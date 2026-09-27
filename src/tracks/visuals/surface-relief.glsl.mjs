/** Reusable MeshStandard/Physical onBeforeCompile POM chunks. WebGL2 native textureGrad. */
export const DECLARATIONS=`
#if __VERSION__ < 300
#ifdef GL_EXT_shader_texture_lod
#define anTextureGrad texture2DGradEXT
#else
#error Surface_relief_requires_explicit_texture_gradients
#endif
#else
#define anTextureGrad textureGrad
#endif
varying vec3 vAnReliefWorld;
varying vec3 vAnReliefNormal;
#ifdef AN_RELIEF_SILHOUETTE
varying float vAnReliefCurvature;
#endif
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
  return mix(anTextureGrad(anHeightMap,p+a,dx,dy).r,anTextureGrad(anHeightMap,p+b,dx,dy).r,smoothstep(.18,.82,f));
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
  return anTextureGrad(anHeightMap,anSurfaceUV(world),anReliefUvDx,anReliefUvDy).r;
}
#endif
// Ray/surface signed separation in metres. Curvature is interpolated 1/metre.
float anReliefField(float t, vec3 direction, float facing, float curvature, float depth) {
  return -facing*t + .5*curvature*t*t
       + depth*(1. - anSurfaceHeight(vAnReliefWorld + direction*t));
}

// Return (distance, height). Secant solves a locally planar field in one sample;
// a residual check prevents accepting the approximation blindly.
vec2 anRefineRelief(
  vec2 interval, vec2 fieldAtEnds, vec3 direction,
  float facing, float curvature, float depth
) {
  float lo = interval.x, hi = interval.y;
  float fraction = clamp(fieldAtEnds.x / max(1e-12, fieldAtEnds.x-fieldAtEnds.y), 0., 1.);
  float candidate = mix(lo, hi, fraction);
  float tolerance = max(1e-6, depth*.002);
  for (int j=0; j<4; j++) {
    float field = anReliefField(candidate, direction, facing, curvature, depth);
    if (abs(field) <= tolerance) {
      // Reuse this sample instead of fetching height again for cavity shading.
      float height = 1. - (field + facing*candidate - .5*curvature*candidate*candidate)/depth;
      return vec2(candidate, clamp(height, 0., 1.));
    }
    if (field > 0.) lo=candidate; else hi=candidate;
    candidate=(lo+hi)*.5;
  }
  return vec2(candidate, anSurfaceHeight(vAnReliefWorld+direction*candidate));
}
`;
export const TRACE=`
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
// All footprint derivatives are evaluated before divergent tracing.
#ifdef AN_RELIEF_LANDSCAPE
vec3 anPomBase=landscapeCoordinates(vAnReliefWorld);
anReliefDx=dFdx(anPomBase);anReliefDy=dFdy(anPomBase);
anReliefWeights=pow(abs(anPomN),vec3(4.));
anReliefWeights/=max(dot(anReliefWeights,vec3(1.)),.0001);
#else
anReliefUvDx=dFdx(vMapUv);anReliefUvDy=dFdy(vMapUv);
#endif
float anPomXX=dot(anPomDx,anPomDx),anPomYY=dot(anPomDy,anPomDy),anPomXY=dot(anPomDx,anPomDy);
float anPomDet=max(0.,anPomXX*anPomYY-anPomXY*anPomXY);
float anPomDistance=distance(cameraPosition,vAnReliefWorld);
float anPomFade=(1.-smoothstep(anReliefRange*.48,anReliefRange,anPomDistance))*anReliefEnabled;
float anHitT=0.,anCavity=0.;
if(anPomFade>.001&&anPomDet>max(1e-20,anPomXX*anPomYY*1e-6)){
  vec3 anPomDualX=(anPomDx*anPomYY-anPomDy*anPomXY)/anPomDet,anPomDualY=(anPomDy*anPomXX-anPomDx*anPomXY)/anPomDet;
  #ifndef AN_RELIEF_LANDSCAPE
  anReliefU=anPomDualX*anReliefUvDx.x+anPomDualY*anReliefUvDy.x;
  anReliefV=anPomDualX*anReliefUvDx.y+anPomDualY*anReliefUvDy.y;
  #endif
  vec3 anPomDir=isOrthographic?inverseTransformDirection(vec3(0.,0.,-1.),viewMatrix):normalize(vAnReliefWorld-cameraPosition);
  float anPomFacing=max(.001,-dot(anPomDir,anPomN)),anPomCurvature=0.;
  #ifdef AN_RELIEF_SILHOUETTE
  vec3 anPomTangent=anPomDir+anPomN*anPomFacing;
  anPomCurvature=clamp(vAnReliefCurvature*dot(anPomTangent,anPomTangent),0.,8.);
  #endif
  float anPomDepth=anReliefDepth*anPomFade;
  #ifndef AN_RELIEF_SILHOUETTE
  anPomDepth*=smoothstep(.018,.085,anPomFacing);
  #endif
  float anPomMaxT=min(anPomDepth/max(.035,anPomFacing)*2.,anPomDepth*30.);
  bool anPomConvexExit=anPomCurvature>1e-5&&2.*anPomFacing/anPomCurvature<anPomMaxT;
  if(anPomConvexExit)anPomMaxT=2.*anPomFacing/anPomCurvature;
  float anPomSteps = ceil(mix(12., clamp(anReliefSteps,12.,24.), 1.-clamp(anPomFacing,0.,1.)));
  float anPomPreviousT = 0.;
  // A grazing fade can reduce depth to zero. Skip all height reads in that case.
  float anHitHeight = anPomDepth>1e-6 ? anSurfaceHeight(vAnReliefWorld) : 1.;
  float anPomPreviousField = anPomDepth*(1.-anHitHeight);
  bool anPomHit = anHitHeight>=.9999;
  for (int i=1; i<=24; i++) {
    if (anPomHit || float(i)>anPomSteps) break;
    float t = anPomMaxT*min(1.,float(i)/anPomSteps);
    float field = anReliefField(t,anPomDir,anPomFacing,anPomCurvature,anPomDepth);
    if (field<=0.) {
      vec2 hit = anRefineRelief(
        vec2(anPomPreviousT,t), vec2(anPomPreviousField,field),
        anPomDir,anPomFacing,anPomCurvature,anPomDepth
      );
      anHitT=hit.x;
      anHitHeight=hit.y;
      anPomHit=true;
      break;
    }
    anPomPreviousT=t;
    anPomPreviousField=field;
  }
  #ifdef AN_RELIEF_SILHOUETTE
  if(!anPomHit&&anPomConvexExit&&anPomDepth>.00001)discard;
  #endif
  if(anPomHit){
    anReliefWorld=vAnReliefWorld+anPomDir*anHitT;
    #ifndef AN_RELIEF_LANDSCAPE
    anReliefUV=anSurfaceUV(anReliefWorld);
    #endif
    anCavity=(1.-anHitHeight)*anPomFade;
  }
}
`;
export const DEPTH=`
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
export const VERTEX=`#include <begin_vertex>
vec4 anReliefPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
anReliefPosition=instanceMatrix*anReliefPosition;
#endif
vAnReliefWorld=(modelMatrix*anReliefPosition).xyz;
vAnReliefNormal=inverseTransformDirection(transformedNormal,viewMatrix);
#ifdef AN_RELIEF_SILHOUETTE
mat3 anReliefModel=mat3(modelMatrix);
#ifdef USE_INSTANCING
anReliefModel=anReliefModel*mat3(instanceMatrix);
#endif
// Exact for uniform scale, isotropic approximation for nonuniform transforms.
float anReliefScale=max(1e-5,pow(max(1e-15,abs(dot(anReliefModel[0],cross(anReliefModel[1],anReliefModel[2])))),1./3.));
vAnReliefCurvature=anReliefCurvature/anReliefScale;
#endif
`;
