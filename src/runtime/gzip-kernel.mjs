const PAGE_BYTES = 65_536;
const STATIC_PAGES = 4;
export const GZIP_PAYLOAD_OFFSET = STATIC_PAGES * PAGE_BYTES;
export const MAX_GZIP_INPUT = 16 * 1024 * 1024;
export const MAX_GZIP_OUTPUT = 40 * 1024 * 1024;

export function readGzipSize(bytes) {
  if (bytes.byteLength < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) {
    throw new Error('Encabezado gzip inválido.');
  }
  return new DataView(bytes.buffer, bytes.byteOffset + bytes.byteLength - 4, 4).getUint32(0, true);
}

export function createGzipMemory(inputSize, size, shared = false) {
  if (!Number.isSafeInteger(inputSize) || inputSize < 18 || inputSize > MAX_GZIP_INPUT
      || !Number.isSafeInteger(size) || size < 0 || size > MAX_GZIP_OUTPUT) {
    throw new RangeError('WASM gzip size limit.');
  }
  const pages = STATIC_PAGES + Math.ceil((inputSize + 15 + size) / PAGE_BYTES);
  return new WebAssembly.Memory({initial: pages, maximum: pages, shared});
}

export function inflateWasmGzip(module, input, size, {memory, checkpoint = () => {}} = {}) {
  memory ??= createGzipMemory(input.byteLength, size);
  const {arena_base, decode_gzip} = new WebAssembly.Instance(module, {env: {memory}}).exports;
  const start = arena_base();
  if (start !== GZIP_PAYLOAD_OFFSET) throw new Error('WASM gzip ABI incompatible.');
  const end = (start + input.byteLength + 15) & ~15;
  if (input.byteOffset !== start || input.buffer !== memory.buffer) {
    new Uint8Array(memory.buffer, start, input.byteLength).set(input);
  }
  checkpoint();
  if (decode_gzip(input.byteLength, size) !== 0) throw new Error('Contenido gzip inválido o incompleto.');
  checkpoint();
  // The public buffer owns its contents, even if the input came from shared memory.
  return {buffer: new Uint8Array(memory.buffer, end, size).slice().buffer, arenaBytes: memory.buffer.byteLength};
}

export async function inflateBrowserGzip(input, size, signal, checkpoint = () => {}) {
  signal?.throwIfAborted();
  let readOffset = 0;
  const reader = new ReadableStream({
    pull(controller) {
      signal?.throwIfAborted();
      checkpoint();
      const next = Math.min(readOffset + 16 * 1024, input.byteLength);
      if (next > readOffset) controller.enqueue(input.subarray(readOffset, next));
      readOffset = next;
      if (next === input.byteLength) controller.close();
    },
  }).pipeThrough(new DecompressionStream('gzip')).getReader();
  const output = new Uint8Array(size);
  let offset = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      signal?.throwIfAborted();
      checkpoint();
      if (done) break;
      if (value.byteLength > size - offset) throw new Error('El gzip supera el tamaño declarado.');
      output.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== size) throw new Error('El gzip no coincide con el tamaño declarado.');
    return output.buffer;
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
