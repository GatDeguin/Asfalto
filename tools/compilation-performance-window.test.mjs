import test from 'node:test';import assert from 'node:assert/strict';import {createTrackPerformanceGovernor} from '../src/performance/track-performance-governor.mjs?v=c2943f0c1c9be48f';
test('background compilation cannot downgrade quality; sustained driving overload still can',()=>{
 const transitions=[],governor=createTrackPerformanceGovernor({initialTier:'high',onTierChange:t=>transitions.push(t)}),frame=(ms,preparing=false)=>governor.sample({frameMs:ms,frameWorkMs:ms,preparing,heapBytes:1,gpuTextures:1,gpuGeometries:1});
 for(let i=0;i<30;i++)frame(16);for(let i=0;i<300;i++)frame(250,true);assert.equal(transitions.length,0);assert.equal(governor.diagnostics().phase,'shader-preparation');assert.equal(governor.diagnostics().samples,0);
 frame(1000);for(let i=0;i<240;i++)frame(16);assert.equal(transitions.length,0);assert.equal(governor.diagnostics().p95FrameMs,16);
 for(let i=0;i<240;i++)frame(30);assert.ok(transitions.some(t=>t.tier==='balanced'));
});
