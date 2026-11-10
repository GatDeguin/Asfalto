import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as chassis from '../src/game/chassis-configuration.mjs?v=cb4421d5b87d806c';
import {buildVehiclePhysicsSpec} from '../src/game/expansion-vehicle-runtime.mjs';
import {applyWorkshopPerformance,workshopPerformanceSetup} from '../src/game/workshop-performance.mjs';
const root=new URL('../',import.meta.url);
const context=vm.createContext({console,WebAssembly,TextDecoder,TextEncoder,atob,btoa,performance});
for(const name of ['asfalto-v6-rapier.js','asfalto-v6-vehicle-model.js','asfalto-v6-physics-runtime.js'])vm.runInContext(fs.readFileSync(new URL('src/legacy/'+name,root),'utf8'),context);
context.AsfaltoV6Chassis=chassis;
const old=vm.createContext({});
for(const name of ['asfalto-v6-vehicle-model.js','asfalto-v6-physics-runtime.js'])vm.runInContext(fs.readFileSync(new URL('tools/fixtures/physics-baseline-2026-09-27/'+name,root),'utf8'),old);
old.AsfaltoV6Chassis=chassis;
const R=context.AsfaltoV6Rapier;await R.init();
function session(ctx,height,configured,spec=ctx.AsfaltoV6VehicleCore.CHEVY_ORIGINAL_SPEC){const world=new R.World({x:0,y:-9.81,z:0});world.createCollider(R.ColliderDesc.cuboid(100,.1,100).setTranslation(0,-.1,0));world.step();const result=new ctx.AsfaltoV6Physics.VehiclePhysicsSession({RAPIER:R,world,core:ctx.AsfaltoV6VehicleCore,spec,spawn:{x:0,y:height,z:0},mutableSnapshots:true,chassisConfig:configured?{abs:true,tire:2,kit:1}:null});result.reset({spawn:{x:0,y:height,z:0},initialGear:1});return result;}
function compare(a,b,path='snapshot'){if(typeof b==='number'){assert.ok(Number.isFinite(a),path+' finite');assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),path+': '+a+' != '+b);return;}if(b&&typeof b==='object'){for(const k of Object.keys(b))compare(a?.[k],b[k],path+'.'+k);}else assert.equal(a,b,path);}
for(const height of [.56,3])for(const configured of [false,true]){
 const a=session(context,height,configured),b=session(old,height,configured);const ray=a.scratch.ray,contacts=a.scratch.contacts,wheels=a.wheels;
 let first,copy;
 for(let i=0;i<16;i++){const input={throttle:.6,brake:i>8?.7:0,steer:.06,requestedGear:1,clutchEngagement:1};const actual=a.stepFixed(input),expected=b.stepFixed(input);compare(actual,expected);if(i===0){first=actual;copy=a.getSnapshotCopy();}if(i===2)assert.equal(actual,first);}
 assert.equal(a.scratch.ray,ray);assert.equal(a.scratch.contacts,contacts);assert.equal(a.wheels,wheels);assert.equal(copy.timeSeconds,1/120);assert.ok(Object.isFrozen(copy));
 a.applyImpact({impulseNs:52000,localPointM:[1,0,.2]});b.applyImpact({impulseNs:52000,localPointM:[1,0,.2]});compare(a.getSnapshot(),b.getSnapshot());
 compare(a.stepFixed({}),b.stepFixed({}));a.dispose();b.dispose();a.world.free();b.world.free();
}
console.log('physics runtime: 64 real Rapier ticks matched baseline; grounded/airborne, ABS/chassis, impact, buffer reuse and historical copy passed');

vm.runInContext(fs.readFileSync(new URL('src/legacy/asfalto-v6-integration-runtime.js?v=5c927ea089ff205a',root),'utf8'),context);
const proto=context.AsfaltoV6Integration.RaceSimulationV6.prototype;
const live=session(context,.56,false);live.stepFixed({});
let recorded,maintenance;
const host={_snapshot:live.getSnapshot(),_physicalEnvironmentQuery:{},_physicalEnvironment:{},_physicalFrameView:{},_physicalObservers:new Set(),_vehicleMaintenance:{sample(frame){maintenance=frame;}},_physicsSession:live,_projection:{s:1,raceProgress:1},_browserOptions:{},_physicalSessionSequence:1,_physicalQAMutated:false,_playerTeleportCount:0,_physicalTeleportBaseline:0,_recoveryCount:0,_referenceChart:0,getPhysicsSnapshotCopy:proto.getPhysicsSnapshotCopy};
proto._emitPhysicalStep.call(host,'RUNNING',0);assert.equal(maintenance.snapshot,host._snapshot);assert.ok(!Object.isFrozen(host._snapshot));
host._physicalObservers.add({sample(frame){recorded=frame;}});proto._emitPhysicalStep.call(host,'RUNNING',0);
assert.ok(Object.isFrozen(recorded.snapshot));assert.notEqual(recorded.snapshot,host._snapshot);const time=recorded.snapshot.timeSeconds;
for(let i=0;i<3;i++)live.stepFixed({});assert.equal(recorded.snapshot.timeSeconds,time);assert.ok(!Object.isFrozen(host._snapshot));
live.mutableSnapshots=false;const immutable=live.stepFixed({});assert.ok(Object.isFrozen(immutable));const originalTime=immutable.timeSeconds;live.stepFixed({});assert.equal(immutable.timeSeconds,originalTime);
live.dispose();live.world.free();
console.log('physics integration: synchronous maintenance view, immutable observer history and legacy default snapshot passed');
{
 const a=session(context,.56,false),b=session(old,.56,false);
 for(const s of [a,b]){s.world.createCollider(R.ColliderDesc.cuboid(.2,3,8).setTranslation(4,2,0));s.body.setLinvel({x:40,y:0,z:0},true);s.reserveImpactContacts?.();}
 let collisions=0;
 for(let i=0;i<16;i++){const actual=a.stepFixed({}),expected=b.stepFixed({});compare(actual,expected);if(expected.impact)collisions++;}
 assert.ok(collisions>0,'real static collision must exercise contact-force aggregation');
 a.dispose();b.dispose();a.world.free();b.world.free();
 console.log('physics impacts: 16 real Rapier wall-collision ticks and damage aggregation matched baseline');
}

test('recovery resets wheel motion and contact positions while retaining condition',()=>{
 const car=session(context,.56,false);
 try{
  for(let i=0;i<540;i++)car.stepFixed({throttle:.75,requestedGear:1,clutchEngagement:1});
  car.applyImpact({impulseNs:1800,localPointM:[1,0,.25]});
  const before=car.getSnapshotCopy();
  assert.ok(Math.hypot(...before.chassis.linearVelocity)>8);
  assert.ok(before.wheels.some(wheel=>Math.abs(wheel.angularSpeedRadps)>10));
  const reset=car.teleport({x:-30,y:.56,z:4},{x:0,y:0,z:0},{recovery:true});
  assert.equal(reset.timeSeconds,before.timeSeconds);
  assert.deepEqual(reset.damage,before.damage);
  assert.deepEqual(Array.from(reset.chassis.linearVelocity),[0,0,0]);
  assert.deepEqual(Array.from(reset.chassis.angularVelocity),[0,0,0]);
  for(const [i,wheel] of reset.wheels.entries()){
   assert.equal(wheel.angularSpeedRadps,0,'recovered wheel must lose its old angular momentum');
   assert.equal(wheel.slipRatio,0);
   assert.equal(wheel.slipAngleRad,0);
   assert.equal(wheel.rotationRad,before.wheels[i].rotationRad);
   assert.equal(wheel.temperatureC,before.wheels[i].temperatureC);
   assert.ok(wheel.contact&&wheel.normalLoadN>0);
   assert.ok(Array.isArray(wheel.point)&&Array.isArray(wheel.normal),'contacts retain the render snapshot vector format');
   assert.ok(Math.abs(wheel.point[0]+30)<2&&Math.abs(wheel.point[2]-4)<1&&Math.abs(wheel.point[1])<.01);
  }
  assert.equal(reset.impact,false);
  assert.equal(reset.impacts.length,0);
  for(let i=0;i<120;i++){
   const current=car.stepFixed({brake:1,handbrake:1,requestedGear:0,clutchEngagement:0});
   assert.ok(Math.hypot(...current.chassis.linearVelocity)<.25);
   assert.ok(Math.hypot(...current.chassis.position.map((v,axis)=>v-reset.chassis.position[axis]))<.04);
  }
 }finally{car.dispose();car.world.free();}
});

test('track recovery uses the selected pickup and suspension height',()=>{
 const pickup=buildVehiclePhysicsSpec(context.AsfaltoV6VehicleCore.CHEVY_ORIGINAL_SPEC,'pickup_3100');
 const spec=applyWorkshopPerformance(pickup,workshopPerformanceSetup({tuning:{rideHeight:15}}));
 const clearance=spec.cgHeightM+spec.suspensionSetup.heightM;
 const car=session(context,clearance,false,spec);
 try{
  const routeFrame={tangent:[1,0,0],left:[0,0,1],normal:[0,1,0]};
  const rules={
   state:{events:[]},
   recover(){this.state.penaltyTime=10;this.state.events.push({type:'recover'});return this.state;},
   debugSet(values){Object.assign(this.state,values);},
   getState(){return this.state;}
  };
  const simulation=Object.assign(Object.create(proto),{
   _rules:rules,_physicsSession:car,_playerTeleportCount:0,_recoveryCount:0,_projection:{},
   trackAdapter:{resolveRespawn(){return {sM:14,raceProgressM:14,position:[14,0,0],frame:routeFrame,clearanceM:.56,lateralM:0};}},
   _syncRulesMotion(){},_publish(){return this._rules.state;},_mergeFeedback(){return {};}
  });
  const result=simulation.requestRecovery('manual','test');
  assert.equal(result.recovered,true);
  assert.equal(rules.state.penaltyTime,10);
  assert.ok(Math.abs(result.snapshot.chassis.position[1]-clearance)<1e-5,'pickup uses its calibrated height and installed suspension');
  assert.equal(simulation._projection.signedSeparationM,clearance);
  assert.equal(simulation._currentSnapshot,simulation._previousSnapshot);
  assert.ok(result.snapshot.wheels.every(wheel=>wheel.contact&&wheel.compressionM<.16));
 }finally{car.dispose();car.world.free();}
});
