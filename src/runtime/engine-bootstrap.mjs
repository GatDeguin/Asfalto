import './diagnostics.mjs?v=ea513f78afb7a709';
import {loadWorkshopBootstrap} from './workshop-bootstrap.mjs?v=e2edfbd0db5a168f';
import {boundedOperation} from './demand-loader.mjs?v=4a2efb64f7eb24a0';

const scripts=new Map();
export function loadLegacyScript(id,{signal}={}){
 if(!scripts.has(id)){
  const source=document.getElementById(id)?.dataset.deferredSrc;
  if(!source)return Promise.reject(new Error('Dependencia no declarada: '+id));
  const pending=boundedOperation(active=>new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=source;script.async=false;
   const cleanup=()=>{script.onload=script.onerror=null;active.removeEventListener('abort',abort);};
   const abort=()=>{cleanup();script.remove();reject(active.reason);};
   script.onload=()=>{cleanup();resolve();};script.onerror=()=>{cleanup();script.remove();reject(new Error('No se pudo cargar '+id));};
   active.addEventListener('abort',abort,{once:true});document.head.append(script);
  }),{label:id,timeoutMs:45000}).catch(error=>{scripts.delete(id);throw error;});scripts.set(id,pending);
 }
 return boundedOperation(()=>scripts.get(id),{signal,label:id});
}
let starting=null,phase='idle',failure=null,terminalError=null,moduleStarted=false;
window.addEventListener('chevy-three-error',event=>{if(!moduleStarted)return;terminalError=event.detail instanceof Error?event.detail:new Error(String(event.detail));terminalError.requiresReload=true;phase='failed';failure=terminalError.message;});
function start({signal}={}){
 if(terminalError)return Promise.reject(terminalError);
 if(globalThis.__chevyV6Three)return Promise.resolve(globalThis.__chevyV6Three);
 if(!starting){phase='loading';failure=null;
  starting=boundedOperation(async active=>{
   // Validate the small document before importing a module with top-level state.
   // An HTTP/checksum failure can now be retried without a poisoned ESM cache.
   globalThis.__asfaltoBootstrapDocument=await loadWorkshopBootstrap(null,{signal:active});
   await loadLegacyScript('cockpit-v5-preflight',{signal:active});
   const ready=new Promise((resolve,reject)=>{
    const cleanup=()=>{window.removeEventListener('chevy-three-ready',ok);window.removeEventListener('chevy-three-error',bad);active.removeEventListener('abort',aborted);};
    const ok=e=>{cleanup();resolve(e.detail);},bad=e=>{cleanup();reject(e.detail);},aborted=()=>{cleanup();reject(active.reason);};
    window.addEventListener('chevy-three-ready',ok,{once:true});window.addEventListener('chevy-three-error',bad,{once:true});active.addEventListener('abort',aborted,{once:true});
    moduleStarted=true;
    import('../legacy/module-02.mjs?v=7b1c4280bdcfebc6').catch(error=>bad({detail:error}));
   });
   return ready;
  },{timeoutMs:90000,label:'Motor 3D'}).then(value=>{phase='ready';return value;},error=>{phase=error?.name==='AbortError'?'aborted':'failed';failure=String(error?.message||error);starting=null;if(moduleStarted){terminalError=error;terminalError.requiresReload=true;}throw error;});
 }
 return boundedOperation(()=>starting,{signal,timeoutMs:90000,label:'Motor 3D'});
}
globalThis.__asfaltoEngineBootstrap={start,physics:options=>loadLegacyScript('asfalto-v6-rapier',options),diagnostics:()=>({phase,error:failure,canRetry:!terminalError,requiresReload:!!terminalError,loadedScripts:[...scripts.keys()]})};
