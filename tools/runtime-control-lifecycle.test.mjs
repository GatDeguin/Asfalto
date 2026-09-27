import assert from 'node:assert/strict';
import {createEngineControlRing,createEngineControlReader} from '../src/audio/engine-control-ring.mjs?v=1004f2bad30c31a3';
import {createAssetLifecycleManager,disposeAssets,AssetPipeline} from '../src/runtime/asset-lifecycle.mjs?v=a4c55886c0272d57';
import {stepDampedSpring,smoothAnalog} from '../src/render/cockpit-animator.mjs?v=1e70e16a21a9b8b3';
import {createIgnitionMotion} from '../src/render/ignition-motion.mjs?v=6fe1bdf4284282d2';
import {createCockpitHeadMotion} from '../src/game/cockpit-head-motion.mjs?v=91536e58ba4745bc';

for(const shared of [false,true]){
  const ring=createEngineControlRing({shared});
  ring.shift(.9);ring.publish();ring.shift(.2);ring.publish();
  const state=ring.consume();assert.ok(Math.abs(state[26]-.9)<1e-6);
  ring.shift(.3);ring.publish();assert.ok(Math.abs(ring.consume()[26]-.3)<1e-6);
  for(let i=0;i<31;i++){ring.set('rpm',1000+i);assert.equal(ring.publish(),true);}
  ring.set('rpm',5000);assert.equal(ring.publish(),false);
  assert.equal(ring.consume()[0],1030);assert.equal(ring.publish(),true);assert.equal(ring.consume()[0],5000);
  ring.dispose();
}
{
  const toAudio=[],toMain=[],mainPort={onmessage:null,postMessage(data,transfer){toAudio.push(structuredClone(data,{transfer}));}};
  const audioPort={onmessage:null,postMessage(data,transfer){toMain.push(structuredClone(data,{transfer}));}};
  const ring=createEngineControlRing({shared:false}),reader=createEngineControlReader(audioPort,null,ring.values);
  ring.attach(mainPort);ring.shift(.9);ring.publish();ring.shift(.2);ring.publish();ring.set('rpm',4200);ring.publish();
  assert.equal(ring.publish(),false);
  for(const data of toAudio)audioPort.onmessage({data});
  assert.equal(reader.read()[0],4200);assert.ok(reader.state[26]>.89);
  for(const data of toMain)mainPort.onmessage({data});
  assert.equal(ring.diagnostics().availableTransfers,3);
  ring.shift(.1);assert.equal(ring.publish(),true);
}
{
  const counts=new Map(),resource=(name,extras={})=>({dispose(){counts.set(name,(counts.get(name)||0)+1);},...extras});
  const texture=resource('texture',{isTexture:true}),geometry=resource('geometry'),material=resource('material',{map:texture});
  const makeRoot=()=>({isInstancedMesh:true,geometry,material,dispose(){counts.set('instance',(counts.get('instance')||0)+1);},traverse(fn){fn(this);},removeFromParent(){}});
  const manager=createAssetLifecycleManager(),a=manager.createScope(),b=manager.createScope();
  a.trackRoot(makeRoot());b.trackRoot(makeRoot());a.dispose();assert.equal(counts.has('texture'),false);b.dispose();
  assert.equal(counts.get('texture'),1);assert.equal(counts.get('instance'),2);
  manager.dispose();const late=resource('late');disposeAssets({geometry:late,traverse(fn){fn(this);},removeFromParent(){}},{manager});assert.equal(counts.get('late'),1);
}
{
  const x=new Float64Array(2),y=new Float64Array(2);
  for(let i=0;i<60;i++)stepDampedSpring(x,0,1,1/60,12,.7);
  for(let i=0;i<240;i++)stepDampedSpring(y,0,1,1/240,12,.7);
  assert.ok(Math.abs(x[0]-y[0])<1e-12);
  assert.ok(Math.abs(smoothAnalog(smoothAnalog(0,5000,16,1/120),5000,16,1/120)-smoothAnalog(0,5000,16,1/60))<1e-10);
  const snap={timeSeconds:0,chassis:{position:[0,1,0],linearVelocity:[10,0,0],angularVelocity:[0,.3,0],rotation:[0,0,0,1],acceleration:[-4,0,2]},wheels:[],engine:{rpm:3000}};
  const key=createIgnitionMotion(),head=createCockpitHeadMotion(),ks=key.step(snap),hs=head.update(snap);
  for(let i=1;i<100;i++){snap.timeSeconds=i/120;assert.equal(key.step(snap),ks);assert.equal(head.update(snap,1/120),hs);}
  assert.ok(Number.isFinite(ks.pitch));assert.ok(Math.abs(ks.roll)<=.9);
  const paused=ks.pitch;key.step(snap,{paused:true});assert.equal(ks.pitch,paused);
}
{
  const oldFetch=globalThis.fetch;let finishParse,disposed=0;
  const root={geometry:{dispose(){disposed++;}},traverse(fn){fn(this);},removeFromParent(){}};
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
  const lifecycle=createAssetLifecycleManager(),pipeline=new AssetPipeline({lifecycle,yieldTask:async()=>{},loader:{parseAsync:()=>new Promise(resolve=>{finishParse=resolve;})}});
  try{
    const result=pipeline.enqueue('http://local/car.glb');
    while(!finishParse)await new Promise(resolve=>setTimeout(resolve,0));
    pipeline.dispose();lifecycle.dispose();finishParse({scene:root});
    await assert.rejects(result);assert.equal(disposed,1);
  }finally{globalThis.fetch=oldFetch;}
}
console.log('Runtime control/lifecycle/spring focused checks PASS');

