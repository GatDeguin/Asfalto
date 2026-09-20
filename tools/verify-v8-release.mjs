import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),name='assets/manifests/release.json';
const sha=b=>createHash('sha256').update(b).digest('hex').toUpperCase();
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules','test-results','playwright-report'].includes(e.name))continue;assert(!e.isSymbolicLink(),'No symlinks');const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else {const rel=path.relative(root,p).replaceAll('\\','/');if(rel===name)continue;const b=await fs.readFile(p);files.push({path:rel,bytes:b.length,sha256:sha(b)});}}}
await walk(root);files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const destination=path.join(root,name),old=JSON.parse(await fs.readFile(destination,'utf8'));
const actual={...old,schema:'asfalto-nacional-v8-modular-release/v1',builder:'tools/verify-v8-release.mjs',files,fileCount:files.length,totalBytes:files.reduce((a,f)=>a+f.bytes,0),inventorySha256:sha(Buffer.from(JSON.stringify(files)))};
if(process.argv.includes('--write'))await fs.writeFile(destination,JSON.stringify(actual,null,2)+'\n');
assert.deepEqual(JSON.parse(await fs.readFile(destination,'utf8')),actual,'Release inventory mismatch');
assert(actual.totalBytes<1_000_000_000,'Pages site budget exceeded');
assert(files.every(f=>f.bytes<100*1024*1024),'GitHub file budget exceeded');
console.log(JSON.stringify({status:'pass',files:files.length,bytes:actual.totalBytes,inventory:actual.inventorySha256}));
