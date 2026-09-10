export function renderPixelRatio({devicePixelRatio=1,qualityLimit=1,renderScale=1}={}){
 const safe=(n,f)=>Number.isFinite(n)&&n>0?n:f;
 return Math.min(safe(devicePixelRatio,1),safe(qualityLimit,1))*Math.max(.5,Math.min(1,safe(renderScale,1)));
}
