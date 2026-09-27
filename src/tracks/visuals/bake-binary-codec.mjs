// Binary container v3: 24-byte LE header, bounded descriptor JSON, aligned buffers.
// Decoding mutates the owned container in place; all typed views share that buffer.
export const BAKE_SCHEMA='asfalto-cpu-bake/v3';
export const MAX_BAKE_BYTES=512*1024*1024;
const MAGIC=0x334b4241,HEADER=24,MAX_META=4*1024*1024;
const TYPES={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array};
const align=n=>Math.ceil(n/8)*8;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const check=(condition,message)=>{if(!condition)throw Error('bake binary '+message);};
const compare=(a,b)=>a===b?0:Number.isNaN(a)?(Number.isNaN(b)?0:1):Number.isNaN(b)?-1:a<b?-1:1;
function compareRow(a,i,j){for(let k=0;k<3;k++){const c=compare(a[i*7+k],a[j*7+k]);if(c)return c;}return 0;}
export function indexSpatial(records){
 check(records instanceof Float64Array&&records.length%7===0,'spatial records');
 const index=new Uint32Array(records.length/7);for(let i=0;i<index.length;i++)index[i]=i;
 index.sort((i,j)=>compareRow(records,i,j));return {packedSpatial:records,index};
}
export function packSpatial(rows){
 const a=new Float64Array(rows.length*7);rows.forEach(([q,v],i)=>{a.set(q.split(',').map(Number),i*7);a.set(v?[v.distance,v.height,v.sM,v.widthM]:[NaN,0,0,0],i*7+3);});return indexSpatial(a);
}
export function lookupSpatial(p,x,z,maxDistance=1500){
 // Canonical string conversion matches the legacy x+','+z+','+distance key.
 const q=[x,z,maxDistance],n=q.map(Number);if(q.some((v,i)=>String(v)!==String(n[i])))return {found:false};
 const a=p.packedSpatial,index=p.index;let low=0,high=index.length;
 while(low<high){const mid=(low+high)>>>1,j=index[mid]*7;let c=0;for(let k=0;k<3&&!c;k++)c=compare(a[j+k],n[k]);if(c<0)low=mid+1;else high=mid;}
 if(low===index.length)return {found:false};const j=index[low]*7;
 for(let k=0;k<3;k++)if(compare(a[j+k],n[k]))return {found:false};
 return {found:true,value:Number.isNaN(a[j+3])?null:{distance:a[j+3],height:a[j+4],sM:a[j+5],widthM:a[j+6]}};
}
export function validateBakePayload(payload){
 check(payload?.schema===BAKE_SCHEMA&&typeof payload.id==='string'&&Array.isArray(payload.entries)&&payload.entries.length<=10000,'schema');
 const keys=new Set();for(const row of payload.entries){check(Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&!keys.has(row[0]),'entry');keys.add(row[0]);const [key,v]=row;
  if(key.startsWith('spatial:')){check(v?.packedSpatial instanceof Float64Array&&v.packedSpatial.length%7===0&&v.index instanceof Uint32Array&&v.index.length===v.packedSpatial.length/7,'spatial schema');
   // Strict monotonicity validates bounds, uniqueness and complete coverage without another index allocation.
   for(let i=0;i<v.index.length;i++){check(v.index[i]<v.index.length,'spatial index');if(i)check(compareRow(v.packedSpatial,v.index[i-1],v.index[i])<0,'spatial index order');}
  }
  if(key.startsWith('curvature:'))check(v?.values instanceof Float32Array,'curvature schema');
  if(key.startsWith('refine:')){check(v?.geometry?.data?.attributes&&typeof v.geometry.data.attributes==='object','geometry schema');for(const a of [...Object.values(v.geometry.data.attributes),...(v.geometry.data.index?[v.geometry.data.index]:[])])check(TYPES[a.type]&&a.array instanceof TYPES[a.type],'geometry array');}
 }return payload;
}
function transform(bytes,stride,xor,decode){
 const count=bytes.length/stride,scratch=new Uint8Array(256*stride);
 if(!decode&&xor)for(let i=bytes.length-1;i>=xor*stride;i--)bytes[i]^=bytes[i-xor*stride];
 for(let start=0;start<count;start+=256){const n=Math.min(256,count-start),offset=start*stride;scratch.set(bytes.subarray(offset,offset+n*stride));for(let b=0;b<stride;b++)for(let i=0;i<n;i++)bytes[offset+(decode?i*stride+b:b*n+i)]=scratch[decode?b*n+i:i*stride+b];}
 if(decode&&xor)for(let i=xor*stride;i<bytes.length;i++)bytes[i]^=bytes[i-xor*stride];
}
export function encodeBinaryBake(payload){
 validateBakePayload(payload);const buffers=[],sources=[],seen=new Map();
 function visit(v,components=1){
  // A valid typed view may leave trailing bytes in its shared backing buffer.
  if(ArrayBuffer.isView(v)){check(TYPES[v.constructor.name]&&v.buffer instanceof ArrayBuffer,'array type');let i=seen.get(v.buffer);if(i===undefined){i=buffers.length;seen.set(v.buffer,i);sources.push(v.buffer);buffers.push({offset:0,length:v.buffer.byteLength,stride:v.buffer.byteLength%v.BYTES_PER_ELEMENT===0?v.BYTES_PER_ELEMENT:1,xor:components});}return {$array:i,type:v.constructor.name,offset:v.byteOffset,count:v.length};}
  if(Array.isArray(v))return v.map(x=>visit(x));
  if(v&&typeof v==='object'){const result={};for(const [k,x]of Object.entries(v))result[k]=visit(x,k==='packedSpatial'?7:k==='array'?(v.itemSize||1):1);return result;}return v;
 }
 const metadata={schema:BAKE_SCHEMA,buffers,payload:visit(payload)};
 let position=0;for(const b of buffers){position=align(position);b.offset=position;position+=b.length;}
 const json=new TextEncoder().encode(JSON.stringify(metadata));check(json.length<=MAX_META,'metadata size');const start=align(HEADER+json.length),total=start+position;check(total<=MAX_BAKE_BYTES,'size');
 const result=new ArrayBuffer(total),view=new DataView(result);[MAGIC,3,json.length,start,total,0].forEach((n,i)=>view.setUint32(i*4,n,true));new Uint8Array(result,HEADER,json.length).set(json);
 for(let i=0;i<buffers.length;i++){const b=buffers[i],bytes=new Uint8Array(result,start+b.offset,b.length);bytes.set(new Uint8Array(sources[i]));transform(bytes,b.stride,b.xor,false);}return result;
}
export function decodeBinaryBake(buffer){
 check(buffer instanceof ArrayBuffer&&buffer.byteLength>=HEADER&&buffer.byteLength<=MAX_BAKE_BYTES,'size');const v=new DataView(buffer),n=v.getUint32(8,true),start=v.getUint32(12,true);
 check(v.getUint32(0,true)===MAGIC&&v.getUint32(4,true)===3&&v.getUint32(20,true)===0,'header');check(n>0&&n<=MAX_META&&start===align(HEADER+n)&&start<=buffer.byteLength&&v.getUint32(16,true)===buffer.byteLength,'bounds');
 const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(buffer,HEADER,n)));check(m.schema===BAKE_SCHEMA&&Array.isArray(m.buffers)&&m.buffers.length<=30000,'metadata');
 let end=0;for(const b of m.buffers){check(integer(b.offset,0,buffer.byteLength)&&b.offset===align(end)&&integer(b.length,0,buffer.byteLength-start-b.offset)&&[1,2,4,8].includes(b.stride)&&b.length%b.stride===0&&integer(b.xor,0,16),'buffer descriptor');end=b.offset+b.length;}check(start+end===buffer.byteLength,'trailing bytes');
 // Validate descriptors before touching payload bytes.
 function visit(value,install=false,depth=0){check(depth<64,'metadata nesting');if(!value||typeof value!=='object')return value;
  if(Object.hasOwn(value,'$array')){const Type=TYPES[value.type],b=m.buffers[value.$array];check(integer(value.$array,0,m.buffers.length-1)&&Type&&b&&integer(value.offset,0,b.length)&&value.offset%Type.BYTES_PER_ELEMENT===0&&integer(value.count,0,Math.floor((b.length-value.offset)/Type.BYTES_PER_ELEMENT)),'array descriptor');return install?new Type(buffer,start+b.offset+value.offset,value.count):value;}
  for(const key of Object.keys(value))value[key]=visit(value[key],install,depth+1);return value;
 }
 visit(m.payload);for(const b of m.buffers)transform(new Uint8Array(buffer,start+b.offset,b.length),b.stride,b.xor,true);
 return validateBakePayload(visit(m.payload,true));
}
export function bakeTransferList(payload){const buffers=new Set();function visit(v){if(ArrayBuffer.isView(v)){buffers.add(v.buffer);return;}if(v&&typeof v==='object')for(const x of Object.values(v))visit(x);}visit(payload);return [...buffers];}

