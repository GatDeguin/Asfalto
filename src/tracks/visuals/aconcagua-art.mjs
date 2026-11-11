export const aconcaguaArtAsset = Object.freeze({
  path: 'assets/tracks/aconcagua-horcones-art.glb.gz',
  bytes: 419486,
  sha256: 'c9c47d57e5849fe0080e9fc883dd02adcccd915b6ea709f9f1a5e196878b337d',
  triangles: 13216,
});
const expectedMeshes = new Set([
  'HORCONES_CORTES_S06',
  'HORCONES_ABANICO_S06', 'HORCONES_ABANICO_S06_CLASTOS',
  'HORCONES_ABANICO_S08', 'HORCONES_ABANICO_S08_CLASTOS',
  'HORCONES_META_CUNETA', 'HORCONES_META_CRESTA',
]);

export function attachAconcaguaArt(visualRoot, art) {
  const found = new Map();
  let triangles = 0;
  art.traverse(node => {
    if (!node.isMesh) return;
    const name = node.parent.name;
    const position = node.geometry.attributes.position;
    if (!expectedMeshes.has(name) || found.has(name) || !position?.count
        || node.geometry.attributes.tangent?.count !== position.count || !node.material?.normalMap) {
      throw new Error('Malla o relieve de Horcones inválidos.');
    }
    found.set(name,node);
    triangles += (node.geometry.index?.count ?? position.count) / 3;
  });
  if (found.size !== expectedMeshes.size || triangles !== aconcaguaArtAsset.triangles) {
    throw new Error('Inventario de Horcones incompleto.');
  }
  for (const node of found.values()) {
    node.userData.collision = false;
    node.receiveShadow = true;
    node.material.userData.asfaltoSnow = true;
  }
  art.name = 'ASFALTO_HORCONES_BLENDER';
  art.userData.asfaltoHorcones = Object.freeze({
    triangles,primitives:found.size,bytes:aconcaguaArtAsset.bytes,visualOnly:true,
  });
  visualRoot.add(art);
  return art.userData.asfaltoHorcones;
}
