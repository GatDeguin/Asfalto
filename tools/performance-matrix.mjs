// Sequential, resumable real-GPU benchmark. One browser/GPU process only.
import os from 'node:os';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {startServer} from '../server.mjs?v=a0bf97c66f8e1a23';import {matrixCases,summarizeIntervals,validateRun,qualityTransitionWindows,benchmarkEnvironment} from './performance-matrix-core.mjs?v=470665282579cded';
import {withWatchdog} from './performance-matrix-watchdog.mjs?v=c378812c5ee5c044';
const app=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
const arg=(name,fallback)=>args.find(v=>v.startsWith(name+'='))?.slice(name.length+1)??fallback;
const smoke=args.includes('--smoke'),planOnly=args.includes('--plan-only'),limit=Number(arg('--limit','Infinity'));
const out=path.resolve(arg('--out',path.join(app,'../Reports/Asfalto_Nacional_v8/performance-stage2-2026-09-26/matrix')));
const cases=matrixCases({durationSeconds:Number(arg('--duration','60'))});
fs.mkdirSync(path.join(out,'cases'),{recursive:true});fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
function atomic(file,value){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}
function fingerprint(){const hash=createHash('sha256');const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else{hash.update(path.relative(app,p));hash.update(fs.readFileSync(p));}}};walk(path.join(app,'src'));for(const f of ['index.html','server.mjs','assets/tracks/offline-bake/manifest.json?v=3f7afb7702579a52','assets/manifests/release.json','tools/performance-matrix.mjs','tools/performance-matrix-core.mjs','tools/performance-matrix-watchdog.mjs'])hash.update(fs.readFileSync(path.join(app,f.split('?')[0])));return hash.digest('hex');}
const sourceHash=fingerprint(),plan={version:2,httpCache:true,sourceHash,smoke,viewport:[1600,900],deviceScaleFactor:1,targetFps:60,cases,method:'Combined track/car matrix. Paired high-fixed/adaptive environmental conditions, five repetitions with rotated clear day, clear night, rainy day and rainy night. Five starting sectors (0/20/40/60/80 percent of route), QA positioning before timing only. Real physics controlled at20Hz, four cameras in each run. First run per isolated context cold browser cache, later runs workshop reentry; native HTTP cache remains enabled and a repeated immutable resource verifies cache reuse. Camera samples begin 250 ms after each setter. Physics diagnostics reset at each measurement window. Five repetitions rotate environment and starting sector; they are coverage runs, not identical-condition replicas. Browser process and GPU persist between isolated contexts. Default authored geometry and all high effects. No CPU profiler. rAF includes hitches and shader work; presented-frame intervals and GPU timer reported separately.'};
const planPath=path.join(out,'plan.json');if(fs.existsSync(planPath)){const old=JSON.parse(fs.readFileSync(planPath));if(old.sourceHash!==sourceHash||old.smoke!==smoke||old.cases[0]?.durationSeconds!==cases[0].durationSeconds)throw Error('Output contains a different source or measurement plan; use a new --out directory.');}else atomic(planPath,plan);
if(planOnly){console.log(JSON.stringify({cases:cases.length,minimumDrivingHours:cases.length*cases[0].durationSeconds/3600,sourceHash,out}));process.exit(0);}
const lockPath=path.join(out,'running.lock');let lock;
try{lock=fs.openSync(lockPath,'wx');fs.writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));}catch{throw Error('Benchmark lock exists; confirm the recorded process has stopped before clearing it.');}
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/Gaston/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');const {chromium}=require('playwright');
let browser,server,context,page,activePair=null,runCount=0,activeReport=null;const state={startedAt:new Date().toISOString(),sourceHash,smoke,total:cases.length,completed:0,failed:0,current:null};
const statePath=path.join(out,'status.json');const resultPath=c=>path.join(out,'cases',c.id+'.json');
function phase(name,timeoutMs,work){return withWatchdog(name,timeoutMs,work,()=>withWatchdog('abort-'+name,5000,()=>context?.close(),()=>browser?.close()));}
function refreshStatus(){state.completed=0;state.failed=0;for(const c of cases){const p=resultPath(c);if(!fs.existsSync(p))continue;const r=JSON.parse(fs.readFileSync(p));if(r.status==='complete')state.completed++;else state.failed++;}state.updatedAt=new Date().toISOString();atomic(statePath,state);}
async function boot(c){
 await context?.close();context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(180000);
 page.on('pageerror',e=>activeReport?.errors.push(e.stack||e.message));page.on('response',r=>{if(r.status()>=400)activeReport?.httpErrors.push({url:r.url(),status:r.status()});});
 // The QA server has no cockpit data directory: its API already disables persistence.
 // Playwright routing would disable HTTP caching across the entire context.
 await page.addInitScript(({vehicleId})=>{localStorage.setItem('asfalto:v7:@migration-v1','complete');localStorage.setItem('asfalto:recovery:v8-v7:complete','complete');localStorage.setItem('asfalto:v7:asfalto:nacional:v6:selected-vehicle',vehicleId);localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6',JSON.stringify({graphicsQuality:'high',transmissionMode:'automatic'}));localStorage.setItem('asfalto:v7:asfalto-v6-advanced-graphics-v1',JSON.stringify({quality:'high'}));performance.setResourceTimingBufferSize(5000);window.__matrixLongTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__matrixLongTasks.push({at:e.startTime,ms:e.duration});}).observe({entryTypes:['longtask']});},c);
 const started=Date.now();await page.goto(server.url+'?qa=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.__chevyV6Complete?.initialized);await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__chevyV6Complete?.workshop?.loaded&&!globalThis.__chevyV6Complete.workshop.loading,null,{timeout:240000});
 return Date.now()-started;
}
async function verifyHttpCache(){return page.evaluate(async()=>{
 const candidate=performance.getEntriesByType('resource').filter(e=>new URL(e.name).origin===location.origin&&e.decodedBodySize>0&&!new URL(e.name).pathname.startsWith('/api/')).sort((a,b)=>a.decodedBodySize-b.decodedBodySize)[0];
 if(!candidate)return {verified:false,reason:'No same-origin resource available'};
 // Graph revision IDs need revalidation; the server only grants immutable caching
 // to an actual byte digest. Use a small, already loaded resource as the probe.
 const bytes=await (await fetch(candidate.name)).arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const url=new URL(candidate.name);url.searchParams.set('v',digest);
 const response=await fetch(url);await response.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,0));
 const cacheControl=response.headers.get('cache-control')||'',first=performance.getEntriesByName(url.href).at(-1);
 const repeated=await fetch(url);await repeated.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,0));
 const second=performance.getEntriesByName(url.href).at(-1),describe=e=>e?{startTime:e.startTime,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,durationMs:e.duration}:null;
 return {url:url.href,cacheControl,first:describe(first),repeated:describe(second),verified:cacheControl.includes('immutable')&&!!first&&!!second&&second.startTime>first.startTime&&second.transferSize===0&&second.decodedBodySize>0};
});}
async function measure(c){return page.evaluate(async({c,smoke})=>{
 const cockpit=window.__cockpit,world=cockpit.raceWorld,track=world.track;
 if(!Number.isFinite(cockpit.v7Presentation.diagnostics().actualSceneFrames))throw Error('Actual presented-frame counter is required');
 cockpit.v7BeginMeasurement();
 const initial=world.getState(),initialDiagnostics=world.getV6Diagnostics(),physicsWindowStart=initialDiagnostics.physicsPerformance;
 const durationMs=smoke?8000:c.durationSeconds*1000,start=performance.now();
 const rafIntervals=[],presentedIntervals=[],samples=[],cameras=[],statuses=new Set(),controllerCosts=[];
 let previous=start,lastPresentedFrame=cockpit.v7Presentation.diagnostics().actualSceneFrames,lastPresentedTime=start,lastControl=-Infinity,lastSample=-Infinity,lastCamera=-1,cameraChangedAt=-Infinity,maxLateral=0,maxSpeed=0,offroadMs=0,firstPresentationDelayMs=null,previousSurface=initial.surface;
 const longTaskStart=window.__matrixLongTasks.length;
 return await new Promise((resolve,reject)=>{
 function frame(){try{
  const now=performance.now();
  const dt=now-previous;rafIntervals.push(dt);previous=now;
  const cameraIndex=Math.min(3,Math.floor((now-start)/durationMs*4));if(cameraIndex!==lastCamera){lastCamera=cameraIndex;cameraChangedAt=now;cockpit.raceSetCamera(c.cameras[cameraIndex]);cameras.push(c.cameras[cameraIndex]);}
  if(now-lastControl>=50){const t=performance.now(),s=world.getState(),p=s.projection||s;statuses.add(s.status);const progress=p.raceProgress??s.raceProgress??0;
   const previews=[0,25,60,110].map(offset=>track.sample(progress+offset)),curvature=previews.reduce((sum,p,i)=>sum+(p.curvature||0)*[.46,.3,.17,.07][i],0),maxCurve=Math.max(.0005,...previews.map(p=>Math.abs(p.curvature||0)));
   const lateral=p.lateral||0,speed=Math.abs(p.speedAlongRouteMps??s.speedMps??0),heading=p.headingError||0;
   let target=Math.max(5,Math.min(12,Math.sqrt(.58*9.81/maxCurve),...previews.map(p=>(p.targetSpeedKph||90)/3.6*.84)));if(Math.abs(lateral)>1.6)target=Math.min(target,7);if(Math.abs(lateral)>2.6)target=Math.min(target,5);
   const error=target-speed,braking=error<-.5;cockpit.setControls({steer:Math.atan(2.819*curvature)-heading*1.4-lateral*.18-(p.lateralSpeedMps||0)*.035,throttle:braking?0:Math.min(1,Math.max(0,.36+error/7)),brake:braking?Math.min(1,.55-error/6):0});
   maxLateral=Math.max(maxLateral,Math.abs(lateral));maxSpeed=Math.max(maxSpeed,speed);previousSurface=s.surface;controllerCosts.push(performance.now()-t);lastControl=now;
  }
  if(!['asphalt','road','curb'].includes(previousSurface))offroadMs+=dt;
  const presentation=cockpit.v7Presentation.diagnostics();if(presentation.actualSceneFrames!==lastPresentedFrame){firstPresentationDelayMs??=presentation.actualSceneTimestampMs-start;presentedIntervals.push(presentation.actualSceneTimestampMs-lastPresentedTime);lastPresentedTime=presentation.actualSceneTimestampMs;lastPresentedFrame=presentation.actualSceneFrames;}
  if(now-lastSample>=1000&&now-cameraChangedAt>=250){const d=world.getPerformanceDiagnostics(),r=cockpit.v7RenderDiagnostics(),s=world.getState();samples.push({atMs:now-start,tier:world.getPerformanceTier(),requestedTier:d.tier,adaptive:d.adaptive,scale:world.getPerformanceScale(),trackId:world.track.id,vehicleId:window.__asfaltoSelectedPlayerVehicle,camera:cockpit.raceCameraMode(),skyId:world.getAdvancedGraphicsEnvironment().skyId,weather:world.getAdvancedGraphicsEnvironment().weather,drawingBuffer:r.drawingBuffer,frameBudget:r.frameBudget,preparation:r.preparation,gpu:r.gpu,render:r.render,resources:r.resources,progressM:s.raceProgress,speedMps:s.speedMps,lateral:s.lateral,surface:s.surface,transitions:d.transitions,transitionReason:d.transitionReason,preparing:world.isPreparing(),p95FrameWorkMs:d.p95FrameWorkMs,recoveryHealthyMs:d.recoveryHealthyMs,upgradeRetryRemainingMs:d.upgradeRetryRemainingMs});lastSample=now;}
  if(now-start<durationMs){requestAnimationFrame(frame);return;}
  cockpit.clearControls();const final=world.getState(),end=world.getV6Diagnostics();resolve({elapsedMs:now-start,firstPresentationDelayMs,unpresentedTailMs:Math.max(0,now-lastPresentedTime),rafIntervals,presentedIntervals,samples,cameras,statuses:[...statuses],progressM:final.raceProgress-initial.raceProgress,initialProgressM:initial.raceProgress,finalProgressM:final.raceProgress,maxLateralM:maxLateral,maxSpeedMps:maxSpeed,offroadMs,recoveries:(end.recovery?.recoveryCount||0)-(initialDiagnostics.recovery?.recoveryCount||0),controllerCostsMs:controllerCosts,longTasks:window.__matrixLongTasks.slice(longTaskStart).filter(task=>task.at>=start),physicsWindowStart,physics:end.physicsPerformance,finalStatus:final.status,renderHost:window.__asfaltoRenderHost?.diagnostics?.()||null});
 }catch(error){cockpit.clearControls();reject(error);}}
 requestAnimationFrame(frame);
 });
 },{c,smoke});}
try{
 server=await phase('server-start',30000,()=>startServer({root:app}));browser=await phase('browser-launch',120000,()=>chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']}));
 const environmentRecord=await phase('capture-environment',30000,async()=>{const cdp=await browser.newBrowserCDPSession();try{return {systemInfo:await cdp.send('SystemInfo.getInfo'),browserVersion:await cdp.send('Browser.getVersion')};}finally{await cdp.detach();}});
 const host={platform:os.platform(),arch:os.arch(),release:os.release(),cpuModels:os.cpus().map(cpu=>cpu.model),totalMemoryBytes:os.totalmem()};
 const environment=benchmarkEnvironment(environmentRecord.systemInfo,environmentRecord.browserVersion,host),environmentPath=path.join(out,'environment.json');
 const environmentCompatible=!fs.existsSync(environmentPath)||JSON.stringify(JSON.parse(fs.readFileSync(environmentPath)))===JSON.stringify(environment);
 state.segmentId=new Date().toISOString().replace(/[:.]/g,'-')+'__'+process.pid;
 fs.mkdirSync(path.join(out,'segments'),{recursive:true});atomic(path.join(out,'segments',state.segmentId+'.json'),{segmentId:state.segmentId,startedAt:state.startedAt,sourceHash,environmentCompatible,environment,...environmentRecord});
 if(!environmentCompatible)throw Error('Hardware, OS, GPU driver or browser changed since this matrix began; use a new --out directory.');
 if(!fs.existsSync(environmentPath))atomic(environmentPath,environment);
 if(!fs.existsSync(path.join(out,'hardware.json')))atomic(path.join(out,'hardware.json'),environmentRecord.systemInfo.gpu);
 refreshStatus();
 for(const c of cases){if(runCount>=limit)break;const file=resultPath(c);if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).status==='complete')continue;
  if(arg('--track','')&&c.trackId!==arg('--track',''))continue;if(arg('--vehicle','')&&c.vehicleId!==arg('--vehicle',''))continue;
  if(fingerprint()!==sourceHash)throw Error('Source changed during benchmark; stop to preserve comparability.');
  const r={case:c,sourceHash,segmentId:state.segmentId,smoke,startedAt:new Date().toISOString(),errors:[],httpErrors:[],timings:{}};activeReport=r;state.current=c.id;refreshStatus();console.log('START '+c.id);
  try{
   const pair=c.trackId+'__'+c.vehicleId;
   if(pair!==activePair||!page){r.timings.homeMs=await phase('boot-workshop',360000,()=>boot(c));activePair=pair;r.entry='cold';r.httpCache=await phase('verify-http-cache',30000,verifyHttpCache);if(!r.httpCache.verified)throw Error('Native HTTP cache verification failed: '+JSON.stringify(r.httpCache));}
   else{const start=Date.now();await phase('return-workshop',240000,async()=>{await page.evaluate(()=>__chevyV6Complete.openMenu('drive'));await page.waitForFunction(()=>__chevyV6Complete.workshop.loaded&&!__chevyV6Complete.workshop.loading);});r.timings.returnWorkshopMs=Date.now()-start;r.entry='reentry';}
   await phase('configure-drive-menu',30000,()=>page.evaluate(c=>{for(const [id,value] of [['v6-drive-route',c.trackId],['v6-drive-weather',c.weather],['v6-drive-sky',c.skyId]]){const el=document.getElementById(id);if(!el||![...el.options].some(o=>o.value===value))throw Error('Missing option '+id+':'+value);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}__asfaltoAdvancedGraphics.setMode('high');},c));
   let t=Date.now();await phase('enter-race',360000,async()=>{const success=await page.evaluate(()=>__chevyV6Complete.startDrive('free'));if(success===false)throw Error('startDrive rejected');await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='RUNNING',null,{timeout:240000});});r.timings.raceEntryMs=Date.now()-t;
   t=Date.now();await phase('prepare-measurement-policy',360000,()=>page.evaluate(async c=>{__cockpit.setSettings({graphicsQuality:'high',transmissionMode:'automatic'});__cockpit.v7Presentation.setTargetFps(60);await __cockpit.raceWorld.setDayCycleOptions({enabled:false},{persist:false});await __cockpit.raceSetSettings({skyId:c.skyId,weather:c.weather});__cockpit.debugSetPerformanceAdaptive(false);if(c.startFraction>0){__cockpit.raceWorld.debugTeleportPhysicalVehicle({raceProgressM:__cockpit.raceWorld.track.length*c.startFraction});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}await __cockpit.prepareRendering();},c));
   await phase('wait-high-quality',190000,()=>page.waitForFunction(()=>__cockpit.raceWorld.getPerformanceTier()==='high'&&!__cockpit.raceWorld.isPreparing(),null,{timeout:180000}));
   await phase('begin-driving',30000,()=>page.evaluate(c=>{if(c.policy==='adaptive')__cockpit.debugSetPerformanceAdaptive(true);__cockpit.raceSetCamera('cockpit');__cockpit.setGear(1);},c));r.timings.policyReadyMs=Date.now()-t;
   r.initial=await phase('initial-diagnostics',30000,()=>page.evaluate(()=>({vehicle:__asfaltoSelectedPlayerVehicle,track:__cockpit.raceWorld.track.id,host:window.__asfaltoRenderHost?.diagnostics?.()||null,hud:window.__chevyHud3D?.getDiagnostics?.().renderer||null,initialization:__asfaltoV6Modular.getDiagnostics(),bake:window.__asfaltoTrackBakeState?.stats||null})));
   r.measurement=await phase('drive-measurement',(smoke?8000:c.durationSeconds*1000)+45000,()=>measure(c));r.summary={raf:summarizeIntervals(r.measurement.rafIntervals),presented:summarizeIntervals(r.measurement.presentedIntervals),controller:summarizeIntervals(r.measurement.controllerCostsMs),qualityTransitions:qualityTransitionWindows(r.measurement.samples,r.measurement.elapsedMs)};r.summary.presented.meanFps=r.measurement.presentedIntervals.length*1000/r.measurement.elapsedMs;r.summary.presented.maxVisibleGapMs=Math.max(r.summary.presented.maxMs||0,r.measurement.unpresentedTailMs);delete r.summary.controller.meanFps;
   r.invalidReasons=validateRun(r,{smoke});r.status=r.invalidReasons.length?'invalid':'complete';
   await phase('capture-result',20000,()=>page.screenshot({path:path.join(out,'screenshots',c.id+'.png'),timeout:15000}));
  }catch(error){r.status='failed';r.failure=error.stack||error.message;r.failurePhase=error.phase||null;r.failureCode=error.code||null;try{await phase('capture-failure',12000,()=>page?.screenshot({path:path.join(out,'screenshots',c.id+'__failure.png'),timeout:10000}));}catch{}}
  finally{r.finishedAt=new Date().toISOString();atomic(file,r);runCount++;refreshStatus();console.log('RESULT '+JSON.stringify({id:c.id,status:r.status,entryMs:r.timings.raceEntryMs,p95Ms:r.summary?.presented.p95Ms,reasons:r.invalidReasons,failure:r.failure}));}
  if(r.status!=='complete')throw Error('Invalid measurement; stopped before collecting misleading subsequent runs: '+c.id);
 }
 state.current=null;state.status=state.completed===cases.length?'complete':'partial';refreshStatus();
}catch(error){state.status='failed';state.failure=error.stack||error.message;refreshStatus();console.error(error);process.exitCode=1;}
finally{for(const [name,close] of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server?.close()]]){try{await withWatchdog('close-'+name,10000,close);}catch(error){console.error(error.message);process.exitCode=1;}}fs.closeSync(lock);fs.unlinkSync(lockPath);}
