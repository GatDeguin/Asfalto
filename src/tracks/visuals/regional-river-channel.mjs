// Carve the delivered Horcones river ribbon into its surrounding visual ground.
// Imported buffers, road position and all collision meshes remain untouched.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export function exposeAuthoredRiver(T, root, roadField) {
  root.updateMatrixWorld(true);
  const rivers = [], terrains = [], grid = new Map(), cellM = 100, point = new T.Vector3();
  root.traverse(mesh => {
    if (!mesh.isMesh || /SOURCE_OWNER|COLLISION_|RETURN_/.test(mesh.name)) return;
    if (mesh.material?.name === 'MAT_P1_RIVER') rivers.push(mesh);
    if (/^MAT_P1_TERRAIN_/.test(mesh.material?.name || '') && /TERRAIN|Terrain/.test(mesh.name)) terrains.push(mesh);
  });
  for (const river of rivers) {
    const p = river.geometry.attributes.position, rows = [];
    for (let i = 0; i + 1 < p.count; i += 2) {
      const a = new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(river.matrixWorld);
      const b = new T.Vector3().fromBufferAttribute(p, i + 1).applyMatrix4(river.matrixWorld);
      rows.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, halfWidth: Math.hypot(a.x - b.x, a.z - b.z) / 2 });
    }
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      for (let x = Math.floor(Math.min(a.x, b.x) / cellM); x <= Math.floor(Math.max(a.x, b.x) / cellM); x++)
        for (let z = Math.floor(Math.min(a.z, b.z) / cellM); z <= Math.floor(Math.max(a.z, b.z) / cellM); z++) {
          const key = x + ':' + z; if (!grid.has(key)) grid.set(key, []); grid.get(key).push({ a, b });
        }
    }
    river.userData.asfaltoRiverChannel = { rows: rows.length, designedDepthM: 1.5, surveyedGeographicDepth: false };
  }
  const field = (x, z) => {
    const cx = Math.floor(x / cellM), cz = Math.floor(z / cellM); let nearest = null, distance2 = 6400;
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) for (const { a, b } of grid.get((cx + ix) + ':' + (cz + iz)) || []) {
      const dx = b.x - a.x, dz = b.z - a.z, u = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1));
      const d = (x - a.x - dx * u) ** 2 + (z - a.z - dz * u) ** 2;
      if (d < distance2) { distance2 = d; nearest = { y: a.y + (b.y - a.y) * u, halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * u, distance: Math.sqrt(d) }; }
    }
    return nearest;
  };
  const result = { meshes: 0, vertices: 0, maximumLoweringM: 0, roadEnvelopePreserved: true };
  for (const mesh of terrains) {
    if (mesh.userData.asfaltoRiverChannel) continue;
    const original = mesh.geometry, p = original.attributes.position, inverse = mesh.matrixWorld.clone().invert(), changes = [];
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      const river = field(point.x, point.z); if (!river || river.distance > river.halfWidth + 37) continue;
      const road = roadField?.(point.x, point.z); if (road && road.distanceM < (road.widthM || 8) / 2 + 12) continue;
      const influence = 1 - smooth((river.distance - river.halfWidth - 7) / 30), floor = river.y - 1.5;
      if (point.y <= floor || influence <= 0) continue;
      const y = point.y + (floor - point.y) * influence; result.maximumLoweringM = Math.max(result.maximumLoweringM, point.y - y);
      changes.push([i, y]);
    }
    if (!changes.length) continue;
    const geometry = original.clone(), positions = geometry.attributes.position;
    for (const [i, y] of changes) {
      point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); point.y = y; point.applyMatrix4(inverse);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    mesh.geometry = geometry; mesh.userData.asfaltoRiverChannel = { loweredVertices: changes.length };
    const owner = new T.Mesh(original, mesh.material); owner.name = 'ASFALTO_RIVER_TERRAIN_SOURCE_OWNER'; owner.visible = false; owner.userData.asfaltoReplacedTerrain = true; mesh.add(owner);
    result.meshes++; result.vertices += changes.length;
  }
  root.userData.asfaltoRiverChannel = result;
  return result;
}
