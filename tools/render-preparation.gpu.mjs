// Optional real-WebGL regression test. Uses shipped Three; no save/profile writes.
// Install Playwright normally, or set PLAYWRIGHT_PACKAGE to its host package.json.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const root=new URL('../',import.meta.url);
const payload=JSON.parse(fs.readFileSync(new URL('assets/manifests/workshop-bootstrap.json?v=71e24e64d3ef5ec5',root)));
const core='data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64');
const source=gunzipSync(Buffer.from(payload.threeModuleGz,'base64')).toString().replaceAll('./three.core.min.js',core);
const helper=fs.readFileSync(new URL('src/render/pass-preparation.mjs?v=258173b4dba723d7',root),'utf8');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:process.platform==='win32'?['--use-angle=d3d11']:[]});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result=await page.evaluate(async({source,helper})=>{
  const module=code=>URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const threeUrl=module(source),helperUrl=module(helper),T=await import(threeUrl),{compileVisiblePass,prepareBatchedPass,registerRenderPreparation,disposeRenderPreparation}=await import(helperUrl);
  const renderer=new T.WebGLRenderer(),camera=new T.PerspectiveCamera(60,1,.1,100),scene=new T.Scene();renderer.setSize(32,32);renderer.toneMapping=T.ACESFilmicToneMapping;camera.position.z=5;camera.updateMatrixWorld();registerRenderPreparation(renderer,T);
  const opaque=new T.MeshStandardMaterial({color:'red'}),box=new T.Mesh(new T.BoxGeometry(),opaque);scene.add(box,new T.DirectionalLight());
  const cases=[];for(const planes of [0,1,0]){
   renderer.clippingPlanes=planes?[new T.Plane(new T.Vector3(0,1,0),0)]:[];
   const observed=[];opaque.onBeforeCompile=parameters=>observed.push(parameters.numClippingPlanes);
   const counts={...renderer.info.render},auto=renderer.autoClear;
   await compileVisiblePass(renderer,scene,camera);
   const primingPreservesCounters=JSON.stringify(renderer.info.render)===JSON.stringify(counts)&&renderer.autoClear===auto;
   const before=renderer.info.programs.length;renderer.render(scene,camera);cases.push({planes,observed,before,after:renderer.info.programs.length,primingPreservesCounters});
  }
  const local=[];renderer.localClippingEnabled=true;
  for(const enabled of [true,false]){opaque.clippingPlanes=enabled?[new T.Plane(new T.Vector3(1,0,0),0)]:[];opaque.needsUpdate=true;await compileVisiblePass(renderer,scene,camera);const before=renderer.info.programs.length;renderer.render(scene,camera);local.push({enabled,before,after:renderer.info.programs.length});}
  const transmission=[];
  for(const transparent of [true,false])for(const forceSinglePass of [false,true]){
   const glassMaterial=new T.MeshPhysicalMaterial({transmission:1,thickness:.2,roughness:.1,transparent,side:T.DoubleSide,forceSinglePass}),glass=new T.Mesh(new T.BoxGeometry(2,2,.1),glassMaterial);glass.position.z=1;scene.add(glass);
   await compileVisiblePass(renderer,scene,camera);const before=renderer.info.programs.length;renderer.render(scene,camera);transmission.push({transparent,forceSinglePass,before,after:renderer.info.programs.length});glass.removeFromParent();glass.geometry.dispose();glassMaterial.dispose();
  }
  const fogTiers=[];
  renderer.localClippingEnabled=false;renderer.clippingPlanes=[];
  const read=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(32*32*4);gl.readPixels(0,0,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
  scene.fog=null;const noFog=read();
  for(const exponential of [true,false]){
   const fog=scene.fog=exponential?new T.FogExp2('blue',0):new T.Fog('blue',camera.far,camera.far*2);
   await compileVisiblePass(renderer,scene,camera);const neutral=read(),before=renderer.info.programs.length;
   if(exponential)fog.density=.15;else{fog.near=1;fog.far=10;}
   await compileVisiblePass(renderer,scene,camera);const low=read();
   fogTiers.push({exponential,before,after:renderer.info.programs.length,neutralMatches:noFog.every((n,i)=>n===neutral[i]),lowChanges:low.some((n,i)=>n!==neutral[i])});
  }
  scene.fog=null;renderer.shadowMap.enabled=true;box.receiveShadow=true;
  const sun=scene.children.find(n=>n.isLight);sun.castShadow=true;
  await compileVisiblePass(renderer,scene,camera);renderer.render(scene,camera);const currentProgram=renderer.properties.get(opaque).currentProgram.id;
  const future=prepareBatchedPass(renderer,()=>{try{renderer.shadowMap.enabled=false;return compileVisiblePass(renderer,scene,camera);}finally{renderer.shadowMap.enabled=true;}},{size:1});
  renderer.render(scene,camera);const foregroundProgram=renderer.properties.get(opaque).currentProgram.id;await future;
  const staged={currentProgram,foregroundProgram};
  // Starting teardown while native compile is still polling must be safe.
  const pending=compileVisiblePass(renderer,scene,camera);opaque.dispose();renderer.dispose();await pending;
  const error=renderer.getContext().getError();disposeRenderPreparation(renderer);box.geometry.dispose();opaque.dispose();renderer.dispose();URL.revokeObjectURL(threeUrl);URL.revokeObjectURL(helperUrl);return{revision:T.REVISION,cases,local,transmission,fogTiers,staged,error};
 },{source,helper});
 assert.equal(result.staged.currentProgram,result.staged.foregroundProgram,'future compile corrupted foreground program selection');
 assert.deepEqual(errors,[]);assert.equal(result.error,0);
 for(const sample of result.cases){assert.equal(sample.after,sample.before,'draw created an unprepared clipping variant');assert.equal(sample.primingPreservesCounters,true);assert.ok(sample.observed.every(value=>value===sample.planes));}
 for(const sample of result.local)assert.equal(sample.after,sample.before,'draw created an unprepared local clipping variant');
 for(const sample of result.fogTiers){assert.equal(sample.before,sample.after,'low fog created new world programs');assert.equal(sample.neutralMatches,true);assert.equal(sample.lowChanges,true);}
 for(const sample of result.transmission)assert.equal(sample.after,sample.before,'draw created an unprepared transmission variant');console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
