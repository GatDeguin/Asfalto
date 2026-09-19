import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const module=await import('../src/runtime/frame-failure-boundary.mjs').catch(()=>({}));
test('A2 frame failures latch once, release controls, suspend audio, and require explicit recovery',async()=>{
 assert.equal(typeof module.createFrameFailureBoundary,'function');let pauses=0,releases=0,suspends=0,notices=0,frames=0;
 const api=module.createFrameFailureBoundary({pause(){pauses++;},releaseInputs(){releases++;},suspendAudio(){suspends++;return Promise.resolve();},onFailure(){notices++;}});
 assert.equal(api.run(()=>{throw Error('render fault');}),false);
 for(let i=0;i<20;i++)api.run(()=>frames++);
 assert.deepEqual([pauses,releases,suspends,notices,frames],[1,1,1,1,0]);assert.equal(api.diagnostics().message,'render fault');
 api.reset();assert.equal(api.run(()=>frames++),true);assert.equal(frames,1);
 api.dispose();api.run(()=>frames++);assert.equal(frames,1);
});
test('A2 a failing recovery callback does not prevent input release or error reporting',async()=>{
 assert.equal(typeof module.createFrameFailureBoundary,'function');const calls=[];
 const api=module.createFrameFailureBoundary({pause(){throw Error('pause failed');},releaseInputs(){calls.push('released');},suspendAudio(){return Promise.reject(Error('audio failed'));},onFailure(){calls.push('reported');}});
 api.run(()=>{throw Error('visual update failed');});await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls,['released','reported']);assert.equal(api.diagnostics().cleanupErrors.length,2);
});
test('A2 the published animate schedules exactly one next RAF after an injected render error and none after shutdown',()=>{
 const source=fs.readFileSync(new URL('../src/legacy/module-02.mjs',import.meta.url),'utf8');const start=source.indexOf('  function animate(timestamp=performance.now())');const end=source.indexOf("\n  setLoading(",start);
 let scheduled=0;const fallback={run(fn){try{fn();}catch{}}};
 const context=vm.createContext({performance:{now:()=>1},clock:{getDelta:()=>.016},document:{hidden:false,body:{classList:{contains:()=>false}}},renderingEnabled:true,previousDrivingFrame:true,frameWorkStarted:0,accumulator:0,accumulatedFrameWorkMs:0,frameRaf:0,modularRuntimeShutdown:null,frameFailureBoundary:module.createFrameFailureBoundary?.({})||fallback,raceWorld:{reportFrame(){},beginPerformanceWindow(){}},applyMechanicalVisuals(){},simulationStep(){},updateRaceCamera(){},framePacer:{sample:()=>({render:true}),reset(){}},framePacingSettings:{getTargetFps:()=>60},presentationStats:{frames:0},renderFrame(){throw Error('render failed');},requestAnimationFrame(){return ++scheduled;}});
 vm.runInContext(source.slice(start,end)+';animate();',context);assert.equal(scheduled,1);
 context.modularRuntimeShutdown=Promise.resolve();vm.runInContext('animate();',context);assert.equal(scheduled,1);
});
