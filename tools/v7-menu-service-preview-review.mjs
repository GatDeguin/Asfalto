import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/Gaston/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('Reports/Asfalto_Nacional_v7/menu-service-preview-2026-09-12');fs.mkdirSync(out,{recursive:true});
const {startServer}=await import('../server.mjs?v=photo-r1-20260916');const server=await startServer({root:path.resolve('Asfalto_Nacional_v7'),port:0,cockpitDataDirectory:path.join(out,'isolated-data')});
const report={startedAt:new Date().toISOString(),errors:[],requests:[],checks:[],screenshots:[],loadedSourceHashes:{}};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));let browser;
try {
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--remote-debugging-port=9227']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(120000);
 page.on('response',async response=>{if(!/\.(?:mjs|js)(?:\?|$)/.test(response.url()))return;try{report.loadedSourceHashes[response.url()]=crypto.createHash('sha256').update(await response.body()).digest('hex');save();}catch{}});
 page.on('pageerror',error=>{report.errors.push(error.stack);save();});page.on('request',request=>{if(/\/exact-/.test(request.url()))report.requests.push(request.url());});
 await page.addInitScript(()=>{if(sessionStorage.getItem('ui-review-seeded'))return;const condition={engine:70,oil:84,brakes:100,tires:100,body:35,paint:40,fuel:0,steering:100,suspension:100,drivetrain:100,gearbox:100,dirt:80,damageZones:{front:.55,left:.2,right:0,rear:0,roof:0}};localStorage.setItem('asfalto:v7:chevy-serie2-v6-profile',JSON.stringify({version:6,workshopTokens:12,condition,appearance:{dirt:80},vehicleConditionsV7:{version:1,selectedVehicleId:'chevy',cars:{chevy:condition}}}));sessionStorage.setItem('ui-review-seeded','1');});
 await page.goto(server.url+'?qa=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__chevyV6Complete?.homeReady&&globalThis.__asfaltoWorkshopService,null,{timeout:300000});
 const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});report.screenshots.push(name+'.png');save();console.log('SCREENSHOT',name);};
 await shot('01-home');assert.equal(report.requests.length,0,'no route preview downloads on home');
 const pointer=await page.locator('.an-v7-quick-drive').evaluate(el=>{const r=el.getBoundingClientRect();return{pointerEvents:getComputedStyle(el).pointerEvents,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.an-v7-quick-drive')===el};});assert.equal(pointer.pointerEvents,'auto');assert.equal(pointer.hit,true);report.checks.push({quickDrive:pointer});
 await page.click('.an-v7-quick-drive');await page.waitForFunction(()=>{const root=document.querySelector('#v6-main-menu');return root.dataset.anPanel==='workshop'&&root.dataset.anView==='section'&&!document.querySelector('#v6-menu-content').hidden;},null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelectorAll('[data-v7-service]').length===12);
 assert.equal(await page.locator('[data-workshop-tab=condition]').getAttribute('aria-selected'),'true');await shot('02-workshop-fault');
 const before=await page.evaluate(()=>__chevyV6Complete.getVehicleServiceState());assert.equal(before.condition.fuel,0);assert.equal(before.canDrive,false);
 await page.locator('[data-v7-service=dirt]').click();await page.waitForFunction(()=>__chevyV6Complete.getVehicleServiceState().condition.dirt===0);
 const washed=await page.evaluate(()=>__chevyV6Complete.getVehicleServiceState());assert.equal(washed.condition.body,35);assert.equal(washed.condition.paint,40);assert.equal(washed.condition.fuel,0);assert.equal(washed.condition.damageZones.front,.55);assert.equal(await page.locator('[data-v7-service=dirt]').evaluate(el=>el.closest('article')===document.activeElement),true);
 await page.locator('[data-v7-service=fuel]').click();await page.waitForFunction(()=>__chevyV6Complete.getVehicleServiceState().condition.fuel===100);
 await page.locator('[data-v7-service=body]').click();await page.waitForFunction(()=>__chevyV6Complete.getVehicleServiceState().condition.body===100);
 const repaired=await page.evaluate(()=>__chevyV6Complete.getVehicleServiceState());assert.equal(repaired.condition.paint,40);assert.equal(repaired.condition.damageZones.front,0);assert.equal(repaired.condition.engine,70);assert.equal(repaired.canDrive,true);report.checks.push({before,washed,repaired});
 await page.locator('#v6-menu-content').evaluate(el=>el.scrollTop=0);await shot('03-workshop-serviced');
 for(const id of ['mechanics','chassis','tuning','appearance','history']){await page.locator(`[data-workshop-tab=${id}]`).click();await shot('04-workshop-'+id);}
 for(const id of ['tests','competition','collection','settings']){await page.locator(`[data-v6-panel=${id}]`).click();await shot('05-menu-'+id);}
 await page.click('[data-v6-panel=drive]');await shot('06-drive-modes');await page.click('[data-an-mode=drive]');
 await page.waitForFunction(()=>document.querySelector('#v6-drive-panel .an-route-preview').dataset.photoMatch==='exact');await shot('07-drive-preview');
 await page.evaluate(()=>{for(const[id,value]of [['v6-drive-sky','overcast'],['v6-drive-weather','storm'],['v6-drive-sky','night'],['v6-drive-route','paso_garibaldi'],['v6-drive-weather','light-snow'],['v6-drive-sky','golden-hour']]){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}});
 await page.waitForFunction(()=>document.querySelector('#v6-drive-panel .an-route-preview img').dataset.key==='paso_garibaldi--golden-hour--light-snow');
 const preview=await page.locator('#v6-drive-panel .an-route-preview').evaluate(el=>({match:el.dataset.photoMatch,key:el.querySelector('img').dataset.key,alt:el.querySelector('img').alt,naturalWidth:el.querySelector('img').naturalWidth}));assert.equal(preview.match,'exact');assert.equal(preview.naturalWidth,960);report.checks.push({rapidPreview:preview});await shot('08-rapid-exact-preview');
 await page.click('[data-v6-panel=workshop]');assert.equal(await page.locator('#v6-drive-panel .an-route-preview img').getAttribute('src'),null);report.checks.push({hiddenPreviewReleased:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await shot('09-mobile-workshop');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 const transition=await page.locator('[data-workshop-tab=condition]').evaluate(el=>getComputedStyle(el).transitionDuration);assert.equal(transition,'0s');report.checks.push({mobileOverflow:false,reducedMotion:transition});
 await page.setViewportSize({width:1440,height:900});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>globalThis.__chevyV6Complete?.homeReady,null,{timeout:300000});
 const persisted=await page.evaluate(()=>__chevyV6Complete.getVehicleServiceState());assert.equal(persisted.condition.body,100);assert.equal(persisted.condition.dirt,0);assert.equal(persisted.condition.paint,40);assert.equal(persisted.condition.fuel,100);report.checks.push({persisted});
 await page.evaluate(()=>{
  for(const [id,value] of [['v6-drive-route','cuesta_lipan'],['v6-drive-weather','clear'],['v6-drive-sky','clear']]){const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));}
  const cycle=document.querySelector('[data-race-day-cycle]');cycle.value='fixed';cycle.dispatchEvent(new Event('change',{bubbles:true}));
  globalThis.__menuTransitionTrace=[];globalThis.__menuTransitionTimer=setInterval(()=>{const world=globalThis.__cockpit?.raceWorld,state=world?.state,loading=document.querySelector('#an-session-loading');__menuTransitionTrace.push({at:performance.now(),held:!!globalThis.__asfaltoRacePresentationHeld,menuOpen:document.body.classList.contains('v6-menu-open'),loading:!!loading&&!loading.hidden,status:state?.status||null,countdown:state?.countdown??null,frame:globalThis.__cockpit?.v7Presentation?.diagnostics().frames??null,opening:globalThis.__cockpit?.raceOpeningDiagnostics()||null});},100);
 });
 await page.click('.an-v7-quick-drive');
 await page.waitForFunction(()=>globalThis.__cockpit?.raceWorld?.state?.status==='RUNNING'&&!globalThis.__asfaltoRacePresentationHeld&&!globalThis.__cockpit?.raceOpeningDiagnostics()?.blocking,null,{timeout:300000});
 report.transition=await page.evaluate(()=>{clearInterval(__menuTransitionTimer);return __menuTransitionTrace;});
 const heldCountdown=report.transition.filter(row=>row.held&&row.status==='COUNTDOWN');
 if(heldCountdown.length>1)assert.ok(Math.max(...heldCountdown.map(r=>r.countdown))-Math.min(...heldCountdown.map(r=>r.countdown))<.025,'countdown must not run under loading');
 assert.equal(report.transition.at(-1).menuOpen,false);report.finalEnvironment=await page.evaluate(()=>({trackId:__cockpit.raceWorld.track.id,environment:__cockpit.raceWorld.getEnvironmentDiagnostics(),cycle:__cockpit.raceWorld.getDayCycleDiagnostics()}));assert.equal(report.finalEnvironment.trackId,'cuesta_lipan');assert.equal(report.finalEnvironment.cycle.active,false);await shot('10-first-playable-frame');
 assert.deepEqual(report.errors,[],'browser runtime errors');report.complete=true;report.finishedAt=new Date().toISOString();save();
} catch(error){report.fatal=error.stack;save();throw error;}finally{await browser?.close();await server.close();}
