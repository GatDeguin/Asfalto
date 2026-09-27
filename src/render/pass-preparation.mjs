const contexts=new WeakMap();
export function registerRenderPreparation(renderer,T){
 let context=contexts.get(renderer);
 if(!context||context.disposed){context={T,empty:new T.Scene(),transmission:null,pending:0,disposed:false,lastBatch:null};contexts.set(renderer,context);}
 return context;
}
export const isRenderPreparationPending=renderer=>(contexts.get(renderer)?.pending||0)>0;
function releaseContext(renderer,context){if(!context?.disposed||context.pending)return;context.transmission?.dispose();context.transmission=null;if(contexts.get(renderer)===context)contexts.delete(renderer);}
export function disposeRenderPreparation(renderer){const context=contexts.get(renderer);if(context){context.disposed=true;releaseContext(renderer,context);}}
export const getRenderPreparationDiagnostics=renderer=>{const context=contexts.get(renderer);return context?.lastBatch?{...context.lastBatch,pending:context.pending}:null;};
// Three r180 compile() reads cached WebGLClipping state; assigning clippingPlanes
// alone does not update NUM_CLIPPING_PLANES. A material-free, clear-free render
// initializes that state without drawing, compiling or touching the visible image.
export function primePassClipping(renderer,scene,camera){
 if(!renderer.isWebGLRenderer)return;
 const context=contexts.get(renderer);
 const empty=context?.empty||new scene.constructor();
 const autoClear=renderer.autoClear,autoReset=renderer.info.autoReset,counts={...renderer.info.render};
 const shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
 try{renderer.autoClear=false;renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.render(empty,camera);}
 finally{renderer.autoClear=autoClear;renderer.info.autoReset=autoReset;Object.assign(renderer.info.render,counts);renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;}
}
const materialLeases=new WeakMap();
// Three r180's native poll dereferences material.currentProgram. Defer disposal
// until every native compile using that material settles, including cancelled passes.
function retainMaterials(view,renderer){
 const held=new Set();const retain=node=>{for(const material of Array.isArray(node.material)?node.material:[node.material]){
  if(!material||held.has(material)||typeof material.dispose!=='function')continue;held.add(material);
  let lease=materialLeases.get(material);
  if(!lease){const own=Object.getOwnPropertyDescriptor(material,'dispose'),original=material.dispose;lease={count:0,requested:false,own,original};lease.wrapper=function(){lease.requested=true;};material.dispose=lease.wrapper;materialLeases.set(material,lease);}lease.count++;
 }};view.traverse(retain);retain({material:renderer});
 return ()=>{for(const material of held){const lease=materialLeases.get(material);if(--lease.count)continue;materialLeases.delete(material);if(material.dispose===lease.wrapper){if(lease.own)Object.defineProperty(material,'dispose',lease.own);else delete material.dispose;}if(lease.requested)lease.original.call(material);}};
}
function waitPrograms(renderer,pending,programs){
 if(!renderer.isWebGLRenderer||!renderer.extensions.has('KHR_parallel_shader_compile'))return pending;
 // Poll only unfinished actual programs, not mutable material.currentProgram.
 const unfinished=programs.filter(program=>program.program&&!program.isReady());if(!unfinished.length)return pending;
 return Promise.all([pending,new Promise(resolve=>{const check=()=>{const live=new Set(renderer.info.programs);if(unfinished.every(program=>!live.has(program)||!program.program||program.isReady()))resolve();else setTimeout(check,10);};check();})]);
}
function compileNative(renderer,view,scene,camera){
 const release=retainMaterials(view,renderer),context=contexts.get(renderer);if(context)context.pending++;let pending;
 try{primePassClipping(renderer,scene,camera);pending=renderer.compileAsync(view,camera,scene);
  // compile() replaces material.currentProgram even when its version and light
  // counts stay unchanged. Foreground draws must select their current-tier
  // program again instead of accidentally drawing with an unfinished future one.
  if(context?.batch){const materials=new Set();view.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)materials.add(material);});for(const material of materials)material.needsUpdate=true;}
 }
 catch(error){if(context){context.pending--;releaseContext(renderer,context);}release();throw error;}
 return Promise.resolve(waitPrograms(renderer,pending,[...(renderer.info?.programs||[])])).finally(()=>{if(context){context.pending--;releaseContext(renderer,context);}release();});
}
function compileMaterials(renderer,view,scene,camera){
 if(!renderer.localClippingEnabled)return compileNative(renderer,view,scene,camera);
 const globalPlanes=renderer.clippingPlanes,groups=new Map();
 view.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:[node.material]){if(!material)continue;const local=material.clippingPlanes||[];const count=local.length;if(!groups.has(count))groups.set(count,{planes:globalPlanes.concat(local),materials:new Set()});groups.get(count).materials.add(material);}});
 if(!groups.size)return compileNative(renderer,view,scene,camera);
 const pending=[];
 try{for(const {planes,materials} of groups.values()){
  // The game's local cut planes use union clipping. Prime the same total plane
  // count globally because native compile does not call setState per material.
  renderer.clippingPlanes=planes;
  const filtered={traverse(visit){view.traverse(node=>{if(!node.material)return;const original=node.material,selected=(Array.isArray(original)?original:[original]).filter(m=>materials.has(m));if(!selected.length)return;try{node.material=Array.isArray(original)?selected:selected[0];visit(node);}finally{node.material=original;}});},traverseVisible(){}};
  pending.push(compileNative(renderer,filtered,scene,camera));
 }}finally{renderer.clippingPlanes=globalPlanes;}
 return Promise.all(pending);
}
// Only fold objects with the same resource identities and native shader features.
// Custom hooks, skeletons and batched draw data can specialize per object.
function uniquePreparationNodes(nodes,context){
 const ids=new WeakMap();let nextId=1;
 const id=value=>{if(!ids.has(value))ids.set(value,nextId++);return ids.get(value);};
 const seen=new Set(),prototype=context.T.Material?.prototype;
 return nodes.filter(node=>{
  const materials=Array.isArray(node.material)?node.material:[node.material];
  if(!node.geometry||node.isSkinnedMesh||node.isBatchedMesh||materials.some(m=>!m||!prototype||m.onBeforeCompile!==prototype.onBeforeCompile||m.customProgramCacheKey!==prototype.customProgramCacheKey))return true;
  const key=[node.type,id(node.geometry),materials.map(id).join(','),!!node.receiveShadow,!!node.isInstancedMesh,!!node.instanceColor,!!node.morphTexture].join(':');
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
export function compileVisiblePass(renderer,scene,camera){
 if(typeof renderer.compileAsync!=='function')throw new Error('Asynchronous shader preparation is unavailable');
 let nodes=[];const walk=node=>{if(!node.visible&&!node.userData?.asfaltoPrewarm)return;if(node.layers.test(camera.layers))nodes.push(node);for(const child of node.children)walk(child);};
 const batch=contexts.get(renderer)?.batch;
 if(batch?.views.has(scene))nodes=batch.views.get(scene);else{walk(scene);if(batch){
  nodes=nodes.filter(n=>n.isMesh||n.isPoints||n.isLine||n.isSprite);
  const allNodes=nodes;batch.releases.push(retainMaterials({traverse(visit){for(const node of allNodes)visit(node);}},renderer));
  batch.diagnostics.sourceObjects+=nodes.length;nodes=uniquePreparationNodes(nodes,contexts.get(renderer));batch.diagnostics.uniqueObjects+=nodes.length;
  batch.views.set(scene,nodes);
 }}
 const fullNodes=nodes;
 if(batch){batch.more||=nodes.length>batch.offset+batch.size;nodes=nodes.slice(batch.offset,batch.offset+batch.size);}
 const view={traverse(visit){for(const node of nodes)visit(node);},traverseVisible(){}};
 const pending=compileMaterials(renderer,view,scene,camera);
 const context=contexts.get(renderer);let transmission=batch?.transmission.get(scene);
 if(transmission===undefined){
  transmission=false;
  if(context)for(const node of fullNodes){for(const material of Array.isArray(node.material)?node.material:[node.material])if(material?.transmission>0)transmission=true;}
  batch?.transmission.set(scene,transmission);
 }
 if(!transmission)return pending;
 const {T}=context;
 if(!context.transmission){context.transmission=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType});context.transmission.texture.colorSpace=T.LinearSRGBColorSpace;}
 const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),tone=renderer.toneMapping;
 const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),physical=renderer.getCurrentViewport(new T.Vector4()),scissorTest=renderer.getScissorTest();
 let extra;
 try{
  renderer.setRenderTarget(context.transmission);renderer.toneMapping=T.NoToneMapping;
  // The internal transmission pass draws opaque objects plus BackSide of every
  // double-sided transmissive material, even transparent=false/forceSinglePass.
  const opaque={traverse(visit){view.traverse(node=>{if(!node.material)return;const original=node.material,selected=(Array.isArray(original)?original:[original]).filter(m=>m&&(!m.transparent&&!(m.transmission>0)||m.transmission>0&&m.side===T.DoubleSide));if(!selected.length)return;const sides=new Map(selected.map(m=>[m,m.side]));try{for(const m of selected)if(m.transmission>0)m.side=T.BackSide;node.material=Array.isArray(original)?selected:selected[0];visit(node);}finally{node.material=original;for(const [m,side] of sides)m.side=side;}});},traverseVisible(){}};
  extra=compileMaterials(renderer,opaque,scene,camera);
 }catch(error){void pending.catch(()=>{});throw error;}
 finally{renderer.toneMapping=tone;renderer.setRenderTarget(target,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.state.viewport(physical);}
 return Promise.all([pending,extra]);
}
// Bound synchronous shader construction as well as asynchronous driver linking.
// The caller reapplies/restores the real pass state for each batch. Only the
// synchronous callback sees the batch filter; foreground rendering stays normal.
export async function prepareBatchedPass(renderer,compile,{signal,size=16,budgetMs=4,withTurnState=work=>work(),isCurrent=()=>true,now=()=>performance.now(),yieldTask=()=>new Promise(resolve=>setTimeout(resolve,16))}={}){
 if(!Number.isFinite(budgetMs)||budgetMs<=0)throw new RangeError('budgetMs must be positive');
 if(!Number.isInteger(size)||size<1)throw new RangeError('size must be a positive integer');
 const context=contexts.get(renderer);if(!context)return withTurnState(compile);
 const diagnostics={budgetMs,maxPositionsPerTurn:Math.min(size,16),sourceObjects:0,uniqueObjects:0,submittedPositions:0,turns:0,totalSyncMs:0,maxSubmissionMs:0,overBudgetUnits:0};
 context.lastBatch=diagnostics;
 const batch={views:new Map(),transmission:new Map(),releases:[],offset:0,size:1,more:false,diagnostics},pending=[];context.pending++;
 try{
  do{
   const started=now();let submitted=0,cancelled=false;
   withTurnState(()=>{
   do{
    signal?.throwIfAborted();if(context.disposed||!isCurrent()){cancelled=true;return;}
    batch.more=false;const previous=context.batch;context.batch=batch;const unitStarted=now();
    try{const work=Promise.resolve(compile());work.catch(()=>{});pending.push(work);}finally{context.batch=previous;}
    // Native GL work is atomic: an expensive single program can exceed the
    // budget, but no further object is submitted in that turn.
    if(now()-unitStarted>budgetMs)diagnostics.overBudgetUnits++;
    batch.offset++;submitted++;diagnostics.submittedPositions++;
   }while(batch.more&&submitted<diagnostics.maxPositionsPerTurn&&now()-started<budgetMs);
   });
   if(cancelled)return false;
   const elapsed=now()-started;diagnostics.turns++;diagnostics.totalSyncMs+=elapsed;diagnostics.maxSubmissionMs=Math.max(diagnostics.maxSubmissionMs,elapsed);
   if(batch.more)await yieldTask();
  }while(batch.more);
  await Promise.all(pending);signal?.throwIfAborted();
 }finally{
  // Pending native polls and unsubmitted materials outlive cancellation.
  await Promise.allSettled(pending);for(const release of batch.releases)release();context.pending--;releaseContext(renderer,context);
 }
}
const equal=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
export function createPassPreparation({onError=error=>console.warn('Render pass preparation failed; retaining fallback',error)}={}){
 let generation=0,disposed=false,key=null,status='idle',pending=null,error=null;
 return {
  ready(next){return !disposed&&status==='ready'&&equal(key,next);},
  prepare(next,compile,{signal}={}){
   if(disposed||signal?.aborted)return Promise.resolve(false);
   if(equal(key,next)&&pending&&status!=='idle')return pending;
   const epoch=++generation;key=[...next];status='pending';error=null;
   let work;try{work=compile(()=>!disposed&&epoch===generation&&!signal?.aborted);}catch(failure){work=Promise.reject(failure);}
   pending=Promise.resolve(work).then(()=>{
    if(disposed||epoch!==generation||signal?.aborted){if(epoch===generation)status='idle';return false;}
    status='ready';return true;
   },failure=>{if(!disposed&&epoch===generation){status='failed';error=String(failure?.message||failure);onError(failure);}return false;});
   return pending;
  },
  invalidate(){generation++;key=null;pending=null;status='idle';error=null;},
  dispose(){disposed=true;generation++;key=null;pending=null;status='disposed';},
  diagnostics:()=>({status,generation,error,disposed})
 };
}
export async function prepareCubeCamera(renderer,scene,camera,{signal,withState=fn=>fn()}={}){
 if(camera.parent===null)camera.updateMatrixWorld();
 if(camera.coordinateSystem!==renderer.coordinateSystem){camera.coordinateSystem=renderer.coordinateSystem;camera.updateCoordinateSystem();}
 for(let face=0;face<6;face++){
  signal?.throwIfAborted();
  const target=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace?.()||0,mip=renderer.getActiveMipmapLevel?.()||0,xr=renderer.xr?.enabled;
  const viewport=renderer.getViewport?.(camera.renderTarget.viewport.clone()),scissor=renderer.getScissor?.(camera.renderTarget.scissor.clone()),physical=renderer.getCurrentViewport?.(camera.renderTarget.viewport.clone()),scissorTest=renderer.getScissorTest?.();
  let pending;
  try{if(renderer.xr)renderer.xr.enabled=false;renderer.setRenderTarget(camera.renderTarget,face,camera.activeMipmapLevel||0);pending=withState(()=>compileVisiblePass(renderer,scene,camera.children[face]));}
  finally{renderer.setRenderTarget(target,oldFace,mip);if(viewport)renderer.setViewport(viewport);if(scissor)renderer.setScissor(scissor);if(scissorTest!==undefined)renderer.setScissorTest(scissorTest);if(physical)renderer.state?.viewport?.(physical);if(renderer.xr)renderer.xr.enabled=xr;}
  await pending;
 }
 signal?.throwIfAborted();
}
