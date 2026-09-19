import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as warmup from '../src/performance/render-warmup.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
test('A5 equivalent starts reuse a completed preparation, changed scene and context invalidate it',async()=>{
 assert.equal(typeof warmup.createRenderWarmupCache,'function');const cache=warmup.createRenderWarmupCache();let tier='cinematic',scene={},calls=0;
 const options={getKey:()=>[scene,'vehicle-a'],maximumTier:'cinematic',getTier:()=>tier,applyTier:t=>tier=t,prepare:async()=>calls++};
 const first=await cache.prepare(options),second=await cache.prepare(options);assert.equal(first.cacheHit,false);assert.equal(second.cacheHit,true);assert.equal(calls,4);assert.equal(tier,'cinematic');
 scene={};await cache.prepare(options);assert.equal(calls,8);cache.invalidate();await cache.prepare(options);assert.equal(calls,12);
 await cache.prepare({...options,maximumTier:'high'});assert.equal(calls,15);cache.dispose();
});
test('A5 aborted preparation restores tier and never becomes a cache hit',async()=>{
 assert.equal(typeof warmup.createRenderWarmupCache,'function');let tier='high',release,calls=0;const cache=warmup.createRenderWarmupCache(),c=new AbortController();
 const options={getKey:()=>['same'],getTier:()=>tier,applyTier:t=>tier=t,prepare:()=>++calls===1?new Promise(r=>release=r):Promise.resolve()};
 const result=cache.prepare({...options,signal:c.signal});await tick();c.abort();await assert.rejects(result,{name:'AbortError'});await tick();assert.equal(tier,'high');release();await tick();
 const next=await cache.prepare(options);assert.equal(next.cacheHit,false);assert.equal(calls,4);cache.dispose();
});
test('A5 context invalidation cancels pending warmup and prevents stale completion',async()=>{
 assert.equal(typeof warmup.createRenderWarmupCache,'function');const cache=warmup.createRenderWarmupCache();let tier='high';
 const pending=cache.prepare({getKey:()=>[1],getTier:()=>tier,applyTier:t=>tier=t,prepare:()=>new Promise(()=>{})});await tick();cache.invalidate();await assert.rejects(pending,{name:'AbortError'});await tick();assert.equal(tier,'high');assert.equal(cache.diagnostics().cached,false);cache.dispose();
});
test('A5 actual host uses cache with vehicle, scene/resource identity and context invalidation',()=>{
 const source=fs.readFileSync(new URL('../src/legacy/module-02.mjs',import.meta.url),'utf8');assert.match(source,/visualWarmupCache\.prepare\(/);assert.match(source,/visualWarmupCache\.invalidate\(/);assert.match(source,/getRenderPreparationKey/);
});
test('A5 view preparation cancellation restores camera before any late draw completion',async()=>{
 const c=new AbortController();let view='original',draws=0,release;const result=warmup.prewarmViews({signal:c.signal,capture:()=>view,selections:[()=>view='first',()=>view='second'],draw:()=>{draws++;return new Promise(r=>release=r);},restore:v=>view=v});await tick();c.abort();assert.equal(await Promise.race([result.then(()=> 'done',e=>e.name),new Promise(r=>setTimeout(()=>r('pending'),50))]),'AbortError');assert.equal(view,'original');release();await tick();assert.equal(draws,1);
});
