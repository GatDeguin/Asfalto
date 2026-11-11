import {MAX_PAGE_TRIANGLES, MAX_TERRAIN_PAGES, TERRAIN_DETAIL_SLOTS, TRIANGLE_BYTES} from './virtual-terrain-data.mjs?v=09bc75160261c900';
import {virtualTerrainShader} from './virtual-terrain-raster.wgsl.mjs?v=2a2c51069349da11';

const SLOT_BYTES = MAX_PAGE_TRIANGLES * TRIANGLE_BYTES;
const FRAME_BYTES = 80;
const DRAW_ARGS = new Uint32Array([0, 1, 0, 0]);
const MAX_PIXELS = 1920 * 1080;

export async function createVirtualTerrainRaster(device, {canvas, slots, doubleSided}) {
  const format = navigator.gpu.getPreferredCanvasFormat();
  const context = canvas.getContext('webgpu');
  if (!context || !Number.isInteger(slots) || slots < 1 || slots > MAX_TERRAIN_PAGES + TERRAIN_DETAIL_SLOTS ||
    slots * MAX_PAGE_TRIANGLES > 65535) {
    throw new Error('Contexto de geometría virtualizada no disponible.');
  }
  const module = device.createShaderModule({label: 'Rasterización de microtriángulos', code: virtualTerrainShader});
  const compilation = await module.getCompilationInfo();
  const error = compilation.messages.find(entry => entry.type === 'error');
  if (error) throw new Error(`Raster WGSL, línea ${error.lineNum}: ${error.message}`);

  const [depthPipeline, ownerPipeline, nativePipeline, resolvePipeline] = await Promise.all([
    device.createComputePipelineAsync({layout: 'auto', compute: {module, entryPoint: 'rasterDepth'}}),
    device.createComputePipelineAsync({layout: 'auto', compute: {module, entryPoint: 'rasterOwner'}}),
    device.createRenderPipelineAsync({
      layout: 'auto', vertex: {module, entryPoint: 'nativeVertex'},
      primitive: {cullMode: doubleSided ? 'none' : 'back'},
      depthStencil: {format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater-equal'},
      fragment: {module, entryPoint: 'nativeFragment', targets: [{format: 'r32uint'}]},
    }),
    device.createRenderPipelineAsync({
      layout: 'auto', vertex: {module, entryPoint: 'fullscreen'},
      fragment: {module, entryPoint: 'resolveVisibility', targets: [{format}]},
    }),
  ]);
  context.configure({device, format, alphaMode: 'opaque'});
  const frame = device.createBuffer({size: FRAME_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  const vertices = device.createBuffer({size: slots * SLOT_BYTES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
  const pages = device.createBuffer({size: MAX_TERRAIN_PAGES * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
  const large = device.createBuffer({size: slots * MAX_PAGE_TRIANGLES * 4, usage: GPUBufferUsage.STORAGE});
  const args = device.createBuffer({size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST |
    GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC});
  const counters = device.createBuffer({size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST});
  const readback = device.createBuffer({size: 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
  const timestamps = device.features.has('timestamp-query') ? device.createQuerySet({type: 'timestamp', count: 2}) : null;
  const queryResult = timestamps ? device.createBuffer({size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC}) : null;
  const uniforms = new ArrayBuffer(FRAME_BYTES);
  const floats = new Float32Array(uniforms);
  const uints = new Uint32Array(uniforms);
  const selectedPages = new Uint32Array(MAX_TERRAIN_PAGES * 2);
  let targets = null;
  let disposed = false;
  let pending = false;
  let lastSample = -Infinity;
  let samples = null;

  function bind(pipeline, buffers, views = []) {
    return device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [
      ...buffers.map(([binding, buffer]) => ({binding, resource: {buffer}})),
      ...views.map(([binding, resource]) => ({binding, resource})),
    ]});
  }

  const nativeBind = bind(nativePipeline, [[0, frame], [1, vertices], [8, large]]);

  function releaseTargets() {
    if (!targets) return;
    targets.depth.destroy();
    targets.owner.destroy();
    targets.native.destroy();
    targets.nativeDepth.destroy();
    targets = null;
  }

  function fits(width, height) {
    return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
      width * height <= MAX_PIXELS && width <= device.limits.maxTextureDimension2D &&
      height <= device.limits.maxTextureDimension2D && width * height * 4 <= device.limits.maxStorageBufferBindingSize;
  }

  function resize(width, height) {
    if (targets?.width === width && targets.height === height) return;
    releaseTargets();
    canvas.width = width;
    canvas.height = height;
    const size = {width, height};
    const buffer = () => device.createBuffer({size: width * height * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
    const depth = buffer();
    const owner = buffer();
    const rasterOutput = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const native = device.createTexture({size, format: 'r32uint', usage: rasterOutput});
    const nativeDepth = device.createTexture({size, format: 'depth32float', usage: rasterOutput});
    targets = {width, height, depth, owner, native, nativeDepth};
    targets.nativeView = native.createView();
    targets.nativeDepthView = nativeDepth.createView();
    const common = [[0, frame], [1, vertices], [2, pages], [3, depth]];
    // WGSL resources are shared by the two specialized kernels; auto layout
    // includes both branches of raster() even when a literal selects one.
    const bindings = [...common, [4, owner], [5, large], [6, args], [7, counters]];
    targets.depthBind = bind(depthPipeline, bindings);
    targets.ownerBind = bind(ownerPipeline, bindings);
    targets.resolveBind = bind(resolvePipeline, [[0, frame], [10, depth], [11, owner]],
      [[9, targets.nativeView], [12, targets.nativeDepthView]]);
  }

  function submit(selected, matrix, far, width, height, now = performance.now()) {
    if (disposed || !selected.length || !fits(width, height)) return false;
    if (selected.length > MAX_TERRAIN_PAGES) throw new RangeError('Demasiadas páginas en el rasterizador.');
    resize(width, height);
    floats.set(matrix, 0);
    uints[16] = width;
    uints[17] = height;
    floats[18] = 1 / Math.log2(far + 1);
    const sample = !pending && now - lastSample >= 850;
    uints[19] = Number(doubleSided) | (sample ? 2 : 0);
    let maximum = 0;
    for (const [i, entry] of selected.entries()) {
      const {slot, triangles, objectId} = entry;
      if (!Number.isInteger(slot) || slot < 0 || slot >= slots ||
        !Number.isInteger(triangles) || triangles < 1 || triangles > MAX_PAGE_TRIANGLES ||
        !Number.isInteger(objectId) || objectId < 1 || objectId > 255) {
        throw new RangeError('Identificador de visibilidad fuera de la reserva GPU.');
      }
      selectedPages[i * 2] = (objectId << 16) | slot;
      selectedPages[i * 2 + 1] = entry.triangles;
      maximum = Math.max(maximum, entry.triangles);
    }
    device.queue.writeBuffer(frame, 0, uniforms);
    device.queue.writeBuffer(pages, 0, selectedPages, 0, selected.length * 2);
    device.queue.writeBuffer(args, 0, DRAW_ARGS);
    const encoder = device.createCommandEncoder({label: 'Terreno virtual'});
    encoder.clearBuffer(targets.depth);
    encoder.clearBuffer(targets.owner);
    if (sample) encoder.clearBuffer(counters);
    const groups = Math.ceil(maximum / 64);
    const depthPass = encoder.beginComputePass(sample && timestamps ?
      {timestampWrites: {querySet: timestamps, beginningOfPassWriteIndex: 0}} : {});
    depthPass.setPipeline(depthPipeline);
    depthPass.setBindGroup(0, targets.depthBind);
    depthPass.dispatchWorkgroups(groups, selected.length);
    depthPass.end();

    const ownerPass = encoder.beginComputePass();
    ownerPass.setPipeline(ownerPipeline);
    ownerPass.setBindGroup(0, targets.ownerBind);
    ownerPass.dispatchWorkgroups(groups, selected.length);
    ownerPass.end();

    const nativePass = encoder.beginRenderPass({
      colorAttachments: [{view: targets.nativeView, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0]}],
      depthStencilAttachment: {view: targets.nativeDepthView, depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 0},
    });
    nativePass.setPipeline(nativePipeline);
    nativePass.setBindGroup(0, nativeBind);
    nativePass.drawIndirect(args, 0);
    nativePass.end();

    const resolvePass = encoder.beginRenderPass({
      colorAttachments: [{view: context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store',
        clearValue: [0, 0, 0, 1]}],
      ...(sample && timestamps && {timestampWrites: {querySet: timestamps, endOfPassWriteIndex: 1}}),
    });
    resolvePass.setPipeline(resolvePipeline);
    resolvePass.setBindGroup(0, targets.resolveBind);
    resolvePass.draw(3);
    resolvePass.end();
    if (sample) {
      encoder.copyBufferToBuffer(counters, 0, readback, 0, 4);
      encoder.copyBufferToBuffer(args, 0, readback, 4, 4);
      if (timestamps) {
        encoder.resolveQuerySet(timestamps, 0, 2, queryResult, 0);
        encoder.copyBufferToBuffer(queryResult, 0, readback, 16, 16);
      }
    }
    device.queue.submit([encoder.finish()]);
    if (sample) {
      lastSample = now;
      pending = true;
      void readback.mapAsync(GPUMapMode.READ).then(() => {
        if (disposed) return;
        const bytes = readback.getMappedRange();
        const [microTriangles, hardwareVertices] = new Uint32Array(bytes, 0, 2);
        const ticks = timestamps ? new BigUint64Array(bytes, 16, 2) : null;
        samples = {microTriangles, hardwareTriangles: hardwareVertices / 3, gpuMs: ticks && ticks[1] >= ticks[0] ?
          Number(ticks[1] - ticks[0]) / 1e6 : null, width, height, visibilityBytes: width * height * 4};
        readback.unmap();
      }).catch(() => {}).finally(() => { pending = false; });
    }
    return true;
  }

  return {
    fits, submit, diagnostics: () => samples,
    releaseViewport() {
      if (!targets) return;
      releaseTargets();
      canvas.width = canvas.height = 1;
    },
    upload(slot, verticesData) {
      if (disposed || slot < 0 || slot >= slots || verticesData.byteLength > SLOT_BYTES) throw new Error('Página fuera de la reserva GPU.');
      device.queue.writeBuffer(vertices, slot * SLOT_BYTES, verticesData);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseTargets();
      for (const resource of [frame, vertices, pages, large, args, counters, readback, timestamps, queryResult]) resource?.destroy();
      context.unconfigure();
    },
  };
}
