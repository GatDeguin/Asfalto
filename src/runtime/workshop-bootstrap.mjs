import {workshopBootstrapManifest as manifest} from './workshop-bootstrap-manifest.mjs?v=6238a53a583b3bc4';
import {boundedOperation} from './demand-loader.mjs';

/** A failed 598 KB bootstrap is recoverable. It must never fetch the 59 MB authoring payload. */
export async function loadWorkshopBootstrap(_original,{read=globalThis.AsfaltoV6AssetCore.readExternalPayload,signal,timeoutMs=45000}={}){
 const node={dataset:{externalUrl:new URL(manifest.url,import.meta.url).href,bytes:String(manifest.bytes),sha256:manifest.sha256}};
 return boundedOperation(async active=>{
  const bytes=await read(node,(url,options)=>fetch(url,{...options,signal:active}));active.throwIfAborted();
  return {payload:JSON.parse(new TextDecoder().decode(bytes)),full:false};
 },{signal,timeoutMs,label:'Motor del taller'});
}
export function readDeferredPayload(node,signal){return boundedOperation(async active=>{
 const bytes=await globalThis.AsfaltoV6AssetCore.readExternalPayload(node,(url,options)=>fetch(url,{...options,signal:active}));active.throwIfAborted();return bytes;
 },{signal,label:node?.dataset?.filename||'Recurso del juego'});}
