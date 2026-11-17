import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {THREE as T} from './cinematic-three.mjs';
import {decodeGlbDocument,parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {attachGaribaldiBordes,garibaldiBordesAsset as asset} from '../src/tracks/visuals/garibaldi-bordes.mjs?v=f7a0695305fe5df8';
import {loadRegionalBlenderArt} from '../src/tracks/visuals/regional-blender-art.mjs';

async function decode(bytes,label){
  const document=await decodeGlbDocument(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  return globalThis.AsfaltoV5GlbCore.completeGlbToObject(T,bytes,label,{
    decodedDocument:document,parseGlb:parseGlbContainer,makeAttribute:makeGlbAttribute,textureFromInfo:()=>null,
  });
}

test('Garibaldi validates a boundary payload before changing the scene',async t=>{
  const payload=await fs.readFile(new URL('../'+asset.path,import.meta.url));
  const root=new T.Group(),native=new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial());
  native.name='ROAD_SHOULDERS';root.add(native);
  const originalChildren=[...root.children],originalGeometry=native.geometry,originalMaterial=native.material;
  const corrupted=new Uint8Array(payload);corrupted[Math.floor(corrupted.length/2)]^=1;
  t.mock.method(console,'warn',()=>{});
  assert.equal(await loadRegionalBlenderArt({root,releaseRoot:'https://test.invalid/',asset,label:'Garibaldi bordes'}, {
    fetchBytes:async()=>corrupted,loadGlb:()=>assert.fail('Corrupted bytes must not decode'),
    attach:()=>assert.fail('Corrupted bytes must not attach'),dispose:()=>assert.fail('No art was created'),
  }),null);
  assert.deepEqual(root.children,originalChildren);
  assert.equal(native.geometry,originalGeometry);assert.equal(native.material,originalMaterial);

  const badArt=await decode(gunzipSync(payload),'Garibaldi invalid role');
  const owner=badArt.getObjectByName('TERRAIN_GARIBALDI_BORDE_00');
  owner.userData.asfaltoGaribaldiBoundaryRole='visual';
  assert.throws(()=>attachGaribaldiBordes(root,badArt),/inesperada/);
  assert.deepEqual(root.children,originalChildren);
  assert.equal(root.userData.asfaltoGaribaldiBordes,undefined);

  const art=await decode(gunzipSync(payload),'Garibaldi valid boundaries');
  const texture=new T.Texture(),normal=new T.Texture();
  native.material.map=texture;native.material.normalMap=normal;native.material.normalScale.set(.35,.35);
  const result=attachGaribaldiBordes(root,art);
  assert.equal(result.triangles,asset.triangles);assert.equal(result.primitives,asset.primitives);
  assert.equal(art.parent,root);assert.equal(native.geometry,originalGeometry);
  art.traverse(mesh=>{
    if(!mesh.isMesh)return;
    assert.equal(mesh.userData.collision,true);
    assert.equal(mesh.material.map,texture);assert.equal(mesh.material.normalMap,normal);
    assert.deepEqual(mesh.material.normalScale.toArray(),[.35,.35]);
  });
});
