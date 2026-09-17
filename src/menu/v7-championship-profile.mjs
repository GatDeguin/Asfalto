import {createRun,beginStage,cancelStage,acceptStage,resumeRun} from './v7-championship-state.mjs';
import {getEarnedDisplayItems} from './v7-earned-collection.mjs?v=body-r3-20260916';
import {PROFILE_KEY,PROFILE_LOCK_NAME,withProfileWriteLock,profileRevision} from '../runtime/profile-persistence.mjs';
export {PROFILE_KEY,PROFILE_LOCK_NAME,withProfileWriteLock};
const clone=x=>structuredClone(x),revision=p=>p?.motorsportV7?.revision||0;
function extension(profile){const old=profile.motorsportV7;if(old&&old.schema!=='asfalto-motorsport/v1')throw new Error('Unsupported motorsport profile');return old||{schema:'asfalto-motorsport/v1',revision:0,activeRunId:null,runs:{},awards:{},memories:{}};}
function completedIds(runs){const ids=[];for(const run of Object.values(runs)){try{const valid=resumeRun(run);if(valid.status==='completed')ids.push(valid.championshipId);}catch{}}return ids;}
export function applyChampionshipProfileAction(profile,action){
 const ext=extension(profile);let run;
 if(action.type==='memory'){
  const verified=resumeRun(ext.runs[action.runId]),receipt=verified.accepted.find(r=>r.resultId===action.receiptId);if(!receipt)throw new Error('Memory needs a persisted finish');
  const id='stage-photo:'+action.runId+':'+action.receiptId;if(action.id!==id||!['saved','deleted'].includes(action.status))throw new Error('Invalid memory reference');
  const selected=action.status==='saved'&&(action.selected??ext.memories?.[id]?.selected??false);if(selected&&Object.entries(ext.memories||{}).filter(([key,item])=>key!==id&&item.status==='saved'&&item.selected).length>=2)throw new Error('Elegí hasta dos fotos para el mueble.');const reference={id,runId:action.runId,receiptId:action.receiptId,status:action.status,selected};if(JSON.stringify(ext.memories?.[id])===JSON.stringify(reference))return profile;
  const draft=clone(profile);draft.motorsportV7={...clone(ext),revision:revision(profile)+1,memories:{...(ext.memories||{}),[id]:reference}};return draft;
 }
 if(action.type==='enroll'){
  if(ext.runs[action.id])throw new Error('Season already exists');
  run=createRun({id:action.id,championshipId:action.championshipId,entrant:action.entrant,createdAt:action.at,completedChampionshipIds:completedIds(ext.runs)});
 }else{
  if(ext.activeRunId!==action.runId||!ext.runs[action.runId])throw new Error('Inactive season');
  const original=ext.runs[action.runId];let current=resumeRun(original);if(original.status==='running'){if(original.attempt?.stageId!==current.schedule[current.nextStageIndex]?.id)throw new Error('Invalid persisted attempt');current=beginStage(current,original.attempt.id);}
  if(action.type==='begin')run=beginStage(current,action.attemptId);
  else if(action.type==='resume')run=resumeRun(current);
  else if(action.type==='cancel'||action.type==='failure')run=cancelStage(current,action.attemptId);
  else if(action.type==='accept')run=acceptStage(current,action.receipt);
  else throw new Error('Unknown championship action');
  if(run===current)return profile;
 }
 const draft=clone(profile),next=clone(ext);next.runs[run.id]=run;next.activeRunId=run.id;next.revision=revision(profile)+1;
 if(action.type==='failure'){const history=next.failedAttempts||[];next.failedAttempts=[...history,{runId:run.id,attemptId:action.attemptId,reason:String(action.reason||'Intento no válido'),at:action.at}].slice(-30);}
 draft.motorsportV7=next;
 // Recompute from validated receipts; stored counters or award IDs cannot unlock objects.
 next.awards=Object.fromEntries(getEarnedDisplayItems(draft).map(item=>[item.id,item]));return draft;
}
function freezeReceipts(profile){const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}};for(const run of Object.values(profile.motorsportV7?.runs||{}))for(const receipt of run.accepted||[])freeze(receipt);return profile;}
export function createChampionshipProfileStore({storage=globalThis.__asfaltoV7Storage,getProfile,replaceProfile,withLock=withProfileWriteLock,key=PROFILE_KEY}={}){
 let queue=Promise.resolve(),pending=null;
 function transact(action){const intent=clone(action);const task=queue.then(()=>withLock(()=>{
  if(typeof storage?.getItemPersistent!=='function'||typeof storage?.setItemPersistent!=='function')throw new Error('Real persistent storage unavailable');
  const current=getProfile(),raw=storage.getItemPersistent(key),disk=raw===null?null:JSON.parse(raw);
  if(profileRevision(disk)!==profileRevision(current)){
   // An uncertain disk success may be retried with the same result ID, never duplicated.
   if(intent.type==='accept'){try{const restored=resumeRun(disk.motorsportV7.runs[intent.runId]);if(restored.accepted.some(r=>r.resultId===intent.receipt.resultId&&r.attemptId===intent.receipt.attemptId&&r.stageId===intent.receipt.stageId)){replaceProfile(freezeReceipts(disk));pending=null;return{profile:disk,changed:false,persisted:true,recovered:true};}}catch{}}
   throw new Error('Profile revision conflict; reload the saved profile');
  }
  const draft=applyChampionshipProfileAction(current,intent);if(draft===current){pending=null;return{profile:current,changed:false,persisted:true};}
  draft.storageRevision=(disk?.storageRevision||0)+1;storage.setItemPersistent(key,JSON.stringify(draft));
  freezeReceipts(draft);replaceProfile(draft);pending=null;return{profile:draft,changed:true,persisted:true};
 }));queue=task.catch(()=>{});return task.catch(error=>{pending={action:intent,error:String(error.message||error)};throw error;});}
 return Object.freeze({transact,retryPending(){if(!pending)return Promise.resolve(null);return transact(pending.action);},diagnostics:()=>({pending:!!pending,error:pending?.error||null,action:pending?.action.type||null}),clearPending(){pending=null;}});
}
