import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { THREE as T } from './cinematic-three.mjs';
import { createCockpitDriverArms } from '../src/render/cockpit-driver-arms.mjs?v=ad72f30c7851f5ff';
import { COCKPIT_HAND_MESH } from '../src/render/cockpit-hand-mesh.mjs?v=ecf8eef834b29fbf';
import { sanitizeDriverArmsSettings } from '../src/game/cockpit-driver-arms-settings.mjs?v=b0a5c2457804d040';
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
  const sample = { settings, active: true, shiftProgress: 0, dt: 1 / 60 };
  return { parent, pivot, knob, arms, sample };
}

test('the experimental setting starts off and clamps the saved pose per model', () => {
  const key = 'race-settings';
  const values = new Map([[vehiclePreferenceKey(key, 'chevy'), JSON.stringify({ enabled: true, shiftEnabled: false, gripDeg: 300, shoulderHeightCm: -99, shiftSeconds: .20 })]]);
  const storage = { getItem: id => values.get(id) };
  const chevy = sanitizeDriverArmsSettings(readVehiclePreference(storage, key, 'chevy'));
  const belAir = sanitizeDriverArmsSettings(readVehiclePreference(storage, key, 'belair_1957'));
  assert.equal(chevy.gripDeg, 120);
  assert.equal(chevy.shoulderHeightCm, -12);
  assert.equal(chevy.shiftEnabled, false);
  assert.equal(chevy.shiftSeconds, .20);
  assert.equal(belAir.enabled, false);
  assert.equal(belAir.shiftEnabled, true);
  assert.equal(sanitizeDriverArmsSettings({ enabled: 'false', gripDeg: null }).enabled, false);
  assert.equal(sanitizeDriverArmsSettings({ enabled: true, gripDeg: 60 }).gripDeg, 90);
  assert.equal(sanitizeDriverArmsSettings({ enabled: true, gripDeg: 60, poseVersion: 2 }).gripDeg, 60);
});

test('the reference grip rests at nine and three with the palm and cuff approaching from below', () => {
  const { parent, arms, sample } = fixture();
  arms.update(sample);
  const { hands, grips, cuffs } = arms.diagnostics();
  for (const [i, suffix] of ['L', 'R'].entries()) {
    const hand = parent.getObjectByName(`CockpitDriver_hand.${suffix}`);
    const rimInHand = new T.Vector3(0, 1, 0).applyQuaternion(hand.quaternion.clone().invert());
    assert.ok(Math.abs(grips[i][1]) < .002, 'Both grips should start level with the center of the wheel');
    assert.ok(grips[i][1] - hands[i][1] > .016, 'Cuffs approach from below');
    assert.ok(Math.abs(hands[i][0]) > Math.abs(grips[i][0]) + .012);
    assert.ok(Math.abs(rimInHand.x) > .80 && Math.abs(rimInHand.y) < .55,
      'The rim crosses the width of the palm from the little finger toward the thumb');
    assert.ok(new T.Vector3(...hands[i]).distanceTo(new T.Vector3(...cuffs[i])) < .012);
  }
  arms.dispose();
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

test('a moderate turn keeps the rising hand above the wheel center and leaves both hands on their sides', () => {
  const { pivot, arms, sample } = fixture();
  for (const turn of [-.78, .78]) {
    pivot.rotation.z = turn;
    arms.update({ ...sample, wheelSpinRad: turn });
    const { grips } = arms.diagnostics();
    assert.ok(grips[0][0] < -.08 && grips[1][0] > .08);
    const rising = turn < 0 ? 0 : 1;
    assert.ok(grips[rising][1] > .075);
    assert.ok(grips[1 - rising][1] < -.075);
  }
  arms.dispose();
});

test('the shift hand tracks the actual moving knob, then returns without reacting to an old shift', () => {
  const { arms, knob, sample } = fixture();
  arms.update(sample);
  const steady = arms.diagnostics();
  const shift = { ...sample, shiftProgress: 1 };
  arms.update(shift);
  const grasped = arms.diagnostics();
  assert.equal(grasped.shiftBlend, 1);
  assert.deepEqual(grasped.hands[0], steady.hands[0]);
  assert.ok(new T.Vector3(...grasped.hands[1]).distanceTo(knob.position) < .09);
  knob.position.x += .024;
  arms.update(shift);
  assert.ok(Math.abs(arms.diagnostics().hands[1][0] - grasped.hands[1][0] - .024) < 1e-6);
  arms.update({ ...shift, paused: true });
  assert.equal(arms.diagnostics().shiftBlend, 1);
  arms.update({ ...shift, reducedMotion: true });
  assert.equal(arms.diagnostics().shiftBlend, 0);
  arms.update({ ...shift, active: false });
  assert.equal(arms.diagnostics().visible, false);
  arms.update(sample);
  assert.equal(arms.diagnostics().shiftBlend, 0);
  arms.dispose();
});

test('a steering correction flexes the fingers on different timings and settles back on the same palm support', () => {
  const { parent, arms, sample } = fixture(.0155);
  arms.update(sample);
  const hand = parent.getObjectByName('CockpitDriver_hand.R');
  const names = ['indexFlex', 'outerFlex', 'thumbFlex'];
  const readFlexion = () => names.map(name => hand.morphTargetInfluences[hand.morphTargetDictionary[name]]);
  const rest = arms.diagnostics();
  assert.deepEqual(readFlexion(), [0, 0, 0]);
  for (let frame = 0; frame < 16; frame++) arms.update({ ...sample, steeringRateRadS: 3 });
  const flexed = readFlexion();
  assert.ok(flexed.every(weight => weight > 0 && weight < .32));
  assert.ok(new Set(flexed).size === names.length);
  assert.ok(new T.Vector3(...arms.diagnostics().grips[1]).distanceTo(new T.Vector3(...rest.grips[1])) > .0002);
  assert.deepEqual(arms.diagnostics().contacts, ['wheel', 'wheel']);
  arms.update({ ...sample, steeringRateRadS: -3, paused: true });
  assert.deepEqual(readFlexion(), flexed);
  for (let frame = 0; frame < 150; frame++) {
    arms.update(sample);
    if (readFlexion().every(weight => weight === 0) &&
        arms.diagnostics().grips[1].every((value, i) => value === rest.grips[1][i])) break;
  }
  assert.deepEqual(readFlexion(), [0, 0, 0]);
  assert.deepEqual(arms.diagnostics().grips, rest.grips);
  arms.update({ ...sample, steeringRateRadS: 3, reducedMotion: true });
  assert.deepEqual(readFlexion(), [0, 0, 0]);
  arms.dispose();
});

test('with a steady wheel, each hand makes its own small adjustment and keeps the palm on the rim', () => {
  const { arms, sample } = fixture(.0155);
  arms.update(sample);
  const rest = arms.diagnostics();
  let previous = rest;
  const wristTravel = [0, 0];
  const flexPeaks = [[0, 0, 0], [0, 0, 0]];
  let restedBetweenGestures = false, sawAdjustment = false, sawThumbLead = false;
  const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
  for (let frame = 0; frame < 600; frame++) {
    arms.update(sample);
    const current = arms.diagnostics();
    const moving = current.fingerFlex.map(hand => hand.some(weight => weight > .003));
    assert.ok(moving.filter(Boolean).length <= 1, 'The hands adjust independently');
    if (sawAdjustment && !moving.some(Boolean)) restedBetweenGestures = true;
    sawAdjustment ||= moving.some(Boolean);
    assert.deepEqual(current.contacts, ['wheel', 'wheel']);
    assert.deepEqual(current.grips, rest.grips, 'The wrist adjusts without sliding the palm along the rim');
    for (let side = 0; side < 2; side++) {
      const [x, y, z] = current.grips[side];
      const [index, middle, ring, little, thumb] = current.digitFlex[side];
      sawThumbLead ||= thumb > .13 && Math.max(index, middle, ring, little) < .025;
      assert.ok(Math.abs(Math.hypot(x, y) - .18) < .001 && Math.abs(z) < .001);
      assert.ok(distance(current.hands[side], previous.hands[side]) < .00025, 'The wrist stays continuous between frames');
      assert.ok(distance(current.hands[side], current.cuffs[side]) < .012);
      wristTravel[side] = Math.max(wristTravel[side], distance(current.hands[side], rest.hands[side]));
      for (let channel = 0; channel < 3; channel++) {
        flexPeaks[side][channel] = Math.max(flexPeaks[side][channel], current.fingerFlex[side][channel]);
      }
    }
    previous = current;
  }
  assert.ok(wristTravel.every(distance => distance > .00035 && distance < .0020), 'Both wrists settle by millimeters');
  assert.ok(flexPeaks.flat().every(weight => weight > .055 && weight <= .30), 'Each set of fingers changes pressure');
  assert.ok(restedBetweenGestures, 'Pressure returns to the original contact between gestures');
  assert.ok(sawThumbLead, 'The thumb can settle while the other digits keep their grip');
  arms.dispose();
});

test('the little and middle fingers can lead or follow the other fingers in a resting grip', () => {
  const { arms, sample } = fixture();
  const poses = [];
  for (let frame = 0; frame < 160; frame++) {
    arms.update(sample);
    const fingers = arms.diagnostics().digitFlex?.[1];
    assert.equal(fingers?.length, 5);
    poses.push(fingers);
  }
  const peakAt = digit => poses.reduce((peak, sample, frame) =>
    sample[digit] > poses[peak][digit] ? frame : peak, 0);
  assert.ok(poses.some(([index, middle]) => middle - index > .05));
  assert.ok(poses.some(([, , ring, little]) => little - ring > .075));
  assert.ok(Math.abs(peakAt(1) - peakAt(0)) >= 4);
  assert.ok(Math.abs(peakAt(3) - peakAt(2)) >= 4);
  assert.ok(peakAt(4) > peakAt(3), 'The thumb relieves pressure after the little finger settles');
  arms.dispose();
});

test('isolated finger and wrist shapes move the selected skin through its UV seams', () => {
  const { parent, arms, sample } = fixture(.0155);
  arms.update(sample);
  const hand = parent.getObjectByName('CockpitDriver_hand.R');
  const base = hand.geometry.getAttribute('position');
  const weld = new Uint16Array(Uint8Array.from(atob(COCKPIT_HAND_MESH.weld), c => c.charCodeAt(0)).buffer);
  const digits = Uint8Array.from(atob(COCKPIT_HAND_MESH.digits), c => c.charCodeAt(0));
  const point = new T.Vector3(), initial = new T.Vector3();
  for (const [name, canMove] of [
    ['middleFlex', (digit) => digit === 2],
    ['littleFlex', (digit) => digit === 4],
    ['wristSettle', (digit, y) => digit === 0 && y < .034],
  ]) {
    const target = hand.morphTargetDictionary[name];
    hand.morphTargetInfluences[target] = .25;
    let moved = 0;
    const displacement = new Map();
    for (let vertex = 0; vertex < weld.length; vertex++) {
      const size = hand.getVertexPosition(vertex, point).distanceTo(initial.fromBufferAttribute(base, vertex));
      if (size > .0001) {
        moved++;
        assert.ok(canMove(digits[weld[vertex]], initial.y));
      }
      const prior = displacement.get(weld[vertex]);
      if (prior !== undefined) assert.equal(size, prior, 'Both sides of the UV seam follow the same deformation');
      displacement.set(weld[vertex], size);
    }
    assert.ok(moved > 100);
    hand.morphTargetInfluences[target] = 0;
  }
  arms.dispose();
});

test('the resting thumb glides along the rim and keeps its pad supported across wheel profiles', () => {
  const decode16 = packed => new Uint16Array(Uint8Array.from(atob(packed), c => c.charCodeAt(0)).buffer);
  const weld = decode16(COCKPIT_HAND_MESH.weld);
  const distalThumb = new Set(decode16(COCKPIT_HAND_MESH.thumb));
  const pads = Uint8Array.from(atob(COCKPIT_HAND_MESH.pads), c => c.charCodeAt(0));
  const start = new T.Vector3(), finish = new T.Vector3();
  for (const tube of [.009, .010, .014, .0155, .018, .020, .021, .022]) {
    const { parent, arms, sample } = fixture(tube);
    arms.update(sample);
    parent.updateMatrixWorld(true);
    const depth = point => Math.hypot(Math.hypot(point.x, point.y) - .18, point.z) - tube;
    for (const side of ['L', 'R']) {
      const hand = parent.getObjectByName(`CockpitDriver_hand.${side}`);
      const thumb = hand.morphTargetDictionary.thumbFlex;
      let contacts = 0, travel = 0;
      for (let vertex = 0; vertex < weld.length; vertex++) {
        if (!(pads[weld[vertex]] & 16) || !distalThumb.has(weld[vertex])) continue;
        hand.morphTargetInfluences[thumb] = 0;
        hand.getVertexPosition(vertex, start).applyMatrix4(hand.matrixWorld);
        if (start.z <= 0 || Math.abs(depth(start)) > .0018) continue;
        contacts++;
        for (const weight of [.06, .12, .18]) {
          hand.morphTargetInfluences[thumb] = weight;
          hand.getVertexPosition(vertex, finish).applyMatrix4(hand.matrixWorld);
          assert.ok(Math.abs(depth(finish)) < .0022 && finish.z > 0, 'The thumb pad stays supported through the reposition');
        }
        const cross = start.x * finish.y - start.y * finish.x;
        const dot = start.x * finish.x + start.y * finish.y;
        travel += Math.abs(Math.atan2(cross, dot)) * .18;
      }
      assert.ok(contacts >= 6, 'The relaxed thumb starts on the front of the rim');
      assert.ok(travel / contacts >= .0011, 'The thumb tip repositions along the curve');
    }
    arms.dispose();
  }
});

test('a resting grip freezes on pause and starts cleanly after reduced motion or leaving the view', () => {
  const { arms, sample } = fixture();
  let active;
  for (let frame = 0; frame < 180; frame++) {
    arms.update(sample);
    const pose = arms.diagnostics();
    if (pose.fingerFlex.flat().some(weight => weight > .10)) { active = pose; break; }
  }
  assert.ok(active, 'An idle grip should animate with a steady wheel');
  for (let frame = 0; frame < 90; frame++) arms.update({ ...sample, paused: true });
  assert.deepEqual(arms.diagnostics().fingerFlex, active.fingerFlex);
  assert.deepEqual(arms.diagnostics().hands, active.hands);
  arms.update({ ...sample, reducedMotion: true });
  assert.ok(arms.diagnostics().fingerFlex.flat().every(weight => weight === 0));
  for (let frame = 0; frame < 90; frame++) arms.update(sample);
  assert.ok(arms.diagnostics().fingerFlex.flat().some(weight => weight > .02));
  arms.update({ ...sample, active: false });
  arms.update(sample);
  assert.ok(arms.diagnostics().fingerFlex.flat().every(weight => weight === 0));
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
      assert.equal(hand.geometry.morphAttributes.position.length, 9);
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
    assert.ok(z - grips[i][2] > .04, 'The palm should reach forward from the wrist');
    assert.ok(Math.hypot(x - cuffs[i][0], y - cuffs[i][1], z - cuffs[i][2]) < .012);
  }
  arms.dispose();
});

test('upper arm and forearm keep their lengths and the wrist follows the joint through steering and shifting', () => {
  const { pivot, arms, sample } = fixture();
  const position = new T.Vector3();
  const distance = (a, b) => position.set(a[0] - b[0], a[1] - b[1], a[2] - b[2]).length();
  const check = () => {
    const { hands, shoulders, elbows } = arms.diagnostics();
    for (let i = 0; i < hands.length; i++) {
      assert.ok(Math.abs(distance(shoulders[i], elbows[i]) - .32) < .0001);
      assert.ok(Math.abs(distance(elbows[i], hands[i]) - .26) < .0001);
    }
  };
  for (const gripDeg of [60, 90, 120]) {
    const settings = sanitizeDriverArmsSettings({ enabled: true, gripDeg, poseVersion: 2 });
    for (const turn of [0, .55, -.55, 1.15, -1.15, 2.5, -2.5]) {
      pivot.rotation.z = turn;
      arms.update({ ...sample, settings, wheelSpinRad: turn });
      check();
      assert.ok(arms.diagnostics().wristAngles.every(angle => angle < 33), 'The forearm should approach the wrist without a harsh bend');
    }
  }
  const settings = sanitizeDriverArmsSettings({ enabled: true, shoulderHeightCm: 12, shoulderReachCm: 12 });
  for (let frame = 0; frame < 28; frame++) {
    arms.update({ ...sample, settings, shiftProgress: Math.min(1, (frame + 1) / 18) });
    check();
  }
  assert.equal(arms.diagnostics().contacts[1], 'shifter');
  arms.dispose();
});

test('shifting takes an open hand to the moving knob with the left hand on the wheel', () => {
  const { parent, pivot, knob, arms, sample } = fixture();
  arms.update(sample);
  for (let frame = 0; frame < 40; frame++) {
    pivot.rotation.z = (frame + 20) * .08;
    arms.update({ ...sample, shiftProgress: Math.min(1, (frame + 1) / 18), wheelSpinRad: pivot.rotation.z });
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

test('the returning hand seats the palm on the rim before it closes the fingers', () => {
  const { parent, arms, sample } = fixture();
  arms.update(sample);
  const palmAnchor = new T.Vector3(...arms.diagnostics().grips[1]);
  const hand = parent.getObjectByName('CockpitDriver_hand.R');
  const rimOpen = hand.morphTargetDictionary.rimOpen;
  assert.equal(typeof rimOpen, 'number');
  arms.update({ ...sample, shiftProgress: 1 });
  assert.equal(arms.diagnostics().contacts[1], 'shifter');
  let palmLanded = false;
  for (let frame = 59; frame >= 0; frame--) {
    arms.update({ ...sample, shiftProgress: frame / 60 });
    const pose = arms.diagnostics();
    if (pose.shiftBlend === 0 && hand.morphTargetInfluences[rimOpen] > .2) {
      palmLanded = true;
      assert.ok(new T.Vector3(...pose.grips[1]).distanceTo(palmAnchor) < .002);
    }
  }
  assert.ok(palmLanded);
  assert.equal(hand.morphTargetInfluences[rimOpen], 0);
  arms.dispose();
});

test('the actual finger surfaces seat against thin, intermediate and thick rims', () => {
  const point = new T.Vector3();
  const asIndices = packed => new Uint16Array(Uint8Array.from(atob(packed), character => character.charCodeAt(0)).buffer);
  const weld = asIndices(COCKPIT_HAND_MESH.weld), thumbs = new Set(asIndices(COCKPIT_HAND_MESH.thumb));
  const pads = Uint8Array.from(atob(COCKPIT_HAND_MESH.pads), character => character.charCodeAt(0));
  const dorsal = COCKPIT_HAND_MESH.grip.basis[2];
  const oppositePalm = (radial, axial) => -dorsal[0] * radial + dorsal[2] * axial < -.001;
  for (const tube of [.009, .010, .014, .018, .020, .022]) {
    const { parent, arms, sample } = fixture(tube);
    arms.update(sample);
    parent.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const hand = parent.getObjectByName(`CockpitDriver_hand.${side}`);
      let contact = 0, penetration = 0, thumbOnFace = 0, palmContact = 0;
      const opposingPads = [0, 0, 0, 0];
      let palmLow = Infinity, palmHigh = -Infinity;
      for (let i = 0; i < hand.geometry.attributes.position.count; i++) {
        const localX = hand.getVertexPosition(i, point).x;
        point.applyMatrix4(hand.matrixWorld);
        const radial = Math.hypot(point.x, point.y) - .18;
        const depth = Math.hypot(radial, point.z) - tube;
        if (Math.abs(depth) < .002) {
          contact++;
          if (pads[weld[i]] & 32) {
            palmContact++;
            palmLow = Math.min(palmLow, localX);
            palmHigh = Math.max(palmHigh, localX);
          }
          if (thumbs.has(weld[i])) {
            if (point.z > .45 * Math.abs(radial)) thumbOnFace++;
          } else if (oppositePalm(radial, point.z)) {
            for (let digit = 0; digit < opposingPads.length; digit++) {
              if (pads[weld[i]] & (1 << digit)) opposingPads[digit]++;
            }
          }
        }
        penetration = Math.max(penetration, -depth);
      }
      assert.ok(contact > 140, `Surface was floating at ${tube * 1000} mm`);
      assert.ok(penetration < .0032, `Surface crossed the rim by ${(penetration * 1000).toFixed(2)} mm`);
      assert.ok(palmContact >= 30 && palmHigh - palmLow >= .052,
        `At ${tube * 1000} mm, contact extends across the width of the palm`);
      assert.ok(thumbOnFace >= 20, `At ${tube * 1000} mm, the thumb pad opposes the grip on the face of the rim`);
      assert.ok(opposingPads.every(count => count >= 8),
        `At ${tube * 1000} mm, all four fingers wrap past the rim to oppose the palm (${opposingPads.join(', ')})`);
      for (const openness of [.25, .50, .75, 1]) {
        hand.morphTargetInfluences[hand.morphTargetDictionary.rimOpen] = openness;
        let openPalm = 0, closedPads = 0, overlap = 0;
        for (let i = 0; i < weld.length; i++) {
          hand.getVertexPosition(i, point).applyMatrix4(hand.matrixWorld);
          const radial = Math.hypot(point.x, point.y) - .18;
          const depth = Math.hypot(radial, point.z) - tube;
          overlap = Math.max(overlap, -depth);
          if (Math.abs(depth) >= .002) continue;
          if (pads[weld[i]] & 32) openPalm++;
          if ((pads[weld[i]] & 15) && oppositePalm(radial, point.z)) closedPads++;
        }
        assert.equal(openPalm, palmContact, 'Opening the fingers preserves the same palm support');
        assert.ok(overlap < .0032, 'The fingers uncurl around the rim throughout the motion');
        if (openness === 1) assert.ok(closedPads < opposingPads.reduce((sum, count) => sum + count, 0) / 2);
      }
      hand.morphTargetInfluences[hand.morphTargetDictionary.rimOpen] = 0;
      hand.morphTargetInfluences[hand.morphTargetDictionary.indexFlex] = .20;
      hand.morphTargetInfluences[hand.morphTargetDictionary.outerFlex] = .18;
      hand.morphTargetInfluences[hand.morphTargetDictionary.thumbFlex] = .13;
      hand.morphTargetInfluences[hand.morphTargetDictionary.middleFlex] = -.11;
      hand.morphTargetInfluences[hand.morphTargetDictionary.littleFlex] = .12;
      hand.morphTargetInfluences[hand.morphTargetDictionary.wristSettle] = .28;
      let planted = 0, thumbStillOnFace = 0, flexPenetration = 0;
      for (let i = 0; i < weld.length; i++) {
        hand.getVertexPosition(i, point).applyMatrix4(hand.matrixWorld);
        const radial = Math.hypot(point.x, point.y) - .18;
        const depth = Math.hypot(radial, point.z) - tube;
        flexPenetration = Math.max(flexPenetration, -depth);
        if (Math.abs(depth) >= .002) continue;
        if (pads[weld[i]] & 32) planted++;
        if (thumbs.has(weld[i]) && point.z > .45 * Math.abs(radial)) thumbStillOnFace++;
      }
      assert.equal(planted, palmContact, 'Micro-adjustments preserve palmar support');
      assert.ok(thumbStillOnFace >= 15, 'The thumb continues to oppose the fingers as they adjust');
      assert.ok(flexPenetration < .0032, 'Micro-adjustments do not pass through the rim');
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
  const hand = rig.getObjectByName('CockpitDriver_hand.L');
  const gripColor = hand.geometry.getAttribute('color').array;
  assert.equal(hand.material.vertexColors, true);
  assert.ok(gripColor.some(value => value < .87) && gripColor.some(value => value === 1));
  assert.ok(hand.geometry.morphAttributes.color.slice(0, 2).every(pose => pose.array.every(value => value === 1)));
  assert.ok(hand.geometry.morphAttributes.color[hand.morphTargetDictionary.rimOpen].array.some(value => value < .95));
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
  const host = readFileSync(new URL('../src/legacy/module-02.mjs?v=9000f422d2f58b6c', import.meta.url), 'utf8');
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
