import {waitForSignal} from '../runtime/abortable.mjs';
/** Single host session request; a scene implementation receives and must honor AbortSignal. */
export function createSessionTransactionRunner({begin=()=>({}),onCancel=()=>{}}={}){
 let current=null,epoch=0;
 function cancel(reason='cancel'){if(!current)return;const request=current;request.userCanceled=reason==='cancel';try{request.presentation?.canceling?.();}finally{request.controller.abort();request.decide?.('cancel');}}
 async function run(load,metadata={}){
  cancel('superseded');const request={controller:new AbortController(),epoch:++epoch,decide:null,metadata};current=request;let success=false;
  const isCurrent=()=>current===request&&!request.controller.signal.aborted;
  let presentation;try{presentation=begin({metadata,cancel:()=>{if(current===request)cancel();},retry:()=>{if(isCurrent())request.decide?.('retry');}})||{};}catch(error){if(current===request)current=null;request.controller.abort();throw error;}
  request.presentation=presentation;const signal=request.controller.signal;
  let abortListener;const canceled=new Promise(resolve=>{abortListener=()=>resolve({canceled:true});if(signal.aborted)abortListener();else signal.addEventListener('abort',abortListener,{once:true});});
  try{while(isCurrent()){
   try{const operation=Promise.resolve().then(()=>isCurrent()?load({signal,isCurrent,wait:promise=>waitForSignal(promise,signal),stage:(...args)=>{if(isCurrent())presentation.stage?.(...args);}}):false);const outcome=await Promise.race([operation.then(value=>({value})),canceled]);
    if(outcome.canceled||!isCurrent()){operation.catch(()=>{});return false;}
    if(outcome.value!==true)throw new Error('No se pudo preparar la sesión.');
    success=true;return true;
   }catch(error){if(!isCurrent()||error?.name==='AbortError')return false;presentation.fail?.(String(error?.message||error));if(presentation.canRetry===false)return false;const decision=await Promise.race([new Promise(resolve=>request.decide=resolve),canceled]);request.decide=null;if(decision!=='retry'||!isCurrent())return false;presentation.stage?.('Reintentando la preparación…');}
  }return false;}finally{signal.removeEventListener('abort',abortListener);try{await presentation.end?.(success);}finally{const stillOwned=current===request;if(stillOwned)current=null;if(stillOwned&&request.userCanceled)onCancel(request.metadata);}if(epoch!==request.epoch||signal.aborted)return false;}
 }
 return {run,cancel,diagnostics:()=>({active:!!current,epoch,aborted:current?.controller.signal.aborted??false})};
}
const finite=value=>Number.isFinite(value)?value:null;
export function sessionTelemetry({snapshot={},race={},speedKph,gear,activity='free'}={}){
 const velocity=snapshot.chassis?.linearVelocity;const measured=Array.isArray(velocity)&&velocity.length===3&&velocity.every(Number.isFinite)?Math.hypot(...velocity):null;
 const speedMps=measured??(Number.isFinite(speedKph)?Math.abs(speedKph)/3.6:null),alerts=[];
 if(snapshot.engine?.fire===true||snapshot.engine?.fault==='fire')alerts.push('Fuego en el motor');else if(snapshot.engine?.fault==='damaged')alerts.push('Motor dañado');
 if(snapshot.engine?.temperatureC>=110)alerts.push('Temperatura de motor alta');
 if(snapshot.engine?.running===false)alerts.push('Motor detenido');
 if(race.invalidLap)alerts.push('Vuelta invalidada');if(race.penaltyTime>0)alerts.push(`Penalización +${race.penaltyTime.toFixed(1)} s`);
 if(race.offTrack)alerts.push('Fuera de pista');
 return {speedMps,gear:snapshot.gearbox?.gear??gear??'N',activity,alerts};
}
export function sessionResultFacts({activity='',race={},elapsedMs,valid,reason='',progress=''}={}){
 const penaltySeconds=finite(race.penaltyTime),activeSeconds=activity==='competition'?finite(race.totalTime):Number.isFinite(elapsedMs)?Math.max(0,elapsedMs)/1000:null;
 return {activeSeconds,penaltySeconds,totalSeconds:activeSeconds!==null&&penaltySeconds!==null?activeSeconds+penaltySeconds:null,valid,reason,progress};
}

