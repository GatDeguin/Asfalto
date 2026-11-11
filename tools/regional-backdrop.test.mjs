import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THREE as T} from './cinematic-three.mjs';
import {mountainProfile} from '../src/tracks/visuals/mountain-profile.mjs?v=260b3d9b5f9319b2';
import {addMountainBackdrop,terrainProjection} from '../src/tracks/visuals/reference-landscape.mjs?v=30a528c61c10745d';
import {decodeHorconesDEM,addHorconesDEM} from '../src/tracks/visuals/horcones-dem.mjs?v=6e9457e12e10ffb1';
const ids=['dos_lagos','paso_garibaldi','cuesta_lipan','cataratas_iguazu'];
const query={sample:s=>({position:[s,Math.sin(s/500)*20,Math.sin(s/1100)*200],frame:{tangent:[1,0,0]}})};
test('regional backdrops stay finite and close at both ends of each ridge',()=>{
 for(const id of ids)for(let layer=0;layer<3;layer++)for(let row=0;row<=48;row++){
  const u=row/48,a=mountainProfile(id,0,u,layer),b=mountainProfile(id,Math.PI*2,u,layer);
  assert.ok(Math.abs(a.height-b.height)<1e-8,`${id} seam`);
  for(let col=0;col<=320;col++){const p=mountainProfile(id,col/320*Math.PI*2,u,layer);assert.ok(Number.isFinite(p.height)&&p.height>=0);assert.ok(p.radius>=1);}
 }
});
test('Misiones remains a low forest plateau instead of inheriting Andean peaks',()=>{
 let highest=0;for(let a=0;a<360;a++)for(let row=0;row<=48;row++)highest=Math.max(highest,mountainProfile('cataratas_iguazu',a*Math.PI/180,row/48,2).height);
 assert.ok(highest<300,`unexpected tropical mountain: ${highest}m`);
});
test('three visual ridge layers keep the existing 52736-triangle budget and draw count',()=>{
 for(const id of ids){const root=new T.Group(),stats=addMountainBackdrop(T,root,id,query,5000,{});assert.equal(root.children.length,3);assert.equal(stats.mountainTriangles,52736);for(const mesh of root.children){assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));assert.equal(mesh.castShadow,false);mesh.geometry.dispose();mesh.material.dispose();}}
});
test('basalt and laterite use distinct programs while retaining native fog and HDR chunks',()=>{
 const materials=['MAT_basalt','MAT_laterite','MAT_forest_floor'].map(name=>{const m=new T.MeshStandardMaterial({name});m.userData.asfaltoRegion='cataratas_iguazu';terrainProjection(m,5);return m;});
 assert.equal(new Set(materials.map(m=>m.customProgramCacheKey())).size,3);
 for(const material of materials){const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);for(const chunk of ['fog_fragment','tonemapping_fragment','colorspace_fragment'])assert.ok(shader.fragmentShader.includes('#include <'+chunk+'>'));material.dispose();}
});
test('DEM apron has one usable normal for every vertex, including the 640 crop-edge additions',()=>{
 const b=fs.readFileSync(new URL('../tracks/aconcagua-horcones/distant-aconcagua-dem.glb',import.meta.url)),g=decodeHorconesDEM(T,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),provenance=JSON.parse(fs.readFileSync(new URL('../tracks/aconcagua-horcones/distant-aconcagua-dem.provenance.json',import.meta.url))),root=new T.Group();
 addHorconesDEM(T,root,{geometry:g,provenance});const geometry=root.children[0].geometry,normals=geometry.attributes.normal;assert.equal(normals.count,geometry.attributes.position.count);for(let i=g.attributes.position.count;i<normals.count;i++)assert.ok(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))>.99);g.dispose();geometry.dispose();root.children[0].material.dispose();
});
test('DEM styling preserves every geographic vertex and index; owns only its clone',()=>{
 const b=fs.readFileSync(new URL('../tracks/aconcagua-horcones/distant-aconcagua-dem.glb',import.meta.url)),g=decodeHorconesDEM(T,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),source=new Float32Array(g.attributes.position.array),colors=new Float32Array(g.attributes.color.array),provenance=JSON.parse(fs.readFileSync(new URL('../tracks/aconcagua-horcones/distant-aconcagua-dem.provenance.json',import.meta.url))),root=new T.Group();
 addHorconesDEM(T,root,{geometry:g,provenance});const rendered=root.children[0].geometry,expected=g.clone().applyMatrix4(new T.Matrix4().fromArray(provenance.placement.matrixColumnMajor));assert.deepEqual(rendered.attributes.position.array.slice(0,source.length),expected.attributes.position.array);assert.deepEqual(rendered.index.array.slice(0,g.index.count),g.index.array);assert.deepEqual(g.attributes.position.array,source);assert.deepEqual(g.attributes.color.array,colors);assert.equal(rendered.index.count,157440);assert.ok(rendered.attributes.color.array.slice(0,colors.length).some((v,i)=>Math.abs(v-colors[i])>.04),'DEM relief should become readable through slope/height color');g.dispose();expected.dispose();rendered.dispose();root.children[0].material.dispose();
});
