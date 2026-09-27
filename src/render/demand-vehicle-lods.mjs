/** Low-detail decoding/installation only occurs while presentation is explicitly held. */
export function createDemandVehicleLods({primary,prefetch,load,select,signal}){
 const lifetime=new AbortController();const abortLifetime=()=>lifetime.abort(signal?.reason);if(signal?.aborted)abortLifetime();else signal?.addEventListener('abort',abortLifetime,{once:true});
 const models=new Map([[0,primary]]),states=new Map();let wanted=0,active=0,disposed=false,loading=null,controller=null;const requested=new Set();
 function update(sample={}){if(disposed)return false;wanted=select(sample,active);if(wanted&&!requested.has(wanted)){requested.add(wanted);Promise.resolve(prefetch(wanted,lifetime.signal)).catch(()=>requested.delete(wanted));}
 const safe=!!sample.paused||!!sample.editing||sample.active===false;
 if(!safe&&controller){controller.abort();controller=null;}
 if(safe&&wanted&&!models.has(wanted)&&!loading){const level=wanted,c=controller=new AbortController();const abort=()=>c.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});loading=(async()=>{let next;try{signal?.throwIfAborted();next=await load(level,c.signal);c.signal.throwIfAborted();if(disposed)throw Error('Disposed LOD');for(const [name,args] of states)next[name]?.(...args);models.set(level,next);}catch{next?.dispose();}finally{signal?.removeEventListener('abort',abort);if(controller===c)controller=null;loading=null;}})();}
 active=models.has(wanted)?wanted:0;for(const [level,model] of models){const lodActive=level===active&&sample.active!==false;model.root.visible=level===active;model.setActive?.(lodActive);model.update({...sample,active:lodActive,projectedPixels:Infinity});}return true;}
 const target={root:primary.root,update,diagnostics:()=>({...primary.diagnostics(),lod:active,requestedLod:wanted,residentLods:[...models.keys()],loading:!!loading}),dispose(){if(disposed)return false;disposed=true;lifetime.abort();signal?.removeEventListener('abort',abortLifetime);controller?.abort();for(const model of models.values())model.dispose();models.clear();return true;}};
 return new Proxy(target,{get(object,key){if(key in object)return object[key];const value=primary[key];if(typeof value!=='function')return value;return(...args)=>{if(String(key).startsWith('set')||key==='resetCondition'){states.set(key,args);let result;for(const model of models.values())result=model[key]?.(...args);return result;}return value.apply(primary,args);};}});
}

