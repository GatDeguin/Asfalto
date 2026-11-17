import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';

const root=new URL('../',import.meta.url);
const source=await fs.readFile(new URL('src/app/modular-bootstrap.mjs?v=bb4a6cb95c850d35',root),'utf8');
function bootstrap({missingDescriptor=false}={}){
 const requests=[];
 const context=vm.createContext({URL,AbortController,performance,
  createTrackManager:({registry})=>({select:async id=>{assert.ok(registry.tracks.some(track=>track.id===id));return{id,ready:true};}}),
  fetch:async url=>{
   const relative=new URL(url).pathname.slice('/game/'.length);requests.push(relative);
   // The full audit inventory is deliberately unavailable in an offline runtime.
   if(relative==='assets/manifests/release.json'||missingDescriptor&&relative==='assets/manifests/runtime.json')return{ok:false,status:404};
   try{const body=await fs.readFile(new URL(relative,root),'utf8');return{ok:true,json:async()=>JSON.parse(body)};}catch{return{ok:false,status:404};}
  },
 });
 const runnable=source.replace(/^import .+;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://asfalto.test/game/src/app/modular-bootstrap.mjs')).replaceAll('export function ','function ').replace(/^export \{[^}]+\};?\s*$/gm,'');
 vm.runInContext(runnable,context);
 return{requests,context,connect:()=>vm.runInContext('connectModularHost({trackId:"dos_lagos"})',context)};
}
test('offline modular boot selects the circuit without fetching the full audit inventory',async()=>{
 const app=bootstrap();const adapter=await app.connect();
 assert.equal(adapter.id,'dos_lagos');assert.equal(adapter.ready,true);
 assert.ok(app.requests.includes('tracks/registry.json'));
 assert.ok(app.requests.includes('assets/manifests/runtime.json'));
 assert.equal(app.requests.includes('assets/manifests/release.json'),false);
 assert.equal(app.context.__asfaltoV6Modular.getDiagnostics().releaseSchema,'asfalto-nacional-v8-modular-release/v1');
});
test('a genuinely missing runtime descriptor still rejects boot with a useful diagnostic',async()=>{
 const app=bootstrap({missingDescriptor:true});
 await assert.rejects(app.connect(),/runtime descriptor request failed: 404/);
 assert.equal(app.context.__asfaltoV6Modular.getDiagnostics().bootStatus,'failed');
});
test('the real PWA builder packages both boot JSON dependencies and retains the descriptor in its shell',async t=>{
 const temporaryRoot=await fs.realpath(os.tmpdir());
 const fixture=await fs.mkdtemp(path.join(temporaryRoot,'asfalto-offline-boot-'));
 t.after(async()=>{assert.equal(path.dirname(await fs.realpath(fixture)),temporaryRoot);await fs.rm(fixture,{recursive:true,force:true});});
 const inputs=new Map([
  ['index.html','<!doctype html><link rel="manifest" href="manifest.webmanifest">'],
  ['manifest.webmanifest','{"name":"Offline boot fixture"}'],['apple-touch-icon.png','fixture'],
  ['assets/manifests/release.json','{"auditOnly":true}'],
 ]);
 for(const name of ['tracks/registry.json','assets/manifests/runtime.json','src/runtime/pwa-worker.js'])inputs.set(name,await fs.readFile(new URL(name,root)));
 for(const [name,bytes] of inputs){const target=path.join(fixture,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);}
 const built=spawnSync(process.execPath,[fileURLToPath(new URL('tools/build-pwa.mjs',root)),'--root',fixture],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr||built.stdout);
 const worker=await fs.readFile(path.join(fixture,'sw.js'),'utf8');
 const release=JSON.parse(/^const ASFALTO_PWA_RELEASE=(.+);$/m.exec(worker)[1]);
 for(const name of ['tracks/registry.json','assets/manifests/runtime.json']){
  const file=release.files.find(file=>file.path===name);
  assert.ok(file,`Missing offline boot dependency: ${name}`);
  const bytes=await fs.readFile(new URL(name,root));
  assert.equal(file.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(file.bytes,bytes.length);
  if(name.endsWith('runtime.json'))assert.equal(file.shell,true);
 }
 assert.equal(release.files.some(file=>file.path==='assets/manifests/release.json'),false,'Keep full inventory out of the recursive worker hash graph');
});
