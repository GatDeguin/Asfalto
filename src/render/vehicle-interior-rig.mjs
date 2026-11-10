import {getVehicleDefinition} from './vehicle-catalog.mjs?v=1fb2dbf31facc389';
import {installClassicCabinTrim} from './classic-cabin-trim.mjs?v=ca49ae66900d0ed1';
import {createSS250InteriorControls} from './ss250-interior-controls.mjs?v=88ce0aa6a33d0690';
import {installSS250InstrumentGlass} from './ss250-instrument-glass.mjs?v=e200ae68ce6dcce2';
import {installChevrolet400Finish,installHeritageHornBadge,installHeritageInteriorDetail} from './heritage-interior-detail.mjs?v=da4f2a284a5c6c12';
export function installVehicleInteriorRig(T,{root,vehicle,lods}){
 const definition=getVehicleDefinition(vehicle),pivots=[],axis=new T.Vector3(...(definition?.steeringAxis||[1,0,0])).normalize();
 const pickupSpokeIndex=vehicle==='pickup_3100'?new T.Quaternion().setFromAxisAngle(axis,35*Math.PI/180):null;
 for(const model of lods){
  const meshes=[];model.traverse(n=>{if(n.userData?.steeringWheel)meshes.push(n);});
  if(!meshes.length)continue;
  const pivot=new T.Group();
  pivot.name=vehicle+'_CockpitSteeringPivot';pivot.position.fromArray(definition.steeringCenterSource);
  model.add(pivot);model.updateWorldMatrix(true,true);
  for(const node of meshes){
   pivot.attach(node);
   // Index the pickup's spokes away from its two gauges when driving straight.
   if(pickupSpokeIndex){node.position.applyQuaternion(pickupSpokeIndex);node.quaternion.premultiply(pickupSpokeIndex);}
  }
  pivots.push(pivot);
 }
 const ss400=root.getObjectByName('SS250_PhysicalInterior_R53');
 const ss=ss400?createSS250InteriorControls(T,root):null;
 const glass=ss?installSS250InstrumentGlass(T,root):null;
 const finish=ss400?installChevrolet400Finish(ss400):null;
 const detail=['belair_1957','pickup_3100'].includes(vehicle)?installHeritageInteriorDetail(T,{root:lods[0],vehicle}):null;
 const badge=detail?installHeritageHornBadge(T,pivots[0],axis,vehicle):null;
 const trim=ss400||detail?installClassicCabinTrim(T,lods[0],vehicle):null;
 const visible=n=>{for(let p=n;p;p=p.parent)if(!p.visible)return false;return true;};
 let disposed=false,last=null,lights=false,instrumentPower=0,daylight=null;
 const applyIllumination=()=>{
  detail?.setInstrumentPower(instrumentPower,daylight??1);
  finish?.setInstrumentPower(instrumentPower,daylight??1);
 };
 return {
  update(sample={},fuelFraction){
   if(disposed)return;
   const s=sample.snapshot||{},c=s.controls||s.input||{},rpm=sample.rpm??s.engine?.rpm??0;
   const speedKph=Math.abs(sample.speedMps??s.speedMps??s.chassis?.speedMps??0)*3.6,steer=Number(c.steer)||0;
   last={speedKph,rpm,steer};
   for(const pivot of pivots)pivot.quaternion.setFromAxisAngle(axis,-steer*Math.PI*5/3);
   ss?.update({speedKph,rpm,steeringWheelRadians:-steer*Math.PI*5/3,throttle:c.throttle,brake:c.brake,clutch:1-(s.clutch?.engagement??1),temperatureC:s.engine?.temperatureC});
   detail?.update({speedKph,rpm,temperatureC:s.engine?.temperatureC,fuel:fuelFraction});
   if(detail||finish){
    const phase=sample.phase||'';
    const day=Number.isFinite(sample.nightAmount)?1-Math.min(1,Math.max(0,sample.nightAmount)):
     /night|moonrise/i.test(phase)?0:/sunset|dusk|dawn/i.test(phase)?.42:1;
    if(day!==daylight){daylight=day;applyIllumination();}
   }
  },
  setLights(on,power){
   if(disposed)return;
   lights=!!on;
   const next=lights?(Number.isFinite(power)?Math.min(1,Math.max(0,power)):1):0;
   if(next===instrumentPower)return;
   instrumentPower=next;applyIllumination();
  },
  getSteeringTargets:()=>[...pivots,...(ss?[root.getObjectByName('SS250_WheelAssembly')]:[])].filter(n=>n&&visible(n)),
  getPedalTarget(type){return ss?root.getObjectByName(type==='brake'?'SS250_BrakePedalPivot':'SS250_ThrottlePedalPivot'):null;},
  diagnostics:()=>({vehicle,disposed,steering:pivots.length,hornBadge:!!badge,trimFittings:trim?.fittings??0,ss250:ss?.diagnostics(),finish:finish?.diagnostics(),lights,instrumentPower,detail:detail?.diagnostics(),last}),
  dispose(){if(disposed)return;disposed=true;trim?.dispose();badge?.dispose();ss?.dispose();finish?.dispose();glass?.dispose();detail?.dispose();}
 };
}
