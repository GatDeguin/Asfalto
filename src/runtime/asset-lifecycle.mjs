/**
 * Explicit scene leases. Every workshop/race/cache owner must register before a
 * shared resource can be released. Switching a scene does not destroy the renderer.
 */
export function createAssetLifecycleManager({ renderer, isExternalResource = () => false } = {}) {
  const refs = new Map(), scopes = new Set(), targetForTexture = new WeakMap();
  let closed = false;
  function resourceOwner(resource) { return targetForTexture.get(resource) || resource; }
  function retain(scope, resource) {
    if (!resource || isExternalResource(resource) || typeof resource.dispose !== 'function') return resource;
    if (scope.released || (closed && !scope.cleanup)) throw new Error('Asset scope is closed');
    resource = resourceOwner(resource);
    if (!scope.resources.has(resource)) {
      scope.resources.add(resource); refs.set(resource, (refs.get(resource) || 0) + 1);
    }
    return resource;
  }
  function textures(value, scope, seen) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    if (value.isTexture) { retain(scope, value); return; }
    if (ArrayBuffer.isView(value) || value.isObject3D || value.isBufferGeometry) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) textures(item, scope, seen); }
    else for (const key of Object.keys(value)) textures(value[key], scope, seen);
  }
  function scan(root, scope) {
    const seen = new Set();
    root.traverse(node => {
      if(node.isInstancedMesh)retain(scope,node);
      retain(scope, node.geometry);
      if (node.isSkinnedMesh && node.skeleton?.boneTexture) retain(scope, node.skeleton.boneTexture);
      const materials = Array.isArray(node.material) ? [...node.material] : [node.material];
      materials.push(node.customDepthMaterial,node.customDistanceMaterial);
      if(node.isLight&&node.shadow)retain(scope,node.shadow);
      for (const material of materials) {
        if (!material) continue;
        retain(scope, material);
        for (const key of Object.keys(material)) if (material[key]?.isTexture) retain(scope, material[key]);
        textures(material.uniforms, scope, seen);
        // onBeforeCompile uniforms are not owned by Three's material object.
        textures(material.userData?.assetUniforms, scope, seen);
      }
    });
    if (root.isScene) { retain(scope, root.environment); retain(scope, root.background); }
    scope.roots.add(root); return root;
  }
  function release(scope) {
    if (scope.released) return false;
    scope.released = true;
    const errors=[];
    for (const root of scope.roots) {
      try { root.removeFromParent(); if (root.isScene) { root.environment = null; root.background = null; } } catch(error) { errors.push(error); }
    }
    // Materials and buffers may share textures. Counts, not traversal order, own them.
    for (const resource of scope.resources) {
      const count = refs.get(resource);
      if (count > 1) refs.set(resource, count - 1);
      else { refs.delete(resource); try { resource.dispose(); } catch(error) { errors.push(error); } }
    }
    scope.resources.clear(); scope.roots.clear(); scopes.delete(scope);
    // Release references to the previous scene retained by render lists.
    try { renderer?.renderLists?.dispose(); } catch(error) { errors.push(error); }
    if(errors.length)throw new AggregateError(errors,'Asset release failed after completing cleanup');
    return true;
  }
  return {
    disposeRoot(root){const scope={label:'late-cleanup',resources:new Set(),roots:new Set(),released:false,cleanup:true};scan(root,scope);release(scope);},
    createScope(label = 'assets') {
      if (closed) throw new Error('Asset manager is closed');
      const scope = { label, resources: new Set(), roots: new Set(), released: false };
      scopes.add(scope);
      return {
        label,
        track: resource => retain(scope, resource),
        trackRoot: root => scan(root, scope),
        /** Register before exposing target.texture to any other owner. */
        trackTarget(target) {
          const attachments = [...(target.textures || [target.texture]),target.depthTexture].filter(Boolean);
          for (const texture of attachments) {
            if(refs.has(texture))throw new Error('Register render target before its attachments');
            const owner=targetForTexture.get(texture);if(owner&&owner!==target)throw new Error('Attachment already has an owner');
          }
          for (const texture of attachments) targetForTexture.set(texture, target);
          return retain(scope, target);
        },
        dispose: () => release(scope),
      };
    },
    dispose() { if (closed) return; closed=true;const errors=[];for (const scope of scopes) { try { release(scope); } catch(error) { errors.push(error); } }if(errors.length)throw new AggregateError(errors,'Asset manager cleanup failed'); },
    diagnostics: () => ({ scopes: scopes.size, resources: refs.size, closed }),
  };
}

/** One-shot exclusive ownership, or pass an existing registered lease for sharing. */
export function disposeAssets(root, { scope = null, manager = null, renderer = null } = {}) {
  if (scope) { scope.dispose(); return; }
  const owner = manager || createAssetLifecycleManager({ renderer });
  owner.disposeRoot(root);
  if (!manager) owner.dispose();
}

/**
 * Downloads run concurrently; GLTFLoader.parseAsync is serialized between frames.
 * Draco/Meshopt workers must be configured on the supplied loader. JSON/scene
 * construction and GPU uploads still execute on main: no hard 60fps guarantee.
 */
export class AssetPipeline {
  constructor({ loader, concurrency = 2, capacity = 32, lifecycle = null, yieldTask = null } = {}) {
    if (!loader?.parseAsync) throw new TypeError('A configured GLTFLoader is required');
    this.loader = loader; this.lifecycle = lifecycle;
    this.concurrency = Math.max(1, Math.min(4, concurrency | 0));
    this.queue = new Array(Math.max(1, capacity | 0)); this.head = 0; this.tail = 0; this.count = 0;
    this.active = new Set(); this.decodeTail = Promise.resolve(); this.closed = false;
    this.yieldTask = yieldTask || yieldAssetTask;
  }
  enqueue(url, { signal = null, scope = null, sha256 = null, expectedBytes = null } = {}) {
    if(signal?.aborted)return Promise.reject(signal.reason || new DOMException('Aborted','AbortError'));
    if (this.closed || this.count === this.queue.length) return Promise.reject(new Error('Asset queue unavailable'));
    return new Promise((resolve, reject) => {
      const job = { url, signal, scope, sha256, expectedBytes, resolve, reject, controller: new AbortController() };
      this.queue[this.tail] = job; this.tail = (this.tail + 1) % this.queue.length; this.count++;
      this.pump();
    });
  }
  pump() {
    while (!this.closed && this.count && this.active.size < this.concurrency) {
      const job = this.queue[this.head]; this.queue[this.head] = null;
      this.head = (this.head + 1) % this.queue.length; this.count--;
      this.active.add(job); this.run(job);
    }
  }
  async run(job) {
    const abort = () => job.controller.abort(job.signal?.reason);
    job.signal?.addEventListener('abort', abort, { once: true });
    if (job.signal?.aborted) abort();
    let gltf = null;
    try {
      const requestUrl=new URL(job.url,globalThis.location?.href||'http://localhost/');
      if(job.sha256)requestUrl.searchParams.set('v',job.sha256.slice(0,16));
      const response = await fetch(requestUrl.href, { signal: job.controller.signal });
      if (!response.ok) throw new Error('GLB HTTP ' + response.status);
      const buffer = await response.arrayBuffer();
      if(job.expectedBytes!==null&&buffer.byteLength!==job.expectedBytes)throw new Error('GLB size mismatch');
      if(job.sha256){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));let hex='';for(let i=0;i<digest.length;i++)hex+=digest[i].toString(16).padStart(2,'0');if(hex.toLowerCase()!==job.sha256.toLowerCase())throw new Error('GLB integrity mismatch');}
      const base = new URL('.', new URL(job.url, globalThis.location?.href || 'http://localhost/')).href;
      // Recover the serial queue after a failed decoder rather than poisoning it.
      const task = this.decodeTail.then(async () => {
        await this.yieldTask();
        job.controller.signal.throwIfAborted();
        if (this.closed) throw new Error('Asset pipeline closed');
        return this.loader.parseAsync(buffer, base, {signal:job.controller.signal,checkpoint:createAssetFrameBudget({signal:job.controller.signal,yieldTask:this.yieldTask})});
      });
      this.decodeTail = task.then(() => undefined, () => undefined);
      gltf = await task;
      if (this.closed || job.controller.signal.aborted) {
        const cancelled=gltf;gltf=null;disposeAssets(cancelled.scene,{manager:this.lifecycle});
        throw job.controller.signal.reason || new Error('Asset pipeline closed');
      }
      job.scope?.trackRoot(gltf.scene);
      job.resolve(gltf);
    } catch (error) { try { if(gltf)disposeAssets(gltf.scene,{manager:this.lifecycle}); } catch(cleanupError) { error=new AggregateError([error,cleanupError],'Asset load and cleanup failed'); } finally { job.reject(error); } }
    finally { job.signal?.removeEventListener('abort', abort); this.active.delete(job); this.pump(); }
  }
  dispose() {
    if (this.closed) return; this.closed = true;
    for (const job of this.active) job.controller.abort(new Error('Asset pipeline closed'));
    while (this.count) {
      const job = this.queue[this.head]; this.queue[this.head] = null;
      this.head = (this.head + 1) % this.queue.length; this.count--;
      job.reject(new Error('Asset pipeline closed'));
    }
  }
}


/** Yield a task, not just a microtask; hidden tabs must not wait for rAF. */
export function yieldAssetTask(){return globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));}
/** Cooperative budget: one indivisible primitive/decode/upload can exceed it. */
export function createAssetFrameBudget({budgetMs=4,signal=null,yieldTask=yieldAssetTask}={}){
 let started=performance.now();
 return async function checkpoint(){signal?.throwIfAborted();if(performance.now()-started>=budgetMs){await yieldTask();started=performance.now();signal?.throwIfAborted();}};
}
