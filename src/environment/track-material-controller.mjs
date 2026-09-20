const ROLES = new Set(['asphalt', 'shoulder', 'terrain', 'water', 'snow']);
const SURFACES = new Set(['dry', 'damp', 'wet', 'dust', 'light-snow', 'heavy-snow']);
const FIELDS = ['roughness', 'metalness', 'envMapIntensity', 'color', 'clearcoat', 'clearcoatRoughness', 'needsUpdate'];

function cloneValue(value) {
  if (value?.clone instanceof Function) return value.clone();
  if (value && typeof value === 'object') return structuredClone(value);
  return value;
}

function snapshot(material, supplied = {}) {
  const result = {};
  for (const field of FIELDS) {
    if (Object.hasOwn(supplied, field)) result[field] = cloneValue(supplied[field]);
    else if (field in material) result[field] = cloneValue(material[field]);
  }
  return Object.freeze(result);
}

function restoreField(material, field, value) {
  if (field === 'color' && material.color?.copy instanceof Function && value && typeof value === 'object') material.color.copy(value);
  else if (field === 'color' && material.color?.set instanceof Function) material.color.set(value);
  else material[field] = cloneValue(value);
}

function setColor(material, value) {
  if (material.color?.set instanceof Function) material.color.set(value);
  else material.color = value;
}

function scaled(material, baseline, field, multiplier) {
  if (Number.isFinite(baseline[field])) material[field] = baseline[field] * multiplier;
}

export function createTrackMaterialController(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('track material adapter is required');
  const raw = adapter.getMaterialBindings?.() ?? [];
  if (!Array.isArray(raw)) throw new TypeError('material bindings must be an array');
  const seen = new Set();
  const bindings = raw.map((binding, index) => {
    if (!binding || !ROLES.has(binding.role)) throw new TypeError(`invalid material role at ${index}`);
    const material = binding.material;
    if (!material || typeof material !== 'object') throw new TypeError(`invalid material at ${index}`);
    if (seen.has(material)) throw new TypeError('duplicate material binding');
    seen.add(material);
    return Object.freeze({ role: binding.role, material, baseline: snapshot(material, binding.baseline) });
  });
  let disposed = false;
  let currentState = 'dry';
  let applications = 0;

  function restore() {
    let restored = 0;
    for (const binding of bindings) {
      for (const [field, value] of Object.entries(binding.baseline)) {
        const calibrated = field === 'color' ? binding.material.userData?.asfaltoSurfaceColorBase : null;
        restoreField(binding.material, field, calibrated || value);
      }
      restored += 1;
    }
    currentState = 'dry';
    return restored;
  }

  function apply(environmentState) {
    if (disposed) throw new Error('track material controller is disposed');
    const state = environmentState?.surfaceState;
    if (!SURFACES.has(state)) throw new RangeError(`unsupported material surface state: ${state}`);
    restore();
    let affected = 0;
    const wetness = state === 'wet' ? 1 : state === 'damp' ? 0.5 : 0;
    for (const binding of bindings) {
      const { material, baseline, role } = binding;
      let changed = false;
      if (wetness > 0 && role === 'asphalt' && !material.userData?.asfaltoTemporalWeather) {
        scaled(material, baseline, 'roughness', state === 'wet' ? 0.68 : 0.84);
        scaled(material, baseline, 'envMapIntensity', state === 'wet' ? 1.18 : 1.09);
        if (Number.isFinite(baseline.clearcoat)) material.clearcoat = Math.min(0.22, baseline.clearcoat + wetness * 0.19);
        if (Number.isFinite(baseline.clearcoatRoughness)) material.clearcoatRoughness = Math.max(0.08, baseline.clearcoatRoughness * (1 - wetness * 0.35));
        changed = true;
      } else if (wetness > 0 && role === 'shoulder' && !material.userData?.asfaltoTemporalWeather) {
        scaled(material, baseline, 'roughness', state === 'wet' ? 0.82 : 0.91);
        changed = true;
      } else if (state === 'dust' && (role === 'shoulder' || role === 'terrain')) {
        // Photographic terrain already contains local rock/soil color. A flat tint
        // destroyed the calibrated Lipán layers on every environment application.
        if (!material.userData?.asfaltoSurfaceColorBase) setColor(material, role === 'shoulder' ? '#A5845F' : '#8D7658');
        else if (material.color?.multiplyScalar) material.color.multiplyScalar(1.015);
        changed = true;
      } else if (['light-snow', 'heavy-snow'].includes(state) && role === 'snow') {
        setColor(material, '#F1F4F5');
        scaled(material, baseline, 'roughness', 0.85);
        scaled(material, baseline, 'envMapIntensity', 1.12);
        changed = true;
      }
      if (changed) { material.needsUpdate = true; affected += 1; }
    }
    currentState = state;
    applications += 1;
    return affected;
  }

  function dispose() {
    if (!disposed) { const restored = restore(); disposed = true; return { disposed: true, restored }; }
    return { disposed: true, restored: bindings.length };
  }

  function diagnostics() {
    return Object.freeze({ bindings: bindings.length, applications, currentState, disposed, roles: Object.freeze(bindings.map(binding => binding.role)) });
  }

  return Object.freeze({ apply, restore, dispose, diagnostics });
}
