import {DECLARATIONS,TRACE,DEPTH,VERTEX} from './surface-relief.glsl.mjs?v=7675ec5a7a7b8227';
import {computeReliefCurvature} from '../../render/surface-curvature.mjs?v=b65bd00ab81d3d27';
import {isHighGraphicsQuality} from '../../render/graphics-quality-policy.mjs?v=778703e2dae501e6';

// Inward relief with local quadratic convex silhouette tracing. The curvature
// approximation suits smooth rocks; it does not extrude prisms or change colliders.
const quality={anReliefSteps:{value:24},anReliefRange:{value:95},anReliefEnabled:{value:1},anReliefPDOEnabled:{value:1}};
let shaderChunks,three;
const installedMaterials=new WeakSet();
export function configureSurfaceRelief(THREE){three=THREE;shaderChunks=THREE.ShaderChunk;}
/** Call during geometry construction, before renderer upload. Caller owns geometry. */
export function prepareSurfaceReliefGeometry(geometry){
  if(!three||!geometry)return false;
  const attribute=computeReliefCurvature(three,geometry);
  if(!attribute)return false;
  geometry.setAttribute('anReliefCurvature',attribute);return true;
}
export function setSurfaceReliefQuality(tier='high'){
  quality.anReliefSteps.value=isHighGraphicsQuality(tier)?24:12;
  quality.anReliefRange.value=isHighGraphicsQuality(tier)?95:48;
  quality.anReliefEnabled.value=tier==='low'?0:1;
}
export function setSurfaceReliefPDO(enabled=true){quality.anReliefPDOEnabled.value=enabled?1:0;}
export function surfaceReliefDiagnostics(){
  return {enabled:!!quality.anReliefEnabled.value,maxSteps:quality.anReliefSteps.value,
    pixelDepthOffset:!!quality.anReliefPDOEnabled.value,depthEncoding:'perspective-and-logarithmic',fadeEndM:quality.anReliefRange.value,silhouette:'adjacency-metric-mean-curvature',physicalDeltaM:0};
}
export function installSurfaceRelief(material,{heightMap,metres=3,depthM=.045,projection='uv',silhouette=false}={}){
  if(!heightMap?.isTexture||!material?.isMeshStandardMaterial||!material.map||material.transparent||installedMaterials.has(material))return false;
  if(!(metres>0&&Number.isFinite(metres)&&depthM>0&&Number.isFinite(depthM)))return false;
  // Set extension requests before Three builds program parameters (GLSL1 hosts).
  material.extensions={...material.extensions,derivatives:true,shaderTextureLOD:true};
  const triplanar=projection==='landscape',previous=material.onBeforeCompile;
  const baseKey=material.customProgramCacheKey();
  installedMaterials.add(material);
  material.asfaltoHeightTexture=heightMap;
  const heightUniform={value:heightMap};
  material.userData.assetUniforms={...material.userData.assetUniforms,anHeightMap:heightUniform};
  if(silhouette){
    material.defaultAttributeValues={...material.defaultAttributeValues,anReliefCurvature:[0]};

  }
  material.userData.asfaltoRelief={depthM,metres,projection,silhouette,physicalDeltaM:0};
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    // Relief uses visible-surface normals and lighting chunks; native shadow
    // passes keep their depth/alpha implementation and actual mesh silhouette.
    if(this.isMeshDepthMaterial||this.isMeshDistanceMaterial)return;
    Object.assign(shader.uniforms,quality,{anHeightMap:heightUniform,anReliefDepth:{value:depthM}});
    if(renderer?.capabilities?.isWebGL2===false){
      if(!renderer.extensions?.has?.('EXT_shader_texture_lod'))throw new Error('Surface relief requires WebGL2 or EXT_shader_texture_lod');
      this.extensions={...this.extensions,shaderTextureLOD:true};
    }
    if(triplanar)shader.defines={...shader.defines,AN_RELIEF_LANDSCAPE:1};
    if(silhouette)shader.defines={...shader.defines,AN_RELIEF_SILHOUETTE:1};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAnReliefWorld;\nvarying vec3 vAnReliefNormal;\n#ifdef AN_RELIEF_SILHOUETTE\nattribute float anReliefCurvature;\nvarying float vAnReliefCurvature;\n#endif');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',VERTEX);
    shader.fragmentShader=shader.fragmentShader.replace('#include <uv_pars_fragment>','#include <uv_pars_fragment>\n'+DECLARATIONS);
    const anchor=triplanar?'vec3 landscapeUV = landscapeCoordinates(vLandscapeWorld);':'#include <map_fragment>';
    shader.fragmentShader=shader.fragmentShader.replace(anchor,TRACE+'\n'+anchor);
    if(triplanar){
      shader.fragmentShader=shader.fragmentShader.replaceAll('landscapeCoordinates(vLandscapeWorld)','landscapeCoordinates(anReliefWorld)');
    }else{
      // Keep the native include anchors for weather and later material hooks.
      // UV aliases are scoped to one chunk, including the chunks it expands.
      for(const [chunk,uv]of [['map_fragment','vMapUv'],['normal_fragment_maps','vNormalMapUv'],['roughnessmap_fragment','vRoughnessMapUv']]){
        if(!shaderChunks?.[chunk])continue;
        const anchor='#include <'+chunk+'>',value=uv==='vMapUv'?'anReliefUV':'('+uv+' + anReliefUV - vMapUv)';
        shader.fragmentShader=shader.fragmentShader.replace(anchor,'#define '+uv+' '+value+'\n'+anchor+'\n#undef '+uv);
      }
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.-anCavity*.18;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',DEPTH);
  };
  material.customProgramCacheKey=()=>baseKey+'|an-relief-v3-secant-'+projection+'-'+silhouette;
  material.needsUpdate=true;
  return true;
}

