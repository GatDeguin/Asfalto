import {staticSeedUrl} from './hosting-mode.mjs';
import { sanitizeCompositionState } from './composition-editor-state.mjs?v=79460f757b2aac28';

const valid = value => value && [1, 2, 3].includes(value.version) && value.transforms && typeof value.transforms === 'object';
const timestamp = value => Date.parse(value?.updatedAt || '') || 0;

// Browser storage remains a recovery copy. The local launcher owns the durable file.
export function createCockpitLayoutFile({ fetcher = globalThis.fetch?.bind(globalThis), endpoint = '/api/cockpit-layout' , requestTimeoutMs = 8000, staticLayoutUrl = staticSeedUrl('cockpit-layout.json') } = {}) {
  let enabled = false, filePath = '', error = '', queue = Promise.resolve();
  async function send(layout) {
    try {
      const response = await fetcher(endpoint, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        credentials: 'same-origin', cache: 'no-store', keepalive: true,
        signal: AbortSignal.timeout(requestTimeoutMs),
        body: JSON.stringify(sanitizeCompositionState(layout)),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.error || 'No se pudo guardar el archivo del cockpit');
      filePath = data.path || filePath; error = '';
      return { ok: true, path: filePath };
    } catch (cause) {
      error = cause?.message || 'No se pudo guardar el archivo del cockpit';
      return { ok: false, error };
    }
  }
  return Object.freeze({
    get enabled() { return enabled; },
    get path() { return filePath; },
    get error() { return error; },
    async initialize(localLayout) {
      enabled = false; error = '';
      const local = valid(localLayout) ? sanitizeCompositionState(localLayout) : null;
      try {
        if (staticLayoutUrl) {
          const response = await fetcher(staticLayoutUrl, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(4000) });
          if (!response.ok) throw new Error('No se pudo leer la calibración inicial del cockpit');
          const seed = await response.json();
          if (!valid(seed)) throw new Error('Calibración inicial del cockpit inválida');
          const initial = sanitizeCompositionState(seed);
          return local && (timestamp(local) > timestamp(initial) || timestamp(initial) === 0) ? local : initial;
        }
        const response = await fetcher(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(4000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo leer el archivo del cockpit');
        enabled = data.enabled === true;
        filePath = data.path || '';
        if (!enabled || !valid(data.layout)) return local;
        const disk = sanitizeCompositionState(data.layout);
        return local && (timestamp(local) > timestamp(disk) || timestamp(disk) === 0) ? local : disk;
      } catch (cause) {
        error = cause?.message || 'No se pudo leer el archivo del cockpit';
        return local;
      }
    },
    save(layout, { immediate = false } = {}) {
      if (!enabled) return Promise.resolve({ ok: false, disabled: true });
      const snapshot = sanitizeCompositionState(layout);
      if (immediate) return send(snapshot);
      const task = queue.then(() => send(snapshot));
      queue = task.then(() => undefined, () => undefined);
      return task;
    },
  });
}
