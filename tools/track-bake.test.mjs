import {encodeBinaryBake,decodeBinaryBake} from '../src/tracks/visuals/bake-binary-codec.mjs?v=9a206fac5b81dd7a';
import {prepareBinaryPayload} from './bake-tooling.mjs?v=08383d8a84ffdff4';
import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {routeSpatialField} from '../src/tracks/visuals/closure-terrain.mjs?v=4dcccce8e97601ca';
import {visualRoadField} from '../src/tracks/visuals/forest-terrain-detail.mjs?v=9535a171be7c3c52';
import {refineTerrainSurface} from '../src/tracks/visuals/terrain-refinement.mjs?v=b7edee06e0b828be';
import {computeSurfaceCurvature,releaseSurfaceCurvatureCache} from '../src/render/surface-curvature.mjs?v=38c4cf791d4cbb40';
import {prepareTrackBake,bakeCapture,bakeDiagnostics,BAKE_SCHEMA} from '../src/tracks/visuals/offline-track-bake.mjs?v=67e9450828b29db5';
const state=globalThis.__asfaltoTrackBakeState;
const clear=()=>{state.entries.clear();globalThis.__ASFALTO_CAPTURE_BAKE__=true;};
test('distributed spatial query results retain exact doubles and nulls; stale inputs miss',()=>{
 clear();const samples=[{position:[0,3,0],sM:0,widthM:8},{position:[100,7,60],sM:120,widthM:10}];
 const f=routeSpatialField(samples),queries=[[2,3,100],[90,40,200],[800,800,20]],expected=queries.map(q=>f(...q));
 const serialized=JSON.stringify(bakeCapture());state.entries=new Map(JSON.parse(serialized).entries);globalThis.__ASFALTO_CAPTURE_BAKE__=false;
 const before=bakeDiagnostics().hits,g=routeSpatialField(samples);assert.deepEqual(queries.map(q=>g(...q)),expected);assert.ok(bakeDiagnostics().hits>=before+queries.length);
 assert.notDeepEqual(routeSpatialField([{...samples[0],position:[0,20,0]},samples[1]])(2,3,100),expected[0]);
});
test('refinement bake preserves every geometry/index/normal value, ownership and transforms',()=>{
 clear();const query={sample:s=>({position:[s,0,0],widthM:8})},roadField=visualRoadField(query,200);
 const source=new T.PlaneGeometry(200,200,10,10);source.rotateX(-Math.PI/2);source.translate(50,30,80);
 const parent=new T.Group(),a=new T.Mesh(source.clone()),b=new T.Mesh(source.clone());parent.position.set(5,2,7);parent.add(a,b);
 const options={roadField,region:'dos_lagos',targetEdgeM:32,maxTriangles:1000};const result=refineTerrainSurface(T,a,options);
 state.entries=new Map(JSON.parse(JSON.stringify(bakeCapture())).entries);globalThis.__ASFALTO_CAPTURE_BAKE__=false;
 assert.deepEqual(refineTerrainSurface(T,b,options),result);
 for(const name of Object.keys(a.geometry.attributes))assert.deepEqual(b.geometry.attributes[name].array,a.geometry.attributes[name].array);
 assert.deepEqual(b.geometry.index.array,a.geometry.index.array);assert.equal(b.children[0].geometry.attributes.position.count,source.attributes.position.count);
 parent.position.x=200;parent.updateMatrixWorld(true);assert.equal(a.matrixWorld.elements[12],b.matrixWorld.elements[12]);assert.equal(a.matrixWorld.elements[12],200);
});
test('curvature bake equals full precision original and respects vertex budgets',()=>{
 clear();const g=new T.SphereGeometry(5,20,16),original=computeSurfaceCurvature(T,g);assert.ok(original.attribute);
 releaseSurfaceCurvatureCache(g);state.entries=new Map(JSON.parse(JSON.stringify(bakeCapture())).entries);globalThis.__ASFALTO_CAPTURE_BAKE__=false;
 assert.deepEqual(computeSurfaceCurvature(T,g).attribute.array,original.attribute.array);
 assert.equal(computeSurfaceCurvature(T,g,{maxVertices:1}).diagnostics.reason,'vertex-budget');
});
test('loader unsupported-worker fallback and already-aborted signal preserve cache safety',async()=>{
 globalThis.document={};globalThis.__ASFALTO_CAPTURE_BAKE__=false;const warn=console.warn;console.warn=()=>{};
 try{await prepareTrackBake('test_track');assert.equal(state.entries.size,0);assert.match(bakeDiagnostics().lastError,/worker unavailable/);const c=new AbortController();c.abort();await assert.rejects(()=>prepareTrackBake('test_track',c.signal),{name:'AbortError'});}finally{console.warn=warn;delete globalThis.document;}
});
test('binary artifact encoding round-trips float bits, indices and spatial doubles',()=>{
 clear();const field=routeSpatialField([{position:[0,1.23456789123,0],sM:0,widthM:8},{position:[30,10,5],sM:32,widthM:9}]);field(4.567891234,2.345678,100);field(800,800,1);
 computeSurfaceCurvature(T,new T.SphereGeometry(5,12,8));
 const original=prepareBinaryPayload(bakeCapture()),packed=encodeBinaryBake(original),decoded=decodeBinaryBake(packed.slice(0));
 assert.deepEqual(decoded,original);
 assert.deepEqual(encodeBinaryBake(original),packed);
});


test('curvature bakes distinguish interleaved views sharing the same storage',()=>{
 clear();const sphere=new T.SphereGeometry(5,8,6),source=sphere.attributes.position,array=new Float32Array(source.count*6);for(let i=0;i<source.count;i++)array.set([source.getX(i),source.getY(i),source.getZ(i),source.getX(i),0,source.getZ(i)],i*6);
 const data=new T.InterleavedBuffer(array,6),a=new T.BufferGeometry(),b=new T.BufferGeometry();a.setAttribute('position',new T.InterleavedBufferAttribute(data,3,0));b.setAttribute('position',new T.InterleavedBufferAttribute(data,3,3));a.setIndex(sphere.index.clone());b.setIndex(sphere.index.clone());computeSurfaceCurvature(T,a);globalThis.__ASFALTO_CAPTURE_BAKE__=false;const actual=computeSurfaceCurvature(T,b).attribute.array;releaseSurfaceCurvatureCache(b);state.entries.clear();const expected=computeSurfaceCurvature(T,b).attribute.array;assert.deepEqual(actual,expected);assert.ok(actual.every(v=>v===0));
});
test('refinement helper-only edits invalidate distributed results',async()=>{
 const {readFile}=await import('node:fs/promises'),url=new URL('../src/tracks/visuals/terrain-refinement.mjs?v=b7edee06e0b828be',import.meta.url);const text=await readFile(url,'utf8');const changed=text.replace(/(['"])\.\/offline-track-bake\.mjs(?:\?[^'"]*)?\1/,JSON.stringify(new URL('../src/tracks/visuals/offline-track-bake.mjs?v=67e9450828b29db5',import.meta.url).href)).replace('return(h(ix,iz)','return 0;return(h(ix,iz)');assert.notEqual(changed,text);const modified=await import('data:text/javascript;base64,'+Buffer.from(changed).toString('base64'));
 clear();const roadField=Object.assign(()=>({distanceM:500,widthM:8,position:[0,0,0]}),{bakeSignature:'test-field'}),source=new T.PlaneGeometry(200,200,10,10);source.rotateX(-Math.PI/2);source.translate(50,30,80);for(let i=0;i<source.attributes.position.count;i++){const p=source.attributes.position;p.setY(i,p.getY(i)+p.getX(i)*.2+p.getZ(i)*.1);}const options={roadField,region:'dos_lagos',targetEdgeM:32,maxTriangles:1000},a=new T.Mesh(source.clone()),b=new T.Mesh(source.clone()),c=new T.Mesh(source.clone());refineTerrainSurface(T,a,options);globalThis.__ASFALTO_CAPTURE_BAKE__=false;modified.refineTerrainSurface(T,b,options);state.entries.clear();modified.refineTerrainSurface(T,c,options);assert.deepEqual(b.geometry.attributes.position.array,c.geometry.attributes.position.array);assert.notDeepEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);
});

