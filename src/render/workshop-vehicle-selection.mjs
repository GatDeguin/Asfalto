import {getVehicleDefinition} from './vehicle-catalog.mjs?v=79da6f20496c6a50';
import {createVehiclePresentation} from './vehicle-presentation.mjs?v=f6f84bf33ac89608';
import {createWorkshopInspection} from './workshop-inspection.mjs';
import {createWorkshopChassis} from './workshop-chassis.mjs';
import {createWorkshopEngine} from './workshop-engine.mjs?v=5d2c5df645fc643d';
export async function prepareWorkshopVehicle(T,workshop,vehicle) {
 const parent=workshop.car,stage=new T.Group();stage.name=`WorkshopVehicle_${vehicle}`;stage.userData.vehicleSelectionMount=true;stage.visible=false;parent.add(stage);let presentation,committed=false,released=false;
 try{presentation=await createVehiclePresentation(T,{vehicle,modelRoot:stage,loadGlb:globalThis.__asfaltoLoadVehicleModel,paintColor:getVehicleDefinition(vehicle)?.defaultPaint||workshop.paintColor||globalThis.__chevyPaintColor||'#d66a24'});presentation.setEnvironment(workshop.presentation?.getRoomEnvironment()||null);}catch(error){stage.removeFromParent();throw error;}
 return{
  commit(){if(committed||released)return;workshop.chassis?.dispose();workshop.chassis=null;workshop.engine?.dispose();workshop.engine=null;workshop.inspection?.dispose();workshop.inspection=null;workshop.vehiclePresentation?.dispose();for(const child of [...parent.children])if(child!==stage){if(child.userData.vehicleSelectionMount)child.removeFromParent();else child.visible=false;}
   workshop.vehiclePresentation=presentation;workshop.vehicleId=vehicle;stage.visible=true;committed=true;parent.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(presentation.root);if(!box.isEmpty())parent.position.y+=(parent.userData.surfaceY||0)-box.min.y;parent.userData.floorY=parent.position.y;parent.updateWorldMatrix(true,true);
   workshop.inspection=createWorkshopInspection(T,workshop);workshop.engine=createWorkshopEngine(T,workshop);workshop.chassis=createWorkshopChassis(T,workshop);workshop.rayTracing?.invalidate();workshop.focus('general',true);workshop.resize();
  },
  dispose(){if(released||committed)return;released=true;presentation.dispose();stage.removeFromParent();},
 };
}
