import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs?v=5a11a063822d96e9';

const [output,...options]=process.argv.slice(2);
assert.ok(output,'Indica un directorio externo para la evidencia.');
const selected=options.find(arg=>!arg.startsWith('--'));
const drawDetail=options.includes('--draw-detail');
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
await fs.mkdir(output,{recursive:true});
const root=fileURLToPath(new URL('../',import.meta.url));
const tracks=[['dos_lagos','clear'],['aconcagua_horcones','clear'],['cuesta_lipan','light-snow'],['paso_garibaldi','light-snow'],['cataratas_iguazu','rain']];
assert.ok(!selected||tracks.some(([id])=>id===selected),'Circuito desconocido.');
const server=await startServer({root});
const report={tracks:[],errors:[],httpErrors:[],viewport:[1280,800]};
const save=()=>fs.writeFile(path.join(output,'sweep.json'),JSON.stringify(report,null,2)+'\n');
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
 report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.setDefaultTimeout(180_000);
 const sceneRequests=[];
 page.on('request',request=>{
  const pathname=new URL(request.url()).pathname;
  if(/^\/tracks\/[^/]+\/scene\.glb$/.test(pathname))sceneRequests.push(pathname);
 });
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',r=>{if(r.status()>=400)report.httpErrors.push([r.status(),new URL(r.url()).pathname]);});
 await page.addInitScript(()=>{
  localStorage.setItem('asfalto:v7:@migration-v1','complete');
  localStorage.setItem('asfalto:recovery:v8-v7:complete','complete');
  localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6',JSON.stringify({transmissionMode:'automatic'}));
  globalThis.__long=[];new PerformanceObserver(list=>{for(const e of list.getEntries())__long.push([e.startTime,e.duration]);}).observe({type:'longtask'});
 });
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__chevyV6Complete?.initialized);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>__chevyV6Complete.workshop.loaded&&document.querySelector('#loading')?.hidden);
 for(const [id,weather] of tracks.filter(([id])=>!selected||id===selected)){
  const row={id,weather};report.tracks.push(row);
  console.log('Cargando '+id+' '+weather);
  try{
   await page.locator('[data-v6-panel=drive]').click();
   await page.locator('[data-an-mode=drive]').click();
   await page.locator('#v6-drive-route').selectOption(id);
   await page.locator('#v6-drive-weather').selectOption(weather);
   const firstSceneRequest=sceneRequests.length;
   const started=performance.now();
   await page.locator('#v6-drive-start').click();
   await page.waitForFunction(id=>globalThis.__cockpit?.raceWorld?.track.id===id&&__cockpit.raceWorld.state.status==='RUNNING'&&document.body.classList.contains('v6-driving'),id);
   row.entryMs=performance.now()-started;
   row.sceneRequests=sceneRequests.slice(firstSceneRequest);
   if(selected)assert.deepEqual(row.sceneRequests,[`/tracks/${id.replaceAll('_','-')}/scene.glb`],'La primera salida debe cargar directamente la escena elegida.');
   const before=await page.evaluate(()=>{__cockpit.raceSetCamera('chase');return __cockpit.v7Presentation.diagnostics().actualSceneFrames;});
   await page.waitForFunction(before=>__cockpit.v7Presentation.diagnostics().actualSceneFrames>before+10,before,{timeout:25_000});
   await page.keyboard.down('w');
   try{
    row.drive=await page.evaluate(async()=>{
     const cockpit=__cockpit,world=cockpit.raceWorld,start=performance.now(),s=world.state.raceProgress,initial=cockpit.v7Presentation.diagnostics().actualSceneFrames;
     cockpit.v7BeginMeasurement();
     let previous=start;const intervals=[];
     while(previous-start<10_000){
      const at=await new Promise(requestAnimationFrame);
      if(at>=previous){intervals.push(at-previous);previous=at;}
     }
     const d=cockpit.v7RenderDiagnostics(),ordered=intervals.sort((a,b)=>a-b);
     return {progressM:world.state.raceProgress-s,status:world.state.status,sceneFps:(d.actualSceneFrames-initial)*1000/(previous-start),rafP95:ordered[Math.ceil(ordered.length*.95)-1],rafMax:ordered.at(-1),gpuP95:d.gpu.p95GpuMs,draws:d.render.calls,triangles:d.render.triangles,tier:world.getPerformanceTier(),buffer:d.drawingBuffer,preparation:d.preparation,longTasks:__long.filter(([at])=>at>=start&&at<=previous)};
    });
   }finally{await page.keyboard.up('w');}
   assert.ok(row.drive.progressM>3&&row.drive.status==='RUNNING','Keyboard must move the physical car.');
   if(drawDetail){
    row.renderDetail=await page.evaluate(async()=>{
     const raw=__asfaltoRenderHost.renderer,draw=raw.renderBufferDirect,byKind={},start=__cockpit.v7Presentation.diagnostics().actualSceneFrames;
     const root=__asfaltoV6Modular.trackManager.active.visualRoot;
     const graph={instanced:0,total:0,source:root.userData.asfaltoIguazu};
     root.traverse(o=>{if(o.isMesh)graph.total++;if(o.isInstancedMesh)graph.instanced++;});
     raw.renderBufferDirect=function(c,s,g,m,o,group){
      const type=(o.name.match(/^(IGUAZU_SOURCE|IGUAZU_RETURN|IGUAZU_BANK|[A-Z]+)_/)||[])[1]||'other';
      const pass=raw.getRenderTarget()?.texture?.name||'default';
      const entry=(byKind[pass]??={})[type]??={draws:0,instances:0};
      entry.draws++;entry.instances+=o.isInstancedMesh?o.count:1;
      return draw.call(this,c,s,g,m,o,group);
     };
     try{while(__cockpit.v7Presentation.diagnostics().actualSceneFrames-start<6)await new Promise(requestAnimationFrame);}
     finally{raw.renderBufferDirect=draw;}
     return {graph,byKind};
    });
   }
   await page.screenshot({path:path.join(output,id+'.png'),timeout:45_000});
   await page.keyboard.press('Escape');
   await page.locator('[data-pause-action=resume]').click();
   await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='RUNNING');
   await page.keyboard.press('Escape');
   await page.locator('[data-pause-action=workshop]').click();
   await page.waitForFunction(()=>__chevyV6Complete.workshop.active&&document.body.classList.contains('v6-menu-open'));
   row.pass=true;console.log(id+' '+JSON.stringify(row.drive));
  }catch(error){
   row.error=error.stack;
   row.failureFrame=await page.evaluate(()=>globalThis.__cockpit?.v7RenderDiagnostics()).catch(()=>null);
   await page.screenshot({path:path.join(output,id+'-fallo.png'),timeout:10_000}).catch(()=>{});
   await save();throw error;
  }
  await save();
 }
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.httpErrors,[]);
}finally{
 await save();
 await browser?.close();
 await server.close();
}
