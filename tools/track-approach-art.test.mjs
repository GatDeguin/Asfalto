import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {THREE as T} from './cinematic-three.mjs';
import {attachTrackApproachArt, trackApproachArtAssets} from '../src/tracks/visuals/track-approach-art.mjs?v=1ed04832d43cd6e1';

const names = ['ART_HORIZON', ...['START','FINISH'].flatMap(end =>
  ['BANK_LEFT','BANK_RIGHT','STRATA','UNDERSTORY'].map(part => `ART_${end}_${part}`))];
const source = () => {
  const root = new T.Group();
  for (const end of ['START', 'FINISH']) for (const part of ['TERRAIN_-1','TERRAIN_1','STONES','ASPHALT']) {
    const mesh = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial());
    mesh.name = `APPROACH_${end}_${part}`;
    root.add(mesh);
  }
  return root;
};
const artwork = meshNames => {
  const root = new T.Group();
  for (const name of meshNames) {
    const mesh = new T.Mesh(new T.PlaneGeometry(), new T.MeshStandardMaterial());
    mesh.name = name + '.002_Primitive_0';
    root.add(mesh);
  }
  return root;
};

test('Blender artwork replaces both banks and keeps the road and its shared material', () => {
  const original = source(), art = artwork(names);
  const asphalt = original.getObjectByName('APPROACH_START_ASPHALT');
  const groundMaterial = original.getObjectByName('APPROACH_START_TERRAIN_-1').material;
  const diagnostics = attachTrackApproachArt(original, art, 'dos_lagos');
  assert.deepEqual(diagnostics, {id:'dos_lagos', meshes:9});
  assert.equal(original.getObjectByName(asphalt.name), asphalt);
  assert.equal(original.getObjectByName('APPROACH_START_TERRAIN_-1').material, groundMaterial);
  assert.equal(original.getObjectByName('APPROACH_START_STONES'), undefined);
  assert.equal(original.getObjectByName('ART_HORIZON.002_Primitive_0').userData.collision, false);
});

test('incomplete Blender files leave the original banks mounted', () => {
  const original = source(), before = original.children.slice(), art = artwork(names.slice(0,-1));
  assert.throws(() => attachTrackApproachArt(original, art, 'dos_lagos'), /UNDERSTORY/);
  assert.deepEqual(original.children, before);
  assert.equal(art.parent, null);
});

for (const [id, asset] of Object.entries(trackApproachArtAssets)) test(id+' has nine local colored Blender meshes with a bounded transport', async () => {
  const bytes = await readFile(new URL(`../assets/tracks/approach-art/${id}.glb.gz`,import.meta.url));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.ok(bytes.length < 1_400_000);
  const glb = gunzipSync(bytes);
  assert.equal(glb.readUInt32LE(0), 0x46546c67);
  const doc = JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
  assert.match(doc.asset.generator,/Blender/);
  assert.deepEqual(doc.nodes.map(node=>node.name.replace(/\.\d{3}$/,'')).sort(),names.slice().sort());
  assert.ok(doc.meshes.every(mesh=>mesh.primitives.every(primitive=>Number.isInteger(primitive.attributes.COLOR_0))));
  assert.ok(doc.buffers.every(buffer=>!buffer.uri) && !doc.images?.length);
});
