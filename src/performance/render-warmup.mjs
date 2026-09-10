export async function prepareRenderPolicies({getTier,applyTier,prepare,paint=async()=>{},signal}){
 const previous=getTier(),started=performance.now(),prepared=[];
 try{for(const tier of ['low','balanced','high']){signal?.throwIfAborted();applyTier(tier);await prepare(tier);prepared.push(tier);await paint();signal?.throwIfAborted();}return{prepared,durationMs:performance.now()-started};}
 finally{applyTier(previous);}
}

/** Compile while the scene owns a stable set of materials. No asynchronous
 * program polling survives a streamed mesh disposal. The draw pays linking
 * cost inside the visible loading phase, never on the first driving frame. */
export async function prewarmStableScene({setLocked,settleStreaming,compile,draw}){
 setLocked(true);try{await settleStreaming();compile();draw();}finally{setLocked(false);}
}
