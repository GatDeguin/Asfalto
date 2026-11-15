import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { THREE as T } from './cinematic-three.mjs';
import { createCockpitDriverArms } from '../src/render/cockpit-driver-arms.mjs?v=f9a1f6f8e1f7dda2';
import { sanitizeDriverArmsSettings } from '../src/game/cockpit-driver-arms-settings.mjs?v=8e4913a8b8088612';
import { readVehiclePreference, vehiclePreferenceKey } from '../src/game/cockpit-layout-file.mjs';

function fixture(tube = .014) {
  const parent = new T.Group(), pivot = new T.Group(), knob = new T.Group();
  const rim = new T.Mesh(new T.TorusGeometry(.18, tube, 16, 64), new T.MeshBasicMaterial());
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
    for (const [x, y, z] of arms.diagnostics().grips) {
      assert.ok(Math.abs(Math.hypot(x, y) - .18) < .004);
      assert.ok(z >= -.001 && z < .020);
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

test('palms, fingers and cuffs fit the rim continuously through regrips', () => {
  const { parent, pivot, arms, sample } = fixture();
  const previous = [null, null];
  for (let i = -240; i <= 240; i++) {
    const angle = i / 20;
    pivot.rotation.z = angle;
    arms.update({ ...sample, wheelSpinRad: angle });
    const rig = parent.getObjectByName('CockpitDriverArms');
    const pose = arms.diagnostics();
    assert.equal(rig.children.length, 4);
    assert.ok(pose.contacts.some(contact => contact === 'wheel'), 'The other hand must hold during a regrip');
    for (const [index, side] of ['L', 'R'].entries()) {
      const hand = rig.getObjectByName(`CockpitDriver_hand.${side}`);
      assert.ok(hand.geometry.attributes.position.count > 2500);
      assert.equal(hand.geometry.morphAttributes.position.length, 2);
      const wrist = hand.position;
      const grip = new T.Vector3(...pose.grips[index]);
      assert.ok(wrist.distanceTo(grip) > .06 && wrist.distanceTo(grip) < .11);
      if (pose.contacts[index] === 'wheel') {
        assert.ok(Math.abs(Math.hypot(grip.x, grip.y) - .18) < .004);
        assert.ok(Math.abs(grip.z) < .003);
      }
      if (previous[index]) assert.ok(previous[index].distanceTo(wrist) < .035, 'Grip must stay continuous across turns');
      previous[index] = wrist.clone();
      const cuff = new T.Vector3(...pose.cuffs[index]);
      assert.ok(cuff.distanceTo(wrist) < .022);
    }
  }
  arms.dispose();
});

test('shifting takes an open hand to the moving knob with the left hand on the wheel', () => {
  const { parent, pivot, knob, arms, sample } = fixture();
  arms.update(sample);
  for (let frame = 0; frame < 40; frame++) {
    pivot.rotation.z = (frame + 20) * .08;
    arms.update({ ...sample, shifting: true, wheelSpinRad: pivot.rotation.z });
    const pose = arms.diagnostics();
    assert.equal(pose.contacts[0], 'wheel');
    if (pose.shiftBlend > .15 && pose.shiftBlend < .7) {
      const hand = parent.getObjectByName('CockpitDriver_hand.R');
      assert.ok(hand.morphTargetInfluences[hand.morphTargetDictionary.reach] > .3);
    }
  }
  const pose = arms.diagnostics();
  assert.equal(pose.contacts[1], 'shifter');
  assert.ok(new T.Vector3(...pose.grips[1]).distanceTo(knob.position) < .009);
  arms.dispose();
});

test('the actual finger surfaces seat against thin, intermediate and thick rims', () => {
  const point = new T.Vector3();
  for (const tube of [.009, .010, .014, .018, .020, .022]) {
    const { parent, arms, sample } = fixture(tube);
    arms.update(sample);
    parent.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const hand = parent.getObjectByName(`CockpitDriver_hand.${side}`);
      let contact = 0, penetration = 0;
      for (let i = 0; i < hand.geometry.attributes.position.count; i++) {
        hand.getVertexPosition(i, point).applyMatrix4(hand.matrixWorld);
        const depth = Math.hypot(Math.hypot(point.x, point.y) - .18, point.z) - tube;
        if (Math.abs(depth) < .002) contact++;
        penetration = Math.max(penetration, -depth);
      }
      assert.ok(contact > 140, `Surface was floating at ${tube * 1000} mm`);
      assert.ok(penetration < .0032, `Surface crossed the rim by ${(penetration * 1000).toFixed(2)} mm`);
    }
    arms.dispose();
  }
});

test('a stationary sleeve stays idle and 20 toggles dispose all of the avatar resources', () => {
  const { parent, arms, sample } = fixture();
  for (let retry = 0; retry < 20; retry++) {
    arms.update(sample);
    const rig = parent.getObjectByName('CockpitDriverArms');
    const resources = new Set(rig.children.flatMap(mesh => [mesh.geometry, mesh.material, mesh.material.map].filter(Boolean)));
    const disposed = new Set();
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.add(resource));
    for (let frame = 0; frame < 30; frame++) arms.update(sample);
    assert.equal(arms.diagnostics().sleeveUpdates, 2);
    arms.update({ ...sample, settings: sanitizeDriverArmsSettings() });
    assert.equal(parent.getObjectByName('CockpitDriverArms'), undefined);
    assert.deepEqual(disposed, resources);
  }
  arms.dispose();
});

test('opening the workshop frees the cockpit rig before the shared renderer changes views', () => {
  const { parent, arms, sample } = fixture();
  arms.update(sample);
  const host = readFileSync(new URL('../src/legacy/module-02.mjs?v=134e5b841811b93e', import.meta.url), 'utf8');
  const start = host.indexOf('  function syncDocumentFlags(){');
  const end = host.indexOf('\n  syncDocumentFlags();', start);
  assert.ok(start >= 0 && end > start);
  const flags = { menuOpen: false, hidden: false };
  const classes = new Set();
  const document = { hidden: false, body: { classList: { contains: name => classes.has(name) } } };
  const sync = new Function('documentFlags', 'document', 'driverArms', host.slice(start, end) + '\nreturn syncDocumentFlags;')(flags, document, arms);
  sync();
  assert.equal(arms.diagnostics().visible, true);
  classes.add('v6-menu-open');
  sync();
  assert.equal(arms.diagnostics().triangles, 0);
  assert.equal(parent.getObjectByName('CockpitDriverArms'), undefined);
  arms.dispose();
});
