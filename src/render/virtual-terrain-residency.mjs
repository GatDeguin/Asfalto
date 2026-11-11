import {TERRAIN_DETAIL_SLOTS} from './virtual-terrain-data.mjs?v=3cb3d32add0067b4';

/** Bounded GPU residency. Invisible pages can stay until their slots are needed. */
export function createTerrainResidency({pages, load, upload, capacity = TERRAIN_DETAIL_SLOTS}) {
  let wanted = new Set();
  const residents = new Map();
  const pending = new Map();
  const failed = new Set();
  const slots = Array.from({length: capacity}, (_, i) => pages.length + i);
  let disposed = false;
  let requests = 0;
  let evictions = 0;
  let cancellations = 0;
  let lastError = null;

  function place(id, bytes) {
    let slot = slots.pop();
    if (slot === undefined) {
      // Map iteration is least recently used first. Never evict a wanted page.
      const evict = [...residents].find(([resident]) => !wanted.has(resident));
      if (!evict) return;
      const [oldId, oldSlot] = evict;
      residents.delete(oldId);
      evictions++;
      slot = oldSlot;
    }
    try {
      upload(slot, bytes);
      residents.set(id, slot);
    } catch (error) {
      slots.push(slot);
      throw error;
    }
  }

  function pump() {
    if (disposed) return;
    for (const id of wanted) {
      if (pending.size >= 2) break;
      if (residents.has(id) || pending.has(id) || failed.has(id)) continue;
      const controller = new AbortController();
      pending.set(id, controller);
      requests++;
      void Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return load(pages[id], controller.signal);
      }).then(bytes => {
        if (!disposed && !controller.signal.aborted && wanted.has(id)) place(id, bytes);
      }).catch(error => {
        if (!controller.signal.aborted && !disposed) {
          failed.add(id);
          lastError = String(error?.message || error);
        }
      }).finally(() => {
        pending.delete(id);
        pump();
      });
    }
  }

  return {
    select(ids) {
      if (disposed) return;
      wanted = new Set(ids.slice(0, capacity));
      for (const [id, controller] of pending) {
        if (!wanted.has(id) && !controller.signal.aborted) {
          cancellations++;
          controller.abort();
        }
      }
      for (const id of wanted) if (residents.has(id)) {
        const slot = residents.get(id);
        residents.delete(id);
        residents.set(id, slot);
      }
      pump();
    },
    slotFor: id => wanted.has(id) ? residents.get(id) : undefined,
    diagnostics: () => ({resident: [...residents.keys()].sort((a, b) => a - b), wanted: [...wanted],
      pending: pending.size, requests, evictions, cancellations, errors: failed.size, lastError}),
    dispose() {
      disposed = true;
      wanted.clear();
      residents.clear();
      for (const controller of pending.values()) controller.abort();
    },
  };
}
