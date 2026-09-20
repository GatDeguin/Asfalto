import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/legacy/module-02.mjs?v=8265befc1ac24281',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  let rivalVisualPromise=null;'),source.indexOf('  raceChevyPresentation=await',source.indexOf('  let rivalVisualPromise=null;')));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function fixture({decode,convert,present}={}){
 const stats={decode:0,convert:0,present:0,rig:0,installed:0,disposed:[],shutdown:false};
 const globalThis={AsfaltoV5PayloadCore:{async decodePayloadById(){stats.decode++;return decode?decode():new Uint8Array();}},AsfaltoV5GlbCore:{async completeGlbToObject(){stats.convert++;return convert?convert():{name:'source'};}},AsfaltoV6Falcon:{createFalconVisualRig(){stats.rig++;return{root:{name:'rig'}};}}};
 const window={__asfaltoVehiclePresentations:{chevy:{},falcon:null}};
 const modularHostInitialization={signal:new AbortController().signal,assertActive(){if(stats.shutdown)throw Error('shutdown');}};
 const ensure=new Function('globalThis','window','document','modularHostInitialization','createVehiclePresentation','raceWorld','disposeTrackObjectRoot',`const THREE={},gunzipBase64=()=>{},trackGlbHelpers={},scene={},lightingEditor=null,modularRuntimeShutdown=null;${block};return ensureRivalVisual;`)(globalThis,window,{getElementById:()=>({textContent:'{}'})},modularHostInitialization,async()=>{stats.present++;return present?present():{dispose(){stats.disposed.push('presentation');}};},{setFalconVisualRig(){stats.installed++;},setFalconPresentation(){}},root=>{if(root)stats.disposed.push(root.name);});
 return{ensure,stats,window};
}
test('Falcon stays unloaded until requested, concurrent races and restarts reuse it',async()=>{
 const gate=deferred(),f=fixture({decode:()=>gate.promise});assert.equal(f.stats.decode,0);const a=f.ensure(),b=f.ensure();assert.equal(f.stats.decode,1);gate.resolve(new Uint8Array());assert.equal(await a,await b);await f.ensure();assert.equal(f.stats.convert,1);assert.equal(f.stats.present,1);assert.equal(f.stats.installed,1);assert.ok(f.window.__asfaltoVehiclePresentations.falcon);
});
test('failed rival preparation cleans partial resources and can retry',async()=>{
 let attempts=0;const f=fixture({present:async()=>{if(++attempts===1)throw Error('load failed');return{dispose(){}};}});await assert.rejects(f.ensure(),/load failed/);assert.deepEqual(f.stats.disposed,['rig','source']);await f.ensure();assert.equal(f.stats.installed,1);assert.equal(f.stats.decode,2);
});
test('shutdown during conversion disposes late model and never installs rival',async()=>{
 const gate=deferred(),started=deferred(),f=fixture({convert:()=>{started.resolve();return gate.promise;}});const p=f.ensure();await started.promise;f.stats.shutdown=true;gate.resolve({name:'late-source'});await assert.rejects(p,/shutdown/);assert.equal(f.stats.present,0);assert.equal(f.stats.installed,0);assert.deepEqual(f.stats.disposed,['late-source']);
});
test('shutdown during presentation disposes late presentation and roots',async()=>{
 const gate=deferred(),started=deferred(),f=fixture({present:()=>{started.resolve();return gate.promise;}});const p=f.ensure();await started.promise;f.stats.shutdown=true;gate.resolve({dispose(){f.stats.disposed.push('late-presentation');}});await assert.rejects(p,/shutdown/);assert.equal(f.stats.installed,0);assert.deepEqual(f.stats.disposed,['late-presentation','rig','source']);
});
const startBlock=source.slice(source.indexOf('  async function start({signal,onStage='),source.indexOf('  function pause(',source.indexOf('  async function start({signal,onStage=')));
function raceStart(mode,ensure){return new Function('ui','options',`const withRacePreparation=fn=>fn(),prepareRaceStart=opts=>opts.environment();const environmentHostDisposed=false;const releaseRaceDayCycle=()=>{},raceWeatherEffects={reset(){}},syncEnvironment=()=>{throw Error('environment reached');};${startBlock};return start;`)({mode:{value:mode}},{ensureRivalVisual:ensure});}
test('free drive bypasses rival; competition waits; cancellation cannot start race',async()=>{
 let loads=0;await assert.rejects(raceStart('free',()=>{loads++;})(),/environment reached/);assert.equal(loads,0);
 const gate=deferred(),controller=new AbortController();const p=raceStart('race',()=>{loads++;return gate.promise;})({signal:controller.signal});assert.equal(loads,1);controller.abort();gate.resolve();await assert.rejects(p,{name:'AbortError'});
 await assert.rejects(raceStart('race',async()=>{loads++;})(),/environment reached/);assert.equal(loads,2);
});
