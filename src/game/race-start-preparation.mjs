/** Await the real preparation stages; visibility/control release remains owned by the session transaction. */
export async function prepareRaceStart({environment,dayCycle,physics,graphics,audio,signal,onStage=()=>{},onUpdate=()=>{},paint=async()=>{},now=()=>performance.now()}){
 const report={status:'preparing',startedAtMs:now(),durationMs:0,stages:[]};
 const publish=()=>onUpdate({...report,stages:report.stages.map(s=>({...s}))});
 const stages=[['environment','Preparando cielo y clima…',environment],['day-cycle','Ajustando las condiciones del recorrido…',dayCycle],['physics','Colocando el auto en la salida…',physics],['graphics','Preparando la vista de conducción…',graphics],['audio','Preparando el sonido de la salida…',audio]];
 try{
  for(const [id,label,run]of stages){
   signal?.throwIfAborted();const stage={id,status:'preparing',startedAtMs:now(),durationMs:0};report.stages.push(stage);onStage(label);publish();
   await paint();signal?.throwIfAborted();await run();signal?.throwIfAborted();stage.status='ready';stage.durationMs=now()-stage.startedAtMs;publish();
  }
  report.status='ready';return {...report,durationMs:now()-report.startedAtMs,stages:report.stages.map(s=>({...s}))};
 }catch(error){report.status=signal?.aborted?'aborted':'failed';const stage=report.stages.at(-1);if(stage?.status==='preparing'){stage.status=report.status;stage.durationMs=now()-stage.startedAtMs;}throw error;}
 finally{report.durationMs=now()-report.startedAtMs;publish();}
}
