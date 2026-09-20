import {waitForSignal} from './abortable.mjs?v=c91114c944607feb';

/** One deferred runtime. Transport results are committed only by the live attempt. */
export function createStartupDemand({prepareTimeoutMs=180000}={}) {
  if (!Number.isFinite(prepareTimeoutMs) || prepareTimeoutMs <= 0) throw new RangeError('Invalid preparation timeout');
  let phase='dormant', error=null, attempts=0, controller=null, wake=null, running=null;
  const consumers=new Set();
  const abortError=()=>new DOMException('Preparación cancelada','AbortError');
  function settle(consumer, failure) {
    if (!consumers.delete(consumer)) return;
    consumer.signal?.removeEventListener('abort',consumer.abort);
    if (failure) consumer.reject(failure); else consumer.resolve(true);
  }
  function request({signal,onStage}={}) {
    if(signal?.aborted)return Promise.reject(signal.reason||abortError());
    if(phase==='prepared')return Promise.resolve(true);
    return new Promise((resolve,reject)=>{
      // A new caller must not join a canceled attempt whose catch has not run yet.
      const attempt=phase==='loading'&&!controller?.signal.aborted?attempts:attempts+1;
      const consumer={resolve,reject,signal,onStage,attempt};
      consumer.abort=()=>{
        settle(consumer,signal.reason||abortError());
        if(phase==='loading'&&![...consumers].some(c=>c.attempt===attempts))controller?.abort(abortError());
      };
      consumers.add(consumer);
      signal?.addEventListener('abort',consumer.abort,{once:true});
      wake?.();
    });
  }
  function run(load) {
    if(running)return running;
    if(typeof load!=='function')throw new TypeError('Startup loader is required');
    running=(async()=>{for(;;){
      if(!consumers.size)await new Promise(resolve=>wake=resolve);
      wake=null;if(!consumers.size)continue;
      phase='loading';error=null;const attempt=++attempts;
      const owned=new AbortController();controller=owned;const signal=owned.signal;
      const timeout=setTimeout(()=>owned.abort(new DOMException('La preparación del cockpit tardó demasiado. Podés reintentar.','TimeoutError')),prepareTimeoutMs);
      try {
        const operation=Promise.resolve().then(()=>{
          signal.throwIfAborted();
          return load({signal,stage:(...args)=>{
            if(controller!==owned||signal.aborted)return;
            for(const c of consumers)if(c.attempt===attempt)c.onStage?.(...args);
          }});
        });
        const result=await waitForSignal(operation,signal);
        signal.throwIfAborted();
        if(![...consumers].some(c=>c.attempt===attempt))throw abortError();
        phase='prepared';
        for(const c of [...consumers])if(c.attempt===attempt)settle(c);
        return result;
      } catch(failure) {
        const current=[...consumers].filter(c=>c.attempt===attempt);
        phase=current.length?'failed':'dormant';
        error=current.length?String(failure?.message||failure):null;
        for(const c of current)settle(c,failure);
      } finally {
        clearTimeout(timeout);
        if(controller===owned)controller=null;
      }
    }})();
    return running;
  }
  return Object.freeze({request,run,diagnostics:()=>({phase,error,attempts,consumers:consumers.size})});
}
export const startupDemand=globalThis.__asfaltoV7Startup||createStartupDemand();
if(!globalThis.__asfaltoV7Startup)globalThis.__asfaltoV7Startup=startupDemand;

export {waitForSignal,waitForCondition,waitForAnimationFrame} from './abortable.mjs?v=c91114c944607feb';
