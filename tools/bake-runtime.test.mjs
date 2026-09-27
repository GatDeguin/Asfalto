import test from 'node:test';import assert from 'node:assert/strict';
class WorkerFake{static all=[];constructor(){WorkerFake.all.push(this);}postMessage(m){this.message=m;}terminate(){this.terminated=true;}success(){this.onmessage?.({data:{requestId:this.message.requestId,ok:true,payload:{id:this.message.id,entries:[['result',this.message.id]]},stats:{},sentAt:performance.timeOrigin+performance.now()}});}}
globalThis.Worker=WorkerFake;globalThis.document={};const runtime=await import('../src/tracks/visuals/offline-track-bake.mjs?v=67e9450828b29db5');
test('runtime never installs superseded or aborted worker data',async()=>{
 const a=runtime.prepareTrackBake('a'),rejected=assert.rejects(a,{name:'AbortError'}),old=WorkerFake.all.at(-1),b=runtime.prepareTrackBake('b');old.success();WorkerFake.all.at(-1).success();await rejected;await b;assert.equal(runtime.bakeRead('result'),'b');assert.equal(runtime.bakeDiagnostics().id,'b');
 const signal=new AbortController(),c=runtime.prepareTrackBake('c',signal.signal),rejectC=assert.rejects(c,{name:'AbortError'});signal.abort();await rejectC;assert.equal(runtime.bakeDiagnostics().entries,0);
});
test('worker error reports explicit fallback and capture mode still records computed queries',async()=>{
 const oldWarn=console.warn;const warnings=[];console.warn=(...x)=>warnings.push(x);try{const p=runtime.prepareTrackBake('failed');WorkerFake.all.at(-1).onerror({message:'simulated unavailable'});await p;assert.equal(runtime.bakeDiagnostics().lastError,'simulated unavailable');assert.equal(runtime.bakeDiagnostics().entries,0);assert.equal(warnings.length,1);}finally{console.warn=oldWarn;}
 globalThis.__ASFALTO_CAPTURE_BAKE__=true;await runtime.prepareTrackBake('capture');let calls=0;const field=runtime.bakeSpatialField([],10,'test',()=>{calls++;return null;});assert.equal(field(-3,2),null);assert.equal(field(-3,2),null);assert.equal(calls,1);assert.deepEqual(runtime.bakeCapture().entries[0][1],[['-3,2,1500',null]]);delete globalThis.__ASFALTO_CAPTURE_BAKE__;
});
