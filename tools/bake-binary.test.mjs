import test from 'node:test';
import assert from 'node:assert/strict';
let codec={};try{codec=await import('../src/tracks/visuals/bake-binary-codec.mjs?v=9a206fac5b81dd7a');}catch{}
test('binary codec preserves typed bytes, offsets and shared backing buffers',()=>{
 assert.equal(typeof codec.encodeBinaryBake,'function');
 const buffer=new ArrayBuffer(48),a=new Float64Array(buffer,8,3);a.set([-0,Math.PI,NaN]);
 const b=new Uint16Array(buffer,12,4),payload={schema:codec.BAKE_SCHEMA,id:'test',entries:[['arrays',{a,b,c:new Float32Array([1/3,-Infinity]),d:new Int32Array([-2147483648,42])}]]};
 const decoded=codec.decodeBinaryBake(codec.encodeBinaryBake(payload));const value=decoded.entries[0][1];
 assert.deepEqual(new Uint8Array(value.a.buffer,value.a.byteOffset,value.a.byteLength),new Uint8Array(buffer,8,24));
 assert.equal(value.b.buffer,value.a.buffer);assert.equal(value.b.byteOffset-value.a.byteOffset,4);assert.deepEqual(value.c,payload.entries[0][1].c);assert.deepEqual(value.d,payload.entries[0][1].d);
});
test('packed spatial lookup preserves null, negative coordinates, maxDistance and missing',()=>{
 assert.equal(typeof codec.packSpatial,'function');
 const rows=[['-3,2,1500',{distance:3,height:-2,sM:0,widthM:12}],['0,0,2',null],['-3,2,9',{distance:7,height:1,sM:2,widthM:3}]];
 const p=codec.packSpatial(rows);for(const [q,v]of rows)assert.deepEqual(codec.lookupSpatial(p,...q.split(',').map(Number)),{found:true,value:v});
 assert.deepEqual(codec.lookupSpatial(p,-3,2,8),{found:false});assert.deepEqual(codec.lookupSpatial(p,'-03',2,1500),{found:false});assert.deepEqual(codec.lookupSpatial(p,-0,0,2),{found:true,value:null});
});
test('rejects malformed binary header, metadata, descriptors and array bounds',()=>{
 assert.equal(typeof codec.encodeBinaryBake,'function');
 const valid=codec.encodeBinaryBake({schema:codec.BAKE_SCHEMA,id:'test-with-metadata-padding',entries:[['a',new Float64Array([1,2])]]});
 for(const offset of [0,4,8,12,16,20]){const corrupt=valid.slice(0);new DataView(corrupt).setUint32(offset,0xffffffff,true);assert.throws(()=>codec.decodeBinaryBake(corrupt));}
 assert.throws(()=>codec.decodeBinaryBake(valid.slice(0,-1)));
 const mutate=fn=>{const copy=valid.slice(0),view=new DataView(copy),n=view.getUint32(8,true),bytes=new Uint8Array(copy,24,n),m=JSON.parse(new TextDecoder().decode(bytes));fn(m);m.payload.id='';const s=new TextEncoder().encode(JSON.stringify(m));assert.ok(s.length<=n);bytes.fill(32);bytes.set(s);return copy;};
 for(const fn of [m=>m.schema='wrong',m=>m.buffers[0].offset=1,m=>m.buffers[0].length=0,m=>m.payload.entries[0][1].type='BadType',m=>m.payload.entries[0][1].count=-1,m=>m.payload.entries[0][1].count=999999]){const corrupted=mutate(fn);assert.throws(()=>codec.decodeBinaryBake(corrupted));}
});

test('all integer types and noncanonical NaN bits retain exact bytes',()=>{
 const types=[Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array];
 const arrays=types.map(Type=>new Type([0,-0,1,-1,2**31-1,-(2**31),NaN,Infinity,-Infinity,Number.MIN_VALUE]));new DataView(arrays[1].buffer).setBigUint64(6*8,0x7ff8000000000123n,true);
 const p=codec.decodeBinaryBake(codec.encodeBinaryBake({schema:codec.BAKE_SCHEMA,id:'types',entries:[['all',arrays]]}));
 p.entries[0][1].forEach((a,i)=>assert.deepEqual(new Uint8Array(a.buffer,a.byteOffset,a.byteLength),new Uint8Array(arrays[i].buffer)));
});
test('rejects corrupted spatial index instead of installing wrong lookup order',()=>{
 const p=codec.packSpatial([['1,0,1',null],['2,0,1',null]]),buffer=codec.encodeBinaryBake({schema:codec.BAKE_SCHEMA,id:'spatial',entries:[['spatial:test',p]]}),view=new DataView(buffer);
 const metadata=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,24,view.getUint32(8,true)))),descriptor=metadata.buffers[metadata.payload.entries[0][1].index.$array];
 new Uint8Array(buffer)[view.getUint32(12,true)+descriptor.offset]=255;assert.throws(()=>codec.decodeBinaryBake(buffer),/spatial index/);
});

test('odd-length backing buffers preserve offset float views and all shared bytes',()=>{
 for(const Type of [Float32Array,Float64Array,Uint16Array]){
  const offset=Type.BYTES_PER_ELEMENT,length=offset+2*Type.BYTES_PER_ELEMENT+1,buffer=new ArrayBuffer(length),bytes=new Uint8Array(buffer);bytes.fill(0xa5);
  const floats=new Type(buffer,offset,2);floats.set([1.25,-2.5]);const original=bytes.slice();
  // Put the wide view first: buffer layout must not assume its full backing size is aligned.
  const payload={schema:codec.BAKE_SCHEMA,id:'odd-backing-size',entries:[['arrays',{floats,bytes}]]};
  const decoded=codec.decodeBinaryBake(codec.encodeBinaryBake(payload)).entries[0][1];
  assert.deepEqual(decoded.bytes,original);assert.deepEqual(decoded.floats,floats);assert.equal(decoded.floats.buffer,decoded.bytes.buffer);assert.equal(decoded.floats.byteOffset-decoded.bytes.byteOffset,offset);assert.deepEqual(bytes,original);
 }
});
