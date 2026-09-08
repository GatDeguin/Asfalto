export const DAY_CYCLE_STORAGE_KEY='asfalto:nacional:v6:day-cycle';
export function readRaceDayCycleEnabled(storage){try{return storage?.getItem(DAY_CYCLE_STORAGE_KEY)!=='fixed';}catch{return true;}}
export function reflectRaceDayCycleEnabled(enabled,{document,storage}={}){
 try{storage?.setItem(DAY_CYCLE_STORAGE_KEY,enabled?'cycle':'fixed');}catch{}
 for(const control of document?.querySelectorAll('[data-race-day-cycle]')||[])control.value=enabled?'cycle':'fixed';
}
export function installRaceDayCycleControls({document,storage,getController=()=>null}={}){
 const controls=Array.from(document?.querySelectorAll('[data-race-day-cycle]')||[]),listeners=[];
 let enabled=readRaceDayCycleEnabled(storage);for(const control of controls)control.value=enabled?'cycle':'fixed';
 for(const control of controls){const change=async()=>{const previous=enabled;enabled=control.value!=='fixed';reflectRaceDayCycleEnabled(enabled,{document,storage});try{await getController()?.setDayCycleOptions?.({enabled});}catch(error){enabled=previous;reflectRaceDayCycleEnabled(previous,{document,storage});console.error('No se pudo cambiar el ciclo horario',error);}};control.addEventListener('change',change);listeners.push([control,change]);}
 return{dispose(){for(const [control,change]of listeners)control.removeEventListener('change',change);listeners.length=0;}};
}
// Resolve the runtime at click time; pre-start choices initialize the race clock.
if(typeof document!=='undefined'){
 let storage;try{storage=globalThis.localStorage;}catch{}
 installRaceDayCycleControls({document,storage,getController:()=>globalThis.__cockpit?.raceWorld});
}