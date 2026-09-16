/** Transfer generated PCM from a short-lived worker; no audio nodes exist until ready. */
export function prepareSoundscapeBanks(context,{seed=6147,signal,createWorker=()=>new Worker(new URL('./soundscape-banks-worker.mjs',import.meta.url),{type:'module'})}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  let worker,finished=false;
  const finish=(error,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(value);};
  const abort=()=>finish(signal.reason||new DOMException('Aborted','AbortError'));
  try{worker=createWorker();signal?.addEventListener('abort',abort,{once:true});
   worker.onerror=event=>{event.preventDefault?.();finish(new Error(event.message||'Soundscape worker failed'));};
   worker.onmessage=({data})=>{if(finished)return;try{if(data.error)throw new Error(data.error);const buffers=data.buffers.map(channels=>{const buffer=context.createBuffer(channels.length,channels[0].length,context.sampleRate);channels.forEach((samples,i)=>buffer.copyToChannel(samples,i));return buffer;});finish(null,{buffers,randomState:data.randomState});}catch(error){finish(error);}};
   worker.postMessage({sampleRate:context.sampleRate,seed});
  }catch(error){finish(error);}
 });
}
