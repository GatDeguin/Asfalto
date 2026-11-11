import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadRegionalBlenderArt} from '../src/tracks/visuals/regional-blender-art.mjs?v=942ba726ff042432';

const payload = Uint8Array.of(0x67, 0x6c, 0x54, 0x46);
const asset = {
  path: 'assets/tracks/terrain.glb',
  bytes: payload.byteLength,
  sha256: createHash('sha256').update(payload).digest('hex'),
};
const root = {isObject3D: true};
const label = 'Escenografía de prueba';
const releaseRoot = 'https://example.test/asfalto/';

test('an optional regional asset checks its local lock before the visual handoff', async () => {
  const art = {};
  const mounted = await loadRegionalBlenderArt({root, releaseRoot, asset, label}, {
    async fetchBytes(url) {
      assert.equal(url, releaseRoot + asset.path + '?v=' + asset.sha256.slice(0, 16));
      return payload;
    },
    async loadGlb(bytes) {
      assert.deepEqual(bytes, payload);
      return art;
    },
    attach(target, parsed) {
      assert.equal(target, root);
      assert.equal(parsed, art);
      return 'mounted';
    },
    dispose() { assert.fail('attached art belongs to the root'); },
  });
  assert.equal(mounted, 'mounted');
});

test('a corrupt regional asset keeps the original scenery usable', async t => {
  t.mock.method(console, 'warn', () => {});
  const result = await loadRegionalBlenderArt({root, releaseRoot, asset, label}, {
    fetchBytes: async () => Uint8Array.of(1, 2, 3, 4),
    loadGlb() { assert.fail('an invalid asset must not be decoded'); },
    attach() { assert.fail('invalid geometry cannot be attached'); },
    dispose() { assert.fail('no geometry was created'); },
  });
  assert.equal(result, null);
  assert.equal(console.warn.mock.callCount(), 1);
});

test('canceling a regional load after parse releases the candidate exactly once', async () => {
  const controller = new AbortController();
  const reason = new DOMException('Cambio de pista', 'AbortError');
  const art = {};
  let disposals = 0;
  await assert.rejects(loadRegionalBlenderArt({root, releaseRoot, asset, label, signal: controller.signal}, {
    fetchBytes: async () => payload,
    async loadGlb() { controller.abort(reason); return art; },
    attach() { assert.fail('a canceled load cannot be attached'); },
    dispose(candidate) { assert.equal(candidate, art); disposals++; },
  }), error => error === reason);
  assert.equal(disposals, 1);
});
