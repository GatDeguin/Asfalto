
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {encodeBinaryBake,BAKE_SCHEMA} from '../src/tracks/visuals/bake-binary-codec.mjs?v=9a206fac5b81dd7a';
import {prepareBinaryPayload} from './bake-tooling.mjs?v=08383d8a84ffdff4';
import {startServer} from '../server.mjs?v=a0bf97c66f8e1a23';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const referenceFlag=process.argv.indexOf('--reference');
const reference=referenceFlag<0?null:path.resolve(process.argv[referenceFlag+1]);
if(reference)fs.mkdirSync(reference,{recursive:true});
const out=path.join(root,'assets/tracks/offline-bake');fs.mkdirSync(out,{recursive:true});
const manifest={schema:BAKE_SCHEMA,tracks:{},inputs:{}};
for(const file of ['src/tracks/visuals/closure-terrain.mjs?v=f318411546da8c34','src/tracks/visuals/terrain-refinement.mjs?v=b7edee06e0b828be','src/tracks/visuals/forest-terrain-detail.mjs?v=9535a171be7c3c52','src/render/surface-curvature.mjs?v=22c58be495958005'].map(file=>file.split('?')[0]))manifest.inputs[file]=createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
for(const e of JSON.parse(fs.readFileSync(path.join(root,'tracks/registry.json'))).tracks){const file=path.join('tracks',e.manifest);if(fs.existsSync(path.join(root,file)))manifest.inputs[file]=createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');}
const server=await startServer({root});let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-angle=d3d11']});
 const page=await browser.newPage();page.setDefaultTimeout(300000);
 page.on('pageerror',e=>console.error('PAGE',e.message));
 await page.addInitScript(()=>{globalThis.__ASFALTO_CAPTURE_BAKE__=true;});
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.__chevyV6Complete?.initialized);await page.keyboard.press('Escape');
 await page.waitForFunction(()=>globalThis.__chevyV6Complete?.workshop?.loaded);
 console.log('BOOT');await page.evaluate(()=>__chevyV6Complete.startDrive('free'));
 await page.waitForFunction(()=>globalThis.__asfaltoV6Modular?.trackManager?.active?.ready);
 for(const id of ['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu']){
   const started=Date.now();console.log('BAKE',id);
   await page.evaluate(async id=>{const m=__asfaltoV6Modular.trackManager;if(m.active?.id!==id)await m.select(id);},id);
   const payload=await page.evaluate(async()=>{
     const {computeSurfaceCurvature}=await import('/src/render/surface-curvature.mjs');
     let budget=240000;const seen=new Set();__asfaltoV6Modular.trackManager.active.visualRoot.traverse(o=>{if(!o.isMesh||!o.geometry||seen.has(o.geometry))return;seen.add(o.geometry);const r=computeSurfaceCurvature(__chevyV6Three,o.geometry,{maxVertices:Math.min(80000,budget)});if(r.attribute)budget-=r.attribute.count;});
     return (await import('/src/tracks/visuals/offline-track-bake.mjs')).bakeCapture();
   });
   if(reference)fs.writeFileSync(path.join(reference,id+'.json.gz'),gzipSync(JSON.stringify(payload),{level:6}));
   const raw=Buffer.from(encodeBinaryBake(prepareBinaryPayload(payload))),compressed=gzipSync(raw,{level:9}),file=id+'.bake.gz';fs.writeFileSync(path.join(out,file),compressed);
   manifest.tracks[id]={file,bytes:compressed.length,decodedBytes:raw.length,sha256:createHash('sha256').update(compressed).digest('hex'),entries:payload.entries.length};
   fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('SAVED',id,compressed.length,raw.length,Date.now()-started);
 }
}finally{await browser?.close();await server.close();}

