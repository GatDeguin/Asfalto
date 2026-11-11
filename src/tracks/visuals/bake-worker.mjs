import {BAKE_SCHEMA, MAX_BAKE_BYTES, decodeBinaryBake, bakeTransferList} from './bake-binary-codec.mjs?v=9a206fac5b81dd7a';

const MAX_COMPRESSED = 100 * 1024 * 1024;

async function boundedBytes(response, limit, expected, checkpoint) {
  if (!response.ok) throw new Error('bake fetch ' + response.status);
  const reader = response.body.getReader();
  const output = expected === undefined ? null : new Uint8Array(expected);
  const chunks = [];
  let offset = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      checkpoint();
      if (done) break;
      if (value.byteLength > (expected ?? limit) - offset) throw new Error('bake byte limit');
      if (output) output.set(value, offset);
      else chunks.push(value);
      offset += value.byteLength;
    }
    if (output) {
      if (offset !== expected) throw new Error('bake byte count');
      return output;
    }
    const joined = new Uint8Array(offset);
    offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return joined;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function loadBake(id, inflate, checkpoint) {
  const started = performance.now();
  const base = new URL('../../../assets/tracks/offline-bake/', import.meta.url);
  const response = await fetch(new URL('manifest.json', base), {cache: 'no-cache'});
  const manifest = JSON.parse(new TextDecoder().decode(await boundedBytes(response, 256 * 1024, undefined, checkpoint)));
  const entry = manifest.tracks?.[id];
  if (manifest.schema !== BAKE_SCHEMA || !entry || entry.file !== id + '.bake.gz'
      || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > MAX_COMPRESSED
      || !Number.isSafeInteger(entry.decodedBytes) || entry.decodedBytes <= 0 || entry.decodedBytes > MAX_BAKE_BYTES
      || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('incompatible bake manifest');
  const url = new URL(entry.file, base);
  url.searchParams.set('v', entry.sha256);
  const bytes = await boundedBytes(await fetch(url), MAX_COMPRESSED, entry.bytes, checkpoint);
  const fetched = performance.now();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== entry.sha256) throw new Error('bake integrity');
  const verified = performance.now();
  checkpoint();
  const decoded = await inflate(bytes, entry.decodedBytes);
  const unpacking = performance.now();
  const payload = decodeBinaryBake(decoded.buffer);
  if (payload.id !== id || payload.entries.length !== entry.entries) throw new Error('bake payload identity');
  const transfers = bakeTransferList(payload);
  const stats = {...decoded.stats, fetchMs: fetched - started, integrityMs: verified - fetched,
    decodeMs: performance.now() - unpacking, workerMs: performance.now() - started, transferBuffers: transfers.length};
  return {result: {payload, stats}, transfers};
}
