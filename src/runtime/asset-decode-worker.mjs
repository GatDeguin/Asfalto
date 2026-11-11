import {GZIP_PAYLOAD_OFFSET, inflateBrowserGzip, inflateWasmGzip, MAX_GZIP_INPUT, MAX_GZIP_OUTPUT, readGzipSize}
  from './gzip-kernel.mjs?v=7cef6073fc46cbf3';
import {loadBake} from '../tracks/visuals/bake-worker.mjs?v=7433367e722b6f11';

const kernelUrls = {
  private: new URL('../../assets/engine/gzip-kernel.wasm?v=ec52e7ae9dd4fca7', import.meta.url),
  shared: new URL('../../assets/engine/gzip-kernel-shared.wasm?v=4145a643eb12a8f8', import.meta.url),
};
const kernels = new Map();

function loadKernel(shared) {
  const key = shared ? 'shared' : 'private';
  if (!kernels.has(key)) {
    const loading = (async () => {
      const response = await fetch(kernelUrls[key]);
      if (!response.ok) return null;
      return WebAssembly.compile(await response.arrayBuffer());
    })().catch(() => null);
    kernels.set(key, loading);
  }
  return kernels.get(key);
}

async function inflate(input, size, checkpoint, memory) {
  const module = input.byteLength <= MAX_GZIP_INPUT && size <= MAX_GZIP_OUTPUT
    ? await loadKernel(!!memory) : null;
  checkpoint();
  const start = performance.now();
  const result = module
    ? inflateWasmGzip(module, input, size, {memory, checkpoint})
    : {buffer: await inflateBrowserGzip(memory ? input.slice() : input, size, undefined, checkpoint), arenaBytes: 0};
  return {...result, stats: {
    backend: module ? 'wasm' : 'browser', sharedArena: !!memory && !!module,
    arenaBytes: result.arenaBytes, compressedBytes: input.byteLength, decodedBytes: size,
    inflateStart: performance.timeOrigin + start, inflateEnd: performance.timeOrigin + performance.now(),
    decompressMs: performance.now() - start,
  }};
}

globalThis.onmessage = async ({data: {requestId, kind, data, control}}) => {
  const checkpoint = () => {
    if (control && Atomics.load(control, 0)) throw new DOMException('Carga cancelada.', 'AbortError');
  };
  try {
    checkpoint();
    let result, transfers;
    if (kind === 'bake') {
      // Read/verify the cache file and compile its decoder concurrently.
      void loadKernel(false);
      ({result, transfers} = await loadBake(data.id, (input, size) => inflate(input, size, checkpoint), checkpoint));
    } else if (kind === 'gzip') {
      const {buffer, memory, length, size} = data;
      const input = memory ? new Uint8Array(memory.buffer, GZIP_PAYLOAD_OFFSET, length) : new Uint8Array(buffer);
      const decoded = await inflate(input, size, checkpoint, memory);
      result = {buffer: decoded.buffer, stats: decoded.stats};
      transfers = [decoded.buffer];
    } else if (kind === 'glb') {
      const {decodeGlbDocument} = await import('./glb-decode-worker.mjs?v=4e5a55f83b79f7c1');
      checkpoint();
      const start = performance.now();
      const decoded = await decodeGlbDocument(data.buffer, data.label);
      result = {...decoded, stats: {backend: 'meshopt', label: data.label, compressedBytes: data.buffer.byteLength,
        decodedBytes: decoded.bin.byteLength, decodeMs: performance.now() - start}};
      transfers = [decoded.bin.buffer];
    } else if (kind === 'terrain') {
      const {loadTerrainEngine, refineTerrainDocument} = await import('../tracks/visuals/terrain-refinement-worker.mjs?v=152fd2975f4032de');
      const {terrainTransferList} = await import('../tracks/visuals/terrain-geometry-transport.mjs?v=1bd13edef21b4c5a');
      const THREE = await loadTerrainEngine(async bytes => (await inflate(bytes, readGzipSize(bytes), checkpoint)).buffer);
      checkpoint();
      const start = performance.now();
      const output = refineTerrainDocument(THREE, data);
      result = {output, stats: {backend: 'terrain', label: data.name, refineMs: performance.now() - start}};
      transfers = output ? terrainTransferList(output.geometry) : [];
    } else {
      throw new Error('Trabajo de recursos desconocido.');
    }
    checkpoint();
    result.sentAt = performance.timeOrigin + performance.now();
    globalThis.postMessage({requestId, ok: true, result}, transfers);
  } catch (error) {
    globalThis.postMessage({requestId, ok: false, error: error?.message || String(error)});
  }
};
