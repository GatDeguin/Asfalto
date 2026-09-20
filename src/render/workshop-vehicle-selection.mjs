import {preparePrograms} from './shader-preparation.mjs';
import {getVehicleDefinition} from './vehicle-catalog.mjs?v=1fb2dbf31facc389';
import {createVehiclePresentation} from './vehicle-presentation.mjs?v=6698fa8c93c2dcfc';
import {createWorkshopInspection} from './workshop-inspection.mjs?v=f49feba020fb38ff';
import {createWorkshopChassis} from './workshop-chassis.mjs?v=13b36eb3a7d8a770';
import {createWorkshopEngine} from './workshop-engine.mjs?v=f57b4eeb4ba5e02f';
export async function prepareWorkshopVehicle(T,workshop,vehicle) {
 const parent=workshop.car,stage=new T.Group();stage.name=`WorkshopVehicle_${vehicle}`;stage.userData.vehicleSelectionMount=true;stage.visible=false;parent.add(stage);let presentation,committed=false,released=false;
 try{presentation=await createVehiclePresentation(T,{vehicle,lodLevels:[0],modelRoot:stage,loadGlb:globalThis.__asfaltoLoadVehicleModel,paintColor:getVehicleDefinition(vehicle)?.defaultPaint||workshop.paintColor||globalThis.__chevyPaintColor||'#d66a24'});presentation.setEnvironment(workshop.presentation?.getRoomEnvironment()||null);
  // Compile the staged car under the real workshop output before making it visible.
  // The group stays hidden, so the old car can continue rendering while this yields.
  if(workshop.advancedGraphics){workshop.advancedGraphics.refresh();workshop.advancedGraphics.update({time:0});await workshop.advancedGraphics.prepare(()=>preparePrograms(workshop.renderer,stage,workshop.camera,workshop.scene));}
 }catch(error){presentation?.dispose();stage.removeFromParent();throw error;}
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
