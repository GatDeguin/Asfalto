import { createGlbPointToPointAdapter } from './glb-point-to-point.mjs?v=400-review-r144-20260917';
import { createClosedRoute } from '../visuals/route-closure.mjs?v=400-review-r144-20260917';
import { prepareIguazuVisual, prepareIguazuReturn } from '../visuals/iguazu-landscape.mjs?v=400-review-r144-20260917';
const MANIFEST=Object.freeze({"schema":"asfalto-track/v1","id":"cataratas_iguazu","displayName":"Cataratas del Iguazú","format":"point_to_point","lengthM":10600,"defaultEnvironment":"clear","environment":{"profile":"./environment.json","defaultPreset":"clear","availablePresets":["clear","overcast","golden-hour","sunset","moonrise","night"]},"route":"./route.json","visual":["./scene.glb"],"collision":["./collision.glb"],"integrity":{"route":{"bytes":2305517,"sha256":"D205F9437E8B9FDE8081331DADA5AA670FE4DCFD3EE8D421B15226298706F426"},"visual":{"./scene.glb":{"bytes":29694896,"sha256":"CACFE094089980BBBF7AD99252F5031738D4FE09F1018326419B15A8E69A96D9"}},"collision":{"./collision.glb":{"bytes":2048124,"sha256":"5D5A6D08F1DB85A4EA19658326443EA9A0D5E69C95D369965F4FBDC72D1787B6"}}}});
const LOCKS=Object.freeze({"manifest":{"bytes":757,"sha256":"1AD2CA83D5E0510001933DED4623254D9917B78BADADFAFD7116B8B03B7ACCBF"},"route":{"bytes":2305517,"sha256":"D205F9437E8B9FDE8081331DADA5AA670FE4DCFD3EE8D421B15226298706F426"},"visual":{"./scene.glb":{"bytes":29694896,"sha256":"CACFE094089980BBBF7AD99252F5031738D4FE09F1018326419B15A8E69A96D9"}},"collision":{"./collision.glb":{"bytes":2048124,"sha256":"5D5A6D08F1DB85A4EA19658326443EA9A0D5E69C95D369965F4FBDC72D1787B6"}}});
const PROFILE=Object.freeze({id:'cataratas_iguazu',name:'Cataratas del Iguazú',description:'Recorrido selvático ficticio inspirado en Iguazú, con cataratas, basaltos y laterita.',biome:'subtropical_forest',environment:'iguazu',palette:{rock:'#393c35',dust:'#a3472c',asphalt:'#363b39',vegetation:'#40592f'},shoulder:1.2,barrier:3.4,recommendedFarPlaneM:18000,surface:{road:'humid_asphalt',shoulder:'stabilized_laterite',barrier:'galvanized_guardrail'}});
export function createIguazuAdapter(dependencies){
  const deps={...dependencies};
  if(!deps.prepareClosedRoute)deps.prepareClosedRoute=(source,options)=>{
    const closed=createClosedRoute(source,{...options,marginM:1800});
    return {...closed,createRoots:materials=>closed.createRoots(globalThis.__chevyV6Three||globalThis.THREE,materials)};
  };
  return createGlbPointToPointAdapter(deps,{
    manifest:MANIFEST,locks:LOCKS,profile:PROFILE,
    requiredVisualNodes:['ROAD_00','WATERFALL_00'],requiredCollisionNodes:['COLLISION_IGUAZU_SURFACES'],
    visualFilter:name=>!name.startsWith('COLLISION_'),collisionFilter:name=>name==='COLLISION_IGUAZU_SURFACES',
    prepareVisual:prepareIguazuVisual,prepareReturnVisual:prepareIguazuReturn,
    materialRoles:{asphalt:['MAT_asphalt','MAT_road_white','MAT_road_ochre'],shoulder:['MAT_laterite'],terrain:['MAT_forest_floor','MAT_basalt','MAT_earthen_bank_PBR'],water:['MAT_river_FLOW'],snow:[]},
    updateStreaming(_root,context){const distanceM=Number(context?.distanceM);if(!Number.isFinite(distanceM)||distanceM<0)throw new TypeError('distanceM must be finite and nonnegative');return{distanceM,mode:'instanced_distance_culling',groups:0};},
    applyEnvironment(root,id){root.userData.asfaltoEnvironment=id;return{id};}
  });
}
