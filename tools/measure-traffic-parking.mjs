import {readFile,writeFile} from 'node:fs/promises';
import {THREE as T} from './cinematic-three.mjs';
import {CIRCUIT_IDS,readCircuitSource} from './fixtures/closed-circuit-source.mjs';
import {decodeGlbDocument,parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs?v=4e5a55f83b79f7c1';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {terrainHeightSampler} from '../src/tracks/visuals/reference-landscape.mjs?v=30a528c61c10745d';
import '../src/legacy/asfalto-v5-glb-runtime.js';

const out=process.argv[2];
if(!out)throw new Error('Indica la salida JSON de la medición para Blender.');
const supportName=/ROAD_SURFACE|ROAD_RENDER|ROAD_ASPHALT|ROADBED|^CHECK_(ROAD|SHOULDER)|ROAD_SHOULDER|SHOULDER_(LEFT|RIGHT)|ROAD_PULLOFFS/i;
const obstructionName=/GUARDRAIL|DELINEATOR|SNOW_POLE|ROAD_RETAINING|SIGNPOST|FURNITURE.*SIGNAGE/i;
const round=n=>Math.round(n*1000)/1000;
const output={};

async function readSurface(directory,file,origin) {
  const bytes=await readFile(new URL(file,directory));
  const decodedDocument=await decodeGlbDocument(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const scene=await globalThis.AsfaltoV5GlbCore.completeGlbToObject(T,bytes,file,{
    decodedDocument,parseGlb:parseGlbContainer,makeAttribute:makeGlbAttribute,textureFromInfo:()=>null,
  });
  if(origin)scene.position.set(origin[0],origin[2],-origin[1]);
  return scene;
}

function matched(node,pattern) {
  for(let object=node;object;object=object.parent)if(pattern.test(object.name))return true;
  return false;
}

for(const id of CIRCUIT_IDS) {
  const directory=new URL(`../tracks/${id.replaceAll('_','-')}/`,import.meta.url);
  const route=readCircuitSource(id),query=createRouteQuery(route);
  const root=new T.Group();
  if(id==='cuesta_lipan') {
    const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
    for(const sector of manifest.streaming.sectors)root.add(await readSurface(directory,sector.visual.lod0.url,sector.localOrigin));
  } else {
    root.add(await readSurface(directory,id==='cataratas_iguazu'?'collision.glb':'scene.glb'));
  }
  // The height sampler deliberately excludes collision geometry by name, so
  // rename the Iguazú proxy surfaces in this offline copy only.
  if(id==='cataratas_iguazu')root.traverse(node=>{if(/^COLLISION_(ROAD|SHOULDER)/.test(node.name))node.name=node.name.replace(/^COLLISION_/,'CHECK_');});
  const ground=terrainHeightSampler(T,root,node=>matched(node,supportName)||/^V2_(ASPHALT|SHOULDER)_PBR$/.test(node.material?.name||''),{includeDefaultTerrain:false});
  const obstacles=terrainHeightSampler(T,root,node=>matched(node,obstructionName),{includeDefaultTerrain:false});
  const pullOffs=terrainHeightSampler(T,root,node=>matched(node,/ROAD_PULLOFFS/i),{includeDefaultTerrain:false});
  const placements=[];
  const rejected={width:0,missingSupport:0,gradeDifference:0,uneven:0,blocked:0};
  const point=new T.Vector3(),tangent=new T.Vector3(),lateral=new T.Vector3(),normal=new T.Vector3();

  function measure(sample,edgeOffsetM) {
    const half=sample.widthM/2, offset=half+edgeOffsetM;
    // 2.14 m covers the fleet at body height. Leave at least 2.65 m from
    // the stopped body to the centre line of the two-way road.
    const freeLaneM=offset-1.07;
    if(freeLaneM<2.65){rejected.width++;return null;}
    const center=new T.Vector3(...sample.position).addScaledVector(lateral,offset);
    const at=(along,side)=>point.copy(center).addScaledVector(tangent,along).addScaledVector(lateral,side);
    const supports=[];
    // Envelope of all four tire patches, including the longitudinal shifts
    // between axle and art origin in the fleet.
    for(const forward of [-1.60,-1.40,1.19,1.48])for(const side of [-.85,-.66,.66,.85]){
      const p=at(forward,side);
      const y=ground(p.x,p.z),error=y-p.y;
      if(!Number.isFinite(y)){rejected.missingSupport++;return null;}
      if(Math.abs(error)>.24){rejected.gradeDifference++;return null;}
      supports.push({along:forward,side,y:round(y),error});
    }
    const lift=supports.reduce((sum,v)=>sum+v.error,0)/supports.length;
    const maxError=Math.max(...supports.map(p=>Math.abs(p.error-lift)));
    if(maxError>.092){rejected.uneven++;return null;}
    for(let along=-2.73;along<=2.74;along+=.3)for(let side=-1.09;side<=1.09;side+=.22){
      const p=at(along,side);
      if(obstacles.raw(p.x,p.z)>p.y+.10){rejected.blocked++;return null;}
    }
    return {atM:sample.sM,edgeOffsetM,liftM:round((lift+.012)/normal.y),widthM:round(sample.widthM),
      freeLaneM:round(freeLaneM),tireDeviationM:round(maxError),
      location:center.toArray().map(round),tangent:tangent.toArray(),lateral:lateral.toArray(),normal:normal.toArray(),
      supports:supports.map(({along,side,y})=>({along,side,y})),
      pullOff:Number.isFinite(pullOffs.raw(center.x,center.z))};
  }

  for(let s=540;s<route.lengthM-650;s+=14) {
    const sample=query.sample(s);
    tangent.fromArray(sample.frame.tangent);
    lateral.fromArray(sample.frame.left);
    normal.fromArray(sample.frame.normal);
    if(Math.abs(tangent.y)>.09||Math.abs(lateral.y)>.083||normal.y<.98)continue;
    // Check the change of heading over the approach and departure around the lay-by.
    if([s-55,s-15,s+15,s+55].some(at=>query.sample(at).frame.tangent.reduce((sum,c,i)=>sum+c*sample.frame.tangent[i],0)<.966))continue;
    for(const offset of [1.08,.94,.82,.70,.60,.50,.42,.34,.27,.21,.16]) {
      const placement=measure(sample,offset);
      if(placement){placements.push(placement);break;}
    }
  }
  // Review candidates spread along the route, giving existing pull-offs priority.
  const ranked=placements.sort((a,b)=>Number(b.pullOff)-Number(a.pullOff)||b.edgeOffsetM-a.edgeOffsetM||a.tireDeviationM-b.tireDeviationM);
  const selected=[];
  for(const row of ranked) {
    if(selected.every(other=>Math.abs(other.atM-row.atM)>390))selected.push(row);
    if(selected.length===6)break;
  }
  output[id]=selected.sort((a,b)=>a.atM-b.atM);
  console.log(`${id}: ${placements.length} emplazamientos medidos; ${selected.length} candidatos | ${selected.map(row=>row.atM).join(', ')}`);
  if(!selected.length)console.log(JSON.stringify(rejected));
}
await writeFile(out,JSON.stringify(output,null,2)+'\n');
