import {createTrackManager} from "../tracks/track-manager.mjs";
import {createDosLagosAdapter} from "../tracks/adapters/dos-lagos.mjs?v=balance-20260917";
import {createAconcaguaHorconesAdapter} from "../tracks/adapters/aconcagua-horcones.mjs?v=balance-20260917";
import {createCuestaLipanAdapter} from "../tracks/adapters/cuesta-lipan.mjs?v=balance-20260917";
import {createPasoGaribaldiAdapter} from "../tracks/adapters/paso-garibaldi.mjs?v=balance-20260917";

import {createIguazuAdapter} from "../tracks/adapters/cataratas-iguazu.mjs?v=balance-20260917";

const releaseRootUrl=new URL("../../",import.meta.url).href;
const registryUrl=new URL("tracks/registry.json",releaseRootUrl).href;
const releaseManifestUrl=new URL("assets/manifests/release.json",releaseRootUrl).href;

function deepFreeze(value){if(!value||typeof value!=="object"||Object.isFrozen(value))return value;for(const child of Object.values(value))deepFreeze(child);return Object.freeze(value)}
async function fetchJson(url,label,{signal}={}){const response=await fetch(url,{credentials:"same-origin",signal});if(!response.ok)throw new Error(label+" request failed: "+response.status);return response.json()}

let runtimeBoundary=null;
let trackManager=null;
let registry=null;
let releaseManifest=null;
let connectPromise=null;
let bootPromise=null;
let shutdownPromise=null;
let bootStatus="idle";
let bootError=null;
let shutdownRequested=false;
let hostInitialization=null;
const lifecycleAbort=new AbortController();
let resolveReady;
let rejectReady;
const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
ready.catch(()=>{});
const cleanup={attempts:0,completed:0,failures:[]};

function reportFailure(error,phase){const message=String(error?.message||error);if(phase==="boot"){bootStatus="failed";bootError=message;try{runtimeBoundary?.onBootError?.(error)}catch(callbackError){cleanup.failures.push(String(callbackError?.message||callbackError))}try{globalThis.dispatchEvent?.(new CustomEvent("asfalto-v6-modular-error",{detail:{phase,error:message}}))}catch{}}else{cleanup.failures.push(message);for(const cause of error?.errors||[])cleanup.failures.push(String(cause?.message||cause))}}
function createManager(){return createTrackManager({registry,createAdapter(id,entry){if(!runtimeBoundary)throw new Error("modular runtime boundary is not connected");const factory=id==="dos_lagos"?createDosLagosAdapter:id==="aconcagua_horcones"?createAconcaguaHorconesAdapter:id==="cuesta_lipan"?createCuestaLipanAdapter:id==="paso_garibaldi"?createPasoGaribaldiAdapter:id==="cataratas_iguazu"?createIguazuAdapter:null;if(!factory)throw new RangeError("no adapter factory for track: "+id);return factory({...runtimeBoundary,releaseRootUrl,registryUrl,manifestUrl:entry.manifest})}})}
async function ensureBoot(){if(bootPromise)return bootPromise;bootStatus="loading";bootPromise=Promise.all([fetchJson(registryUrl,"track registry",{signal:lifecycleAbort.signal}),fetchJson(releaseManifestUrl,"release manifest",{signal:lifecycleAbort.signal})]).then(([nextRegistry,nextManifest])=>{if(shutdownRequested)throw new Error("modular host shutdown during boot");registry=deepFreeze(nextRegistry);releaseManifest=deepFreeze(nextManifest);trackManager=createManager();bootStatus="ready";return Object.freeze({registry,releaseManifest,trackManager})}).catch(error=>{reportFailure(error,"boot");rejectReady(error);throw error});bootPromise.catch(()=>{});return bootPromise}

export function connectModularHost(boundary){if(!boundary||typeof boundary!=="object")return Promise.reject(new TypeError("modular runtime boundary is required"));if(runtimeBoundary&&runtimeBoundary!==boundary)return Promise.reject(new Error("modular runtime boundary is already connected"));if(connectPromise)return connectPromise;runtimeBoundary=Object.freeze({...boundary});connectPromise=ensureBoot().then(({registry:loadedRegistry,trackManager:manager})=>{const selectedId=boundary.trackId||loadedRegistry.tracks.find(entry=>entry.status==="ready")?.id;return manager.select(selectedId)}).then(adapter=>{if(shutdownRequested||lifecycleAbort.signal.aborted)throw lifecycleAbort.signal.reason||new Error("modular host shutdown during selection");resolveReady(adapter);return adapter});connectPromise.catch(()=>{});return connectPromise}

async function selectTrack(id){if(shutdownRequested||lifecycleAbort.signal.aborted)throw lifecycleAbort.signal.reason||new Error("modular host shutdown during selection");const {trackManager:manager}=await ensureBoot();const adapter=await manager.select(id);if(shutdownRequested||lifecycleAbort.signal.aborted)throw lifecycleAbort.signal.reason||new Error("modular host shutdown during selection");if(adapter?.ready!==true)throw new Error("selected track did not become ready: "+id);return adapter}
function beginHostInitialization(){
 if(hostInitialization)return hostInitialization.api;
 let resolveCompletion;let rejectCompletion;let settled=false;let failure=null;let ownedOperation=null;
 const completion=new Promise((resolve,reject)=>{resolveCompletion=resolve;rejectCompletion=reject});completion.catch(()=>{});
 const abortError=()=>lifecycleAbort.signal.reason||new Error("modular host shutdown during initialization");
 const finish=(error)=>{if(settled)return;settled=true;failure=error||null;if(error)rejectCompletion(error);else resolveCompletion(Object.freeze({completed:true}));};
 const api={
  get signal(){return lifecycleAbort.signal;},
  assertActive(){if(shutdownRequested||lifecycleAbort.signal.aborted)throw abortError();},
  waitFor(value){api.assertActive();return Promise.resolve(value).then(result=>{api.assertActive();return result},error=>{if(!ownedOperation)finish(error);throw error});},
  own(operation){if(typeof operation!=="function")return Promise.reject(new TypeError("host initialization operation is required"));if(ownedOperation)return ownedOperation;api.assertActive();ownedOperation=Promise.resolve().then(()=>operation(api)).then(result=>{api.assertActive();finish();return result},error=>{finish(error);throw error});ownedOperation.catch(()=>{});return ownedOperation;},
  complete(){api.assertActive();finish();},
  fail(error){finish(error||abortError());},
 };
 hostInitialization={api:Object.freeze(api),promise:completion,get settled(){return settled},get failure(){return failure}};
 lifecycleAbort.signal.addEventListener("abort",()=>{if(!ownedOperation)finish(abortError())},{once:true});
 return hostInitialization.api;
}
function runtimeCleanupDiagnostics(){try{return runtimeBoundary?.getRuntimeCleanupDiagnostics?.()||null}catch(error){cleanup.failures.push(String(error?.message||error));return null}}
export function shutdownModularHost(){if(shutdownPromise)return shutdownPromise;shutdownRequested=true;lifecycleAbort.abort(new Error("modular host shutdown"));cleanup.attempts+=1;shutdownPromise=Promise.resolve().then(async()=>{await Promise.allSettled([bootPromise,connectPromise,hostInitialization?.promise].filter(Boolean));const results=await Promise.allSettled([Promise.resolve().then(()=>trackManager?.unload?.()),Promise.resolve().then(()=>runtimeBoundary?.disposeRuntime?.())]);const failures=results.filter(result=>result.status==="rejected").map(result=>result.reason);if(failures.length)throw new AggregateError(failures,"modular shutdown failed");cleanup.completed+=1;return Object.freeze({completed:true})}).catch(error=>{reportFailure(error,"shutdown");throw error});shutdownPromise.catch(()=>{});return shutdownPromise}

function getDiagnostics(){const active=trackManager?.active;const host=hostInitialization?Object.freeze({settled:hostInitialization.settled,aborted:lifecycleAbort.signal.aborted,failure:hostInitialization.failure?String(hostInitialization.failure?.message||hostInitialization.failure):null}):null;return Object.freeze({ready:active?.ready===true,activeTrackId:active?.id||null,bootStatus,bootError,registrySchema:registry?.schema||null,releaseSchema:releaseManifest?.schema||null,track:active?.getDiagnostics?.()||null,cleanup:Object.freeze({attempts:cleanup.attempts,completed:cleanup.completed,failures:[...cleanup.failures],runtime:runtimeCleanupDiagnostics(),hostInitialization:host})})}

const facade=Object.freeze({ready,selectTrack,get trackManager(){return trackManager},getDiagnostics,get releaseManifest(){return releaseManifest},beginHostInitialization,shutdown:shutdownModularHost});
Object.defineProperty(globalThis,"__asfaltoV6Modular",{value:facade,enumerable:false,configurable:false,writable:false});
globalThis.addEventListener?.("pagehide",event=>{if(event.persisted)return;const shared=shutdownModularHost();shared.catch(error=>{reportFailure(error,"pagehide")})});

export {facade as modularFacade};
