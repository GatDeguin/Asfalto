/** Shared full-resolution PMREM targets. maxIdle bounds only unused targets;
 * active leases are never evicted. dispose() force-invalidates every lease. */
export function createPmremCache({build,maxIdle=2,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 if(typeof build!=='function')throw new TypeError('PMREM build function required');
 if(!Number.isInteger(maxIdle)||maxIdle<0)throw new RangeError('maxIdle must be a nonnegative integer');
 const entries=new Map(),idle=new Map();let disposed=false;
 const closed=()=>new Error('PMREM cache disposed');
 function destroy(entry){idle.delete(entry.key);if(entries.get(entry.key)===entry)entries.delete(entry.key);entry.target?.dispose();entry.target=null;}
 function trim(){while(idle.size>maxIdle)destroy(idle.values().next().value);}
 return{
  async acquire(key,source){
   if(disposed)throw closed();
   let entry=entries.get(key);
   if(!entry){
    entry={key,refs:0,target:null,promise:null};entries.set(key,entry);
    entry.promise=(async()=>{
     await yieldTask();if(disposed)throw closed();
     const target=await build(source);
     if(disposed){target.dispose();throw closed();}
     entry.target=target;return target;
    })().catch(error=>{if(entries.get(key)===entry)entries.delete(key);throw error;});
   }
   entry.refs++;idle.delete(key);
   let target;
   try{target=await entry.promise;if(disposed)throw closed();}
   catch(error){entry.refs--;throw error;}
   let released=false;
   return{texture:target.texture,width:target.width,height:target.height,dispose(){
    if(released)return;released=true;entry.refs--;
    if(!disposed&&entry.refs===0){idle.set(key,entry);trim();}
   }};
  },
  dispose(){if(disposed)return;disposed=true;for(const entry of entries.values())entry.target?.dispose();entries.clear();idle.clear();},
  diagnostics(){return{disposed,entries:entries.size,idle:idle.size,active:[...entries.values()].filter(entry=>entry.refs>0).length,maxIdle};},
 };
}
