import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { THREE as T } from './cinematic-three.mjs';
import { createCockpitDriverArms } from '../src/render/cockpit-driver-arms.mjs?v=9382b60c92c41ea6';
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
      const wrist = new T.Vector3(...pose.hands[index]);
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

test('the resting wrist approaches the grip from below and behind the rim', () => {
  const { arms, sample } = fixture();
  arms.update(sample);
  const { hands, grips, cuffs } = arms.diagnostics();
  for (const [i, [x, y, z]] of hands.entries()) {
    assert.ok(y < grips[i][1] + .003, 'A high wrist forces the hand to fold inward toward the hub');
    assert.ok(z - grips[i][2] > .047, 'The palm should reach forward from the wrist');
    assert.ok(Math.hypot(x - cuffs[i][0], y - cuffs[i][1], z - cuffs[i][2]) < .012);
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
    const resources = new Set(rig.children.flatMap(({ geometry, material }) =>
      [geometry, material, material.map, material.bumpMap, material.roughnessMap].filter(Boolean)));
    const disposed = new Map();
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
    for (let frame = 0; frame < 30; frame++) arms.update(sample);
    assert.equal(arms.diagnostics().sleeveUpdates, 2);
    arms.update({ ...sample, settings: sanitizeDriverArmsSettings() });
    assert.equal(parent.getObjectByName('CockpitDriverArms'), undefined);
    assert.deepEqual(disposed, new Map([...resources].map(resource => [resource, 1])));
  }
  arms.dispose();
});

test('the skin and cloth share UV-mapped pigment, relief and roughness between both arms', () => {
  const { parent, arms, sample } = fixture();
  arms.update(sample);
  const rig = parent.getObjectByName('CockpitDriverArms');
  for (const part of ['hand', 'sleeve']) {
    const left = rig.getObjectByName(`CockpitDriver_${part}.L`), right = rig.getObjectByName(`CockpitDriver_${part}.R`);
    assert.equal(left.material, right.material);
    const { map, bumpMap, roughnessMap } = left.material;
    assert.equal(left.geometry.getAttribute('uv')?.count, left.geometry.getAttribute('position').count);
    assert.equal(map.colorSpace, T.SRGBColorSpace);
    assert.ok(map.generateMipmaps);
    assert.ok(bumpMap?.generateMipmaps);
    assert.equal(bumpMap, roughnessMap);
    assert.equal(bumpMap.colorSpace, T.NoColorSpace);
    const values = bumpMap.image.data;
    let low = 255, high = 0;
    for (let i = 1; i < values.length; i += 4) {
      low = Math.min(low, values[i]);
      high = Math.max(high, values[i]);
    }
    assert.ok(high - low > 28, 'Different surfaces need distinct roughness');
  }
  arms.dispose();
});

test('the longitudinal sleeve seam preserves the surface normal as the arm moves', () => {
  const { parent, pivot, arms, sample } = fixture();
  const point = new T.Vector3(), opposite = new T.Vector3();
  for (const turn of [0, .8, -1.4, 2.2]) {
    pivot.rotation.z = turn;
    arms.update({ ...sample, wheelSpinRad: turn });
    for (const suffix of ['L', 'R']) {
      const sleeve = parent.getObjectByName(`CockpitDriver_sleeve.${suffix}`);
      const { uv, position, normal } = sleeve.geometry.attributes;
      const width = Array.from({ length: uv.count }, (_, i) => i).find(i => i > 0 && uv.getX(i) === uv.getX(0));
      assert.ok(width > 10);
      for (let ring = 0; ring < uv.count; ring += width) {
        const otherEdge = ring + width - 1;
        assert.ok(point.fromBufferAttribute(position, ring).distanceTo(opposite.fromBufferAttribute(position, otherEdge)) < .000001);
        assert.ok(point.fromBufferAttribute(normal, ring).dot(opposite.fromBufferAttribute(normal, otherEdge)) > .999);
      }
    }
  }
  arms.dispose();
});

test('opening the workshop frees the cockpit rig before the shared renderer changes views', () => {
  const { parent, arms, sample } = fixture();
  arms.update(sample);
  const host = readFileSync(new URL('../src/legacy/module-02.mjs?v=b398773f8cb0185a', import.meta.url), 'utf8');
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
