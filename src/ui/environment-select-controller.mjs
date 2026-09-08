const OPTIONS = Object.freeze([
  Object.freeze({ id: 'clear', label: 'Día despejado' }),
  Object.freeze({ id: 'overcast', label: 'Día nublado' }),
  Object.freeze({ id: 'golden-hour', label: 'Tarde dorada' }),
  Object.freeze({ id: 'sunset', label: 'Atardecer' }),
  Object.freeze({ id: 'moonrise', label: 'Noche con luna' }),
  Object.freeze({ id: 'night', label: 'Noche profunda' }),
]);
const IDS = new Set(OPTIONS.map(option => option.id));
const LEGACY_BY_PRESET = Object.freeze({
  clear: Object.freeze({ weather: 'clear', timeOfDay: 'day' }),
  overcast: Object.freeze({ weather: 'cloudy', timeOfDay: 'day' }),
  'golden-hour': Object.freeze({ weather: 'clear', timeOfDay: 'afternoon' }),
  sunset: Object.freeze({ weather: 'clear', timeOfDay: 'sunset' }),
  moonrise: Object.freeze({ weather: 'clear', timeOfDay: 'moonrise' }),
  night: Object.freeze({ weather: 'cloudy', timeOfDay: 'night' }),
});

function assertPreset(id) {
  if (!IDS.has(id)) throw new RangeError(`Invalid environment preset: ${id}`);
  return id;
}

export function legacySettingsForEnvironmentPreset(id, settings = {}) {
  return { skyId: assertPreset(id), timeOfDay: LEGACY_BY_PRESET[id].timeOfDay, weather: settings.weather || 'clear' };
}

export function environmentPresetForLegacySettings(settings = {}) {
  if (IDS.has(settings.skyId)) return settings.skyId;
  if (settings.timeOfDay === 'afternoon') return 'golden-hour';
  if (settings.timeOfDay === 'moonrise') return 'moonrise';
  const weather = ['cloudy', 'rain', 'storm'].includes(settings.weather) ? settings.weather : 'clear';
  const timeOfDay = ['day', 'dawn', 'sunset', 'night'].includes(settings.timeOfDay) ? settings.timeOfDay : 'day';
  if (timeOfDay === 'night') return weather === 'clear' ? 'moonrise' : 'night';
  if (timeOfDay === 'dawn') return 'golden-hour';
  if (timeOfDay === 'sunset') return 'sunset';
  if (weather !== 'clear') return 'overcast';
  return 'clear';
}

export function createEnvironmentSelectController({ select, createOption, getTrackDefault, onSelect, initialPreset = 'clear', onError, getCurrent }) {
  if (!select || typeof select.replaceChildren !== 'function' || typeof select.addEventListener !== 'function') {
    throw new TypeError('A valid environment select is required');
  }
  if (typeof createOption !== 'function' || typeof getTrackDefault !== 'function' || typeof onSelect !== 'function') {
    throw new TypeError('Environment select dependencies are required');
  }
  select.replaceChildren(...OPTIONS.map(option => createOption(option)));
  let disposed = false;
  let current = assertPreset(initialPreset);
  let revision = 0;
  select.value = current;
  const commit = async id => {
    if (disposed) return current;
    const requested = assertPreset(id);
    const requestRevision = ++revision;
    select.value = requested;
    try { await onSelect(requested); if (!disposed && revision === requestRevision) current = requested; }
    catch (error) {
      if (!disposed && revision === requestRevision) { current = assertPreset(getCurrent?.() || current); select.value = current; }
      throw error;
    }
    return current;
  };
  const onChange = () => commit(select.value).catch(error => { if (onError) onError(error); else throw error; });
  select.addEventListener('change', onChange);
  return Object.freeze({
    setPreset: commit,
    selectTrack: trackId => commit(assertPreset(getTrackDefault(trackId))),
    current: () => current,
    dispose() { if (!disposed) select.removeEventListener('change', onChange); disposed = true; revision++; },
  });
}

export { OPTIONS as ENVIRONMENT_SELECT_OPTIONS };
