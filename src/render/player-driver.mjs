import {getVehicleDefinition} from './vehicle-catalog.mjs?v=d34c237e4bf2bab0';
import {VEHICLE_VISUAL_CALIBRATION} from './vehicle-physical-calibration.mjs';
import {createTrafficDriver} from './traffic-driver.mjs?v=6a52e1173920be49';

export function playerDriverSeat(id){
  const definition=getVehicleDefinition(id),fit=definition?.calibration||VEHICLE_VISUAL_CALIBRATION[id];
  if(!fit)return null;
  const sx=fit.wheelbaseM/(fit.sourceRearX-fit.sourceFrontX),sy=(fit.heightM-fit.radiusM)/(fit.sourceRoof-fit.sourceWheelY);
  const sz=(fit.frontTrackM+fit.rearTrackM)/4/fit.sourceHalfTrack;
  const offsetX=fit.wheelbaseM*(1-fit.frontWeight)+fit.sourceFrontX*sx;
  const offsetY=fit.radiusM-fit.cgHeightM-fit.sourceWheelY*sy;
  // The rig is in chassis metres, with its own yaw to convert -X to physical +X.
  const source=([x,y,z])=>[x*sx-offsetX,y*sy+offsetY,z*sz];
  const authoredEye=definition?.cockpitEyeSource||(id==='chevy_400_1957'?[.22,.235,.15865]:null);
  const roofM=fit.heightM-fit.cgHeightM;
  const eye=authoredEye?source(authoredEye):[.39-offsetX,roofM-.245,.40];
  const wheel=definition?.steeringCenterSource?source(definition.steeringCenterSource):[eye[0]-.46,eye[1]-.29,eye[2]];
  const [x,y,z]=definition?.steeringAxis||[1,0,0];
  return {eye,wheel,roofM,steeringAxis:[x*sx,y*sy,z*sz]};
}

export function createPlayerDriver(T,id){
  const seat=playerDriverSeat(id);
  if(!seat)return null;
  const driver=createTrafficDriver(T,{...seat,animatedHands:true});
  driver.root.name='PlayerDriver';
  driver.root.rotation.y=Math.PI;
  driver.root.visible=false;
  return {
    root:driver.root,
    update(mode,steeringRad,{opening=false,exterior=true}={}){
      driver.root.visible=exterior&&(mode==='chase'||mode==='cinematic'||opening);
      if(driver.root.visible)driver.setSteering(steeringRad);
    },
    dispose:driver.dispose,
  };
}
