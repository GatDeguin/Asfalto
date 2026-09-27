import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackPerformanceGovernor} from '../src/performance/track-performance-governor.mjs?v=c2943f0c1c9be48f';
function setup(initialTier='low',targetFps=60){
 const changes=[]; const governor=createTrackPerformanceGovernor({initialTier,onTierChange:event=>changes.push(event)});
 const frame=(frameMs,extra={})=>governor.sample({frameMs,frameWorkMs:frameMs,heapBytes:0,gpuTextures:0,gpuGeometries:0,targetFps,...extra});
 const feed=(ms,n)=>{for(let i=0;i<n;i++)frame(ms);};
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
