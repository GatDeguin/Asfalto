const cache=new WeakMap();
/** PCM synthesis runs off the render thread. Successful banks live with their AudioContext. */
export function prepareSoundscapeBanks(context,{seed=6147,signal,createWorker=()=>new Worker(new URL('./soundscape-banks-worker.mjs?v=17dd7930d2372e0b',import.meta.url),{type:'module'})}={}){
 if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
 let entries=cache.get(context);if(!entries){entries=new Map();cache.set(context,entries);}
 if(entries.has(seed))return Promise.resolve(entries.get(seed));
 return new Promise((resolve,reject)=>{
  let worker,finished=false;
  const finish=(error,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);worker?.terminate();if(error)reject(error);else{entries.set(seed,value);resolve(value);}};
  const abort=()=>finish(signal.reason||new DOMException('Aborted','AbortError'));
  try{worker=createWorker();signal?.addEventListener('abort',abort,{once:true});
   worker.onerror=event=>{event.preventDefault?.();finish(new Error(event.message||'Soundscape worker failed'));};
   worker.onmessage=({data})=>{if(finished)return;try{if(data.error)throw new Error(data.error);
    const convert=banks=>banks.map(channels=>{const buffer=context.createBuffer(channels.length,channels[0].length,context.sampleRate);channels.forEach((samples,i)=>buffer.copyToChannel(samples,i));return buffer;});
    finish(null,{buffers:convert(data.buffers),drivingBuffers:convert(data.drivingBuffers),randomState:data.randomState});
   }catch(error){finish(error);}};
   worker.postMessage({sampleRate:context.sampleRate,seed});
  }catch(error){finish(error);}
 });
}
