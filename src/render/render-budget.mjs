import {TRACK_RENDER_POLICIES} from '../performance/track-performance-governor.mjs?v=80b7bc7f721a38cf';
const MiB=1024*1024;
const budgets=Object.freeze({
 cinematic:{maxPixels:2560*1440,maxPostBytes:256*MiB,samples:4,effectPixels:518400,effectScale:.625},
 high:{maxPixels:1920*1080,maxPostBytes:160*MiB,samples:2,effectPixels:768*768,effectScale:.5},
 balanced:{maxPixels:1600*900,maxPostBytes:96*MiB,samples:2,effectPixels:576*576,effectScale:.5},
 low:{maxPixels:1280*720,maxPostBytes:64*MiB,samples:0,effectPixels:384*384,effectScale:.4},
 off:{maxPixels:1920*1080,maxPostBytes:160*MiB,samples:2,effectPixels:0,effectScale:0},
});
const positive=(n,fallback)=>Number.isFinite(n)&&n>0?n:fallback;
/** Conservative allocation budget for concurrent HDR color/depth/MSAA passes.
 * Not a VRAM measurement: assets, shadows, driver storage and the canvas are
 * separate. Reserving both HDR passes avoids oversubscription when a LUT opens. */
export function resolveRenderBudget({width=640,height=360,pixelRatio=1,quality='high',phone=false,passCount=2,samples}={}) {
 const policy=budgets[quality]||budgets.balanced;
 width=positive(width,640);height=positive(height,360);pixelRatio=positive(pixelRatio,1);
 const count=Math.max(1,Math.min(2,Math.ceil(positive(passCount,2))));
 const sampleCount=phone?0:Math.max(0,Math.min(policy.samples,Number.isFinite(samples)?Math.floor(samples):policy.samples));
 const maxPostBytes=Math.min(policy.maxPostBytes,phone?64*MiB:Infinity);
 const effectReserve=16*policy.effectPixels; // two RGBA16F screen lighting targets
 const bytesPerPixel=count*(12+12*sampleCount); // RGBA16F + conservative 32-bit depth, resolved and MSAA
 const maxPixels=Math.max(4,Math.min(policy.maxPixels,phone?1280*720:Infinity,Math.floor((maxPostBytes-effectReserve)/bytesPerPixel)));
 const ratio=Math.min(pixelRatio,Math.sqrt(maxPixels/(width*height)),8192/width,8192/height);
 const physicalWidth=Math.max(2,Math.floor(width*ratio)),physicalHeight=Math.max(2,Math.floor(height*ratio));
 const pixels=physicalWidth*physicalHeight;
 return Object.freeze({quality,width:physicalWidth,height:physicalHeight,pixelRatio:ratio,requestedPixelRatio:pixelRatio,maxPixels,maxPostBytes,passCount:count,samples:sampleCount,nominalPostBytes:pixels*bytesPerPixel+16*Math.min(policy.effectPixels,Math.floor(pixels*policy.effectScale**2)),limited:ratio<pixelRatio,scope:'concurrent postprocessing allocations; excludes assets, canvas and driver overhead'});
}
export const renderSampleLimit=(quality,phone=false)=>phone?0:(budgets[quality]||budgets.balanced).samples;
export function describeRenderTarget(target) {
 if(!target)return null;
 const width=target.width,height=target.height,samples=target.samples||0,depthBytes=target.depthBuffer?4:0;
 return {name:target.texture?.name||'',width,height,samples,colorFormat:'RGBA16F',depth:!!target.depthBuffer,nominalBytes:width*height*(8+depthBytes)*(1+samples)};
}
/** Workshop owns its CSS dimensions independently of pixel ratio; never compare
 * a physical canvas width with a CSS width (that reallocates on every resize). */
export function createWorkshopRenderBudget(T,{renderer,phone=false}={}) {
 const supported=!!(renderer?.getSize&&renderer.setSize&&renderer.getPixelRatio&&renderer.setPixelRatio);
 const originalSize=supported?renderer.getSize(new T.Vector2()):new T.Vector2(640,360);
 const originalRatio=supported?renderer.getPixelRatio():1,originalShadows=renderer.shadowMap?.enabled;
 let baseRatio=originalRatio,quality='high',last=null,signature='',disposed=false;
 const restored=()=>{signature='';};renderer.domElement?.addEventListener?.('webglcontextrestored',restored);
 function apply(tier=quality,dimensions={}) {
  if(disposed)return last;
  quality=TRACK_RENDER_POLICIES[tier]?tier:'high';
  if(Number.isFinite(dimensions.pixelRatio)&&dimensions.pixelRatio>0)baseRatio=dimensions.pixelRatio;
  const rect=renderer.domElement?.getBoundingClientRect?.()||originalSize;
  const width=positive(dimensions.width,positive(rect.width,originalSize.x)),height=positive(dimensions.height,positive(rect.height,originalSize.y));
  const policy=TRACK_RENDER_POLICIES[quality];
  last=resolveRenderBudget({width,height,pixelRatio:baseRatio*policy.resolutionScale,quality,phone,passCount:1});
  const next=[width,height,last.pixelRatio,policy.shadows].join(':');
  if(supported&&next!==signature){
   if(renderer.getPixelRatio()!==last.pixelRatio)renderer.setPixelRatio(last.pixelRatio);
   const size=renderer.getSize(new T.Vector2());if(size.x!==width||size.y!==height)renderer.setSize(width,height,false);
   if(renderer.shadowMap)renderer.shadowMap.enabled=policy.shadows;
   signature=next;
  }
  return last;
 }
 return {apply,diagnostics:()=>last?{...last,applied:supported,shadows:renderer.shadowMap?.enabled}:null,dispose(){if(disposed)return;disposed=true;renderer.domElement?.removeEventListener?.('webglcontextrestored',restored);if(supported){renderer.setPixelRatio(originalRatio);renderer.setSize(originalSize.x,originalSize.y,false);if(renderer.shadowMap)renderer.shadowMap.enabled=originalShadows;}last=null;}};
}
