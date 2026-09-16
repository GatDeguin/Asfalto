import {staticSeedUrl} from './hosting-mode.mjs';
import { COCKPIT_FACTORY_LAYOUT } from './cockpit-layout-default.mjs';
import { sanitizeCompositionState, sanitizeTransform, migrateCompositionState } from './composition-editor-state.mjs?v=body-r2-20260916';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const valid = value => record(value) && [1, 2, 3].includes(value.version) && record(value.transforms);
const timestamp = value => Date.parse(value?.updatedAt || '') || 0;

// Browser storage remains a recovery copy. The local launcher owns the durable file.
export function createCockpitLayoutFile({ fetcher = globalThis.fetch?.bind(globalThis), endpoint = '/api/cockpit-layout' , requestTimeoutMs = 8000, staticLayoutUrl = staticSeedUrl('cockpit-layout.json'), factoryLayout = COCKPIT_FACTORY_LAYOUT } = {}) {
  const defaults = sanitizeCompositionState(factoryLayout);
  // User records select the layout; factory values only fill targets absent in an older record.
  const complete = value => {
    if (!valid(value)) return defaults;
    const saved = migrateCompositionState(value);
    const transforms = { ...defaults.transforms };
    for (const [id, transform] of Object.entries(saved.transforms)) transforms[id] = sanitizeTransform(transform, defaults.transforms[id]);
    const assembled = { ...defaults, ...value, version: 3, transforms, camera: { cockpit: { ...defaults.camera.cockpit, ...value.camera?.cockpit } } };
    if (!Object.hasOwn(value, 'updatedAt')) delete assembled.updatedAt;
    return sanitizeCompositionState(assembled);
  };
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
    get defaults() { return defaults; },
    get path() { return filePath; },
    get error() { return error; },
    async initialize(localLayout) {
      enabled = false; error = '';
      const local = valid(localLayout) ? complete(localLayout) : null;
      try {
        if (staticLayoutUrl) {
          const response = await fetcher(staticLayoutUrl, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(4000) });
          if (!response.ok) throw new Error('No se pudo leer la calibración inicial del cockpit');
          const seed = await response.json();
          if (!valid(seed)) throw new Error('Calibración inicial del cockpit inválida');
          // A shipped seed is a default, never a newer user edit.
          return local || complete(seed);
        }
        const response = await fetcher(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(4000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo leer el archivo del cockpit');
        enabled = data.enabled === true;
        filePath = data.path || '';
        if (!enabled || !valid(data.layout)) return local || defaults;
        const disk = complete(data.layout);
        return local && (timestamp(local) > timestamp(disk) || timestamp(disk) === 0) ? local : disk;
      } catch (cause) {
        error = cause?.message || 'No se pudo leer el archivo del cockpit';
        return local || defaults;
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
