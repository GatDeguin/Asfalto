import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../src/performance/track-performance-governor.mjs?v=5c4adbaec0014be9';
const {createTrackPerformanceGovernor}=policy;
function setup(initialTier='low',targetFps=60,options={}){
 const changes=[]; const governor=createTrackPerformanceGovernor({initialTier,onTierChange:event=>changes.push(event),...options});
 const frame=(frameMs,extra={})=>governor.sample({frameMs,frameWorkMs:frameMs,heapBytes:0,gpuTextures:0,gpuGeometries:0,targetFps,...extra});
 const feed=(ms,n,extra)=>{for(let i=0;i<n;i++)frame(ms,extra);};
 return {governor,changes,frame,feed};
}
for(const [target,ms] of [[60,16],[30,32],[60,8]]) test('recovery requires thirty seconds of healthy windows at '+target+' FPS / '+ms+'ms',()=>{
 const {governor,feed}=setup('low',target);
 feed(ms,Math.ceil(29000/ms)); assert.equal(governor.tier(),'low');
 feed(ms,Math.ceil(15000/ms)+600); assert.equal(governor.tier(),'balanced');
});
test('failed tier stays blocked across measurement and preparation windows',()=>{
 const {governor,feed,frame}=setup('balanced');
 feed(30,240); assert.equal(governor.tier(),'low');
 governor.beginWindow('new-camera'); frame(1000,{preparing:true}); frame(1000);
 feed(16,3000); assert.equal(governor.tier(),'low');
 assert.ok(governor.diagnostics().upgradeRetryRemainingMs>0);
 feed(16,3000); assert.equal(governor.tier(),'balanced');
});
test('repeated brief improvements do not bounce low and balanced',()=>{
 const {governor,feed,changes}=setup('balanced'); feed(30,240);
 for(let i=0;i<4;i++){feed(16,1200);feed(30,240);}
 assert.equal(governor.tier(),'low');assert.deepEqual(changes.map(x=>x.tier),['low']);
});
test('emergency downgrade remains responsive',()=>{
 const {governor,feed}=setup('high');feed(200,8);
 assert.equal(governor.tier(),'balanced');assert.equal(governor.diagnostics().transitionReason,'sustained-severe-overload');
});
test('fixed quality records frames without silently lowering tier',()=>{
 const {governor,feed}=setup('low');governor.setAdaptive(false);
 assert.equal(governor.tier(),'high');feed(200,900);
 assert.equal(governor.tier(),'high');assert.equal(governor.diagnostics().adaptive,false);
 assert.equal(governor.diagnostics().samples,600);assert.equal(governor.diagnostics().p95FrameMs,200);
 governor.setAdaptive(true);feed(200,8);assert.equal(governor.tier(),'balanced');
});
test('target cadence change resets health evidence, not failed-tier cooldown',()=>{
 const {governor,feed,frame}=setup('balanced');feed(30,240);feed(16,2000);
 const before=governor.diagnostics().upgradeRetryRemainingMs;frame(32,{targetFps:30});
 const state=governor.diagnostics();assert.equal(state.recoveryHealthyMs,0);assert.ok(state.upgradeRetryRemainingMs>=before-33);
});
test('Auto starts at the conservative 60 FPS tier while explicit choices and 30 FPS retain their starting tiers',()=>{
 const select=(quality,targetFps,maximumTier='high',hardwareTier='high')=>policy.initialRacePerformanceTier({quality,targetFps,maximumTier,hardwareTier});
 assert.equal(select('auto',60),'low');
 assert.equal(select('auto',60,'balanced','balanced'),'low');
 assert.equal(select('auto',30),'high');
 assert.equal(select('auto',30,'balanced','balanced'),'balanced');
 assert.equal(select('high',60),'high');
 assert.equal(select('balanced',60,'balanced'),'balanced');
 assert.equal(select('eco',60,'low'),'low');
 assert.equal(select('auto',60,'cinematic'),'cinematic');
});
test('recovery waits for fresh GPU evidence and sustained headroom',()=>{
 let timing={samples:300,p95GpuMs:15};
 const {governor,feed}=setup('low',60,{canRecoverTier:(fps,frameMs,workMs)=>policy.hasRaceRecoveryHeadroom(timing,fps,frameMs,workMs)});
 const cpu={frameWorkMs:8};
 feed(16,3300,cpu);
 assert.equal(governor.tier(),'low');
 assert.equal(governor.diagnostics().recoveryHealthyMs,0);
 timing={samples:0,p95GpuMs:null};feed(16,3300,cpu);
 assert.equal(governor.tier(),'low');
 timing={samples:120,p95GpuMs:11};feed(16,1800,cpu);
 assert.equal(governor.tier(),'low');
 feed(16,100,cpu);
 assert.equal(governor.tier(),'balanced');
});
test('Auto recovery also requires a presentation cadence and CPU submission margin',()=>{
 const timing={samples:300,p95GpuMs:10};
 const {governor,feed}=setup('low',60,{canRecoverTier:(fps,frameMs,workMs)=>policy.hasRaceRecoveryHeadroom(timing,fps,frameMs,workMs)});
 feed(16.7,3300,{frameWorkMs:16});
 assert.equal(governor.tier(),'low');
 feed(20,3300,{frameWorkMs:7});
 assert.equal(governor.tier(),'low');
 feed(16.7,2700,{frameWorkMs:8});
 assert.equal(governor.tier(),'balanced');
});
