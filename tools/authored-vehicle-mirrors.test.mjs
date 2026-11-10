import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {attachAuthoredMirrors} from '../src/render/authored-vehicle-mirrors.mjs?v=2c508a9c35caef1c';

test('the 400 live reflection is a round disc seated in the angled chrome housing', () => {
  const root = new T.Group();
  const feed = new T.MeshBasicMaterial();
  const mirrors = attachAuthoredMirrors(T, {root}, 'chevy_400_1957', {
    center: {glass: {material: feed}}, left: {glass: {material: feed}},
  });
  const glass = root.getObjectByName('AuthoredMirrorFace_left');
  const outline = glass.geometry.attributes.position;
  const radii = [];
  for (let i = 0; i < outline.count; i++) {
    const radius = Math.hypot(outline.getX(i), outline.getY(i));
    if (radius > 0) radii.push(radius);
  }
  assert.ok(radii.length >= 32, 'the reflection surface needs a curved perimeter');
  assert.ok(radii.every(radius => Math.abs(radius - radii[0]) < 1e-6));
  assert.ok(radii[0] > .022 && radii[0] < .025);
  const authoredCenter = new T.Vector3(-.21652, .17780, .40384);
  const authoredNormal = new T.Vector3(.873, .038, .487).normalize();
  const placement = glass.position.clone().sub(authoredCenter);
  assert.ok(placement.length() < .0012 && placement.dot(authoredNormal) > .0003);
  assert.ok(new T.Vector3(0, 0, 1).applyQuaternion(glass.quaternion).dot(authoredNormal) > .999);
  assert.equal(glass.material, feed);
  mirrors.dispose();
  feed.dispose();
});
