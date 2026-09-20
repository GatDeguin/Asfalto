const ALLOWED_IDS = Object.freeze(['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night']);
const ALLOWED_ID_SET = new Set(ALLOWED_IDS);
const MAGIC = 'AV3HDRI1';
const WIDTH = 1024;
const HEIGHT = 512;
const HEADER_BYTES = 16;
const PAYLOAD_BYTES = WIDTH * HEIGHT * 3 * 2;
const FILE_BYTES = HEADER_BYTES + PAYLOAD_BYTES;
let catalogCaches = new WeakMap();
let payloadCaches = new WeakMap();

function baseUrl() {
  return globalThis.location?.href || 'http://127.0.0.1/';
}

function assertSafeUrl(raw, label, base = baseUrl()) {
  if (typeof raw !== 'string' || raw.length === 0 || /[\\\0]/.test(raw)
      || /%(?:00|2f|5c)/i.test(raw)) throw new TypeError(`${label} path is unsafe`);
  let url;
  try { url = new URL(raw, base); } catch (error) { throw new TypeError(`${label} path is unsafe`, { cause: error }); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new TypeError(`${label} path is unsafe`);
  }
  const decoded = decodeURIComponent(url.pathname);
  if (decoded.split('/').some(part => part === '.' || part === '..')) throw new TypeError(`${label} path traversal`);
  return url;
}

function getCache(store, fetchImpl) {
  let cache = store.get(fetchImpl);
  if (!cache) { cache = new Map(); store.set(fetchImpl, cache); }
  return cache;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || !ALLOWED_ID_SET.has(entry.id)
      || typeof entry.label !== 'string' || entry.label.length === 0
      || entry.width !== WIDTH || entry.height !== HEIGHT || entry.byteLength !== FILE_BYTES
      || !/^[A-F0-9]{64}$/.test(entry.sha256)) throw new TypeError(`invalid HDRI catalog entry: ${entry?.id}`);
  if (!/^[a-z0-9-]+\.av3hdri$/.test(entry.file)) throw new TypeError('HDRI asset path is unsafe');
  return Object.freeze({ ...entry });
}

function validateCatalog(value) {
  if (!value || value.schema !== 'asfalto-hdri-catalog/v1' || !Array.isArray(value.presets)) {
    throw new TypeError('invalid HDRI catalog');
  }
  const presets = value.presets.map(validateEntry);
  if (new Set(presets.map(entry => entry.id)).size !== presets.length) throw new TypeError('duplicate HDRI preset');
  return Object.freeze({ schema: value.schema, presets: Object.freeze(presets) });
}

async function fetchCatalog(catalogUrl, fetchImpl) {
  const cache = getCache(catalogCaches, fetchImpl);
  if (cache.has(catalogUrl.href)) return cache.get(catalogUrl.href);
  const pending = (async () => {
    const response = await fetchImpl(catalogUrl.href, { credentials: 'same-origin' });
    if (!response?.ok) throw new Error(`HDRI catalog request failed: ${response?.status ?? 'unknown'}`);
    return validateCatalog(await response.json());
  })();
  cache.set(catalogUrl.href, pending);
  pending.catch(() => cache.delete(catalogUrl.href));
  return pending;
}

async function digestHex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function validatePayload(bytes, entry) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== entry.byteLength || bytes.byteLength !== FILE_BYTES) {
    throw new Error(`HDRI byte length mismatch: ${entry.id}`);
  }
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (bytes[index] !== MAGIC.charCodeAt(index)) throw new Error(`invalid AV3HDRI magic: ${entry.id}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== entry.width || view.getUint32(12, true) !== entry.height) {
    throw new Error(`invalid AV3HDRI dimensions: ${entry.id}`);
  }
  if (bytes.byteLength !== HEADER_BYTES + entry.width * entry.height * 3 * 2) {
    throw new Error(`invalid AV3HDRI payload length: ${entry.id}`);
  }
}

function publicPayload(cached) {
  return Object.freeze({
    id: cached.id,
    width: cached.width,
    height: cached.height,
    encoding: 'rgb9e5',
    pixels: cached.pixels.slice(),
    sourceSha256: cached.sourceSha256,
  });
}

export async function loadHdriPreset(id, { fetchImpl = globalThis.fetch, catalogUrl = '/assets/skies/catalog.json' } = {}) {
  if (!ALLOWED_ID_SET.has(id)) throw new RangeError(`unknown HDRI preset: ${id}`);
  if (typeof fetchImpl !== 'function') throw new TypeError('HDRI fetch implementation is required');
  const absoluteCatalogUrl = assertSafeUrl(catalogUrl, 'HDRI catalog');
  const cache = getCache(payloadCaches, fetchImpl);
  const key = `${absoluteCatalogUrl.href}|${id}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      const catalog = await fetchCatalog(absoluteCatalogUrl, fetchImpl);
      const entry = catalog.presets.find(candidate => candidate.id === id);
      if (!entry) throw new RangeError(`unknown HDRI preset: ${id}`);
      const assetUrl = assertSafeUrl(entry.file, 'HDRI asset', absoluteCatalogUrl.href);
      const catalogDirectory = new URL('./', absoluteCatalogUrl.href);
      if (assetUrl.origin !== catalogDirectory.origin || !assetUrl.pathname.startsWith(catalogDirectory.pathname)
          || assetUrl.pathname.slice(catalogDirectory.pathname.length).includes('/')) {
        throw new TypeError('HDRI asset path is unsafe');
      }
      const response = await fetchImpl(assetUrl.href, { credentials: 'same-origin' });
      if (!response?.ok) throw new Error(`HDRI asset request failed: ${response?.status ?? 'unknown'}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      validatePayload(bytes, entry);
      const actualSha256 = await digestHex(bytes);
      if (actualSha256 !== entry.sha256) throw new Error(`HDRI SHA-256 digest mismatch: ${id}`);
      return Object.freeze({
        id,
        width: entry.width,
        height: entry.height,
        pixels: bytes.slice(HEADER_BYTES),
        sourceSha256: actualSha256,
      });
    })();
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return publicPayload(await pending);
}

export function clearHdriPresetCache() {
  catalogCaches = new WeakMap();
  payloadCaches = new WeakMap();
}

export { ALLOWED_IDS as HDRI_PRESET_IDS };
