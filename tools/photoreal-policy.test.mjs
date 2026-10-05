import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextureFiltering} from '../src/render/texture-filtering.mjs?v=dd00a75cbd9c1e71';
import {resolveRenderBudget} from '../src/render/render-budget.mjs?v=19c7400d32eaa34a';
const T={LinearMipmapLinearFilter:1,LinearMipmapNearestFilter:2,NearestMipmapLinearFilter:3,NearestMipmapNearestFilter:4};
const texture=(extra={})=>({isTexture:true,minFilter:1,generateMipmaps:true,anisotropy:1,...extra});
const root=maps=>({traverse(fn){for(const map of maps)fn({material:{map}});}});
const renderer={capabilities:{getMaxAnisotropy:()=>4}};

test('Balanced filters eligible mipmapped textures at 2x, High at hardware-bounded 4x',()=>{
 const map=texture(), video=texture({isVideoTexture:true}), noMips=texture({generateMipmaps:false}), rt=texture({isRenderTargetTexture:true});
 const filter=createTextureFiltering(T,{root:root([map,video,noMips,rt]),renderer,quality:'balanced'});
 assert.equal(map.anisotropy,2);assert.equal(video.anisotropy,1);assert.equal(noMips.anisotropy,1);assert.equal(rt.anisotropy,1);
 filter.setQuality('high');assert.equal(map.anisotropy,4);filter.setQuality('cinematic');assert.equal(map.anisotropy,4);
 filter.setQuality('low');assert.equal(map.anisotropy,1);filter.dispose();
});
test('shared texture keeps strongest active owner and restores after last release',()=>{
 const map=texture(),a=createTextureFiltering(T,{root:root([map]),renderer,quality:'balanced'}),b=createTextureFiltering(T,{root:root([map]),renderer,quality:'high'});
 assert.equal(map.anisotropy,4);b.dispose();assert.equal(map.anisotropy,2);a.dispose();assert.equal(map.anisotropy,1);
});
test('filtered texture added late is borrowed, never cloned; dispose is idempotent',()=>{
 const maps=[], map=texture();const f=createTextureFiltering(T,{root:root(maps),renderer,quality:'high'});maps.push(map);f.refresh();assert.equal(map.anisotropy,4);assert.equal(f.diagnostics().ownedTextures,0);f.dispose();f.dispose();f.refresh();assert.equal(map.anisotropy,1);
});
test('spatial resolve reserves 12 bytes per pixel and constrains 4K to combined budget',()=>{
 const plain=resolveRenderBudget({width:640,height:360,quality:'high'}),aa=resolveRenderBudget({width:640,height:360,quality:'high',spatialResolve:true});
 assert.equal(aa.nominalPostBytes-plain.nominalPostBytes,640*360*12);
 const fourK=resolveRenderBudget({width:3840,height:2160,quality:'cinematic',spatialResolve:true});assert.ok(fourK.nominalPostBytes<=fourK.maxPostBytes);assert.ok(fourK.limited);
});
let createRenderCapabilities;try{({createRenderCapabilities}=await import('../src/render/render-capabilities.mjs?v=db7746f3deffab55'));}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
test('capability report distinguishes WebGPU adapter from shipped renderer and refreshes context limits',async()=>{
 assert.equal(typeof createRenderCapabilities,'function','capability monitor missing');
 const canvas=new EventTarget();let max=4096;
 const gl={canvas,VERSION:1,MAX_TEXTURE_SIZE:2,MAX_RENDERBUFFER_SIZE:3,MAX_TEXTURE_IMAGE_UNITS:4,MAX_VERTEX_ATTRIBS:5,MAX_UNIFORM_BLOCK_SIZE:6,MAX_SAMPLES:7,MAX_ARRAY_TEXTURE_LAYERS:8,getParameter(k){return k===1?'WebGL 2.0':max;},getSupportedExtensions:()=>['EXT_color_buffer_float','WEBGL_compressed_texture_s3tc'],isContextLost:()=>false};
 const report=createRenderCapabilities({renderer:{getContext:()=>gl,domElement:canvas,capabilities:{getMaxAnisotropy:()=>4}},navigator:{gpu:{requestAdapter:async()=>({features:new Set(['timestamp-query']),limits:{maxTextureDimension2D:8192,maxBufferSize:1024}})},deviceMemory:8}});
 await new Promise(resolve=>setImmediate(resolve));let d=report.diagnostics();assert.equal(d.backend,'webgl2');assert.equal(d.webgpu.status,'available');assert.equal(d.webgpu.rendererCompatible,false);assert.equal(d.webgl.maxTextureSize,4096);assert.deepEqual(d.webgl.compression,['bc']);assert.equal(d.memory.scope,'browser system-memory hint; not VRAM');
 max=8192;canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(report.diagnostics().webgl.maxTextureSize,8192);report.dispose();max=2048;canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(report.diagnostics().webgl.maxTextureSize,8192);
});
test('denied adapter preserves fallback, late adapter after dispose cannot mutate report',async()=>{
 assert.equal(typeof createRenderCapabilities,'function','capability monitor missing');
 const gl={getParameter:()=>null,getSupportedExtensions:()=>[]};let resolveAdapter;
 const monitor=createRenderCapabilities({renderer:{getContext:()=>gl},navigator:{gpu:{requestAdapter:()=>new Promise(resolve=>resolveAdapter=resolve)}}});await Promise.resolve();monitor.dispose();resolveAdapter({features:new Set(),limits:{}});await new Promise(resolve=>setImmediate(resolve));assert.equal(monitor.diagnostics().webgpu.status,'pending');
 const denied=createRenderCapabilities({renderer:{getContext:()=>gl},navigator:{gpu:{requestAdapter:async()=>{throw Error('denied');}}}});await new Promise(resolve=>setImmediate(resolve));assert.equal(denied.diagnostics().webgpu.status,'denied');assert.equal(denied.diagnostics().backend,'webgl2');denied.dispose();
});

import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
test('shared renderer, vehicle and curvature registries use one module URL each',async()=>{
 const names=['pass-preparation','vehicle-resource-pool','frame-matrices','surface-curvature'],urls=new Map(names.map(name=>[name,new Set()]));async function visit(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(/\.(mjs|js)$/.test(file)){const source=await fs.readFile(file,'utf8');for(const match of source.matchAll(/['"]([^'"\r\n]{0,150}(pass-preparation|vehicle-resource-pool|frame-matrices|surface-curvature)\.mjs(?:\?v=[a-f0-9]{16})?)['"]/g))urls.get(match[2]).add(new URL(match[1],pathToFileURL(file)).href);}}}
 await visit(path.resolve(import.meta.dirname,'../src'));assert.deepEqual(Object.fromEntries([...urls].map(([name,values])=>[name,values.size])),Object.fromEntries(names.map(name=>[name,1])),'split shared registries: '+JSON.stringify(Object.fromEntries([...urls].map(([name,values])=>[name,[...values]]))));
});
