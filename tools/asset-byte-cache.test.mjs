import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetByteCache} from '../src/runtime/asset-byte-cache.mjs?v=ff36157512bb6612';
const response=values=>({ok:true,arrayBuffer:async()=>Uint8Array.from(values).buffer});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

test('deduplicates consumers, returns owned buffers and evicts by byte LRU',async()=>{
 let calls=0;const cache=createAssetByteCache({maxBytes:6,maxEntryBytes:4,fetchImpl:async()=>{calls++;return response([1,2,3]);}});
 const [a,b]=await Promise.all([cache.read('a?v=0123456789abcdef'),cache.read('a?v=0123456789abcdef')]);assert.equal(calls,1);a[0]=99;assert.equal(b[0],1);
 assert.equal((await cache.read('a?v=0123456789abcdef'))[0],1);assert.equal(calls,1);
 await cache.read('b?v=0123456789abcdef');await cache.read('a?v=0123456789abcdef');await cache.read('c?v=0123456789abcdef');assert.equal(cache.diagnostics().residentBytes,6);
 await cache.read('b?v=0123456789abcdef');assert.equal(calls,4);
});
test('one cancelled consumer does not abort the shared transfer; last one does',async()=>{
 const gate=defer();let transfer;const cache=createAssetByteCache({fetchImpl:async(_url,{signal})=>{transfer=signal;return gate.promise;}});
 const one=new AbortController(),two=new AbortController();const a=cache.read('shared?v=0123456789abcdef',{signal:one.signal});const b=cache.read('shared?v=0123456789abcdef',{signal:two.signal});
 one.abort();await assert.rejects(a,{name:'AbortError'});assert.equal(transfer.aborted,false);gate.resolve(response([7]));assert.deepEqual([...await b],[7]);
 const wait=defer();let abandoned;const c=createAssetByteCache({fetchImpl:async(_url,{signal})=>{abandoned=signal;return wait.promise;}});const controller=new AbortController();const p=c.read('a',{signal:controller.signal});await Promise.resolve();controller.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(abandoned.aborted,true);wait.resolve(response([9]));await new Promise(r=>setImmediate(r));assert.equal(c.diagnostics().residentBytes,0);
});
test('failures, oversized files and unversioned files are not retained; clear invalidates pending',async()=>{
 let calls=0;const cache=createAssetByteCache({maxBytes:4,maxEntryBytes:2,fetchImpl:async()=>{calls++;if(calls===1)throw new Error('offline');return response([1,2,3]);}});
 await assert.rejects(cache.read('a?v=0123456789abcdef'),/offline/);await cache.read('a?v=0123456789abcdef');await cache.read('a?v=0123456789abcdef');assert.equal(calls,3);assert.equal(cache.diagnostics().residentBytes,0);
 const gate=defer();const c=createAssetByteCache({fetchImpl:()=>gate.promise});const p=c.read('a?v=0123456789abcdef');c.clear();gate.resolve(response([1]));await p;assert.equal(c.diagnostics().residentBytes,0);
 let plain=0;const d=createAssetByteCache({fetchImpl:async()=>{plain++;return response([1]);}});await d.read('plain');await d.read('plain');assert.equal(plain,2);
});

test('arbitrary falsy abort reasons reject promptly and abort the last transfer',async()=>{
 for(const reason of [false,0,'']){
  const gate=defer();let transfer;const cache=createAssetByteCache({fetchImpl:async(_url,{signal})=>{transfer=signal;return gate.promise;}});
  const controller=new AbortController();const pending=cache.read('a',{signal:controller.signal});await Promise.resolve();controller.abort(reason);
  await pending.then(()=>assert.fail('must reject'),error=>assert.equal(error,reason));assert.equal(transfer.aborted,true);gate.resolve(response([1]));
 }
});
