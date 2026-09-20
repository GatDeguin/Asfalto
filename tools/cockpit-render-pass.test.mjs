import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE} from './cinematic-three.mjs?v=1538801f0545ceb6';
import { createCockpitRenderPass } from '../src/render/cockpit-render-pass.mjs?v=94cfe8a9d3150ce6';

function fixture() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const cockpit = new THREE.Group(), road = new THREE.Mesh(), dash = new THREE.Mesh();
  const light = new THREE.DirectionalLight(), guide = new THREE.Group();
  scene.background = new THREE.Color('skyblue');
  scene.environment = new THREE.Texture();
  scene.add(camera, road, light, guide); camera.add(cockpit); cockpit.add(dash);
  road.userData.depth = 1; dash.userData.depth = 2;
  const calls = [], renderer = {
    autoClear:true, shadowMap:{autoUpdate:true, needsUpdate:true}, info:{autoReset:true},
    depth:Infinity, pixel:null,
    clearDepth(){ this.depth=Infinity; calls.push('clear-depth'); },
    render(s,c){
      if(this.autoClear)this.depth=Infinity;
      const visible=[];s.traverseVisible(n=>{if(n.layers.test(c.layers))visible.push(n);});
      calls.push({visible,background:s.background,environment:s.environment,shadows:this.shadowMap.autoUpdate});
      for(const n of visible)if(n.isMesh&&n.userData.depth<this.depth){this.depth=n.userData.depth;this.pixel=n;}
    },
  };
  return {scene,camera,cockpit,road,dash,light,guide,renderer,calls};
}

test('near road cannot overwrite the lower cockpit, while internal depth and world lighting remain enabled',()=>{
  const f=fixture();
  f.renderer.render(f.scene,f.camera);
  assert.equal(f.renderer.pixel,f.road,'reproduce the shared-depth road intrusion first');
  f.calls.length=0;
  createCockpitRenderPass({...f,overlays:[f.guide]}).render();
  assert.equal(f.renderer.pixel,f.dash,'interior must win even when the road is closer');
  assert.equal(f.calls.length,3);
  assert.ok(f.calls[0].visible.includes(f.road));assert.ok(!f.calls[0].visible.includes(f.dash));
  assert.equal(f.calls[1],'clear-depth');
  assert.ok(f.calls[2].visible.includes(f.dash));assert.ok(!f.calls[2].visible.includes(f.road));
  assert.ok(f.calls[2].visible.includes(f.light));assert.ok(f.calls[2].visible.includes(f.guide));
  assert.equal(f.calls[2].background,null);assert.equal(f.calls[2].environment,f.scene.environment);
  assert.equal(f.calls[2].shadows,false);
  assert.equal(f.dash.material.depthTest,true);assert.equal(f.dash.material.depthWrite,true);
  assert.equal(f.camera.layers.mask,1);assert.equal(f.dash.layers.mask,1);assert.equal(f.light.layers.mask,1);
  assert.equal(f.renderer.autoClear,true);assert.equal(f.renderer.shadowMap.needsUpdate,true);
  assert.equal(f.renderer.info.autoReset,true);assert.equal(f.guide.visible,true);
});

test('external views remain one render with no depth clear or changed masks',()=>{
  const f=fixture();f.cockpit.visible=false;
  createCockpitRenderPass(f).render();
  assert.equal(f.calls.length,1);assert.equal(f.renderer.pixel,f.road);assert.equal(f.cockpit.visible,false);
});

test('new interior meshes and lights are included without changing hidden objects or raycast layers',()=>{
  const f=fixture(), pass=createCockpitRenderPass(f);pass.render();
  const newMesh=new THREE.Mesh(),newLight=new THREE.PointLight();
  newMesh.layers.set(4);newMesh.visible=false;f.cockpit.add(newMesh);f.scene.add(newLight);
  pass.render();
  assert.ok(f.calls.at(-1).visible.includes(newLight));assert.ok(!f.calls.at(-1).visible.includes(newMesh));
  assert.equal(newMesh.layers.mask,16);assert.equal(newMesh.visible,false);assert.equal(newLight.layers.mask,1);
});

for(const failAt of [1,2])test(`render failure in pass ${failAt} restores all shared state`,()=>{
  const f=fixture(), render=f.renderer.render.bind(f.renderer), background=f.scene.background;
  let count=0;f.renderer.render=(...args)=>{render(...args);if(++count===failAt)throw new Error('gpu failure');};
  assert.throws(()=>createCockpitRenderPass({...f,overlays:[f.guide]}).render(),/gpu failure/);
  assert.equal(f.cockpit.visible,true);assert.equal(f.guide.visible,true);
  for(const n of [f.camera,f.cockpit,f.dash,f.light])assert.equal(n.layers.mask,1);
  assert.equal(f.scene.background,background);assert.equal(f.renderer.autoClear,true);
  assert.equal(f.renderer.shadowMap.autoUpdate,true);assert.equal(f.renderer.shadowMap.needsUpdate,true);
  assert.equal(f.renderer.info.autoReset,true);
});


test('own road projectors illuminate the world only, while rival and cabin lighting remain in the interior pass',()=>{
  const f=fixture(), own=new THREE.SpotLight(), rival=new THREE.SpotLight();
  own.userData.excludeFromCameraInterior=true;f.scene.add(own,rival);
  createCockpitRenderPass(f).render();
  assert.ok(f.calls[0].visible.includes(own));assert.ok(f.calls[0].visible.includes(rival));
  assert.ok(!f.calls[2].visible.includes(own),'world-space own headlight must not be remapped onto the camera-space dashboard');
  assert.ok(f.calls[2].visible.includes(rival));assert.ok(f.calls[2].visible.includes(f.light));
  assert.equal(own.layers.mask,1);assert.equal(rival.layers.mask,1);assert.equal(own.visible,true);
});

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function compileFixture(){
 const f=fixture(),own=new THREE.SpotLight(),hidden=new THREE.PointLight(),offLayer=new THREE.PointLight();
 own.userData.excludeFromCameraInterior=true;hidden.visible=false;offLayer.layers.set(5);f.scene.add(own,hidden,offLayer);
 const pending=[],compiled=[];f.renderer.compileAsync=(view,camera,targetScene)=>{
  const meshes=[],lights=[],extraLights=[];
  view.traverse(n=>{if(n.isMesh)meshes.push(n);});
  targetScene.traverseVisible(n=>{if(n.isLight&&n.layers.test(camera.layers))lights.push(n);});
  view.traverseVisible(n=>{if(n.isLight)extraLights.push(n);});
  compiled.push({meshes,lights,extraLights,targetScene,background:targetScene.background,environment:targetScene.environment,cameraMask:camera.layers.mask,autoClear:f.renderer.autoClear,shadowAutoUpdate:f.renderer.shadowMap.autoUpdate});
  const gate=deferred();pending.push(gate);return gate.promise;
 };
 const pass=createCockpitRenderPass({...f,overlays:[f.guide],compilePrograms:(renderer,...args)=>renderer.compileAsync(...args)});
 return {...f,own,hidden,offLayer,pending,compiled,pass};
}
function assertRestored(f,background){
 assert.equal(f.camera.layers.mask,1);assert.equal(f.cockpit.layers.mask,1);assert.equal(f.dash.layers.mask,1);assert.equal(f.light.layers.mask,1);assert.equal(f.own.layers.mask,1);assert.equal(f.offLayer.layers.mask,32);
 assert.equal(f.scene.background,background);assert.equal(f.cockpit.visible,true);assert.equal(f.guide.visible,true);assert.equal(f.hidden.visible,false);
 assert.equal(f.renderer.autoClear,true);assert.equal(f.renderer.info.autoReset,true);assert.equal(f.renderer.shadowMap.autoUpdate,true);assert.equal(f.renderer.shadowMap.needsUpdate,true);
 assert.equal(f.calls.length,0,'preparation must never draw or clear depth');
}
test('prepare compiles exact world then cabin lighting/material sets and restores immediately',async()=>{
 const f=compileFixture(),background=f.scene.background,p=f.pass.prepare();
 assert.equal(f.compiled.length,1);assertRestored(f,background);
 const world=f.compiled[0];assert.deepEqual(world.meshes,[f.road]);assert.ok(world.lights.includes(f.own));assert.ok(!world.lights.includes(f.hidden));assert.equal(world.background,background);assert.equal(world.targetScene,f.scene);assert.deepEqual(world.extraLights,[]);
 f.pending[0].resolve();await Promise.resolve();assert.equal(f.compiled.length,2);assertRestored(f,background);
 const cabin=f.compiled[1];assert.deepEqual(cabin.meshes,[f.dash]);assert.deepEqual(cabin.lights,[f.light]);assert.equal(cabin.background,null);assert.equal(cabin.environment,f.scene.environment);assert.equal(cabin.cameraMask,1<<30);assert.equal(cabin.autoClear,false);assert.equal(cabin.shadowAutoUpdate,false);
 f.pending[1].resolve();await p;assertRestored(f,background);
});
test('prepare outside cockpit compiles only world and leaves overlays visible',async()=>{
 const f=compileFixture();f.cockpit.visible=false;const overlay=new THREE.Mesh();f.guide.add(overlay);const p=f.pass.prepare();assert.equal(f.cockpit.visible,false);assert.ok(f.compiled[0].meshes.includes(overlay));f.pending[0].resolve();await p;assert.equal(f.compiled.length,1);assert.equal(f.calls.length,0);
});
for(const failAt of [1,2])for(const synchronous of [true,false])test(`prepare failure ${failAt}, synchronous=${synchronous}, restores scene and stops`,async()=>{
 const f=compileFixture(),background=f.scene.background,compile=f.renderer.compileAsync;let count=0;
 f.renderer.compileAsync=(...args)=>{if(++count===failAt&&synchronous)throw Error('compile failed');return compile(...args);};
 const p=f.pass.prepare();if(failAt===2){f.pending[0].resolve();await Promise.resolve();}
 assertRestored(f,background);if(!synchronous)f.pending[failAt-1].reject(Error('compile failed'));await assert.rejects(p,/compile failed/);assert.equal(count,failAt);assertRestored(f,background);
});
