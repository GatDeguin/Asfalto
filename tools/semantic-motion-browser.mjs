import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startServer} from '../server.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({chromium} = require('playwright')); }
catch { ({chromium} = createRequire(process.env.ASFALTO_PLAYWRIGHT_PACKAGE || 'C:/Users/Gaston/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright')); }
const mode = process.argv[2] || 'contracts';
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(root, '../Reports/Asfalto_Nacional_v8/motion-semantico-2026-10-03', mode);
await fs.mkdir(output, {recursive:true});
const report = {mode, startedAt:new Date().toISOString(), checks:[], pageErrors:[], externalRequests:[], measurements:[]};
const server = await startServer({root});
const browser = await chromium.launch({headless:true, executablePath:process.env.CHEVY_CHROME_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--use-angle=d3d11']});
report.environment = {node:process.version, browser:browser.version(), os:process.platform, headless:true, angle:'d3d11'};
const context = await browser.newContext(mode==='touch' ? {viewport:{width:390,height:844},isMobile:true,hasTouch:true} : {viewport:{width:1280,height:800}});
const page = await context.newPage();
page.setDefaultTimeout(120000);
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('request', request => {if(!request.url().startsWith(server.url) && /^https?:/.test(request.url())) report.externalRequests.push(request.url());});
const check = (name, value) => {assert.ok(value, name); report.checks.push(name);};
const saveShot = async name => {await page.screenshot({path:path.join(output, name+'.png')});};
const settled = () => page.waitForFunction(() => !document.getAnimations().some(a => a.effect?.target?.closest?.('#v6-menu-content,.an-race-pause,.an-vehicle-plate') && a.playState==='running'));

async function fixture() {
  await page.route('**/motion-contract-fixture', route => route.fulfill({contentType:'text/html', body:`<!doctype html><html lang="es"><head><link rel="stylesheet" href="/assets/styles/race-pause-menu.css"><link rel="stylesheet" href="/assets/styles/semantic-motion.css"></head><body><button id="origin">Pausa</button><script type="module">import {createRacePauseMenu} from '/src/menu/race-pause-menu.mjs'; window.calls=[];window.pause=createRacePauseMenu({onResume:()=>calls.push('resume'),onRestart:()=>calls.push('restart')});window.ready=true;</script></body></html>`}));
  await page.goto(server.url+'motion-contract-fixture');
  await page.waitForFunction(() => window.ready);
}

async function cssPolicy() {
  await fixture();
  await page.evaluate(async()=>{
    pause.dispose();
    for(const href of ['/assets/styles/menu-presentation.css','/assets/styles/menu-refinements.css','/assets/styles/loading-presentation.css']) {
      const link=document.createElement('link');link.rel='stylesheet';link.href=href;
      const loaded=new Promise(resolve=>link.onload=resolve);document.head.append(link);await loaded;
    }
    const root=document.createElement('section');root.id='v6-main-menu';root.className='an-cinematic-menu';
    root.innerHTML='<button class="v6-nav-btn">Conducir</button><button class="an-panel-back">Volver</button><div class="an-engine-panel" aria-busy="true"><p class="an-engine-status">Preparando motor</p></div>';
    document.body.append(root);
    const host=document.createElement('section');host.className='an-cinema-loading';host.hidden=true;host.id='css-loading-probe';document.body.append(host);
  });
  const failures=[];
  const expect=(name,value)=>{if(value)report.checks.push(name);else failures.push(name);};
  for(const selector of ['.v6-nav-btn','.an-panel-back']) {
    await page.locator(selector).hover();await page.mouse.down();
    expect('objetivo quieto al presionar '+selector,await page.locator(selector).evaluate(n=>getComputedStyle(n).transform==='none'));
    await page.mouse.up();
  }
  for(const preference of ['an-v7-reduce-motion','v6-reduce-motion']) {
    await page.evaluate(preference=>document.body.classList.add(preference),preference);
    expect('pseudo-elemento estático con '+preference,await page.locator('.an-engine-status').evaluate(n=>getComputedStyle(n,'::before').animationName==='none'));
    expect('host de carga estático con '+preference,await page.locator('#css-loading-probe').evaluate(n=>getComputedStyle(n).transitionDuration==='0s'));
    await page.evaluate(preference=>document.body.classList.remove(preference),preference);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  expect('pseudo-elemento estático con sistema',await page.locator('.an-engine-status').evaluate(n=>getComputedStyle(n,'::before').animationName==='none'));
  check('política CSS completa: '+failures.join(', '),failures.length===0);
}

async function contracts() {
  await fixture();
  await page.locator('#origin').focus();
  await page.evaluate(() => pause.show({sessionLabel:'Dos Lagos · Práctica'}));
  check('entrada de pausa con transición activa', await page.evaluate(() => document.getAnimations().some(a => a.playState==='running')));
  check('foco inmediato en Continuar', await page.locator('[data-pause-action=resume]').evaluate(n => n===document.activeElement));
  check('fondo inerte desde el primer frame', await page.locator('#origin').evaluate(n => n.inert));
  await page.locator('[data-pause-action=restart]').click();
  check('confirmación segura recibe foco', await page.locator('[data-pause-action=cancel]').evaluate(n => n===document.activeElement));
  check('no reinicia por terminar animación', await page.evaluate(() => calls.length===0));
  await page.keyboard.press('Escape');
  check('Escape invierte confirmación sin reanudar', await page.evaluate(() => pause.isOpen() && calls.length===0));
  await page.keyboard.press('Escape');
  check('Escape reanuda una sola vez y restaura foco', await page.evaluate(() => calls.join() === 'resume' && document.activeElement.id==='origin' && !document.querySelector('#origin').inert));
  for(const fraction of [0,.5,.98]) {
    await page.evaluate(fraction => {pause.show();for(const a of document.getAnimations()){a.pause();a.currentTime=a.effect.getTiming().duration*fraction;}pause.hide();}, fraction);
    check('interrupción de pausa a '+fraction, await page.evaluate(() => !pause.isOpen() && document.getAnimations().length===0 && calls.length===1));
  }
  await page.evaluate(() => {for(let i=0;i<20;i++){pause.show();pause.hide();}});
  await settled();
  check('20 ciclos sin animaciones, callbacks ni duplicados', await page.evaluate(() => document.getAnimations().length===0 && document.querySelectorAll('.an-race-pause').length===1 && calls.length===1));
  await page.evaluate(() => pause.show());
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => document.getAnimations().length===0);
  check('preferencia del sistema cancela durante entrada', await page.evaluate(() => pause.isOpen() && document.activeElement.dataset.pauseAction==='resume'));
  await page.evaluate(() => {pause.hide();pause.show();});
  check('entrada reducida estática y utilizable', await page.evaluate(() => document.getAnimations().length===0 && pause.isOpen()));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(() => {pause.hide();pause.show();document.body.classList.add('an-v7-reduce-motion');});
  await page.waitForFunction(() => document.getAnimations().length===0);
  check('preferencia de la aplicación cancela durante entrada', true);
  await page.evaluate(() => {pause.hide();document.body.classList.remove('an-v7-reduce-motion');const native=Element.prototype.animate;Element.prototype.animate=undefined;pause.show();Element.prototype.animate=native;});
  check('fallback sin WAAPI preserva controles', await page.evaluate(() => pause.isOpen() && document.getAnimations().length===0));
  await page.evaluate(() => {pause.hide();pause.show();pause.dispose();});
  check('desmontaje limpia animación y restaura fondo', await page.evaluate(() => document.getAnimations().length===0 && !document.querySelector('.an-race-pause') && !document.querySelector('#origin').inert));
  await page.evaluate(async () => {
    const {createRacePauseMenu}=await import('/src/menu/race-pause-menu.mjs');
    for(let i=0;i<20;i++){const instance=createRacePauseMenu();instance.show();instance.dispose();}
  });
  check('20 montajes y desmontajes sin diálogo ni animación residual', await page.evaluate(() => document.querySelectorAll('.an-race-pause').length===0 && document.getAnimations().length===0 && !document.querySelector('#origin').inert));
  check('sin errores de promesas canceladas', report.pageErrors.length===0);
}

async function measure(label) {
  report.measurements.push(await page.evaluate(async label => {
    const entries=[]; const observer=new PerformanceObserver(list=>entries.push(...list.getEntries().map(e=>e.duration)));
    observer.observe({type:'longtask',buffered:false});
    const frames=[];let previous=performance.now(),start=previous;
    const clickTimes=[];
    for(const panel of ['tests','settings','competition','tests','drive','settings']) {
      const before=performance.now();document.querySelector(`[data-v6-panel="${panel}"]`).click();clickTimes.push(performance.now()-before);
      const until=performance.now()+400;
      while(performance.now()<until){const now=await new Promise(requestAnimationFrame);frames.push(now-previous);previous=now;}
    }
    observer.disconnect();frames.sort((a,b)=>a-b);
    return {label,viewport:[innerWidth,innerHeight],sceneActive:__chevyV6Complete.workshop.active,durationMs:performance.now()-start,frames:frames.length,frameP50Ms:frames[Math.floor(frames.length*.5)],frameP95Ms:frames[Math.floor(frames.length*.95)],maxFrameMs:frames.at(-1),framesOver34Ms:frames.filter(n=>n>34).length,longTasks:entries.length,longTaskMs:entries.reduce((a,b)=>a+b,0),synchronousClickMaxMs:Math.max(...clickTimes)};
  }, label));
}

async function ready() {
  await page.goto(server.url+'?qa=1', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__chevyV6Complete?.initialized && window.__asfaltoMenuPresentation);
  await page.waitForFunction(() => __chevyV6Complete.workshop.loaded && document.querySelector('#loading')?.hidden);
  page.setDefaultTimeout(30000);
  console.log('Aplicación lista: '+mode);
}

async function touch() {
  await ready();
  check('entrada táctil emulada',await page.evaluate(()=>navigator.maxTouchPoints>0));
  await page.locator('[data-v6-panel=tests]').tap();await settled();
  await page.locator('[data-test-id=m500]').tap();
  check('tacto selecciona datos correctos',await page.evaluate(()=>__chevyV6Complete.profile().selectedTest==='m500' && document.querySelector('#an-test-title').textContent.includes('500')));
  await page.locator('.an-panel-back').tap();
  await page.locator('[data-v6-panel=drive]').tap();
  await page.locator('[data-an-mode=drive]').tap();await settled();
  check('tacto llega a preparación de salida',await page.locator('#v6-drive-start').isVisible());
  await page.setViewportSize({width:844,height:390});
  await saveShot('touch-preparation-landscape');
  await page.locator('.an-panel-back').tap();await page.locator('.an-panel-back').tap();
  check('tacto regresa al menú',await page.evaluate(()=>__asfaltoMenuPresentation.getState().view==='home'));
  check('sin errores JS',report.pageErrors.length===0);
}

async function driving() {
  await ready();
  await page.locator('[data-v6-panel=drive]').click();
  await page.locator('[data-an-mode=drive]').click();
  await page.locator('#v6-drive-start').click();
  console.log('Salida real solicitada, esperando runtime de carrera');
  await page.waitForFunction(()=>globalThis.__cockpit?.ready && __cockpit.raceWorld.state.status==='RUNNING' && document.body.classList.contains('v6-driving'),null,{timeout:180000});
  check('salida real llega a RUNNING',true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='PAUSED' && __asfaltoRacePresentation.isOpen());
  check('pausa detiene física antes del reposo visual',await page.evaluate(()=>__cockpit.raceWorld.state.status==='PAUSED'));
  await settled();await saveShot('race-pause');
  await page.locator('[data-pause-action=restart]').click();
  await page.locator('[data-pause-action=cancel]').click();
  check('cancelar reinicio conserva carrera pausada',await page.evaluate(()=>__cockpit.raceWorld.state.status==='PAUSED' && __asfaltoRacePresentation.isOpen()));
  await page.locator('[data-pause-action=resume]').click();
  await page.waitForFunction(()=>__cockpit.raceWorld.state.status==='RUNNING');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__asfaltoRacePresentation.isOpen());
  check('pausa reducida conserva misma física y foco',await page.evaluate(()=>__cockpit.raceWorld.state.status==='PAUSED' && document.activeElement.dataset.pauseAction==='resume' && !document.getAnimations().some(a=>a.effect?.target?.closest?.('.an-race-pause'))));
  await page.locator('[data-pause-action=workshop]').click();
  await page.waitForFunction(()=>document.body.classList.contains('v6-menu-open'));
  await settled();
  check('regreso al taller cierra pausa y conserva vehículo',await page.evaluate(()=>!__asfaltoRacePresentation.isOpen() && __chevyV6Complete.workshop.vehicleId==='chevrolet_1969'));
  check('sin errores JS',report.pageErrors.length===0);
}

async function app() {
  await ready();
  report.stack = await page.evaluate(() => ({three:__chevyV6Complete.workshop.T.REVISION,vehicle:__chevyV6Complete.workshop.vehicleId,tests:document.querySelectorAll('[data-test-id]').length,nav:document.querySelectorAll('.v6-nav-btn').length}));
  await saveShot('home');
  await measure('full-game-menu');
  await page.locator('[data-v6-panel=tests]').click();
  await settled();
  await saveShot('tests-stable');
  if(mode==='baseline')return;
  check('entrada integrada conservó el perfil', await page.evaluate(() => __chevyV6Complete.profile().lastPanel==='tests'));
  await page.evaluate(() => {document.querySelector('[data-v6-panel=settings]').click();document.querySelector('[data-v6-panel=tests]').click();});
  check('última intención mantiene sección correcta', await page.evaluate(() => document.querySelector('#v6-main-menu').dataset.anPanel==='tests'));
  await settled();
  await page.evaluate(() => {document.querySelector('[data-v6-panel=settings]').click();const animations=document.getAnimations();for(const a of animations)if(a.effect?.target?.closest?.('#v6-menu-content')){a.pause();a.currentTime=0;}});
  check('transición de sección conectada a evento real', await page.evaluate(()=>document.getAnimations().some(a=>a.effect?.target?.closest?.('#v6-menu-content') && a.playState==='paused')));
  await saveShot('section-start');
  await page.evaluate(() => {for(const a of document.getAnimations())if(a.effect?.target?.closest?.('#v6-menu-content'))a.currentTime=a.effect.getTiming().duration/2;});
  await saveShot('section-middle');
  await page.evaluate(() => {for(const a of document.getAnimations())if(a.effect?.target?.closest?.('#v6-menu-content'))a.play();});
  await settled();await saveShot('section-end');
  console.log('Sección inspeccionable en inicio, mitad y final');
  await page.locator('[data-v6-panel=tests]').click();await settled();
  const testCards=page.locator('[data-test-id]:not(.v6-locked)');
  await testCards.nth(1).click();
  check('detalle corresponde a selección real', await page.evaluate(() => document.querySelector('#an-test-title').textContent===document.querySelector('[data-test-id][aria-selected=true] h3').textContent));
  console.log('Selección de prueba verificada');
  await page.evaluate(() => {document.querySelector('[data-test-id=accel100]').click();document.querySelector('[data-v6-panel=settings]').click();});
  check('navegar cancela detalle saliente', await page.evaluate(() => !document.getAnimations().some(a=>a.effect?.target?.closest?.('.an-test-info'))));
  await page.emulateMedia({reducedMotion:'reduce'});
  await settled();
  check('política reducida cancela WAAPI integrada',await page.evaluate(()=>!document.getAnimations().some(a=>a.effect?.target?.closest?.('#v6-menu-content'))));
  await page.locator('.an-panel-back').click();
  for(const panel of ['drive','tests','competition','workshop','collection','settings']){await page.locator(`[data-v6-panel=${panel}]`).click();check('recorrido reducido '+panel, await page.evaluate(panel=>document.querySelector('#v6-main-menu').dataset.anPanel===panel, panel));await page.locator('.an-panel-back').click();}
  console.log('Seis secciones operables en movimiento reducido');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{for(let i=0;i<20;i++){document.querySelector('[data-v6-panel=tests]').click();__asfaltoMenuPresentation.onBack();}});
  await settled();
  check('20 idas y vueltas sin recursos visuales activos', await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest?.('#v6-menu-content,.an-vehicle-plate')).length===0));
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-v6-panel=tests]').click();
  await page.setViewportSize({width:844,height:390});await settled();await saveShot('phone-landscape');
  await page.setViewportSize({width:390,height:844});await settled();await saveShot('phone-portrait');
  check('sin desborde horizontal del documento', await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.an-panel-back').click();
  await page.keyboard.press('Tab');check('teclado conserva foco visible',await page.evaluate(()=>document.activeElement.getClientRects().length>0));
  report.finalMenuState=await page.evaluate(()=>__asfaltoMenuPresentation.getState());
  check('sin errores JS',report.pageErrors.length===0);
}

try {if(mode==='contracts')await contracts();else if(mode==='css')await cssPolicy();else if(mode==='touch')await touch();else if(mode==='driving')await driving();else await app();report.status='pass';}
catch(error){report.status='fail';report.failure=error.stack;process.exitCode=1;}
finally {await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await server.close();console.log(JSON.stringify(report,null,2));}
