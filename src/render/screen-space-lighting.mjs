import {createScreenSpaceTarget,supportsScreenSpaceHDR} from './screen-space-targets.mjs?v=6da4d0d78fe83c9e';
import {vertexShader,depthGLSL,bounceGLSL,metadataGLSL,metadataMain,bilateralGLSL,compositeMain,volumeMain,historyMain} from './screen-space-lighting.glsl.mjs?v=4f83a6d6ad3191fe';
import {compileVisiblePass} from './pass-preparation.mjs?v=258173b4dba723d7';
import {resolveRenderBudget,describeRenderTarget,renderSampleLimit} from './render-budget.mjs?v=19c7400d32eaa34a';
import {supportedHdrSamples} from './render-target-capabilities.mjs?v=f3103d3a8267e6f2';
import {gtaoShaderDefinitions} from './vendor/gtao-shader-factory.mjs?v=b7634bbada9ccfa0';
const policies=Object.freeze({
 cinematic:Object.freeze({enabled:true,maxWidth:960,maxPixels:518400,scale:.5,aoSamples:32,giRays:6,giSteps:12,dfao:true,volume:true}),
 high:Object.freeze({enabled:true,maxWidth:768,maxPixels:589824,scale:.5,aoSamples:24,giRays:6,giSteps:12,dfao:true,volume:true}),
 balanced:Object.freeze({enabled:true,maxWidth:576,maxPixels:331776,scale:.5,aoSamples:12,giRays:3,giSteps:8,dfao:true,volume:true}),
 low:Object.freeze({enabled:true,maxWidth:384,maxPixels:147456,scale:.4,aoSamples:6,giRays:0,giSteps:0,dfao:false,volume:false}),
 off:Object.freeze({enabled:false,maxWidth:1,scale:1,aoSamples:0,giRays:0,giSteps:0,dfao:false,volume:false})
});
export const screenLightingPolicy=tier=>policies[tier]||policies.balanced;
export function depthToViewDistance(depth,near,far,logarithmic=false){return logarithmic?Math.expm1(Math.log1p(far)*depth):near*far/(far-depth*(far-near));}
const gtaoAdapter="uniform bool anGtaoLogDepth;\nfloat anGtaoDecode(float d){if(!anGtaoLogDepth||d>=1.)return d;float z=max(cameraNear,exp2(d*log2(cameraFar+1.))-1.);return cameraFar/(cameraFar-cameraNear)-cameraFar*cameraNear/((cameraFar-cameraNear)*z);}\nvec3 getViewPosition(";

export function createScreenSpaceLighting(T,{renderer,scene,camera,atmosphere=null,distanceField=null,quality='balanced',samples=2,phone=false,framePassCount=2,spatialResolve=false,onStage=null}={}){
 let disposed=false,rendering=false,frames=0,targets=null,historyValid=false,historyIndex=0,policy=screenLightingPolicy(quality),lastError=null,features={gtao:true,ssgi:true,dfao:true,volumetrics:true};
 const hdrSupported=supportsScreenSpaceHDR(renderer);
 const previousWorld=new T.Matrix4(),previousView=new T.Matrix4(),previousProjection=new T.Matrix4();
 let previousNear=camera.near,previousFar=camera.far;
 const atmosphereState=new Float64Array(12);
 const size=new T.Vector2(),currentViewport=new T.Vector4(),viewport=new T.Vector4(),scissor=new T.Vector4(),clearColor=new T.Color();
 const definitions=gtaoShaderDefinitions(T),noise=definitions.generateMagicSquareNoise(5);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
 const uniforms={anMetadata:{value:null},anPreviousMetadata:{value:null},anFog:{value:null},anFogRaw:{value:null},anFogHistory:{value:null},anUseVolume:{value:false},anHistoryValid:{value:false},anPreviousView:{value:previousView},anPreviousProjection:{value:previousProjection},anSceneDepth:{value:null},anSceneColor:{value:null},anGtao:{value:null},anLighting:{value:null},anResolution:{value:new T.Vector2()},anLightingResolution:{value:new T.Vector2()},anProjection:{value:camera.projectionMatrix},anProjectionInverse:{value:camera.projectionMatrixInverse},anCameraWorld:{value:camera.matrixWorld},anNear:{value:camera.near},anFar:{value:camera.far},anLogDepth:{value:!!renderer.capabilities.logarithmicDepthBuffer},anGiRays:{value:policy.giRays},anGiSteps:{value:policy.giSteps},anAoStrength:{value:.38},anGiStrength:{value:.28},anUseDfa:{value:0},...(atmosphere?.uniforms||{}),...(distanceField?.uniforms||{})};
 const gtaoUniforms=T.UniformsUtils.clone(definitions.GTAOShader.uniforms);gtaoUniforms.tNoise.value=noise;gtaoUniforms.radius.value=1.2;gtaoUniforms.thickness.value=.7;gtaoUniforms.distanceFallOff.value=1;gtaoUniforms.anGtaoLogDepth={value:!!renderer.capabilities.logarithmicDepthBuffer};
 let gtaoFragment=definitions.GTAOShader.fragmentShader;
 gtaoFragment=gtaoFragment.replace('vec3 getViewPosition(',gtaoAdapter)
 .replace('return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;','return anGtaoDecode(textureLod(tDepth, clamp(uv.xy,vec2(0.),vec2(1.)), 0.0).DEPTH_SWIZZLING);')
 .replace('return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;','return anGtaoDecode(texelFetch(tDepth, clamp(uv.xy,ivec2(0),textureSize(tDepth,0)-ivec2(1)), 0).DEPTH_SWIZZLING);')
 .replace('vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);','cosHorizons=clamp(cosHorizons,vec2(-1.),vec2(1.));vec2 sinHorizons = sqrt(max(vec2(0.),1. - cosHorizons * cosHorizons));');
 const gtao=new T.ShaderMaterial({name:'ASFALTO_GTAO',uniforms:gtaoUniforms,defines:{...definitions.GTAOShader.defines,SAMPLES:policy.aoSamples||6,NORMAL_VECTOR_TYPE:0},vertexShader,fragmentShader:gtaoFragment,depthTest:false,depthWrite:false,blending:T.NoBlending});
 const bounce=new T.ShaderMaterial({name:'ASFALTO_SSGI_DFAO',uniforms,vertexShader,fragmentShader:'varying vec2 vUv;\n'+depthGLSL+'\n'+(distanceField?.glsl||'float anDistanceFieldAO(vec3 p,vec3 n){return 1.;}')+'\n'+bounceGLSL,depthTest:false,depthWrite:false,blending:T.NoBlending});
 const atmosphereGLSL=atmosphere?.glsl||'vec4 anIntegrateAtmosphere(vec3 p,vec2 uv){return vec4(0.);} vec3 anCompositeAtmosphere(vec3 c,vec3 p,vec4 f){return c;} vec3 anApplyAtmosphere(vec3 c,vec3 p,vec2 uv){return c;}';
 const baseGLSL='varying vec2 vUv;\n'+depthGLSL+'\n'+metadataGLSL;
 const postMaterial=(name,fragment)=>new T.ShaderMaterial({name,uniforms,vertexShader,fragmentShader:baseGLSL+'\n'+fragment,depthTest:false,depthWrite:false,blending:T.NoBlending});
 const metadata=postMaterial('ASFALTO_SURFACE_METADATA',metadataMain);
 const volume=postMaterial('ASFALTO_FOG_EIGHT_STRATA',atmosphereGLSL+'\n'+volumeMain);
 const history=postMaterial('ASFALTO_FOG_REPROJECT',historyMain);
 const composite=postMaterial('ASFALTO_INDIRECT_COMPOSITE',atmosphereGLSL+'\n'+bilateralGLSL+'\n'+compositeMain);
 composite.depthTest=true;composite.depthWrite=true;composite.depthFunc=T.AlwaysDepth;
 const quad=new T.Mesh(geometry,gtao);quad.frustumCulled=false;const passScene=new T.Scene();passScene.add(quad);const passCamera=new T.Camera();
 // Preserve the fog program topology across quality tiers. Volumetrics already
 // integrate extinction, so neutralize legacy fog numerically during the capture
 // rather than removing it and compiling the entire world again on a downgrade.
 function suppressLegacyFog(){
  const fog=scene.fog;if(!volumeEnabled()||!fog)return ()=>{};
  if(fog.isFogExp2){const density=fog.density;fog.density=0;return ()=>{fog.density=density;};}
  if(fog.isFog){const near=fog.near,far=fog.far;fog.near=Math.max(1,camera.far);fog.far=fog.near*2;return ()=>{fog.near=near;fog.far=far;};}
  return ()=>{};
 }
 function volumeEnabled(){return !!(atmosphere&&features.volumetrics&&policy.volume&&atmosphere.uniforms?.anAtmoEnabled?.value!==0);}
 function hasIndirect(){return !!(features.gtao&&policy.aoSamples>0||features.ssgi&&policy.giRays>0||distanceField&&features.dfao&&policy.dfao);}
 function hasEffects(){return hdrSupported&&(hasIndirect()||volumeEnabled());}
 function releaseTargets(){historyValid=false;if(!targets)return;for(const t of Object.values(targets))t.dispose();targets=null;allocationBudget=null;}
 function requestedCaptureSamples(){return Math.min(renderSampleLimit(quality,phone),samples===0?0:policy===screenLightingPolicy('cinematic')?Math.max(4,samples):samples);}
 function captureSamples(){return supportedHdrSamples(renderer,requestedCaptureSamples());}
 let targetSamples=captureSamples();
 const contextRestored=()=>{releaseTargets();releasePreparationTargets();targetSamples=captureSamples();};
 renderer.domElement?.addEventListener?.('webglcontextrestored',contextRestored);
 let preparationTargets=null;
 function releasePreparationTargets(){
  if(preparationTargets)for(const target of Object.values(preparationTargets))target.dispose();
  preparationTargets=null;
 }
 function makeTarget(width,height,name,{color=false,ao=false}={}){
  return createScreenSpaceTarget(T,width,height,name,{color,ao,samples:targetSamples});
 }
 function ensurePreparationTargets(){
  if(!preparationTargets)preparationTargets={
   color:makeTarget(1,1,'ASFALTO_INDIRECT_SOURCE',{color:true}),
   ao:makeTarget(1,1,'ASFALTO_GTAO_R8',{ao:true}),
   lighting:makeTarget(1,1,'ASFALTO_GI_RGB_AO_A'),metadata:makeTarget(1,1,'ASFALTO_METADATA'),
   volume:makeTarget(1,1,'ASFALTO_FOG_RAW'),history:makeTarget(1,1,'ASFALTO_FOG_HISTORY')
  };
  return preparationTargets;
 }
 let allocationBudget=null;
 function ensureTargets(){
  const destination=renderer.getRenderTarget();
  if(destination)size.set(destination.width,destination.height);else renderer.getDrawingBufferSize(size);
  allocationBudget=resolveRenderBudget({width:size.x,height:size.y,quality,phone,passCount:framePassCount,samples:targetSamples,spatialResolve});
  const width=allocationBudget.width,height=allocationBudget.height;
  const scale=Math.min(.5,policy.scale,policy.maxWidth/width,Math.sqrt((policy.maxPixels??Infinity)/(width*height)));
  const ew=Math.max(1,Math.floor(width*scale)),eh=Math.max(1,Math.floor(height*scale));
  if(!targets){
   targets={color:makeTarget(width,height,'ASFALTO_INDIRECT_SOURCE',{color:true}),ao:makeTarget(ew,eh,'ASFALTO_GTAO_R8',{ao:true}),lighting:makeTarget(ew,eh,'ASFALTO_GI_RGB_AO_A'),
    metadata0:makeTarget(ew,eh,'ASFALTO_METADATA_0'),metadata1:makeTarget(ew,eh,'ASFALTO_METADATA_1')};
   historyValid=false;
  }
  if(volumeEnabled()&&!targets.fogRaw){
   targets.fogRaw=makeTarget(ew,eh,'ASFALTO_FOG_RAW');
   targets.fog0=makeTarget(ew,eh,'ASFALTO_FOG_HISTORY_0');targets.fog1=makeTarget(ew,eh,'ASFALTO_FOG_HISTORY_1');historyValid=false;
  }else if(!volumeEnabled()&&targets.fogRaw){
   for(const key of ['fogRaw','fog0','fog1']){targets[key].dispose();delete targets[key];}historyValid=false;
  }
  if(targets.color.samples!==targetSamples){targets.color.dispose();targets.color.samples=targetSamples;historyValid=false;}
  for(const [key,target]of Object.entries(targets)){
   const w=key==='color'?width:ew,h=key==='color'?height:eh;
   if(target.width!==w||target.height!==h){target.setSize(w,h);historyValid=false;}
  }
  uniforms.anSceneDepth.value=targets.color.depthTexture;uniforms.anSceneColor.value=targets.color.texture;
  uniforms.anGtao.value=targets.ao.texture;uniforms.anLighting.value=targets.lighting.texture;
  uniforms.anMetadata.value=targets['metadata'+historyIndex].texture;
  uniforms.anPreviousMetadata.value=targets['metadata'+(1-historyIndex)].texture;
  uniforms.anFogRaw.value=targets.fogRaw?.texture||null;
  uniforms.anFogHistory.value=targets['fog'+(1-historyIndex)]?.texture||null;
  uniforms.anFog.value=targets['fog'+historyIndex]?.texture||null;
  uniforms.anUseVolume.value=volumeEnabled();
  uniforms.anResolution.value.set(width,height);uniforms.anLightingResolution.value.set(ew,eh);
  gtaoUniforms.tDepth.value=targets.color.depthTexture;gtaoUniforms.resolution.value.set(ew,eh);
 }
 function updateHistoryValidity(){
  const current=camera.matrixWorld.elements,prior=previousWorld.elements,projection=camera.projectionMatrix.elements;
  const dx=current[12]-prior[12],dy=current[13]-prior[13],dz=current[14]-prior[14];
  if(dx*dx+dy*dy+dz*dz>25||current[8]*prior[8]+current[9]*prior[9]+current[10]*prior[10]<.5||camera.near!==previousNear||camera.far!==previousFar)historyValid=false;
  for(let i=0;i<16;i++)if(Math.abs(projection[i]-previousProjection.elements[i])>1e-5)historyValid=false;
  const u=atmosphere?.uniforms;
  if(u){
   // Avoid preserving history across a weather preset or lighting cut. Slow
   // drift is handled by the current neighborhood clamp in the history shader.
   const scalars=['anAtmoDensity','anAtmoFalloff','anAtmoSunIntensity','anAtmoBaseHeight','anAtmoMieG','anAtmoMaxDistance'];
   for(let i=0;i<scalars.length;i++){const value=u[scalars[i]]?.value||0;if(Math.abs(value-atmosphereState[i])>Math.max(.00001,Math.abs(value)*.08))historyValid=false;atmosphereState[i]=value;}
   const sun=u.anAtmoSunDirection?.value,color=u.anAtmoSunColor?.value;
   for(let i=0;i<3;i++){const direction=sun?.getComponent(i)||0,channel=color?(i===0?color.r:i===1?color.g:color.b):0;if(Math.abs(direction-atmosphereState[6+i])>.08||Math.abs(channel-atmosphereState[9+i])>.08)historyValid=false;atmosphereState[6+i]=direction;atmosphereState[9+i]=channel;}
  }
  uniforms.anHistoryValid.value=historyValid;
 }
 return{
  setFeatures(value){historyValid=false;features={...features,...value};uniforms.anAoStrength.value=features.gtao?.38:0;uniforms.anGiStrength.value=features.ssgi?.28:0;uniforms.anGiRays.value=features.ssgi?policy.giRays:0;if(!hasEffects())releaseTargets();},
  setQuality(tier){historyValid=false;quality=tier;const next=screenLightingPolicy(tier);if(next===policy)return;policy=next;const nextSamples=captureSamples();if(nextSamples!==targetSamples){targetSamples=nextSamples;}uniforms.anGiRays.value=features.ssgi?policy.giRays:0;uniforms.anGiSteps.value=policy.giSteps;if(gtao.defines.SAMPLES!==(policy.aoSamples||6)){gtao.defines.SAMPLES=policy.aoSamples||6;gtao.needsUpdate=true;}if(!policy.enabled||!hasEffects())releaseTargets();},
  prepare(compile){
   if(typeof compile!=='function')throw new TypeError('Screen lighting compile callback is required');
   if(disposed||!policy.enabled||!hasEffects()||renderer.getContext().isContextLost())return compile();
   if(rendering)throw Error('Screen lighting cannot prepare recursively');rendering=true;
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace?.()||0,oldMip=renderer.getActiveMipmapLevel?.()||0,oldAutoClear=renderer.autoClear,oldScissor=renderer.getScissorTest(),oldFog=scene.fog,oldMaterial=quad.material;
   const savedViewport=new T.Vector4(),savedScissor=new T.Vector4();renderer.getViewport(savedViewport);renderer.getScissor(savedScissor);
   const restoreFog=suppressLegacyFog();
   try{
    const prepared=ensurePreparationTargets();renderer.setRenderTarget(prepared.color);renderer.setScissorTest(false);renderer.autoClear=true;
    const work=[compile()];restoreFog();
    const stage=(material,target)=>{quad.material=material;renderer.setRenderTarget(target);work.push(compileVisiblePass(renderer,passScene,passCamera));};
    stage(metadata,prepared.metadata);
    if(features.gtao&&policy.aoSamples>0)stage(gtao,prepared.ao);
    if(hasIndirect())stage(bounce,prepared.lighting);
    if(volumeEnabled()){stage(volume,prepared.volume);stage(history,prepared.history);}
    stage(composite,oldTarget);
    return Promise.all(work);
   }finally{
    quad.material=oldMaterial;restoreFog();scene.fog=oldFog;renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(savedViewport);renderer.setScissor(savedScissor);renderer.setScissorTest(oldScissor);renderer.autoClear=oldAutoClear;rendering=false;
   }
  },
  render(draw){
   if(disposed||!policy.enabled||!hasEffects()||renderer.getContext().isContextLost()){if(!disposed&&(!policy.enabled||!hasEffects()))releaseTargets();draw();return;}
   if(rendering)throw Error('Screen lighting cannot render recursively');rendering=true;
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace?.()||0,oldMip=renderer.getActiveMipmapLevel?.()||0,oldAutoClear=renderer.autoClear,oldInfo=renderer.info.autoReset,oldScissor=renderer.getScissorTest(),oldAlpha=renderer.getClearAlpha();
   renderer.getViewport(viewport);renderer.getCurrentViewport?.(currentViewport);renderer.getScissor(scissor);renderer.getClearColor(clearColor);const oldFog=scene.fog;
   const restoreFog=suppressLegacyFog();
   try{
    onStage?.('Primer cuadro: buffers de iluminación');ensureTargets();camera.updateMatrixWorld();atmosphere?.beginFrame?.(frames);updateHistoryValidity();uniforms.anNear.value=camera.near;uniforms.anFar.value=camera.far;
    gtaoUniforms.cameraNear.value=camera.near;gtaoUniforms.cameraFar.value=camera.far;gtaoUniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);gtaoUniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);gtaoUniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
    uniforms.anUseDfa.value=distanceField&&features.dfao&&policy.dfao?1:0;
    renderer.setRenderTarget(targets.color);renderer.setScissorTest(false);renderer.autoClear=true;
    onStage?.('Primer cuadro: captura del mundo');draw();restoreFog();scene.fog=oldFog;renderer.info.autoReset=false;renderer.autoClear=false;
    renderer.setRenderTarget(targets['metadata'+historyIndex]);quad.material=metadata;renderer.render(passScene,passCamera);
    onStage?.('Primer cuadro: oclusión GTAO');renderer.setRenderTarget(targets.ao);renderer.setClearColor(0xffffff,1);renderer.clear(true,false,false);if(features.gtao&&policy.aoSamples>0){quad.material=gtao;renderer.render(passScene,passCamera);}
    onStage?.('Primer cuadro: iluminación indirecta');renderer.setRenderTarget(targets.lighting);renderer.setClearColor(0x000000,1);renderer.clear(true,false,false);if(hasIndirect()){quad.material=bounce;renderer.render(passScene,passCamera);}
    if(volumeEnabled()){
     renderer.setRenderTarget(targets.fogRaw);quad.material=volume;renderer.render(passScene,passCamera);
     renderer.setRenderTarget(targets['fog'+historyIndex]);quad.material=history;renderer.render(passScene,passCamera);
    }
    onStage?.('Primer cuadro: composición del mundo');renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(oldScissor);if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(currentViewport);renderer.autoClear=false;quad.material=composite;renderer.render(passScene,passCamera);frames++;
    previousWorld.copy(camera.matrixWorld);previousView.copy(camera.matrixWorldInverse);previousProjection.copy(camera.projectionMatrix);previousNear=camera.near;previousFar=camera.far;historyValid=volumeEnabled();historyIndex=1-historyIndex;
   }catch(error){historyValid=false;lastError=error.message;throw error;}
   finally{restoreFog();scene.fog=oldFog;renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(oldScissor);renderer.setClearColor(clearColor,oldAlpha);renderer.autoClear=oldAutoClear;renderer.info.autoReset=oldInfo;if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(currentViewport);rendering=false;}
  },
  diagnostics:()=>({enabled:policy.enabled,policy,frames,requestedSamples:requestedCaptureSamples(),supportedSamples:targetSamples,allocationBudget,allocations:targets?Object.values(targets).map(describeRenderTarget):[],hdrSupported,spatialOnly:!volumeEnabled(),fogHistoryValid:historyValid,targets:targets?Object.keys(targets).length:0,samples:targets?.color.samples??null,size:targets?[targets.color.width,targets.color.height]:null,effectSize:targets?[targets.ao.width,targets.ao.height]:null,techniques:{gtao:'Three r180 horizon integration',ssgi:'half-resolution RGB GI + A AO, symmetric plane/depth/normal bilateral',fog:'8 blue-noise strata with reprojected clamped history',dfao:!!distanceField,volumetric:!!atmosphere},lastError,disposed}),
  dispose(){if(disposed)return;disposed=true;renderer.domElement?.removeEventListener?.('webglcontextrestored',contextRestored);releaseTargets();if(preparationTargets)for(const target of Object.values(preparationTargets))target.dispose();preparationTargets=null;noise.dispose();geometry.dispose();gtao.dispose();bounce.dispose();metadata.dispose();volume.dispose();history.dispose();composite.dispose();}
 };
}
