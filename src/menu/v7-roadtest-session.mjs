import {createPhysicalRoadTestValidator,createSlalomCourse} from '../game/physical-road-tests.mjs';
import {freezeRoadTestData,validateRoadTestReceipt} from './v7-roadtest-receipts.mjs?v=vehicles-r1-20260916';
export {createSlalomCourse};
export {configurationFingerprint} from './v7-championship-result.mjs';
/** Subscribe only after the awaited raceStart. RAF may display this state; it cannot produce results. */
export function createRoadTestSession(options){
 const {world,getInstrument=()=>null,onCompleted=()=>{},onInvalidated=()=>{},onProgress=()=>{},isCurrent=()=>true,now=()=>new Date().toISOString(),newId=()=>globalThis.crypto.randomUUID()}=options;
 const initial=world?.getPhysicalObservationState?.(),sequence=options.sessionSequence??initial?.sessionSequence;
 if(!Number.isSafeInteger(sequence)||sequence<=0||sequence!==initial?.sessionSequence||initial.qa!==false||typeof world?.subscribePhysicalSteps!=='function')throw new Error('La sesión física no está disponible o fue modificada por QA.');
 const validator=createPhysicalRoadTestValidator(options),resultId=newId();let unsubscribe=null,closed=false,receipt=null,terminalState=null,maxSpeed=0,lastSeriesTick=-Infinity;const series=[];
 function detach(){closed=true;unsubscribe?.();unsubscribe=null;world.clearRoadTestGates?.();}
 function invalidate(reason='attempt-canceled'){
  if(closed)return;validator.invalidate(reason);const state=validator.getState();
  // Publication can fail after the physical validator has completed. Its immutable
  // completion does not make a rejected receipt an eligible host result.
  terminalState=freezeRoadTestData({...state,phase:'invalid',valid:false,objectiveComplete:false,measurement:null,invalidReasons:[...new Set([...state.invalidReasons,reason])]});
  receipt=null;detach();onInvalidated(terminalState);
 }
 const observer={
  sample(frame){
   if(closed)return;
   if(!isCurrent()||frame.sessionSequence!==sequence){invalidate('session-changed');return;}
   const instrument=getInstrument();validator.sample({...frame,sessionId:options.sessionId,configurationHash:options.configurationHash,instrument:instrument?{indicatedKph:instrument.indicatedKph,sampleTick:instrument.physicalTick}:null});
   const state=validator.getState();if(frame.running&&state.phase!=='invalid'){const speed=Math.hypot(...frame.snapshot.chassis.linearVelocity)*3.6;maxSpeed=Math.max(maxSpeed,speed);if(frame.tick-lastSeriesTick>=12&&series.length<2400){series.push({t:state.activeSeconds*1000,speed,rpm:frame.snapshot.engine?.rpm,distance:state.distanceM,lateral:frame.projection.lateral});lastSeriesTick=frame.tick;}}
   if(state.phase==='invalid'){detach();onInvalidated(state);return;}
   if(state.phase==='completed'){
    try{receipt=validateRoadTestReceipt({...validator.getReceipt({resultId,finishedAt:now()}),sessionSequence:sequence});}
    catch{invalidate('receipt-creation-or-validation-failed');return;}
    detach();onCompleted(receipt);return;
   }
   if(frame.tick%12===0)onProgress(state);
  },
  invalidated:invalidate,
  rebase(event){if(closed)return;try{validator.rebase(event);}catch{invalidate('reference-rebase-required');}}
 };
 unsubscribe=world.subscribePhysicalSteps(observer);
 return Object.freeze({cancel:invalidate,getState:()=>terminalState||validator.getState(),getReceipt:()=>receipt,getTelemetry:()=>freezeRoadTestData({maxSpeed,series:series.map(x=>({...x}))}),sessionId:options.sessionId,sessionSequence:sequence});
}
