const ENVIRONMENTS = Object.freeze([
  'clear',
  'overcast',
  'golden',
  'sunset',
  'moonrise',
  'night',
]);
const ENVIRONMENT_PRESETS = Object.freeze(['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night']);
export const RESPAWN_CLEARANCE_M = 0.56;

const ADAPTER_METHODS = Object.freeze([
  'validate',
  'load',
  'unload',
  'sampleRoute',
  'projectToRoute',
  'surfaceAt',
  'resolveRespawn',
  'getSpawn',
  'getCheckpoints',
  'updateStreaming',
  'applyEnvironment',
  'getDiagnostics',
]);

const SAFE_ID = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_URL_CHARS = /^[A-Za-z0-9._~!$&'()+,;=@/-]+$/;
const SAFE_NODE = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;

export const TrackSurface = Object.freeze({
  ROAD: 'road',
  SHOULDER: 'shoulder',
  OFFROAD: 'offroad',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isSafeId(value) {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function canonicalizeRelativeUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || !SAFE_URL_CHARS.test(value)) return null;
  if (value.startsWith('/') || value.startsWith('\\') || value.includes('\\')) return null;
  if (value.includes('?') || value.includes('#') || value.includes('%') || value.includes(':')) return null;

  const rawSegments = value.split('/');
  const segments = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = rawSegments[index];
    if (segment === '.') continue;
    if (segment === '..' || segment.length === 0) return null;
    segments.push(segment);
  }
  return segments.length > 0 ? './' + segments.join('/') : null;
}

function canonicalizeUrlArray(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const canonical = value.map(canonicalizeRelativeUrl);
  return canonical.every((url) => url !== null) ? canonical : null;
}

function immutableResult(errors, manifest) {
  const result = {
    ok: errors.length === 0,
    errors: Object.freeze([...errors]),
  };
  if (manifest) result.manifest = manifest;
  return Object.freeze(result);
}

export function validateTrackManifest(raw) {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = [];

  if (value.schema !== 'asfalto-track/v1') {
    errors.push('schema must equal asfalto-track/v1');
  }
  if (!isSafeId(value.id)) {
    errors.push('id must be a safe stable identifier');
  }
  if (typeof value.displayName !== 'string' || value.displayName.trim().length === 0) {
    errors.push('displayName must be a nonempty string');
  }
  if (value.format !== 'point_to_point') {
    errors.push('format must equal point_to_point');
  }
  if (!Number.isFinite(value.lengthM) || value.lengthM <= 0) {
    errors.push('lengthM must be finite and positive');
  }
  if (!ENVIRONMENTS.includes(value.defaultEnvironment)) {
    errors.push('defaultEnvironment must be one of clear, overcast, golden, sunset, moonrise, night');
  }

  const canonicalRoute = canonicalizeRelativeUrl(value.route);
  const canonicalVisual = canonicalizeUrlArray(value.visual);
  const canonicalCollision = canonicalizeUrlArray(value.collision);
  if (canonicalRoute === null) {
    errors.push('route must be a safe relative URL');
  }
  if (canonicalVisual === null) {
    errors.push('visual must be a nonempty array of safe relative URLs');
  }
  if (canonicalCollision === null) {
    errors.push('collision must be a nonempty array of safe relative URLs');
  }

  let normalizedEnvironment = null;
  if (Object.hasOwn(value, 'environment')) {
    const environment = value.environment;
    if (!environment || typeof environment !== 'object' || Array.isArray(environment)) errors.push('environment must be an object');
    else {
      const profile = canonicalizeRelativeUrl(environment.profile);
      if (profile !== './environment.json') errors.push('environment.profile must equal ./environment.json');
      if (!ENVIRONMENT_PRESETS.includes(environment.defaultPreset)) errors.push('environment.defaultPreset is invalid');
      if (!Array.isArray(environment.availablePresets) || environment.availablePresets.length !== ENVIRONMENT_PRESETS.length
          || environment.availablePresets.some((id, index) => id !== ENVIRONMENT_PRESETS[index])) errors.push('environment.availablePresets must contain the canonical six presets');
      if (profile === './environment.json' && ENVIRONMENT_PRESETS.includes(environment.defaultPreset)
          && Array.isArray(environment.availablePresets) && environment.availablePresets.length === ENVIRONMENT_PRESETS.length
          && environment.availablePresets.every((id, index) => id === ENVIRONMENT_PRESETS[index])) normalizedEnvironment = { profile, defaultPreset: environment.defaultPreset, availablePresets: [...environment.availablePresets] };
    }
  }

  const hasCollisionExtension = Object.hasOwn(value, 'collisionMode') || Object.hasOwn(value, 'collisionNodes');
  const collisionMode = value.collisionMode;
  const collisionNodes = value.collisionNodes;
  if (hasCollisionExtension && !['separate', 'embedded'].includes(collisionMode)) errors.push('collisionMode must equal separate or embedded');
  if (hasCollisionExtension && (!Array.isArray(collisionNodes) || !collisionNodes.every(name => typeof name === 'string' && SAFE_NODE.test(name)) || new Set(collisionNodes).size !== collisionNodes.length)) errors.push('collisionNodes must contain unique safe stable GLB node names');
  if (hasCollisionExtension && collisionMode === 'embedded' && (!Array.isArray(collisionNodes) || collisionNodes.length === 0)) errors.push('embedded collisionMode requires at least one collision node');
  const routeAssets = canonicalRoute === null ? [] : [canonicalRoute];
  const visualAssets = canonicalVisual ?? [];
  const collisionAssets = canonicalCollision ?? [];
  const duplicateWithinVisual = new Set(visualAssets).size !== visualAssets.length;
  const duplicateWithinCollision = new Set(collisionAssets).size !== collisionAssets.length;
  const routeReused = visualAssets.includes(canonicalRoute) || collisionAssets.includes(canonicalRoute);
  const crossRoleReuse = visualAssets.some((url) => collisionAssets.includes(url));
  const duplicateAssets = duplicateWithinVisual || duplicateWithinCollision || routeReused
    || (collisionMode !== 'embedded' && crossRoleReuse);
  if (duplicateAssets || (
    collisionMode !== 'embedded'
    && new Set([...routeAssets, ...visualAssets, ...collisionAssets]).size
      !== routeAssets.length + visualAssets.length + collisionAssets.length
  )) {
    errors.push('asset URLs must be unique');
  }

  if (errors.length > 0) return immutableResult(errors);

  const manifest = {
    schema: value.schema,
    id: value.id,
    displayName: value.displayName,
    format: value.format,
    lengthM: value.lengthM,
    defaultEnvironment: value.defaultEnvironment,
    route: canonicalRoute,
    visual: canonicalVisual,
    collision: canonicalCollision,
  };
  if (normalizedEnvironment) manifest.environment = normalizedEnvironment;
  if (hasCollisionExtension) { manifest.collisionMode = collisionMode; manifest.collisionNodes = [...collisionNodes]; }
  deepFreeze(manifest);
  return immutableResult(errors, manifest);
}

export function assertTrackAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object' || Array.isArray(adapter)) {
    throw new TypeError('track adapter must be an object');
  }
  for (const method of ADAPTER_METHODS) {
    if (typeof adapter[method] !== 'function') {
      throw new TypeError('track adapter.' + method + ' must be a function');
    }
  }
  if (typeof adapter.ready !== 'boolean') {
    throw new TypeError('track adapter.ready must be a boolean');
  }
  return adapter;
}
