import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {createRaceWeatherEffects} from '../src/render/race-weather-effects.mjs?v=82bd4492d14bfcf7';
const waterRoot=()=>{const root=new T.Group(),m=new T.MeshStandardMaterial();m.name='M_Lake_Water';const water=new T.Mesh(new T.PlaneGeometry(10,10),m);water.rotation.x=-Math.PI/2;root.add(water);root.updateMatrixWorld(true);return {root,water,m};};
test('tier changes settle water shaders immediately and newly streamed water inherits the tier',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),effects=createRaceWeatherEffects({THREE:T,scene,camera,qualityTier:'balanced'}),first=waterRoot();scene.add(first.root);effects.setTrack({id:'one',visualRoot:first.root});assert.ok(first.water.material.transmission>0);
 const before=effects.diagnostics();effects.setQualityTier('low');assert.equal(first.water.material.transmission,0);const version=first.water.material.version;effects.setQualityTier('low');assert.equal(first.water.material.version,version);assert.equal(effects.diagnostics().updates,before.updates);assert.equal(effects.diagnostics().time,before.time);
 const second=waterRoot();scene.add(second.root);effects.setTrack({id:'two',visualRoot:second.root});assert.equal(second.water.material.transmission,0);effects.setQualityTier('high');assert.ok(second.water.material.transmission>0);effects.dispose();for(const x of [first,second]){x.water.geometry.dispose();x.m.dispose();}
});
test('governor applies shader tier before resize can start asynchronous preparation',()=>{
 const source=fs.readFileSync(new URL('../src/legacy/module-02.mjs?v=c76e996a15ff9f6d',import.meta.url),'utf8'),body=source.match(/function applyPerformanceTier\(\) \{([\s\S]*?)\n  \}/)[1],order=[];
 const fn=new Function('raceWeatherEffects','performanceState','setSurfaceReliefQuality','isHighGraphicsQuality','MAX_SEGMENTS','drawDistance','behindDistance','visibleRoadStep',body);
 fn({setQualityTier:t=>order.push('weather:'+t)},{qualityTier:'low'},()=>{},()=>false,1,1,1,1);assert.equal(order[0],'weather:low');
 const callback=source.match(/function commitPerformanceTier\(transition,beforeResize\)\{([^}]+)\}/)[1];assert.ok(callback.indexOf('applyPerformanceTier()')<callback.indexOf('onRenderingScaleChanged('));
});
