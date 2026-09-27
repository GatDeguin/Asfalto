import test from 'node:test';import assert from 'node:assert/strict';
import {createDemandVehicleLods} from '../src/render/demand-vehicle-lods.mjs?v=4a07a2ebe53561d6';
test('first demand prefetches bytes; decode waits safe state and disposal cancels',async()=>{let prefetched=0,loaded=0;const root={visible:true},primary={root,update(){},dispose(){},diagnostics:()=>({})},secondary={root:{visible:false},update(){},setActive(){},dispose(){this.disposed=true;}};const c=createDemandVehicleLods({primary,prefetch:()=>{prefetched++;},load:async()=>{loaded++;return secondary;},select:s=>s.level});c.update({level:2});assert.equal(prefetched,1);assert.equal(loaded,0);c.update({level:2,paused:true});await new Promise(r=>setImmediate(r));assert.equal(loaded,1);c.update({level:2});assert.equal(root.visible,false);assert.equal(secondary.root.visible,true);c.dispose();assert.equal(secondary.disposed,true);});
test('only the displayed LOD keeps its lighting active through update and both views stay synchronized',async()=>{
 function view(){return {root:{visible:true},lightingActive:false,samples:[],setActive(value){this.lightingActive=value;},update(sample){this.samples.push(sample);this.lightingActive=sample.active!==false;},dispose(){},diagnostics:()=>({})};}
 const primary=view(),secondary=view(),c=createDemandVehicleLods({primary,prefetch:async()=>{},load:async()=>secondary,select:s=>s.level});
 c.update({level:2,paused:true,active:true,time:1});await new Promise(r=>setImmediate(r));
 c.update({level:2,active:true,time:2});assert.equal(primary.lightingActive,false);assert.equal(secondary.lightingActive,true);assert.equal(primary.root.visible,false);assert.equal(secondary.root.visible,true);
 c.update({level:0,active:true,time:3});assert.equal(primary.lightingActive,true);assert.equal(secondary.lightingActive,false);assert.equal(primary.root.visible,true);assert.equal(secondary.root.visible,false);
 c.update({level:2,active:false,time:4});assert.equal(primary.lightingActive,false);assert.equal(secondary.lightingActive,false);
 assert.deepEqual(primary.samples.map(s=>s.time),[1,2,3,4]);assert.deepEqual(secondary.samples.map(s=>s.time),[2,3,4]);assert.ok([...primary.samples,...secondary.samples].every(s=>s.projectedPixels===Infinity));c.dispose();
});
