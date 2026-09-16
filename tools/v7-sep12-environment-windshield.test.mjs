import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../Web/vendor/three.module.js';
import {createWeatherWindshield,windshieldLayout} from '../src/render/weather-windshield.mjs?v=full-r1-20260916';
function fixture(){const cabin=new T.Group(),controller=createWeatherWindshield(T,{cabinMount:cabin}),pane=cabin.getObjectByName('AN_DropsOnCabinGlass');return{cabin,controller,pane};}
function run(controller,seconds,options={}){for(let i=0;i<Math.round(seconds*60);i++)controller.update({dt:1/60,rain:1,...options});}
test('a wiped sector remains clear with stopped blades, then refills from fresh rain',()=>{
 const {controller,pane}=fixture();run(controller,2,{wiperMode:'fast'});run(controller,1,{wiperMode:'off'});
 const memory=pane.material.uniforms.uWipeMemory?.value;assert.ok(memory,'persistent optical wipe memory is bound to the pane');
 const data=memory.image.data,peak=Math.max(...data);assert.ok(peak>5,'parking must not erase all clear sectors');
 run(controller,.1,{wiperMode:'off'});const after=Math.max(...data);assert.ok(after>0&&after<peak);assert.equal(pane.material.uniforms.uWipeMemory.value,memory);assert.equal(memory.image.data,data);
 run(controller,8,{wiperMode:'off'});assert.ok(Math.max(...data)<after*.1);controller.dispose();
});
test('pause freezes water, blade position and wipe history; stopped rain drains to transparent dry glass',()=>{
 const {controller,pane,cabin}=fixture();run(controller,4);const before=controller.diagnostics(),memory=pane.material.uniforms.uWipeMemory?.value;assert.ok(memory);const bytes=Array.from(memory.image.data);
 run(controller,2,{paused:true});const paused=controller.diagnostics();assert.equal(paused.time,before.time);assert.equal(paused.film,before.film);assert.equal(paused.phase,before.phase);assert.deepEqual(Array.from(memory.image.data),bytes);
 run(controller,160,{rain:0});assert.equal(controller.diagnostics().dropsVisible,false);assert.ok(controller.diagnostics().film<.005);assert.equal(controller.diagnostics().visible,true);
 let disposed=0;memory.addEventListener('dispose',()=>disposed++);controller.dispose();controller.dispose();assert.equal(disposed,1);assert.equal(cabin.children.length,0);
});
test('improved optics retain measured glass corners and exact blade annuli under cabin transforms',()=>{
 const {controller,cabin,pane}=fixture(),fit=windshieldLayout();cabin.position.set(.876,.167,.648);cabin.scale.set(2.965,2.8,3.1);cabin.rotation.set(.03,-.06,.04);
 const p=pane.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getZ(i)-(.335262279*p.getY(i)-.353797844))<.006);assert.ok(p.getY(i)>=.15&&p.getY(i)<=.465);}
 for(let step=0;step<90;step++){
  controller.update({dt:.05,rain:1,wiperMode:'fast'});cabin.updateWorldMatrix(true,true);const inverse=cabin.matrixWorld.clone().invert(),u=pane.material.uniforms;
  for(let i=0;i<2;i++){
   const blade=cabin.getObjectByName('AN_WiperBlade_'+i);blade.geometry.computeBoundingBox();const box=blade.geometry.boundingBox,pivot=u.uWipers.value[i],theta=u.uAngles.value.x+u.uPhase.value*(u.uAngles.value.y-u.uAngles.value.x);
   for(const [y,radius] of [[box.min.y,pivot.z],[box.max.y,pivot.w]]){const point=new T.Vector3(0,y,0).applyMatrix4(blade.matrixWorld).applyMatrix4(inverse),along=(point.y-fit.baseY)*fit.cos+(point.z-fit.baseZ)*fit.sin,dx=point.x-pivot.x,dy=along-pivot.y;assert.ok(Math.abs(Math.hypot(dx,dy)-radius)<1e-7);assert.ok(Math.abs(Math.atan2(dy,dx)-theta)<1e-7);}
  }
 }controller.dispose();
});
