import test from 'node:test';import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';import {compileVisiblePass,prepareBatchedPass,registerRenderPreparation,isRenderPreparationPending,disposeRenderPreparation} from '../src/render/pass-preparation.mjs?v=258173b4dba723d7';
test('preparation submits bounded batches, yields with current state restored, and leaves foreground traversal whole',async()=>{
 const scene=new T.Scene(),camera=new T.Camera(),seen=[],sizes=[];let tier='high',foreground=0;
 for(let i=0;i<7;i++){const m=new T.Mesh();m.name=String(i);scene.add(m);}
 const renderer={compileAsync(view){const meshes=[];view.traverse(n=>{if(n.isMesh)meshes.push(n.name);});if(tier==='high'){foreground++;assert.equal(meshes.length,7);}else{sizes.push(meshes.length);seen.push(...meshes);}return Promise.resolve();},dispose(){}};registerRenderPreparation(renderer,T);
 const pending=prepareBatchedPass(renderer,()=>{try{tier='low';return compileVisiblePass(renderer,scene,camera);}finally{tier='high';}},{size:2});
 assert.equal(tier,'high');assert.equal(isRenderPreparationPending(renderer),true);await compileVisiblePass(renderer,scene,camera);await pending;assert.deepEqual(seen,['0','1','2','3','4','5','6']);assert.deepEqual(sizes,[1,1,1,1,1,1,1]);assert.equal(foreground,1);assert.equal(isRenderPreparationPending(renderer),false);disposeRenderPreparation(renderer);
});
test('aborting a batch prevents later submission and releases retained scene materials',async()=>{
 const scene=new T.Scene(),camera=new T.Camera(),signal=new AbortController(),material=new T.MeshBasicMaterial();let calls=0,disposed=0;material.addEventListener('dispose',()=>disposed++);for(let i=0;i<4;i++)scene.add(new T.Mesh(undefined,material));
 const renderer={compileAsync(){calls++;return Promise.resolve();},dispose(){}};registerRenderPreparation(renderer,T);
 const pending=prepareBatchedPass(renderer,()=>compileVisiblePass(renderer,scene,camera),{signal:signal.signal,size:1});material.dispose();assert.equal(disposed,0);signal.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);assert.equal(disposed,1);assert.equal(isRenderPreparationPending(renderer),false);disposeRenderPreparation(renderer);
});
