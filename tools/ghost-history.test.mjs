import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createGameplayBridge } from '../src/tracks/gameplay-bridge.mjs?v=75c4371c18fdd85b';

const read = name => fs.readFileSync(new URL('../src/legacy/'+name, import.meta.url), 'utf8');
const source = read('module-02.mjs');
const start = source.indexOf('const RaceCore = (() => {');
const end = source.indexOf('/* Cockpit Chevy Racing POV v3', start);
assert.ok(start >= 0 && end > start, 'production race rules are present');
const context = vm.createContext({performance});
vm.runInContext(source.slice(start,end)+'\nglobalThis.RaceCore=RaceCore;', context);
vm.runInContext(read('asfalto-v6-integration-runtime.js'), context);
const {RaceCore,AsfaltoV6Integration}=context;
const lengthM=10000;
const samples=[0,lengthM].map(sM=>({sM,sectorId:'straight',position:[0,0,-sM],tangent:[0,0,-1],widthM:10}));
const track=createGameplayBridge({sample:()=>samples[0]},{lengthM,closed:true,samples,sectors:[{endM:lengthM}]},{id:'ghost-history-fixture'});
const race=()=>new AsfaltoV6Integration.RaceSimulationV6({RaceCore,track,storage:null,settings:{mode:'practice',laps:3}});
const publish = sim => sim.state=sim._publish(sim._projection,sim._snapshot);

test('publishing a physics frame does not visit recorded ghost samples', () => {
  const sim=race();let visited=0;
  const ghostSamples=Array.from({length:4000},(_,i)=>({get t(){visited++;return i*.04;},s:i}));
  sim._rules.debugSet({ghostSamples},{publish:false});
  for(let i=0;i<120;i++)publish(sim);
  assert.equal(visited,0,'render telemetry must not traverse the history');
  const copy=sim.getState();
  assert.equal(copy.ghostSamples.length,4000);
  assert.equal(copy.ghostSamples[20].t,.8);
});

test('the previous published history survives rollover, reset and changes to a public copy', () => {
  const sim=race(),rules=sim._rules;
  rules.debugSet({status:'RUNNING',ghostSamples:Array.from({length:4000},(_,i)=>({t:i*.04,s:i})),totalTime:160},{publish:false});
  const previous=publish(sim);
  rules.step(.041,{speedMps:1});
  const next=publish(sim);
  rules.debugSet({ghostSamples:[]},{publish:false});publish(sim);
  assert.equal(previous.ghostSamples[0].s,0);
  assert.equal(previous.ghostSamples.at(-1).s,3999);
  assert.equal(next.ghostSamples[0].s,1);
  assert.equal(next.ghostSamples.length,4000);
  assert.equal(sim.getState().ghostSamples.length,0);
  const detached=sim.getState();detached.ghostSamples.push({s:-1});
  assert.equal(sim.getState().ghostSamples.length,0);
});

test('a full history still records the authoritative physical pose for the current lap', () => {
  const rules=race()._rules;
  rules.debugSet({status:'RUNNING',s:10,raceProgress:track.length+10,completedLaps:1,totalTime:170,lapStartTime:160,ghostSamples:Array.from({length:4000},(_,i)=>({t:i*.04,s:i}))},{publish:false});
  rules.step(.041,{speedMps:2},{raceProgress:track.length+21,lateral:.6,speedAlongRouteMps:15,headingError:.2,slip:.17});
  const history=rules.getState().ghostSamples;
  assert.equal(history.length,4000);
  assert.equal(history[0].s,1);
  const {s,lateral,speed,heading,slip}=history.at(-1);
  assert.deepEqual({s,lateral,speed,heading,slip},{s:21,lateral:.6,speed:15,heading:.2,slip:.17});
});
