// CPU bytes only: each caller owns its copy, so GLB parsing/transfer/disposal cannot
// invalidate another renderer. GPU objects remain owned by their rendering context.
export function createAssetByteCache({fetchImpl = globalThis.fetch, maxBytes = 48 * 1024 * 1024, maxEntryBytes = 20 * 1024 * 1024} = {}) {
  const resident = new Map(), pending = new Map();
  let residentBytes = 0, generation = 0, hits = 0, transfers = 0;
  const abortReason = signal => signal?.reason ?? new DOMException('Asset request cancelled', 'AbortError');
  function retain(key, bytes) {
    if (bytes.byteLength > maxEntryBytes || bytes.byteLength > maxBytes || !/[?&]v=[a-f0-9]{16,64}(?:&|$)/i.test(key)) return;
    if (resident.has(key)) { residentBytes -= resident.get(key).byteLength; resident.delete(key); }
    while (residentBytes + bytes.byteLength > maxBytes && resident.size) {
      const oldest = resident.keys().next().value;
      residentBytes -= resident.get(oldest).byteLength; resident.delete(oldest);
    }
    resident.set(key, bytes); residentBytes += bytes.byteLength;
  }
  function read(url, {signal} = {}) {
    const key = String(url);
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    const cached = resident.get(key);
    if (cached) { hits++; resident.delete(key); resident.set(key, cached); return Promise.resolve(cached.slice()); }
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController(), epoch = generation;
      entry = {controller, consumers: new Set(), done: false, promise: null};
      const current = entry;
      pending.set(key, entry); transfers++;
      entry.promise = Promise.resolve().then(async () => {
        if (controller.signal.aborted) throw abortReason(controller.signal);
        const response = await fetchImpl(key, {signal: controller.signal, credentials: 'same-origin', cache: 'default'});
        if (!response.ok) throw new Error('Asset HTTP ' + response.status + ': ' + key);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!controller.signal.aborted && generation === epoch) retain(key, bytes);
        return bytes;
      }).finally(() => {
        current.done = true;
        if (pending.get(key) === current) pending.delete(key);
      });
    } else hits++;
    const current = entry;
    return new Promise((resolve, reject) => {
      const consumer = {};
      current.consumers.add(consumer);
      let settled = false;
      function finish(ok, value) {
        if (settled) return;
        settled = true; signal?.removeEventListener('abort', onAbort); current.consumers.delete(consumer);
        if (ok) resolve(value.slice()); else reject(value);
      }
      function onAbort() {
        finish(false, abortReason(signal));
        if (!current.done && current.consumers.size === 0) {
          if (pending.get(key) === current) pending.delete(key);
          current.controller.abort(abortReason(signal));
        }
      }
      signal?.addEventListener('abort', onAbort, {once: true});
      current.promise.then(bytes => finish(true, bytes), error => finish(false, error));
    });
  }
  return Object.freeze({
    read,
    clear() { generation++; resident.clear(); residentBytes = 0; pending.clear(); },
    diagnostics: () => ({residentBytes, entries: resident.size, pending: pending.size, maxBytes, maxEntryBytes, hits, transfers}),
  });
}
export const assetByteCache = createAssetByteCache();
