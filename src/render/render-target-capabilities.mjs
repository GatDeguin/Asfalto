/** Select an actually supported sample count for the HDR+depth attachment pair.
 * Canvas antialiasing says nothing about offscreen targets. Unknown capabilities
 * conservatively select a single-sample target, not a claimed MSAA substitute. */
const supportedByContext=new WeakMap(),observedContexts=new WeakSet();
export function supportedHdrSamples(renderer,requested=2){
 const limit=Math.min(8,Math.floor(Number(requested)||0),renderer?.capabilities?.maxSamples||0);
 if(limit<2)return 0;
 try{
  const gl=renderer.getContext();
  if(gl.isContextLost?.()||typeof gl.getInternalformatParameter!=='function')return 0;
  let supported=supportedByContext.get(gl);
  if(!supported){
   const color=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
   const depth=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]);
   supported=color.filter(n=>Number.isInteger(n)&&n>=2&&depth.includes(n));supportedByContext.set(gl,supported);
   if(!observedContexts.has(gl)){
    observedContexts.add(gl);
    const invalidate=()=>supportedByContext.delete(gl);
    gl.canvas?.addEventListener?.('webglcontextlost',invalidate);
    gl.canvas?.addEventListener?.('webglcontextrestored',invalidate);
   }
  }
  return Math.max(0,...supported.filter(n=>n<=limit));
 }catch{return 0;}
}
