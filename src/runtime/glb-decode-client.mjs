/** Transfers ownership of buffer until the job completes; no main-thread decode copy.
 * A worker is scoped to this load and terminated on success, error, timeout or abort.
 * null means Workers are unavailable and the caller still owns the original buffer.
 */
export function decodeGlbInWorker(buffer,{
  signal=null,WorkerClass=globalThis.Worker,timeoutMs=60000,
  url=new URL('./glb-decode-worker.mjs?v=2a59613c05796123',import.meta.url)
}={}){
  if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
  if(typeof WorkerClass!=='function')return Promise.resolve(null);
  return new Promise((resolve,reject)=>{
    let worker=null,timer=null,settled=false;
    const finish=(error,result)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();}
      error?reject(error):resolve(result);
    };
    const abort=()=>finish(signal.reason||new DOMException('Aborted','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    try{
      worker=new WorkerClass(url,{type:'module',name:'asfalto-rival-glb'});
      worker.onmessage=({data})=>{
        if(!data?.ok){finish(new Error(data?.error||'GLB worker failed'));return;}
        if(!data.json||!(data.bin instanceof Uint8Array)){finish(new Error('Invalid GLB worker result'));return;}
        finish(null,{json:data.json,bin:data.bin});
      };
      worker.onerror=event=>{event.preventDefault?.();finish(new Error(event.message||'GLB worker error'));};
      worker.onmessageerror=()=>finish(new Error('GLB worker message error'));
      timer=setTimeout(()=>finish(new Error('GLB worker timeout')),timeoutMs);
      worker.postMessage({buffer},[buffer]);
    }catch(error){finish(error);}
  });
}

