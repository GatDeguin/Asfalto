/** One visual clock. Physics callbacks keep their own unchanged fixed accumulator. */
export function createFrameScheduler({request=requestAnimationFrame,cancel=cancelAnimationFrame,onError=error=>{console.error('Frame owner failed',error);},visible=()=>true}={}){
 const owners=new Map();let frame=null,disposed=false,frames=0;
 const eligible=entry=>visible()&&entry.enabled();
 function wake(){if(!disposed&&frame===null&&[...owners.values()].some(eligible))frame=request(tick);}
 function tick(time){frame=null;if(disposed)return;frames++;
  for(const entry of [...owners.values()]){
   if(!owners.has(entry.id)||!eligible(entry)){entry.last=-Infinity;continue;}
   if(time-entry.last+0.1<entry.interval)continue;entry.last=time;
   try{entry.callback(time);}catch(error){owners.delete(entry.id);onError(error,entry.id);}
  }wake();
 }
 function subscribe(id,callback,{hz=0,enabled=()=>true}={}){
  if(disposed)throw new Error('Frame scheduler disposed');if(owners.has(id))throw new Error('Duplicate frame owner: '+id);
  const entry={id,callback,enabled,interval:hz>0?1000/hz:0,last:-Infinity};owners.set(id,entry);wake();
  return ()=>{if(owners.get(id)!==entry)return false;owners.delete(id);if(![...owners.values()].some(eligible)&&frame!==null){cancel(frame);frame=null;}return true;};
 }
 return {subscribe,wake,diagnostics:()=>({activeRaf:frame===null?0:1,frames,owners:[...owners.values()].map(e=>({id:e.id,hz:e.interval?1000/e.interval:0,active:eligible(e)}))}),dispose(){disposed=true;if(frame!==null)cancel(frame);frame=null;owners.clear();}};
}
let shared;
export function getFrameScheduler(){
 if(shared)return shared;
 shared=createFrameScheduler({visible:()=>!document.hidden,onError:(error,owner)=>{console.error('Asfalto: error de animación en '+owner,error);globalThis.dispatchEvent(new CustomEvent('asfalto:runtime-fault',{detail:{owner,message:String(error?.message||error)}}));}});
 const observer=new MutationObserver(()=>shared.wake());observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 const wake=()=>shared.wake();document.addEventListener('visibilitychange',wake);
 globalThis.addEventListener('pageshow',wake);
 const close=event=>{if(event.persisted)return;observer.disconnect();document.removeEventListener('visibilitychange',wake);globalThis.removeEventListener('pageshow',wake);globalThis.removeEventListener('pagehide',close);shared.dispose();};
 globalThis.addEventListener('pagehide',close);
 globalThis.__asfaltoFrames=shared;return shared;
}
