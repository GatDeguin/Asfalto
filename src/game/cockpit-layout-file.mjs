import {staticSeedUrl} from './hosting-mode.mjs?v=bcd45c5c9364a26f';
import { COCKPIT_FACTORY_LAYOUT } from './cockpit-layout-default.mjs?v=41ddb2cbdf200068';
import { sanitizeCompositionState, sanitizeTransform, migrateCompositionState } from './composition-editor-state.mjs?v=c4711cb3438b2dc0';
import { sanitizeCockpitCalibration } from './vehicle-camera-rig.mjs?v=467c30948b8f1e07';
import { authoredCockpitAnchors } from './expansion-vehicle-runtime.mjs?v=aaacadfb3c716f14';
import { getVehicleDefinition } from '../render/vehicle-catalog.mjs?v=d34c237e4bf2bab0';

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
    const camera = { ...defaults.camera, ...value.camera, cockpit: { ...defaults.camera.cockpit, ...value.camera?.cockpit } };
    const assembled = { ...defaults, ...value, version: 3, transforms, camera };
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
    async initialize(localLayout, { fallback = defaults } = {}) {
      enabled = false; error = '';
      const local = valid(localLayout) ? complete(localLayout) : null;
      const baseline = complete(fallback);
      if (!fetcher) return local || baseline;
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
        if (!enabled || !valid(data.layout)) return local || baseline;
        const disk = complete(data.layout);
        return local && (timestamp(local) > timestamp(disk) || timestamp(disk) === 0) ? local : disk;
      } catch (cause) {
        error = cause?.message || 'No se pudo leer el archivo del cockpit';
        return local || baseline;
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

export const localCockpitHost = (location = globalThis.location) =>
  location?.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export const vehiclePreferenceKey = (key, vehicle) => `${key}:${vehicle}`;

export function readVehiclePreference(storage, key, vehicle, { legacy = true } = {}) {
  try {
    const scoped = storage?.getItem(vehiclePreferenceKey(key, vehicle));
    return JSON.parse(scoped ?? (legacy ? storage?.getItem(key) : null) ?? 'null');
  } catch { return null; }
}

export function createVehicleCockpitLayouts({ storage, legacyLayout, loopback = localCockpitHost(), fileOptions = {},
  key = 'cockpit-chevy-layout-editor-v1' } = {}) {
  const profiles = new Map();
  function prepare(vehicle) {
    if (!getVehicleDefinition(vehicle)?.selectable) throw new TypeError('Modelo de cockpit inválido');
    if (profiles.has(vehicle)) return profiles.get(vehicle);
    const authored = Boolean(authoredCockpitAnchors(vehicle));
    const factoryLayout = authored ? {
      ...COCKPIT_FACTORY_LAYOUT,
      transforms: { auto: COCKPIT_FACTORY_LAYOUT.transforms.auto },
      camera: { cockpit: sanitizeCockpitCalibration({ lensMode: 'manual', focalLengthMm: 18 }) },
    } : COCKPIT_FACTORY_LAYOUT;
    const file = createCockpitLayoutFile({ ...fileOptions, factoryLayout, staticLayoutUrl: null,
      endpoint: `/api/cockpit-layout?vehicle=${encodeURIComponent(vehicle)}`,
      ...(loopback ? {} : { fetcher: null }),
    });
    const browserKey = vehiclePreferenceKey(key, vehicle);
    const pending = file.initialize(readVehiclePreference(storage, key, vehicle, { legacy: false }), {
      fallback: authored ? file.defaults : legacyLayout || file.defaults,
    }).then(initial => {
      let layout = initial;
      return Object.freeze({
        vehicle, authored, defaults: file.defaults, file,
        get layout() { return layout; },
        saveLocal(value) {
          const updatedAt = new Date(Math.max(timestamp(value) || Date.now(), timestamp(layout) + 1)).toISOString();
          layout = sanitizeCompositionState({ ...value, updatedAt });
          const data = JSON.stringify(layout);
          try {
            if (storage?.setItemPersistent) storage.setItemPersistent(browserKey, data);
            else if (storage?.setItem) storage.setItem(browserKey, data);
            else return false;
            return true;
          } catch { return false; }
        },
      });
    });
    profiles.set(vehicle, pending);
    return pending;
  }
  return Object.freeze({ prepare });
}
