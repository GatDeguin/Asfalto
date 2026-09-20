import { validateTrackManifest } from './track-contract.mjs?v=7d88fa8e85b8ea4d';

const PRESETS = Object.freeze(['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function validateShippingTrackManifest(raw) {
  const base = validateTrackManifest(raw);
  const errors = [...base.errors];
  const environment = raw?.environment;
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) errors.push('environment declaration is required');
  else {
    if (environment.profile !== './environment.json') errors.push('environment.profile must equal ./environment.json');
    if (!PRESETS.includes(environment.defaultPreset)) errors.push('environment.defaultPreset is invalid');
    if (!Array.isArray(environment.availablePresets) || environment.availablePresets.length !== PRESETS.length
        || environment.availablePresets.some((id, index) => id !== PRESETS[index])) errors.push('environment.availablePresets must contain the canonical six presets');
  }
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  const manifest = freeze({ ...base.manifest, environment: { profile: environment.profile, defaultPreset: environment.defaultPreset, availablePresets: [...environment.availablePresets] } });
  return Object.freeze({ ok: true, errors: Object.freeze([]), manifest });
}

export { PRESETS as TRACK_ENVIRONMENT_PRESET_IDS };
