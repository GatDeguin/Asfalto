import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVehicleCameraRig } from '../src/game/vehicle-camera-rig.mjs?v=467c30948b8f1e07';
import { createVehicleCockpitLayouts } from '../src/game/cockpit-layout-file.mjs?v=3400aba2ce03221e';
import { createCompositionState, sanitizeCompositionState } from '../src/game/composition-editor-state.mjs?v=c4711cb3438b2dc0';
import { createLightingPresetStore } from '../src/game/lighting-preset-file.mjs?v=b7a7523d5581d2ac';
import { installRayTracingSettings } from '../src/render/ray-tracing-settings.mjs?v=513f6fff23644d17';
import { RAY_TRACING_STORAGE_KEY } from '../src/render/ray-traced-occlusion.mjs';
import { applyPhoneCockpitProjection } from '../src/render/phone-cockpit-projection.mjs?v=c9d3861a0c494f0b';
import { startServer } from '../server.mjs?v=9eba410657deb1ea';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const frame = {
  currentSnapshot: { chassis: { position: [1, 2, 3], rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0] } },
  cockpitAnchorM: [.1, .6, -.35], hoodAnchorM: [1.6, .25, 0], projection: { raceProgress: 90 },
};
const lens = focalLengthMm => ({ lensMode: 'manual', focalLengthMm });
const rig = () => createVehicleCameraRig({ camera: {
  position: {}, up: {}, lookAt() {}, aspect: 16 / 9,
} });

test('each external view owns its position, aim and lens without changing any other view', () => {
  const camera = rig();
  const modes = ['cockpit', 'hood', 'chase', 'cinematic'];
  const capture = () => Object.fromEntries(modes.map(mode => {
    camera.setMode(mode);
    return [mode, camera.reset(frame)];
  }));
  const defaults = capture();
  camera.setCalibrations({
    chase: { ...lens(48), positionOffsetM: [-.8, .15, .3], rotationOffsetDeg: [6, 12, -4] },
    hood: { ...lens(39), positionOffsetM: [.08, .12, 0], rotationOffsetDeg: [4, -8, 2] },
    cinematic: { ...lens(52), positionOffsetM: [0, .35, .26], rotationOffsetDeg: [-5, 7, 3] },
  });
  const edited = capture();
  assert.deepEqual(edited.cockpit, defaults.cockpit);
  for (const [mode, focal] of [['chase', 48], ['hood', 39], ['cinematic', 52]]) {
    assert.notDeepEqual(edited[mode].position, defaults[mode].position);
    assert.notDeepEqual(edited[mode].look, defaults[mode].look);
    assert.notDeepEqual(edited[mode].up, defaults[mode].up);
    assert.ok(Math.abs(edited[mode].baseHorizontalFovDeg - 2 * Math.atan(18 / focal) * 180 / Math.PI) < 1e-12);
  }
  camera.setCalibrations({ hood: lens(39) });
  assert.deepEqual(capture().chase, defaults.chase);
});

test('model profiles restore independent cameras and cockpit pieces in a new session', async () => {
  const browser = storage();
  const old = { version: 3, transforms: { dashboard: { position: [.32, 0, 0] } }, camera: { cockpit: lens(32) } };
  const options = { storage: browser, legacyLayout: old, loopback: false };
  const layouts = createVehicleCockpitLayouts(options);
  const shared = await layouts.prepare('chevrolet_1969');
  const belair = await layouts.prepare('belair_1957');
  assert.equal(shared.layout.camera.cockpit.focalLengthMm, 32);
  assert.equal(shared.layout.transforms.dashboard.position[0], .32);
  assert.equal(belair.layout.camera.cockpit.focalLengthMm, 18);
  assert.equal(belair.layout.transforms.dashboard, undefined);

  const state = createCompositionState({ initial: belair.layout });
  state.setCameraCalibration('cockpit', lens(28));
  state.setCameraCalibration('chase', lens(46));
  state.setCameraCalibration('hood', lens(36));
  state.setTargetState('radio', { position: [.01, .02, .03] });
  belair.saveLocal(state.getState());
  shared.saveLocal({ ...shared.layout, camera: { cockpit: lens(35), chase: lens(61) } });

  const fresh = createVehicleCockpitLayouts(options);
  const restored = await fresh.prepare('belair_1957');
  assert.equal(restored.layout.camera.cockpit.focalLengthMm, 28);
  assert.equal(restored.layout.camera.chase.focalLengthMm, 46);
  assert.equal(restored.layout.camera.hood.focalLengthMm, 36);
  assert.deepEqual(restored.layout.transforms.radio.position, [.01, .02, .03]);
  assert.equal((await fresh.prepare('chevrolet_1969')).layout.camera.chase.focalLengthMm, 61);
  assert.equal((await fresh.prepare('pickup_3100')).layout.camera.chase, undefined);
  restored.saveLocal(restored.defaults);
  const reset = await createVehicleCockpitLayouts(options).prepare('belair_1957');
  assert.equal(reset.layout.camera.cockpit.focalLengthMm, 18);
  assert.equal(reset.layout.camera.chase, undefined);
  assert.equal((await createVehicleCockpitLayouts(options).prepare('chevrolet_1969')).layout.camera.cockpit.focalLengthMm, 35);
});

test('legacy layout versions preserve their cockpit while validating only recognized new views', () => {
  const saved = sanitizeCompositionState({ version: 2, transforms: { wheel: { rotation: [0, Math.PI, 0] } }, camera: {
    cockpit: lens(37), chase: { ...lens(300), positionOffsetM: [0, Infinity, 15] }, free: lens(35),
  } });
  assert.equal(saved.version, 3);
  assert.equal(saved.transforms.wheel.rotation[1], 180);
  assert.equal(saved.camera.cockpit.focalLengthMm, 37);
  assert.equal(saved.camera.chase.focalLengthMm, 120);
  assert.deepEqual(saved.camera.chase.positionOffsetM, [0, 0, 4]);
  assert.equal(saved.camera.free, undefined);
});

test('the local launcher persists separate model files and restores them in a clean browser', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'asfalto-cockpits-'));
  const server = await startServer({root:fileURLToPath(new URL('../', import.meta.url)), cockpitDataDirectory:dir});
  try {
    const fetcher = (url, options) => fetch(new URL(url, server.url), {
      ...options, headers:{...options.headers, origin:new URL(server.url).origin},
    });
    const create = () => createVehicleCockpitLayouts({ storage:storage(), loopback:true, fileOptions:{fetcher} });
    const profiles = create();
    const fleet = await Promise.all(['chevy','chevrolet_1969','chevy_400_1957','pickup_3100','belair_1957'].map(profiles.prepare));
    assert.deepEqual(fleet.map(profile => profile.authored), [false, false, true, true, true]);
    assert.deepEqual(await fs.readdir(dir), []);
    const [chevy,,,pickup] = fleet;
    for (const [profile, focal] of [[chevy, 45], [pickup, 55]]) {
      assert.equal(profile.saveLocal({...profile.layout, camera:{...profile.layout.camera, cinematic:lens(focal)}}), true);
      assert.equal((await profile.file.save(profile.layout)).ok, true);
    }
    assert.deepEqual((await fs.readdir(dir)).sort(), ['cockpit-layout.chevy.json','cockpit-layout.pickup_3100.json']);
    const fresh = create();
    assert.equal((await fresh.prepare('chevy')).layout.camera.cinematic.focalLengthMm, 45);
    assert.equal((await fresh.prepare('pickup_3100')).layout.camera.cinematic.focalLengthMm, 55);
    assert.equal((await fresh.prepare('belair_1957')).layout.camera.cinematic, undefined);
    assert.equal((await fetch(new URL('/api/cockpit-layout?vehicle=falcon',server.url))).status, 400);
  } finally { await server.close();await fs.rm(dir, {recursive:true,force:true}); }
});

test('the gear menu lighting keeps a model override within its route and weather', () => {
  const browser = storage();
  const route = {trackId:'dos_lagos', skyId:'clear', weather:'clear'};
  const coupe = {...route, vehicleId:'chevrolet_1969'}, pickup = {...route, vehicleId:'pickup_3100'};
  const store = createLightingPresetStore({storage:browser, fetcher:null});
  store.set(route, {vehicles:{player:{intensityScale:1.2}}});
  store.set(coupe, {vehicles:{player:{intensityScale:.7}}});
  assert.equal(store.get(pickup).vehicles.player.intensityScale, 1.2);
  store.set(pickup, {});
  store.dispose();
  const restored = createLightingPresetStore({storage:browser, fetcher:null});
  assert.equal(restored.get(coupe).vehicles.player.intensityScale, .7);
  assert.deepEqual(restored.get(pickup), {});
  assert.deepEqual(restored.get({...coupe,weather:'rain'}), {});
  restored.dispose();
});

test('the graphics setting in the gear follows the active model', () => {
  const browser = storage(), changes = [];
  browser.setItem(RAY_TRACING_STORAGE_KEY, 'balanced');
  const settings = installRayTracingSettings({root:{querySelectorAll:()=>[]},storage:browser,vehicleId:'chevrolet_1969',
    controller:{setMode(value){changes.push(value);return true;},diagnostics:()=>({status:'off'})}});
  settings.setMode('high');
  settings.setVehicle('belair_1957');
  assert.equal(settings.getMode(), 'balanced');
  settings.setMode('off');
  settings.setVehicle('chevrolet_1969');
  assert.equal(settings.getMode(), 'high');
  assert.deepEqual(changes, ['balanced','high','balanced','off','high']);
  settings.dispose();
});

test('the phone viewport retains a custom lens while fitting the factory lens', () => {
  const camera = {aspect: .48, fov: 114,
    projectionMatrix: {elements: Array(16).fill(0)},
    projectionMatrixInverse: {copy(){return this;},invert(){}},
    updateProjectionMatrix(){this.projectionMatrix.elements[9] = 0;},
  };
  applyPhoneCockpitProjection(camera, {fitLens:false});
  assert.equal(camera.fov, 114);
  assert.equal(camera.projectionMatrix.elements[9], -.20);
  applyPhoneCockpitProjection(camera);
  assert.equal(camera.fov, 98);
});
