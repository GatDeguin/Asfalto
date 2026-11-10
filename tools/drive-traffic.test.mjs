import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveTrafficPlan, createDriveTraffic } from '../src/game/drive-traffic.mjs?v=3cce59e8724fc388';

test('a trip gives each model two or three varied encounters, with one parking and one passing event', () => {
  const plan = createDriveTrafficPlan({lengthM: 22717, seed: 42});
  const regular = plan.filter(event => event.kind === 'regular');
  const models = new Set(plan.map(event => event.model));
  assert.equal(models.size, 6);
  assert.deepEqual(plan, createDriveTrafficPlan({lengthM: 22717, seed: 42}));
  assert.notDeepEqual(plan, createDriveTrafficPlan({lengthM: 22717, seed: 41}));
  for (const model of models) {
    const rows = regular.filter(event => event.model === model);
    assert.ok(rows.length >= 2 && rows.length <= 3);
    for (const key of ['color', 'rim', 'tire', 'brake', 'driver']) {
      assert.equal(new Set(rows.map(row => row[key])).size, rows.length);
    }
  }
  assert.deepEqual(new Set(regular.map(event => event.direction)), new Set([-1, 1]));
  assert.ok(regular.every(event => event.speedMps <= 60 / 3.6));
  assert.equal(plan.filter(event => event.kind === 'parked').length, 1);
  assert.equal(plan.filter(event => event.kind === 'passing').length, 1);
  assert.ok(plan.every((event, i) => !i || event.atM - plan[i - 1].atM > 240));
});

test('overtaking waits for a safe opening and pause and reversal cannot repeat an encounter', () => {
  const event = {id: 1, kind: 'passing', model: 'falcon', atM: 1000, direction: 1, speedMps: 29};
  const traffic = createDriveTraffic([event], {lengthM: 5000});
  assert.equal(traffic.update({progressM:1000, speedMps:12, lateralM:-1, dt:1}).length, 0);
  const cars = traffic.update({progressM:1015, speedMps:12, lateralM:1, dt:1});
  assert.equal(cars.length, 1);
  assert.equal(cars[0].side, -1);
  assert.ok(cars[0].progressM < 1015);
  const previous = cars[0].progressM;
  assert.equal(traffic.update({progressM:1015, speedMps:0, lateralM:1, dt:0})[0].progressM, previous);
  assert.equal(traffic.update({progressM:1700, speedMps:12, lateralM:1, dt:1}).length, 0);
  assert.equal(traffic.update({progressM:1015, speedMps:12, lateralM:1, dt:1}).length, 0);
});

test('the parked car stays on the shoulder and blinks only while the trip advances', () => {
  const event = {id: 0, kind: 'parked', model: 'chevy', atM: 800, direction: 1, speedMps: 0};
  const traffic = createDriveTraffic([event], {lengthM: 5000});
  const sample = dt => traffic.update({progressM:650, speedMps:10, lateralM:1, dt})[0];
  const parked = sample(0);
  assert.equal(parked.progressM, 800);
  assert.equal(parked.side, 1);
  assert.equal(parked.hazards, true);
  assert.equal(sample(.6).hazards, false);
  assert.equal(sample(0).hazards, false);
});
