import {buildChampionshipReceipt} from './v7-championship-result.mjs';
export function createChampionshipSession(host){
 let epoch=0,phase='idle',error=null,attempt=null,finalizing=false,pendingAction=null,lastFinal=null,pendingMemory=null;
 const now=()=>host.now?.()||new Date().toISOString(),id=()=>host.id?.()||crypto.randomUUID();
 const run=()=>{const p=host.getProfile().motorsportV7;return p?.runs?.[p.activeRunId]||null;};
 const changed=()=>host.onChange?.({phase,error,run:run(),final:lastFinal});
 async function persist(action){try{const result=await host.store.transact(action);pendingAction=null;return result;}catch(e){pendingAction=action;throw e;}}
 async function enroll(championshipId){if(['loading','running','capturing','saving'].includes(phase)||pendingAction)throw Error('Terminá o cancelá el intento actual.');if(!await host.prepare())return false;const entrant=await host.getEntrant();await persist({type:'enroll',id:id(),championshipId,entrant,at:now()});phase='ready';error=null;changed();return true;}
 async function finish(final,token){
  if(token!==epoch||finalizing||phase!=='running')return false;finalizing=true;lastFinal=structuredClone(final);
  let action;
  try{const context=await host.getContext();if(token!==epoch)return false;const r=run();const receipt=buildChampionshipReceipt(final,{...context,run:r,resultId:attempt.resultId,finishedAt:now()});action={type:'accept',runId:r.id,receipt};if(host.prepareMemory){phase='capturing';changed();pendingMemory=await host.prepareMemory({run:r,receipt});if(token!==epoch)return false;}}
  catch(e){if(token!==epoch)return false;action={type:'failure',runId:attempt.runId,attemptId:attempt.id,reason:String(e.message||e),at:now()};error=action.reason;}
  phase='saving';changed();
  try{await persist(action);if(action.type==='accept')void Promise.resolve(host.onAccepted?.({runId:action.runId,receipt:action.receipt,capture:pendingMemory})).catch(()=>{});phase=action.type==='accept'?'result':'invalid';host.world()?.configureChampionship({enabled:false});changed();return true;}
  catch(e){phase='save-error';error=String(e.message||e);changed();return false;}
 }
 async function start(){
  if(['loading','running','saving'].includes(phase)||pendingAction)throw Error('Hay un intento o guardado pendiente.');
  const token=++epoch;error=null;lastFinal=null;finalizing=false;
  if(!await host.prepare()||token!==epoch)return false;
  let r=run();if(!r)throw Error('Elegí un campeonato.');if(r.status==='running'){await persist({type:'resume',runId:r.id});r=run();}
  if(r.status==='completed')throw Error('Campeonato completo. Elegí la siguiente inscripción.');
  const entrant=await host.getEntrant();if(token!==epoch)return false;
  if(entrant.configurationHash!==r.entrant.configurationHash)throw Error('La configuración cambió. Restaurá el auto y las ayudas de la inscripción o inscribí otra temporada.');
  attempt={id:id(),runId:r.id,resultId:id()};phase='loading';changed();await persist({type:'begin',runId:r.id,attemptId:attempt.id});if(token!==epoch)return false;
  try{const stage=run().schedule[r.nextStageIndex];if(!await host.configure(stage)||token!==epoch){if(token===epoch)await cancel();return false;}
   const world=host.world();if(typeof world?.configureChampionship!=='function'||typeof world?.getFinalClassification!=='function'&&host.requireFinalApi)throw Error('La clasificación física no está disponible.');
   world.configureChampionship({enabled:true,onFinalClassification:final=>finish(final,token)});phase='running';changed();
   if(await host.start(stage,r)===false)throw Error('No se pudo iniciar la etapa.');if(token!==epoch){world.configureChampionship({enabled:false});return false;}return true;
  }catch(e){if(token===epoch){await cancel();error=String(e.message||e);changed();}throw e;}
 }
 async function cancel(){++epoch;host.world()?.configureChampionship({enabled:false});if(attempt&&!pendingAction&&['running','loading','capturing'].includes(phase)){try{await persist({type:'cancel',runId:attempt.runId,attemptId:attempt.id});}catch(e){phase='save-error';error=String(e.message||e);changed();return false;}}if(!pendingAction){phase='ready';attempt=null;finalizing=false;}changed();return true;}
 async function retrySave(){if(!pendingAction)return false;const action=pendingAction;try{await persist(action);if(action.type==='accept')void Promise.resolve(host.onAccepted?.({runId:action.runId,receipt:action.receipt,capture:pendingMemory})).catch(()=>{});phase=action.type==='accept'?'result':action.type==='failure'?'invalid':'ready';error=action.type==='failure'?action.reason:null;host.world()?.configureChampionship({enabled:false});changed();return true;}catch(e){phase='save-error';error=String(e.message||e);changed();return false;}}
 return Object.freeze({enroll,start,cancel,retrySave,run,diagnostics:()=>({phase,error,pending:!!pendingAction,attemptId:attempt?.id||null,final:lastFinal})});
}
