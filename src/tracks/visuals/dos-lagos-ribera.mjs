import {decodeVehicleTransport} from '../../runtime/vehicle-transport.mjs?v=f15233fd0976636d';
import {shorelineFromGeometry} from './shore-promontory.mjs?v=d288d03e3f385b93';

// Exported from the editable Dos Lagos - Ribera.blend master.
const asset = Object.freeze({
  path: 'assets/tracks/dos-lagos-ribera.glb.gz',
  bytes: 166957,
  sha256: 'c52169c9c9a8ae31914ab0d38edd20f15afa709deff59b0181b66b29ce816637',
  triangles: 11618,
});
const banks = new Set(['FALKNER_ALTO', 'FALKNER_BAJO', 'FALKNER_PUNTA']);
const boulders = 'FALKNER_CANTOS_Y_AFLORAMIENTOS';
const embankment = 'TERRAIN_FALKNER_TERRAPLEN';

function attachRibera(THREE, root, art) {
  const lake = root.getObjectByName('WATER_Falkner_Primitive_0');
  const hydrology = lake?.userData.asfaltoWater;
  if (!hydrology?.shoreSegments?.length) throw new Error('Falta la ribera base del Falkner.');
  root.updateWorldMatrix(true, false);
  art.updateMatrixWorld(true);
  const level = new THREE.Box3().setFromObject(lake).max.y;
  const gravel = root.getObjectByName('ASFALTO_SHORE_COVES_AND_PROMONTORIES')?.material;
  const found = new Set(), shoreline = [], localDepthSamples = [];
  const worldMatrix = new THREE.Matrix4();
  let terrain;
  let triangles = 0, primitives = 0, collisionTriangles = 0;
  art.traverse(node => {
    if (!node.isMesh) return;
    const name = node.parent.name;
    const position = node.geometry.attributes.position;
    if (!position?.count || found.has(name) || !(banks.has(name) || name === boulders || name === embankment)) {
      throw new Error('Malla de ribera inesperada.');
    }
    found.add(name);
    primitives++;
    const count = (node.geometry.index?.count ?? position.count) / 3;
    triangles += count;
    node.userData.collision = name === embankment;
    if (node.userData.collision) {
      collisionTriangles = count;
      terrain = node;
    }
    node.castShadow = false;
    node.receiveShadow = true;
    node.material.userData.asfaltoSnow = true;
    if (!banks.has(name)) return;
    const samples = node.parent.userData.asfaltoDepthPatch;
    if (node.parent.userData.nivel_agua_m !== level || !Array.isArray(samples) || samples.length % 5
        || !samples.every(Number.isFinite)) {
      throw new Error('Muestras de profundidad inválidas.');
    }
    for (let i = 0; i < samples.length; i += 5) {
      if (samples[i + 1] !== level || samples[i + 3] <= 0 || samples[i + 4] <= 0) {
        throw new Error('Profundidad o radio inválido en la ribera.');
      }
    }
    localDepthSamples.push(...samples);
    worldMatrix.multiplyMatrices(root.matrixWorld, node.matrixWorld);
    shoreline.push(...shorelineFromGeometry(THREE, node.geometry, level, worldMatrix));
  });
  if (primitives !== banks.size + 2 || triangles !== asset.triangles || !collisionTriangles
      || !shoreline.length || !localDepthSamples.length) {
    throw new Error('La ribera no coincide con la exportación de Blender.');
  }
  // Preserve the authored lake perimeter at the worker's existing sample budget.
  const available = Math.max(1, 2048 - hydrology.shoreSegments.length);
  const step = Math.ceil(shoreline.length / available);
  const visibleShoreline = shoreline.filter((_, index) => index % step === 0);
  terrain.material.map = gravel?.map || null;
  terrain.material.normalMap = gravel?.normalMap || null;
  art.name = 'ASFALTO_DOS_LAGOS_RIBERA';
  art.userData.asfaltoRibera = Object.freeze({
    triangles, primitives, collisionTriangles, bytes: asset.bytes, shoreSegments: visibleShoreline.length,
    depthSamples: localDepthSamples.length / 5,
  });
  lake.userData.asfaltoWater = {
    ...hydrology,
    shoreSegments: [...hydrology.shoreSegments, ...visibleShoreline],
    localDepthSamples,
    depthSource: 'blender-local-banks-and-geometric-shore-wedge',
  };
  root.add(art);
}

export async function loadDosLagosRibera({root, releaseRoot, signal, fetchLocked, loadGlb, dispose}) {
  const THREE = globalThis.__chevyV6Three || globalThis.THREE;
  if (!THREE || !root.isObject3D) return;
  const url = new URL(asset.path, releaseRoot);
  url.searchParams.set('v', asset.sha256.slice(0, 16));
  let art;
  try {
    const bytes = await fetchLocked(url.href, asset);
    const glb = await decodeVehicleTransport(bytes, signal);
    art = await loadGlb(glb, 'Dos Lagos · Ribera del Falkner', {signal});
    signal.throwIfAborted();
    attachRibera(THREE, root, art);
  } catch (error) {
    if (art) dispose(art);
    signal.throwIfAborted();
    if (error.name === 'AbortError') throw error;
    console.warn('[Dos Lagos] Se usa la ribera original del Falkner:', error.message);
  }
}
