// One nearby water plane captures the actual bank/terrain. It supplements the
// physical HDR environment; out-of-capture pixels keep that continuous fallback.
const TIERS={low:[256,144,6],balanced:[384,216,10],high:[640,360,15]};
export function reflectedWaterPose(T,camera,height){
 const position=new T.Vector3(),direction=new T.Vector3(),up=new T.Vector3(0,1,0);camera.getWorldPosition(position);camera.getWorldDirection(direction);up.applyQuaternion(camera.getWorldQuaternion(new T.Quaternion()));
 position.y=2*height-position.y;direction.y*=-1;up.y*=-1;
 return {position:position.toArray(),target:position.clone().add(direction).toArray(),up:up.toArray()};
}
export function createWaterSceneReflection(T){
 let entries=[],target=null,disposed=false,lastMs=-Infinity,frames=0,activeHeight=null,currentTier=null,rendering=false,errors=0;
 const virtualCamera=new T.PerspectiveCamera();virtualCamera.userData.asfaltoWaterReflection=true;
 const matrix=new T.Matrix4(),bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),bounds=new T.Box3(),position=new T.Vector3(),frustum=new T.Frustum(),vp=new T.Matrix4(),plane=new T.Plane(new T.Vector3(0,1,0),0);
 const previousViewport=new T.Vector4(),previousScissor=new T.Vector4(),previousColor=new T.Color();
 function reset(){for(const e of entries)e.uniforms.uAnWaterReflectReady.value=0;lastMs=-Infinity;activeHeight=null;}
 function bind(next=[]){reset();entries=next.map(e=>{bounds.setFromObject(e.mesh);return {...e,bounds:bounds.clone(),height:(bounds.min.y+bounds.max.y)*.5};});reset();}
 function capture({renderer,scene,camera,quality='balanced',nowMs=0,excludeRoots=[],prepareRender}={}){
  if(disposed||rendering||!entries.length||!renderer||!scene||!camera)return false;
  camera.getWorldPosition(position);vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(vp);
  let chosen=null,best=Infinity;for(const e of entries){if(position.y<=e.height+.08||!frustum.intersectsBox(e.bounds))continue;const d=e.bounds.distanceToPoint(position);if(d<best&&d<1200){best=d;chosen=e;}}
  if(!chosen){for(const e of entries)e.uniforms.uAnWaterReflectReady.value=0;return false;}
  const tier=TIERS[quality]?quality:'balanced',[width,height,hz]=TIERS[tier];
  if(!target){target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,depthBuffer:true,stencilBuffer:false,samples:0});target.texture.name='V7_Water_Real_Bank_Reflection';target.texture.colorSpace=T.LinearSRGBColorSpace;target.texture.generateMipmaps=false;}
  if(currentTier!==tier){target.setSize(width,height);currentTier=tier;lastMs=-Infinity;}
  const levelChanged=activeHeight===null||Math.abs(activeHeight-chosen.height)>.08;
  if(!levelChanged&&nowMs>=lastMs&&nowMs-lastMs<1000/hz){for(const e of entries)e.uniforms.uAnWaterReflectReady.value=Math.abs(e.height-activeHeight)<.08?1:0;return false;}
  const pose=reflectedWaterPose(T,camera,chosen.height);virtualCamera.position.fromArray(pose.position);virtualCamera.up.fromArray(pose.up);virtualCamera.lookAt(...pose.target);virtualCamera.near=camera.near;virtualCamera.far=camera.far;virtualCamera.projectionMatrix.copy(camera.projectionMatrix);virtualCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);virtualCamera.layers.mask=camera.layers.mask;virtualCamera.updateMatrixWorld(true);
  matrix.copy(bias).multiply(virtualCamera.projectionMatrix).multiply(virtualCamera.matrixWorldInverse);plane.constant=-chosen.height+.035;
  const hidden=new Map();for(const e of entries)hidden.set(e.mesh,e.mesh.visible);for(const o of excludeRoots.filter(Boolean))hidden.set(o,o.visible);
  const prior={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace?.()||0,mipmap:renderer.getActiveMipmapLevel?.()||0,autoClear:renderer.autoClear,scissor:renderer.getScissorTest(),alpha:renderer.getClearAlpha(),toneMapping:renderer.toneMapping,clippingPlanes:renderer.clippingPlanes,shadowAuto:renderer.shadowMap?.autoUpdate,shadowNeeds:renderer.shadowMap?.needsUpdate,xr:renderer.xr?.enabled};renderer.getViewport(previousViewport);renderer.getScissor(previousScissor);renderer.getClearColor(previousColor);let restoreFog;
  rendering=true;try{
   for(const o of hidden.keys())o.visible=false;
   if(renderer.shadowMap){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;}if(renderer.xr)renderer.xr.enabled=false;
   restoreFog=prepareRender?.({linearOutput:true});renderer.toneMapping=T.NoToneMapping;renderer.clippingPlanes=[plane];renderer.autoClear=false;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear(true,true,true);renderer.render(scene,virtualCamera);
   activeHeight=chosen.height;lastMs=nowMs;frames++;
   for(const e of entries){e.uniforms.uAnWaterReflection.value=target.texture;e.uniforms.uAnWaterReflectMatrix.value.copy(matrix);e.uniforms.uAnWaterReflectReady.value=Math.abs(e.height-activeHeight)<.08?1:0;}return true;
  }catch(error){errors++;reset();throw error;}finally{
   restoreFog?.();for(const [o,visible]of hidden)o.visible=visible;renderer.toneMapping=prior.toneMapping;renderer.clippingPlanes=prior.clippingPlanes;renderer.autoClear=prior.autoClear;if(renderer.shadowMap){renderer.shadowMap.autoUpdate=prior.shadowAuto;renderer.shadowMap.needsUpdate=prior.shadowNeeds;}if(renderer.xr)renderer.xr.enabled=prior.xr;
   renderer.setRenderTarget(prior.target,prior.face,prior.mipmap);renderer.setViewport(previousViewport);renderer.setScissor(previousScissor);renderer.setScissorTest(prior.scissor);renderer.setClearColor(previousColor,prior.alpha);rendering=false;
  }
 }
 return {bind,capture,reset,diagnostics:()=>({model:'nearest-real-bank-planar-with-HDR-fallback',frames,errors,activeHeightM:activeHeight,quality:currentTier,ownedTargets:target?1:0,textureSize:target?[target.width,target.height]:null,waterMeshes:entries.length,disposed}),dispose(){if(disposed)return;reset();entries=[];target?.dispose();target=null;disposed=true;}};
}
