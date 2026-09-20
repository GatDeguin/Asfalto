import { sanitizeHeadMotionCalibration } from './cockpit-head-motion.mjs';

const installations = new WeakMap();
const numericControls = Object.freeze([
  { key: 'intensity', label: 'Intensidad', min: 0, max: 2 },
  { key: 'responseSpeed', label: 'Rapidez de respuesta', min: .25, max: 3 },
  { key: 'translationScale', label: 'Desplazamiento', min: 0, max: 2 },
  { key: 'rotationScale', label: 'Inclinación', min: 0, max: 2 },
]);
const kebab = key => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** Adds an owned group below the lens; refresh is read-only, onChange persists. */
export function installHeadMotionControls({ root = globalThis.document, getValue = () => ({}), onChange = () => {} } = {}) {
  const lens = root?.querySelector?.('#editor-camera-lens');
  const doc = lens?.ownerDocument || root;
  if (!lens || !doc?.createElement) return null;
  installations.get(lens)?.dispose();
  const group = doc.createElement('section');
  group.className = 'editor-head-motion-controls';
  group.setAttribute('aria-label', 'Cabeceo · movimiento de cabeza');
  const create = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const title = create('div', 'editor-vector-title', 'Cabeceo · movimiento de cabeza');
  title.append(create('span', '', 'físico'));
  group.append(title);
  const enabledRow = create('label', 'setting-row switch-row');
  const enabledLabel = create('span', '', 'Activar');
  enabledLabel.append(create('small', '', 'Responde a frenadas, curvas y suspensión.'));
  const enabled = create('input'); enabled.type = 'checkbox'; enabled.id = 'editor-head-motion-enabled'; enabled.setAttribute('aria-label', 'Activar movimiento de cabeza');
  enabledRow.append(enabledLabel, enabled, create('i')); group.append(enabledRow);
  const rows = numericControls.map(spec => {
    const row = create('label', 'slider-row'), label = create('span', '', spec.label), output = create('output');
    const input = create('input'); input.type = 'range'; input.id = `editor-head-motion-${kebab(spec.key)}`; input.min = String(spec.min); input.max = String(spec.max); input.step = '.05'; input.setAttribute('aria-label', `${spec.label} del movimiento de cabeza`);
    output.setAttribute('for', input.id); label.append(output); row.append(label, input); group.append(row);
    return { ...spec, input, output };
  });
  group.append(create('p', 'editor-tip', 'El tablero conserva su posición y se ve desde el movimiento de la cabeza.'));
  lens.append(group);
  let disposed = false;
  function refresh() {
    if (disposed) return;
    const value = sanitizeHeadMotionCalibration(getValue());
    enabled.checked = value.enabled;
    for (const row of rows) { row.input.value = String(value[row.key]); row.input.disabled = !value.enabled; row.output.textContent = `${value[row.key].toFixed(2)}×`; }
    return value;
  }
  function change(key, value) {
    if (disposed) return;
    const next = sanitizeHeadMotionCalibration({ ...sanitizeHeadMotionCalibration(getValue()), [key]: value });
    onChange({ ...next });
    refresh();
  }
  const onEnabled = () => change('enabled', enabled.checked);
  enabled.addEventListener('change', onEnabled);
  for (const row of rows) { row.onInput = () => change(row.key, Number(row.input.value)); row.input.addEventListener('input', row.onInput); }
  const controller = Object.freeze({
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      enabled.removeEventListener('change', onEnabled);
      for (const row of rows) row.input.removeEventListener('input', row.onInput);
      group.remove();
      if (installations.get(lens) === controller) installations.delete(lens);
    },
  });
  installations.set(lens, controller);
  refresh();
  return controller;
}
