const TIERS=Object.freeze(['high','balanced','low']);
const RING_SIZE=600,DOWNGRADE_SAMPLES=240,UPGRADE_SAMPLES=600,STATS_EVERY=30;
const HIGH_MAX=20,BALANCED_MAX=25;
const POLICIES=Object.freeze({
 high:Object.freeze({resolutionScale:1,shadows:true,vegetationLod:'high',mirrorHz:30,sectorPreloadRadius:2}),
 balanced:Object.freeze({resolutionScale:.86,shadows:true,vegetationLod:'balanced',mirrorHz:22,sectorPreloadRadius:1}),
 low:Object.freeze({resolutionScale:.7,shadows:false,vegetationLod:'low',mirrorHz:15,sectorPreloadRadius:0})
});
const checked=(v,field)=>{if(!Number.isFinite(v)||v<0)throw new TypeError(field+' must be a finite non-negative number');return v;};
function stats(values){const sorted=values.sort((a,b)=>a-b),p=q=>sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*q)-1)]:0;return {p50:p(.5),p95:p(.95),p99:p(.99),max:sorted.at(-1)||0,hitches:sorted.filter(n=>n>100).length};}
export function createTrackPerformanceGovernor({initialTier,onTierChange}){
 if(!TIERS.includes(initialTier))throw new RangeError('Invalid performance tier: '+initialTier);
 if(typeof onTierChange!=='function')throw new TypeError('Performance tier callback is required');
 const ring=new Float64Array(RING_SIZE),workRing=new Float64Array(RING_SIZE);
 let targetFps=60;
 let count=0,cursor=0,sinceTransition=0,currentTier=initialTier,transitions=0,phase='initial',transitionReason='initial',lastTransitionMs=0,slow=0,healthy=0,dirty=true;
 let resources=Object.freeze({heapBytes:0,gpuTextures:0,gpuGeometries:0}),frameStats=stats([]),workStats=stats([]);
 const values=(r,n=count)=>Array.from({length:Math.min(n,count)},(_,i)=>r[(cursor-1-i+RING_SIZE)%RING_SIZE]);
 const refresh=()=>{if(dirty){frameStats=stats(values(ring));workStats=stats(values(workRing));dirty=false;}};
 function snapshot(){return Object.freeze({tier:currentTier,targetFps,phase,p50FrameMs:frameStats.p50,p95FrameMs:frameStats.p95,p99FrameMs:frameStats.p99,maxFrameIntervalMs:frameStats.max,hitchesOver100Ms:frameStats.hitches,p50FrameWorkMs:workStats.p50,p95FrameWorkMs:workStats.p95,p99FrameWorkMs:workStats.p99,maxFrameWorkMs:workStats.max,samples:count,capacity:RING_SIZE,consecutiveSlow:slow,consecutiveHealthy:healthy,transitions,transitionReason,lastTransitionMs,renderPolicy:POLICIES[currentTier],resources,thresholds:Object.freeze({highMaxFrameMs:HIGH_MAX*60/targetFps,balancedMaxFrameMs:BALANCED_MAX*60/targetFps,downgradeSamples:DOWNGRADE_SAMPLES,upgradeSamples:UPGRADE_SAMPLES})});}
 function transition(next,reason){const previousTier=currentTier;currentTier=next;sinceTransition=0;slow=0;healthy=0;transitions++;transitionReason=reason;lastTransitionMs=Number(globalThis.performance?.now?.()??Date.now());onTierChange(Object.freeze({previousTier,tier:next,reason,renderPolicy:POLICIES[next],atMs:lastTransitionMs}));}
 function sample(input={}){
  const frameMs=checked(input.frameMs,'frameMs'),workMs=checked(input.frameWorkMs??frameMs,'frameWorkMs');
  const nextResources={heapBytes:checked(input.heapBytes,'heapBytes'),gpuTextures:checked(input.gpuTextures,'gpuTextures'),gpuGeometries:checked(input.gpuGeometries,'gpuGeometries')};
  targetFps=input.targetFps===30?30:60;const budgetScale=60/targetFps;
  resources=Object.freeze(nextResources);ring[cursor]=frameMs;workRing[cursor]=workMs;cursor=(cursor+1)%RING_SIZE;count=Math.min(RING_SIZE,count+1);sinceTransition++;dirty=true;
  const slowBoundary=currentTier==='high'?HIGH_MAX*budgetScale:currentTier==='balanced'?BALANCED_MAX*budgetScale:Infinity;
  const healthyBoundary=currentTier==='low'?22*budgetScale:currentTier==='balanced'?16.7*budgetScale:-Infinity;
  slow=frameMs>slowBoundary?slow+1:0;healthy=frameMs<=healthyBoundary?healthy+1:0;
  if(sinceTransition%STATS_EVERY===0){
   refresh();
   if(sinceTransition>=DOWNGRADE_SAMPLES&&count>=DOWNGRADE_SAMPLES){
    const recent=stats(values(ring,DOWNGRADE_SAMPLES));
    if(currentTier==='high'&&recent.p95>HIGH_MAX*budgetScale)transition('balanced','p95-above-target-budget');
    else if(currentTier==='balanced'&&recent.p95>BALANCED_MAX*budgetScale)transition('low','p95-above-balanced-budget');
    else if(sinceTransition>=UPGRADE_SAMPLES&&count>=UPGRADE_SAMPLES&&frameStats.p95<=healthyBoundary){
     if(currentTier==='low')transition('balanced','600-window-p95-at-22ms');
     else if(currentTier==='balanced')transition('high','600-window-p95-at-16.7ms');
    }
   }
  }
  return snapshot();
 }
 function diagnostics(){refresh();return snapshot();}
 function beginWindow(nextPhase='driving'){ring.fill(0);workRing.fill(0);count=0;cursor=0;sinceTransition=0;slow=0;healthy=0;phase=nextPhase;dirty=true;return diagnostics();}
 function reset(){currentTier=initialTier;transitions=0;transitionReason='reset';lastTransitionMs=0;resources=Object.freeze({heapBytes:0,gpuTextures:0,gpuGeometries:0});return beginWindow('reset');}
 return Object.freeze({sample,tier:()=>currentTier,reset,beginWindow,diagnostics});
}
export {POLICIES as TRACK_RENDER_POLICIES};
