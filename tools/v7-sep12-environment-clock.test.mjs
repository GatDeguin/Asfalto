import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceDayCycle} from '../src/environment/race-day-cycle.mjs?v=7e778f2f4e357b6f';
import * as controls from '../src/ui/race-day-cycle-controls.mjs?v=5f87a759443055e0';
const advance=(clock,dt)=>clock.update({dt,status:'RUNNING',active:true});
test('360 second cycles preserve completed loops and real active time across a duration change',()=>{
 const c=createRaceDayCycle({skyId:'sunset',durationSeconds:360}),state=c.state;
 advance(c,810);assert.equal(c.state,state);assert.equal(state.completedCycles,2);assert.equal(state.elapsedSeconds,90);assert.equal(state.activeSeconds,810);
 const hour=state.hour;c.setOptions({durationSeconds:720});assert.equal(state.hour,hour);assert.equal(state.elapsedSeconds,180);assert.equal(state.activeSeconds,810);assert.equal(state.completedCycles,2);
 advance(c,540);assert.equal(state.completedCycles,3);assert.equal(state.elapsedSeconds,0);assert.equal(state.activeSeconds,1350);assert.equal(state.hour,18.5);
});
test('pause, countdown, inactive and fixed modes cannot advance either clock counter',()=>{
 const c=createRaceDayCycle({skyId:'night',durationSeconds:360});advance(c,360);
 for(const status of ['PAUSED','COUNTDOWN','IDLE'])c.update({dt:360,status,active:true});
 c.update({dt:360,status:'RUNNING',active:false});c.setOptions({enabled:false});advance(c,360);
 assert.equal(c.state.activeSeconds,360);assert.equal(c.state.completedCycles,1);assert.equal(c.state.hour,0);
 c.reset('golden-hour');assert.equal(c.state.completedCycles,0);assert.equal(c.state.activeSeconds,0);assert.equal(c.state.hour,17);
});
function fixture(value){const saved=new Map(value?[['asfalto:nacional:v6:day-cycle',value]]:[]),elements=[0,1].map(()=>({value:'',listeners:{},addEventListener(k,fn){this.listeners[k]=fn},removeEventListener(k){delete this.listeners[k]}}));return{storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},document:{querySelectorAll:()=>elements},elements,saved};}
test('six minute selection is persisted and sent to the controller with enabled state',async()=>{
 assert.equal(typeof controls.readRaceDayCycleOptions,'function');const f=fixture(),calls=[];
 const ui=controls.installRaceDayCycleControls({...f,getController:()=>({async setDayCycleOptions(o){calls.push(o)}})});
 f.elements[0].value='cycle-6';await f.elements[0].listeners.change();
 assert.deepEqual(controls.readRaceDayCycleOptions(f.storage),{enabled:true,durationSeconds:360});assert.deepEqual(calls.at(-1),{enabled:true,durationSeconds:360});assert.equal(f.elements[1].value,'cycle-6');
 f.elements[1].value='fixed';await f.elements[1].listeners.change();assert.deepEqual(controls.readRaceDayCycleOptions(f.storage),{enabled:false,durationSeconds:360});ui.dispose();assert.equal(f.elements[0].listeners.change,undefined);
});
test('legacy cycle and unavailable storage load a twelve minute cycle',()=>{
 assert.equal(typeof controls.readRaceDayCycleOptions,'function');assert.deepEqual(controls.readRaceDayCycleOptions(fixture('cycle').storage),{enabled:true,durationSeconds:720});assert.deepEqual(controls.readRaceDayCycleOptions({getItem(){throw Error('blocked')}}),{enabled:true,durationSeconds:720});
});

test('120 Hz active updates cross the exact six minute boundary without losing a full cycle',()=>{
 const clock=createRaceDayCycle({skyId:'night',durationSeconds:360});for(let i=0;i<43200;i++)advance(clock,1/120);assert.equal(clock.state.completedCycles,1);assert.ok(clock.state.elapsedSeconds<1e-6);assert.ok(Math.abs(clock.state.activeSeconds-360)<1e-6);
});
