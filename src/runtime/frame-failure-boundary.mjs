/** A failed frame is not retried continuously. Physics remains paused until an
 * explicit, successfully prepared new session resets this boundary. */
export function createFrameFailureBoundary({pause=()=>{},releaseInputs=()=>{},suspendAudio=()=>{},onFailure=()=>{}}={}) {
  let failure=null,disposed=false,count=0;
  const cleanupErrors=[];
  const record=error=>cleanupErrors.push(String(error?.message||error));
  function run(work) {
    if(disposed||failure)return false;
    try { work(); return true; }
    catch(error) {
      failure={message:String(error?.message||error),atMs:performance.now()};count++;
      for(const action of [pause,releaseInputs,suspendAudio,onFailure]) {
        try { Promise.resolve(action({...failure})).catch(record); } catch(cause) { record(cause); }
      }
      return false;
    }
  }
  return Object.freeze({run,reset(){if(!disposed)failure=null;},
    diagnostics:()=>({failed:!!failure,message:failure?.message||null,atMs:failure?.atMs??null,count,cleanupErrors:[...cleanupErrors],disposed}),
    dispose(){disposed=true;},
  });
}
