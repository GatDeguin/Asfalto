import {workshopBootstrapManifest as manifest} from './workshop-bootstrap-manifest.mjs';
/** Preserve original asset integrity checks and original full-payload fallback. */
export async function loadWorkshopBootstrap(original,{read=globalThis.AsfaltoV6AssetCore.readExternalPayload,warn=console.warn}={}){
 const node={dataset:{externalUrl:new URL(manifest.url,import.meta.url).href,bytes:String(manifest.bytes),sha256:manifest.sha256}};
 try{return{payload:JSON.parse(new TextDecoder().decode(await read(node))),full:false};}
 catch(error){warn('Bootstrap del taller no disponible; usando el recurso original.',error);return{payload:JSON.parse(new TextDecoder().decode(await read(original))),full:true};}
}
export async function readDeferredPayload(node,signal){if(signal?.aborted)throw signal.reason;const bytes=await globalThis.AsfaltoV6AssetCore.readExternalPayload(node,(url,options)=>fetch(url,{...options,signal}));if(signal?.aborted)throw signal.reason;return bytes;}
