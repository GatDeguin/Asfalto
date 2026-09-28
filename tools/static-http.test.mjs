import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import http from 'node:http';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {startServer} from '../server.mjs?v=ec9ca3d30198bdb8';

test('static HTTP revalidates mutable files, streams ranges and respects HEAD', async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'asfalto-http-'));
 await writeFile(path.join(root,'index.html'),'hello world');
 const server=await startServer({root});
 try {
  const first=await fetch(server.url);assert.equal(first.status,200);assert.equal(await first.text(),'hello world');
  assert.match(first.headers.get('cache-control'),/no-cache/);assert.ok(first.headers.get('etag'));assert.ok(first.headers.get('last-modified'));
  const cached=await fetch(server.url,{headers:{'If-None-Match':first.headers.get('etag')}});assert.equal(cached.status,304);assert.equal(await cached.text(),'');
  const dated=await fetch(server.url,{headers:{'If-Modified-Since':first.headers.get('last-modified')}});assert.equal(dated.status,304);
  const precedence=await fetch(server.url,{headers:{'If-None-Match':'"other"','If-Modified-Since':first.headers.get('last-modified')}});assert.equal(precedence.status,200);
  const range=await fetch(server.url,{headers:{Range:'bytes=1-4'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 1-4/11');assert.equal(await range.text(),'ello');
  const suffix=await fetch(server.url,{headers:{Range:'bytes=-5'}});assert.equal(await suffix.text(),'world');
  const open=await fetch(server.url,{headers:{Range:'bytes=6-'}});assert.equal(await open.text(),'world');
  const bad=await fetch(server.url,{headers:{Range:'bytes=99-100'}});assert.equal(bad.status,416);assert.equal(bad.headers.get('content-range'),'bytes */11');
  const multiple=await fetch(server.url,{headers:{Range:'bytes=0-1,4-5'}});assert.equal(multiple.status,200);
  const mismatch=await fetch(server.url,{headers:{Range:'bytes=1-4','If-Range':'"stale"'}});assert.equal(mismatch.status,200);
  const future=await fetch(server.url,{headers:{Range:'bytes=1-4','If-Range':'Wed, 31 Dec 2099 00:00:00 GMT'}});assert.equal(future.status,200);
  const exact=await fetch(server.url,{headers:{Range:'bytes=1-4','If-Range':first.headers.get('last-modified')}});assert.equal(exact.status,206);
  const head=await fetch(server.url,{method:'HEAD',headers:{Range:'bytes=1-4'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'11');assert.equal(await head.text(),'');
  await new Promise(r=>setTimeout(r,20));await writeFile(path.join(root,'index.html'),'hello changed');
  const changed=await fetch(server.url,{headers:{'If-None-Match':first.headers.get('etag')}});assert.equal(changed.status,200);assert.equal(await changed.text(),'hello changed');
  const versioned=await fetch(server.url+'?v=0123456789abcdef');assert.doesNotMatch(versioned.headers.get('cache-control'),/immutable/);
  const digest=createHash('sha256').update('hello changed').digest('hex');
  await writeFile(path.join(root,'data.json'),'hello changed');
  const immutable=await fetch(server.url+'data.json?v='+digest.slice(0,16));assert.match(immutable.headers.get('cache-control'),/immutable/);
  const strongRange=await fetch(server.url+'data.json?v='+digest.slice(0,16),{headers:{Range:'bytes=1-4','If-Range':immutable.headers.get('etag')}});assert.equal(strongRange.status,206);
  for(const rawPath of ['/%2e%2e/secret','/%252e%252e/secret','/%5csecret']) {
   const status=await new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port:new URL(server.url).port,path:rawPath},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});assert.equal(status,403);
  }
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
