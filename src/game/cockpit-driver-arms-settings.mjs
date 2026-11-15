export const DRIVER_ARMS_DEFAULTS = Object.freeze({
  enabled: false,
  shiftEnabled: true,
  gripDeg: 90,
  poseVersion: 2,
  shoulderHeightCm: 0,
  shoulderReachCm: 0,
  shiftSeconds: .18,
});

const numeric = {
  gripDeg: { min: 60, max: 120, step: 1, text: value => ({ 60: '10 y 2', 90: '9 y 3', 120: '8 y 4' }[value] ?? `${value}°`) },
  shoulderHeightCm: { min: -12, max: 12, step: 1, text: value => `${value} cm` },
  shoulderReachCm: { min: -12, max: 12, step: 1, text: value => `${value} cm` },
  shiftSeconds: { min: .10, max: .40, step: .01, text: value => `${Math.round(value * 1000)} ms` },
};

export function sanitizeDriverArmsSettings(value) {
  const saved = value && typeof value === 'object' ? value : {};
  const result = { ...DRIVER_ARMS_DEFAULTS, enabled: saved.enabled === true, shiftEnabled: saved.shiftEnabled !== false };
  for (const [key, { min, max, step }] of Object.entries(numeric)) {
    const prior = saved[key];
    if (!Number.isFinite(prior)) continue;
    if (key === 'gripDeg' && prior === 60 && !saved.poseVersion) continue;
    result[key] = Number((Math.round(Math.max(min, Math.min(max, prior)) / step) * step).toFixed(2));
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
        const text = range.text(value[key]);
        input.setAttribute('aria-valuetext', text);
        if (output) output.textContent = text;
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
