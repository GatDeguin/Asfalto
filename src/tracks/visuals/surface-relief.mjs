import {isHighGraphicsQuality} from '../../render/graphics-quality-policy.mjs';

// Inward relief with local quadratic convex silhouette tracing. The curvature
// approximation suits smooth rocks; it does not extrude prisms or change colliders.
const quality={anReliefSteps:{value:24},anReliefRange:{value:95},anReliefEnabled:{value:1},anReliefPDOEnabled:{value:1}};
let shaderChunks;
const installedMaterials=new WeakSet();
export function configureSurfaceRelief(THREE){shaderChunks=THREE.ShaderChunk;}
export function setSurfaceReliefQuality(tier='high'){
  quality.anReliefSteps.value=isHighGraphicsQuality(tier)?24:12;
  quality.anReliefRange.value=isHighGraphicsQuality(tier)?95:48;
  quality.anReliefEnabled.value=tier==='low'?0:1;
}
export function setSurfaceReliefPDO(enabled=true){quality.anReliefPDOEnabled.value=enabled?1:0;}
export function surfaceReliefDiagnostics(){
  return {enabled:!!quality.anReliefEnabled.value,maxSteps:quality.anReliefSteps.value,
    pixelDepthOffset:!!quality.anReliefPDOEnabled.value,depthEncoding:'perspective-and-logarithmic',fadeEndM:quality.anReliefRange.value,silhouette:'convex-local-curvature',physicalDeltaM:0};
}
export function installSurfaceRelief(material,{heightMap,metres=3,depthM=.045,projection='uv',silhouette=false}={}){
  if(!heightMap?.isTexture||!material?.isMeshStandardMaterial||!material.map||material.transparent||installedMaterials.has(material))return false;
  if(!(metres>0&&Number.isFinite(metres)&&depthM>0&&Number.isFinite(depthM)))return false;
  const triplanar=projection==='landscape',previous=material.onBeforeCompile;
  const baseKey=material.customProgramCacheKey();
  installedMaterials.add(material);
  material.asfaltoHeightTexture=heightMap;
  material.userData.asfaltoRelief={depthM,metres,projection,silhouette,physicalDeltaM:0};
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    // Relief uses visible-surface normals and lighting chunks; native shadow
    // passes keep their depth/alpha implementation and actual mesh silhouette.
    if(this.isMeshDepthMaterial||this.isMeshDistanceMaterial)return;
    Object.assign(shader.uniforms,quality,{anHeightMap:{value:heightMap},anReliefDepth:{value:depthM}});
    if(triplanar)shader.defines={...shader.defines,AN_RELIEF_LANDSCAPE:1};
    if(silhouette)shader.defines={...shader.defines,AN_RELIEF_SILHOUETTE:1};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAnReliefWorld;\nvarying vec3 vAnReliefNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',VERTEX);
    shader.fragmentShader=shader.fragmentShader.replace('#include <uv_pars_fragment>','#include <uv_pars_fragment>\n'+DECLARATIONS);
    const anchor=triplanar?'vec3 landscapeUV = landscapeCoordinates(vLandscapeWorld);':'#include <map_fragment>';
    shader.fragmentShader=shader.fragmentShader.replace(anchor,TRACE+'\n'+anchor);
    if(triplanar){
      shader.fragmentShader=shader.fragmentShader.replaceAll('landscapeCoordinates(vLandscapeWorld)','landscapeCoordinates(anReliefWorld)');
    }else{
      // Keep the native include anchors for weather and later material hooks.
      // UV aliases are scoped to one chunk, including the chunks it expands.
      for(const [chunk,uv]of [['map_fragment','vMapUv'],['normal_fragment_maps','vNormalMapUv'],['roughnessmap_fragment','vRoughnessMapUv']]){
        if(!shaderChunks?.[chunk])continue;
        const anchor='#include <'+chunk+'>',value=uv==='vMapUv'?'anReliefUV':'('+uv+' + anReliefUV - vMapUv)';
        shader.fragmentShader=shader.fragmentShader.replace(anchor,'#define '+uv+' '+value+'\n'+anchor+'\n#undef '+uv);
      }
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.-anCavity*.18;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',DEPTH);
  };
  material.customProgramCacheKey=()=>baseKey+'|an-relief-v1-'+projection+'-'+silhouette;
  material.needsUpdate=true;
  return true;
}

const DECLARATIONS=`
varying vec3 vAnReliefWorld;
varying vec3 vAnReliefNormal;
uniform sampler2D anHeightMap;
uniform mat4 projectionMatrix;
uniform float anReliefDepth;
uniform float anReliefSteps;
uniform float anReliefRange;
uniform float anReliefEnabled;
uniform float anReliefPDOEnabled;
vec3 anReliefWorld;
vec2 anReliefUV;
vec3 anReliefDx,anReliefDy,anReliefWeights,anReliefU,anReliefV;
vec2 anReliefUvDx,anReliefUvDy;
#ifdef AN_RELIEF_LANDSCAPE
vec3 landscapeCoordinates(vec3 world);
float landscapeNoise(vec2 p);
float anHeightPlane(vec2 p,vec2 dx,vec2 dy){
  float k=landscapeNoise(p*.065)*8.,i=floor(k),f=fract(k);
  vec2 a=sin(vec2(3.1,7.7)*i)*3.,b=sin(vec2(3.1,7.7)*(i+1.))*3.;
  return mix(textureGrad(anHeightMap,p+a,dx,dy).r,textureGrad(anHeightMap,p+b,dx,dy).r,smoothstep(.18,.82,f));
}
float anSurfaceHeight(vec3 world){
  vec3 p=landscapeCoordinates(world);float h=0.;
  if(anReliefWeights.x>.001)h+=anHeightPlane(p.yz,anReliefDx.yz,anReliefDy.yz)*anReliefWeights.x;
  if(anReliefWeights.y>.001)h+=anHeightPlane(p.xz,anReliefDx.xz,anReliefDy.xz)*anReliefWeights.y;
  if(anReliefWeights.z>.001)h+=anHeightPlane(p.xy,anReliefDx.xy,anReliefDy.xy)*anReliefWeights.z;
  return h;
}
#else
vec2 anSurfaceUV(vec3 world){
  vec3 delta=world-vAnReliefWorld;
  return vMapUv+vec2(dot(delta,anReliefU),dot(delta,anReliefV));
}
float anSurfaceHeight(vec3 world){
  return textureGrad(anHeightMap,anSurfaceUV(world),anReliefUvDx,anReliefUvDy).r;
}
#endif
float anReliefField(float t,vec3 direction,float facing,float curvature,float depth){
  return -facing*t+.5*curvature*t*t+depth*(1.-anSurfaceHeight(vAnReliefWorld+direction*t));
}
`;
const TRACE=`
anReliefWorld=vAnReliefWorld;
#ifdef AN_RELIEF_LANDSCAPE
anReliefUV=vec2(0.);
#else
anReliefUV=vMapUv;
#endif
vec3 anPomDx=dFdx(vAnReliefWorld),anPomDy=dFdy(vAnReliefWorld);
vec3 anPomN=normalize(vAnReliefNormal);
#ifdef DOUBLE_SIDED
anPomN*=gl_FrontFacing?1.:-1.;
#endif
vec3 anPomNx=dFdx(anPomN),anPomNy=dFdy(anPomN);
#ifdef AN_RELIEF_LANDSCAPE
vec3 anPomBase=landscapeCoordinates(vAnReliefWorld);
anReliefDx=dFdx(anPomBase);anReliefDy=dFdy(anPomBase);
anReliefWeights=pow(abs(anPomN),vec3(4.));
anReliefWeights/=max(dot(anReliefWeights,vec3(1.)),.0001);
#else
anReliefUvDx=dFdx(vMapUv);anReliefUvDy=dFdy(vMapUv);
#endif
float anPomXX=dot(anPomDx,anPomDx),anPomYY=dot(anPomDy,anPomDy),anPomXY=dot(anPomDx,anPomDy);
float anPomDet=anPomXX*anPomYY-anPomXY*anPomXY;
float anPomDistance=distance(cameraPosition,vAnReliefWorld);
float anPomFade=(1.-smoothstep(anReliefRange*.48,anReliefRange,anPomDistance))*anReliefEnabled;
float anHitT=0.,anCavity=0.;
if(anPomFade>.001&&anPomDet>1e-16){
  vec3 anPomDualX=(anPomDx*anPomYY-anPomDy*anPomXY)/anPomDet,anPomDualY=(anPomDy*anPomXX-anPomDx*anPomXY)/anPomDet;
  #ifndef AN_RELIEF_LANDSCAPE
  anReliefU=anPomDualX*anReliefUvDx.x+anPomDualY*anReliefUvDy.x;
  anReliefV=anPomDualX*anReliefUvDx.y+anPomDualY*anReliefUvDy.y;
  #endif
  vec3 anPomDir=isOrthographic?inverseTransformDirection(vec3(0.,0.,-1.),viewMatrix):normalize(vAnReliefWorld-cameraPosition);
  float anPomFacing=max(.001,-dot(anPomDir,anPomN)),anPomCurvature=0.;
  #ifdef AN_RELIEF_SILHOUETTE
  vec3 anPomTangent=anPomDir+anPomN*anPomFacing;
  anPomCurvature=clamp(dot(anPomTangent,anPomNx*dot(anPomTangent,anPomDualX)+anPomNy*dot(anPomTangent,anPomDualY)),0.,8.);
  #endif
  float anPomDepth=anReliefDepth*anPomFade;
  #ifndef AN_RELIEF_SILHOUETTE
  anPomDepth*=smoothstep(.018,.085,anPomFacing);
  #endif
  float anPomMaxT=min(anPomDepth/max(.035,anPomFacing)*2.,anPomDepth*30.);
  bool anPomConvexExit=anPomCurvature>1e-5&&2.*anPomFacing/anPomCurvature<anPomMaxT;
  if(anPomConvexExit)anPomMaxT=2.*anPomFacing/anPomCurvature;
  float anPomSteps=ceil(mix(8.,anReliefSteps,1.-anPomFacing)),anPomPreviousT=0.;
  bool anPomHit=anSurfaceHeight(vAnReliefWorld)>=.9999;
  for(int i=1;i<=24;i++){
    if(anPomHit||float(i)>anPomSteps)break;
    float t=anPomMaxT*min(1.,float(i)/anPomSteps);
    if(anReliefField(t,anPomDir,anPomFacing,anPomCurvature,anPomDepth)<=0.){
      float lo=anPomPreviousT,hi=t;
      for(int j=0;j<4;j++){
        float mid=(lo+hi)*.5;
        if(anReliefField(mid,anPomDir,anPomFacing,anPomCurvature,anPomDepth)>0.)lo=mid;else hi=mid;
      }
      anHitT=(lo+hi)*.5;anPomHit=true;
    }
    anPomPreviousT=t;
  }
  #ifdef AN_RELIEF_SILHOUETTE
  if(!anPomHit&&anPomConvexExit&&anPomDepth>.00001)discard;
  #endif
  if(anPomHit){
    anReliefWorld=vAnReliefWorld+anPomDir*anHitT;
    #ifndef AN_RELIEF_LANDSCAPE
    anReliefUV=anSurfaceUV(anReliefWorld);
    #endif
    anCavity=(1.-anSurfaceHeight(anReliefWorld))*anPomFade;
  }
}
`;
const DEPTH=`
#if !defined(USE_LOGARITHMIC_DEPTH_BUFFER) && !defined(USE_LOGDEPTHBUF)
gl_FragDepth=gl_FragCoord.z;
#endif
if(anHitT>0.&&anReliefPDOEnabled>.5){
  vec4 anViewHit=viewMatrix*vec4(anReliefWorld,1.);
  #if defined(USE_LOGARITHMIC_DEPTH_BUFFER) || defined(USE_LOGDEPTHBUF)
  if(vIsPerspective==0.){
    vec4 anClipHit=projectionMatrix*anViewHit;
    gl_FragDepth=clamp(anClipHit.z/anClipHit.w*.5+.5,0.,1.);
  }else gl_FragDepth=log2(max(.000001,1.-anViewHit.z))*logDepthBufFC*.5;
  #else
  vec4 anClipHit=projectionMatrix*anViewHit;
  gl_FragDepth=clamp(anClipHit.z/anClipHit.w*.5+.5,0.,1.);
  #endif
}
#include <opaque_fragment>
`;
const VERTEX=`#include <begin_vertex>
vec4 anReliefPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
anReliefPosition=instanceMatrix*anReliefPosition;
#endif
vAnReliefWorld=(modelMatrix*anReliefPosition).xyz;
vAnReliefNormal=inverseTransformDirection(transformedNormal,viewMatrix);
`;
