import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {CIRCUIT_IDS,readCircuitSource} from './fixtures/closed-circuit-source.mjs?v=dab87f84716fb019';
import {createClosedRoute} from '../src/tracks/visuals/route-closure.mjs?v=f87ef0744f99cd6c';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import {createGameplayBridge} from '../src/tracks/gameplay-bridge.mjs?v=c594401a38ba1b3f';
import {planReturnLandmarks} from '../src/tracks/visuals/return-landmarks.mjs?v=15148dabb6c8a02d';

for(const id of CIRCUIT_IDS)test(id+' keeps both joins and drives through five distinct return chapters',()=>{
  const source=readCircuitSource(id),loop=createClosedRoute(source,{id}),{closure,samples,route}=loop;
  const query=createRouteQuery(route),track=createGameplayBridge(query,route,{id});
  assert.equal(track.layoutRevision,'return-v2');
  assert.equal(track.closed,true);
  for(const [actual,expected] of [[samples[0],source.samples.at(-1)],[samples.at(-1),source.samples[0]]]){
    for(const field of ['position','tangent','left','normal','widthM'])assert.deepEqual(actual[field],expected[field],field);
  }
  assert.deepEqual(route.samples.slice(0,source.samples.length-1),source.samples.slice(0,-1));
  assert.equal(closure.originalCrossings,0);
  assert.ok(closure.shapeStrength>=.8);
  assert.ok(closure.maxGrade<=Math.max(.08,closure.inheritedEndpointGrade)+1e-6);
  assert.equal(closure.chapters.length,5);
  assert.ok(new Set(closure.chapters.map(c=>c.landscape)).size>=4);
  for(const chapter of closure.chapters){
    const active=samples.filter(s=>s.sM>=chapter.startM&&s.sM<chapter.endM);
    assert.ok(active.filter(s=>s.curvaturePerM>.0006).length>active.length*.10);
    assert.ok(active.filter(s=>s.curvaturePerM<-.0006).length>active.length*.10);
    assert.ok(Math.max(...active.map(s=>s.widthM))-Math.min(...active.map(s=>s.widthM))>.11);
    assert.ok(active.some(s=>Math.abs(s.bank)>.006));
    const middle=(chapter.startM+chapter.endM)/2,q=query.sample(middle),projection=query.project(q.position);
    assert.ok(Math.abs(projection.sM-middle)<.02&&projection.distanceXZ<.02);
  }
  const landmarks=planReturnLandmarks({id,chapters:closure.chapters,query,heightAt:(x,z)=>query.project([x,0,z]).position[1]});
  assert.ok(landmarks.length>=9);
  assert.ok(landmarks.every(site=>site.pieces.every(item=>query.project(item.position).distanceXZ>9)));
  assert.equal(route.checkpoints.at(-1).sM,route.lengthM);
  assert.ok(route.respawns.some(r=>r.sM>closure.startS));
});

test('return road vertices and their physical surface are the same and the signed road paint is lifted',()=>{
  const source=readCircuitSource('dos_lagos'),closed=createClosedRoute(source,{id:'dos_lagos'});
  const {visualRoot,collisionRoot}=closed.createRoots(T);
  const road=visualRoot.getObjectByName('RETURN_ROAD').geometry;
  const physical=collisionRoot.getObjectByName('COLLISION_RETURN_ROAD').geometry;
  assert.deepEqual(road.attributes.position.array,physical.attributes.position.array);
  assert.deepEqual(road.index.array,physical.index.array);
  assert.ok(visualRoot.userData.asfaltoReturnLandmarks.sites.length>=9);
  const paint=visualRoot.getObjectByName('RETURN_CENTRE_DASHES').geometry;
  const center=paint.attributes.asfaltoRoadCoordinates;
  const firstSegment=center.getX(2)-center.getX(0);
  assert.equal(firstSegment,3);
  const resources=new Set();
  for(const root of [visualRoot,collisionRoot])root.traverse(node=>{if(node.isMesh){resources.add(node.geometry);resources.add(node.material);}});
  for(const resource of resources)resource.dispose();
});

test('Iguazú return markings have a readable material without the source vertex colors',()=>{
  const source=readCircuitSource('cataratas_iguazu'),closed=createClosedRoute(source,{id:'cataratas_iguazu'});
  const authored=new T.MeshStandardMaterial({color:0x101010,vertexColors:true});
  const {visualRoot,collisionRoot}=closed.createRoots(T,{paint:authored});
  const paint=visualRoot.getObjectByName('RETURN_CENTRE_DASHES').material;
  assert.notEqual(paint,authored);
  assert.equal(paint.vertexColors,false);
  assert.ok(paint.color.r>.7&&paint.color.g>.65);
  const resources=new Set([authored]);
  for(const root of [visualRoot,collisionRoot])root.traverse(node=>{if(node.isMesh){resources.add(node.geometry);resources.add(node.material);}});
  for(const resource of resources)resource.dispose();
});
