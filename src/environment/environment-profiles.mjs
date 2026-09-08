const PRESET_IDS = Object.freeze(['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night']);
const WEATHER_IDS = Object.freeze(['clear', 'cloudy', 'rain', 'storm', 'fog', 'light-snow', 'heavy-snow']);
const TRACK_DEFAULTS = Object.freeze({
  dos_lagos: 'clear',
  aconcagua_horcones: 'golden-hour',
  paso_garibaldi: 'overcast',
  cuesta_lipan: 'clear',
  cataratas_iguazu:'clear',
});
const SURFACE_STATES = new Set(['dry', 'damp', 'wet', 'dust', 'light-snow', 'heavy-snow']);
const PRECIPITATION = new Set(['none', 'rain', 'storm', 'light-snow', 'heavy-snow']);
const HEADLIGHTS = new Set(['off', 'available', 'required']);

const BASE = {
  clear: { skyId: 'clear', exposure: 1.00, sun: { azimuthDeg: 320, elevationDeg: 52, lux: 90000, color: '#FFF0D2' }, ambient: { intensity: 0.70, color: '#DDEEFF' }, fog: { color: '#CADCE3', density: 0.000045, near: 150, far: 40000 }, precipitation: 'none', surfaceState: 'dry', headlightPolicy: 'off' },
  overcast: { skyId: 'overcast', exposure: 1.25, sun: { azimuthDeg: 340, elevationDeg: 55, lux: 18000, color: '#D8E2E8' }, ambient: { intensity: 0.95, color: '#D0DAE0' }, fog: { color: '#B9CBD0', density: 0.00035, near: 50, far: 12000 }, precipitation: 'none', surfaceState: 'damp', headlightPolicy: 'available' },
  'golden-hour': { skyId: 'golden-hour', exposure: 1.10, sun: { azimuthDeg: 280, elevationDeg: 14, lux: 34000, color: '#FFD19A' }, ambient: { intensity: 0.72, color: '#D9B48C' }, fog: { color: '#C9A77C', density: 0.00008, near: 100, far: 28000 }, precipitation: 'none', surfaceState: 'dry', headlightPolicy: 'available' },
  sunset: { skyId: 'sunset', exposure: 1.35, sun: { azimuthDeg: 270, elevationDeg: 4, lux: 10000, color: '#FFAD7A' }, ambient: { intensity: 0.55, color: '#9E8190' }, fog: { color: '#8F7280', density: 0.00030, near: 50, far: 12000 }, precipitation: 'none', surfaceState: 'dry', headlightPolicy: 'available' },
  moonrise: { skyId: 'moonrise', exposure: 1.60, sun: { azimuthDeg: 80, elevationDeg: 18, lux: 1200, color: '#9DB8DC' }, ambient: { intensity: 0.25, color: '#35445E' }, fog: { color: '#35445E', density: 0.00025, near: 40, far: 10000 }, precipitation: 'none', surfaceState: 'dry', headlightPolicy: 'required' },
  night: { skyId: 'night', exposure: 1.55, sun: { azimuthDeg: 0, elevationDeg: -8, lux: 0, color: '#6F86AD' }, ambient: { intensity: 0.12, color: '#101727' }, fog: { color: '#101727', density: 0.00018, near: 30, far: 9000 }, precipitation: 'none', surfaceState: 'dry', headlightPolicy: 'required' },
};

const TRACKS = {
  cataratas_iguazu:{allowedSurfaceStates:['dry','damp','wet'],climateBounds:[2,44],clearSurfaceState:'dry',temperatures:{clear:29,overcast:25,'golden-hour':27,sunset:24,moonrise:22,night:21}},
  dos_lagos: {
    allowedSurfaceStates: ['dry', 'damp', 'wet'], climateBounds: [-12, 32], clearSurfaceState: 'dry',
    temperatures: { clear: 16, overcast: 10, 'golden-hour': 12, sunset: 9, moonrise: 5, night: 4 },
  },
  aconcagua_horcones: {
    allowedSurfaceStates: ['dry', 'damp', 'wet'], climateBounds: [-20, 28], clearSurfaceState: 'dry',
    temperatures: { clear: 7, overcast: 2, 'golden-hour': 9, sunset: 4, moonrise: -2, night: -6 },
  },
  paso_garibaldi: {
    allowedSurfaceStates: ['dry', 'damp', 'wet', 'light-snow', 'heavy-snow'], climateBounds: [-22, 20], clearSurfaceState: 'dry',
    temperatures: { clear: 8, overcast: 5, 'golden-hour': 7, sunset: 4, moonrise: -1, night: -4 },
  },
  cuesta_lipan: {
    allowedSurfaceStates: ['dry', 'damp', 'wet', 'dust', 'light-snow', 'heavy-snow'], climateBounds: [-25, 35], clearSurfaceState: 'dust',
    temperatures: { clear: 14, overcast: 6, 'golden-hour': 11, sunset: 5, moonrise: -5, night: -9 },
  },
};

// These are explicit climate choices, never inferred from an HDRI/time preset.
const WEATHER = deepFreeze({
  clear: { precipitation: 'none', precipitationIntensity: 0, roadWetness: 0, surfaceState: 'dry', fogDensityMin: 0, headlightPolicy: 'off' },
  cloudy: { precipitation: 'none', precipitationIntensity: 0, roadWetness: .35, surfaceState: 'damp', fogDensityMin: .004, headlightPolicy: 'available' },
  rain: { precipitation: 'rain', precipitationIntensity: .65, roadWetness: .7, surfaceState: 'wet', fogDensityMin: .006, headlightPolicy: 'available' },
  storm: { precipitation: 'storm', precipitationIntensity: 1, roadWetness: .9, surfaceState: 'wet', fogDensityMin: .009, headlightPolicy: 'required' },
  fog: { precipitation: 'none', precipitationIntensity: 0, roadWetness: .35, surfaceState: 'damp', fogDensityMin: .018, headlightPolicy: 'required' },
  'light-snow': { precipitation: 'light-snow', precipitationIntensity: .35, roadWetness: .1, surfaceState: 'light-snow', fogDensityMin: .006, headlightPolicy: 'required' },
  'heavy-snow': { precipitation: 'heavy-snow', precipitationIntensity: 1, roadWetness: .12, surfaceState: 'heavy-snow', fogDensityMin: .014, headlightPolicy: 'required' },
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finite(value, min, max, field) {
  if (!Number.isFinite(value) || value < min || value > max) throw new TypeError(`invalid environment ${field}`);
}

function validateResolved(value, profile) {
  finite(value.exposure, 0.1, 3, 'exposure');
  finite(value.sun.azimuthDeg, -360, 360, 'sun.azimuthDeg'); finite(value.sun.elevationDeg, -30, 90, 'sun.elevationDeg'); finite(value.sun.lux, 0, 150000, 'sun.lux');
  finite(value.ambient.intensity, 0, 4, 'ambient.intensity'); finite(value.fog.density, 0, 0.1, 'fog.density'); finite(value.fog.near, 0, 100000, 'fog.near'); finite(value.fog.far, 1, 100000, 'fog.far');
  finite(value.temperatureC, profile.climateBounds[0], profile.climateBounds[1], 'temperatureC');
  finite(value.roadWetness, 0, 1, 'roadWetness');
  finite(value.precipitationIntensity, 0, 1, 'precipitationIntensity');
  for (const [color, field] of [[value.sun.color, 'sun.color'], [value.ambient.color, 'ambient.color'], [value.fog.color, 'fog.color']]) if (!/^#[0-9A-F]{6}$/.test(color)) throw new TypeError(`invalid environment ${field}`);
  if (value.fog.far <= value.fog.near || !SURFACE_STATES.has(value.surfaceState) || !profile.allowedSurfaceStates.includes(value.surfaceState) || !PRECIPITATION.has(value.precipitation) || !HEADLIGHTS.has(value.headlightPolicy)) throw new TypeError('incompatible environment profile');
  if (['rain', 'storm'].includes(value.precipitation) && !['damp', 'wet'].includes(value.surfaceState)) throw new TypeError('rain requires damp or wet surface');
  if (['light-snow', 'heavy-snow'].includes(value.precipitation) && (value.surfaceState !== value.precipitation || value.temperatureC > 2)) throw new TypeError('snow requires a matching cold snow surface');
  if (['moonrise', 'night'].includes(value.presetId) && value.headlightPolicy !== 'required') throw new TypeError('dark presets require headlights');
}

export function resolveEnvironment(trackId, presetId = TRACK_DEFAULTS[trackId], weatherId = 'clear') {
  const profile = TRACKS[trackId];
  if (!profile) throw new RangeError(`unknown environment track: ${trackId}`);
  if (!PRESET_IDS.includes(presetId)) throw new RangeError(`unknown environment preset: ${presetId}`);
  if (!WEATHER_IDS.includes(weatherId)) throw new RangeError(`unknown environment weather: ${weatherId}`);
  if (['light-snow', 'heavy-snow'].includes(weatherId) && !profile.allowedSurfaceStates.includes(weatherId)) throw new RangeError(`incompatible environment weather ${weatherId}: ${trackId}`);
  const base = BASE[presetId];
  const weather = WEATHER[weatherId];
  const temperatureC = profile.temperatures[presetId];
  const headlightPolicies = ['off', 'available', 'required'];
  const resolved = {
    trackId, presetId, weatherId, ...structuredClone(base),
    temperatureC: weatherId === 'heavy-snow' ? Math.min(temperatureC, -3) : weatherId === 'light-snow' ? Math.min(temperatureC, -1) : temperatureC,
    precipitation: weather.precipitation,
    precipitationIntensity: weather.precipitationIntensity,
    roadWetness: weather.roadWetness,
    surfaceState: weatherId === 'clear' ? profile.clearSurfaceState : weather.surfaceState,
    fog: { ...base.fog, density: Math.max(base.fog.density, weather.fogDensityMin) },
    headlightPolicy: headlightPolicies[Math.max(headlightPolicies.indexOf(base.headlightPolicy), headlightPolicies.indexOf(weather.headlightPolicy))],
  };
  validateResolved(resolved, profile);
  return deepFreeze(resolved);
}

export function getTrackEnvironmentPolicy(trackId) {
  const profile = TRACKS[trackId];
  if (!profile) throw new RangeError(`unknown environment track: ${trackId}`);
  return deepFreeze({ allowedSurfaceStates: [...profile.allowedSurfaceStates], climateBounds: [...profile.climateBounds], availableWeatherIds: getWeatherOptionsForTrack(trackId), defaultWeather: 'clear' });
}

export function getWeatherOptionsForTrack(trackId) {
  const profile = TRACKS[trackId];
  if (!profile) throw new RangeError(`unknown environment track: ${trackId}`);
  return Object.freeze(WEATHER_IDS.filter(id => !['light-snow', 'heavy-snow'].includes(id) || profile.allowedSurfaceStates.includes(id)));
}

export const ENVIRONMENT_PRESET_IDS = PRESET_IDS;
export const ENVIRONMENT_WEATHER_IDS = WEATHER_IDS;
export const TRACK_ENVIRONMENT_DEFAULTS = TRACK_DEFAULTS;

for (const trackId of Object.keys(TRACKS)) for (const presetId of PRESET_IDS) for (const weatherId of getWeatherOptionsForTrack(trackId)) resolveEnvironment(trackId, presetId, weatherId);
