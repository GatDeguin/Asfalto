import {boundedOperation} from './demand-loader.mjs?v=4a2efb64f7eb24a0';

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Verified, bounded transport. Allocate the declared size once, never accumulate
 * unbounded chunks or silently substitute a different asset after failure. */
export async function readExternalPayload(element, fetchImpl = fetch, {signal,timeoutMs=90000}={}) {
  const url=element?.dataset?.externalUrl, expected=Number(element?.dataset?.bytes);
  if(!url)throw new TypeError('external payload URL required');
  if(!Number.isSafeInteger(expected)||expected<1||expected>128*1024*1024)throw new RangeError('Invalid payload size: '+url);
  const version=String(element.dataset.sha256||'').toLowerCase();
  const versionedUrl=url+(url.includes('?')?'&':'?')+'v='+encodeURIComponent(version);
  return boundedOperation(async active=>{
    const response=await fetchImpl(versionedUrl,{cache:'default',signal:active});
    if(!response.ok)throw new Error('payload HTTP '+response.status+': '+url);
    const declared=Number(response.headers?.get('Content-Length'));
    if(!response.headers?.get('Content-Encoding')&&declared>expected){await response.body?.cancel();throw new Error('payload length mismatch: '+url);}
    let bytes;
    if(response.body?.getReader){
      const reader=response.body.getReader();bytes=new Uint8Array(expected);let offset=0,complete=false;
      const abort=()=>void reader.cancel(active.reason).catch(error=>console.warn('Asset stream cancel failed',error));
      active.addEventListener('abort',abort,{once:true});
      try{
        for(;;){active.throwIfAborted();const {done,value}=await reader.read();if(done)break;
          if(offset+value.byteLength>expected)throw new Error('payload length mismatch: '+url);
          bytes.set(value,offset);offset+=value.byteLength;
        }
        active.throwIfAborted();if(offset!==expected)throw new Error('payload length mismatch: '+url);complete=true;
      }finally{active.removeEventListener('abort',abort);if(!complete)await reader.cancel();reader.releaseLock();}
    }else bytes=new Uint8Array(await response.arrayBuffer());
    active.throwIfAborted();if(bytes.byteLength!==expected)throw new Error('payload length mismatch: '+url);
    if(await sha256Hex(bytes)!==String(element.dataset.sha256).toUpperCase())throw new Error('payload hash mismatch: '+url);
    active.throwIfAborted();return bytes;
  },{signal,timeoutMs,label:element.dataset.filename||'Asset'});
}
const api=Object.freeze({readExternalPayload});
if(typeof globalThis!=='undefined')globalThis.AsfaltoV6AssetCore=api;
