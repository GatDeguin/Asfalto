import {installMaterialHook} from './material-hook.mjs?v=6b3897bdbe3f1129';
/** One world-space wind field shared by precipitation, surface waves and vegetation. */
export function createWeatherWind(THREE){
  const uniforms={uAnWindTime:{value:0},uAnWindVector:{value:new THREE.Vector3(1.2,0,.36)},uAnWindGust:{value:1}};
  const restores=new Map(),target=new THREE.Vector3();let initialized=false;
  function bind(root){root?.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    const config=material?.userData?.asfaltoWind;if(!config||restores.has(material))continue;
    const patch=function(shader,renderer){Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
uniform float uAnWindTime,uAnWindGust;uniform vec3 uAnWindVector;`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 anTreeOrigin=vec4(0.,0.,0.,1.);float anTreeScale=1.;
#ifdef USE_INSTANCING
anTreeOrigin=instanceMatrix*anTreeOrigin;anTreeScale=max(.1,length(instanceMatrix[1].xyz));
#endif
vec3 anTreeWorld=(modelMatrix*anTreeOrigin).xyz;
float anTreeHeight=clamp((position.y-${Number(config.baseY||0).toFixed(4)})/${Math.max(.01,Number(config.heightM)||1).toFixed(4)},0.,1.);
float anTreePhase=dot(anTreeWorld.xz,normalize(uAnWindVector.xz+vec2(.001)))*.065-uAnWindTime*1.35;
float anExposure=.6+.4*sin(dot(anTreeWorld.xz,vec2(.0071,.0133))+1.2);
vec3 anWorldBend=uAnWindVector*${Math.max(0,Number(config.maxBendM)||0).toFixed(4)}*.13*anTreeHeight*anTreeHeight*(.62+.38*sin(anTreePhase))*uAnWindGust*anExposure;
vec3 anLocalBend=vec3(dot(anWorldBend,modelMatrix[0].xyz),dot(anWorldBend,modelMatrix[1].xyz),dot(anWorldBend,modelMatrix[2].xyz))/vec3(dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
transformed+=anLocalBend/max(1.,sqrt(anTreeScale));`);
    };
    restores.set(material,installMaterialHook(material,'weather-wind',{compile:patch,key:()=> '|an-common-wind-v1-'+[config.heightM,config.maxBendM,config.baseY||0].join('-')}));
  }});}
  return{uniforms,bind,
    update({dt,time,environment={},speed=1.2}){if(!(dt>0))return;
      const supplied=environment.windVector??environment.windMps;
      if(supplied&&typeof supplied==='object')target.set(supplied.x??supplied[0]??0,0,supplied.z??supplied[2]??0);
      else{const heading=Number(environment.windDirectionDeg??73),radians=(Number.isFinite(heading)?heading:73)*Math.PI/180,strength=typeof supplied==='number'&&Number.isFinite(supplied)?Math.max(0,supplied):speed;target.set(Math.sin(radians)*strength,0,Math.cos(radians)*strength);}
      if(!initialized){uniforms.uAnWindVector.value.copy(target);initialized=true;}else uniforms.uAnWindVector.value.lerp(target,1-Math.exp(-dt*.7));uniforms.uAnWindTime.value=time;
      uniforms.uAnWindGust.value=.86+.1*Math.sin(time*.37)+.04*Math.sin(time*1.17+2);
    },
    clear(){for(const restore of restores.values())restore();restores.clear();},
    diagnostics:()=>({vector:uniforms.uAnWindVector.value.toArray(),gust:uniforms.uAnWindGust.value,foliageMaterials:restores.size}),
    dispose(){this.clear();},
  };
}
