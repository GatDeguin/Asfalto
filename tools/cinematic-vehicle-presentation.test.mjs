import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {installVehiclePresentation} from '../src/render/vehicle-presentation.mjs';
import {createAdvancedMaterials} from '../src/render/advanced-materials.mjs';

test('active approved exterior preserves its vehiclePigment mask, paint owner and condition uniforms',()=>{
 const root=new T.Group(),lod=new T.Group();
 const original=new T.MeshStandardMaterial({color:'#d66a24',metalness:.04,roughness:.3});original.name='Body_Paint_Atlas';
 const body=new T.Mesh(new T.BoxGeometry(2,1,1),original);body.name='body';lod.add(body);
 const presentation=installVehiclePresentation(T,{vehicle:'chevy',modelRoot:root,lods:[lod],paintColor:'#d66a24'});
 const material=body.material,prior=material.onBeforeCompile,api=createAdvancedMaterials(T,{root,quality:'cinematic'});
 try{
  const shader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/float anAMSurfaceMask=.*vehiclePigment/);
  assert.ok(shader.fragmentShader.indexOf('float vehiclePigment')<shader.fragmentShader.indexOf('float anAMSurfaceMask'));
  assert.equal(presentation.setPaintColor('#123456'),true);assert.equal(shader.uniforms.vehiclePaint.value.getHexString(),'123456');
  presentation.setCondition('wet');assert.equal(shader.uniforms.vehicleWet.value,1);
  assert.equal(body.material,material);assert.equal(material.metalness,.04);
 }finally{api.dispose();assert.equal(material.onBeforeCompile,prior);presentation.dispose();}
});
