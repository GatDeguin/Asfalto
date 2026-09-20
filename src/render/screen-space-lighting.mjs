import {resolveRenderBudget,describeRenderTarget,renderSampleLimit} from './render-budget.mjs?v=ef65ac852f9d069d';
import {supportedHdrSamples} from './render-target-capabilities.mjs?v=9ae9aca93c7ad99b';
import {gtaoShaderDefinitions} from './vendor/gtao-shader-factory.mjs?v=e2765b113440f785';
const policies=Object.freeze({
 cinematic:Object.freeze({enabled:true,maxWidth:960,maxPixels:518400,scale:.625,aoSamples:32,giRays:6,giSteps:12,dfao:true,volume:true}),
 high:Object.freeze({enabled:true,maxWidth:768,maxPixels:589824,scale:.5,aoSamples:24,giRays:6,giSteps:12,dfao:true,volume:true}),
 balanced:Object.freeze({enabled:true,maxWidth:576,maxPixels:331776,scale:.5,aoSamples:12,giRays:3,giSteps:8,dfao:true,volume:true}),
 low:Object.freeze({enabled:true,maxWidth:384,maxPixels:147456,scale:.4,aoSamples:6,giRays:0,giSteps:0,dfao:false,volume:false}),
 off:Object.freeze({enabled:false,maxWidth:1,scale:1,aoSamples:0,giRays:0,giSteps:0,dfao:false,volume:false})
});
export const screenLightingPolicy=tier=>policies[tier]||policies.balanced;
export function depthToViewDistance(depth,near,far,logarithmic=false){return logarithmic?Math.expm1(Math.log1p(far)*depth):near*far/(far-depth*(far-near));}
const vertexShader="varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}";
const depthGLSL="\nuniform sampler2D anSceneDepth;\nuniform mat4 anProjection,anProjectionInverse,anCameraWorld;\nuniform float anNear,anFar;\nuniform bool anLogDepth;\nuniform vec2 anResolution;\nfloat anReadDepth(vec2 uv){return texture2D(anSceneDepth,clamp(uv,vec2(0.),vec2(1.))).r;}\nfloat anViewDistance(float d){if(anLogDepth)return exp2(d*log2(anFar+1.))-1.;return anNear*anFar/(anFar-d*(anFar-anNear));}\nvec3 anViewPosition(vec2 uv){\n float d=anReadDepth(uv);vec4 p=anProjectionInverse*vec4(uv*2.-1.,1.,1.);vec3 ray=p.xyz/p.w;\n return ray*(anViewDistance(d)/max(.000001,-ray.z));\n}\nvec3 anDepthNormal(vec2 uv){\n vec2 pixel=1./anResolution;vec3 p=anViewPosition(uv),l=anViewPosition(uv-vec2(pixel.x,0.)),r=anViewPosition(uv+vec2(pixel.x,0.)),b=anViewPosition(uv-vec2(0.,pixel.y)),t=anViewPosition(uv+vec2(0.,pixel.y));\n vec3 dx=abs(l.z-p.z)<abs(r.z-p.z)?p-l:r-p,dy=abs(b.z-p.z)<abs(t.z-p.z)?p-b:t-p;\n vec3 n=cross(dx,dy);return dot(n,n)>1e-14?normalize(n):vec3(0.,0.,1.);\n}";
const bounceGLSL="\nuniform sampler2D anSceneColor,anGtao;\nuniform int anGiRays,anGiSteps;\nuniform float anAoStrength,anGiStrength,anUseDfa;\nfloat anRandom(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}\nvec3 anBounce(vec3 p,vec3 n){\n if(anGiRays==0||p.z < -90.)return vec3(0.);\n vec3 tangent=normalize(cross(n,abs(n.z)<.9?vec3(0.,0.,1.):vec3(0.,1.,0.))),bitangent=cross(n,tangent),sum=vec3(0.);\n float rotation=anRandom(floor(vUv*anResolution*.5))*6.2831853;\n for(int ray=0;ray<6;ray++){\n  if(ray>=anGiRays)break;\n  float u=(float(ray)+.5)/float(anGiRays),phi=float(ray)*2.3999632+rotation;\n  vec3 direction=tangent*(cos(phi)*sqrt(u))+bitangent*(sin(phi)*sqrt(u))+n*sqrt(1.-u);\n  vec3 origin=p+n*.06;\n  for(int step=1;step<=12;step++){\n   if(step>anGiSteps)break;\n   float fraction=float(step)/float(anGiSteps),distance=.12+fraction*fraction*5.;\n   vec3 samplePoint=origin+direction*distance;\n   if(samplePoint.z>-.05)break;\n   vec4 projected=anProjection*vec4(samplePoint,1.);vec2 uv=projected.xy/projected.w*.5+.5;\n   if(any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998))))break;\n   if(anReadDepth(uv)>=.999999)continue;\n   vec3 hit=anViewPosition(uv);float behind=hit.z-samplePoint.z;\n   if(behind>0.){\n    float thickness=.15+distance*.06;\n    if(behind<thickness&&length(hit-origin)<5.4){\n     vec3 hn=anDepthNormal(uv);float facing=max(0.,dot(hn,-direction));\n     vec3 incoming=min(texture2D(anSceneColor,uv).rgb,vec3(3.));\n     sum+=incoming*facing*(1.-smoothstep(2.5,5.4,length(hit-origin)));\n    }\n    break;\n   }\n  }\n }\n return sum/max(1.,float(anGiRays));\n}\nvoid main(){\n float depth=anReadDepth(vUv);\n if(depth>=.999999){gl_FragColor=vec4(0.,0.,0.,1.);return;}\n vec3 p=anViewPosition(vUv),n=anDepthNormal(vUv);\n float ao=mix(1.,texture2D(anGtao,vUv).r,anAoStrength);\n if(anUseDfa>.5&&-p.z<70.){\n  vec3 wp=(anCameraWorld*vec4(p,1.)).xyz,wn=normalize(mat3(anCameraWorld)*n);\n  // Both methods estimate the same occlusion; avoid multiplying their estimates.\n  ao=min(ao,anDistanceFieldAO(wp,wn));\n }\n gl_FragColor=vec4(anBounce(p,n)*anGiStrength,clamp(ao,.46,1.));\n}";
const compositeGLSL="uniform sampler2D anSceneColor,anLighting;\nuniform vec2 anLightingResolution;\nvarying vec2 vUv;\n";
const compositeMain="\nvoid main(){\n vec4 color=texture2D(anSceneColor,vUv);float depth=anReadDepth(vUv);vec3 p=anViewPosition(vUv);\n vec4 lighting=vec4(0.);float weight=0.;\n for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){\n  vec2 uv=clamp(vUv+vec2(float(x),float(y))/anLightingResolution,vec2(.001),vec2(.999));\n  float delta=abs(anViewPosition(uv).z-p.z),w=exp(-delta/max(.06,-p.z*.004))*((x==0&&y==0)?2.:1.);\n  lighting+=texture2D(anLighting,uv)*w;weight+=w;\n }\n lighting/=max(weight,.0001);vec3 result=color.rgb;\n if(depth<.999999){result*=lighting.a;result+=lighting.rgb*min(color.rgb+.06,vec3(1.));}\n result=anApplyAtmosphere(result,p,vUv);\n gl_FragColor=vec4(max(result,vec3(0.)),color.a);\n gl_FragDepth=depth;\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}";
const gtaoAdapter="uniform bool anGtaoLogDepth;\nfloat anGtaoDecode(float d){if(!anGtaoLogDepth||d>=1.)return d;float z=max(cameraNear,exp2(d*log2(cameraFar+1.))-1.);return cameraFar/(cameraFar-cameraNear)-cameraFar*cameraNear/((cameraFar-cameraNear)*z);}\nvec3 getViewPosition(";

export function createScreenSpaceLighting(T,{renderer,scene,camera,atmosphere=null,distanceField=null,quality='balanced',samples=2,phone=false,framePassCount=2,onStage=null}={}){
 let disposed=false,rendering=false,frames=0,targets=null,policy=screenLightingPolicy(quality),lastError=null,features={gtao:true,ssgi:true,dfao:true,volumetrics:true};
 const size=new T.Vector2(),currentViewport=new T.Vector4(),viewport=new T.Vector4(),scissor=new T.Vector4(),clearColor=new T.Color();
 const definitions=gtaoShaderDefinitions(T),noise=definitions.generateMagicSquareNoise(5);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
 const uniforms={anSceneDepth:{value:null},anSceneColor:{value:null},anGtao:{value:null},anLighting:{value:null},anResolution:{value:new T.Vector2()},anLightingResolution:{value:new T.Vector2()},anProjection:{value:camera.projectionMatrix},anProjectionInverse:{value:camera.projectionMatrixInverse},anCameraWorld:{value:camera.matrixWorld},anNear:{value:camera.near},anFar:{value:camera.far},anLogDepth:{value:!!renderer.capabilities.logarithmicDepthBuffer},anGiRays:{value:policy.giRays},anGiSteps:{value:policy.giSteps},anAoStrength:{value:.38},anGiStrength:{value:.28},anUseDfa:{value:0},...(atmosphere?.uniforms||{}),...(distanceField?.uniforms||{})};
 const gtaoUniforms=T.UniformsUtils.clone(definitions.GTAOShader.uniforms);gtaoUniforms.tNoise.value=noise;gtaoUniforms.radius.value=1.2;gtaoUniforms.thickness.value=.7;gtaoUniforms.distanceFallOff.value=1;gtaoUniforms.anGtaoLogDepth={value:!!renderer.capabilities.logarithmicDepthBuffer};
 let gtaoFragment=definitions.GTAOShader.fragmentShader;
 gtaoFragment=gtaoFragment.replace('vec3 getViewPosition(',gtaoAdapter)
 .replace('return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;','return anGtaoDecode(textureLod(tDepth, clamp(uv.xy,vec2(0.),vec2(1.)), 0.0).DEPTH_SWIZZLING);')
 .replace('return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;','return anGtaoDecode(texelFetch(tDepth, clamp(uv.xy,ivec2(0),textureSize(tDepth,0)-ivec2(1)), 0).DEPTH_SWIZZLING);')
 .replace('vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);','cosHorizons=clamp(cosHorizons,vec2(-1.),vec2(1.));vec2 sinHorizons = sqrt(max(vec2(0.),1. - cosHorizons * cosHorizons));');
 const gtao=new T.ShaderMaterial({name:'ASFALTO_GTAO',uniforms:gtaoUniforms,defines:{...definitions.GTAOShader.defines,SAMPLES:policy.aoSamples||6,NORMAL_VECTOR_TYPE:0},vertexShader,fragmentShader:gtaoFragment,depthTest:false,depthWrite:false,blending:T.NoBlending});
 const bounce=new T.ShaderMaterial({name:'ASFALTO_SSGI_DFAO',uniforms,vertexShader,fragmentShader:'varying vec2 vUv;\n'+depthGLSL+'\n'+(distanceField?.glsl||'float anDistanceFieldAO(vec3 p,vec3 n){return 1.;}')+'\n'+bounceGLSL,depthTest:false,depthWrite:false,blending:T.NoBlending});
 const composite=new T.ShaderMaterial({name:'ASFALTO_INDIRECT_COMPOSITE',uniforms,vertexShader,fragmentShader:compositeGLSL+depthGLSL+'\n'+(atmosphere?.glsl||'vec3 anApplyAtmosphere(vec3 c,vec3 p,vec2 uv){return c;}')+'\n'+compositeMain,depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth,blending:T.NoBlending});
 const quad=new T.Mesh(geometry,gtao);quad.frustumCulled=false;const passScene=new T.Scene();passScene.add(quad);const passCamera=new T.Camera();
 function volumeEnabled(){return !!(atmosphere&&features.volumetrics&&policy.volume&&atmosphere.uniforms?.anAtmoEnabled?.value!==0);}
 function hasIndirect(){return !!(features.gtao&&policy.aoSamples>0||features.ssgi&&policy.giRays>0||distanceField&&features.dfao&&policy.dfao);}
 function hasEffects(){return hasIndirect()||volumeEnabled();}
 function releaseTargets(){if(!targets)return;for(const t of Object.values(targets))t.dispose();targets=null;allocationBudget=null;}
 function requestedCaptureSamples(){return Math.min(renderSampleLimit(quality,phone),samples===0?0:policy===screenLightingPolicy('cinematic')?Math.max(4,samples):samples);}
 function captureSamples(){return supportedHdrSamples(renderer,requestedCaptureSamples());}
 let targetSamples=captureSamples();
 const contextRestored=()=>{releaseTargets();targetSamples=captureSamples();};
 renderer.domElement?.addEventListener?.('webglcontextrestored',contextRestored);
 let allocationBudget=null;
 function ensureTargets(){
  const destination=renderer.getRenderTarget();if(destination)size.set(destination.width,destination.height);else renderer.getDrawingBufferSize(size);allocationBudget=resolveRenderBudget({width:size.x,height:size.y,quality,phone,passCount:framePassCount,samples:targetSamples});const width=allocationBudget.width,height=allocationBudget.height,scale=Math.min(policy.scale,policy.maxWidth/width,Math.sqrt((policy.maxPixels??Infinity)/(width*height))),ew=Math.max(2,Math.floor(width*scale)),eh=Math.max(2,Math.floor(height*scale));
  if(!targets){const params={type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false,stencilBuffer:false};const color=new T.WebGLRenderTarget(width,height,{...params,depthBuffer:true,samples:targetSamples});color.depthTexture=new T.DepthTexture(width,height,T.UnsignedIntType);color.texture.name='ASFALTO_INDIRECT_SOURCE';color.texture.colorSpace=T.LinearSRGBColorSpace;targets={color,ao:new T.WebGLRenderTarget(ew,eh,params),lighting:new T.WebGLRenderTarget(ew,eh,params)};}
  if(targets.color.width!==width||targets.color.height!==height)targets.color.setSize(width,height);
  for(const t of [targets.ao,targets.lighting])if(t.width!==ew||t.height!==eh)t.setSize(ew,eh);
  uniforms.anSceneDepth.value=targets.color.depthTexture;uniforms.anSceneColor.value=targets.color.texture;uniforms.anGtao.value=targets.ao.texture;uniforms.anLighting.value=targets.lighting.texture;uniforms.anResolution.value.set(width,height);uniforms.anLightingResolution.value.set(ew,eh);
  gtaoUniforms.tDepth.value=targets.color.depthTexture;gtaoUniforms.resolution.value.set(ew,eh);
 }
 return{
  setFeatures(value){features={...features,...value};uniforms.anAoStrength.value=features.gtao?.38:0;uniforms.anGiStrength.value=features.ssgi?.28:0;uniforms.anGiRays.value=features.ssgi?policy.giRays:0;if(!hasEffects())releaseTargets();},
  setQuality(tier){quality=tier;const next=screenLightingPolicy(tier);if(next===policy)return;policy=next;const nextSamples=captureSamples();if(nextSamples!==targetSamples){targetSamples=nextSamples;releaseTargets();}uniforms.anGiRays.value=features.ssgi?policy.giRays:0;uniforms.anGiSteps.value=policy.giSteps;if(gtao.defines.SAMPLES!==(policy.aoSamples||6)){gtao.defines.SAMPLES=policy.aoSamples||6;gtao.needsUpdate=true;}if(!policy.enabled||!hasEffects())releaseTargets();},
  prepare(compile){
   if(typeof compile!=='function')throw new TypeError('Screen lighting compile callback is required');
   if(disposed||!policy.enabled||!hasEffects()||renderer.getContext().isContextLost())return compile();
   if(rendering)throw Error('Screen lighting cannot prepare recursively');rendering=true;
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace?.()||0,oldMip=renderer.getActiveMipmapLevel?.()||0,oldAutoClear=renderer.autoClear,oldScissor=renderer.getScissorTest(),oldFog=scene.fog;
   const savedViewport=new T.Vector4(),savedScissor=new T.Vector4();renderer.getViewport(savedViewport);renderer.getScissor(savedScissor);
   try{
    ensureTargets();renderer.setRenderTarget(targets.color);renderer.setScissorTest(false);renderer.autoClear=true;
    if(volumeEnabled())scene.fog=null;
    return compile();
   }finally{
    scene.fog=oldFog;renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(savedViewport);renderer.setScissor(savedScissor);renderer.setScissorTest(oldScissor);renderer.autoClear=oldAutoClear;rendering=false;
   }
  },
  render(draw){
   if(disposed||!policy.enabled||!hasEffects()||renderer.getContext().isContextLost()){if(!disposed&&(!policy.enabled||!hasEffects()))releaseTargets();draw();return;}
   if(rendering)throw Error('Screen lighting cannot render recursively');rendering=true;
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace?.()||0,oldMip=renderer.getActiveMipmapLevel?.()||0,oldAutoClear=renderer.autoClear,oldInfo=renderer.info.autoReset,oldScissor=renderer.getScissorTest(),oldAlpha=renderer.getClearAlpha();
   renderer.getViewport(viewport);renderer.getCurrentViewport?.(currentViewport);renderer.getScissor(scissor);renderer.getClearColor(clearColor);const oldFog=scene.fog;
   try{
    onStage?.('Primer cuadro: buffers de iluminación');ensureTargets();camera.updateMatrixWorld();uniforms.anNear.value=camera.near;uniforms.anFar.value=camera.far;
    gtaoUniforms.cameraNear.value=camera.near;gtaoUniforms.cameraFar.value=camera.far;gtaoUniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);gtaoUniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);gtaoUniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
    uniforms.anUseDfa.value=distanceField&&features.dfao&&policy.dfao?1:0;
    renderer.setRenderTarget(targets.color);renderer.setScissorTest(false);renderer.autoClear=true;
    if(volumeEnabled())scene.fog=null;
    onStage?.('Primer cuadro: captura del mundo');draw();scene.fog=oldFog;renderer.info.autoReset=false;renderer.autoClear=false;
    onStage?.('Primer cuadro: oclusión GTAO');renderer.setRenderTarget(targets.ao);renderer.setClearColor(0xffffff,1);renderer.clear(true,false,false);if(features.gtao&&policy.aoSamples>0){quad.material=gtao;renderer.render(passScene,passCamera);}
    onStage?.('Primer cuadro: iluminación indirecta');renderer.setRenderTarget(targets.lighting);renderer.setClearColor(0x000000,1);renderer.clear(true,false,false);if(hasIndirect()){quad.material=bounce;renderer.render(passScene,passCamera);}
    onStage?.('Primer cuadro: composición del mundo');renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(oldScissor);if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(currentViewport);renderer.autoClear=false;quad.material=composite;renderer.render(passScene,passCamera);frames++;
   }catch(error){lastError=error.message;throw error;}
   finally{scene.fog=oldFog;renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(oldScissor);renderer.setClearColor(clearColor,oldAlpha);renderer.autoClear=oldAutoClear;renderer.info.autoReset=oldInfo;if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(currentViewport);rendering=false;}
  },
  diagnostics:()=>({enabled:policy.enabled,policy,frames,requestedSamples:requestedCaptureSamples(),supportedSamples:targetSamples,allocationBudget,allocations:targets?Object.values(targets).map(describeRenderTarget):[],spatialOnly:true,targets:targets?3:0,samples:targets?.color.samples??null,size:targets?[targets.color.width,targets.color.height]:null,effectSize:targets?[targets.ao.width,targets.ao.height]:null,techniques:{gtao:'Three r180 horizon integration',ssgi:'hemisphere depth ray marching with bilateral filtering',dfao:!!distanceField,volumetric:!!atmosphere},lastError,disposed}),
  dispose(){if(disposed)return;disposed=true;renderer.domElement?.removeEventListener?.('webglcontextrestored',contextRestored);releaseTargets();noise.dispose();geometry.dispose();gtao.dispose();bounce.dispose();composite.dispose();}
 };
}
