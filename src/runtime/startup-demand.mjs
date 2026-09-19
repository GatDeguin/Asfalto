import {waitWithSignal} from './abortable-task.mjs';
/** One deferred runtime. Cancellable transport is distinct from irreversible scene construction. */
export function createStartupDemand({prepareTimeoutMs=180000}={}){
 let phase='dormant',error=null,attempts=0,controller=null,wake=null,running=null;const consumers=new Set();
 const abortError=()=>new DOMException('Preparación cancelada','AbortError');
 const settle=(consumer,failure)=>{consumers.delete(consumer);consumer.signal?.removeEventListener('abort',consumer.abort);failure?consumer.reject(failure):consumer.resolve(true);};
 function request({signal,onStage}={}){
  if(signal?.aborted)return Promise.reject(signal.reason||abortError());
  if(phase==='prepared')return Promise.resolve(true);
  return new Promise((resolve,reject)=>{const consumer={resolve,reject,signal,onStage,attempt:phase==='loading'&&controller&&!controller.signal.aborted?attempts:null};consumer.abort=()=>{settle(consumer,signal.reason||abortError());if(!consumers.size&&phase==='loading')controller?.abort(abortError());};consumers.add(consumer);signal?.addEventListener('abort',consumer.abort,{once:true});wake?.();});
 }
 function run(load){
  if(running)return running;
  running=(async()=>{for(;;){
   if(!consumers.size)await new Promise(resolve=>wake=resolve);wake=null;if(!consumers.size)continue;
   phase='loading';error=null;attempts++;for(const c of consumers)c.attempt=attempts;controller=new AbortController();const signal=controller.signal;const timeout=setTimeout(()=>controller?.abort(new DOMException('La preparación del cockpit tardó demasiado. Podés reintentar.','TimeoutError')),prepareTimeoutMs);
   try{const result=await waitWithSignal(load({signal,stage:(...args)=>{if(!signal.aborted)for(const c of consumers)c.onStage?.(...args);}}),signal);if(signal.aborted||!consumers.size)throw signal.reason||abortError();clearTimeout(timeout);phase='prepared';for(const c of [...consumers])settle(c);controller=null;return result;}
   catch(failure){clearTimeout(timeout);controller=null;const affected=[...consumers].filter(c=>c.attempt===attempts);if(signal.aborted&&!affected.length){phase='dormant';}else{phase='failed';error=String(failure?.message||failure);for(const c of affected)settle(c,failure);}}
  }})();return running;
 }
 return Object.freeze({request,run,diagnostics:()=>({phase,error,attempts,consumers:consumers.size})});
}
export const startupDemand=globalThis.__asfaltoV7Startup||createStartupDemand();
if(!globalThis.__asfaltoV7Startup)globalThis.__asfaltoV7Startup=startupDemand;
