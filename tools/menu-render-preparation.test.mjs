import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const moduleSource=readFileSync(new URL('../src/legacy/module-02.mjs?v=144a6369345e62c8',import.meta.url),'utf8');
const menuSource=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=e8db8317c8a85363',import.meta.url),'utf8');
const extract=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))).trim();
const renderSource=extract(moduleSource,'  function renderFrame() {','  function qualityPixelRatioLimit(');
const configureSource=extract(menuSource,'async function configureExistingGameReady(','function persistPlayableRoute(');
const prepareSource=extract(moduleSource,'  let renderingPreparation=','  function renderFrame() {');
const bindPrepare=scope=>new Function('scope',`with(scope){${prepareSource};return prepareRendering;}`)(scope);
const bind=(source,scope)=>new Function('scope',`with(scope){return (${source});}`)(scope);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function renderFixture(classes){
 const calls=[],scope={document:{body:{classList:{contains:name=>classes.includes(name)}}},raceCameraInitialized:true,updateRaceCamera:()=>calls.push('camera'),cockpitMirrors:{update:()=>calls.push('mirrors')},renderer:{},scene:{},camera:{position:{x:0,y:0,z:0}},raceWorld:{state:{},track:{sample:()=>({})},getRenderFrame:()=>({}),getPerformanceTier:()=> 'high',prepareFogRender:()=>()=>calls.push('fog-restored')},raceCameraState:{current:'cockpit'},authoredMirrors:null,performance:{now:()=>0},compositionEditor:null,radioController:null,globalThis:{__asfaltoV6Modular:{}},gameSettings:{graphicsQuality:'high'},trackStreamingError:null,advancedGraphics:{update:()=>calls.push('graphics')},graphicsSettings:{refresh(){}},rayTracing:{update(){}},rayTracingSettings:{refresh(){}},colorGrading:{render:callback=>callback()},cockpitRenderPass:{render:()=>calls.push('draw')}};
 return{calls,render:bind(renderSource,scope)};
}
for(const classes of [['v6-menu-open'],['an-intro-open'],['v6-menu-open','an-intro-open']])test(`no world/mirror/render work behind ${classes.join('+')}`,()=>{const f=renderFixture(classes);f.render();assert.deepEqual(f.calls,[]);});
test('driving still renders when menu and introduction are closed',()=>{const f=renderFixture([]);f.render();assert.deepEqual(f.calls,['mirrors','graphics','draw','fog-restored']);});
function configureFixture(){
 const calls=[],ready=deferred(),selected=deferred(),compiled=deferred(),workshop={};
 const cockpit={raceGetState:()=>({track:{id:'old'}}),raceSelectCircuit:async()=>{calls.push('track');},raceSetSettings:async()=>{calls.push('settings');},prepareRendering:()=>{calls.push('prepare');return compiled.promise;}};
 const scope={profile:{lastSky:'clear'},workshop,waitForExistingGameReady:()=>{calls.push('ready-wait');return ready.promise;},persistedTrack:x=>x,normalizeTrack:x=>x,reflectValue:()=>{},setValue:()=>calls.push('ui'),clamp:x=>x,toast:()=>calls.push('error')};
 return{calls,ready,selected,compiled,workshop,cockpit,configure:bind(configureSource,scope),options:{track:'dos_lagos',weather:'clear',mode:'practice',laps:1,difficulty:'normal'}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('restoration initiated at ready is awaited before track/settings and compile completion gates success',async()=>{
 const f=configureFixture(),p=f.configure(f.options);assert.deepEqual(f.calls,['ready-wait']);
 f.workshop.vehicleSelector={diagnostics:()=>({pending:true}),whenSettled:()=>{f.calls.push('selection-wait');return f.selected.promise;}};f.ready.resolve(f.cockpit);await tick();assert.deepEqual(f.calls,['ready-wait','selection-wait']);
 f.selected.resolve(true);await tick();assert.deepEqual(f.calls,['ready-wait','selection-wait','track','settings','ui','ui','ui','prepare']);let done=false;p.then(()=>done=true);await tick();assert.equal(done,false);f.compiled.resolve();assert.equal(await p,true);
});
test('failed restored selection prevents configuration and shader preparation',async()=>{const f=configureFixture();f.workshop.vehicleSelector={diagnostics:()=>({pending:true}),whenSettled:()=>Promise.resolve(false)};const p=f.configure(f.options);f.ready.resolve(f.cockpit);assert.equal(await p,false);assert.deepEqual(f.calls,['ready-wait','error']);});
test('preparation failure cannot report configuration success',async()=>{const f=configureFixture(),p=f.configure(f.options);f.ready.resolve(f.cockpit);await tick();f.compiled.reject(Error('compile failed'));await assert.rejects(p,/compile failed/);});
test('selected rendering prepares camera/material state before compiling and rechecks host after await',async()=>{
 const calls=[],gate=deferred();let shutdown=false;const fn=bindPrepare({modularHostInitialization:{assertActive(){calls.push('active');if(shutdown)throw Error('shutdown');},waitFor(p,label){calls.push(label);return p;}},applyMechanicalVisuals:()=>calls.push('mechanical'),updateRaceCamera:dt=>calls.push(['camera',dt]),advancedGraphics:{update:()=>calls.push('graphics')},performance:{now:()=>10},cockpitRenderPass:{prepare:()=>{calls.push('compile');return gate.promise;}}});
 const p=fn();await tick();assert.deepEqual(calls,['active','mechanical',['camera',0],'graphics','compile','selected-vehicle-shader-preparation']);shutdown=true;gate.resolve();await assert.rejects(p,/shutdown/);assert.equal(calls.at(-1),'active');
});
const startDriveSource=extract(menuSource,'async function startDrive(mode){','async function startRoadTest(');
test('drive menu stays open until selected vehicle compilation settles',async()=>{
 const f=configureFixture(),events=[],scope={profile:{},saveProfile(){},q:selector=>({value:selector.includes('weather')?'clear':'dos_lagos',classList:{add(){}}}),configureExistingGame:f.configure,persistPlayableRoute:x=>x,applyVehicleConfig(){},resetSession(){},activeSession:{},performance:{now:()=>0},closeMenu:()=>events.push('close-menu'),updateObjective(){},startExistingGame:()=>events.push('start-race'),toast(){},sessionLoop:{start(){}}};
 const start=bind(startDriveSource,scope),p=start('free');f.ready.resolve(f.cockpit);await tick();assert.deepEqual(events,[]);assert.equal(f.calls.at(-1),'prepare');f.compiled.resolve();assert.equal(await p,true);assert.deepEqual(events,['close-menu','start-race']);
});
test('shader preparations serialize shared programs and recover after failure',async()=>{
 const gates=[],fn=bindPrepare({modularHostInitialization:{assertActive(){},waitFor:p=>p},applyMechanicalVisuals(){},updateRaceCamera(){},advancedGraphics:{update(){}},performance:{now:()=>0},cockpitRenderPass:{prepare(){const gate=deferred();gates.push(gate);return gate.promise;}}});
 const first=fn(),second=fn();await tick();assert.equal(gates.length,1);const failed=assert.rejects(first,/compile failed/);gates[0].reject(Error('compile failed'));await failed;await tick();assert.equal(gates.length,2);gates[1].resolve();await second;
});
test('launch guard rejects overlapping launch and releases after success or failure',async()=>{
 const block=extract(menuSource,'let gameLaunchPreparing=false;','async function prepareExistingGame('),gates=[];
 const configure=new Function('prepareExistingGame',`${block};return configureExistingGame;`)(()=>{const gate=deferred();gates.push(gate);return gate.promise;});
 const first=configure({});assert.equal(await configure({}),false);assert.equal(gates.length,1);gates[0].resolve(true);assert.equal(await first,true);
 const second=configure({});assert.equal(gates.length,2);const rejected=assert.rejects(second,/failed/);gates[1].reject(Error('failed'));await rejected;
 const third=configure({});assert.equal(gates.length,3);gates[2].resolve(true);assert.equal(await third,true);
});
