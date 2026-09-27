import {isDeepStrictEqual} from 'node:util';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {decodeBinaryBake,BAKE_SCHEMA,lookupSpatial} from '../src/tracks/visuals/bake-binary-codec.mjs?v=9a206fac5b81dd7a';import {prepareBinaryPayload} from './bake-tooling.mjs?v=08383d8a84ffdff4';
const base=new URL('../assets/tracks/offline-bake/',import.meta.url),flag=process.argv.indexOf('--reference'),reference=flag<0?null:path.resolve(process.argv[flag+1]);
const digest=x=>createHash('sha256').update(x).digest('hex'),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base))),report={scope:reference?'transport-and-exact-generated-values':'transport-integrity-only',tracks:{},totalBytes:0};
assert.equal(manifest.schema,BAKE_SCHEMA);
for(const [id,m]of Object.entries(manifest.tracks)){
 const started=performance.now(),zipped=fs.readFileSync(new URL(m.file,base));assert.equal(zipped.length,m.bytes);assert.equal(digest(zipped),m.sha256);
 const raw=gunzipSync(zipped);assert.equal(raw.length,m.decodedBytes);const current=decodeBinaryBake(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));assert.equal(current.id,id);assert.equal(current.entries.length,m.entries);
 const source=reference?JSON.parse(gunzipSync(fs.readFileSync(path.join(reference,id+'.json.gz')))):null,original=source?prepareBinaryPayload(source,{legacy:source.schema==='asfalto-cpu-bake/v2'&&!!source.entries.find(([k])=>k.startsWith('spatial:'))?.[1]?.spatial}):null,old=original?new Map(original.entries):null;
 const stat={bytes:zipped.length,entries:current.entries.length,geometryValues:0,spatialQueries:0,curvatureValues:0};if(old)assert.equal(old.size,current.entries.length,id+' entry coverage changed');
 for(const [key,v]of current.entries){
  if(!old)continue;assert.ok(old.has(key),id+' input signature missing: '+key);const prior=old.get(key);if(!key.startsWith('spatial:'))assert.ok(isDeepStrictEqual(v,prior),id+' exact values '+key);
  if(key.startsWith('refine:'))for(const a of [...Object.values(v.geometry.data.attributes),...(v.geometry.data.index?[v.geometry.data.index]:[])])stat.geometryValues+=a.array.length;
  else if(key.startsWith('spatial:')){assert.equal(v.index.length,prior.index.length,id+' spatial count');const a=prior.packedSpatial;for(let i=0;i<a.length;i+=7)assert.deepEqual(lookupSpatial(v,a[i],a[i+1],a[i+2]),{found:true,value:Number.isNaN(a[i+3])?null:{distance:a[i+3],height:a[i+4],sM:a[i+5],widthM:a[i+6]}});stat.spatialQueries+=v.index.length;}
  else if(key.startsWith('curvature:'))stat.curvatureValues+=v.values.length;
 }
 assert.equal(digest(gzipSync(raw,{level:9})),m.sha256);stat.elapsedMs=performance.now()-started;report.tracks[id]=stat;report.totalBytes+=zipped.length;console.log(id,JSON.stringify(stat));
}
console.log(JSON.stringify(report));


