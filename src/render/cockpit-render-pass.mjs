// Camera-space interior has its own depth, while windows retain the rendered world.
// Layer 30 is temporary. No renderer resources, simulation or camera calibration change.
const INTERIOR_MASK=1<<30;
const rectangle=()=>({isVector4:true,x:0,y:0,z:0,w:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;}});
export function createCockpitRenderPass({renderer,scene,camera,cockpit,overlays=[],onStage=null,renderWorld=()=>renderer.render(scene,camera)}){
 const masks=[],visibility=[],viewport=rectangle(),scissor=rectangle(),currentViewport=rectangle();
 const isolate=node=>{masks.push(node,node.layers.mask);node.layers.mask=INTERIOR_MASK;};
 const includeLight=node=>{if(node.isLight&&!node.userData.excludeFromCameraInterior&&node.layers.test(camera.layers))isolate(node);};
 return{render(){
  const wasVisible=cockpit.visible,cameraMask=camera.layers.mask,background=scene.background;
  const autoClear=renderer.autoClear,infoAutoReset=renderer.info?.autoReset,shadowAutoUpdate=renderer.shadowMap?.autoUpdate;
  let shadowNeedsUpdate=renderer.shadowMap?.needsUpdate;
  const target=renderer.getRenderTarget?.(),face=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0,scissorTest=renderer.getScissorTest?.();
  renderer.getViewport?.(viewport);renderer.getScissor?.(scissor);renderer.getCurrentViewport?.(currentViewport);
  masks.length=0;visibility.length=0;
  try{
   if(!wasVisible){renderWorld();return;}
   cockpit.visible=false;
   for(const overlay of overlays){visibility.push(overlay,overlay.visible);overlay.visible=false;}
   onStage?.('Primer cuadro: mundo');renderWorld();shadowNeedsUpdate=renderer.shadowMap?.needsUpdate;
   cockpit.visible=true;for(let i=0;i<visibility.length;i+=2)visibility[i].visible=visibility[i+1];
   scene.traverse(includeLight);cockpit.traverse(isolate);for(const overlay of overlays)overlay.traverse(isolate);
   camera.layers.mask=INTERIOR_MASK;scene.background=null;renderer.autoClear=false;
   if(renderer.info)renderer.info.autoReset=false;
   if(renderer.shadowMap){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;}
   onStage?.('Primer cuadro: interior del cockpit');renderer.clearDepth();renderer.render(scene,camera);
  }finally{
   for(let i=masks.length-2;i>=0;i-=2)masks[i].layers.mask=masks[i+1];
   for(let i=0;i<visibility.length;i+=2)visibility[i].visible=visibility[i+1];
   cockpit.visible=wasVisible;camera.layers.mask=cameraMask;scene.background=background;
   renderer.autoClear=autoClear;if(renderer.info)renderer.info.autoReset=infoAutoReset;
   if(renderer.shadowMap){renderer.shadowMap.autoUpdate=shadowAutoUpdate;renderer.shadowMap.needsUpdate=shadowNeedsUpdate;}
   if(renderer.getRenderTarget)renderer.setRenderTarget(target,face,mip);
   if(renderer.getViewport)renderer.setViewport(viewport.x,viewport.y,viewport.z,viewport.w);
   if(renderer.getScissor)renderer.setScissor(scissor.x,scissor.y,scissor.z,scissor.w);
   if(renderer.getScissorTest)renderer.setScissorTest(scissorTest);
   if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(currentViewport);
   masks.length=0;visibility.length=0;
  }
 }};
}
