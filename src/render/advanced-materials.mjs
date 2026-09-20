import {computeSurfaceCurvature,releaseSurfaceCurvatureCache} from './surface-curvature.mjs?v=9dbb5f4dd8be5807';

const materialOwners=new WeakMap(),geometryOwners=new WeakMap(),texturePools=new WeakMap();
const geometrySignature=geometry=>[geometry.attributes.position,geometry.attributes.position.version,geometry.index,geometry.index?.version];
const sameSignature=(a,b)=>a?.length===b?.length&&a.every((value,i)=>value===b[i]);
const ATTRIBUTE='anAdvancedCurvature';
const PROVENANCE='asfaltoAdvancedMaterialProvenance',PATCH_MARKER='#define AN_ADVANCED_SURFACE_PATCHED 1';
const PHYSICAL_FEATURES=['clearcoat','anisotropy','sheen'];
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
const tierValue=tier=>tier==='cinematic'||tier==='high'||tier==='ultra'?1:tier==='balanced'||tier==='medium'?.65:0;
const SURFACES=Object.freeze({
  paint:{coat:.78,frequency:75,detail:.0002,roughness:.035,wear:.10},
  varnish:{coat:.52,frequency:44,detail:.0005,roughness:.04,wear:.06},
  'brushed-metal':{anisotropy:.65,frequency:110,detail:.00032,roughness:.08,wear:.14},
  fabric:{sheen:.45,frequency:130,detail:.00075,roughness:.12,wear:.04},
  foliage:{scatter:.32,frequency:42,detail:.00075,roughness:.08,wear:0},
  wax:{scatter:.16,frequency:60,detail:.0001,roughness:.02,wear:.015},
  'thin-plastic':{scatter:.20,frequency:90,detail:.00015,roughness:.045,wear:.035},
  mineral:{frequency:34,detail:.0012,roughness:.12,wear:.10},
  asphalt:{frequency:6,detail:.00022,roughness:.065,wear:.012},
  rubber:{frequency:8,detail:.0001,roughness:.04,wear:0},
  vinyl:{frequency:10,detail:.00012,roughness:.045,wear:0},
});

export function classifyAdvancedSurface(material,object=null,scope='world') {
  if(!material?.isMeshStandardMaterial||material.userData?.advancedMaterials===false||object?.userData?.advancedMaterials===false)return null;
  const explicit=material.userData?.advancedSurface||object?.userData?.advancedSurface;
  const name=[material.name,object?.name].filter(Boolean).join(' ').toLowerCase();
  if(/glass|vidrio|water|agua|mirror|chrome|cromo|emissiveglow|particle|sprite|mist|smoke|sky|cloud|flare/.test(name)||material.transmission>0)return null;
  const leaf=/leav|leaf|foliage|hojas|frond|grassblade|canopy/.test(name)||explicit==='foliage';
  if(material.transparent&&!leaf)return null;
  if(explicit&&Object.hasOwn(SURFACES,explicit))return explicit;
  if(leaf)return 'foliage';
  if(/wax|cera(?:_|\b)/.test(name))return 'wax';
  if(/thin.?plastic|plastic.?thin|plastico.?fino|translucent.?plastic|milk.?plastic/.test(name))return 'thin-plastic';
  if(/fabric|cloth|textile|canvas|lona|upholster|tapizado|tela|seat.?cover/.test(name))return 'fabric';
  if(/paint|pintura|stripeatlas|car.?body|body.?coat/.test(name))return 'paint';
  if(/varnish|barniz|lacquer|lacado|polished.?wood/.test(name))return 'varnish';
  if(/brush|cepill|steel|alumin|inox|machined|brake.?rotor|brake.?disc/.test(name))return 'brushed-metal';
  if(/rubber|neumatic|neumático|tire.?rubber|caucho/.test(name))return 'rubber';
  if(/vinyl|vinilo|dashboard.?plastic|interior.?plastic/.test(name))return 'vinyl';
  if(/asphalt|asfalto|tarmac/.test(name))return 'asphalt';
  if(/rock|stone|mineral|asphalt|concrete|pavement|boulder|terrain|rubble|piedra|hormigon/.test(name))return 'mineral';
  return null;
}

/** RG tangent-space micro-normal, B roughness, A height; no color conversion. */
export function createAdvancedDetailTexture(T,{size=64,seed=173}={}) {
  size=Math.max(16,Math.min(256,2**Math.round(Math.log2(Number.isFinite(size)&&size>0?size:64))));
  const heights=new Float32Array(size*size),data=new Uint8Array(size*size*4);
  function noise(x,y){let n=(Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263))>>>0;n=Math.imul(n^(n>>>13),1274126177)>>>0;return (n^(n>>>16))>>>0;}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)heights[y*size+x]=(noise(x,y)%65536)/65535*.64+(Math.sin(x/size*Math.PI*16)*Math.cos(y/size*Math.PI*12)+1)*.09;
  const sample=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(sample(x+1,y)-sample(x-1,y))*.8,dy=(sample(x,y+1)-sample(x,y-1))*.8,length=Math.hypot(dx,dy,1),i=(y*size+x)*4;
    data[i]=Math.round((-.5*dx/length+.5)*255);data[i+1]=Math.round((-.5*dy/length+.5)*255);data[i+2]=Math.round(clamp(.25+sample(x,y)*.65)*255);data[i+3]=Math.round(clamp(sample(x,y))*255);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat,T.UnsignedByteType);texture.name='AdvancedMaterial_DetailNormalRoughness';texture.colorSpace=T.NoColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
function acquireTexture(T) {let pool=texturePools.get(T);if(!pool){pool={texture:createAdvancedDetailTexture(T),refs:0};texturePools.set(T,pool);}pool.refs++;return pool.texture;}
function releaseTexture(T) {const pool=texturePools.get(T);if(pool&&--pool.refs===0){pool.texture.dispose();texturePools.delete(T);}}

function remember(entry,key){if(!entry.restore.has(key))entry.restore.set(key,Object.getOwnPropertyDescriptor(entry.material,key));}
function write(entry,key,value){remember(entry,key);if(PHYSICAL_FEATURES.includes(key))remember(entry,'_'+key);entry.material[key]=value;}
function promote(T,entry) {
  const material=entry.material;if(material.isMeshPhysicalMaterial)return true;
  if(Object.getPrototypeOf(material)!==T.MeshStandardMaterial.prototype)return false;
  // Preserve identity: paint controllers, light calibration and environment sets keep
  // references to this object. Add only Physical's missing constructor fields.
  const template=new T.MeshPhysicalMaterial();
  for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(template))) {
    if(Object.hasOwn(material,key))continue;
    remember(entry,key);Object.defineProperty(material,key,{...descriptor,configurable:true});
  }
  entry.promoted=true;Object.setPrototypeOf(material,T.MeshPhysicalMaterial.prototype);
  write(entry,'type','MeshPhysicalMaterial');write(entry,'defines',{...material.defines,STANDARD:'',PHYSICAL:''});return true;
}
function setEntryQuality(entry) {
  const quality=Math.max(0,...[...entry.owners.values()].map(owner=>tierValue(owner.quality))),surface=SURFACES[entry.role];
  entry.uniforms.anAMQuality.value=quality;
  const cinematic=[...entry.owners.values()].some(owner=>owner.quality==='cinematic');
  entry.uniforms.anAMCinematic.value=cinematic?1:0;
  entry.uniforms.anAMFrequency.value=cinematic?(entry.role==='paint'?32:entry.role==='mineral'?12:surface.frequency):surface.frequency;
  entry.uniforms.anAMWear.value=cinematic?(entry.role==='paint'?0:Math.min(surface.wear,.025)):surface.wear;
  entry.uniforms.anAMNormalStrength.value=cinematic&&entry.role==='paint'?.00008:surface.detail;
  entry.uniforms.anAMRoughnessStrength.value=cinematic&&entry.role==='paint'?.022:surface.roughness;
  if(entry.material.isMeshPhysicalMaterial) {
    write(entry,'clearcoat',Math.max(entry.native.clearcoat,(surface.coat||0)*quality));
    write(entry,'anisotropy',Math.max(entry.native.anisotropy,(surface.anisotropy||0)*quality));
    write(entry,'sheen',Math.max(entry.native.sheen,(surface.sheen||0)*quality));
  }
  for(const key of PHYSICAL_FEATURES)entry.provenance.applied[key]=entry.material[key]||0;
}
function createEntry(T,material,role) {
  const surface=SURFACES[role],entry={T,material,role,owners:new Map(),restore:new Map(),prototype:Object.getPrototypeOf(material),active:true,promoted:false,compileCount:0,incompatibleShaders:0,
    priorCompile:material.onBeforeCompile,priorKey:material.customProgramCacheKey,
    native:{clearcoat:material.clearcoat||0,anisotropy:material.anisotropy||0,sheen:material.sheen||0}};
  // Three clones Physical fields and userData, while shader owners such as PivotPainter
  // also preserve callbacks. Keep the authored baseline, not a copied enhancement.
  const inherited=material.userData[PROVENANCE],inheritedKeys=[];
  if(inherited?.version===1)for(const key of PHYSICAL_FEATURES){
    if(Number.isFinite(inherited.native?.[key])&&entry.native[key]===inherited.applied?.[key]){entry.native[key]=inherited.native[key];inheritedKeys.push(key);}
  }
  entry.previousProvenance=inherited?.version===1?undefined:Object.getOwnPropertyDescriptor(material.userData,PROVENANCE);
  entry.provenance={version:1,native:{...entry.native},applied:{}};material.userData[PROVENANCE]=entry.provenance;
  for(const key of inheritedKeys){
    // Physical setters store their values in these own fields. Restore the baseline
    // when this clone leaves, even if its source is still being enhanced.
    for(const field of [key,'_'+key]){const descriptor=Object.getOwnPropertyDescriptor(material,field);if(descriptor&&'value' in descriptor)entry.restore.set(field,{...descriptor,value:entry.native[key]});}
  }
  if(surface.coat||surface.anisotropy||surface.sheen)promote(T,entry);
  if(material.isMeshPhysicalMaterial&&surface.coat)write(entry,'clearcoatRoughness',Math.max(.13,Math.min(.3,material.clearcoatRoughness||.18)));
  if(material.isMeshPhysicalMaterial&&surface.sheen){write(entry,'sheenColor',new T.Color('#b7a794'));write(entry,'sheenRoughness',.72);}
  write(entry,'defaultAttributeValues',{...material.defaultAttributeValues,uv:material.defaultAttributeValues?.uv||[0,0],[ATTRIBUTE]:[0]});
  const detail=acquireTexture(T);
  entry.uniforms={anAMDetail:{value:detail},anAMQuality:{value:1},anAMCinematic:{value:0},anAMFrequency:{value:surface.frequency},anAMNormalStrength:{value:surface.detail},anAMRoughnessStrength:{value:surface.roughness},anAMWear:{value:surface.wear},anAMScatter:{value:surface.scatter||0},
    anAMSunDirection:{value:new T.Vector3(.4,.8,.2).normalize()},anAMSunColor:{value:new T.Color('#fff4df')},anAMSunIntensity:{value:1},anAMSunVisibility:{value:1},anAMTime:{value:0}};
  entry.compile=function(shader,renderer) {
    entry.priorCompile?.call(this,shader,renderer);if(!entry.active||this!==entry.material)return;
    // A foreign wrapper may explicitly invoke its source material callback. Rebind
    // uniforms to this owner but never emit the same shader layer twice.
    if(shader.vertexShader.includes(PATCH_MARKER)&&shader.fragmentShader.includes(PATCH_MARKER)){entry.compileCount++;Object.assign(shader.uniforms,entry.uniforms);return;}
    const requiredVertex=['#include <common>','#include <project_vertex>'];
    const requiredFragment=['#include <common>','#include <map_fragment>','#include <roughnessmap_fragment>','#include <normal_fragment_maps>','#include <lights_fragment_end>'];
    if(requiredVertex.some(token=>!shader.vertexShader.includes(token))||requiredFragment.some(token=>!shader.fragmentShader.includes(token))){entry.incompatibleShaders++;return;}
    entry.compileCount++;Object.assign(shader.uniforms,entry.uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+VERTEX_DECLARATIONS);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+VERTEX_VALUES);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+FRAGMENT_DECLARATIONS);
    // The shared Chevy atlas declares its pigment mask in the map block.
    // Sample after that block, never tint the source before paint isolation.
    const chevyMask=entry.role==='paint'&&shader.fragmentShader.includes('float chevyPaintMask');
    const pigmentMask=chevyMask?'chevyPaintMask':entry.role==='paint'&&shader.fragmentShader.includes('float vehiclePigment')?'vehiclePigment':null;
    const detail=DETAIL_SAMPLE.replace('AN_AM_SURFACE_MASK',pigmentMask?'mix(1.,'+pigmentMask+',anAMCinematic)':'1.');
    const roughness='roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor+(anAMSample.b-.5)*anAMRoughnessStrength*anAMLocalQuality+anAMConvex*anAMWear*.16*anAMLocalQuality,.045,1.),step(.00001,anAMLocalQuality));';
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',detail+'\n#include <roughnessmap_fragment>'+(chevyMask?'':'\n'+roughness));
    if(chevyMask)shader.fragmentShader=shader.fragmentShader.replace('roughnessFactor = mix(roughnessFactor, .28, chevyPaintMask);','roughnessFactor = mix(roughnessFactor, .28, chevyPaintMask);\n'+roughness);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+DETAIL_NORMAL);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n'+THIN_SCATTERING);
  };
  entry.key=function(){return (entry.priorKey?.call(this)||'')+(entry.active&&this===entry.material?'|advanced-materials-v2-metric-filtered:'+role:'');};
  material.onBeforeCompile=entry.compile;material.customProgramCacheKey=entry.key;material.needsUpdate=true;
  materialOwners.set(material,entry);return entry;
}
function releaseMaterial(entry,owner) {
  entry.owners.delete(owner);if(entry.owners.size){setEntryQuality(entry);return;}
  const material=entry.material;entry.active=false;
  if(material.onBeforeCompile===entry.compile)material.onBeforeCompile=entry.priorCompile;
  if(material.customProgramCacheKey===entry.key)material.customProgramCacheKey=entry.priorKey;
  for(const [key,descriptor] of [...entry.restore].reverse()){if(descriptor)Object.defineProperty(material,key,descriptor);else delete material[key];}
  if(entry.promoted&&Object.getPrototypeOf(material)===entry.T.MeshPhysicalMaterial.prototype)Object.setPrototypeOf(material,entry.prototype);
  if(material.userData[PROVENANCE]===entry.provenance){if(entry.previousProvenance)Object.defineProperty(material.userData,PROVENANCE,entry.previousProvenance);else delete material.userData[PROVENANCE];}
  material.needsUpdate=true;releaseTexture(entry.T);entry.uniforms.anAMDetail.value=null;entry.restore.clear();materialOwners.delete(material);
}
function releaseGeometry(geometry,owner) {
  const entry=geometryOwners.get(geometry);if(!entry)return;entry.owners.delete(owner);if(entry.owners.size)return;
  if(geometry.getAttribute(ATTRIBUTE)===entry.attribute){if(entry.previous)geometry.setAttribute(ATTRIBUTE,entry.previous);else geometry.deleteAttribute(ATTRIBUTE);}
  geometryOwners.delete(geometry);releaseSurfaceCurvatureCache(geometry);
}

export function createAdvancedMaterials(T,{root,scope='world',quality='high'}={}) {
  if(!root?.traverse||!T?.MeshPhysicalMaterial||!T?.DataTexture)throw new TypeError('Advanced materials require Three.js and a traversable root');
  if(!['world','vehicle','workshop'].includes(scope))throw new TypeError('Invalid advanced material scope');
  const owner={quality},materials=new Map(),geometries=new Map();let disposed=false,refreshes=0,processedVertices=0,skippedGeometry=0;
  function refresh() {
    if(disposed)return false;refreshes++;const nextMaterials=new Map(),nextGeometries=new Set();let budget=scope==='world'?240000:160000;processedVertices=0;skippedGeometry=0;
    root.traverse(object=>{
      if(!object.isMesh||!object.geometry?.getAttribute?.('position')||object.userData?.advancedMaterials===false)return;
      let eligible=false;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        const role=classifyAdvancedSurface(material,object,scope);if(!role)continue;eligible=true;
        let entry=materialOwners.get(material);if(!entry)entry=createEntry(T,material,role);
        entry.owners.set(owner,owner);nextMaterials.set(material,entry);setEntryQuality(entry);
      }
      if(!eligible||nextGeometries.has(object.geometry))return;const geometry=object.geometry;nextGeometries.add(geometry);
      let entry=geometryOwners.get(geometry);
      if(entry){
        entry.owners.add(owner);
        const signature=geometrySignature(geometry);
        if(!sameSignature(signature,entry.signature)&&geometry.getAttribute(ATTRIBUTE)===entry.attribute){
          const result=computeSurfaceCurvature(T,geometry,{maxVertices:Math.min(80000,budget)});
          if(result.attribute){geometry.setAttribute(ATTRIBUTE,result.attribute);budget-=result.attribute.count;processedVertices+=result.attribute.count;}
          else{geometry.deleteAttribute(ATTRIBUTE);skippedGeometry++;}
          entry.attribute=result.attribute;entry.signature=signature;entry.diagnostics=result.diagnostics;
        }
        geometries.set(geometry,entry.diagnostics);return;
      }
      if(geometry.getAttribute(ATTRIBUTE)){geometries.set(geometry,{reason:'external-curvature',vertices:geometry.attributes.position.count});return;}
      const result=computeSurfaceCurvature(T,geometry,{maxVertices:Math.min(80000,budget)});
      geometries.set(geometry,result.diagnostics);
      if(!result.attribute){skippedGeometry++;return;}
      budget-=result.attribute.count;processedVertices+=result.attribute.count;
      entry={attribute:result.attribute,signature:geometrySignature(geometry),previous:null,owners:new Set([owner]),diagnostics:result.diagnostics};geometry.setAttribute(ATTRIBUTE,result.attribute);geometryOwners.set(geometry,entry);
    });
    for(const [material,entry] of materials)if(!nextMaterials.has(material))releaseMaterial(entry,owner);
    for(const geometry of geometries.keys())if(!nextGeometries.has(geometry)){releaseGeometry(geometry,owner);geometries.delete(geometry);}
    materials.clear();for(const [material,entry] of nextMaterials)materials.set(material,entry);return diagnostics();
  }
  function setQuality(tier) {if(disposed)return false;owner.quality=tier;for(const entry of materials.values())setEntryQuality(entry);return diagnostics();}
  function update({time,sunDirection,sunColor,sunIntensity,sunVisibility}={}) {
    if(disposed)return false;
    for(const entry of materials.values()){
      const u=entry.uniforms;if(Number.isFinite(time))u.anAMTime.value=time;
      if(sunDirection){const x=sunDirection.x??sunDirection[0],y=sunDirection.y??sunDirection[1],z=sunDirection.z??sunDirection[2];if(Number.isFinite(x+y+z)&&Math.hypot(x,y,z)>1e-8)u.anAMSunDirection.value.set(x,y,z).normalize();}
      if(sunColor?.isColor)u.anAMSunColor.value.copy(sunColor);else if(typeof sunColor==='string'||typeof sunColor==='number')u.anAMSunColor.value.set(sunColor);
      if(Number.isFinite(sunIntensity))u.anAMSunIntensity.value=clamp(sunIntensity,0,8);
      if(Number.isFinite(sunVisibility))u.anAMSunVisibility.value=clamp(sunVisibility);
    }
    return true;
  }
  function diagnostics(){const roles={};for(const entry of materials.values())roles[entry.role]=(roles[entry.role]||0)+1;return {scope,quality:owner.quality,disposed,materials:materials.size,roles,geometries:geometries.size,curvatureGeometries:[...geometries.values()].filter(value=>!value.reason).length,skippedGeometry,processedVertices,refreshes,
    compileCount:[...materials.values()].reduce((sum,entry)=>sum+entry.compileCount,0),incompatibleShaders:[...materials.values()].reduce((sum,entry)=>sum+entry.incompatibleShaders,0),ownedTextures:materials.size?1:0,
    materialIdentityPreserved:true,detailFilter:owner.quality==='cinematic'?'metric footprint + authored mipmaps':'authored mipmaps',scatteringModel:'thin-surface single-scattering approximation',curvatureModel:'signed seam-welded one-ring convexity',physicalDeltaM:0};}
  function dispose(){if(disposed)return false;disposed=true;for(const entry of materials.values())releaseMaterial(entry,owner);for(const geometry of geometries.keys())releaseGeometry(geometry,owner);materials.clear();geometries.clear();return true;}
  refresh();return {refresh,setQuality,update,diagnostics,dispose};
}

const VERTEX_DECLARATIONS=PATCH_MARKER+`
attribute float anAdvancedCurvature;
uniform float anAMCinematic;
varying float vAnAMCurvature;
varying vec3 vAnAMLocalPosition,vAnAMLocalNormal,vAnAMBrushDirection;`;
const VERTEX_VALUES=`vAnAMCurvature=anAdvancedCurvature;
mat4 anAMMetricMatrix=modelMatrix;
#ifdef USE_INSTANCING
anAMMetricMatrix=modelMatrix*instanceMatrix;
#endif
vec3 anAMMetricScale=vec3(length(anAMMetricMatrix[0].xyz),length(anAMMetricMatrix[1].xyz),length(anAMMetricMatrix[2].xyz));
vAnAMLocalPosition=transformed*mix(vec3(1.),anAMMetricScale,anAMCinematic);
vAnAMLocalNormal=objectNormal;
vec3 anAMBrushLocal=vec3(1.,0.,0.);
#ifdef USE_INSTANCING
anAMBrushLocal=mat3(instanceMatrix)*anAMBrushLocal;
#endif
vAnAMBrushDirection=mat3(modelViewMatrix)*anAMBrushLocal;`;
const FRAGMENT_DECLARATIONS=PATCH_MARKER+`
uniform sampler2D anAMDetail;
uniform float anAMQuality,anAMCinematic,anAMFrequency,anAMNormalStrength,anAMRoughnessStrength,anAMWear,anAMScatter,anAMSunIntensity,anAMSunVisibility,anAMTime;
uniform vec3 anAMSunDirection,anAMSunColor;
varying float vAnAMCurvature;
varying vec3 vAnAMLocalPosition,vAnAMLocalNormal,vAnAMBrushDirection;`;
const DETAIL_SAMPLE=`float anAMSurfaceMask=AN_AM_SURFACE_MASK;
// Texels per pixel, not frame history: stable during motion and camera cuts.
float anAMFootprint=max(length(dFdx(vAnAMLocalPosition)),length(dFdy(vAnAMLocalPosition)))*anAMFrequency*64.;
float anAMDetailWeight=mix(1.,1.-smoothstep(1.,4.,anAMFootprint),anAMCinematic);
float anAMLocalQuality=anAMQuality*anAMDetailWeight*anAMSurfaceMask;
vec4 anAMSample=vec4(.5);
if(anAMQuality>.01){
  vec3 anAMWeights=pow(abs(vAnAMLocalNormal),vec3(4.));anAMWeights/=max(dot(anAMWeights,vec3(1.)),.00001);
  anAMSample=texture2D(anAMDetail,vAnAMLocalPosition.yz*anAMFrequency)*anAMWeights.x
    +texture2D(anAMDetail,vAnAMLocalPosition.xz*anAMFrequency)*anAMWeights.y
    +texture2D(anAMDetail,vAnAMLocalPosition.xy*anAMFrequency)*anAMWeights.z;
}
float anAMConvex=smoothstep(.025,.24,max(vAnAMCurvature,0.))*(.35+.65*anAMSample.b);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.32,.28),anAMConvex*anAMWear*anAMLocalQuality);`;
const DETAIL_NORMAL=`if(anAMQuality>.01){
  // Screen derivatives compose micro-height with the authored/POM/weather normal.
  float anAMHeight=(anAMSample.a-.5)*anAMNormalStrength*anAMLocalQuality;
  vec3 anAMDpx=dFdx(-vViewPosition),anAMDpy=dFdy(-vViewPosition);
  vec3 anAMR1=cross(anAMDpy,normal),anAMR2=cross(normal,anAMDpx);
  float anAMDet=dot(anAMDpx,anAMR1);
  vec3 anAMPerturbed=abs(anAMDet)*normal-sign(anAMDet)*(dFdx(anAMHeight)*anAMR1+dFdy(anAMHeight)*anAMR2);
  if(dot(anAMPerturbed,anAMPerturbed)>1e-16)normal=normalize(anAMPerturbed);
}
#ifdef USE_ANISOTROPY
#ifndef USE_TANGENT
// Native UV derivatives become zero on UV-less meshes. Keep a stable object-space brushing direction.
if(dot(tbn[ 0 ],tbn[ 0 ])<.00001||dot(tbn[ 1 ],tbn[ 1 ])<.00001){
  vec3 anAMT=vAnAMBrushDirection-normal*dot(vAnAMBrushDirection,normal);
  if(dot(anAMT,anAMT)<.00001)anAMT=cross(normal,abs(normal.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.));
  anAMT=normalize(anAMT);tbn=mat3(anAMT,normalize(cross(normal,anAMT)),normal);
}
#endif
#endif`;
const THIN_SCATTERING=`if(anAMScatter>0.&&anAMQuality>.01){
  // Thin-sheet approximation; not a volumetric BSSRDF or a second transparency pass.
  vec3 anAML=normalize(mat3(viewMatrix)*anAMSunDirection);
  float anAMBack=max(dot(-normal,anAML),0.);
  float anAMForward=pow(max(dot(normalize(vViewPosition),-anAML),0.),3.);
  float anAMTransmission=anAMScatter*anAMBack*(.25+.75*anAMForward)*anAMSunIntensity*anAMSunVisibility*(.35+.65*anAMQuality);
  reflectedLight.directDiffuse+=diffuseColor.rgb*anAMSunColor*anAMTransmission;
}`;
