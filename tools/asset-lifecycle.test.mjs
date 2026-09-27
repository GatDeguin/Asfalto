import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createAssetLifecycleManager,createAssetFrameBudget} from '../src/runtime/asset-lifecycle.mjs?v=a4c55886c0272d57';
import {parseGlbContainer,decodeGlbDocument} from '../src/runtime/glb-decode-worker.mjs?v=2a59613c05796123';
import {decodeGlbInWorker} from '../src/runtime/glb-decode-client.mjs?v=91a1751f8f15975f';

const payload=JSON.parse(fs.readFileSync(new URL('../assets/manifests/workshop-bootstrap.json?v=71e24e64d3ef5ec5',import.meta.url),'utf8'));
const core='data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64');
const source=gunzipSync(Buffer.from(payload.threeModuleGz,'base64')).toString().replaceAll('./three.core.min.js',core);
const T=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const fixture={asset:{version:'2.0'},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],materials:[{name:'used'},{name:'unused'}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
const json=new TextEncoder().encode(JSON.stringify(fixture)),jsonLength=(json.length+3)&~3;
function glb(){
 const b=new ArrayBuffer(12+8+jsonLength+8+36),v=new DataView(b);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,b.byteLength,true);
 v.setUint32(12,jsonLength,true);v.setUint32(16,0x4e4f534a,true);
 new Uint8Array(b,20,jsonLength).fill(32);new Uint8Array(b,20,json.length).set(json);
 v.setUint32(20+jsonLength,36,true);v.setUint32(24+jsonLength,0x004e4942,true);
 new Float32Array(b,28+jsonLength,9).set([0,0,0,1,0,0,0,1,0]);return b;
}
assert.equal(parseGlbContainer(glb()).bin.byteLength,36);
assert.throws(()=>parseGlbContainer(new ArrayBuffer(5)),/header/);
const document=await decodeGlbDocument(glb());assert.equal(document.json.nodes.length,1);
let workerTerminated=0;
class WorkerMock{
 postMessage(message,transfer){
  const received=structuredClone(message,{transfer});
  queueMicrotask(async()=>{
   const result=await decodeGlbDocument(received.buffer);
   const response=structuredClone({ok:true,...result},{transfer:[result.bin.buffer]});
   this.onmessage?.({data:response});
  });
 }
 terminate(){workerTerminated++;}
}
const transferred=glb(),decoded=await decodeGlbInWorker(transferred,{WorkerClass:WorkerMock});
assert.equal(transferred.byteLength,0);assert.equal(decoded.bin.byteLength,36);assert.equal(workerTerminated,1);
const allocated=[];
class Material extends T.MeshStandardMaterial{constructor(options){super(options);this.released=0;allocated.push(this);}dispose(){this.released++;super.dispose();}}
class Geometry extends T.BufferGeometry{constructor(){super();this.released=0;allocated.push(this);}dispose(){this.released++;super.dispose();}}
const three={...T,MeshStandardMaterial:Material,BufferGeometry:Geometry};
const helpers={parseGlb:parseGlbContainer,decodedDocument:decoded,makeAttribute:()=>new T.BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3),textureFromInfo:async()=>null};
const root=await globalThis.AsfaltoV5GlbCore.completeGlbToObject(three,null,'fixture',helpers);
const live=allocated.filter(x=>!x.released);assert.equal(live.length,2);
const manager=createAssetLifecycleManager();manager.disposeRoot(root);assert(allocated.every(x=>x.released===1));
allocated.length=0;let checkpoints=0;
await assert.rejects(globalThis.AsfaltoV5GlbCore.completeGlbToObject(three,null,'abort',{...helpers,checkpoint:async()=>{if(++checkpoints===5)throw new DOMException('Cancelled','AbortError');}}),{name:'AbortError'});
assert(allocated.length>0&&allocated.every(x=>x.released===1));

let targetDisposed=0,textureDisposed=0,tailDisposed=0;
const texture={isTexture:true,dispose(){textureDisposed++;}},depth={isTexture:true,dispose(){textureDisposed++;}};
const target={textures:[texture],depthTexture:depth,dispose(){targetDisposed++;}};
const m=createAssetLifecycleManager(),workshop=m.createScope(),race=m.createScope();
workshop.trackTarget(target);race.track(texture);workshop.dispose();assert.equal(targetDisposed,0);
race.dispose();assert.equal(targetDisposed,1);assert.equal(textureDisposed,0);
const bad=m.createScope(),tail=m.createScope();bad.track({dispose(){throw Error('custom dispose failed');}});tail.track({dispose(){tailDisposed++;}});
assert.throws(()=>m.dispose(),AggregateError);assert.equal(tailDisposed,1);assert.deepEqual(m.diagnostics(),{scopes:0,resources:0,closed:true});
let yielded=0;const budget=createAssetFrameBudget({budgetMs:0,yieldTask:async()=>{yielded++;}});await budget();assert.equal(yielded,1);
console.log('Asset ownership, error cleanup, GLB transfer, partial construction cleanup and cooperative yield: PASS (CPU)');

