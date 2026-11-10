import {PROFILE_KEY,withProfileWriteLock,profileRevision,readPersistentProfile} from '../runtime/profile-persistence.mjs?v=34c8f093c015eb86';
import {validateRoadTestReceipt,freezeRoadTestData,roadTestResultSheet} from './v7-roadtest-receipts.mjs?v=b2a818b5bf186307';
import {applyWorkshopProgress,ROAD_TEST_TOKENS} from './activity-rewards.mjs?v=684503a891f85e8a';
export {roadTestResultSheet};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Same workshop progression as the activity cards, granted atomically from a new physical receipt.
const REWARD_AXES={vmax:['dominio','ruta'],accel100:['dominio','mecanica'],accel160:['dominio','competencia'],m500:['historia','dominio'],m1000:['mecanica','historia'],recovery:['mecanica'],brake100:['dominio','mecanica'],slalom:['dominio','competencia'],turn:['historia','mecanica'],wet:['ruta','dominio'],speedo:['historia'],consumption:['ruta','mecanica']};
function applyReceiptProgress(draft,receipt){
 return applyWorkshopProgress(draft,Object.fromEntries(REWARD_AXES[receipt.testId].map(axis=>[axis,7])),ROAD_TEST_TOKENS);
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
   if(saved){validateRoadTestReceipt(saved);if(!equal(saved,receipt))throw new Error('El identificador del resultado ya existe con otra medición.');const recovered=profileRevision(disk)!==profileRevision(current)||!extension(current).receipts[receipt.resultId];replaceProfile(freezeReceipts(disk));pending=null;return{profile:disk,changed:false,persisted:true,recovered,tokensAwarded:diskExt.tokenAwards?.[receipt.resultId]??ROAD_TEST_TOKENS};}
   if(profileRevision(disk)!==profileRevision(current))throw new Error('Otro taller actualizó el archivo. Recargá antes de guardar.');
   const ext=extension(current);if(Object.values(ext.receipts).some(r=>r.sessionId===receipt.sessionId))throw new Error('La sesión ya tiene un resultado persistido.');
   const draft=structuredClone(current);draft.roadTestsV7={...structuredClone(ext),revision:ext.revision+1,receipts:{...structuredClone(ext.receipts),[receipt.resultId]:receipt}};draft.storageRevision=(disk?.storageRevision||0)+1;
   if(intent.sheet){if(intent.sheet.receiptId!==receipt.resultId||intent.sheet.testId!==receipt.testId)throw new Error('La ficha no corresponde al recibo.');draft.sheets=[roadTestResultSheet(receipt,{title:intent.sheet.title,series:intent.sheet.series||[]}),...(draft.sheets||[])].slice(0,50);}
   const tokensAwarded=applyReceiptProgress(draft,receipt);draft.roadTestsV7.tokenAwards={...ext.tokenAwards,[receipt.resultId]:tokensAwarded};const serialized=JSON.stringify(draft);storage.setItemPersistent(key,serialized);const readback=storage.getItemPersistent(key);if(readback!==serialized)throw new Error('No se pudo verificar el guardado físico en disco.');
   const verified=JSON.parse(readback);validateRoadTestReceipt(verified.roadTestsV7.receipts[receipt.resultId]);replaceProfile(freezeReceipts(verified));pending=null;return{profile:verified,changed:true,persisted:true,recovered:false,tokensAwarded};
  }));queue=task.catch(()=>{});return task.catch(error=>{if(attemptGeneration===generation)pending={...intent,error:String(error?.message||error)};throw error;});
 }
 return Object.freeze({accept,retryPending(){if(!pending)return Promise.resolve(null);return accept(pending.receipt,{isCurrent:pending.isCurrent,sheet:pending.sheet});},clearPending(){generation++;pending=null;},diagnostics:()=>({pending:!!pending,resultId:pending?.receipt.resultId||null,error:pending?.error||null})});
}
