// Runs on Node's event loop, independently of the page renderer. Cleanup is
// started on timeout but never awaited before rejecting a stalled benchmark phase.
export async function withWatchdog(phase,timeoutMs,operation,onTimeout=()=>{}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new RangeError('Watchdog requires a positive finite timeout');
 let timer;
 const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{
  const error=Object.assign(new Error(`Benchmark phase timed out after ${timeoutMs} ms: ${phase}`),{code:'BENCHMARK_PHASE_TIMEOUT',phase,timeoutMs});
  try{Promise.resolve(onTimeout(error)).catch(()=>{});}catch{}
  reject(error);
 },timeoutMs);});
 try{return await Promise.race([Promise.resolve().then(operation),expired]);}finally{clearTimeout(timer);}
}
