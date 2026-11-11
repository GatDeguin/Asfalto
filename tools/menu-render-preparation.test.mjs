import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {waitForSignal} from '../src/runtime/abortable.mjs?v=c91114c944607feb';import {createSessionTransactionRunner} from '../src/menu/v7-session-runtime.mjs?v=70b376bd29cce8c2';
const moduleSource=readFileSync(new URL('../src/legacy/module-02.mjs?v=e8c40ad860009021',import.meta.url),'utf8'),menuSource=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=bb5ec8193025aa90',import.meta.url),'utf8');
const extract=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start))).trim();
const bind=(source,scope)=>new Function('scope',`with(scope){return (${source});}`)(scope);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};const tick=()=>new Promise(r=>setImmediate(r));
test('continuous sky and weather blends do not invalidate the prepared image',()=>{
 const selection={skyId:'clear',weather:'clear'},live={...selection};
 const scope={
  raceWorld:{getPerformanceTier:()=> 'low',track:{id:'dos_lagos'},getDrivingLights:()=>({mode:'off'}),
   getAdvancedGraphicsEnvironment:()=>live,getRenderEnvironmentSelection:()=>selection},
  cockpit:{visible:true},camera:{layers:{mask:1}},readAdvancedGraphics:()=>({}),renderingSceneRevision:0,rayShaderRevision:0,cockpitRenderPass:null,renderer:{},
 };
 const variant=bind(extract(moduleSource,'  function renderPreparationVariant(','  async function prepareAuxiliaryRendering('),scope);
 const before=variant();live.skyId='overcast';live.weather='rain';
 assert.equal(variant(),before);
 scope.rayShaderRevision++;assert.notEqual(variant(),before);
 const withProbes=variant();selection.weather='rain';assert.notEqual(variant(),withProbes);
});
const prepareSource=extract(moduleSource,'  let renderingPreparation=','  gpuFrameTimer=createGpuFrameTimer');
const preparationScope={raceWorld:{getRenderEnvironmentSelection:()=>({}),getPerformanceTier:()=>'balanced',getDrivingLights:()=>({mode:'off'}),prepareHydrology:async()=>{},prepareWaterReflections:async()=>{},getRenderFrame:()=>({chassis:{position:[0,0,0]}})},cockpit:{visible:true},camera:{layers:{mask:1}},scene:{},renderer:{},compositionEditor:null,authoredMirrors:null,cockpitMirrors:{prepare:async()=>{}},readAdvancedGraphics:()=>({}),gpuFrameTimer:{beginWindow(){}},raceCameraState:{current:'cockpit'}};
const bindPrepare=given=>{const scope={...preparationScope,...given};return new Function('scope',`with(scope){${prepareSource};return prepareRendering;}`)(scope);};
for(const hidden of ['v6-menu-open','an-intro-open'])test('no world work behind '+hidden,()=>{const render=bind(extract(moduleSource,'  function renderFrame() {','  function qualityPixelRatioLimit('),{bootRenderGate:{allowed:()=>true},document:{body:{classList:{contains:s=>s===hidden}}},markFirstFrame(){throw Error('unseen frame prepared');}});render();});
function configuration(){const calls=[],selected=deferred(),compiled=deferred(),controller=new AbortController();let current=true,shaderSignal;const cockpit={raceGetState:()=>({track:{id:'old'}}),raceSelectCircuit:async()=>calls.push('track'),prepareRendering:({signal}={})=>{calls.push('compile');shaderSignal=signal;return compiled.promise;}};const scope={profile:{lastSky:'clear'},PLAYABLE_TRACK_IDS:new Set(['dos_lagos']),workshop:{raceVehicleSelection:{ensureApplied:()=>{calls.push('selection');return selected.promise;}}},waitForExistingGameReady:async(_timeout,{initialTrackId})=>{assert.equal(initialTrackId,'dos_lagos');return cockpit;},persistedTrack:x=>x,normalizeTrack:x=>x,reflectValue(){},setValue(){},clamp:x=>x,toast(){}};const fn=bind(extract(menuSource,'async function configureExistingGameReady(','function persistPlayableRoute('),scope),tx={signal:controller.signal,isCurrent:()=>current&&!controller.signal.aborted,wait:p=>waitForSignal(p,controller.signal),stage(){}};return{calls,selected,compiled,shaderSignal:()=>shaderSignal,cancel(){current=false;controller.abort();},run:options=>fn({track:'dos_lagos',weather:'clear',mode:'practice',laps:1,difficulty:'normal'},tx,options)};}
test('selection and shaders must settle before race configuration can succeed',async()=>{const f=configuration();let done=false;const p=f.run().then(x=>{done=true;return x});await tick();assert.deepEqual(f.calls,['selection']);f.selected.resolve();await tick();assert.deepEqual(f.calls,['selection','track','compile']);assert.equal(done,false);f.compiled.resolve();assert.equal(await p,true);});
test('failed selected car cannot configure route or compile',async()=>{const f=configuration(),p=f.run();const rejected=assert.rejects(p,/vehicle failed/);f.selected.reject(Error('vehicle failed'));await rejected;assert.deepEqual(f.calls,['selection']);});
test('shader failure never reports ready',async()=>{const f=configuration(),p=f.run();f.selected.resolve();await tick();const rejected=assert.rejects(p,/compile failed/);f.compiled.reject(Error('compile failed'));await rejected;});
test('cancel during compile aborts immediately and never reports ready after late completion',async()=>{const f=configuration(),p=f.run();f.selected.resolve();await tick();const rejected=assert.rejects(p,{name:'AbortError'});f.cancel();await rejected;f.compiled.resolve();await tick();assert.equal(f.shaderSignal()?.aborted,true);});
test('drive configuration leaves shader preparation to race start when requested',async()=>{
 const f=configuration(),p=f.run({deferShaders:true});
 f.selected.resolve();await tick();
 assert.deepEqual(f.calls,['selection','track']);
 assert.equal(await p,true);
});
test('race opening holds loading until a new scene frame has actually rendered',async()=>{
 const owner=new AbortController(),departure=deferred(),firstFrame=deferred(),events=[];
 let frames=12,check;
 const scope={
  sessionPresentationOwner:{departure:departure.promise},
  window:{__cockpit:{prepareRacePresentation(){events.push('pose');},v7Presentation:{diagnostics:()=>({actualSceneFrames:frames})}}},
  startupDemandReady:Promise.resolve({waitForAnimationFrame:async(_signal,callback)=>callback?.(),
   waitForCondition(predicate,{signal}){assert.equal(signal,owner.signal);check=predicate;return firstFrame.promise;}}),
  closeMenu(){events.push('open');},q:()=>({classList:{add(){}}}),updateObjective(){}
 };
 const fn=bind(extract(menuSource,'async function openPreparedRace(','async function startDrive('),scope);
 let finished=false;
 const result=fn({signal:owner.signal,isCurrent:()=>!owner.signal.aborted,wait:promise=>promise,stage(){}}).then(value=>{finished=true;return value;});
 await tick();assert.deepEqual(events,[]);
 departure.resolve();await tick();
 assert.ok(events.includes('open'));assert.equal(finished,false);assert.equal(check(),false);
 frames++;
 assert.equal(check(),true);firstFrame.resolve();
 assert.equal(await result,true);
});
test('shader preparation serializes and checks shutdown after compile',async()=>{const gates=[],calls=[];let shutdown=false;const fn=bindPrepare({bootRenderGate:{release(){throw Error('Failed preparation cannot release render gate');}},modularHostInitialization:{assertActive(){if(shutdown)throw Error('shutdown');},waitFor:p=>p},applyMechanicalVisuals(){calls.push('mechanical');},updateRaceCamera(dt){assert.equal(dt,0);},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},cockpitRenderPass:{prepare(){const g=deferred();gates.push(g);return g.promise;}}});const a=fn(),b=fn();await tick();assert.equal(gates.length,1);const rejected=assert.rejects(a,/compile failed/);gates[0].reject(Error('compile failed'));await rejected;await tick();assert.equal(gates.length,2);shutdown=true;const stopped=assert.rejects(b,/shutdown/);gates[1].resolve();await stopped;assert.equal(calls.length,2);});
test('actual drive flow waits for configuration and race start before exposing the scene',async()=>{const configuration=deferred(),started=deferred(),events=[];let deferredShaders;const runner=createSessionTransactionRunner();const scope={canLeaveWorkshop:()=>true,leaveChampionship:async()=>{},cancelRoadTest(){},profile:{},saveProfile:async()=>{},q:()=>({value:'dos_lagos'}),getSessionRequestRunner:async()=>runner,workshop:{},configureExistingGameReady:(_settings,_tx,options)=>{deferredShaders=options?.deferShaders;return configuration.promise;},persistPlayableRoute:x=>x,applyVehicleConfig(){},resetSession(){},activeSession:{},performance:{now:()=>1},window:{__cockpit:{raceStart:()=>{events.push('race-start');return started.promise;}}},openPreparedRace:()=>{events.push('open');return true;},toast(){},sessionLoop:{start(){}}};const fn=bind(extract(menuSource,'async function startDrive(mode){','async function startRoadTest('),scope),p=fn('free');await tick();assert.deepEqual(events,[]);configuration.resolve(true);await tick();assert.deepEqual(events,['race-start']);started.resolve();assert.equal(await p,true);assert.deepEqual(events,['race-start','open']);assert.equal(deferredShaders,true);});
test('launch guard rejects overlapping preparations and releases on failure',async()=>{const gates=[],body=extract(menuSource,'let gameLaunchPreparing=false;','async function prepareExistingGame('),fn=new Function('prepareExistingGame',body+';return configureExistingGame;')(()=>{const g=deferred();gates.push(g);return g.promise;});const p=fn({});assert.equal(await fn({}),false);gates[0].resolve(true);assert.equal(await p,true);const q=fn({}),rejected=assert.rejects(q,/failure/);gates[1].reject(Error('failure'));await rejected;const z=fn({});gates[2].resolve(true);assert.equal(await z,true);});

test('phone render gate opens only after selected shaders complete successfully',async()=>{const compiled=deferred();let released=false;const prepare=bindPrepare({bootRenderGate:{release(){released=true;}},modularHostInitialization:{assertActive(){},waitFor:p=>p},applyMechanicalVisuals(){},updateRaceCamera(){},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},cockpitRenderPass:{prepare:()=>compiled.promise}});const p=prepare();await tick();assert.equal(released,false);compiled.resolve();await p;assert.equal(released,true);});
test('the first selected cockpit waits for the shader variant visible after camera setup',async()=>{
 const cockpit={visible:true};let released=false,compiledVisibility;
 const prepare=bindPrepare({cockpit,bootRenderGate:{release(){released=true;}},
  modularHostInitialization:{assertActive(){},waitFor:promise=>promise},applyMechanicalVisuals(){},
  updateRaceCamera(){cockpit.visible=false;},advancedGraphics:{update(){}},performance:{now:()=>0},
  cockpitRenderPass:{async prepare(){compiledVisibility=cockpit.visible;}}});
 await prepare();
 assert.equal(compiledVisibility,false);
 assert.equal(released,true);
});
test('a primary render variant replaced during shader compilation waits for its successor',async()=>{
 let sky='clear',released=false;const first=deferred(),second=deferred(),compiled=[];
 const prepare=bindPrepare({bootRenderGate:{release(){released=true;}},
  modularHostInitialization:{assertActive(){},waitFor:promise=>promise},applyMechanicalVisuals(){},
  updateRaceCamera(){},advancedGraphics:{update(){}},performance:{now:()=>0},
  raceWorld:{...preparationScope.raceWorld,getRenderEnvironmentSelection:()=>({skyId:sky})},
  cockpitRenderPass:{prepare(){compiled.push(sky);return compiled.length===1?first.promise:second.promise;}}});
 const result=prepare();await tick();
 sky='night';first.resolve();await tick();
 assert.deepEqual(compiled,['clear','night']);assert.equal(released,false);
 second.resolve();await result;
 assert.equal(released,true);
});
test('primary readiness does not wait for secondary feeds; they prepare after world',async()=>{
 const water=deferred(),mirror=deferred(),events=[];let released=false;
 const scope={...preparationScope,raceWorld:{...preparationScope.raceWorld,prepareWaterReflections(){events.push('water');return water.promise;}},cockpitMirrors:{prepare(){events.push('mirrors');return mirror.promise;}},bootRenderGate:{release(){released=true;}},modularHostInitialization:{assertActive(){},waitFor:p=>p},applyMechanicalVisuals(){},updateRaceCamera(){},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},cockpitRenderPass:{prepare:async()=>events.push('world')}};
 const p=bindPrepare(scope)();await tick();assert.deepEqual(events,['world','water']);assert.equal(released,true);await p;water.resolve();await tick();assert.deepEqual(events,['world','water','mirrors']);assert.equal(released,true);mirror.resolve();await tick();
});
test('a replaced variant never starts old mirror preparation after pending water completes',async()=>{
 const water=deferred();let sky='clear',mirrors=0;
 const prepare=bindPrepare({raceWorld:{...preparationScope.raceWorld,getRenderEnvironmentSelection:()=>({skyId:sky}),prepareWaterReflections:()=>water.promise},cockpitMirrors:{prepare:async()=>mirrors++},bootRenderGate:{release(){}},modularHostInitialization:{assertActive(){},waitFor:p=>p},applyMechanicalVisuals(){},updateRaceCamera(){},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},cockpitRenderPass:{prepare:async()=>{}}});
 await prepare();sky='night';water.resolve();await tick();assert.equal(mirrors,0);
});

for(const abort of [false,true])test(`future quality restores current state during preparation and commits only when ready, abort=${abort}`,async()=>{
 let tier='high',commits=0,compiled=[];const gate=deferred(),controller=new AbortController();
 const scope={...preparationScope,modularHostInitialization:{signal:controller.signal,assertActive(){controller.signal.throwIfAborted();}},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},raceWorld:{...preparationScope.raceWorld,getPerformanceTier:()=>tier,withPerformanceTier(next,compile){const old=tier;try{tier=next;return compile();}finally{tier=old;}}},cockpitRenderPass:{async prepare({withState}){await withState(()=>{compiled.push(tier);return gate.promise;});await withState(()=>{compiled.push(tier);return Promise.resolve();});}}};
 const api=new Function('scope',`with(scope){${prepareSource};return {stagePerformanceTier,ready:()=>renderingPreparedVariant,pending:()=>renderingPreparation};}`)(scope);
 api.stagePerformanceTier({tier:'low'},beforeResize=>{tier='low';commits++;beforeResize?.();});await tick();assert.equal(tier,'high');assert.equal(commits,0);assert.deepEqual(compiled,['low']);
 if(abort)controller.abort();gate.resolve();await api.pending();assert.equal(commits,abort?0:1);assert.equal(tier,abort?'high':'low');if(!abort){assert.deepEqual(compiled,['low','low']);assert.match(api.ready(),/low/);}
});

test('ordinary preparation followed by a staged tier cannot strand the pending guard',async()=>{
 let tier='high';const gates=[],controller=new AbortController();
 const scope={...preparationScope,bootRenderGate:{release(){}},applyMechanicalVisuals(){},updateRaceCamera(){},modularHostInitialization:{signal:controller.signal,assertActive(){},waitFor:p=>p},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},raceWorld:{...preparationScope.raceWorld,getPerformanceTier:()=>tier,withPerformanceTier(next,compile){const old=tier;try{tier=next;return compile();}finally{tier=old;}}},cockpitRenderPass:{prepare(){const gate=deferred();gates.push(gate);return gate.promise;}}};
 const api=new Function('scope',`with(scope){${prepareSource};return {prepareRendering,stagePerformanceTier,pending:()=>renderingPreparation,busy:()=>renderingPending};}`)(scope);
 const first=api.prepareRendering();await tick();api.stagePerformanceTier({tier:'low'},before=>{tier='low';before?.();});gates.shift().resolve();await first;await tick();assert.equal(api.busy(),0);gates.shift().resolve();await api.pending();assert.equal(api.busy(),0);const next=api.prepareRendering();await tick();assert.equal(api.busy(),1);gates.shift().resolve();await next;assert.equal(api.busy(),0);
});

test('primary shaders await hydrology fields before becoming ready',async()=>{const fields=deferred();let compiled=false,released=false;const prepare=bindPrepare({raceWorld:{...preparationScope.raceWorld,prepareHydrology:()=>fields.promise},bootRenderGate:{release(){released=true;}},modularHostInitialization:{assertActive(){},waitFor:p=>p},applyMechanicalVisuals(){},updateRaceCamera(){},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},cockpitRenderPass:{prepare:async()=>{compiled=true;}}});const p=prepare();await tick();assert.equal(compiled,false);assert.equal(released,false);fields.resolve();await p;assert.equal(compiled,true);assert.equal(released,true);});

test('staged tier awaits hydrology and rejects stale field revisions before compiling',async()=>{let tier='high',commits=0,compiled=0,sky='clear';const fields=deferred(),controller=new AbortController();const scope={...preparationScope,modularHostInitialization:{signal:controller.signal,assertActive(){controller.signal.throwIfAborted();}},advancedGraphics:{update(){},syncPreparationQuality(){}},performance:{now:()=>0},raceWorld:{...preparationScope.raceWorld,getRenderEnvironmentSelection:()=>({skyId:sky}),getPerformanceTier:()=>tier,prepareHydrology:()=>fields.promise,withPerformanceTier(next,fn){const old=tier;try{tier=next;return fn();}finally{tier=old;}}},cockpitRenderPass:{prepare:async()=>{compiled++;}}};const api=new Function('scope',`with(scope){${prepareSource};return {stagePerformanceTier,pending:()=>renderingPreparation};}`)(scope);api.stagePerformanceTier({tier:'low'},before=>{tier='low';commits++;before?.();});await tick();assert.equal(compiled,0);assert.equal(commits,0);sky='night';fields.resolve();await api.pending();assert.equal(compiled,1);assert.equal(commits,1);});
