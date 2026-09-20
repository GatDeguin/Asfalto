// Stable, removable slots survive an external owner wrapping the callbacks.
// Reactivation updates the slot rather than retaining another inactive closure.
const owners=new WeakMap();
export function installMaterialHook(material,id,{compile,key}){
 let slots=owners.get(material);if(!slots){slots=new Map();owners.set(material,slots);}
 let slot=slots.get(id);
 if(!slot){
  slot={compile:null,key:null,baseCompile:material.onBeforeCompile,baseKey:material.customProgramCacheKey};
  slot.patch=function(shader,renderer){slot.baseCompile?.call(this,shader,renderer);slot.compile?.call(this,shader,renderer);};
  slot.cache=function(){return(slot.baseKey?.call(this)||'')+(slot.key?.call(this)||'');};
  slots.set(id,slot);material.onBeforeCompile=slot.patch;material.customProgramCacheKey=slot.cache;
 }
 slot.compile=compile;slot.key=key;material.needsUpdate=true;
 let disposed=false;
 return()=>{if(disposed)return;disposed=true;if(slot.compile!==compile)return;slot.compile=slot.key=null;
  if(material.onBeforeCompile===slot.patch&&material.customProgramCacheKey===slot.cache){material.onBeforeCompile=slot.baseCompile;material.customProgramCacheKey=slot.baseKey;slots.delete(id);}
  material.needsUpdate=true;
 };
}
