import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/legacy/module-02.mjs?v=7b1c4280bdcfebc6',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  function createRaceAudio() {'),source.indexOf('  const raceAudio = createRaceAudio();'));
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}};
function setup({shared=Promise.resolve(true),prepared=Promise.resolve({drivingBuffers:[]})}={}){
 let nodes=0,disconnected=0,preparations=0,signal;const context={state:'running',destination:{},createGain(){nodes++;return{gain:{value:0},connect(){},disconnect(){disconnected++;}}},resume:async()=>{}};
 const createBus=()=>({dispose(){},setActive(){}});
 const factory=new Function('ensureAudioStarted','getSharedAudioContext','getSharedAudioDestination','prepareSoundscapeBanks','createRaceSoundscape','createRaceDrivingAudio','THREE',body+'return createRaceAudio();');
 const audio=factory(()=>shared,()=>context,()=>context.destination,(c,options)=>{preparations++;signal=options?.signal;return prepared},createBus,createBus,{Vector3:class{}});
 return{audio,get nodes(){return nodes},get disconnected(){return disconnected},get preparations(){return preparations},get signal(){return signal}};
}
test('dispose while banks are pending aborts and never creates late audio nodes',async()=>{const pending=deferred(),s=setup({prepared:pending.promise}),start=s.audio.ensureStarted();await Promise.resolve();await s.audio.dispose();pending.resolve({drivingBuffers:[]});assert.equal(await start,false);assert.equal(s.nodes,1);assert.equal(s.disconnected,1);assert.equal(s.signal.aborted,true);assert.equal(await s.audio.ensureStarted(),false)});
test('dispose while shared context authorization is pending never starts a worker',async()=>{const pending=deferred(),s=setup({shared:pending.promise}),start=s.audio.ensureStarted();await s.audio.dispose();pending.resolve(true);assert.equal(await start,false);assert.equal(s.preparations,0);assert.equal(s.nodes,0)});
test('normal startup still creates its bus and coalesces concurrent calls',async()=>{const pending=deferred(),s=setup({prepared:pending.promise}),a=s.audio.ensureStarted(),b=s.audio.ensureStarted();assert.equal(a,b);await Promise.resolve();pending.resolve({drivingBuffers:[]});assert.equal(await a,true);assert.equal(s.nodes,1);await s.audio.dispose()});

test("worker abort rejection after disposal resolves startup as false",async()=>{const pending=deferred(),s=setup({prepared:pending.promise}),start=s.audio.ensureStarted();await Promise.resolve();await s.audio.dispose();pending.reject(new DOMException("Aborted","AbortError"));assert.equal(await start,false);assert.equal(s.nodes,1);assert.equal(s.disconnected,1)});
