import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as maintenance from '../src/game/vehicle-maintenance.mjs?v=de3e5e0f060ab156';
import {normalizeVehicleCondition} from '../src/game/vehicle-condition.mjs';

const source=await readFile(new URL('../src/legacy/v6-complete-runtime.js?v=2eee8004211ab081',import.meta.url),'utf8');
const resolveSource=/const selectedVehicle=(\(\)=>[^;]+);/.exec(source)?.[1];
assert.ok(resolveSource,'Exercise the actual menu maintenance resolver');
function selector(profile,{workshopId,storedId=null}={}){
 return vm.runInNewContext(resolveSource,{profile,workshop:{vehicleId:workshopId},getProfileVehicleId:maintenance.getProfileVehicleId,__asfaltoV7Storage:{getItem:()=>storedId}});
}
function savedProfile(){
 const cars={chevy:normalizeVehicleCondition({engine:92,oil:84,brakes:88,tires:91,body:87,fuel:78,dirt:18}),chevrolet_1969:normalizeVehicleCondition({engine:73,fuel:44,dirt:31})};
 return {createdAt:'2026-11-17T00:00:00Z',xp:3,workshopTokens:100,workshopLearningV7:{appearance:true},appearance:{dirt:31},condition:structuredClone(cars.chevrolet_1969),vehicleConditionsV7:{version:1,selectedVehicleId:'chevrolet_1969',cars}};
}

test('failed visual loading and unload preserve the saved vehicle and every condition',()=>{
 const profile=savedProfile(),before=structuredClone(profile),getVehicleId=selector(profile),saved=[];
 const system=maintenance.createVehicleMaintenance({getProfile:()=>profile,getVehicleId,save:()=>saved.push(structuredClone(profile))});
 assert.equal(system.getState().vehicleId,'chevrolet_1969');
 system.flush({end:true});
 assert.deepEqual(profile,before,'No fallback car, apparent repair or dirt reset may be saved');
 assert.deepEqual(saved,[before]);
});

test('an explicit or committed workshop selection still takes precedence over profile mirrors',()=>{
 const profile=savedProfile();
 assert.equal(selector(profile,{storedId:'belair_1957'})(),'belair_1957');
 assert.equal(selector(profile,{workshopId:'pickup_3100',storedId:'belair_1957'})(),'pickup_3100');
});

test('rendering appearance during failed loading cannot copy another car paint into the selected car',()=>{
 const profile=savedProfile();profile.vehiclePaintV7={chevy:'#d66a24',chevrolet_1969:'#123456'};
 const before=structuredClone(profile.vehiclePaintV7),getVehicleId=selector(profile);
 const system=maintenance.createVehicleMaintenance({getProfile:()=>profile,getVehicleId});
 const paintSource=/const paintVehicle=[^;]+;workshop\.setCarColor\([^;]+\);/.exec(source)?.[0];
 assert.ok(paintSource,'Exercise the actual appearance initialization');
 vm.runInNewContext(paintSource,{profile,BODY_COLORS:{},workshop:{setCarColor:hex=>profile.vehiclePaintV7[getVehicleId()]=hex},__asfaltoVehicleMaintenance:system,__asfaltoV7Storage:{getItem:()=>null}});
 assert.deepEqual(profile.vehiclePaintV7,before);
});

test('legacy profiles and invalid vehicle IDs retain the original Chevy migration',()=>{
 for(const bank of [undefined,{version:1,selectedVehicleId:'untrusted-car-id',cars:{}},{version:99,selectedVehicleId:'chevrolet_1969',cars:{}}]){
  const profile={condition:{engine:92,fuel:78},appearance:{dirt:18},vehicleConditionsV7:bank};
  const system=maintenance.createVehicleMaintenance({getProfile:()=>profile,getVehicleId:selector(profile)});
  assert.equal(system.getState().vehicleId,'chevy');
  if(bank?.version!==1){assert.equal(system.getState().condition.engine,92);assert.equal(system.getState().condition.dirt,18);}
 }
});
