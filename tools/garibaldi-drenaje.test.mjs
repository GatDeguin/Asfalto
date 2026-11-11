import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {THREE as T} from './cinematic-three.mjs';
import {readCircuitSource} from './fixtures/closed-circuit-source.mjs';
import {decodeGlbDocument,parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs?v=4e5a55f83b79f7c1';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {visualRoadField} from '../src/tracks/visuals/forest-terrain-detail.mjs?v=8e17cf50d6fbaefc';
import {terrainHeightSampler} from '../src/tracks/visuals/reference-landscape.mjs?v=ada39f9cec1a7220';
import {refineTerrainSurface} from '../src/tracks/visuals/terrain-refinement.mjs?v=8ac034d3920ac072';
import {addRegionalLandscapeDetails} from '../src/tracks/visuals/regional-landscape-details.mjs?v=ebfeb17aac19884b';
import {attachGaribaldiLadera,garibaldiLaderaAsset as asset} from '../src/tracks/visuals/garibaldi-ladera.mjs?v=bb4060bab8241a9c';
import {loadRegionalBlenderArt} from '../src/tracks/visuals/regional-blender-art.mjs?v=942ba726ff042432';

const id='paso_garibaldi';
const url=file=>new URL('../'+file,import.meta.url);
async function decode(bytes,label) {
  const document=await decodeGlbDocument(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  return globalThis.AsfaltoV5GlbCore.completeGlbToObject(T,bytes,label,{
    decodedDocument:document,parseGlb:parseGlbContainer,makeAttribute:makeGlbAttribute,textureFromInfo:()=>null,
  });
}

test('the measured Garibaldi hillside keeps terrain contact without reflective water strips',async t=>{
  const route=readCircuitSource(id),query=createRouteQuery(route);
  const [original,art]=await Promise.all([
    fs.readFile(url('tracks/paso-garibaldi/scene.glb')).then(bytes=>decode(bytes,id)),
    fs.readFile(url(asset.path)).then(bytes=>decode(gunzipSync(bytes),'Garibaldi Blender')),
  ]);
  const roadField=visualRoadField(query,route.lengthM);
  const sheets=[];
  let lake,culverts,markings;
  original.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(/^TERRAIN_(HERO|TRANSITION|VISTA)/.test(mesh.name))sheets.push(mesh);
    if(mesh.name.startsWith('LAGO_ESCONDIDO'))lake=mesh;
    if(mesh.name.startsWith('ROAD_CULVERTS'))culverts=mesh;
    if(mesh.name.startsWith('ROAD_MARKINGS'))markings=mesh;
  });
  const waterLevel=new T.Box3().setFromObject(lake).max.y;
  for(const mesh of sheets){
    const vista=mesh.name.includes('VISTA'),transition=mesh.name.includes('TRANSITION');
    refineTerrainSurface(T,mesh,{region:id,roadField,waterLevel,roadMarginM:8,
      maxTriangles:vista?65000:transition?125000:180000,targetEdgeM:vista?130:transition?70:48,nearEdgeM:vista?90:transition?35:14});
  }
  const heightAt=terrainHeightSampler(T,original);
  // Only the approach sign texture needs a DOM in the procedural generator.
  const canvas={getContext:()=>new Proxy({},{get:()=>()=>{}})};
  const priorDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{value:{createElement:()=>canvas},configurable:true});
  try {
    const textures={aerial_rocks_04:{diff:null,normal:null,rough:null},aerial_grass_rock:{diff:null}};
    addRegionalLandscapeDetails(T,original,{id,query,lengthM:route.lengthM,heightAt,textures,scenery:false});
  } finally {
    if(priorDocument)Object.defineProperty(globalThis,'document',priorDocument);
    else delete globalThis.document;
  }
  original.updateMatrixWorld(true);
  const strips=original.getObjectByName('ASFALTO_TOPOGRAPHIC_DRAINS');
  const originalIndex=strips.geometry.index;
  const channels=original.userData.asfaltoDrainageChannels;
  const wetSoil=original.getObjectByName('ASFALTO_DRAINAGE_WET_SOIL');
  const roadGeometry=markings.geometry,culvertGeometry=culverts.geometry,lakeGeometry=lake.geometry;
  const culprit=channels.find(({sM,position})=>sM===14014&&position[1]>80);
  assert.ok(culprit,'The procedural scene reproduces the steep drain at km 14.014');
  if(process.env.GARIBALDI_DRAINAGE_SURVEY)console.table(channels.filter(channel=>channel.sM>=13760&&channel.sM<=15240).map(({sM,position,end})=>{
    const roadY=query.sample(sM).position[1];
    return {sM,startY:position[1],endY:end[1],roadY,grade:(position[1]-end[1])/Math.hypot(position[0]-end[0],position[2]-end[2])};
  }));
  const valleyDrain=channels.find(({sM,position})=>sM===14014&&position[1]<query.sample(sM).position[1]);
  assert.ok(valleyDrain,'The same cut has a drain below the road grade');
  const retained=[valleyDrain,...channels.filter(({sM})=>sM<asset.startM||sM>asset.endM)];
  assert.ok(wetSoil?.visible);

  const camera=new T.PerspectiveCamera(38.21677477956707,1.6,.02,32000);
  camera.position.set(-673.4565382374958,77.38718600916128,1731.6022509429192);
  camera.quaternion.set(-.01751549135519986,.8670102343330057,.029690935056671603,.4970964790660591);
  camera.updateMatrixWorld(true);
  const ray=new T.Raycaster();
  const hitAt=(x,y)=>{
    ray.setFromCamera(new T.Vector2(2*(x+.5)/1280-1,1-2*(y+.5)/800),camera);
    return ray.intersectObjects([strips,...sheets],false)[0];
  };
  const stripPixels=[[116,151],[222,229]];
  for(const pixel of stripPixels)assert.equal(hitAt(...pixel)?.object,strips,'The chase ray reproduces the strip in front of the hillside');

  t.mock.method(console,'warn',()=>{});
  assert.equal(await loadRegionalBlenderArt({root:original,releaseRoot:'https://test.invalid/',asset,label:'Garibaldi'}, {
    fetchBytes:async()=>new Uint8Array(1),loadGlb:()=>assert.fail('Invalid bytes were decoded'),
    attach:()=>assert.fail('Invalid art was attached'),dispose:()=>assert.fail('Invalid bytes created art'),
  }),null);
  assert.equal(strips.geometry.index,originalIndex);
  assert.equal(original.userData.asfaltoDrainageChannels,channels);

  attachGaribaldiLadera(original,art,query);
  original.updateMatrixWorld(true);
  for(const pixel of stripPixels)assert.match(hitAt(...pixel)?.object.name??'',/^TERRAIN_HERO/,
    'The km 14.00 chase ray must see the supported terrain through the removed strip');
  const remaining=original.userData.asfaltoDrainageChannels;
  assert.ok(!remaining.includes(culprit));
  for(const channel of retained)assert.ok(remaining.includes(channel));
  const valleyCenter=new T.Vector3().fromArray(valleyDrain.position).lerp(new T.Vector3().fromArray(valleyDrain.end),.5);
  ray.set(valleyCenter.add(new T.Vector3(0,2,0)),new T.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(strips,false).some(hit=>hit.distance<4),'The valley drain still has a rendered water surface');
  assert.equal(original.getObjectByName('ASFALTO_DRAINAGE_WET_SOIL'),wetSoil);
  assert.equal(culverts.geometry,culvertGeometry);
  assert.equal(lake.geometry,lakeGeometry);
  assert.equal(markings.geometry,roadGeometry);
  assert.equal(strips.userData.asfaltoWater.kind,'drain');
});
