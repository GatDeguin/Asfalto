import {inflateGzipBytes} from './inflate.mjs?v=1d1e76c615135552';
import {cockpitSourceParts} from './cockpit-source-manifest.mjs?v=357ec1b3aa92c849';
import {readDeferredPayload} from './workshop-bootstrap.mjs?v=e2edfbd0db5a168f';
import {boundedOperation} from './demand-loader.mjs?v=4a2efb64f7eb24a0';
/** Exact original PC GLBs, individually gzip transported. No JSON/base64/string copies. */
export function readCockpitSourcePart(key,{signal}={}){
 const entry=cockpitSourceParts[key];if(!entry)throw new Error('Pieza original desconocida: '+key);
 return boundedOperation(async active=>{
  const bytes=await readDeferredPayload({dataset:{externalUrl:new URL(entry.url,import.meta.url).href,bytes:String(entry.bytes),sha256:entry.sha256}},active);
  return inflateGzipBytes(bytes,{signal:active});
 },{signal,timeoutMs:90000,label:'Pieza '+key});
}
