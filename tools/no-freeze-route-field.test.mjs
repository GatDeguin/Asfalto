import test from 'node:test';import assert from 'node:assert/strict';
import {routeSpatialField} from '../src/tracks/visuals/closure-terrain.mjs?v=91d5bd33810dccbf';
test('road distance index agrees with exhaustive segment projection including negative cells and endpoints',()=>{
 const samples=Array.from({length:600},(_,i)=>({position:[Math.sin(i*.13)*900+i*.2,Math.cos(i*.02)*35,i*4-1200],sM:i*10,widthM:8+i%3}));
 const field=routeSpatialField(samples);let seed=32;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/2**32;
 for(let j=0;j<250;j++){const x=random()*3000-1500,z=random()*4200-2100,r=50+random()*1800;let best=null,d2=r*r;
  for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],vx=b.position[0]-a.position[0],vz=b.position[2]-a.position[2],u=Math.max(0,Math.min(1,((x-a.position[0])*vx+(z-a.position[2])*vz)/(vx*vx+vz*vz||1))),d=(x-a.position[0]-vx*u)**2+(z-a.position[2]-vz*u)**2;if(d<d2){d2=d;best={distance:Math.sqrt(d),height:a.position[1]+(b.position[1]-a.position[1])*u};}}
  const got=field(x,z,r);assert.equal(!!got,!!best);if(best){assert(Math.abs(got.distance-best.distance)<1e-8);assert(Math.abs(got.height-best.height)<1e-7);}
 }
});
