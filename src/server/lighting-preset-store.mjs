import {lstat,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {atomicWrite,enforceSameOrigin,readJSONBody,sendJSON} from './cockpit-layout-store.mjs?v=balance-20260917';
import {lightingPresetKey,validateLightingEntry} from '../game/lighting-presets.mjs';
const FILE='iluminacion-carreras.json',LIMIT=4*1024*1024;
export function createLightingPresetEndpoint(directory=null){
 const filename=directory?path.resolve(directory,FILE):null;let tail=Promise.resolve();
 const enqueue=fn=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;};
 async function read(){if(!filename)return null;try{const info=await lstat(filename);if(!info.isFile()||info.isSymbolicLink()||info.size>LIMIT)throw Error('Archivo de iluminación inválido');const value=JSON.parse(await readFile(filename,'utf8'));if(value.version!==1||!value.presets||Array.isArray(value.presets)||Object.keys(value.presets).length>1024)throw Error('Archivo de iluminación inválido');const presets={};for(const[key,raw]of Object.entries(value.presets)){const entry=validateLightingEntry(raw);if(key!==lightingPresetKey(entry.context))throw Error('Clave de preset inválida');presets[key]=entry;}return {version:1,presets};}catch(error){if(error.code==='ENOENT')return {version:1,presets:{}};error.status=500;throw error;}}
 return async(request,response)=>{try{
  enforceSameOrigin(request);if(!['GET','PUT'].includes(request.method)){sendJSON(response,405,{error:'Método no permitido'},{allow:'GET, PUT'});return;}
  if(!filename){sendJSON(response,request.method==='GET'?200:503,{enabled:false,error:request.method==='PUT'?'Guardado en disco desactivado':undefined});return;}
  if(request.method==='GET'){const document=await enqueue(read);sendJSON(response,200,{enabled:true,path:filename.replaceAll('\\','/'),...document});return;}
  let entry;try{entry=validateLightingEntry(await readJSONBody(request));}catch(error){error.status??=400;throw error;}
  const document=await enqueue(async()=>{const current=await read(),key=lightingPresetKey(entry.context),prior=current.presets[key];if(prior&&Date.parse(prior.updatedAt)>Date.parse(entry.updatedAt)){const error=Error('Existe un ajuste más reciente de esta combinación');error.status=409;throw error;}
   const next={version:1,presets:{...current.presets,[key]:entry}},contents=JSON.stringify(next,null,2)+'\n';if(Object.keys(next.presets).length>1024||Buffer.byteLength(contents)>LIMIT){const error=Error('Demasiados presets guardados');error.status=413;throw error;}
   await mkdir(directory,{recursive:true});if(Object.keys(current.presets).length)await atomicWrite(path.join(directory,'iluminacion-carreras.previous.json'),JSON.stringify(current,null,2)+'\n');await atomicWrite(filename,contents);return next;
  });sendJSON(response,200,{ok:true,path:filename.replaceAll('\\','/'),entry:document.presets[lightingPresetKey(entry.context)]});
 }catch(error){if(!response.destroyed)sendJSON(response,error.status||500,{error:error.message||'No se pudo guardar la iluminación'});}finally{if(!request.readableEnded)request.resume();}};
}
