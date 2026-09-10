import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createRoadTestCoursePresentation} from '../src/render/road-test-course.mjs';
const payload=JSON.parse(fs.readFileSync(new URL('../assets/manifests/workshop-bootstrap.json',import.meta.url)));
const T=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64'));
const gates=()=>Array.from({length:8},(_,i)=>({id:'slalom-'+(i+1),center:[20+16*i,2,i%2?.9:-.9],forward:[1,0,0],left:[0,0,1],halfWidthM:1.5}));
test('sixteen physical gate edges are visible with bounded resources and no collision ownership',()=>{
 const scene=new T.Scene(),api=createRoadTestCoursePresentation(T,{scene}),data=gates();const before=JSON.stringify(data);api.set(data,{sessionSequence:4});
 const root=scene.getObjectByName('RoadTestCourse_Markers');assert(root);assert.equal(root.children.length,3);assert.equal(api.diagnostics().gateCount,8);assert.equal(api.diagnostics().markerCount,16);assert.equal(api.diagnostics().drawCalls,3);assert(api.diagnostics().triangles<=2500);assert.equal(api.diagnostics().colliders,0);assert.equal(JSON.stringify(data),before);
 root.updateMatrixWorld(true);const mesh=root.getObjectByName('RoadTestCourse_Base'),m=new T.Matrix4(),v=new T.Vector3();for(let i=0;i<16;i++){mesh.getMatrixAt(i,m);v.setFromMatrixPosition(m);const g=data[Math.floor(i/2)];assert(Math.abs(v.x-g.center[0])<1e-5);assert(Math.abs(v.z-(g.center[2]+(i%2?1:-1)*g.halfWidthM))<1e-5);assert(v.y>g.center[1]&&v.y<g.center[1]+.1);}api.dispose();
});
test('rigid rebases preserve visible and committed gate alignment and reject nonrigid transforms',()=>{
 const scene=new T.Scene(),api=createRoadTestCoursePresentation(T,{scene});api.set(gates(),{sessionSequence:3});const root=scene.children[0];api.rebase({matrix:[0,0,-1,0,0,1,0,0,1,0,0,0,100,0,50,1],referenceChart:1});root.updateMatrixWorld(true);const p=new T.Vector3(20,2,-.9).applyMatrix4(root.matrixWorld);assert(p.distanceTo(new T.Vector3(99.1,2,30))<1e-6);assert.throws(()=>api.rebase({matrix:[2,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],referenceChart:2}),/rigid/i);assert.equal(api.diagnostics().referenceChart,1);api.dispose();
});
test('replacement and cancellation release each owned geometry/material exactly once',()=>{
 const scene=new T.Scene(),api=createRoadTestCoursePresentation(T,{scene});api.set(gates(),{sessionSequence:3});let geometries=0,materials=0;scene.children[0].traverse(o=>{o.geometry?.addEventListener('dispose',()=>geometries++);o.material?.addEventListener('dispose',()=>materials++);});api.clear();api.clear();assert.equal(geometries,3);assert.equal(materials,3);assert.equal(scene.children.length,0);assert.equal(api.diagnostics().gateCount,0);api.set(gates(),{sessionSequence:4});api.dispose();api.dispose();assert.equal(scene.children.length,0);assert.throws(()=>api.set(gates(),{sessionSequence:5}),/disposed/);
});
test('invalid gate data never replaces a currently valid course',()=>{const scene=new T.Scene(),api=createRoadTestCoursePresentation(T,{scene});api.set(gates(),{sessionSequence:1});const malformed=gates();malformed[2].forward=[0,0,0];assert.throws(()=>api.set(malformed,{sessionSequence:1}),/gate/i);assert.equal(api.diagnostics().gateCount,8);api.dispose();});
