import { prepareOptionalClosedRoute, attachClosedRouteRoots, respawnRouteDistance } from './closed-route-support.mjs';
import { RESPAWN_CLEARANCE_M, validateTrackManifest } from '../track-contract.mjs';
import { createRouteQuery } from '../route-query.mjs';
import { createGameplayBridge } from '../gameplay-bridge.mjs';
import { collectMaterialBindings } from '../../environment/material-bindings.mjs';
import { prepareTrackVisual, prepareReturnScenery } from '../visuals/reference-landscape.mjs?v=full-r1-20260916';
const ENV = new Set(['clear','overcast','golden','sunset','moonrise','night']);
const freeze = (v,seen=new Set()) => { if (!v || typeof v !== 'object' || Object.isFrozen(v) || seen.has(v)) return v; seen.add(v); Object.values(v).forEach(child=>freeze(child,seen)); return Object.freeze(v); };
const abortError = () => Object.assign(new Error('operation aborted'), { name: 'AbortError' });
const bytes = (v,label) => { if (v instanceof Uint8Array) return v; if (v instanceof ArrayBuffer) return new Uint8Array(v); throw new TypeError(label+' must be bytes'); };
const sha = async b => Array.from(
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', b)),
  value => value.toString(16).padStart(2, '0'),
).join('').toUpperCase();
const cloneBytes = b => new Uint8Array(b);
function parseLockedJson(value,label){try{return JSON.parse(new TextDecoder().decode(value));}catch(error){throw Object.assign(new TypeError(label+' SHA-256 mismatch: locked JSON is invalid'),{cause:error});}}
function requireFn(d,name){if(typeof d?.[name] !== 'function') throw new TypeError(name+' must be a function');}
function rejectRawUrl(value,label,{relative=false}={}){
  if(typeof value!=='string'||value.length===0)throw new TypeError(label+' URL is required');
  if(value.includes('\\'))throw new TypeError(label+' URL contains backslash');
  if(value.includes('\0'))throw new TypeError(label+' URL contains NUL');
  if(value.includes('?'))throw new TypeError(label+' URL query is forbidden');
  if(value.includes('#'))throw new TypeError(label+' URL fragment is forbidden');
  if(value.includes('%'))throw new TypeError(label+' URL encoded bytes are forbidden');
  if(value.startsWith('//'))throw new TypeError(label+' protocol-relative URL is forbidden');
  if(relative){
    if(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)||value.startsWith('/'))throw new TypeError(label+' URL must be relative');
    const tail=value.startsWith('./')?value.slice(2):value;
    const parts=tail.split('/');
    if(!tail||parts.some(part=>!part||part==='.'||part==='..'))throw new TypeError(label+' URL contains dot traversal');
  }
  return value;
}
function canonicalReleaseRoot(raw){
  rejectRawUrl(raw,'release root');
  let root;try{root=new URL(raw);}catch(error){throw new TypeError('release root URL is invalid',{cause:error});}
  if(root.username||root.password)throw new TypeError('release root URL credentials are forbidden');
  if(root.search||root.hash)throw new TypeError('release root URL query or fragment is forbidden');
  if(!root.pathname.endsWith('/'))throw new TypeError('releaseRootUrl is required');
  return root;
}
function assertContained(root,url,label){
  if(url.origin!==root.origin)throw new TypeError(label+' URL escapes release origin');
  if(url.username||url.password)throw new TypeError(label+' URL credentials are forbidden');
  if(url.search||url.hash)throw new TypeError(label+' URL query or fragment is forbidden');
  if(!url.pathname.startsWith(root.pathname))throw new TypeError(label+' URL escapes release root');
  return url;
}
function absoluteWithinRelease(raw,root,label){
  rejectRawUrl(raw,label);
  let url;try{url=new URL(raw);}catch(error){throw new TypeError(label+' URL is invalid',{cause:error});}
  return assertContained(root,url,label);
}
function relativeWithin(raw,base,root,label,subtree=base){
  rejectRawUrl(raw,label,{relative:true});
  const url=assertContained(root,new URL(raw,base),label);
  if(!url.pathname.startsWith(subtree.pathname))throw new TypeError(label+' URL escapes manifest directory');
  return url;
}
function assertSafeRelativeReference(value,label){rejectRawUrl(value,label,{relative:true});}
function named(root,name){let found=null; root?.traverse?.(node=>{if(!found&&node?.name===name)found=node;});return found;}
function normalizeLock(value,label){
  if(!value||!Number.isSafeInteger(value.bytes)||value.bytes<0||typeof value.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(value.sha256))throw new TypeError(label+' lock is invalid');
  return freeze({bytes:value.bytes,sha256:value.sha256.toUpperCase()});
}
function validParsedRoot(root){return !!root&&typeof root==='object'&&Array.isArray(root.children)&&typeof root.traverse==='function';}
function hasTriangleMesh(root){let found=false;root?.traverse?.(node=>{if(found||node?.isMesh!==true)return;const position=node.geometry?.getAttribute?.('position')||node.geometry?.attributes?.position;const count=Number.isInteger(position?.count)?position.count:Number(position?.array?.length)/(Number(position?.itemSize)||3);if(Number.isInteger(count)&&count>=3)found=true;});return found;}
function filterRoot(root,predicate,mode='visual',blockedNames=new Set()){
  const prune=node=>{
    const name=node?.name||'';
    if(mode==='visual'&&(blockedNames.has(name)||/^COLLISION_/.test(name)))return null;
    const own=!!predicate(name,node);
    if(mode==='collision'&&own)return node;
    if(Array.isArray(node?.children)){
      node.children=node.children.map(prune).filter(Boolean);
      if(mode==='collision'&&!own&&node.children.length===0)return null;
    }
    return own||node?.children?.length?node:null;
  };
  if(!root)return root;
  if(Array.isArray(root.children))root.children=root.children.map(prune).filter(Boolean);
  return root;
}
function disposeRoot(root,seen,walked,errors=[],isOwned=()=>true){
  const owned=(value,kind)=>{
    try{return isOwned(value,kind)!==false;}
    catch(error){errors.push(Object.assign(new Error(kind+' ownership: '+error.message),{cause:error}));return false;}
  };
  const dispose=(value,kind,label)=>{
    if(!value||typeof value.dispose!=='function'||seen.has(value))return;
    seen.add(value);
    if(!owned(value,kind))return;
    try{value.dispose();}
    catch(error){errors.push(Object.assign(new Error(label+': '+error.message),{cause:error}));}
  };
  const walk=value=>{
    if(!value||typeof value!=='object'||walked.has(value)||value instanceof ArrayBuffer||ArrayBuffer.isView(value))return;
    walked.add(value);
    if(value.isTexture||(typeof value.dispose==='function'&&/texture/i.test(value.constructor?.name||'')))dispose(value,'texture','texture dispose');
    if(Array.isArray(value)){for(const child of value)walk(child);return;}
    let children;
    try{children=Object.values(value);}
    catch(error){errors.push(Object.assign(new Error('material resource walk: '+error.message),{cause:error}));return;}
    for(const child of children)walk(child);
  };
  root?.traverse?.(node=>{
    dispose(node?.geometry,'geometry','geometry dispose');
    for(const material of (Array.isArray(node?.material)?node.material:[node?.material])){
      dispose(material,'material','material dispose');
      walk(material);
    }
  });
  dispose(root,'root','root dispose');
  return errors;
}
function lifecycle(label, callback, signal){let result;try{result=callback();}catch(error){return Promise.reject(error);} const bad=()=>new TypeError(label+' mutating hook must return a synchronous value or cancellable handle { promise, cancel }; bare Promise returns are invalid'); if(result&&typeof result.then==='function')return Promise.reject(bad()); if(!(result&&typeof result==='object'&&(Object.hasOwn(result,'promise')||Object.hasOwn(result,'cancel'))))return Promise.resolve(result); if(!result.promise||typeof result.promise.then!=='function'||typeof result.cancel!=='function')return Promise.reject(bad()); let cancelled=false; const cancel=()=>{if(!cancelled){cancelled=true;try{result.cancel(signal.reason||abortError());}catch{}}}; if(signal.aborted){cancel();return Promise.reject(signal.reason||abortError());} let listener; const aborted=new Promise((_,reject)=>{listener=()=>{cancel();reject(signal.reason||abortError());};signal.addEventListener('abort',listener,{once:true});}); return Promise.race([Promise.resolve(result.promise),aborted]).finally(()=>signal.removeEventListener('abort',listener));}
export function createGlbPointToPointAdapter(dependencies, policy) {
  for(const name of ['fetchBytes','completeGlbToObject','createCollisionProbe','createPhysicsBridge','detachPhysicsBridge','installVisualRoot','detachVisualRoot','installCollisionRoot','detachCollisionRoot','applyVisualEnvironment'])requireFn(dependencies,name);
  const releaseRoot=canonicalReleaseRoot(dependencies.releaseRootUrl);
  if(dependencies.registryUrl!==undefined&&typeof dependencies.registryUrl!=='string')throw new TypeError('registryUrl must be a string');
  if(dependencies.isResourceOwned!==undefined&&typeof dependencies.isResourceOwned!=='function')throw new TypeError('isResourceOwned must be a function');
  if(!policy||typeof policy!=='object'||!policy.manifest||!policy.locks)throw new TypeError('policy manifest and locks are required');
  const locked=validateTrackManifest(policy.manifest); if(!locked.ok)throw new TypeError(locked.errors.join('; ')); const expected=locked.manifest;
  const locks={
    manifest:normalizeLock(policy.locks.manifest,'policy manifest'),
    route:normalizeLock(policy.locks.route,'policy route'),
    visual:{},
    collision:{},
  };
  for(const role of ['visual','collision']){
    if(!policy.locks[role]||typeof policy.locks[role]!=='object')throw new TypeError('policy '+role+' locks are invalid');
    for(const relative of expected[role]){
      assertSafeRelativeReference(relative,role+' '+relative);
      if(!Object.hasOwn(policy.locks[role],relative))throw new TypeError(role+' '+relative+' lock is invalid');
      locks[role][relative]=normalizeLock(policy.locks[role][relative],role+' '+relative);
    }
  }
  freeze(locks);
  for(const key of ['visualFilter','collisionFilter'])if(typeof policy[key]!=='function')throw new TypeError('policy '+key+' must be a function');
  const resourceOwned=typeof dependencies.isResourceOwned==='function'?dependencies.isResourceOwned:()=>true;
  const visualCollisionNodes=new Set(expected.collisionNodes||[]);
  let ready=false,state='idle',epoch=0,tx=null,unloading=null,environment=expected.defaultEnvironment,last={};
  const pub=()=>tx&&ready?tx:null;
  const cleanup=async transaction=>{
    if(!transaction||transaction.cleaned)return [];
    transaction.cleaned=true;
    const errors=[],seen=new Set(),walked=new Set(),sig=new AbortController().signal;
    const capture=(label,error)=>errors.push(Object.assign(new Error(label+': '+error.message),{cause:error}));
    const run=async(label,fn)=>{try{await lifecycle(label,fn,sig);}catch(error){capture(label,error);}};
    const runPromise=async(label,fn)=>{try{await fn();}catch(error){capture(label,error);}};

    if(transaction.bridgeSource)await run('physics detach',()=>dependencies.detachPhysicsBridge(transaction.bridgeSource,{signal:sig}));
    if(transaction.disposeBridge)await runPromise('physics dispose',transaction.disposeBridge);
    if(transaction.probe?.dispose)await run('collision probe dispose',()=>transaction.probe.dispose({signal:sig}));

    for(const root of [...(transaction.collisionInstallAttempts||[])].reverse())await run('collision detach',()=>dependencies.detachCollisionRoot(root,{signal:sig}));
    for(const root of [...(transaction.visualInstallAttempts||[])].reverse())await run('visual detach',()=>dependencies.detachVisualRoot(root,{signal:sig}));
    for(const root of [...(transaction.collisionRoots||[])].reverse())disposeRoot(root,seen,walked,errors,resourceOwned);
    for(const root of [...(transaction.visualRoots||[])].reverse())disposeRoot(root,seen,walked,errors,resourceOwned);

    last={live:{geometry:0,material:0,texture:0},cleanupErrors:errors.length};
    transaction.probe=null;
    transaction.bridge=null;
    transaction.bridgeSource=null;
    transaction.disposeBridge=null;
    transaction.visualRoot=null;
    transaction.collisionRoot=null;
    transaction.visualRoots=[];
    transaction.collisionRoots=[];
    transaction.visualInstallAttempts=[];
    transaction.collisionInstallAttempts=[];
    transaction.query=null;
    transaction.route=null;
    transaction.gameplay=null;transaction.closure=null;
    return errors;
  };
  const current=t=>{if(t!==tx||t.token!==epoch||t.controller.signal.aborted)throw abortError();};
  async function verifyLock(label,b,lock,transaction){if(b.byteLength!==lock.bytes)throw new TypeError(label+' byte length mismatch');if(await sha(b)!==lock.sha256)throw new TypeError(label+' SHA-256 mismatch');current(transaction);return b;}
  async function checked(label,url,lock,transaction){const b=bytes(await dependencies.fetchBytes(url,{signal:transaction.controller.signal}),label);current(transaction);return verifyLock(label,b,lock,transaction);}
  async function validate(request={}) { if(request.entry&&request.entry.id&&request.entry.id!==expected.id)throw new TypeError('entry identity mismatch'); return freeze({ok:true,errors:[],manifest:expected}); }
  async function perform(request, transaction) {
    const caller=request.signal;
    const mirror=()=>transaction.controller.abort(caller?.reason);
    if(caller){if(caller.aborted)mirror();else caller.addEventListener('abort',mirror,{once:true});}
    try{
      current(transaction);
      const registry=dependencies.registryUrl===undefined?null:absoluteWithinRelease(dependencies.registryUrl,releaseRoot,'registry');
      const manifestBase=registry?new URL('./',registry):releaseRoot;
      const manifestUrl=relativeWithin(request.manifestUrl||request.entry?.manifest||'manifest.json',manifestBase,releaseRoot,'manifest',manifestBase).href;
      const assetBase=new URL('./',manifestUrl);
      const mbytes=await checked('manifest',manifestUrl,locks.manifest,transaction);
      const fetched=validateTrackManifest(parseLockedJson(mbytes,'manifest'));
      if(!fetched.ok)throw new TypeError(fetched.errors.join('; '));
      if(JSON.stringify(fetched.manifest)!==JSON.stringify(expected))throw new TypeError('manifest identity mismatch');

      const routeUrl=relativeWithin(expected.route,assetBase,releaseRoot,'route',assetBase).href;
      const routeBytes=await checked('route',routeUrl,locks.route,transaction);
      const assetCache=new Map();
      const assetBytes=async (role,relative)=>{
        const url=relativeWithin(relative,assetBase,releaseRoot,role+' '+relative,assetBase).href;
        let value=assetCache.get(url);
        if(!value){value=bytes(await dependencies.fetchBytes(url,{signal:transaction.controller.signal}),role+' '+relative);current(transaction);assetCache.set(url,value);}
        await verifyLock(role+' '+relative,value,locks[role][relative],transaction);
        return value;
      };
      const visualBytes=[];
      const collisionBytes=[];
      for(const relative of expected.visual)visualBytes.push(await assetBytes('visual',relative));
      for(const relative of expected.collision)collisionBytes.push(await assetBytes('collision',relative));

      const sourceRoute=parseLockedJson(routeBytes,'route'),sourceQuery=createRouteQuery(sourceRoute);
      const closure=prepareOptionalClosedRoute(dependencies,sourceRoute,expected.id),route=closure?.route||sourceRoute;
      const query=closure?createRouteQuery(route):sourceQuery,gameplay=createGameplayBridge(query,route,policy.profile||{});
      transaction.closure=closure?.closure||null;
      transaction.visualRoots=[];
      transaction.collisionRoots=[];
      for(let index=0;index<visualBytes.length;index++){
        const root=await dependencies.completeGlbToObject(cloneBytes(visualBytes[index]),'visual['+index+']',{signal:transaction.controller.signal});
        transaction.visualRoots.push(root);
        current(transaction);
        if(!validParsedRoot(root))throw new TypeError('visual root is invalid');
        filterRoot(root,policy.visualFilter,'visual',visualCollisionNodes);
        await (policy.prepareVisual||prepareTrackVisual)(root,{id:expected.id,query:sourceQuery,lengthM:sourceRoute.lengthM,signal:transaction.controller.signal});
        current(transaction);
      }
      for(let index=0;index<collisionBytes.length;index++){
        const root=await dependencies.completeGlbToObject(cloneBytes(collisionBytes[index]),'collision['+index+']',{signal:transaction.controller.signal});
        transaction.collisionRoots.push(root);
        current(transaction);
        if(!validParsedRoot(root))throw new TypeError('collision root is invalid');
        for(const name of policy.requiredSourceCollisionNodes||[]){
          if(!named(root,name))throw new TypeError('collision source missing required node '+name);
        }
        filterRoot(root,policy.collisionFilter,'collision');
      }
      transaction.visualRoot=transaction.visualRoots[0]||null;
      transaction.collisionRoot=transaction.collisionRoots[0]||null;
      if(closure){const roots=attachClosedRouteRoots(closure,transaction.visualRoot,transaction.collisionRoot);await (policy.prepareReturnVisual||prepareReturnScenery)(roots.visualRoot,{id:expected.id,sourceRoot:transaction.visualRoot,query,lengthM:route.lengthM,startM:sourceRoute.lengthM,signal:transaction.controller.signal});current(transaction);}
      for(const name of policy.requiredVisualNodes||[])if(!transaction.visualRoots.some(root=>named(root,name)))throw new TypeError('visual root missing required node '+name);
      for(const name of (policy.requiredCollisionNodes||expected.collisionNodes||[])){const required=transaction.collisionRoots.map(root=>named(root,name)).find(Boolean);if(!required)throw new TypeError('collision root missing required node '+name);if(!hasTriangleMesh(required))throw new TypeError('collision root required node lacks triangle mesh '+name);}

      transaction.visualInstallAttempts=[];
      transaction.collisionInstallAttempts=[];
      for(const root of transaction.visualRoots){transaction.visualInstallAttempts.push(root);await lifecycle('visual install',()=>dependencies.installVisualRoot(root,{signal:transaction.controller.signal,visualRoots:transaction.visualRoots}),transaction.controller.signal);current(transaction);}
      for(const root of transaction.collisionRoots){transaction.collisionInstallAttempts.push(root);await lifecycle('collision install',()=>dependencies.installCollisionRoot(root,{signal:transaction.controller.signal,collisionRoots:transaction.collisionRoots}),transaction.controller.signal);current(transaction);}
      const probe=await lifecycle('collision probe create',()=>dependencies.createCollisionProbe(transaction.collisionRoot,{signal:transaction.controller.signal,collisionRoots:transaction.collisionRoots}),transaction.controller.signal);
      transaction.probe=probe;
      if(!probe||typeof probe.sample!=='function'||typeof probe.getState!=='function')throw new TypeError('collision probe is invalid');
      const bridgeSource=await lifecycle('physics bridge create',()=>dependencies.createPhysicsBridge({collisionRoot:transaction.collisionRoot,collisionRoots:transaction.collisionRoots,visualRoots:transaction.visualRoots,collisionProbe:probe,routeQuery:query,signal:transaction.controller.signal}),transaction.controller.signal);
      transaction.bridgeSource=bridgeSource;
      const bridgeDisposeController=new AbortController();
      let bridgeDisposal=null;
      transaction.disposeBridge=()=>bridgeDisposal||(bridgeDisposal=lifecycle('physics dispose',()=>bridgeSource?.dispose?.({signal:bridgeDisposeController.signal}),bridgeDisposeController.signal));
      if(!bridgeSource||typeof bridgeSource.browserStackFactory!=='function'||typeof bridgeSource.getCollisionRoot!=='function'||typeof bridgeSource.dispose!=='function'||bridgeSource.getCollisionRoot()!==transaction.collisionRoot)throw new TypeError('physics bridge is invalid');
      transaction.bridge=freeze({browserStackFactory:bridgeSource.browserStackFactory.bind(bridgeSource),getCollisionRoot:()=>pub()===transaction?transaction.collisionRoot:null,dispose:transaction.disposeBridge});
      transaction.visualRoots=Object.freeze([...transaction.visualRoots]);
      transaction.collisionRoots=Object.freeze([...transaction.collisionRoots]);
      transaction.query=query;transaction.route=route;transaction.gameplay=gameplay;ready=true;state='ready';return adapter;
    }catch(error){const errors=await cleanup(transaction);ready=false;if(state!=='unloading')state='idle';if(errors.length)error.cleanupErrors=freeze(errors);throw error;}
    finally{if(caller)caller.removeEventListener('abort',mirror);}
  }
  function load(request={}){if(ready)return Promise.resolve(adapter);if(state==='unloading')return Promise.reject(new Error('adapter is unloading'));if(state==='loading')return Promise.reject(new Error('adapter is already loading'));const transaction={token:++epoch,controller:new AbortController(),cleaned:false};tx=transaction;state='loading';return perform(request,transaction);}
  function unload(){if(unloading)return unloading;const transaction=tx;epoch++;ready=false;state='unloading';if(transaction)transaction.controller.abort(abortError());unloading=Promise.resolve().then(()=>cleanup(transaction)).then(errors=>{if(errors.length)throw new AggregateError(errors,'adapter cleanup failed');}).finally(()=>{if(tx===transaction)tx=null;state='idle';unloading=null;});return unloading;}
  function requireReady(){if(!ready||!tx)throw new Error('adapter is not ready');return tx;}
  const resolveRespawn=raceProgressM=>{const t=requireReady();if(!Number.isFinite(raceProgressM))throw new TypeError('raceProgressM must be finite');const progress=respawnRouteDistance(t.route,raceProgressM),r=t.query.respawnFor(progress.sM);return freeze({sM:r.sM,raceProgressM:progress.lapPrefixM+r.sM,position:[...r.position],frame:{tangent:[...r.frame.tangent],left:[...r.frame.left],normal:[...r.frame.normal]},lateralM:r.lateralM,clearanceM:RESPAWN_CLEARANCE_M,sectorId:r.sectorId});};
  const spawn=(sample,position,grid)=>freeze({position:[...position],frame:freeze({tangent:[...sample.frame.tangent],left:[...sample.frame.left],normal:[...sample.frame.normal]}),progress:freeze({sM:sample.sM,u:sample.sM/tx.route.lengthM,sectorId:sample.sectorId}),grid:freeze({...grid})});
  const adapter={};Object.defineProperties(adapter,{id:{enumerable:true,value:expected.id},ready:{enumerable:true,get:()=>ready},environmentProfile:{enumerable:true,value:expected.environment},visualRoot:{enumerable:true,get:()=>pub()?.visualRoots?.[0]||null},collisionRoot:{enumerable:true,get:()=>pub()?.collisionRoots?.[0]||null},collisionProbe:{enumerable:true,get:()=>pub()?.probe||null},physicsBridge:{enumerable:true,get:()=>pub()?.bridge||null},routeQuery:{enumerable:true,get:()=>pub()?.query||null},gameplay:{enumerable:true,get:()=>pub()?.gameplay||null},sectors:{enumerable:true,get:()=>ready?freeze(structuredClone(tx.route.sectors)):freeze([])},respawns:{enumerable:true,get:()=>ready?freeze(structuredClone(tx.route.respawns)):freeze([])},validate:{value:validate,enumerable:true},load:{value:load,enumerable:true},unload:{value:unload,enumerable:true},sampleRoute:{enumerable:true,value:s=>{const t=requireReady(),q=t.query.sample(s),g=t.gameplay.sample(s);return freeze({...q,curvature:g.curvature,bankRad:g.bank,targetSpeedKph:g.targetSpeedKph,idealLineOffsetM:t.gameplay.idealLineOffset(q.sM)});}},projectToRoute:{enumerable:true,value:(...args)=>requireReady().query.project(...args)},surfaceAt:{enumerable:true,value:(a,b,c,d)=>typeof a==='number'?requireReady().gameplay.surfaceAt(a,b,c):requireReady().query.surfaceAt(a,b,c||d)},resolveRespawn:{enumerable:true,value:resolveRespawn},getSpawn:{enumerable:true,value:(kind,index=0)=>{const t=requireReady();if(kind==='chevy'){const q=t.query.sample(0);return spawn(q,q.position,{rearwardM:0,lateralM:0});}if(kind==='falcon'){const q=t.query.sample(0),r=4.5,l=Math.min(1.25,q.widthM*.25),p=q.position.map((x,i)=>x-q.frame.tangent[i]*r+q.frame.left[i]*l);return spawn(q,p,{rearwardM:r,lateralM:l});}if(kind==='respawn'){const r=t.route.respawns[index];if(!r)throw new RangeError('respawn index out of range: '+index);const q=t.query.respawnFor(r.sM);return spawn(q,q.position,{rearwardM:0,lateralM:r.lateralM});}throw new RangeError('unknown spawn: '+kind);}},getCheckpoints:{enumerable:true,value:()=>{const t=requireReady();return freeze(t.route.checkpoints.map((x,i)=>freeze({...t.query.checkpointAt(i),id:'checkpoint_'+(i+1),finish:i===t.route.checkpoints.length-1})));}},updateStreaming:{enumerable:true,value:context=>{const t=requireReady();const result=policy.updateStreaming?policy.updateStreaming(t.visualRoots[0],context,t.visualRoots):{};if(!result||typeof result!=='object')return result;return Object.freeze(Array.isArray(result)?[...result]:{...result});}},applyEnvironment:{enumerable:true,value:async id=>{const t=requireReady();if(!ENV.has(id))throw new RangeError('unsupported environment: '+id);for(const root of t.visualRoots){await lifecycle('visual environment',()=>dependencies.applyVisualEnvironment(root,id,{signal:t.controller.signal,visualRoots:t.visualRoots}),t.controller.signal);if(policy.applyEnvironment)await lifecycle('policy environment',()=>policy.applyEnvironment(root,id,{signal:t.controller.signal,visualRoots:t.visualRoots}),t.controller.signal);}current(t);environment=id;}},getDiagnostics:{enumerable:true,value:()=>freeze({id:expected.id,state,environment,closed:ready?tx.route.closed===true:false,lengthM:ready?tx.route.lengthM:0,closure:ready?tx.closure:null,live:ready?{visualRoots:tx.visualRoots.length,collisionRoots:tx.collisionRoots.length,collisionProbes:1,physicsBridges:1,geometry:0,material:0,texture:0}:last.live||{geometry:0,material:0,texture:0}})}});Object.defineProperty(adapter,'getMaterialBindings',{enumerable:true,value:()=>ready?collectMaterialBindings(tx.visualRoots,policy.materialRoles||{}):freeze([])});return Object.freeze(adapter);
}
