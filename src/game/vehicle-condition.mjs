import {VEHICLE_CATALOG} from '../render/vehicle-catalog.mjs?v=body-r2-20260916';
import {createFuelObserver} from './fuel-observer.mjs';
export const VEHICLE_CONDITION_KEYS=Object.freeze(['engine','oil','brakes','tires','body','paint','fuel','steering','suspension','drivetrain','gearbox']);
export const VEHICLE_IDS=Object.freeze(['chevy',...Object.values(VEHICLE_CATALOG).filter(v=>v.selectable||v.supportsPersistentCondition).map(v=>v.id)]);
const ZONES=['front','rear','left','right','roof'],WHEELS=['frontLeft','frontRight','rearLeft','rearRight'];
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
const copy=value=>structuredClone(value);
const mechanicalTemplate=()=>({body:{frontCondition:1,sideCondition:1,undersideCondition:1},steering:{condition:1,offsetRad:0},suspension:Object.fromEntries(WHEELS.map(id=>[id,{condition:1}])),tires:Object.fromEntries(WHEELS.map(id=>[id,{condition:1,pressureRatio:1}])),brakes:{condition:1,fade:0},drivetrain:{condition:1},gearbox:{condition:1,shiftReliability:1},engine:{condition:1,powerFactor:1,coolingCondition:1,fire:false,fireIntensity:0,heatExposureSeconds:0,fuelLeak:0}});
function sanitizeMechanical(raw,template=mechanicalTemplate()){
 const out={};for(const[key,defaultValue]of Object.entries(template)){
  const value=raw?.[key];if(typeof defaultValue==='object')out[key]=sanitizeMechanical(value,defaultValue);
  else if(typeof defaultValue==='boolean')out[key]=value===true;
  else out[key]=clamp(finite(value,defaultValue),key==='offsetRad'?-.18:0,key==='offsetRad'?.18:key==='heatExposureSeconds'?30:1);
 }return out;
}
function preserveDamage(old,current){
 if(!old)return current;const result={};for(const[key,value]of Object.entries(current)){
  const previous=old[key];if(value&&typeof value==='object')result[key]=preserveDamage(previous,value);
  else if(typeof value==='boolean')result[key]=value||previous===true;
  else if(/condition|powerFactor|pressureRatio|shiftReliability/i.test(key))result[key]=Math.min(value,finite(previous,value));
  else if(key==='offsetRad')result[key]=Math.abs(value)>=Math.abs(previous||0)?value:previous;
  else if(['fade','fuelLeak','fireIntensity'].includes(key))result[key]=Math.max(value,finite(previous,value));
  else result[key]=value;
 }return result;
}
export function normalizeVehicleCondition(raw={}){
 const c={};for(const id of VEHICLE_CONDITION_KEYS)c[id]=clamp(finite(raw?.[id],100));c.dirt=clamp(finite(raw?.dirt,0));
 c.damageZones=Object.fromEntries(ZONES.map(id=>[id,clamp(finite(raw?.damageZones?.[id],0),0,1)]));
 if(raw?.mechanical&&typeof raw.mechanical==='object')c.mechanical=sanitizeMechanical(raw.mechanical);
 return c;
}
export function ensureVehicleConditionProfile(profile,initialVehicleId='chevy'){
 if(!VEHICLE_IDS.includes(initialVehicleId))throw new TypeError('Unknown vehicle');
 if(!profile.vehicleConditionsV7||profile.vehicleConditionsV7.version!==1){profile.vehicleConditionsV7={version:1,selectedVehicleId:initialVehicleId,cars:{[initialVehicleId]:normalizeVehicleCondition({...profile.condition,dirt:profile.appearance?.dirt})}};}
 const store=profile.vehicleConditionsV7;store.cars=Object.fromEntries(VEHICLE_IDS.filter(id=>store.cars?.[id]).map(id=>[id,normalizeVehicleCondition(store.cars[id])]));
 if(!VEHICLE_IDS.includes(store.selectedVehicleId))store.selectedVehicleId=initialVehicleId;
 return store;
}
export function selectVehicleCondition(profile,id){
 if(!VEHICLE_IDS.includes(id))throw new TypeError('Unknown vehicle');
 const store=profile.vehicleConditionsV7?.version===1?profile.vehicleConditionsV7:ensureVehicleConditionProfile(profile,id);
 store.cars[id]||=normalizeVehicleCondition({});store.selectedVehicleId=id;profile.condition=store.cars[id];profile.appearance||={};profile.appearance.dirt=profile.condition.dirt;return profile.condition;
}
export function toPhysicalDamage(condition,createDamageState=mechanicalTemplate){
 const c=normalizeVehicleCondition(condition),d=c.mechanical?copy(c.mechanical):sanitizeMechanical(createDamageState());
 for(const id of ['engine','steering','brakes','drivetrain','gearbox'])d[id].condition=Math.min(d[id].condition,c[id]/100);
 d.engine.powerFactor=Math.min(d.engine.powerFactor,c.engine/100);
 if(!c.mechanical)for(const id of WHEELS){d.suspension[id].condition=Math.min(d.suspension[id].condition,c.suspension/100);d.tires[id].condition=Math.min(d.tires[id].condition,c.tires/100);}
 if(!c.mechanical)for(const key of Object.keys(d.body))d.body[key]=c.body/100;
 return d;
}
export function conditionFromSnapshot(previous,snapshot,{fuelUsedLiters=0,tankLiters=60,newImpacts=[]}={}){
 const c=normalizeVehicleCondition(previous),d=snapshot?.damage?preserveDamage(c.mechanical,sanitizeMechanical(snapshot.damage)):c.mechanical;
 if(d){c.mechanical=d;for(const key of ['engine','steering','brakes','drivetrain','gearbox'])c[key]=Math.min(c[key],d[key].condition*100);
  c.body=Math.min(c.body,...Object.values(d.body).map(v=>v*100));
  for(const key of ['suspension','tires'])c[key]=Math.min(c[key],...WHEELS.map(id=>d[key][id].condition*100));
 }
 c.fuel=Math.max(0,c.fuel-Math.max(0,finite(fuelUsedLiters,0))/Math.max(1,tankLiters)*100);
 for(const event of newImpacts){const p=event.localPointM;if(!Array.isArray(p)||!p.every(Number.isFinite))continue;const strength=clamp(finite(event.magnitude,finite(event.impulseNs,0)/20000),0,1);if(strength<=0)continue;
  const zones=[];if(p[0]>.7)zones.push('front');else if(p[0]<-.7)zones.push('rear');if(Math.abs(p[2])>.45)zones.push(p[2]>0?'right':'left');if(p[1]>.5)zones.push('roof');
  for(const zone of zones)c.damageZones[zone]=Math.min(1,c.damageZones[zone]+strength*.3);
  if(zones.length){c.paint=Math.max(0,c.paint-strength*12);c.body=Math.min(c.body,100-Math.max(...Object.values(c.damageZones))*60);}
 }
 return c;
}
export const SERVICE_LABELS=Object.freeze({engine:'Motor',oil:'Lubricación',brakes:'Frenos',tires:'Neumáticos',body:'Chapa',paint:'Pintura',fuel:'Combustible',steering:'Dirección',suspension:'Suspensión',drivetrain:'Transmisión',gearbox:'Caja de cambios',dirt:'Lavado'});
export function terminalVehicleFaults(value){const c=normalizeVehicleCondition(value),faults=[];for(const[id,threshold]of Object.entries({fuel:.001,engine:15.1,oil:0,steering:20.1,brakes:15.1,suspension:10.1,tires:5.1,drivetrain:15.1,gearbox:15.1}))if(c[id]<=threshold||(id==='engine'&&c.mechanical?.engine.fire===true))faults.push({id,label:id==='fuel'?'Sin combustible':id==='engine'&&c.mechanical?.engine.fire?'Motor incendiado':SERVICE_LABELS[id]+' fuera de servicio'});return faults;}
export function serviceVehicleCondition(value,id){
 if(!Object.hasOwn(SERVICE_LABELS,id))throw new TypeError('Unknown service');const c=normalizeVehicleCondition(value);
 if(id==='dirt'){c.dirt=0;return c;}c[id]=100;
 const pristine=mechanicalTemplate();if(c.mechanical){if(['engine','steering','brakes','suspension','tires','drivetrain','gearbox'].includes(id))c.mechanical[id]=pristine[id];if(id==='body')c.mechanical.body=pristine.body;}
 if(id==='body')for(const zone of ZONES)c.damageZones[zone]=0;
 return c;
}
export function createVehicleConditionSession({vehicleId,condition,vehicleSpec,tankLiters=60}){
 if(!VEHICLE_IDS.includes(vehicleId))throw new TypeError('Unknown vehicle');let current=normalizeVehicleCondition(condition),lastTick=null,lastFuel=0,samples=0,disposed=false;
 const fuel=createFuelObserver({displacementLiters:vehicleSpec?.engine?.displacementLiters||4.1,fuelMultiplier:vehicleSpec?.fuelMultiplier||1}),seenImpacts=new Set();
 function sample(frame){if(disposed||!frame.running||frame.qa)return;if(frame.tick===lastTick)return;
  fuel.sample(frame);const fuelState=fuel.getState(),delta=fuelState.fuelUsedLiters-lastFuel;lastFuel=fuelState.fuelUsedLiters;lastTick=frame.tick;samples++;
  const newImpacts=[];for(const impact of frame.snapshot?.impacts||[]){const key=impact.timeSeconds+':'+impact.impulseNs+':'+impact.localPointM?.join(',');if(!seenImpacts.has(key)){seenImpacts.add(key);newImpacts.push(impact);if(seenImpacts.size>64)seenImpacts.delete(seenImpacts.values().next().value);}}
  current.fuel=Math.max(0,current.fuel-delta/tankLiters*100);
  if(samples%12===0||newImpacts.length||frame.snapshot?.damage?.engine?.fire)current=conditionFromSnapshot(current,frame.snapshot,{newImpacts});
  const speed=Math.hypot(...(frame.snapshot?.chassis?.linearVelocity||[0,0,0]));const unpaved=(frame.snapshot?.wheels||[]).some(w=>w.contact&&!['asphalt','road'].includes(w.surface));
  current.dirt=Math.min(100,current.dirt+speed/120*(unpaved?.0009:.00004));
 }
 return{sample,getCondition:()=>normalizeVehicleCondition(current),faults:()=>terminalVehicleFaults(current),diagnostics:()=>({vehicleId,samples,fuel:fuel.getState()}),dispose(){disposed=true;seenImpacts.clear();}};
}
