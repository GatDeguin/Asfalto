import {VEHICLE_CATALOG} from '../src/render/vehicle-catalog.mjs?v=1fb2dbf31facc389';
export const TRACK_IDS=['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu'];
export const ENVIRONMENTS=[{skyId:'clear',weather:'clear'},{skyId:'night',weather:'clear'},{skyId:'overcast',weather:'rain'},{skyId:'night',weather:'rain'},{skyId:'clear',weather:'clear'}];
export function matrixCases({durationSeconds=60}={}){
 if(!Number.isInteger(durationSeconds)||durationSeconds<60||durationSeconds>120)throw new RangeError('Duration must be 60–120 seconds');
 const cars=Object.values(VEHICLE_CATALOG).filter(v=>v.selectable).map(v=>v.id),cases=[];
 for(const [ti,trackId] of TRACK_IDS.entries())for(const [vi,vehicleId] of cars.entries())for(let repeat=1;repeat<=5;repeat++){
  const environment=ENVIRONMENTS[(ti*cars.length+vi+repeat-1)%ENVIRONMENTS.length];
  for(const policy of repeat%2?['high-fixed','adaptive']:['adaptive','high-fixed'])cases.push({id:[trackId,vehicleId,policy,repeat].join('__'),trackId,vehicleId,policy,repeat,startFraction:(repeat-1)*.2,...environment,durationSeconds,cameras:['cockpit','chase','hood','cinematic']});
 }
 return cases;
}
export function summarizeIntervals(values){
 const a=values.filter(Number.isFinite).sort((x,y)=>x-y);const p=q=>a.length?a[Math.max(0,Math.ceil(q*a.length)-1)]:null;
 return {count:a.length,p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),maxMs:a.at(-1)??null,hitchesOver50Ms:a.filter(x=>x>50).length,hitchesOver100Ms:a.filter(x=>x>100).length,meanFps:a.length?a.length*1000/a.reduce((x,y)=>x+y,0):null};
}
// Only stable device/runtime properties participate in resume comparability. Raw CDP
// output is retained per segment, but transient GPU process counters are excluded.
export function benchmarkEnvironment(systemInfo,browserVersion,host){
 const gpu=systemInfo.gpu||{},aux=gpu.auxAttributes||{};
 return JSON.parse(JSON.stringify({host,browser:{product:browserVersion.product,revision:browserVersion.revision,jsVersion:browserVersion.jsVersion},modelName:systemInfo.modelName,modelVersion:systemInfo.modelVersion,gpu:{devices:gpu.devices,glRenderer:aux.glRenderer,glVendor:aux.glVendor,glVersion:aux.glVersion,glImplementationParts:aux.glImplementationParts}}));
}
export function qualityTransitionWindows(samples,elapsedMs){
 const windows=[];let pending=null;
 const finish=(atMs,resolved)=>{if(!pending)return;windows.push({...pending,endMs:atMs,durationMs:Math.max(0,atMs-pending.startMs),resolved});pending=null;};
 for(const s of samples){
  if(!Number.isFinite(s.atMs))continue;
  if(s.requestedTier!==s.tier){pending??={startMs:s.atMs,visibleTier:s.tier,requestedTier:s.requestedTier,reason:s.transitionReason||null};pending.requestedTier=s.requestedTier;pending.reason=s.transitionReason||pending.reason;}
  else finish(s.atMs,true);
 }
 finish(elapsedMs,false);return windows;
}
export function validateRun(result,{smoke=false}={}){
 const reasons=[];if(result.errors?.length)reasons.push('page-errors');if(result.httpErrors?.length)reasons.push('http-errors');
 const m=result.measurement;if(!m)return [...reasons,'measurement-missing'];
 const expectedMs=smoke?8000:result.case.durationSeconds*1000;
 if(!Number.isFinite(m.elapsedMs))reasons.push('duration-invalid');else if(m.elapsedMs<expectedMs)reasons.push('duration-short');
 if(!Array.isArray(m.statuses)||!m.statuses.length||m.statuses.some(s=>s!=='RUNNING')||m.finalStatus!=='RUNNING')reasons.push('not-running');
 if(!Number.isFinite(m.progressM))reasons.push('progress-invalid');else if(m.progressM<(smoke?10:120))reasons.push('insufficient-physical-progress');
 if(m.recoveries!==0)reasons.push('vehicle-recovery');
 if(!Array.isArray(m.presentedIntervals)||m.presentedIntervals.length<10)reasons.push('insufficient-presented-frames');
 else if(m.presentedIntervals.some(t=>!Number.isFinite(t)||t<=0))reasons.push('presented-intervals-invalid');
 if(!m.physicsWindowStart||['frameCount','totalSubsteps','overruns'].some(k=>m.physicsWindowStart[k]!==0))reasons.push('physics-window-not-reset');
 if(!Number.isFinite(m.physics?.frameCount)||m.physics.frameCount<=0)reasons.push('physics-window-empty');
 const samples=Array.isArray(m.samples)?m.samples:[];
 if(!samples.length)return [...reasons,'samples-missing'];
 if(samples.some((s,i)=>!Number.isFinite(s.atMs)||s.atMs<0||s.atMs>m.elapsedMs||(i&&s.atMs<=samples[i-1].atMs)))reasons.push('sample-time-invalid');
 if(samples.some(s=>s.skyId!==result.case.skyId||s.weather!==result.case.weather))reasons.push('wrong-sky-or-weather');
 if(result.case.policy==='high-fixed'&&samples.some(s=>s.tier!=='high'||s.scale!==1||s.adaptive!==false))reasons.push('fixed-quality-drift');
 if(result.case.policy==='adaptive'&&samples.some(s=>s.adaptive!==true))reasons.push('adaptive-policy-disabled');
 if(samples.some(s=>s.trackId!==result.case.trackId||s.vehicleId!==result.case.vehicleId))reasons.push('wrong-track-or-vehicle');
 const segments=new Set();let cameraMismatch=false;
 for(const s of samples){const segment=Math.min(result.case.cameras.length-1,Math.floor(s.atMs/expectedMs*result.case.cameras.length));segments.add(segment);if(s.camera!==result.case.cameras[segment])cameraMismatch=true;}
 if(cameraMismatch||segments.size!==result.case.cameras.length)reasons.push('camera-coverage');
 if(samples.some(s=>!['low','balanced','high'].includes(s.tier)||!['low','balanced','high'].includes(s.requestedTier)))reasons.push('quality-tier-invalid');
 if(qualityTransitionWindows(samples,m.elapsedMs).some(w=>w.durationMs>30000))reasons.push('quality-transition-timeout');
 return reasons;
}
