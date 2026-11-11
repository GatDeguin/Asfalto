import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, rmdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [zig, libdeflateRoot] = process.argv.slice(2);
if (!zig || !libdeflateRoot) {
  throw new Error('Uso: node tools/build-gzip-kernel.mjs <zig 0.14.1> <libdeflate 1.25>');
}
const lib = path.resolve(libdeflateRoot);
const header = await readFile(path.join(lib, 'libdeflate.h'), 'utf8');
if (!/^#define LIBDEFLATE_VERSION_STRING\s+"1\.25"/m.test(header)) {
  throw new Error('La compilación del núcleo usa libdeflate 1.25.');
}
const build = await mkdtemp(path.join(tmpdir(), 'asfalto-gzip-'));
const sources = ['deflate_decompress.c', 'gzip_decompress.c', 'crc32.c', 'utils.c'];
const objects = [...sources.map(source => path.join(build, source + '.o')), path.join(build, 'kernel.o')];
const outputs = ['gzip-kernel.wasm', 'gzip-kernel-shared.wasm'].map(file => path.join(build, file));
const wrapper = fileURLToPath(new URL('native/gzip-kernel.cpp', import.meta.url));
const flags = ['-target', 'wasm32-freestanding', '-O3', '-mbulk-memory', '-ffreestanding',
  '-DFREESTANDING', '-fvisibility=hidden', '-I', lib];

function run(args) {
  const child = spawnSync(zig, args, {stdio: 'inherit'});
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error('Zig terminó con código ' + child.status);
}

try {
  const directory = new URL('../assets/engine/', import.meta.url);
  await mkdir(directory, {recursive: true});
  for (const [index, output] of outputs.entries()) {
    const shared = index === 1;
    const atomics = shared ? ['-matomics'] : [];
    for (const [sourceIndex, source] of sources.entries()) {
      run(['cc', ...flags, ...atomics, '-c', path.join(lib, 'lib', source), '-o', objects[sourceIndex]]);
    }
    run(['c++', ...flags, ...atomics, '-std=c++17', '-fno-exceptions', '-fno-rtti', '-c', wrapper, '-o', objects.at(-1)]);
    run(['cc', '-target', 'wasm32-freestanding', '-nostdlib', '-mbulk-memory', ...atomics,
      '-Wl,--no-entry', '-Wl,--import-memory', '-Wl,--initial-memory=262144', '-Wl,--max-memory=59047936',
      '-Wl,-z,stack-size=32768', '-Wl,--export=arena_base', '-Wl,--export=decode_gzip', '-Wl,--strip-all',
      ...(shared ? ['-Wl,--shared-memory'] : []), ...objects, '-o', output]);
    const bytes = await readFile(output);
    const module = await WebAssembly.compile(bytes);
    const memory = new WebAssembly.Memory({initial: 4, maximum: 4, shared});
    const instance = new WebAssembly.Instance(module, {env: {memory}});
    if (instance.exports.arena_base() !== memory.buffer.byteLength) throw new Error('WASM ABI arena fuera del límite');
    await writeFile(new URL(path.basename(output), directory), bytes);
    console.log(`${path.basename(output)} · ${bytes.length} bytes · SHA-256 ${createHash('sha256').update(bytes).digest('hex')}`);
  }
  await writeFile(new URL('libdeflate-LICENSE.txt', directory), await readFile(path.join(lib, 'COPYING')));
} finally {
  for (const file of [...objects, ...outputs]) await rm(file, {force: true});
  await rmdir(build);
}
