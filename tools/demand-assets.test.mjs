import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {phoneCockpitAssets} from '../src/runtime/phone-cockpit-assets.mjs?v=2106632bc0111fe4';
import {vehicleAssetVersions} from '../src/runtime/vehicle-asset-versions.mjs?v=49590cd241f95e87';
test('transport manifests identify exact bytes and cockpit decompresses losslessly',async()=>{
 for(const entry of Object.values(phoneCockpitAssets)){const bytes=await readFile(new URL('../'+entry.url.replace('../../','').split('?')[0],import.meta.url));assert.equal(bytes[0],31);assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.equal(gunzipSync(bytes).readUInt32LE(0),0x46546c67);}
 for(const [name,hash] of Object.entries(vehicleAssetVersions)){const bytes=await readFile(new URL('../assets/vehicles/'+name,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);}
});
