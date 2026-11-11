import {MAX_PROBE_PROXIES, PROBE_PRESETS, PROBE_PROXY_STRIDE} from './probe-radiance-input.mjs?v=83e589831e106c72';
import {probeRadianceShader} from './probe-radiance.wgsl.mjs?v=547c6227816a1de2';

const PARAM_BYTES = (7 + 2 * 4) * 16;
const MAX_TRIANGLES = PROBE_PRESETS.high.triangles;
const NODE_BYTES = MAX_TRIANGLES * 2 * 32;
const TRIANGLE_BYTES = MAX_TRIANGLES * 48;
const PROXY_BYTES = MAX_PROBE_PROXIES * PROBE_PROXY_STRIDE * 4;
const FIELD_BYTES = PROBE_PRESETS.high.bytes;
const QUERY_BYTES = 16;

/** One compute device, one dispatch in flight and one bounded async readback. */
export async function createGpuProbeTracer(gpu = globalThis.navigator?.gpu) {
  const adapter = await gpu?.requestAdapter({powerPreference: 'high-performance'});
  if (!adapter || adapter.info?.isFallbackAdapter || adapter.isFallbackAdapter) return null;
  const hasTimestamp = adapter.features.has('timestamp-query');
  const device = await adapter.requestDevice({requiredFeatures: hasTimestamp ? ['timestamp-query'] : []});
  const allocations = [];
  const U = GPUBufferUsage;
  let disposed = false, lost = null, validation = null, pending = false, geometry = null, queries = null;
  let bufferBytes = 0;
  const fail = event => { validation = event.error.message; event.preventDefault(); };
  device.addEventListener('uncapturederror', fail);
  void device.lost.then(info => { if (!disposed) lost = info.message || info.reason; });

  function buffer(label, size, usage) {
    const result = device.createBuffer({label, size, usage});
    allocations.push(result);
    bufferBytes += size;
    return result;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    device.removeEventListener('uncapturederror', fail);
    for (const allocation of allocations) allocation.destroy();
    queries?.destroy();
    device.destroy();
    bufferBytes = 0;
    geometry = null;
  }

  try {
    const shader = device.createShaderModule({label: 'Radiance probes SDF + BVH', code: probeRadianceShader});
    const compilation = await shader.getCompilationInfo();
    const errors = compilation.messages.filter(message => message.type === 'error');
    if (errors.length) throw new Error(errors.map(message => `${message.lineNum}: ${message.message}`).join('\n'));
    const pipeline = await device.createComputePipelineAsync({
      label: 'Local radiance compute', layout: 'auto', compute: {module: shader, entryPoint: 'traceProbes'},
    });
    const params = buffer('Probe parameters', PARAM_BYTES, U.UNIFORM | U.COPY_DST);
    const nodes = buffer('Local BVH nodes', NODE_BYTES, U.STORAGE | U.COPY_DST);
    const triangles = buffer('Local BVH triangles', TRIANGLE_BYTES, U.STORAGE | U.COPY_DST);
    const sdf = buffer('Rounded SDF proxies', PROXY_BYTES, U.STORAGE | U.COPY_DST);
    const field = buffer('Radiance atlas output', FIELD_BYTES, U.STORAGE | U.COPY_SRC);
    const staging = buffer('Radiance atlas readback', FIELD_BYTES + (hasTimestamp ? QUERY_BYTES : 0), U.MAP_READ | U.COPY_DST);
    queries = hasTimestamp ? device.createQuerySet({type: 'timestamp', count: 2}) : null;
    const resolved = queries ? buffer('Probe GPU timestamps', QUERY_BYTES, U.QUERY_RESOLVE | U.COPY_SRC) : null;
    const bindGroup = device.createBindGroup({layout: pipeline.getBindGroupLayout(0),
      entries: [params, nodes, triangles, sdf, field].map((value, binding) => ({binding, resource: {buffer: value}})),
    });
    const parameters = new ArrayBuffer(PARAM_BYTES);
    const floats = new Float32Array(parameters);
    const ints = new Uint32Array(parameters);

    async function trace({bvh, center, grid, preset, proxies, lighting}) {
      if (disposed || pending) throw new Error('Probe compute is unavailable or busy.');
      if (lost || validation) throw new Error(lost || validation);
      if (bvh.bounds.byteLength > NODE_BYTES || bvh.triangles.byteLength > TRIANGLE_BYTES
        || proxies.data.byteLength > PROXY_BYTES || preset.bytes > FIELD_BYTES) throw new RangeError('Probe GPU budget exceeded.');
      pending = true;
      const started = performance.now();
      try {
        if (geometry !== bvh) {
          device.queue.writeBuffer(nodes, 0, bvh.bounds);
          device.queue.writeBuffer(triangles, 0, bvh.triangles);
          geometry = bvh;
        }
        if (proxies.count) device.queue.writeBuffer(sdf, 0, proxies.data, 0, proxies.count * PROBE_PROXY_STRIDE);
        floats.set([...grid.origin.map((value, index) => value - center[index]), preset.traceDistance], 0);
        floats.set([preset.spacing, preset.height, preset.spacing, 0], 4);
        ints.set([preset.size, bvh.nodeCount, proxies.count, preset.rays], 8);
        floats.set([...lighting.direction, lighting.intensity], 12);
        floats.set([...lighting.color, 0], 16);
        floats.set([...lighting.sky, 0], 20);
        floats.set([...lighting.ground, 0], 24);
        floats.fill(0, 28);
        for (const [index, spot] of (lighting.headlights || []).slice(0, 2).entries()) {
          const offset = 28 + index * 16;
          floats.set([...spot.position.map((value, axis) => value - center[axis]), Math.min(34, spot.range)], offset);
          floats.set([...spot.direction, spot.outer], offset + 4);
          floats.set([...spot.color, spot.intensity], offset + 8);
          floats.set([spot.inner, spot.decay, 0, 0], offset + 12);
        }
        device.queue.writeBuffer(params, 0, parameters);
        const encoder = device.createCommandEncoder({label: 'Trace local probe atlas'});
        const timestampWrites = queries ? {querySet: queries, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1} : undefined;
        const pass = encoder.beginComputePass({timestampWrites});
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(preset.size * preset.size / 2));
        pass.end();
        encoder.copyBufferToBuffer(field, 0, staging, 0, preset.bytes);
        if (queries) {
          encoder.resolveQuerySet(queries, 0, 2, resolved, 0);
          encoder.copyBufferToBuffer(resolved, 0, staging, FIELD_BYTES, QUERY_BYTES);
        }
        device.queue.submit([encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        try {
          const range = staging.getMappedRange();
          const data = new Uint8Array(range, 0, preset.bytes).slice();
          const ticks = queries ? new BigUint64Array(range, FIELD_BYTES, 2) : null;
          const gpuMs = ticks && ticks[1] >= ticks[0] ? Number(ticks[1] - ticks[0]) / 1e6 : null;
          if (lost || validation) throw new Error(lost || validation);
          return {data, gpuMs, turnaroundMs: performance.now() - started};
        } finally {
          if (!disposed) staging.unmap();
        }
      } finally {
        pending = false;
      }
    }

    return {trace, dispose, diagnostics: () => ({pending, disposed, error: lost || validation, bufferBytes,
      timestampQuery: hasTimestamp, adapter: adapter.info?.description || adapter.info?.architecture || null})};
  } catch (error) {
    dispose();
    throw error;
  }
}
