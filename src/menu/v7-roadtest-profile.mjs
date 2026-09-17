import {PROFILE_KEY,withProfileWriteLock,profileRevision,readPersistentProfile} from '../runtime/profile-persistence.mjs';
import {validateRoadTestReceipt,freezeRoadTestData,roadTestResultSheet} from './v7-roadtest-receipts.mjs?v=400-review-r144-20260917';
export {roadTestResultSheet};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Same workshop progression as the activity cards, granted atomically from a new physical receipt.
const REWARD_AXES={vmax:['dominio','ruta'],accel100:['dominio','mecanica'],accel160:['dominio','competencia'],m500:['historia','dominio'],m1000:['mecanica','historia'],recovery:['mecanica'],brake100:['dominio','mecanica'],slalom:['dominio','competencia'],turn:['historia','mecanica'],wet:['ruta','dominio'],speedo:['historia'],consumption:['ruta','mecanica']};
function applyReceiptProgress(draft,receipt){
 const axes=REWARD_AXES[receipt.testId],oldLevel=draft.level||1;draft.axes={...(draft.axes||{})};for(const axis of axes)draft.axes[axis]=Math.min(100,Math.max(0,Number(draft.axes[axis])||0)+7);
 draft.xp=(Number(draft.xp)||0)+axes.length*7;draft.level=1+Math.floor(draft.xp/80);draft.workshopTokens=(Number(draft.workshopTokens)||0)+2+(draft.level>oldLevel?1:0);
 const unlocked=new Set(draft.unlocked||[]);if(draft.level>=2)for(const id of ['sierraMap','periodWheels','mechanicNotes'])unlocked.add(id);if(draft.level>=3)for(const id of ['timingCamera','coastRoute'])unlocked.add(id);if(draft.axes.competencia>=25)unlocked.add('clubBadge');draft.unlocked=[...unlocked];
}
function extension(profile){const ext=profile?.roadTestsV7;if(ext&&(ext.schema!=='asfalto-road-tests/v1'||!Number.isSafeInteger(ext.revision)||ext.revision<0||!ext.receipts||typeof ext.receipts!=='object'||Array.isArray(ext.receipts)))throw new Error('Archivo de pruebas no compatible.');return ext||{schema:'asfalto-road-tests/v1',revision:0,receipts:{}};}
function freezeReceipts(profile){for(const receipt of Object.values(profile?.roadTestsV7?.receipts||{}))freezeRoadTestData(receipt);return profile;}
export function createRoadTestProfileStore({storage=globalThis.__asfaltoV7Storage,getProfile,replaceProfile,withLock=withProfileWriteLock,key=PROFILE_KEY}={}){
 let queue=Promise.resolve(),pending=null,generation=0;
 function accept(value,{isCurrent=()=>true,sheet=null}={}){
  const attemptGeneration=generation,receipt=validateRoadTestReceipt(value),intent={receipt,isCurrent,sheet:sheet?structuredClone(sheet):null};
  const task=queue.then(()=>withLock(()=>{
   if(!isCurrent())throw new Error('El intento ya no es la sesión actual.');
   const current=getProfile(),disk=readPersistentProfile(storage,key),diskExt=extension(disk),saved=diskExt.receipts[receipt.resultId];
   if(saved){validateRoadTestReceipt(saved);if(!equal(saved,receipt))throw new Error('El identificador del resultado ya existe con otra medición.');const recovered=profileRevision(disk)!==profileRevision(current)||!extension(current).receipts[receipt.resultId];replaceProfile(freezeReceipts(disk));pending=null;return{profile:disk,changed:false,persisted:true,recovered};}
   if(profileRevision(disk)!==profileRevision(current))throw new Error('Otro taller actualizó el archivo. Recargá antes de guardar.');
   const ext=extension(current);if(Object.values(ext.receipts).some(r=>r.sessionId===receipt.sessionId))throw new Error('La sesión ya tiene un resultado persistido.');
   const draft=structuredClone(current);draft.roadTestsV7={...structuredClone(ext),revision:ext.revision+1,receipts:{...structuredClone(ext.receipts),[receipt.resultId]:receipt}};draft.storageRevision=(disk?.storageRevision||0)+1;
   if(intent.sheet){if(intent.sheet.receiptId!==receipt.resultId||intent.sheet.testId!==receipt.testId)throw new Error('La ficha no corresponde al recibo.');draft.sheets=[roadTestResultSheet(receipt,{title:intent.sheet.title,series:intent.sheet.series||[]}),...(draft.sheets||[])].slice(0,50);}
   applyReceiptProgress(draft,receipt);const serialized=JSON.stringify(draft);storage.setItemPersistent(key,serialized);const readback=storage.getItemPersistent(key);if(readback!==serialized)throw new Error('No se pudo verificar el guardado físico en disco.');
   const verified=JSON.parse(readback);validateRoadTestReceipt(verified.roadTestsV7.receipts[receipt.resultId]);replaceProfile(freezeReceipts(verified));pending=null;return{profile:verified,changed:true,persisted:true,recovered:false};
  }));queue=task.catch(()=>{});return task.catch(error=>{if(attemptGeneration===generation)pending={...intent,error:String(error?.message||error)};throw error;});
 }
 return Object.freeze({accept,retryPending(){if(!pending)return Promise.resolve(null);return accept(pending.receipt,{isCurrent:pending.isCurrent,sheet:pending.sheet});},clearPending(){generation++;pending=null;},diagnostics:()=>({pending:!!pending,resultId:pending?.receipt.resultId||null,error:pending?.error||null})});
}
