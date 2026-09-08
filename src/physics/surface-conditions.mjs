const TABLE = Object.freeze({
  dry: Object.freeze({ gripMultiplier: 1.00, rollingResistanceMultiplier: 1.00, aquaplaningEnabled: false, looseSurfaceDepthM: 0.000 }),
  damp: Object.freeze({ gripMultiplier: 0.91, rollingResistanceMultiplier: 1.08, aquaplaningEnabled: false, looseSurfaceDepthM: 0.002 }),
  wet: Object.freeze({ gripMultiplier: 0.80, rollingResistanceMultiplier: 1.14, aquaplaningEnabled: true, looseSurfaceDepthM: 0.008 }),
  dust: Object.freeze({ gripMultiplier: 0.74, rollingResistanceMultiplier: 1.20, aquaplaningEnabled: false, looseSurfaceDepthM: 0.012 }),
  'light-snow': Object.freeze({ gripMultiplier: 0.62, rollingResistanceMultiplier: 1.28, aquaplaningEnabled: false, looseSurfaceDepthM: 0.018 }),
  'heavy-snow': Object.freeze({ gripMultiplier: 0.48, rollingResistanceMultiplier: 1.50, aquaplaningEnabled: false, looseSurfaceDepthM: 0.050 }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function resolveSurfaceCondition({ baseSurface, trackProfile, preset, temperatureC }) {
  const baseMu = baseSurface?.mu;
  if (!Number.isFinite(baseMu) || baseMu <= 0) throw new TypeError('base surface mu must be finite and positive');
  if (!Number.isFinite(temperatureC)) throw new TypeError('surface temperature must be finite');
  const requested = typeof preset === 'string' ? preset : preset?.surfaceState;
  if (!Object.hasOwn(TABLE, requested)) throw new RangeError(`unsupported surface state: ${requested}`);
  const allowed = trackProfile?.allowedSurfaceStates;
  if (!Array.isArray(allowed) || !allowed.every(state => Object.hasOwn(TABLE, state))) throw new TypeError('track profile allowedSurfaceStates is required');
  let state = requested;
  if (!allowed.includes(state)) {
    const fallback = trackProfile?.surfaceFallbacks?.[state];
    if (!Object.hasOwn(TABLE, fallback) || !allowed.includes(fallback)) throw new RangeError(`unsupported surface state without explicit fallback: ${state}`);
    state = fallback;
  }
  if (['light-snow', 'heavy-snow'].includes(state) && temperatureC > 2) throw new RangeError(`${state} requires temperature at or below 2 C`);
  const coefficients = TABLE[state];
  return Object.freeze({
    state,
    gripMultiplier: coefficients.gripMultiplier,
    rollingResistanceMultiplier: coefficients.rollingResistanceMultiplier,
    aquaplaningEnabled: coefficients.aquaplaningEnabled,
    looseSurfaceDepthM: coefficients.looseSurfaceDepthM,
    frictionMu: clamp(baseMu * coefficients.gripMultiplier, 0.35, 1.15),
    baseSurface: baseSurface.kind || 'unknown',
    temperatureC,
  });
}

export const SURFACE_CONDITION_TABLE = TABLE;
