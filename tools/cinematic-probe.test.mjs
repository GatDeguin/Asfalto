import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {createRoomProbeGuard} from '../src/render/workshop-probe-guard.mjs';
function setup(bad=false){
 const listeners=new Map(),state={target:{name:'outer'},face:2,mip:1,viewport:new T.Vector4(1,2,30,40),scissor:new T.Vector4(4,3,20,10),test:true};
 const renderer={autoClear:false,toneMapping:4,xr:{enabled:true},shadowMap:{autoUpdate:false,needsUpdate:true},state:{viewport(){}},domElement:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
 getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,setRenderTarget:(t,f=0,m=0)=>{state.target=t;state.face=f;state.mip=m;},
 getViewport:v=>v.copy(state.viewport),getCurrentViewport:v=>v.copy(state.viewport),setViewport:v=>state.viewport.copy(v),getScissor:v=>v.copy(state.scissor),setScissor:v=>state.scissor.copy(v),getScissorTest:()=>state.test,setScissorTest:v=>state.test=v,
 readRenderTargetPixels(_t,_x,_y,_w,_h,buffer){buffer.fill(0x3800);if(bad)buffer[0]=0x7e00;}};
 let disposed=0,resets=0;const target=new T.WebGLRenderTarget(4,4,{type:T.HalfFloatType});target.addEventListener('dispose',()=>disposed++);
 return {renderer,target,listeners,state,disposed:()=>disposed,resets:()=>resets,guard:createRoomProbeGuard(T,renderer,{onReset:()=>resets++})};
}
test('finite room PMREM stays caller-owned and capture state is restored',()=>{
 const a=setup(),before={target:a.state.target,viewport:a.state.viewport.clone()};
 const result=a.guard.capture(()=>{a.renderer.setRenderTarget(null);a.renderer.setViewport(new T.Vector4(0,0,1,1));a.renderer.autoClear=true;a.renderer.xr.enabled=false;return a.target;});
 assert.equal(result,a.target);assert.equal(a.disposed(),0);assert.equal(a.state.target,before.target);assert.equal(a.state.face,2);assert.equal(a.state.mip,1);assert.deepEqual(a.state.viewport,before.viewport);assert.equal(a.renderer.autoClear,false);assert.equal(a.renderer.xr.enabled,true);assert.equal(a.guard.diagnostics().mode,'local-pmrem');a.guard.dispose();assert.equal(a.disposed(),0);
});
test('non-finite probe falls back to scene HDRI, releases target and latches until context reset',()=>{
 const a=setup(true);const result=a.guard.capture(()=>a.target);
 assert.equal(result.texture,null);assert.equal(a.disposed(),1);assert.equal(a.guard.disabled(),true);assert.equal(a.guard.diagnostics().reason,'non-finite-radiance');
 let builds=0;a.guard.capture(()=>{builds++;return a.target;});assert.equal(builds,0);result.dispose();assert.equal(a.disposed(),1);
 a.listeners.get('webglcontextrestored')();assert.equal(a.guard.disabled(),false);assert.equal(a.resets(),1);a.guard.dispose();a.guard.dispose();assert.equal(a.listeners.size,0);
});
test('readback unsupported, oversize and thrown capture use explicit fallbacks rather than a black local map',()=>{
 for(const scenario of ['unsupported','oversize','throw']){
  const a=setup();if(scenario==='unsupported')a.renderer.readRenderTargetPixels=undefined;if(scenario==='oversize')a.target.width=a.target.height=4096;
  const result=a.guard.capture(()=>{if(scenario==='throw'){a.renderer.autoClear=true;throw Error('context interrupted');}return a.target;});
  assert.equal(result.texture,null);assert.equal(a.guard.disabled(),true);assert.equal(a.renderer.autoClear,false);assert.equal(a.disposed(),scenario==='throw'?0:1);assert.match(a.guard.diagnostics().reason,/unsupported|budget|capture-failed/);a.guard.dispose();
 }
});
