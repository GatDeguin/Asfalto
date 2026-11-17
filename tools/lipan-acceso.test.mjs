import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {THREE as T} from './cinematic-three.mjs';
import {decodeGlbDocument,parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {attachLipanAccess,lipanAccessAsset as asset} from '../src/tracks/visuals/lipan-acceso.mjs?v=cea16d7de19e35fe';
import {loadRegionalBlenderArt} from '../src/tracks/visuals/regional-blender-art.mjs';

async function decode(bytes,label){
  const document=await decodeGlbDocument(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  return globalThis.AsfaltoV5GlbCore.completeGlbToObject(T,bytes,label,{decodedDocument:document,
    parseGlb:parseGlbContainer,makeAttribute:makeGlbAttribute,textureFromInfo:()=>null});
}

test('Lipán refuses a corrupted support payload before touching its permanent scene',async t=>{
  const payload=await fs.readFile(new URL('../'+asset.path,import.meta.url)),root=new T.Group();
  const corrupted=new Uint8Array(payload);corrupted[200]^=1;
  t.mock.method(console,'warn',()=>{});
  const result=await loadRegionalBlenderArt({root,releaseRoot:'https://test.invalid/',asset,label:'Lipán acceso'}, {
    fetchBytes:async()=>corrupted,loadGlb:()=>assert.fail('Corrupted asset must not decode'),
    attach:()=>assert.fail('Corrupted asset must not attach'),dispose:()=>assert.fail('Nothing decoded'),
  });
  assert.equal(result,null);assert.equal(root.children.length,0);
});

test('Blender support stays outside asphalt and the existing turning clearing',async()=>{
  const payload=await fs.readFile(new URL('../'+asset.path,import.meta.url)),art=await decode(gunzipSync(payload),'Lipán support');
  const root=new T.Group(),keeper=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial());
  keeper.name='ASFALTO_VISUAL_RESOURCE_OWNER';
  const maps={diff:new T.Texture(),normal:new T.Texture(),rough:new T.Texture()};keeper.asfaltoSurfaceTextures={gravel_floor:maps};root.add(keeper);
  attachLipanAccess(root,art);art.updateMatrixWorld(true);
  const point=new T.Vector3();let vertices=0;
  art.traverse(mesh=>{
    if(!mesh.isMesh)return;
    assert.equal(mesh.userData.collision,true);assert.equal(mesh.material.transparent,false);
    assert.equal(mesh.material.map,maps.diff);assert.equal(mesh.material.normalMap,maps.normal);
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);vertices++;
      assert.ok(Math.abs(point.x)>=4.0999&&Math.abs(point.x)<=12.6001);
      assert.ok(point.z>=-.0001&&point.z<=160.0001);
      assert.ok(Math.hypot(point.x-22,point.z-100)>8,'Native clearing must remain untouched');
    }
  });
  assert.ok(vertices>10000);assert.deepEqual(root.children,[keeper,art]);
});

test('An invalid support role cannot partially attach a Lipán mesh',async()=>{
  const bytes=gunzipSync(await fs.readFile(new URL('../'+asset.path,import.meta.url)));
  const art=await decode(bytes,'Invalid Lipán'),root=new T.Group();
  art.getObjectByName('TERRAIN_LIPAN_ACCESO_DERECHA').userData.asfaltoLipanAccessRole='visual';
  assert.throws(()=>attachLipanAccess(root,art),/inesperada/);
  assert.equal(root.children.length,0);assert.equal(root.userData.asfaltoLipanAccess,undefined);
});
