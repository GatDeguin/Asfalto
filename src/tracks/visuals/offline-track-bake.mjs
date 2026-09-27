// Optional distributed CPU results. Rendering resources and physics never enter this cache.
import {BAKE_SCHEMA,lookupSpatial} from './bake-binary-codec.mjs?v=9a206fac5b81dd7a';
import {BakeWorkerClient} from './bake-worker-client.mjs?v=f1b8a1be5cb47787';
export {BAKE_SCHEMA};
const state=globalThis.__asfaltoTrackBakeState||={entries:new Map(),stats:{hits:0,misses:0,loads:0,fallbacks:0},id:null};
const workerClient=new BakeWorkerClient();let generation=0;
export function bakeSignature(value){
 const text=typeof value==='string'?value:JSON.stringify(value);let a=2166136261,b=2246822507;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489909);}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+':'+text.length;
}
export function bakeRead(key){const value=state.entries.get(key);state.stats[value===undefined?'misses':'hits']++;return value;}
export function bakeWrite(key,value){if(globalThis.__ASFALTO_CAPTURE_BAKE__)state.entries.set(key,value);return value;}
export function bakeCapture(){return {schema:BAKE_SCHEMA,id:state.id,entries:[...state.entries]};}
export function bakeDiagnostics(){return {...state.stats,entries:state.entries.size,id:state.id,workerActive:!!workerClient.active,generation};}
export async function prepareTrackBake(id,signal){
 signal?.throwIfAborted();const token=++generation,started=performance.now();workerClient.cancel();state.entries.clear();state.id=id;
 for(const key of ['fetchMs','integrityMs','decompressMs','decodeMs','transferMs','installMs','workerMs','loadMs','compressedBytes','decodedBytes','transferBuffers','lastError'])delete state.stats[key];
 if(typeof document==='undefined'||globalThis.__ASFALTO_CAPTURE_BAKE__||globalThis.__ASFALTO_DISABLE_BAKE__)return;
 try{
  const result=await workerClient.load(id,signal);signal?.throwIfAborted();if(token!==generation)throw new DOMException('Bake superseded','AbortError');
  const installing=performance.now();state.entries=new Map(result.payload.entries);Object.assign(state.stats,result.stats,{installMs:performance.now()-installing,loadMs:performance.now()-started});state.stats.loads++;
 }catch(error){if(token!==generation||signal?.aborted||error?.name==='AbortError')throw error;state.entries.clear();state.stats.fallbacks++;state.stats.lastError=String(error?.message||error);state.stats.loadMs=performance.now()-started;console.warn('[asfalto bake] CPU fallback:',state.stats.lastError);}
}
export function bakeSpatialField(samples,cellM,algorithm,compute){
 const key='spatial:'+bakeSignature([samples,cellM,algorithm]),saved=bakeRead(key),packed=saved?.packedSpatial?saved:null;
 const records=packed?null:new Map(saved||[]),capturing=!!globalThis.__ASFALTO_CAPTURE_BAKE__;
 if(capturing)bakeWrite(key,[]);const captured=capturing?state.entries.get(key):null;
 return (x,z,maxDistance=1500)=>{
  const q=packed?null:x+','+z+','+maxDistance,hit=packed?lookupSpatial(packed,x,z,maxDistance):records.has(q)?{found:true,value:records.get(q)}:{found:false};
  if(hit.found){state.stats.hits++;return hit.value===null?null:{...hit.value};}
  state.stats.misses++;const value=compute(x,z,maxDistance);if(capturing){records.set(q,value);captured.push([q,value]);}return value;
 };
}
export function bakeAttributeInput(attribute){
 if(!attribute)return null;const array=attribute.array||attribute.data?.array;
 return [array?.constructor.name,attribute.itemSize,!!attribute.normalized,attribute.count,attribute.isInterleavedBufferAttribute?[attribute.offset,attribute.data.stride]:null,Array.from(array||[])];
}
export function bakeGeometryInput(mesh,options){
 mesh.updateWorldMatrix(true,false);const g=mesh.geometry,attributes={};for(const [name,a]of Object.entries(g.attributes))attributes[name]=bakeAttributeInput(a);
 return bakeSignature([options,mesh.matrixWorld.elements,attributes,bakeAttributeInput(g.index)]);
}
