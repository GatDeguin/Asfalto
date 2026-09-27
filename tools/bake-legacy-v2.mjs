// Tooling-only v2 codec. Never imported by the browser runtime.
export const BAKE_SCHEMA='asfalto-cpu-bake/v2';
const ARRAY_TYPES={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array};
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
function packArray(values,type,components=1){
 const array=new ARRAY_TYPES[type](values),stride=array.BYTES_PER_ELEMENT,source=new Uint8Array(array.buffer);
 const candidates=[{binary:base64(source),type,count:array.length}];
 for(const xor of [0,components]){
  const bytes=source.slice();if(xor)for(let i=bytes.length-1;i>=xor*stride;i--)bytes[i]^=bytes[i-xor*stride];
  const shuffled=new Uint8Array(bytes.length),block=256;
  for(let start=0;start<array.length;start+=block){const n=Math.min(block,array.length-start);for(let b=0;b<stride;b++)for(let i=0;i<n;i++)shuffled[start*stride+b*n+i]=bytes[(start+i)*stride+b];}
  candidates.push({binary:base64(shuffled),type,count:array.length,layout:'block-shuffle-v1',xor,block});
 }
 const score=globalThis.__ASFALTO_BAKE_PACK_SCORE__;return score?candidates.map(v=>[v,score(JSON.stringify(v))]).sort((a,b)=>a[1]-b[1])[0][0]:candidates[2];
}
export function unpackArray(record){
 const Type=ARRAY_TYPES[record?.type];if(!Type||typeof record.binary!=='string')throw Error('bake array schema');
 const text=atob(record.binary),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);if(bytes.byteLength!==record.count*Type.BYTES_PER_ELEMENT)throw Error('bake array length');
 let unpacked=bytes;const stride=Type.BYTES_PER_ELEMENT;
 if(record.layout==='byte-shuffle-v1'){unpacked=new Uint8Array(bytes.length);for(let b=0;b<stride;b++)for(let i=0;i<record.count;i++)unpacked[i*stride+b]=bytes[b*record.count+i];}
 else if(record.layout==='block-shuffle-v1'){
  if(record.block!==256||!Number.isInteger(record.xor)||record.xor<0||record.xor>16)throw Error('bake layout');unpacked=new Uint8Array(bytes.length);
  for(let start=0;start<record.count;start+=record.block){const n=Math.min(record.block,record.count-start);for(let b=0;b<stride;b++)for(let i=0;i<n;i++)unpacked[(start+i)*stride+b]=bytes[start*stride+b*n+i];}
  if(record.xor)for(let i=record.xor*stride;i<unpacked.length;i++)unpacked[i]^=unpacked[i-record.xor*stride];
 }else if(record.layout!==undefined)throw Error('bake array layout');
 const array=new Type(unpacked.buffer);if(record.delta)for(let i=1;i<array.length;i++)array[i]+=array[i-1];return array;
}
export function encodeBakeArtifact(payload){
 return {...payload,schema:BAKE_SCHEMA,entries:payload.entries.slice().sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(([key,value])=>{
  if(key.startsWith('curvature:'))return [key,{...value,values:packArray(value.values,'Float32Array')}];
  if(key.startsWith('refine:')){const geometry=structuredClone(value.geometry);for(const a of Object.values(geometry.data.attributes))a.array=packArray(a.array,a.type,a.itemSize||1);if(geometry.data.index){const a=geometry.data.index;a.array=packArray(a.array,a.type,a.itemSize||1);}return[key,{...value,geometry}];}
  if(key.startsWith('spatial:')){const data=new Float64Array(value.length*7);value.slice().sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).forEach(([q,v],i)=>{const j=i*7;data.set(q.split(',').map(Number),j);data.set(v?[v.distance,v.height,v.sM,v.widthM]:[NaN,0,0,0],j+3);});return[key,{spatial:packArray(data,'Float64Array',7)}];}
  return[key,value];
 })};
}
export function decodeBakeArtifact(payload){
 return {...payload,entries:payload.entries.map(([key,value])=>{
  if(key.startsWith('curvature:'))return[key,{...value,values:unpackArray(value.values)}];
  if(key.startsWith('refine:')){for(const a of Object.values(value.geometry.data.attributes))a.array=unpackArray(a.array);if(value.geometry.data.index)value.geometry.data.index.array=unpackArray(value.geometry.data.index.array);return[key,value];}
  if(key.startsWith('spatial:')){const a=unpackArray(value.spatial),records=[];if(a.length%7)throw Error('spatial length');for(let i=0;i<a.length;i+=7)records.push([a[i]+','+a[i+1]+','+a[i+2],Number.isNaN(a[i+3])?null:{distance:a[i+3],height:a[i+4],sM:a[i+5],widthM:a[i+6]}]);return[key,records];}
  return[key,value];
 })};
}

