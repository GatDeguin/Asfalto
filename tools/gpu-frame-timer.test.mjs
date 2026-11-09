import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuFrameTimer} from '../src/performance/gpu-frame-timer.mjs?v=6f67b1dbf7ea22a5';

test('a disjoint GPU clock invalidates prior timing evidence and pending queries',()=>{
 let disjoint=false;
 const deleted=[];
 const gl={
  getExtension:()=>({GPU_DISJOINT_EXT:1,TIME_ELAPSED_EXT:2}),
  createQuery:()=>({}),
  beginQuery(){},
  endQuery(){},
  getParameter:()=>disjoint,
  getQueryParameter:(_query,param)=>param==='available'?true:10e6,
  QUERY_RESULT_AVAILABLE:'available',
  deleteQuery:query=>deleted.push(query)
 };
 const timer=createGpuFrameTimer(gl);
 timer.begin();timer.end();timer.poll();
 assert.equal(timer.diagnostics().p95GpuMs,10);
 timer.begin();timer.end();
 disjoint=true;timer.poll();
 assert.equal(timer.diagnostics().samples,0);
 assert.equal(timer.diagnostics().pending,0);
 assert.equal(timer.diagnostics().discarded,1);
 assert.equal(deleted.length,2);
 disjoint=false;timer.begin();timer.end();timer.poll();
 assert.equal(timer.diagnostics().samples,1);
 timer.dispose();
});

test('the timer drops old queries and reacquires the extension on context restoration',()=>{
 const canvas=new EventTarget();
 let generation=0,lost=false,acquisitions=0;
 const gl={
  canvas,isContextLost:()=>lost,
  getExtension(){acquisitions++;return {GPU_DISJOINT_EXT:10+generation,TIME_ELAPSED_EXT:20+generation};},
  getParameter(value){assert.equal(value,10+generation);return false;},
  createQuery:()=>({generation}),
  beginQuery(target){assert.equal(target,20+generation);},
  endQuery(target){assert.equal(target,20+generation);},
  getQueryParameter(query,param){
   assert.equal(query.generation,generation);
   return param==='available'?true:10e6;
  },
  QUERY_RESULT_AVAILABLE:'available',
  deleteQuery(query){assert.equal(query.generation,generation);}
 };
 const timer=createGpuFrameTimer(gl);
 timer.begin();timer.end();timer.poll();
 assert.equal(timer.diagnostics().samples,1);
 timer.begin();timer.end();
 lost=true;canvas.dispatchEvent(new Event('webglcontextlost'));
 assert.equal(timer.diagnostics().available,false);
 assert.equal(timer.diagnostics().pending,0);
 assert.equal(timer.diagnostics().samples,0);
 assert.equal(timer.begin(),false);
 generation++;lost=false;canvas.dispatchEvent(new Event('webglcontextrestored'));
 timer.begin();timer.end();timer.poll();
 assert.equal(acquisitions,2);
 assert.equal(timer.diagnostics().p95GpuMs,10);
 timer.dispose();
 canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.equal(acquisitions,2);
});
