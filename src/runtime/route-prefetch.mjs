// A small HTTP-cache warmup. No decoded geometry, texture, or response-buffer cache.
const ROUTES=Object.freeze({dos_lagos:'dos-lagos',aconcagua_horcones:'aconcagua-horcones',cuesta_lipan:'cuesta-lipan',paso_garibaldi:'paso-garibaldi',cataratas_iguazu:'cataratas-iguazu'});
export function createRoutePrefetch({fetchImpl=globalThis.fetch?.bind(globalThis),resolveUrl=url=>url,baseUrl=new URL('../../',import.meta.url).href,getConnection=()=>globalThis.navigator?.connection,debounceMs=250,maxBytes=8*1024*1024,maxEntries=5,manifestMaxBytes=128*1024,timeoutMs=15000}={}) {
  let active=null,disposed=false,last={status:'idle',trackId:null,bytes:0,requests:0,completed:0};
  maxBytes=Math.max(0,Number(maxBytes)||0);maxEntries=Math.max(0,Math.floor(Number(maxEntries)||0));
  const diagnostics=()=>({...last});
  function cancel(){if(active){clearTimeout(active.timer);clearTimeout(active.timeout);active.controller.abort();active.state.status='cancelled';active.finish({...active.state});active=null;}}
  function blocked(){const c=getConnection?.();return c?.saveData||['slow-2g','2g'].includes(c?.effectiveType)||(c?.downlink>0&&c.downlink<0.75);}
  function selection(trackId){
    if(active?.state.trackId===trackId)return active.promise;
    cancel();last={status:'idle',trackId,bytes:0,requests:0,completed:0};
    if(disposed||!ROUTES[trackId]||blocked()||!fetchImpl||!maxEntries||!maxBytes){last.status='skipped';return Promise.resolve(diagnostics());}
    const tx={state:last,controller:new AbortController()};tx.promise=new Promise(resolve=>{tx.finish=resolve;});active=tx;
    tx.state.status='scheduled';tx.timer=setTimeout(()=>run(tx),Math.max(0,debounceMs));return tx.promise;
  }
  async function run(tx){
    const {state,controller}=tx,signal=controller.signal;
    const check=()=>{if(signal.aborted||active!==tx)throw new DOMException('cancelled','AbortError');};
    // Assets are drained one at a time on every device. Only the small manifest is decoded.
    async function request(url,{json=false}={}){
      check();if(blocked()){state.status='skipped';return null;}
      const resolved=await resolveUrl(url);check();state.requests++;
      const response=await fetchImpl(resolved,{signal,cache:'default',priority:'low'});check();
      if(!response.ok){await response.body?.cancel();throw Error('prefetch HTTP '+response.status);}
      const limit=Math.min(maxBytes-state.bytes,json?manifestMaxBytes:Infinity);
      const length=Number(response.headers?.get('content-length'));
      if(length>limit){await response.body?.cancel();state.status='budget';return null;}
      const reader=response.body?.getReader();
      if(!reader){await response.body?.cancel();throw Error('streaming response unavailable');}
      let readBytes=0,text='';const decoder=json?new TextDecoder():null;
      try{while(true){check();const {done,value}=await reader.read();if(done)break;readBytes+=value.byteLength;
        // A network stream can deliver one chunk larger than the remaining budget.
        state.bytes+=value.byteLength;if(readBytes>limit){await reader.cancel();state.status='budget';return null;}
        if(json)text+=decoder.decode(value,{stream:true});
      }}finally{reader.releaseLock();}
      check();state.completed++;return json?JSON.parse(text+decoder.decode()):true;
    }
    tx.timeout=setTimeout(()=>{if(active===tx){state.status='timeout';controller.abort();}},timeoutMs);
    try{
      check();state.status='loading';const manifestUrl=new URL('tracks/'+ROUTES[state.trackId]+'/manifest.json',baseUrl).href;
      const manifest=await request(manifestUrl,{json:true});check();if(!manifest)return;
      if(manifest.id!==state.trackId)throw Error('prefetch manifest identity mismatch');
      const candidates=[];const add=(url,bytes)=>{if(typeof url==='string')candidates.push({url,bytes});};
      add(manifest.route,manifest.integrity?.route?.bytes);add(manifest.environment?.profile);
      const first=manifest.streaming?.sectors?.[0];
      if(first){add(first.visual?.lod0?.url,first.visual?.lod0?.bytes);add(first.collision?.url,first.collision?.bytes);}
      else {for(const role of ['visual','collision']){const url=manifest[role]?.[0];add(url,manifest.integrity?.[role]?.[url]?.bytes);}}
      const routeBase=new URL('./',manifestUrl),seen=new Set();
      for(const item of candidates){
        check();if(state.requests>=maxEntries||state.bytes>=maxBytes||state.status==='budget'||state.status==='skipped')break;
        const url=new URL(item.url,routeBase);
        // Keep manifest URLs confined to this route, excluding external and off-route assets.
        if(url.origin!==routeBase.origin||!url.pathname.startsWith(routeBase.pathname)||seen.has(url.href))continue;
        seen.add(url.href);if(item.bytes>maxBytes-state.bytes)continue;
        await request(url.href);
      }
      if(state.status==='loading')state.status='complete';
    }catch(error){if(state.status!=='timeout')state.status=signal.aborted?'cancelled':'error';if(!signal.aborted)state.error=String(error?.message||error);}
    finally{clearTimeout(tx.timeout);if(active===tx)active=null;tx.finish({...state});}
  }
  return Object.freeze({selection,cancel,diagnostics,dispose(){cancel();disposed=true;}});
}
