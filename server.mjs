import {createGzip} from 'node:zlib';
import {prepareV7DataDirectory} from './src/server/v7-data-directory.mjs';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createCockpitLayoutEndpoint } from './src/server/cockpit-layout-store.mjs?v=balance-20260917';
import {createLightingPresetEndpoint} from './src/server/lighting-preset-store.mjs?v=balance-20260917';

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'], ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.glb', 'model/gltf-binary'], ['.gltf', 'model/gltf+json'], ['.wasm', 'application/wasm'],
  ['.ogg', 'audio/ogg'], ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'],
  ['.mp4', 'video/mp4'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
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
    const headers = { 'content-type': MIME_TYPES.get(extension) || 'application/octet-stream', 'content-length': details.size };
    const etag = 'W/"' + details.size.toString(16) + '-' + Math.floor(details.mtimeMs*1000).toString(16) + '"';
    headers.etag=etag;headers['cache-control']='no-cache';headers.vary='Accept-Encoding';
    if(String(request.headers['if-none-match']||'').split(',').map(v=>v.trim()).includes(etag)){
      delete headers['content-length'];response.writeHead(304,headers);response.end();return;
    }
    const compress=request.method!=='HEAD'&&details.size>1024&&['.html','.htm','.js','.mjs','.css','.json','.svg','.gltf','.glb','.bin','.wasm'].includes(extension)&&/(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers['accept-encoding']||'');
    if(compress){headers['content-encoding']='gzip';delete headers['content-length'];}
    response.writeHead(200,headers);
    if(request.method==='HEAD'){response.end();return;}
    const stream=createReadStream(fileReal);stream.once('error',()=>response.destroy());
    response.once('close',()=>stream.destroy());
    if(compress){const gzip=createGzip({level:5});gzip.once('error',()=>response.destroy());response.once('close',()=>gzip.destroy());stream.pipe(gzip).pipe(response);}
    else stream.pipe(response);
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
  const firstPort = explicitPort ?? (startAt >= 0 ? Number.parseInt(args[startAt + 1], 10) : 4273);
  const lastPort = explicitPort ?? (endAt >= 0 ? Number.parseInt(args[endAt + 1], 10) : 4283);
  if (!Number.isInteger(firstPort) || !Number.isInteger(lastPort)
      || firstPort < 0 || lastPort > 65535 || firstPort > lastPort) {
    throw new RangeError('Rango de puertos invalido.');
  }
  const root = path.dirname(fileURLToPath(import.meta.url));
  const targetDirectory=path.resolve(root,'.local-data','v7');
  await prepareV7DataDirectory({sourceDirectory:path.resolve(root,'..','Configuracion','v7'),targetDirectory});
  const cockpitDataDirectory=await prepareV7DataDirectory({sourceDirectory:path.resolve(root,'assets','configuration'),targetDirectory});
  let instance = null;
  let lastError = null;
  for (let port = firstPort; port <= lastPort; port += 1) {
    try { instance = await startServer({ root, port, cockpitDataDirectory }); break; }
    catch (error) {
      lastError = error;
      if (error?.code !== 'EADDRINUSE' && error?.code !== 'EACCES') throw error;
    }
  }
  if (!instance) throw lastError || new Error('No hay un puerto disponible entre 4273 y 4283.');
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
