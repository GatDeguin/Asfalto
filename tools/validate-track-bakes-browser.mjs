import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {startServer} from '../server.mjs?v=ec9ca3d30198bdb8';
const root=fileURLToPath(new URL('../',import.meta.url)),out=fileURLToPath(new URL('../../Reports/Asfalto_Nacional_v8/performance-2026-09-26/implementation/task-2-runtime-validation.json',import.meta.url));
const {chromium}=createRequire('C:/Users/Gaston/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const server=await startServer({root});let browser;const report={tracks:{},errors:[]};
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11']});const page=await browser.newPage();page.setDefaultTimeout(300000);page.on('pageerror',e=>{report.errors.push(e.message);console.error('PAGE',e.message);});page.on('crash',()=>console.error('PAGE CRASH'));const deadline=setTimeout(()=>{void browser.close();},300000);deadline.unref();
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.__chevyV6Complete?.initialized);await page.keyboard.press('Escape');await page.waitForFunction(()=>globalThis.__chevyV6Complete?.workshop?.loaded);console.log('BOOT');await page.evaluate(()=>__chevyV6Complete.startDrive('free'));await page.waitForFunction(()=>globalThis.__asfaltoV6Modular?.trackManager?.active?.ready);
 await page.evaluate(()=>{globalThis.requestAnimationFrame=()=>0;});
 for(const id of ['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu']){
  report.tracks[id]=await page.evaluate(async id=>{const api=await import('/src/tracks/visuals/offline-track-bake.mjs'),before=api.bakeDiagnostics(),start=performance.now(),manager=__asfaltoV6Modular.trackManager;await manager.select(id);const after=api.bakeDiagnostics();return {selectMs:performance.now()-start,bake:after,deltaHits:after.hits-before.hits,deltaMisses:after.misses-before.misses,route:Array.from({length:17},(_,i)=>manager.active.sampleRoute(manager.active.gameplay.length*i/16)),diagnostics:manager.active.getDiagnostics()};},id);
  fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(id,report.tracks[id].selectMs,report.tracks[id].bake);
 }
 // Real missing-artifact fallback on a fresh load, and direct hit/miss comparison for the default track.
 await page.evaluate(()=>{globalThis.__ASFALTO_DISABLE_BAKE__=true;});const start=Date.now();await page.evaluate(()=>__asfaltoV6Modular.trackManager.select('dos_lagos'));
 report.dosLagosUncachedMs=Date.now()-start;report.dosLagosUncachedRoute=await page.evaluate(()=>{const a=__asfaltoV6Modular.trackManager.active;return Array.from({length:17},(_,i)=>a.sampleRoute(a.gameplay.length*i/16));});
 await page.evaluate(async()=>{await __asfaltoV6Modular.trackManager.unload();globalThis.__ASFALTO_DISABLE_BAKE__=false;});const hitStart=Date.now();await page.evaluate(()=>__asfaltoV6Modular.trackManager.select('dos_lagos'));report.dosLagosCachedMs=Date.now()-hitStart;
 report.dosLagosCached=await page.evaluate(async()=>{const a=__asfaltoV6Modular.trackManager.active;return {bake:(await import('/src/tracks/visuals/offline-track-bake.mjs')).bakeDiagnostics(),route:Array.from({length:17},(_,i)=>a.sampleRoute(a.gameplay.length*i/16))};});
 report.routesEqual=JSON.stringify(report.dosLagosUncachedRoute)===JSON.stringify(report.dosLagosCached.route);fs.writeFileSync(out,JSON.stringify(report,null,2));console.log('COMPARISON',report.dosLagosUncachedMs,report.dosLagosCachedMs,report.routesEqual);
}finally{await browser?.close();await server.close();}
