import {boundedOperation} from './demand-loader.mjs';
/** Native streaming gzip, bounded in both expanded size and wall time. */
export function inflateGzipBytes(bytes,{signal,timeoutMs=90000,maxBytes=180*1024*1024,createStream=value=>new Blob([value]).stream().pipeThrough(new DecompressionStream('gzip'))}={}){
 return boundedOperation(async active=>{
  const reader=createStream(bytes).getReader();let complete=false;
  const abort=()=>void reader.cancel(active.reason).catch(error=>console.warn('Decompression cancellation failed',error));
  active.addEventListener('abort',abort,{once:true});
  try{const chunks=[];let length=0;for(;;){active.throwIfAborted();const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>maxBytes)throw new RangeError('Expanded asset exceeds its memory budget');chunks.push(next.value);}
   active.throwIfAborted();const output=new Uint8Array(length);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}complete=true;return output;
  }finally{active.removeEventListener('abort',abort);if(!complete)await reader.cancel();reader.releaseLock();}
 },{signal,timeoutMs,label:'Descompresión del asset'});
}
