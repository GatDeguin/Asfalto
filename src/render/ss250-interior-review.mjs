/** Opt-in local driving review until interaction, LOD and phone gates pass. */
export function ss250InteriorReviewEnabled(id){
 return id==='chevy_400_1957' && new URLSearchParams(globalThis.location?.search||'').get('ss250Interior')==='1';
}
export const SS250_REVIEW_EYE=Object.freeze([.10254671714384456,.23117623804357162,.15865491525423722]);

/** Inspection view from the same eye point; local opt-in only, not a driving default. */
export function ss250ConsoleInspection(id){return ss250InteriorReviewEnabled(id)&&new URLSearchParams(globalThis.location?.search||'').get('consoleLook')==='1';}
