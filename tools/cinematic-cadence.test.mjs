import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isHighGraphicsQuality} from '../src/render/graphics-quality-policy.mjs';
test('active legacy procedural cadence treats Cinematic explicitly as High',()=>{
 const source=fs.readFileSync(new URL('../src/legacy/module-02.mjs',import.meta.url),'utf8');
 const condition=source.match(/environmentFrame\+\+;if\((.*?)\)return;/)?.[1];
 assert.ok(condition,'use the actual active cadence condition, not a duplicate policy');
 const skips=Function('force','environmentFrame','performanceState','isHighGraphicsQuality','return ('+condition+');');
 for(const tier of ['high','cinematic'])assert.equal(skips(false,1,{qualityTier:tier},isHighGraphicsQuality),false);
 assert.equal(skips(false,1,{qualityTier:'balanced'},isHighGraphicsQuality),true);
 assert.equal(skips(true,1,{qualityTier:'balanced'},isHighGraphicsQuality),false);
});
