import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {THREE as T} from './cinematic-three.mjs';
import {decodeGlbDocument,parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {aconcaguaArtAsset,attachAconcaguaArt} from '../src/tracks/visuals/aconcagua-art.mjs?v=06f5ae0d35c4689b';
import {addHorconesDEM,decodeHorconesDEM} from '../src/tracks/visuals/horcones-dem.mjs?v=6e9457e12e10ffb1';

const game = new URL('../',import.meta.url);
const horcones = new URL('tracks/aconcagua-horcones/',game);
const buffer = bytes => bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

test('Horcones art mounts only after validating all seven visual-only Blender meshes',async()=>{
  const payload=await readFile(new URL(aconcaguaArtAsset.path,game));
  assert.equal(payload.length,aconcaguaArtAsset.bytes);
  assert.equal(createHash('sha256').update(payload).digest('hex'),aconcaguaArtAsset.sha256);
  const glb=gunzipSync(payload);
  const decodedDocument=await decodeGlbDocument(buffer(glb));
  const normal=new T.Texture();
  const art=await globalThis.AsfaltoV5GlbCore.completeGlbToObject(T,glb,'Horcones',{
    decodedDocument,parseGlb:parseGlbContainer,makeAttribute:makeGlbAttribute,textureFromInfo:()=>normal,
  });
  const root=new T.Group(),first=art.children[0],name=first.name;
  first.name='unexpected';
  assert.throws(()=>attachAconcaguaArt(root,art),/Horcones/);
  assert.equal(root.children.length,0);
  first.name=name;
  const stats=attachAconcaguaArt(root,art);
  assert.equal(stats.triangles,aconcaguaArtAsset.triangles);
  assert.equal(stats.primitives,7);
  assert.equal(root.children[0],art);
  art.traverse(node=>{
    if(!node.isMesh)return;
    assert.equal(node.userData.collision,false);
    assert.equal(node.material.normalMap,normal);
    assert.equal(node.geometry.attributes.tangent.count,node.geometry.attributes.position.count);
  });
});

test('the unchanged measured summit stays within the road-facing view and camera reach',async()=>{
  const [demBytes,metadata,routeBytes]=await Promise.all([
    readFile(new URL('distant-aconcagua-dem.glb',horcones)),
    readFile(new URL('distant-aconcagua-dem.provenance.json',horcones),'utf8'),
    readFile(new URL('route.json',horcones),'utf8'),
  ]);
  const route=createRouteQuery(JSON.parse(routeBytes));
  const dem=decodeHorconesDEM(T,buffer(demBytes));
  const {placement}=JSON.parse(metadata);
  const matrix=new T.Matrix4().fromArray(placement.matrixColumnMajor);
  const scales=new T.Vector3().setFromMatrixScale(matrix);
  assert.ok(Math.abs(scales.x-scales.y)<1e-8&&Math.abs(scales.x-scales.z)<1e-8);
  const p=dem.attributes.position,peak=new T.Vector3(0,-Infinity,0);
  for(let i=0;i<p.count;i++)if(p.getY(i)>peak.y)peak.fromBufferAttribute(p,i);
  peak.applyMatrix4(matrix);
  for(const s of [20,7980,13440,20880,20960]){
    const {position,frame:{tangent}}=route.sample(s);
    const direction=peak.clone().sub(new T.Vector3(...position));
    assert.ok(direction.length()<32000,'summit clips at '+s);
    const bearing=Math.atan2(tangent[0]*direction.z-tangent[2]*direction.x,
      tangent[0]*direction.x+tangent[2]*direction.z)*180/Math.PI;
    assert.ok(Math.abs(bearing)<30,'summit leaves the forward view at '+s);
  }
});

test('the arid DEM foothills remain darker and warmer than its high faces',async()=>{
  const [bytes,metadata]=await Promise.all([
    readFile(new URL('distant-aconcagua-dem.glb',horcones)),
    readFile(new URL('distant-aconcagua-dem.provenance.json',horcones),'utf8'),
  ]);
  const geometry=decodeHorconesDEM(T,buffer(bytes));
  const root=new T.Group();
  addHorconesDEM(T,root,{geometry,provenance:JSON.parse(metadata)});
  const height=geometry.attributes.position,colors=root.children[0].geometry.attributes.color;
  const groups={low:{count:0,light:0,warmth:0},high:{count:0,light:0,warmth:0}};
  for(let i=0;i<height.count;i++){
    const y=height.getY(i);
    const group=y<1800?groups.low:y>3300?groups.high:null;
    if(!group)continue;
    group.count++;
    group.light+=(colors.getX(i)+colors.getY(i)+colors.getZ(i))/3;
    group.warmth+=colors.getX(i)-colors.getZ(i);
  }
  assert.ok(groups.low.count>2000&&groups.high.count>15);
  assert.ok(groups.high.light/groups.high.count>groups.low.light/groups.low.count*1.35);
  assert.ok(groups.low.warmth/groups.low.count>groups.high.warmth/groups.high.count*1.3);
});
