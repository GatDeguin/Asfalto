import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {installClassicCabinSurfaces} from '../src/render/classic-cabin-surfaces.mjs?v=7acecb476191cf1b';

test('the Bel Air toe board closes the sight lines from the driver to the road under the dashboard', () => {
  const model = new T.Group();
  const trim = installClassicCabinSurfaces(T, model, 'belair_1957');
  const board = model.getObjectByName('BelAir_ToeBoard');
  assert.ok(board?.isMesh, 'the toe board must be solid cabin geometry');
  model.updateMatrixWorld(true);
  const ray = new T.Raycaster(), origin = new T.Vector3(.20, .184, .18);
  for (const [pitch, yaw] of [[-28, 15], [-35, -25], [-35, -20], [-35, -15], [-35, 15]]) {
    const p = T.MathUtils.degToRad(pitch), y = T.MathUtils.degToRad(yaw);
    ray.set(origin, new T.Vector3(-Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)));
    assert.ok(ray.intersectObject(board).some(hit => hit.point.y > -.161), `open footwell at ${pitch}°, ${yaw}°`);
  }
  trim.dispose();
  assert.equal(model.getObjectByName('BelAir_ToeBoard'), undefined);
});
