/** Single scattering references:
 * https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering
 * https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
 * Our phase convention uses positive g for a forward lobe, mu=dot(view ray,to sun).
 * Include after the host's vec3 anViewPosition(vec2 uv), which must reconstruct
 * view coordinates from its own perspective/logarithmic depth encoding, and
 * float anReadDepth(vec2 uv), returning raw depth with 1.0 for the background.
 * Inputs and return value are linear scene radiance, before tone mapping.
 */
export const AN_ATMOSPHERE_GLSL = /* glsl */ `
uniform float anAtmoEnabled;
uniform mat4 anAtmoCameraWorld;
uniform mat4 anAtmoViewMatrix;
uniform mat4 anAtmoProjection;
uniform vec3 anAtmoSunDirection;
uniform vec3 anAtmoSunColor;
uniform float anAtmoSunIntensity;
uniform vec3 anAtmoAmbient;
uniform vec3 anAtmoRayleigh;
uniform float anAtmoDensity;
uniform float anAtmoBaseHeight;
uniform float anAtmoFalloff;
uniform float anAtmoMieG;
uniform float anAtmoMaxDistance;
uniform float anAtmoOcclusionDistance;
uniform float anAtmoShaftStrength;
uniform float anAtmoTime;
uniform int anAtmoVolumeSteps;
uniform int anAtmoLightSteps;

float anAtmoPhaseR(float mu) { return 0.05968310366 * (1.0 + mu * mu); }
float anAtmoPhaseM(float mu) {
 float g=clamp(anAtmoMieG,-0.95,0.95);
 return (1.0-g*g)/(12.5663706144*pow(max(1.0+g*g-2.0*g*mu,0.0001),1.5));
}
float anAtmoSunVisibility(vec3 sampleView,vec3 sunView) {
 // March toward the light and compare reconstructed scene geometry with each
 // projected ray sample. Off-screen occluders remain outside this depth proxy.
 float visibility=1.0;
 for(int index=0;index<4;index++) {
  if(index>=anAtmoLightSteps)break;
  float fraction=(float(index)+0.5)/float(max(anAtmoLightSteps,1));
  vec3 probe=sampleView+sunView*(0.35+fraction*fraction*anAtmoOcclusionDistance);
  vec4 projected=anAtmoProjection*vec4(probe,1.0);
  if(projected.w<=0.0)break;
  vec2 sampleUv=projected.xy/projected.w*0.5+0.5;
  if(any(lessThan(sampleUv,vec2(0.002)))||any(greaterThan(sampleUv,vec2(0.998))))break;
  vec3 surface=anViewPosition(sampleUv);
  float rayDepth=-probe.z,surfaceDepth=-surface.z;
  float bias=max(0.08,rayDepth*0.0006);
  float occluded=step(surfaceDepth+bias,rayDepth)*step(0.0,surfaceDepth);
  float edge=min(min(sampleUv.x,sampleUv.y),min(1.0-sampleUv.x,1.0-sampleUv.y));
  visibility*=1.0-occluded*smoothstep(0.0,0.04,edge);
  if(visibility<0.02)break;
 }
 return mix(1.0,visibility,clamp(anAtmoShaftStrength,0.0,1.0));
}
vec3 anApplyAtmosphere(vec3 radiance,vec3 viewPosition,vec2 uv) {
 if(anAtmoEnabled<0.5||anReadDepth(uv)>=0.999999)return radiance;
 float rayLength=min(length(viewPosition),anAtmoMaxDistance);
 if(rayLength<0.001)return radiance;
 vec3 viewRay=normalize(viewPosition);
 vec3 worldRay=normalize((anAtmoCameraWorld*vec4(viewRay,0.0)).xyz);
 vec3 origin=anAtmoCameraWorld[3].xyz;
 vec3 sunView=normalize((anAtmoViewMatrix*vec4(anAtmoSunDirection,0.0)).xyz);
 float mu=clamp(dot(worldRay,anAtmoSunDirection),-1.0,1.0);
 float phaseR=anAtmoPhaseR(mu),phaseM=anAtmoPhaseM(mu);
 float segment=rayLength/float(max(anAtmoVolumeSteps,1));
 // Stable subpixel dither avoids moving grain when time is paused.
 float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
 vec3 transmittance=vec3(1.0),scattering=vec3(0.0);
 for(int index=0;index<32;index++) {
  if(index>=anAtmoVolumeSteps)break;
  float distanceAlong=(float(index)+0.25+0.5*jitter)*segment;
  vec3 position=origin+worldRay*distanceAlong;
  float height=max(position.y-anAtmoBaseHeight,0.0);
  // Low-amplitude moving density structure; extinction is integrated in metres.
  float structure=0.96+0.04*sin(position.x*0.035+position.z*0.027+anAtmoTime*0.08)*sin(position.y*0.06-position.z*0.017);
  float aerosol=anAtmoDensity*exp(-height*anAtmoFalloff)*structure;
  vec3 molecular=anAtmoRayleigh*exp(-max(position.y,0.0)/8000.0);
  vec3 extinction=molecular+vec3(aerosol);
  vec3 segmentTransmittance=exp(-extinction*segment);
  float visibility=anAtmoSunIntensity>0.0001?anAtmoSunVisibility(viewRay*distanceAlong,sunView):0.0;
  vec3 sunlight=anAtmoSunColor*anAtmoSunIntensity*visibility;
  vec3 source=sunlight*(molecular*phaseR+vec3(aerosol*0.92*phaseM))+anAtmoAmbient*aerosol;
  // Analytic integration inside each piecewise-constant density interval.
  scattering+=transmittance*source*(vec3(1.0)-segmentTransmittance)/max(extinction,vec3(0.00000001));
  transmittance*=segmentTransmittance;
  if(max(max(transmittance.r,transmittance.g),transmittance.b)<0.002)break;
 }
 return max(vec3(0.0),radiance*transmittance+scattering);
}
`;

export const AN_SKY_VERTEX_GLSL = /* glsl */ `
varying vec3 vAnSkyDirection;
void main(){
 vAnSkyDirection=(modelMatrix*vec4(position,0.0)).xyz;
 vec4 projected=projectionMatrix*modelViewMatrix*vec4(position,1.0);
 gl_Position=projected.xyww;
}
`;

export const AN_SKY_FRAGMENT_GLSL = /* glsl */ `
varying vec3 vAnSkyDirection;
uniform vec3 anSkySunDirection;
uniform vec3 anSkySunColor;
uniform float anSkySunIntensity;
uniform float anSkyAltitude;
uniform float anSkyTurbidity;
uniform float anSkyBlend;
uniform float anSkyNight;
uniform int anSkySteps;
const float AN_PLANET=6360.0;
const float AN_TOP=6460.0;
const vec3 AN_RAYLEIGH=vec3(0.0058,0.0135,0.0331);
vec2 anSkySphere(vec3 origin,vec3 direction,float radius){
 float b=dot(origin,direction),c=dot(origin,origin)-radius*radius,discriminant=b*b-c;
 if(discriminant<0.0)return vec2(1e10,-1e10);
 float root=sqrt(discriminant);return vec2(-b-root,-b+root);
}
float anSkyMie(float mu,float g){return (1.0-g*g)/(12.5663706144*pow(max(1.0+g*g-2.0*g*mu,0.0001),1.5));}
vec3 anSkyRadiance(vec3 direction){
 vec3 origin=vec3(0.0,AN_PLANET+max(anSkyAltitude,1.0)*0.001,0.0);
 vec2 atmosphere=anSkySphere(origin,direction,AN_TOP),ground=anSkySphere(origin,direction,AN_PLANET);
 float lengthToSky=max(0.0,atmosphere.y);
 if(ground.x>0.0)lengthToSky=min(lengthToSky,ground.x);
 float segment=lengthToSky/float(max(anSkySteps,1));
 float rayleighDepth=0.0,mieDepth=0.0;
 vec3 sumR=vec3(0.0),sumM=vec3(0.0);
 float betaM=0.021*anSkyTurbidity;
 for(int index=0;index<24;index++){
  if(index>=anSkySteps)break;
  vec3 point=origin+direction*((float(index)+0.5)*segment);
  float altitude=max(length(point)-AN_PLANET,0.0);
  float densityR=exp(-altitude/8.0),densityM=exp(-altitude/1.2);
  rayleighDepth+=densityR*segment;mieDepth+=densityM*segment;
  vec2 groundLight=anSkySphere(point,anSkySunDirection,AN_PLANET);
  if(groundLight.x>0.0)continue;
  float sunLength=max(0.0,anSkySphere(point,anSkySunDirection,AN_TOP).y);
  float sunSegment=sunLength/6.0,sunR=0.0,sunM=0.0;
  for(int lightIndex=0;lightIndex<6;lightIndex++){
   float sunAltitude=max(length(point+anSkySunDirection*((float(lightIndex)+0.5)*sunSegment))-AN_PLANET,0.0);
   sunR+=exp(-sunAltitude/8.0)*sunSegment;sunM+=exp(-sunAltitude/1.2)*sunSegment;
  }
  vec3 attenuation=exp(-(AN_RAYLEIGH*(rayleighDepth+sunR)+vec3(betaM*1.1*(mieDepth+sunM))));
  sumR+=attenuation*densityR*segment;sumM+=attenuation*densityM*segment;
 }
 float mu=clamp(dot(direction,anSkySunDirection),-1.0,1.0);
 float phaseR=0.05968310366*(1.0+mu*mu),phaseM=anSkyMie(mu,0.76);
 vec3 radiance=anSkySunColor*anSkySunIntensity*(sumR*AN_RAYLEIGH*phaseR+sumM*betaM*phaseM);
 // The disk is attenuated by the same accumulated optical depths as the sky.
 float disk=smoothstep(cos(0.0050),cos(0.0042),mu)*step(0.0,anSkySunDirection.y)*(1.0-anSkyNight);
 radiance+=anSkySunColor*anSkySunIntensity*disk*exp(-(AN_RAYLEIGH*rayleighDepth+vec3(betaM*mieDepth)));
 return radiance;
}
void main(){
 vec3 direction=normalize(vAnSkyDirection);
 vec3 radiance=anSkyRadiance(direction);
 gl_FragColor=vec4(max(radiance,vec3(0.0)),anSkyBlend);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
