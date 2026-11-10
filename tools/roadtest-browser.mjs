import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server.mjs?v=5a11a063822d96e9';

const output=process.argv[2];
assert.ok(output,'Indica un directorio externo para la evidencia.');
await mkdir(output,{recursive:true});
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const server=await startServer({root:fileURLToPath(new URL('../',import.meta.url))});
const report={viewport:[1280,800],checks:[],errors:[],httpErrors:[],samples:[]};
const save=()=>writeFile(path.join(output,'roadtest.json'),JSON.stringify(report,null,2)+'\n');
let browser,page;
function check(condition,label){
 assert.ok(condition,label);
 report.checks.push(label);
 console.log(label);
}

try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
 report.browser=browser.version();
 page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.setDefaultTimeout(180_000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.httpErrors.push([response.status(),new URL(response.url()).pathname]);});
 await page.addInitScript(()=>{
  localStorage.setItem('asfalto:v7:@migration-v1','complete');
  localStorage.setItem('asfalto:recovery:v8-v7:complete','complete');
  const key='asfalto:v7:cockpit-chevy-settings-v6';
  if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({transmissionMode:'automatic'}));
 });
 const enterWorkshop=async()=>{
  await page.waitForFunction(()=>globalThis.__chevyV6Complete?.initialized);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__chevyV6Complete.workshop.loaded&&document.querySelector('#loading')?.hidden);
 };
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await enterWorkshop();
 await page.locator('[data-v6-panel=tests]').click();
 await page.locator('[data-test-id=accel100]').focus();
 await page.keyboard.press('Enter');
 await page.locator('#v6-test-start').click();
 await page.waitForFunction(()=>globalThis.__chevyV6Complete?.sessionDiagnostics().roadTest?.phase==='armed');
 check(await page.evaluate(()=>__cockpit.raceWorld.getPhysicalObservationState().qa===false),'El intento oficial se armó desde reposo.');
 await page.keyboard.press('Escape');
 await page.locator('[data-pause-action=resume]').waitFor();
 await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='PAUSED');
 await page.locator('[data-pause-action=resume]').click();
 await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='RUNNING');
 check(await page.evaluate(()=>__chevyV6Complete.sessionDiagnostics().roadTest?.phase==='armed'),'La pausa conserva el intento armado.');

 await page.keyboard.down('w');
 try{
  const finished=await page.evaluate(async()=>{
   const api=__chevyV6Complete,world=__cockpit.raceWorld,started=performance.now(),samples=[];
   let next=started;
   while(performance.now()-started<45_000){
    const at=await new Promise(requestAnimationFrame),session=api.sessionDiagnostics(),state=world.state;
    if(at>=next){
     samples.push({atMs:at-started,phase:session.roadTest?.phase,speedKph:state.speedMps*3.6,progressM:state.raceProgress,lateralM:state.lateral,headingError:state.projection?.headingError,gear:state.physicsSnapshot?.gearbox?.gear,tier:world.getPerformanceTier()});
     next=at+500;
    }
    if(session.completed)return{session,samples};
   }
   return{session:api.sessionDiagnostics(),samples};
  });
  report.samples=finished.samples;
  report.session=finished.session;
 }finally{await page.keyboard.up('w');}
 check(report.session.roadTest?.phase==='completed','La entrada de teclado completó la prueba física.');
 const verdict=page.locator('#v6-results-verdict');
 await page.waitForFunction(()=>document.querySelector('#v6-results-verdict')?.textContent==='Prueba completada y resultado guardado.');
 check(await verdict.isVisible(),'El resultado muestra la confirmación del guardado.');
 report.receipts=await page.evaluate(()=>Object.values(__chevyV6Complete.profile().roadTestsV7?.receipts||{}));
 check(report.receipts.length===1&&report.receipts[0].testId==='accel100','El perfil contiene un solo recibo del 0–100.');
 const metrics=await page.locator('#v6-results-metrics').textContent();
 check(metrics.includes('Duración del intento')&&!metrics.includes('Tiempo final'),'La duración del intento está separada de la marca oficial.');
 check(await page.locator('#v6-results-main').textContent()===report.receipts[0].measurement.value.toFixed(3),'La marca visible coincide con el recibo físico.');
 await page.screenshot({path:path.join(output,'resultado.png'),timeout:45_000});
 await page.locator('#v6-results-workshop').click();
 await page.waitForFunction(()=>__chevyV6Complete.workshop.active&&document.body.classList.contains('v6-menu-open'));
 await page.reload({waitUntil:'domcontentloaded'});
 await enterWorkshop();
 const reloaded=await page.evaluate(()=>Object.values(__chevyV6Complete.profile().roadTestsV7?.receipts||{}));
 assert.deepEqual(reloaded,report.receipts);
 check(true,'El mismo recibo sigue disponible tras volver al taller y recargar.');
 check(report.errors.length===0&&report.httpErrors.length===0,'Sin excepciones de consola ni respuestas HTTP fallidas.');
}catch(error){
 report.failure=error.stack;
 if(page&&!page.isClosed()){
  await page.screenshot({path:path.join(output,'fallo.png'),timeout:15_000}).catch(()=>{});
 }
 throw error;
}finally{
 await save();
 await browser?.close();
 await server.close();
}
