// Test-only loader of the exact modules shipped by the application. No npm Three upgrade.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
const payload=JSON.parse(fs.readFileSync(new URL('../assets/manifests/workshop-bootstrap.json?v=71e24e64d3ef5ec5',import.meta.url)));
const core='data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64');
const source=gunzipSync(Buffer.from(payload.threeModuleGz,'base64')).toString('utf8').replaceAll('./three.core.min.js',core);
export const THREE=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
