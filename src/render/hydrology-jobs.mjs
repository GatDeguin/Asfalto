const abortError=()=>new DOMException('Hydrology cancelled','AbortError');
/** One worker per weather controller. Copies retain a deterministic fallback; messages transfer typed buffers. */
export function createHydrologyJobs({workerFactory=()=>new Worker(new URL('./hydrology-worker.mjs?v=3ad58c948a924028',import.meta.url),{type:'module'}),timeoutMs=30000}={}){
 let worker=null,nextId=0,disposed=false;const pending=new Map(),stats={submitted:0,completed:0,cancelled:0,failures:0,computeMs:0,copyMs:0};
 const stop=()=>{worker?.terminate();worker=null;};
 const failAll=error=>{stop();for(const job of [...pending.values()])job.finish(error);};
 function ensure(){if(worker)return worker;worker=workerFactory();const instance=worker;worker.onmessage=({data})=>{if(worker!==instance)return;const job=pending.get(data?.id);if(!job)return;if(data.error||!(data.values instanceof Float32Array)){stats.failures++;job.finish(new Error(data.error||'Invalid hydrology result'));return;}stats.completed++;stats.computeMs+=Number(data.computeMs)||0;job.finish(null,data.values);};worker.onerror=event=>{if(worker!==instance)return;event.preventDefault?.();stats.failures++;failAll(new Error(event.message||'Hydrology worker failed'));};worker.onmessageerror=()=>{if(worker!==instance)return;stats.failures++;failAll(new Error('Invalid hydrology worker message'));};return worker;}
 function run(kind,input,{signal}={}){
  if(disposed||signal?.aborted)return Promise.reject(signal?.reason||abortError());
  return new Promise((resolve,reject)=>{const id=++nextId;let timer;
   const finish=(error,value)=>{if(!pending.delete(id))return;clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(error)reject(error);else resolve(value);};
   const cancel=()=>{stats.cancelled++;finish(signal?.reason||abortError());if(!pending.size)stop();};pending.set(id,{finish});signal?.addEventListener('abort',cancel,{once:true});
   timer=setTimeout(()=>{stats.failures++;failAll(new Error('Hydrology worker timed out'));},timeoutMs);
   try{const target=ensure(),start=performance.now(),copy=structuredClone(input),buffers=[];for(const value of Object.values(copy))if(ArrayBuffer.isView(value)&&!buffers.includes(value.buffer))buffers.push(value.buffer);stats.copyMs+=performance.now()-start;stats.submitted++;target.postMessage({id,kind,input:copy},buffers);}catch(error){stats.failures++;finish(error);if(!pending.size)stop();}
  });
 }
 return{run,diagnostics:()=>({...stats,pending:pending.size,worker:!!worker,disposed}),dispose(){if(disposed)return;disposed=true;failAll(abortError());}};
}
