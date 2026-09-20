import {sanitizeLightingOverrides,LUT_DEFAULTS} from '../game/lighting-presets.mjs?v=746ea306bd370d04';
import {VEHICLE_LIGHT_CALIBRATION_DEFAULTS} from './vehicle-lighting.mjs?v=cbf59234f390cc3e';
const degrees=v=>((v*180/Math.PI+180)%360+360)%360-180;
const hex=color=>'#'+color.getHexString();
export const VEHICLE_LIGHT_DEFAULTS=VEHICLE_LIGHT_CALIBRATION_DEFAULTS;
// Calibration null means mode/quality-controlled. Read the real projectors for
// display, without copying their transient low/high state into saved overrides.
export function captureVehicleLightingState(controllers={}){
 const result={};
 for(const id of ['player','rival']){
  const controller=controllers[id],beams=controller?.getLights?.()||[],first=beams[0];
  const calibration={...VEHICLE_LIGHT_DEFAULTS,...controller?.getLightingCalibration?.()};
  const shadows=beams.filter(l=>l.castShadow).length;
  result[id]={available:!!first,mode:controller?.getLightingDiagnostics?.().mode||'off',
   values:{...calibration,color:first?hex(first.color):null,angleDeg:first?first.angle*180/Math.PI:null,penumbra:first?.penumbra??null,decay:first?.decay??calibration.decay,castShadow:first?(shadows===beams.length?true:shadows===0?false:null):null},
   beams:{count:beams.length,visible:beams.filter(l=>l.visible).length,shadows}};
 }
 return result;
}
export function captureLightingState(scene,renderer,lights){
 const state={hdri:{backgroundIntensity:scene.backgroundIntensity??1,environmentIntensity:scene.environmentIntensity??1,exposure:renderer.toneMappingExposure,backgroundBlurriness:scene.backgroundBlurriness??0,rotation:[scene.backgroundRotation?.x||0,scene.backgroundRotation?.y||0,scene.backgroundRotation?.z||0].map(degrees),environmentRotation:[scene.environmentRotation?.x||0,scene.environmentRotation?.y||0,scene.environmentRotation?.z||0].map(degrees)},lights:{},vehicles:{player:{...VEHICLE_LIGHT_DEFAULTS},rival:{...VEHICLE_LIGHT_DEFAULTS}},lut:{...LUT_DEFAULTS}};
 for(const {id,object:l}of lights){const value={enabled:l.visible,intensity:l.intensity,color:hex(l.color),position:l.position.toArray()};if(l.groundColor)value.groundColor=hex(l.groundColor);if(l.target)value.target=l.target.position.toArray();if(l.shadow){value.castShadow=l.castShadow;value.shadowBias=l.shadow.bias;value.shadowNormalBias=l.shadow.normalBias;}for(const k of ['distance','decay','penumbra'])if(Number.isFinite(l[k]))value[k]=l[k];if(Number.isFinite(l.angle))value.angleDeg=l.angle*180/Math.PI;state.lights[id]=value;}
 if(scene.fog?.isFogExp2)state.fog={color:hex(scene.fog.color),density:scene.fog.density};return state;
}
export function mergeLightingState(base,overrides){const value=structuredClone(base);for(const[group,settings]of Object.entries(overrides)){if(group==='lights'||group==='vehicles'){value[group]??={};for(const[id,fields]of Object.entries(settings))value[group][id]={...value[group][id],...structuredClone(fields)};}else value[group]={...value[group],...structuredClone(settings)};}return value;}
export function applyLightingState(scene,renderer,lights,state){
 const h=state.hdri;scene.backgroundIntensity=h.backgroundIntensity;scene.environmentIntensity=h.environmentIntensity;scene.backgroundBlurriness=h.backgroundBlurriness;renderer.toneMappingExposure=h.exposure;scene.backgroundRotation?.set(...h.rotation.map(v=>v*Math.PI/180));scene.environmentRotation?.set(...h.environmentRotation.map(v=>v*Math.PI/180));
 for(const {id,object:l}of lights){const s=state.lights[id];if(!s)continue;l.visible=s.enabled;l.intensity=s.intensity;l.color.set(s.color);l.position.fromArray(s.position);if(s.groundColor&&l.groundColor)l.groundColor.set(s.groundColor);if(s.target&&l.target){l.target.position.fromArray(s.target);l.target.updateMatrixWorld();}if(l.shadow){l.castShadow=s.castShadow;l.shadow.bias=s.shadowBias;l.shadow.normalBias=s.shadowNormalBias;l.shadow.needsUpdate=true;}for(const k of ['distance','decay','penumbra'])if(s[k]!==undefined)l[k]=s[k];if(s.angleDeg!==undefined)l.angle=s.angleDeg*Math.PI/180;l.updateMatrixWorld();}
 if(state.fog&&scene.fog?.isFogExp2){scene.fog.color.set(state.fog.color);scene.fog.density=state.fog.density;}
}
export function validatedLightingState(base,overrides){return mergeLightingState(base,sanitizeLightingOverrides(overrides));}
