import {createVehicleSelection} from '../game/vehicle-selection.mjs?v=762e5c55273b7942';
import {VEHICLE_CATALOG} from '../render/vehicle-catalog.mjs?v=79da6f20496c6a50';
const labels=Object.fromEntries(Object.values(VEHICLE_CATALOG).map(vehicle=>[vehicle.id,vehicle.label]));
export function installWorkshopVehicleSelector({workshop,prepareRace,prepareWorkshop,root=document,storage=globalThis.localStorage}={}){
 const select=root.querySelector('#v6-workshop-vehicle'),status=root.querySelector('#v6-workshop-vehicle-status'),container=select?.closest('.an-workshop-vehicle-select');if(!select||!status)return null;
 for(const vehicle of Object.values(VEHICLE_CATALOG).filter(vehicle=>vehicle.selectable)){
  let option=Array.from(select.options).find(option=>option.value===vehicle.id);
  if(!option){option=select.ownerDocument.createElement('option');option.value=vehicle.id;select.append(option);}
  option.textContent=vehicle.label;
 }
 const selection=createVehicleSelection({prepare:[prepareWorkshop,prepareRace],storage,onState:state=>{container?.setAttribute('aria-busy',String(state.pending));if(state.pending){status.textContent=`Cargando ${labels[state.requested]}…`;return;}select.value=state.current;status.textContent=state.error?'No se pudo cargar el auto. Se conserva el anterior.':`${labels[state.current]} · Listo para conducir.`;if(!state.error){workshop.vehicleId=state.current;globalThis.dispatchEvent?.(new CustomEvent('asfalto:vehicle-selected',{detail:{id:state.current,label:labels[state.current]}}));}}});
 const change=()=>{void selection.select(select.value);};select.addEventListener('change',change);
 return{...selection,restore:()=>selection.restore(),dispose(){select.removeEventListener('change',change);return selection.dispose();}};
}
