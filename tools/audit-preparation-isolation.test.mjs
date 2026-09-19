import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createFrameFailureBoundary} from '../src/runtime/frame-failure-boundary.mjs';
const source=fs.readFileSync(new URL('../src/legacy/module-02.mjs',import.meta.url),'utf8');

test('A1/A5 active animation never advances physics or renders a partially prepared circuit',()=>{
 const code=source.slice(source.indexOf('  function animate(timestamp=performance.now()) {'),source.indexOf("\n  setLoading('Aplicando presupuesto"));
 let preparing=true,steps=0,draws=0,scheduled=0;
 const context=vm.createContext({frameFailureBoundary:createFrameFailureBoundary(),modularRuntimeShutdown:null,performance:{now:()=>1},clock:{getDelta:()=>1/60},document:{hidden:false,body:{classList:{contains:()=>false}}},renderingEnabled:true,previousDrivingFrame:false,accumulatedFrameWorkMs:0,accumulator:0,raceWorld:{isPreparing:()=>preparing,beginPerformanceWindow(){},reportFrame(){}},simulationStep(){steps++;},applyMechanicalVisuals(){},updateRaceCamera(){},framePacer:{sample:()=>({render:true,intervalMs:16.7,targetFps:60}),reset(){}},framePacingSettings:{getTargetFps:()=>60},presentationStats:{frames:0},renderFrame(){draws++;},requestAnimationFrame(){scheduled++;}});
 vm.runInContext(code+'\nanimate(0);animate(17);',context);
 assert.equal(steps,0,'physics must not use the old circuit while replacing it');
 assert.equal(draws,0,'do not queue driving frames while the preparer owns the scene');
 assert.equal(scheduled,2,'keep the single owner loop alive for recovery');
 preparing=false;vm.runInContext('animate(34)',context);assert.equal(steps,1);assert.equal(draws,1);
});

test('A1/A5 the shared preparation gate releases on error and keeps nested operations isolated',async()=>{
 const start=source.indexOf('  let pendingRacePreparations=0;');
 assert.notEqual(start,-1,'the actual race owner must account for all pending preparations');
 const code=source.slice(start,source.indexOf('  let circuitSelectionTail=',start));
 let releases=0;const context=vm.createContext({clearInputs(){},onInputCaptureRelease(){releases++;},driverControlPipeline:{reset(){}}});
 vm.runInContext(code+'\nglobalThis.gate={run:withRacePreparation,busy:()=>pendingRacePreparations>0};',context);
 let finish;const held=new Promise(resolve=>finish=resolve);
 const outer=context.gate.run(()=>held);assert.equal(context.gate.busy(),true);
 await assert.rejects(context.gate.run(async()=>{throw Error('setup failure');}),/setup failure/);
 assert.equal(context.gate.busy(),true);finish();await outer;assert.equal(context.gate.busy(),false);assert.equal(releases,1);
 const select=source.slice(source.indexOf('  function selectCircuit('),source.indexOf('  async function performCircuitSelection('));
 assert.match(select,/withRacePreparation/);
 const raceStart=source.slice(source.indexOf('  async function start({signal,onStage='),source.indexOf('  function pause({reason='));
 assert.match(raceStart,/withRacePreparation/);
});
