import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createAdvancedMaterials,classifyAdvancedSurface} from '../src/render/advanced-materials.mjs';
import {createChevyPaintController} from '../src/render/chevy-paint-controller.mjs';
import {createDistanceFieldOcclusion} from '../src/render/distance-field-occlusion.mjs';
import {createPivotPainter} from '../src/render/pivot-painter.mjs';
import {weatherEffectsPolicy} from '../src/render/weather-effects-policy.mjs';
import {createCockpitRenderPass} from '../src/render/cockpit-render-pass.mjs';
import {THREE as T} from './cinematic-three.mjs';
const shaderFor=m=>{const s={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};m.onBeforeCompile(s,{});return s;};

test('Cinematic materiality keeps authored maps, metalness, identity and restores hooks',()=>{
 const scene=new T.Scene(),geometry=new T.BoxGeometry(),map=new T.Texture(),material=new T.MeshStandardMaterial({map,metalness:.08,roughness:.35});material.name='Body_Paint';
 const oldCompile=material.onBeforeCompile,oldKey=material.customProgramCacheKey;scene.add(new T.Mesh(geometry,material));
 const api=createAdvancedMaterials(T,{root:scene,quality:'cinematic'}),shader=shaderFor(material);
 assert.equal(shader.uniforms.anAMQuality.value,1);assert.equal(shader.uniforms.anAMCinematic.value,1);
 assert.equal(material.map,map);assert.equal(material.metalness,.08);assert.equal(scene.children[0].material,material);
 assert.match(shader.fragmentShader,/anAMFootprint/);assert.match(shader.vertexShader,/anAMMetricScale/);
 const compile=material.onBeforeCompile;for(let i=0;i<5;i++)api.refresh();assert.equal(material.onBeforeCompile,compile);
 api.setQuality('off');assert.equal(shader.uniforms.anAMQuality.value,0);
 api.dispose();api.dispose();assert.equal(material.onBeforeCompile,oldCompile);assert.equal(material.customProgramCacheKey,oldKey);
 assert.equal(material.isMeshPhysicalMaterial,undefined);assert.equal(material.map,map);assert.equal(geometry.getAttribute('anAdvancedCurvature'),undefined);
});
test('rubber, vinyl and asphalt have explicit non-metallic material roles; glass and water remain untouched',()=>{
 const expected={Road_Asphalt:'asphalt',Tire_Rubber:'rubber',Dashboard_Vinyl:'vinyl',Rock_Granite:'mineral'};
 for(const [name,role]of Object.entries(expected)){const m=new T.MeshStandardMaterial();m.name=name;assert.equal(classifyAdvancedSurface(m),role);}
 for(const name of ['Glass_Windscreen','Water_Lake','Chrome_Trim']){const m=new T.MeshPhysicalMaterial();m.name=name;assert.equal(classifyAdvancedSurface(m),null);}
});
test('mixed Chevy atlas microdetail uses the existing paint mask after it is defined',()=>{
 const scene=new T.Scene(),original=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),original);scene.add(mesh);
 const paint=createChevyPaintController(T,scene,{partitionWheels:false});const material=mesh.material;
 const advanced=createAdvancedMaterials(T,{root:scene,quality:'cinematic'}),s=shaderFor(material);
 assert.match(s.fragmentShader,/anAMSurfaceMask.*chevyPaintMask/);
 assert.ok(s.fragmentShader.indexOf('float chevyPaintMask')<s.fragmentShader.indexOf('float anAMSurfaceMask'));
 assert.equal(paint.setColor('#123456'),true);assert.equal(s.uniforms.chevyPaintColor.value.getHexString(),'123456');
 advanced.dispose();assert.equal(mesh.material,material);paint.dispose();assert.equal(mesh.material,original);
});
test('DFAO and Pivot Painter explicitly keep their High budgets; rain count does not multiply',()=>{
 const scene=new T.Scene(),df=createDistanceFieldOcclusion(T,{scene}),pp=createPivotPainter(T,{root:scene,quality:'cinematic'});
 df.setQuality('cinematic');assert.equal(df.diagnostics().rays,3);assert.equal(df.diagnostics().steps,4);assert.equal(pp.uniforms.anPpLeafMotion.value,1);
 assert.deepEqual(weatherEffectsPolicy({precipitation:'rain'},'cinematic'),weatherEffectsPolicy({precipitation:'rain'},'high'));
 df.dispose();df.dispose();pp.dispose();pp.dispose();
});
test('HDR multisampling chooses only the intersection supported by color and depth formats',async()=>{
 const url=new URL('../src/render/render-target-capabilities.mjs',import.meta.url);assert.ok(fs.existsSync(url),'format-aware multisample selector exists');
 const {supportedHdrSamples}=await import(url);
 const renderer=(color,depth,max=8)=>({capabilities:{maxSamples:max},getContext:()=>({RENDERBUFFER:1,RGBA16F:2,DEPTH_COMPONENT24:3,SAMPLES:4,getInternalformatParameter:(_,f)=>f===2?color:depth})});
 assert.equal(supportedHdrSamples(renderer([8,4],[4,2]),4),4);
 assert.equal(supportedHdrSamples(renderer([8,4],[4,2]),2),0);
 assert.equal(supportedHdrSamples(renderer([4,2],[2]),4),2);
 assert.equal(supportedHdrSamples(renderer([8],[4]),8),0);
 assert.equal(supportedHdrSamples(renderer([4],[4]),0),0);
 assert.equal(supportedHdrSamples({capabilities:{maxSamples:4},getContext:()=>({})},4),0);
});
test('texture filtering is reversible, capability-capped, shared-owner safe and never disposes borrowed textures',async()=>{
 const url=new URL('../src/render/texture-filtering.mjs',import.meta.url);assert.ok(fs.existsSync(url),'reversible texture filtering exists');
 const {createTextureFiltering}=await import(url),texture=new T.Texture();texture.minFilter=T.LinearMipmapLinearFilter;
 const scene=new T.Scene();scene.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({map:texture})));
 const renderer={capabilities:{getMaxAnisotropy:()=>4}};let disposed=0;texture.addEventListener('dispose',()=>disposed++);
 const a=createTextureFiltering(T,{root:scene,renderer,quality:'cinematic'}),b=createTextureFiltering(T,{root:scene,renderer,quality:'cinematic'});
 assert.equal(texture.anisotropy,4);const version=texture.version;a.refresh();assert.equal(texture.version,version);
 a.dispose();assert.equal(texture.anisotropy,4);b.setQuality('off');assert.equal(texture.anisotropy,1);
 b.dispose();b.dispose();assert.equal(disposed,0);
});
// Renderer API model only. These tests do NOT claim GPU shader compilation.
function mockRenderer(){const target={name:'outer'},state={target,face:2,mip:1,viewport:new T.Vector4(2,3,400,300),scissor:new T.Vector4(4,5,200,100),scissorTest:true};return{state,autoClear:true,info:{autoReset:true},shadowMap:{autoUpdate:true,needsUpdate:true},
 getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,setRenderTarget(t,f=0,m=0){state.target=t;state.face=f;state.mip=m;},
 getViewport:v=>v.copy(state.viewport),setViewport(x,y,z,w){if(x?.isVector4)state.viewport.copy(x);else state.viewport.set(x,y,z,w);},getScissor:v=>v.copy(state.scissor),setScissor(x,y,z,w){if(x?.isVector4)state.scissor.copy(x);else state.scissor.set(x,y,z,w);},getScissorTest:()=>state.scissorTest,setScissorTest:v=>state.scissorTest=v,clearDepth(){},render(){}};}
test('cockpit restores target, viewport, scissor, masks and depth ownership even when the world throws',()=>{
 const renderer=mockRenderer(),scene=new T.Scene(),camera=new T.PerspectiveCamera(),cockpit=new T.Group(),light=new T.DirectionalLight(),overlay=new T.Group();scene.add(cockpit,light,overlay);
 const before={target:renderer.state.target,viewport:renderer.state.viewport.toArray(),scissor:renderer.state.scissor.toArray(),mask:camera.layers.mask,light:light.layers.mask};
 const pass=createCockpitRenderPass({renderer,scene,camera,cockpit,overlays:[overlay],renderWorld(){renderer.setRenderTarget({name:'leak'});renderer.setViewport(0,0,5,5);renderer.setScissor(0,0,2,2);renderer.setScissorTest(false);throw Error('capture failed');}});
 assert.throws(()=>pass.render(),/capture failed/);assert.equal(renderer.state.target,before.target);assert.deepEqual(renderer.state.viewport.toArray(),before.viewport);assert.deepEqual(renderer.state.scissor.toArray(),before.scissor);assert.equal(renderer.state.scissorTest,true);assert.equal(renderer.state.face,2);assert.equal(renderer.state.mip,1);assert.equal(camera.layers.mask,before.mask);assert.equal(light.layers.mask,before.light);assert.equal(cockpit.visible,true);assert.equal(overlay.visible,true);assert.equal(renderer.autoClear,true);
});
test('workshop owns a real governor, honors manual Cinematic and reports a measured downgrade',async()=>{
 const {createAdvancedGraphics}=await import('../src/render/advanced-graphics.mjs');
 const old=globalThis.__asfaltoV7Storage;
 globalThis.__asfaltoV7Storage={getItem:()=>JSON.stringify({quality:'cinematic',materials:false,gtao:false,ssgi:false,dfao:false,volumetrics:false,sky:false,pivotPainter:false,pdo:false})};
 const renderer={info:{memory:{textures:0,geometries:0}},capabilities:{maxSamples:0},getContext:()=>({isContextLost:()=>false}),render(){}};
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();let api;
 try{
  api=createAdvancedGraphics(T,{renderer,scene,camera,scope:'workshop',getMaximumQuality:()=> 'high'});
  assert.equal(api.getEffectiveQuality(),'cinematic');
  let time=0;for(let i=0;i<242;i++){time+=.03;api.update({time,environment:{skyId:'night',sunIntensity:0}});api.render(()=>{});}
  assert.equal(api.diagnostics().performance.tier,'high');
  assert.equal(api.diagnostics().requestedQuality,'cinematic');assert.equal(api.getEffectiveQuality(),'high');
  assert.ok(api.diagnostics().performance.p95FrameMs>=29.9);
  time+=.4;api.update({time});api.render(()=>{});assert.ok(api.diagnostics().performance.maxFrameIntervalMs>=399,'A genuine 400ms hitch must not be hidden');
  api.beginFrameWindow();time+=10;api.update({time});api.render(()=>{});assert.equal(api.diagnostics().performance.samples,0,'Explicit resume excludes inactive time');
 }finally{api?.dispose();globalThis.__asfaltoV7Storage=old;}
});
