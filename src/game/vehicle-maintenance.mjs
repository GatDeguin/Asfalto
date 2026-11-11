import {ensureVehicleConditionProfile,selectVehicleCondition,normalizeVehicleCondition,createVehicleConditionSession,toPhysicalDamage,terminalVehicleFaults,serviceVehicleCondition,SERVICE_LABELS} from './vehicle-condition.mjs?v=92fc1e81f7682f9f';
const FIRE_PREVIEW_STEPS=300; // 2.5 seconds of the 120 Hz driving simulation.
/** Persistent maintenance is fed by actual 120 Hz player steps, independent of test receipts. */
export function createVehicleMaintenance({getProfile,getVehicleId,save=()=>{},onChanged=()=>{},onAppearance=()=>{},onFaultPreview=()=>{},onFault=()=>{}}){
 let session=null,sessionVehicle=null,lastPublishedTick=0,lastSavedTick=0,faultLatched=false,fireSteps=null;
 const initial=getVehicleId();ensureVehicleConditionProfile(getProfile(),initial);selectVehicleCondition(getProfile(),initial);
 function store(condition,id=sessionVehicle||getVehicleId()){
  const p=getProfile();ensureVehicleConditionProfile(p,id);p.vehicleConditionsV7.cars[id]=normalizeVehicleCondition(condition);
  if(id===getVehicleId())selectVehicleCondition(p,id);
 }
 function current(){const p=getProfile();ensureVehicleConditionProfile(p,getVehicleId());return selectVehicleCondition(p,getVehicleId());}
 function flush({persist=true,end=false}={}){if(session)store(session.getCondition());if(end){session?.dispose();session=null;sessionVehicle=null;fireSteps=null;}onChanged(current());if(persist)void save();return current();}
 function getState(){const condition=normalizeVehicleCondition(current()),faults=terminalVehicleFaults(condition),tokens=Math.max(0,Number(getProfile().workshopTokens)||0);
  return{vehicleId:getVehicleId(),condition,canDrive:!faults.length,faults,services:Object.entries(SERVICE_LABELS).map(([id,label])=>{const health=id==='dirt'?100-condition.dirt:condition[id],baseCost=id==='body'||id==='paint'?2:1,critical=faults.some(f=>f.id===id);const cost=critical&&tokens<baseCost?0:baseCost;return{id,label,condition:health,cost,available:(critical||health<99.999)&&tokens>=cost};})};
 }
 async function service(id){flush({persist:false,end:true});const state=getState(),item=state.services.find(s=>s.id===id);if(!item)throw new TypeError('Servicio desconocido');if(!item.available)return state;
  getProfile().workshopTokens=Math.max(0,(Number(getProfile().workshopTokens)||0)-item.cost);store(serviceVehicleCondition(state.condition,id),getVehicleId());faultLatched=false;onChanged(current());await save();return getState();
 }
 function begin({vehicleSpec}={}){flush({persist:false,end:true});const state=getState();if(!state.canDrive){onFault(state.faults,{duringDrive:false});throw new Error('Repará el auto en el taller antes de salir.');}
  sessionVehicle=getVehicleId();session=createVehicleConditionSession({vehicleId:sessionVehicle,condition:state.condition,vehicleSpec});lastPublishedTick=0;lastSavedTick=0;faultLatched=false;return toPhysicalDamage(state.condition);
 }
 function sample(frame){if(!session?.sample(frame))return;
  if(frame.tick-lastPublishedTick>=12||frame.snapshot?.impact){
   const condition=session.getCondition();
   store(condition);lastPublishedTick=frame.tick;
   onAppearance(condition,sessionVehicle);
  }
  const faults=session.faults();
  if(faults.length&&!faultLatched){
   const canShowFire=frame.statusAfter!=='FINISHED'&&faults[0].code==='fire';
   if(canShowFire&&fireSteps===null){fireSteps=0;lastSavedTick=frame.tick;flush();onFaultPreview(faults);return;}
   if(!canShowFire||++fireSteps>=FIRE_PREVIEW_STEPS){
    faultLatched=true;fireSteps=null;lastSavedTick=frame.tick;flush();onFault(faults,{duringDrive:true});return;
   }
  }
  if(frame.tick-lastSavedTick>=600){lastSavedTick=frame.tick;flush();}
 }
 function selected(id){flush({persist:true,end:true});selectVehicleCondition(getProfile(),id);faultLatched=false;onChanged(current());void save();}
 return{begin,sample,flush,selected,getState,service,canDrive:()=>getState().canDrive,canResume:()=>fireSteps!==null||getState().canDrive,diagnostics:()=>({vehicleId:getVehicleId(),activeVehicle:sessionVehicle,faultLatched,fireSteps,session:session?.diagnostics()||null}),dispose:()=>flush({end:true})};
}
