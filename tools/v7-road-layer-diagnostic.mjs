import {createWeatherSurfaceController} from '../src/render/weather-surfaces.mjs?v=body-r3-20260916';
export async function layers({regional=false,weather=false}={}){
 globalThis.qaRebuild.reliefOnly(); const T=__chevyV6Three;
 const fake={children:qaRoadMeshes.map(e=>e.mesh),userData:{},updateMatrixWorld(){},traverse(callback){for(const e of qaRoadMeshes)callback(e.mesh);}};
 for(const e of qaRoadMeshes)e.mesh.material.name=e.material.name;
 let regionalResult=null;
 if(regional){const {improveRegionalRoadMaterials}=await import('../src/tracks/visuals/regional-road-surfaces.mjs');regionalResult=improveRegionalRoadMaterials(T,fake,{query:__asfaltoV6Modular.trackManager.active.routeQuery,id:'dos_lagos'});}
 if(weather){globalThis.qaWeatherController?.dispose();globalThis.qaWeatherController=createWeatherSurfaceController(T);qaWeatherController.setTrack({visualRoot:fake,materialBindings:qaRoadMeshes.map(e=>({material:e.mesh.material,role:'asphalt'}))});}
 __cockpit.render();return {regionalResult,weather:qaWeatherController?.diagnostics()};
}
