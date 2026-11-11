import {packTerrainNormal} from './virtual-terrain-data.mjs?v=09bc75160261c900';
import {selectTerrainMeshletRange} from './terrain-meshlets.mjs?v=d30e317b7c1b864d';
import {prepareSurfaceSky} from './virtual-terrain-sky.mjs?v=63f27700e259634a';
import {indexedVirtualTerrainSurfaceShader, virtualTerrainSurfaceShader} from './virtual-terrain-surface.wgsl.mjs?v=a9647329392463c4';

const NAMES = [
  'ROAD_RENDER_WEB_MESH_Primitive_0',
  'TERRAIN_HERO_WEB_MESH_Primitive_0',
  'TERRAIN_TRANSITION_WEB_MESH_Primitive_0',
];
const MAX_TEXTURE_BYTES = 48 * 1024 * 1024;
const FLOATS_PER_VERTEX = 8;
const SURFACE_FRAME_FLOATS = 124;
const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'asfaltoTerrainRockTexture'];
const MIP_SHADER = /* wgsl */ `
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var linear: sampler;
@vertex fn vertex(@builtin(vertex_index) i: u32) -> Vertex {
  let p = array<vec2f,3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0))[i];
  return Vertex(vec4f(p, 0.0, 1.0), p * vec2f(0.5, -0.5) + 0.5);
}
@fragment fn fragment(in: Vertex) -> @location(0) vec4f {
  return textureSampleLevel(tex, linear, in.uv, 0.0);
}
`;

export function readGaribaldiSurfaceMeshes(THREE, root, vista) {
  const identity = new THREE.Matrix4();
  return [vista, ...NAMES.map(name => root.getObjectByName(name))].map((mesh, i) => {
    const {geometry, material} = mesh || {};
    const index = geometry?.index, attrs = geometry?.attributes;
    if (!mesh?.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.morphTargetInfluences ||
      !mesh.matrixWorld.equals(identity) || !material?.isMeshStandardMaterial || material.side !== THREE.FrontSide ||
      material.transparent || material.alphaTest || material.displacementMap || material.envMap ||
      !attrs?.position || attrs.normal?.count !== attrs.position.count ||
      (i > 0 && (!index || index.count % 3 || geometry.groups.length ||
        geometry.drawRange.start !== 0 || geometry.drawRange.count < index.count))) {
      throw new Error('Geometría WebGPU de calzada o terreno incompatible.');
    }
    return {id: i + 1, mesh, geometry, material, identity, index, position: attrs.position, normal: attrs.normal,
      tint: attrs.color, indexVersion: index?.version, positionVersion: attrs.position.version,
      normalVersion: attrs.normal.version, tintVersion: attrs.color?.version, maps: MAP_KEYS.map(key => material[key])};
  });
}

export async function packGaribaldiSurfaces(sources, signal, yieldFrame = () => Promise.resolve()) {
  const vertexCount = sources.reduce((n, s) => n + s.position.count, 0);
  const indexCount = sources.reduce((n, s) => n + s.index.count, 0);
  if (indexCount / 3 > 16777215) throw new RangeError('La ruta excede los IDs de triángulo WebGPU.');
  const vertices = new Float32Array(vertexCount * FLOATS_PER_VERTEX);
  const indices = new Uint32Array(indexCount);
  let vertexStart = 0, indexStart = 0;
  for (const surface of sources) {
    await yieldFrame();
    signal?.throwIfAborted();
    const {position, index, geometry, material} = surface;
    const {normal, color} = geometry.attributes;
    const tint = material.vertexColors && color?.count === position.count ? color : null;
    const strength = surface.id === 2 || material.userData.asfaltoVertexVariation ? 1 : 0.025;
    for (let i = 0; i < position.count; i++) {
      const at = (vertexStart + i) * FLOATS_PER_VERTEX;
      vertices[at] = position.getX(i);
      vertices[at + 1] = position.getY(i);
      vertices[at + 2] = position.getZ(i);
      vertices[at + 3] = packTerrainNormal(normal.getX(i), normal.getY(i), normal.getZ(i));
      vertices[at + 4] = tint ? 1 + (tint.getX(i) - 1) * strength : 1;
      vertices[at + 5] = tint ? 1 + (tint.getY(i) - 1) * strength : 1;
      vertices[at + 6] = tint ? 1 + (tint.getZ(i) - 1) * strength : 1;
    }
    for (let i = 0; i < index.count; i++) {
      const v = index.getX(i);
      if (v >= position.count || v < 0) throw new RangeError('Índice WebGPU fuera de la geometría de Garibaldi.');
      indices[indexStart + i] = vertexStart + v;
    }
    surface.first = indexStart;
    vertexStart += position.count;
    indexStart += index.count;
  }
  return {vertices, indices};
}

async function createSurfaceMaps(device, maps, sky, owned, signal) {
  const sources = maps.map(({texture, color}) => {
    const image = texture?.image;
    const width = image?.naturalWidth || image?.width;
    const height = image?.naturalHeight || image?.height;
    if (!(width > 0 && height > 0 && width <= device.limits.maxTextureDimension2D &&
      height <= device.limits.maxTextureDimension2D)) throw new Error('Falta un mapa de material WebGPU.');
    const levels = 1 + Math.floor(Math.log2(Math.max(width, height)));
    let bytes = 0;
    for (let mip = 0; mip < levels; mip++) bytes += Math.max(1, width >> mip) * Math.max(1, height >> mip) * 4;
    return {texture, image, width, height, levels, bytes, format: color ? 'rgba8unorm-srgb' : 'rgba8unorm'};
  });
  const skyLevels = 1 + Math.floor(Math.log2(Math.max(sky.width, sky.height)));
  let skyBytes = 0;
  for (let mip = 0; mip < skyLevels; mip++) skyBytes += Math.max(1, sky.width >> mip) * Math.max(1, sky.height >> mip) * 8;
  sources.push({width: sky.width, height: sky.height, levels: skyLevels, bytes: skyBytes, format: 'rgba16float', data: sky.data});
  if (sources.reduce((bytes, s) => bytes + s.bytes, 0) > MAX_TEXTURE_BYTES) throw new Error('Mapas WebGPU fuera del presupuesto.');
  const module = device.createShaderModule({label: 'Mipmaps de calzada y terreno', code: MIP_SHADER});
  const variants = new Map(await Promise.all([...new Set(sources.map(x => x.format))].map(async format => [
    format, await device.createRenderPipelineAsync({layout: 'auto', vertex: {module, entryPoint: 'vertex'},
      fragment: {module, entryPoint: 'fragment', targets: [{format}]}}),
  ])));
  signal?.throwIfAborted();
  const linear = device.createSampler({minFilter: 'linear', magFilter: 'linear'});
  const encoder = device.createCommandEncoder({label: 'Mipmaps de mapas PBR de Garibaldi'});
  const views = sources.map(({texture, image, data, width, height, levels, format}) => {
    const gpu = device.createTexture({label: data ? 'Panorama HDR de Garibaldi' : image.src?.split('/').at(-1) || 'Mapa de Garibaldi',
      size: {width, height}, format, mipLevelCount: levels,
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING});
    owned.push(gpu);
    if (data) device.queue.writeTexture({texture: gpu}, data, {bytesPerRow: width * 8}, {width, height});
    else device.queue.copyExternalImageToTexture({source: image, flipY: texture.flipY}, {texture: gpu}, {width, height});
    const pipeline = variants.get(format);
    for (let mip = 1; mip < levels; mip++) {
      const bind = device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [
        {binding: 0, resource: gpu.createView({baseMipLevel: mip - 1, mipLevelCount: 1})},
        {binding: 1, resource: linear},
      ]});
      const pass = encoder.beginRenderPass({colorAttachments: [
        {view: gpu.createView({baseMipLevel: mip, mipLevelCount: 1}), loadOp: 'clear', storeOp: 'store'},
      ]});
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.draw(3);
      pass.end();
    }
    return gpu.createView();
  });
  device.queue.submit([encoder.finish()]);
  const sampler = device.createSampler({addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear',
    minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8});
  const skySampler = device.createSampler({addressModeU: 'repeat', magFilter: 'linear',
    minFilter: 'linear', mipmapFilter: 'linear'});
  return {sampler, skySampler, views, skyLevels, textureBytes: sources.reduce((bytes, s) => bytes + s.bytes, 0)};
}

export async function createVirtualTerrainSurfaces(THREE, device, root, vista, lighting, signal) {
  const sources = readGaribaldiSurfaceMeshes(THREE, root, vista);
  const staticSources = sources.slice(1);
  const [{material: terrain}, {material: road}] = sources;
  const textureMaps = [
    [terrain.map, true], [terrain.normalMap], [terrain.roughnessMap], [terrain.asfaltoTerrainRockTexture, true],
    [road.map, true], [road.normalMap], [road.roughnessMap],
  ].map(([texture, color]) => ({texture, color}));
  if (sources.slice(2).some(({material}) => MAP_KEYS
    .some(key => material[key] !== terrain[key]))) throw new Error('Los mapas de relieve WebGPU deben coincidir.');
  const {vertices, indices} = await packGaribaldiSurfaces(staticSources, signal,
    () => new Promise(resolve => setTimeout(resolve, 0)));
  signal.throwIfAborted();
  const owned = [];
  try {
    const indexed = device.features.has('primitive-index');
    const module = device.createShaderModule({label: 'Visibilidad y materiales de Garibaldi',
      code: indexed ? indexedVirtualTerrainSurfaceShader : virtualTerrainSurfaceShader});
    const info = await module.getCompilationInfo();
    const error = info.messages.find(m => m.type === 'error');
    if (error) throw new Error(`Superficies WGSL, línea ${error.lineNum}: ${error.message}`);
    signal.throwIfAborted();
    const visibilityPipeline = (vertex, fragment) => device.createRenderPipelineAsync({
      layout: 'auto', vertex: {module, entryPoint: vertex}, primitive: {cullMode: 'back'},
      fragment: {module, entryPoint: fragment, targets: [{format: 'r32uint'}]},
      depthStencil: {format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater-equal'},
    });
    const [visibility, vistaVisibility, resolve] = await Promise.all([
      indexed ? visibilityPipeline('indexedSurfaceVertex', 'indexedSurfaceFragment') :
        visibilityPipeline('surfaceVertex', 'surfaceIdFragment'),
      visibilityPipeline('surfaceVistaVertex', 'surfaceIdFragment'),
      device.createRenderPipelineAsync({layout: 'auto', vertex: {module, entryPoint: 'fullscreen'},
        fragment: {module, entryPoint: 'resolveSurface', targets: [{format: navigator.gpu.getPreferredCanvasFormat()}]}}),
    ]);
    signal.throwIfAborted();
    const panorama = lighting.skyTexture?.();
    const sky = lighting.skyTexture ? prepareSurfaceSky(THREE, panorama) :
      {data: new Uint16Array([0,0,0,0x3c00]), width:1, height:1, irradiance:new Float32Array(36)};
    const maps = await createSurfaceMaps(device, textureMaps, sky, owned, signal);
    signal.throwIfAborted();
    function buffer(data, usage) {
      const result = device.createBuffer({size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST});
      owned.push(result);
      device.queue.writeBuffer(result, 0, data);
      return result;
    }
    const staticVertices = buffer(vertices, GPUBufferUsage.STORAGE);
    const staticIndices = buffer(indices, GPUBufferUsage.STORAGE | (indexed ? GPUBufferUsage.INDEX : 0));
    const geometryBytes = vertices.byteLength + indices.byteLength;
    const state = new Float32Array(SURFACE_FRAME_FLOATS);
    state.set(sky.irradiance, 88);
    state[87] = maps.skyLevels - 1;
    const parameters = buffer(state, GPUBufferUsage.UNIFORM);
    const range = new Uint32Array(2);
    const direction = new THREE.Vector3(), target = new THREE.Vector3();
    const clip = new THREE.Vector4(), rotation = new THREE.Matrix3();
    const origin = new THREE.Vector3(), rayX = new THREE.Vector3(), rayY = new THREE.Vector3();
    const meshes = new Set(sources.map(s => s.mesh));
    let submittedTriangles = 0;
    for (const source of staticSources) source.geometry.computeBoundingBox();
    const entry = (binding, buffer) => ({binding, resource: {buffer}});
    function unprojectRay(camera, x, y, result) {
      clip.set(x, y, 0, 1).applyMatrix4(camera.projectionMatrixInverse);
      return result.set(clip.x / -clip.z, clip.y / -clip.z, -1).applyMatrix3(rotation);
    }
    return {
      includes: object => meshes.has(object),
      compatible() {
        return (!panorama || lighting.skyTexture() === panorama) &&
          sources.every(s => s.mesh.visible && s.mesh.matrixWorld.equals(s.identity) &&
          s.mesh.material === s.material && s.mesh.geometry === s.geometry && s.geometry.index === s.index &&
          s.index?.version === s.indexVersion && s.geometry.attributes.position === s.position &&
          s.position.version === s.positionVersion && s.geometry.attributes.normal === s.normal &&
          s.normal.version === s.normalVersion && s.geometry.attributes.color === s.tint &&
          s.tint?.version === s.tintVersion && MAP_KEYS.every((key, i) => s.material[key] === s.maps[i]));
      },
      update(camera, width, height) {
        rotation.setFromMatrix4(camera.matrixWorld);
        unprojectRay(camera, -1, 1, origin).toArray(state, 0);
        unprojectRay(camera, 1, 1, rayX).sub(origin).divideScalar(width).toArray(state, 4);
        unprojectRay(camera, -1, -1, rayY).sub(origin).divideScalar(height).toArray(state, 8);
        target.setFromMatrixPosition(camera.matrixWorld).toArray(state, 12);
        for (const [i, light] of lighting.directional.entries()) {
          const at = 16 + i * 8;
          direction.copy(light.position).sub(light.target.position).normalize().toArray(state, at);
          const power = light.visible ? light.intensity : 0;
          state.set([light.color.r * power, light.color.g * power, light.color.b * power, 0], at + 4);
        }
        const {hemisphere: hemi} = lighting;
        const ambient = hemi.visible ? hemi.intensity : 0;
        state.set([hemi.color.r * ambient, hemi.color.g * ambient, hemi.color.b * ambient, 0], 40);
        state.set([hemi.groundColor.r * ambient, hemi.groundColor.g * ambient, hemi.groundColor.b * ambient, 0], 44);
        for (const [i, {material: m}] of sources.entries()) {
          state.set([m.color.r, m.color.g, m.color.b, m.roughness, m.userData.asfaltoSurfaceMetres,
            m.normalScale.x, 0, 0], 48 + i * 8);
        }
        state[80] = camera.near;
        state[81] = camera.far;
        const yaw = lighting.skyYaw?.() || 0;
        state[84] = panorama ? lighting.skyIntensity() : 0;
        state[85] = Math.cos(yaw);
        state[86] = Math.sin(yaw);
        device.queue.writeBuffer(parameters, 0, state);
      },
      bindings({frame, vertices, large, depth, owner, nativeView, nativeDepthView}) {
        return {
          visibility: device.createBindGroup({layout: visibility.getBindGroupLayout(0), entries: [
            entry(0, frame), entry(13, staticVertices), ...(!indexed ? [entry(14, staticIndices)] : []), entry(15, parameters),
          ]}),
          vista: device.createBindGroup({layout: vistaVisibility.getBindGroupLayout(0), entries: [
            entry(0, frame), entry(1, vertices), entry(8, large), entry(15, parameters),
          ]}),
          resolve: device.createBindGroup({layout: resolve.getBindGroupLayout(0), entries: [
            entry(0, frame), entry(1, vertices), {binding: 9, resource: nativeView}, entry(10, depth),
            entry(11, owner), {binding: 12, resource: nativeDepthView}, entry(13, staticVertices),
            entry(14, staticIndices), entry(15, parameters), {binding: 16, resource: maps.sampler},
            ...maps.views.map((resource, i) => ({binding: 17 + i, resource})),
            {binding: 25, resource: maps.skySampler},
          ]}),
        };
      },
      drawVisibility(pass, bind, frustum) {
        submittedTriangles = 0;
        pass.setPipeline(visibility);
        pass.setBindGroup(0, bind);
        if (indexed) pass.setIndexBuffer(staticIndices, 'uint32');
        for (const s of staticSources) {
          if (!frustum.intersectsBox(s.geometry.boundingBox)) continue;
          const found = selectTerrainMeshletRange(s.geometry, frustum.planes, range);
          if (found === false) continue;
          const start = found ? range[0] : 0;
          const count = found ? range[1] - start : s.index.count;
          const first = s.first + start;
          if (indexed) pass.drawIndexed(count, 1, first, 0, (s.id << 24) | (first / 3));
          else pass.draw(count, 1, first, s.id);
          submittedTriangles += count / 3;
        }
      },
      drawVista(pass, bind, args) {
        pass.setPipeline(vistaVisibility);
        pass.setBindGroup(0, bind);
        pass.drawIndirect(args, 0);
      },
      drawResolve(pass, bind) {
        pass.setPipeline(resolve);
        pass.setBindGroup(0, bind);
        pass.draw(3);
      },
      diagnostics: () => ({submittedTriangles, geometryBytes, indexed,
        textureBytes: maps.textureBytes, objects: sources.map(s => s.mesh.name)}),
      dispose() { for (const resource of owned) resource.destroy(); },
    };
  } catch (error) {
    for (const resource of owned) resource.destroy();
    throw error;
  }
}
