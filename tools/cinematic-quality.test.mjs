import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {normalizeAdvancedGraphics,readAdvancedGraphics,installAdvancedGraphicsSettings,effectiveGraphicsQuality,ADVANCED_GRAPHICS_KEY} from '../src/render/advanced-graphics-settings.mjs';
import {createTrackPerformanceGovernor,maximumTierForGraphicsQuality,TRACK_RENDER_POLICIES} from '../src/performance/track-performance-governor.mjs';
import {screenLightingPolicy} from '../src/render/screen-space-lighting.mjs';
import {prepareRenderPolicies} from '../src/performance/render-warmup.mjs';
const payload=JSON.parse(fs.readFileSync(new URL('../assets/manifests/workshop-bootstrap.json',import.meta.url)));
const T=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64'));
const sample=(g,ms,n)=>{for(let i=0;i<n;i++)g.sample({frameMs:ms,frameWorkMs:ms/2,heapBytes:0,gpuTextures:0,gpuGeometries:0});};

test('Cinematic survives normalization and existing preferences keep their defaults',()=>{
 assert.equal(normalizeAdvancedGraphics({quality:'cinematic',ssgi:false}).quality,'cinematic');
 for(const quality of ['auto','high','balanced','low','off'])assert.equal(normalizeAdvancedGraphics({quality}).quality,quality);
 assert.equal(normalizeAdvancedGraphics(null).quality,'balanced');
 assert.equal(normalizeAdvancedGraphics({quality:'unknown'}).quality,'balanced');
 assert.equal(normalizeAdvancedGraphics({quality:'cinematic',ssgi:false}).ssgi,false);
});
test('requested/effective rank includes manual Cinematic and treats malformed requests conservatively',()=>{
 for(const cap of ['cinematic','high','balanced','low','off'])assert.equal(effectiveGraphicsQuality({quality:'cinematic'},cap),cap);
 assert.equal(effectiveGraphicsQuality({quality:'auto'},'cinematic'),'high');
 assert.equal(effectiveGraphicsQuality({quality:'off'},'cinematic'),'off');
 assert.equal(effectiveGraphicsQuality({quality:'bad'},'high'),'balanced');
});
test('settings persist Cinematic through existing storage, dispatch it and release listeners',()=>{
 const store=new Map([[ADVANCED_GRAPHICS_KEY,JSON.stringify({quality:'high',ssgi:false})]]);
 const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const handlers=new Map(),select={value:null,addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:(n,f)=>{assert.equal(handlers.get(n),f);handlers.delete(n);}},status={textContent:''};
 const root={querySelectorAll:s=>s.includes('-quality]')?[select]:[status]};
 const api=installAdvancedGraphicsSettings({root,storage,getDiagnostics:()=>({effectiveQuality:'high'})});
 assert.equal(api.getSettings().quality,'high');
 assert.equal(store.get(ADVANCED_GRAPHICS_KEY),JSON.stringify({quality:'high',ssgi:false}),'mount must not overwrite a preference');
 select.value='cinematic';handlers.get('change')({target:select});
 assert.equal(readAdvancedGraphics(storage).quality,'cinematic');assert.equal(api.getSettings().ssgi,false);
 assert.match(status.textContent,/Solicitado: Cinemática \/ Ultra · Efectivo: Alto/);
 api.dispose();api.dispose();assert.equal(handlers.size,0);
});
test('master performance cap respects manual Cinematic, Eco and Balanced; Auto is never promoted',()=>{
 assert.equal(maximumTierForGraphicsQuality('high','cinematic'),'cinematic');
 assert.equal(maximumTierForGraphicsQuality('auto','cinematic'),'cinematic');
 assert.equal(maximumTierForGraphicsQuality('balanced','cinematic'),'balanced');
 assert.equal(maximumTierForGraphicsQuality('eco','cinematic'),'low');
 assert.equal(maximumTierForGraphicsQuality('high','auto'),'high');
});
test('Cinematic degrades only after the slow window, recovers gradually, and cannot exceed manual cap',()=>{
 const changes=[],g=createTrackPerformanceGovernor({initialTier:'cinematic',maximumTier:'cinematic',onTierChange:v=>changes.push(v)});
 sample(g,22,239);assert.equal(g.tier(),'cinematic');sample(g,22,1);assert.equal(g.tier(),'high');
 sample(g,16,599);assert.equal(g.tier(),'high');sample(g,16,1);assert.equal(g.tier(),'cinematic');
 g.setMaximumTier('high');assert.equal(g.tier(),'high');sample(g,8,1800);assert.equal(g.tier(),'high');
 assert.equal(g.diagnostics().maximumTier,'high');assert.ok(changes.length>=3);
 g.setMaximumTier('low');assert.equal(g.tier(),'low');
});
test('adaptive/high initial governor never upgrades to Cinematic on arbitrarily healthy frames',()=>{
 const g=createTrackPerformanceGovernor({initialTier:'high',onTierChange:()=>{}});sample(g,5,2400);assert.equal(g.tier(),'high');
});
test('Cinematic budgets are explicit, bounded, and do not multiply GI or physical streaming',()=>{
 const c=screenLightingPolicy('cinematic'),h=screenLightingPolicy('high');assert.ok(c.aoSamples>h.aoSamples);assert.ok(c.maxWidth>h.maxWidth);
 assert.equal(c.giRays,6);assert.equal(c.giSteps,12);assert.ok(c.maxPixels<=960*540);
 for(const key of ['resolutionScale','vegetationLod','mirrorHz','sectorPreloadRadius','shadows'])assert.equal(TRACK_RENDER_POLICIES.cinematic[key],TRACK_RENDER_POLICIES.high[key]);
});
test('warmup enumerates Cinematic only for a manual cap and restores the original tier on error',async()=>{
 let tier='balanced';const warmed=[];
 const d=await prepareRenderPolicies({maximumTier:'cinematic',getTier:()=>tier,applyTier:t=>tier=t,prepare:async t=>warmed.push(t)});
 assert.deepEqual(d.prepared,['low','balanced','high','cinematic']);assert.equal(tier,'balanced');
 await assert.rejects(prepareRenderPolicies({maximumTier:'cinematic',getTier:()=>tier,applyTier:t=>tier=t,prepare:async()=>{throw new Error('compile');}}),/compile/);assert.equal(tier,'balanced');
});
test('bundled actual Three revision remains r180',()=>assert.equal(T.REVISION,'180'));
