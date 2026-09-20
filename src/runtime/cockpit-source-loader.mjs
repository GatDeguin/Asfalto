import {cockpitSourceParts} from './cockpit-source-manifest.mjs';
import {readDeferredPayload} from './workshop-bootstrap.mjs';
import {boundedOperation} from './demand-loader.mjs';
/** Exact original PC GLBs, individually gzip transported. No JSON/base64/string copies. */
export function readCockpitSourcePart(key,{signal}={}){
 const entry=cockpitSourceParts[key];if(!entry)throw new Error('Pieza original desconocida: '+key);
 return boundedOperation(async active=>{
  const bytes=await readDeferredPayload({dataset:{externalUrl:new URL(entry.url,import.meta.url).href,bytes:String(entry.bytes),sha256:entry.sha256}},active);
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader=stream.getReader();let complete=false;const abort=()=>void reader.cancel(active.reason).catch(error=>console.warn('Cancelación del descompresor',error));active.addEventListener('abort',abort,{once:true});
  try{const chunks=[];let length=0;while(true){active.throwIfAborted();const next=await reader.read();if(next.done)break;chunks.push(next.value);length+=next.value.byteLength;if(length>180*1024*1024)throw new Error('Pieza descomprimida excede el límite');}
   active.throwIfAborted();const out=new Uint8Array(length);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}complete=true;return out;
  }finally{active.removeEventListener('abort',abort);if(!complete)await reader.cancel();reader.releaseLock();}
 },{signal,timeoutMs:90000,label:'Pieza '+key});
}
