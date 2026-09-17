import {createWaterSceneReflection} from './water-scene-reflection.mjs?v=balance-20260917';
import {resolveWaterOptics} from './weather-water-optics.mjs';
import { createWaterHydrology, installRoadHydrology } from './weather-hydrology.mjs';
const WATER_NAMES = /^(M_Lake_Water|MAT_WATER(?:\.\d+)?|MAT_P1_RIVER)$/;
const SURFACE_SHADER = `
varying vec3 vAnFxSurface,vAnFxWorldPosition,vAnFxWorldNormal;varying float vAnFxSlope;varying vec2 vAnFxHydrology;
uniform float uAnFxTime,uAnFxWetness,uAnFxRain,uAnFxWind,uAnFxSnow,uAnFxSnowDetail;
uniform vec3 uAnWaterShallow,uAnWaterDeep;uniform float uAnWaterAbsorption;
uniform sampler2D uAnWaterReflection;uniform mat4 uAnWaterReflectMatrix;uniform float uAnWaterReflectReady;
uniform sampler2D uAnCanopyField;uniform vec4 uAnCanopyBounds,uAnWheelPaths[24];uniform float uAnCanopyEnabled,uAnWheelPathStrengths[24];uniform int uAnWheelPathCount;
float anRoadWetness(vec3 p){float wet=uAnFxWetness;vec2 uv=(p.xz-uAnCanopyBounds.xy)/uAnCanopyBounds.zw;
if(uAnCanopyEnabled>.5&&all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){float edge=smoothstep(0.,.07,uv.x)*smoothstep(0.,.07,uv.y)*(1.-smoothstep(.93,1.,uv.x))*(1.-smoothstep(.93,1.,uv.y));wet*=1.-texture2D(uAnCanopyField,uv).r*edge*.35;}
float cleared=0.;for(int i=0;i<24;i++){if(i>=uAnWheelPathCount)break;vec4 line=uAnWheelPaths[i];vec2 direction=line.zw-line.xy;float t=clamp(dot(p.xz-line.xy,direction)/max(.001,dot(direction,direction)),0.,1.);float d=length(p.xz-line.xy-direction*t);cleared=max(cleared,(1.-smoothstep(.11,.23,d))*uAnWheelPathStrengths[i]);}
return wet*(1.-cleared*.65);}
uniform float uAnFxCompactedSnow,uAnFxMelt,uAnFxSnowLine,uAnFxValleyFloor,uAnFxMist;
uniform vec3 uAnWindVector;uniform sampler2D uAnWaterField;uniform vec4 uAnWaterBounds;uniform vec2 uAnWaterFlow;uniform float uAnWaterShoreWidth,uAnWaterMaxDepth;
uniform sampler2D uAnFxSky;uniform float uAnFxSkyEnabled,uAnFxSkyIntensity;uniform mat3 uAnFxSkyRotation;
float anSurfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float anSurfaceNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(anSurfaceHash(i),anSurfaceHash(i+vec2(1,0)),f.x),mix(anSurfaceHash(i+vec2(0,1)),anSurfaceHash(i+1.),f.x),f.y);}
float anRainHeight(vec2 p){vec2 cell=floor(p*2.3),q=fract(p*2.3)-.5;float phase=fract(uAnFxTime*1.35+anSurfaceHash(cell));float radius=length(q);return sin((radius-phase*.7)*66.)*exp(-abs(radius-phase*.4)*30.)*sin(phase*3.14159)*.0028;}
float anWaterHeight(vec2 p){float t=uAnFxTime;vec2 d=normalize(uAnWindVector.xz+vec2(.001));vec2 transverse=vec2(-d.y,d.x);vec2 advected=p-uAnWaterFlow*t;vec2 q=vec2(dot(advected,d),dot(advected,transverse));
float range=length(vAnFxWorldPosition-cameraPosition),longLod=1.-smoothstep(500.,1800.,range),midLod=1.-smoothstep(60.,250.,range),shortLod=1.-smoothstep(25.,100.,range),microLod=1.-smoothstep(15.,60.,range);
float broadPhase=anSurfaceNoise(p*.004)*6.28318,localPhase=anSurfaceNoise(p*.018-d*t*.015)*3.;
return (sin(q.x*.23+q.y*.08-t*.68+broadPhase)*.019
+sin(q.x*.13-q.y*.29-t*.51+broadPhase*1.31)*.013
+sin(q.x*.41+q.y*.19-t*.77+localPhase)*.006)*longLod
+sin(q.x*.85+q.y*.37-t*.9+broadPhase*1.7+localPhase)*.016*midLod
+sin(q.x*1.9-q.y*.72-t*1.4+localPhase*1.3)*.007*shortLod
+sin(q.x*4.7+q.y*2.1-t*2.+localPhase)*.002*microLod+anRainHeight(p)*uAnFxRain*shortLod;}
`;
function patchSurface(material, uniforms, kind, transmissionChunk) {
  const water=kind==='water',ground=kind==='ground',fogOnly=kind==='fog';
  const compile=material.onBeforeCompile,cache=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    compile?.call(this,shader,renderer);
    // Depth/distance passes inherit this hook through vegetation wrappers but
    // do not calculate transformedNormal. Preserve the upstream alpha/wind
    // hooks while leaving lit surface weather out of those shadow shaders.
    if(!shader.vertexShader.includes('#include <defaultnormal_vertex>'))return;
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAnFxSurface,vAnFxWorldPosition,vAnFxWorldNormal;varying float vAnFxSlope;varying vec2 vAnFxHydrology;'+(kind==='asphalt'?'\nattribute vec2 anFxHydrology;':''));
    if(!fogOnly)shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAnFxSurface = position;vAnFxWorldNormal=normalize(transformedNormal * mat3(viewMatrix));vAnFxSlope=max(0.,vAnFxWorldNormal.y);vAnFxHydrology='+(kind==='asphalt'?'anFxHydrology':'vec2(0.)')+';');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
vec4 anFxWorld=vec4(transformed,1.);
#ifdef USE_INSTANCING
anFxWorld=instanceMatrix*anFxWorld;
#endif
vAnFxWorldPosition=(modelMatrix*anFxWorld).xyz;
vAnFxSurface=vAnFxWorldPosition;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+SURFACE_SHADER);
    // Terrain projection owns color/roughness chunks; main remains a common,
    // unconditional anchor across Standard, Physical and chained terrain hooks.
    if(!fogOnly)shader.fragmentShader=shader.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/,main=>main+'\nfloat anWorldWetness='+(kind==='asphalt'?'anRoadWetness(vAnFxWorldPosition)':'uAnFxWetness')+';');
    const normalAnchor=shader.fragmentShader.includes('// ASFALTO_LANDSCAPE_NORMAL_END')?'// ASFALTO_LANDSCAPE_NORMAL_END':'#include <normal_fragment_maps>';
    if(!fogOnly)shader.fragmentShader=shader.fragmentShader.replace(normalAnchor,`${normalAnchor}
float anHeight=${water?'anWaterHeight(vAnFxSurface.xz)*(1.+uAnFxWind*.13)':ground?'0.':'anRainHeight(vAnFxSurface.xz)*uAnFxRain*anWorldWetness'};
vec3 anDx=dFdx(-vViewPosition),anDy=dFdy(-vViewPosition);vec3 anR1=cross(anDy,normal),anR2=cross(normal,anDx);float anDet=dot(anDx,anR1);
normal=normalize(max(abs(anDet),1e-8)*normal-sign(anDet)*(dFdx(anHeight)*anR1+dFdy(anHeight)*anR2));
${ground?'roughnessFactor=mix(roughnessFactor,max(.4,roughnessFactor*.84),anWorldWetness*.75);':''}
${water?`vec2 anWaterUV=(vAnFxSurface.xz-uAnWaterBounds.xy)/uAnWaterBounds.zw;vec2 anDepthShore=texture2D(uAnWaterField,anWaterUV).rg;
float anAbsorption=1.-exp(-anDepthShore.x*uAnWaterAbsorption);
diffuseColor.rgb=mix(uAnWaterShallow,uAnWaterDeep,anAbsorption);
float anContactFoam=(1.-smoothstep(.1,uAnWaterShoreWidth,anDepthShore.y))*smoothstep(.003,.04,anHeight)*(.3+.7*uAnFxRain);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.7,.67),min(.24,anContactFoam*.24));
`:`float anSnow=0.,anSnowDrift=.5,anSnowGrain=.5;
if(uAnFxSnow>.0001){
 // Stable metre-space deposition: broad patches and leeward ridges reveal the
 // original terrain/rock/leaf color until accumulation reaches each threshold.
 vec2 anSnowWind=normalize(uAnWindVector.xz+vec2(.001)),anSnowAcross=vec2(-anSnowWind.y,anSnowWind.x);
 float anAltitude=smoothstep(uAnFxSnowLine-70.,uAnFxSnowLine+160.,vAnFxWorldPosition.y);
 float anShelter=.76+.24*clamp(1.-dot(vAnFxWorldNormal.xz,anSnowWind),0.,1.);
 float anSnowCoverage=clamp(uAnFxSnow*(.66+.34*anAltitude)*anShelter,0.,1.);
 float anSnowMacro=anSurfaceNoise(vAnFxSurface.xz*.075);
 anSnowDrift=anSurfaceNoise(vec2(dot(vAnFxSurface.xz,anSnowWind)*.085,dot(vAnFxSurface.xz,anSnowAcross)*.46)+anSnowMacro*1.7);
 float anSnowField=.10+.70*(anSnowMacro*.46+anSnowDrift*.32+anSurfaceNoise(vAnFxSurface.xz*.63+vAnFxSurface.y*.11)*.22);
 float anSnowSlope=smoothstep(mix(.58,.30,anSnowCoverage),mix(.9,.68,anSnowCoverage),vAnFxSlope);
 anSnow=anSnowSlope*smoothstep(anSnowField-.085,anSnowField+.085,anSnowCoverage)*smoothstep(0.,.06,uAnFxSnow);
 // Grain detail fades before subpixel frequencies alias. Low quality uses the
 // same deposition and powder material with no extra near-surface noise read.
 if(uAnFxSnowDetail>.35){float anGrainLod=uAnFxSnowDetail*(1.-smoothstep(8.,35.,length(vAnFxWorldPosition-cameraPosition)));anSnowGrain=mix(.5,anSurfaceNoise(vAnFxSurface.xz*68.+vAnFxSurface.y*13.),anGrainLod);}
}
diffuseColor.rgb*=mix(vec3(1.),vec3(.76,.79,.81),anWorldWetness*(1.-anSnow)*${ground?'.65':'.3'});
if(uAnFxSnow>.0001){
 vec3 anPowder=mix(vec3(.66,.73,.81),vec3(.87,.91,.94),.38+anSnowDrift*.62)*(.96+.08*anSnowGrain);
 anPowder=mix(anPowder,anPowder*vec3(.80,.86,.91),clamp(uAnFxCompactedSnow+uAnFxMelt*1.6,0.,.65));
 diffuseColor.rgb=mix(diffuseColor.rgb,anPowder,anSnow*${ground?'.96':'.78'});
 roughnessFactor=mix(roughnessFactor,clamp(.92-uAnFxCompactedSnow*.22-uAnFxMelt*.28+(anSnowGrain-.5)*.12,.56,.98),anSnow);
 metalnessFactor*=1.-anSnow*.98;
 // Cover smooths authored micro-relief only under powder; uncovered POM and
 // geometric vertex colors keep their existing shading and silhouette.
 vec3 anSnowMacroNormal=normalize(mat3(viewMatrix)*vAnFxWorldNormal);
 if(dot(anSnowMacroNormal,normal)<0.)anSnowMacroNormal=-anSnowMacroNormal;
 normal=normalize(mix(normal,anSnowMacroNormal,anSnow*.62));
 float anSnowHeight=(anSnowGrain-.5)*.0009*anSnow;
 vec3 anSnowR1=cross(anDy,normal),anSnowR2=cross(normal,anDx);float anSnowDet=dot(anDx,anSnowR1);
 normal=normalize(max(abs(anSnowDet),1e-8)*normal-sign(anSnowDet)*(dFdx(anSnowHeight)*anSnowR1+dFdy(anSnowHeight)*anSnowR2));
}
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.74,.79,.82),uAnFxMelt*.24);`}`);
    if(!water&&!ground&&!fogOnly)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
float anPuddle=smoothstep(.001,.018,vAnFxHydrology.x)*(1.-smoothstep(.02,.12,vAnFxHydrology.y))*anWorldWetness;
roughnessFactor=mix(roughnessFactor,.22,anWorldWetness*.34+anPuddle*.62);
roughnessFactor=mix(roughnessFactor,.6,uAnFxCompactedSnow*.5);`);
    if(water)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
// Radiance capture stays linear; the normal and dielectric Fresnel come from
// this water surface. Beyond its footprint the physical HDRI remains active.
if(uAnWaterReflectReady>.5){
 vec4 anReflectionProject=uAnWaterReflectMatrix*vec4(vAnFxWorldPosition,1.);
 vec2 anReflectionUv=anReflectionProject.xy/max(.0001,anReflectionProject.w);
 vec3 anWaterNormalWorld=inverseTransformDirection(normal,viewMatrix);
 anReflectionUv+=anWaterNormalWorld.xz*.009;
 float anInside=step(.0001,anReflectionProject.w)*smoothstep(0.,.025,anReflectionUv.x)*smoothstep(0.,.025,anReflectionUv.y)*(1.-smoothstep(.975,1.,anReflectionUv.x))*(1.-smoothstep(.975,1.,anReflectionUv.y));
 vec2 anBlur=vec2(.0017,.003)*roughnessFactor;
 vec3 anReflection=(texture2D(uAnWaterReflection,anReflectionUv).rgb*.5+texture2D(uAnWaterReflection,anReflectionUv+anBlur).rgb*.25+texture2D(uAnWaterReflection,anReflectionUv-anBlur).rgb*.25);
 float anFresnel=.0204+.9796*pow(1.-clamp(dot(normal,geometryViewDir),0.,1.),5.);
 outgoingLight+=anInside*(anReflection*anFresnel-reflectedLight.indirectSpecular);
}
#include <opaque_fragment>`);
    if(water&&transmissionChunk)shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_fragment>',transmissionChunk.replace('material.thickness = thickness;',`material.thickness = clamp(anDepthShore.x,.025,8.) / max(.0001,length(modelMatrix[1].xyz));`));
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`
#ifdef USE_FOG
#ifdef FOG_EXP2
float anFogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
float anValley=exp(-max(0.,vAnFxWorldPosition.y-uAnFxValleyFloor)/32.);
float anHollow=.72+.28*anSurfaceNoise(vAnFxWorldPosition.xz*.008);
anFogFactor=1.-pow(max(.0001,1.-anFogFactor),1.+anValley*anHollow*uAnFxMist*.65);
#else
float anFogFactor=smoothstep(fogNear,fogFar,vFogDepth);
#endif
${material.userData.asfaltoDistantMountain ? `// Clear-air mountain contrast; rain and dense mist restore full atmospheric extinction.
anFogFactor*=mix(${(.58+(material.userData.asfaltoMountainLayer||0)*.07).toFixed(2)},1.,clamp(uAnFxMist+uAnFxRain,0.,1.));` : ''}
vec3 anFogColor=fogColor;
if(uAnFxSkyEnabled>.5&&anFogFactor>.01){
vec3 anSkyDirection=uAnFxSkyRotation*normalize(vAnFxWorldPosition-cameraPosition);
vec3 anSkyColor=texture2D(uAnFxSky,equirectUv(anSkyDirection)).rgb*uAnFxSkyIntensity;
#ifdef TONE_MAPPING
anSkyColor=toneMapping(anSkyColor);
#endif
anFogColor=linearToOutputTexel(vec4(anSkyColor,1.)).rgb;
}
gl_FragColor.rgb=mix(gl_FragColor.rgb,anFogColor,anFogFactor);
#endif`);
  };
  material.customProgramCacheKey=function(){return(cache?.call(this)||'')+'|an-fx-surface-v12-bank-reflection-'+kind+'-mountain-'+(material.userData.asfaltoMountainLayer??'none');};
  material.needsUpdate=true;
  return()=>{material.onBeforeCompile=compile;material.customProgramCacheKey=cache;material.needsUpdate=true;};
}

/** Owns only replacement water materials and shader hooks, never source maps/geometry. */
export function createWeatherSurfaceController(THREE,{roadWetness}={}) {
  const uniforms={uAnFxTime:{value:0},uAnFxWetness:{value:0},uAnFxRain:{value:0},uAnFxWind:{value:0},uAnFxSnow:{value:0},uAnFxSnowDetail:{value:1},uAnFxCompactedSnow:{value:0},uAnFxMelt:{value:0},uAnFxSnowLine:{value:0},uAnFxValleyFloor:{value:0},uAnFxMist:{value:0},uAnWindVector:{value:new THREE.Vector3(1,0,.3)},uAnWaterField:{value:null},uAnWaterBounds:{value:new THREE.Vector4()},uAnWaterFlow:{value:new THREE.Vector2()},uAnWaterShoreWidth:{value:1.5},uAnWaterMaxDepth:{value:18},uAnFxSky:{value:null},uAnFxSkyEnabled:{value:0},uAnFxSkyIntensity:{value:1},uAnFxSkyRotation:{value:new THREE.Matrix3()}};
  Object.assign(uniforms,{uAnCanopyField:{value:null},uAnCanopyBounds:{value:new THREE.Vector4(0,0,1,1)},uAnCanopyEnabled:{value:0},uAnWheelPaths:{value:Array.from({length:24},()=>new THREE.Vector4())},uAnWheelPathStrengths:{value:new Float32Array(24)},uAnWheelPathCount:{value:0}},roadWetness?.uniforms||{});
  let reflection=null,reflectionEntries=[];
  let originals=[],owned=[],unpatch=[],hydrology=[],roadRestores=[],root=null,children=[],wetCount=0,fogCount=0;
  const ownedSources=new Map();
  const audioWater={kind:'lake',distanceM:Infinity,flowMps:0,source:'mesh-shore-distance'};const audioPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  function clear(){reflection?.bind([]);reflectionEntries=[];audioPosition.set(Infinity,Infinity,Infinity);for(const restore of unpatch)restore();unpatch=[];for(const restore of roadRestores)restore();roadRestores=[];for(const field of hydrology)field.dispose();hydrology=[];for(const entry of originals)if(entry.mesh.material===entry.assigned)entry.mesh.material=entry.original;for(const material of owned)material.dispose();originals=[];owned=[];ownedSources.clear();root=null;children=[];wetCount=fogCount=0;uniforms.uAnFxSky.value=null;uniforms.uAnFxSkyEnabled.value=0;}
  function setTrack({visualRoot,materialBindings=[]}={}) {
    if(visualRoot===root)return;
    clear();root=visualRoot;if(!root)return;children=[...root.children];
    const weather=root.userData?.asfaltoWeather||{};uniforms.uAnFxSnowLine.value=weather.snowLineM??0;uniforms.uAnFxValleyFloor.value=weather.valleyFloorM??0;
    const roles=new Map(materialBindings.map(binding=>[binding.material,binding.role])),patched=new Set(),roadGeometries=new Set();
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];let changed=false;
      const assigned=list.map(material=>{
        if(!material)return material;
        const role=roles.get(material),isWater=!!mesh.userData.asfaltoWater||role==='water'||WATER_NAMES.test(material.name||'');
        if(role==='asphalt'&&!roadGeometries.has(mesh.geometry)){roadRestores.push(installRoadHydrology(THREE,mesh));roadGeometries.add(mesh.geometry);}
        if(!isWater&&!patched.has(material)&&material.isMeshStandardMaterial){const wet=['asphalt','terrain','shoulder'].includes(role)||material.userData.asfaltoSnow===true;if(wet){const prior=material.userData.asfaltoTemporalWeather;material.userData.asfaltoTemporalWeather=true;unpatch.push(()=>{if(prior===undefined)delete material.userData.asfaltoTemporalWeather;else material.userData.asfaltoTemporalWeather=prior;});}unpatch.push(patchSurface(material,uniforms,wet?(role==='asphalt'?'asphalt':'ground'):'fog'));patched.add(material);fogCount++;if(wet)wetCount++;}
        if(!isWater)return material;
        changed=true;
        const river=/RIVER/.test(material.name)||['river','drain'].includes(mesh.userData.asfaltoWater?.kind);
        const optics=resolveWaterOptics(mesh.userData.asfaltoWater,river);
        const water=new THREE.MeshPhysicalMaterial({name:material.name,color:'#ffffff',roughness:optics.roughness,metalness:0,ior:1.333,transmission:.12,thickness:river?.65:2.8,attenuationColor:optics.deepColor,attenuationDistance:optics.attenuationDistanceM,envMapIntensity:1,clearcoat:0,side:THREE.DoubleSide});
        // Authored silhouettes remain unchanged. Metric waves replace baked flat blue
        // maps; refraction uses Three's physical transmission pass, reflection its HDRI.
        water.userData={...material.userData,asfaltoWaterEffects:true,v7WaterOptics:optics};
        const field=createWaterHydrology(THREE,mesh);hydrology.push(field);const metadata=field.metadata,direction=metadata.flowDirection||{x:1,z:0};
        water.attenuationDistance=optics.attenuationDistanceM;
        water.depthWrite=true;water.toneMapped=true;const waterUniforms={uAnWaterReflection:{value:null},uAnWaterReflectMatrix:{value:new THREE.Matrix4()},uAnWaterReflectReady:{value:0}};reflectionEntries.push({mesh,uniforms:waterUniforms});patchSurface(water,{...uniforms,...waterUniforms,uAnWaterShallow:{value:new THREE.Color(optics.shallowColor)},uAnWaterDeep:{value:new THREE.Color(optics.deepColor)},uAnWaterAbsorption:{value:optics.absorptionPerMeter},uAnWaterField:{value:field.texture},uAnWaterBounds:{value:field.bounds},uAnWaterFlow:{value:new THREE.Vector2(direction.x??direction[0]??1,direction.z??direction[2]??0).normalize().multiplyScalar(Number(metadata.flowSpeedMps)||(river?.7:0))},uAnWaterShoreWidth:{value:Math.max(.15,Number(metadata.shoreWidthM)||1.5)},uAnWaterMaxDepth:{value:field.diagnostics.maxDepthM}},'water',THREE.ShaderChunk.transmission_fragment);
        owned.push(water);ownedSources.set(water,material);return water;
      });
      if(changed){const original=mesh.material;mesh.material=Array.isArray(original)?assigned:assigned[0];originals.push({mesh,original,assigned:mesh.material});}
    });
    reflection?.bind(reflectionEntries);
  }
  return{setTrack,
    renderReflections(options){if(!reflectionEntries.length)return false;if(!reflection){reflection=createWaterSceneReflection(THREE);reflection.bind(reflectionEntries);}else if(reflection.diagnostics().waterMeshes!==reflectionEntries.length)reflection.bind(reflectionEntries);return reflection.capture(options);},
    waterAudioAt(position){if(!position){audioWater.distanceM=Infinity;return audioWater;}if(audioPosition.distanceToSquared(position)<.25)return audioWater;audioPosition.copy(position);audioWater.distanceM=Infinity;for(const field of hydrology){const b=field.bounds,broad=Math.hypot(Math.max(b.x-position.x,0,position.x-b.x-b.z),Math.max(b.y-position.z,0,position.z-b.y-b.w));if(broad>audioWater.distanceM)continue;const distance=field.distanceToWater(position);if(distance<audioWater.distanceM){audioWater.distanceM=distance;audioWater.kind=field.metadata.kind||'lake';audioWater.flowMps=Number(field.metadata.flowSpeedMps)||(audioWater.kind==='river'?.7:0);}}return audioWater;},
    refresh({materialBindings,getMaterialBindings}={}){
      if(!root||root.children.length===children.length&&children.every((child,index)=>root.children[index]===child))return false;
      // Lipán swaps direct sector roots. Check their identities before asking the
      // adapter to traverse bindings, so an unchanged streaming frame does no scan.
      const visualRoot=root,bindings=(getMaterialBindings?.()||materialBindings||[]).map(binding=>({...binding,material:ownedSources.get(binding.material)||binding.material}));
      clear();setTrack({visualRoot,materialBindings:bindings});return true;
    },
    update({time,policy,skyFog,wind,dynamics}){uniforms.uAnFxTime.value=time;uniforms.uAnFxWetness.value=policy.wetness;uniforms.uAnFxRain.value=policy.rainy?policy.intensity:0;uniforms.uAnFxWind.value=policy.wind;uniforms.uAnFxSnow.value=Math.max(0,Math.min(1,Number(dynamics?.snowCover??(policy.snow?policy.snowIntensity??policy.intensity:0))||0));uniforms.uAnFxSnowDetail.value=policy.tier.snow>=1600?1:policy.tier.snow>=950?.65:.3;uniforms.uAnFxCompactedSnow.value=dynamics?.compactedSnow||0;uniforms.uAnFxMelt.value=dynamics?.meltWater||0;uniforms.uAnFxMist.value=policy.mist;if(wind)uniforms.uAnWindVector.value.copy(wind);uniforms.uAnFxSkyEnabled.value=skyFog?.enabled?1:0;uniforms.uAnFxSky.value=skyFog?.texture||null;uniforms.uAnFxSkyIntensity.value=skyFog?.intensity??1;if(skyFog?.rotation)uniforms.uAnFxSkyRotation.value.copy(skyFog.rotation);for(const material of owned){const transmission=policy.tier.transmission;if((material.transmission===0)!==(transmission===0))material.needsUpdate=true;material.transmission=transmission;material.roughness=Math.min(.7,material.userData.v7WaterOptics.roughness+policy.wind*.013);}},
    diagnostics:()=>({waterMaterials:owned.length,wetSurfaceShaders:wetCount,fogSurfaceShaders:fogCount+owned.length,waterMeshes:originals.length,hydrology:hydrology.map(field=>field.diagnostics),roadDrainage:roadRestores.length,snowCover:uniforms.uAnFxSnow.value,snowDetail:uniforms.uAnFxSnowDetail.value,snowAppearance:'slope-and-wind-powder-with-grain',optics:owned.map(material=>({...material.userData.v7WaterOptics})),waveDirections:3,reflection:reflection?.diagnostics()||{model:'physical-env',frames:0,ownedTargets:0},refraction:owned.some(material=>material.transmission>0)?'physical-transmission':'tier-disabled'}),
    dispose(){clear();reflection?.dispose();reflection=null;},
  };
}
