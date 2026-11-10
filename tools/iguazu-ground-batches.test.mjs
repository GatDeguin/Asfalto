import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {batchIguazuGround} from '../src/tracks/visuals/iguazu-ground-batches.mjs?v=657ba3796dce7370';

function tile(root,material,name,x,y){
 const geometry=new T.PlaneGeometry(4,4).rotateX(-Math.PI/2).translate(x,y,0);
 geometry.setAttribute('color',new T.Uint8BufferAttribute(Array(16).fill(180),4,true));
 const mesh=new T.Mesh(geometry,material);
 mesh.name=name+'_Primitive_0';mesh.receiveShadow=true;
 const group=new T.Group();group.name=name;group.add(mesh);root.add(group);
 return mesh;
}

test('Iguazú packs compatible ground sectors while preserving triangle positions and attributes',()=>{
 const root=new T.Group(),material=new T.MeshStandardMaterial({name:'MAT_forest_floor'});
 root.position.set(50,3,-20);
 const first=tile(root,material,'TERRAIN_000',10,2),second=tile(root,material,'TERRAIN_001',15,1);
 const distant=tile(root,material,'TERRAIN_002',1600,4);
 const lifted=tile(root,material,'TERRAIN_003',22,1);lifted.position.y=1;
 const road=tile(root,material,'ROAD_00',13,5);
 let disposals=0;first.geometry.addEventListener('dispose',()=>disposals++);
 const ray=new T.Raycaster(new T.Vector3(65,10,-20),new T.Vector3(0,-1,0));
 root.updateMatrixWorld(true);const height=ray.intersectObject(second)[0].point.y;
 assert.deepEqual(batchIguazuGround(T,root),{sourceMeshes:2,batches:1});
 const packed=root.children.find(mesh=>mesh.isMesh);
 root.updateMatrixWorld(true);
 assert.equal(ray.intersectObject(packed)[0].point.y,height);
 assert.equal(packed.geometry.attributes.position.count,8);
 assert.equal(packed.geometry.index.count,12);
 for(const name of ['position','normal','uv','color']){
  const a=first.geometry.attributes[name],b=second.geometry.attributes[name];
  const joined=packed.geometry.attributes[name];
  assert.deepEqual([...joined.array],[...a.array,...b.array]);
  assert.equal(joined.normalized,a.normalized);
 }
 assert.equal(packed.material,material);
 assert.equal(packed.receiveShadow,true);
 assert.equal(disposals,1);
 for(const mesh of [distant,lifted,road])assert.equal(mesh.parent.parent,root);
});
