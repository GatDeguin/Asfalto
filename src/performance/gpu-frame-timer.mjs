export function createGpuFrameTimer(gl,{capacity=300,maxPending=8}={}){
 let ext=null,available=false,active=null,disposed=false,discarded=0;
 const pending=[],samples=[];
 function restore(){
  ext=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
  available=!!(ext&&gl.createQuery&&gl.beginQuery);
 }
 function lose(){
  // The old context owns these handles. Drop them without GL calls.
  active=null;ext=null;available=false;discarded=0;
  pending.length=0;samples.length=0;
 }
 restore();
 gl?.canvas?.addEventListener('webglcontextlost',lose);
 gl?.canvas?.addEventListener('webglcontextrestored',restore);
 function poll(){
  if(!available||disposed||gl.isContextLost?.())return;
  if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
   samples.length=0;
   discarded+=pending.length;
   clearPending();
   return;
  }
  for(let i=0;i<pending.length;){
   const query=pending[i];
   if(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){i++;continue;}
   const ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
   if(Number.isFinite(ms)&&ms>=0){
    samples.push(ms);
    if(samples.length>capacity)samples.shift();
   }
   gl.deleteQuery(query);
   pending.splice(i,1);
  }
 }
 function begin(){
  poll();
  if(!available||disposed||active||pending.length>=maxPending||gl.isContextLost?.())return false;
  active=gl.createQuery();
  if(!active)return false;
  gl.beginQuery(ext.TIME_ELAPSED_EXT,active);
  return true;
 }
 function end(){if(!active||disposed)return;gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active=null;}
 function diagnostics(){const ordered=[...samples].sort((a,b)=>a-b),p=q=>ordered.length?ordered[Math.ceil(ordered.length*q)-1]:null;return{available,source:available?'EXT_disjoint_timer_query_webgl2':'unavailable',samples:samples.length,p50GpuMs:p(.5),p95GpuMs:p(.95),p99GpuMs:p(.99),maxGpuMs:ordered.at(-1)??null,pending:pending.length,discarded};}
 function clearPending(){for(const query of pending)gl.deleteQuery(query);pending.length=0;}
 function beginWindow(){samples.length=0;discarded=0;clearPending();}
 function dispose(){
  if(disposed)return;
  end();clearPending();disposed=true;
  gl?.canvas?.removeEventListener('webglcontextlost',lose);
  gl?.canvas?.removeEventListener('webglcontextrestored',restore);
 }
 return{begin,end,poll,diagnostics,beginWindow,dispose};
}

