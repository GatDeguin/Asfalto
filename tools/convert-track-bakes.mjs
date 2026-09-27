import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {BAKE_SCHEMA,encodeBinaryBake,decodeBinaryBake,lookupSpatial} from '../src/tracks/visuals/bake-binary-codec.mjs?v=9a206fac5b81dd7a';
import {prepareBinaryPayload} from './bake-tooling.mjs?v=08383d8a84ffdff4';
const root=new URL('../',import.meta.url),flag=process.argv.indexOf('--source'),source=flag<0?new URL('../../Reports/Asfalto_Nacional_v8/performance-stage2-2026-09-26/before/assets/tracks/offline-bake/',import.meta.url):path.resolve(process.argv[flag+1]);
const read=(base,file)=>fs.readFileSync(base instanceof URL?new URL(file,base):path.join(base,file));
const old=JSON.parse(read(source,'manifest.json'));assert.equal(old.schema,'asfalto-cpu-bake/v2');const manifest={schema:BAKE_SCHEMA,tracks:{},inputs:old.inputs},report={tracks:{},beforeBytes:0,afterBytes:0};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [id,entry]of Object.entries(old.tracks)){
 const started=performance.now(),compressed=read(source,entry.file);assert.equal(compressed.length,entry.bytes);assert.equal(digest(compressed),entry.sha256);
 const payload=prepareBinaryPayload(JSON.parse(gunzipSync(compressed)),{legacy:true});assert.equal(payload.id,id);
 const encoded=encodeBinaryBake(payload),zipped=gzipSync(new Uint8Array(encoded),{level:9}),decoded=decodeBinaryBake(encoded.slice(0));assert.deepEqual(decoded,payload);
 let queries=0;for(const [key,p]of payload.entries)if(key.startsWith('spatial:')){const actual=decoded.entries.find(([k])=>k===key)[1];for(let i=0;i<p.packedSpatial.length;i+=7){const a=p.packedSpatial;assert.deepEqual(lookupSpatial(actual,a[i],a[i+1],a[i+2]),{found:true,value:Number.isNaN(a[i+3])?null:{distance:a[i+3],height:a[i+4],sM:a[i+5],widthM:a[i+6]}});queries++;}}
 assert.ok(zipped.length<100*1024*1024);const file=id+'.bake.gz';fs.writeFileSync(new URL('assets/tracks/offline-bake/'+file,root),zipped);
 manifest.tracks[id]={file,bytes:zipped.length,decodedBytes:encoded.byteLength,sha256:digest(zipped),entries:payload.entries.length};
 report.tracks[id]={beforeBytes:compressed.length,afterBytes:zipped.length,decodedBytes:encoded.byteLength,spatialQueries:queries,elapsedMs:performance.now()-started};report.beforeBytes+=compressed.length;report.afterBytes+=zipped.length;console.log(id,JSON.stringify(report.tracks[id]));
}
// Publish manifest only after every artifact passed exact byte and query checks.
fs.writeFileSync(new URL('assets/tracks/offline-bake/manifest.json?v=3f7afb7702579a52',root),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(report,null,2));
