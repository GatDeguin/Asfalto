import { terrainHeightSampler } from './reference-landscape.mjs?v=62f7607723a931ca';
import { addRoadSigns, roadSignYaw } from './road-signs.mjs?v=6d823d9e48d15630';

// Stations measured from the signed LOD0 exports. At 6209 m the original
// plate runs into the cut when moved behind the rail, so use 6197 m instead.
const chevronStations = {
  S03: [[4410, -1], [4509, -1], [4863, 1], [4962, 1], [5308, -1], [5408, -1], [5764, 1],
    [6110, -1], [6197, -1], [6584, 1], [6684, 1], [7040, -1], [7140, -1]],
  S05: [[10770, 1], [10870, 1], [10970, 1]],
};

export function prepareLipanAuthoredSigns(root, { THREE, sectorId, query, heightAt }) {
  const oldSignage = root.children.find(node => node.userData.source_object_name === `V2_FURNITURE_${sectorId}_SIGNAGE`
    && node.userData.semantic === 'ROAD_SIGNAGE');
  // Keep the source nodes owned by their sector for disposal. The blank
  // midpoint markers are superseded by the numbered kilometre markers.
  if (oldSignage) oldSignage.visible = false;
  const stations = chevronStations[sectorId];
  if (!stations) return [];

  const shoulderAt = terrainHeightSampler(THREE, root, mesh => /SHOULDER|ROADBED|CUT_FILL/.test(mesh.name)
    && mesh.name !== 'ASFALTO_TERRAIN_SHOULDER_TRANSITION', { includeDefaultTerrain: false });
  const groundAt = (x, z) => {
    const terrainY = heightAt(x, z);
    const shoulderY = shoulderAt(x, z);
    return Number.isFinite(terrainY) ? Math.max(terrainY, shoulderY) : shoulderY;
  };
  const cues = [];
  for (const [sM, turn] of stations) {
    const { position, frame, widthM } = query.sample(sM);
    // The route's positive lateral axis points to the driver's right. Use
    // the outside shoulder, past the collision rails at about 4.9 m.
    const side = -turn;
    const offset = side * (widthM / 2 + 1.75);
    const [x, shoulderY, z] = position.map((value, i) => value + frame.left[i] * offset);
    const groundY = groundAt(x, z);
    if (!Number.isFinite(groundY)) continue;
    cues.push({ kind: 'chevron', phase: 'support', sM, turn, side, position: [x, groundY, z],
      yaw: roadSignYaw(frame.tangent, -side), bottomM: Math.max(.92, shoulderY + 1.15 - groundY) });
  }
  addRoadSigns(THREE, root, cues, { name: 'ASFALTO_LIPAN_AUTHORED_SIGNS', heightAt: groundAt });
  return cues;
}
