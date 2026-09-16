import {loadHorconesDEM,addHorconesDEM} from './horcones-dem.mjs';
import {planAustralCanopyStands,createForestImpostorGeometry,installAustralCanopyShader} from './regional-canopy-stand.mjs';
import {regionalReviewPlan} from './regional-review-plan.mjs';
import {mountainProfile,mountainAngleAtFraction} from './mountain-profile.mjs';
import {configureSurfaceRelief,installSurfaceRelief} from './surface-relief.mjs';
import {applySurfaceVertexColors} from './surface-vertex-colors.mjs';
import { exposeAuthoredRiver } from './regional-river-channel.mjs';
import { addRegionalWayfinding } from './regional-wayfinding.mjs?v=photo-r1-20260916';
import { refineRegionalBoulders } from './regional-boulders.mjs';
import { refineRegionalShoreline } from './regional-shoreline.mjs';
import { improveRegionalRoadMaterials } from './regional-road-surfaces.mjs';
import { addRegionalLandscapeDetails, regionalCameraProfiles } from './regional-landscape-details.mjs?v=photo-r1-20260916';
// Visual-only correction of authored track assets. The route is sampled read-only; physics geometry is never edited.
// Source maps and the rendered tree impostors are CC0; see assets/tracks/visual-correction/provenance.json.
import { closeTerrainEdges } from './terrain-edge-closure.mjs';
import { addRoadsideDetails, loadRoadsideTemplates } from './roadside-details.mjs?v=photo-r1-20260916';
import { forestBackfill, visualRoadField } from './forest-terrain-detail.mjs';
import { refineTerrainSurface, joinTerrainTiles } from './terrain-refinement.mjs';
import { addTerrainShoulderTransition } from './terrain-shoulder-transition.mjs';
const ASSETS = new URL('../../../assets/tracks/visual-correction/', import.meta.url);
const FOREST_TRACKS = new Set(['dos_lagos', 'paso_garibaldi']);
const MAP_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];

function rng(seed) {
  let state = seed >>> 0;
  return () => { state = Math.imul(1664525, state) + 1013904223 >>> 0; return state / 4294967296; };
}
function surfaceRule(name, id) {
  if(id==='cataratas_iguazu'){
    if(name==='MAT_asphalt')return{asset:'aerial_asphalt_01',metres:9,roughness:.86,normal:.24,color:'#b6b4ae',road:true};
    if(name==='MAT_laterite')return{asset:'gravel_floor',metres:3,roughness:.96,normal:.45,color:'#b97850',terrain:true};
    if(/MAT_(forest_floor|earthen_bank)/.test(name))return{asset:'aerial_grass_rock',metres:7,roughness:.98,normal:.35,color:'#929c74',terrain:true};
    if(name==='MAT_basalt')return{asset:'aerial_rocks_04',metres:5,roughness:.92,normal:.5,color:'#858e83',terrain:true};
  }
  if (/^(M_Asphalt_Wet|MAT_ASPHALT|MAT_P1_ROAD|V2_ASPHALT_PBR|M_DL_Detail_RoadPatch_PBR)$/.test(name))
    return { asset: 'aerial_asphalt_01', metres: 9, roughness: 0.84, normal: 0.24, color: FOREST_TRACKS.has(id)?'#828782':id==='cuesta_lipan'?'#6b6d66':'#999a93', road: true };
  if (/(Shoulder_Gravel|Gravel_PBR|MAT_SHOULDER|MAT_DRAINAGE|MAT_P1_GRAVEL|MAT_P1_BALLAST|V2_SHOULDER_PBR)/.test(name))
    return { asset: 'gravel_floor', metres: 3, roughness: 0.94, normal: 0.5, color: FOREST_TRACKS.has(id) ? '#858775' : id==='cuesta_lipan' ? '#a69374' : '#9e9787' };
  if (/(Terrain_Andean|MAT_TERRAIN_|MAT_PEAT)/.test(name))
    return { asset: 'aerial_grass_rock', metres: 8, roughness: 0.97, normal: 0.35, color: id === 'paso_garibaldi' ? '#a4af94' : '#b8bfa2', terrain: true };
  if (id === 'aconcagua_horcones' && name === 'MAT_P1_TERRAIN_ARID')
    return { asset: 'gravel_floor', metres: 12, roughness: 0.99, normal: 0.28, color: '#bbb9b2', terrain: true };
  if (id === 'cuesta_lipan' && name === 'V2_TERRAIN_PBR')
    return { asset: 'gravel_floor', metres: 10, roughness: 0.99, normal: 0.3, color: '#c2b9a5', terrain: true };
  if (/(MAT_P1_TERRAIN_|V2_TERRAIN_PBR)/.test(name))
    return { asset: 'rock_face', metres: id === 'cuesta_lipan' ? 16 : 24, roughness: 0.97, normal: 0.38, color: id === 'cuesta_lipan' ? '#ecd4ac' : '#e2ded2', terrain: true };
  if (/(M_Rock_|Rock_PBR|MAT_ROCK|MAT_P1_DUST|V2_ROCK_PBR)/.test(name))
    return { asset: FOREST_TRACKS.has(id) ? 'aerial_rocks_04' : 'rock_face', metres: 12, roughness: 0.95, normal: 0.4, color: id === 'cuesta_lipan' ? '#d4a577' : '#c5c5c0', terrain: true };
  return null;
}

function retainTexture(material, texture) {
  if (!texture?.isTexture) return;
  material.asfaltoRetiredTextures ||= [];
  if (!material.asfaltoRetiredTextures.includes(texture)) {
    const index = material.asfaltoRetiredTextures.length;
    material.asfaltoRetiredTextures.push(texture);
    // The legacy sector disposer walks direct material properties; keep each retired map reachable.
    material['asfaltoRetiredTexture' + index] = texture;
  }
}

function metricUV(THREE, mesh, metres) {
  const positions = mesh.geometry?.attributes?.position;
  if (!positions) return;
  const values = new Float32Array(positions.count * 2), point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    values[i * 2] = point.x / metres;
    values[i * 2 + 1] = (point.z + point.y * 0.18) / metres;
  }
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(values, 2));
  // Tangents in the imported package describe the old UVs, so recompute the derivative basis.
  mesh.geometry.deleteAttribute('tangent');
}

export function terrainProjection(material, metres, snowLine = 1e8, secondaryMaps = null) {
  const mountainSnow=Boolean(material.userData.asfaltoMountainSnow);
  material.onBeforeCompile = shader => {
    if(mountainSnow){
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float asfaltoMountainSnow;\nvarying float vMountainSnow;').replace('#include <begin_vertex>','#include <begin_vertex>\nvMountainSnow=asfaltoMountainSnow;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vMountainSnow;');
    }
    if (secondaryMaps) shader.uniforms.landscapeRockMap = { value: secondaryMaps.diff };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLandscapeWorld;\nvarying vec3 vLandscapeNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 landscapePosition = vec4(position, 1.0);
vec3 landscapeNormal = normal;
#ifdef USE_INSTANCING
landscapePosition = instanceMatrix * landscapePosition;
landscapeNormal = mat3(instanceMatrix) * landscapeNormal;
#endif
vLandscapeWorld = (modelMatrix * landscapePosition).xyz;
vLandscapeNormal = normalize(mat3(modelMatrix) * landscapeNormal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLandscapeWorld;
varying vec3 vLandscapeNormal;
${secondaryMaps ? 'uniform sampler2D landscapeRockMap;' : ''}
float landscapeHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float landscapeNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(landscapeHash(i),landscapeHash(i+vec2(1.0,0.0)),f.x),mix(landscapeHash(i+vec2(0.0,1.0)),landscapeHash(i+vec2(1.0,1.0)),f.x),f.y);
}
vec3 landscapeCoordinates(vec3 world) {
  vec3 p=world/${Number(metres).toFixed(2)};
  // Smooth domain variation breaks the exact rectangular repetition. The same
  // coordinates drive albedo, roughness and normal detail, including mirrors.
  vec3 warp=vec3(landscapeNoise(p.yz*.19+8.3),landscapeNoise(p.xz*.19+41.7),landscapeNoise(p.xy*.19+19.2));
  return p+(warp-.5)*1.65;
}
vec3 landscapePlane(sampler2D tex, vec2 p) {
  float k=landscapeNoise(p*.065)*8.0,i=floor(k),f=fract(k);
  vec2 a=sin(vec2(3.1,7.7)*i)*3.0,b=sin(vec2(3.1,7.7)*(i+1.0))*3.0;
  return mix(texture2D(tex,p+a).rgb,texture2D(tex,p+b).rgb,smoothstep(.18,.82,f));
}
vec3 landscapeSample(sampler2D tex, vec3 p, vec3 n) {
  vec3 weights = pow(abs(n), vec3(4.0));
  weights /= max(dot(weights, vec3(1.0)), 0.0001);
  return landscapePlane(tex, p.yz) * weights.x + landscapePlane(tex, p.xz) * weights.y + landscapePlane(tex, p.xy) * weights.z;
}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec3 landscapeUV = landscapeCoordinates(vLandscapeWorld);
  vec3 landscapeColor = landscapeSample(map, landscapeUV, normalize(vLandscapeNormal));
  vec3 landscapeMacro = landscapeSample(map, landscapeUV * 0.071 + vec3(4.7, 8.1, 2.3), normalize(vLandscapeNormal));
  float distantGrain=smoothstep(65.0,420.0,distance(cameraPosition,vLandscapeWorld));
  // Distant soil reads as broad connected deposits instead of a field of tiles.
  landscapeColor=mix(landscapeColor,landscapeMacro,distantGrain*.78);
  landscapeColor*=mix(.87,1.13,landscapeNoise(vLandscapeWorld.xz*.007));
  ${secondaryMaps ? `float exposedRock=(1.0-smoothstep(.58,.96,abs(normalize(vLandscapeNormal).y)))*mix(.48,.91,landscapeNoise(vLandscapeWorld.xz*.015));
  vec3 rockColor=landscapeSample(landscapeRockMap,landscapeUV*.57+vec3(12.6,8.1,2.7),normalize(vLandscapeNormal));
  landscapeColor=mix(landscapeColor,rockColor,exposedRock);` : ''}
  float geologicalRegion=landscapeNoise(vLandscapeWorld.xz*.0028+vec2(27.1,8.3));
  float bedding=landscapeNoise(vec2(vLandscapeWorld.y*.018+landscapeNoise(vLandscapeWorld.xz*.004)*3.7,dot(vLandscapeWorld.xz,vec2(.0017,.0024))));
  float stratum=smoothstep(.32,.74,bedding)*(.3+.7*geologicalRegion);
  vec3 mineralA=${material.userData.asfaltoRegion==='cuesta_lipan'?'vec3(.83,.76,.68)':material.userData.asfaltoRegion==='aconcagua_horcones'?'vec3(.84,.86,.88)':'vec3(.78,.85,.71)'};
  landscapeColor*=mix(vec3(1.04,1.01,.96),mineralA,stratum*.66);
  ${FOREST_TRACKS.has(material.userData.asfaltoRegion)?`float protectedMoss=smoothstep(.12,.72,normalize(vLandscapeNormal).y)*(1.0-smoothstep(.2,.8,dot(normalize(vLandscapeNormal),vec3(.82,0.,.57))))*landscapeNoise(vLandscapeWorld.xz*.15);landscapeColor=mix(landscapeColor,landscapeColor*vec3(.68,.83,.54),protectedMoss*.44);`:''}
  diffuseColor.rgb *= landscapeColor;
  float snowHeight = smoothstep(${Number(snowLine - 180).toFixed(2)}, ${Number(snowLine + 230).toFixed(2)}, vLandscapeWorld.y + (landscapeMacro.r - 0.5) * 410.0);
  float snowSlope = smoothstep(0.24, 0.75, max(0.0,normalize(vLandscapeNormal).y));
  float snowAspect=.72-.28*dot(normalize(vLandscapeNormal.xz+vec2(.0001)),normalize(vec2(.55,.83)));
  float landscapeSnowCover=snowHeight*snowSlope*mix(.55,1.0,snowAspect)${mountainSnow?'*smoothstep(.12,.78,vMountainSnow)*smoothstep(.32,.74,normalize(vLandscapeNormal).y)':''};
  float landscapeMeltFringe=snowSlope*smoothstep(.05,.32,snowHeight)*(1.0-smoothstep(.48,.8,snowHeight))*(1.0-landscapeSnowCover);
  diffuseColor.rgb*=1.0-landscapeMeltFringe*.18;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.83, 0.86), landscapeSnowCover * 0.78);
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
#ifdef USE_COLOR_ALPHA
  diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, ${material.userData.asfaltoVertexVariation ? '1.0' : '0.025'});
  diffuseColor.a *= vColor.a;
#elif defined(USE_COLOR)
  diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, ${material.userData.asfaltoVertexVariation ? '1.0' : '0.025'});
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= mix(0.88, 1.0, landscapeSample(roughnessMap, landscapeCoordinates(vLandscapeWorld), normalize(vLandscapeNormal)).g);
#endif
#ifdef USE_MAP
  roughnessFactor=mix(roughnessFactor,.34,landscapeMeltFringe*.85);
  roughnessFactor=mix(roughnessFactor,.64,landscapeSnowCover);
#endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
#ifdef USE_NORMALMAP
  vec3 landscapeN = normalize(vLandscapeNormal);
  vec3 weightsN = pow(abs(landscapeN), vec3(4.0));
  weightsN /= max(dot(weightsN, vec3(1.0)), 0.0001);
  vec3 normalUV = landscapeCoordinates(vLandscapeWorld);
  vec2 nX = landscapePlane(normalMap, normalUV.yz).xy * 2.0 - 1.0;
  vec2 nY = landscapePlane(normalMap, normalUV.xz).xy * 2.0 - 1.0;
  vec2 nZ = landscapePlane(normalMap, normalUV.xy).xy * 2.0 - 1.0;
  vec3 detailN = vec3(0.0, nX.x, nX.y) * weightsN.x + vec3(nY.x, 0.0, nY.y) * weightsN.y + vec3(nZ.x, nZ.y, 0.0) * weightsN.z;
  normal = normalize(mat3(viewMatrix) * normalize(landscapeN + detailN * normalScale.x));
  #ifdef DOUBLE_SIDED
    normal *= faceDirection;
  #endif
#endif
// ASFALTO_LANDSCAPE_NORMAL_END`);
  };
  material.customProgramCacheKey = () => 'asfalto-landscape-v7-aspect-melt-' + metres + '-' + snowLine + '-' + Boolean(secondaryMaps)+'-'+(material.userData.asfaltoRegion||'backdrop')+'-'+mountainSnow;
}

export function improveAuthoredSurfaces(root, { THREE, id, textures, query, lengthM, roadField }) {
  configureSurfaceRelief(THREE);
  root.updateMatrixWorld?.(true);
  let changed = 0;
  const processed = new Set();
  const terrainSheets = new Set();
  const forestSheets = new Set();
  let waterLevel = -Infinity;
  root.traverse(mesh => {
    if (!mesh.isMesh || /^COLLISION_/i.test(mesh.name || '')) return;
    // Authored Garibaldi snow consists of 76 disconnected flat triangles, floating above the hillside.
    // Keep the named anchor but let orientation/altitude-aware surface snow own accumulation.
    if(id==='paso_garibaldi' && (/SNOW_PATCHES/.test(mesh.name+' '+mesh.parent?.name) || (!Array.isArray(mesh.material)&&mesh.material?.name==='MAT_SNOW'))) {mesh.geometry?.setDrawRange(0,0);mesh.userData.asfaltoReplacedSnowWedge=true;}
    // The exported foam is a bright continuous zigzag; a still mountain lake has no surf ribbon.
    let foamOwner = mesh;
    while (foamOwner && !/^(DETAIL_ShoreFoam_v3|DETAIL_Shore_Wetline)$/.test(foamOwner.name)) foamOwner = foamOwner.parent;
    if (foamOwner || (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(material => /^(M_ShoreFoam_v3|M_DL_Detail_ShoreWetline)$/.test(material?.name || ''))) mesh.geometry?.setDrawRange(0, 0);
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
      if (!material?.isMaterial) continue;
      if(id==='cuesta_lipan'&&material.name==='V2_TIRE_PBR'&&/TIRE_WEAR/.test(mesh.name)){
        for(const key of MAP_SLOTS){retainTexture(material,material[key]);material[key]=null;}
        material.color.set('#242421');material.metalness=0;material.roughness=1;material.opacity=.19;material.transparent=true;material.depthWrite=false;material.needsUpdate=true;material.userData.asfaltoRubberWear=true;
      }
      if(/GUARDRAIL|Guardrail|Galvanized_Metal|^V2_METAL_PBR$/.test(material.name)){
        // The Lipan export bakes blue paint into a shared metal map. Galvanized
        // road furniture uses its neutral metal response; retain the source map for unload.
        if(material.name==='V2_METAL_PBR'){retainTexture(material,material.map);material.map=null;}
        material.color?.set('#808780');material.emissive?.set('#000000');material.metalness=.42;material.roughness=.68;material.userData.asfaltoSurfaceColorBase=material.color?.clone();material.userData.asfaltoRegionalSteel=true;material.needsUpdate=true;
      }
      if (/^(M_Lake_Water|MAT_WATER(?:\.001)?|MAT_P1_RIVER)$/.test(material.name)) {
        if(id==='paso_garibaldi'&&material.name==='MAT_WATER.001'){mesh.userData.asfaltoWater={kind:'river',maxDepthM:.45,shoreWidthM:1.2,shallowColor:'#6a7053',deepColor:'#394c3c',absorptionPerMeter:.45,roughness:.28,attenuationDistanceM:2,depthSource:'derived-shallow-wetland-envelope-not-surveyed-bathymetry',flowDirection:{x:.82,z:.57},flowSpeedMps:.16};}
        if(material.name==='MAT_P1_RIVER'&&query&&Number.isFinite(lengthM)){const first=query.sample(0).position,last=query.sample(Math.min(lengthM,21000)).position,d=Math.hypot(last[0]-first[0],last[2]-first[2])||1,sign=last[1]>first[1]?-1:1;mesh.userData.asfaltoWater={kind:'river',maxDepthM:2,shoreWidthM:4,flowDirection:{x:(last[0]-first[0])/d*sign,z:(last[2]-first[2])/d*sign},flowSpeedMps:1.1};}
        // Water appearance and wave coordinates belong to the environment effects controller.
        waterLevel = Math.max(waterLevel, new THREE.Box3().setFromObject(mesh).max.y);
        continue;
      }
      const rule = surfaceRule(material.name, id);
      if (!rule || !textures[rule.asset]) continue;
      if ((id === 'cuesta_lipan' && material.name === 'V2_TERRAIN_PBR') || (id === 'aconcagua_horcones' && /MAT_P1_TERRAIN_/.test(material.name))) terrainSheets.add(mesh);
      if (FOREST_TRACKS.has(id) && /(Terrain_Andean|MAT_TERRAIN_|MAT_PEAT)/.test(material.name)) forestSheets.add(mesh);
      metricUV(THREE, mesh, rule.metres);
      mesh.receiveShadow = true;
      if (processed.has(material)) continue;
      processed.add(material);
      for (const key of MAP_SLOTS) retainTexture(material, material[key]);
      const maps = textures[rule.asset];
      material.map = maps.diff;
      material.normalMap = maps.normal;
      material.roughnessMap = maps.rough;
      material.metalnessMap = null; material.aoMap = null;
      material.metalness = 0; material.roughness = rule.roughness;
      material.envMapIntensity = rule.road ? 0.52 : 0.3;
      material.normalScale?.set(rule.normal, rule.normal);
      material.color?.set(rule.color);
      material.userData.asfaltoSurfaceColorBase = material.color.clone();
      material.userData.asfaltoRegion=id;
      material.flatShading = false;
      if (rule.terrain || /(SHOULDER|Shoulder_Gravel|MAT_P1_GRAVEL|MAT_DRAINAGE|Gravel_PBR)/.test(material.name)) {
        // Lipán's exported ridge sheet is single sided; reverse-facing folds otherwise vanish from the valley.
        if (id === 'cuesta_lipan' && material.name === 'V2_TERRAIN_PBR') material.side = THREE.DoubleSide;
        const secondaryMaps = rule.asset === 'aerial_grass_rock' ? textures.aerial_rocks_04 : rule.asset === 'gravel_floor' ? textures.rock_face : null;
        if (secondaryMaps) material.asfaltoTerrainRockTexture = secondaryMaps.diff;
        terrainProjection(material, rule.metres, 1e8, secondaryMaps);
      }
      const projection = rule.terrain || /(SHOULDER|Shoulder_Gravel|MAT_P1_GRAVEL|MAT_DRAINAGE|Gravel_PBR)/.test(material.name) ? 'landscape' : 'uv';
      const rock = /MAT_basalt|M_Rock_|Rock_PBR|MAT_ROCK|V2_ROCK_PBR/.test(material.name);
      material.userData.asfaltoSurfaceRole = rule.road ? 'road' : rock ? 'rock' : rule.terrain ? 'terrain' : 'gravel';
      installSurfaceRelief(material, {heightMap: maps.height, metres: rule.metres, projection,
        depthM: rule.road ? .008 : rock ? .16 : rule.terrain ? .07 : .045, silhouette: rock});
      material.userData.asfaltoSurfaceMetres = rule.metres;
      material.needsUpdate = true;
      changed++;
    }
  });
  if (id === 'dos_lagos' && forestSheets.size > 1 && roadField) {
    const joined = joinTerrainTiles(THREE, root, [...forestSheets]); forestSheets.clear(); forestSheets.add(joined);
  }
  if (roadField) for (const mesh of new Set([...forestSheets, ...terrainSheets])) {
    // Material names are shared by some independent boulders: refine only the
    // connected terrain sheet, never rocks, shrubs, collision or road meshes.
    if (mesh.userData.asfaltoReturnLandscape || !/(TERRAIN|Terrain)/.test(mesh.name + ' ' + mesh.parent?.name)) continue;
    const vista = /VISTA/.test(mesh.name), transition = /TRANSITION/.test(mesh.name);
    refineTerrainSurface(THREE, mesh, { roadField, waterLevel, region: id, roadMarginM: 8,
      maxTriangles: id === 'dos_lagos' ? 330000 : vista ? 65000 : transition ? 125000 : id === 'aconcagua_horcones' ? 260000 : 180000,
      targetEdgeM: vista ? 130 : transition ? 70 : 48, nearEdgeM: vista ? 90 : transition ? 35 : 14 });
    metricUV(THREE, mesh, mesh.material.userData.asfaltoSurfaceMetres || 8);
  }
  if(id==='aconcagua_horcones')exposeAuthoredRiver(THREE,root,roadField);
  if (query?.project && Number.isFinite(lengthM)) {
    let floorY = Infinity;
    for (let s = 0; s <= lengthM; s += Math.max(1, lengthM / 100)) floorY = Math.min(floorY, query.sample(s).position[1] - 250);
    for (const mesh of terrainSheets) closeTerrainEdges(THREE, mesh, { query, floorY, talus: true });
  }
  applySurfaceVertexColors(THREE,root,{id});
  return changed;
}

// Correlated age/cover creates stands and openings in world space. It never
// changes the terrain or collider and is stable at streaming boundaries.
export function forestHabitat(x,z,id='dos_lagos'){
 const cell=95,ix=Math.floor(x/cell),iz=Math.floor(z/cell),u=x/cell-ix,v=z/cell-iz;
 const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7+(id==='paso_garibaldi'?71:31))*43758.5453;return n-Math.floor(n);};
 const smooth=t=>t*t*(3-2*t),a=smooth(u),b=smooth(v),mix=(x,y,t)=>x+(y-x)*t;
 const grove=mix(mix(hash(ix,iz),hash(ix+1,iz),a),mix(hash(ix,iz+1),hash(ix+1,iz+1),a),b);
 const mature=Math.max(0,Math.min(1,(grove-.25)/.5));
 return{grove,cover:.10+.85*smooth(mature),maturity:.25+.75*mature};
}
export function createForestPlacements({ id, query, heightAt, maxTrees = 12000, detailRange = null, lengthM = query.lengthM }) {
  const random = rng(id === 'dos_lagos' ? 43109 : 43117), trees = [];
  if (!Number.isFinite(lengthM) || lengthM <= 0) return trees;
  const startM=detailRange?.startM||0,endM=detailRange?.endM||lengthM;
  const spacing = Math.max(10, (endM-startM) / Math.floor(maxTrees / 12));
  for (let s = startM; s < endM && trees.length < maxTrees; s += spacing) {
    for (let band = 0; band < 16 && trees.length < maxTrees; band++) {
      const sample = query.sample(Math.min(lengthM, Math.max(0, s + (random() - 0.5) * spacing)));
      const side = band % 2 ? 1 : -1;
      const offsets = [11, 28, 48, 74, 112, 166, 235, 330];
      const offset = side * (offsets[Math.floor(band / 2)] + random() * (band < 2 ? 15 : band < 6 ? 35 : 85));
      const position = sample.position.map((v, i) => v + sample.frame.left[i] * offset);
      const height = heightAt(position[0], position[2]);
      if(!Number.isFinite(height))continue;
      // Grove density follows terrain-space patches, not parallel route bands.
      const habitat=forestHabitat(position[0],position[2],id);
      if(random()>habitat.cover)continue;
      const slopeX=heightAt(position[0]+3,position[2]),slopeZ=heightAt(position[0],position[2]+3);
      if(Number.isFinite(slopeX)&&Number.isFinite(slopeZ)&&Math.hypot(slopeX-height,slopeZ-height)/3>1.35)continue;
      const nearest=query.project?.([position[0],height,position[2]]);if(nearest&&nearest.distanceXZ<(nearest.widthM||8)/2+5.5)continue;
      if (!Number.isFinite(height) || height < sample.position[1] - (id==='paso_garibaldi'?100:20) || height > sample.position[1] + 310) continue;
      // Reject lake-floor placements and terrain outside the authored mesh.
      position[1] = height - 0.2;
      const age=habitat.maturity*.72+random()*.28;
      trees.push({position,roadDistanceM:nearest?.distanceXZ??Math.abs(offset),height:6+age*22,width:.58+habitat.maturity*.22+random()*.18,rotation:random()*Math.PI*2,variation:Math.floor(random()*3),grove:habitat.grove});
    }
  }
  return trees;
}

export function terrainHeightSampler(THREE, root) {
  // A spatial triangle grid makes thousands of vertical placements cheap and deterministic.
  const grid = new Map(), water = [], size = 80, bounds = new THREE.Box3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (mesh.isMesh && /^(WATER_|LAGO_ESCONDIDO)/.test(mesh.name)) water.push(new THREE.Box3().setFromObject(mesh));
    if (!mesh.isMesh || mesh.userData.asfaltoReplacedTerrain || /^(COLLISION_)|SOURCE_OWNER/i.test(mesh.name) || (!/(ENV_Terrain_|TERRAIN_HERO|TERRAIN_TRANSITION|^TERRAIN_)/.test(mesh.name)
      && !/^(V2_TERRAIN_PBR|MAT_P1_TERRAIN_|M_Terrain_Andean|MAT_TERRAIN_|MAT_PEAT|MAT_forest_floor|MAT_earthen_bank_PBR)/.test(mesh.material?.name || ''))) return;
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const count = index?.count || p.count;
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
      bounds.expandByPoint(a); bounds.expandByPoint(b); bounds.expandByPoint(c);
      const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(determinant) < 0.00001) continue;
      const triangle = [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, determinant];
      for (let x = Math.floor(Math.min(a.x, b.x, c.x) / size); x <= Math.floor(Math.max(a.x, b.x, c.x) / size); x++)
        for (let z = Math.floor(Math.min(a.z, b.z, c.z) / size); z <= Math.floor(Math.max(a.z, b.z, c.z) / size); z++) {
          const key = x + ':' + z;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(triangle);
        }
    }
  });
  const rawHeightAt = (x, z) => {
    let height = -Infinity;
    for (const t of grid.get(Math.floor(x / size) + ':' + Math.floor(z / size)) || []) {
      const wa = ((t[5] - t[8]) * (x - t[6]) + (t[6] - t[3]) * (z - t[8])) / t[9];
      const wb = ((t[8] - t[2]) * (x - t[6]) + (t[0] - t[6]) * (z - t[8])) / t[9];
      const wc = 1 - wa - wb;
      if (wa >= -0.0001 && wb >= -0.0001 && wc >= -0.0001) height = Math.max(height, wa * t[1] + wb * t[4] + wc * t[7]);
    }
    return height;
  };
  const heightAt=(x,z)=>{const height=rawHeightAt(x,z);
    if (water.some(box => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z && height < box.max.y + 0.4)) return NaN;
    return height;
  };
  heightAt.raw=rawHeightAt;
  heightAt.bounds = bounds;
  return heightAt;
}

export function addForest(THREE, root, id, query, lengthM, maps, heightAt, roadField, detailRange=null) {
  const austral=id==='paso_garibaldi';
  const backfill=detailRange?[]:forestBackfill({heightAt,roadField,valleyDepthM:austral?180:55});
  const far=austral?planAustralCanopyStands(backfill,{heightAt,roadField,habitat:(x,z)=>forestHabitat(x,z,id)}):backfill;
  const placements = [...createForestPlacements({ id, query, lengthM, heightAt, detailRange, maxTrees:detailRange?6000:12000 }), ...far];
  const group = new THREE.Group(); group.name = 'ASFALTO_REFERENCE_FOREST';
  const dummy = new THREE.Object3D();
  // Keep required authored nodes present for route/LOD validation, but replace their visible proxies.
  root.traverse(mesh => {
    let owner = mesh;
    while (owner && !/^(VEG_Canopy_|VEG_Trunks|VEG_ForestCards|VEG_Hero|VEG_Shrubs|DETAIL_Understory_Cards|FOREST_NEAR|FOREST_MID|FOREST_VISTA)/.test(owner.name)) owner = owner.parent;
    if (owner) {
      mesh.userData.asfaltoReplacedForest = true;
      // Existing adapters change .visible as their LOD toggles; zero draw range remains stable across that transition.
      mesh.geometry?.setDrawRange(0, 0);
    }
  });
  const chunks = new Map();
  for (const tree of placements) {
    const key = Math.floor(tree.position[0] / 900) + ':' + Math.floor(tree.position[2] / 900) + ':' + tree.variation;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(tree);
  }
  const geometry = austral?createForestImpostorGeometry(THREE):new THREE.PlaneGeometry(1, 1); if(!austral)geometry.translate(0, 0.48, 0);
  const materials = maps.map(map => new THREE.MeshStandardMaterial({ name:'ASFALTO_'+id+'_canopy', map, color: id === 'paso_garibaldi' ? '#b2beb0' : '#d2d3af', alphaTest: 0.44, side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0.2 }));
  for (const material of materials) {
    material.alphaToCoverage=true;
    material.userData.asfaltoRainCanopy=true;
    material.userData.asfaltoSnow=true;
    material.userData.asfaltoWind={heightM:1,baseY:0,maxBendM:.025};
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float asfaltoDetailedTree;\nvarying float vDetailedTree;\nvarying float vForestDistance;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDetailedTree=asfaltoDetailedTree;\nvForestDistance=distance(cameraPosition,(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDetailedTree;\nvarying float vForestDistance;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif(vDetailedTree>0.5){diffuseColor.a*=smoothstep(185.0,240.0,vForestDistance);if(diffuseColor.a<.002)discard;}');
    };
    material.customProgramCacheKey = () => 'forest-near-physical-v1';
    if(austral)installAustralCanopyShader(material);
  }
  for (const [key, list] of chunks) {
    const material = materials[list[0].variation];
    const copies=austral?1:2;
    const tileGeometry = geometry.clone(), detailFlags = new Float32Array(list.length * copies);
    list.forEach((tree, index) => {for(let p=0;p<copies;p++)detailFlags[index*copies+p] = tree.roadDistanceM <= 48 ? 1 : 0; });
    if(austral){
      tileGeometry.setAttribute('asfaltoCanopyStand',new THREE.InstancedBufferAttribute(new Float32Array(list.map(t=>t.canopyStand?1:0)),1));
      tileGeometry.setAttribute('asfaltoCanopyGround',new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(t=>t.canopyGround||[0,0,0,0])),4));
      const ground=list.flatMap(t=>t.canopyGround||[0]);
      tileGeometry.boundingBox.min.y=Math.min(-.02,...ground);
      tileGeometry.boundingBox.max.y=1+Math.max(0,...ground);
      tileGeometry.boundingBox.getBoundingSphere(tileGeometry.boundingSphere);
    }
    tileGeometry.setAttribute('asfaltoDetailedTree', new THREE.InstancedBufferAttribute(detailFlags, 1));
    const instanced = new THREE.InstancedMesh(tileGeometry, material, list.length * copies);
    instanced.name = 'Forest canopy ' + key; instanced.castShadow = false; instanced.receiveShadow = true;
    let index = 0;
    for (const tree of list) for (let plane = 0; plane < copies; plane++) {
      dummy.position.fromArray(tree.position); dummy.scale.set(tree.height * tree.width, tree.height, austral?tree.height*tree.width:1);
      dummy.rotation.set(0, tree.rotation + plane * Math.PI / 2, 0); dummy.updateMatrix();
      instanced.setMatrixAt(index++, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true; instanced.computeBoundingBox(); instanced.computeBoundingSphere();
    group.add(instanced);
  }
  geometry.dispose();
  root.add(group);
  return { placements, trees: placements.length, forestBatches: chunks.size, forestTriangles: placements.length * 4, canopyStands:far.filter(t=>t.canopyStand).length, replacedBackfillTrees:backfill.length };
}

function ridgeNoise(x, y) {
  return Math.sin(x * 1.43 + Math.sin(y * 0.91) * 1.8) * 0.48 + Math.sin(x * 3.71 - y * 1.17) * 0.25 + Math.sin(x * 7.23 + y * 4.11) * 0.15 + Math.sin(x * 19.4 - y * 11.8) * 0.075;
}

export function addMountainBackdrop(THREE, root, id, query, lengthM, textures, layer = 0) {
  if(id==='aconcagua_horcones')return addHorconesDEM(THREE,root,textures.horconesDEM,{heightAt:textures.demHeightAt});
  const forest = FOREST_TRACKS.has(id);
  const box = new THREE.Box3();
  for (let s = 0; s <= lengthM; s += Math.max(1, lengthM / 80)) box.expandByPoint(new THREE.Vector3().fromArray(query.sample(s).position));
  const center = box.getCenter(new THREE.Vector3());
  const span = box.getSize(new THREE.Vector3());
  let rx = span.x / 2 + (forest ? 4000 : 2400)+layer*1900, rz = span.z / 2 + (forest ? 4000 : 2400)+layer*1900;
  let clearance = 1;
  for (let s = 0; s <= lengthM; s += Math.max(1, lengthM / 80)) {
    const p = query.sample(s).position;
    clearance = Math.max(clearance, Math.hypot((p[0] - center.x) / rx, (p[2] - center.z) / rz) * 1.12);
  }
  rx *= clearance; rz *= clearance;
  const cols = layer===0?320:layer===1?224:160, rows = layer===0?48:layer===1?32:24, positions = [], indices = [], colors = [], snowRetention = [];
  const palette = id === 'cuesta_lipan' ? ['#948777', '#82746b', '#b6a789'] : forest ? ['#8c9796', '#a1aaac', '#b4bfc4'] : ['#8b8272', '#756f68', '#aca18c'];
  const baseColor = new THREE.Color();
  const focus=query.sample(lengthM*.38).frame?.tangent||[0,0,1];
  const bearing=id==='aconcagua_horcones'?Math.atan2(focus[2],focus[0])-Math.PI/2:0;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const localAngle = mountainAngleAtFraction(id,col / cols), angle=localAngle+bearing, u = row / rows;
    const profile=mountainProfile(id,localAngle,u,layer);
    snowRetention.push(profile.snowRetention);
    const {radius,falloff}=profile;
    const height = box.min.y - 120 + profile.height;
    positions.push(center.x + Math.cos(angle) * rx * radius, height, center.z + Math.sin(angle) * rz * radius);
    baseColor.set(palette[0]).lerp(new THREE.Color(palette[1]),profile.rockBand*.65);
    baseColor.lerp(new THREE.Color(palette[2]),Math.pow(falloff,2)*.38);
    // Muted linear vertex tint: exposed strata, dark gullies and cool far ridges.
    baseColor.multiplyScalar(.92+profile.rockBand*.16);
    baseColor.lerp(new THREE.Color('#a4b9ca'),layer*.10);
    baseColor.lerp(new THREE.Color('#ffffff'),.64); // linear tint over the rock albedo
    colors.push(baseColor.r, baseColor.g, baseColor.b);
    if (row < rows && col < cols) {
      const a = row * (cols + 1) + col, b = a + cols + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('asfaltoMountainSnow',new THREE.Float32BufferAttribute(snowRetention,1)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const map = textures.rock_face?.diff || textures.aerial_rocks_04?.diff || textures.aerial_grass_rock?.diff || null;
  const material = new THREE.MeshStandardMaterial({ map, color: layer===0?'#e5e0d7':layer===1?'#bec6c8':'#b8c5cd', vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.12, side: THREE.DoubleSide });
  material.userData.asfaltoRegion=id;
  material.userData.asfaltoVertexVariation=true;
  material.userData.asfaltoDistantMountain=true;
  material.userData.asfaltoMountainSnow=id==='aconcagua_horcones';
  material.userData.asfaltoMountainLayer=layer;
  terrainProjection(material, forest ? 110 : 150, id === 'cuesta_lipan' ? 1e8 : box.min.y + (id === 'aconcagua_horcones' ? 2050 : id === 'paso_garibaldi' ? 800 : 1080));
  const mesh = new THREE.Mesh(geometry, material); mesh.name = layer===0?'ASFALTO_REGIONAL_MOUNTAIN_BACKDROP':'ASFALTO_REGIONAL_MOUNTAIN_BACKDROP_'+layer;mesh.userData.asfaltoDistantRidge={layer,triangles:indices.length/3};
  // This distant visual mesh has no route surface or collision role.
  root.add(mesh);
  const next=layer<2?addMountainBackdrop(THREE,root,id,query,lengthM,textures,layer+1):{mountainTriangles:0,mountainLayers:0};
  return { mountainTriangles: indices.length / 3+next.mountainTriangles,mountainLayers:1+next.mountainLayers };
}

export async function loadSurfaceTextures(THREE, id, signal, sceneryOnly) {
  const rock = FOREST_TRACKS.has(id)||id==='cataratas_iguazu' ? 'aerial_rocks_04' : 'rock_face';
  const names = sceneryOnly ? [rock] : ['aerial_asphalt_01', 'gravel_floor', rock];
  if (!sceneryOnly && (FOREST_TRACKS.has(id)||id==='cataratas_iguazu')) names.push('aerial_grass_rock');
  const textures = {}, owned = [];
  const load = async (file, color = false, repeat = true) => {
    const texture = await new THREE.TextureLoader().loadAsync(new URL(file, ASSETS).href);
    owned.push(texture);
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  try {
    const settleAll = async promises => {
      const results = await Promise.allSettled(promises);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      return results.map(result => result.value);
    };
    const tasks = names.map(async name => {
      const roles = ['diff', 'normal', 'rough', 'height'];
      const maps = await settleAll(roles.map(role => load(name + '_' + role + (role === 'height' ? '.png' : '.jpg'), role === 'diff')));
      textures[name] = Object.fromEntries(roles.map((role, i) => [role, maps[i]]));
    });
    if (FOREST_TRACKS.has(id)) tasks.push(settleAll([0, 1, 2].map(i => load('forest-canopy-' + i + '.png', true, false))).then(value => { textures.forest = value; }));
    if (FOREST_TRACKS.has(id)) tasks.push(settleAll([load('detail-bark.jpg', true), load('detail-leaf.jpg', true)]).then(([bark, leaf]) => { textures.detailBark = bark; textures.detailLeaf = leaf; }));
    await settleAll(tasks);
    if (signal?.aborted) throw signal.reason || new Error('Track visual load aborted');
    return { textures, owned };
  } catch (error) { for (const texture of owned) texture.dispose(); throw error; }
}

export async function prepareTrackVisual(root, { id, query, lengthM, signal, scenery = true, sceneryOnly = false, detailRange = null, barrierSource = null, THREE = globalThis.__chevyV6Three || globalThis.THREE } = {}) {
  // Contract fixtures deliberately have no rendering engine or browser. Their route behavior stays independent.
  if (!root?.isObject3D || !THREE?.TextureLoader || typeof document === 'undefined') return null;
  if (root.userData.asfaltoReferenceVisual) return root.userData.asfaltoReferenceVisual;
  const { textures, owned } = await loadSurfaceTextures(THREE, id, signal, sceneryOnly);
  try { if(id==='aconcagua_horcones'&&scenery) textures.horconesDEM=await loadHorconesDEM(THREE,signal); }
  catch(error){for(const texture of owned)texture.dispose();throw error;}
  let templates;
  if (!sceneryOnly) {
    try { templates = await loadRoadsideTemplates(THREE, signal, id); }
    catch (error) { for (const texture of owned) texture.dispose(); textures.horconesDEM?.geometry.dispose(); throw error; }
  }
  const keeper = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  keeper.name = 'ASFALTO_VISUAL_RESOURCE_OWNER'; keeper.visible = false;
  for (let i = 0; i < owned.length; i++) keeper.material['asfaltoOwnedTexture' + i] = owned[i];
  // Make decoded model buffers reachable before any CPU decoration can throw.
  for (const [name, geometry] of templates || []) {
    const owner = new THREE.Mesh(geometry, keeper.material); owner.name = 'Detail template ' + name; keeper.add(owner);
  }
  if(textures.horconesDEM)keeper.add(new THREE.Mesh(textures.horconesDEM.geometry,keeper.material));
  root.add(keeper);
  const roadField = query && Number.isFinite(lengthM) ? visualRoadField(query, lengthM) : null;
  const changed = sceneryOnly ? 0 : improveAuthoredSurfaces(root, { THREE, id, textures, query, lengthM, roadField });
  let details = sceneryOnly ? {} : improveRegionalRoadMaterials(THREE,root,{query,id});
  let treePlacements = [];
  const heightAt = !sceneryOnly ? terrainHeightSampler(THREE, root) : null;
  if(heightAt&&query&&Number.isFinite(lengthM)){
    details={...details,...refineRegionalBoulders(THREE,root,{id,query,heightAt})};
    let source;root.traverse(mesh=>{if(!source&&mesh.userData.asfaltoTerrainRefinement)source=mesh.material;});
    if(source){
      const material=source.clone();delete material.userData.asfaltoRelief;material.vertexColors=true;material.transparent=true;material.opacity=.9;material.depthWrite=false;material.side=THREE.DoubleSide;
      material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;
      material.userData.asfaltoSurfaceColorBase=source.color.clone();
      const secondary=FOREST_TRACKS.has(id)?textures.aerial_rocks_04:textures.rock_face;
      if(secondary)material.asfaltoTerrainRockTexture=secondary.diff;
      terrainProjection(material,source.userData.asfaltoSurfaceMetres||8,1e8,secondary);
      details.shoulderTransition=addTerrainShoulderTransition(THREE,root,{query,lengthM,heightAt,material,embankment:id==='cuesta_lipan'});
    }
  }
  textures.demHeightAt=heightAt;
  if (scenery && query && Number.isFinite(lengthM)) {
    details = { ...details, ...addMountainBackdrop(THREE, root, id, query, lengthM, textures) };
    if (FOREST_TRACKS.has(id)) {
      const { placements, ...forestDetails } = addForest(THREE, root, id, query, lengthM, textures.forest, heightAt, roadField);
      treePlacements = placements; details = { ...details, ...forestDetails };
    }
  }
  if (templates && query && Number.isFinite(lengthM)) details = { ...details,
    ...addRoadsideDetails(THREE, root, { id, query, lengthM, heightAt, templates, textures, treePlacements, detailRange }) };
  else if (templates) for (const geometry of new Set(templates.values())) geometry.dispose();
  if(templates && heightAt && query)details={...details,...addRegionalLandscapeDetails(THREE,root,{id,query,lengthM,heightAt,textures,templates,scenery,detailRange,barrierSource:id==='cuesta_lipan'?barrierSource:null}),...addRegionalWayfinding(THREE,root,{id,query,lengthM,heightAt,templates,textures,detailRange})};
  else if(scenery&&query)root.userData.asfaltoRegionalCameras=regionalCameraProfiles({id,query,lengthM});
  if(scenery&&heightAt&&query)details={...details,...refineRegionalShoreline(THREE,root,{id,query,heightAt,textures})};
  if(query){const ys=Array.from({length:41},(_,i)=>query.sample(lengthM*i/40).position[1]),minY=Math.min(...ys),maxY=Math.max(...ys);root.userData.asfaltoWeather={snowLineM:minY+(maxY-minY)*.62,valleyFloorM:minY};}
  const vertexColors=applySurfaceVertexColors(THREE,root,{id});
  const reliefSet=new Set();
  root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m?.userData.asfaltoRelief)reliefSet.add(m);});
  const stats = { version: 4, materialCount: changed, textureCount: owned.length, reliefMaterials:reliefSet.size, vertexColors, ...details };
  root.userData.asfaltoRegionalReview = regionalReviewPlan({id,query,lengthM});
  root.userData.asfaltoReferenceVisual = stats;
  return stats;
}

export async function prepareReturnScenery(root,{id,query,lengthM,startM,signal,THREE=globalThis.__chevyV6Three||globalThis.THREE}={}){
  if(!root?.isObject3D||!THREE?.TextureLoader||typeof document==='undefined')return null;
  const detailRange={startM:startM+60,endM:lengthM-60};
  const {textures,owned}=await loadSurfaceTextures(THREE,id,signal,false);
  let templates;try{templates=await loadRoadsideTemplates(THREE,signal,id);}catch(error){for(const texture of owned)texture.dispose();throw error;}
  const keeper=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());keeper.name='ASFALTO_RETURN_SCENERY_RESOURCE_OWNER';keeper.visible=false;
  owned.forEach((texture,i)=>keeper.material['asfaltoOwnedTexture'+i]=texture);for(const[name,geometry]of templates){const owner=new THREE.Mesh(geometry,keeper.material);owner.name='Return detail template '+name;keeper.add(owner);}root.add(keeper);
  const heightAt=terrainHeightSampler(THREE,root),roadField=visualRoadField(query,lengthM);let placements=[],stats={};
  if(FOREST_TRACKS.has(id)){const forest=addForest(THREE,root,id,query,lengthM,textures.forest,heightAt,roadField,detailRange);placements=forest.placements;stats=forest;}
  stats={...stats,...addRoadsideDetails(THREE,root,{id,query,lengthM,heightAt,templates,textures,treePlacements:placements,detailRange}),...addRegionalLandscapeDetails(THREE,root,{id,query,lengthM,heightAt,templates,textures,detailRange})};
  stats.vertexColors=applySurfaceVertexColors(THREE,root,{id});
  delete stats.placements;root.userData.asfaltoReturnScenery={...stats,detailRange};return stats;
}

export async function prepareIguazuSurfaces(root,{THREE,signal}={}){
  if(typeof document==='undefined'||!THREE?.TextureLoader)return null;
  const {textures,owned}=await loadSurfaceTextures(THREE,'cataratas_iguazu',signal,false);
  const keeper=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
  keeper.name='ASFALTO_IGUAZU_SURFACE_RESOURCE_OWNER';keeper.visible=false;
  owned.forEach((texture,i)=>keeper.material['asfaltoOwnedTexture'+i]=texture);root.add(keeper);
  const materialCount=improveAuthoredSurfaces(root,{THREE,id:'cataratas_iguazu',textures});
  return {materialCount,textureCount:owned.length};
}
