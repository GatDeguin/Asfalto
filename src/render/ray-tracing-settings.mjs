import {RAY_TRACING_STORAGE_KEY} from './ray-traced-occlusion.mjs?v=6eb33370562f7d1a';
export function installRayTracingSettings({controller,root=document,storage=globalThis.__asfaltoV7Storage,vehicleId=null,getDiagnostics=()=>controller.diagnostics()}={}) {
 const key=()=>vehicleId?`${RAY_TRACING_STORAGE_KEY}:${vehicleId}`:RAY_TRACING_STORAGE_KEY;
 function read(){try{const stored=storage?.getItem(key())??storage?.getItem(RAY_TRACING_STORAGE_KEY);if(['off','balanced','high'].includes(stored))return stored;}catch{}return 'off';}
 let mode=read();
 controller.setMode(mode);const selectors=[...root.querySelectorAll('[data-ray-tracing-select]')],statuses=[...root.querySelectorAll('[data-ray-tracing-status]')];let disposed=false,last='';
 const setMode=(value,{persist=true}={})=>{if(!controller.setMode(value))return false;mode=value;for(const select of selectors)select.value=value;if(persist)try{storage?.setItem(key(),value);}catch{}globalThis.dispatchEvent?.(new CustomEvent('asfalto:ray-tracing-mode',{detail:{mode:value}}));refresh();return true;};
 const change=e=>setMode(e.target.value);for(const select of selectors){select.value=mode;select.addEventListener('change',change);}
 function refresh(){if(disposed)return;const d=getDiagnostics(),messages={off:'Desactivado',preparing:'Preparando geometría cercana…',active:'Activo · oclusión ambiental por rayos',empty:'Sin geometría opaca cercana',unsupported:'La GPU no admite este efecto',error:'Efecto no disponible · renderizado normal','context-lost':'Esperando recuperación de la GPU',disposed:'Desactivado'},text=messages[d.status]||d.status;if(text===last)return;last=text;for(const status of statuses)status.textContent=text;}
 refresh();return{setMode,getMode:()=>mode,setVehicle(id){if(id!==vehicleId){vehicleId=id;setMode(read(),{persist:false});}},refresh,dispose(){if(disposed)return;disposed=true;for(const select of selectors)select.removeEventListener('change',change);}};
}
