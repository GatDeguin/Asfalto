import test from 'node:test';import assert from 'node:assert/strict';
import {createDemandLoader,boundedOperation} from '../src/runtime/demand-loader.mjs';
test('shared consumers cancel independently and one producer resolves both',async()=>{
 let calls=0,finish;const loader=createDemandLoader(()=>{calls++;return new Promise(r=>finish=r);});const a=new AbortController();const one=loader.request({signal:a.signal}),two=loader.request();await Promise.resolve();a.abort(new DOMException('cancel','AbortError'));await assert.rejects(one,{name:'AbortError'});finish(42);assert.equal(await two,42);assert.equal(calls,1);assert.equal(await loader.request(),42);assert.equal(loader.diagnostics().consumers,0);
});
test('last cancellation aborts producer and permits a fresh generation',async()=>{
 let signal;const loader=createDemandLoader(({signal:s})=>{signal=s;return new Promise(()=>{});});const a=new AbortController(),one=loader.request({signal:a.signal});await Promise.resolve();a.abort(new DOMException('cancel','AbortError'));await assert.rejects(one);assert(signal.aborted);assert.equal(loader.diagnostics().state,'aborted');loader.dispose();
});
test('timeout and synchronous exceptions do not leave consumers pending',async()=>{
 const loader=createDemandLoader(()=>new Promise(()=>{}),{timeoutMs:5});await assert.rejects(loader.request(),{name:'TimeoutError'});assert.equal(loader.diagnostics().state,'failed');assert.equal(loader.diagnostics().consumers,0);
 await assert.rejects(boundedOperation(()=>{throw new Error('decode');}),/decode/);
});

test('a late owned result is disposed once after timeout, then retry succeeds',async()=>{
 let finish,disposed=0,calls=0;
 const loader=createDemandLoader(()=>++calls===1?new Promise(r=>finish=r):Promise.resolve(42),{timeoutMs:5});
 await assert.rejects(loader.request(),{name:'TimeoutError'});
 finish({dispose(){disposed++;}});await new Promise(setImmediate);
 assert.equal(disposed,1);assert.equal(await loader.request(),42);loader.dispose();assert.equal(disposed,1);
});
test('a late owned result is disposed once after the last consumer aborts',async()=>{
 let finish,disposed=0;const c=new AbortController();
 const loader=createDemandLoader(()=>new Promise(r=>finish=r));const pending=loader.request({signal:c.signal});await Promise.resolve();
 c.abort();await assert.rejects(pending);finish({dispose(){disposed++;}});await new Promise(setImmediate);
 loader.dispose();assert.equal(disposed,1);
});
