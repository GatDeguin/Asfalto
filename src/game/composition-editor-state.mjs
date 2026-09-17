import { COCKPIT_CALIBRATION_DEFAULTS, sanitizeCockpitCalibration } from './vehicle-camera-rig.mjs?v=balance-20260917';

const TRANSFORM_DEFAULTS = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0]),
  scale: Object.freeze([1, 1, 1]),
});

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
};

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const degrees = (value, fallback = 0) => { const numeric = finite(value, fallback); const normalized = ((numeric + 180) % 360 + 360) % 360 - 180; return normalized === -180 && numeric > 0 ? 180 : normalized; };
const clone = value => globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
const validId = id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);

export const COMPOSITION_STATE_DEFAULTS = freeze({
  version: 3,
  build: '',
  transforms: {
    auto: { position: [0, -0.72, 0], rotation: [0, 180, 0], scale: [1, 1, 1] },
    roof: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  },
  camera: { cockpit: COCKPIT_CALIBRATION_DEFAULTS },
});

export function sanitizeTransform(value = {}, fallback = TRANSFORM_DEFAULTS) {
  const source = value && typeof value === 'object' ? value : {};
  return freeze({
    position: [0, 1, 2].map(index => clamp(finite(source.position?.[index], fallback.position[index]), index === 1 ? -2.5 : -4, index === 1 ? 2.5 : 4)),
    rotation: [0, 1, 2].map(index => degrees(source.rotation?.[index], fallback.rotation[index])),
    scale: [0, 1, 2].map(index => clamp(finite(source.scale?.[index], fallback.scale[index]), 0.05, 4)),
  });
}

export function migrateCompositionState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const legacyRadians = Number(source.version) === 1 || Number(source.version) === 2;
  const transforms = Object.fromEntries(Object.entries(source.transforms && typeof source.transforms === 'object' ? source.transforms : {})
    .filter(([id]) => validId(id))
    .map(([id, transform]) => [id, legacyRadians && transform && typeof transform === 'object'
      ? { ...clone(transform), rotation: Array.isArray(transform.rotation) ? transform.rotation.map(value => finite(value, 0) * 180 / Math.PI) : transform.rotation }
      : clone(transform)]));
  return freeze({
    version: 3,
    build: typeof source.build === 'string' ? source.build : '',
    ...(typeof source.updatedAt === 'string' ? { updatedAt: source.updatedAt } : {}),
    transforms,
    camera: { cockpit: sanitizeCockpitCalibration(source.camera?.cockpit) },
  });
}

export function sanitizeCompositionState(raw = {}) {
  const migrated = migrateCompositionState(raw);
  return freeze({
    version: 3,
    build: migrated.build,
    ...(migrated.updatedAt ? { updatedAt: migrated.updatedAt } : {}),
    transforms: Object.fromEntries(Object.entries(migrated.transforms)
      .filter(([id]) => validId(id))
      .map(([id, transform]) => [id, sanitizeTransform(transform, COMPOSITION_STATE_DEFAULTS.transforms[id] || TRANSFORM_DEFAULTS)])),
    camera: { cockpit: sanitizeCockpitCalibration(migrated.camera?.cockpit) },
  });
}

export function serializeCompositionState(state, build = '') {
  const sanitized = sanitizeCompositionState(state);
  return JSON.stringify({
    version: 3,
    build: String(build || sanitized.build || ''),
    updatedAt: new Date().toISOString(),
    transforms: sanitized.transforms,
    camera: sanitized.camera,
  });
}

export function createTargetDescriptor({ id, label = id, kind = 'object', capabilities, defaultState, getState, applyState, pickRoots = [], availability = () => ({ available: true, reason: '' }) }) {
  if (!validId(id) || (kind !== 'object' && kind !== 'cockpit-camera') || typeof getState !== 'function' || typeof applyState !== 'function') {
    throw new TypeError('Descriptor de composición inválido');
  }
  const defaults = kind === 'cockpit-camera'
    ? sanitizeCockpitCalibration(defaultState)
    : sanitizeTransform(defaultState);
  return freeze({
    id,
    label,
    kind,
    capabilities: freeze({ position: !!capabilities?.position, rotation: !!capabilities?.rotation, scale: !!capabilities?.scale, lens: !!capabilities?.lens }),
    getState,
    applyState,
    reset: () => applyState(clone(defaults)),
    pickRoots: Object.freeze([...pickRoots]),
    availability,
  });
}

// This seam owns selection policy independently from the DOM.  In particular it
// never "helps" by changing the driver's camera mode when a selected target is
// unavailable; the UI can render the same selection as disabled and explain why.
export function createCompositionEditorController({ targets = [], cameraMode = () => 'cockpit' } = {}) {
  const targetMap = new Map(targets.map(target => [target?.id, target]).filter(([id, target]) => !!id && !!target));
  let selectedId = targetMap.keys().next().value || null;
  const selected = () => targetMap.get(selectedId) || null;
  const availability = () => {
    const result = selected()?.availability?.(cameraMode()) || { available: false, reason: 'Objeto no disponible' };
    return { available: result.available !== false, reason: String(result.reason || '') };
  };
  const state = () => {
    const target = selected();
    const current = availability();
    return freeze({ selectedId, available: current.available, reason: current.reason, pickEnabled: current.available && (target?.pickRoots?.length || 0) > 0, capabilities: clone(target?.capabilities || {}) });
  };
  return Object.freeze({
    getState: () => state(),
    select(id) { if (!targetMap.has(id)) return false; selectedId = id; return true; },
    setTargetState(id, value) {
      if (!validId(id)) throw new TypeError('Id de composición inválido');
      const target = targetMap.get(id);
      if (!target || id !== selectedId || !availability().available) return false;
      if (target.kind === 'cockpit-camera') {
        if (!target.capabilities.lens && (value?.lensMode !== undefined || value?.focalLengthMm !== undefined)) return false;
        const current = target.getState();
        const next = { ...current, ...value };
        if (!target.capabilities.position) next.positionOffsetM = current.positionOffsetM;
        if (!target.capabilities.rotation) next.rotationOffsetDeg = current.rotationOffsetDeg;
        target.applyState(sanitizeCockpitCalibration(next));
        return true;
      }
      const current = target.getState();
      const next = { ...current };
      for (const key of ['position', 'rotation', 'scale']) if (target.capabilities[key] && value?.[key] !== undefined) next[key] = value[key];
      target.applyState(sanitizeTransform(next, current));
      return true;
    },
    setCockpitCameraCalibration(value) {
      const target = targetMap.get('cockpit-camera');
      if (!target) return false;
      target.applyState(sanitizeCockpitCalibration(value));
      return true;
    },
    setElementTransform(id, value) {
      const target = targetMap.get(id);
      if (target?.kind === 'cockpit-camera') throw new TypeError('cockpit-camera requires setCockpitCameraCalibration');
      return this.setTargetState(id, value);
    },
    resetTarget(id = selectedId) {
      const target = targetMap.get(id);
      if (!target) return false;
      target.reset();
      return true;
    },
  });
}

export function createCompositionState({ storage = null, keys = {}, initial = {}, defaults = COMPOSITION_STATE_DEFAULTS, background = {}, frontCut = {}, build = '' } = {}) {
  const storageKeys = { layout: keys.layout || 'cockpit-chevy-layout-editor-v1', background: keys.background || 'cockpit-chevy-background-editor-v1', frontCut: keys.frontCut || 'cockpit-chevy-front-cut-editor-v1' };
  const resetDefaults = sanitizeCompositionState(defaults);
  let layout = sanitizeCompositionState(initial);
  let backgroundState = clone(background);
  let frontCutState = clone(frontCut);
  const write = (key, value) => storage?.setItem?.(key, value);
  const read = key => storage?.getItem?.(key) ?? null;
  const restore = (key, value) => { if (value === null) storage?.removeItem?.(key); else write(key, value); };

  return Object.freeze({
    getState: () => freeze(clone(layout)),
    getBackground: () => freeze(clone(backgroundState)),
    getFrontCut: () => freeze(clone(frontCutState)),
    replaceFacets({ background: nextBackground = backgroundState, frontCut: nextFrontCut = frontCutState } = {}) {
      backgroundState = clone(nextBackground);
      frontCutState = clone(nextFrontCut);
      return freeze({ background: clone(backgroundState), frontCut: clone(frontCutState) });
    },
    setCockpitCalibration(value) {
      layout = sanitizeCompositionState({ ...layout, camera: { cockpit: value } });
      return layout.camera.cockpit;
    },
    setTargetState(id, value) {
      if (!validId(id)) throw new TypeError('Id de composición inválido');
      layout = sanitizeCompositionState({ ...layout, transforms: { ...layout.transforms, [id]: value } });
      return layout.transforms[id];
    },
    resetAll({ background: nextBackground = {}, frontCut: nextFrontCut = {} } = {}) {
      const before = { layout, backgroundState, frontCutState };
      let raw;
      try {
        raw = { layout: read(storageKeys.layout), background: read(storageKeys.background), frontCut: read(storageKeys.frontCut) };
        layout = sanitizeCompositionState({ ...resetDefaults, build });
        backgroundState = clone(nextBackground);
        frontCutState = clone(nextFrontCut);
        write(storageKeys.layout, serializeCompositionState(layout, layout.build));
        write(storageKeys.background, JSON.stringify(backgroundState));
        write(storageKeys.frontCut, JSON.stringify(frontCutState));
        return freeze({ ok: true, error: null });
      } catch (error) {
        layout = before.layout;
        backgroundState = before.backgroundState;
        frontCutState = before.frontCutState;
        for (const key of raw ? ['layout', 'background', 'frontCut'] : []) {
          try { restore(storageKeys[key], raw[key]); } catch {}
        }
        return freeze({ ok: false, error: String(error?.message || error) });
      }
    },
  });
}
