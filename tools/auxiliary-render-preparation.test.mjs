import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {prepareBatchedPass,registerRenderPreparation,createPassPreparation,compileVisiblePass,prepareCubeCamera} from '../src/render/pass-preparation.mjs?v=2481e701be72bf1c';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('pending variants deduplicate and stale completion cannot activate after invalidation or disposal',async()=>{
 const gate=createPassPreparation(),first=deferred();let calls=0;
 const p=gate.prepare(['a'],()=>{calls++;return first.promise;});assert.equal(gate.ready(['a']),false);
 assert.equal(gate.prepare(['a'],()=>{calls++;}),p);assert.equal(calls,1);
 gate.invalidate();first.resolve();assert.equal(await p,false);assert.equal(gate.ready(['a']),false);
 const next=deferred(),q=gate.prepare(['b'],()=>next.promise);gate.dispose();next.resolve();assert.equal(await q,false);assert.equal(gate.ready(['b']),false);
});
test('failed preparations stay in fallback and report once until invalidation',async()=>{
 const errors=[],gate=createPassPreparation({onError:e=>errors.push(e)});let calls=0;
 assert.equal(await gate.prepare([1],()=>{calls++;throw Error('driver');}),false);
 assert.equal(await gate.prepare([1],()=>{calls++;}),false);assert.equal(calls,1);assert.equal(errors.length,1);assert.equal(gate.diagnostics().status,'failed');
 gate.invalidate();assert.equal(await gate.prepare([1],()=>{}),true);assert.equal(gate.ready([1]),true);
});
test('abort cannot publish readiness',async()=>{const gate=createPassPreparation(),pending=deferred(),c=new AbortController();const p=gate.prepare(['a'],()=>pending.promise,{signal:c.signal});c.abort();pending.resolve();assert.equal(await p,false);assert.equal(gate.ready(['a']),false);});
test('compile material traversal excludes hidden meshes and supplies actual scene lights',async()=>{const scene=new T.Scene(),camera=new T.PerspectiveCamera(),visible=new T.Mesh(),hidden=new T.Mesh(),off=new T.Mesh(),light=new T.PointLight();hidden.visible=false;off.layers.set(3);scene.add(visible,hidden,off,light);let meshes=[];await compileVisiblePass({compileAsync(view,c,target){view.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(c,camera);assert.equal(target,scene);let duplicateLights=0;view.traverseVisible(()=>duplicateLights++);assert.equal(duplicateLights,0);return Promise.resolve();}},scene,camera);assert.deepEqual(meshes,[visible]);});
test('cube prepares six target faces with immediate target and XR restoration',async()=>{
 const scene=new T.Scene(),cube=new T.WebGLCubeRenderTarget(16),camera=new T.CubeCamera(.1,30,cube),gates=[],faces=[];scene.add(camera);
 let target='original',face=4,mip=2;const renderer={coordinateSystem:T.WebGLCoordinateSystem,xr:{enabled:true},getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,setRenderTarget(t,f=0,m=0){target=t;face=f;mip=m;},compileAsync(view,c,s){assert.equal(target,cube);assert.equal(renderer.xr.enabled,false);assert.equal(c,camera.children[face]);assert.equal(s,scene);faces.push(face);const g=deferred();gates.push(g);return g.promise;}};
 const p=prepareCubeCamera(renderer,scene,camera);assert.equal(target,'original');assert.equal(face,4);assert.equal(mip,2);assert.equal(renderer.xr.enabled,true);
 for(let i=0;i<6;i++){assert.equal(gates.length,i+1);gates[i].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(target,'original');}
 await p;assert.deepEqual(faces,[0,1,2,3,4,5]);cube.dispose();
});
import {createWaterSceneReflection} from '../src/render/water-scene-reflection.mjs?v=f4d6d8707816c8ab';
import {createCockpitMirrors} from '../src/render/cockpit-mirrors.mjs?v=65b923efda2cac08';
function captureFixture(){let target=null,face=2,mip=3,scissor=true,alpha=.4;const viewport=new T.Vector4(3,4,128,96),box=new T.Vector4(1,2,90,70),color=new T.Color('red');const compiled=[],drawn=[],pending=[];
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1,.1,100);camera.position.set(0,4,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const state=c=>({target,tone:r.toneMapping,clipping:r.clippingPlanes.length,layers:c.layers.mask,visible:scene.children.filter(o=>o.visible).map(o=>o.uuid),xr:r.xr.enabled,shadow:r.shadowMap.autoUpdate});
 const r={autoClear:true,info:{autoReset:true},shadowMap:{autoUpdate:true,needsUpdate:true},xr:{enabled:true},toneMapping:T.ACESFilmicToneMapping,clippingPlanes:[],getRenderTarget:()=>target,getActiveCubeFace:()=>face,getActiveMipmapLevel:()=>mip,setRenderTarget(t,f=0,m=0){target=t;face=f;mip=m;},getViewport:v=>v.copy(viewport),setViewport:v=>viewport.copy(v),getScissor:v=>v.copy(box),setScissor:v=>box.copy(v),getScissorTest:()=>scissor,setScissorTest:v=>scissor=v,getClearColor:v=>v.copy(color),getClearAlpha:()=>alpha,setClearColor(c,a){color.set(c);alpha=a;},clear(){},getContext:()=>({isContextLost:()=>false}),compileAsync(v,c){compiled.push(state(c));const d=deferred();pending.push(d);return d.promise;},render(s,c){drawn.push(state(c));}};
 return{r,scene,camera,compiled,drawn,pending};
}
test('water first capture prepares exact pass with immediate restoration and draws only after readiness',async()=>{
 const f=captureFixture(),water=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshBasicMaterial());water.rotation.x=-Math.PI/2;f.scene.add(water);f.scene.updateMatrixWorld(true);const uniforms={uAnWaterReflectReady:{value:0},uAnWaterReflection:{value:null},uAnWaterReflectMatrix:{value:new T.Matrix4()}};
 const reflection=createWaterSceneReflection(T);reflection.bind([{mesh:water,uniforms}]);const options={renderer:f.r,scene:f.scene,camera:f.camera,quality:'balanced',nowMs:1000};
 assert.equal(reflection.capture(options),false);assert.equal(f.compiled.length,1);assert.equal(f.drawn.length,0);assert.equal(f.r.getRenderTarget(),null);assert.equal(f.r.clippingPlanes.length,0);assert.equal(water.visible,true);
 assert.equal(reflection.capture(options),false);assert.equal(f.compiled.length,1);f.pending[0].resolve();await reflection.prepare(options);assert.equal(reflection.capture(options),true);assert.deepEqual(f.drawn[0],f.compiled[0]);assert.equal(uniforms.uAnWaterReflectReady.value,1);
 const next={...options,variantKey:'rain',nowMs:2000};assert.equal(reflection.capture(next),false);assert.equal(uniforms.uAnWaterReflectReady.value,0);reflection.dispose();f.pending[1].resolve();await Promise.resolve();assert.equal(reflection.diagnostics().preparation.status,'disposed');
});
test('mirror preparation restores exclusions and targets while awaiting both feeds',async()=>{
 const f=captureFixture(),cockpit=new T.Group();f.scene.add(cockpit);const mirror=createCockpitMirrors({THREE:T,cockpitRoot:cockpit});const options={renderer:f.r,scene:f.scene,carPose:{position:[0,0,0]},nowMs:1000,force:true};
 assert.equal(mirror.update(options),0);assert.equal(f.drawn.length,0);assert.equal(cockpit.visible,true);assert.equal(f.r.getRenderTarget(),null);const p=mirror.prepare(options);
 f.pending[0].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.compiled.length,2);assert.equal(cockpit.visible,true);f.pending[1].resolve();await p;assert.equal(mirror.update(options),2);assert.deepEqual(f.drawn,f.compiled);mirror.dispose();
});
import {prepareRenderPolicies,createRenderPreparationCache} from '../src/performance/render-warmup.mjs?v=cbabfcdb7b1f34d2';
test('warmup prepares only active tier and cache distinguishes active tier changes',async()=>{
 let tier='balanced';const calls=[],cache=createRenderPreparationCache();const options={getTier:()=>tier,applyTier:v=>tier=v,prepare:v=>calls.push(v),maximumTier:'high'};
 assert.deepEqual((await prepareRenderPolicies(options)).prepared,['balanced']);calls.length=0;
 await cache.prepare('scene',options);await cache.prepare('scene',options);tier='high';await cache.prepare('scene',options);assert.deepEqual(calls,['balanced','high']);
});
test('cube restores temporary exclusions immediately and stops faces after cancellation',async()=>{
 const f=captureFixture(),cube=new T.WebGLCubeRenderTarget(16),camera=new T.CubeCamera(.1,30,cube),hidden=new T.Mesh(),c=new AbortController();f.scene.add(hidden,camera);f.r.coordinateSystem=T.WebGLCoordinateSystem;
 const p=prepareCubeCamera(f.r,f.scene,camera,{signal:c.signal,withState:compile=>{hidden.visible=false;try{return compile();}finally{hidden.visible=true;}}});assert.equal(hidden.visible,true);assert.equal(f.r.getRenderTarget(),null);assert.equal(f.r.getActiveCubeFace(),2);assert.equal(f.r.getActiveMipmapLevel(),3);assert.equal(f.r.getScissorTest(),true);
 c.abort();f.pending[0].resolve();await assert.rejects(p,{name:'AbortError'});assert.equal(f.compiled.length,1);cube.dispose();
});
test('water compile failure restores state and never renders a failed variant',async t=>{
 t.mock.method(console,'warn',()=>{});const f=captureFixture(),mesh=new T.Mesh(new T.PlaneGeometry(20,20));mesh.rotation.x=-Math.PI/2;f.scene.add(mesh);f.scene.updateMatrixWorld(true);const reflection=createWaterSceneReflection(T);reflection.bind([{mesh,uniforms:{uAnWaterReflectReady:{value:0},uAnWaterReflection:{value:null},uAnWaterReflectMatrix:{value:new T.Matrix4()}}}]);const options={renderer:f.r,scene:f.scene,camera:f.camera};
 const p=reflection.prepare(options);f.pending[0].reject(Error('driver'));assert.equal(await p,false);assert.equal(reflection.capture(options),false);assert.equal(f.drawn.length,0);assert.equal(f.compiled.length,1);assert.equal(mesh.visible,true);assert.equal(f.r.xr.enabled,true);assert.equal(reflection.diagnostics().preparation.error,'driver');reflection.dispose();
});
test('explicit transient batches are prepared before first emission without including hidden vehicle roots',async()=>{
 const scene=new T.Scene(),camera=new T.Camera(),particle=new T.Mesh(),hiddenParent=new T.Group(),hiddenChild=new T.Mesh();particle.visible=false;particle.userData.asfaltoPrewarm=true;hiddenParent.visible=false;hiddenChild.userData.asfaltoPrewarm=true;hiddenParent.add(hiddenChild);scene.add(particle,hiddenParent);const meshes=[];
 await compileVisiblePass({compileAsync(view){view.traverse(node=>{if(node.isMesh)meshes.push(node);});return Promise.resolve();}},scene,camera);assert.deepEqual(meshes,[particle]);assert.equal(particle.visible,false);
});
test('mirror toggle retains the mapped shader and disabled preparation does not reactivate feeds',async()=>{
 const f=captureFixture(),mirrors=createCockpitMirrors({THREE:T}),options={renderer:f.r,scene:f.scene,carPose:{position:[0,0,0]}};
 const feed=mirrors.feeds.center,texture=feed.glass.material.map,version=feed.glass.material.version;
 mirrors.update({...options,enabled:false});assert.equal(feed.glass.material.map,texture);assert.equal(feed.glass.material.version,version);assert.equal(mirrors.diagnostics().enabled,false);
 await mirrors.prepare({...options,enabled:false});assert.equal(mirrors.diagnostics().enabled,false);assert.equal(f.compiled.length,0);
 const preparing=mirrors.prepare({...options,enabled:true});for(let i=0;i<2;i++){f.pending[i].resolve();await new Promise(r=>setImmediate(r));}await preparing;assert.equal(feed.glass.material.map,texture);assert.equal(feed.glass.material.version,version);mirrors.dispose();
});

test('native compilation retains materials and renderer through concurrent cancellation/disposal',async()=>{
 const scene=new T.Scene(),camera=new T.Camera(),material=new T.MeshBasicMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),material);scene.add(mesh);const first=deferred(),second=deferred();let calls=0,materialDisposals=0,rendererDisposals=0;material.addEventListener('dispose',()=>materialDisposals++);const renderer={compileAsync(){return ++calls===1?first.promise:second.promise;},dispose(){rendererDisposals++;}};const originalRendererDispose=renderer.dispose;
 const a=compileVisiblePass(renderer,scene,camera),b=compileVisiblePass(renderer,scene,camera);material.dispose();renderer.dispose();assert.equal(materialDisposals,0);assert.equal(rendererDisposals,0);first.resolve();await a;assert.equal(materialDisposals,0);second.reject(Error('cancelled'));await assert.rejects(b,/cancelled/);assert.equal(materialDisposals,1);assert.equal(rendererDisposals,1);assert.equal(Object.hasOwn(material,'dispose'),false);assert.equal(renderer.dispose,originalRendererDispose);mesh.geometry.dispose();
});

test('a later transmissive batch still prepares earlier opaque objects for the transmission target',async()=>{
 const f=captureFixture();f.r.getCurrentViewport=f.r.getViewport;f.r.state={viewport:value=>f.r.setViewport(value)};registerRenderPreparation(f.r,T);const first=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),glass=new T.Mesh(new T.BoxGeometry(),new T.MeshPhysicalMaterial({transmission:1}));first.name='opaque-first';glass.name='glass-last';f.scene.add(first,glass);const observed=[];
 f.r.compileAsync=(view)=>{const meshes=[];view.traverse(n=>{if(n.isMesh)meshes.push(n.name);});observed.push({meshes,tone:f.r.toneMapping});return Promise.resolve();};
 await prepareBatchedPass(f.r,()=>compileVisiblePass(f.r,f.scene,f.camera),{size:1});assert.ok(observed.some(x=>x.tone===T.NoToneMapping&&x.meshes.includes('opaque-first')));first.geometry.dispose();first.material.dispose();glass.geometry.dispose();glass.material.dispose();
});
