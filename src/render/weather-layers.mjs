const NOISE = `
float anHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float anNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(anHash(i),anHash(i+vec2(1,0)),f.x),mix(anHash(i+vec2(0,1)),anHash(i+vec2(1)),f.x),f.y);}
float anFbm(vec2 p){return anNoise(p)*.54+anNoise(p*2.03+11.7)*.28+anNoise(p*4.07-7.1)*.13+anNoise(p*8.1)*.05;}
`;
export function effectsRandom(seed = 6147) { let value=seed>>>0;return()=>{value=Math.imul(value,1664525)+1013904223>>>0;return value/4294967296;}; }
export function effectsQuad(THREE, count, seed = 6147) {
  const base=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.copy(base);base.dispose();
  const values=new Float32Array(count*4),random=effectsRandom(seed);for(let i=0;i<values.length;i++)values[i]=random();
  geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(values,4));geometry.instanceCount=0;return geometry;
}
const LOG_VERTEX = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const LOG_FRAGMENT = '#include <logdepthbuf_pars_fragment>';
export function createWeatherLayers(THREE, parent) {
  const shared={uTime:{value:0},uCenter:{value:new THREE.Vector3()},uRight:{value:new THREE.Vector3(1,0,0)},uUp:{value:new THREE.Vector3(0,1,0)},uVelocity:{value:new THREE.Vector3()},uWind:{value:1},uWindVector:{value:new THREE.Vector3(1,0,.3)},uColor:{value:new THREE.Color('#c1d0d5')}};
  const rainUniforms={...shared,uIntensity:{value:0},uSnow:{value:0},uSnowIntensity:{value:0},uSnowDetail:{value:1},uSnowTurbulence:{value:.65},uSnowLayerSplit:{value:new THREE.Vector2(.48,.82)},uSnowSizeScale:{value:1},uSnowOpacity:{value:1},uSnowColor:{value:new THREE.Color()},uSnowExtents:{value:[new THREE.Vector3(18,14,24),new THREE.Vector3(42,24,48),new THREE.Vector3(78,36,92)]},uGround:{value:0},uCarInverse:{value:new THREE.Matrix4()},uEnclosed:{value:0}};
  const precipitationMaterial=new THREE.ShaderMaterial({name:'AN_ScaledPrecipitation',uniforms:rainUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`${LOG_VERTEX}
attribute vec4 aSeed;uniform float uTime,uIntensity,uSnow,uSnowIntensity,uSnowTurbulence,uWind,uGround;uniform vec3 uSnowExtents[3];uniform vec2 uSnowLayerSplit;uniform float uSnowSizeScale;
uniform vec3 uCenter,uRight,uUp,uVelocity,uWindVector;varying vec2 vUv;varying float vAlpha,vSeed,vImpact,vSnowDepth;varying vec3 vWorld;
void main(){
 vUv=uv;vSeed=fract(aSeed.x*19.71+aSeed.z*13.17);vImpact=float(aSeed.w>.97&&uSnow<.5);vSnowDepth=0.;
 vec3 world;
 if(uSnow>.5){
  // Nested world-space volumes retain depth at the same fixed particle budget.
  // The seed/trajectory stays put as the camera moves; only distant cells wrap.
  float layer=aSeed.w<uSnowLayerSplit.x?0.:aSeed.w<uSnowLayerSplit.y?1.:2.;
  vec3 extent=layer<.5?uSnowExtents[0]:layer<1.5?uSnowExtents[1]:uSnowExtents[2];
  float fall=.45+pow(vSeed,.72)*1.85;
  vec3 drift=vec3(uWindVector.x*(.42+vSeed*.38),-fall,uWindVector.z*(.42+vSeed*.38));
  vec3 p=mod(aSeed.xyz*extent+drift*uTime-uCenter,extent)-extent*.5;
  float phase=dot(aSeed.xyz,vec3(37.1,91.7,53.3));
  float gust=sin(uTime*.57+phase*.13);
  p.x+=(sin(uTime*(.72+vSeed*.54)+phase)+sin(uTime*1.73+phase*1.7)*.26)*uSnowTurbulence;
  p.z+=(cos(uTime*(.51+vSeed*.61)+phase)+gust*.3)*uSnowTurbulence*.76;
  p.y+=sin(uTime*1.1+phase)*.16*uSnowTurbulence+2.;
  float range=length(p),limit=extent.x*.56;
  vSnowDepth=clamp(range/42.,0.,1.);
  vAlpha=smoothstep(.45,1.15,range)*(1.-smoothstep(limit*.72,limit,range))*(.62+vSeed*.38);
  float size=(.017+pow(vSeed,1.35)*.046)*(1.+layer*.52)*mix(uSnowSizeScale,1.,layer*.32);
  float spin=uTime*(.35+vSeed*1.2)+phase;
  vec2 rotated=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*position.xy;
  rotated.y*=.58+.42*abs(sin(uTime*(.63+vSeed)+phase));
  // Slight exposure stretch follows relative air flow, without rain-like streaks.
  vec3 velocity=drift-uVelocity;
  vec2 screenFlow=vec2(dot(velocity,uRight),dot(velocity,uUp));
  vec2 blur=screenFlow*min(.0025,.035/max(1.,length(screenFlow)))*position.y;
  world=uCenter+p+uRight*(rotated.x*size+blur.x)+uUp*(rotated.y*size+blur.y);
  vAlpha*=smoothstep(-.08,.32,world.y-uGround);
 }else{
  float fall=16.+aSeed.w*9.;vec3 drift=vec3(uWindVector.x,-fall,uWindVector.z),velocity=drift-uVelocity;
  vec3 p=mod(aSeed.xyz*vec3(72.,30.,92.)+drift*uTime-uCenter,vec3(72.,30.,92.))-vec3(36.,5.,46.);
  float size=.009+aSeed.w*.012;vec3 streak=normalize(velocity)*min(length(velocity)*(.015+aSeed.w*.009),1.1);
  world=uCenter+p+uRight*position.x*size+streak*position.y;
  vAlpha=smoothstep(1.1,3.,length(p))*(1.-smoothstep(34.,50.,length(p)))*(.35+aSeed.w*.65);
  if(vImpact>.5){float phase=fract(uTime*1.6+aSeed.x*19.);world=uCenter+vec3(p.x*.32,-uCenter.y+uGround+.018,p.z*.32)+vec3(position.x,0.,position.y)*(.025+phase*.12);vAlpha=(1.-phase)*.38;}
 }
 vWorld=world;
 vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;
 #include <logdepthbuf_vertex>
}`,
    fragmentShader:`${LOG_FRAGMENT}
uniform float uIntensity,uSnow,uSnowIntensity,uSnowDetail,uEnclosed,uSnowOpacity;uniform mat4 uCarInverse;uniform vec3 uColor,uSnowColor;
varying vec2 vUv;varying float vAlpha,vSeed,vImpact,vSnowDepth;varying vec3 vWorld;
void main(){
 vec3 car=(uCarInverse*vec4(vWorld,1.)).xyz;
 if(uEnclosed>.5&&abs(car.x)<1.75&&abs(car.z)<.91&&car.y>-.4&&car.y<1.4)discard;
 vec2 p=vUv-.5;float radius=length(p),alpha;vec3 color=uColor;
 if(uSnow>.5){
  float angle=atan(p.y,p.x),detail=uSnowDetail*(1.-vSnowDepth);
  // Rounded aggregates mix with small crystal lobes; derivatives keep distant
  // flakes stable instead of turning subpixel detail into sparkling points.
  float edge=.31+.035*cos(angle*6.+vSeed*8.)*detail+.018*cos(angle*11.+vSeed*23.)*detail;
  float aa=max(fwidth(radius)*1.25,.035+vSnowDepth*.025);
  float flake=1.-smoothstep(edge-aa,edge+aa,radius);
  float core=1.-smoothstep(.04,.30,radius);
  alpha=min(.92,flake*(.56+core*.3)*vAlpha*(.58+uSnowIntensity*.30)*uSnowOpacity);
  // Diffuse ice follows the sampled sky radiance; no night-time white emission.
  color=uSnowColor*(.8+core*.30+vSeed*.20);
 }else{
  float rain=(1.-smoothstep(.18,.5,abs(p.x)))*smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.64,1.,vUv.y));
  alpha=rain*vAlpha*.18*(.55+uIntensity*.45);
  if(vImpact>.5)alpha=(1.-smoothstep(.025,.075,abs(radius-.36)))*vAlpha*uIntensity;
 }
 if(alpha<.005)discard;gl_FragColor=vec4(color,alpha);
 #include <logdepthbuf_fragment>
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
  const rain=new THREE.Mesh(effectsQuad(THREE,3200),precipitationMaterial);rain.name='AN_RainSnowStreaks';rain.frustumCulled=false;rain.visible=false;parent.add(rain);
  function atmosphere(name,count,mist) {
    const uniforms={...shared,uOpacity:{value:0},uMist:{value:mist?1:0},uGround:{value:0}};
    const material=new THREE.ShaderMaterial({name,uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`${LOG_VERTEX}
attribute vec4 aSeed;uniform float uTime,uWind,uMist,uGround;uniform vec3 uCenter,uRight,uUp,uWindVector;varying vec2 vUv;varying float vSeed;
void main(){vUv=uv;vSeed=aSeed.w;float angle=aSeed.x*6.283185;float range=mix(600.+aSeed.y*1250.,95.+aSeed.y*390.,uMist);
vec2 extent=mix(vec2(3600.),vec2(900.),uMist);vec2 xz=mod(vec2(cos(angle),sin(angle))*range+uWindVector.xz*uTime*mix(.32,.12,uMist)-uCenter.xz+extent*.5,extent)-extent*.5;
vec3 p=vec3(uCenter.x+xz.x,mix(uGround+230.+aSeed.z*170.,uGround+5.+aSeed.z*16.,uMist),uCenter.z+xz.y);
vec2 size=mix(vec2(420.,105.)*(.7+aSeed.z*.7),vec2(105.,24.)*(.7+aSeed.z),uMist);
vec3 world=p+uRight*position.x*size.x+uUp*position.y*size.y;vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;
#include <logdepthbuf_vertex>
}`,
      fragmentShader:`${LOG_FRAGMENT}
${NOISE}
uniform float uTime,uOpacity,uMist;uniform vec3 uColor;varying vec2 vUv;varying float vSeed;
void main(){vec2 p=vUv-.5;float edge=1.-smoothstep(.22,.5,length(p*vec2(.92,1.15)));float density=anFbm(vUv*vec2(5.5,3.)+vec2(vSeed*31.+uTime*.006,0.));float cloud=smoothstep(.32,.71,density)*edge;float alpha=cloud*uOpacity; if(alpha<.008)discard;
vec3 lit=uColor*mix(.67,1.04,smoothstep(.1,.88,vUv.y)+density*.12);gl_FragColor=vec4(lit,alpha);
#include <logdepthbuf_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
    const mesh=new THREE.Mesh(effectsQuad(THREE,count,mist?128:912),material);mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;parent.add(mesh);return{mesh,uniforms,material};
  }
  const clouds=atmosphere('AN_LayeredClouds',16,false),mist=atmosphere('AN_ValleyMist',9,true);
  const cameraPosition=new THREE.Vector3(),carMatrix=new THREE.Matrix4(),carScale=new THREE.Vector3(1,1,1);
  return {
    update({time,camera,policy,velocity,groundY=0,color,wind,vehicle={},valleyFloorM}) {
      shared.uTime.value=time;camera.getWorldPosition(cameraPosition);shared.uCenter.value.copy(cameraPosition);
      shared.uRight.value.setFromMatrixColumn(camera.matrixWorld,0);shared.uUp.value.setFromMatrixColumn(camera.matrixWorld,1);
      shared.uVelocity.value.copy(velocity);shared.uWind.value=policy.wind;if(wind)shared.uWindVector.value.copy(wind);if(color)shared.uColor.value.set(color);
      rainUniforms.uGround.value=groundY;rainUniforms.uEnclosed.value=vehicle.position&&vehicle.enclosed!==false?1:0;if(vehicle.position)rainUniforms.uCarInverse.value.copy(carMatrix.compose(vehicle.position,vehicle.quaternion||new THREE.Quaternion(),carScale)).invert();
      const snowIntensity=policy.snow?Math.max(0,Math.min(1,Number(policy.snowIntensity??policy.intensity)||0)):0;
      rainUniforms.uIntensity.value=policy.intensity;rainUniforms.uSnow.value=Number(policy.snow);rainUniforms.uSnowIntensity.value=snowIntensity;
      rainUniforms.uSnowDetail.value=policy.tier.snow>=1600?1:policy.tier.snow>=950?.65:.3;
      const heavy=policy.heavySnow===true;
      rainUniforms.uSnowLayerSplit.value.set(heavy?.76:.48,heavy?.93:.82);
      rainUniforms.uSnowSizeScale.value=heavy?1.7:1;rainUniforms.uSnowOpacity.value=heavy?1.28:1;
      // Concentrate existing particles close enough to resolve on a low-tier
      // framebuffer, retaining the three world-space depth layers and trajectories.
      rainUniforms.uSnowExtents.value[0].set(heavy?10:18,heavy?8:14,heavy?12:24);
      rainUniforms.uSnowExtents.value[1].set(heavy?28:42,heavy?18:24,heavy?34:48);
      rainUniforms.uSnowColor.value.setRGB(shared.uColor.value.r*.96,shared.uColor.value.g*.98,shared.uColor.value.b);
      rainUniforms.uSnowTurbulence.value=.55+snowIntensity*.62+(policy.heavySnow?.32:0);
      const budget=Math.min(3200,policy.snow?policy.tier.snow:policy.tier.rain);
      rain.geometry.instanceCount=Math.max(0,Math.min(budget,Math.round(Number(policy.precipitationCount)||0)));rain.visible=rain.geometry.instanceCount>0;
      clouds.uniforms.uOpacity.value=policy.clouds;clouds.uniforms.uGround.value=valleyFloorM??groundY;clouds.mesh.geometry.instanceCount=policy.tier.clouds;clouds.mesh.visible=policy.clouds>.01;
      mist.uniforms.uOpacity.value=policy.mist;mist.uniforms.uGround.value=valleyFloorM??groundY;mist.mesh.geometry.instanceCount=policy.tier.mist;mist.mesh.visible=policy.mist>.01;
    },
    diagnostics:()=>({precipitation:rain.geometry.instanceCount,clouds:clouds.mesh.visible?clouds.mesh.geometry.instanceCount:0,mist:mist.mesh.visible?mist.mesh.geometry.instanceCount:0,enclosedExclusion:rainUniforms.uEnclosed.value===1,rainImpactFraction:.03,snowDepthLayers:3,snowNearFraction:rainUniforms.uSnowLayerSplit.value.x,snowSizeScale:rainUniforms.uSnowSizeScale.value,snowOpacity:rainUniforms.uSnowOpacity.value,snowIntensity:rainUniforms.uSnowIntensity.value,snowDetail:rainUniforms.uSnowDetail.value,snowTurbulence:rainUniforms.uSnowTurbulence.value,wind:shared.uWindVector.value.toArray()}),
    dispose(){for(const mesh of [rain,clouds.mesh,mist.mesh]){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}},
  };
}
