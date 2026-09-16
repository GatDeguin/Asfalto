import { VEHICLE_CATALOG } from '../render/vehicle-catalog.mjs?v=full-r1-20260916';

const FALLBACK = 'Vehículo seleccionado';
function definition(id, catalog) {
  if (typeof id !== 'string' || !Object.hasOwn(catalog, id)) return null;
  const entry = catalog[id];
  return entry?.selectable !== false && typeof entry?.label === 'string' && entry.label.trim() ? entry : null;
}

/** A display name only: IDs, model filenames and calibration are not specifications. */
export function selectedVehicleLabel(id, catalog = VEHICLE_CATALOG) {
  return definition(id, catalog)?.label || FALLBACK;
}

function committedVehicleId() {
  return globalThis.__chevyV6Complete?.workshop?.vehicleId || globalThis.__asfaltoSelectedPlayerVehicle;
}

/** Bind committed selection, never the pending select value or persisted request. */
export function bindSelectedVehicleLabels({
  root, events = globalThis, getVehicleId = committedVehicleId, catalog = VEHICLE_CATALOG,
} = {}) {
  let disposed = false, committedId;
  function refresh(eventId) {
    if (disposed) return;
    let current;
    try { current = getVehicleId(); } catch { /* The host can still be initializing. */ }
    const id = definition(eventId, catalog) ? eventId : current || committedId;
    if (definition(id, catalog)) committedId = id;
    const label = selectedVehicleLabel(id, catalog);
    for (const node of root?.querySelectorAll('[data-selected-vehicle-label]') || []) node.textContent = label;
  }
  function onSelected(event) {
    const id = event.detail?.id;
    if (definition(id, catalog)) refresh(id);
  }
  function onReady() { refresh(); }
  events?.addEventListener?.('asfalto:vehicle-selected', onSelected);
  events?.addEventListener?.('asfalto-menu-ready', onReady);
  refresh();
  return {
    refresh: () => refresh(),
    dispose() {
      if (disposed) return;
      disposed = true;
      events?.removeEventListener?.('asfalto:vehicle-selected', onSelected);
      events?.removeEventListener?.('asfalto-menu-ready', onReady);
    },
  };
}
