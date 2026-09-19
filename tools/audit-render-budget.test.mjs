import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {THREE as T} from './cinematic-three.mjs';
const module=await import('../src/render/main-render-budget.mjs').catch(()=>({}));
const workshopModule=await import('../src/render/workshop-render-budget.mjs').catch(()=>({}));
test('A7 main HDR budget bounds high-DPR and extreme-aspect buffers before allocation',()=>{
 assert.equal(typeof module.planMainRenderBudget,'function');
 for(const quality of ['cinematic','high','balanced','low'])for(const [width,height,ratio] of [[1920,1080,1.9],[3840,2160,2],[9000,1000,4],[10,9000,3]]){
  const p=module.planMainRenderBudget({width,height,pixelRatio:ratio,quality,samples:quality==='cinematic'?4:2,maxTextureSize:4096});
  assert.ok(p.width*p.height<=p.maxPixels);assert.ok(p.nominalBytes<=p.limitBytes);assert.ok(p.width<=4096&&p.height<=4096);
  assert.ok(p.pixelRatio<=ratio);assert.equal(p.scope,'main HDR targets only; not measured VRAM');
 }
});
test('A7 phone targets have an explicit lower bound on memory budget, and budget sanitizes invalid inputs',()=>{
 assert.equal(typeof module.planMainRenderBudget,'function');
 const p=module.planMainRenderBudget({width:1920,height:1080,pixelRatio:3,quality:'cinematic',phone:true,samples:0});
 assert.ok(p.nominalBytes<=96*1024*1024);assert.ok(p.width*p.height<=1048576);
 const invalid=module.planMainRenderBudget({width:NaN,height:Infinity,pixelRatio:-1});
 assert.ok(Number.isFinite(invalid.nominalBytes));assert.ok(invalid.width>=1&&invalid.height>=1);
});
test('A4 workshop applies actual internal resolution and bounded shadows, without compounding DPR or losing contact shadows',()=>{
 assert.equal(typeof workshopModule.createWorkshopRenderBudget,'function');
 let ratio=1.75,size=new T.Vector2(1280,720);const calls=[];const scene=new T.Scene(),light=new T.DirectionalLight();light.castShadow=true;light.shadow.mapSize.set(2048,2048);scene.add(light);
 const renderer={capabilities:{maxTextureSize:4096},shadowMap:{enabled:true},getPixelRatio:()=>ratio,getSize:v=>v.copy(size),getDrawingBufferSize:v=>v.copy(size).multiplyScalar(ratio).floor(),setPixelRatio:v=>{ratio=v;calls.push('ratio');},setSize:(w,h)=>{size.set(w,h);calls.push('size');}};
 const api=workshopModule.createWorkshopRenderBudget(T,{renderer,scene});api.setTier('high');const before=ratio;api.setTier('low');assert.ok(ratio<before);assert.equal(renderer.shadowMap.enabled,true);assert.equal(light.shadow.mapSize.x,1024);
 const low=ratio;for(let i=0;i<10;i++)api.resize({width:1280,height:720,pixelRatio:1.75});assert.equal(ratio,low);
 assert.deepEqual(api.diagnostics().drawingBuffer,[Math.floor(1280*ratio),Math.floor(720*ratio)]);
 api.dispose();assert.equal(ratio,1.75);assert.equal(light.shadow.mapSize.x,2048);
});
test('A4 advanced workshop governor invokes its renderer policy on a real tier transition',async()=>{
 const {createAdvancedGraphics}=await import('../src/render/advanced-graphics.mjs');const storage=globalThis.__asfaltoV7Storage;let ratio=1.5,resizes=0;
 globalThis.__asfaltoV7Storage={getItem:()=>JSON.stringify({quality:'cinematic',materials:false,gtao:false,ssgi:false,dfao:false,volumetrics:false,sky:false,pivotPainter:false,pdo:false})};
 const renderer={info:{memory:{}},capabilities:{maxSamples:0,maxTextureSize:4096},getContext:()=>({isContextLost:()=>false}),render(){},getSize:v=>v.set(640,360),getDrawingBufferSize:v=>v.set(640*ratio,360*ratio).floor(),getPixelRatio:()=>ratio,setPixelRatio:v=>{ratio=v;resizes++;},setSize(){}};
 let api;try{api=createAdvancedGraphics(T,{renderer,scene:new T.Scene(),camera:new T.PerspectiveCamera(),scope:'workshop',getMaximumQuality:()=> 'high'});for(let i=0;i<70;i++){api.update({time:i*.1});api.render(()=>{});}assert.equal(api.diagnostics().performance.tier,'low');assert.ok(resizes>0);assert.ok(api.diagnostics().rendererPolicy.drawingBuffer[0]<960);}finally{api?.dispose();globalThis.__asfaltoV7Storage=storage;}
});
test('A7 both HDR passes invoke the same budget before target allocation',()=>{
 for(const file of ['screen-space-lighting.mjs','race-color-grade.mjs'])assert.match(fs.readFileSync(new URL('../src/render/'+file,import.meta.url),'utf8'),/planMainRenderBudget\(/);
 const host=fs.readFileSync(new URL('../src/legacy/module-02.mjs',import.meta.url),'utf8');assert.match(host,/planMainRenderBudget\(/);
});
