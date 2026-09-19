import {waitWithSignal} from '../runtime/abortable-task.mjs';
export async function prepareRenderPolicies({getTier,applyTier,prepare,paint=async()=>{},signal,maximumTier='high'}){
 const tiers=['low','balanced','high','cinematic'],limit=tiers.indexOf(maximumTier);
 if(limit<0)throw new RangeError('Unknown maximum rendering tier: '+maximumTier);
 const previous=getTier(),started=performance.now(),prepared=[];
 try{for(const tier of tiers.slice(0,limit+1)){signal?.throwIfAborted();applyTier(tier);await waitWithSignal(prepare(tier),signal);signal?.throwIfAborted();prepared.push(tier);await waitWithSignal(paint(),signal);signal?.throwIfAborted();}return{prepared,durationMs:performance.now()-started};}
 finally{applyTier(previous);}
}

/** Compile while the scene owns a stable set of materials. No asynchronous
 * program polling survives a streamed mesh disposal. The draw pays linking
 * cost inside the visible loading phase, never on the first driving frame. */
export async function prewarmStableScene({setLocked,settleStreaming,compile,draw,signal}){
 signal?.throwIfAborted();setLocked(true);try{await waitWithSignal(settleStreaming(),signal);signal?.throwIfAborted();await compile();signal?.throwIfAborted();await waitWithSignal(draw(),signal);}finally{setLocked(false);}
}

/** Pay first-use exterior GPU work behind loading, without advancing camera animation. */
export async function prewarmViews({capture,select,selections=[select],draw,restore,signal}){signal?.throwIfAborted();const state=capture();try{for(const choose of selections){signal?.throwIfAborted();choose();await waitWithSignal(draw(),signal);signal?.throwIfAborted();}}finally{restore(state);}signal?.throwIfAborted();await waitWithSignal(draw(),signal);}


/** Cache only completed preparations; serialize global renderer state changes.
 * The key is evaluated after preparation too, since first-use geometry/textures
 * may become resident while warming. Object identity matters, not just names. */
export function createRenderWarmupCache(){
 let key=null,report=null,tail=Promise.resolve(),epoch=0,hits=0,misses=0,disposed=false;
 const controllers=new Set();
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 function invalidate(){epoch++;key=null;report=null;for(const c of controllers)c.abort(new DOMException('La preparación gráfica cambió','AbortError'));}
 function prepare(options){
  if(disposed)return Promise.reject(new Error('Render warmup cache disposed'));
  const controller=new AbortController(),source=options.signal;
  const abort=()=>controller.abort(source.reason);if(source?.aborted)abort();else source?.addEventListener('abort',abort,{once:true});
  controllers.add(controller);const signal=controller.signal,revision=epoch;
  const readKey=()=>[...(options.getKey?.()||[]),options.maximumTier||'high'];
  const operation=tail.then(async()=>{
   signal.throwIfAborted();const requested=readKey();
   if(same(requested,key)){hits++;return {...report,cacheHit:true};}
   misses++;const next=await prepareRenderPolicies({...options,signal});signal.throwIfAborted();
   if(revision!==epoch)throw new DOMException('Preparación obsoleta','AbortError');
   key=readKey();report=next;return {...next,cacheHit:false};
  }).finally(()=>{source?.removeEventListener('abort',abort);controllers.delete(controller);});
  tail=operation.then(()=>{},()=>{});
  return waitWithSignal(operation,signal);
 }
 return {prepare,invalidate,diagnostics:()=>({hits,misses,cached:!!key,pending:controllers.size,epoch,disposed}),dispose(){if(disposed)return;disposed=true;invalidate();}};
}
