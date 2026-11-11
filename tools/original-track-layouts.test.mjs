import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('playable route distances match the point-to-point source manifests', () => {
  const {tracks} = JSON.parse(read('tracks/registry.json'));
  assert.equal(tracks.length, 5);
  for (const track of tracks) {
    const manifest = JSON.parse(read('tracks/' + track.manifest));
    assert.equal(manifest.format, 'point_to_point', track.id);
    assert.equal(track.lengthM, manifest.lengthM, track.id);
    assert.equal(Object.hasOwn(track, 'closedRuntimeLengthM'), false, track.id);
  }
});

test('the live host and Iguazú adapter do not add a connector after the authored finish', () => {
  assert.doesNotMatch(read('src/legacy/module-02.mjs?v=425f8400e08a617f'), /prepareClosedRoute\s*\(/);
  assert.doesNotMatch(read('src/tracks/adapters/cataratas-iguazu.mjs?v=3f0ac0c089745439'), /prepareClosedRoute/);
});

test('club competitions offer one pass and the route sheet uses the official distance', () => {
  assert.doesNotMatch(read('index.html'), /id="v6-comp-laps"/);
  assert.match(read('src/menu/drive-route-sheet.mjs?v=8af0468b53b20f46'), /entry\?\.lengthM/);
  assert.doesNotMatch(read('src/menu/drive-route-sheet.mjs?v=8af0468b53b20f46'), /closedRuntimeLengthM|El regreso/);
});
