const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Artistic sRGB optical targets; depth is supplied by the scene's geometric field. */
export function resolveWaterOptics(metadata={},river=false){
 const color=(key,fallback)=>/^#[0-9a-f]{6}$/i.test(metadata[key]||'')?metadata[key]:fallback;
 const number=(key,fallback,min,max)=>Number.isFinite(metadata[key])?clamp(metadata[key],min,max):fallback;
 return {shallowColor:color('shallowColor',river?'#5b6650':'#52715c'),deepColor:color('deepColor',river?'#243b2c':'#12383d'),absorptionPerMeter:number('absorptionPerMeter',river?.35:.16,.01,4),roughness:number('roughness',river?.26:.12,.05,.7),attenuationDistanceM:number('attenuationDistanceM',river?3:15,.1,100)};
}
