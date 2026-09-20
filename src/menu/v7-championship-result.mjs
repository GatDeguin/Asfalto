import {acceptStage} from './v7-championship-state.mjs?v=54514a098688545f';
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
export async function configurationFingerprint(configuration){const bytes=new TextEncoder().encode(JSON.stringify(canonical(configuration)));const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');}
export function buildChampionshipReceipt(final,context){
 if(context.qaMode!==false)throw new Error('Sesión de QA: no publica resultados ni premios.');
 if(!final?.complete||final.cancelled||final.valid!==true||final.invalidReasons?.length||final.fixedHz!==120)throw new Error('Clasificación física incompleta o invalidada.');
 if(!Array.isArray(final.participants)||final.participants.length!==2||final.participants.some(p=>p.status==='pending'||p.status==='finished'&&p.valid!==true))throw new Error('Llegada física no válida.');
 const receipt={resultId:context.resultId,runId:context.run.id,stageId:context.run.attempt?.stageId,attemptId:context.run.attempt?.id,configurationHash:context.configurationHash,trackId:context.trackId,skyId:context.skyId,weather:context.weather,finishedAt:context.finishedAt,source:'authoritative-race',qa:false,valid:true,classification:final.participants.map(p=>({entrantId:p.id,status:p.status,checkpointsComplete:p.checkpointComplete,activeSeconds:p.activeSeconds,penaltySeconds:p.penaltySeconds,officialSeconds:p.officialSeconds,finishTick:p.finishTick,reason:p.terminalReason||undefined}))};
 // The pure state validator is the same gate used when replaying saved seasons.
 acceptStage(context.run,receipt);return receipt;
}
