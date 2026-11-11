export const TERRAIN_MESHLET_MAX_VERTICES = 64;
export const TERRAIN_MESHLET_MAX_TRIANGLES = 124;

const layouts = new WeakMap();
const fringeM = 0.05;

function validateTree(data, indexCount) {
  if (!data) return false;
  const {nodes, bounds, vertexCounts} = data;
  if (!(nodes instanceof Uint32Array && bounds instanceof Float32Array && vertexCounts instanceof Uint8Array) ||
      !vertexCounts.length || nodes.length !== (vertexCounts.length * 2 - 1) * 3 ||
      bounds.length !== nodes.length * 2 || nodes[0] !== 0 || nodes[1] !== indexCount) return false;

  let leaf = 0;
  function visit(node, limit, start, end, parentBounds, depth) {
    const i = node * 3, b = node * 6;
    if (node >= limit || depth > 32 || nodes[i] !== start || nodes[i + 1] !== end || start >= end) return false;
    for (let axis = 0; axis < 3; axis++) {
      const min = bounds[b + axis], max = bounds[b + axis + 3];
      if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return false;
      if (parentBounds >= 0 && (min < bounds[parentBounds + axis] || max > bounds[parentBounds + axis + 3])) return false;
    }
    const right = nodes[i + 2];
    if (!right) {
      const count = vertexCounts[leaf++];
      return limit === node + 1 && start % 3 === 0 && end % 3 === 0 &&
        end - start <= TERRAIN_MESHLET_MAX_TRIANGLES * 3 && count > 0 && count <= TERRAIN_MESHLET_MAX_VERTICES;
    }
    if (right <= node + 1 || right >= limit) return false;
    const middle = nodes[right * 3];
    return visit(node + 1, right, start, middle, b, depth + 1) && visit(right, limit, middle, end, b, depth + 1);
  }
  return visit(0, nodes.length / 3, 0, indexCount, -1, 0) && leaf === vertexCounts.length;
}

// The original triangle order stays intact. Find just the two edges of a
// conservative interval so the renderer issues at most the original one draw.
export function createMeshletCuller({nodes, bounds}) {
  let planes;
  function findEdge(node, mask, trailing) {
    const box = node * 6;
    const minX = bounds[box], minY = bounds[box + 1], minZ = bounds[box + 2];
    const maxX = bounds[box + 3], maxY = bounds[box + 4], maxZ = bounds[box + 5];
    for (let i = 0; i < 6 && mask; i++) {
      const bit = 1 << i;
      if (!(mask & bit)) continue;
      const {normal: {x, y, z}, constant} = planes[i];
      const outer = x * (x < 0 ? minX : maxX) + y * (y < 0 ? minY : maxY) + z * (z < 0 ? minZ : maxZ) + constant;
      if (outer < -fringeM) return -1;
      const inner = x * (x < 0 ? maxX : minX) + y * (y < 0 ? maxY : minY) + z * (z < 0 ? maxZ : minZ) + constant;
      if (inner >= fringeM) mask ^= bit;
    }
    const i = node * 3, right = nodes[i + 2];
    if (!mask || !right) return nodes[i + (trailing ? 1 : 0)];
    const first = trailing ? right : node + 1;
    const edge = findEdge(first, mask, trailing);
    return edge >= 0 ? edge : findEdge(trailing ? node + 1 : right, mask, trailing);
  }

  return function select(viewPlanes, range) {
    planes = viewPlanes;
    const start = findEdge(0, 63, false);
    if (start < 0) return false;
    range[0] = start;
    range[1] = findEdge(0, 63, true);
    return true;
  };
}

export function registerTerrainMeshlets(geometry, data) {
  const {index, attributes} = geometry;
  const position = attributes.position;
  if (!index || !position || geometry.groups.length || !validateTree(data, index.count)) return false;
  layouts.set(geometry, {index, position, indexVersion: index.version, positionVersion: position.version,
    select: createMeshletCuller(data)});
  return true;
}

export function installTerrainMeshletRanges(THREE, renderer, {enabled = () => true} = {}) {
  if (!renderer.isWebGLRenderer) return null;
  const original = renderer.renderBufferDirect;
  const projection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  const range = new Uint32Array(2), clip = {start: 0, count: 0, materialIndex: 0};
  let disposed = false;
  function draw(camera, scene, geometry, material, object, group) {
    const layout = layouts.get(geometry);
    if (layout && !disposed && group == null && !material.transparent && !material.displacementMap &&
        !object.isInstancedMesh && !object.isSkinnedMesh && !object.morphTargetInfluences &&
        geometry.index === layout.index && geometry.index.version === layout.indexVersion &&
        geometry.attributes.position === layout.position && layout.position.version === layout.positionVersion &&
        geometry.drawRange.start === 0 && geometry.drawRange.count >= layout.index.count && enabled()) {
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(object.matrixWorld);
      frustum.setFromProjectionMatrix(projection, THREE.WebGLCoordinateSystem, camera.reversedDepth);
      if (!layout.select(frustum.planes, range)) return;
      if (range[0] !== 0 || range[1] !== layout.index.count) {
        clip.start = range[0];
        clip.count = range[1] - range[0];
        group = clip;
      }
    }
    return original.call(this, camera, scene, geometry, material, object, group);
  }
  renderer.renderBufferDirect = draw;
  return {dispose() {
    disposed = true;
    if (renderer.renderBufferDirect === draw) renderer.renderBufferDirect = original;
  }};
}
