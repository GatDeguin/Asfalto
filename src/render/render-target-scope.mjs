const rectangle=()=>({isVector4:true,x:0,y:0,z:0,w:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;}});
/** Callback may return a promise, but shared renderer mutations end synchronously. */
export function withRenderTarget(renderer,target,run){
 const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),viewport=renderer.getViewport?.(rectangle()),scissor=renderer.getScissor?.(rectangle()),physical=renderer.getCurrentViewport?.(rectangle()),scissorTest=renderer.getScissorTest?.();
 try{renderer.setRenderTarget(target);return run();}finally{renderer.setRenderTarget(previous,face,mip);if(viewport)renderer.setViewport(viewport);if(scissor)renderer.setScissor(scissor);if(scissorTest!==undefined)renderer.setScissorTest(scissorTest);if(physical)renderer.state?.viewport(physical);}
}
