export async function prepareRenderPolicies({getTier,applyTier,prepare,paint=async()=>{},signal,maximumTier='high'}){
 const tiers=['low','balanced','high'],limit=tiers.indexOf(maximumTier);
 if(limit<0)throw new RangeError('Unknown maximum rendering tier: '+maximumTier);
 const previous=getTier(),started=performance.now(),prepared=[];
 try{for(const tier of tiers.slice(0,limit+1)){signal?.throwIfAborted();applyTier(tier);await prepare(tier);prepared.push(tier);await paint();signal?.throwIfAborted();}return{prepared,durationMs:performance.now()-started};}
 finally{applyTier(previous);}
}

/** Compile while the scene owns a stable set of materials. No asynchronous
 * program polling survives a streamed mesh disposal. The draw pays linking
 * cost inside the visible loading phase, never on the first driving frame. */
export async function prewarmStableScene({setLocked,settleStreaming,compile,draw}){
 setLocked(true);try{await settleStreaming();compile();await draw();}finally{setLocked(false);}
}

/** Pay first-use exterior GPU work behind loading, without advancing camera animation. */
export async function prewarmViews({capture,select,draw,restore}){const state=capture();try{select();await draw();}finally{restore(state);}await draw();}

