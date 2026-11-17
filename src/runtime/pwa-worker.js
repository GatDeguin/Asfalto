/* The build embeds ASFALTO_PWA_RELEASE above this source. Never clear browser profile storage here. */
'use strict';
const PWA_RELEASE = ASFALTO_PWA_RELEASE;
const PWA_SCOPE = self.registration.scope;
const PWA_CACHE = `asfalto-pwa-v1:${PWA_SCOPE}:content`;
const PWA_FILES = new Map(PWA_RELEASE.files.map(file => [file.path, file]));
const contentUrl = file => new URL(`.__asfalto_content__/${file.sha256}`, PWA_SCOPE).href;
const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
const integrity = file => `sha256-${btoa(file.sha256.match(/../g).map(value => String.fromCharCode(parseInt(value, 16))).join(''))}`;
let downloadController = null;
const clientActivity = new Map();
const unresponsiveClients = new Set();
const PAUSED_FOR_DRIVING = 'Descarga pausada al salir a conducir. Podés continuar al volver al taller';

async function gameWindows() {
  return (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => resourcePath(new URL(client.url)) !== null);
}
async function activityState({ query = false } = {}) {
  const windows = await gameWindows(), live = new Set(windows.map(client => client.id));
  for (const id of clientActivity.keys()) if (!live.has(id)) { clientActivity.delete(id); unresponsiveClients.delete(id); }
  if (query) await Promise.all(windows.map(client => new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (safe, answered = false) => { clearTimeout(timer); channel.port1.close(); clientActivity.set(client.id, safe === true); if (answered) unresponsiveClients.delete(client.id); else unresponsiveClients.add(client.id); resolve(); };
    const timer = setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = event => finish(event.data?.safe, typeof event.data?.safe === 'boolean');
    try { client.postMessage({ type: 'ASFALTO_PWA_ACTIVITY_QUERY' }, [channel.port2]); } catch { finish(false); }
  })));
  return { windows, activityBlocked: windows.some(client => clientActivity.get(client.id) !== true), unresponsiveClients: windows.filter(client => unresponsiveClients.has(client.id)).length };
}
async function broadcastActivity() {
  const { windows, activityBlocked, unresponsiveClients } = await activityState();
  for (const client of windows) {
    try { client.postMessage({ type: 'ASFALTO_PWA_ACTIVITY_CHANGED', activityBlocked, unresponsiveClients, downloading: Boolean(downloadController) }); } catch {}
  }
}

async function storedFiles() {
  const cache = await caches.open(PWA_CACHE);
  return { cache, keys: new Set((await cache.keys()).map(request => request.url)) };
}
async function status() {
  const { keys } = await storedFiles();
  const { activityBlocked, unresponsiveClients } = await activityState({ query: true });
  const stored = PWA_RELEASE.files.filter(file => keys.has(contentUrl(file)));
  return { version: PWA_RELEASE.id, files: PWA_RELEASE.files.length, storedFiles: stored.length,
    totalBytes: PWA_RELEASE.totalBytes, storedBytes: stored.reduce((sum, file) => sum + file.bytes, 0),
    shellBytes: PWA_RELEASE.shellBytes, complete: stored.length === PWA_RELEASE.files.length,
    downloading: Boolean(downloadController), activityBlocked, unresponsiveClients };
}
async function storeFile(file, cache, signal) {
  const key = contentUrl(file);
  if (await cache.match(key)) return;
  signal?.throwIfAborted();
  const response = await fetch(new URL(file.path, PWA_SCOPE), { cache: 'no-store', credentials: 'same-origin', signal });
  if (!response.ok || response.status !== 200 || response.type === 'opaque') throw new Error('No se pudo descargar un archivo de esta versión. Reintentá con conexión.');
  const bytes = await response.arrayBuffer();
  signal?.throwIfAborted();
  if (bytes.byteLength !== file.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== file.sha256) {
    throw new Error('La versión publicada cambió durante la descarga. Cerrá el juego, abrilo otra vez y reintentá.');
  }
  signal?.throwIfAborted();
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.set('content-length', String(bytes.byteLength));
  await cache.put(key, new Response(bytes, { status: 200, headers }));
}
self.addEventListener('install', event => {
  // Only code and small configuration enter automatically. Models/music/textures require explicit DOWNLOAD.
  event.waitUntil((async () => {
    const cache = await caches.open(PWA_CACHE);
    const pending = PWA_RELEASE.files.filter(file => file.shell);
    let next = 0;
    await Promise.all([0, 1].map(async () => { while (next < pending.length) await storeFile(pending[next++], cache); }));
  })());
});
self.addEventListener('activate', event => {
  // No skipWaiting or clients.claim: a running race stays with its original worker and code.
  event.waitUntil((async () => {
    const { cache, keys } = await storedFiles();
    const retained = new Set(PWA_RELEASE.files.map(contentUrl));
    for (const key of keys) if (!retained.has(key)) await cache.delete(key);
  })());
});
async function rangeResponse(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  const bytes = await response.arrayBuffer(), size = bytes.byteLength;
  const headers = new Headers(response.headers);
  const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
  const end = match?.[1] && match?.[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
    headers.set('content-range', `bytes */${size}`); headers.set('content-length', '0');
    return new Response(null, { status: 416, headers });
  }
  headers.set('accept-ranges', 'bytes'); headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
function resourcePath(url) {
  const scope = new URL(PWA_SCOPE);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null;
  try { return decodeURIComponent(url.pathname.slice(scope.pathname.length)) || 'index.html'; } catch { return null; }
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const file = PWA_FILES.get(resourcePath(new URL(event.request.url)));
  if (!file) return;
  event.respondWith((async () => {
    const cache = await caches.open(PWA_CACHE), stored = await cache.match(contentUrl(file));
    if (stored) return event.request.headers.has('range') ? rangeResponse(stored, event.request.headers.get('range')) : stored;
    // Network resources are streamed by fetch; only explicit downloads populate the large content cache.
    // A partial media request cannot validate a whole-file SRI digest. Its offline counterpart uses verified bytes above.
    if (event.request.headers.has('range')) return fetch(event.request);
    return fetch(new Request(event.request, { integrity: integrity(file), cache: 'no-cache' }));
  })());
});
async function download(post) {
  if (downloadController) throw new Error('Ya hay una descarga en curso en otra ventana.');
  const owned = new AbortController(); downloadController = owned;
  try {
    const activity = await activityState({ query: true });
    if (activity.unresponsiveClients) throw new DOMException('Otra ventana del juego no respondió. Volvé a esa ventana o cerrala antes de continuar la descarga.', 'InvalidStateError');
    if (activity.activityBlocked) throw new DOMException('La descarga está disponible cuando todas las ventanas del juego están en el taller.', 'InvalidStateError');
    await broadcastActivity();
    owned.signal.throwIfAborted();
    const { cache, keys } = await storedFiles();
    let done = 0, bytes = 0;
    for (const file of PWA_RELEASE.files) {
      owned.signal.throwIfAborted();
      post({ kind: 'progress', filesDone: done, files: PWA_RELEASE.files.length, storedBytes: bytes, totalBytes: PWA_RELEASE.totalBytes });
      if (!keys.has(contentUrl(file))) await storeFile(file, cache, owned.signal);
      done++; bytes += file.bytes;
    }
    downloadController = null;
    return await status();
  } finally { if (downloadController === owned) downloadController = null; await broadcastActivity(); }
}
async function removeDownloads() {
  if (downloadController) throw new Error('Cancelá la descarga antes de quitar los archivos.');
  const cache = await caches.open(PWA_CACHE);
  const shellKeys = new Set(PWA_RELEASE.files.filter(file => file.shell).map(contentUrl));
  for (const file of PWA_RELEASE.files) if (!shellKeys.has(contentUrl(file))) await cache.delete(contentUrl(file));
  return status();
}
self.addEventListener('message', event => {
  const port = event.ports?.[0];
  if (!port || resourcePath(new URL(event.source?.url || PWA_SCOPE)) === null) return;
  const post = value => { try { port.postMessage(value); } catch {} };
  event.waitUntil((async () => {
    try {
      let value;
      if (event.data?.type === 'STATUS') value = await status();
      else if (event.data?.type === 'DOWNLOAD') value = await download(post);
      else if (event.data?.type === 'ACTIVITY') {
        if (!event.source?.id) throw new Error('No se pudo identificar la ventana del juego.');
        clientActivity.set(event.source.id, event.data.safe === true);
        unresponsiveClients.delete(event.source.id);
        if (event.data.safe !== true) downloadController?.abort(new DOMException(PAUSED_FOR_DRIVING, 'AbortError'));
        await broadcastActivity(); value = { safe: event.data.safe === true };
      }
      else if (event.data?.type === 'CANCEL') { downloadController?.abort(new DOMException('Descarga cancelada', 'AbortError')); value = { canceled: true }; }
      else if (event.data?.type === 'REMOVE_DOWNLOADS') value = await removeDownloads();
      else throw new Error('Solicitud de aplicación desconocida.');
      post({ kind: 'result', value });
    } catch (error) {
      post({ kind: 'error', name: error.name, message: error.name === 'QuotaExceededError' ? 'No alcanza el espacio del navegador. Liberá espacio y reintentá; los archivos ya verificados se conservan.' : error.message });
    }
  })());
});
