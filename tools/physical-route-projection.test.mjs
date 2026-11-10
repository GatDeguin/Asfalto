import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/legacy/asfalto-v6-physics-runtime.js?v=c5fde6a88e095b7b';

const {createRouteSpatialIndex,projectToRoute,createProjectionTeleportToken}=globalThis.AsfaltoV6Physics;

test('Dos Lagos projects a continuous crossing just south of the 150 m grid corner',()=>{
 const route=JSON.parse(readFileSync(new URL('../assets/extracted/asfalto-v5-dos-lagos-route/dos_lagos_route.json',import.meta.url),'utf8'));
 const index=createRouteSpatialIndex({
  samples:route.samples.map(({s,position:[x,y,z]})=>({s,x,y,z}))
 });
 const position=x=>[x,34+.008*x+.52,-.001];
 const prior=projectToRoute(index,position(149.8),149.6);
 const next=projectToRoute(index,position(150),prior.raceProgress);
 assert.equal(next.jumpRejected,false);
 assert.ok(Math.abs(next.raceProgress-prior.raceProgress-.2)<.001,`Physical step 0.2 m projected to ${next.raceProgress-prior.raceProgress} m`);
 assert.ok(next.distanceM<.53);
});

test('projection still rejects a large relocation unless it consumes an explicit token',()=>{
 const index=createRouteSpatialIndex({samples:[{x:0,y:0,z:0,s:0},{x:500,y:0,z:0,s:500}]});
 assert.equal(projectToRoute(index,[300,1,0],5).jumpRejected,true);
 const token=createProjectionTeleportToken();
 const relocated=projectToRoute(index,[300,1,0],5,token);
 assert.equal(relocated.jumpRejected,false);
 assert.equal(relocated.raceProgress,300);
 assert.equal(projectToRoute(index,[300,1,0],5,token).jumpRejected,true);
});
