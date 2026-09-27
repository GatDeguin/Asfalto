/** CPU originals are fetched atomically only when the editor is requested. */
export function createLazyCockpitOriginals({bindings,load}){
 const display=Object.fromEntries(Object.entries(bindings).map(([k,m])=>[k,m.geometry]));let originals=null,pending=null,disposed=false,editing=false;
 function update({editing:next=false}={}){editing=!!next&&!!originals&&!disposed;for(const [k,m] of Object.entries(bindings))m.geometry=editing?originals[k]:display[k];return editing;}
 async function prepare({signal}={}){signal?.throwIfAborted();if(disposed)throw Error('Cockpit originals disposed');if(originals)return true;if(pending)return pending;
 pending=(async()=>{let staged;try{staged=await load(signal);signal?.throwIfAborted();if(disposed)throw Error('Cockpit originals disposed');for(const k of Object.keys(bindings))if(!staged[k])throw Error('Missing original '+k);originals=staged;return true;}catch(error){for(const g of Object.values(staged||{}))g.dispose();throw error;}finally{pending=null;}})();return pending;}
 return {prepare,update,diagnostics:()=>({ready:!!originals,editing,pending:!!pending,parts:Object.keys(bindings)}),dispose(){if(disposed)return;update({editing:false});disposed=true;for(const g of Object.values(originals||{}))g.dispose();originals=null;}};
}
/** Freeze simulation while originals decode; failed activation must not strand a running race. */
export function createCockpitEditorActivation({prepare,isRunning,pause,resume,onResumeIntent}){return async signal=>{const wasRunning=isRunning();if(wasRunning){onResumeIntent(true);pause();}try{await prepare({signal});signal?.throwIfAborted();}catch(error){if(wasRunning){onResumeIntent(false);resume();}throw error;}};}
