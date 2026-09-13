const QUALITIES = new Set(['high', 'balanced', 'low']);
const SAFE_ID = /^[A-Z][A-Z0-9_]{0,31}$/;

function abortError(reason) {
  if (reason instanceof Error) return reason;
  return Object.assign(new Error('streaming operation aborted'), { name: 'AbortError' });
}

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function normalizeSectors(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('sectors must be a nonempty array');
  const ids = new Set();
  const sectors = value.map((sector, index) => {
    if (!sector || typeof sector !== 'object') throw new TypeError(`sectors[${index}] must be an object`);
    if (typeof sector.id !== 'string' || !SAFE_ID.test(sector.id) || ids.has(sector.id)) {
      throw new TypeError(`sectors[${index}].id is invalid`);
    }
    ids.add(sector.id);
    const startM = Number(sector.startM);
    const endM = Number(sector.endM);
    if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
      throw new TypeError(`${sector.id} has invalid route bounds`);
    }
    if (index > 0 && startM !== Number(value[index - 1].endM)) {
      throw new TypeError(`${sector.id} does not continuously follow the previous sector`);
    }
    const visual = {};
    for (let lod = 0; lod <= 2; lod += 1) {
      const asset = sector.visual?.[`lod${lod}`];
      if (!asset || typeof asset.url !== 'string' || asset.url.length === 0) {
        throw new TypeError(`${sector.id}.visual.lod${lod} is invalid`);
      }
      visual[`lod${lod}`] = Object.freeze({ ...asset });
    }
    if (!sector.collision || typeof sector.collision.url !== 'string' || sector.collision.url.length === 0) {
      throw new TypeError(`${sector.id}.collision is invalid`);
    }
    const localOrigin = Array.isArray(sector.localOrigin) ? sector.localOrigin.map(Number) : [];
    if (localOrigin.length !== 3 || !localOrigin.every(Number.isFinite)) {
      throw new TypeError(`${sector.id}.localOrigin is invalid`);
    }
    return Object.freeze({
      ...sector,
      startM,
      endM,
      localOrigin: Object.freeze(localOrigin),
      visual: Object.freeze(visual),
      collision: Object.freeze({ ...sector.collision }),
    });
  });
  return Object.freeze(sectors);
}

function desiredFor(index, quality, sectors) {
  const visual = new Map();
  const put = (offset, lod) => {
    const sector = sectors[index + offset];
    if (sector) visual.set(sector.id, lod);
  };
  if (quality === 'high') {
    put(-2, 2);
    put(-1, 1);
    put(0, 0);
    put(1, 1);
    put(2, 2);
  } else if (quality === 'balanced') {
    put(-1, 2);
    put(0, 0);
    put(1, 2);
  } else {
    put(0, 1);
    put(1, 2);
  }
  const collision = new Set();
  for (const offset of [-1, 0, 1]) {
    const sector = sectors[index + offset];
    if (sector) collision.add(sector.id);
  }
  return { visual, collision };
}

export function createSectorStreamer(options = {}) {
  const sectors = normalizeSectors(options.sectors);
  const sectorById = new Map(sectors.map((sector) => [sector.id, sector]));
  const loadVisual = requireFunction(options.loadVisual, 'loadVisual');
  const loadCollision = requireFunction(options.loadCollision, 'loadCollision');
  const disposeVisual = requireFunction(options.disposeVisual, 'disposeVisual');
  const disposeCollision = requireFunction(options.disposeCollision, 'disposeCollision');
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new TypeError('signal must be an AbortSignal');
  }

  // Lipan keeps its prepared road/terrain surface while automatic render quality changes.
  // Other adapters retain the original LOD policy unless they opt in.
  const stableGeometry = options.stableQualityGeometry === true;
  const updateVisualQuality = options.updateVisualQuality === undefined ? null
    : requireFunction(options.updateVisualQuality, 'updateVisualQuality');
  const now = options.now === undefined ? () => globalThis.performance?.now?.() ?? Date.now()
    : requireFunction(options.now, 'now');
  const retryDelayMs = Number(options.retryDelayMs ?? 0);
  const retryMaxDelayMs = Number(options.retryMaxDelayMs ?? 30000);
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0 || !Number.isFinite(retryMaxDelayMs) || retryMaxDelayMs < retryDelayMs) {
    throw new RangeError('invalid streaming retry delay');
  }
  let lastFailure = null;
  const visual = new Map();
  const collision = new Map();
  let generation = 0;
  let active = null;
  let disposed = false;
  let disposal = null;
  let currentSector = null;
  let quality = null;
  let updates = 0;
  let peakVisualSectors = 0;
  let peakCollisionSectors = 0;

  function sectorIndexAt(sM) {
    if (!Number.isFinite(sM)) throw new TypeError('sM must be finite');
    const first = sectors[0];
    const last = sectors.at(-1);
    if (sM < first.startM || sM > last.endM) throw new RangeError('sM is outside the streamed route');
    const index = sectors.findIndex((sector, candidate) => sM >= sector.startM
      && (candidate === sectors.length - 1 ? sM <= sector.endM : sM < sector.endM));
    if (index < 0) throw new RangeError('sM does not belong to a sector');
    return index;
  }

  function isCurrent(operation) {
    return !disposed && active === operation && !operation.controller.signal.aborted;
  }

  function assertCurrent(operation) {
    if (!isCurrent(operation)) throw abortError(operation.controller.signal.reason);
  }

  function makeRecord(role, sector, lod, resource) {
    return { role, sector, lod, resource, disposed: false };
  }

  function disposeRecord(record) {
    if (!record || record.disposed) return;
    record.disposed = true;
    if (record.role === 'visual') disposeVisual(record.resource, {
      sector: record.sector,
      lod: record.lod,
    });
    else disposeCollision(record.resource, { sector: record.sector });
  }

  async function settleLoads(operation, requests, loader, role) {
    const outcomes = await Promise.allSettled(requests.map(async (request) => {
      const resource = await loader({ ...request, signal: operation.controller.signal });
      return makeRecord(role, request.sector, request.lod ?? null, resource);
    }));
    const completed = outcomes.filter((outcome) => outcome.status === 'fulfilled').map((outcome) => outcome.value);
    const failure = outcomes.find((outcome) => outcome.status === 'rejected');
    if (!isCurrent(operation) || failure) {
      for (const record of completed) disposeRecord(record);
      if (!isCurrent(operation)) throw abortError(operation.controller.signal.reason);
      throw failure.reason;
    }
    return completed;
  }

  function removeVisualNotIn(desired) {
    for (const [id, record] of [...visual]) {
      if (desired.has(id)) continue;
      visual.delete(id);
      disposeRecord(record);
    }
  }

  async function transitionCollision(operation, desired, currentId) {
    const common = [...collision.keys()].filter((id) => desired.has(id));
    const obsolete = [...collision.keys()].filter((id) => !desired.has(id));
    if (common.length > 0 || collision.size === 0) {
      for (const id of obsolete) {
        const record = collision.get(id);
        collision.delete(id);
        disposeRecord(record);
      }
    } else {
      const anchor = obsolete.shift();
      for (const id of obsolete) {
        const record = collision.get(id);
        collision.delete(id);
        disposeRecord(record);
      }
      const current = sectorById.get(currentId);
      const loaded = await settleLoads(operation, [{ sector: current, asset: current.collision }], loadCollision, 'collision');
      assertCurrent(operation);
      collision.set(currentId, loaded[0]);
      const anchorRecord = collision.get(anchor);
      collision.delete(anchor);
      disposeRecord(anchorRecord);
    }

    const requests = [...desired]
      .filter((id) => !collision.has(id))
      .map((id) => {
        const sector = sectorById.get(id);
        return { sector, asset: sector.collision };
      });
    if (requests.length > 0) {
      const loaded = await settleLoads(operation, requests, loadCollision, 'collision');
      assertCurrent(operation);
      for (const record of loaded) collision.set(record.sector.id, record);
    }
    peakCollisionSectors = Math.max(peakCollisionSectors, collision.size);
  }

  async function transitionVisual(operation, desired) {
    removeVisualNotIn(desired);
    const requests = [];
    for (const [id, lod] of desired) {
      const existing = visual.get(id);
      if (existing && (existing.lod === lod || (stableGeometry && existing.lod < lod))) continue;
      const sector = sectorById.get(id);
      requests.push({ sector, lod, asset: sector.visual[`lod${lod}`] });
    }
    const loaded = requests.length > 0
      ? await settleLoads(operation, requests, loadVisual, 'visual')
      : [];
    assertCurrent(operation);
    for (const record of loaded) {
      const previous = visual.get(record.sector.id);
      visual.set(record.sector.id, record);
      disposeRecord(previous);
    }
    peakVisualSectors = Math.max(peakVisualSectors, visual.size);
  }

  async function performUpdate(operation, sM, nextQuality) {
    assertCurrent(operation);
    const index = sectorIndexAt(sM);
    const geometryQuality = stableGeometry && nextQuality === 'low' ? 'balanced' : nextQuality;
    const desired = desiredFor(index, geometryQuality, sectors);
    const nextCurrent = sectors[index].id;
    await transitionCollision(operation, desired.collision, nextCurrent);
    assertCurrent(operation);
    await transitionVisual(operation, desired.visual);
    assertCurrent(operation);
    currentSector = nextCurrent;
    quality = operation.targetQuality;
    for (const record of visual.values()) updateVisualQuality?.(record.resource, {
      sector: record.sector, lod: record.lod, quality, currentSector: nextCurrent,
    });
    lastFailure = null;
    updates += 1;
    return diagnostics();
  }

  function update(sM, nextQuality = 'high') {
    if (disposed) return Promise.reject(new Error('sector streamer is disposed'));
    if (!QUALITIES.has(nextQuality)) return Promise.reject(new RangeError(`unknown quality tier: ${nextQuality}`));
    if (options.signal?.aborted) return Promise.reject(abortError(options.signal.reason));
    let index;
    try { index = sectorIndexAt(Number(sM)); } catch (error) { return Promise.reject(error); }
    const geometryQuality = stableGeometry && nextQuality === 'low' ? 'balanced' : nextQuality;
    const key = `${index}:${geometryQuality}`;
    if (active?.key === key) { active.targetQuality = nextQuality; return active.promise; }
    if (active) active.controller.abort(abortError());
    if (lastFailure?.key === key && now() < lastFailure.retryAtMs) return lastFailure.promise;
    const operation = { token: ++generation, key, targetQuality: nextQuality, controller: new AbortController(), promise: null };
    const forwardAbort = () => operation.controller.abort(abortError(options.signal?.reason));
    if (options.signal) options.signal.addEventListener('abort', forwardAbort, { once: true });
    active = operation;
    operation.promise = performUpdate(operation, Number(sM), nextQuality)
      .catch(error => {
        if (retryDelayMs && isCurrent(operation) && error?.name !== 'AbortError') {
          const attempts = lastFailure?.key === key ? lastFailure.attempts + 1 : 1;
          const delay = Math.min(retryMaxDelayMs, retryDelayMs * 2 ** Math.min(20, attempts - 1));
          lastFailure = { key, attempts, retryAtMs: now() + delay, error, promise: operation.promise };
        }
        throw error;
      })
      .finally(() => {
        if (options.signal) options.signal.removeEventListener('abort', forwardAbort);
        if (active === operation) active = null;
      });
    return operation.promise;
  }

  function diagnostics() {
    const loaded = {};
    for (const sector of sectors) {
      const record = visual.get(sector.id);
      if (record) loaded[sector.id] = `lod${record.lod}`;
    }
    const collisionIds = sectors.filter((sector) => collision.has(sector.id)).map((sector) => sector.id);
    return Object.freeze({
      loaded: Object.freeze(loaded),
      collision: Object.freeze(collisionIds),
      currentSector,
      quality,
      stableQualityGeometry: stableGeometry,
      retry: lastFailure ? Object.freeze({ attempts: lastFailure.attempts, retryAtMs: lastFailure.retryAtMs,
        remainingMs: Math.max(0, lastFailure.retryAtMs - now()), message: String(lastFailure.error?.message || lastFailure.error) }) : null,
      pending: active !== null,
      updates,
      generation,
      ownedResources: visual.size + collision.size,
      peakVisualSectors,
      peakCollisionSectors,
      disposed,
    });
  }

  async function flush() {
    const operation = active;
    if (operation) await operation.promise;
    return diagnostics();
  }

  function dispose() {
    if (disposal) return disposal;
    disposed = true;
    const operation = active;
    if (operation) operation.controller.abort(abortError());
    disposal = (async () => {
      if (operation) {
        try { await operation.promise; } catch (error) {
          if (error?.name !== 'AbortError' && !/abort/i.test(String(error?.message))) throw error;
        }
      }
      for (const record of visual.values()) disposeRecord(record);
      for (const record of collision.values()) disposeRecord(record);
      visual.clear();
      collision.clear();
      currentSector = null;
      quality = null;
      lastFailure = null;
    })();
    return disposal;
  }

  const api = {};
  Object.defineProperties(api, {
    update: { enumerable: true, value: update },
    flush: { enumerable: true, value: flush },
    dispose: { enumerable: true, value: dispose },
    diagnostics: { enumerable: true, get: diagnostics },
  });
  return Object.freeze(api);
}
