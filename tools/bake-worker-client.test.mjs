import test from 'node:test';import assert from 'node:assert/strict';
let Client;try{({BakeWorkerClient:Client}=await import('../src/tracks/visuals/bake-worker-client.mjs?v=f1b8a1be5cb47787'));}catch{}
class WorkerFake {static all=[];constructor(){WorkerFake.all.push(this);}postMessage(message){this.message=message;}terminate(){this.terminated=true;}result(payload={entries:[]}){this.onmessage?.({data:{requestId:this.message.requestId,ok:true,payload,stats:{},sentAt:performance.now()}});}}
test('abort terminates worker and overlap rejects old load without publishing stale result',async()=>{
 assert.equal(typeof Client,'function');const client=new Client({WorkerClass:WorkerFake});const controller=new AbortController();const first=client.load('a',controller.signal);const rejection=assert.rejects(first,{name:'AbortError'});controller.abort();await rejection;assert.equal(WorkerFake.all.at(-1).terminated,true);
 const old=client.load('a'),oldReject=assert.rejects(old,{name:'AbortError'}),worker=WorkerFake.all.at(-1),current=client.load('b');await oldReject;worker.result({id:'a',entries:[]});WorkerFake.all.at(-1).result({id:'b',entries:[]});assert.equal((await current).payload.id,'b');assert.equal(client.active,null);
});
test('worker creation error, message error and timeout reject so caller can compute fallback',async()=>{
 assert.equal(typeof Client,'function');class Throws{constructor(){throw Error('denied');}}await assert.rejects(new Client({WorkerClass:Throws}).load('a'),/denied/);
 const client=new Client({WorkerClass:WorkerFake,timeoutMs:5});const bad=client.load('a');WorkerFake.all.at(-1).onerror({message:'worker crashed',preventDefault(){}});await assert.rejects(bad,/worker crashed/);
 await assert.rejects(client.load('a'),/timeout/);assert.equal(WorkerFake.all.at(-1).terminated,true);
 const unsupported=new Client({WorkerClass:null});await assert.rejects(unsupported.load('a'),/unavailable/);
});
