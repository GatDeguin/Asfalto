import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {compileVisiblePass,prepareBatchedPass,registerRenderPreparation,getRenderPreparationDiagnostics,disposeRenderPreparation} from '../src/render/pass-preparation.mjs?v=258173b4dba723d7';
function fixture(count,{cost=0}={}){
 let time=0;const scene=new T.Scene(),camera=new T.Camera(),turns=[],seen=[];
 for(let i=0;i<count;i++){const mesh=new T.Mesh();mesh.name=String(i);scene.add(mesh);}
 const renderer={compileAsync(view){view.traverse(n=>{if(n.isMesh)seen.push(n.name);});time+=cost;return Promise.resolve();},dispose(){}};
 registerRenderPreparation(renderer,T);
 return {scene,camera,renderer,seen,turns,options:{now:()=>time,yieldTask:async()=>{turns.push(seen.length);}},run(options={}){return prepareBatchedPass(renderer,()=>compileVisiblePass(renderer,scene,camera),{...this.options,...options});}};
}
test('CPU budget stops submission after an atomic unit crosses the deadline',async()=>{
 const f=fixture(7,{cost:3});await f.run({budgetMs:4});
 assert.deepEqual(f.turns,[2,4,6]);assert.equal(f.seen.length,7);
 const d=getRenderPreparationDiagnostics(f.renderer);assert.equal(d.maxSubmissionMs,6);assert.equal(d.turns,4);assert.equal(d.submittedPositions,7);
});
test('one expensive native compile still progresses and yields immediately',async()=>{
 const f=fixture(3,{cost:12});await f.run({budgetMs:4});
 assert.deepEqual(f.turns,[1,2]);assert.equal(getRenderPreparationDiagnostics(f.renderer).overBudgetUnits,3);
});
test('cheap work retains the sixteen-position cap',async()=>{
 const f=fixture(40);await f.run();assert.deepEqual(f.turns,[16,32]);assert.equal(f.seen.length,40);
});
test('equivalent repeated objects share preparation but feature variants remain',async()=>{
 const f=fixture(0),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
 const add=(name,changes={})=>{const m=new T.Mesh(geometry,material);Object.assign(m,{name},changes);f.scene.add(m);return m;};
 add('base');add('copy');add('receive',{receiveShadow:true});
 const instanced=new T.InstancedMesh(geometry,material,1);instanced.name='instances';f.scene.add(instanced);
 await f.run();assert.deepEqual(f.seen,['base','receive','instances']);
 const d=getRenderPreparationDiagnostics(f.renderer);assert.equal(d.sourceObjects,4);assert.equal(d.uniqueObjects,3);
});
test('custom shaders and distinct materials are never folded speculatively',async()=>{
 const f=fixture(0),geometry=new T.BoxGeometry(),custom=new T.MeshStandardMaterial();custom.onBeforeCompile=()=>{};
 for(const [name,material] of [['custom-a',custom],['custom-b',custom],['own-a',new T.MeshBasicMaterial()],['own-b',new T.MeshBasicMaterial()]]){const m=new T.Mesh(geometry,material);m.name=name;f.scene.add(m);}
 await f.run();assert.equal(f.seen.length,4);
});
test('invalid budget fails without entering native compilation',async()=>{
 const f=fixture(1);await assert.rejects(f.run({budgetMs:0}),/budgetMs/);assert.equal(f.seen.length,0);
});

test('disposal waits for pending native passes before destroying transmission target',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r),scene=new T.Scene(),camera=new T.Camera();scene.add(new T.Mesh(new T.BoxGeometry(),new T.MeshPhysicalMaterial({transmission:1})));
 let target=null;const viewport=new T.Vector4(0,0,1,1);
 const renderer={compileAsync:()=>gate,dispose(){},toneMapping:T.ACESFilmicToneMapping,getRenderTarget:()=>target,setRenderTarget:t=>target=t,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(viewport),getCurrentViewport:v=>v.copy(viewport),getScissorTest:()=>false,setViewport(){},setScissor(){},setScissorTest(){},state:{viewport(){}}};
 const context=registerRenderPreparation(renderer,T);const pending=compileVisiblePass(renderer,scene,camera);let disposals=0;
 context.transmission.addEventListener('dispose',()=>disposals++);disposeRenderPreparation(renderer);assert.equal(disposals,0);
 const replacement=registerRenderPreparation(renderer,T);assert.notEqual(replacement,context);resolve();await pending;
 assert.equal(disposals,1);assert.equal(registerRenderPreparation(renderer,T),replacement);disposeRenderPreparation(renderer);
});

test('full-scene transmission detection stays linear under one-object batches',async()=>{
 const f=fixture(512);let reads=0;
 for(const mesh of f.scene.children)Object.defineProperty(mesh.material,'transmission',{get(){reads++;return 0;}});
 await f.run();assert.equal(reads,512);assert.equal(f.seen.length,512);
});

test('quality state is installed once per budgeted turn and restored before yielding',async()=>{const f=fixture(6,{cost:2});let active=false,enters=0;await prepareBatchedPass(f.renderer,()=>{assert.equal(active,true);return compileVisiblePass(f.renderer,f.scene,f.camera);},{...f.options,withTurnState:work=>{enters++;active=true;try{return work();}finally{active=false;}},yieldTask:async()=>{assert.equal(active,false);}});assert.equal(enters,3);assert.equal(active,false);assert.equal(f.seen.length,6);});
