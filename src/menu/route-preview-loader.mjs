// One visible preview owns one request and one decoded object URL. A new selection
// hides old pixels immediately, even if an earlier request ignores cancellation.
export function createRoutePreviewLoader({load=loadPreviewImage,release=source=>URL.revokeObjectURL(source),onState}) {
  let generation=0, controller=null, current=null, selected=null, disposed=false;
  function clear(){controller?.abort();controller=null;if(current){release(current);current=null;}}
  return {
    async select(key, source) {
      if(disposed||selected===`${key}|${source||''}`) return;
      selected=`${key}|${source||''}`; const request=++generation;clear();
      onState({key,status:source?'loading':'missing',source:null});
      if(!source)return;
      controller=new AbortController();
      try {
        const result=await load(source,controller.signal);
        if(disposed||request!==generation){release(result);return;}
        current=result;controller=null;onState({key,status:'ready',source:result});
      } catch(error) {
        if(!disposed&&request===generation){controller=null;onState({key,status:'error',source:null,error});}
      }
    },
    suspend(){if(disposed||(!controller&&!current&&selected===null))return;++generation;selected=null;clear();onState({status:'idle',source:null});},
    dispose(){disposed=true;++generation;clear();},
  };
}
async function loadPreviewImage(source, signal){
  const response=await fetch(source,{signal});
  if(!response.ok)throw new Error('La vista previa no está disponible.');
  const url=URL.createObjectURL(await response.blob());
  try{const image=new Image();image.src=url;await image.decode();signal.throwIfAborted();return url;}
  catch(error){URL.revokeObjectURL(url);throw error;}
}
