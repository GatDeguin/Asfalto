import test from 'node:test';import assert from 'node:assert/strict';
import {createFrameScheduler} from '../src/runtime/frame-scheduler.mjs';
test('three owners share one RAF, cancellation and frequency are bounded',()=>{
 let next=1,queue=new Map(),a=0,b=0;const scheduler=createFrameScheduler({request:fn=>{const id=next++;queue.set(id,fn);return id;},cancel:id=>queue.delete(id),onError:e=>{throw e;}});
 const step=t=>{const work=[...queue.values()];queue.clear();work.forEach(fn=>fn(t));};
 const stopA=scheduler.subscribe('physics',()=>a++),stopB=scheduler.subscribe('hud',()=>b++,{hz:20});assert.equal(queue.size,1);step(0);step(16);step(32);step(50);assert.equal(a,4);assert.equal(b,2);stopA();stopB();assert.equal(queue.size,0);assert.equal(scheduler.diagnostics().owners.length,0);
});
test('disabled owners do no work and wake resumes without time catchup',()=>{
 let callback,active=false,calls=0;const s=createFrameScheduler({request:fn=>(callback=fn,1),cancel:()=>callback=null,onError:e=>{throw e;}});s.subscribe('scene',()=>calls++,{enabled:()=>active});assert.equal(callback,undefined);active=true;s.wake();callback(10000);assert.equal(calls,1);active=false;callback(11000);assert.equal(calls,1);s.dispose();
});
