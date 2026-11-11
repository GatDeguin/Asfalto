import {packTerrainNormal, VISIBILITY_OBJECT_SHIFT, VISIBILITY_TRIANGLE_MASK} from './virtual-terrain-data.mjs?v=3cb3d32add0067b4';
import {selectTerrainMeshletRange} from './terrain-meshlets.mjs?v=d30e317b7c1b864d';
import {indexedVirtualTerrainSurfaceShader, virtualTerrainSurfaceShader} from './virtual-terrain-surface.wgsl.mjs?v=57870df24a9da57d';

const NAMES = [
  'ROAD_RENDER_WEB_MESH_Primitive_0',
  'TERRAIN_HERO_WEB_MESH_Primitive_0',
  'TERRAIN_TRANSITION_WEB_MESH_Primitive_0',
];
const FLOATS_PER_VERTEX = 8;
const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'asfaltoTerrainRockTexture'];
export function readGaribaldiSurfaceMeshes(THREE, root, vista) {
  const identity = new THREE.Matrix4();
  return [vista, ...NAMES.map(name => root.getObjectByName(name))].map((mesh, i) => {
    const {geometry, material} = mesh || {};
    const index = geometry?.index, attrs = geometry?.attributes;
    if (!mesh?.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.morphTargetInfluences ||
      !mesh.matrixWorld.equals(identity) || !material?.isMeshStandardMaterial || material.side !== THREE.FrontSide ||
      material.transparent || material.alphaTest || material.displacementMap || material.envMap ||
      !attrs?.position?.count || attrs.normal?.count !== attrs.position.count ||
      (i > 0 && (!index?.count || index.count % 3 || geometry.groups.length ||
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
  if (indexCount / 3 > VISIBILITY_TRIANGLE_MASK) throw new RangeError('La ruta excede los IDs de triángulo WebGPU.');
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

export async function createVirtualTerrainSurfaces(device, sources, geometry, signal) {
  const staticSources = sources.slice(1);
  const {vertices, indices} = geometry;
  const owned = [];
  try {
    const indexed = device.features.has('primitive-index');
    const module = device.createShaderModule({label: 'Visibilidad de calzada y terreno',
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
        fragment: {module, entryPoint: 'resolveSurfaceVisibility', targets: [{format: navigator.gpu.getPreferredCanvasFormat()}]}}),
    ]);
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
    const nearFar = new Float32Array(2);
    const parameters = buffer(nearFar, GPUBufferUsage.UNIFORM);
    const range = new Uint32Array(2);
    const meshes = new Set(sources.map(s => s.mesh));
    let submittedTriangles = 0;
    let near, far;
    for (const source of staticSources) source.geometry.computeBoundingBox();
    const entry = (binding, buffer) => ({binding, resource: {buffer}});
    return {
      includes: object => meshes.has(object),
      compatible() {
        return sources.every(s => s.mesh.visible && s.mesh.matrixWorld.equals(s.identity) &&
          s.mesh.material === s.material && s.mesh.geometry === s.geometry && s.geometry.index === s.index &&
          s.index?.version === s.indexVersion && s.geometry.attributes.position === s.position &&
          s.position.version === s.positionVersion && s.geometry.attributes.normal === s.normal &&
          s.normal.version === s.normalVersion && s.geometry.attributes.color === s.tint &&
          s.tint?.version === s.tintVersion && MAP_KEYS.every((key, i) => s.material[key] === s.maps[i]));
      },
      update(camera) {
        if (camera.near === near && camera.far === far) return;
        nearFar[0] = near = camera.near;
        nearFar[1] = far = camera.far;
        device.queue.writeBuffer(parameters, 0, nearFar);
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
            entry(0, frame), {binding: 9, resource: nativeView}, entry(10, depth),
            entry(11, owner), {binding: 12, resource: nativeDepthView}, entry(15, parameters),
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
          if (indexed) pass.drawIndexed(count, 1, first, 0, (s.id << VISIBILITY_OBJECT_SHIFT) | (first / 3));
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
      diagnostics: () => ({submittedTriangles, geometryBytes, indexed, textureBytes: 0,
        objects: sources.map(s => s.mesh.name)}),
      dispose() { for (const resource of owned) resource.destroy(); },
    };
  } catch (error) {
    for (const resource of owned) resource.destroy();
    throw error;
  }
}
