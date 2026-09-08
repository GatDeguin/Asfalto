// Load every affected view before committing a selection. Superseded requests
// release staged GPU objects and cannot overwrite the user's latest choice.
export function createVehicleSelection({initial='chevy',ids=['chevy','chevy_400_1957','chevrolet_1969'],prepare,storage=globalThis.localStorage,onState=()=>{}}={}) {
 const key='asfalto:nacional:v6:selected-vehicle';let current=initial,generation=0,disposed=false,pending=false,error=null;
 const diagnostics=()=>({current,pending,error,disposed});
 async function performSelection(id){if(disposed||!ids.includes(id))return false;const ticket=++generation;if(id===current){pending=false;error=null;onState(diagnostics());return true;}pending=true;error=null;onState({...diagnostics(),requested:id});let stages=[];
  try{const results=await Promise.allSettled(prepare.map(factory=>factory(id)));stages=results.filter(r=>r.status==='fulfilled').map(r=>r.value);const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;if(disposed||ticket!==generation){for(const stage of stages)stage.dispose();return false;}
   for(const stage of stages)stage.commit();current=id;pending=false;try{storage?.setItem(key,id);}catch{}onState(diagnostics());return true;
  }catch(reason){for(const stage of stages)stage.dispose();if(ticket===generation&&!disposed){pending=false;error=String(reason?.message||reason);onState(diagnostics());}return false;}
 }
 let activePromise=Promise.resolve(true);const select=id=>(activePromise=performSelection(id));
 async function whenSettled(){while(true){const observed=activePromise,result=await observed;if(observed===activePromise)return result;}}
 return{select,diagnostics,whenSettled,restore(){let saved;try{saved=storage?.getItem(key);}catch{}return ids.includes(saved)&&saved!==current?select(saved):Promise.resolve(true);},dispose(){if(disposed)return false;disposed=true;generation++;pending=false;return true;}};
}
