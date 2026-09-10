// Austral distant canopy proxy. Four triangles replace the two old crossed cards.
// Habitat coverage is authored visual adaptation, not a forestry survey.
export function planAustralCanopyStands(trees,{heightAt,roadField,cellM,habitat}){
 const bounds=heightAt.bounds;if(!bounds||bounds.isEmpty())return[];
 const area=(bounds.max.x-bounds.min.x)*(bounds.max.z-bounds.min.z);
 const step=cellM||Math.max(28,Math.sqrt(area/(16000*1.2))),used=new Set(),stands=[];
 for(const tree of trees){
  const ix=Math.floor((tree.position[0]-bounds.min.x)/step),iz=Math.floor((tree.position[2]-bounds.min.z)/step),key=ix+':'+iz;
  if(used.has(key))continue;used.add(key);
  const x=bounds.min.x+(ix+.5)*step,z=bounds.min.z+(iz+.5)*step;
  const h=habitat(x,z);if(h.grove<.18)continue;
  const span=Math.min(step*1.08,2*(x-bounds.min.x),2*(bounds.max.x-x),2*(z-bounds.min.z),2*(bounds.max.z-z)),r=span*.5,y=heightAt(x,z),q=roadField(x,z);
  if(!Number.isFinite(y)||q.distanceM<160||y<q.position[1]-180||y>q.position[1]+470)continue;
  const corners=[[-r,-r],[r,-r],[r,r],[-r,r]].map(([dx,dz])=>heightAt(x+dx,z+dz));
  const supports=[...corners,...[[0,-r],[r,0],[0,r],[-r,0]].map(([dx,dz])=>heightAt(x+dx,z+dz))];
  if(supports.some(v=>!Number.isFinite(v)||Math.abs(v-y)>r*1.15))continue;
  if([[-r,-r],[r,-r],[r,r],[-r,r]].some(([dx,dz])=>roadField(x+dx,z+dz).distanceM<160))continue;
  const height=15+Math.min(1,h.maturity)*5;
  stands.push({...tree,position:[x,y,z],height,width:span/height,rotation:0,variation:0,roadDistanceM:q.distanceM,canopyStand:true,canopySpanM:span,canopyGround:corners.map(v=>(v-y)/height)});
 }
 return stands;
}
export function createForestImpostorGeometry(T){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute([-.5,-.02,0,.5,-.02,0,.5,.98,0,-.5,.98,0,0,-.02,-.5,0,-.02,.5,0,.98,.5,0,.98,-.5],3));
 g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],2));
 g.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);g.computeVertexNormals();
 g.setAttribute('asfaltoStandPosition',new T.Float32BufferAttribute([0,1,0,-.5,.72,-.5,-.5,.72,.5,.5,.72,.5,0,1,0,.5,.72,.5,.5,.72,-.5,-.5,.72,-.5],3));
 const fan=new T.BufferGeometry();fan.setAttribute('position',g.attributes.asfaltoStandPosition);fan.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);fan.computeVertexNormals();g.setAttribute('asfaltoStandNormal',fan.attributes.normal.clone());fan.dispose();
 g.setAttribute('asfaltoGroundWeights',new T.Float32BufferAttribute([0,0,0,0,1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],4));
 g.computeBoundingBox();g.boundingBox.min.set(-.5,-.02,-.5);g.boundingBox.max.set(.5,1,.5);g.computeBoundingSphere();return g;
}
export function installAustralCanopyShader(material){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  previous(shader);
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute float asfaltoCanopyStand;
attribute vec3 asfaltoStandPosition;
attribute vec3 asfaltoStandNormal;
attribute vec4 asfaltoGroundWeights;
attribute vec4 asfaltoCanopyGround;
varying float vCanopyStand;
varying vec3 vCanopyWorld;`);
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec3 crownNormal=normalize(vec3(objectNormal.x*.34,.88,objectNormal.z*.34));objectNormal=mix(crownNormal,asfaltoStandNormal,asfaltoCanopyStand);');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vCanopyStand=asfaltoCanopyStand;
transformed=mix(transformed,asfaltoStandPosition,asfaltoCanopyStand);
transformed.y+=dot(asfaltoGroundWeights,asfaltoCanopyGround)*asfaltoCanopyStand;
vCanopyWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying float vCanopyStand;
varying vec3 vCanopyWorld;
float australCanopyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec4 australBaseColor=diffuseColor;
#include <map_fragment>
// Keep the map anchor at main scope: advanced-materials declares data here
// that its roughness and normal stages consume later.
if(vCanopyStand<.5){diffuseColor.rgb*=1.18;}
if(vCanopyStand>.5){
 float crown=australCanopyNoise(vCanopyWorld.xz*.16),grove=australCanopyNoise(vCanopyWorld.xz*.018);
 diffuseColor=australBaseColor;
 diffuseColor.rgb*=mix(vec3(.068,.12,.045),vec3(.19,.27,.105),crown)*mix(.83,1.15,grove);
}`);
  // A card represents both sides of the same crown, so its upward shading
  // normal must not be flipped on its back face. The closed stand keeps its
  // geometric front/back behavior.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
if(vCanopyStand<.5)normal*=faceDirection;
#endif`);
 };
 material.customProgramCacheKey=()=>key+'-austral-closed-stand-v4-two-sided-crown';
}
