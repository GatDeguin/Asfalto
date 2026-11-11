import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const host = readFileSync(new URL('../src/legacy/module-02.mjs?v=af05976fe51f9183', import.meta.url), 'utf8');
function section(start, end, offset = 0) {
  const from = host.indexOf(start, offset);
  const to = host.indexOf(end, from);
  assert.ok(from >= 0 && to > from, start);
  return host.slice(from, to);
}

function fixture({gear = '1', velocity = [0, 0, 0], mode = 'automatic', status = 'RUNNING'} = {}) {
  const gearState = {gear, requested: gear, x: -1, y: 1, path: null};
  const keyActions = new Set();
  const events = [];
  let onKeyDown;
  const context = vm.createContext({
    window: {addEventListener(type, handler) { if (type === 'keydown') onKeyDown = handler; }},
    document: {body: {classList: {contains: () => false}}},
    HTMLInputElement: class {}, HTMLSelectElement: class {}, HTMLButtonElement: class {},
    raceRenderView: {isActive: () => true}, renderer: {}, options: {getTransmissionMode: () => mode},
    settingsOpen: false, resultsOpen: false, menuOpen: false, listeningBinding: null,
    compositionEditor: null, gameSettings: {transmissionMode: mode}, gearState, vehicle: {speedMps: 0, rpm: 825},
    GEAR_POSITIONS: {'1': {x: -1, y: 1}, R: {x: 1, y: -1}, N: {x: 0, y: 0}},
    FORWARD_GEARS: ['1', '2', '3', '4'], GEAR_RATIOS: {'1': 3, R: -3, N: 0},
    ENGINE_SPEC: {idleRpm: 825, hardLimitRpm: 6500}, rpmForSpeed: () => 825,
    performance: {now: () => 1000}, setGearUi() {}, ensureAudioStarted: async () => {},
    buildShiftPathFrom: () => [{x: 0, y: 0}, {x: 1, y: 1}],
    engineSound: {notifyShift() {}}, keyActions, bindingActionForCode: () => 'brake',
    raceWorld: {
      getControlGate: () => ({status, blockDriving: status !== 'RUNNING'}),
      getRenderFrame: () => ({currentSnapshot: {chassis: {linearVelocity: velocity}}}),
      showMessage: (message, options) => events.push({message, options}),
    },
  });
  vm.runInContext([
    section('function evaluateShift(', 'function createVehicleState('),
    section('  function requestGear(', '  function finishShift('),
    section('  const gearKeyMap =', "  window.addEventListener('keyup'"),
    section('  function onKeyDown(event)', '  function onKeyUp(event)', host.indexOf('  function mergedRaceInput()')),
  ].join('\n'), context);
  function press(extra = {}, handler = onKeyDown) {
    const event = {
      code: 'KeyR', repeat: false, target: {}, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...extra,
    };
    handler(event);
    return event;
  }
  return {gearState, events, press, keyActions, raceKeyDown: context.onKeyDown};
}

test('R alternates between automatic reverse and first gear at rest', () => {
  const f = fixture();
  assert.equal(f.press().defaultPrevented, true);
  assert.equal(f.gearState.requested, 'R');
  f.press();
  assert.equal(f.gearState.requested, 'R', 'the lever is already shifting');
  Object.assign(f.gearState, {gear: 'R', path: null});
  f.press({repeat: true});
  assert.equal(f.gearState.requested, 'R');
  f.press();
  assert.equal(f.gearState.requested, '1');
});

test('the automatic selector blocks a direction change above the lockout speed in either direction', () => {
  for (const [gear, velocity] of [['1', [0, 0, 4]], ['R', [-4, 0, 0]]]) {
    const f = fixture({gear, velocity});
    f.press();
    assert.equal(f.gearState.requested, gear);
    assert.equal(f.gearState.path, null);
    assert.equal(f.events.length, 1);
    assert.equal(f.events[0].options.drivingCue, true);
  }
});

test('automatic R has one owner and leaves the browser reload shortcut intact', () => {
  const f = fixture();
  f.press({}, f.raceKeyDown);
  assert.equal(f.keyActions.size, 0, 'a saved race binding must not also apply the brake');
  assert.equal(f.press({ctrlKey: true}).defaultPrevented, false);
  assert.equal(f.gearState.requested, '1');
  const paused = fixture({status: 'PAUSED'});
  paused.press();
  assert.equal(paused.gearState.requested, '1');
});

test('manual R still selects reverse instead of toggling into first', () => {
  const f = fixture({mode: 'manual', gear: 'R'});
  f.press();
  assert.equal(f.gearState.requested, 'R');
});
