import { createGlbPointToPointAdapter } from './glb-point-to-point.mjs?v=body-r2-20260916';

const SCENE_LOCK=Object.freeze({bytes:30462168,sha256:'BC1699C6F101E9BE4D5E7C1CC7F4435FD5B1C3C92BC7FE43F752FB06B27A5C92'});
const MANIFEST=Object.freeze({
  schema:'asfalto-track/v1',
  id:'aconcagua_horcones',
  displayName:'Aconcagua — Corredor de Horcones',
  format:'point_to_point',
  lengthM:21000,
  defaultEnvironment:'clear',
  environment:Object.freeze({
    profile:'./environment.json',
    defaultPreset:'golden-hour',
    availablePresets:Object.freeze(['clear','overcast','golden-hour','sunset','moonrise','night']),
  }),
  route:'./route.json',
  visual:Object.freeze(['./scene.glb']),
  collision:Object.freeze(['./scene.glb']),
  collisionMode:'embedded',
  collisionNodes:Object.freeze(['COLLISION_ROAD','COLLISION_TRACK_LIMITS']),
});
const LOCKS=Object.freeze({
  manifest:Object.freeze({bytes:4746,sha256:'5AC561C6AB79665727734BCFECDF605414719139C74673FF8ADEDD241704A2EF'}),
  route:Object.freeze({bytes:778488,sha256:'82830CCF1FD9687B0D1F0577D51ED6DB2E9819E7041FF20BC623FF680A71AE34'}),
  visual:Object.freeze({'./scene.glb':SCENE_LOCK}),
  collision:Object.freeze({'./scene.glb':SCENE_LOCK}),
});
const REQUIRED_VISUAL=Object.freeze(['FINISH_GATE','GUARDRAILS_RENDER','RAILWAY_RAIL_LEFT','RAILWAY_RAIL_RIGHT','RIVER_DESIGN_PROXY','ROAD_RENDER','SHOULDER_LEFT_RENDER','SHOULDER_RIGHT_RENDER','SPAWN_FINISH','SPAWN_START','START_GATE','TERRAIN_RENDER',...Array.from({length:12},(_,index)=>{const sector='S'+String(index).padStart(2,'0');return ['RAILWAY_SLEEPERS_'+sector+'_LOD0','RAILWAY_SLEEPERS_'+sector+'_LOD1'];}).flat()]);
const REQUIRED_COLLISION=Object.freeze(['COLLISION_ROAD','COLLISION_TRACK_LIMITS']);
const PROFILE=Object.freeze({
  id:'aconcagua_horcones',
  name:'Aconcagua — Corredor de Horcones',
  description:'Corredor andino de alta montaña, asfalto frío y seco.',
  biome:'andes_mountain',
  environment:'clear',
  palette:Object.freeze({rock:'#756957',dust:'#9A8061',asphalt:'#34383A',snow:'#D9E1E3'}),
  shoulder:1.8,
  barrier:3.2,
  recommendedFarPlaneM:30000,
  surface:Object.freeze({road:'dry_cold_asphalt',shoulder:'mineral_gravel',barrier:'galvanized_guardrail'}),
});
const LOD_GROUPS=Object.freeze(Array.from({length:12},(_,index)=>{
  const sector='S'+String(index).padStart(2,'0');
  return Object.freeze({lod0:'RAILWAY_SLEEPERS_'+sector+'_LOD0',lod1:'RAILWAY_SLEEPERS_'+sector+'_LOD1'});
}));
function named(root,name){let hit=null;root?.traverse?.(node=>{if(!hit&&node?.name===name)hit=node;});return hit;}
function createPolicy(){
  const modes=new WeakMap();
  return Object.freeze({
    manifest:MANIFEST,
    locks:LOCKS,
    profile:PROFILE,
    requiredVisualNodes:REQUIRED_VISUAL,
    materialRoles:Object.freeze({asphalt:Object.freeze(['MAT_P1_ROAD','MAT_ROAD_JOINT_DARK','MAT_P1_WEAR']),shoulder:Object.freeze(['MAT_P1_GRAVEL','MAT_P1_BALLAST']),terrain:Object.freeze(['MAT_P1_TERRAIN_ROCK','MAT_P1_TERRAIN_ARID','MAT_P1_DUST','MAT_P1_SCRUB']),water:Object.freeze(['MAT_P1_RIVER']),snow:Object.freeze([])}),
    requiredCollisionNodes:REQUIRED_COLLISION,
    visualFilter(name){return !name.startsWith('COLLISION_');},
    collisionFilter(name){return name==='COLLISION_ROAD'||name==='COLLISION_TRACK_LIMITS';},
    updateStreaming(_root,context,roots){
      const distanceM=Number(context?.distanceM);
      if(!Number.isFinite(distanceM)||distanceM<0)throw new TypeError('distanceM must be finite and nonnegative');
      let changed=0;
      for(const root of roots){
        let mode=modes.get(root)||'lod0';
        if(distanceM<=220)mode='lod0';
        else if(distanceM>=260)mode='lod1';
        modes.set(root,mode);
        for(const group of LOD_GROUPS){
          const lod0=named(root,group.lod0),lod1=named(root,group.lod1);
          if(!lod0||!lod1)throw new TypeError('railway LOD group is incomplete: '+group.lod0);
          const next0=mode==='lod0',next1=mode==='lod1';
          if(lod0.visible!==next0){lod0.visible=next0;changed++;}
          if(lod1.visible!==next1){lod1.visible=next1;changed++;}
        }
      }
      return {distanceM,mode:distanceM<=220?'lod0':distanceM>=260?'lod1':'hysteresis',groups:LOD_GROUPS.length,changed};
    },
    applyEnvironment(root,id){
      root.userData=root.userData||{};
      root.userData.asfaltoEnvironment=id;
      root.traverse?.(node=>{
        node.userData=node.userData||{};
        node.userData.asfaltoEnvironment=id;
      });
      return {id};
    },
  });
}

function authoredStart(base){
  let node=null;
  base.visualRoot?.traverse?.(entry=>{if(!node&&entry?.name==='SPAWN_START')node=entry;});
  if(!node)throw new TypeError('SPAWN_START is missing');
  const authoredStation=node.userData?.station_m;
  const station=authoredStation==null?70:Number(authoredStation);
  if(station!==70)throw new TypeError('SPAWN_START station_m must equal 70');
  let position=null;
  if(Array.isArray(node.position)&&node.position.length===3)position=node.position;
  else if(node.position&&[node.position.x,node.position.y,node.position.z].every(Number.isFinite))position=[node.position.x,node.position.y,node.position.z];
  else if(Array.isArray(node.translation)&&node.translation.length===3)position=node.translation;
  else if(node.matrixWorld?.elements?.length===16)position=[node.matrixWorld.elements[12],node.matrixWorld.elements[13],node.matrixWorld.elements[14]];
  if(!position||!position.every(Number.isFinite))throw new TypeError('SPAWN_START world position is invalid');
  const route=base.sampleRoute(station);
  if(Math.hypot(position[0]-route.position[0],position[2]-route.position[2])>0.35)throw new TypeError('SPAWN_START does not match route station 70');
  return station;
}
function spawnRecord(base,sample,position,grid){
  return Object.freeze({
    position:Object.freeze([...position]),
    frame:Object.freeze({tangent:Object.freeze([...sample.frame.tangent]),left:Object.freeze([...sample.frame.left]),normal:Object.freeze([...sample.frame.normal])}),
    progress:Object.freeze({sM:sample.sM,u:sample.sM/base.gameplay.length,sectorId:sample.sectorId}),
    grid:Object.freeze({...grid}),
  });
}
function wrapSpawnPolicy(base){
  const wrapper={};
  for(const key of Reflect.ownKeys(base)){if(key==='getSpawn')continue;Object.defineProperty(wrapper,key,Object.getOwnPropertyDescriptor(base,key));}
  Object.defineProperty(wrapper,'getSpawn',{enumerable:true,value(kind,index=0){
    if(kind!=='chevy'&&kind!=='falcon')return base.getSpawn(kind,index);
    const start=authoredStart(base);
    if(kind==='chevy'){const sample=base.sampleRoute(start);return spawnRecord(base,sample,sample.position,{rearwardM:0,lateralM:0});}
    const rearwardM=8.0,sample=base.sampleRoute(start-rearwardM),lateralM=Math.min(1.25,sample.widthM*0.25);
    const position=sample.position.map((value,axis)=>value+sample.frame.left[axis]*lateralM);
    return spawnRecord(base,sample,position,{rearwardM,lateralM});
  }});
  return Object.freeze(wrapper);
}
export function createAconcaguaHorconesAdapter(dependencies){
  const base=createGlbPointToPointAdapter(dependencies,createPolicy());
  return wrapSpawnPolicy(base);
}
