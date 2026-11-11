import test from 'node:test';
import assert from 'node:assert/strict';
import {conditionFromSnapshot, normalizeVehicleCondition, serviceVehicleCondition, terminalVehicleFaults, toPhysicalDamage} from '../src/game/vehicle-condition.mjs?v=92fc1e81f7682f9f';
import {createVehicleMaintenance} from '../src/game/vehicle-maintenance.mjs?v=e41d4bbdb923cfdf';

const impact = (localPointM, impulseNs) => ({localPointM, impulseNs, magnitude: Math.min(1, impulseNs / 20000)});

test('total loss needs a severe structural impact and panel damage follows the contact point', () => {
  const pristine = normalizeVehicleCondition();
  const bump = conditionFromSnapshot(pristine, null, {newImpacts: [impact([1.8, .15, 0], 15000)]});
  assert.deepEqual(terminalVehicleFaults(bump), []);
  assert.ok(bump.panelDamage.hood < .4);
  const wreck = conditionFromSnapshot(bump, null, {newImpacts: [impact([1.8, .15, 0], 80000)]});
  assert.equal(terminalVehicleFaults(wreck)[0].code, 'wreck');
  assert.ok(wreck.panelDamage.hood >= .86);
  assert.equal(wreck.panelDamage.rightDoor, 0);

  const side = conditionFromSnapshot(pristine, null, {newImpacts: [impact([.1, .18, .92], 54000)]});
  assert.ok(side.panelDamage.rightDoor >= .86);
  assert.equal(side.panelDamage.leftDoor, 0);
  assert.equal(side.panelDamage.hood, 0);
  const rearQuarter = conditionFromSnapshot(pristine, null, {newImpacts: [impact([-2.2, .18, .85], 54000)]});
  assert.equal(rearQuarter.panelDamage.rightDoor, 0);
  assert.deepEqual(serviceVehicleCondition(wreck, 'body').panelDamage, pristine.panelDamage);
  assert.equal(serviceVehicleCondition(wreck, 'paint').panelDamage.hood, wreck.panelDamage.hood);
});

test('faults identify punctured wheels and distinguish the transmission from the gearbox', () => {
  const damage = toPhysicalDamage({});
  damage.tires.rearRight.pressureRatio = .15;
  const faults = terminalVehicleFaults({mechanical: damage, drivetrain: 15, gearbox: 15});
  const tire = faults.find(fault => fault.id === 'tires');
  assert.match(tire.detail, /trasero derecho/);
  assert.match(faults.find(fault => fault.id === 'drivetrain').label, /Transmisión/);
  assert.match(faults.find(fault => fault.id === 'gearbox').label, /Caja de cambios/);
});

test('engine repair extinguishes the fire and paint service removes the localized scorch', () => {
  const damage = toPhysicalDamage({});
  damage.engine.fire = true;
  damage.engine.fireIntensity = .8;
  const burned = conditionFromSnapshot({}, {damage});
  assert.ok(burned.scorch > .65);
  assert.ok(burned.paint < 80);
  const repaired = serviceVehicleCondition(burned, 'engine');
  assert.equal(repaired.mechanical.engine.fire, false);
  assert.equal(repaired.scorch, burned.scorch);
  assert.equal(serviceVehicleCondition(repaired, 'paint').scorch, 0);
});

function maintenanceFixture() {
  const profile = {condition: {}, appearance: {}, workshopTokens: 0};
  const events = [];
  const maintenance = createVehicleMaintenance({getProfile: () => profile, getVehicleId: () => 'chevy',
    onFaultPreview: faults => events.push(['preview', faults[0].code]),
    onFault: faults => events.push(['terminal', faults[0].code])});
  const damage = maintenance.begin();
  const sample = (tick, more = {}) => maintenance.sample({tick, running: true, statusAfter: 'RUNNING',
    snapshot: {damage, impacts: [], engine: {rpm: 900, torqueNm: 0}}, ...more});
  return {profile, events, maintenance, damage, sample};
}

test('fire runs for 300 additional active physics steps and can be paused and resumed', async () => {
  const {events, maintenance, damage, sample} = maintenanceFixture();
  damage.engine.fire = true;
  damage.engine.fireIntensity = .8;
  sample(1);
  assert.deepEqual(events, [['preview', 'fire']]);
  assert.equal(maintenance.canDrive(), false);
  assert.equal(maintenance.canResume(), true);
  for (let i = 0; i < 500; i++) { sample(1); sample(2, {running: false}); }
  for (let tick = 2; tick <= 300; tick++) sample(tick);
  assert.equal(events.length, 1);
  sample(301);
  sample(302);
  assert.deepEqual(events, [['preview', 'fire'], ['terminal', 'fire']]);
  assert.equal(maintenance.canResume(), false);
  assert.equal(maintenance.getState().services.find(service => service.id === 'engine').available, true);
  assert.equal((await maintenance.service('engine')).canDrive, true);
});

test('terminal drivetrain damage stops the attempt without a fire window', () => {
  const {events, damage, sample} = maintenanceFixture();
  damage.drivetrain.condition = .15;
  for (let tick = 1; tick <= 13; tick++) sample(tick);
  assert.deepEqual(events, [['terminal', 'drivetrain']]);
});

test('a finish during a fire window settles the breakdown without waiting for more physics steps', () => {
  const {events, damage, sample} = maintenanceFixture();
  damage.engine.fire = true;
  sample(1);
  sample(2, {statusAfter: 'FINISHED'});
  assert.deepEqual(events, [['preview', 'fire'], ['terminal', 'fire']]);
});
