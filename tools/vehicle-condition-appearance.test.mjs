import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {damageDisplacement,createVehicleConditionAppearance} from '../src/render/vehicle-condition-appearance.mjs?v=3c5cafe81e30151f';
import {installVehiclePresentation} from '../src/render/vehicle-presentation.mjs?v=23d1e7f259ba8f73';
import {createVehicleMaintenance} from '../src/game/vehicle-maintenance.mjs?v=4f107479f0202bca';
import {createVehicleConditionSession} from '../src/game/vehicle-condition.mjs?v=3960803c4e868c79';
import {createWeatherWindshield} from '../src/render/weather-windshield.mjs?v=7d8cf1fdcc8f4382';
import {installClassicCabinTrim} from '../src/render/classic-cabin-trim.mjs?v=ca49ae66900d0ed1';
import {createAuthoredControlMounts} from '../src/render/authored-control-mounts.mjs?v=6876d2d01acaeeae';

const payload=JSON.parse(readFileSync(new URL('../assets/manifests/cockpit-payload.json',import.meta.url),'utf8'));
const T=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64'));

test('deformation follows physical impact axes and preserves distinct underbody damage',()=>{
 const rightImpact={body:64,damageZones:{right:.6}};
 assert.ok(damageDisplacement([0,0,-.35],rightImpact)[2]>.04);
 assert.deepEqual(damageDisplacement([0,0,.35],rightImpact),[0,0,0]);
 const underneath={body:60,mechanical:{body:{undersideCondition:.6}}};
 assert.ok(damageDisplacement([0,-.2,0],underneath)[1]>.02);
 assert.deepEqual(damageDisplacement([0,.28,0],underneath),[0,0,0]);
});

test('deformation owns its clone and restores the exact shared geometry after service',()=>{
 const geometry=new T.BoxGeometry(.1,.2,.6,3,4,8),mesh=new T.Mesh(geometry),other=new T.Mesh(geometry);
 const appearance=createVehicleConditionAppearance(T);
 appearance.add(mesh,new T.Matrix4().makeTranslation(-.88,0,0));
 appearance.set({body:30,damageZones:{front:.8}});
 assert.notEqual(mesh.geometry,geometry);
 assert.equal(other.geometry,geometry);
 assert.notDeepEqual(mesh.geometry.attributes.position.array,geometry.attributes.position.array);
 const damagedGeometry=mesh.geometry;
 let released=0;damagedGeometry.addEventListener('dispose',()=>released++);
 appearance.set({body:30,dirt:70,paint:10,damageZones:{front:.8}});
 assert.equal(mesh.geometry,damagedGeometry);
 appearance.set({dirt:70,paint:10});
 assert.equal(mesh.geometry,geometry);
 assert.equal(released,1);
});

test('the installed vehicle binds its window and structural finishes to independent service values',()=>{
 function vehicle(){
  const model=new T.Group(),modelRoot=new T.Group();
  const meshes={};
  for(const [part,materialName] of Object.entries({paint:'C3100_RoofIvory',glass:'C3100_Glass',structure:'C3100_UnderbodyBlackened',lamp:'C3100_HeadlampGlass',gauge:'39_Gauge_glass'})){
   const m=new T.Mesh(new T.BoxGeometry(1.6,.5,.7),new T.MeshPhysicalMaterial());m.name=part;m.material.name=materialName;model.add(m);meshes[part]=m;
  }
  const view=installVehiclePresentation(T,{vehicle:'pickup_3100',modelRoot,lods:[model]});
  return {view,meshes};
 }
 function compile(mesh){
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <transmission_fragment>\n#include <lights_physical_fragment>'};
  mesh.material.onBeforeCompile(shader);return shader;
 }
 const a=vehicle(),b=vehicle();
 const painted=compile(a.meshes.paint),glass=compile(a.meshes.glass),structure=compile(a.meshes.structure),otherGlass=compile(b.meshes.glass);
 assert.match(painted.fragmentShader,/vehicleAbrasion/);
 assert.match(glass.fragmentShader,/vehicleGlassFracture/);
 assert.match(structure.fragmentShader,/vehicleDirtMask/);
 for(const part of ['lamp','gauge'])assert.doesNotMatch(compile(a.meshes[part]).fragmentShader,/vehicleGlassFracture/);
 a.view.setPersistentCondition({body:62,paint:40,dirt:70,damageZones:{front:.5}});
 assert.equal(glass.uniforms.vehicleDirt.value,.7);
 assert.equal(glass.uniforms.vehicleDamageFrontRear.value.x,.5);
 assert.equal(painted.uniforms.vehiclePaintWear.value,.6);
 assert.equal(otherGlass.uniforms.vehicleDirt.value,0);
 a.view.resetCondition();
 assert.equal(glass.uniforms.vehicleDirt.value,.7);
 a.view.setPersistentCondition({body:62,paint:40,dirt:0,damageZones:{front:.5}});
 assert.equal(glass.uniforms.vehicleDirt.value,0);
 assert.equal(glass.uniforms.vehicleDamageFrontRear.value.x,.5);
 a.view.setPersistentCondition({paint:40});
 assert.equal(glass.uniforms.vehicleDamageFrontRear.value.x,0);
 assert.equal(painted.uniforms.vehiclePaintWear.value,.6);
 a.view.dispose();b.view.dispose();
});

test('an actual running impact is published to the active vehicle appearance between saves',()=>{
 const profile={condition:{},appearance:{}};
 const rendered=[],changes=[];
 const maintenance=createVehicleMaintenance({getProfile:()=>profile,getVehicleId:()=> 'chevrolet_1969',onAppearance:(condition,id)=>rendered.push({condition,id}),onChanged:condition=>changes.push(condition)});
 maintenance.begin();
 const frame={tick:1,running:true,snapshot:{impact:true,engine:{rpm:2200,torqueNm:100},impacts:[{timeSeconds:.1,localPointM:[1.6,.2,.1],magnitude:.8}],chassis:{linearVelocity:[10,0,0]},wheels:[{contact:true,surface:'dirt'}]}};
 maintenance.sample({...frame,qa:true});
 assert.equal(rendered.length,0);
 maintenance.sample(frame);
 assert.equal(rendered[0].id,'chevrolet_1969');
 assert.ok(rendered[0].condition.damageZones.front>0);
 assert.ok(rendered[0].condition.dirt>0);
 assert.equal(changes.length,1);
});

test('Bel Air fuel gauge follows the current car’s persistent fuel, including empty and refueled',()=>{
 const view=installVehiclePresentation(T,{vehicle:'belair_1957',modelRoot:new T.Group(),lods:[new T.Group()]});
 try{
  const gauge=()=>view.getInteriorDiagnostics().detail.gauges.find(g=>g.channel==='fuel');
  for(const fuel of [100,38,0,100]){
   view.setPersistentCondition({fuel});
   view.update({paused:true,snapshot:{engine:{rpm:825}}});
   assert.equal(gauge().value,fuel/100);
   assert.equal(gauge().ratio,fuel/100);
  }
 }finally{view.dispose();}
});

test('classic glovebox trim seats on its donor and releases its own mesh and material',()=>{
 const model=new T.Group(),dash=new T.Group();
 dash.name='SS250_DashboardAssembly';model.add(dash);
 assert.equal(installClassicCabinTrim(T,model,'chevy_400_1957').fittings,0);
 const donor=new T.Mesh(new T.BoxGeometry(.319,.012,.123),new T.MeshStandardMaterial());
 donor.name='SS250_GloveboxDoor';donor.position.set(.5165,.025,-.0025);dash.add(donor);
 const trim=installClassicCabinTrim(T,model,'chevy_400_1957');
 assert.equal(trim.fittings,1);
 const plaque=dash.getObjectByName('Chevrolet400GloveboxPlate');
 assert.ok(Math.abs(plaque.parent.position.y-.0315)<1e-6);
 let disposals=0;
 plaque.geometry.addEventListener('dispose',()=>disposals++);
 plaque.material.addEventListener('dispose',()=>disposals++);
 trim.dispose();
 assert.equal(disposals,2);
 assert.deepEqual(dash.children,[donor]);
 donor.geometry.dispose();donor.material.dispose();
});

test('authored gauges dim independently of the road lights, and restore the legacy cabin lamp on exit',()=>{
 const model=new T.Group(),workshop=new T.Group();
 const view=installVehiclePresentation(T,{vehicle:'pickup_3100',modelRoot:workshop,lods:[model]});
 const cockpit=new T.Group(),lamp=new T.PointLight();
 cockpit.add(lamp);
 const equipment=createAuthoredControlMounts(T,{illumination:lamp});
 try{
  equipment.attach(view.root,'pickup_3100');
  assert.equal(lamp.visible,false);
  const face=model.getObjectByName('RecessedPrintedFace').material;
  const needle=model.getObjectByName('TelemetryNeedle').material;
  view.update({phase:'night'});
  for(const power of [1,.25,0,1]){
   view.setLightMode('low',power);
   assert.equal(view.getInteriorDiagnostics().instrumentPower,power);
   assert.equal(view.getLightingDiagnostics().mode,'low');
   assert.equal(face.emissiveIntensity,.66*power);
   assert.equal(needle.emissiveIntensity,1.35*power);
  }
  view.setLightMode('position',.4);
  assert.equal(view.getInteriorDiagnostics().instrumentPower,.4);
  view.setLightMode('off',.8);
  assert.equal(face.emissiveIntensity,0);
  assert.equal(needle.emissiveIntensity,0);
  view.update({phase:'day'});
  assert.ok(face.emissiveIntensity>0);
  assert.equal(view.getInteriorDiagnostics().instrumentPower,0);
  equipment.attach(view.root,'chevy');
  assert.equal(lamp.visible,true);
  assert.equal(lamp.parent,cockpit);
 }finally{equipment.dispose();view.dispose();}
});

test('physical dirt responds to driving distance on the contacted surface',()=>{
 function dirtAfter120Steps(surface,contact){
  const session=createVehicleConditionSession({vehicleId:'chevy'});
  const snapshot={engine:{rpm:2200,torqueNm:100},chassis:{linearVelocity:[25,0,0]},wheels:Array.from({length:4},()=>({contact,surface}))};
  for(let tick=1;tick<=120;tick++)session.sample({tick,running:true,snapshot});
  return session.getCondition().dirt;
 }
 const asphalt=dirtAfter120Steps('asphalt',true),gravel=dirtAfter120Steps('gravel',true),mud=dirtAfter120Steps('mud',true);
 assert.ok(asphalt>0&&gravel>asphalt&&mud>gravel);
 assert.ok(gravel>.35);
 assert.equal(dirtAfter120Steps('gravel',false),0);
});

test('the legacy cockpit windshield shows persistent condition in dry weather and clears after service',()=>{
 const cabinMount=new T.Group(),windshield=createWeatherWindshield(T,{cabinMount});
 const update=values=>windshield.update({cameraMode:'cockpit',rain:0,active:true,...values});
 update({condition:{damage:.1,dirt:.01}});
 const pane=cabinMount.getObjectByName('AN_DropsOnCabinGlass');
 assert.equal(pane.visible,false);
 update({condition:{damage:.75,dirt:.62},paused:true});
 assert.equal(pane.visible,true);
 assert.equal(windshield.diagnostics().dropsVisible,false);
 assert.equal(windshield.diagnostics().phase,0);
 assert.equal(pane.material.uniforms.uGlassDamage.value,.75);
 assert.equal(pane.material.uniforms.uGlassDirt.value,.62);
 update({condition:{damage:.75,dirt:0},paused:true});
 assert.equal(pane.visible,true);
 assert.equal(pane.material.uniforms.uGlassDirt.value,0);
 update({paused:true});
 assert.equal(pane.visible,false);
 windshield.dispose();
});
