import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceSoundscape} from '../src/audio/race-soundscape.mjs?v=1bbc92775a48417b';
import {createRaceDrivingAudio} from '../src/audio/race-driving-audio.mjs?v=5ed1d32c8cc8fcf7';
import {sampleTrafficAudio} from '../src/audio/race-driving-state.mjs?v=51a660aeafa28587';
import {createRaceAcousticWorld} from '../src/audio/race-acoustic-world.mjs?v=a9d9ae943f0dbc4b';
import {installSharedInstanceWindow} from '../src/tracks/seam-copy-factory.mjs?v=998dbd3ed43b3655';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
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

function recordedDrivingAudio() {
 const c=context(),strikes=[];
 const createFilter=c.createBiquadFilter;
 c.createBiquadFilter=()=>{const filter=createFilter();strikes.push(filter);return filter;};
 const audio=createRaceDrivingAudio({context:c});
 strikes.length=0;
 return {c,audio,strikes};
}

test('plays the strongest fresh Rapier impact even when the last substep has no impact',()=>{
 const {c,audio,strikes}=recordedDrivingAudio();
 const snapshot={timeSeconds:3.025,impact:false,impacts:[
  {sequence:1,timeSeconds:3,impulseNs:2400,material:'metal',localPointM:[0,0,1]},
  {sequence:2,timeSeconds:3.008,impulseNs:500,material:'soil',localPointM:[0,0,-1]},
 ]};
 audio.update({snapshot});
 assert.equal(strikes.length,1);
 assert.ok(strikes[0].frequency.value>2000,'metal uses the bright impact voice');
 c.currentTime=.25;audio.update({snapshot:{...snapshot,timeSeconds:3.05}});
 assert.equal(strikes.length,1,'retained history is consumed only once');
 audio.dispose();
});

test('ignores absent, stale and muted impacts without replaying them on resume',()=>{
 const {audio,strikes}=recordedDrivingAudio();
 const snapshot={timeSeconds:3,impact:true,impacts:[]};
 audio.update({snapshot});
 snapshot.impacts=[{sequence:1,timeSeconds:2,impulseNs:2600,material:'stone'}];
 audio.update({snapshot});
 snapshot.impacts.push({sequence:2,timeSeconds:3,impulseNs:2000,material:'metal'});
 audio.update({snapshot,impactsGain:0});audio.update({snapshot});
 snapshot.impacts.push({sequence:3,timeSeconds:3,impulseNs:1200,material:'stone'});
 audio.update({snapshot,paused:true});audio.update({snapshot});
 assert.equal(strikes.length,0);
 snapshot.impacts.push({sequence:4,timeSeconds:3,impulseNs:900,material:'stone'});
 audio.update({snapshot});
 assert.equal(strikes.length,1,'fresh active impact can still play');
 assert.ok(strikes[0].frequency.value<1500,'stone uses a duller impact voice');
 audio.dispose();
});

test('a physical scrape controls a separate continuous layer and obeys impact volume',()=>{
 const {audio,strikes}=recordedDrivingAudio();
 const snapshot={timeSeconds:3,scrapeContact:{timeSeconds:3,material:'metal',normalForceN:4500,tangentialSpeedMps:12,localSideM:1}};
 audio.update({snapshot});
 assert.ok(audio.diagnostics().targets.scrape>0);
 assert.equal(strikes.length,0,'scraping does not spawn strikes');
 audio.update({snapshot,impactsGain:0});
 assert.equal(audio.diagnostics().targets.scrape,0);
 audio.update({snapshot:{timeSeconds:3.15}});
 assert.equal(audio.diagnostics().targets.scrape,0);
 audio.dispose();
});

test('traffic audio follows position, relative speed and model for both kinds of pass',()=>{
  const car={id:4,kind:'passing',model:'belair_1957',speedMps:31,currentSpeedMps:24};
  const pose={car,position:[-24,0,-3],velocity:[24,0,0]};
  const listening=(x=0,velocity=14)=>sampleTrafficAudio([pose],{x,y:0,z:0},[velocity,0,0],{x:0,y:0,z:1},[]);
  const mixing=createRaceDrivingAudio({context:context()});
  mixing.update({traffic:listening()});
  const approaching=mixing.diagnostics().nearbyVehicles[0];
  assert.equal(approaching.id,'traffic:4');
  assert.equal(approaching.model,'belair_1957');
  assert.equal(approaching.engineOrder,4);
  assert.ok(approaching.pan<0&&approaching.pitchScale>1&&approaching.level>0);
  pose.position[0]=24;
  mixing.update({traffic:listening()});
  assert.ok(mixing.diagnostics().nearbyVehicles[0].pitchScale<1,'the car receding ahead drops pitch');

  Object.assign(car,{kind:'regular',model:'chevy',speedMps:12,currentSpeedMps:12});
  pose.velocity[0]=12;pose.position[2]=3;
  mixing.update({traffic:listening(0,22)});
  const catching=mixing.diagnostics().nearbyVehicles[0];
  assert.equal(catching.engineOrder,3);
  assert.ok(catching.pan>0&&catching.pitchScale>1);
  mixing.update({traffic:listening(48,22)});
  assert.ok(mixing.diagnostics().nearbyVehicles[0].pitchScale<1,'the passed car receding behind drops pitch');

  car.kind='parked';
  mixing.update({traffic:listening()});
  assert.deepEqual(mixing.diagnostics().nearbyVehicles,[]);
  mixing.dispose();
});

test('forest acoustics use authored instances even when the previous camera culled the canopy',()=>{
 const root=new T.Group();
 const geometry=new T.BoxGeometry(1,1,1), material=new T.MeshBasicMaterial({name:'MAT_leaf'});
 const tree=new T.InstancedMesh(geometry,material,2);
 tree.setMatrixAt(0,new T.Matrix4().makeTranslation(10,0,0));
 tree.setMatrixAt(1,new T.Matrix4().makeTranslation(270,0,0));
 installSharedInstanceWindow(T,tree,{rangeM:26});root.add(tree);
 const camera=new T.PerspectiveCamera();camera.position.set(1000,0,0);
 tree.onBeforeRender(null,root,camera);
 assert.equal(tree.count,0);
 const acoustics=createRaceAcousticWorld(T);
 acoustics.bind(root,'paso_garibaldi');
 assert.equal(acoustics.diagnostics().canopyEmitters,2);
 const listener=new T.Vector3();
 const ahead=acoustics.sample(listener,new T.Vector3(1,0,0)).forest;
 const behind=acoustics.sample(listener,new T.Vector3(-1,0,0)).forest;
 assert.equal(ahead.distanceM,10);assert.equal(ahead.pan,.8);assert.equal(behind.pan,-.8);
 acoustics.dispose();tree.dispose();geometry.dispose();material.dispose();
});

test('Iguazu dusk swaps from birds to insects gradually based on the day cycle',()=>{
 const audio=createRaceSoundscape({context:context()});
 const state={trackId:'cataratas_iguazu',forest:{proximity:1}};
 const levels=nightAmount=>{audio.update({...state,nightAmount});return audio.diagnostics().targets;};
 const day=levels(0),dusk=levels(.5),night=levels(1);
 assert.ok(day.birds>dusk.birds&&dusk.birds>night.birds);
 assert.ok(day.insects<dusk.insects&&dusk.insects<night.insects);
 audio.dispose();
});
