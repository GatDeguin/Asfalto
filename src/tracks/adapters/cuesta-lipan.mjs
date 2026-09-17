import { prepareOptionalClosedRoute, attachClosedRouteRoots, respawnRouteDistance, sourceStreamingDistance } from './closed-route-support.mjs';
import { createGameplayBridge } from '../gameplay-bridge.mjs';
import { createRouteQuery } from '../route-query.mjs';
import { createSectorStreamer } from '../sector-streamer.mjs';
import { updateSectorVisualQuality } from '../sector-visual-quality.mjs';
import { RESPAWN_CLEARANCE_M, validateTrackManifest } from '../track-contract.mjs';
import { collectMaterialBindings } from '../../environment/material-bindings.mjs';
import { prepareTrackVisual } from '../visuals/reference-landscape.mjs?v=body-r3-20260916';

const MANIFEST_LOCK = Object.freeze({
  bytes: 21230,
  sha256: '78009A158F4CB10AF5BE71AA012D1CB6FD97E2DCD195D371BAB91DF4ED7768F6',
});
const COLLISION_LOCKS = Object.freeze({
  S01: Object.freeze({ bytes: 60584, sha256: '65BD55D687DBC5A8FF7EAB4D553DE544DFE8D0D6AFEB2D44D75C85CDF32EE71A' }),
  S02: Object.freeze({ bytes: 69656, sha256: 'B2F16F24FF5A7CD2D6C561CC06EBCD1CD41122FFD460C6100480AD01BCF3AAA4' }),
  S03: Object.freeze({ bytes: 76884, sha256: '22C020B96D41A4A7E0348F2B42161F3053D098D821EB0FF791837F9097574865' }),
  S04: Object.freeze({ bytes: 63476, sha256: '1ABFE3A0A3FA6208930A3DD13FA76CD417C948E8CC89F5F01C356CE9FB868715' }),
  S05: Object.freeze({ bytes: 73512, sha256: 'FF7AEFC5FEE45B6B3F5D1309B24B40D47829ED9BDA15E777D34848CDAD7A91E7' }),
  S06: Object.freeze({ bytes: 65048, sha256: '0D1C27161BC600F8C30E7B84A9A5F80B25C1AE6A8F3B1B3BA488B57DE23DC2E8' }),
  S07: Object.freeze({ bytes: 69564, sha256: '862022F3EA713C687E4A5974E0AA4E659C744BAF05FE62A4CB1C6234848F9996' }),
  S08: Object.freeze({ bytes: 60344, sha256: 'FA741E6F46CF39E2D365C4B0F3572FD990F00F5825C00BC81591719C34709131' }),
});
const ENVIRONMENTS = new Set(['clear', 'overcast', 'golden', 'sunset', 'moonrise', 'night']);
const PROFILE = Object.freeze({
  id: 'cuesta_lipan',
  name: 'Cuesta de Lipán',
  description: 'Ruta de altura en la Puna, con asfalto seco, polvo mineral y fuertes desniveles.',
  biome: 'puna_high_altitude',
  environment: 'golden',
  shoulder: 1.4,
  barrier: 3.1,
  palette: Object.freeze({ rock: '#8b6043', dust: '#b98658', asphalt: '#34312e', snow: '#e5e1d8' }),
});

function freeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function requireFunction(dependencies, name) {
  if (typeof dependencies?.[name] !== 'function') throw new TypeError(`${name} must be a function`);
}

function asBytes(value, label) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError(`${label} must be bytes`);
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 Web Crypto is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new TypeError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
}

function abortError(reason) {
  if (reason instanceof Error && reason.name === 'AbortError') return reason;
  const error = new Error('Cuesta de Lipán load aborted');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function canonicalRoot(raw) {
  let root;
  try { root = new URL(raw); } catch { throw new TypeError('releaseRootUrl must be an absolute URL'); }
  if (!root.pathname.endsWith('/') || root.username || root.password || root.search || root.hash) {
    throw new TypeError('releaseRootUrl must be a canonical directory URL');
  }
  return root;
}

function safeUrl(raw, base, root, label) {
  if (typeof raw !== 'string' || !raw || raw.includes('\\') || raw.includes('\0')
      || raw.includes('%') || raw.includes('?') || raw.includes('#')) {
    throw new TypeError(`${label} must be a canonical release URL`);
  }
  let url;
  try { url = new URL(raw, base); } catch { throw new TypeError(`${label} must be a valid release URL`); }
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) {
    throw new TypeError(`${label} must stay beneath the release root`);
  }
  return url;
}

function normalizeLock(value, label) {
  if (!value || !Number.isSafeInteger(value.bytes) || value.bytes < 0
      || typeof value.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(value.sha256)) {
    throw new TypeError(`${label} integrity lock is invalid`);
  }
  return Object.freeze({ bytes: value.bytes, sha256: value.sha256.toUpperCase() });
}

function sameLock(first, second) {
  return first.bytes === second.bytes && first.sha256.toUpperCase() === second.sha256.toUpperCase();
}

// The authored manifest stores Blender-space vectors [x,y,z]. glTF and the game use
// Y-up [x,z,-y]. Applying this once keeps route queries, colliders and rendered sectors aligned.
function toRuntimeYUp(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must contain three finite numbers`);
  }
  return [value[0], value[2], -value[1]];
}

function normalizeRoute(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.samples)) {
    throw new TypeError('Cuesta route must be an object with samples');
  }
  return freeze({
    ...raw,
    samples: raw.samples.map((sample, index) => ({
      ...sample,
      position: toRuntimeYUp(sample.position, `samples[${index}].position`),
      tangent: toRuntimeYUp(sample.tangent, `samples[${index}].tangent`),
      left: toRuntimeYUp(sample.left, `samples[${index}].left`),
      normal: toRuntimeYUp(sample.normal, `samples[${index}].normal`),
      bank: Number(sample.bankRad) || 0,
    })),
    sectors: raw.sectors.map((sector) => ({ ...sector })),
    checkpoints: raw.checkpoints.map((checkpoint) => ({ ...checkpoint })),
    respawns: raw.respawns.map((respawn) => ({ ...respawn })),
  });
}

function validateLockedManifest(raw) {
  const result = validateTrackManifest(raw);
  if (!result.ok) throw new TypeError(`invalid Cuesta manifest: ${result.errors.join('; ')}`);
  const manifest = result.manifest;
  if (manifest.id !== 'cuesta_lipan' || manifest.lengthM !== 20000
      || manifest.defaultEnvironment !== 'golden' || manifest.route !== './route.json'
      || manifest.visual.length !== 24 || manifest.collision.length !== 8) {
    throw new TypeError('Cuesta manifest identity drift');
  }
  if (raw.streaming?.schema !== 'asfalto-sector-streaming/v1'
      || raw.streaming?.decoder !== '../../assets/vendor/meshopt/meshopt_decoder.module.js'
      || !Array.isArray(raw.streaming?.sectors) || raw.streaming.sectors.length !== 8) {
    throw new TypeError('Cuesta streaming contract drift');
  }
  normalizeLock(raw.integrity?.route, 'route');
  const decoderLock = normalizeLock(raw.integrity?.decoder, 'decoder');
  if (raw.integrity.decoder.url !== raw.streaming.decoder) throw new TypeError('Cuesta decoder URL drift');
  const seenVisual = new Set();
  const seenCollision = new Set();
  for (const [index, sector] of raw.streaming.sectors.entries()) {
    const expectedId = `S${String(index + 1).padStart(2, '0')}`;
    if (sector.id !== expectedId || sector.routeSectorId !== expectedId.toLowerCase()) {
      throw new TypeError(`Cuesta streaming sector identity drift at ${index}`);
    }
    toRuntimeYUp(sector.localOrigin, `${sector.id}.localOrigin`);
    for (let lod = 0; lod <= 2; lod += 1) {
      const asset = sector.visual?.[`lod${lod}`];
      const lock = normalizeLock(asset, `${sector.id}.lod${lod}`);
      const integrity = normalizeLock(raw.integrity?.visual?.[asset.url], `${asset?.url} manifest`);
      if (!sameLock(lock, integrity) || !manifest.visual.includes(asset.url)) throw new TypeError(`${sector.id}.lod${lod} integrity drift`);
      seenVisual.add(asset.url);
    }
    const collision = normalizeLock(sector.collision, `${sector.id}.collision`);
    const collisionIntegrity = normalizeLock(raw.integrity?.collision?.[sector.collision.url], `${sector.collision?.url} manifest`);
    const collisionHardLock = COLLISION_LOCKS[sector.id];
    if (!sameLock(collision, collisionIntegrity) || !sameLock(collision, collisionHardLock)
        || !manifest.collision.includes(sector.collision.url)) {
      throw new TypeError(`${sector.id}.collision integrity drift`);
    }
    seenCollision.add(sector.collision.url);
  }
  if (seenVisual.size !== 24 || seenCollision.size !== 8) throw new TypeError('Cuesta streaming asset coverage drift');
  return Object.freeze({ manifest, raw: freeze(raw), decoderLock });
}

export function validateCuestaLipanManifest(raw) {
  return validateLockedManifest(raw);
}

function setPosition(root, value) {
  if (root?.position?.fromArray) root.position.fromArray(value);
  else if (root?.position && typeof root.position === 'object') {
    [root.position.x, root.position.y, root.position.z] = value;
  } else root.position = [...value];
  root.updateMatrixWorld?.(true);
}

function validRoot(root) {
  return Boolean(root && typeof root === 'object' && Array.isArray(root.children)
    && typeof root.add === 'function' && typeof root.traverse === 'function');
}

function qualityTier(value) {
  if (value === 'eco' || value === 'low') return 'low';
  if (value === 'balanced') return 'balanced';
  return 'high';
}

function sectorAt(sectors, sM) {
  return sectors.find((sector, index) => sM >= sector.startM
    && (index === sectors.length - 1 ? sM <= sector.endM : sM < sector.endM));
}

export function createCuestaLipanAdapter(dependencies) {
  for (const name of [
    'fetchBytes', 'completeGlbToObject', 'createTrackRoot', 'disposeObjectRoot',
    'installVisualRoot', 'detachVisualRoot', 'installCollisionRoot', 'detachCollisionRoot',
    'createCollisionProbe', 'createPhysicsBridge', 'detachPhysicsBridge', 'applyVisualEnvironment',
  ]) requireFunction(dependencies, name);

  const releaseRoot = canonicalRoot(dependencies.releaseRootUrl);
  const registryUrl = safeUrl(dependencies.registryUrl || new URL('tracks/registry.json', releaseRoot).href,
    releaseRoot, releaseRoot, 'registry');
  let ready = false;
  let state = 'idle';
  let epoch = 0;
  let transaction = null;
  let loading = null;
  let unloading = null;
  let lastDiagnostics = freeze({ id: 'cuesta_lipan', state: 'idle', live: { visualRoots: 0, collisionRoots: 0 } });

  function current(tx) {
    if (transaction !== tx || tx.token !== epoch || tx.controller.signal.aborted) {
      throw abortError(tx.controller.signal.reason);
    }
  }

  async function fetchLocked(url, lockValue, label, tx, signal = tx.controller.signal) {
    const lock = normalizeLock(lockValue, label);
    const bytes = asBytes(await dependencies.fetchBytes(url, { signal }), label);
    current(tx);
    if (bytes.byteLength !== lock.bytes) throw new TypeError(`${label} byte length mismatch`);
    if (await sha256(bytes) !== lock.sha256) throw new TypeError(`${label} SHA-256 mismatch`);
    current(tx);
    return bytes;
  }

  function disposeOnce(tx, root) {
    if (!root || tx.disposedRoots.has(root)) return;
    tx.disposedRoots.add(root);
    dependencies.disposeObjectRoot(root);
  }

  async function cleanup(tx) {
    if (!tx || tx.cleaned) return;
    tx.cleaned = true;
    tx.controller.abort(abortError());
    if (tx.streamer) {
      try { await tx.streamer.dispose(); } catch (error) { tx.cleanupErrors.push(error); }
    }
    if (tx.physicsBridge) {
      try { await dependencies.detachPhysicsBridge(tx.physicsBridge); } catch (error) { tx.cleanupErrors.push(error); }
      try { await tx.physicsBridge.dispose?.(); } catch (error) { tx.cleanupErrors.push(error); }
    }
    try { await tx.collisionProbe?.dispose?.(); } catch (error) { tx.cleanupErrors.push(error); }
    if (tx.collisionInstalled) {
      try { await dependencies.detachCollisionRoot(tx.collisionRoot); } catch (error) { tx.cleanupErrors.push(error); }
    }
    if (tx.visualInstalled) {
      try { await dependencies.detachVisualRoot(tx.visualRoot); } catch (error) { tx.cleanupErrors.push(error); }
    }
    try { disposeOnce(tx, tx.visualRoot); } catch (error) { tx.cleanupErrors.push(error); }
    try { disposeOnce(tx, tx.collisionRoot); } catch (error) { tx.cleanupErrors.push(error); }
    lastDiagnostics = freeze({
      id: 'cuesta_lipan', state: 'idle', environment: tx.environment,
      live: { visualRoots: 0, collisionRoots: 0, collisionProbes: 0, physicsBridges: 0 },
      ownershipRemainder: 0,
      ownershipErrors: tx.cleanupErrors.length,
      cleanupErrors: tx.cleanupErrors.map((error) => String(error?.message || error)),
    });
    tx.collisionById.clear();
    tx.streamer = null;
    tx.pendingStreaming = null;
    tx.visualRoot = null;
    tx.collisionRoot = null;
    tx.collisionProbe = null;
    tx.physicsBridge = null;
    tx.routeQuery = null;
    tx.gameplay = null;
    tx.route = null;
    tx.sectors = null;
    tx.manifest = null;
    tx.manifestBase = null;tx.closure=null;tx.sourceLengthM=null;
  }

  async function performLoad(request, tx) {
    const callerSignal = request.signal;
    const mirrorAbort = () => tx.controller.abort(abortError(callerSignal?.reason));
    if (callerSignal) {
      if (callerSignal.aborted) mirrorAbort();
      else callerSignal.addEventListener('abort', mirrorAbort, { once: true });
    }
    try {
      current(tx);
      if (request.entry?.id && request.entry.id !== 'cuesta_lipan') throw new TypeError('entry identity mismatch');
      const registryBase = new URL('./', registryUrl);
      const manifestUrl = safeUrl(request.manifestUrl || request.entry?.manifest || './cuesta-lipan/manifest.json',
        registryBase, releaseRoot, 'manifest');
      const manifestBytes = await fetchLocked(manifestUrl.href, MANIFEST_LOCK, 'Cuesta manifest', tx);
      const locked = validateLockedManifest(parseJson(manifestBytes, 'Cuesta manifest'));
      const manifestBase = new URL('./', manifestUrl);
      const routeUrl = safeUrl(locked.manifest.route, manifestBase, releaseRoot, 'route');
      const routeBytes = await fetchLocked(routeUrl.href, locked.raw.integrity.route, 'Cuesta route', tx);
      const decoderUrl = safeUrl(locked.raw.streaming.decoder, manifestBase, releaseRoot, 'Meshopt decoder');
      await fetchLocked(decoderUrl.href, locked.decoderLock, 'Meshopt decoder', tx);
      const sourceRoute = normalizeRoute(parseJson(routeBytes, 'Cuesta route'));
      const sourceQuery = createRouteQuery(sourceRoute);
      const closure = prepareOptionalClosedRoute(dependencies,sourceRoute,'cuesta_lipan');
      const route = closure?.route || sourceRoute;
      const baseQuery = closure ? createRouteQuery(route) : sourceQuery;
      const routeQuery = Object.freeze({ lengthM: route.lengthM, ...baseQuery });
      tx.sourceLengthM=sourceRoute.lengthM;tx.closure=closure?.closure||null;
      const gameplay = createGameplayBridge(routeQuery, route, PROFILE);

      tx.manifest = locked.raw;
      tx.manifestBase = manifestBase;
      tx.route = route;
      tx.routeQuery = routeQuery;
      tx.gameplay = gameplay;
      tx.sectors = locked.raw.streaming.sectors;
      tx.visualRoot = dependencies.createTrackRoot('Cuesta de Lipán · visuales sectoriales');
      tx.collisionRoot = dependencies.createTrackRoot('Cuesta de Lipán · colisión completa');
      if (!validRoot(tx.visualRoot) || !validRoot(tx.collisionRoot)) throw new TypeError('track root factory returned an invalid root');
      await prepareTrackVisual(tx.visualRoot, { id: 'cuesta_lipan', query: sourceQuery, lengthM: sourceRoute.lengthM, signal: tx.controller.signal, sceneryOnly: true });
      current(tx);

      for (const sector of tx.sectors) {
        const url = safeUrl(sector.collision.url, manifestBase, releaseRoot, `${sector.id} collision`);
        const bytes = await fetchLocked(url.href, sector.collision, `${sector.id} collision`, tx);
        const root = await dependencies.completeGlbToObject(bytes, `Cuesta ${sector.id} collision`, { signal: tx.controller.signal });
        current(tx);
        if (!validRoot(root)) throw new TypeError(`${sector.id} collision root is invalid`);
        setPosition(root, toRuntimeYUp(sector.localOrigin, `${sector.id}.localOrigin`));
        tx.collisionRoot.add(root);
        tx.collisionById.set(sector.id, root);
      }

      if(closure){
        const roots=attachClosedRouteRoots(closure,tx.visualRoot,tx.collisionRoot,{});tx.closureRoots=roots;
        // A streamed source sector may be disposed later. The permanent return
        // therefore owns its own maps/materials instead of borrowing sector resources.
        await prepareTrackVisual(roots.visualRoot,{id:'cuesta_lipan',query:routeQuery,lengthM:route.lengthM,signal:tx.controller.signal,scenery:false});
        current(tx);
      }

      await dependencies.installVisualRoot(tx.visualRoot, { signal: tx.controller.signal });
      tx.visualInstalled = true;
      current(tx);
      await dependencies.installCollisionRoot(tx.collisionRoot, { signal: tx.controller.signal });
      tx.collisionInstalled = true;
      current(tx);
      tx.collisionProbe = await dependencies.createCollisionProbe(tx.collisionRoot, { signal: tx.controller.signal });
      if (!tx.collisionProbe || typeof tx.collisionProbe.sample !== 'function' || typeof tx.collisionProbe.getState !== 'function') {
        throw new TypeError('Cuesta collision probe is invalid');
      }
      current(tx);
      tx.physicsBridge = await dependencies.createPhysicsBridge({
        collisionRoot: tx.collisionRoot,
        collisionProbe: tx.collisionProbe,
        routeQuery,
        signal: tx.controller.signal,
      });
      if (!tx.physicsBridge || typeof tx.physicsBridge.browserStackFactory !== 'function'
          || typeof tx.physicsBridge.getCollisionRoot !== 'function'
          || tx.physicsBridge.getCollisionRoot() !== tx.collisionRoot) {
        throw new TypeError('Cuesta physics bridge is invalid');
      }
      current(tx);

      tx.streamer = createSectorStreamer({
        sectors: tx.sectors,
        stableQualityGeometry: true,
        updateVisualQuality(root, state) {
          // A prepared replacement becomes visible only after the streamer
          // disposes its predecessor; partial loads never draw a second rail.
          root.visible = true;
          updateSectorVisualQuality(root, state);
        },
        retryDelayMs: 1000,
        retryMaxDelayMs: 30000,
        signal: tx.controller.signal,
        async loadVisual({ sector, lod, asset, signal }) {
          const url = safeUrl(asset.url, manifestBase, releaseRoot, `${sector.id} lod${lod}`);
          const bytes = await fetchLocked(url.href, asset, `${sector.id} lod${lod}`, tx, signal);
          const root = await dependencies.completeGlbToObject(bytes, `Cuesta ${sector.id} lod${lod}`, { signal });
          current(tx);
          if (!validRoot(root)) throw new TypeError(`${sector.id} lod${lod} root is invalid`);
          setPosition(root, toRuntimeYUp(sector.localOrigin, `${sector.id}.localOrigin`));
          root.visible = false;
          tx.visualRoot.add(root);
          await prepareTrackVisual(root, { id: 'cuesta_lipan', signal, scenery: false, query: sourceQuery, lengthM: sourceRoute.lengthM, detailRange:{startM:sector.startM,endM:sector.endM}, barrierSource:sector.startM<6100?{collisionRoot:tx.collisionById.get(sector.id),sectorId:sector.id}:null });
            tx.closureRoots?.carveSourceTerrain?.(root);
          current(tx);
          await dependencies.applyVisualEnvironment(root, tx.environment, { signal });
          return root;
        },
        loadCollision({ sector }) {
          const root = tx.collisionById.get(sector.id);
          if (!root) throw new Error(`preloaded collision is missing for ${sector.id}`);
          return root;
        },
        disposeVisual(root) {
          root?.removeFromParent?.();
          disposeOnce(tx, root);
        },
        disposeCollision() {
          // Physics is built once from the complete 539 KB collision package.
          // The streamer still tracks the active collision window for diagnostics.
        },
      });
      await tx.streamer.update(0, 'high');
      current(tx);
      await dependencies.applyVisualEnvironment(tx.visualRoot, tx.environment, { signal: tx.controller.signal });
      current(tx);
      ready = true;
      state = 'ready';
      return adapter;
    } catch (error) {
      await cleanup(tx);
      ready = false;
      if (state !== 'unloading') state = 'idle';
      if (tx.cleanupErrors.length) error.cleanupErrors = Object.freeze([...tx.cleanupErrors]);
      throw error;
    } finally {
      callerSignal?.removeEventListener?.('abort', mirrorAbort);
    }
  }

  function validate(request = {}) {
    if (request.entry?.id && request.entry.id !== 'cuesta_lipan') {
      return Promise.reject(new TypeError('entry identity mismatch'));
    }
    return Promise.resolve(freeze({ ok: true, errors: [], id: 'cuesta_lipan' }));
  }

  function load(request = {}) {
    if (ready) return Promise.resolve(adapter);
    if (state === 'loading') return Promise.reject(new Error('Cuesta adapter is already loading'));
    if (state === 'unloading') return Promise.reject(new Error('Cuesta adapter is unloading'));
    const tx = {
      token: ++epoch,
      controller: new AbortController(),
      cleaned: false,
      cleanupErrors: [],
      disposedRoots: new WeakSet(),
      collisionById: new Map(),
      environment: 'golden',
      streamer: null,
      pendingStreaming: null,
      pendingSignature: null,
    };
    transaction = tx;
    state = 'loading';
    loading = performLoad(request, tx);
    loading.finally(() => { if (transaction === tx) loading = null; }).catch(() => {});
    return loading;
  }

  function unload() {
    if (unloading) return unloading;
    const tx = transaction;
    epoch += 1;
    ready = false;
    state = 'unloading';
    tx?.controller.abort(abortError());
    unloading = Promise.resolve(loading).catch(() => {}).then(() => cleanup(tx)).then(() => {
      if (tx?.cleanupErrors.length) throw new AggregateError(tx.cleanupErrors, 'Cuesta adapter cleanup failed');
    }).finally(() => {
      if (transaction === tx) transaction = null;
      state = 'idle';
      unloading = null;
    });
    unloading.catch(() => {});
    return unloading;
  }

  function requireReady() {
    if (!ready || !transaction) throw new Error('Cuesta adapter is not ready');
    return transaction;
  }

  function sampleRoute(sM) {
    const tx = requireReady();
    const route = tx.routeQuery.sample(sM);
    const authored = tx.gameplay.sample(route.sM);
    return freeze({
      ...route,
      curvature: authored.curvature,
      bankRad: authored.bank,
      targetSpeedKph: authored.targetSpeedKph,
      idealLineOffsetM: tx.gameplay.idealLineOffset(route.sM),
    });
  }

  function spawnRecord(tx, sample, position, grid) {
    return freeze({
      position: [...position],
      frame: {
        tangent: [...sample.frame.tangent],
        left: [...sample.frame.left],
        normal: [...sample.frame.normal],
      },
      progress: { sM: sample.sM, u: sample.sM / tx.route.lengthM, sectorId: sample.sectorId },
      grid: { ...grid },
    });
  }

  function getSpawn(kind, index = 0) {
    const tx = requireReady();
    if (kind === 'chevy') {
      const sample = tx.routeQuery.sample(tx.route.respawns[0].sM);
      return spawnRecord(tx, sample, sample.position, { rearwardM: 0, lateralM: 0 });
    }
    if (kind === 'falcon') {
      const sample = tx.routeQuery.sample(tx.route.respawns[0].sM);
      const rearwardM = 8;
      const lateralM = Math.min(1.25, sample.widthM * 0.25);
      const position = sample.position.map((value, axis) => value
        - sample.frame.tangent[axis] * rearwardM + sample.frame.left[axis] * lateralM);
      return spawnRecord(tx, sample, position, { rearwardM, lateralM });
    }
    if (kind === 'respawn') {
      if (!Number.isInteger(index) || index < 0 || index >= tx.route.respawns.length) {
        throw new RangeError(`respawn index out of range: ${index}`);
      }
      const respawn = tx.routeQuery.respawnFor(tx.route.respawns[index].sM);
      return spawnRecord(tx, respawn, respawn.position, { rearwardM: 0, lateralM: respawn.lateralM });
    }
    throw new RangeError(`unknown spawn: ${kind}`);
  }

  function resolveRespawn(raceProgressM) {
    if (!Number.isFinite(raceProgressM)) throw new TypeError('raceProgressM must be finite');
    const tx = requireReady();
    const progress=respawnRouteDistance(tx.route,raceProgressM);
    const record = tx.routeQuery.respawnFor(progress.sM);
    return freeze({
      sM: record.sM,
      raceProgressM: progress.lapPrefixM+record.sM,
      position: [...record.position],
      frame: {
        tangent: [...record.frame.tangent],
        left: [...record.frame.left],
        normal: [...record.frame.normal],
      },
      lateralM: record.lateralM,
      clearanceM: RESPAWN_CLEARANCE_M,
      sectorId: record.sectorId,
    });
  }

  function getCheckpoints() {
    const tx = requireReady();
    return freeze(tx.route.checkpoints.map((checkpoint, index) => ({
      ...tx.routeQuery.checkpointAt(index),
      id: checkpoint.id || `checkpoint_${index + 1}`,
      finish: index === tx.route.checkpoints.length - 1,
    })));
  }

  function updateStreaming(context = {}) {
    const tx = requireReady();
    let sM = Number(context.sM);
    if (!Number.isFinite(sM)) {
      if (!Array.isArray(context.vehiclePosition)) throw new TypeError('streaming requires sM or vehiclePosition');
      sM = tx.routeQuery.project(context.vehiclePosition, undefined, { allowTeleport: true }).sM;
    }
    sM = sourceStreamingDistance(tx.route,tx.sourceLengthM,sM);
    const quality = qualityTier(context.quality);
    const sector = sectorAt(tx.sectors, sM);
    if (!sector) return Promise.reject(new RangeError('streaming position is outside Cuesta sectors'));
    const signature = `${sector.id}:${quality}`;
    if (tx.pendingSignature === signature && tx.pendingStreaming) return tx.pendingStreaming;
    if (tx.streamer.diagnostics.currentSector === sector.id && tx.streamer.diagnostics.quality === quality) {
      return Promise.resolve(tx.streamer.diagnostics);
    }
    const promise = tx.streamer.update(sM, quality);
    tx.pendingSignature = signature;
    tx.pendingStreaming = promise;
    promise.finally(() => {
      if (tx.pendingStreaming === promise) {
        tx.pendingStreaming = null;
        tx.pendingSignature = null;
      }
    }).catch(() => {});
    return promise;
  }

  async function applyEnvironment(id) {
    const tx = requireReady();
    if (!ENVIRONMENTS.has(id)) throw new RangeError(`unsupported environment: ${id}`);
    await dependencies.applyVisualEnvironment(tx.visualRoot, id, { signal: tx.controller.signal });
    current(tx);
    tx.environment = id;
  }

  function getDiagnostics() {
    if (!ready || !transaction) return lastDiagnostics;
    const tx = transaction;
    return freeze({
      id: 'cuesta_lipan', state, environment: tx.environment,
      routeSamples: tx.route.samples.length,closed:tx.route.closed===true,lengthM:tx.route.lengthM,sourceLengthM:tx.sourceLengthM,closure:tx.closure,
      streamer: tx.streamer.diagnostics,
      collisionPolicy: 'complete-preloaded',
      live: { visualRoots: 1, collisionRoots: 1, collisionProbes: 1, physicsBridges: 1 },
      ownershipRemainder: tx.streamer.diagnostics.ownedResources + 4,
      ownershipErrors: 0,
    });
  }

  const adapter = {};
  Object.defineProperties(adapter, {
    id: { enumerable: true, value: 'cuesta_lipan' },
    ready: { enumerable: true, get: () => ready },
    environmentProfile: { enumerable: true, value: freeze({ profile: './environment.json', defaultPreset: 'clear', availablePresets: ['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night'] }) },
    visualRoot: { enumerable: true, get: () => ready ? transaction?.visualRoot || null : null },
    collisionRoot: { enumerable: true, get: () => ready ? transaction?.collisionRoot || null : null },
    collisionProbe: { enumerable: true, get: () => ready ? transaction?.collisionProbe || null : null },
    physicsBridge: { enumerable: true, get: () => ready ? transaction?.physicsBridge || null : null },
    routeQuery: { enumerable: true, get: () => ready ? transaction?.routeQuery || null : null },
    gameplay: { enumerable: true, get: () => ready ? transaction?.gameplay || null : null },
    route: { enumerable: true, get: () => ready ? transaction?.route || null : null },
    sectors: { enumerable: true, get: () => ready ? transaction.route.sectors : Object.freeze([]) },
    respawns: { enumerable: true, get: () => ready ? transaction.route.respawns : Object.freeze([]) },
    streamer: { enumerable: true, get: () => ready ? transaction?.streamer || null : null },
    environment: {
      enumerable: true,
      get: () => freeze({ defaultPreset: 'clear', currentPreset: transaction?.environment || 'golden' }),
    },
    validate: { enumerable: true, value: validate },
    load: { enumerable: true, value: load },
    unload: { enumerable: true, value: unload },
    sampleRoute: { enumerable: true, value: sampleRoute },
    projectToRoute: { enumerable: true, value: (...args) => requireReady().routeQuery.project(...args) },
    surfaceAt: {
      enumerable: true,
      value: (first, second, third, fourth) => typeof first === 'number'
        ? requireReady().gameplay.surfaceAt(first, second, third)
        : requireReady().routeQuery.surfaceAt(first, second, third || fourth),
    },
    resolveRespawn: { enumerable: true, value: resolveRespawn },
    getSpawn: { enumerable: true, value: getSpawn },
    getCheckpoints: { enumerable: true, value: getCheckpoints },
    getMaterialBindings: { enumerable: true, value: () => ready ? collectMaterialBindings(transaction.visualRoot, { asphalt: ['V2_ASPHALT_PBR', 'V2_ROAD_DECAL_CRACK', 'V2_ROAD_DECAL_PATCH'], shoulder: ['V2_SHOULDER_PBR'], terrain: ['V2_TERRAIN_PBR', 'V2_ROCK_PBR'], water: [], snow: [] }) : Object.freeze([]) },
    updateStreaming: { enumerable: true, value: updateStreaming },
    applyEnvironment: { enumerable: true, value: applyEnvironment },
    getDiagnostics: { enumerable: true, value: getDiagnostics },
  });
  return Object.freeze(adapter);
}
