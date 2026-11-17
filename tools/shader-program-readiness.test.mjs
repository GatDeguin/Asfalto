import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {compileVisiblePass, registerRenderPreparation, isRenderPreparationPending} from '../src/render/pass-preparation.mjs?v=926cddc76a9af3b4';

function program() {
 const shader = {program:{}, ready:false, checks:0, prepared:0,
  isReady(){shader.checks++;return shader.ready;},
  getUniforms(){assert.equal(shader.ready,true);shader.prepared++;}};
 return shader;
}

function fixture() {
 const camera = new T.Camera();
 const front = program(), back = program(), auxiliary = program();
 const properties = new Map();
 const context = {lost:false,isContextLost(){return this.lost;}};
 const renderer = {
  isWebGLRenderer:true, extensions:{has:name=>name==='KHR_parallel_shader_compile'},
  info:{programs:[front,back,auxiliary],render:{}}, shadowMap:{}, properties,
  getContext:()=>context, render(){},
  compile(view){
   const materials=new Set();
   view.traverse(node=>{if(node.material)materials.add(node.material);});
   return materials;
  },
  compileAsync(view){renderer.compile(view);return Promise.resolve(view);}
 };
 registerRenderPreparation(renderer,T);
 function sceneWith(...programs) {
  const material = new T.MeshBasicMaterial(), scene = new T.Scene();
  const variants = new Map(programs.map((shader,i)=>[i,shader]));
  properties.set(material,{programs:variants,currentProgram:programs[0]});
  scene.add(new T.Mesh(undefined,material));
  return scene;
 }
 return {renderer,context,front,back,auxiliary,sceneWith,compile:scene=>compileVisiblePass(renderer,scene,camera)};
}

async function poll(t) {
 t.mock.timers.tick(16);
 await new Promise(resolve=>setImmediate(resolve));
}

test('overlapping passes share shader polls and wait for all of their own variants',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {renderer,front,back,auxiliary,sceneWith,compile}=fixture();
 const scene=sceneWith(front,back),mesh=scene.children[0];
 let completed=0;
 const first=compile(scene).then(()=>completed++);
 const second=compile(sceneWith(front)).then(()=>completed++);
 renderer.properties.get(mesh.material).currentProgram=auxiliary;
 front.ready=true;
 await poll(t);
 assert.deepEqual([front.checks,back.checks,auxiliary.checks,completed],[1,1,0,1]);
 assert.equal(isRenderPreparationPending(renderer),true);
 back.ready=true;
 await poll(t);
 await Promise.all([first,second]);
 assert.deepEqual([front.checks,back.checks,auxiliary.checks,completed],[1,2,0,2]);
 await compile(scene);
 assert.deepEqual([front.checks,back.checks,auxiliary.checks],[1,2,0]);
 assert.equal(isRenderPreparationPending(renderer),false);
 t.mock.timers.tick(160);
 assert.deepEqual([front.checks,back.checks,auxiliary.checks],[1,2,0]);
});

test('context loss ends pending readiness and the restored program cache starts fresh',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {renderer,context,front,sceneWith,compile}=fixture();
 let failure;
 const interrupted=compile(sceneWith(front)).catch(error=>{failure=error;});
 context.lost=true;
 await poll(t);
 assert.equal(failure?.name,'AbortError');
 await interrupted;
 assert.equal(front.checks,0);
 assert.equal(isRenderPreparationPending(renderer),false);
 context.lost=false;
 const restored=program();
 renderer.info.programs=[restored];
 const current=compile(sceneWith(restored));
 restored.ready=true;
 await poll(t);
 await current;
 assert.equal(restored.checks,1);
});

test('a traffic occupant primes first-draw metadata once, after the program has linked',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {front,back,sceneWith,compile}=fixture();
 const first=compile(sceneWith(front));
 front.ready=true;
 await poll(t);
 await first;
 assert.equal(front.prepared,0);

 const traffic=sceneWith(front,back);
 traffic.children[0].material.userData.asfaltoPrepareFirstDraw=true;
 const beforeDrive=compile(traffic);
 const mirror=compile(traffic);
 await poll(t);
 assert.equal(front.prepared,1,'a shared program previously polled is still primed before first draw');
 assert.equal(back.prepared,0,'an unlinked program must remain a nonblocking poll');
 back.ready=true;
 await poll(t);
 await Promise.all([beforeDrive,mirror]);
 await compile(traffic);
 assert.deepEqual([front.prepared,back.prepared],[1,1]);
});

test('a renderer without the parallel extension keeps its native asynchronous readiness',async()=>{
 const {renderer,front,sceneWith,compile}=fixture();
 renderer.extensions.has=()=>false;
 let finish;
 renderer.compileAsync=()=>new Promise(resolve=>{finish=resolve;});
 const pending=compile(sceneWith(front));
 assert.equal(isRenderPreparationPending(renderer),true);
 assert.equal(front.checks,0);
 finish();await pending;
 assert.equal(isRenderPreparationPending(renderer),false);
});
