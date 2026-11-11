import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {THREE as T} from './cinematic-three.mjs';
import {decodeGlbDocument,parseGlbContainer} from '../src/runtime/glb-decode-worker.mjs?v=4e5a55f83b79f7c1';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {addIguazuNativeRoadSigns} from '../src/tracks/visuals/iguazu-signs.mjs?v=963ecc7c5f8c18fb';
import {terrainHeightSampler} from '../src/tracks/visuals/reference-landscape.mjs?v=30a528c61c10745d';

test('Iguazú replaces the original 14 sign pairs with grounded plates for real features', async () => {
  const track=new URL('../tracks/cataratas-iguazu/',import.meta.url);
  const [glb,route]=await Promise.all([
    fs.readFile(new URL('scene.glb',track)),fs.readFile(new URL('route.json',track),'utf8').then(JSON.parse),
  ]);
  const bytes=glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
  const root=await globalThis.AsfaltoV5GlbCore.completeGlbToObject(T,bytes,'Carteles Iguazú',{
    decodedDocument:await decodeGlbDocument(bytes),parseGlb:parseGlbContainer,makeAttribute:makeGlbAttribute,textureFromInfo:()=>null,
  });
  const query=createRouteQuery(route);
  const heightAt=terrainHeightSampler(T,root);
  const result=addIguazuNativeRoadSigns(T,root,{query,heightAt});
  assert.equal(result.cues.length,13);
  assert.deepEqual(result.retired,['PROP_sign_13']);
  const source=root.getObjectByName('ASFALTO_IGUAZU_SIGN_SOURCE_OWNER');
  assert.equal(source.children.length,28);
  assert.equal(source.visible,false);
  const group=root.getObjectByName('ASFALTO_IGUAZU_AUTHORED_SIGNS');
  assert.ok(group?.visible);
  root.updateMatrixWorld(true);
  const plates=group.getObjectByName(group.name+'_FACES');
  const posts=group.getObjectByName(group.name+'_SUPPORTS');
  assert.equal(posts.count,22);
  const transform=new T.Matrix4();
  for(let i=0;i<posts.count;i++){
    posts.getMatrixAt(i,transform);
    const e=transform.elements;
    const foot=e[13]-e[5]/2;
    assert.ok(Math.abs(foot-heightAt(e[12],e[14])+.12)<1e-4,'post foot reaches its own ground sample');
  }
  const placeNames=result.cues.filter(c=>c.kind==='place').map(c=>c.name);
  assert.equal(new Set(placeNames).size,9);
  assert.ok(placeNames.includes('Cataratas del Iguazú'));
  assert.ok(placeNames.includes('Balcón del Salto'));
  const warnings=result.cues.filter(c=>c.kind==='warning');
  assert.deepEqual(warnings.map(c=>c.turn),[-1,1,-1,-1]);
  const ray=new T.Raycaster();
  for(const c of group.userData.asfaltoRoadSigns){
    const [x,y,z]=c.position;
    assert.equal(y,heightAt(x,z));
    const q=query.project(c.position);
    assert.ok(q.lateralM>q.widthM*.5+2.2,'right of the travelled way');
    const from=query.sample(Math.max(0,c.sM-45));
    const driver=from.position.map((v,i)=>v+from.frame.left[i]*from.widthM*.25);
    const angle=new T.Vector3(Math.sin(c.yaw),0,Math.cos(c.yaw))
      .dot(new T.Vector3(driver[0]-x,0,driver[2]-z).normalize());
    assert.ok(angle>.89,'face points towards the approaching lane');
    const eye=new T.Vector3(...driver);eye.y+=1.22;
    const faceCenter=new T.Vector3(x,y+c.bottomM+c.heightM*.5,z);
    ray.set(eye,faceCenter.sub(eye).normalize());
    assert.equal(ray.intersectObjects([plates,posts])[0]?.object,plates,'the plate is in front of its post');
  }
  for(const c of warnings){
    assert.ok(c.hazardM-c.sM>=85);
    const a=query.sample(c.hazardM-28).frame.tangent,b=query.sample(c.hazardM+28).frame.tangent;
    assert.equal(Math.sign(a[0]*b[2]-a[2]*b[0]),c.turn);
  }
  assert.equal(addIguazuNativeRoadSigns(T,root,{query,heightAt}),result);
});

test('Iguazú preserves an original pair when there is no grounded location for its replacement', () => {
  const root=new T.Group();
  for(const name of ['PROP_sign_00','PROP_signpost_00']){
    const node=new T.Group();node.name=name;root.add(node);
  }
  const sample=()=>({position:[0,0,0],frame:{left:[-1,0,0],tangent:[0,0,1]},widthM:7.2});
  const result=addIguazuNativeRoadSigns(T,root,{query:{sample},heightAt:()=>NaN});
  assert.equal(result,null);
  assert.equal(root.getObjectByName('PROP_sign_00').parent,root);
  assert.equal(root.getObjectByName('ASFALTO_IGUAZU_SIGN_SOURCE_OWNER'),undefined);
});
