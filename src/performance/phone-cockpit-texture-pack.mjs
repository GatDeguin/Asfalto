import { phoneCockpitTextureManifest } from './phone-cockpit-texture-manifest.mjs';

const PHONE_QUALITIES = new Set(['auto', 'balanced', 'eco']);
const HEX = /^[0-9a-f]{64}$/;
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');

// An optional image-only overlay. The master GLB, names, accessors and UVs never change.
// No createImageBitmap call belongs here: select() must finish before the first decode.
export function createPhoneCockpitTextureSelector({
  getProfile = () => null,
  getQuality = () => 'auto',
  fetcher = (...args) => globalThis.fetch(...args),
  cryptoProvider = globalThis.crypto,
  manifest = phoneCockpitTextureManifest,
  baseUrl = new URL('../../assets/cockpit/phone-textures/', import.meta.url),
  timeoutMs = 8000,
} = {}) {
  const entries = new Map(manifest.entries.map(entry => [entry.sourceSha256, entry]));
  const sizes = new Set(manifest.entries.map(entry => entry.sourceBytes));
  const cache = new Map();
  const controllers = new Set();
  let hashes = new WeakMap();
  let disposed = false;
  let networkUnavailable = false;
  const counters = { selected: 0, cacheHits: 0, fetches: 0, hashedSourceBytes: 0, fetchedEncodedBytes: 0, fallback: {} };
  const fallback = (blob, reason) => {
    counters.fallback[reason] = (counters.fallback[reason] || 0) + 1;
    return blob;
  };
  const digest = async bytes => hex(await cryptoProvider.subtle.digest('SHA-256', bytes));
  async function load(entry) {
    if (disposed) return null;
    if (cache.has(entry.sha256)) {
      counters.cacheHits++;
      return cache.get(entry.sha256);
    }
    const pending = (async () => {
      const controller = new AbortController();
      controllers.add(controller);
      let timer;
      try {
        if (!HEX.test(entry.sha256) || entry.filename !== entry.sha256 + '.webp' || entry.mime !== 'image/webp') return null;
        const operation = (async () => {
          counters.fetches++;
          const response = await fetcher(new URL(entry.filename, baseUrl), { signal: controller.signal, cache: 'force-cache', credentials: 'same-origin' });
          if (!response.ok) throw new Error('pack response');
          const bytes = await response.arrayBuffer();
          counters.fetchedEncodedBytes += bytes.byteLength;
          if (bytes.byteLength !== entry.bytes || await digest(bytes) !== entry.sha256) return null;
          return new Blob([bytes], { type: entry.mime });
        })();
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('pack timeout')); }, timeoutMs);
        });
        return await Promise.race([operation, timeout]);
      } catch {
        // One failed transport disables new requests for this selector lifetime.
        // Concurrent requests are bounded by the same timeout; subsequent models
        // use the existing original-image decode/resize path immediately.
        networkUnavailable = true;
        return null;
      } finally {
        clearTimeout(timer);
        controllers.delete(controller);
      }
    })();
    cache.set(entry.sha256, pending);
    return pending;
  }
  async function select(original) {
    try {
      if (disposed) return fallback(original, 'disposed');
      if (!getProfile()?.phone || !PHONE_QUALITIES.has(getQuality())) return fallback(original, 'profile');
      if (!cryptoProvider?.subtle?.digest) return fallback(original, 'crypto');
      if (!sizes.has(original.size)) return fallback(original, 'size');
      let sourceHash = hashes.get(original);
      if (!sourceHash) {
        counters.hashedSourceBytes += original.size;
        sourceHash = original.arrayBuffer().then(digest);
        hashes.set(original, sourceHash);
      }
      const resolvedSourceHash = await sourceHash;
      if (disposed) return fallback(original, 'disposed');
      if (!getProfile()?.phone || !PHONE_QUALITIES.has(getQuality())) return fallback(original, 'profile');
      const entry = entries.get(resolvedSourceHash);
      if (!entry || entry.sourceBytes !== original.size) return fallback(original, 'unmatched');
      if (networkUnavailable && !cache.has(entry.sha256)) return fallback(original, 'network-disabled');
      const replacement = await load(entry);
      if (disposed) return fallback(original, 'disposed');
      if (!getProfile()?.phone || !PHONE_QUALITIES.has(getQuality())) return fallback(original, 'profile');
      if (!replacement) return fallback(original, 'pack');
      counters.selected++;
      return replacement;
    } catch {
      return fallback(original, 'exception');
    }
  }
  return {
    select,
    diagnostics: () => ({ ...counters, fallback: { ...counters.fallback }, cachedOutputs: cache.size, networkUnavailable, disposed, limit: manifest.limit }),
    dispose() {
      disposed = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      cache.clear();
      hashes = new WeakMap();
    },
  };
}
