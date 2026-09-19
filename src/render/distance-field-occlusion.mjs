import {graphicsQualityFamily} from './graphics-quality-policy.mjs';
// Analytic signed distance to camera-local OBB proxies. This is deliberately a
// proxy approximation of opaque solids, not a voxel bake or a renamed BVH.
const LIMIT=64,RANGE_M=25;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createDistanceFieldOcclusion(T,{scene,maxObjects=64}={}){
 if(!scene?.traverse)throw new TypeError('DFAO requires a scene root');
 const capacity=clamp(Math.floor(Number(maxObjects)||64),1,LIMIT);
 const data=new Float32Array(4*LIMIT*4),texture=new T.DataTexture(data,4,LIMIT,T.RGBAFormat,T.FloatType);
 texture.name='Analytic OBB distance-field proxies';texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;
 const uniforms={anDfaProxyTexture:{value:texture},anDfaCount:{value:0},anDfaEnabled:{value:1},anDfaRays:{value:3},anDfaSteps:{value:4},anDfaRange:{value:4},anDfaStrength:{value:.38}};
 const cameraPoint=new T.Vector3(),center=new T.Vector3(),scale=new T.Vector3(),position=new T.Vector3(),rotation=new T.Quaternion(),matrix=new T.Matrix4(),instance=new T.Matrix4(),size=new T.Vector3();
 let proxies=[],tier='high',disposed=false,candidates=0;
 function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
 function allowed(o){
  if(!o.isMesh||o.isSkinnedMesh||!o.geometry?.attributes?.position||!visible(o)||o.geometry.drawRange.count===0)return false;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(!mats.length||mats.some(m=>!m||m.transparent||m.opacity<.98||m.alphaTest>0||m.transmission>0))return false;
  let ancestry='';for(let p=o;p&&p!==scene;p=p.parent)ancestry+=' '+p.name;
  for(let p=o;p&&p!==scene;p=p.parent)if(p.userData.vehicleSelectionMount||/ApprovedExterior|PresentationPivot|StationaryBrakePivot|^RaceVehicle_|^WorkshopVehicle_|^COLLISION_/i.test(p.name))return false;
  if(/tree|foliage|canopy|broadleaf|grass|vegetation|shrub|leaf|leaves|palm|fern/i.test(ancestry))return false;
  const name=o.name+' '+mats.map(m=>m.name+' '+(m.userData.asfaltoSurfaceRole||'')).join(' ');
  if(/terrain|floor|ground|road|asphalt|water|lake|river|backdrop|mountain|sky|snow.sheet/i.test(name)&&!/\brock\b|_rock|rock_|wall|building|facade|brick/i.test(name))return false;
  return o.userData.asfaltoDistanceFieldProxy===true||/rock|boulder|stone|basalt|building|wall|house|facade|brick|concrete|pillar|column|bridge|shed|garage/i.test(name);
 }
 function add(o,world,localBox,list,index=-1){
  world.decompose(position,rotation,scale);if(![...world.elements].every(Number.isFinite)||Math.min(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z))<1e-5)return;
  localBox.getCenter(center).applyMatrix4(world);localBox.getSize(size).multiply(scale).multiplyScalar(.5);size.set(Math.abs(size.x),Math.abs(size.y),Math.abs(size.z));
  // A merged perimeter wall is a hollow room, not one solid OBB. Without
  // component proxies, omit broad wall batches rather than fill their floor.
  // Check local scaled axes so a single thin wall remains valid when rotated.
  const materials=Array.isArray(o.material)?o.material:[o.material];
  if(!o.isInstancedMesh&&/batch|merged|combined/i.test(o.name)&&/wall|pared/i.test(o.name+' '+materials.map(m=>m.name).join(' '))&&Math.min(size.x,size.z)>2)return;
  const radius=size.length();
  const cameraLocal=cameraPoint.clone().sub(center).applyQuaternion(rotation.clone().normalize().conjugate());
  // A room shell can have a closed bounding box around the viewer. Never
  // interpret an occupied camera volume as opaque material.
  if(Math.abs(cameraLocal.x)<size.x&&Math.abs(cameraLocal.y)<size.y&&Math.abs(cameraLocal.z)<size.z)return;
  // Reject giant merged scenery and wide, flat ground sheets.
  if(radius<.04||Math.max(size.x,size.y,size.z)>12||size.x>6&&size.z>6&&size.y<.7)return;
  const distance=Math.max(0,center.distanceTo(cameraPoint)-radius);if(distance>RANGE_M)return;
  list.push({name:o.name,index,center:center.clone(),half:size.clone(),rotation:rotation.clone().normalize(),radius,distance});
 }
 function refresh({camera}={}){
  if(disposed)return 0;
  if(camera?.getWorldPosition)camera.getWorldPosition(cameraPoint);else if(camera?.position)cameraPoint.copy(camera.position);else cameraPoint.set(0,0,0);
  scene.updateWorldMatrix?.(true,true);const list=[];
  scene.traverse(o=>{
   if(!allowed(o))return;const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const box=g.boundingBox;if(!box||box.isEmpty())return;
   if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);matrix.multiplyMatrices(o.matrixWorld,instance);add(o,matrix,box,list,i);}}
   else add(o,o.matrixWorld,box,list);
  });
  candidates=list.length;list.sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name)||a.index-b.index);
  proxies=list.slice(0,Math.min(capacity,tier==='high'?16:8));data.fill(0);
  proxies.forEach((p,i)=>{data.set([...p.center.toArray(),p.radius,...p.half.toArray(),1,...p.rotation.toArray(),p.distance,0,0,0],i*16);});
  uniforms.anDfaCount.value=proxies.length;texture.needsUpdate=true;return proxies.length;
 }
 function setQuality(value='high'){tier=graphicsQualityFamily(value)==='high'?'high':value==='low'||value==='off'?'low':'balanced';uniforms.anDfaEnabled.value=tier==='low'?0:1;uniforms.anDfaRays.value=tier==='high'?3:2;uniforms.anDfaSteps.value=tier==='high'?4:3;uniforms.anDfaCount.value=Math.min(proxies.length,tier==='high'?16:8);}
 function sampleDistance(point){
  const p=point?.isVector3?point:new T.Vector3().fromArray(point),local=new T.Vector3();let result=1e4;
  for(const proxy of proxies){local.copy(p).sub(proxy.center).applyQuaternion(proxy.rotation.clone().conjugate());const x=Math.abs(local.x)-proxy.half.x,y=Math.abs(local.y)-proxy.half.y,z=Math.abs(local.z)-proxy.half.z;result=Math.min(result,Math.hypot(Math.max(x,0),Math.max(y,0),Math.max(z,0))+Math.min(Math.max(x,y,z),0));}
  return result;
 }
 return {uniforms,glsl:GLSL,refresh,setQuality,sampleDistance,
  diagnostics:()=>({enabled:!!uniforms.anDfaEnabled.value,tier,representation:'analytic-signed-distance-OBB-proxies',approximation:'opaque local bounding boxes; broad merged wall envelopes, terrain slabs, foliage and vehicles omitted',proxyCount:uniforms.anDfaCount.value,candidates,capacity,rangeM:RANGE_M,rays:uniforms.anDfaRays.value,steps:uniforms.anDfaSteps.value,proxies:proxies.map(p=>({name:p.name,index:p.index,center:p.center.toArray(),halfExtent:p.half.toArray(),rotation:p.rotation.toArray(),distanceM:p.distance})),disposed}),
  dispose(){if(disposed)return;disposed=true;proxies=[];uniforms.anDfaCount.value=0;uniforms.anDfaEnabled.value=0;texture.dispose();}
 };
}
const GLSL=/* glsl */`
uniform sampler2D anDfaProxyTexture;
uniform int anDfaCount,anDfaRays,anDfaSteps;
uniform float anDfaEnabled,anDfaRange,anDfaStrength;
vec3 anDfaInverseRotate(vec3 p,vec4 q){
 vec3 a=-q.xyz;return p+2.0*cross(a,cross(a,p)+q.w*p);
}
float anDfaDistance(vec3 p){
 float nearest=10000.0;
 for(int i=0;i<16;i++){
  if(i>=anDfaCount)break;
  float row=(float(i)+.5)/64.0;
  vec4 center=texture2D(anDfaProxyTexture,vec2(.125,row));
  // A sphere lower bound rejects distant solids before loading their axes.
  if(length(p-center.xyz)-center.w>min(nearest,anDfaRange))continue;
  vec3 halfExtent=texture2D(anDfaProxyTexture,vec2(.375,row)).xyz;
  vec4 orientation=texture2D(anDfaProxyTexture,vec2(.625,row));
  vec3 q=abs(anDfaInverseRotate(p-center.xyz,orientation))-halfExtent;
  nearest=min(nearest,length(max(q,vec3(0.0)))+min(max(q.x,max(q.y,q.z)),0.0));
 }
 return nearest;
}
float anDistanceFieldAO(vec3 worldPosition,vec3 worldNormal){
 if(anDfaEnabled<.5||anDfaCount==0)return 1.0;
 vec3 n=normalize(worldNormal);
 vec3 tangent=normalize(cross(abs(n.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.),n));
 vec3 bitangent=cross(n,tangent);
 float occlusion=0.;
 for(int ray=0;ray<3;ray++){
  if(ray>=anDfaRays)break;
  float phi=float(ray)*2.39996323;
  vec3 direction=normalize(n*.80+(tangent*cos(phi)+bitangent*sin(phi))*.60);
  float travel=.13,visibility=1.;
  for(int step=0;step<4;step++){
   if(step>=anDfaSteps||travel>anDfaRange)break;
   float distanceToSolid=anDfaDistance(worldPosition+n*.075+direction*travel);
   if(distanceToSolid<.035){visibility=0.;break;}
   visibility=min(visibility,clamp(distanceToSolid/(travel*.55),0.,1.));
   travel+=max(.12,distanceToSolid*.85);
  }
  occlusion+=1.-visibility;
 }
 return clamp(1.-anDfaStrength*occlusion/max(1.,float(anDfaRays)),.55,1.);
}
`;
