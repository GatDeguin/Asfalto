/** Close-range rain impacts on real opaque body panels. Restores every chained hook. */
export function createVehicleRainSurfaces(THREE){
  const uniforms={uAnBodyRain:{value:0},uAnBodyWet:{value:0},uAnBodyTime:{value:0}},restores=new Map();let roots=[];
  function clear(){for(const restore of restores.values())restore();restores.clear();roots=[];}
  function bind(nextRoots=[]){nextRoots=nextRoots.filter(Boolean);if(nextRoots.length===roots.length&&nextRoots.every((root,i)=>root===roots[i]))return;clear();roots=nextRoots;
    for(const root of roots)root.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(!material?.isMeshStandardMaterial||material.transparent||material.transmission>0||restores.has(material)||/glass|vidrio|tire|neum|rubber|goma/i.test(material.name||''))continue;
      const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
      material.onBeforeCompile=function(shader,renderer){compile?.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAnBodyWorld;varying float vAnBodyTop;');
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAnBodyTop=max(0.,normalize(transformedNormal*mat3(viewMatrix)).y);');
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvAnBodyWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float uAnBodyRain,uAnBodyWet,uAnBodyTime;varying vec3 vAnBodyWorld;varying float vAnBodyTop;
float anBodyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec2 anCell=floor(vAnBodyWorld.xz*13.);vec2 anOffset=fract(vAnBodyWorld.xz*13.)-.5;float anPhase=fract(uAnBodyTime*1.8+anBodyHash(anCell));
float anRing=sin((length(anOffset)-anPhase*.38)*45.)*exp(-abs(length(anOffset)-anPhase*.3)*34.)*sin(anPhase*3.14159)*.00065*uAnBodyRain*smoothstep(.3,.8,vAnBodyTop)*(1.-smoothstep(5.,18.,length(vAnBodyWorld-cameraPosition)));
vec3 anBx=dFdx(-vViewPosition),anBy=dFdy(-vViewPosition),anBr1=cross(anBy,normal),anBr2=cross(normal,anBx);float anBdet=dot(anBx,anBr1);normal=normalize(max(abs(anBdet),1e-8)*normal-sign(anBdet)*(dFdx(anRing)*anBr1+dFdy(anRing)*anBr2));`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,max(.16,roughnessFactor*.76),uAnBodyWet*smoothstep(.3,.8,vAnBodyTop));');
      };
      material.customProgramCacheKey=function(){return(key?.call(this)||'')+'|an-body-rain-v1';};material.needsUpdate=true;restores.set(material,()=>{material.onBeforeCompile=compile;material.customProgramCacheKey=key;material.needsUpdate=true;});
    }});
  }
  return{bind,update({time,rain,wetness}){uniforms.uAnBodyTime.value=time;uniforms.uAnBodyRain.value=rain;uniforms.uAnBodyWet.value=wetness;},diagnostics:()=>({materials:restores.size,nearImpactRadiusM:18}),dispose:clear};
}
