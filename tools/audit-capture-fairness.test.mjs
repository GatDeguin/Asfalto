import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuxiliaryCaptureSchedule} from '../src/render/auxiliary-capture-schedule.mjs';

test('slow frames cannot starve live mirrors behind water captures',()=>{
 for(const interval of [300,1000,5000]){
  const schedule=createAuxiliaryCaptureSchedule(),counts={water:0,center:0,left:0};
  for(let frame=0;frame<12;frame++){
   schedule.beginFrame(frame*interval,{quality:'low',mirrors:true});let used=0;
   for(const id of Object.keys(counts))if(schedule.take(id)){counts[id]++;used++;}
   assert.ok(used<=2,'capture burst is still bounded');
  }
  assert.ok(counts.water>0);assert.ok(counts.center>0,'center mirror receives service at '+interval+'ms');assert.ok(counts.left>0,'left mirror receives service at '+interval+'ms');
 }
});
test('return from a long pause services all views without an unlimited catch-up burst',()=>{
 const schedule=createAuxiliaryCaptureSchedule();schedule.beginFrame(0,{quality:'high',mirrors:true});schedule.take('water');
 const seen=new Set();
 for(let i=0;i<4;i++){
  schedule.beginFrame(60000+i*17,{quality:'high',mirrors:true});let used=0;
  for(const id of ['water','center','left'])if(schedule.take(id)){seen.add(id);used++;}
  assert.ok(used<=2);
 }
 assert.deepEqual([...seen].sort(),['center','left','water']);
 schedule.beginFrame(1,{quality:'balanced',mirrors:false});assert.equal(schedule.take('center'),false);assert.equal(schedule.take('left'),false);assert.equal(schedule.take('water'),true);
});
