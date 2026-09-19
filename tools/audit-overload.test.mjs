import test from 'node:test';import assert from 'node:assert/strict';
import {createTrackPerformanceGovernor} from '../src/performance/track-performance-governor.mjs';
const sample=(g,ms,targetFps=60)=>g.sample({frameMs:ms,frameWorkMs:1,heapBytes:0,gpuTextures:0,gpuGeometries:0,targetFps});
test('A3 severe sustained overload reduces each tier within two seconds, not 240 slow frames',()=>{
 const transitions=[];const g=createTrackPerformanceGovernor({initialTier:'cinematic',maximumTier:'cinematic',onTierChange:d=>transitions.push(d)});
 for(let i=0;i<20;i++)sample(g,100);assert.equal(g.tier(),'high');
 for(let i=0;i<20;i++)sample(g,100);assert.equal(g.tier(),'balanced');
 for(let i=0;i<20;i++)sample(g,100);assert.equal(g.tier(),'low');assert.equal(transitions.length,3);
 assert.ok(transitions.every(t=>t.reason==='sustained-severe-overload'));
});
test('A3 isolated stalls and hidden-tab-sized gaps do not trigger emergency degradation',()=>{
 const g=createTrackPerformanceGovernor({initialTier:'high',onTierChange(){}});
 for(let i=0;i<120;i++){sample(g,16.67);if(i%20===0)sample(g,400);}
 sample(g,10000);assert.equal(g.tier(),'high');
});
test('A3 emergency scales with 30 FPS and recovery still requires a full healthy window',()=>{
 const g=createTrackPerformanceGovernor({initialTier:'high',onTierChange(){}});
 for(let i=0;i<50;i++)sample(g,40,30);assert.equal(g.tier(),'high');
 for(let i=0;i<20;i++)sample(g,100,30);assert.equal(g.tier(),'balanced');
 for(let i=0;i<599;i++)sample(g,33,30);assert.equal(g.tier(),'balanced');
 sample(g,33,30);assert.equal(g.tier(),'high');
 for(let i=0;i<1200;i++)sample(g,16.6);assert.equal(g.tier(),'high');
});
test('A3 repeated multi-second visible frames still trigger emergency rather than being excluded as single gaps',()=>{
 const g=createTrackPerformanceGovernor({initialTier:'cinematic',maximumTier:'cinematic',onTierChange(){}});for(let i=0;i<8;i++)g.sample({frameMs:1500,frameWorkMs:1500,heapBytes:0,gpuTextures:0,gpuGeometries:0});assert.equal(g.tier(),'high');
});
