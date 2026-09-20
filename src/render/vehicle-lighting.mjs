// Projectors are scene-owned so cockpit hiding the exterior cannot hide the road light.
const MODES=Object.freeze({off:{candela:0,rangeM:0,angle:.32,aimM:40,dropM:.8,lens:0,tail:0},position:{candela:0,rangeM:0,angle:.32,aimM:40,dropM:.8,lens:.18,tail:.13},low:{candela:6200,rangeM:100,angle:.34,aimM:40,dropM:.82,lens:1.35,tail:.16},high:{candela:14500,rangeM:185,angle:.21,aimM:120,dropM:.45,lens:2.15,tail:.16}});
export const VEHICLE_LIGHT_MODES=Object.freeze(Object.keys(MODES));
export const VEHICLE_LIGHT_CALIBRATION_DEFAULTS=Object.freeze({enabled:true,intensityScale:1,color:null,distanceScale:1,angleDeg:null,penumbra:null,decay:2,castShadow:null,aimHorizontalDeg:0,aimVerticalDeg:0});
const CALIBRATION_LIMITS={intensityScale:[0,5],distanceScale:[.1,3],angleDeg:[1,80],penumbra:[0,1],decay:[0,4],aimHorizontalDeg:[-30,30],aimVerticalDeg:[-20,20]};
function calibrated(value,previous){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(!Object.keys(value).length)return {...VEHICLE_LIGHT_CALIBRATION_DEFAULTS};
 const next={...previous};for(const [key,range]of Object.entries(CALIBRATION_LIMITS))if(key in value){if(value[key]===null&&VEHICLE_LIGHT_CALIBRATION_DEFAULTS[key]===null)next[key]=null;else if(Number.isFinite(value[key]))next[key]=Math.max(range[0],Math.min(range[1],value[key]));}
 if(typeof value.enabled==='boolean')next.enabled=value.enabled;
 if(value.castShadow===null||typeof value.castShadow==='boolean')next.castShadow=value.castShadow;
 if(value.color===null)next.color=null;else if(typeof value.color==='string'&&/^#[a-f\d]{6}$/i.test(value.color))next.color=value.color.toLowerCase();
 return next;
}

export function vehicleLightConfiguration(mode='off'){return MODES[mode]?{...MODES[mode]}:null;}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
function texture(T,kind){
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.hypot(u,v),i=(y*n+x)*4;
  const edge=clamp((1-r)*8),cut=kind==='low'?clamp((.015+.045*Math.max(0,u)-v)*50):1;
  const value=Math.exp(-r*r*(kind==='glare'?5:1.8))*edge*cut;
  data[i]=data[i+1]=data[i+2]=kind==='glare'?255:Math.round(255*value);data[i+3]=kind==='glare'?Math.round(255*value):255;
 }
 const map=new T.DataTexture(data,n,n,T.RGBAFormat);map.minFilter=map.magFilter=T.LinearFilter;map.needsUpdate=true;return map;
}
export function createVehicleLighting(T,{vehicle,root,scene,headlamps=[],brakes=[],lampAnchor=[-.963,.006,.267]}={}){
 let mode='off',beamMode='low',nightAmount=0,disposed=false,active=true,brake=0,lastQuality='balanced',calibration={...VEHICLE_LIGHT_CALIBRATION_DEFAULTS};const headlampColors=new Map(headlamps.map(m=>[m,m.emissive?.clone()]));const filament={candela:0,lens:0,tail:0};const beams=[],halos=[],maps=[];
 const origin=new T.Vector3(),forward=new T.Vector3(),up=new T.Vector3(),toCamera=new T.Vector3(),target=new T.Vector3(),aimForward=new T.Vector3(),aimRight=new T.Vector3();
 let rig=null;
 if(scene?.add){
  rig=new T.Group();rig.name=vehicle+'_RoadLightRig';scene.add(rig);
  const low=texture(T,'low'),high=texture(T,'high'),glare=texture(T,'glare');maps.push(low,high,glare);
  for(const side of [-1,1]){
   const light=new T.SpotLight(0xffedcc,0,100,.34,.5,2);light.name=vehicle+'_Headlight_'+side;light.visible=false;light.target=new T.Object3D();light.shadow.mapSize.set(512,512);light.shadow.camera.near=.1;light.shadow.bias=-.0002;light.shadow.normalBias=.02;light.userData.side=side;light.userData.excludeFromCameraInterior=vehicle!=='falcon';light.userData.lowMap=low;light.userData.highMap=high;rig.add(light,light.target);beams.push(light);
   const material=new T.SpriteMaterial({map:glare,color:0xffecc2,transparent:true,opacity:0,blending:T.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false});const halo=new T.Sprite(material);halo.name=vehicle+'_HeadlightGlare_'+side;halo.visible=false;rig.add(halo);halos.push(halo);
  }
 }
 function apply(){
  const gain=active?1:0,beamGain=gain*(calibration.enabled?calibration.intensityScale:0);
  const c=MODES[beamMode];for(const m of headlamps){m.emissiveIntensity=beamGain*filament.lens*(1+nightAmount*.45);if(m.emissive){if(calibration.color)m.emissive.set(calibration.color);else if(headlampColors.get(m))m.emissive.copy(headlampColors.get(m));}}
  for(const m of brakes)m.emissiveIntensity=gain*(filament.tail*(1+nightAmount*.3)+brake*(1.15+nightAmount*.30));
  // Keep shader light/shadow counts stable across beam modes; dark beams retain their maps without rendering them.
  for(const [i,light]of beams.entries()){light.visible=active&&calibration.enabled;light.intensity=beamGain*filament.candela;light.color.set(calibration.color||0xffedcc);light.distance=c.rangeM*calibration.distanceScale;light.angle=calibration.angleDeg===null?c.angle:calibration.angleDeg*Math.PI/180;light.penumbra=calibration.penumbra??(beamMode==='high'?.65:.38);light.decay=calibration.decay;light.map=beamMode==='high'?light.userData.highMap:light.userData.lowMap;light.castShadow=light.visible&&lastQuality!=='eco'&&(calibration.castShadow??i===0);const shadowActive=light.castShadow&&light.intensity>0;if(shadowActive&&!light.shadow.autoUpdate)light.shadow.needsUpdate=true;if(!shadowActive)light.shadow.needsUpdate=false;light.shadow.autoUpdate=shadowActive;light.shadow.camera.far=Math.max(1,light.distance);halos[i].visible=beamGain>0&&filament.lens>.002;}
 }
 const api={
  getLights:()=>beams.slice(),
  getCalibration:()=>({...calibration}),
  setCalibration(value={}){if(disposed)return false;const next=calibrated(value,calibration);if(!next)return false;calibration=next;apply();return true;},
  setActive(value){if(disposed)return false;active=!!value;apply();return true;},
  getRig:()=>rig,
  setMode(value){if(disposed||!MODES[value])return false;mode=value;if(value==='low'||value==='high')beamMode=value;apply();return true;},
  update(sample={}){
   if(disposed)return false;
   active=sample.active!==false;if(typeof sample.quality==='string')lastQuality=sample.quality;
   nightAmount=Number.isFinite(sample.nightAmount)?clamp(sample.nightAmount):/night|noche/i.test(sample.phase||'')?1:/dusk|dawn|amanecer|atardecer/i.test(sample.phase||'')?.55:0;
   brake=clamp(sample.brake);const dt=clamp(Number.isFinite(sample.dt)?sample.dt:1/60,0,.1);for(const key of Object.keys(filament)){const goal=MODES[mode][key],tau=goal>filament[key]?.08:.12;filament[key]+=(goal-filament[key])*(1-Math.exp(-dt/tau));if(Math.abs(filament[key]-goal)<.0001)filament[key]=goal;}apply();if(!rig)return true;
   root.updateWorldMatrix(true,false);forward.set(-1,0,0).transformDirection(root.matrixWorld);up.set(0,1,0).transformDirection(root.matrixWorld);const c=MODES[beamMode];
   for(const [i,light]of beams.entries()){
    origin.set(lampAnchor[0],lampAnchor[1],light.userData.side*lampAnchor[2]).applyMatrix4(root.matrixWorld);light.position.copy(origin);aimForward.copy(forward).applyAxisAngle(up,-calibration.aimHorizontalDeg*Math.PI/180);aimRight.crossVectors(aimForward,up).normalize();target.copy(aimForward).multiplyScalar(c.aimM).addScaledVector(up,-c.dropM).applyAxisAngle(aimRight,calibration.aimVerticalDeg*Math.PI/180).add(origin);light.target.position.copy(target);light.shadow.camera.up.copy(up);
    const halo=halos[i];halo.visible=active&&calibration.enabled&&calibration.intensityScale>0&&sample.allowGlare!==false&&filament.lens>.002;halo.position.copy(origin).addScaledVector(forward,.015);halo.scale.setScalar((mode==='position'?.15:.24)+nightAmount*(mode==='position'?.12:.28));
    let facing=0;if(sample.camera){sample.camera.getWorldPosition(toCamera);toCamera.sub(origin).normalize();facing=Math.pow(clamp((forward.dot(toCamera)-.35)/.65),5);}
    halo.material.opacity=calibration.intensityScale*facing*(mode==='position'?.10:.34)*(1+nightAmount*.65)*clamp(filament.lens/(mode==='position'?.18:MODES[beamMode].lens));
   }
   rig.updateMatrixWorld(true);return true;
  },
  diagnostics:()=>({mode,active,nightAmount,filament:{...filament},filamentOnTauS:.08,filamentOffTauS:.12,projectorsActive:!!rig&&!disposed,beamCount:beams.length,visibleBeams:beams.filter(l=>l.visible&&l.intensity>0).length,...MODES[mode],candela:MODES[mode].candela*(active&&calibration.enabled?calibration.intensityScale:0),rangeM:MODES[mode].rangeM*calibration.distanceScale,angle:calibration.angleDeg===null?MODES[mode].angle:calibration.angleDeg*Math.PI/180,calibration:{...calibration},origins:beams.map(l=>l.position.toArray()),targets:beams.map(l=>l.target.position.toArray()),hiddenExteriorStillLit:root.visible===false&&beams.some(l=>l.visible&&l.intensity>0),disposed}),
  dispose(){if(disposed)return false;active=false;apply();disposed=true;for(const l of beams){l.shadow.map?.dispose();l.dispose?.();}for(const h of halos)h.material.dispose();maps.forEach(t=>t.dispose());rig?.removeFromParent();return true;}
 };apply();return api;
}
