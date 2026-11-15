import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveTrafficPlan, createDriveTraffic } from '../src/game/drive-traffic.mjs?v=72634b8baa1ea0df';
import {CIRCUIT_IDS,readCircuitSource} from './fixtures/closed-circuit-source.mjs';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {TRAFFIC_PARKING} from '../src/game/traffic-parking.mjs?v=3006726ba162354a';

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
    for (const key of ['finish', 'color', 'rim', 'tire', 'brake', 'driver']) {
      assert.equal(new Set(rows.map(row => row[key])).size, rows.length);
    }
  }
  assert.deepEqual(new Set(regular.map(event => event.direction)), new Set([-1, 1]));
  assert.ok(regular.every(event => event.speedMps <= 60 / 3.6));
  assert.equal(plan.filter(event => event.kind === 'parked').length, 1);
  assert.equal(plan.filter(event => event.kind === 'passing').length, 1);
  const occupied=plan.filter(event=>event.passenger!=null);
  assert.ok(occupied.length>0&&occupied.length<plan.length);
  assert.ok(occupied.every(event=>event.passenger>=0&&event.passenger<6&&event.passenger!==event.driver));
  assert.ok(plan.every((event, i) => !i || event.atM - plan[i - 1].atM > 240));
});

test('the parking event selects a measured site on each circuit and rejects invalidated sites',()=>{
  for(const trackId of CIRCUIT_IDS) {
    const route=readCircuitSource(trackId),query=createRouteQuery(route);
    const options={trackId,lengthM:route.lengthM,canPark:(s,site)=>Math.abs(query.sample(s).widthM-site.widthM)<.02};
    const stations=new Set();
    for(let seed=1;seed<=40;seed++) {
      const plan=createDriveTrafficPlan({...options,seed});
      const row=plan.find(e=>e.kind==='parked');
      assert.ok(row,trackId);
      assert.ok(TRAFFIC_PARKING[trackId].includes(row.parking),trackId);
      assert.equal(row.parking.atM,row.atM,trackId);
      assert.ok(row.parking.freeLaneM>=2.65&&row.parking.tireDeviationM<=.092,trackId);
      assert.ok(plan.every((event,i)=>i===0||event.atM>plan[i-1].atM),trackId);
      stations.add(row.atM);
    }
    assert.ok(stations.size>1,trackId);
    assert.ok(!createDriveTrafficPlan({...options,seed:1,canPark:()=>false}).some(e=>e.kind==='parked'),trackId);
  }
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

test('a car traveling ahead does not suppress independent oncoming traffic', () => {
  const traffic=createDriveTraffic([
    {id:0,kind:'regular',model:'chevy',atM:510,direction:1,speedMps:14},
    {id:1,kind:'regular',model:'belair_1957',atM:1150,direction:-1,speedMps:14},
  ],{lengthM:5000});
  for(let s=300;s<935;s+=1.4)traffic.update({progressM:s,speedMps:14,lateralM:1,dt:.1});
  const cars=traffic.update({progressM:960,speedMps:14,lateralM:1,dt:.1});
  assert.deepEqual(cars.map(car=>car.direction),[1,-1]);
  assert.equal(cars[1].side,-1);
});

test('an unsafe overtake remains pending without hiding a parked car', () => {
  const traffic=createDriveTraffic([
    {id:0,kind:'passing',model:'chevy',atM:1000,direction:1,speedMps:33},
    {id:1,kind:'parked',model:'pickup_3100',atM:1180,direction:1,speedMps:0},
  ],{lengthM:5000});
  const sample=(progressM,passingAllowed)=>traffic.update({progressM,speedMps:14,lateralM:1,dt:1,passingAllowed});
  assert.deepEqual(sample(1000,()=>false).map(car=>car.kind),['parked']);
  assert.deepEqual(sample(1040,()=>true).map(car=>car.kind),['parked','passing']);
});

test('the one planned overtake can wait beyond its initial sector for a safe opening', () => {
  const event={id:0,kind:'passing',model:'chevy',atM:1000,direction:1,speedMps:33};
  const traffic=createDriveTraffic([event],{lengthM:5000});
  const sample=(progressM,allowed)=>traffic.update({progressM,speedMps:14,lateralM:1,dt:1,passingAllowed:()=>allowed});
  assert.equal(sample(1000,false).length,0);
  assert.equal(sample(1750,true)[0]?.id,0);
  assert.equal(sample(2500,true).length,0);
});

test('after overtaking the player, the fast car follows slower traffic in the right lane', () => {
  const traffic=createDriveTraffic([
    {id:0,kind:'regular',model:'chevy',atM:510,direction:1,speedMps:14},
    {id:1,kind:'passing',model:'falcon',atM:1000,direction:1,speedMps:33},
  ],{lengthM:5000});
  let closest=Infinity;
  for(let s=300;s<1750;s+=1.4){
    const [regular,fast]=traffic.update({progressM:s,speedMps:14,lateralM:1,dt:.1});
    if(regular&&fast?.side>.6&&fast.progressM>s)closest=Math.min(closest,regular.progressM-fast.progressM);
  }
  assert.ok(closest>10&&closest<25, String(closest));
});

test('a parked car has its own visual slot when a moving car shares its model', () => {
  const traffic=createDriveTraffic([
    {id:0,kind:'regular',model:'chevy',atM:510,direction:1,speedMps:14},
    {id:1,kind:'parked',model:'chevy',atM:1150,direction:1,speedMps:0},
  ],{lengthM:5000});
  for(let s=300;s<950;s+=1.4)traffic.update({progressM:s,speedMps:14,lateralM:1,dt:.1});
  assert.deepEqual(traffic.update({progressM:960,speedMps:14,lateralM:1,dt:.1}).map(car=>car.kind),['regular','parked']);
});
