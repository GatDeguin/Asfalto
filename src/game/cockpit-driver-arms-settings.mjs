export const DRIVER_ARMS_DEFAULTS = Object.freeze({
  enabled: false,
  shiftEnabled: true,
  gripDeg: 60,
  shoulderHeightCm: 0,
  shoulderReachCm: 0,
  shiftSeconds: .18,
});

const numeric = {
  gripDeg: { min: 34, max: 78, step: 1, text: value => `${value}°` },
  shoulderHeightCm: { min: -12, max: 12, step: 1, text: value => `${value} cm` },
  shoulderReachCm: { min: -12, max: 12, step: 1, text: value => `${value} cm` },
  shiftSeconds: { min: .10, max: .40, step: .01, text: value => `${Math.round(value * 1000)} ms` },
};

export function sanitizeDriverArmsSettings(value) {
  const saved = value && typeof value === 'object' ? value : {};
  const result = { ...DRIVER_ARMS_DEFAULTS, enabled: saved.enabled === true, shiftEnabled: saved.shiftEnabled !== false };
  for (const [key, { min, max, step }] of Object.entries(numeric)) {
    if (!Number.isFinite(saved[key])) continue;
    result[key] = Number((Math.round(Math.max(min, Math.min(max, saved[key])) / step) * step).toFixed(2));
  }
  return Object.freeze(result);
}

export function installDriverArmsSettings(section, { getSettings, onChange }) {
  if (!section) return null;
  const events = new AbortController();
  const options = { signal: events.signal };
  const fields = [...section.querySelectorAll('[data-driver-arms]')].map(input => {
    const key = input.dataset.driverArms;
    const range = numeric[key];
    if (range) {
      input.min = String(range.min);
      input.max = String(range.max);
      input.step = String(range.step);
    }
    const output = input.labels[0]?.querySelector('output');
    input.addEventListener(range ? 'input' : 'change', () => {
      apply({ ...getSettings(), [key]: range ? input.valueAsNumber : input.checked });
    }, options);
    return { input, output, key, range };
  });
  const reset = section.querySelector('[data-driver-arms-reset]');
  reset.addEventListener('click', () => apply({ ...DRIVER_ARMS_DEFAULTS, enabled: getSettings().enabled }), options);

  function refresh() {
    const value = getSettings();
    for (const { input, output, key, range } of fields) {
      input.disabled = key !== 'enabled' && (!value.enabled || (key === 'shiftSeconds' && !value.shiftEnabled));
      if (range) {
        input.value = value[key];
        if (output) output.textContent = range.text(value[key]);
      } else input.checked = value[key];
    }
    reset.disabled = !value.enabled;
  }
  function apply(value) {
    onChange(sanitizeDriverArmsSettings(value));
    refresh();
  }
  refresh();
  return { refresh, dispose: () => events.abort() };
}
