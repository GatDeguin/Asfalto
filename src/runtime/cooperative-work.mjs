export const yieldToMain=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
/** Cooperate with input/painting after a real time budget; never sleep to mask races. */
export async function runCooperatively(iterator,{signal,sliceMs=6,now=()=>performance.now(),yieldTask=yieldToMain}={}){
 let deadline=now()+sliceMs;
 try{while(true){signal?.throwIfAborted();const item=iterator.next();if(item.done)return item.value;if(now()>=deadline){await yieldTask();signal?.throwIfAborted();deadline=now()+sliceMs;}}}
 finally{iterator.return?.();}
}
