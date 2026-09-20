import {waitForSignal} from '../runtime/abortable.mjs?v=c91114c944607feb';
export async function prepareRenderPolicies({getTier,applyTier,prepare,paint=async()=>{},signal,maximumTier='high'}){
 const tiers=['low','balanced','high','cinematic'],limit=tiers.indexOf(maximumTier);
 if(limit<0)throw new RangeError('Unknown maximum rendering tier: '+maximumTier);
 const previous=getTier(),started=performance.now(),prepared=[];
 try{for(const tier of tiers.slice(0,limit+1)){signal?.throwIfAborted();applyTier(tier);await waitForSignal(prepare(tier),signal);signal?.throwIfAborted();prepared.push(tier);await waitForSignal(paint(),signal);signal?.throwIfAborted();}return{prepared,durationMs:performance.now()-started};}
 finally{applyTier(previous);}
}

/** Compile while the scene owns a stable set of materials. No asynchronous
 * program polling survives a streamed mesh disposal. The draw pays linking
 * cost inside the visible loading phase, never on the first driving frame. */
export async function prewarmStableScene({setLocked,settleStreaming,compile,draw,signal}){
 signal?.throwIfAborted();setLocked(true);try{await waitForSignal(settleStreaming(),signal);signal?.throwIfAborted();await waitForSignal(compile(),signal);signal?.throwIfAborted();await waitForSignal(draw(),signal);}finally{setLocked(false);}
}

/** Pay first-use exterior GPU work behind loading, without advancing camera animation. */
export async function prewarmViews({capture,select,selections=[select],draw,restore}){const state=capture();try{for(const choose of selections){choose();await draw();}}finally{restore(state);}await draw();}


/** Only successful, equivalent preparations are reused. Serialization protects
 * the renderer's temporary quality state; aborted work cannot populate a cache. */
export function createRenderPreparationCache({limit=4}={}){
 const entries=new Map();let tail=Promise.resolve(),generation=0,hits=0,misses=0;
 limit=Math.max(1,Math.min(16,Math.floor(Number(limit)||4)));
 return {
  prepare(key,options){
   const epoch=generation;
   const operation=tail.then(async()=>{
    options.signal?.throwIfAborted();
    const fullKey=JSON.stringify([key,options.maximumTier||'high']);
    if(epoch===generation&&entries.has(fullKey)){const report=entries.get(fullKey);entries.delete(fullKey);entries.set(fullKey,report);hits++;return {...report,cached:true};}
    misses++;const report=await prepareRenderPolicies(options);options.signal?.throwIfAborted();
    if(epoch===generation){entries.set(fullKey,report);while(entries.size>limit)entries.delete(entries.keys().next().value);}
    return {...report,cached:false};
   });tail=operation.catch(()=>{});return waitForSignal(operation,options.signal);
  },
  invalidate(){generation++;entries.clear();},
  diagnostics:()=>({entries:entries.size,limit,generation,hits,misses})
 };
}
/** A start-time key, not a per-frame traversal. Transforms/visibility and mutable
 * shader version counters are deliberately excluded; resource replacement and
 * relevant feature variants invalidate it without invalidating every warmup. */
export function renderPreparationKey(scene,context={}){
 const resources=[];
 scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;const mats=Array.isArray(o.material)?o.material:[o.material];
  resources.push([g?.uuid,...Object.keys(g?.attributes||{}).sort(),...mats.map(m=>m?[m.uuid,m.type,m.side,m.alphaTest>0,!!m.transparent,m.skinning,!!m.transmission,...['map','normalMap','roughnessMap','metalnessMap','alphaMap','aoMap','emissiveMap'].map(k=>m[k]?.uuid||''),JSON.stringify(m.defines||{})]:null)]);
 });return JSON.stringify([context,resources]);
}
