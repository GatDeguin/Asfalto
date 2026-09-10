import {createVehicleSelection} from '../game/vehicle-selection.mjs';
const labels={chevy:'Chevy 250 Serie 2 · 1973',chevy_400_1957:'Chevrolet 400 · 1957',chevrolet_1969:'Chevrolet · 1969'};
export function installWorkshopVehicleSelector({workshop,prepareRace,prepareWorkshop,root=document,storage=globalThis.__asfaltoV7Storage}={}){
 const select=root.querySelector('#v6-workshop-vehicle'),status=root.querySelector('#v6-workshop-vehicle-status'),container=select?.closest('.an-workshop-vehicle-select');if(!select||!status)return null;
 let loadingFilm=null;
 const selection=createVehicleSelection({prepare:[prepareWorkshop,prepareRace],storage,onState:state=>{container?.setAttribute('aria-busy',String(state.pending));if(state.pending){if(!loadingFilm)loadingFilm=globalThis.__asfaltoLoading?.begin('Preparando el vehículo','Preparando el auto seleccionado…',{scene:'vehicle'});status.textContent=`Cargando ${labels[state.requested]}…`;return;}if(loadingFilm){void loadingFilm.end();loadingFilm=null;}select.value=state.current;status.textContent=state.error?'No se pudo cargar el auto. Se conserva el anterior.':state.current==='chevy'?'Lista para conducir.':'Usa la mecánica y la cabina ajustable actuales.';if(!state.error){workshop.vehicleId=state.current;globalThis.dispatchEvent?.(new CustomEvent('asfalto:vehicle-selected',{detail:{id:state.current,label:labels[state.current]}}));}}});
 const change=()=>{void selection.select(select.value);};select.addEventListener('change',change);
 return{...selection,restore:()=>selection.restore(),dispose(){void loadingFilm?.end();loadingFilm=null;select.removeEventListener('change',change);return selection.dispose();}};
}
