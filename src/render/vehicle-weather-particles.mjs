import { effectsQuad, effectsRandom } from './weather-layers.mjs?v=3739704650e329ef';
import { wheelWeatherEmission } from './weather-dynamics.mjs?v=97b633343145b353';
import { getVehicleEngineMount } from './vehicle-engine-mount.mjs?v=0e10204a874b5b00';
import { getVehicleDefinition } from './vehicle-catalog.mjs?v=1fb2dbf31facc389';

/** Fixed reusable pool: spray, soil dust, tire/engine smoke, contact sparks and exhaust fire. */
export function createVehicleWeatherParticles(THREE,parent,{light=true}={}) {
  const capacity=560,random=effectsRandom(20260906),storage=new Float64Array(capacity*11);
  const pool={life:storage.subarray(0*capacity,1*capacity),x:storage.subarray(1*capacity,2*capacity),y:storage.subarray(2*capacity,3*capacity),z:storage.subarray(3*capacity,4*capacity),vx:storage.subarray(4*capacity,5*capacity),vy:storage.subarray(5*capacity,6*capacity),vz:storage.subarray(6*capacity,7*capacity),size:storage.subarray(7*capacity,8*capacity),age:storage.subarray(8*capacity,9*capacity),kind:storage.subarray(9*capacity,10*capacity),seed:storage.subarray(10*capacity,11*capacity)};
  let cursor=0,limit=320,previousHeading=null,alive=0,additiveAlive=0,disposed=false,lastVehicleId=null;
  const engineLocal=new THREE.Vector3(1.55,.4,0);
  const position=new THREE.Vector3(),sourceVelocity=new THREE.Vector3(),orientation=new THREE.Quaternion();
  const defaultTires=[new THREE.Vector3(),new THREE.Vector3()],defaultExhaust=new THREE.Vector3(),defaultEngine=new THREE.Vector3(),contactPosition=new THREE.Vector3();
  const wheelBudgets=new Float32Array(12),wheelEmission={spray:0,dust:0,smoke:0,dustLife:1},zeroOrigin=new THREE.Vector3(),identityRotation=new THREE.Quaternion(),windVector=new THREE.Vector3(),carInverse=new THREE.Matrix4(),carScale=new THREE.Vector3(1,1,1);
  const fireLight=new THREE.PointLight('#ff9839',0,3.2,2);fireLight.name='AN_BoundedFireLight';fireLight.castShadow=false;if(light)parent.add(fireLight);let lightEnergy=0;
  function batch() {
    const geometry=effectsQuad(THREE,capacity),positions=new Float32Array(capacity*3),velocities=new Float32Array(capacity*3),data=new Float32Array(capacity*4);
    geometry.setAttribute('aPosition',new THREE.InstancedBufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aVelocity',new THREE.InstancedBufferAttribute(velocities,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aData',new THREE.InstancedBufferAttribute(data,4).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({name:'AN_PooledVehicleParticles',uniforms:{uCarInverse:{value:carInverse},uEnclosed:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquation:THREE.AddEquation,
      vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aPosition,aVelocity;attribute vec4 aData;varying vec2 vUv;varying vec4 vData;varying vec3 vParticleWorld;
void main(){vUv=uv;vData=aData;vParticleWorld=aPosition;vec4 mvPosition=viewMatrix*vec4(aPosition,1.);float aliveScale=instanceMatrix[0][0];vec2 offset=position.xy*aData.z*aliveScale;
if(aData.y>2.5&&aData.y<3.5){vec2 direction=(viewMatrix*vec4(aVelocity,0.)).xy;direction=normalize(direction+vec2(.0001));offset=vec2(-direction.y,direction.x)*position.x*.012+direction*position.y*max(.08,aData.z);offset*=aliveScale;}
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
gl_FragColor.rgb*=alpha;gl_FragColor.a=kind>2.5?0.:alpha;
}`});
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);const matrices=mesh.instanceMatrix.array;matrices.fill(0);for(let i=0;i<capacity;i++)matrices[i*16+15]=1;geometry.instanceCount=capacity;mesh.name=material.name;mesh.frustumCulled=false;mesh.visible=false;mesh.userData.asfaltoPrewarm=true;parent.add(mesh);return{mesh,geometry,positions,velocities,data,count:0};
  }
  const alpha=batch(),attributeNames=['aPosition','aVelocity','aData'];
  function emit(kind,origin,count,power=1,lifetime=1,relativeVelocity=null) {
    for(let i=0;i<count;i++){
      const slot=cursor%limit;cursor=(slot+1)%limit;pool.kind[slot]=kind;pool.age[slot]=0;pool.seed[slot]=random();
      pool.x[slot]=origin.x+(random()-.5)*.14;pool.y[slot]=origin.y+random()*.1;pool.z[slot]=origin.z+(random()-.5)*.14;
      pool.vx[slot]=(random()-.5)*(kind===3?7:1.2)*power;pool.vy[slot]=(kind===3?random()*4:kind===4?.8:random()*.6+.25)*power;pool.vz[slot]=(random()*1.5+.4)*power;
      const inherited=kind===4?.8:kind===0?.32:kind===3?.18:.06;pool.vx[slot]+=sourceVelocity.x*inherited;pool.vz[slot]+=sourceVelocity.z*inherited;
      if(kind===3&&relativeVelocity){pool.vx[slot]+=(relativeVelocity.x??relativeVelocity[0]??0)*.45;pool.vy[slot]+=(relativeVelocity.y??relativeVelocity[1]??0)*.18;pool.vz[slot]+=(relativeVelocity.z??relativeVelocity[2]??0)*.45;}
      pool.life[slot]=kind===3?.16+random()*.28:kind===4?.065+random()*.10:.6+random()*1.2;
      if(kind===1||kind===2||kind===4)pool.life[slot]*=lifetime;
      pool.size[slot]=kind===3?.10+random()*.24:kind===4?.10+power*.2:kind===0?.06+random()*.15:.16+random()*.32;
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
      const origin=vehicle.position||zeroOrigin,groundY=vehicle.groundY??origin.y,carLocal=vehicle.coordinateSpace==='car-local';
      sourceVelocity.copy(carLocal?position.set(0,0,0):velocity||position.set(0,0,0));orientation.copy(vehicle.quaternion||identityRotation);
      if(wind)windVector.copy(wind);carInverse.compose(origin,orientation,carScale).invert();alpha.mesh.material.uniforms.uEnclosed.value=vehicle.enclosed!==false?1:0;
      const heading=Number(vehicle.heading)||0,delta=previousHeading==null?0:heading-previousHeading,c=Math.cos(delta),s=Math.sin(delta);previousHeading=heading;
      for(let i=0;i<capacity;i++){
        const slot=i;if(i>=limit){pool.life[slot]=0;continue;}if(pool.life[slot]<=0)continue;
        pool.age[slot]+=dt;if(pool.age[slot]>=pool.life[slot]){pool.life[slot]=0;continue;}
        if(carLocal){const x=pool.x[slot]-origin.x,z=pool.z[slot]-origin.z;pool.x[slot]=origin.x+x*c+z*s;pool.z[slot]=origin.z-x*s+z*c;}
        pool.x[slot]+=(pool.vx[slot]-(carLocal?velocity.x:0))*dt;pool.y[slot]+=pool.vy[slot]*dt;pool.z[slot]+=(pool.vz[slot]-(carLocal?velocity.z:0))*dt;
        const drag=1-Math.exp(-dt*(pool.kind[slot]===3?.2:pool.kind[slot]===0?.45:1.1));pool.vx[slot]+=(windVector.x-pool.vx[slot])*drag;pool.vz[slot]+=(windVector.z-pool.vz[slot])*drag;
        pool.vy[slot]+=(pool.kind[slot]===3?-9.81:pool.kind[slot]===0?-2.2:1.0)*dt;
        if(pool.kind[slot]===3&&pool.y[slot]<groundY+.015){pool.y[slot]=groundY+.015;pool.vy[slot]=Math.abs(pool.vy[slot])*.25;pool.vx[slot]*=.6;pool.vz[slot]*=.6;}
        if(pool.kind[slot]<3)pool.size[slot]+=dt*(pool.kind[slot]===0?.18:.35);
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
        for(let w=0;w<Math.min(4,vehicle.wheelContacts.length);w++){
          const wheel=vehicle.wheelContacts[w],state=wheelWeatherEmission(wheel,vehicle.speedMps,policy.wetness,wheelEmission),budgetOffset=w*3;
          wheelBudgets[budgetOffset+0]+=dt*state.spray*90*tierFactor;wheelBudgets[budgetOffset+1]+=dt*state.dust*32*tierFactor;wheelBudgets[budgetOffset+2]+=dt*state.smoke*36*tierFactor;
          if(!wheel.point)continue;contactPosition.fromArray(wheel.point);contactPosition.y+=.025;
          for(let kind=0;kind<3;kind++){const count=Math.floor(wheelBudgets[budgetOffset+kind]);if(count){emit(kind,contactPosition,count,kind===0?1+state.spray:1,kind===1?state.dustLife:1);wheelBudgets[budgetOffset+kind]-=count;}}
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
      fireLight.intensity=Math.min(2,lightEnergy);fireLight.visible=true;
      if(emission.sparks>0){const contact=vehicle.metalContact;if(Array.isArray(contact?.point))position.fromArray(contact.point);else position.copy(contact?.point||vehicle.impactPosition||origin);position.y=Math.max(groundY+.02,position.y);emit(3,position,Math.ceil((8+emission.sparks*28)*tierFactor),emission.sparks,1,contact?.relativeVelocity);}
      alive=0;additiveAlive=0;alpha.count=0;const matrices=alpha.mesh.instanceMatrix.array;
      for(let i=0;i<capacity;i++){
        const slot=i,active=i<limit&&pool.life[slot]>0,m=i*16;
        matrices[m]=matrices[m+5]=matrices[m+10]=active?1:0;
        if(!active)continue;
        if(pool.kind[slot]>2.5)additiveAlive++;
        const a=i*3,b=i*4;alpha.positions[a]=pool.x[slot];alpha.positions[a+1]=pool.y[slot];alpha.positions[a+2]=pool.z[slot];
        alpha.velocities[a]=pool.vx[slot];alpha.velocities[a+1]=pool.vy[slot];alpha.velocities[a+2]=pool.vz[slot];
        alpha.data[b]=pool.age[slot]/pool.life[slot];alpha.data[b+1]=pool.kind[slot];alpha.data[b+2]=pool.size[slot];alpha.data[b+3]=pool.seed[slot];alive++;
      }
      alpha.count=alive;alpha.mesh.count=limit;alpha.mesh.visible=alive>0;alpha.mesh.instanceMatrix.needsUpdate=true;
      if(alive)for(let i=0;i<attributeNames.length;i++)alpha.geometry.attributes[attributeNames[i]].needsUpdate=true;
    },
    reset(){pool.life.fill(0);wheelBudgets.fill(0);lightEnergy=fireLight.intensity=0;fireLight.visible=true;previousHeading=null;cursor=0;alive=0;additiveAlive=0;alpha.count=0;sprayBudget=dustBudget=smokeBudget=engineBudget=engineFlameBudget=0;alpha.mesh.visible=false;alpha.mesh.instanceMatrix.array.fill(0);for(let i=0;i<capacity;i++)alpha.mesh.instanceMatrix.array[i*16+15]=1;alpha.mesh.instanceMatrix.needsUpdate=true;},
    getAliveCount:()=>alive,
    diagnostics:()=>({alive,capacity,limit,alpha:alive-additiveAlive,additive:additiveAlive,drawBatches:alive?1:0,wheelSources:4,localLightIntensity:fireLight.intensity,wind:windVector.toArray()}),
    dispose(){if(disposed)return;disposed=true;fireLight.removeFromParent();alpha.mesh.removeFromParent();alpha.mesh.dispose();alpha.geometry.dispose();alpha.mesh.material.dispose();},
  };
}
