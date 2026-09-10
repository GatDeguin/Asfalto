import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {buildReleaseManifest as inspectSharedAssetContracts} from './asfalto_v7_asset_contracts.mjs';
export const RELEASE_ROOT=path.resolve(import.meta.dirname,'..');
export const REPORT_ROOT=path.resolve(import.meta.dirname,'../docs/v7/acceptance');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export async function environmentCases(root=RELEASE_ROOT){
 const module=await import(pathToFileURL(path.join(root,'src/environment/environment-profiles.mjs')).href),registry=await readJson(path.join(root,'tracks/registry.json'));
 const ids=registry.tracks.filter(t=>t.status==='ready').map(t=>t.id).sort();assert.deepEqual(ids,['aconcagua_horcones','cataratas_iguazu','cuesta_lipan','dos_lagos','paso_garibaldi']);assert.equal(module.ENVIRONMENT_PRESET_IDS.length,6);
 const cases=[];for(const trackId of ids){const choices=module.getWeatherOptionsForTrack(trackId),snow=['cuesta_lipan','paso_garibaldi'].includes(trackId);assert.equal(choices.length,snow?7:5);for(const weather of ['light-snow','heavy-snow'])assert.equal(choices.includes(weather),snow);for(const skyId of module.ENVIRONMENT_PRESET_IDS)for(const weatherId of choices){module.resolveEnvironment(trackId,skyId,weatherId);cases.push({trackId,skyId,weatherId});}}
 assert.equal(cases.length,174);return cases;
}
export async function buildReleaseManifest(root=RELEASE_ROOT){
 // Reuse the existing read-only GLB/route/sky integrity contracts, not the obsolete v6 acceptance coverage.
 const manifest=await inspectSharedAssetContracts(root),cases=await environmentCases(root);
 return {...manifest,schema:'asfalto-nacional-v7-modular-release/v1',schemaVersion:1,builder:'tools/validate_asfalto_v7_modular.mjs',selectionCases:cases.length,environmentCases:cases};
}
export async function writeReleaseManifest(root=RELEASE_ROOT){const manifest=await buildReleaseManifest(root);await fs.writeFile(path.join(root,'assets/manifests/release.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}
export async function validateRelease({root=RELEASE_ROOT,integrityOnly=false}={}){
 const bytes=await fs.readFile(path.join(root,'assets/manifests/release.json')),manifest=JSON.parse(bytes),expected=await buildReleaseManifest(root);assert.deepEqual(manifest,expected,'Release inventory is stale or altered');
 const digest=sha(bytes);
 if(!integrityOnly){
  const a=await readJson(path.join(REPORT_ROOT,'acceptance.json'));assert.equal(a.schema,'asfalto-v7-acceptance/v1');assert.equal(a.status,'pass');assert.equal(a.releaseSha256,digest);assert.equal(a.selectionCases,174);assert.equal(a.tracks,5);
  assert.deepEqual(a.errors,[]);assert.deepEqual(a.httpErrors,[]);assert.equal(a.localServerPassed,true);assert.equal(a.staticServerPassed,true);assert.equal(a.lifecycle.cycles,20);assert.equal(a.lifecycle.pendingOwnedResources,0);assert.ok(a.lifecycle.stabilizedGrowth<=.1);assert.equal(a.performance.runs.length,3);
  for(const run of a.performance.runs){assert.ok(run.drivingSeconds>=300);assert.equal(run.viewport.width,1920);assert.equal(run.viewport.height,1080);assert.equal(run.targetFps,60);assert.ok(run.frame.p95<=20);assert.ok(run.frame.p99<=33.3);assert.equal(run.reproducibleGameHitchesOver100Ms,0);}
  const ledger=await readJson(path.join(REPORT_ROOT,'improvement-ledger.json'));assert.equal(ledger.entries.length,100);assert.equal(new Set(ledger.entries.map(e=>e.id)).size,100);assert.ok(ledger.entries.every(e=>e.status==='verified'&&e.evidence.length),'All 100 points need actual acceptance evidence');
 }
 return {ok:true,scope:integrityOnly?'integrity-only':'full-acceptance',root,releaseSha256:digest,fileCount:manifest.fileCount,totalBytes:manifest.totalBytes,tracks:manifest.tracks.length,selectionCases:manifest.selectionCases};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 try{if(process.argv.includes('--write'))await writeReleaseManifest();console.log(JSON.stringify(await validateRelease({integrityOnly:process.argv.includes('--integrity-only')})));}catch(e){console.error(e.stack);process.exitCode=1;}
}
