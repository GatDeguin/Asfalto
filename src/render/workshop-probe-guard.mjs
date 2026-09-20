import {readHalfFloatTarget} from './async-probe-readback.mjs?v=15602b3ab72b0ac3';
// Validate an infrequently rebuilt local reflection before binding it to materials.
// A single NaN/Infinity can poison PMREM lighting. Null means use the existing
// scene.environment HDRI; it never means disable the car's PBR or add fill lights.
const FALLBACK=Object.freeze({texture:null,dispose(){}});
const MAX_PIXELS=1024*1024;
export function createRoomProbeGuard(T,renderer,{onReset=()=>{},signal}={}){
 let blocked=false,disposed=false,last={mode:'pending',reason:null,checks:0,pixels:0};
 const reset=()=>{if(disposed)return;blocked=false;onReset();};
 renderer.domElement?.addEventListener?.('webglcontextrestored',reset);
 const fail=(reason,error=null)=>{blocked=true;last={...last,mode:'scene-hdri-fallback',reason,error};return FALLBACK;};
 async function capture(build){
  if(disposed||blocked)return FALLBACK;
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),physical=renderer.getCurrentViewport?.(new T.Vector4()),scissorTest=renderer.getScissorTest();
  const autoClear=renderer.autoClear,toneMapping=renderer.toneMapping,xr=renderer.xr?.enabled,shadowAuto=renderer.shadowMap?.autoUpdate,shadowNeeds=renderer.shadowMap?.needsUpdate;
  let candidate=null;
  try{
   try{candidate=build();}finally{
    renderer.autoClear=autoClear;renderer.toneMapping=toneMapping;if(renderer.xr)renderer.xr.enabled=xr;
    if(renderer.shadowMap){renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;}
    renderer.setRenderTarget(target,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
    if(physical&&renderer.state?.viewport)renderer.state.viewport(physical);
   }
   last={...last,checks:last.checks+1};
   const pixels=candidate?.width*candidate?.height;
   if(!Number.isInteger(pixels)||pixels<=0||pixels>MAX_PIXELS){candidate?.dispose();candidate=null;return fail('probe-pixel-budget');}
   if(candidate.texture.type!==T.HalfFloatType){candidate.dispose();candidate=null;return fail('probe-readback-unsupported');}
   const buffer=new Uint16Array(pixels*4);buffer.fill(0x7e00);
   await readHalfFloatTarget(renderer,candidate,buffer,{signal});signal?.throwIfAborted();
   if(disposed)throw new DOMException('Taller cerrado','AbortError');
   let invalid=0;for(let i=0;i<buffer.length;i+=4)for(let c=0;c<3;c++)if((buffer[i+c]&0x7c00)===0x7c00)invalid++;
   last={...last,pixels,invalidComponents:invalid,readbackBytes:buffer.byteLength};
   if(invalid){candidate.dispose();candidate=null;return fail('non-finite-radiance');}
   last={...last,mode:'local-pmrem',reason:null,error:null};return candidate;
  }catch(error){candidate?.dispose();if(signal?.aborted||error?.name==='AbortError')throw error;return fail('probe-capture-failed',String(error?.message||error));}
 }
 return{capture,disabled:()=>blocked,diagnostics:()=>({...last,disabled:blocked,disposed,maxPixels:MAX_PIXELS}),dispose(){if(disposed)return;disposed=true;renderer.domElement?.removeEventListener?.('webglcontextrestored',reset);}};
}
