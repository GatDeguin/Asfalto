import test from 'node:test';
import assert from 'node:assert/strict';
import * as cameraEntrance from '../src/game/race-camera-entrance.mjs?v=8938b40b749fe337';
const {createRaceCameraEntrance} = cameraEntrance;

const cases = [
  ['chevy', [-.219, .154, .146], [-.2349, .158, .145]],
  ['chevrolet_1969', [-.159, .130, .139], [-.2209, .165, .14]],
  ['chevy_400_1957', [.220, .235, .159], [-.1842, .220, .14]],
  ['belair_1957', [.200, .184, .180], [-.1777, .190, .17]],
  ['pickup_3100', [.216, .276, .108], [-.1758, .300, .125]],
];

test('every selectable car approaches above its hood, crosses the glass, and settles at its saved eye', () => {
  assert.equal(typeof cameraEntrance.sampleCockpitEntrance, 'function', 'the camera needs a path in body coordinates');
  for (const [vehicle, eye, [glassX, glassY, glassZ]] of cases) {
    const entrance = createRaceCameraEntrance();
    entrance.start('cockpit');
    const states = Array.from({length: 227}, () => entrance.step(.01));
    const points = states.filter(state => state.active).map(state => cameraEntrance.sampleCockpitEntrance(vehicle, eye, state.progress));
    assert.ok(points[0].position[0] < -1.5, vehicle + ' must begin ahead of the nose');
    const crossing = points.findIndex(point => point.position[0] > glassX);
    assert.ok(crossing > 0, vehicle + ' must pass its windshield');
    assert.deepEqual(points[crossing].position.slice(1), [glassY, glassZ]);
    assert.ok(points.slice(0, crossing).every(point => !point.inside));
    assert.ok(points.at(-1).inside);
    assert.ok(points.every(({position}, index) => index === 0 || position[0] >= points[index - 1].position[0]));
    assert.ok(points.at(-1).position.every((value, index) => Math.abs(value - eye[index]) < .001));
    assert.equal(states.at(-1).active, false);
  }
});

test('reduced motion and switching away from cockpit bypass the windshield path', () => {
  const entrance = createRaceCameraEntrance();
  entrance.start('cockpit', {reducedMotion: true});
  assert.equal(entrance.step(.03).active, false);
  entrance.start('cockpit');
  const before = entrance.step(.05);
  assert.deepEqual(entrance.step(.05, {paused: true}), before);
  assert.equal(entrance.step(.05, {currentMode: 'chase'}).active, false);
});
