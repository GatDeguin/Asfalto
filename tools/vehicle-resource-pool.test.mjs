import test from 'node:test';import assert from 'node:assert/strict';import {getVehicleResourcePool,releaseVehicleModel,retainVehicleResources} from '../src/render/vehicle-resource-pool.mjs?v=b2b341c34f9c8779';
function fixture(){const g={attributes:{},count:0,dispose(){this.count++;}},t={isTexture:true,count:0,dispose(){this.count++;}},m={map:t,userData:{deep:{value:1}},count:0,clone(){return {...this,userData:structuredClone(this.userData)};},dispose(){this.count++;}};class Node{constructor(){this.userData={nested:{value:1}};this.geometry=g;this.material=m;}traverse(fn){fn(this);}clone(){const n=new Node();n.userData=structuredClone(this.userData);return n;}}return {root:new Node(),g,t,m,pool:getVehicleResourcePool({})};}
test('dedup exact GPU identity while all nodes/materials/userData remain private; last release once',async()=>{const f=fixture();let loads=0;const options={load:async()=>{loads++;return f.root;}};const [a,b]=await Promise.all([f.pool.acquire('asset?v=1',options),f.pool.acquire('asset?v=1',options)]);assert.equal(loads,1);assert.notEqual(a,b);assert.equal(a.geometry,b.geometry);assert.equal(a.material.map,b.material.map);assert.notEqual(a.material,b.material);a.userData.nested.value=4;a.material.userData.deep.value=7;assert.equal(b.userData.nested.value,1);assert.equal(b.material.userData.deep.value,1);releaseVehicleModel(a);assert.equal(f.g.count,0);releaseVehicleModel(b);releaseVehicleModel(b);assert.equal(f.g.count,1);assert.equal(f.t.count,1);});
test('cancelled consumer cannot cancel shared decode; native pin retains last resources',async()=>{const f=fixture(),controller=new AbortController();let settle;const load=()=>new Promise(r=>settle=r);const a=f.pool.acquire('a',{load,signal:controller.signal}),b=f.pool.acquire('a',{load});await Promise.resolve();controller.abort();await assert.rejects(a,{name:'AbortError'});settle(f.root);const root=await b,release=retainVehicleResources(root);releaseVehicleModel(root);assert.equal(f.g.count,0);release();assert.equal(f.g.count,1);});
test('late decode after all abort is disposed, never published or kept idle',async()=>{const f=fixture(),controller=new AbortController();let settle;const p=f.pool.acquire('a',{load:()=>new Promise(r=>settle=r),signal:controller.signal});await Promise.resolve();controller.abort();await assert.rejects(p,{name:'AbortError'});settle(f.root);await new Promise(r=>setImmediate(r));assert.equal(f.g.count,1);assert.equal(f.pool.diagnostics().entries.length,0);});
test('phone transition pin preserves identity across release and reacquire',async()=>{const f=fixture(),options={load:async()=>f.root};const a=await f.pool.acquire('a',options),unpin=f.pool.pinAll();releaseVehicleModel(a);assert.equal(f.g.count,0);const b=await f.pool.acquire('a',options);unpin();assert.equal(f.g.count,0);assert.equal(a.geometry,b.geometry);releaseVehicleModel(b);assert.equal(f.g.count,1);});

test('native preparation reads each shared material once and pins every distinct resource entry',async()=>{
 const fixtures=[fixture(),fixture(),fixture()];
 const roots=await Promise.all(fixtures.map((f,i)=>f.pool.acquire(`asset-${i}`,{load:async()=>f.root})));
 let firstReads=0,secondReads=0;
 const first={get map(){firstReads++;return fixtures[0].t;}};
 const second={get map(){secondReads++;return fixtures[1].t;}};
 const nodes=[
  {geometry:fixtures[0].g,material:[first,second,first]},
  {geometry:fixtures[2].g,material:first},
  {material:[null,second]},
 ];
 const unpin=retainVehicleResources({traverse(visit){nodes.forEach(visit);}});
 assert.equal(firstReads,1,'shared material properties are read only once per preparation');
 assert.equal(secondReads,1,'a different shared material is inspected independently');
 for(const f of fixtures)assert.equal(f.pool.diagnostics().entries[0].pins,1);
 roots.forEach(releaseVehicleModel);
 for(const f of fixtures){assert.equal(f.g.count,0);assert.equal(f.t.count,0);}
 unpin();
 for(const f of fixtures){assert.equal(f.g.count,1);assert.equal(f.t.count,1);assert.equal(f.m.count,1);assert.equal(f.pool.diagnostics().entries.length,0);}
});

test('material retention observes texture changes between overlapping preparations',async()=>{
 const a=fixture(),b=fixture();
 const roots=await Promise.all([a.pool.acquire('a',{load:async()=>a.root}),b.pool.acquire('b',{load:async()=>b.root})]);
 let current=a.t,reads=0;
 const material={get map(){reads++;return current;}};
 const scene={traverse(visit){visit({material});visit({material});}};
 const first=retainVehicleResources(scene);
 assert.equal(reads,1);
 current=b.t;
 const second=retainVehicleResources(scene);
 assert.equal(reads,2,'a later preparation must read the current material again');
 roots.forEach(releaseVehicleModel);
 assert.equal(a.g.count,0);assert.equal(b.g.count,0);
 first();
 assert.equal(a.g.count,1);assert.equal(a.t.count,1);assert.equal(b.g.count,0);assert.equal(b.t.count,0);
 second();
 assert.equal(b.g.count,1);assert.equal(b.t.count,1);
});
