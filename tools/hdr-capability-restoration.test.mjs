import test from 'node:test';
import assert from 'node:assert/strict';
import {supportedHdrSamples} from '../src/render/render-target-capabilities.mjs?v=d75829b876d7c18d';

test('HDR cache refreshes before a persistent consumer on consecutive context restores',()=>{
 let formats=[4,2],queries=0;
 const canvas=new EventTarget();
 const gl={canvas,RENDERBUFFER:1,RGBA16F:2,DEPTH_COMPONENT24:3,SAMPLES:4,isContextLost:()=>false,getInternalformatParameter(){queries++;return formats;}};
 const renderer={capabilities:{maxSamples:4},getContext:()=>gl};
 let captured=supportedHdrSamples(renderer,4);
 assert.equal(captured,4);
 // Mirrors screen-space-lighting: query initially, then retain a restore handler
 // that consumes the supported samples while the restore event is dispatching.
 canvas.addEventListener('webglcontextrestored',()=>{captured=supportedHdrSamples(renderer,4);});
 formats=[2];canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.equal(captured,2);assert.equal(queries,4);
 formats=[4,2];canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.equal(captured,4,'second restore must not reuse the first restored context capabilities');
 assert.equal(queries,6);
 formats=[];canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.equal(captured,0);assert.equal(queries,8);
});
