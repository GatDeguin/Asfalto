import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {THREE as T} from './cinematic-three.mjs';
import {createWaterfallEffects} from '../src/render/weather-waterfalls.mjs';
import {decodeGlbDocument, parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {attachIguazuSidefalls, iguazuSidefallsAsset} from '../src/tracks/visuals/iguazu-sidefalls.mjs?v=366b813b19c9b9ac';
import {loadRegionalBlenderArt} from '../src/tracks/visuals/regional-blender-art.mjs';

async function decode(bytes) {
  return globalThis.AsfaltoV5GlbCore.completeGlbToObject(T, bytes, 'Iguazú', {
    decodedDocument: await decodeGlbDocument(Uint8Array.from(bytes).buffer),
    parseGlb: parseGlbContainer,
    makeAttribute: makeGlbAttribute,
    textureFromInfo: () => null,
  });
}

async function loadAsset(root, fetchBytes, dispose = () => {}) {
  return loadRegionalBlenderArt({root, releaseRoot:'http://127.0.0.1/', asset:iguazuSidefallsAsset, label:'Saltos laterales'}, {
    fetchBytes, loadGlb:decode, attach:(root, art) => attachIguazuSidefalls(T, root, art), dispose,
  });
}

function source() {
  const root = new T.Group();
  const waterfallMaterial = new T.MeshStandardMaterial({name:'MAT_waterfall_FLOW', map:new T.Texture()});
  for (let id = 0; id < 6; id++) {
    const owner = new T.Group();
    owner.name = `SIDEFALL_${id}`;
    const old = new T.Mesh(new T.PlaneGeometry(), waterfallMaterial);
    old.name = `${owner.name}_Primitive_0`;
    old.userData.asfaltoWaterfall = {heightM:18};
    owner.add(old);
    root.add(owner);
  }
  const main = new T.Mesh(new T.PlaneGeometry(), waterfallMaterial);
  main.name = 'WATERFALL_15_Primitive_0';
  main.userData.asfaltoWaterfall = {impactCenter:[800,15,7300]};
  root.add(main);
  return {root, main, waterfallMaterial};
}

test('Blender replaces six displaced Iguazú sidefalls with real basin contacts', async () => {
  const bytes = await readFile(new URL('../' + iguazuSidefallsAsset.path, import.meta.url));
  assert.ok(bytes.length < 180_000);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), iguazuSidefallsAsset.sha256);
  const {root, main, waterfallMaterial} = source();
  const diagnostics = await loadAsset(root, async () => bytes);
  assert.equal(diagnostics.sites.length, 6);
  assert.equal(diagnostics.primitives, 18);
  const art = root.getObjectByName('ASFALTO_IGUAZU_SALTOS_LATERALES');
  assert.ok(art?.isObject3D);
  for (const site of diagnostics.sites) {
    const old = root.getObjectByName(`SIDEFALL_${site.id}_Primitive_0`);
    const curtain = art.getObjectByName(`IGUAZU_LATERAL_${site.id}_CAIDA_Primitive_0`);
    assert.ok(curtain?.isMesh && curtain.userData.collision === false);
    assert.equal(curtain.material.map, waterfallMaterial.map);
    assert.equal(old.parent.visible, false);
    assert.equal(old.userData.asfaltoWaterfall, undefined);
    assert.ok(curtain.userData.asfaltoWaterfall.impactSpanM > 2);
    assert.ok(curtain.userData.asfaltoWaterfall.impactReceiverTriangles.length > 0);
  }
  assert.equal(main.visible, true);
  assert.deepEqual(main.userData.asfaltoWaterfall.impactCenter, [800,15,7300]);
  const effects = createWaterfallEffects(T, new T.Group());
  effects.setTrack({visualRoot:root});
  try {
    assert.equal(effects.diagnostics().waterfalls,7);
    assert.ok(effects.diagnostics().foamTriangles > 0);
  } finally {
    effects.dispose();
  }
});

test('Iguazú keeps the original waterfall state if the optional transport is truncated', async t => {
  const {root} = source();
  const originals = [...root.children];
  t.mock.method(console, 'warn', () => {});
  const result = await loadAsset(root, async () => Uint8Array.of(8, 3, 5));
  assert.equal(result, null);
  assert.deepEqual(root.children, originals);
  for (const owner of originals.slice(0, 6)) {
    assert.equal(owner.visible, true);
    assert.equal(owner.children[0].userData.asfaltoWaterfall.heightM, 18);
  }
  assert.equal(console.warn.mock.callCount(), 1);
});

test('invalid basin geometry leaves all six native waterfalls mounted', async () => {
  const {root} = source();
  const bytes = await readFile(new URL('../' + iguazuSidefallsAsset.path, import.meta.url));
  const art = await decode(gunzipSync(bytes));
  const basin = art.getObjectByName('IGUAZU_LATERAL_5_CUENCO');
  basin.position.y += 40;
  assert.throws(() => attachIguazuSidefalls(T, root, art), /Falta el contacto entre el salto lateral 5/);
  assert.equal(art.parent,null);
  for (let id = 0; id < 6; id++) {
    const owner = root.getObjectByName(`SIDEFALL_${id}`);
    assert.equal(owner.visible,true);
    assert.equal(owner.children[0].userData.asfaltoWaterfall.heightM,18);
  }
});
