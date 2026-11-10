import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('assets/skies/catalog.json', root), 'utf8'));
const payloads = [
  ['asfalto-v5-dos-lagos-route', 'tracks/dos-lagos/route.json', 'dos_lagos_route.json'],
  ['asfalto-v5-dos-lagos-visual', 'tracks/dos-lagos/scene.glb', 'dos_lagos_scene_hyperreal_blender_pass_v3.glb'],
  ['asfalto-v5-dos-lagos-collision', 'tracks/dos-lagos/collision.glb', 'dos_lagos_collision.glb'],
  ...catalog.presets.map(({file}) => ['asfalto-v5-hdri-' + file.replace(/\.av3hdri$/, ''), 'assets/skies/' + file, file]),
];

test('Dos Lagos and every HDR sky use their canonical asset in the legacy payload descriptors', () => {
  for (const [id, file, duplicate] of payloads) {
    const tag = html.match(new RegExp('<script\\s+id="' + id + '"[^>]*>'))?.[0];
    assert.ok(tag, id);
    assert.equal(tag.match(/data-external-url="([^"]+)"/)?.[1], './' + file, id);
    const bytes = readFileSync(new URL(file, root));
    assert.equal(bytes.length, Number(tag.match(/data-bytes="(\d+)"/)?.[1]), id);
    const digest = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    assert.equal(digest, tag.match(/data-sha256="([A-F0-9]+)"/)?.[1], id);
    assert.equal(existsSync(new URL('assets/extracted/' + id + '/' + duplicate, root)), false, id);
  }
});
