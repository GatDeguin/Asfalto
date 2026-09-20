export function createGpuFrameTimer(gl,{capacity=300,maxPending=8}={}){
 const ext=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
 const available=!!(ext&&gl.createQuery&&gl.beginQuery);
 let active=null,disposed=false,discarded=0;
 const pending=[],samples=[];
 function poll(){if(!available||disposed)return;const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);for(let i=0;i<pending.length;){const q=pending[i];if(disjoint||gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(disjoint)discarded++;else{const ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;if(Number.isFinite(ms)&&ms>=0){samples.push(ms);if(samples.length>capacity)samples.shift();}}gl.deleteQuery(q);pending.splice(i,1);}else i++;}}
 function begin(){poll();if(!available||disposed||active||pending.length>=maxPending||gl.isContextLost?.())return false;active=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,active);return true;}
 function end(){if(!active||disposed)return;gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active=null;}
 function diagnostics(){const ordered=[...samples].sort((a,b)=>a-b),p=q=>ordered.length?ordered[Math.ceil(ordered.length*q)-1]:null;return{available,source:available?'EXT_disjoint_timer_query_webgl2':'unavailable',samples:samples.length,p50GpuMs:p(.5),p95GpuMs:p(.95),p99GpuMs:p(.99),maxGpuMs:ordered.at(-1)??null,pending:pending.length,discarded};}
 function beginWindow(){samples.length=0;discarded=0;for(const q of pending)gl.deleteQuery(q);pending.length=0;}
 function dispose(){if(disposed)return;end();for(const q of pending)gl.deleteQuery(q);pending.length=0;disposed=true;}
 return{begin,end,poll,diagnostics,beginWindow,dispose};
}

