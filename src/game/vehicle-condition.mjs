import {VEHICLE_CATALOG} from '../render/vehicle-catalog.mjs?v=d34c237e4bf2bab0';
import {createFuelObserver} from './fuel-observer.mjs?v=c8691a04c5e062fe';
export const VEHICLE_CONDITION_KEYS=Object.freeze(['engine','oil','brakes','tires','body','paint','fuel','steering','suspension','drivetrain','gearbox']);
export const VEHICLE_IDS=Object.freeze(['chevy',...Object.values(VEHICLE_CATALOG).filter(v=>v.selectable||v.supportsPersistentCondition).map(v=>v.id)]);
const ZONES=['front','rear','left','right','roof'],WHEELS=['frontLeft','frontRight','rearLeft','rearRight'];
const PANELS=['hood','leftDoor','rightDoor'];
// Dirt added in percentage points per meter of actual tire contact.
const DIRT_RATE={gravel:.018,dirt:.026,sand:.024,grass:.013,shoulder:.018,mud:.052,snow:.021,wet:.003};
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
const copy=value=>structuredClone(value);
const scorchLevel=engine=>engine?.fire===true ? .42+.5*engine.fireIntensity : 0;
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
 c.panelDamage=Object.fromEntries(PANELS.map(id=>[id,clamp(finite(raw?.panelDamage?.[id],0),0,1)]));
 if(raw?.mechanical&&typeof raw.mechanical==='object')c.mechanical=sanitizeMechanical(raw.mechanical);
 c.scorch=clamp(finite(raw?.scorch,scorchLevel(c.mechanical?.engine)),0,1);
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
  c.scorch=Math.max(c.scorch,scorchLevel(d.engine));
  if(d.engine.fire)c.paint=Math.min(c.paint,100-c.scorch*44);
 }
 c.fuel=Math.max(0,c.fuel-Math.max(0,finite(fuelUsedLiters,0))/Math.max(1,tankLiters)*100);
 for(const event of newImpacts){const p=event.localPointM;if(!Array.isArray(p)||p.length<3||!p.every(Number.isFinite))continue;
  const [x,y,z]=p,impulse=Math.max(0,finite(event.impulseNs,0));
  const strength=clamp(finite(event.magnitude,impulse/20000),0,1);if(strength<=0)continue;
  const zones=[];if(x>.7)zones.push('front');else if(x<-.7)zones.push('rear');if(Math.abs(z)>.45)zones.push(z>0?'right':'left');if(y>.5)zones.push('roof');
  const structuralLoss=impulse>=75000&&(zones.length>0||y<-.25);
  for(const zone of zones)c.damageZones[zone]=structuralLoss?1:Math.min(1,c.damageZones[zone]+strength*.3);
  if(zones.length){c.paint=Math.max(0,c.paint-strength*12);c.body=Math.min(c.body,100-Math.max(...Object.values(c.damageZones))*60);}
  if(structuralLoss)c.body=Math.min(c.body,12);
  const panelStress=clamp(impulse>0?impulse/60000:strength*.3,0,1);
  if(x>.8&&y>-.42&&y<1&&Math.abs(z)<1.03)c.panelDamage.hood=Math.min(1,c.panelDamage.hood+panelStress);
  if(Math.abs(z)>.56&&x> -1.1&&x<.85&&y>-.42&&y<.85){
   const door=z>0?'rightDoor':'leftDoor';c.panelDamage[door]=Math.min(1,c.panelDamage[door]+panelStress);
  }
 }
 return c;
}
export const SERVICE_LABELS=Object.freeze({engine:'Motor',oil:'Lubricación',brakes:'Frenos',tires:'Neumáticos',body:'Chapa',paint:'Pintura',fuel:'Combustible',steering:'Dirección',suspension:'Suspensión',drivetrain:'Transmisión',gearbox:'Caja de cambios',dirt:'Lavado'});
const FAULTS=Object.freeze([
 ['body',15.1,'Destrucción total','La estructura quedó comprometida. Repará la chapa y revisá los demás daños.','wreck'],
 ['engine',15.1,'Motor fuera de servicio','El motor perdió la capacidad de sostener la marcha.'],
 ['drivetrain',15.1,'Transmisión fuera de servicio','La transmisión dejó de llevar fuerza a las ruedas.'],
 ['gearbox',15.1,'Caja de cambios fuera de servicio','La caja perdió la capacidad de engranar con fiabilidad.'],
 ['steering',20.1,'Dirección averiada','La dirección quedó comprometida y el auto perdió control.'],
 ['brakes',15.1,'Frenos fuera de servicio','El sistema de frenos agotó su capacidad de frenado.'],
 ['suspension',10.1,'Suspensión averiada','La suspensión perdió el apoyo necesario para continuar.'],
 ['tires',5.1,'Neumáticos fuera de servicio','El auto perdió apoyo por un neumático destruido o sin presión.'],
 ['oil',0,'Lubricación agotada','El motor necesita servicio de lubricación.'],
 ['fuel',.001,'Sin combustible','El tanque está vacío. Cargá combustible en el taller.'],
]);
const WHEEL_LABELS={frontLeft:'delantero izquierdo',frontRight:'delantero derecho',rearLeft:'trasero izquierdo',rearRight:'trasero derecho'};
function collectVehicleFaults(c){
 const faults=[],fire=c.mechanical?.engine.fire===true;
 if(fire)faults.push({id:'engine',code:'fire',label:'Motor incendiado',detail:'El incendio obliga a interrumpir la marcha y reparar el motor.'});
 for(const [id,threshold,label,detail,code=id] of FAULTS){
  if(id==='engine'&&fire)continue;
  if(id==='tires'){
   const tires=c.mechanical?.tires;
   const affected=tires?WHEELS.filter(wheel=>tires[wheel].condition<=.051||tires[wheel].pressureRatio<=.151):[];
   if(affected.length){faults.push({id,code,label,detail:'Neumáticos afectados · '+affected.map(wheel=>WHEEL_LABELS[wheel]).join(', ')+'.'});continue;}
  }
  if(c[id]<=threshold)faults.push({id,code,label,detail});
 }
 return faults;
}
export function terminalVehicleFaults(value){return collectVehicleFaults(normalizeVehicleCondition(value));}
export function serviceVehicleCondition(value,id){
 if(!Object.hasOwn(SERVICE_LABELS,id))throw new TypeError('Unknown service');const c=normalizeVehicleCondition(value);
 if(id==='dirt'){c.dirt=0;return c;}c[id]=100;
 const pristine=mechanicalTemplate();if(c.mechanical){if(['engine','steering','brakes','suspension','tires','drivetrain','gearbox'].includes(id))c.mechanical[id]=pristine[id];if(id==='body')c.mechanical.body=pristine.body;}
 if(id==='body'){for(const zone of ZONES)c.damageZones[zone]=0;for(const panel of PANELS)c.panelDamage[panel]=0;}
 if(id==='paint')c.scorch=0;
 return c;
}
export function createVehicleConditionSession({vehicleId,condition,vehicleSpec,tankLiters=vehicleSpec?.fuelCapacityLiters??60}){
 if(!VEHICLE_IDS.includes(vehicleId))throw new TypeError('Unknown vehicle');let current=normalizeVehicleCondition(condition),lastTick=null,lastFuel=0,samples=0,disposed=false;
 const fuel=createFuelObserver({displacementLiters:vehicleSpec?.engine?.displacementLiters||4.1,fuelMultiplier:vehicleSpec?.fuelMultiplier||1}),seenImpacts=new Set();
 function sample(frame){if(disposed||!frame.running||frame.qa||frame.tick===lastTick)return false;
  fuel.sample(frame);const fuelState=fuel.getState(),delta=fuelState.fuelUsedLiters-lastFuel;lastFuel=fuelState.fuelUsedLiters;lastTick=frame.tick;samples++;
  const newImpacts=[];for(const impact of frame.snapshot?.impacts||[]){const key=impact.timeSeconds+':'+impact.impulseNs+':'+impact.localPointM?.join(',');if(!seenImpacts.has(key)){seenImpacts.add(key);newImpacts.push(impact);if(seenImpacts.size>64)seenImpacts.delete(seenImpacts.values().next().value);}}
  current.fuel=Math.max(0,current.fuel-delta/tankLiters*100);
  if(samples===1||samples%12===0||newImpacts.length||(frame.snapshot?.damage?.engine?.fire&&!current.mechanical?.engine.fire))current=conditionFromSnapshot(current,frame.snapshot,{newImpacts});
  const wheels=frame.snapshot?.wheels||[];
  let dirtRate=0;
  for(const wheel of wheels)if(wheel.contact)dirtRate+=DIRT_RATE[wheel.surface]??.0012;
  const velocity=frame.snapshot?.chassis?.linearVelocity;
  if(dirtRate>0&&velocity){
   const distance=Math.hypot(finite(velocity[0],0),finite(velocity[2],0))/120;
   current.dirt=Math.min(100,current.dirt+distance*dirtRate/wheels.length);
  }
  return true;
 }
 return{sample,getCondition:()=>normalizeVehicleCondition(current),faults:()=>collectVehicleFaults(current),diagnostics:()=>({vehicleId,samples,fuel:fuel.getState()}),dispose(){disposed=true;seenImpacts.clear();}};
}
