/** Authored SS250 animation bindings. Caller supplies actual vehicle telemetry.
 * Pedal travels are provisional visual ranges, not certified linkage dimensions.
 */
import {createSS250SpeedPointer} from './ss250-speed-pointer.mjs?v=4e39523a343530ae';
const unit=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export const SS250_AUX_SCALES=Object.freeze({rpm:Object.freeze({node:'SS250_rpm_Pivot',min:0,max:6000}),temperatureC:Object.freeze({node:'SS250_water_Pivot',min:40,max:120})});
export function createSS250InteriorControls(T,root){
 const names=['SS250_WheelAssembly','SS250_ClutchPedalPivot','SS250_BrakePedalPivot','SS250_ThrottlePedalPivot'];
 const nodes=names.map(name=>{const node=root.getObjectByName(name);if(!node)throw new Error('Missing interior control: '+name);return node;});
 const rests=nodes.map(n=>n.quaternion.clone()),axisX=new T.Vector3(1,0,0),axisY=new T.Vector3(0,1,0),rotation=new T.Quaternion();
 const auxiliary=Object.entries(SS250_AUX_SCALES).map(([key,scale])=>{const node=root.getObjectByName(scale.node);return node?{key,scale,node,rest:node.quaternion.clone(),value:null}:null;}).filter(Boolean);
 const pointer=createSS250SpeedPointer(T,root);let disposed=false,lastInput=null;
 return {
  update({speedKph=0,steeringWheelRadians=0,clutch=0,brake=0,throttle=0,rpm,temperatureC}={}){
   if(disposed)return;
   const values=[Number.isFinite(steeringWheelRadians)?steeringWheelRadians:0,unit(clutch)*Math.PI/9,unit(brake)*Math.PI/9,-unit(throttle)*Math.PI/12];
   for(let i=0;i<nodes.length;i++)nodes[i].quaternion.copy(rests[i]).multiply(rotation.setFromAxisAngle(i===0?axisY:axisX,values[i]));
   for(const gauge of auxiliary){const value=gauge.key==='rpm'?rpm:temperatureC;gauge.value=Number.isFinite(value)?value:null;const fraction=gauge.value===null?0:unit((gauge.value-gauge.scale.min)/(gauge.scale.max-gauge.scale.min));gauge.node.quaternion.copy(gauge.rest).multiply(rotation.setFromAxisAngle(axisY,-Math.PI*1.5*fraction));}
   pointer.update(speedKph);lastInput={speedKph:pointer.getReading(),steeringWheelRadians:values[0],clutch:unit(clutch),brake:unit(brake),throttle:unit(throttle)};
  },
  dispose(){if(disposed)return;disposed=true;nodes.forEach((node,i)=>node.quaternion.copy(rests[i]));pointer.update(0);for(const gauge of auxiliary){gauge.node.quaternion.copy(gauge.rest);gauge.value=null;}},
  diagnostics(){return {disposed,speedKph:pointer.getReading(),bindings:names.slice(),auxiliary:auxiliary.map(g=>({name:g.key,value:g.value,available:g.value!==null,scaleEstimated:true})),unavailableSignals:['oilPressure','chargingCurrent'],pedalTravelEstimated:true,lastInput:lastInput?{...lastInput}:null};}
 };
}
