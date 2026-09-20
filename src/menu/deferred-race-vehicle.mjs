/** Workshop choices can commit before the race runtime exists. Apply the latest choice before driving. */
export function createDeferredRaceVehicle({getCockpit=()=>globalThis.__cockpit}={}){let selected='chevy',applied='chevy';
 async function prepare(id){const cockpit=getCockpit();if(!cockpit?.ready)return{commit(){selected=id;},dispose(){}};const stage=await cockpit.preparePlayerVehicle(id);return{commit(){stage.commit();selected=applied=id;},dispose(){stage.dispose();}};}
 async function ensureApplied(cockpit,{signal}={}){while(selected!==applied){const id=selected,stage=await cockpit.preparePlayerVehicle(id,{signal});if(signal?.aborted){stage.dispose();throw signal.reason;}if(id!==selected){stage.dispose();continue;}stage.commit();applied=id;}return applied;}
 return{prepare,ensureApplied,diagnostics:()=>({selected,applied})};}
