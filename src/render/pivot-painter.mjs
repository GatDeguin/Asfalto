// Pivot Painter style hierarchy inferred from connected branch/leaf components.
// Explicit local pivots and axes drive rotations; the source meshes and physics
// stay unchanged. These are inferred pivots, not an authored Pivot Painter bake.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const materialList=o=>Array.isArray(o.material)?o.material:[o.material];
function components(geometry){
 const p=geometry.attributes.position,index=geometry.index,parent=new Int32Array(p.count);for(let i=0;i<p.count;i++)parent[i]=i;
 const find=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const n=parent[i];parent[i]=r;i=n;}return r;};
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
 const welded=new Map();
 for(let i=0;i<p.count;i++){const key=Math.round(p.getX(i)*10000)+','+Math.round(p.getY(i)*10000)+','+Math.round(p.getZ(i)*10000);if(welded.has(key))join(i,welded.get(key));else welded.set(key,i);}
 const count=index?index.count:p.count;for(let i=0;i+2<count;i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;join(a,b);join(a,c);}
 const groups=new Map();for(let i=0;i<p.count;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}return [...groups.values()];
}
function pivotGeometry(T,source,kind,{baseY=0,heightM=16}={}){
 const geometry=source.clone(),p=geometry.attributes.position,count=p.count,branches=new Float32Array(count*3),leaves=new Float32Array(count*3),axes=new Float32Array(count*3),weights=new Float32Array(count*4),point=new T.Vector3(),box=new T.Box3(),centroid=new T.Vector3(),axis=new T.Vector3(),leafPivot=new T.Vector3(),branchPivot=new T.Vector3();
 const groups=components(geometry),height=Math.max(1,Number(heightM)||16),base=Number(baseY)||0;
 for(const ids of groups){
  box.makeEmpty();centroid.set(0,0,0);for(const i of ids){point.fromBufferAttribute(p,i);box.expandByPoint(point);centroid.add(point);}centroid.divideScalar(ids.length);
  const leaf=kind==='leaf',span=Math.max(.01,box.max.y-box.min.y);
  if(leaf){
   // Leaf hinge on the lower edge; a separate inferred limb hinge connects it
   // to the trunk. Every vertex of a leaf shares its local frame.
   leafPivot.copy(centroid);leafPivot.y=box.min.y;
   branchPivot.set(0,Math.max(base,centroid.y-2.2),0);
   if(ids.length>1)axis.fromBufferAttribute(p,ids[1]).sub(point.fromBufferAttribute(p,ids[0]));else axis.set(1,0,0);
   if(axis.lengthSq()<1e-8)axis.set(1,0,0);axis.normalize();
  }else{
   branchPivot.set(0,0,0);let roots=0;
   for(const i of ids)if(p.getY(i)<box.min.y+Math.max(.02,span*.08)){branchPivot.add(point.fromBufferAttribute(p,i));roots++;}
   branchPivot.divideScalar(Math.max(1,roots));leafPivot.copy(branchPivot);
   axis.set(centroid.z-branchPivot.z,0,-(centroid.x-branchPivot.x));if(axis.lengthSq()<1e-8)axis.set(1,0,0);axis.normalize();
  }
  const phase=(Math.sin(centroid.x*12.9898+centroid.y*4.1414+centroid.z*78.233)*43758.5453)%6.2831853;
  const rooted=box.min.y<base+.65;
  for(const i of ids){
   branches.set(branchPivot.toArray(),i*3);leaves.set(leafPivot.toArray(),i*3);axes.set(axis.toArray(),i*3);
   const h=clamp(((leaf?centroid.y:p.getY(i))-base)/height,0,1);
   weights.set([rooted&&!leaf?0:clamp((p.getY(i)-branchPivot.y)/Math.max(.3,span),0,1),leaf?1:0,phase,h*h],i*4);
  }
 }
 geometry.setAttribute('anPpBranchPivot',new T.BufferAttribute(branches,3));geometry.setAttribute('anPpLeafPivot',new T.BufferAttribute(leaves,3));geometry.setAttribute('anPpAxis',new T.BufferAttribute(axes,3));geometry.setAttribute('anPpWeights',new T.BufferAttribute(weights,4));
 if(!source.boundingSphere)source.computeBoundingSphere();if(!source.boundingBox)source.computeBoundingBox();
 const padding=Math.max(.5,height*.16);geometry.boundingSphere=source.boundingSphere.clone();geometry.boundingSphere.radius+=padding;geometry.boundingBox=source.boundingBox.clone().expandByScalar(padding);
 geometry.userData.anPivotPainter={kind,components:groups.length,hierarchyLevels:3,padding,baseY:base,heightM:height};
 return geometry;
}
export function createPivotPainter(T,{root,quality='high'}={}){
 if(!root?.traverse)throw new TypeError('Pivot Painter requires a vegetation root');
 const uniforms={anPpTime:{value:0},anPpWindSpeed:{value:2},anPpWindDirection:{value:new T.Vector3(.82,0,.57).normalize()},anPpEnabled:{value:1},anPpLeafMotion:{value:1}};
 const records=new Map(),geometryCache=new Map(),materials=new Set();let tier='high',disposed=false;
 function classify(o){
  if(!o.isMesh||o.isSkinnedMesh||!o.geometry?.attributes.position||o.geometry.attributes.asfaltoDetailedTree||o.geometry.drawRange.count===0)return null;
  let path='';for(let p=o;p&&p!==root;p=p.parent)path+=' '+p.name;
  if(/grass|cesped|césped|billboard|resource.owner|source.owner|detail.template/i.test(path)||o.userData.asfaltoRealisticGrass)return null;
  const mats=materialList(o);if(mats.some(m=>!m?.isMeshStandardMaterial))return null;
  const names=path+' '+mats.map(m=>m.name).join(' ');
  if(!/tree|broadleaf|leaf|leaves|bark|palm|canopy/i.test(names))return null;
  return /leaf|leaves|palm|canopy/i.test(names)?'leaf':'bark';
 }
 function patch(material,source,config,previousShadow){
  // Material.clone intentionally does not copy callbacks. Preserve all earlier
  // surface/alpha hooks, then replace only the two known displacement snippets.
  const prior=source.onBeforeCompile,priorKey=source.customProgramCacheKey,shadowHook=previousShadow?.onBeforeCompile;
  material.userData={...source.userData,asfaltoPivotPainter:true};delete material.userData.asfaltoWind;
  material.onBeforeCompile=function(shader,renderer){
   if(shadowHook&&shadowHook!==prior)shadowHook.call(this,shader,renderer);
   prior?.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms,{anPpRootPivot:{value:new T.Vector3(0,config.baseY,0)}});
   shader.vertexShader=shader.vertexShader
    .replace('transformed.xz+=landscapeWindDirection*sway;','')
    .replace('transformed+=anLocalBend/max(1.,sqrt(anTreeScale));','');
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+GLSL);
   // Rodrigues rotations also rotate normals before Three applies instance/model
   // normal matrices. Shadow shaders without normals only consume the position.
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=anPpDeformNormal(objectNormal);');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=anPpDeformPosition(transformed);');
  };
  const key=priorKey?.call(source)||'';
  material.customProgramCacheKey=()=>key+'|an-pivot-painter-v1-'+config.baseY+'-'+(material.isMeshDepthMaterial?'depth':material.isMeshDistanceMaterial?'distance':'surface');
  material.needsUpdate=true;materials.add(material);return material;
 }
 function attach(o,kind){
  const source=o.geometry,sourceMaterials=materialList(o),wind=sourceMaterials.find(m=>m.userData.asfaltoWind)?.userData.asfaltoWind||{},config={baseY:Number(wind.baseY)||0,heightM:Number(wind.heightM)||16};
  const key=source.uuid+'|'+kind+'|'+config.baseY+'|'+config.heightM;let geometry=geometryCache.get(key);
  if(!geometry){geometry=pivotGeometry(T,source,kind,config);geometryCache.set(key,geometry);}
  const visible=sourceMaterials.map(m=>patch(m.clone(),m,config)),alpha=sourceMaterials[0];
  const depth=o.customDepthMaterial?.clone()||new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),distance=o.customDistanceMaterial?.clone()||new T.MeshDistanceMaterial();
  for(const shadow of [depth,distance])for(const key of ['map','alphaMap','alphaTest','side','clipShadows','clippingPlanes','displacementMap','displacementScale','displacementBias'])shadow[key]=alpha[key];
  patch(depth,alpha,config,o.customDepthMaterial);patch(distance,alpha,config,o.customDistanceMaterial);
  const record={object:o,geometry:source,material:o.material,depth:o.customDepthMaterial,distance:o.customDistanceMaterial,sphere:o.boundingSphere,box:o.boundingBox,generatedGeometry:geometry,generatedMaterials:visible,generatedDepth:depth,generatedDistance:distance};
  records.set(o,record);o.geometry=geometry;o.material=Array.isArray(record.material)?visible:visible[0];o.customDepthMaterial=depth;o.customDistanceMaterial=distance;
  if(o.isInstancedMesh){
   let maximum=1;const a=o.instanceMatrix.array;for(let i=0;i<a.length;i+=16)maximum=Math.max(maximum,Math.hypot(a[i],a[i+1],a[i+2]),Math.hypot(a[i+4],a[i+5],a[i+6]),Math.hypot(a[i+8],a[i+9],a[i+10]));
   const pad=geometry.userData.anPivotPainter.padding*maximum;if(record.sphere){o.boundingSphere=record.sphere.clone();o.boundingSphere.radius+=pad;}if(record.box)o.boundingBox=record.box.clone().expandByScalar(pad);
  }
 }
 function releaseRecord(r){
  const o=r.object;if(o.geometry===r.generatedGeometry)o.geometry=r.geometry;
  if(o.material===r.generatedMaterials[0]||Array.isArray(o.material)&&o.material[0]===r.generatedMaterials[0])o.material=r.material;
  if(o.customDepthMaterial===r.generatedDepth)o.customDepthMaterial=r.depth;if(o.customDistanceMaterial===r.generatedDistance)o.customDistanceMaterial=r.distance;
  o.boundingSphere=r.sphere;o.boundingBox=r.box;
  for(const m of [...r.generatedMaterials,r.generatedDepth,r.generatedDistance])if(materials.delete(m))m.dispose();
  records.delete(o);
 }
 function releaseUnusedGeometry(){
  const used=new Set([...records.values()].map(r=>r.generatedGeometry));
  for(const [key,g]of geometryCache)if(!used.has(g)){g.dispose();geometryCache.delete(key);}
 }
 function refresh(){
  if(disposed)return 0;
  for(const r of records.values()){let attached=false;for(let p=r.object;p;p=p.parent)if(p===root){attached=true;break;}if(!attached)releaseRecord(r);}
  releaseUnusedGeometry();
  root.traverse(o=>{if(records.has(o))return;const kind=classify(o);if(kind)attach(o,kind);});return records.size;
 }
 function setQuality(value='high'){tier=value==='high'?'high':value==='low'||value==='off'?'low':'balanced';uniforms.anPpEnabled.value=tier==='low'?0:1;uniforms.anPpLeafMotion.value=tier==='high'?1:.55;}
 function update({time,windSpeed,windDirection}={}){
  if(disposed)return;if(Number.isFinite(time))uniforms.anPpTime.value=Math.max(0,time);if(Number.isFinite(windSpeed))uniforms.anPpWindSpeed.value=clamp(windSpeed,0,32);
  if(windDirection){const x=windDirection.x??windDirection[0],z=windDirection.z??windDirection[windDirection.length===2?1:2];if(Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x,z)>1e-6)uniforms.anPpWindDirection.value.set(x,0,z).normalize();}
 }
 setQuality(quality);
 return {uniforms,refresh,update,setQuality,
  diagnostics:()=>({enabled:!!uniforms.anPpEnabled.value,tier,hierarchyLevels:3,representation:'component-derived root / branch / leaf pivot rotations',meshes:records.size,geometries:geometryCache.size,materials:materials.size,components:[...geometryCache.values()].reduce((n,g)=>n+g.userData.anPivotPainter.components,0),time:uniforms.anPpTime.value,windSpeed:uniforms.anPpWindSpeed.value,windDirection:uniforms.anPpWindDirection.value.toArray(),shadows:'matching depth and point-light distance deformation with alpha masks',disposed}),
  dispose(){if(disposed)return;disposed=true;for(const r of records.values())releaseRecord(r);releaseUnusedGeometry();uniforms.anPpEnabled.value=0;}
 };
}
const GLSL=/* glsl */`
attribute vec3 anPpBranchPivot,anPpLeafPivot,anPpAxis;
attribute vec4 anPpWeights;
uniform vec3 anPpRootPivot,anPpWindDirection;
uniform float anPpTime,anPpWindSpeed,anPpEnabled,anPpLeafMotion;
vec3 anPpRotate(vec3 v,vec3 axis,float angle){
 float c=cos(angle),s=sin(angle);return v*c+cross(axis,v)*s+axis*dot(axis,v)*(1.-c);
}
vec3 anPpLocalWind(){
 vec3 world=anPpWindDirection;
 vec3 local=vec3(dot(world,modelMatrix[0].xyz),dot(world,modelMatrix[1].xyz),dot(world,modelMatrix[2].xyz));
 #ifdef USE_INSTANCING
 local=vec3(dot(local,instanceMatrix[0].xyz),dot(local,instanceMatrix[1].xyz),dot(local,instanceMatrix[2].xyz));
 #endif
 return normalize(local+vec3(.00001,0.,0.));
}
vec3 anPpAngles(){
 vec4 origin=vec4(0.,0.,0.,1.);
 #ifdef USE_INSTANCING
 origin=instanceMatrix*origin;
 #endif
 vec3 worldOrigin=(modelMatrix*origin).xyz;
 float phase=anPpWeights.z+dot(worldOrigin.xz,vec2(.037,.021));
 float strength=clamp(anPpWindSpeed*.055,0.,1.45)*anPpEnabled;
 return strength*vec3(
  (.55+.45*sin(anPpTime*.83+phase*.12))*.048*anPpWeights.w,
  sin(anPpTime*1.71+phase)*.115*anPpWeights.x,
  sin(anPpTime*4.4+phase*2.1)*.19*anPpWeights.y*anPpLeafMotion);
}
vec3 anPpRootAxis(){return normalize(cross(vec3(0.,1.,0.),anPpLocalWind())+vec3(.000001,0.,0.));}
vec3 anPpDeformPosition(vec3 p){
 vec3 angle=anPpAngles(),axis=normalize(anPpAxis);
 p=anPpLeafPivot+anPpRotate(p-anPpLeafPivot,axis,angle.z);
 p=anPpBranchPivot+anPpRotate(p-anPpBranchPivot,axis,angle.y);
 return anPpRootPivot+anPpRotate(p-anPpRootPivot,anPpRootAxis(),angle.x);
}
vec3 anPpDeformNormal(vec3 n){
 vec3 angle=anPpAngles(),axis=normalize(anPpAxis);
 n=anPpRotate(n,axis,angle.z);n=anPpRotate(n,axis,angle.y);return anPpRotate(n,anPpRootAxis(),angle.x);
}
`;
