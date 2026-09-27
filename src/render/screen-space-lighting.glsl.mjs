/** Linear/HDR passes. Geometry metadata is point-sampled: sqrt(view distance),
 * octahedral view normal, validity. Decode logarithmic source depth before use. */
export const vertexShader=/* glsl */ `varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
export const depthGLSL=/* glsl */ `
uniform sampler2D anSceneDepth;
uniform mat4 anProjection,anProjectionInverse,anCameraWorld;
uniform float anNear,anFar;
uniform bool anLogDepth;
uniform vec2 anResolution;
float anReadDepth(vec2 uv){return texture2D(anSceneDepth,clamp(uv,vec2(0.),vec2(1.))).r;}
float anViewDistance(float d){if(anLogDepth)return exp2(d*log2(anFar+1.))-1.;return anNear*anFar/(anFar-d*(anFar-anNear));}
// Perspective camera: homogeneous w cancels when normalizing the view ray.
vec3 anPositionAtDistance(vec2 uv, float distanceToCamera) {
  vec4 ray=anProjectionInverse*vec4(uv*2.-1.,1.,1.);
  return ray.xyz*(distanceToCamera/max(.000001,-ray.z));
}
vec3 anViewPosition(vec2 uv) {
  return anPositionAtDistance(uv,anViewDistance(anReadDepth(uv)));
}
vec3 anDepthNormal(vec2 uv){
 vec2 pixel=1./anResolution;vec3 p=anViewPosition(uv),l=anViewPosition(uv-vec2(pixel.x,0.)),r=anViewPosition(uv+vec2(pixel.x,0.)),b=anViewPosition(uv-vec2(0.,pixel.y)),t=anViewPosition(uv+vec2(0.,pixel.y));
 vec3 dx=abs(l.z-p.z)<abs(r.z-p.z)?p-l:r-p,dy=abs(b.z-p.z)<abs(t.z-p.z)?p-b:t-p;
 vec3 n=cross(dx,dy);return dot(n,n)>1e-14?normalize(n):vec3(0.,0.,1.);
}`;
export const bounceGLSL=/* glsl */ `
uniform sampler2D anSceneColor,anGtao;
uniform int anGiRays,anGiSteps;
uniform float anAoStrength,anGiStrength,anUseDfa;
float anRandom(vec2 p){return fract(dot(p,vec2(.754877666,.569840296)));}
vec3 anBounce(vec3 p,vec3 n){
 if(anGiRays==0||p.z < -90.)return vec3(0.);
 vec3 tangent=normalize(cross(n,abs(n.z)<.9?vec3(0.,0.,1.):vec3(0.,1.,0.))),bitangent=cross(n,tangent),sum=vec3(0.);
 float rotation=anRandom(floor(vUv*anResolution*.5))*6.2831853;
 for(int ray=0;ray<6;ray++){
  if(ray>=anGiRays)break;
  float u=(float(ray)+.5)/float(anGiRays),phi=float(ray)*2.3999632+rotation;
  vec3 direction=tangent*(cos(phi)*sqrt(u))+bitangent*(sin(phi)*sqrt(u))+n*sqrt(1.-u);
  vec3 origin=p+n*.06;
  for(int step=1;step<=12;step++){
   if(step>anGiSteps)break;
   float fraction=float(step)/float(anGiSteps),distance=.12+fraction*fraction*5.;
   vec3 samplePoint=origin+direction*distance;
   if(samplePoint.z>-.05)break;
   vec4 projected=anProjection*vec4(samplePoint,1.);vec2 uv=projected.xy/projected.w*.5+.5;
   if(any(lessThan(uv,vec2(.002)))||any(greaterThan(uv,vec2(.998))))break;
   if(anReadDepth(uv)>=.999999)continue;
   vec3 hit=anViewPosition(uv);float behind=hit.z-samplePoint.z;
   if(behind>0.){
    float thickness=.15+distance*.06;
    if(behind<thickness&&length(hit-origin)<5.4){
     vec3 hn=anDepthNormal(uv);float facing=max(0.,dot(hn,-direction));
     vec3 incoming=min(texture2D(anSceneColor,uv).rgb,vec3(3.));
     sum+=incoming*facing*(1.-smoothstep(2.5,5.4,length(hit-origin)));
    }
    break;
   }
  }
 }
 return sum/max(1.,float(anGiRays));
}
void main(){
 float depth=anReadDepth(vUv);
 if(depth>=.999999){gl_FragColor=vec4(0.,0.,0.,1.);return;}
 vec3 p=anViewPosition(vUv),n=anDepthNormal(vUv);
 float ao=mix(1.,texture2D(anGtao,vUv).r,anAoStrength);
 if(anUseDfa>.5&&-p.z<70.){
  vec3 wp=(anCameraWorld*vec4(p,1.)).xyz,wn=normalize(mat3(anCameraWorld)*n);
  // Both methods estimate the same occlusion; avoid multiplying their estimates.
  ao=min(ao,anDistanceFieldAO(wp,wn));
 }
 gl_FragColor=vec4(anBounce(p,n)*anGiStrength,clamp(ao,.46,1.));
}`;

export const metadataGLSL=/* glsl */ `
uniform sampler2D anMetadata,anPreviousMetadata;
uniform vec2 anLightingResolution;
vec2 anOctEncode(vec3 n){
 n/=max(abs(n.x)+abs(n.y)+abs(n.z),.000001);
 vec2 s=vec2(n.x>=0.?1.:-1.,n.y>=0.?1.:-1.);
 return (n.z>=0.?n.xy:(1.-abs(n.yx))*s)*.5+.5;
}
vec3 anOctDecode(vec2 e){
 vec2 f=e*2.-1.;vec3 n=vec3(f,1.-abs(f.x)-abs(f.y));
 float t=max(-n.z,0.);n.xy+=vec2(n.x>=0.?-t:t,n.y>=0.?-t:t);
 return normalize(n);
}
float anMetadataDistance(vec4 value){return value.r*value.r;}
`;
export const metadataMain=/* glsl */ `
void main(){
 float d=anReadDepth(vUv);
 if(d>=.999999){gl_FragColor=vec4(0.);return;}
 vec3 p=anViewPosition(vUv),n=anDepthNormal(vUv);
 gl_FragColor=vec4(sqrt(max(0.,-p.z)),anOctEncode(n),1.);
}
`;
export const bilateralGLSL=/* glsl */ `
// Symmetric point-to-plane distance accepts sloped surfaces but rejects layers
// on separate planes. Metadata is never linearly interpolated before this test.
float anBilateralWeight(
  vec3 position, vec3 normal, vec4 metadata, vec2 sampleUv, vec2 offsetInTexels
) {
  if(metadata.a<.5)return 0.;
  vec3 sampleNormal=anOctDecode(metadata.gb);
  float agreement=max(0.,dot(normal,sampleNormal));
  if(agreement<.75)return 0.;
  float distanceToCamera=anMetadataDistance(metadata);
  vec3 displacement=anPositionAtDistance(sampleUv,distanceToCamera)-position;
  float planeError=max(abs(dot(normal,displacement)),abs(dot(sampleNormal,displacement)));
  // Include RGBA16F sqrt-depth quantization in the world-space tolerance.
  float tolerance=max(.015,max(-position.z,distanceToCamera)*.0015);
  if(planeError>2.5*tolerance)return 0.;
  float spatial=exp(-.75*dot(offsetInTexels,offsetInTexels));
  float edge=exp(-planeError/tolerance);
  return spatial*edge*pow(agreement,16.);
}
`;
export const compositeMain=/* glsl */ `
uniform sampler2D anSceneColor,anLighting,anFog;
uniform bool anUseVolume;
void main(){
 vec4 color=texture2D(anSceneColor,vUv);float depth=anReadDepth(vUv);
 vec3 p=anPositionAtDistance(vUv,anViewDistance(depth)),result=color.rgb;
 if(depth<.999999){
  vec3 n=anDepthNormal(vUv);vec4 lighting=vec4(0.),fog=vec4(0.);float sum=0.;
  vec2 center=floor(vUv*anLightingResolution);
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
   vec2 pixel=center+vec2(float(x),float(y));
   if(any(lessThan(pixel,vec2(0.)))||any(greaterThanEqual(pixel,anLightingResolution)))continue;
   vec2 uv=(pixel+.5)/anLightingResolution;
   vec4 geometry=texture2D(anMetadata,uv);if(geometry.a<.5)continue;
   vec2 offset=uv*anLightingResolution-vUv*anLightingResolution;
   float weight=anBilateralWeight(p,n,geometry,uv,offset);
   if(weight<.000001)continue;
   lighting+=texture2D(anLighting,uv)*weight;
   if(anUseVolume)fog+=texture2D(anFog,uv)*weight;
   sum+=weight;
  }
  if(sum>.00001){
   lighting/=sum;result=result*lighting.a+lighting.rgb*min(color.rgb+.06,vec3(1.));
   if(anUseVolume)result=anCompositeAtmosphere(result,p,fog/sum);
  }else if(anUseVolume)result=anApplyAtmosphere(result,p,vUv);
 }
 gl_FragColor=vec4(max(result,vec3(0.)),color.a);gl_FragDepth=depth;
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;
export const volumeMain=/* glsl */ `
void main(){gl_FragColor=anIntegrateAtmosphere(anViewPosition(vUv),vUv);}
`;
export const historyMain=/* glsl */ `
uniform sampler2D anFogRaw,anFogHistory;
uniform mat4 anPreviousView,anPreviousProjection;
uniform bool anHistoryValid;
void main(){
 vec4 current=texture2D(anFogRaw,vUv),geometry=texture2D(anMetadata,vUv);
 if(!anHistoryValid||geometry.a<.5){gl_FragColor=current;return;}
 vec3 p=anViewPosition(vUv);vec4 world=anCameraWorld*vec4(p,1.);
 vec4 previousView=anPreviousView*world,clip=anPreviousProjection*previousView;
 if(clip.w<=0.){gl_FragColor=current;return;}
 vec2 uv=clip.xy/clip.w*.5+.5;
 vec2 margin=.5/anLightingResolution;
 if(any(lessThan(uv,margin))||any(greaterThan(uv,vec2(1.)-margin))){gl_FragColor=current;return;}
 // Validate each history tap against the surface it actually represented.
 vec3 previousNormal=normalize(mat3(anPreviousView)*mat3(anCameraWorld)*anOctDecode(geometry.gb));
 vec2 pixel=uv*anLightingResolution-.5,base=floor(pixel),fraction=fract(pixel);
 vec4 history=vec4(0.);float total=0.;
 for(int x=0;x<2;x++)for(int y=0;y<2;y++){
  vec2 tap=(base+vec2(float(x),float(y))+.5)/anLightingResolution;
  vec4 prior=texture2D(anPreviousMetadata,tap);
  float delta=abs(anMetadataDistance(prior)+previousView.z);
  if(prior.a<.5||delta>max(.05,-previousView.z*.008)||dot(previousNormal,anOctDecode(prior.gb))<.85)continue;
  vec2 w=mix(vec2(1.)-fraction,fraction,vec2(float(x),float(y)));
  float weight=w.x*w.y;history+=texture2D(anFogHistory,tap)*weight;total+=weight;
 }
 if(total<.5){gl_FragColor=current;return;}
 vec4 lo=current,hi=current;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  vec2 tap=clamp(vUv+vec2(float(x),float(y))/anLightingResolution,margin,vec2(1.)-margin);
  vec4 neighborGeometry=texture2D(anMetadata,tap);
  if(neighborGeometry.a<.5||abs(anMetadataDistance(neighborGeometry)-anMetadataDistance(geometry))>max(.05,-p.z*.008)||dot(anOctDecode(neighborGeometry.gb),anOctDecode(geometry.gb))<.85)continue;
  vec4 sampleValue=texture2D(anFogRaw,tap);lo=min(lo,sampleValue);hi=max(hi,sampleValue);
 }
 history=clamp(history/total,lo,hi);
 // Current-frame neighborhood clamp bounds disocclusion/lighting ghosts.
 gl_FragColor=mix(current,history,.82);
}
`;
