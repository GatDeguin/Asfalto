import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createCockpitLayoutEndpoint } from './src/server/cockpit-layout-store.mjs?v=26e5547de5f86a16';
import {createLightingPresetEndpoint} from './src/server/lighting-preset-store.mjs?v=943a14ce242cf817';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'], ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.glb', 'model/gltf-binary'], ['.gltf', 'model/gltf+json'], ['.wasm', 'application/wasm'],
  ['.ogg', 'audio/ogg'], ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'],
  ['.mp4', 'video/mp4'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'], ['.hdr', 'application/octet-stream'],
  ['.av3hdri', 'application/octet-stream'],
]);

function decodePath(rawUrl) {
  const queryAt = rawUrl.search(/[?#]/);
  let decoded = queryAt === -1 ? rawUrl : rawUrl.slice(0, queryAt);
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  for (let pass = 0; pass < 5; pass += 1) {
    let next;
    try { next = decodeURIComponent(decoded); } catch { return null; }
    if (next === decoded) break;
    decoded = next;
    if (pass === 4) return null;
  }
  if (decoded.startsWith('//') || decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter(Boolean);
  if (segments.length === 0) segments.push('index.html');
  if (segments.some(segment => segment === '.' || segment === '..' || /^[A-Za-z]:/.test(segment))) return null;
  return segments;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function sendText(response, status, message, headers = {}) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(message), ...headers });
  response.end(message);
}

export async function startServer({ root, host = '127.0.0.1', port = 0, cockpitDataDirectory = null } = {}) {
  if (host !== '127.0.0.1') throw new RangeError('El servidor solo puede enlazarse a 127.0.0.1.');
  if (!root) throw new TypeError('root es obligatorio.');
  const rootReal = await realpath(root);
  const cockpitLayout = createCockpitLayoutEndpoint(cockpitDataDirectory);
  const lightingPresets = createLightingPresetEndpoint(cockpitDataDirectory);
  // Metadata-keyed, bounded digest cache. An arbitrary ?v= must never freeze stale files.
  const fingerprints = new Map();
  async function fingerprint(file, details) {
    const key = file + ':' + details.size + ':' + details.mtimeMs + ':' + details.ctimeMs;
    if (fingerprints.has(key)) return fingerprints.get(key);
    const pending = (async () => { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); })();
    fingerprints.set(key, pending);
    while (fingerprints.size > 512) fingerprints.delete(fingerprints.keys().next().value);
    try { return await pending; } catch (error) { fingerprints.delete(key); throw error; }
  }
  let closed = false;
  let closePromise;

  const server = http.createServer(async (request, response) => {
    if ((request.url || '').split(/[?#]/, 1)[0] === '/api/cockpit-layout') {
      await cockpitLayout(request, response);
      return;
    }
    if ((request.url || '').split(/[?#]/, 1)[0] === '/api/lighting-presets') { await lightingPresets(request,response); return; }
    if ((request.url || '').split(/[?#]/, 1)[0] === '/healthz') {
      sendText(response, 200, 'ok\n', { 'cache-control': 'no-store' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendText(response, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
      return;
    }
    const segments = decodePath(request.url || '');
    if (!segments) { sendText(response, 403, 'Forbidden'); return; }
    const requested = path.resolve(rootReal, ...segments);
    if (!isWithin(rootReal, requested)) { sendText(response, 403, 'Forbidden'); return; }

    let fileReal;
    let details;
    try {
      fileReal = await realpath(requested);
      if (!isWithin(rootReal, fileReal)) { sendText(response, 403, 'Forbidden'); return; }
      details = await stat(fileReal);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') { sendText(response, 404, 'Not Found'); return; }
      sendText(response, 403, 'Forbidden');
      return;
    }
    if (!details.isFile()) { sendText(response, 404, 'Not Found'); return; }

    const extension = path.extname(fileReal).toLowerCase();
    const version = new URL(request.url, 'http://localhost').searchParams.get('v') || '';
    let digest = null;
    if (/^[a-f0-9]{16,64}$/i.test(version)) {
      try { digest = await fingerprint(fileReal, details); } catch { sendText(response, 404, 'Not Found'); return; }
    }
    const immutable = digest?.startsWith(version.toLowerCase()) && extension !== '.html';
    const etag = digest ? '"' + digest + '"' : 'W/"' + details.size.toString(16) + '-' + details.mtimeMs.toString(16) + '-' + details.ctimeMs.toString(16) + '"';
    const modified = Math.floor(details.mtimeMs / 1000) * 1000;
    const headers = {
      'content-type': MIME_TYPES.get(extension) || 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      etag, 'last-modified': new Date(modified).toUTCString(), 'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
    };
    const noneMatch = request.headers['if-none-match'];
    const notModified = noneMatch !== undefined
      ? noneMatch.split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''))
      : request.headers['if-modified-since'] && Date.parse(request.headers['if-modified-since']) >= modified;
    if (notModified) { response.writeHead(304, headers); response.end(); return; }
    let start = 0, end = details.size - 1, partial = false;
    const ifRange = request.headers['if-range'];
    const allowRange = !ifRange || (digest && ifRange === etag) || (!ifRange.includes('"') && Date.parse(ifRange) === modified);
    const match = request.method === 'GET' && allowRange && /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || '');
    if (match) {
      const from = match[1], to = match[2];
      if (from) { start = Number(from); end = to ? Math.min(Number(to), end) : end; }
      else if (to) start = Math.max(0, details.size - Number(to));
      if ((!from && !to) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= details.size) {
        response.writeHead(416, { ...headers, 'content-range': 'bytes */' + details.size, 'content-length': 0 }); response.end(); return;
      }
      partial = true; headers['content-range'] = 'bytes ' + start + '-' + end + '/' + details.size;
    }
    headers['content-length'] = partial ? end - start + 1 : details.size;
    response.writeHead(partial ? 206 : 200, headers);
    if (request.method === 'HEAD' || details.size === 0) { response.end(); return; }
    const stream = createReadStream(fileReal, { start, end });
    response.once('close', () => stream.destroy());
    stream.once('error', () => response.destroy());
    stream.pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  return {
    url,
    close() {
      if (!closePromise) {
        closed = true;
        closePromise = new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      }
      return closePromise;
    },
    get closed() { return closed; },
  };
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export async function main() {
  const args = process.argv.slice(2);
  const portAt = args.indexOf('--port');
  const startAt = args.indexOf('--port-start');
  const endAt = args.indexOf('--port-end');
  const explicitPort = portAt >= 0 ? Number.parseInt(args[portAt + 1], 10) : null;
  const firstPort = explicitPort ?? (startAt >= 0 ? Number.parseInt(args[startAt + 1], 10) : 4173);
  const lastPort = explicitPort ?? (endAt >= 0 ? Number.parseInt(args[endAt + 1], 10) : 4183);
  if (!Number.isInteger(firstPort) || !Number.isInteger(lastPort)
      || firstPort < 0 || lastPort > 65535 || firstPort > lastPort) {
    throw new RangeError('Rango de puertos invalido.');
  }
  const root = path.dirname(fileURLToPath(import.meta.url));
  let instance = null;
  let lastError = null;
  for (let port = firstPort; port <= lastPort; port += 1) {
    try { instance = await startServer({ root, port, cockpitDataDirectory: path.resolve(root, '..', 'Configuracion') }); break; }
    catch (error) {
      lastError = error;
      if (error?.code !== 'EADDRINUSE' && error?.code !== 'EACCES') throw error;
    }
  }
  if (!instance) throw lastError || new Error('No hay un puerto disponible entre 4173 y 4183.');
  console.log(`Juego disponible en ${instance.url}`);
  console.log('Para cerrar el servidor y el juego, presiona Ctrl+C.');
  if (args.includes('--open')) openBrowser(instance.url);
  let stopping = false;
  process.once('SIGINT', () => {
    if (stopping) return;
    stopping = true;
    void instance.close().catch(error => { console.error(error.message); process.exitCode = 1; });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
