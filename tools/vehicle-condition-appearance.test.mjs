import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {damageDisplacement,createVehicleConditionAppearance} from '../src/render/vehicle-condition-appearance.mjs?v=c2ea69acda3ee7c3';
import {installVehiclePresentation} from '../src/render/vehicle-presentation.mjs?v=a91aa1f0755040d1';
import {createVehicleMaintenance} from '../src/game/vehicle-maintenance.mjs?v=56be296de9a809d6';
import {createVehicleConditionSession} from '../src/game/vehicle-condition.mjs?v=90a703f379ef0e55';
import {createWeatherWindshield} from '../src/render/weather-windshield.mjs?v=b0d766ee92317059';
import {installClassicCabinTrim} from '../src/render/classic-cabin-trim.mjs?v=ca49ae66900d0ed1';
import {createAuthoredControlMounts} from '../src/render/authored-control-mounts.mjs?v=2cb0605f3be95739';

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

test('pickup pedals use live inputs and leave their fitted brackets fixed',()=>{
 const model=new T.Group();
 const underbody=new T.Group();
 underbody.name='pickup_3100_static_C3100_UnderbodyBlackened';model.add(underbody);
 const donorMaterial=new T.MeshStandardMaterial();
 const floor=new T.Mesh(new T.BoxGeometry(.50,.02,.62),donorMaterial);
 floor.position.set(0,-.1373,0);underbody.add(floor);
 const firewall=new T.Mesh(new T.BoxGeometry(.02,.22,.61),donorMaterial);
 firewall.position.set(-.236,.018,0);underbody.add(firewall);
 const view=installVehiclePresentation(T,{vehicle:'pickup_3100',modelRoot:new T.Group(),lods:[model]});
 try{
  const diagnostics=()=>view.getInteriorDiagnostics().surfaces;
  assert.equal(diagnostics().floor,2);
  assert.deepEqual(diagnostics().pedals.map(({key})=>key),['clutch','brake','throttle']);
  const pivot=model.getObjectByName('Pickup_brake_PedalPivot'),bracket=pivot.parent;
  const anchor=bracket.position.clone(),bracketRotation=bracket.quaternion.clone();
  view.update({snapshot:{controls:{throttle:.5,brake:1},clutch:{engagement:.75}}});
  assert.deepEqual(diagnostics().pedals.map(({angle})=>angle),[-.27*.25,-.27,.29*.5]);
  assert.ok(bracket.position.equals(anchor)&&bracket.quaternion.equals(bracketRotation));
  view.update({snapshot:{controls:{throttle:0,brake:0},clutch:{engagement:1}}});
  assert.ok(diagnostics().pedals.every(({angle})=>angle===0));
 }finally{view.dispose();}
 assert.equal(model.getObjectByName('ClassicCabinUpholstery'),undefined);
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

test('the 3100 seats the original controls on its fascia and restores them when leaving the cockpit',()=>{
 const cockpit=new T.Group(),root=new T.Group(),dash=new T.Group();
 dash.name='pickup_3100_Exterior_LOD0';dash.rotation.y=.12;root.add(dash);
 const material=new T.MeshBasicMaterial();
 function mesh(parent,name,size,position){
  const part=new T.Mesh(new T.BoxGeometry(...size),material);
  part.name=name;part.position.fromArray(position);parent.add(part);return part;
 }
 mesh(dash,'pickup_3100_static_C3100_Paint_Turquoise',[.02,.09,.65],[-.155,.168,0]);
 const lights=new T.Group(),ignition=new T.Group(),radio=new T.Group();
 cockpit.add(lights,ignition,radio);
 lights.position.set(-.5,.25,.4);radio.scale.setScalar(2);
 const knob=mesh(lights,'Flared_Trapezoid_Knob',[.04,.03,.01],[0,0,.025]);
 mesh(lights,'Retaining_Nut',[.03,.03,.01],[0,0,0]);
 mesh(ignition,'ignition-lock-root',[.04,.04,.01],[0,0,0]);
 mesh(ignition,'ignition-rotor',[.02,.02,.01],[0,0,.007]);
 mesh(radio,'FACEPLATE',[.30,.06,.02],[0,0,.005]);
 const screen=mesh(radio,'DISPLAY_SURFACE',[.15,.03,.003],[0,0,.017]);
 const equipment=createAuthoredControlMounts(T,{lights,ignition,radio});
 try{
  for(let pass=0;pass<2;pass++){
   equipment.attach(root,'pickup_3100');
   const [light,key,receiver]=equipment.diagnostics().placements;
   assert.ok([light,key,receiver].every(control=>control.supported));
   assert.ok(light.point[2]>key.point[2]&&key.point[2]>receiver.point[2]);
   assert.ok(receiver.point[1]>light.point[1]&&light.point[1]>key.point[1]);
   root.updateWorldMatrix(true,true);
   assert.ok(dash.worldToLocal(knob.getWorldPosition(new T.Vector3())).x>-.145);
   assert.ok(dash.worldToLocal(screen.getWorldPosition(new T.Vector3())).x>-.14);
   assert.equal(root.getObjectsByProperty('name','FunctionalCockpitEquipment').length,1);
   assert.equal(root.getObjectsByProperty('name','Speaker grille slat').length,4);
  }
  equipment.attach(root,'chevy');
  assert.equal(root.getObjectByName('FunctionalCockpitEquipment'),undefined);
  assert.ok([lights,ignition,radio].every(control=>control.parent===cockpit));
  assert.deepEqual(lights.position.toArray(),[-.5,.25,.4]);
  assert.deepEqual(radio.scale.toArray(),[2,2,2]);
 }finally{equipment.dispose();}
});

test('the Bel Air has two spokes and one horn ring on the live steering pivot',()=>{
 const model=new T.Group(),workshop=new T.Group();
 const chrome=new T.Group();
 chrome.name='belair_1957_steeringWheel_True_BA57_Chrome';chrome.userData.steeringWheel=true;
 chrome.add(new T.Mesh(new T.BoxGeometry(.03,.1,.1),new T.MeshStandardMaterial()));
 const ivory=chrome.clone();ivory.name='belair_1957_steeringWheel_True_BA57_Upholstery_Ivory';
 model.add(chrome,ivory);
 const view=installVehiclePresentation(T,{vehicle:'belair_1957',modelRoot:workshop,lods:[model]});
 try{
  const wheel=model.getObjectByName('BelAir2434_SteeringDetail');
  assert.equal(wheel?.getObjectsByProperty('name','BelAir2434_Spoke').length,2);
  assert.ok(wheel.getObjectByName('BelAir2434_HornRing'));
  assert.equal(chrome.visible,false);
  assert.equal(ivory.visible,true);
  assert.equal(wheel.parent,ivory.parent);
  const rest=wheel.parent.quaternion.clone();
  view.update({snapshot:{controls:{steer:.3}}});
  assert.ok(rest.angleTo(wheel.parent.quaternion)>1);
 }finally{view.dispose();}
 assert.equal(chrome.visible,true);
 assert.equal(model.getObjectByName('BelAir2434_SteeringDetail'),undefined);
});

test('the Delco front preserves seven clickable radio controls and restores the donor on swap',()=>{
 const cockpit=new T.Group(),model=new T.Group(),radio=new T.Group();
 const material=new T.MeshBasicMaterial(),geometry=new T.BoxGeometry(.1,.05,.01);
 const legacy=new T.Mesh(geometry,material);legacy.name='FACEPLATE';radio.add(legacy);cockpit.add(radio);
 const names=['POWER_VOLUME','PREVIOUS','REWIND','PLAY_PAUSE','FORWARD','NEXT','TUNING_SEEK'];
 const controls=names.map((name,index)=>{
  const control=new T.Group();control.name='CTRL_'+name;control.position.set(index*.01,-.01,.07);
  control.userData.radioBasePosition=control.position.clone();
  control.add(new T.Mesh(geometry,material));radio.add(control);return control;
 });
 const equipment=createAuthoredControlMounts(T,{radio});
 try{
  for(let pass=0;pass<2;pass++){
   equipment.attach(model,'pickup_3100');
   const dial=radio.getObjectByName('Delco986443_Dial');
   assert.ok(dial);
   assert.equal(legacy.visible,false);
   for(const control of controls){
    assert.equal(control.children[0].visible,false);
    assert.equal(control.children.filter(child=>child.visible).length,1);
    assert.ok(control.position.y>dial.position.y);
   }
   assert.equal(radio.getObjectsByProperty('name','Delco986443_Dial').length,1);
  }
  equipment.attach(model,'chevy');
  assert.equal(radio.getObjectByName('Delco986443_Dial'),undefined);
  assert.equal(legacy.visible,true);
  for(const [index,control] of controls.entries()){
   assert.deepEqual(control.userData.radioBasePosition.toArray(),[index*.01,-.01,.07]);
   assert.ok(control.position.equals(control.userData.radioBasePosition));
   assert.equal(control.children.length,1);
   assert.equal(control.children[0].visible,true);
  }
 }finally{equipment.dispose();}
});

test('the SS 250 seats its radio above the grille and can swap between the three period faces',()=>{
 const cockpit=new T.Group(),root=new T.Group(),dash=new T.Group(),belAir=new T.Group(),radio=new T.Group();
 dash.name='SS250_DashboardAssembly';root.add(dash);cockpit.add(radio);
 belAir.name='belair_1957_Exterior_LOD0';root.add(belAir);
 const material=new T.MeshBasicMaterial();
 function mesh(parent,name,size,position){
  const part=new T.Mesh(new T.BoxGeometry(...size),material);
  part.name=name;part.position.fromArray(position);parent.add(part);return part;
 }
 mesh(dash,'SS250_FormedSteelDash',[1.45,.06,.36],[0,.026,0]);
 const grip=mesh(dash,'SS250_RadioControlGrip',[.020,.008,.020],[.085,.070,-.036]);
 const grille=mesh(dash,'SS250_SpeakerGrille',[.236,.009,.040],[.190,.044,.024]);
 const fascia=mesh(belAir,'belair_1957_static_BA57_Paint_Turquoise',[.02,.09,.65],[-.114,.071,0]);
 const donor=mesh(belAir,'belair_1957_radioDonor_BA57_Chrome',[.007,.024,.090],[-.098,.068,.016]);
 const original=mesh(radio,'FACEPLATE',[.200,.060,.010],[0,0,.073]);
 mesh(radio,'DISPLAY_SURFACE',[.096,.019,.001],[0,.007,.085]);
 const names=['POWER_VOLUME','PREVIOUS','REWIND','PLAY_PAUSE','FORWARD','NEXT','TUNING_SEEK'];
 const controls=names.map((name,index)=>{
  const control=new T.Group();control.name='CTRL_'+name;control.position.set(index*.01,-.018,.079);
  control.userData.radioBasePosition=control.position.clone();
  mesh(control,'Original input mesh',[.012,.012,.010],[0,0,0]);radio.add(control);return control;
 });
 const equipment=createAuthoredControlMounts(T,{radio});
 try{
  for(let pass=0;pass<2;pass++){
   equipment.attach(root,'chevy_400_1957');
   const dial=radio.getObjectByName('SS250_RadioAnalogDial');
   const needle=radio.getObjectByName('SS250_RadioNeedle');
   assert.ok(dial&&needle);
   assert.equal(original.visible,false);
   assert.equal(grip.visible,false);
   assert.equal(grille.visible,true);
   assert.equal(root.getObjectByName('Radio inset'),undefined);
   assert.equal(equipment.diagnostics().placements[0].supported,true);
   assert.equal(radio.getObjectsByProperty('name','SS250_RadioAnalogDial').length,1);
   const volume=dash.worldToLocal(controls[0].getWorldPosition(new T.Vector3()));
   assert.ok(Math.abs(volume.x-grip.position.x)<.001&&Math.abs(volume.z-grip.position.z)<.001);
   for(const control of controls.slice(1,-1)){
    assert.ok(control.position.y<dial.position.y);
    assert.ok(control.getObjectByName('SS250_RadioPreset')?.visible);
    assert.equal(control.getObjectByName('Original input mesh').visible,false);
   }
   const standby=dial.material.emissiveIntensity;
   radio.userData.updateRadioFace({powered:true,tracks:[{},{}],currentIndex:0});
   const first=needle.position.x;
   radio.userData.updateRadioFace({powered:true,tracks:[{},{}],currentIndex:1});
   assert.ok(needle.position.x>first&&dial.material.emissiveIntensity>standby);
  }
  equipment.attach(root,'pickup_3100');
  assert.equal(radio.getObjectByName('SS250_RadioAnalogDial'),undefined);
  assert.ok(radio.getObjectByName('Delco986443_Dial'));
  assert.equal(grip.visible,true);
  for(let pass=0;pass<2;pass++){
   equipment.attach(root,'belair_1957');
   const dial=radio.getObjectByName('Delco987575_Dial');
   const needle=radio.getObjectByName('Delco987575_Needle');
   assert.ok(dial&&needle);
   assert.equal(radio.getObjectByName('Delco986443_Dial'),undefined);
   assert.equal(radio.getObjectsByProperty('name','Delco987575_Dial').length,1);
   assert.equal(root.getObjectByName('Radio inset'),undefined);
   assert.equal(original.visible,false);
   assert.equal(donor.visible,false);
   assert.equal(fascia.visible,true);
   assert.equal(equipment.diagnostics().placements[0].supported,true);
   for(const control of controls.slice(1,-1)){
    assert.ok(control.position.y<dial.position.y);
    assert.ok(control.getObjectByName('Delco987575_Preset')?.visible);
    assert.equal(control.getObjectByName('Original input mesh').visible,false);
   }
   for(const control of [controls[0],controls.at(-1)]){
    assert.ok(Math.abs(control.position.x)>Math.abs(controls[1].position.x));
    assert.ok(control.getObjectByName('Delco987575_Knob')?.visible);
   }
   const tracks=[{},{}];
   radio.userData.updateRadioFace({powered:false,tracks,currentIndex:0});
   const first=needle.position.x,standby=dial.material.emissiveIntensity;
   radio.userData.updateRadioFace({powered:true,tracks,currentIndex:1});
   assert.ok(needle.position.x>first&&dial.material.emissiveIntensity>standby);
  }
  equipment.attach(root,'chevy');
  assert.equal(radio.getObjectByName('Delco987575_Dial'),undefined);
  assert.equal(donor.visible,true);
  assert.equal(radio.userData.updateRadioFace,undefined);
  assert.equal(original.visible,true);
  for(const [index,control] of controls.entries()){
   assert.deepEqual(control.position.toArray(),[index*.01,-.018,.079]);
   assert.ok(control.position.equals(control.userData.radioBasePosition));
   assert.equal(control.children.length,1);
  }
 }finally{equipment.dispose();}
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
