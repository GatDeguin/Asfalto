// Conservative admission budget for the main render chain, not a VRAM reading.
// Reserve two RGBA16F + depth surfaces (including multisample attachments) and
// both screen-lighting buffers. Shadows, assets, mirrors and the browser are separate.
const PIXELS=Object.freeze({cinematic:4194304,high:3686400,balanced:2073600,low:1048576,off:3686400});
const positive=(value,fallback)=>Number.isFinite(value)&&value>0?value:fallback;
export function planMainRenderBudget({width=1,height=1,pixelRatio=1,quality='high',phone=false,samples=4,maxTextureSize=16384}={}) {
  width=Math.max(1,positive(width,1));height=Math.max(1,positive(height,1));pixelRatio=positive(pixelRatio,1);
  const level=Object.hasOwn(PIXELS,quality)?quality:'high';
  const limitBytes=(phone?96:256)*1024*1024;
  const effectPixels=level==='cinematic'?518400:level==='high'?331776:level==='balanced'?186624:level==='low'?82944:0;
  const reservedBytes=effectPixels*16; // two RGBA16F effect targets, no depth
  const acceptedSamples=Math.max(0,Math.min(8,Math.floor(Number(samples)||0)));
  const bytesPerPixel=2*(8+4)*(1+acceptedSamples);
  const maxPixels=Math.max(1,Math.min(PIXELS[level],phone?1048576:Infinity,Math.floor((limitBytes-reservedBytes)/bytesPerPixel)));
  const dimensionLimit=Math.max(1,Math.floor(positive(maxTextureSize,16384)));
  const ratio=Math.min(pixelRatio,Math.sqrt(maxPixels/(width*height)),dimensionLimit/width,dimensionLimit/height);
  const w=Math.max(1,Math.floor(width*ratio)),h=Math.max(1,Math.floor(height*ratio));
  return Object.freeze({width:w,height:h,pixelRatio:ratio,maxPixels,limitBytes,reservedBytes,
    nominalBytes:w*h*bytesPerPixel+reservedBytes,acceptedSamples,quality:level,
    limited:ratio<pixelRatio,scope:'main HDR targets only; not measured VRAM'});
}
