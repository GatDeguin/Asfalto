/** Context restoration must finish preparation before gameplay may resume. */
export function createContextRecovery({pause,prepare,onState=()=>{}}){
 let state='ready',pending=null,error=null,generation=0,pendingGeneration=-1;
 const publish=()=>onState({state,error});
 const restore=()=>{
  if(state==='aborted')return Promise.resolve(false);
  if(pending){
   if(pendingGeneration===generation)return pending;
   // A second context loss invalidated in-flight preparation. The next restore
   // event owns another attempt, serialized after the stale GPU work settles.
   return pending.then(restore);
  }
  const epoch=generation;pendingGeneration=epoch;state='loading';error=null;publish();
  pending=Promise.resolve().then(prepare).then(()=>{
   if(epoch===generation){state='ready';publish();}return state==='ready';
  },reason=>{
   if(epoch===generation){state='failed';error=String(reason?.message||reason);publish();}return false;
  }).finally(()=>{pending=null;});return pending;
 };
 return {lost(){if(state==='aborted')return;generation++;state='lost';error=null;pause();publish();},restore,
 canResume:()=>state==='ready',diagnostics:()=>({state,error}),dispose(){generation++;state='aborted';}};
}
