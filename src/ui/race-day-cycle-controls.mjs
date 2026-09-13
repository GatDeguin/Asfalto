export const DAY_CYCLE_STORAGE_KEY='asfalto:nacional:v6:day-cycle';
export const DAY_CYCLE_DURATION_STORAGE_KEY='asfalto:nacional:v7:day-cycle-duration';
const duration=value=>Number(value)===360?360:720;
export function readRaceDayCycleOptions(storage){
 try{const selected=storage?.getItem(DAY_CYCLE_STORAGE_KEY);return{enabled:selected!=='fixed',durationSeconds:selected==='cycle-6'?360:duration(storage?.getItem(DAY_CYCLE_DURATION_STORAGE_KEY))};}catch{return{enabled:true,durationSeconds:720};}
}
export function readRaceDayCycleEnabled(storage){return readRaceDayCycleOptions(storage).enabled;}
export function reflectRaceDayCycleOptions(options,{document,storage}={}){
 const value=options.enabled===false?'fixed':duration(options.durationSeconds)===360?'cycle-6':'cycle';
 try{storage?.setItem(DAY_CYCLE_STORAGE_KEY,value);storage?.setItem(DAY_CYCLE_DURATION_STORAGE_KEY,String(duration(options.durationSeconds)));}catch{}
 for(const control of document?.querySelectorAll('[data-race-day-cycle]')||[])control.value=value;
}
export function reflectRaceDayCycleEnabled(enabled,context={}){reflectRaceDayCycleOptions({...readRaceDayCycleOptions(context.storage),enabled},context);}
export function installRaceDayCycleControls({document,storage,getController=()=>null}={}){
 const controls=Array.from(document?.querySelectorAll('[data-race-day-cycle]')||[]),listeners=[];
 let options=readRaceDayCycleOptions(storage),revision=0;
 reflectRaceDayCycleOptions(options,{document});
 for(const control of controls){const change=async()=>{
  const previous=options,token=++revision;options={enabled:control.value!=='fixed',durationSeconds:control.value==='fixed'?options.durationSeconds:control.value==='cycle-6'?360:720};
  reflectRaceDayCycleOptions(options,{document,storage});
  try{await getController()?.setDayCycleOptions?.(options);}catch(error){if(token===revision){options=previous;reflectRaceDayCycleOptions(previous,{document,storage});}console.error('No se pudo cambiar el ciclo horario',error);}
 };control.addEventListener('change',change);listeners.push([control,change]);}
 return{dispose(){revision++;for(const [control,change]of listeners)control.removeEventListener('change',change);listeners.length=0;}};
}
// Resolve the runtime at click time; pre-start choices initialize the race clock.
if(typeof document!=='undefined'){
 let storage;try{storage=globalThis.__asfaltoV7Storage;}catch{}
 installRaceDayCycleControls({document,storage,getController:()=>globalThis.__cockpit?.raceWorld});
}
