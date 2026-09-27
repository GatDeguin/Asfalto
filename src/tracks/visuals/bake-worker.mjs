import {BAKE_SCHEMA,MAX_BAKE_BYTES,decodeBinaryBake,bakeTransferList} from './bake-binary-codec.mjs?v=9a206fac5b81dd7a';
const MAX_COMPRESSED=100*1024*1024;
async function boundedBytes(response,limit,expected){
 if(!response.ok&&response.status)throw Error('bake fetch '+response.status);
 const reader=response.body.getReader(),chunks=[];let count=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>limit)throw Error('bake byte limit');chunks.push(value);}}catch(error){await reader.cancel();throw error;}
 if(expected!==undefined&&count!==expected)throw Error('bake byte count');const result=new Uint8Array(count);let offset=0;for(let i=0;i<chunks.length;i++){result.set(chunks[i],offset);offset+=chunks[i].length;chunks[i]=null;}return result.buffer;
}
self.onmessage=async({data:{id,requestId}})=>{
 try{
  const stats={},started=performance.now(),base=new URL('../../../assets/tracks/offline-bake/',import.meta.url);
  const manifestResponse=await fetch(new URL('manifest.json',base),{cache:'no-cache'}),manifest=JSON.parse(new TextDecoder().decode(await boundedBytes(manifestResponse,256*1024))),entry=manifest.tracks?.[id];
  if(manifest.schema!==BAKE_SCHEMA||!entry||entry.file!==id+'.bake.gz'||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||entry.bytes>MAX_COMPRESSED||!Number.isSafeInteger(entry.decodedBytes)||entry.decodedBytes<=0||entry.decodedBytes>MAX_BAKE_BYTES||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('incompatible bake manifest');
  const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256);let bytes=await boundedBytes(await fetch(url),MAX_COMPRESSED,entry.bytes);stats.fetchMs=performance.now()-started;
  let phase=performance.now();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==entry.sha256)throw Error('bake integrity');stats.integrityMs=performance.now()-phase;
  phase=performance.now();const decoded=await boundedBytes(new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))),MAX_BAKE_BYTES,entry.decodedBytes);bytes=null;stats.decompressMs=performance.now()-phase;
  phase=performance.now();const payload=decodeBinaryBake(decoded);if(payload.id!==id||payload.entries.length!==entry.entries)throw Error('bake payload identity');stats.decodeMs=performance.now()-phase;stats.compressedBytes=entry.bytes;stats.decodedBytes=decoded.byteLength;stats.workerMs=performance.now()-started;
  const transfers=bakeTransferList(payload);stats.transferBuffers=transfers.length;self.postMessage({requestId,ok:true,payload,stats,sentAt:performance.timeOrigin+performance.now()},transfers);
 }catch(error){self.postMessage({requestId,ok:false,error:error?.message||String(error)});}
};
