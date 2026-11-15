import assert from 'node:assert/strict';
import test from 'node:test';
import { THREE as T } from './cinematic-three.mjs';
import { createCockpitDriverArms } from '../src/render/cockpit-driver-arms.mjs?v=e2b1cf3b3f9c446c';
import { sanitizeDriverArmsSettings } from '../src/game/cockpit-driver-arms-settings.mjs?v=8e4913a8b8088612';
import { readVehiclePreference, vehiclePreferenceKey } from '../src/game/cockpit-layout-file.mjs';

function fixture() {
  const parent = new T.Group(), pivot = new T.Group(), knob = new T.Group();
  const rim = new T.Mesh(new T.TorusGeometry(.18, .014, 10, 48), new T.MeshBasicMaterial());
  pivot.add(rim);
  knob.position.set(.35, -.20, .16);
  parent.add(pivot, knob);
  const arms = createCockpitDriverArms(T);
  arms.bind({ parent, pivot, wheel: rim, knob });
  const settings = sanitizeDriverArmsSettings({ enabled: true });
  const sample = { settings, active: true, gear: '2', shifting: false, grabbing: false, dt: 1 / 60 };
  return { parent, pivot, knob, arms, sample };
}

test('the experimental setting starts off and clamps the saved pose per model', () => {
  const key = 'race-settings';
  const values = new Map([[vehiclePreferenceKey(key, 'chevy'), JSON.stringify({ enabled: true, shiftEnabled: false, gripDeg: 300, shoulderHeightCm: -99, shiftSeconds: .20 })]]);
  const storage = { getItem: id => values.get(id) };
  const chevy = sanitizeDriverArmsSettings(readVehiclePreference(storage, key, 'chevy'));
  const belAir = sanitizeDriverArmsSettings(readVehiclePreference(storage, key, 'belair_1957'));
  assert.deepEqual(chevy, { enabled: true, shiftEnabled: false, gripDeg: 78, shoulderHeightCm: -12, shoulderReachCm: 0, shiftSeconds: .20 });
  assert.equal(belAir.enabled, false);
  assert.equal(belAir.shiftEnabled, true);
  assert.equal(sanitizeDriverArmsSettings({ enabled: 'false', gripDeg: null }).enabled, false);
});

test('an enabled rig uses the measured wheel, follows the moving rim and reclamps its grip', () => {
  const { parent, pivot, arms, sample } = fixture();
  arms.update({ ...sample, settings: sanitizeDriverArmsSettings() });
  assert.equal(parent.getObjectByName('CockpitDriverArms'), undefined);
  arms.update(sample);
  const rest = arms.diagnostics();
  assert.equal(rest.visible, true);
  assert.ok(rest.hands[0][0] < -.11 && rest.hands[1][0] > .11);
  pivot.rotation.z = .15;
  arms.update(sample);
  const turning = arms.diagnostics();
  const expected = new T.Vector3(...rest.hands[1]).applyAxisAngle(new T.Vector3(0, 0, 1), .15);
  assert.ok(expected.distanceTo(new T.Vector3(...turning.hands[1])) < .001);
  for (let frame = 2; frame < 180; frame++) {
    pivot.rotation.z = frame * .15;
    arms.update({ ...sample, wheelSpinRad:pivot.rotation.z });
    for (const [x, y, z] of arms.diagnostics().hands) {
      assert.ok(Math.abs(Math.hypot(x, y) - .18) < .023);
      assert.ok(z > 0 && z < .08);
    }
  }
  pivot.rotation.z = 0;
  arms.update({ ...sample, wheelSpinRad:0 });
  assert.deepEqual(arms.diagnostics().hands, rest.hands);
  arms.update({ ...sample, settings: sanitizeDriverArmsSettings({ enabled: true, shoulderHeightCm: 7 }) });
  assert.ok(arms.diagnostics().shoulders[0][1] > rest.shoulders[0][1] + .05);
  arms.dispose();
  assert.equal(parent.getObjectByName('CockpitDriverArms'), undefined);
});

test('the shift hand tracks the actual moving knob, then returns without reacting to an old shift', () => {
  const { arms, knob, sample } = fixture();
  arms.update(sample);
  const steady = arms.diagnostics();
  const shift = { ...sample, gear: '3', shifting: true };
  for (let frame = 0; frame < 24; frame++) arms.update(shift);
  const grasped = arms.diagnostics();
  assert.equal(grasped.shiftBlend, 1);
  assert.deepEqual(grasped.hands[0], steady.hands[0]);
  assert.ok(new T.Vector3(...grasped.hands[1]).distanceTo(knob.position) < .09);
  knob.position.x += .024;
  arms.update(shift);
  assert.ok(Math.abs(arms.diagnostics().hands[1][0] - grasped.hands[1][0] - .024) < 1e-6);
  arms.update({ ...shift, paused: true, shifting: false });
  assert.equal(arms.diagnostics().shiftBlend, 1);
  arms.update({ ...shift, reducedMotion: true });
  assert.equal(arms.diagnostics().shiftBlend, 0);
  arms.update({ ...shift, active: false });
  assert.equal(arms.diagnostics().visible, false);
  for (let frame = 0; frame < 50; frame++) arms.update({ ...shift, shifting: false });
  assert.equal(arms.diagnostics().shiftBlend, 0);
  arms.dispose();
});
