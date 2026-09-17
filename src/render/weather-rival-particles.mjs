import {createVehicleWeatherParticles} from './vehicle-weather-particles.mjs?v=body-r3-20260916';
import {createVehicleEmissionState} from './weather-effects-policy.mjs';
const METAL=new Set(['metal','steel','guardrail','vehicle-metal']);
const EMPTY=Object.freeze([]);
/** Actual rival snapshots share the original player/rival particle quota. */
export function createRivalWeatherParticles(T,parent){
 const entries=new Map(),vehicles=[],keep=new Set();let totalAlive=0;
 function clear(){for(const e of entries.values()){e.particles.dispose();e.group.removeFromParent();}entries.clear();vehicles.length=0;totalAlive=0;}
 function prepare(inputs=EMPTY){
  keep.clear();vehicles.length=0;
  for(let i=0;i<Math.min(3,inputs.length);i++){
   const input=inputs[i],snapshot=input.snapshot;if(!snapshot?.chassis)continue;
   const id=String(input.id||'rival');keep.add(id);let entry=entries.get(id);
   if(!entry){
    const group=new T.Group();group.name='AN_RivalWeather_'+id;parent.add(group);
    const vehicle={id,position:new T.Vector3(),quaternion:new T.Quaternion(),velocity:new T.Vector3(),enclosed:true};
    entry={group,vehicle,particles:createVehicleWeatherParticles(T,group,{light:false}),emissions:createVehicleEmissionState(),lastImpact:null,impactPoint:new T.Vector3(),contact:{point:[0,0,0],relativeVelocity:[0,0,0],impulseNs:0,material:'metal'}};entries.set(id,entry);
   }
   const v=entry.vehicle,c=snapshot.chassis;
   v.position.fromArray(c.position);v.quaternion.fromArray(c.rotation);if(c.linearVelocity)v.velocity.fromArray(c.linearVelocity);
   if(!c.linearVelocity)v.velocity.set(0,0,0);v.speedMps=v.velocity.length();
   v.wheelContacts=snapshot.wheels||EMPTY;let y=0,n=0;v.surface='asphalt';
   for(const w of v.wheelContacts)if(w.contact&&w.point){y+=w.point[1];if(n===0)v.surface=w.surface||'asphalt';n++;}
   v.groundY=n?y/n:v.position.y-.6;v.rpm=snapshot.engine?.rpm||0;v.throttle=snapshot.controls?.throttle||0;
   v.engineTemperatureC=snapshot.engine?.temperatureC;v.engineDamage=snapshot.damage?.engine;v.engineFire=v.engineDamage?.fire===true;v.metalContact=null;
   const impacts=snapshot.impacts||EMPTY;if(!impacts.length)entry.lastImpact=null;
   for(let j=impacts.length-1;j>=0;j--){
    const event=impacts[j];if(!METAL.has(event.material)&&event.otherId!=='chevy'&&event.otherId!=='falcon')continue;
    const key=event.timeSeconds+'|'+event.otherId+'|'+event.impulseNs;if(key===entry.lastImpact)break;entry.lastImpact=key;
    entry.impactPoint.fromArray(event.localPointM||[0,0,0]).applyQuaternion(v.quaternion).add(v.position).toArray(entry.contact.point);
    if(event.relativeVelocityMps)for(let k=0;k<3;k++)entry.contact.relativeVelocity[k]=event.relativeVelocityMps[k];else v.velocity.toArray(entry.contact.relativeVelocity);
    entry.contact.impulseNs=event.impulseNs;entry.contact.material=METAL.has(event.material)?event.material:'vehicle-metal';v.metalContact=entry.contact;break;
   }
   vehicles.push(v);
  }
  for(const [id,e]of entries)if(!keep.has(id)){e.particles.dispose();e.group.removeFromParent();entries.delete(id);}return vehicles;
 }
 return{prepare,
  update({dt,policy,wind}){totalAlive=0;for(const e of entries.values()){
   if(dt>0){e.vehicle.dt=dt;e.vehicle.wetness=policy.wetness;e.particles.update({dt,vehicle:e.vehicle,emission:e.emissions.update(e.vehicle),policy,velocity:e.vehicle.velocity,wind});}
   totalAlive+=e.particles.getAliveCount();
  }},
  reset(){for(const e of entries.values()){e.particles.reset();e.emissions.reset();e.lastImpact=null;}totalAlive=0;},clear,
  diagnostics:()=>({count:entries.size,totalAlive,vehicles:[...entries].map(([id,e])=>({id,position:e.vehicle.position.toArray(),speedMps:e.vehicle.speedMps,...e.particles.diagnostics()})),drawBatches:entries.size*2}),dispose:clear};
}
