import {createVehiclePresentation} from './vehicle-presentation.mjs?v=body-r3-20260916';
import {createWorkshopInspection} from './workshop-inspection.mjs';
import {createWorkshopChassis} from './workshop-chassis.mjs';
import {createWorkshopEngine} from './workshop-engine.mjs?v=body-r3-20260916';
export async function prepareWorkshopVehicle(T,workshop,vehicle) {
 const parent=workshop.car,stage=new T.Group();stage.name=`WorkshopVehicle_${vehicle}`;stage.userData.vehicleSelectionMount=true;stage.visible=false;parent.add(stage);let presentation,committed=false,released=false;
 try{presentation=await createVehiclePresentation(T,{vehicle,modelRoot:stage,lodLevels:[0],loadGlb:globalThis.__asfaltoLoadVehicleModel,paintColor:['belair_1957','pickup_3100'].includes(vehicle)?undefined:(workshop.paintColor||globalThis.__chevyPaintColor||'#d66a24')});presentation.setEnvironment(workshop.presentation?.getRoomEnvironment()||null);}catch(error){stage.removeFromParent();throw error;}
 return{
  commit(){if(committed||released)return;workshop.chassis?.dispose();workshop.chassis=null;workshop.engine?.dispose();workshop.engine=null;workshop.inspection?.dispose();workshop.inspection=null;workshop.vehiclePresentation?.dispose();for(const child of [...parent.children])if(child!==stage){if(child.userData.vehicleSelectionMount)child.removeFromParent();else child.visible=false;}
   workshop.vehiclePresentation=presentation;workshop.vehicleId=vehicle;stage.visible=true;committed=true;parent.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(presentation.root);if(!box.isEmpty())parent.position.y+=(parent.userData.surfaceY||0)-box.min.y;parent.userData.floorY=parent.position.y;parent.updateWorldMatrix(true,true);
   workshop.inspection=createWorkshopInspection(T,workshop);workshop.engine=createWorkshopEngine(T,workshop);workshop.chassis=createWorkshopChassis(T,workshop);workshop.rayTracing?.invalidate();
   // Keep the display sightline inside the aisle when the longer authored cars replace the previous framing.
   const authoredDisplay=!workshop.deviceProfile?.phone&&['belair_1957','pickup_3100'].includes(vehicle);workshop.hotspots.general={...workshop.hotspots.general,yaw:authoredDisplay?-.9:-.82,...(authoredDisplay?{radius:Math.min(workshop.hotspots.general.radius,8.75),target:[0,1.05,0]}:{})};workshop.focus('general',true);workshop.resize();
  },
  dispose(){if(released||committed)return;released=true;presentation.dispose();stage.removeFromParent();},
 };
}
