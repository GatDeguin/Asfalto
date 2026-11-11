import {readExternalPayload} from '../../runtime/asset-core.mjs';
import {workshopBootstrapManifest} from '../../runtime/workshop-bootstrap-manifest.mjs?v=6238a53a583b3bc4';
import {visualRoadField} from './forest-terrain-detail.mjs?v=8e17cf50d6fbaefc';
import {refineTerrainSurfaceOriginal} from './terrain-refinement-solver.mjs?v=eeee2ed24d0fed64';
import {packTerrainGeometry, unpackTerrainGeometry} from './terrain-geometry-transport.mjs?v=1bd13edef21b4c5a';

let engine;
export function loadTerrainEngine(inflate) {
  return engine ??= (async () => {
    const {url, bytes, sha256} = workshopBootstrapManifest;
    const bootstrap = await readExternalPayload({dataset: {
      externalUrl: new URL(url, new URL('../../runtime/', import.meta.url)).href,
      bytes: String(bytes), sha256,
    }});
    const payload = JSON.parse(new TextDecoder().decode(bootstrap));
    const binary = atob(payload.threeCoreGz);
    const compressed = new Uint8Array(binary.length);
    for (let offset = 0; offset < binary.length; offset++) compressed[offset] = binary.charCodeAt(offset);
    const buffer = await inflate(compressed);
    const moduleUrl = URL.createObjectURL(new Blob([buffer], {type: 'text/javascript'}));
    try { return await import(moduleUrl); }
    finally { URL.revokeObjectURL(moduleUrl); }
  })().catch(error => { engine = null; throw error; });
}

export function refineTerrainDocument(THREE, {name, geometry, matrix, samples, lengthM, options}) {
  const mesh = new THREE.Mesh(unpackTerrainGeometry(THREE, geometry));
  mesh.name = name;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.fromArray(matrix);
  let next = 0;
  const roadField = visualRoadField({sample: () => samples[next++]}, lengthM);
  const result = refineTerrainSurfaceOriginal(THREE, mesh, {...options, roadField});
  return result ? {result, geometry: packTerrainGeometry(mesh.geometry)} : null;
}
