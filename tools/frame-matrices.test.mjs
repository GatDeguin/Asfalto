import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {withFrameMatrices} from '../src/render/frame-matrices.mjs?v=ca094c8344437cf8';

test('stationary world leaves do not multiply static matrices every frame; dynamic child and moved world update',()=>{
 const scene=new T.Scene(),staticRoot=new T.Group(),fixed=new T.Object3D(),dynamic=new T.Object3D();scene.add(staticRoot,dynamic);staticRoot.add(fixed);fixed.position.x=4;staticRoot.position.z=5;
 staticRoot.updateMatrix();staticRoot.matrixAutoUpdate=false;fixed.updateMatrix();fixed.matrixAutoUpdate=false;
 withFrameMatrices(scene,()=>{});let products=0;const multiply=fixed.matrixWorld.multiplyMatrices;fixed.matrixWorld.multiplyMatrices=function(...args){products++;return multiply.apply(this,args);};
 dynamic.position.x=7;withFrameMatrices(scene,()=>{assert.equal(dynamic.matrixWorld.elements[12],7);assert.equal(fixed.matrixWorld.elements[12],4);assert.equal(scene.matrixWorldAutoUpdate,false);});assert.equal(products,0);assert.equal(scene.matrixAutoUpdate,true);
 scene.position.x=2;withFrameMatrices(scene,()=>{});assert.equal(fixed.matrixWorld.elements[12],6);assert.equal(products,1);
});
test('restores renderer and transform update policy when drawing throws, including manual scene matrices',()=>{
 const scene=new T.Scene();scene.matrixAutoUpdate=false;scene.matrixWorldAutoUpdate=false;scene.matrix.makeTranslation(9,0,0);scene.matrixWorldNeedsUpdate=true;
 assert.throws(()=>withFrameMatrices(scene,()=>{throw new Error('draw');}),/draw/);assert.equal(scene.matrixAutoUpdate,false);assert.equal(scene.matrixWorldAutoUpdate,false);assert.equal(scene.matrixWorld.elements[12],0);
});
test('freezing authored track preserves root moves and explicitly dynamic nodes',async()=>{
 const {freezeStaticTrackTransforms}=await import('../src/render/frame-matrices.mjs?v=ca094c8344437cf8');
 const root=new T.Group(),fixed=new T.Object3D(),dynamic=new T.Object3D();root.add(fixed,dynamic);fixed.position.x=3;dynamic.userData.asfaltoDynamicTransform=true;
 assert.equal(freezeStaticTrackTransforms(root),1);assert.equal(root.matrixAutoUpdate,true);assert.equal(fixed.matrixAutoUpdate,false);assert.equal(dynamic.matrixAutoUpdate,true);
 root.position.z=8;dynamic.position.y=6;root.updateMatrixWorld();assert.equal(fixed.matrixWorld.elements[14],8);assert.equal(dynamic.matrixWorld.elements[13],6);
});
