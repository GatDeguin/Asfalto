import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import * as iguazu from '../src/tracks/visuals/iguazu-landscape.mjs?v=914d2aed50024dc4';
import {bindSharedInstanceWindows} from '../src/tracks/seam-copy-factory.mjs?v=97bbf38e4233d892';

test('Iguazú shares one draw per geometry, material and range across visible spatial cells',()=>{
 const scene=new T.Scene(),root=new T.Group(),geometry=new T.BoxGeometry(4,4,4),material=new T.MeshStandardMaterial();
 scene.add(root);
 const item=(x,z,range=1050)=>({geometry,material,matrix:new T.Matrix4().makeTranslation(x,0,z),range});
 const items=[item(0,-100),item(0,-330),item(0,-600),item(0,100),item(600,-300),item(0,-950,190)];
 assert.equal(iguazu.createIguazuInstanceBatches(T,root,items,'TEST_'),2);
 const camera=new T.PerspectiveCamera(60,1,.1,2000);
 const previous=scene.onBeforeRender,unbind=bindSharedInstanceWindows(scene,root);
 const matrix=new T.Matrix4();
 function visible(batch){
  root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  scene.onBeforeRender(null,scene,camera);
  return Array.from({length:batch.count},(_,i)=>{batch.getMatrixAt(i,matrix);return matrix.elements[14];});
 }
 assert.deepEqual(visible(root.children[0]).sort((a,b)=>b-a),[-100,-330,-600]);
 assert.deepEqual(visible(root.children[1]),[]);
 camera.position.z=-900;
 assert.deepEqual(visible(root.children[1]),[-950]);
 unbind();
 assert.equal(scene.onBeforeRender,previous);
 for(const mesh of root.children)mesh.dispose();
 geometry.dispose();material.dispose();
});

test('culling respects world transforms, replacement and conservative geometric bounds',()=>{
 const scene=new T.Scene(),root=new T.Group(),geometry=new T.BoxGeometry(30,2,2),material=new T.MeshStandardMaterial({name:'MAT_leaf'});
 scene.add(root);
 const matrix=new T.Matrix4().makeTranslation(60,0,-100);
 iguazu.createIguazuInstanceBatches(T,root,[{geometry,material,matrix,range:1000}],'TEST_');
 const batch=root.children[0],camera=new T.PerspectiveCamera(60,1,.1,2000);
 const unbind=bindSharedInstanceWindows(scene,root);
 root.position.x=500;camera.position.x=500;
 root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 scene.onBeforeRender(null,scene,camera);
 assert.equal(batch.count,1,'the mesh extends into the view although its center is outside');
 assert.equal(batch.userData.asfaltoReprojectInstances(()=>500),1);
 scene.onBeforeRender(null,scene,camera);
 assert.equal(batch.count,0);
 assert.equal(batch.userData.asfaltoReprojectInstances(()=>0),1);
 scene.onBeforeRender(null,scene,camera);
 assert.equal(batch.count,1);
 const clone=batch.userData.asfaltoCloneForChart();
 unbind();const releaseClone=bindSharedInstanceWindows(scene,clone);
 clone.updateMatrixWorld(true);camera.position.x=0;camera.updateMatrixWorld(true);
 scene.onBeforeRender(null,scene,camera);
 assert.equal(clone.count,1);
 assert.notEqual(clone.instanceMatrix.array,batch.instanceMatrix.array);
 releaseClone();clone.dispose();batch.dispose();geometry.dispose();material.dispose();
});

test('authored bank and overlook details share geometry without a foliage distance limit',()=>{
 const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial({name:'MAT_fern'}),root=new T.Group(),scene=new T.Scene();
 for(const name of ['BANK_SCREE_1','BANK_PLANT_1','WOW_rock_1','WOW_arch_1']){
  assert.equal(iguazu.iguazuInstanceRange(name),Infinity);
 }
 for(const name of ['BANK_SOLID_1','BANK_ROOTS_1','TERRAIN_1','FALL_MAIN_1']){
  assert.equal(iguazu.iguazuInstanceRange(name),null);
 }
 assert.equal(iguazu.iguazuInstanceRange('VEG_fern_1'),190);
 assert.equal(iguazu.iguazuInstanceRange('ROCK_1'),1050);
 const items=[-1400,1400].map(z=>({geometry,material,matrix:new T.Matrix4().makeTranslation(0,0,z),range:iguazu.iguazuInstanceRange('BANK_PLANT_1')}));
 assert.equal(iguazu.createIguazuInstanceBatches(T,root,items,'TEST_'),1);
 scene.add(root);
 const batch=root.children[0],camera=new T.PerspectiveCamera(60,1,.1,2000);
 const unbind=bindSharedInstanceWindows(scene,root);
 root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 scene.onBeforeRender(null,scene,camera);
 assert.equal(batch.count,1,'only the distant plant in front of this camera is selected');
 assert.equal(batch.userData.asfaltoReprojectInstances,undefined,'authored bank placement is unchanged by return terrain');
 unbind();batch.dispose();geometry.dispose();material.dispose();
});
