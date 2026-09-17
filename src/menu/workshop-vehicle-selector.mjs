import {createVehicleSelection} from '../game/vehicle-selection.mjs?v=balance-20260917';
import {VEHICLE_CATALOG} from '../render/vehicle-catalog.mjs?v=balance-20260917';
const labels=Object.fromEntries(Object.values(VEHICLE_CATALOG).map(v=>[v.id,v.label]));
export function installWorkshopVehicleSelector({workshop,prepareRace,prepareWorkshop,root=document,storage=globalThis.__asfaltoV7Storage}={}){
 const select=root.querySelector('#v6-workshop-vehicle'),status=root.querySelector('#v6-workshop-vehicle-status'),container=select?.closest('.an-workshop-vehicle-select');if(!select||!status)return null;
 for(const vehicle of Object.values(VEHICLE_CATALOG).filter(v=>v.selectable)){if(!Array.from(select.options).some(o=>o.value===vehicle.id)){const option=select.ownerDocument.createElement('option');option.value=vehicle.id;option.textContent=vehicle.label;select.append(option);}}
 let loadingFilm=null;
 const selection=createVehicleSelection({prepare:[prepareWorkshop,prepareRace],storage,onState:state=>{container?.setAttribute('aria-busy',String(state.pending));if(state.pending){if(!loadingFilm)loadingFilm=globalThis.__asfaltoLoading?.begin('Preparando el vehículo','Preparando el auto seleccionado…',{scene:'vehicle'});status.textContent=`Cargando ${labels[state.requested]}…`;return;}if(loadingFilm){void loadingFilm.end();loadingFilm=null;}select.value=state.current;status.textContent=state.error?'No se pudo cargar el auto. Se conserva el anterior.':`${labels[state.current]} · Listo para conducir.`;if(!state.error){workshop.vehicleId=state.current;globalThis.dispatchEvent?.(new CustomEvent('asfalto:vehicle-selected',{detail:{id:state.current,label:labels[state.current]}}));}}});
 const change=()=>{void selection.select(select.value);};select.addEventListener('change',change);select.disabled=false;
 return{...selection,restore:()=>selection.restore(),dispose(){void loadingFilm?.end();loadingFilm=null;select.removeEventListener('change',change);select.disabled=true;container?.setAttribute('aria-busy','true');status.textContent='Preparando el taller…';return selection.dispose();}};
}
