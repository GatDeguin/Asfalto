import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {CIRCUIT_IDS,readCircuitSource} from './fixtures/closed-circuit-source.mjs';
import {createClosedRoute} from '../src/tracks/visuals/route-closure.mjs?v=f8d32d8a5f2f2357';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {addScenicSetpieces,hasScenicSetpieces,planScenicSetpieces} from '../src/tracks/visuals/scenic-setpieces.mjs?v=02639ca1402db565';
import {terrainHeightSampler} from '../src/tracks/visuals/reference-landscape.mjs?v=65ec87e78d128128';

const fixture=id=>{
  const source=readCircuitSource(id),closed=createClosedRoute(source,{id}),query=createRouteQuery(closed.route);
  return {id,query,chapters:closed.closure.chapters,lengthM:source.lengthM,
    heightAt:(x,z)=>query.project([x,0,z]).position[1]};
};

test('each circuit authors two distinctive landscape compositions in each leg',()=>{
  for(const id of CIRCUIT_IDS){
    const options=fixture(id);
    for(const leg of ['outbound','return']){
      const sites=planScenicSetpieces({...options,leg});
      assert.equal(sites.length,2,id+' '+leg);
      assert.equal(new Set(sites.map(s=>s.kind)).size,2);
      for(const site of sites){
        assert.equal(site.sM>options.lengthM,leg==='return');
        const road=options.query.project(site.center);
        assert.ok(road.distanceXZ>=road.widthM/2+5);
      }
    }
  }
});

test('scenic sites have one streamed owner and skip unavailable terrain',()=>{
  const options={...fixture('cuesta_lipan'),leg:'outbound'};
  const range={startM:4500,endM:7500};
  assert.equal(hasScenicSetpieces({...options,detailRange:range}),true);
  assert.equal(hasScenicSetpieces({...options,detailRange:{startM:0,endM:2400}}),false);
  const optionsWithRange={...options,detailRange:range};
  const first=planScenicSetpieces(optionsWithRange);
  assert.equal(first.length,1);
  assert.deepEqual(first,planScenicSetpieces(optionsWithRange));
  assert.equal(planScenicSetpieces({...options,heightAt:()=>NaN}).length,0);
});

test('scenery is batched by site and follows or yields to a carved return',()=>{
  const options={...fixture('dos_lagos'),leg:'outbound'},root=new T.Group();
  root.position.set(25,4,-50);
  const sites=addScenicSetpieces(T,root,options);
  assert.equal(sites.length,2);
  const group=root.getObjectByName('ASFALTO_SCENIC_SETPIECES_OUTBOUND');
  assert.equal(group.children.length,sites.length);
  root.updateMatrixWorld(true);
  for(const site of group.children)for(const mesh of site.children){
    const positions=mesh.geometry.attributes.position,point=new T.Vector3();
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      const road=options.query.project(point.toArray());
      assert.ok(road.distanceXZ>=road.widthM/2+5-1e-3);
    }
  }
  const composition=group.children[0],p=composition.children[0].geometry.attributes.position;
  const y=p.getY(0);
  const count=composition.children.reduce((total,mesh)=>total+mesh.geometry.attributes.position.count,0);
  assert.ok(composition.children.length<=2);
  assert.equal(composition.userData.asfaltoReprojectInstances((x,z,old)=>old-1),count);
  assert.ok(Math.abs(p.getY(0)-y+1)<.001);
  assert.equal(composition.userData.asfaltoReprojectInstances(()=>null),0);
  assert.equal(composition.visible,false);
  assert.equal(sites[0].excluded,true);
  const resources=new Set();
  group.traverse(mesh=>{if(mesh.isMesh){resources.add(mesh.geometry);resources.add(mesh.material);if(mesh.material.map)resources.add(mesh.material.map);}});
  for(const resource of resources)resource.dispose();
});

test('a water-only sampler excludes dry banks inside the river bounding rectangle',()=>{
  const root=new T.Group(),material=new T.MeshBasicMaterial();
  const water=new T.BufferGeometry();
  water.setAttribute('position',new T.Float32BufferAttribute([0,2,0,0,2,10,10,2,0],3));
  const river=new T.Mesh(water,material);root.add(river);
  const land=new T.Mesh(new T.PlaneGeometry(30,30).rotateX(-Math.PI/2),material);
  land.name='TERRAIN_DRY_BANK';land.position.y=1;root.add(land);
  const waterAt=terrainHeightSampler(T,root,mesh=>mesh===river,{includeDefaultTerrain:false}).raw;
  assert.equal(waterAt(2,2),2);
  assert.equal(waterAt(8,8),-Infinity);
  assert.ok(Math.abs(terrainHeightSampler(T,root).raw(8,8)-1)<1e-6);
  land.geometry.dispose();water.dispose();material.dispose();
});
