import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {chromium}=require('C:/Users/Gaston/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('../../Motor_Chevy_250/validation_tools/node_modules/sharp');
const root=path.resolve('Asfalto_Nacional_v7'), out=path.resolve('Reports/Asfalto_Nacional_v7/exact-route-previews-2026-09-12');
const assets=path.join(root,'assets/menu/game-captures'); fs.mkdirSync(out,{recursive:true});
const catalogFile=path.join(assets,'index.json'), catalog=JSON.parse(fs.readFileSync(catalogFile));
const {startServer}=await import('../server.mjs?v=photo-r1-20260916');
const server=await startServer({root,port:0,cockpitDataDirectory:path.join(out,'isolated-data')});
const report={startedAt:new Date().toISOString(),source:'actual-v7-renderer',expected:174,captures:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const tracks=['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu'];
const skies=['clear','overcast','golden-hour','sunset','moonrise','night'];
let browser,page;
try {
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--remote-debugging-port=9227']});
 page=await browser.newPage({viewport:{width:1280,height:720}});
 page.setDefaultTimeout(120000); page.on('pageerror',e=>{report.errors.push(e.stack);save();});
 report.loadedSourceHashes={};page.on('response',async response=>{const url=response.url();if(!/\.(?:mjs|js)(?:\?|$)/.test(url))return;try{report.loadedSourceHashes[url]=crypto.createHash('sha256').update(await response.body()).digest('hex');save();}catch{}});
 await page.goto(server.url+'?qa=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>__chevyV6Complete?.workshop?.loaded,null,{timeout:300000});
 await page.evaluate(()=>__chevyV6Complete.prepareCockpit());
 await page.evaluate(()=>__chevyV6Complete.startDrive('free'));
 await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='RUNNING');
 await page.evaluate(async()=>{await __cockpit.raceWorld.setDayCycleOptions({enabled:false},{persist:false}); __cockpit.raceSetCamera('chase'); let scene=__cockpit.raceWorld.getFalconVisualRoot();while(scene.parent)scene=scene.parent; const before=scene.onBeforeRender;scene.onBeforeRender=function(renderer,s,camera,...args){globalThis.__captureScene={renderer,scene:this,camera};before?.call(this,renderer,s,camera,...args);};});
 await page.waitForFunction(()=>!!globalThis.__captureScene);
 console.log('BOOT',server.url); save();
 for(const trackId of tracks) {
  await page.evaluate(async trackId=>{await __cockpit.raceSelectCircuit(trackId,{announce:false,skyId:'clear',weather:'clear'}); await __cockpit.raceStart();__cockpit.raceSetCamera('chase');},trackId);
  await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='RUNNING');
  const camera=await page.evaluate(trackId=>{
   const world=__cockpit.raceWorld, profiles=__asfaltoV6Modular.trackManager.active.visualRoot.userData.asfaltoRegionalCameras;
   const view=trackId==='cataratas_iguazu'?profiles.views[2]:(profiles.openingShot||profiles.views[1]);
   world.debugTeleportPhysicalVehicle({raceProgressM:view.sM});
   const T=__chevyV6Three,{scene,camera:main,renderer}=__captureScene;
   const custom=new T.PerspectiveCamera(48,16/9,.1,32000); custom.position.fromArray(view.position); custom.lookAt(...view.target); custom.layers.mask=main.layers.mask; custom.updateMatrixWorld(true);
   const previous=renderer.render;
   renderer.render=function(s,c){for(const name of ['ChevyV6PhysicalBody','CockpitChevyCompleto']){const obj=scene.getObjectByName(name);if(obj)obj.visible=false;}const falcon=world.getFalconVisualRoot();if(falcon)falcon.visible=false;return previous.call(this,s,s===scene&&c===main?custom:c);};
   globalThis.__restorePreviewCamera=()=>{renderer.render=previous;};
   return {position:custom.position.toArray(),quaternion:custom.quaternion.toArray(),target:view.target,fov:custom.fov,sM:view.sM};
  },trackId);
  const weathers=['clear','cloudy','rain','storm','fog',...(['cuesta_lipan','paso_garibaldi'].includes(trackId)?['light-snow','heavy-snow']:[])];
  for(const skyId of skies) for(const weather of weathers) {
   const key=[trackId,skyId,weather].join('--');
   await page.evaluate(async({skyId,weather})=>{await __cockpit.raceWorld.selectEnvironmentPreset(skyId,{announce:false,weather});await __cockpit.raceWorld.setDayCycleOptions({enabled:false},{persist:false});const a=__asfaltoV6Modular.trackManager.active;__cockpit.raceWorld.setAuthoredTrackVisuals({visualRoot:a.visualRoot,collisionRoot:a.collisionRoot,collisionProbe:a.collisionProbe},{replace:true});}, {skyId,weather});
   await page.waitForTimeout(1800);
   const data=await page.evaluate(async()=>{
    const world=__cockpit.raceWorld, {renderer}=__captureScene;
    // Build-time photograph: render the actual scene once at its authored route camera.
    // The normal advanced pipeline owns a cached draw function; a direct draw avoids
    // substituting a callback into that pipeline and makes framebuffer ownership explicit.
    const target=renderer.getRenderTarget();let image;
    try{renderer.setRenderTarget(null);renderer.render(__captureScene.scene,__captureScene.camera);image=renderer.domElement.toDataURL('image/jpeg',.88);}
    finally{renderer.setRenderTarget(target);}
    return {image,trackId:world.track.id,ui:world.getState().ui,environment:world.getEnvironmentDiagnostics(),weatherEffects:world.getWeatherEffectsDiagnostics(),cycle:world.getDayCycleDiagnostics(),capturedAt:new Date().toISOString()};
   });
   if(data.trackId!==trackId||data.ui.skyId!==skyId||data.ui.weather!==weather||data.environment.regionalEnvironment?.weatherId!==weather||data.environment.environmentSource!==(skyId==='golden-hour'?'golden':skyId)||data.environment.regionalEnvironment?.skyId!==skyId||data.cycle.active) throw new Error('Resolved selection mismatch '+key);
   const file='exact-'+key+'.webp';
   const bytes=await sharp(Buffer.from(data.image.split(',')[1],'base64')).resize(960,540).webp({quality:78}).toBuffer();
   if(bytes.length>160000)throw new Error('Image size cap exceeded '+key);
   fs.writeFileSync(path.join(assets,file),bytes);
   const metadata={file,trackId,skyId,weather,camera,cameraMode:'regional-exact-48deg',capturedAt:data.capturedAt,source:'actual-v7-renderer',renderPath:'on-demand scene photograph, actual route geometry/materials/lights/sky/weather, no postprocessing camera pass',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
   catalog.previews[key]=metadata;
   report.captures.push({...metadata,key,resolved:{trackId:data.trackId,skyId:data.ui.skyId,weather:data.ui.weather},environment:data.environment,weatherEffects:data.weatherEffects,cycle:data.cycle});
   save();fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');console.log('CAPTURE',report.captures.length,'/174',key,bytes.length);
  }
  await page.evaluate(()=>__restorePreviewCamera());
 }
 report.complete=report.captures.length===174; report.finishedAt=new Date().toISOString();save();
} catch(error) {report.fatal=error.stack; save();throw error;} finally {await browser?.close(); await server.close();console.log('CLOSED');}
