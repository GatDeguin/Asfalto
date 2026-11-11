import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {test} from 'node:test';
import {gunzipSync, gzipSync} from 'node:zlib';
import {createGzipMemory, GZIP_PAYLOAD_OFFSET, inflateWasmGzip, readGzipSize, MAX_GZIP_OUTPUT} from '../src/runtime/gzip-kernel.mjs?v=7cef6073fc46cbf3';

const wasm = new URL('../assets/engine/gzip-kernel.wasm', import.meta.url);
let modulePromise;
const loadModule = () => modulePromise ??= readFile(wasm).then(bytes => WebAssembly.compile(bytes));
const assetRoot = new URL('../assets/', import.meta.url);

test('C++ WASM reproduces all shipped gzip assets byte for byte in a bounded arena', async () => {
  const module = await loadModule();
  assert.deepEqual(WebAssembly.Module.imports(module), [{module: 'env', name: 'memory', kind: 'memory'}]);
  const assets = (await readdir(assetRoot, {recursive: true})).filter(file => file.endsWith('.gz'));
  assert.equal(assets.length >= 17, true);
  for (const file of assets) {
    const compressed = await readFile(new URL(file.replaceAll('\\', '/'), assetRoot));
    const expected = gunzipSync(compressed);
    const {buffer, arenaBytes} = inflateWasmGzip(module, compressed, expected.byteLength);
    assert.equal(Buffer.from(buffer).equals(expected), true, file);
    assert.equal(arenaBytes % 65_536, 0);
    assert.ok(arenaBytes - compressed.byteLength - expected.byteLength < 5 * 65_536, file);
  }
});

test('native decoder rejects corrupt CRC, incorrect lengths and bytes outside a single gzip member', async () => {
  const module = await loadModule();
  const input = gzipSync(Buffer.from('asfalto'.repeat(4096)));
  const size = readGzipSize(input);
  const corrupted = Buffer.from(input);
  corrupted[corrupted.length - 8] ^= 1;
  assert.throws(() => inflateWasmGzip(module, corrupted, size), /gzip/i);
  assert.throws(() => inflateWasmGzip(module, input, size - 1), /gzip/i);
  assert.throws(() => inflateWasmGzip(module, input, size + 1), /gzip/i);
  assert.throws(() => inflateWasmGzip(module, input.subarray(0, -3), size), /gzip/i);
  assert.throws(() => inflateWasmGzip(module, Buffer.concat([input, input]), size * 2), /gzip/i);
  assert.throws(() => inflateWasmGzip(module, input, MAX_GZIP_OUTPUT + 1), /limit/i);
  assert.throws(() => readGzipSize(input.subarray(0, 12)), /gzip/i);
});

test('a shared arena preserves its input and returns independent, transferable output', async () => {
  const module = await WebAssembly.compile(await readFile(new URL('../assets/engine/gzip-kernel-shared.wasm', import.meta.url)));
  const payload = Buffer.from('dos lagos'.repeat(10000));
  const compressed = gzipSync(payload);
  const memory = createGzipMemory(compressed.byteLength, payload.byteLength, true);
  const input = new Uint8Array(memory.buffer, GZIP_PAYLOAD_OFFSET, compressed.byteLength);
  input.set(compressed);
  const {buffer} = inflateWasmGzip(module, input, payload.byteLength, {memory});
  assert.deepEqual(Buffer.from(input), compressed);
  assert.equal(memory.buffer instanceof SharedArrayBuffer, true);
  assert.equal(buffer instanceof ArrayBuffer, true);
  input.fill(0);
  assert.deepEqual(Buffer.from(buffer), payload);
});
