import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {createScreenSpaceLighting} from '../src/render/screen-space-lighting.mjs?v=86108a480a3a8a84';
import {createRaceColorGrade} from '../src/render/race-color-grade.mjs?v=0bea085bd170c35b';
import {createCockpitRenderPass} from '../src/render/cockpit-render-pass.mjs?v=4dc1dfe6ae29fbad';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(){
 let target=null,face=2,mip=3,scissor=true,alpha=.4;const viewport=new T.Vector4(3,4,128,96),box=new T.Vector4(1,2,90,70),color=new T.Color('red');
 const r={extensions:{has:name=>name==='EXT_color_buffer_float'},compileAsync:()=>Promise.resolve(),draws:0,clears:0,autoClear:false,info:{autoReset:true},capabilities:{maxSamples:0},shadowMap:{autoUpdate:true,needsUpdate:true},toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1,outputColorSpace:T.SRGBColorSpace,
 getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,setRenderTarget(t,f=0,m=0){target=t;face=f;mip=m;viewport.copy(t?.viewport||new T.Vector4(0,0,128,96));box.copy(t?.scissor||new T.Vector4(0,0,128,96));scissor=t?.scissorTest||false;},getDrawingBufferSize:v=>v.set(128,96),getViewport:v=>v.copy(viewport),setViewport:v=>viewport.copy(v),getCurrentViewport:v=>v.copy(viewport),state:{viewport:v=>viewport.copy(v)},getScissor:v=>v.copy(box),setScissor:v=>box.copy(v),getScissorTest:()=>scissor,setScissorTest:v=>scissor=v,getClearColor:v=>v.copy(color),getClearAlpha:()=>alpha,setClearColor(c,a){color.set(c);alpha=a;},getContext:()=>({isContextLost:()=>false}),render(){r.draws++;},clear(){r.clears++;},clearDepth(){r.clears++;}};
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),fog=new T.Fog('blue',1,100);scene.fog=fog;
 const grade=createRaceColorGrade({THREE:T,renderer:r});
 const post=createScreenSpaceLighting(T,{renderer:r,scene,camera,atmosphere:{uniforms:{anAtmoEnabled:{value:1}}}});
 return{r,scene,camera,fog,grade,post};
}
for(const graded of [false,true])test(`prepare capture contexts match actual render, grading=${graded}`,async()=>{
 const f=fixture();if(graded)await f.grade.setSettings({contrast:1.1});
 let expectedWorld,expectedInterior,expectedFog;
 f.grade.render(()=>{f.post.render(()=>{expectedWorld=f.r.getRenderTarget();expectedFog=f.scene.fog;});expectedInterior=f.r.getRenderTarget();});f.r.draws=f.r.clears=0;
 const cockpit=new T.Group(),dash=new T.Mesh();cockpit.add(dash);f.scene.add(cockpit);const pending=[],captured=[];
 f.r.compileAsync=(_view,_camera,targetScene)=>{captured.push({main:targetScene===f.scene,target:f.r.getRenderTarget(),fog:f.scene.fog});const gate=deferred();pending.push(gate);return gate.promise;};
 const pass=createCockpitRenderPass({...f,renderer:f.r,cockpit,prepareWorld:compile=>f.grade.prepare(()=>f.post.prepare(compile)),prepareInterior:compile=>f.grade.prepare(compile)});
 const p=pass.prepare();assert.ok(captured.length>=4);assert.equal(captured[0].target.texture.type,expectedWorld.texture.type);assert.equal(captured[0].target.texture.colorSpace,expectedWorld.texture.colorSpace);assert.equal(captured[0].fog,expectedFog);assert.equal(f.r.getRenderTarget(),null);assert.equal(f.scene.fog,f.fog);assert.equal(f.r.autoClear,false);
 for(const gate of pending.splice(0))gate.resolve();await new Promise(r=>setImmediate(r));
 const main=captured.filter(x=>x.main);assert.equal(main.length,2);assert.equal(main[1].target,expectedInterior);assert.equal(main[1].fog,f.fog);assert.equal(f.r.getRenderTarget(),null);assert.equal(f.scene.fog,f.fog);for(const gate of pending.splice(0))gate.resolve();await p;
 assert.equal(f.r.draws,0);assert.equal(f.r.clears,0);f.post.dispose();f.grade.dispose();
});
for(const asyncFailure of [false,true])test(`nested prepare restores all state on callback failure, async=${asyncFailure}`,async()=>{
 const f=fixture(),original=new T.WebGLRenderTarget(64,48);await f.grade.setSettings({contrast:1.1});f.r.setRenderTarget(original,2,3);f.r.setViewport(new T.Vector4(3,4,128,96));f.r.setScissor(new T.Vector4(1,2,90,70));f.r.setScissorTest(true);const gate=deferred();let pending;
 const run=()=>f.grade.prepare(()=>f.post.prepare(()=>{assert.equal(f.scene.fog,f.fog);assert.equal(f.fog.near,f.camera.far);assert.equal(f.r.getRenderTarget().texture.name,'ASFALTO_INDIRECT_SOURCE');if(!asyncFailure)throw Error('compile failed');return gate.promise;}));
 if(asyncFailure)pending=run();else assert.throws(run,/compile failed/);
 assert.equal(f.r.getRenderTarget(),original);assert.equal(f.r.getActiveCubeFace(),2);assert.equal(f.r.getActiveMipmapLevel(),3);assert.equal(f.r.getScissorTest(),true);assert.equal(f.r.autoClear,false);assert.equal(f.r.info.autoReset,true);assert.equal(f.scene.fog,f.fog);assert.deepEqual(f.r.getViewport(new T.Vector4()).toArray(),[3,4,128,96]);assert.deepEqual(f.r.getScissor(new T.Vector4()).toArray(),[1,2,90,70]);assert.equal(f.r.getClearAlpha(),.4);assert.equal(f.r.draws,0);assert.equal(f.r.clears,0);
 if(asyncFailure){gate.reject(Error('compile failed'));await assert.rejects(pending,/compile failed/);}
 f.post.prepare(()=>{});f.grade.prepare(()=>{});f.post.dispose();f.grade.dispose();original.dispose();
});
test('disabled effects and neutral grade prepare bypass all target allocations',()=>{const f=fixture();f.post.setQuality('off');let called=0;const result=f.grade.prepare(({linearOutput})=>f.post.prepare(()=>{called++;assert.equal(linearOutput,false);assert.equal(f.scene.fog,f.fog);return 42;}));assert.equal(result,42);assert.equal(called,1);assert.equal(f.grade.diagnostics().renderTargetAllocated,false);assert.equal(f.post.diagnostics().targets,0);f.post.dispose();f.grade.dispose();});

for(const exponential of [false,true])test(`fog topology survives quality changes without double extinction, exponential=${exponential}`,async()=>{
 const f=fixture(),fog=f.scene.fog=exponential?new T.FogExp2('blue',.012):new T.Fog('blue',4,80);
 const original=exponential?[fog.density]:[fog.near,fog.far];
 for(const quality of ['high','balanced','low','high']){
  f.post.setQuality(quality);const capture=()=>{assert.equal(f.scene.fog,fog);const current=exponential?[fog.density]:[fog.near,fog.far];assert.deepEqual(current,quality==='low'?original:exponential?[0]:[f.camera.far,f.camera.far*2]);};
  await f.post.prepare(capture);assert.deepEqual(exponential?[fog.density]:[fog.near,fog.far],original);
  f.post.render(capture);assert.deepEqual(exponential?[fog.density]:[fog.near,fog.far],original);
 }
 f.post.dispose();f.grade.dispose();
});
