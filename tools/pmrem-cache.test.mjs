import test from 'node:test';
import assert from 'node:assert/strict';
import {createPmremCache} from '../src/render/pmrem-cache.mjs?v=01039df439330321';
import {createHdriTransition,rotateHdriHalfTurn} from '../src/render/hdri-transition.mjs?v=c834f23996830a5c';
import * as T from '../../Web/vendor/three.module.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const target=()=>({texture:{},width:768,height:1024,disposals:0,dispose(){this.disposals++;}});
test('deduplicates concurrent builds, keeps dimensions and ref counts; idle LRU never evicts active leases',async()=>{
 let builds=0;const targets=[];const cache=createPmremCache({maxIdle:1,build:()=>{builds++;const t=target();targets.push(t);return t;}});
 const [a,b]=await Promise.all([cache.acquire('a',{}),cache.acquire('a',{})]);assert.equal(builds,1);assert.equal(a.texture,b.texture);assert.equal(a.width,768);assert.equal(a.height,1024);
 a.dispose();a.dispose();assert.equal(cache.diagnostics().idle,0);
 const c=await cache.acquire('c',{});c.dispose();const d=await cache.acquire('d',{});d.dispose();assert.equal(targets[1].disposals,1);assert.equal(targets[0].disposals,0);
 b.dispose();assert.equal(targets[2].disposals,1);const again=await cache.acquire('a',{});assert.equal(builds,3);again.dispose();cache.dispose();cache.dispose();assert.deepEqual(targets.map(t=>t.disposals),[1,1,1]);
});
test('cold builds yield and failure is retryable',async()=>{
 let builds=0;const gate=deferred();const cache=createPmremCache({yieldTask:()=>gate.promise,build:()=>{if(++builds===1)throw Error('failed');return target();}});
 const pending=cache.acquire('a',{});assert.equal(builds,0);gate.resolve();await assert.rejects(pending,/failed/);const lease=await cache.acquire('a',{});assert.equal(builds,2);lease.dispose();cache.dispose();
});
test('shutdown cancels queued work and disposes in-flight and active targets once',async()=>{
 const gate=deferred();let builds=0;const queued=createPmremCache({yieldTask:()=>gate.promise,build:()=>{builds++;return target();}});const p=queued.acquire('a',{});queued.dispose();gate.resolve();await assert.rejects(p,/disposed/);assert.equal(builds,0);
 const started=deferred(),finish=deferred(),t=target();const cache=createPmremCache({build:()=>{started.resolve();return finish.promise;}});const a=cache.acquire('a',{}),b=cache.acquire('a',{});await started.promise;cache.dispose();finish.resolve(t);await Promise.all([assert.rejects(a,/disposed/),assert.rejects(b,/disposed/)]);assert.equal(t.disposals,1);await assert.rejects(cache.acquire('b',{}),/disposed/);
 const live=target(),other=createPmremCache({build:()=>live});const lease=await other.acquire('x',{});other.dispose();lease.dispose();assert.equal(live.disposals,1);
});
test('zero idle budget releases immediately',async()=>{const t=target(),cache=createPmremCache({maxIdle:0,build:()=>t});const a=await cache.acquire('a',{});a.dispose();assert.equal(t.disposals,1);assert.equal(cache.diagnostics().entries,0);cache.dispose();});
test('half-turn orientation metadata distinguishes unchanged-name panoramas',()=>{const t=new T.DataTexture(new Float32Array([1,2,3,4]),4,1);t.name='golden';rotateHdriHalfTurn(t);assert.equal(t.name,'golden');assert.equal(t.userData.asfaltoHdriHalfTurn,true);assert.deepEqual([...t.image.data],[3,4,1,2]);rotateHdriHalfTurn(t);assert.equal(t.userData.asfaltoHdriHalfTurn,false);});
test('prepare returns ready with unresolved next and cancellation releases that source',async()=>{
 const next=deferred(),started=deferred();let disposal=0;const knot=key=>({key,skyId:key}),state={from:knot('a'),to:knot('b'),next:knot('c')};
 const texture=()=>{const t=new T.Texture();t.image={width:8,height:4};return t;};
 const transition=createHdriTransition(T,{scene:new T.Scene(),renderer:{},loadSource:async key=>{if(key==='c'){started.resolve();return next.promise;}return texture();},buildPmrem:()=>({texture:texture(),width:8,height:4,dispose(){}})});
 assert.equal(await transition.prepare(state),true);await started.promise;assert.equal(transition.diagnostics().slots,3);transition.release();const t=texture();t.addEventListener('dispose',()=>disposal++);next.resolve(t);await new Promise(r=>setTimeout(r,5));assert.equal(disposal,1);assert.equal(transition.diagnostics().slots,0);transition.dispose();
});
test('release retains source until asynchronous build settles',async()=>{
 const started=deferred(),finish=deferred();let sources=0;const state={from:{key:'a',skyId:'a'},to:{key:'b',skyId:'b'},next:{key:'c',skyId:'c'}};
 const transition=createHdriTransition(T,{scene:new T.Scene(),renderer:{},loadSource:async()=>({dispose(){sources++;}}),buildPmrem:()=>{started.resolve();return finish.promise;}});
 const pending=transition.prepare(state);await started.promise;transition.release();assert.equal(sources,0);const t=target();finish.resolve(t);assert.equal(await pending,false);assert.equal(sources,1);assert.equal(t.disposals,1);transition.dispose();
});
