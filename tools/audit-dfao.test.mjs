import test from 'node:test';import assert from 'node:assert/strict';import {THREE as T} from './cinematic-three.mjs';import {createDistanceFieldOcclusion} from '../src/render/distance-field-occlusion.mjs';
function fixture(count=10000){const scene=new T.Scene(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();material.name='rock';const mesh=new T.InstancedMesh(geometry,material,count);mesh.name='RockInstances';const m=new T.Matrix4();for(let i=0;i<count;i++){m.makeTranslation(i<20?i-10:1000+i,0,-5);mesh.setMatrixAt(i,m);}mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);const camera=new T.PerspectiveCamera();camera.position.set(0,1,0);const field=createDistanceFieldOcclusion(T,{scene});return{scene,mesh,camera,field,close(){field.dispose();geometry.dispose();material.dispose();}};}
test('A6 repeated static DFAO query does not reread distant instance transforms or reupload unchanged texture',()=>{
 const f=fixture();try{let reads=0;const original=f.mesh.getMatrixAt.bind(f.mesh);f.mesh.getMatrixAt=(...a)=>{reads++;return original(...a);};f.field.refresh({camera:f.camera});assert.equal(reads,10000);const version=f.field.uniforms.anDfaProxyTexture.value.version;reads=0;for(let i=0;i<10;i++)f.field.refresh({camera:f.camera});assert.equal(reads,0);assert.equal(f.field.uniforms.anDfaProxyTexture.value.version,version);assert.equal(f.field.diagnostics().proxyCount,16);assert.ok(f.field.diagnostics().cache.queryHits>=10);}finally{f.close();}
});
test('A6 dirty instance matrices, object transforms, visibility and removals invalidate proxies',()=>{
 const f=fixture(1);try{f.field.refresh({camera:f.camera});assert.equal(f.field.diagnostics().proxyCount,1);
 f.mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(1000,0,0));f.mesh.instanceMatrix.needsUpdate=true;f.field.refresh({camera:f.camera});assert.equal(f.field.diagnostics().proxyCount,0);
 f.mesh.position.x=-1000;f.field.refresh({camera:f.camera});assert.equal(f.field.diagnostics().proxyCount,1);
 f.mesh.visible=false;f.field.refresh({camera:f.camera});assert.equal(f.field.diagnostics().proxyCount,0);
 f.mesh.visible=true;f.field.refresh({camera:f.camera});assert.equal(f.field.diagnostics().proxyCount,1);
 f.mesh.removeFromParent();f.field.refresh({camera:f.camera});assert.equal(f.field.diagnostics().proxyCount,0);assert.equal(f.field.diagnostics().cache.indexedProxies,0);}finally{f.close();}
});
test('A6 spatial query preserves camera-volume, vehicle and ground exclusions and follows the camera',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),geo=new T.BoxGeometry(4,4,4),camera=new T.PerspectiveCamera();
 const shell=new T.Mesh(geo,material);shell.name='GarageWall';scene.add(shell);
 const ground=new T.Mesh(geo,material);ground.name='Road';ground.position.z=-7;scene.add(ground);
 const car=new T.Group();car.userData.vehicleSelectionMount=true;const carPart=new T.Mesh(geo,material);carPart.name='rock';car.add(carPart);scene.add(car);
 const far=new T.Mesh(geo,material);far.name='RockFar';far.position.x=100;scene.add(far);
 const field=createDistanceFieldOcclusion(T,{scene});try{field.refresh({camera});assert.equal(field.diagnostics().proxyCount,0);camera.position.x=90;field.refresh({camera});assert.deepEqual(field.diagnostics().proxies.map(p=>p.name),['RockFar']);assert.equal(field.sampleDistance([100,0,0]),-2);}finally{field.dispose();geo.dispose();material.dispose();}
});
