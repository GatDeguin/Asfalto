import {decodeVehicleTransport} from '../../runtime/vehicle-transport.mjs?v=f15233fd0976636d';

// Produced by ArtSource/v8-circuitos/lipan-piloto.py. Positions are local to S05.
export const lipanPilotAsset = Object.freeze({
  path: 'assets/tracks/lipan-piloto.glb.gz',
  bytes: 151089,
  sha256: 'f106e1229083f15ad010cef8d20b77835ca98e05e8228112330eca91efafd626',
  startM: 11130,
  endM: 12130,
  triangles: 8197,
});

const meshNames = new Set([
  'LIPAN_CORTE_ESTRATIFICADO',
  'LIPAN_ABANICO_Y_FALDEO',
  'LIPAN_ACARREO',
  'LIPAN_CARDONES_Y_COIRON',
]);

export async function loadLipanPilot({sectorRoot, releaseRoot, signal, fetchLocked, loadGlb, dispose}) {
  if (typeof document === 'undefined' || !sectorRoot.isObject3D) return false;
  const url = new URL(lipanPilotAsset.path, releaseRoot);
  url.searchParams.set('v', lipanPilotAsset.sha256.slice(0, 16));
  const label = 'Cuesta S05 · escenografía Blender';
  let art;
  try {
    const bytes = await fetchLocked(url.href, lipanPilotAsset, label);
    art = await loadGlb(await decodeVehicleTransport(bytes, signal), label, {signal});
    signal.throwIfAborted();
    const found = new Set();
    let primitives = 0;
    let triangles = 0;
    art.traverse(node => {
      node.userData.collision = false;
      if (!node.isMesh) return;
      found.add(node.parent.name);
      primitives += 1;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      node.castShadow = false;
      node.receiveShadow = false;
    });
    if (primitives !== meshNames.size || triangles !== lipanPilotAsset.triangles
        || [...meshNames].some(name => !found.has(name))) {
      throw new Error('El piloto de Lipán tiene una geometría inesperada.');
    }
    art.name = 'ASFALTO_LIPAN_PILOTO';
    art.userData.asfaltoLipanPiloto = Object.freeze({sector: 'S05', startM: lipanPilotAsset.startM,
      endM: lipanPilotAsset.endM, triangles, primitives, bytes: lipanPilotAsset.bytes});
    sectorRoot.add(art);
    return true;
  } catch (error) {
    if (art) dispose(art);
    signal.throwIfAborted();
    console.warn('[Lipán] Se usa la escenografía original de S05:', error?.message || error);
    return false;
  }
}
