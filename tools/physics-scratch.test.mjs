import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../src/legacy/asfalto-v6-vehicle-model.js?v=e65d6a457c35c21a', import.meta.url), 'utf8'), context);
const core = context.AsfaltoV6VehicleCore;
assert.equal(typeof core.createDynamicsScratch, 'function', 'core must expose per-session scratch');
const scratch = core.createDynamicsScratch();
const spec = core.CHEVY_ORIGINAL_SPEC;
const wheels = core.createVehicleState(spec).wheels.map(w => ({ ...w, contact: true, normalLoadN: 3200, mu: .8, wheelRadiusM: .33, angularSpeedRadps: 40 }));
const controls = { throttle: .6, brake: .7, handbrake: .1 };
const state = { engineRpm: 2400, gear: 2, clutchEngagement: .8, temperatureC: 80, frontTemperatureC: 450, rearTemperatureC: 350 };
const equal = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a, (_k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v)), JSON.parse(JSON.stringify(b)));
equal(core.stepPowertrainInto(scratch.powertrain, state, controls, wheels, 1/120, spec), core.stepPowertrain(state, controls, wheels, 1/120, spec));
equal(core.stepBrakesInto(scratch.brakes, state, controls, wheels, 1/120, spec), core.stepBrakes(state, controls, wheels, 1/120, spec));
for (const mu of [0, .55, .92]) for (const speed of [0, 12, 40]) {
 const input = { targetSlipAngleRad: .12, targetSlipRatio: -.3, longitudinalSpeedMps: speed, normalLoadN: 3200, wheelRadiusM: .33, mu, surface: 'asphalt', corneringStiffnessNprad: 50000, longitudinalStiffnessN: 52000 };
 const out = { ...wheels[0], tire: {} }; const tire = out.tire;
 equal(core.stepWheelStateInto(out, wheels[0], input, 1/120, scratch.tire), core.stepWheelState(wheels[0], input, 1/120));
 assert.equal(out.tire, tire);
}
const damage = core.createMutableDamageState();
const telemetry = { engineRpm: 5700, engineTemperatureC: 160, frontBrakeTemperatureC: 550, rearBrakeTemperatureC: 440, clutchSlipPowerW: 20000, bottomOut: .8 };
const expected = core.applyMechanicalWear(damage, telemetry, 1/120);
assert.equal(core.applyMechanicalWearInto(damage, damage, telemetry, 1/120), damage);
equal(damage, expected);
console.log('physics scratch: core numerical parity and buffer identity passed');

