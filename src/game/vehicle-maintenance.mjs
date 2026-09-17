import {ensureVehicleConditionProfile,selectVehicleCondition,normalizeVehicleCondition,createVehicleConditionSession,toPhysicalDamage,terminalVehicleFaults,serviceVehicleCondition,SERVICE_LABELS} from './vehicle-condition.mjs?v=body-r3-20260916';
/** Persistent maintenance is fed by actual 120 Hz player steps, independent of test receipts. */
export function createVehicleMaintenance({getProfile,getVehicleId,save=()=>{},onChanged=()=>{},onFault=()=>{}}){
 let session=null,sessionVehicle=null,lastPublishedTick=0,lastSavedTick=0,faultLatched=false;
 const initial=getVehicleId();ensureVehicleConditionProfile(getProfile(),initial);selectVehicleCondition(getProfile(),initial);
 function store(condition,id=sessionVehicle||getVehicleId()){
  const p=getProfile();ensureVehicleConditionProfile(p,id);p.vehicleConditionsV7.cars[id]=normalizeVehicleCondition(condition);
  if(id===getVehicleId())selectVehicleCondition(p,id);
 }
 function current(){const p=getProfile();ensureVehicleConditionProfile(p,getVehicleId());return selectVehicleCondition(p,getVehicleId());}
 function flush({persist=true,end=false}={}){if(session)store(session.getCondition());if(end){session?.dispose();session=null;sessionVehicle=null;}onChanged(current());if(persist)void save();return current();}
 function getState(){const condition=normalizeVehicleCondition(current()),faults=terminalVehicleFaults(condition),tokens=Math.max(0,Number(getProfile().workshopTokens)||0);
  return{vehicleId:getVehicleId(),condition,canDrive:!faults.length,faults,services:Object.entries(SERVICE_LABELS).map(([id,label])=>{const health=id==='dirt'?100-condition.dirt:condition[id],baseCost=id==='body'||id==='paint'?2:1;const cost=faults.some(f=>f.id===id)&&tokens<baseCost?0:baseCost;return{id,label,condition:health,cost,available:health<99.999&&tokens>=cost};})};
 }
 async function service(id){flush({persist:false,end:true});const state=getState(),item=state.services.find(s=>s.id===id);if(!item)throw new TypeError('Servicio desconocido');if(!item.available)return state;
  getProfile().workshopTokens=Math.max(0,(Number(getProfile().workshopTokens)||0)-item.cost);store(serviceVehicleCondition(state.condition,id),getVehicleId());faultLatched=false;onChanged(current());await save();return getState();
 }
 function begin({vehicleSpec}={}){flush({persist:false,end:true});const state=getState();if(!state.canDrive){onFault(state.faults);throw new Error('Repará el auto en el taller antes de salir.');}
  sessionVehicle=getVehicleId();session=createVehicleConditionSession({vehicleId:sessionVehicle,condition:state.condition,vehicleSpec});lastPublishedTick=0;lastSavedTick=0;faultLatched=false;return toPhysicalDamage(state.condition);
 }
 function sample(frame){if(!session)return;session.sample(frame);if(!frame.running||frame.qa)return;
  if(frame.tick-lastPublishedTick>=12||frame.snapshot?.impact){store(session.getCondition());lastPublishedTick=frame.tick;}
  const faults=session.faults();if(faults.length&&!faultLatched){faultLatched=true;flush();onFault(faults);}
  else if(frame.tick-lastSavedTick>=600){lastSavedTick=frame.tick;flush();}
 }
 function selected(id){flush({persist:true,end:true});selectVehicleCondition(getProfile(),id);faultLatched=false;onChanged(current());void save();}
 return{begin,sample,flush,selected,getState,service,canDrive:()=>getState().canDrive,diagnostics:()=>({vehicleId:getVehicleId(),activeVehicle:sessionVehicle,faultLatched,session:session?.diagnostics()||null}),dispose:()=>flush({end:true})};
}
