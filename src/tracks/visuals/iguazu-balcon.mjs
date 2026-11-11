import {loadRegionalBlenderArt} from './regional-blender-art.mjs?v=3b7ae6f4966be6b4';

export const iguazuBalconAsset = Object.freeze({
  path: 'assets/tracks/iguazu-balcon.glb.gz',
  bytes: 242722,
  sha256: '8672de9aabcdd687a2a13e94f993c7b344e290f475c3d6d2f99f356b5d571524',
});

const primitives = new Map([
  ['IGUAZU_LATERITA_GUATAMBU',3168],
  ['IGUAZU_LATERITA_BALCON',2760],
  ['IGUAZU_CUNETA_GUATAMBU',3168],
  ['IGUAZU_SOTOBOSQUE_RIBERENO',3648],
  ['IGUAZU_LABIOS_BASALTO',1680],
  ['IGUAZU_REPISAS_DE_CUENCA',784],
]);
const isFiniteVector = (value,length) => Array.isArray(value) && value.length===length && value.every(Number.isFinite);

export function attachIguazuBalcon(THREE, root, art) {
  const basin = root.getObjectByName('RIVER_BASIN_Primitive_0');
  if (!basin?.userData.asfaltoWater || basin.userData.asfaltoWater.kind!=='river') {
    throw new Error('Falta la cuenca original de Iguazú.');
  }
  const waterBox = new THREE.Box3().setFromObject(basin);
  const found = new Map();
  const soilMaterials = new Set();
  art.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = mesh.parent.name;
    const p = mesh.geometry.attributes.position;
    if (!p?.count || found.has(name) || (mesh.geometry.index?.count??p.count)/3!==primitives.get(name)) {
      throw new Error('La geometría no coincide con el Balcón del Salto.');
    }
    const dirt = /^IGUAZU_(LATERITA|CUNETA)_/.test(name);
    if (dirt && mesh.geometry.attributes.uv2?.count!==p.count) throw new Error('Falta la máscara de humedad.');
    mesh.userData.collision = false;
    mesh.castShadow = false;
    mesh.receiveShadow = dirt;
    if (dirt) {
      mesh.material.userData.asfaltoWeatherMask = 'uv2-snow-wetness';
      soilMaterials.add(mesh.material);
    }
    if (dirt || /^IGUAZU_(LABIOS|REPISAS)_/.test(name)) mesh.material.userData.asfaltoSnow = true;
    found.set(name,mesh.parent.userData);
  });
  if (found.size!==primitives.size) throw new Error('Faltan mallas del Balcón del Salto.');

  const river = found.get('IGUAZU_REPISAS_DE_CUENCA');
  const samples = river.igzDepthSamples;
  const flow = river.igzFlowDirection;
  if (!Number.isFinite(river.igzWaterLevel) || Math.abs(waterBox.min.y-river.igzWaterLevel)>.01 || !isFiniteVector(flow,2)
      || Math.abs(Math.hypot(...flow)-1)>.015 || !Array.isArray(samples) || !samples.length
      || samples.length%5 || samples.length>350 || !samples.every(Number.isFinite)) {
    throw new Error('Las cotas de la cuenca cambiaron.');
  }
  for (let i=0;i<samples.length;i+=5) {
    const [x,y,z,depth,reach] = samples.slice(i,i+5);
    if (x<waterBox.min.x || x>waterBox.max.x || z<waterBox.min.z || z>waterBox.max.z
        || Math.abs(y-river.igzWaterLevel)>.01 || depth<=0 || depth>8 || reach<=0 || reach>28) {
      throw new Error('La muestra de profundidad está fuera de la cuenca.');
    }
  }

  const vegetation = found.get('IGUAZU_SOTOBOSQUE_RIBERENO');
  const pose = JSON.parse(vegetation.igzPreview);
  if (!isFiniteVector(pose.eye,3) || !isFiniteVector(pose.target,3) || !(pose.fov>20&&pose.fov<75)
      || !(pose.sM>=8700&&pose.sM<=9160) || !Number.isInteger(vegetation.igzPlants) || vegetation.igzPlants<=0) {
    throw new Error('La cámara del Balcón del Salto es inválida.');
  }
  const preview = Object.freeze({key:'cataratas-balcon',sM:pose.sM,position:pose.eye,target:pose.target,fov:pose.fov});
  // Native gravel supplies the microtexture. The Blender vertex colors and
  // moisture field still describe the larger erosion and runoff shapes.
  const laterite = root.getObjectByName('SHOULDER_00_-1_Primitive_0')?.material;
  const borrowedSurfaceMaps = Number(!!laterite?.map) + Number(!!laterite?.normalMap);
  for (const material of soilMaterials) {
    material.map = laterite?.map || null;
    material.normalMap = laterite?.normalMap || null;
    if (laterite?.normalScale) material.normalScale.copy(laterite.normalScale);
  }
  art.name = 'ASFALTO_IGUAZU_BALCON';
  art.userData.asfaltoBalcon = Object.freeze({
    bytes:iguazuBalconAsset.bytes,primitives:found.size,triangles:[...primitives.values()].reduce((sum,count)=>sum+count,0),
    depthSamples:samples.length/5,plants:vegetation.igzPlants,borrowedSurfaceMaps,preview,
  });
  basin.userData.asfaltoWater = {
    ...basin.userData.asfaltoWater,
    flowDirection:{x:flow[0],z:flow[1]},
    localDepthSamples:samples,
    depthSource:'iguazu-authored-receiving-shelves-and-native-basin',
  };
  const cameras = root.userData.asfaltoRegionalCameras;
  if (Array.isArray(cameras?.views)) root.userData.asfaltoRegionalCameras = {...cameras,views:[...cameras.views,preview]};
  root.add(art);
  return art.userData.asfaltoBalcon;
}

export async function loadIguazuBalcon(root, {signal,THREE=globalThis.__chevyV6Three||globalThis.THREE}, dependencies) {
  if (typeof document==='undefined' || !THREE || typeof dependencies.disposeObjectRoot!=='function') return null;
  return loadRegionalBlenderArt({
    root,releaseRoot:dependencies.releaseRootUrl,asset:iguazuBalconAsset,label:'Iguazú · Balcón del Salto',signal,
  },{
    fetchBytes:(...args)=>dependencies.fetchBytes(...args),
    loadGlb:(...args)=>dependencies.completeGlbToObject(...args),
    attach:(root,art)=>attachIguazuBalcon(THREE,root,art),
    dispose:art=>dependencies.disposeObjectRoot(art),
  });
}
