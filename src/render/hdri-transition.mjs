import {sampleSkyHorizon} from './sky-matched-fog.mjs';

/** Rotate an independently owned decoded panorama by exactly half a turn. */
export function rotateHdriHalfTurn(texture){
 const {data,width,height}=texture.image,channels=data.length/(width*height);
 if(width%2||!Number.isInteger(channels))throw new TypeError('Dawn HDRI requires an even panorama width');
 const half=width*channels/2,row=new data.constructor(half);
 for(let y=0;y<height;y++){const offset=y*width*channels;row.set(data.subarray(offset,offset+half));data.copyWithin(offset,offset+half,offset+half*2);data.set(row,offset+half);}
 texture.needsUpdate=true;return texture;
}
const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fragmentShader='uniform sampler2D sourceA;uniform sampler2D sourceB;uniform vec2 gains;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(sourceA,vUv).rgb*gains.x+texture2D(sourceB,vUv).rgb*gains.y,1.);}';
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));

/** Linear radiance blending commutes with PMREM convolution: blend the two
 * already filtered CubeUV atlases, never run PMREM in the animation callback.
 * Owns at most three source/PMREM slots and three output targets. Caller textures
 * may be borrowed at startup and are never disposed or modified.
 */
export function createHdriTransition(T,{scene,renderer,keyLight,loadSource,buildPmrem}={}){
 const records=new Map(),uniforms={sourceA:{value:null},sourceB:{value:null},gains:{value:new T.Vector2()}};
 const material=new T.ShaderMaterial({name:'Ciclo horario · mezcla HDRI lineal',uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false,blending:T.NoBlending});
 const geometry=new T.PlaneGeometry(2,2),quad=new T.Mesh(geometry,material),pass=new T.Scene(),camera=new T.Camera();quad.frustumCulled=false;pass.add(quad);
 const viewport=new T.Vector4(),scissor=new T.Vector4(),horizon=new T.Color();
 let backgroundTarget=null,equirectTarget=null,environmentTarget=null,baseline=null,generation=0,prefetchRevision=0,disposed=false,active=false,elapsed=0,lastBlend=-1,lastPair='',requestedPair='',renderCount=0,lastError=null;
 function disposeRecord(record){if(!record.owned)return;record.source?.dispose();record.target?.dispose();record.source=null;record.target=null;record.environment=null;}
 function request(knot){
  if(records.has(knot.key))return records.get(knot.key).promise;
  const token=generation,record={owned:true,source:null,target:null,environment:null,horizon:null,promise:null};records.set(knot.key,record);
  record.promise=(async()=>{
   await yieldTask();if(disposed||token!==generation||records.get(knot.key)!==record)return null;
   const source=await loadSource(knot.skyId);
   if(disposed||token!==generation||records.get(knot.key)!==record){source.dispose();return null;}
   record.source=source;if(knot.rotation)rotateHdriHalfTurn(source);record.horizon=sampleSkyHorizon(T,source);
   // Decoding and GPU filtering are scheduled ahead of the segment boundary,
   // outside update(). Each target is filtered once during its residency.
   await yieldTask();if(disposed||token!==generation||records.get(knot.key)!==record)return null;
   record.target=await buildPmrem(source);record.environment=record.target.texture;
   if(disposed||token!==generation||records.get(knot.key)!==record){disposeRecord(record);return null;}
   return record;
  })().catch(error=>{disposeRecord(record);if(records.get(knot.key)===record)records.delete(knot.key);lastError=String(error?.message||error);return null;});
  return record.promise;
 }
 async function prefetch(state){
  if(disposed)return;
  const token=generation,revision=++prefetchRevision,knots=[state.from,state.to,state.next],keep=new Set(knots.map(k=>k.key));
  for(const [key,record]of records)if(!keep.has(key)){records.delete(key);disposeRecord(record);}
  // Sequential scheduling avoids a burst of multiple PMREM builds in one turn.
  for(const knot of knots){if(disposed||token!==generation||revision!==prefetchRevision)return;await request(knot);}
 }
 function targetFor(texture,name,mapping){
  const {width,height}=texture.image,target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  target.texture.name=name;target.texture.mapping=mapping;target.texture.colorSpace=T.LinearSRGBColorSpace;return target;
 }
 function restore(){
  if(!baseline)return;
  if(scene.background===backgroundTarget?.texture){scene.background=baseline.background;scene.backgroundIntensity=baseline.backgroundIntensity;renderer.toneMappingExposure=baseline.exposure;if(keyLight){keyLight.position.copy(baseline.keyPosition);keyLight.color.copy(baseline.keyColor);keyLight.intensity=baseline.keyIntensity;keyLight.visible=baseline.keyVisible;}}
  if(scene.environment===environmentTarget?.texture){scene.environment=baseline.environment;scene.environmentIntensity=baseline.environmentIntensity;}
 }
 function release(){generation++;restore();active=false;baseline=null;for(const record of records.values())disposeRecord(record);records.clear();backgroundTarget?.dispose();equirectTarget?.dispose();environmentTarget?.dispose();backgroundTarget=null;equirectTarget=null;environmentTarget=null;lastBlend=-1;lastPair='';requestedPair='';uniforms.sourceA.value=null;uniforms.sourceB.value=null;}
 return{
  async prepare(state,options={}){
   if(disposed)return false;release();const token=generation,{source=scene.background,environment=scene.environment,skyId=state.from.skyId}=options;
   baseline={background:scene.background,environment:scene.environment,backgroundIntensity:scene.backgroundIntensity,environmentIntensity:scene.environmentIntensity,exposure:renderer.toneMappingExposure,keyPosition:keyLight?.position.clone(),keyColor:keyLight?.color.clone(),keyIntensity:keyLight?.intensity,keyVisible:keyLight?.visible};
   if(source?.isTexture&&environment?.isTexture&&skyId===state.from.skyId&&!state.from.rotation){const record={owned:false,source,environment,horizon:sampleSkyHorizon(T,source)};record.promise=Promise.resolve(record);records.set(state.from.key,record);}
   await prefetch(state);if(disposed||token!==generation)return false;active=true;return !!records.get(state.from.key)?.environment&&!!records.get(state.to.key)?.environment;
  },prefetch,release,
  update({state,dt=0,quality='high'}={}){
   if(disposed||!active||!state)return false;
   const pair=state.from.key+'|'+state.to.key;
   if(pair!==requestedPair){requestedPair=pair;void prefetch(state);}
   const a=records.get(state.from.key),b=records.get(state.to.key);if(!a?.environment||!b?.environment)return false;
   if(!backgroundTarget){backgroundTarget=targetFor(a.environment,'Asfalto_DayCycle_SkyCubeUV',T.CubeUVReflectionMapping);equirectTarget=targetFor(a.source,'Asfalto_DayCycle_HDRI',T.EquirectangularReflectionMapping);environmentTarget=targetFor(a.environment,'Asfalto_DayCycle_PMREM',T.CubeUVReflectionMapping);backgroundTarget.texture.userData.asfaltoSkyEquirect=equirectTarget.texture;backgroundTarget.texture.userData.asfaltoSkyHorizon=horizon;backgroundTarget.texture.userData.asfaltoSkyRevision=0;}
   scene.background=backgroundTarget.texture;scene.environment=environmentTarget.texture;scene.backgroundIntensity=1;scene.environmentIntensity=1;
   renderer.toneMappingExposure=state.exposure;if(keyLight){keyLight.color.setRGB(...state.color);keyLight.position.fromArray(state.direction);keyLight.intensity=state.keyLightIntensity;keyLight.visible=state.keyLightIntensity>0;}
   elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;
   if(pair===lastPair&&(state.blend===lastBlend||elapsed<(quality==='low'?.2:.1)))return true;
   const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.()??0,mip=renderer.getActiveMipmapLevel?.()??0,autoClear=renderer.autoClear,xr=renderer.xr?.enabled;
   renderer.getViewport?.(viewport);renderer.getScissor?.(scissor);const scissorTest=renderer.getScissorTest?.();
   try{
    if(renderer.xr)renderer.xr.enabled=false;renderer.autoClear=true;renderer.setScissorTest?.(false);
    uniforms.sourceA.value=a.source;uniforms.sourceB.value=b.source;uniforms.gains.value.set((1-state.blend)*state.from.lighting.backgroundIntensity,state.blend*state.to.lighting.backgroundIntensity);
    renderer.setRenderTarget(equirectTarget);renderer.render(pass,camera);
    if(a.horizon&&b.horizon)horizon.setRGB(a.horizon.r*uniforms.gains.value.x+b.horizon.r*uniforms.gains.value.y,a.horizon.g*uniforms.gains.value.x+b.horizon.g*uniforms.gains.value.y,a.horizon.b*uniforms.gains.value.x+b.horizon.b*uniforms.gains.value.y);
    backgroundTarget.texture.userData.asfaltoSkyRevision++;
    uniforms.sourceA.value=a.environment;uniforms.sourceB.value=b.environment;renderer.setRenderTarget(backgroundTarget);renderer.render(pass,camera);uniforms.gains.value.set((1-state.blend)*state.from.lighting.environmentIntensity,state.blend*state.to.lighting.environmentIntensity);
    renderer.setRenderTarget(environmentTarget);renderer.render(pass,camera);renderCount+=3;
   }finally{renderer.setViewport?.(viewport);renderer.setScissor?.(scissor);if(scissorTest!==undefined)renderer.setScissorTest?.(scissorTest);renderer.setRenderTarget(target,face,mip);renderer.autoClear=autoClear;if(renderer.xr)renderer.xr.enabled=xr;}
   lastPair=pair;lastBlend=state.blend;elapsed=0;return true;
  },
  diagnostics(){let ownedSources=0,ownedTargets=0,estimatedGpuBytes=0;for(const record of records.values())if(record.owned){if(record.source){ownedSources++;estimatedGpuBytes+=(record.source.image?.data?.byteLength||0);}if(record.target){ownedTargets++;estimatedGpuBytes+=record.target.width*record.target.height*8;}}
   for(const target of [backgroundTarget,equirectTarget,environmentTarget])if(target){ownedTargets++;estimatedGpuBytes+=target.width*target.height*8;}
   return{active,disposed,slots:records.size,ownedSources,ownedTargets,estimatedGpuBytes,blendPasses:renderCount,pair:lastPair,blend:lastBlend,error:lastError,pmremPerFrame:false,maxSlots:3};},
  dispose(){if(disposed)return;release();disposed=true;geometry.dispose();material.dispose();},
 };
}