import {inflateGzipBytes} from './inflate.mjs';
import {cockpitSourceParts} from './cockpit-source-manifest.mjs';
import {readDeferredPayload} from './workshop-bootstrap.mjs';
import {boundedOperation} from './demand-loader.mjs';
/** Exact original PC GLBs, individually gzip transported. No JSON/base64/string copies. */
export function readCockpitSourcePart(key,{signal}={}){
 const entry=cockpitSourceParts[key];if(!entry)throw new Error('Pieza original desconocida: '+key);
 return boundedOperation(async active=>{
  const bytes=await readDeferredPayload({dataset:{externalUrl:new URL(entry.url,import.meta.url).href,bytes:String(entry.bytes),sha256:entry.sha256}},active);
  return inflateGzipBytes(bytes,{signal:active});
 },{signal,timeoutMs:90000,label:'Pieza '+key});
}
