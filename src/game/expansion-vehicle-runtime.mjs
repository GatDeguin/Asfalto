import {getVehicleDefinition} from '../render/vehicle-catalog.mjs?v=vehicles-r1-20260916';
export function buildVehiclePhysicsSpec(base,id){
 const definition=getVehicleDefinition(id);if(!definition?.physicsEstimate)return base;
 return {...structuredClone(base),...structuredClone(definition.physicsEstimate),id:`${id}-${base.profile||'original'}`,label:definition.label,isCalibrationOnly:true};
}
export function authoredCockpitAnchors(id){
 const d=getVehicleDefinition(id);if(d?.cockpit!=='authored-interior')return null;
 const s=d.calibration,scaleX=s.wheelbaseM/(s.sourceRearX-s.sourceFrontX),scaleY=(s.heightM-s.radiusM)/(s.sourceRoof-s.sourceWheelY),scaleZ=(s.frontTrackM+s.rearTrackM)/4/s.sourceHalfTrack;
 const offsetX=s.wheelbaseM*(1-s.frontWeight)+s.sourceFrontX*scaleX,offsetY=s.radiusM-s.cgHeightM-s.sourceWheelY*scaleY;
 const transform=p=>[offsetX-p[0]*scaleX,offsetY+p[1]*scaleY,-p[2]*scaleZ];
 return {lookDownDeg:d.cockpitLookDownDeg||0,cockpit:transform(d.cockpitEyeSource),hood:transform([-.34,.245,0])};
}

export function authoredWindshieldMount(T,presentation,id){
 const fit=getVehicleDefinition(id)?.windshield;if(!fit)return null;const mount=new T.Group();mount.name='AuthoredWindshieldMount';mount.rotation.y=Math.PI/2;presentation.root.add(mount);return{cabinMount:mount,...fit,glassOffsetM:.001,bladeOffsetM:.0015,pivotBelowM:.008};
}
