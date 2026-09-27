export class BakeWorkerClient {
 constructor({WorkerClass=globalThis.Worker,timeoutMs=60000,url=new URL('./bake-worker.mjs?v=3bb91dce53785da1',import.meta.url)}={}){this.WorkerClass=WorkerClass;this.timeoutMs=timeoutMs;this.url=url;this.active=null;this.sequence=0;}
 cancel(){this.active?.cancel();}
 load(id,signal){
  this.cancel();const requestId=++this.sequence;
  return new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(signal.reason||new DOMException('Bake aborted','AbortError'));return;}
   if(typeof this.WorkerClass!=='function'){reject(Error('bake worker unavailable'));return;}
   let worker,timer,settled=false;
   const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();}if(this.active?.requestId===requestId)this.active=null;error?reject(error):resolve(result);};
   const abort=()=>finish(signal?.reason||new DOMException('Bake superseded or aborted','AbortError'));
   this.active={requestId,cancel:abort};signal?.addEventListener('abort',abort,{once:true});
   try{
    worker=new this.WorkerClass(this.url,{type:'module',name:'asfalto-cpu-bake'});
    worker.onmessage=event=>{const result=event.data;if(result?.requestId!==requestId)return;if(!result.ok){finish(Error(result.error||'bake worker failed'));return;}if(result.payload?.id!==id||!Array.isArray(result.payload.entries)){finish(Error('bake worker response schema'));return;}result.stats={...result.stats,transferMs:Math.max(0,performance.timeOrigin+performance.now()-result.sentAt)};finish(null,result);};
    worker.onerror=event=>{event.preventDefault?.();finish(Error(event.message||'bake worker error'));};worker.onmessageerror=()=>finish(Error('bake worker message decode'));
    timer=setTimeout(()=>finish(Error('bake worker timeout')),this.timeoutMs);worker.postMessage({requestId,id});
   }catch(error){finish(error);}
  });
 }
}
