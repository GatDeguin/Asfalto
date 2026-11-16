import assert from 'node:assert/strict';
import test from 'node:test';
import { createCockpitShiftMotion } from '../src/render/cockpit-shift-motion.mjs?v=1b751f5432ed5420';

const positions = {
  N: { x: 0, y: 0 }, 1: { x: -1, y: 1 }, 2: { x: -1, y: -1 },
  3: { x: 0, y: 1 }, R: { x: 1, y: -1 },
};
const hPattern = ({ x, y }, target) => {
  const end = positions[target];
  return [{ x, y }, { x, y: 0 }, { x: end.x, y: 0 }, end];
};

function fixture(from = '1') {
  const motion = createCockpitShiftMotion(hPattern, () => .10);
  const lever = { ...positions[from], requested: from, path: null };
  const options = { enabled: true, selectorMove: true, grabbing: false, paused: false, reachSeconds: .18, shiftSpeed: 1, dt: .01 };
  const step = (overrides = {}) => ({ ...motion.update(lever, { ...options, ...overrides }) });
  const request = target => Object.assign(lever, { requested: target, path: hPattern(lever, target) });
  step();
  return { motion, lever, step, request };
}

test('the hand closes before the visible H-pattern moves, even if the gearbox finishes early', () => {
  const { lever, step, request } = fixture();
  request('3');
  Object.assign(lever, positions['3']);
  for (let frame = 0; frame < 17; frame++) {
    const pose = step();
    assert.equal(pose.x, -1);
    assert.equal(pose.y, 1);
    assert.ok(pose.reach > 0 && pose.reach < 1);
  }
  lever.path = null;
  const frames = Array.from({ length: 66 }, () => step());
  const travel = frames.filter(pose => pose.phase === 'shift');
  assert.ok(travel.length > 20);
  assert.ok(travel.every(({ x, y, reach }) => reach === 1 && (Math.abs(x + 1) < 1e-6 || Math.abs(y) < 1e-6 || Math.abs(x) < 1e-6)));
  assert.ok(frames.some(pose => pose.phase === 'hold'));
  assert.ok(frames.some(pose => pose.phase === 'return' && pose.reach < 1));
  assert.deepEqual(frames.at(-1), { ...positions['3'], reach: 0, phase: 'wheel' });
});

test('a second accepted shift takes over the visible lever from its current pose', () => {
  const { lever, step, request } = fixture();
  request('3');
  const moving = Array.from({ length: 23 }, () => step()).at(-1);
  assert.equal(moving.phase, 'shift');
  request('2');
  const redirected = step({ dt: 0 });
  assert.equal(redirected.reach, 1);
  assert.equal(redirected.x, moving.x);
  assert.equal(redirected.y, moving.y);
  Object.assign(lever, { ...positions['2'], path: null });
  const result = Array.from({ length: 80 }, () => step()).at(-1);
  assert.deepEqual(result, { ...positions['2'], reach: 0, phase: 'wheel' });
});

test('paused motion freezes, and bypassing or resetting drops any old intention', () => {
  const { motion, lever, step, request } = fixture();
  request('R');
  const approaching = step();
  assert.ok(approaching.reach > 0);
  assert.deepEqual(step({ paused: true, dt: .05 }), approaching);
  assert.equal(step({ enabled: false }).reach, 0);
  assert.equal(step().reach, 0, 'A shift already in flight must not replay when motion is re-enabled');
  request('3');
  assert.ok(step().reach > 0);
  motion.reset(lever);
  assert.equal(step().reach, 0);
});

test('an internal automatic ratio skips the hand, while direct drag follows the real knob', () => {
  const { lever, step, request } = fixture();
  request('2');
  Object.assign(lever, { x: -.9, y: .4 });
  assert.deepEqual(step({ selectorMove: false }), { x: -.9, y: .4, reach: 0, phase: 'wheel' });
  const drag = step({ grabbing: true });
  assert.equal(drag.x, lever.x);
  assert.equal(drag.y, lever.y);
  assert.ok(drag.reach > 0);
  Array.from({ length: 22 }, () => step({ grabbing: true }));
  assert.equal(step({ grabbing: true }).reach, 1);
  assert.ok(step().reach < 1);
});
