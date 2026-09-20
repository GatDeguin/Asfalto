import {runCooperatively} from '../../runtime/cooperative-work.mjs?v=529f3ae5a1f59485';
// Close the open underside of authored terrain sheets, without moving their top surface.
// Walls stay on the existing boundary in X/Z and exclude the entire drivable corridor.
function* closeTerrainEdgesSteps(THREE, mesh, { query, floorY, roadMarginM = 20, talus = false } = {}) {
  if (!mesh?.isMesh || /^COLLISION_/.test(mesh.name) || !query?.project || !Number.isFinite(floorY)) return null;
  if (mesh.userData.asfaltoEdgeClosure) return mesh.userData.asfaltoEdgeClosure;
  const source = mesh.geometry, p = source?.attributes?.position;
  if (!p) return null;
  mesh.updateWorldMatrix(true, false);
  const canonical = new Map(), ids = new Uint32Array(p.count), representative = [];
  for (let i = 0; i < p.count; i++) {
    if(i%512===0)yield;
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(value => Math.round(value * 1000)).join(':');
    if (!canonical.has(key)) { canonical.set(key, canonical.size); representative.push(i); }
    ids[i] = canonical.get(key);
  }
  const edges = new Map(), index = source.index, count = index?.count || p.count;
  const edge = (a, b, opposite) => {
    if (a === b) return;
    const key = a < b ? a + ':' + b : b + ':' + a;
    const value = edges.get(key);
    if (value) value.count++;
    else edges.set(key, { a: representative[a], b: representative[b], opposite: representative[opposite], count: 1 });
  };
  for (let i = 0; i < count; i += 3) {
    if(i%1536===0)yield;
    const a = ids[index ? index.getX(i) : i], b = ids[index ? index.getX(i + 1) : i + 1], c = ids[index ? index.getX(i + 2) : i + 2];
    edge(a, b, c); edge(b, c, a); edge(c, a, b);
  }
  const positions = [], uv = [], indices = [], wallVertices = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), bottomA = new THREE.Vector3(), bottomB = new THREE.Vector3();
  const inverse = mesh.matrixWorld.clone().invert();
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const metres = material?.userData?.asfaltoSurfaceMetres || 50;
  let boundaryEdges = 0, skippedRoadEdges = 0;
  const directions = new Map(), profiles = new Map(), other = new THREE.Vector3();
  if (talus) for (const value of edges.values()) {
    if (value.count !== 1) continue;
    a.fromBufferAttribute(p, value.a).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(p, value.b).applyMatrix4(mesh.matrixWorld);
    other.fromBufferAttribute(p, value.opposite).applyMatrix4(mesh.matrixWorld);
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const sign = dz * (other.x - a.x) - dx * (other.z - a.z) > 0 ? -1 : 1;
    for (const vertex of [value.a, value.b]) {
      const key = ids[vertex], direction = directions.get(key) || [0, 0];
      direction[0] += dz / length * sign; direction[1] -= dx / length * sign;
      directions.set(key, direction);
    }
  }
  const profile = (point, direction) => {
    const key = [point.x, point.y, point.z].map(value => Math.round(value * 1000)).join(':');
    if (profiles.has(key)) return profiles.get(key);
    const projected = query.project(point.toArray());
    const toeY = Math.min(point.y, Math.max(floorY, (projected.position?.[1] ?? floorY) - 30));
    const clearance = Math.max(0, projected.distanceXZ - projected.widthM / 2 - roadMarginM - 2);
    // Distance to any road point is 1-Lipschitz. Keeping the entire apron inside
    // this clearance disk prevents it crossing a different hairpin, too.
    const travel = Math.min(1300, (point.y - toeY) / 0.72, clearance * 0.82);
    const length = Math.hypot(...direction) || 1;
    const value = { x: direction[0] / length * travel, z: direction[1] / length * travel, toeY, travel };
    profiles.set(key, value); return value;
  };
  const addVertex = point => {
    const u = point.x / metres, v = (point.z + point.y * 0.18) / metres;
    point.applyMatrix4(inverse);
    const key = [point.x, point.y, point.z].map(value => Math.round(value * 1000)).join(':');
    if (!wallVertices.has(key)) {
      wallVertices.set(key, positions.length / 3);
      positions.push(point.x, point.y, point.z); uv.push(u, v);
    }
    return wallVertices.get(key);
  };
  for (const value of edges.values()) {
    yield;
    if (value.count !== 1) continue;
    boundaryEdges++;
    a.fromBufferAttribute(p, value.a).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(p, value.b).applyMatrix4(mesh.matrixWorld);
    const lengthXZ = Math.hypot(a.x - b.x, a.z - b.z);
    if (lengthXZ < 0.01 || Math.min(a.y, b.y) <= floorY + 0.05) continue;
    const steps = Math.max(2, Math.ceil(lengthXZ / 20));
    let nearRoad = false;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const projected = query.project([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t]);
      if (projected.distanceXZ <= projected.widthM / 2 + roadMarginM) { nearRoad = true; break; }
    }
    if (nearRoad) { skippedRoadEdges++; continue; }
    if (talus) {
      const rows = 14, cols = Math.max(1, Math.ceil(lengthXZ / 30));
      const dirA = directions.get(ids[value.a]) || [0, 0], dirB = directions.get(ids[value.b]) || [0, 0];
      const strips = [];
      for (let col = 0; col <= cols; col++) {
        if(col%8===0)yield;
        const f = col / cols, top = a.clone().lerp(b, f);
        const toe = profile(top, [dirA[0] * (1-f) + dirB[0] * f, dirA[1] * (1-f) + dirB[1] * f]);
        const strip = [];
        for (let row = 0; row <= rows; row++) {
          const t = row / rows, point = top.clone();
          point.x += toe.x * t; point.z += toe.z * t;
          const erosion = (Math.sin(top.x * 0.027 + top.z * 0.036) + Math.sin(top.x * 0.09 - top.z * 0.071) * 0.35)
            * Math.min(12, toe.travel * 0.065) * Math.sin(t * Math.PI);
          // Hermite profile: finite, gentle tangent at the crest and horizontal
          // debris toe. The former t^.72 profile had an infinite upper slope,
          // which appeared as knife-like fins along the distant Horcones edge.
          const profileT = t*t*(3-2*t) + .38*t*(1-t)*(1-t);
          point.y = Math.max(toe.toeY, Math.min(top.y, top.y + (toe.toeY - top.y) * profileT + erosion));
          strip.push(addVertex(point));
        }
        strips.push(strip);
        if (col) for (let row = 0; row < rows; row++) {
          const left = strips[col-1], right = strips[col];
          indices.push(left[row], right[row], right[row+1], left[row], right[row+1], left[row+1]);
        }
      }
      continue;
    }
    bottomA.set(a.x, floorY, a.z); bottomB.set(b.x, floorY, b.z);
    const quad = [];
    for (const point of [a, b, bottomB, bottomA]) {
      quad.push(addVertex(point));
    }
    indices.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
  }
  if (indices.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const closure = new THREE.Mesh(geometry, material); closure.name = 'ASFALTO_TERRAIN_EDGE_CLOSURE';
    closure.receiveShadow = true; closure.castShadow = false;
    mesh.add(closure);
  }
  const result = Object.freeze({ boundaryEdges, skippedRoadEdges, triangles: indices.length / 3, talus, maxRunM: Math.max(0, ...[...profiles.values()].map(value => value.travel)) });
  mesh.userData.asfaltoEdgeClosure = result;
  return result;
}

export function closeTerrainEdges(...args){const steps=closeTerrainEdgesSteps(...args);for(;;){const next=steps.next();if(next.done)return next.value;}}
export function closeTerrainEdgesAsync(THREE,mesh,options={}){return runCooperatively(closeTerrainEdgesSteps(THREE,mesh,options),{signal:options.signal});}
