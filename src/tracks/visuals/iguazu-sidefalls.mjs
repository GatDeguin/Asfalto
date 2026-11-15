import {loadRegionalBlenderArt} from './regional-blender-art.mjs?v=942ba726ff042432';
import {findWaterfallImpact} from './waterfall-impact.mjs?v=88a5c279fc1ae5d5';

export const iguazuSidefallsAsset = Object.freeze({
  path: 'assets/tracks/iguazu-saltos-laterales.glb.gz',
  bytes: 115743,
  sha256: '1fc77839fbbe13839451558916989d05661dd4a1e73f69b03c7def4a7b222cf9',
});

const siteCount = 6;
const parts = ['BASALTO', 'CAIDA', 'CUENCO'];

export function attachIguazuSidefalls(THREE, root, art) {
  const sites = Array.from({length:siteCount}, (_, id) => {
    const owner = root.getObjectByName(`SIDEFALL_${id}`);
    const original = owner?.children.find(node => node.isMesh && node.material?.name === 'MAT_waterfall_FLOW');
    if (!original) throw new Error(`Falta el salto lateral original ${id}.`);
    return {owner, original};
  });
  const meshes = new Map();
  let triangles = 0;
  art.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = mesh.parent?.name;
    const p = mesh.geometry.attributes.position;
    if (!/^IGUAZU_LATERAL_[0-5]_(BASALTO|CAIDA|CUENCO)$/.test(name) || meshes.has(name)
        || !p?.count || mesh.geometry.attributes.uv?.count !== p.count) {
      throw new Error('Geometría inválida en los saltos laterales de Iguazú.');
    }
    meshes.set(name, mesh);
    triangles += (mesh.geometry.index?.count ?? p.count) / 3;
  });
  if (meshes.size !== siteCount * parts.length || triangles > 12_000) throw new Error('Inventario inesperado de los saltos laterales.');
  art.updateMatrixWorld(true);
  const details = sites.map(({original}, id) => {
    const [basalt, curtain, pool] = parts.map(part => meshes.get(`IGUAZU_LATERAL_${id}_${part}`));
    const stationM = curtain.parent.userData.progresiva_m;
    const level = pool.parent.userData.cota_agua_m;
    const impact = findWaterfallImpact(THREE, curtain, [pool]);
    if (!Number.isFinite(stationM) || !Number.isFinite(level) || !impact || impact.impactSpanM <= 2
        || Math.abs(impact.impactCenter[1] - level) > .01) {
      throw new Error(`Falta el contacto entre el salto lateral ${id} y su cuenco.`);
    }
    const size = new THREE.Box3().setFromObject(curtain).getSize(new THREE.Vector3());
    return {id, basalt, curtain, original, stationM, impact, size};
  });

  // Stage every fall and receiver before hiding the original rendering and mist sources.
  for (const mesh of meshes.values()) {
    mesh.userData.collision = false;
    mesh.castShadow = false;
    mesh.receiveShadow = mesh.parent.name.endsWith('_BASALTO');
  }
  for (const {basalt, curtain, original, impact, size} of details) {
    basalt.material.userData.asfaltoSnow = true;
    curtain.material.map = original.material.map;
    curtain.userData.asfaltoWaterfall = {
      heightM:size.y, speedMps:Math.sqrt(9.81 * size.y), flowDirection:[0,-1,0],
      baseWidthM:impact.impactSpanM, bottomCenter:impact.impactCenter, sprayRadiusM:3.1, ...impact,
    };
  }
  art.name = 'ASFALTO_IGUAZU_SALTOS_LATERALES';
  const diagnostics = Object.freeze({
    bytes:iguazuSidefallsAsset.bytes, primitives:meshes.size, triangles,
    sites:Object.freeze(details.map(({id, stationM, impact}) => Object.freeze({
      id, stationM, impactCenter:impact.impactCenter, impactSpanM:impact.impactSpanM,
    }))),
  });
  art.userData.asfaltoSidefalls = diagnostics;
  root.add(art);
  for (const {owner, original} of sites) {
    owner.visible = false;
    delete original.userData.asfaltoWaterfall;
  }
  return diagnostics;
}

export async function loadIguazuSidefalls(root, {signal, THREE=globalThis.__chevyV6Three || globalThis.THREE}, dependencies) {
  if (typeof document === 'undefined' || !THREE || typeof dependencies.disposeObjectRoot !== 'function') return null;
  return loadRegionalBlenderArt({
    root, releaseRoot:dependencies.releaseRootUrl, asset:iguazuSidefallsAsset, label:'Iguazú · Saltos laterales', signal,
  }, {
    fetchBytes:(...args) => dependencies.fetchBytes(...args),
    loadGlb:(...args) => dependencies.completeGlbToObject(...args),
    attach:(target, art) => attachIguazuSidefalls(THREE, target, art),
    dispose:art => dependencies.disposeObjectRoot(art),
  });
}
