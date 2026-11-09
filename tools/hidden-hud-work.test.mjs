import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../src/legacy/'+name,import.meta.url),'utf8');
function legacyApp(){
  const flags=new Set(['v6-driving']),frames=[];
  const window={CockpitV5Core:{}};
  vm.runInNewContext(read('cockpit-v5-browser.js'),{window,document:{readyState:'loading',addEventListener(){},body:{classList:{contains:name=>flags.has(name)}}},requestAnimationFrame:callback=>frames.push(callback),console});
  const live={status:'RUNNING',lastLapTime:75,invalidLap:false,settings:{mode:'timeTrial'},track:{id:'dos_lagos'}};
  let fullReads=0,visuals=0;const submissions=[];
  const app=Object.assign(Object.create(window.CockpitV5AppClass.prototype),{
    lastFrame:0,lastUi:0,lastStatus:'',cockpit:{raceWorld:{state:live},getState(){fullReads++;return {race:{...live,ghost:{samples:[{s:42}]}}};}},
    _update(){visuals++;},records:{submit(...args){submissions.push(args);}}
  });
  return {app,flags,frames,live,submissions,counts:()=>[fullReads,visuals]};
}

test('the hidden legacy HUD skips drawing and persists a finish once without opening a modal',()=>{
  const f=legacyApp();f.app._loop(40);f.app._loop(80);
  assert.deepEqual(f.counts(),[0,0]);
  f.live.status='FINISHED';f.app._loop(120);f.app._loop(160);
  assert.deepEqual(f.counts(),[1,0]);
  assert.equal(f.submissions.length,1);
  assert.equal(f.submissions[0][0].track,'dos_lagos');
  assert.equal(f.submissions[0][1].time,75);
  assert.equal(f.submissions[0][1].ghost.samples[0].s,42);
});

test('standalone legacy mode still updates the visible HUD',()=>{
  const f=legacyApp();f.flags.clear();f.app._loop(40);
  assert.deepEqual(f.counts(),[1,1]);
});

test('modern session reads the physical frame and race time without requesting full history',()=>{
  const source=read('v6-complete-runtime.js');
  const start=source.indexOf('function getGameState(){'),end=source.indexOf('function reconcileChassisConfig(){',start);
  assert.ok(start>=0&&end>start);
  const state={status:'FINISHED',totalWithPenalty:78,lap:1,physicsSnapshot:{chassis:{linearVelocity:[3,4,0]},gearbox:{gear:2},engine:{rpm:1650}}};
  let fullReads=0,renderReads=0;
  const world={state,getState(){fullReads++;return state;},getRenderFrame(){renderReads++;return {currentSnapshot:state.physicsSnapshot};}};
  const readSession=vm.runInNewContext(source.slice(start,end)+'\ngetGameState;',{window:{__cockpit:{raceWorld:world}},q:()=>null});
  const result=readSession();
  assert.equal(result.speed,18);
  assert.equal(result.gear,2);
  assert.equal(result.finished,true);
  assert.equal(result.raw.totalWithPenalty,78);
  assert.deepEqual([fullReads,renderReads],[0,0]);
});
