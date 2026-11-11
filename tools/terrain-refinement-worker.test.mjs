import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {gunzipSync} from 'node:zlib';
import {visualRoadField} from '../src/tracks/visuals/forest-terrain-detail.mjs?v=8e17cf50d6fbaefc';
import {refineTerrainSurfaceOriginal} from '../src/tracks/visuals/terrain-refinement-solver.mjs?v=eeee2ed24d0fed64';
import {packTerrainGeometry, terrainTransferList, unpackTerrainGeometry} from '../src/tracks/visuals/terrain-geometry-transport.mjs?v=1bd13edef21b4c5a';
import {refineTerrainDocument} from '../src/tracks/visuals/terrain-refinement-worker.mjs?v=152fd2975f4032de';

test('transported terrain produces exactly the same Lipán geometry and metadata', async () => {
  const bootstrap = JSON.parse(await readFile(new URL('../assets/manifests/workshop-bootstrap.json', import.meta.url)));
  const source = gunzipSync(Buffer.from(bootstrap.threeCoreGz, 'base64'));
  const THREE = await import('data:text/javascript;base64,' + source.toString('base64'));
  const geometry = new THREE.PlaneGeometry(260, 240, 8, 8);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Uint8Array(positions.count * 4);
  for (let vertex = 0; vertex < positions.count; vertex++) {
    positions.setY(vertex, Math.sin(positions.getX(vertex) / 30) * 30 + positions.getZ(vertex) / 3);
    colors.set([vertex, 123, 217, 255], vertex * 4);
  }
  geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(colors, 4), 3, 0, true));
  const mesh = new THREE.Mesh(geometry);
  mesh.name = 'TERRAIN_TEST';
  mesh.position.set(33, 44, 130);
  mesh.rotation.y = .13;
  mesh.updateWorldMatrix(true, false);
  const samples = Array.from({length: 21}, (_, index) => ({position: [20, 15 + index, index * 20], widthM: 9}));
  const options = {region: 'cuesta_lipan', roadMarginM: 8, maxTriangles: 6000, targetEdgeM: 38, nearEdgeM: 19};
  const packed = packTerrainGeometry(geometry, true);
  const request = {name: mesh.name, geometry: packed, matrix: mesh.matrixWorld.elements, samples, lengthM: 400, options};
  const workerRequest = structuredClone(request, {transfer: terrainTransferList(packed)});
  assert.equal(geometry.attributes.position.array.byteLength > 0, true);
  const output = refineTerrainDocument(THREE, workerRequest);
  const direct = refineTerrainSurfaceOriginal(THREE, mesh, {...options,
    roadField: visualRoadField({sample: station => samples[station / 20]}, 400)});
  assert.deepEqual(output.result, direct);
  const restored = unpackTerrainGeometry(THREE, output.geometry);
  for (const name of ['position', 'normal', 'color']) {
    assert.deepEqual(restored.attributes[name].array, mesh.geometry.attributes[name].array, name);
  }
  assert.deepEqual(restored.index.array, mesh.geometry.index.array);
});
