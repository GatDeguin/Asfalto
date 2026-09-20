import {waitForSignal} from '../runtime/abortable.mjs?v=c91114c944607feb';
import { assertTrackAdapter } from './track-contract.mjs?v=7d88fa8e85b8ea4d';

const SAFE_ID = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_URL = /^[A-Za-z0-9._~!$&'()+,;=@/-]+$/;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function canonicalRelativeUrl(value) {
  if (typeof value !== 'string' || !value || !SAFE_URL.test(value)) return null;
  if (value.startsWith('/') || value.startsWith('\\') || value.includes('\\') || value.includes(':')
      || value.includes('?') || value.includes('#') || value.includes('%')) return null;
  const parts = [];
  for (const part of value.split('/')) {
    if (part === '.') continue;
    if (!part || part === '..') return null;
    parts.push(part);
  }
  return parts.length ? './' + parts.join('/') : null;
}

function snapshotRegistry(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== 'asfalto-track-registry/v1') {
    throw new TypeError('registry schema must equal asfalto-track-registry/v1');
  }
  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) {
    throw new TypeError('registry tracks must be a nonempty array');
  }
  const ids = new Set();
  const tracks = raw.tracks.map((rawEntry, index) => {
    if (!rawEntry || typeof rawEntry !== 'object' || !SAFE_ID.test(rawEntry.id || '')) {
      throw new TypeError('registry track[' + index + '] id must be a safe stable identifier');
    }
    if (ids.has(rawEntry.id)) throw new TypeError('registry track ids must be unique');
    ids.add(rawEntry.id);
    const manifest = canonicalRelativeUrl(rawEntry.manifest);
    if (!manifest) throw new TypeError('registry track[' + index + '] must have a safe relative manifest URL');
    if (typeof rawEntry.status !== 'string' || !rawEntry.status) {
      throw new TypeError('registry track[' + index + '] status must be a nonempty string');
    }
    return deepFreeze({ ...rawEntry, manifest });
  });
  return deepFreeze({ schema: raw.schema, tracks });
}

function abortError(message = 'track selection aborted') {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function validationError(result) {
  if (result !== false && result?.ok !== false) return null;
  const details = Array.isArray(result?.errors) && result.errors.length
    ? ': ' + result.errors.join('; ')
    : '';
  return new Error('adapter validation failed' + details);
}

export function createTrackManager(context) {
  if (!context || typeof context !== 'object') throw new TypeError('track manager context must be an object');
  const registry = snapshotRegistry(context.registry);
  if (typeof context.createAdapter !== 'function') throw new TypeError('createAdapter must be a function');

  const byId = new Map(registry.tracks.map((entry) => [entry.id, entry]));
  const cleaned = new WeakSet(), cleaning = new WeakMap(), incomplete = new Set();
  let active = null;
  let activeId = null;
  let pending = null;
  let token = 0;

  async function cleanup(adapter) {
    if (!adapter || typeof adapter !== 'object' || cleaned.has(adapter)) return;
    if(cleaning.has(adapter))return cleaning.get(adapter);
    incomplete.add(adapter);
    const promise=Promise.resolve().then(()=>adapter.unload()).then(()=>{cleaned.add(adapter);incomplete.delete(adapter);}).finally(()=>cleaning.delete(adapter));
    cleaning.set(adapter,promise);return promise;
  }

  function entryFor(id) {
    if (typeof id !== 'string' || !byId.has(id)) throw new RangeError('unknown track: ' + id);
    const entry = byId.get(id);
    if (entry.status !== 'ready') throw new Error('track unavailable: ' + id);
    return entry;
  }

  async function select(id, {signal, timeoutMs=180000} = {}) {
    signal?.throwIfAborted();
    if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new RangeError('Invalid track selection timeout');
    const entry = entryFor(id);

    if (active && activeId === id) {
      token += 1;
      pending?.controller.abort();
      return active;
    }

    const selectionToken = ++token;
    pending?.controller.abort();
    const controller = new AbortController();
    const forwardAbort=()=>controller.abort(signal.reason);
    signal?.addEventListener('abort',forwardAbort,{once:true});
    if(signal?.aborted)forwardAbort();
    const timeout=setTimeout(()=>controller.abort(new DOMException('La carga del circuito tardó demasiado. Podés reintentar.','TimeoutError')),timeoutMs);
    let candidate = null;
    let candidateOwned = false;

    const operation = (async () => {
      try {
        candidate = await context.createAdapter(id, entry);
        candidateOwned = Boolean(candidate && typeof candidate === 'object' && typeof candidate.unload === 'function');
        assertTrackAdapter(candidate);
        if(controller.signal.aborted||selectionToken!==token)throw controller.signal.reason||abortError();

        const result = await candidate.validate({ id, entry, signal: controller.signal });
        const invalid = validationError(result);
        if (invalid) throw invalid;
        if (controller.signal.aborted || selectionToken !== token) throw controller.signal.reason || abortError();

        await candidate.load({ id, entry, signal: controller.signal });
        if (controller.signal.aborted || selectionToken !== token) throw controller.signal.reason || abortError();
        if (candidate.ready !== true) throw new Error('adapter ' + id + ' did not become ready');

        const previous = active;
        active = candidate;
        activeId = id;
        if (previous && previous !== candidate) await cleanup(previous);
        if (controller.signal.aborted || selectionToken !== token) throw controller.signal.reason || abortError();
        return candidate;
      } catch (error) {
        if (candidateOwned && active !== candidate) {
          try {
            await cleanup(candidate);
          } catch (cleanupFailure) {
            if (error && typeof error === 'object' && !('cleanupError' in error)) {
              Object.defineProperty(error, 'cleanupError', { value: cleanupFailure });
            }
          }
        }
        if (controller.signal.aborted || selectionToken !== token) throw controller.signal.reason || abortError();
        throw error;
      } finally {
        if (pending?.token === selectionToken) pending = null;
      }
    })();

    // The adapter owns its late cleanup above. Public cancellation never waits
    // indefinitely for a non-cooperative transport or decoder.
    const promise = waitForSignal(operation, controller.signal);
    pending = { token: selectionToken, controller, promise };
    try { return await promise; }
    finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort',forwardAbort);
      if(pending?.token===selectionToken)pending=null;
    }
  }

  async function unload() {
    const selection = pending;
    token += 1;
    selection?.controller.abort();

    const previous = active;
    active = null;
    activeId = null;

    const targets=new Set(incomplete);if(previous)targets.add(previous);
    const results=await Promise.allSettled([...targets].map(cleanup));
    if (selection) await Promise.allSettled([selection.promise]);
    const failures=results.filter(r=>r.status==='rejected').map(r=>r.reason);
    if(failures.length)throw new AggregateError(failures,'No se pudieron liberar los circuitos');
  }

  const manager = {};
  Object.defineProperties(manager, {
    active: { enumerable: true, get: () => active },
    registry: { enumerable: true, value: registry },
    select: { enumerable: true, value: select },
    unload: { enumerable: true, value: unload },
  });
  return Object.freeze(manager);
}