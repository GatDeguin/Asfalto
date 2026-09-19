// Static literal import inventory plus byte-for-byte protected contract checks.
// Blob/manifest loading and runtime activity require the browser trace as well.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const seen=new Set(),edges=[],pending=['index.html'];
while(pending.length){
 const file=pending.shift();if(seen.has(file))continue;seen.add(file);
 const text=fs.readFileSync(path.join(root,file),'utf8');
 const specs=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"\n]+)\1/g)].map(m=>m[2]);
 if(file==='index.html')for(const m of text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi))specs.push(m[1]);
 for(const spec of new Set(specs)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec.split(/[?#]/)[0]));
  const exists=fs.existsSync(path.join(root,target));edges.push({from:file,to:target,spec,exists});
  if(exists&&/\.(?:mjs|js)$/.test(target)&&!seen.has(target))pending.push(target);
 }
}
const protectedFiles=JSON.parse(fs.readFileSync(path.join(root,'docs/cinematic-ultra/protected-baseline.json'),'utf8')).map(record=>({...record,unchanged:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,record.path))).digest('hex')===record.sha256}));
const result={method:'Literal script/import reachability, not proof that every branch executes',entry:'index.html',reachable:[...seen].sort(),edges,protectedFiles};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify({reachable:seen.size,literalEdges:edges.length,missing:edges.filter(e=>!e.exists),protectedFiles},null,2));
if(protectedFiles.some(p=>!p.unchanged))process.exitCode=1;
