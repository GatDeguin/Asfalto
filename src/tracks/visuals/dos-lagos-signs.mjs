import { terrainHeightSampler } from './reference-landscape.mjs?v=893415f03864bece';
import { addRoadSigns, roadSignYaw } from './road-signs.mjs?v=6d823d9e48d15630';

const groupName = 'ASFALTO_DOS_LAGOS_AUTHORED_SIGNS';
const nativePlate = /^SIGN_P[1-8]_.+_Primitive_0$/;

// Progressives measured at the original plates. P2, P3 and P7 were camera
// directions. The other plates identify places in the circuit.
const sites = [
  { sM: 365, side: 1, name: 'Lago Villarino' },
  { sM: 4825, side: -1, name: 'Balcón de Dos Aguas' },
  // The uphill guardrail hides the lower rim from the cabin at the default height.
  { sM: 5245, side: 1, name: 'Cruce del canal', bottomM: 1.82 },
  { sM: 6095, side: -1, name: 'Lago Falkner' },
  // A single post fits on the narrow shoulder above the final cut.
  { sM: 10195, side: -1, name: 'Mirador\nViento Sur', marginM: 1.05, widthM: 1.7 },
];

export function prepareDosLagosSigns(root, { THREE, query, heightAt }) {
  if (!THREE || !root?.isObject3D || !query || !heightAt) return [];
  const installed = root.getObjectByName(groupName);
  if (installed) return installed.userData.asfaltoRoadSigns;

  const plates = [];
  root.traverse(mesh => {
    if (mesh.isMesh && nativePlate.test(mesh.name)) plates.push(mesh);
  });
  const posts = root.getObjectByName('PROP_SignPosts_Primitive_0');
  if (plates.length !== 8 || !posts?.isMesh) return [];

  const terrainAt = heightAt.raw ?? heightAt;
  const shoulderAt = terrainHeightSampler(THREE, root, mesh => mesh.name.startsWith('ROAD_Shoulder_'), {
    includeDefaultTerrain: false,
  }).raw;
  const groundAt = (x, z) => {
    const terrainY = terrainAt(x, z);
    return Math.max(Number.isFinite(terrainY) ? terrainY : -Infinity, shoulderAt(x, z));
  };

  const signs = [];
  for (const { sM, side, name, marginM = 3.2, widthM = 2.7, bottomM = 1.55 } of sites) {
    const { position, frame, widthM: roadWidthM } = query.sample(sM);
    const lateral = side * (roadWidthM / 2 + marginM);
    const x = position[0] + frame.left[0] * lateral;
    const z = position[2] + frame.left[2] * lateral;
    const y = groundAt(x, z);
    if (!Number.isFinite(y) || Math.abs(y - position[1]) > 2.25) return [];
    // The authored lateral axis points to the driver's right.
    const yaw = roadSignYaw(frame.tangent, -side);
    signs.push({ kind: 'place', sM, name, position: [x, y, z], yaw, widthM, heightM: .84, bottomM });
  }

  const group = addRoadSigns(THREE, root, signs, { name: groupName, heightAt: groundAt });
  // Leave the locked GLB resources attached for the adapter's disposal pass.
  for (const mesh of [...plates, posts]) mesh.visible = false;
  return group.userData.asfaltoRoadSigns;
}
