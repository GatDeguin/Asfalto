import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {setImmediate as flush} from 'node:timers/promises';
import {gunzipSync} from 'node:zlib';
import {GARIBALDI_TERRAIN_MANIFEST, TRIANGLE_BYTES, packTerrainTriangles, selectTerrainDetail, validateTerrainManifest}
  from '../src/render/virtual-terrain-data.mjs?v=09bc75160261c900';
import {createTerrainResidency} from '../src/render/virtual-terrain-residency.mjs?v=497442d1b9bbf4b7';
import {createVirtualTerrainAtlas} from '../src/render/virtual-terrain-composite.mjs?v=1f674a88819b63b9';
import {packGaribaldiSurfaces, readGaribaldiSurfaceMeshes} from '../src/render/virtual-terrain-surface.mjs?v=51250a3d4d356a8c';
import {prepareSurfaceSky} from '../src/render/virtual-terrain-sky.mjs?v=63f27700e259634a';
import {THREE} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {orientedBoundary, readVistaBake, spatialTrianglePages} from './build-virtual-terrain.mjs?v=3c7434995edbee78';

const directory = new URL('../assets/tracks/virtual-terrain/garibaldi/', import.meta.url);
const hash = b => createHash('sha256').update(b).digest('hex');
const load = ({file}) => readFile(new URL(file, directory));
const bytes = await load(GARIBALDI_TERRAIN_MANIFEST);
const manifest = validateTerrainManifest(JSON.parse(bytes));

async function decode(payload) {
  const gzip = await load(payload);
  assert.equal(gzip.length, payload.bytes);
  assert.equal(hash(gzip), payload.sha256);
  const decoded = gunzipSync(gzip);
  assert.equal(decoded.length, payload.decodedBytes);
  return decoded;
}

test('the checked-in virtual terrain reconstructs every baked Vista triangle with its original winding', async () => {
  assert.equal(hash(bytes), GARIBALDI_TERRAIN_MANIFEST.sha256);
  assert.equal(bytes.length, GARIBALDI_TERRAIN_MANIFEST.bytes);
  const {position, normal, indices} = await readVistaBake();
  const sourcePages = spatialTrianglePages(indices, position);
  const root = await decode(manifest.root);
  assert.equal(manifest.triangles, indices.length / 3);
  assert.ok(root.length < indices.length / 3 * TRIANGLE_BYTES / 2);
  for (const page of manifest.pages) {
    const coarse = root.subarray(page.coarseStart * TRIANGLE_BYTES, (page.coarseStart + page.coarseCount) * TRIANGLE_BYTES);
    const full = page.detail ? await decode(page.detail) : coarse;
    assert.deepEqual(full, Buffer.from(packTerrainTriangles(sourcePages[page.id], position, normal).buffer));
    const vertexIds = new Map();
    function boundary(geometry) {
      const ids = [];
      for (let i = 0; i < geometry.length; i += 16) {
        const key = geometry.toString('hex', i, i + 16);
        if (!vertexIds.has(key)) vertexIds.set(key, vertexIds.size);
        ids.push(vertexIds.get(key));
        for (let axis = 0; axis < 3; axis++) {
          const coordinate = geometry.readFloatLE(i + axis * 4);
          assert.ok(coordinate >= page.bounds[axis] && coordinate <= page.bounds[axis + 3]);
        }
      }
      return orientedBoundary(ids);
    }
    assert.deepEqual(boundary(coarse), boundary(full), `la página ${page.id} debe preservar sus bordes`);
  }
});

test('manifest validation rejects unsafe paths, oversized slots, overlapping spans and missing detail', () => {
  for (const mutate of [
    m => { m.pages[1].detail.file = '../other.bin'; },
    m => { m.pages[0].fineCount = 2000; },
    m => { m.pages[1].coarseStart = 0; },
    m => { m.pages[0].detail = null; },
    m => { m.root.decodedBytes++; },
    m => { m.pages[2].bounds[0] = Infinity; },
    m => { m.triangles--; },
  ]) {
    const invalid = structuredClone(manifest);
    mutate(invalid);
    assert.throws(() => validateTerrainManifest(invalid), /Geometría virtualizada/);
  }
});

test('pixel-error selection prioritizes visible detail with hysteresis and a strict slot limit', () => {
  const visible = [{page: {id: 0, detail: {}}, pixels: 1.0}, {page: {id: 1, detail: {}}, pixels: 6},
    {page: {id: 2, detail: null}, pixels: 30}, {page: {id: 3, detail: {}}, pixels: 2.2}];
  assert.deepEqual(selectTerrainDetail(visible, new Set()), [1,3]);
  assert.deepEqual(selectTerrainDetail(visible, new Set([0])), [1,3,0]);
  assert.deepEqual(selectTerrainDetail(visible, new Set([0]), 1), [1]);
});

test('residency keeps the coarse fallback while loading, evicts cold slots, and ignores late canceled loads', async () => {
  const requests = [];
  const uploads = [];
  const pages = Array.from({length: 6}, (_, id) => ({id}));
  const resident = createTerrainResidency({pages, capacity: 2,
    load: (page, signal) => new Promise(resolve => requests.push({id: page.id, signal, resolve})),
    upload: (slot, id) => uploads.push({slot, id}),
  });
  resident.select([0, 1, 2]);
  await flush();
  assert.deepEqual(requests.map(r => r.id), [0, 1]);
  assert.equal(resident.slotFor(0), undefined);
  requests[0].resolve(0);
  await flush();
  assert.ok(resident.slotFor(0) >= pages.length);
  resident.select([2, 3]);
  assert.equal(requests[1].signal.aborted, true);
  await flush();
  assert.deepEqual(requests.map(r => r.id), [0, 1, 2]);
  requests[1].resolve(1);
  requests[2].resolve(2);
  await flush();
  requests[3].resolve(3);
  await flush();
  assert.deepEqual(resident.diagnostics().resident, [2, 3]);
  assert.equal(resident.diagnostics().evictions, 1);
  assert.equal(resident.diagnostics().cancellations, 1);
  assert.deepEqual(uploads.map(u => u.id), [0, 2, 3]);
  assert.equal(uploads[0].slot, uploads[2].slot);
  resident.select([4, 5]);
  await flush();
  resident.dispose();
  for (const request of requests.slice(-2)) {
    assert.equal(request.signal.aborted, true);
    request.resolve(request.id);
  }
  await flush();
  assert.deepEqual(resident.diagnostics().resident, []);
  assert.equal(resident.diagnostics().pending, 0);
  assert.equal(uploads.length, 3);
});

test('a failed detail page keeps its coarse page and cannot spin a request loop', async () => {
  let loads = 0;
  const resident = createTerrainResidency({pages: [{id: 0}], load: async () => {
    loads++;
    throw new Error('detail hash mismatch');
  }, upload: () => assert.fail('failed page must not reach GPU')});
  resident.select([0]);
  await flush();
  resident.select([0]);
  await flush();
  assert.equal(loads, 1);
  assert.equal(resident.slotFor(0), undefined);
  assert.equal(resident.diagnostics().errors, 1);
  resident.dispose();
});

test('the attribute atlas mirrors a reused GPU slot without marking other layers dirty', () => {
  const atlas = createVirtualTerrainAtlas(THREE, 3);
  const page = new Float32Array(12).fill(7);
  const {data, width, height} = atlas.texture.image;
  const stride = width * height * 4;
  atlas.upload(1, page);
  assert.equal(data[stride], 7);
  assert.equal(atlas.texture.layerUpdates.size, 0);
  atlas.texture.onUpdate();
  atlas.upload(2, page);
  atlas.upload(1, new Float32Array(12).fill(9));
  assert.equal(data[0], 0);
  assert.equal(data[stride], 9);
  assert.equal(data[stride * 2], 7);
  assert.deepEqual([...atlas.texture.layerUpdates], [2, 1]);
  assert.equal(atlas.bytes, stride * 3 * 4);
  assert.throws(() => atlas.upload(3, page), RangeError);
  assert.throws(() => atlas.upload(1, page.subarray(0, 11)), RangeError);
  atlas.dispose();
});

function garibaldiSurfaceFixture() {
  const root = new THREE.Group();
  const names = ['TERRAIN_VISTA', 'ROAD_RENDER', 'TERRAIN_HERO', 'TERRAIN_TRANSITION'];
  const meshes = names.map((name, i) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,i, 1,0,i, 0,1,i], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([.5,1,.75, 1,1,1, 1,1,1], 3));
    g.setIndex([0,1,2]);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({vertexColors:true}));
    mesh.name = name + '_WEB_MESH_Primitive_0';
    root.add(mesh);
    return mesh;
  });
  return {root, meshes};
}

test('the WebGPU surface package retains authored triangle order, distinct IDs and road tint', async () => {
  const {root, meshes} = garibaldiSurfaceFixture();
  const sources = readGaribaldiSurfaceMeshes(THREE, root, meshes[0]);
  assert.deepEqual(sources.map(source => source.id), [1,2,3,4]);
  const statics = sources.slice(1);
  const {indices, vertices} = await packGaribaldiSurfaces(statics);
  assert.deepEqual([...indices], [0,1,2,3,4,5,6,7,8]);
  assert.deepEqual(statics.map(source => source.first), [0,3,6]);
  assert.deepEqual([...vertices.slice(0, 8)], [0,0,1,32896,.5,1,.75,0]);
  assert.equal(vertices[24 + 2], 2);
});

test('transformed or grouped ground preserves the WebGL fallback, and packing can be aborted before publishing a range', async () => {
  const {root, meshes} = garibaldiSurfaceFixture();
  const sources = readGaribaldiSurfaceMeshes(THREE, root, meshes[0]);
  const controller = new AbortController();
  await assert.rejects(packGaribaldiSurfaces(sources.slice(1), controller.signal, async () => controller.abort()), {name:'AbortError'});
  assert.ok(sources.every(source => source.first === undefined));
  meshes[1].position.set(1, 0, 0);
  root.updateMatrixWorld(true);
  assert.throws(() => readGaribaldiSurfaceMeshes(THREE, root, meshes[0]), /incompatible/);
  meshes[1].position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  meshes[2].geometry.addGroup(0, 3, 0);
  assert.throws(() => readGaribaldiSurfaceMeshes(THREE, root, meshes[0]), /incompatible/);
});

test('constant linear HDR radiance integrates to pi times its value without a directional tint', () => {
  const width = 64, height = 32, data = new Uint16Array(width * height * 4);
  const pixel = [2, .5, 1, 1].map(THREE.DataUtils.toHalfFloat);
  for (let i = 0; i < data.length; i += 4) data.set(pixel, i);
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  const sky = prepareSurfaceSky(THREE, texture);
  assert.deepEqual([...sky.data.slice(0, 4)], pixel);
  for (const [channel, radiance] of [2, .5, 1].entries()) {
    assert.ok(Math.abs(sky.irradiance[channel] * .282094792 - Math.PI * radiance) < .004);
  }
  assert.ok(sky.irradiance.slice(4).every(coefficient => Math.abs(coefficient) < .01));
  assert.throws(() => prepareSurfaceSky(THREE, new THREE.Texture()), /panorama HDR/);
  texture.dispose();
});
