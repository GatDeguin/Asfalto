import {decodeVehicleTransport} from '../../runtime/vehicle-transport.mjs?v=f15233fd0976636d';
import {trackApproachArtAssets} from './track-approach-art-assets.mjs?v=bb9a576b1fac7cc8';

export {trackApproachArtAssets};

const ends = ['START', 'FINISH'];
const banks = ends.flatMap(end => [
  [`ART_${end}_BANK_LEFT`, `APPROACH_${end}_TERRAIN_-1`],
  [`ART_${end}_BANK_RIGHT`, `APPROACH_${end}_TERRAIN_1`],
]);
const details = ends.flatMap(end => [`ART_${end}_STRATA`, `ART_${end}_UNDERSTORY`]);

export function attachTrackApproachArt(visualRoot, art, id) {
  const meshes = new Map();
  art.traverse(mesh => {
    if (mesh.isMesh) meshes.set(mesh.name.replace(/(?:\.\d{3})?(?:_Primitive_\d+)?$/, ''), mesh);
  });
  for (const name of ['ART_HORIZON', ...details, ...banks.map(([name]) => name)]) {
    if (!meshes.get(name)?.geometry.attributes.position?.count) throw new Error(`Missing scenery mesh ${name}`);
  }
  const replacements = banks.map(([name, originalName]) => {
    const original = visualRoot.getObjectByName(originalName);
    if (!original?.isMesh) throw new Error(`Missing approach bank ${originalName}`);
    return [meshes.get(name), original];
  });
  const retiredGeometry = new Set(), retiredMaterials = new Set();
  for (const [mesh, original] of replacements) {
    retiredMaterials.add(mesh.material);
    retiredGeometry.add(original.geometry);
    mesh.material = original.material;
    mesh.name = original.name;
    mesh.receiveShadow = true;
    original.removeFromParent();
  }
  for (const end of ends) {
    const stones = visualRoot.getObjectByName(`APPROACH_${end}_STONES`);
    if (!stones) continue;
    retiredGeometry.add(stones.geometry);
    retiredMaterials.add(stones.material);
    stones.removeFromParent();
    stones.dispose?.();
  }
  for (const name of details) {
    const mesh = meshes.get(name);
    mesh.receiveShadow = true;
    mesh.userData.collision = false;
  }
  const horizon = meshes.get('ART_HORIZON');
  horizon.userData.collision = false;
  horizon.userData.asfaltoDistantRidge = true;
  art.name = 'ASFALTO_BLENDER_SCENERY';
  visualRoot.add(art);
  for (const geometry of retiredGeometry) geometry.dispose();
  for (const material of retiredMaterials) material.dispose();
  const diagnostics = Object.freeze({id, meshes:meshes.size});
  visualRoot.userData.asfaltoBlenderScenery = diagnostics;
  return diagnostics;
}

export async function loadTrackApproachArt({id, visualRoot, signal}, {fetchBytes, loadGlb, dispose}) {
  const asset = trackApproachArtAssets[id];
  if (!asset) return null;
  const url = new URL(`../../../assets/tracks/approach-art/${id}.glb.gz`, import.meta.url);
  url.searchParams.set('v', asset.sha256.slice(0, 16));
  let art;
  try {
    const bytes = await fetchBytes(url, {signal});
    if (bytes.byteLength !== asset.bytes) throw new Error('Unexpected scenery payload length');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const sha256 = [...digest].map(n => n.toString(16).padStart(2, '0')).join('');
    if (sha256 !== asset.sha256) throw new Error('Scenery payload integrity');
    const glb = await decodeVehicleTransport(bytes, signal);
    art = await loadGlb(glb, id + ' Blender scenery', {signal});
    signal?.throwIfAborted();
    return attachTrackApproachArt(visualRoot, art, id);
  } catch (error) {
    if (art) dispose(art);
    if (signal?.aborted) throw signal.reason;
    if (error.name === 'AbortError') throw error;
    console.warn('[asfalto scenery] ' + id + ': ' + error.message);
    return null;
  }
}
