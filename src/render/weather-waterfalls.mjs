import { effectsQuad } from './weather-layers.mjs';

/** A foam footprint clipped against the actual receiving-water triangles. */
export function createImpactFoamGeometry(T,emitters){
 const positions=[],uv=[];const cross=(a,b,p)=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);
 for(const e of emitters)for(const segment of e.segments||[]){
  const a=segment.a,b=segment.b,dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<.05)continue;
  const radius=Math.min(14,Math.max(3,e.radius*.7)),nx=-dz/length,nz=dx/length;
  const strip=[[a[0]-nx*radius,a[1],a[2]-nz*radius],[b[0]-nx*radius,b[1],b[2]-nz*radius],[b[0]+nx*radius,b[1],b[2]+nz*radius],[a[0]+nx*radius,a[1],a[2]+nz*radius]];
  for(const triangle of e.receiverTriangles||[]){
   if(Math.abs(triangle[0][1]-a[1])>.1)continue;let polygon=strip.map(p=>[...p]);const sign=Math.sign(cross(triangle[0],triangle[1],triangle[2]));if(!sign)continue;
   for(let edge=0;edge<3&&polygon.length;edge++){const p=triangle[edge],q=triangle[(edge+1)%3],out=[];for(let i=0;i<polygon.length;i++){const u=polygon[i],v=polygon[(i+1)%polygon.length],fu=cross(p,q,u)*sign,fv=cross(p,q,v)*sign;if(fu>=-.00001)out.push(u);if((fu>=0)!==(fv>=0)){const t=fu/(fu-fv);out.push(u.map((x,k)=>x+(v[k]-x)*t));}}polygon=out;}
   for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]]){positions.push(p[0],p[1]+.045,p[2]);uv.push(((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(length*length),((p[0]-a[0])*nx+(p[2]-a[2])*nz)/radius*.5+.5);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(positions.length){g.computeBoundingBox();g.computeBoundingSphere();}return g;
}

/** Flow on the delivered vertical curtains; local impact spray shares one bounded batch. */
export function createWaterfallEffects(T,parent){
  const uniforms={uAnFallTime:{value:0}},originals=[],owned=[],hidden=[];let emitters=[],spray=null,foam=null,trackRoot=null;
  const carScale=new T.Vector3(1,1,1),identity=new T.Quaternion();
  const right=new T.Vector3(),up=new T.Vector3(),eye=new T.Vector3();
  function clear(){for(const {mesh,original,assigned}of originals)if(mesh.material===assigned)mesh.material=original;for(const m of owned)m.dispose();for(const {mesh,visible}of hidden)mesh.visible=visible;originals.length=owned.length=hidden.length=0;emitters=[];if(foam){foam.removeFromParent();foam.geometry.dispose();foam.material.dispose();foam=null;}if(spray){spray.removeFromParent();spray.geometry.dispose();spray.material.dispose();spray=null;}trackRoot=null;}
  function setTrack({visualRoot}={}){if(visualRoot===trackRoot)return;clear();trackRoot=visualRoot;if(!trackRoot)return;trackRoot.updateWorldMatrix(true,true);
    trackRoot.traverse(mesh=>{
      if(!mesh.isMesh)return;const fall=mesh.userData.asfaltoWaterfall,aux=mesh.userData.asfaltoWaterfallAux;
      if(aux?.kind==='mist'){hidden.push({mesh,visible:mesh.visible});mesh.visible=false;return;}
      if(!fall&&aux?.kind!=='foam')return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],assigned=materials.map(source=>{
        const material=source.clone(),compile=source.onBeforeCompile,cache=source.customProgramCacheKey;material.depthWrite=!!fall;material.transparent=true;material.roughness=fall?.62:.84;material.envMapIntensity=fall?.2:source.envMapIntensity;if(fall){material.opacity=1;material.metalness=0;}
        const uv=mesh.geometry.attributes.uv;let minU=0,maxU=1;if(fall&&uv){minU=Infinity;maxU=-Infinity;for(let i=0;i<uv.count;i++){minU=Math.min(minU,uv.getX(i));maxU=Math.max(maxU,uv.getX(i));}}
        const localUniforms={...uniforms,uAnFallUvRange:{value:new T.Vector2(minU,maxU)},uAnFallHeight:{value:Math.max(1,fall?.heightM||8)},uAnFallSpeed:{value:fall?.speedMps||.7}};
        material.onBeforeCompile=function(shader,renderer){compile?.call(this,shader,renderer);Object.assign(shader.uniforms,localUniforms);
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAnFallWorld;varying float vAnFallAcross;uniform vec2 uAnFallUvRange;').replace('#include <project_vertex>','#include <project_vertex>\nvAnFallWorld=(modelMatrix*vec4(transformed,1.)).xyz;vAnFallAcross=clamp((uv.x-uAnFallUvRange.x)/max(.001,uAnFallUvRange.y-uAnFallUvRange.x),0.,1.);');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vAnFallWorld;varying float vAnFallAcross;uniform float uAnFallTime,uAnFallHeight,uAnFallSpeed;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
vec2 anFlowUV=vMapUv;
`+(fall?'anFlowUV.y=fract((vAnFallWorld.y+uAnFallTime*uAnFallSpeed)/uAnFallHeight);':'anFlowUV+=vec2(uAnFallTime*.018,uAnFallTime*.008);')+`
vec4 anFallTex=texture2D(map,anFlowUV);
#ifdef DECODE_VIDEO_TEXTURE
anFallTex=sRGBTransferEOTF(anFallTex);
#endif
`+(fall?`
float anFallSide=vAnFallWorld.x*.69+vAnFallWorld.z*.83,anFlowHeight=vAnFallWorld.y+uAnFallTime*uAnFallSpeed;
float anRibbon=.52+.29*sin(anFallSide*2.3+sin(anFlowHeight*.19)*.38)+.16*sin(anFallSide*7.7+anFlowHeight*.07);
float anAeration=clamp(anFallTex.r*.55+anRibbon*.45,0.,1.);
diffuseColor.rgb*=mix(vec3(.60,.73,.77),vec3(.88,.94,.95),.55+anAeration*.45);
float anBank=smoothstep(0.,.035,vAnFallAcross)*(1.-smoothstep(.965,1.,vAnFallAcross));
diffuseColor.a*=mix(.83,.98,anAeration)*anBank;
if(diffuseColor.a<.035)discard;
`:`
float anFoamEdge=1.-smoothstep(.25,.5,length(vMapUv-.5));
diffuseColor.rgb*=vec3(.83,.9,.9);
diffuseColor.a*=anFallTex.a*anFoamEdge*smoothstep(.12,.6,anFallTex.r)*.48;
`)+`
#endif`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float anFallPhase=vAnFallWorld.y+uAnFallTime*uAnFallSpeed;
float anFallHeight=sin(anFallPhase*2.7+vAnFallWorld.x*3.1+vAnFallWorld.z*2.3)*.012+sin(anFallPhase*.8+vAnFallWorld.x*7.3)*.007;
vec3 anFDx=dFdx(-vViewPosition),anFDy=dFdy(-vViewPosition),anFR1=cross(anFDy,normal),anFR2=cross(normal,anFDx);float anFDet=dot(anFDx,anFR1);
normal=normalize(max(abs(anFDet),1e-8)*normal-sign(anFDet)*(dFdx(anFallHeight)*anFR1+dFdy(anFallHeight)*anFR2));`);
        };material.customProgramCacheKey=function(){return(cache?.call(this)||'')+'|an-vertical-waterfall-v4-normalized-curtain-'+(fall?'curtain':'foam');};material.needsUpdate=true;owned.push(material);return material;
      });const original=mesh.material;mesh.material=Array.isArray(original)?assigned:assigned[0];originals.push({mesh,original,assigned:mesh.material});
      if(fall){const box=new T.Box3().setFromObject(mesh),size=box.getSize(new T.Vector3()),axis=size.x>size.z?[1,0]:[0,1];const segments=(fall.impactSegments||[]).map(segment=>({...segment,length:Math.hypot(...segment.a.map((v,i)=>v-segment.b[i]))})).filter(segment=>segment.length>1e-5);emitters.push({center:fall.impactCenter||fall.bottomCenter,axis,width:Math.max(1,fall.impactSpanM||fall.baseWidthM||8),radius:Math.max(2,fall.sprayRadiusM||12),segments,receiverTriangles:fall.impactReceiverTriangles||[],span:segments.reduce((sum,segment)=>sum+segment.length,0)});}
    });
    if(!emitters.length){for(const {mesh,visible}of hidden)mesh.visible=visible;hidden.length=0;return;}
    const geometry=effectsQuad(T,emitters.length*24,839),bases=new Float32Array(emitters.length*24*4),directions=new Float32Array(bases.length);
    for(let i=0;i<emitters.length*24;i++){
      const e=emitters[i%emitters.length];let center=e.center,width=e.width;
      // Sample the exact river/curtain intersection once. Drift remains animated;
      // emission origins never spill onto shore merely because an AABB overlaps it.
      if(e.span>0){let distance=geometry.attributes.aSeed.getX(i)*e.span;for(const segment of e.segments){if(distance<=segment.length){const t=distance/segment.length;center=segment.a.map((v,k)=>v+(segment.b[k]-v)*t);width=0;break;}distance-=segment.length;}}
      bases.set([...center,width],i*4);directions.set([...e.axis,e.radius,0],i*4);
    }
    geometry.setAttribute('aBase',new T.InstancedBufferAttribute(bases,4));geometry.setAttribute('aDirection',new T.InstancedBufferAttribute(directions,4));
    const material=new T.ShaderMaterial({name:'AN_WaterfallImpactMist',transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),...uniforms,uWind:{value:new T.Vector3()},uRight:{value:right},uUp:{value:up},uEye:{value:eye},uCarInverse:{value:new T.Matrix4()},uEnclosed:{value:0},uTint:{value:new T.Color('#bac6bf')}},
      vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
#include <fog_pars_vertex>
attribute vec4 aSeed,aBase,aDirection;uniform float uAnFallTime;uniform vec3 uWind,uRight,uUp,uEye;varying vec2 vUv;varying float vFade,vSeed;varying vec3 vSprayWorld;
void main(){vUv=uv;vSeed=aSeed.w;float life=3.8+aSeed.w*2.8,age=mod(uAnFallTime+aSeed.y*life,life),phase=age/life;
vec3 p=aBase.xyz+vec3(aDirection.x,0.,aDirection.y)*(aSeed.x-.5)*aBase.w+uWind*age*.55;
p.y+=.4+age*(1.3+aSeed.z*.9);p.xz+=vec2(sin(aSeed.w*27.),cos(aSeed.w*27.))*age*.65;
float size=1.8+phase*aDirection.z*.65;vec3 world=p+(uRight*position.x+uUp*position.y)*size;
vSprayWorld=world;vFade=sin(phase*3.14159)*(1.-smoothstep(450.,800.,distance(p,uEye)))*smoothstep(1.2,4.,distance(p,uEye));
vec4 mvPosition=viewMatrix*vec4(world,1.);gl_Position=projectionMatrix*mvPosition;
#include <logdepthbuf_vertex>
#include <fog_vertex>
}`,
      fragmentShader:`#include <logdepthbuf_pars_fragment>
#include <fog_pars_fragment>
uniform vec3 uTint;uniform mat4 uCarInverse;uniform float uEnclosed;varying vec2 vUv;varying float vFade,vSeed;varying vec3 vSprayWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){vec3 localCar=(uCarInverse*vec4(vSprayWorld,1.)).xyz;if(uEnclosed>.5&&abs(localCar.x)<1.75&&abs(localCar.z)<.91&&localCar.y>-.4&&localCar.y<1.4)discard;float edge=1.-smoothstep(.13,.5,length(vUv-.5)),grain=.55*noise(vUv*7.+vSeed*43.)+.3*noise(vUv*15.);float alpha=edge*smoothstep(.18,.7,grain)*vFade*.25;if(alpha<.003)discard;gl_FragColor=vec4(uTint,alpha);
#include <logdepthbuf_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`});
    
    const foamGeometry=createImpactFoamGeometry(T,emitters);
    if(foamGeometry.attributes.position.count){
     const foamMaterial=new T.ShaderMaterial({name:'AN_BasinImpactFoam',transparent:true,depthWrite:false,side:T.DoubleSide,fog:true,uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),...uniforms,uFoamTint:{value:new T.Color('#d6ddd3')}},
      vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
#include <fog_pars_vertex>
varying vec2 vFoamUv;varying vec3 vFoamWorld;
void main(){vFoamUv=uv;vFoamWorld=position;vec4 mvPosition=viewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
#include <logdepthbuf_vertex>
#include <fog_vertex>
}`,fragmentShader:`#include <logdepthbuf_pars_fragment>
#include <fog_pars_fragment>
uniform float uAnFallTime;uniform vec3 uFoamTint;varying vec2 vFoamUv;varying vec3 vFoamWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){float crossStream=abs(vFoamUv.y-.5)*2.,edge=1.-smoothstep(.35,1.,crossStream);vec2 flow=vFoamWorld.xz*.52+vec2(uAnFallTime*.22,-uAnFallTime*.16);float bubbles=noise(flow)*.65+noise(flow*2.8)*.35;float lace=smoothstep(.2,.78,bubbles),churn=.62+.38*sin(crossStream*21.-uAnFallTime*2.4+bubbles*4.);float alpha=edge*(.42+lace*.36)*mix(.82,1.,churn);if(alpha<.015)discard;gl_FragColor=vec4(uFoamTint*mix(.75,1.,lace),alpha);
#include <logdepthbuf_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`});foam=new T.Mesh(foamGeometry,foamMaterial);foam.name='AN_BasinImpactFoam';parent.add(foam);
    }else foamGeometry.dispose();

    spray=new T.Mesh(geometry,material);spray.name='AN_LocalWaterfallSpray';spray.frustumCulled=false;parent.add(spray);
  }
  return{setTrack,clear,update({time,camera,wind,qualityTier='balanced',color,vehicle={}}){uniforms.uAnFallTime.value=time;if(!spray)return;camera.updateMatrixWorld();right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);camera.getWorldPosition(eye);spray.material.uniforms.uEnclosed.value=vehicle.position&&vehicle.enclosed!==false?1:0;if(vehicle.position)spray.material.uniforms.uCarInverse.value.compose(vehicle.position,vehicle.quaternion||identity,carScale).invert();if(wind)spray.material.uniforms.uWind.value.copy(wind);if(color)spray.material.uniforms.uTint.value.copy(color);spray.geometry.instanceCount=emitters.length*(qualityTier==='high'?24:qualityTier==='low'?5:12);},
    diagnostics:()=>({waterfalls:emitters.length,flowMaterials:owned.length,sprayInstances:spray?.geometry.instanceCount||0,drawBatches:(spray?1:0)+(foam?1:0),foamTriangles:(foam?.geometry.attributes.position.count||0)/3,time:uniforms.uAnFallTime.value,flowModel:'source-map-world-height-advection',sourceMistReplaced:hidden.length,impactOrigins:emitters.map(e=>e.center),impactSegmentCount:emitters.reduce((n,e)=>n+e.segments.length,0)}),dispose:clear};
}
