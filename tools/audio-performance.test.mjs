import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceSoundscape} from '../src/audio/race-soundscape.mjs?v=b3d0520149736731';
import {createRaceDrivingAudio} from '../src/audio/race-driving-audio.mjs?v=5dc564db7a89a5ef';
function context(sampleRate=1000){const c={sampleRate,currentTime:0,destination:{},allocations:0,events:0};const param=()=>({value:0,setTargetAtTime(){c.events++},cancelScheduledValues(){c.events++},setValueAtTime(){c.events++},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});const node=()=>({gain:param(),frequency:param(),Q:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){return this},disconnect(){},start(){},stop(){}});for(const name of ['Gain','BufferSource','BiquadFilter','StereoPanner','ChannelSplitter','DynamicsCompressor','Oscillator'])c['create'+name]=node;c.createBuffer=(n,l)=>{c.allocations++;const data=Array.from({length:n},()=>new Float32Array(l));return{getChannelData:i=>data[i],copyToChannel:(a,i)=>data[i].set(a)}};return c;}
test('thunder reuses prepared PCM and does not synthesize during racing',()=>{const c=context(),audio=createRaceSoundscape({context:c});audio.update();const before=c.allocations;assert.equal(audio.thunder(),true);assert.equal(c.allocations,before);audio.dispose()});
for(const [name,create] of [['ambient',createRaceSoundscape],['driving',createRaceDrivingAudio]])test(name+' avoids duplicate automation and inactive updates',()=>{const c=context(),audio=create({context:c});audio.update();const before=c.events;audio.update();assert.equal(c.events,before);audio.setActive(false);const stopped=c.events;audio.update({paused:true});assert.equal(c.events,stopped);audio.update();assert.ok(c.events>stopped);audio.dispose()});
export {context};
import {Worker} from 'node:worker_threads';
import {prepareSoundscapeBanks} from '../src/audio/prepare-soundscape-banks.mjs?v=1f384c94ad27b37c';
import {createSoundscapeBanks} from '../src/audio/soundscape-banks.mjs?v=ab85d85161d96bc7';
import {createSoundscapeBanks as previousBanks} from './fixtures/v7-soundscape-banks.mjs?v=79eb7dea53712cf0';
function nodeWorker(){
 const url=new URL('../src/audio/soundscape-banks-worker.mjs?v=17dd7930d2372e0b',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
 const adapter={terminate:()=>worker.terminate(),postMessage:data=>worker.postMessage(data)};
 worker.on('message',data=>adapter.onmessage?.({data}));worker.on('error',error=>adapter.onerror?.(error));return adapter;
}
test('preserves original four ambient PCM banks and full durations',()=>{
 const a=createSoundscapeBanks(context(1000)).build(),b=previousBanks(context(1000)).build();
 for(let i=0;i<4;i++)for(let ch=0;ch<(i===2?3:2);ch++)assert.deepEqual(a.buffers[i].getChannelData(ch),b.buffers[i].getChannelData(ch));
 assert.deepEqual(a.buffers.map(b=>b.getChannelData(0).length),[8000,11700,41300,14300,4600,4600,4600]);
});
test('worker returns complete banks, constructors allocate no PCM, and preparation cache is reusable',async()=>{
 const c=context(2000);let workers=0;const createWorker=()=>{workers++;return nodeWorker()};
 const prepared=await prepareSoundscapeBanks(c,{createWorker});assert.equal(prepared.buffers.length,7);assert.equal(prepared.drivingBuffers.length,2);
 const allocations=c.allocations;const ambient=createRaceSoundscape({context:c,prepared}),driving=createRaceDrivingAudio({context:c,prepared:prepared.drivingBuffers});assert.equal(c.allocations,allocations);
 assert.equal(await prepareSoundscapeBanks(c,{createWorker}),prepared);assert.equal(workers,1);ambient.dispose();driving.dispose();
});
test('preparation rejects cancellation without creating nodes or keeping worker alive',async()=>{
 const c=context(),controller=new AbortController();let terminated=0;
 const promise=prepareSoundscapeBanks(c,{signal:controller.signal,createWorker:()=>({postMessage(){},terminate(){terminated++}})});controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(terminated,1);assert.equal(c.allocations,0);
});
test('forest wind sends only its final mixed target on repeated telemetry',()=>{const c=context(),audio=createRaceSoundscape({context:c}),state={trackId:'cataratas_iguazu',forest:{proximity:1},windMps:5};audio.update(state);const before=c.events;audio.update(state);assert.equal(c.events,before);audio.dispose()});
