import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as chassis from '../src/game/chassis-configuration.mjs?v=cb4421d5b87d806c';
const root=new URL('../',import.meta.url);
const context=vm.createContext({console,WebAssembly,TextDecoder,TextEncoder,atob,btoa,performance});
for(const name of ['asfalto-v6-rapier.js','asfalto-v6-vehicle-model.js','asfalto-v6-physics-runtime.js'])vm.runInContext(fs.readFileSync(new URL('src/legacy/'+name,root),'utf8'),context);
context.AsfaltoV6Chassis=chassis;
const old=vm.createContext({});
for(const name of ['asfalto-v6-vehicle-model.js','asfalto-v6-physics-runtime.js'])vm.runInContext(fs.readFileSync(new URL('../Reports/Asfalto_Nacional_v8/runtime-gpu-2026-09-27/before/src/legacy/'+name,root),'utf8'),old);
old.AsfaltoV6Chassis=chassis;
const R=context.AsfaltoV6Rapier;await R.init();
function session(ctx,height,configured){const world=new R.World({x:0,y:-9.81,z:0});world.createCollider(R.ColliderDesc.cuboid(100,.1,100).setTranslation(0,-.1,0));world.step();const result=new ctx.AsfaltoV6Physics.VehiclePhysicsSession({RAPIER:R,world,core:ctx.AsfaltoV6VehicleCore,spec:ctx.AsfaltoV6VehicleCore.CHEVY_ORIGINAL_SPEC,spawn:{x:0,y:height,z:0},mutableSnapshots:true,chassisConfig:configured?{abs:true,tire:2,kit:1}:null});result.reset({spawn:{x:0,y:height,z:0},initialGear:1});return result;}
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

vm.runInContext(fs.readFileSync(new URL('src/legacy/asfalto-v6-integration-runtime.js?v=36c7b7d2619c02c2',root),'utf8'),context);
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
