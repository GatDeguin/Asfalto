import {installVehicleInteriorRig} from './vehicle-interior-rig.mjs?v=50dd4e15c3f46e8d';
import {createVehicleConditionAppearance} from './vehicle-condition-appearance.mjs?v=b72eee12bc990a95';
import {thickenVehicleGlass} from './vehicle-glass.mjs?v=c333c48cb1235db7';
import {createVehicleChassis} from './vehicle-chassis.mjs?v=752fa30fc26ab306';
import {getVehicleDefinition} from './vehicle-catalog.mjs?v=1fb2dbf31facc389';
import {createVehicleLighting} from './vehicle-lighting.mjs?v=cbf59234f390cc3e';
import {createVehiclePhysicalCalibration} from './vehicle-physical-calibration.mjs?v=dc9a8e2b14a2b21c';
// Surface/animation presentation only. The physical chassis, collision hull,
// original wheel rig and independently saved cockpit remain caller-owned.
const IDS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
const CENTERS = Object.freeze({
  chevy: [[-.6231,-.1567,-.3187],[-.6229,-.1567,.316],[.4971,-.1566,-.3187],[.4972,-.1565,.3154]],
  falcon: [[-.63848,-.16527,-.3065],[-.63848,-.16527,.3065],[.50985,-.16537,-.3065],[.50985,-.16537,.3065]],
});
const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,finite(x)));
const approach=(x,target,dt,tau)=>x+(target-x)*(1-Math.exp(-dt/tau));

export function selectVehicleLod({projectedPixels=400,current=0,quality='high'}={}) {
  const px=Math.max(0,finite(projectedPixels,400));
  const high=quality==='eco'?300:210,low=quality==='eco'?115:75;
  if (current===0&&px>=high*.84)return 0;
  if (current===2&&px<=low*1.18)return 2;
  if (px>high*1.08)return 0;
  if (px<low*.88)return 2;
  return 1;
}

export function createVehiclePresentationState(vehicle='chevy') {
  let distanceM=0,dirt=0,wetness=0,brake=0,phase=0,rpm=0,speedMps=0,disposed=false;
  return {
    update(sample={}) {
      if(disposed)return false;
      if(sample.paused)return true;
      const dt=clamp(sample.dt,0,.1);speedMps=Math.abs(finite(sample.speedMps,speedMps));rpm=clamp(finite(sample.rpm,rpm),0,9000);
      const distance=Math.min(speedMps,120)*dt;distanceM+=distance;
      const surface=String(sample.surface||'asphalt');const rate=/gravel|dirt|sand|earth|banquina/i.test(surface)?.00038:/snow|mud/i.test(surface)?.00052:.000018;
      dirt=clamp(dirt+distance*rate*(1-clamp(sample.rain)*.28));
      const targetWet=clamp(finite(sample.wetness,finite(sample.rain,wetness)));
      wetness=approach(wetness,targetWet,dt,targetWet>wetness?2.1:40);
      brake=approach(brake,clamp(finite(sample.brake,brake)),dt,.075);
      phase=(phase+dt*rpm/60*Math.PI*2)% (Math.PI*2);
      return true;
    },
    reset(){if(disposed)return false;distanceM=dirt=wetness=brake=phase=rpm=speedMps=0;return true;},
    setPersistentCondition(value){if(disposed)return false;dirt=clamp(finite(value?.dirt)/100);return true;},
    setCondition(condition) {if(disposed)return false;if(condition==='clean'){dirt=0;wetness=0;}else if(condition==='used'){dirt=.48;wetness=0;}else if(condition==='wet'){dirt=.18;wetness=1;}else return false;return true;},
    diagnostics:()=>({vehicle,distanceM,dirt,wetness,brake,phase,rpm,speedMps,disposed}),
    dispose(){disposed=true;},
  };
}

function releaseModels(models,extraGeometries=[]) {
  const geometry=new Set(extraGeometries),material=new Set(),texture=new Set();
  for(const model of models)model?.traverse?.(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){material.add(m);for(const [key,value] of Object.entries(m))if(value?.isTexture&&key!=='envMap')texture.add(value);}});
  geometry.forEach(x=>x.dispose());material.forEach(x=>x.dispose());texture.forEach(x=>x.dispose());
}

export async function createVehiclePresentation(T,{vehicle='chevy',modelRoot,loadGlb,signal,lodLevels=[0,1,2],interiorReviewAsset=null,...options}={}) {
  if(typeof loadGlb!=='function')throw new TypeError('Vehicle presentation requires a complete GLB loader');
  if(!Array.isArray(lodLevels)||!(JSON.stringify(lodLevels)==='[0]'||JSON.stringify(lodLevels)==='[0,1,2]'))throw new TypeError('Vehicle LOD policy must be [0] or [0,1,2]');
  const lods=[];
  try {
    for(const level of (interiorReviewAsset?[0]:lodLevels)) {
      if(signal?.aborted)throw new DOMException('Vehicle presentation cancelled','AbortError');
      const url=new URL(interiorReviewAsset||`../../assets/vehicles/${vehicle}-lod${level}.glb`,import.meta.url);
      url.searchParams.set('v','400-review-r144-20260917');
      lods.push(await loadGlb(url.href,`${vehicle} exterior LOD ${level}`,signal));
    }
    if(vehicle==='chevy_400_1957'){
      const interior=await loadGlb(new URL('../../assets/cockpit/v8/400-detailed-interior.glb?v=a2a70bd1dedb3d8d',import.meta.url).href,'Interior detallado Chevrolet 400',signal);
      // Preserve the v8 exterior and replace only its old interior in the close LOD.
      const previous=lods[0].getObjectByName('Interior');if(previous)previous.visible=false;
      lods[0].add(interior);
    }
    if(signal?.aborted)throw new DOMException('Vehicle presentation cancelled','AbortError');
    return installVehiclePresentation(T,{vehicle,modelRoot,lods,...options});
  }catch(error){releaseModels(lods);throw error;}
}

export function installVehiclePresentation(T,{vehicle='chevy',modelRoot,lods,paintColor,initialCondition='clean',physicalCalibration=false,lightScene=null}={}) {
  const definition=getVehicleDefinition(vehicle),centers=definition?.centers||CENTERS[vehicle];
  if(!centers||!modelRoot?.add||!Array.isArray(lods)||![1,3].includes(lods.length))throw new TypeError('Vehicle presentation needs a vehicle root and one or three complete LODs');
  const conditionTransform=new T.Matrix4();if(definition?.conditionSpace){const cs=definition.conditionSpace;conditionTransform.makeScale(...cs.scale);conditionTransform.setPosition(...cs.offset);}
  paintColor=paintColor||definition?.defaultPaint;
  const state=createVehiclePresentationState(vehicle),appearance=createVehicleConditionAppearance(T),root=new T.Group();root.name=`${vehicle}_ApprovedExterior`;root.rotation.y=vehicle==='falcon'?Math.PI:0;
  const previous=[];modelRoot.traverse(o=>{if(o.isMesh)previous.push({object:o,visible:o.visible});});
  let disposed=false,lodIndex=0,hoodAmount=0,engineBayVisible=true,engineAncillariesVisible=true;const restCompression=new Map(),wheelDiagnostics={};
  const uniforms={vehiclePaint:{value:new T.Color(paintColor||(vehicle==='falcon'?'#761a2a':'#d66a24'))},vehicleDirt:{value:0},vehicleWet:{value:0},vehiclePaintWear:{value:0},vehicleBodyWear:{value:0},vehicleDamageFrontRear:{value:new T.Vector2()},vehicleDamageSidesRoof:{value:new T.Vector3()},vehicleDust:{value:new T.Color('#6c5740')}};
  let instrumentFuel=1;const steeringPivots=[],instrumentPivots=[];const steeringAxis=new T.Vector3(...(definition?.steeringAxis||[1,0,0])).normalize();
  const staticWiperNodes=[],engineBayAncillaryNodes=[],engineBayNodes=[],brakes=[],headlamps=[],flexible=[],hoods=[],tiers=[],materials=new Set(),replacedMaterials=new Set(),replacedGeometries=new Set();
  const colorValue=new T.Color(),worldPosition=new T.Vector3(),scaleVector=new T.Vector3();
  for(let level=0;level<lods.length;level++) {
    const model=lods[level];model.traverse(o=>{if(/_Primitive_/.test(o.name))return;if(o.userData?.system==='wiperHardware')staticWiperNodes.push(o);if(o.userData?.system==='engineBayAncillary'||/EngineBay_Ancillary/i.test(o.name))engineBayAncillaryNodes.push(o);else if(o.userData?.system==='engineBay'||/EngineBay(?:_|$)/i.test(o.name))engineBayNodes.push(o);});model.name=`${vehicle}_Exterior_LOD${level}`;root.add(model);model.updateMatrixWorld(true);
    const wheels=Object.fromEntries(IDS.map((id,i)=>{const pivot=new T.Group();pivot.name=`${vehicle}_${id}_PresentationPivot`;pivot.position.fromArray(centers[i]);model.add(pivot);return[id,pivot];}));
    const stationaryWheels=Object.fromEntries(IDS.map((id,i)=>{const pivot=new T.Group();pivot.name=`${vehicle}_${id}_StationaryBrakePivot`;pivot.position.fromArray(centers[i]);model.add(pivot);return[id,pivot];}));
    const pending=[];model.traverse(o=>{if(!o.isMesh)return;let owner=o;
      // glTF may instance one mesh (and its name) under several wheel nodes.
      // Animation ownership comes from the authored node, not a reused primitive.
      for(let ancestor=o;ancestor&&ancestor!==model;ancestor=ancestor.parent){if(ancestor.userData?.wheelId||ancestor.userData?.stationaryWheelId||ancestor.userData?.hoodHingeAuthored||(!/_Primitive_/.test(ancestor.name)&&/_wheel_|_hood_|_stationary_/i.test(ancestor.name)))owner=ancestor;}
      if(vehicle==='chevy_400_1957'&&/_hood_/i.test(owner.name))for(const material of Array.isArray(o.material)?o.material:[o.material])if(material&&/Black_lacquer/.test(material.name)){material.userData.advancedMaterials=false;material.roughnessMap=null;material.metalness=0;material.roughness=.42;material.clearcoat=.12;material.clearcoatRoughness=.38;material.clearcoatRoughnessMap=null;material.clearcoatNormalMap=null;material.envMapIntensity=.22;material.specularIntensity=.5;material.needsUpdate=true;}
      const name=owner.name;const stationary=!!owner.userData?.stationaryWheelId||/_stationary_/i.test(name);const wheelId=owner.userData?.wheelId||owner.userData?.stationaryWheelId||IDS.find(id=>name.includes(id));
      const hood=owner.userData?.hoodHingeAuthored||(/_hood_/i.test(name)?definition?.hoodHinge||[-.306,.093,0]:null);
      if(wheelId||hood)pending.push({owner,wheelId,hood,stationary});
      // This supplied revision bakes AO in TEXCOORD_1. The legacy loader exposes
      // that stream as uv2; Three r180 selects the second stream through uv1.
      if(vehicle==='chevy_400_1957'&&o.geometry?.attributes.uv2){o.geometry.setAttribute('uv1',o.geometry.attributes.uv2);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.aoMap){m.aoMap.channel=1;m.needsUpdate=true;}}
      if(/Glass/.test(o.material?.name)&&!definition?.preserveAuthoredMaterials){const original=thickenVehicleGlass(T,o,model);if(original)replacedGeometries.add(original);}
      o.castShadow=!/Glass/.test(o.material?.name);o.receiveShadow=true;
      if((Array.isArray(o.material)?o.material:[o.material]).some(m=>!/^SS250_/.test(m?.name||'')&&/Paint|StripeAtlas|Black_lacquer/.test(m?.name||''))&&!wheelId){appearance.add(o,new T.Matrix4().copy(conditionTransform).multiply(new T.Matrix4().copy(model.matrixWorld).invert().multiply(o.matrixWorld)));}
      const mapMaterial=m=>{if(!m)return m;
        // Some supplied GLBs share red lens material with cabin controls and
        // passive quarter reflectors. Only rear-facing tail assemblies emit.
        if(/BrakeLens/.test(m.name)){
          o.geometry.computeBoundingBox();
          const center=o.geometry.boundingBox.getCenter(new T.Vector3()).applyMatrix4(o.matrixWorld).applyMatrix4(new T.Matrix4().copy(model.matrixWorld).invert());
          if(center.x<.88){const passive=m.clone();passive.name=m.name.replace('BrakeLens','PassiveRed');passive.emissiveIntensity=0;materials.add(passive);return passive;}
        }
        if(/Paint|StripeAtlas|Black_lacquer/.test(m.name)){const clone=m.clone();clone.userData.vehicleAuthoredMatrix=new T.Matrix4().copy(conditionTransform).multiply(new T.Matrix4().copy(model.matrixWorld).invert().multiply(o.matrixWorld));replacedMaterials.add(m);materials.add(clone);return clone;}materials.add(m);return m;};
      o.material=Array.isArray(o.material)?o.material.map(mapMaterial):mapMaterial(o.material);
      if(/Mirror_|mirror|ExhaustTip|exhaust|Antenna|antenna/.test(name)&&!/Face|Stem|Hanger|Bore|Pipe/.test(name))flexible.push({object:owner,rotation:owner.rotation.clone(),position:owner.position.clone(),antenna:/antenna/i.test(name)});
    });
    const moved=new Set();
    for(const {owner,wheelId,hood,stationary} of pending){if(moved.has(owner))continue;moved.add(owner);if(wheelId)(stationary?stationaryWheels:wheels)[wheelId].attach(owner);else if(owner.userData?.steeringWheel){const pivot=new T.Group();pivot.name=`${vehicle}_SteeringWheel`;pivot.position.fromArray(definition.steeringCenterSource);model.add(pivot);pivot.attach(owner);steeringPivots.push(pivot);}else if(owner.userData?.instrumentType){const pivot=new T.Group();pivot.name=`${vehicle}_${owner.userData.instrumentType}_Needle`;pivot.position.fromArray(owner.userData.instrumentPivotAuthored);model.add(pivot);pivot.attach(owner);instrumentPivots.push({pivot,type:owner.userData.instrumentType,min:finite(owner.userData.instrumentMinAngle,Math.PI*.15),max:finite(owner.userData.instrumentMaxAngle,-Math.PI*1.15),range:finite(owner.userData.instrumentMaxValue,owner.userData.instrumentType==='speed'?(vehicle==='pickup_3100'?140:180):owner.userData.instrumentType==='rpm'?6000:1)});}else{const pivot=new T.Group();pivot.name=`${vehicle}_HoodHinge`;pivot.position.fromArray(hood);model.add(pivot);pivot.attach(owner);hoods.push(pivot);}}
    tiers.push({model,wheels,stationaryWheels});model.visible=level===0;
  }
  for(const m of materials) {
    if(/Glass/.test(m.name)&&!definition?.preserveAuthoredMaterials){m.transparent=true;m.opacity=1-Math.sqrt(1-.22);m.depthWrite=false;m.side=T.FrontSide;m.envMapIntensity=.85;}
    if(/BrakeLens/.test(m.name)){m.emissive?.set('#a0180e');m.emissiveIntensity=.12;brakes.push(m);}
    if(/Headlamp/.test(m.name)){m.emissive?.set('#fff0cc');headlamps.push(m);}
    if(/Chrome/.test(m.name)){m.metalness=1;if(!definition?.preserveAuthoredMaterials)m.roughness=.22;m.envMapIntensity=.92;}
    if(/Rubber/.test(m.name)){m.metalness=0;m.roughness=.83;}
    if(!/^SS250_/.test(m.name)&&/Paint|StripeAtlas|Black_lacquer/.test(m.name)) {
      const prior=m.onBeforeCompile,priorProgramKey=m.customProgramCacheKey?.call(m)??prior?.toString()??'',paint=/Paint/.test(m.name),atlas=/Atlas/.test(m.name);
      m.onBeforeCompile=shader=>{
        prior?.call(m,shader);Object.assign(shader.uniforms,uniforms);shader.uniforms.vehicleAuthoringMatrix={value:m.userData.vehicleAuthoredMatrix};
        shader.vertexShader='varying vec3 vehicleAuthoredPosition;\nuniform mat4 vehicleAuthoringMatrix;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvehicleAuthoredPosition = (vehicleAuthoringMatrix * vec4(position,1.0)).xyz;');
        shader.fragmentShader='varying vec3 vehicleAuthoredPosition;\nuniform vec3 vehiclePaint;\nuniform float vehicleDirt;\nuniform float vehicleWet;\nuniform vec3 vehicleDust;\nuniform float vehiclePaintWear;\nuniform float vehicleBodyWear;\nuniform vec2 vehicleDamageFrontRear;\nuniform vec3 vehicleDamageSidesRoof;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 vehicleSource = diffuseColor.rgb;
          float vehiclePigment = ${paint?(atlas&&vehicle==='chevy'?'max(smoothstep(1.5,2.4,vehicleSource.r/max(vehicleSource.g,.001))*smoothstep(1.4,2.1,vehicleSource.r/max(vehicleSource.b,.001)),smoothstep(.42,.75,min(vehicleSource.r,min(vehicleSource.g,vehicleSource.b))))':'1.0'):'0.0'};
          diffuseColor.rgb = mix(vehicleSource, vehiclePaint*.88, vehiclePigment);
          ${vehicle==='chevy'&&paint?`float vehicleSideBand = smoothstep(.304,.327,abs(vehicleAuthoredPosition.z))
            * (1.0-smoothstep(.900,.915,abs(vehicleAuthoredPosition.x)))
            * smoothstep(-.069,-.057,vehicleAuthoredPosition.y)*(1.0-smoothstep(.038,.049,vehicleAuthoredPosition.y));
          float vehicleStripe = smoothstep(-.046,-.044,vehicleAuthoredPosition.y)*(1.0-smoothstep(.023,.025,vehicleAuthoredPosition.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,mix(vehiclePaint*.85,vec3(.008,.010,.013),vehicleStripe),vehicleSideBand);
          vehiclePigment*=1.0-vehicleSideBand*vehicleStripe;`:''}
          float vehicleLow = 1.0-smoothstep(-.16,.015,vehicleAuthoredPosition.y);
          vec3 vehicleGrainPosition=vehicleAuthoredPosition*vec3(930.0,1300.0,910.0);
          float vehicleGrain = fract(sin(dot(floor(vehicleGrainPosition),vec3(12.9898,78.233,32.19)))*43758.5453);
          float vehicleFootprint=max(length(dFdx(vehicleGrainPosition)),length(dFdy(vehicleGrainPosition)));
          vehicleGrain=mix(.5,vehicleGrain,1.0-smoothstep(.5,1.5,vehicleFootprint));
          float vehicleDirtMask = vehicleDirt*vehicleLow*(.5+.5*smoothstep(.2,.75,vehicleGrain));
          diffuseColor.rgb=mix(diffuseColor.rgb,vehicleDust,vehicleDirtMask*.82);
          diffuseColor.rgb*=1.0-vehicleWet*.09;
          vec3 vp=vehicleAuthoredPosition;
          float vSide=max(vehicleDamageSidesRoof.x*(1.0-smoothstep(-.33,-.25,vp.z)),vehicleDamageSidesRoof.y*smoothstep(.25,.33,vp.z));
          float vEnd=max(vehicleDamageFrontRear.x*(1.0-smoothstep(-.9,-.62,vp.x)),vehicleDamageFrontRear.y*smoothstep(.62,.9,vp.x));
          float vRoof=vehicleDamageSidesRoof.z*smoothstep(.15,.25,vp.y);
          float vDamage=max(max(vSide,vEnd),vRoof)*max(vehicleBodyWear,.3);
          float vScratchWave=abs(sin(vp.y*690.0+sin(vp.x*23.0)*1.6+vp.z*8.0));
          float vScratch=1.0-smoothstep(.035,.14,vScratchWave);
          float vPatch=smoothstep(.42,.82,sin(vp.x*29.0+vp.z*37.0)*.5+.5);
          float vehicleAbrasion=clamp(vScratch*vPatch*(vehiclePaintWear*.75+vDamage*.85),0.0,1.0);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.26,.28,.29),vehicleAbrasion);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.25,.21),vehiclePaintWear*.10);

        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=clamp(roughnessFactor+(vehicleGrain-.5)*.032*vehiclePigment,0.0,1.0);
          roughnessFactor=mix(roughnessFactor,.76,max(vehicleAbrasion,vehiclePaintWear*.5));
          roughnessFactor=mix(roughnessFactor,.83,vehicleDirtMask*.6);
          roughnessFactor=mix(roughnessFactor,.17,vehicleWet*.7);
        `);
      };
      // Only these four branches change GLSL. Vehicle identity, color and matrices are uniforms.
      const surfaceVariant=!paint?'unpainted':vehicle==='chevy'?(atlas?'chevy-pigment-stripe':'chevy-stripe'):'paint';
      const programKey=JSON.stringify(['approved-vehicle-surface-v3',priorProgramKey,surfaceVariant]);
      m.customProgramCacheKey=()=>programKey;m.needsUpdate=true;
    }
  }
  replacedMaterials.forEach(m=>m.dispose());replacedGeometries.forEach(g=>g.dispose());
  modelRoot.add(root);previous.forEach(entry=>{entry.object.visible=false;});state.setCondition(initialCondition);
  const calibration=physicalCalibration?createVehiclePhysicalCalibration(T,{vehicle,root,modelRoot,tiers,spec:definition?.calibration}):null;
  const chassis=createVehicleChassis(T,{root,tiers,centers});let chassisInspection=null;
  const lighting=createVehicleLighting(T,{vehicle,root,scene:lightScene,headlamps,brakes,lampAnchor:definition?.lampAnchor});
  const interiorRig=installVehicleInteriorRig(T,{root,vehicle,lods});
  // Include newly installed instrument/trim materials and upholstery clones in environment updates.
  root.traverse(node=>{if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)materials.add(material);});
  const controller={
    root,
    getSteeringTargets:()=>interiorRig.getSteeringTargets(),
    getInteriorDiagnostics:()=>interiorRig.diagnostics(),
    getPedalTarget:type=>interiorRig.getPedalTarget(type),
    setChassisConfig(value){if(disposed)return false;const result=chassis.setConfiguration(value);calibration?.setChassisRadiusScale(chassis.diagnostics().radiusScale);return result;},
    getChassisSourceWheels:()=>chassis.sourceWheels(),getChassisInspectionMatrix:()=>chassis.inspectionMatrix(),
    setChassisInspection(value){chassisInspection=value;},
    setPaintColor(hex){if(disposed||typeof hex!=='string'||!/^#[a-f\d]{6}$/i.test(hex))return false;uniforms.vehiclePaint.value.set(hex);return true;},
    setEnvironment(texture){if(disposed||(texture!==null&&!texture?.isTexture))return false;chassis.setEnvironment(texture);for(const material of materials){if(material.envMap===texture)continue;material.envMap=texture;material.needsUpdate=true;}return true;},
    setPersistentCondition(condition){if(disposed)return false;appearance.set(condition);const c=appearance.diagnostics().condition;state.setPersistentCondition(c);instrumentFuel=c.fuel/100;uniforms.vehicleDirt.value=c.dirt/100;uniforms.vehiclePaintWear.value=1-c.paint/100;uniforms.vehicleBodyWear.value=1-c.body/100;uniforms.vehicleDamageFrontRear.value.set(c.damageZones.front,c.damageZones.rear);uniforms.vehicleDamageSidesRoof.value.set(c.damageZones.left,c.damageZones.right,c.damageZones.roof);return true;},
    setCondition(condition){const result=state.setCondition(condition);const now=state.diagnostics();uniforms.vehicleDirt.value=now.dirt;uniforms.vehicleWet.value=now.wetness;return result;},
    resetCondition(){if(disposed)return false;state.reset();uniforms.vehicleDirt.value=uniforms.vehicleWet.value=0;restCompression.clear();for(const item of flexible)item.object.rotation.copy(item.rotation);return true;},
    setEngineBayVisible(value,{includeAncillaries=false}={}){if(disposed)return false;engineBayVisible=!!value;engineBayNodes.forEach(node=>{node.visible=engineBayVisible;});if(includeAncillaries){engineAncillariesVisible=!!value;engineBayAncillaryNodes.forEach(node=>{node.visible=engineAncillariesVisible;});}return true;},
    setHoodOpen(amount){if(disposed)return false;hoodAmount=clamp(amount);hoods.forEach(p=>{p.rotation.z=-hoodAmount*1.04;});return true;},
    setActive(value){return lighting.setActive(value);},
    setHeadlights(on){return lighting.setMode(on?'low':'off');},
    setLightMode(mode){interiorRig.setLights(mode!=='off');return lighting.setMode(mode);},
    setLightingCalibration:value=>lighting.setCalibration(value),getLightingCalibration:()=>lighting.getCalibration(),getLightingDiagnostics:()=>lighting.diagnostics(),
    getRoadLightRig:()=>lighting.getRig(),
    getLights:()=>lighting.getLights(),
    update(sample={}) {
      if(disposed)return false;
      const snapshot=sample.snapshot||chassisInspection||{},controls=snapshot.controls||snapshot.input||{};
      state.update({...sample,speedMps:finite(sample.speedMps,finite(snapshot.speedMps,finite(snapshot.chassis?.speedMps))),rpm:finite(sample.rpm,finite(snapshot.engine?.rpm)),brake:finite(sample.brake,finite(controls.brake))});
      interiorRig.update(sample);
      for(const node of staticWiperNodes)node.visible=!physicalCalibration||sample.cameraMode!=='cockpit';
      if(sample.paused)return true;
      const now=state.diagnostics();uniforms.vehicleDirt.value=now.dirt;uniforms.vehicleWet.value=now.wetness;
      if(/lipan|sand|gravel/i.test(sample.surface||sample.trackId||''))uniforms.vehicleDust.value.set('#9c7151');else if(/garibaldi|mud/i.test(sample.trackId||''))uniforms.vehicleDust.value.set('#514e3c');else uniforms.vehicleDust.value.set('#6c5740');
      let px=sample.projectedPixels;
      if(!Number.isFinite(px)&&sample.camera){root.getWorldPosition(worldPosition);const distance=worldPosition.distanceTo(sample.camera.getWorldPosition(new T.Vector3()));px=4.8*finite(sample.viewportHeight,800)/(2*Math.tan(finite(sample.camera.fov,46)*Math.PI/360)*Math.max(distance,.1));}
      lodIndex=tiers.length===1?0:selectVehicleLod({projectedPixels:px,current:lodIndex,quality:sample.quality});tiers.forEach((tier,i)=>{tier.model.visible=i===lodIndex;});
      modelRoot.getWorldScale(scaleVector);const scale=Math.max(.001,scaleVector.y);
      for(const [i,id] of IDS.entries()){
        const wheel=snapshot.wheels?.find(w=>w.id===id)||{};const compression=finite(wheel.compressionM);if(!restCompression.has(id)&&Number.isFinite(wheel.compressionM))restCompression.set(id,compression);
        const rise=clamp(compression-finite(restCompression.get(id)), -.055,.055)/scale;
        const spin=finite(wheel.rotationRad),steer=id.startsWith('front')?-finite(wheel.steerAngleRad):0;
        for(const tier of tiers){const pivot=tier.wheels[id];pivot.rotation.order='YXZ';pivot.rotation.y=steer;pivot.rotation.z=spin;pivot.position.y=centers[i][1]+rise;const stationary=tier.stationaryWheels[id];stationary.rotation.y=steer;stationary.position.y=centers[i][1]+rise;}
        wheelDiagnostics[id]={spinRad:spin,steerRad:steer,suspensionOffsetM:rise*scale};
      }
      calibration?.update(snapshot);
      for(const item of flexible){const still=sample.reducedMotion||sample.editing;const wave=still?0:Math.sin(now.phase)*(now.rpm>0?.00045:0);item.object.rotation.x=item.rotation.x+wave*(item.antenna?4:1)+(item.antenna&&!still?Math.min(now.speedMps/1500,.045):0);}
      lighting.update({...sample,brake:now.brake});
      return true;
    },
    diagnostics:()=>({...state.diagnostics(),persistentCondition:appearance.diagnostics(),paintColor:'#'+uniforms.vehiclePaint.value.getHexString(),lod:lodIndex,chassis:chassis.diagnostics(),calibration:calibration?.diagnostics()||null,hoodAngleRad:hoodAmount*1.04,headlights:lighting.diagnostics().mode!=='off',lightMode:lighting.diagnostics().mode,lighting:lighting.diagnostics(),engineBayVisible,engineBayNodes:engineBayNodes.length,engineAncillariesVisible,engineBayAncillaryNodes:engineBayAncillaryNodes.length,wheels:{...wheelDiagnostics},sourceFrontAxis:'-X',presentationYawRad:root.rotation.y,materials:materials.size,drawMeshes:tiers.map(t=>{let count=0;t.model.traverse(o=>{if(o.isMesh)count++;});return count;})}),
    dispose(){if(disposed)return false;disposed=true;interiorRig.dispose();state.dispose();chassis.dispose();lighting.dispose();root.removeFromParent();previous.forEach(({object,visible})=>{object.visible=visible;});releaseModels(lods,appearance.originalGeometries());appearance.dispose();return true;},
  };
  controller.update({dt:0});return controller;
}
