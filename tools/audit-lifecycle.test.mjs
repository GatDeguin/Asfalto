import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStartupDemand} from '../src/runtime/startup-demand.mjs';
import {createTrackManager} from '../src/tracks/track-manager.mjs';
import {createSessionTransactionRunner} from '../src/menu/v7-session-runtime.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function adapter(id,load=async()=>{}){
 const a={id,ready:false,validate:async()=>true,load:async options=>{await load(options);a.ready=true;},unloads:0,unload:async()=>{a.unloads++;a.ready=false;}};
 for(const name of ['sampleRoute','projectToRoute','surfaceAt','resolveRespawn','getSpawn','getCheckpoints','updateStreaming','applyEnvironment','getDiagnostics'])a[name]=()=>({});
 return a;
}
function manager(factory){return createTrackManager({registry:{schema:'asfalto-track-registry/v1',tracks:['a','b','c'].map(id=>({id,status:'ready',manifest:`./${id}.json`}))},createAdapter:factory});}

test('A1 startup timeout rejects uncooperative data preparation and ignores its late result',async()=>{
 const gate=createStartupDemand({prepareTimeoutMs:15}),stalled=deferred();let calls=0,signal;
 const runtime=gate.run(options=>{signal=options.signal;return ++calls===1?stalled.promise:Promise.resolve('fresh');});
 const result=gate.request().then(()=> 'success',e=>e.name);
 assert.equal(await Promise.race([result,delay(80).then(()=> 'still-pending')]),'TimeoutError');
 assert.equal(signal.aborted,true);assert.equal(gate.diagnostics().phase,'failed');
 await gate.request();assert.equal(await runtime,'fresh');stalled.resolve('stale');await tick();
 assert.equal(gate.diagnostics().phase,'prepared');assert.equal(calls,2);
});
test('A1 cancellation reaches track transport, releases caller promptly and never activates late candidate',async()=>{
 const stalled=deferred();let transport;const a=adapter('a'),b=adapter('b',({signal})=>{transport=signal;return stalled.promise;}),c=adapter('c');
 const m=manager(id=>({a,b,c})[id]);await m.select('a');const controller=new AbortController();
 const pending=m.select('b',{signal:controller.signal}).then(()=> 'success',e=>e.name);await tick();controller.abort();
 assert.equal(await Promise.race([pending,delay(50).then(()=> 'still-pending')]),'AbortError');
 assert.equal(transport.aborted,true);assert.equal(m.active,a);
 await m.select('c');stalled.resolve();await tick();await tick();
 assert.equal(m.active,c);assert.equal(b.unloads,1);assert.equal(a.unloads,1);await m.unload();
});
test('A1 canceled session closes presentation before uncooperative stage resolves',async()=>{
 const stalled=deferred();let actions,ends=0,cancels=0,lateStages=0;
 const runner=createSessionTransactionRunner({begin:a=>(actions=a,{end(){ends++;},stage(){lateStages++;},fail(){}}),onCancel(){cancels++;}});
 const result=runner.run(async t=>{await stalled.promise;t.stage('stale');return true;});await tick();actions.cancel();
 assert.equal(await Promise.race([result,delay(50).then(()=> 'still-pending')]),false);
 assert.equal(ends,1);assert.equal(cancels,1);assert.equal(runner.diagnostics().active,false);
 assert.equal(await runner.run(async()=>true),true);stalled.resolve();await tick();assert.equal(lateStages,0);
});
test('A1 pre-aborted track request cannot create or replace an adapter',async()=>{
 let created=0;const m=manager(id=>{created++;return adapter(id);});await m.select('a');const old=m.active,c=new AbortController();c.abort();
 await assert.rejects(m.select('a',{signal:c.signal}),{name:'AbortError'});assert.equal(m.active,old);assert.equal(created,1);await m.unload();
});
test('A1 active host propagates selection signal across facade and manager boundaries',()=>{
 const host=fs.readFileSync(new URL('../src/legacy/module-02.mjs',import.meta.url),'utf8');
 const facade=fs.readFileSync(new URL('../src/app/modular-bootstrap.mjs',import.meta.url),'utf8');
 assert.match(host,/candidate\s*=\s*await facade\.selectTrack\(id,\s*\{signal\}\)/);
 assert.match(facade,/manager\.select\(id,\s*\{signal\}\)/);
});
test('A1 an immediate new request after cancel is not rejected by the previous attempt',async()=>{
 const gate=createStartupDemand({prepareTimeoutMs:1000});let attempts=0;const c=new AbortController();const running=gate.run(()=>++attempts===1?new Promise(()=>{}):Promise.resolve('new'));
 const first=gate.request({signal:c.signal}).catch(e=>e.name);await tick();c.abort();const next=gate.request();assert.equal(await first,'AbortError');await next;assert.equal(await running,'new');assert.equal(attempts,2);
});
