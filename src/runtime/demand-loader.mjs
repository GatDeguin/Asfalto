import {waitForSignal} from './abortable.mjs';

/** A bounded operation owns its cancellation, including callers which ignore a signal.
 * Aborting settles the consumer immediately; the producer must check the same signal
 * before publishing resources. No retry is implicit. */
export async function boundedOperation(run,{signal,timeoutMs=60000,label='Carga'}={}){
 signal?.throwIfAborted();
 const controller=new AbortController();
 const abort=()=>controller.abort(signal.reason);
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException(label+' excedió el tiempo de espera','TimeoutError')),timeoutMs);
 try{return await waitForSignal(Promise.resolve().then(()=>{controller.signal.throwIfAborted();return run(controller.signal);}),controller.signal);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

/** One shared producer, independently abortable consumers. Last consumer owns cancel. */
export function createDemandLoader(load,{timeoutMs=60000,label='Carga'}={}){
 let operation=null,value,state='idle',error=null,generation=0;
 const consumers=new Set();
 function request({signal}={}){
  signal?.throwIfAborted();if(state==='ready')return Promise.resolve(value);
  if(!operation){
   const epoch=++generation,controller=new AbortController();state='loading';error=null;
   const promise=boundedOperation(s=>load({signal:s}),{signal:controller.signal,timeoutMs,label}).then(result=>{
    if(epoch!==generation||controller.signal.aborted){result?.dispose?.();throw controller.signal.reason||new DOMException('Carga obsoleta','AbortError');}
    value=result;state='ready';return result;
   },reason=>{if(epoch===generation){state=reason?.name==='AbortError'?'aborted':'failed';error=String(reason?.message||reason);}throw reason;}).finally(()=>{if(operation?.epoch===epoch)operation=null;});
   operation={epoch,controller,promise};promise.catch(()=>{}); // each subscriber observes this failure below
  }
  const current=operation,token={};consumers.add(token);
  return waitForSignal(current.promise,signal).finally(()=>{
   consumers.delete(token);
   if(!consumers.size&&operation===current&&state==='loading'){
    generation++;operation=null;state='aborted';current.controller.abort(new DOMException('Sin consumidores','AbortError'));
   }
  });
 }
 return {request,diagnostics:()=>({state,error,consumers:consumers.size,generation}),dispose(){generation++;operation?.controller.abort(new DOMException('Recurso cerrado','AbortError'));operation=null;value?.dispose?.();value=undefined;state='idle';}};
}
