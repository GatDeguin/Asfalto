/* v7 owns a separate browser namespace; legacy keys are read once and never written. */
(function(root){
'use strict';
if(root.__asfaltoV7Storage)return;
const prefix='asfalto:v7:',marker=prefix+'@migration-v1',memory=new Map();
const recoveryMarker='asfalto:recovery:v8-v7:complete',backupKey='asfalto:recovery:v8-v7:profiles',profileKey='chevy-serie2-v6-profile';
let decision=null,resolveReady;const ready=new Promise(resolve=>resolveReady=resolve);
const validProfile=value=>{try{const p=JSON.parse(value);return p&&typeof p==='object'&&!Array.isArray(p)?p:null;}catch{return null;}};
let disk=null;try{disk=root.localStorage;}catch{}
try{if(disk&&disk.getItem(recoveryMarker)!=='complete'){const v7=disk.getItem(prefix+profileKey),v8=disk.getItem(profileKey);if(validProfile(v7)&&validProfile(v8)&&JSON.stringify(validProfile(v7))!==JSON.stringify(validProfile(v8)))decision={v7,v8};else if(!validProfile(v7)&&validProfile(v8)){try{disk.setItem(prefix+profileKey,v8);if(disk.getItem(prefix+profileKey)!==v8)throw new Error('Profile copy failed');}catch{decision={v7:null,v8};}}}}catch{}
let keys=[];try{for(let i=0;i<disk.length;i++)keys.push(disk.key(i));}catch{}
let migrated=false;try{migrated=disk.getItem(marker)==='complete';}catch{}
if(!migrated){
 for(const key of keys){if(!key||key.startsWith('asfalto:recovery:')||key.startsWith(prefix)||!/^(?:asfalto|cockpit|chevy)[-:]/i.test(key))continue;
  try{const value=disk.getItem(key);if(value!==null){memory.set(key,value);if(disk.getItem(prefix+key)===null)disk.setItem(prefix+key,value);}}catch{}
 }
 try{disk.setItem(marker,'complete');}catch{}
}
try{for(let i=0;i<disk.length;i++){const key=disk.key(i);if(key?.startsWith(prefix)&&key!==marker)memory.set(key.slice(prefix.length),disk.getItem(key));}}catch{}
function chooseProfile(version){
 if(!decision||!['v7','v8'].includes(version)||!validProfile(decision[version]))return false;
 // Preserve both exact snapshots before changing the active slot. Never add balances.
 if(!disk.getItem(backupKey))disk.setItem(backupKey,JSON.stringify(decision));
 const backup=JSON.parse(disk.getItem(backupKey));if(!backup||backup.v7!==decision.v7||backup.v8!==decision.v8)throw new Error('No se pudo guardar la copia de las partidas.');
 disk.setItem(prefix+profileKey,decision[version]);
 if(disk.getItem(prefix+profileKey)!==decision[version])throw new Error('No se pudo verificar la partida elegida.');
 disk.setItem(recoveryMarker,'complete');memory.set(profileKey,decision[version]);decision=null;resolveReady();return true;
}
if(!decision){try{disk?.setItem(recoveryMarker,'complete');}catch{}resolveReady();}
else if(root.document){
 const show=()=>{
  const dialog=document.createElement('dialog');dialog.id='an-profile-recovery';dialog.setAttribute('aria-label','Recuperar partida');
  dialog.style.cssText='max-width:520px;width:calc(100% - 48px);background:#202326;color:#eee;border:1px solid #c39358;border-radius:12px;padding:24px;font:17px system-ui;';
  const title=document.createElement('h2');title.textContent=decision.v7?'Encontramos dos partidas':'Tu partida necesita espacio para guardarse';dialog.append(title);
  const copy=document.createElement('p');copy.textContent=decision.v7?'Elegí con cuál continuar. Conservaremos una copia de ambas, sin sumar ni modificar tus fichas.':'No pudimos copiar tu partida. Descargá una copia, liberá espacio y volvé a intentarlo.';dialog.append(copy);
  for(const version of ['v8','v7']){const p=validProfile(decision[version]);if(!p)continue;const button=document.createElement('button');button.type='button';button.textContent=`Continuar ${version} · ${p.name||'Propietario'} · ${p.workshopTokens??0} fichas`;button.style.cssText='display:block;width:100%;padding:14px;margin:12px 0;font:inherit;';button.onclick=()=>{try{chooseProfile(version);dialog.close();dialog.remove();}catch(error){copy.textContent=error.message;}};dialog.append(button);}
  const download=document.createElement('button');download.textContent='Descargar copia de ambas';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(decision,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='asfalto-partidas-v7-v8.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};dialog.append(download);
  dialog.addEventListener('cancel',event=>event.preventDefault());document.body.append(dialog);dialog.showModal();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
}
const storage=Object.freeze({ready,chooseProfile,
 recoveryProfiles(){try{return JSON.parse(disk?.getItem(backupKey)||'null');}catch{return null;}},
 get length(){return memory.size},
 key(index){return [...memory.keys()][Number(index)]??null},
 getItem(key){return memory.get(String(key))??null},
 // Explicit result transactions require disk success; ordinary preferences keep their memory fallback.
 getItemPersistent(key){if(!disk)throw new Error('El almacenamiento persistente no está disponible.');return disk.getItem(prefix+String(key));},
 setItemPersistent(key,value){if(!disk)throw new Error('El almacenamiento persistente no está disponible.');key=String(key);value=String(value);disk.setItem(prefix+key,value);if(disk.getItem(prefix+key)!==value)throw new Error('No se pudo verificar el guardado persistente.');memory.set(key,value);return value;},
 setItem(key,value){key=String(key);value=String(value);memory.set(key,value);try{disk.setItem(prefix+key,value);}catch{}},
 removeItem(key){key=String(key);memory.delete(key);try{disk.removeItem(prefix+key);}catch{}},
 clear(){for(const key of [...memory.keys()])this.removeItem(key);},
 diagnostics(){return {namespace:prefix,entries:memory.size,migration:'copy-once',profileChoicePending:!!decision,persistent:!!disk};}
});
Object.defineProperty(root,'__asfaltoV7Storage',{value:storage,configurable:false,writable:false});
})(globalThis);

