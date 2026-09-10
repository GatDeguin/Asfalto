/* v7 owns a separate browser namespace; legacy keys are read once and never written. */
(function(root){
'use strict';
if(root.__asfaltoV7Storage)return;
const prefix='asfalto:v7:',marker=prefix+'@migration-v1',memory=new Map();
let disk=null;try{disk=root.localStorage;}catch{}
let keys=[];try{for(let i=0;i<disk.length;i++)keys.push(disk.key(i));}catch{}
let migrated=false;try{migrated=disk.getItem(marker)==='complete';}catch{}
if(!migrated){
 for(const key of keys){if(!key||key.startsWith(prefix)||!/^(?:asfalto|cockpit|chevy)[-:]/i.test(key))continue;
  try{const value=disk.getItem(key);if(value!==null){memory.set(key,value);if(disk.getItem(prefix+key)===null)disk.setItem(prefix+key,value);}}catch{}
 }
 try{disk.setItem(marker,'complete');}catch{}
}
try{for(let i=0;i<disk.length;i++){const key=disk.key(i);if(key?.startsWith(prefix)&&key!==marker)memory.set(key.slice(prefix.length),disk.getItem(key));}}catch{}
const storage=Object.freeze({
 get length(){return memory.size},
 key(index){return [...memory.keys()][Number(index)]??null},
 getItem(key){return memory.get(String(key))??null},
 // Explicit result transactions require disk success; ordinary preferences keep their memory fallback.
 getItemPersistent(key){if(!disk)throw new Error('El almacenamiento persistente no está disponible.');return disk.getItem(prefix+String(key));},
 setItemPersistent(key,value){if(!disk)throw new Error('El almacenamiento persistente no está disponible.');key=String(key);value=String(value);disk.setItem(prefix+key,value);if(disk.getItem(prefix+key)!==value)throw new Error('No se pudo verificar el guardado persistente.');memory.set(key,value);return value;},
 setItem(key,value){key=String(key);value=String(value);memory.set(key,value);try{disk.setItem(prefix+key,value);}catch{}},
 removeItem(key){key=String(key);memory.delete(key);try{disk.removeItem(prefix+key);}catch{}},
 clear(){for(const key of [...memory.keys()])this.removeItem(key);},
 diagnostics(){return {namespace:prefix,entries:memory.size,migration:'copy-once',persistent:!!disk};}
});
Object.defineProperty(root,'__asfaltoV7Storage',{value:storage,configurable:false,writable:false});
})(globalThis);
