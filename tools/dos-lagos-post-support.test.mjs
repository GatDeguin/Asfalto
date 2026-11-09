import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {terrainHeightSampler} from '../src/tracks/visuals/reference-landscape.mjs?v=1877fbe8d19b298a';
import {addDosLagosPostSupport} from '../src/tracks/visuals/dos-lagos-post-support.mjs?v=f855db52f6535e49';

test('Dos Lagos connects a detached post to the shoulder on both sides of a cut',()=>{
 const root=new T.Group(),material=new T.MeshStandardMaterial();
 const place=(name,geometry,x,y,z)=>{const m=new T.Mesh(geometry,material);m.name=name;m.position.set(x,y,z);root.add(m);return m;};
 place('TERRAIN_cut',new T.PlaneGeometry(60,30).rotateX(-Math.PI/2),20,0,0);
 const original=[];
 for(const side of [-1,1]){
  place('ROAD_Shoulder_'+side,new T.PlaneGeometry(50,1).rotateX(-Math.PI/2),20,10,side*4);
  for(const station of [20,24])original.push(place('PROP_Guardrail_Posts_Primitive_0',new T.BoxGeometry(.1,1,.15),station,10.5,side*5));
 }
 const query={project:([x,_y,z])=>({sM:x,lateralM:z}),sample:x=>{assert.ok(Number.isFinite(x));return {position:[x,10,0],widthM:7,frame:{left:[0,0,1]}};}};
 assert.ok(Math.abs(terrainHeightSampler(T,root).raw(20,5))<1e-9);
 assert.deepEqual(addDosLagosPostSupport(T,root,query,60),{feet:4,pads:4});
 const surface=terrainHeightSampler(T,root).raw;
 for(const post of original){assert.equal(post.position.y,10.5);assert.ok(surface(post.position.x,post.position.z)>10);assert.ok(surface(22,post.position.z)>10);}
 assert.ok(Math.abs(surface(20,0))<1e-9,'support does not extend into the driving lane');
});
