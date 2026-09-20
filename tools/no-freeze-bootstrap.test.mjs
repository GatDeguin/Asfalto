import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkshopBootstrap} from '../src/runtime/workshop-bootstrap.mjs';

test('bootstrap failure never requests the monolithic cockpit payload',async()=>{
 const calls=[];const original={dataset:{externalUrl:'forbidden-59MB.json'}};
 await assert.rejects(loadWorkshopBootstrap(original,{read:async node=>{calls.push(node.dataset.externalUrl);throw new Error('HTTP 503');}}),/503/);
 assert.equal(calls.length,1);assert(!calls.some(url=>url.includes('forbidden')));
});
test('aborted and stalled bootstrap consumers settle',async()=>{
 const abort=new AbortController();const request=loadWorkshopBootstrap(null,{signal:abort.signal,read:()=>new Promise(()=>{})});abort.abort(new DOMException('cancelled','AbortError'));
 await assert.rejects(request,{name:'AbortError'});
 await assert.rejects(loadWorkshopBootstrap(null,{timeoutMs:10,read:()=>new Promise(()=>{})}),{name:'TimeoutError'});
});
test('successful bootstrap returns only the small document and retry is explicit',async()=>{
 let calls=0;const read=async()=>{calls++;if(calls===1)throw new Error('checksum mismatch');return new TextEncoder().encode('{"threeCoreGz":"small"}');};
 await assert.rejects(loadWorkshopBootstrap(null,{read}),/checksum/);
 assert.equal(calls,1);const next=await loadWorkshopBootstrap(null,{read});assert.deepEqual(next,{payload:{threeCoreGz:'small'},full:false});assert.equal(calls,2);
});
