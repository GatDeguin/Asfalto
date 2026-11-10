import {getVehicleDefinition} from './vehicle-catalog.mjs?v=1fb2dbf31facc389';
import {createSS250InteriorControls} from './ss250-interior-controls.mjs?v=b48a81810fcdd7d3';
import {installSS250InstrumentGlass} from './ss250-instrument-glass.mjs?v=e200ae68ce6dcce2';
import {installChevrolet400Finish,installHeritageInteriorDetail} from './heritage-interior-detail.mjs?v=a0ca02862e78d9bd';
export function installVehicleInteriorRig(T,{root,vehicle,lods}){
 const definition=getVehicleDefinition(vehicle),pivots=[],axis=new T.Vector3(...(definition?.steeringAxis||[1,0,0])).normalize();
 for(const model of lods){const meshes=[];model.traverse(n=>{if(n.userData?.steeringWheel)meshes.push(n);});if(meshes.length){const pivot=new T.Group();pivot.name=vehicle+'_CockpitSteeringPivot';pivot.position.fromArray(definition.steeringCenterSource);model.add(pivot);model.updateWorldMatrix(true,true);for(const node of meshes)pivot.attach(node);pivots.push(pivot);}}
 const ss400=root.getObjectByName('SS250_PhysicalInterior_R53');
 const ss=ss400?createSS250InteriorControls(T,root):null;
 const glass=ss?installSS250InstrumentGlass(T,root):null;
 const finish=ss400?installChevrolet400Finish(ss400):null;
 const detail=['belair_1957','pickup_3100'].includes(vehicle)?installHeritageInteriorDetail(T,{root:lods[0],vehicle}):null;
 const visible=n=>{for(let p=n;p;p=p.parent)if(!p.visible)return false;return true;};
 let disposed=false,last=null,lights=false;
 return {
  update(sample={},fuelFraction){if(disposed)return;const s=sample.snapshot||{},c=s.controls||s.input||{},rpm=sample.rpm??s.engine?.rpm??0,speedKph=Math.abs(sample.speedMps??s.speedMps??s.chassis?.speedMps??0)*3.6,steer=Number(c.steer)||0;last={speedKph,rpm,steer};for(const pivot of pivots)pivot.quaternion.setFromAxisAngle(axis,-steer*Math.PI*5/3);ss?.update({speedKph,rpm,steeringWheelRadians:-steer*Math.PI*5/3,throttle:c.throttle,brake:c.brake,clutch:1-(s.clutch?.engagement??1),temperatureC:s.engine?.temperatureC});detail?.update({speedKph,rpm,temperatureC:s.engine?.temperatureC,fuel:fuelFraction});},
  setLights(on){on=!!on;if(disposed||lights===on)return;lights=on;detail?.update({lights});finish?.setLights(lights);},
  getSteeringTargets:()=>[...pivots,...(ss?[root.getObjectByName('SS250_WheelAssembly')]:[])].filter(n=>n&&visible(n)),
  getPedalTarget(type){return ss?root.getObjectByName(type==='brake'?'SS250_BrakePedalPivot':'SS250_ThrottlePedalPivot'):null;},
  diagnostics:()=>({vehicle,disposed,steering:pivots.length,ss250:ss?.diagnostics(),finish:finish?.diagnostics(),lights,detail:detail?.diagnostics(),last}),
  dispose(){if(disposed)return;disposed=true;ss?.dispose();finish?.dispose();glass?.dispose();detail?.dispose();}
 };
}
