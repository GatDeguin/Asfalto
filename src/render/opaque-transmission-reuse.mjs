// Reuse Three's opaque refraction prepass only inside a full-size linear HDR
// world capture. Transparent/back-face refraction remains on Three's own path.
export function createOpaqueTransmissionReuse(T,{renderer,enabled=true}={}) {
 let disposed=false,active=false,snapshot=null,quadScene=null,quadCamera=null,quad=null;
 const attached=new Map(),viewport=new T.Vector4();
 const stats={captures:0,reused:0,skippedDraws:0};
 function init(width,height){
  if(!snapshot){
   snapshot=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,depthBuffer:true,stencilBuffer:false});
   snapshot.texture.colorSpace=T.LinearSRGBColorSpace;snapshot.texture.name='ASFALTO_OPAQUE_REFRACTION_SNAPSHOT';
   snapshot.depthTexture=new T.DepthTexture(width,height,T.UnsignedIntType);
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
   quad=new T.Mesh(geometry,new T.ShaderMaterial({name:'ASFALTO_OPAQUE_COLOR_DEPTH_COPY',uniforms:{colorMap:{value:null},depthMap:{value:null}},vertexShader:'varying vec2 uvCopy;void main(){uvCopy=position.xy*.5+.5;gl_Position=vec4(position,1.);}',fragmentShader:'uniform sampler2D colorMap;uniform sampler2D depthMap;varying vec2 uvCopy;void main(){gl_FragColor=texture2D(colorMap,uvCopy);gl_FragDepth=texture2D(depthMap,uvCopy).r;}',depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth,blending:T.NoBlending,toneMapped:false}));
   quad.frustumCulled=false;quadScene=new T.Scene();quadScene.add(quad);quadCamera=new T.Camera();
  }else snapshot.setSize(width,height);
 }
 function render(draw,scene,camera){
  const destination=renderer.getRenderTarget();
  if(T.REVISION!=='180'||!enabled||disposed||active||!destination||destination.isWebGLCubeRenderTarget||destination.isWebGL3DRenderTarget||destination.isWebGLArrayRenderTarget||destination.texture.type!==T.HalfFloatType||destination.texture.colorSpace!==T.LinearSRGBColorSpace||renderer.transmissionResolutionScale!==1||renderer.xr?.enabled||camera?.isArrayCamera||camera?.viewport||renderer.getScissorTest()||scene?.overrideMaterial||renderer.localClippingEnabled||renderer.clippingPlanes?.length||destination.stencilBuffer||!destination.depthBuffer||destination.textures?.length>1||((renderer.getClearAlpha?.()??1)<1&&!scene?.background))return draw();
  renderer.getViewport(viewport);
  // Renderer.getViewport reports the global viewport, not a render target's.
  if(destination.viewport.x!==0||destination.viewport.y!==0||destination.viewport.z!==destination.width||destination.viewport.w!==destination.height)return draw();
  const originalDraw=renderer.renderBufferDirect,originalTarget=renderer.setRenderTarget;
  let source=null,saved=false,copied=false,copying=false;
  function copy(from,to){
   init(destination.width,destination.height);
   const priorTarget=renderer.getRenderTarget(),auto=renderer.autoClear,clip=renderer.clippingPlanes,shadowAuto=renderer.shadowMap?.autoUpdate,shadowNeeds=renderer.shadowMap?.needsUpdate,infoAutoReset=renderer.info?.autoReset;
   copying=true;
   try{
    quad.material.uniforms.colorMap.value=from.texture;quad.material.uniforms.depthMap.value=from.depthTexture;
    renderer.autoClear=false;renderer.clippingPlanes=[];if(renderer.info)renderer.info.autoReset=false;
    if(renderer.shadowMap){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;}
    originalTarget.call(renderer,to);renderer.render(quadScene,quadCamera);
   }finally{
    originalTarget.call(renderer,priorTarget);renderer.autoClear=auto;renderer.clippingPlanes=clip;if(renderer.info)renderer.info.autoReset=infoAutoReset;
    if(renderer.shadowMap){renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowNeeds;}
    copying=false;
   }
  }
  function capture(){init(destination.width,destination.height);copy(source,snapshot);saved=true;stats.captures++;}
  renderer.setRenderTarget=function(target,...args){
   if(!copying&&!source&&target&&target!==destination&&target.texture?.generateMipmaps&&target.texture.type===T.HalfFloatType&&target.texture.colorSpace===T.LinearSRGBColorSpace&&target.samples===4&&target.width===destination.width&&target.height===destination.height){
    source=target;
    if(!attached.has(target)){
     attached.set(target,{depthTexture:target.depthTexture,resolveDepthBuffer:target.resolveDepthBuffer});
     target.dispose();target.depthTexture=new T.DepthTexture(target.width,target.height,T.UnsignedIntType);target.resolveDepthBuffer=true;
    }
   }
   return originalTarget.call(this,target,...args);
  };
  renderer.renderBufferDirect=function(c,s,g,m,o,group){
   if(!copying&&c===camera&&s===scene&&source){
    const target=renderer.getRenderTarget();
    // Three resolves opaque color/depth before drawing transmissive back faces.
    // Save here, before those faces contaminate the opaque background.
    if(target===source&&m.transmission>0&&!saved)capture();
    if(target===destination&&!m.transparent&&!(m.transmission>0)){
     if(!copied){if(!saved)capture();copy(snapshot,destination);copied=true;stats.reused++;}
     stats.skippedDraws++;return;
    }
   }
   return originalDraw.call(this,c,s,g,m,o,group);
  };
  active=true;
  try{return draw();}finally{renderer.renderBufferDirect=originalDraw;renderer.setRenderTarget=originalTarget;active=false;}
 }
 return {render,diagnostics:()=>({...stats,ownedTargets:snapshot?1:0,attachedDepthTargets:attached.size}),dispose(){
  if(disposed)return;disposed=true;snapshot?.dispose();quad?.geometry.dispose();quad?.material.dispose();snapshot=null;
  for(const [target,prior]of attached){target.dispose();target.depthTexture=prior.depthTexture;target.resolveDepthBuffer=prior.resolveDepthBuffer;}attached.clear();
 }};
}
