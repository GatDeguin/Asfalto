/** Reject the caller promptly, observe late failures, and never retain abort listeners.
 * This is a wait boundary, not an undo mechanism: mutating continuations must still
 * check signal/ownership before committing and dispose any late owned resources. */
export function waitForSignal(value, signal) {
  const operation = Promise.resolve(value);
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, result) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback(result);
    };
    const onAbort = () => finish(reject, signal.reason || new DOMException('Carga cancelada', 'AbortError'));
    // Attach handlers even to an already aborted request (no unhandled late rejection).
    operation.then(result => finish(resolve, result), error => finish(reject, error));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, {once: true});
  });
}

/** A readiness poll belongs to its consumer, including timer/listener cleanup. */
export function waitForCondition(check,{signal,timeoutMs=180000,intervalMs=50}={}){
 if(typeof check!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(intervalMs)||intervalMs<=0)throw new TypeError('Invalid readiness wait');
 return new Promise((resolve,reject)=>{
  let timer,deadline,settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(deadline);signal?.removeEventListener('abort',abort);fn(value);};
  const abort=()=>finish(reject,signal.reason||new DOMException('Carga cancelada','AbortError'));
  const poll=()=>{if(settled)return;try{const value=check();if(value){finish(resolve,value);return;}timer=setTimeout(poll,intervalMs);}catch(error){finish(reject,error);}};
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  deadline=setTimeout(()=>finish(reject,new DOMException('La preparación tardó demasiado. Podés reintentar.','TimeoutError')),timeoutMs);poll();
 });
}

/** Catch errors in a first-frame callback instead of leaving its loading promise
 * pending forever. Cancellation prevents even the late callback from executing. */
export function waitForAnimationFrame(signal,callback=()=>{},{requestFrame=globalThis.requestAnimationFrame,cancelFrame=globalThis.cancelAnimationFrame}={}){
 return new Promise((resolve,reject)=>{
  let handle,settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);fn(value);};
  const abort=()=>{if(handle!==undefined)cancelFrame?.(handle);finish(reject,signal.reason||new DOMException('Carga cancelada','AbortError'));};
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  try{handle=requestFrame(timestamp=>{if(settled)return;try{finish(resolve,callback(timestamp));}catch(error){finish(reject,error);}});}catch(error){finish(reject,error);}
 });
}
