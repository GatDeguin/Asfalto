import { effectsQuad, effectsRandom } from './weather-layers.mjs';
import { wheelWeatherEmission } from './weather-dynamics.mjs';
import { getVehicleEngineMount } from './vehicle-engine-mount.mjs?v=body-r3-20260916';
import { getVehicleDefinition } from './vehicle-catalog.mjs?v=body-r3-20260916';

/** Fixed reusable pool: spray, soil dust, tire/engine smoke, contact sparks and exhaust fire. */
export function createVehicleWeatherParticles(THREE,parent,{light=true}={}) {
  const capacity=560,random=effectsRandom(20260906),pool=Array.from({length:capacity},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0,age:0,kind:0,seed:0}));
  let cursor=0,limit=320,previousHeading=null,alive=0,disposed=false,lastVehicleId=null;
  const engineLocal=new THREE.Vector3(1.55,.4,0);
  const position=new THREE.Vector3(),sourceVelocity=new THREE.Vector3(),orientation=new THREE.Quaternion();
  const defaultTires=[new THREE.Vector3(),new THREE.Vector3()],defaultExhaust=new THREE.Vector3(),defaultEngine=new THREE.Vector3(),contactPosition=new THREE.Vector3();
  const wheelBudgets=new Map(),windVector=new THREE.Vector3(),carInverse=new THREE.Matrix4(),carScale=new THREE.Vector3(1,1,1);
  const fireLight=new THREE.PointLight('#ff9839',0,3.2,2);fireLight.name='AN_BoundedFireLight';fireLight.castShadow=false;if(light)parent.add(fireLight);let lightEnergy=0;
  function batch(additive) {
    const geometry=effectsQuad(THREE,capacity),positions=new Float32Array(capacity*3),velocities=new Float32Array(capacity*3),data=new Float32Array(capacity*4);
    geometry.setAttribute('aPosition',new THREE.InstancedBufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aVelocity',new THREE.InstancedBufferAttribute(velocities,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aData',new THREE.InstancedBufferAttribute(data,4).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({name:additive?'AN_FireContactSparks':'AN_SprayDustSmoke',uniforms:{uCarInverse:{value:carInverse},uEnclosed:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
      vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aPosition,aVelocity;attribute vec4 aData;varying vec2 vUv;varying vec4 vData;varying vec3 vParticleWorld;
void main(){vUv=uv;vData=aData;vParticleWorld=aPosition;vec4 mvPosition=viewMatrix*vec4(aPosition,1.);vec2 offset=position.xy*aData.z;
if(aData.y>2.5&&aData.y<3.5){vec2 direction=(viewMatrix*vec4(aVelocity,0.)).xy;direction=normalize(direction+vec2(.0001));offset=vec2(-direction.y,direction.x)*position.x*.012+direction*position.y*max(.08,aData.z);}
mvPosition.xy+=offset;gl_Position=projectionMatrix*mvPosition;
#include <logdepthbuf_vertex>
}`,
      fragmentShader:`#include <logdepthbuf_pars_fragment>
varying vec2 vUv;varying vec4 vData;varying vec3 vParticleWorld;uniform mat4 uCarInverse;uniform float uEnclosed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){vec2 p=(vUv-.5)*2.;float age=vData.x,kind=vData.y;float soft=1.-smoothstep(.3,1.,length(p));float grain=noise(vUv*5.+vData.w*23.)*.65+noise(vUv*11.)*.35;float fade=sin(clamp(age,0.,1.)*3.14159);
vec3 car=(uCarInverse*vec4(vParticleWorld,1.)).xyz;if(uEnclosed>.5&&abs(car.x)<1.35&&abs(car.z)<.84&&car.y>-.25&&car.y<1.3)discard;
vec3 color=vec3(.62,.69,.72);float alpha=soft*fade*.2;
if(kind>.5&&kind<1.5){color=vec3(.42,.33,.23);alpha=soft*fade*grain*.24;}
else if(kind>1.5&&kind<2.5){color=vec3(.39,.41,.4);alpha=soft*fade*grain*.22;}
else if(kind>2.5&&kind<3.5){color=mix(vec3(1.,.68,.17),vec3(.7,.09,.012),age);alpha=(1.-smoothstep(.15,1.,abs(p.x)))*(1.-smoothstep(.4,1.,abs(p.y)))*(1.-age);}
else if(kind>3.5){float shape=1.-smoothstep(.18,.8,length(vec2(p.x*(1.+vUv.y*1.5),p.y)));color=mix(vec3(1.,.78,.29),vec3(.8,.12,.016),vUv.y+age*.35);alpha=shape*(.6+grain*.4)*(1.-age)*.72;}
if(alpha<.005)discard;gl_FragColor=vec4(color,alpha);
#include <logdepthbuf_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name;mesh.frustumCulled=false;mesh.visible=false;parent.add(mesh);return{mesh,geometry,positions,velocities,data,count:0};
  }
  const alpha=batch(false),glow=batch(true),batches=[alpha,glow],attributeNames=['aPosition','aVelocity','aData'];
  function emit(kind,origin,count,power=1,lifetime=1,relativeVelocity=null) {
    for(let i=0;i<count;i++){
      const p=pool[cursor++%limit];p.kind=kind;p.age=0;p.seed=random();
      p.x=origin.x+(random()-.5)*.14;p.y=origin.y+random()*.1;p.z=origin.z+(random()-.5)*.14;
      p.vx=(random()-.5)*(kind===3?7:1.2)*power;p.vy=(kind===3?random()*4:kind===4?.8:random()*.6+.25)*power;p.vz=(random()*1.5+.4)*power;
      const inherited=kind===4?.8:kind===0?.32:kind===3?.18:.06;p.vx+=sourceVelocity.x*inherited;p.vz+=sourceVelocity.z*inherited;
      if(kind===3&&relativeVelocity){p.vx+=(relativeVelocity.x??relativeVelocity[0]??0)*.45;p.vy+=(relativeVelocity.y??relativeVelocity[1]??0)*.18;p.vz+=(relativeVelocity.z??relativeVelocity[2]??0)*.45;}
      p.life=kind===3?.16+random()*.28:kind===4?.065+random()*.10:.6+random()*1.2;
      if(kind===1||kind===2||kind===4)p.life*=lifetime;
      p.size=kind===3?.10+random()*.24:kind===4?.10+power*.2:kind===0?.06+random()*.15:.16+random()*.32;
    }
  }
  let sprayBudget=0,dustBudget=0,smokeBudget=0,engineBudget=0,engineFlameBudget=0;
  return{
    update({dt,vehicle,emission,policy,velocity,wind}){
      if(disposed)return;
      dt=Math.max(0,Math.min(.05,dt||0));if(dt===0)return;
      limit=Math.max(1,Math.min(capacity,Math.floor(policy.tier.particles)));
      const vehicleId=vehicle.id||'chevy';
      if(vehicleId!==lastVehicleId){
        lastVehicleId=vehicleId;const mount=getVehicleEngineMount(vehicleId),hood=mount?.hoodBounds;
        if(hood){
          const spec=getVehicleDefinition(vehicleId)?.calibration;
          const sx=spec?spec.wheelbaseM/(spec.sourceRearX-spec.sourceFrontX):mount.metersPerUnit;
          const sy=spec?(spec.heightM-spec.radiusM)/(spec.sourceRoof-spec.sourceWheelY):mount.metersPerUnit;
          const x=spec?spec.wheelbaseM*(1-spec.frontWeight)+spec.sourceFrontX*sx:0;
          const y=spec?spec.radiusM-spec.cgHeightM-spec.sourceWheelY*sy:0;
          engineLocal.set(x-(hood.min[0]+hood.max[0])*.5*sx,y+hood.max[1]*sy+.06,0);
        }
        else engineLocal.set(1.55,.4,0);
      }
      const origin=vehicle.position||{x:0,y:0,z:0},groundY=vehicle.groundY??origin.y,carLocal=vehicle.coordinateSpace==='car-local';
      sourceVelocity.copy(carLocal?position.set(0,0,0):velocity||position.set(0,0,0));orientation.copy(vehicle.quaternion||{x:0,y:0,z:0,w:1});
      if(wind)windVector.copy(wind);carInverse.compose(origin,orientation,carScale).invert();for(const target of batches)target.mesh.material.uniforms.uEnclosed.value=vehicle.enclosed!==false?1:0;
      const heading=Number(vehicle.heading)||0,delta=previousHeading==null?0:heading-previousHeading,c=Math.cos(delta),s=Math.sin(delta);previousHeading=heading;
      for(let i=0;i<capacity;i++){
        const p=pool[i];if(i>=limit){p.life=0;continue;}if(p.life<=0)continue;
        p.age+=dt;if(p.age>=p.life){p.life=0;continue;}
        if(carLocal){const x=p.x-origin.x,z=p.z-origin.z;p.x=origin.x+x*c+z*s;p.z=origin.z-x*s+z*c;}
        p.x+=(p.vx-(carLocal?velocity.x:0))*dt;p.y+=p.vy*dt;p.z+=(p.vz-(carLocal?velocity.z:0))*dt;
        const drag=1-Math.exp(-dt*(p.kind===3?.2:p.kind===0?.45:1.1));p.vx+=(windVector.x-p.vx)*drag;p.vz+=(windVector.z-p.vz)*drag;
        p.vy+=(p.kind===3?-9.81:p.kind===0?-2.2:1.0)*dt;
        if(p.kind===3&&p.y<groundY+.015){p.y=groundY+.015;p.vy=Math.abs(p.vy)*.25;p.vx*=.6;p.vz*=.6;}
        if(p.kind<3)p.size+=dt*(p.kind===0?.18:.35);
      }
      // The physical chassis uses +X forward. Caller-provided contact points are
      // preferred; these metre-scale offsets also follow body pitch and yaw.
      defaultTires[0].set(-1.35,0,-.76).applyQuaternion(orientation).add(origin);defaultTires[0].y=groundY+.04;
      defaultTires[1].set(-1.35,0,.76).applyQuaternion(orientation).add(origin);defaultTires[1].y=groundY+.04;
      defaultExhaust.set(-2.35,-.25,-.6).applyQuaternion(orientation).add(origin);defaultExhaust.y=Math.max(groundY+.22,defaultExhaust.y);
      defaultEngine.copy(engineLocal).applyQuaternion(orientation).add(origin);
      const tires=vehicle.tirePositions?.length?vehicle.tirePositions:defaultTires;
      const exhaust=vehicle.exhaustPosition||defaultExhaust,hood=vehicle.enginePosition||defaultEngine;
      const tierFactor=limit/560;
      if(Array.isArray(vehicle.wheelContacts)){
        for(let w=0;w<vehicle.wheelContacts.length;w++){
          const wheel=vehicle.wheelContacts[w],state=wheelWeatherEmission(wheel,vehicle.speedMps,policy.wetness),key=wheel.id??w;
          let budget=wheelBudgets.get(key);if(!budget){budget=[0,0,0];wheelBudgets.set(key,budget);}
          budget[0]+=dt*state.spray*90*tierFactor;budget[1]+=dt*state.dust*32*tierFactor;budget[2]+=dt*state.smoke*36*tierFactor;
          if(!wheel.point)continue;contactPosition.fromArray(wheel.point);contactPosition.y+=.025;
          for(let kind=0;kind<3;kind++){const count=Math.floor(budget[kind]);if(count){emit(kind,contactPosition,count,kind===0?1+state.spray:1,kind===1?state.dustLife:1);budget[kind]-=count;}}
        }
      }else{sprayBudget+=dt*emission.spray*145*tierFactor;dustBudget+=dt*emission.dust*65*tierFactor;smokeBudget+=dt*emission.tireSmoke*48*tierFactor;}
      engineBudget+=dt*(emission.engineSmoke*30+emission.engineFire*18)*tierFactor;
      engineFlameBudget+=dt*emission.engineFire*42*tierFactor;
      for(let kind=0;kind<3;kind++){const budget=kind===0?sprayBudget:kind===1?dustBudget:smokeBudget,count=Math.floor(budget);for(let i=0;i<count;i++)emit(kind,tires[i%tires.length],1,kind===0?1+emission.spray:1);if(kind===0)sprayBudget-=count;else if(kind===1)dustBudget-=count;else smokeBudget-=count;}
      if(engineBudget>=1){const count=Math.floor(engineBudget);emit(2,hood,count,1,emission.engineFire?2.2:1.7);engineBudget-=count;}
      if(engineFlameBudget>=1){const count=Math.floor(engineFlameBudget);emit(4,hood,count,.8+emission.engineFire*.6,3.5);engineFlameBudget-=count;}
      lightEnergy*=Math.exp(-dt*12);
      if(emission.fire>0){emit(4,exhaust,Math.ceil(2+emission.fire*9),emission.fire);emit(2,exhaust,1,.3,.75);lightEnergy=Math.max(lightEnergy,emission.fire*7);fireLight.position.copy(exhaust);}
      if(emission.engineFire){lightEnergy=1.8*emission.engineFire;fireLight.position.copy(hood);}
      fireLight.intensity=Math.min(2,lightEnergy);fireLight.visible=lightEnergy>.002;
      if(emission.sparks>0){const contact=vehicle.metalContact;if(Array.isArray(contact?.point))position.fromArray(contact.point);else position.copy(contact?.point||vehicle.impactPosition||origin);position.y=Math.max(groundY+.02,position.y);emit(3,position,Math.ceil((8+emission.sparks*28)*tierFactor),emission.sparks,1,contact?.relativeVelocity);}
      alpha.count=0;glow.count=0;alive=0;
      for(let i=0;i<limit;i++){const p=pool[i];if(p.life<=0)continue;const target=p.kind>=3?glow:alpha,n=target.count++,a=n*3,b=n*4;target.positions[a]=p.x;target.positions[a+1]=p.y;target.positions[a+2]=p.z;target.velocities[a]=p.vx;target.velocities[a+1]=p.vy;target.velocities[a+2]=p.vz;target.data[b]=p.age/p.life;target.data[b+1]=p.kind;target.data[b+2]=p.size;target.data[b+3]=p.seed;alive++;}
      for(const target of batches){target.geometry.instanceCount=target.count;target.mesh.visible=target.count>0;if(target.count)for(const key of attributeNames)target.geometry.attributes[key].needsUpdate=true;}
    },
    reset(){for(const p of pool)p.life=0;wheelBudgets.clear();lightEnergy=fireLight.intensity=0;fireLight.visible=false;previousHeading=null;cursor=0;alive=0;alpha.count=glow.count=0;sprayBudget=dustBudget=smokeBudget=engineBudget=engineFlameBudget=0;alpha.mesh.visible=glow.mesh.visible=false;alpha.geometry.instanceCount=glow.geometry.instanceCount=0;},
    getAliveCount:()=>alive,
    diagnostics:()=>({alive,capacity,limit,alpha:alpha.count,additive:glow.count,wheelSources:wheelBudgets.size,localLightIntensity:fireLight.intensity,wind:windVector.toArray()}),
    dispose(){if(disposed)return;disposed=true;fireLight.removeFromParent();for(const target of batches){target.mesh.removeFromParent();target.geometry.dispose();target.mesh.material.dispose();}},
  };
}
