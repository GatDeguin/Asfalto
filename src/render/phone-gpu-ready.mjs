/** Non-blocking acknowledgement of commands submitted before this fence. */
export async function waitForGpuFrame(gl,{signal,timeoutMs=20000,now=()=>performance.now(),pause=()=>new Promise(r=>setTimeout(r,16))}={}){
 signal?.throwIfAborted();
 if(gl.isContextLost())throw new Error('GPU: contexto perdido');
 const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 if(!sync)throw new Error('GPU: no se pudo crear la confirmación');
 const started=now();
 try{gl.flush();for(;;){signal?.throwIfAborted();if(gl.isContextLost())throw new Error('GPU: contexto perdido');const status=gl.clientWaitSync(sync,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;if(status===gl.WAIT_FAILED)throw new Error('GPU: falló la confirmación');if(now()-started>=timeoutMs)throw new Error('GPU: tiempo de confirmación agotado');await pause();}}
 finally{gl.deleteSync(sync);}
}
