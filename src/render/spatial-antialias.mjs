import {fxaaShaderDefinitions} from './vendor/fxaa-shader-factory.mjs?v=51c793fad42be72d';
import {supportsScreenSpaceHDR} from './screen-space-targets.mjs?v=6da4d0d78fe83c9e';
import {compileVisiblePass} from './pass-preparation.mjs?v=258173b4dba723d7';
import {resolveRenderBudget,describeRenderTarget,renderSampleLimit} from './render-budget.mjs?v=19c7400d32eaa34a';
/** Spatial resolve of linear HDR. No history, jitter, motion vectors or physics state.
 * Insert inside grading: destination targets remain linear; only canvas output is tone mapped. */
export function createSpatialAntialias(T,{renderer,quality='balanced',phone=false,passCount=2,hdrSupported=supportsScreenSpaceHDR(renderer)}={}) {
 const permittedHDR=hdrSupported;
 let disposed=false,rendering=false,target=null,frames=0,budget=null;
 const size=new T.Vector2(),viewport=new T.Vector4(),physicalViewport=new T.Vector4(),scissor=new T.Vector4(),clearColor=new T.Color();
 const definition=fxaaShaderDefinitions(T),uniforms=T.UniformsUtils.clone(definition.uniforms);
 const material=new T.ShaderMaterial({...definition,uniforms,depthTest:false,depthWrite:false,blending:T.NoBlending});
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
 const scene=new T.Scene(),camera=new T.Camera(),quad=new T.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);
 const enabled=()=>!disposed&&!phone&&hdrSupported&&['balanced','high','cinematic'].includes(quality);
 function release(){target?.dispose();target=null;budget=null;uniforms.tDiffuse.value=null;}
 // Dispose owned GL handles while the context is lost, before Three replaces its caches.
 const lost=()=>{release();geometry.dispose();material.dispose();};
 const restored=()=>{hdrSupported=permittedHDR&&supportsScreenSpaceHDR(renderer);release();};renderer.domElement?.addEventListener?.('webglcontextlost',lost);renderer.domElement?.addEventListener?.('webglcontextrestored',restored);
 function ensureTarget(){
  const destination=renderer.getRenderTarget();if(destination)size.set(destination.width,destination.height);else renderer.getDrawingBufferSize(size);
  budget=resolveRenderBudget({width:size.x,height:size.y,quality,phone,passCount,samples:renderSampleLimit(quality,phone),spatialResolve:true});
  const {width,height}=budget;
  if(!target){target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false,generateMipmaps:false,samples:0});target.texture.name='ASFALTO_SPATIAL_AA_HDR';target.texture.colorSpace=T.LinearSRGBColorSpace;}
  if(target.width!==width||target.height!==height)target.setSize(width,height);
  uniforms.tDiffuse.value=target.texture;uniforms.resolution.value.set(1/width,1/height);
 }
 function transact(draw,prepare=false){
  if(typeof draw!=='function')throw new TypeError('Spatial AA requires a draw/compile callback');
  if(!enabled()||renderer.getContext().isContextLost?.()){if(!disposed)release();return draw();}
  if(rendering)throw Error('Spatial AA cannot render recursively');rendering=true;
  const oldTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0,auto=renderer.autoClear,info=renderer.info.autoReset,scissorTest=renderer.getScissorTest(),alpha=renderer.getClearAlpha();
  renderer.getViewport(viewport);renderer.getCurrentViewport?.(physicalViewport);renderer.getScissor(scissor);renderer.getClearColor(clearColor);
  try{
   ensureTarget();renderer.setRenderTarget(target);renderer.setScissorTest(false);
   if(prepare){const work=draw();renderer.setRenderTarget(oldTarget,face,mip);return Promise.all([work,compileVisiblePass(renderer,scene,camera)]);}
   if(info)renderer.info.reset();renderer.info.autoReset=false;renderer.autoClear=true;renderer.clear(true,true,true);draw();
   renderer.setRenderTarget(oldTarget,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(physicalViewport);
   renderer.autoClear=false;renderer.render(scene,camera);frames++;
  }finally{
   renderer.setRenderTarget(oldTarget,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clearColor,alpha);renderer.autoClear=auto;renderer.info.autoReset=info;if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(physicalViewport);rendering=false;
  }
 }
 return {setQuality(value){quality=value;if(!enabled())release();},prepare:compile=>transact(compile,true),render:draw=>transact(draw),diagnostics:()=>({enabled:enabled(),quality,phone,hdrSupported,algorithm:'Three r180 spatial FXAA; perceptual edge luma, linear HDR color; no temporal history',frames,targets:target?1:0,size:target?[target.width,target.height]:null,allocation:describeRenderTarget(target),budget,disposed}),dispose(){if(disposed)return;disposed=true;renderer.domElement?.removeEventListener?.('webglcontextlost',lost);renderer.domElement?.removeEventListener?.('webglcontextrestored',restored);release();geometry.dispose();material.dispose();}};
}
