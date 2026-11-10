import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {CIRCUIT_IDS, readCircuitSource} from './fixtures/closed-circuit-source.mjs?v=dab87f84716fb019';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {addTrackApproaches} from '../src/tracks/visuals/track-approaches.mjs?v=af849d453160b2ba';

for (const id of CIRCUIT_IDS) test(`${id} joins both gates to asphalt beyond the official route`, () => {
  const source = readCircuitSource(id);
  const query = createRouteQuery(source);
  const visual = new T.Group(), collision = new T.Group();
  addTrackApproaches(T, {id, query, lengthM: source.lengthM, visualRoot: visual, collisionRoot: collision});
  assert.equal(query.sample(source.lengthM).sM, source.lengthM);
  assert.equal(query.sample(source.lengthM + 50).sM, source.lengthM);
  const position = new T.Vector3(), down = new T.Vector3(0, -1, 0);
  for (const [tag, s, sign] of [['START', 0, -1], ['FINISH', source.lengthM, 1]]) {
    const gate = query.sample(s);
    const asphalt = visual.getObjectByName(`APPROACH_${tag}_ASPHALT`);
    const pavement = collision.getObjectByName(`COLLISION_APPROACH_${tag}_PAVEMENT`);
    assert.ok(asphalt?.isMesh && pavement?.isMesh);
    const points = pavement.geometry.attributes.position;
    assert.ok(points.count > 250 && points.count < 600);
    const centerAt = row => position.fromBufferAttribute(points, row * 3 + 1).clone();
    const gatePoint = new T.Vector3(...gate.position), outward = new T.Vector3(...gate.frame.tangent).multiplyScalar(sign);
    assert.ok(centerAt(0).distanceTo(gatePoint) < 0.55);
    assert.ok(centerAt(1).distanceTo(gatePoint) < .003);
    assert.ok(centerAt(2).sub(gatePoint).dot(outward) > 1.99);
    assert.ok(centerAt(points.count / 3 - 1).distanceTo(gatePoint) > 480);
    for (let row = 1; row < points.count / 3; row += 11) {
      const center = centerAt(row), previous = centerAt(row - 1);
      assert.ok(Math.abs(center.y - previous.y) / Math.hypot(center.x - previous.x, center.z - previous.z) < .14);
      const ray = new T.Raycaster(center.clone().addScaledVector(down, -2), down, 0, 3);
      assert.ok(ray.intersectObject(pavement, false).length > 0, `${tag} row ${row} has tire support`);
    }
  }
});
