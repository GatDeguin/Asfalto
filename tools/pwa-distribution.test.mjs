import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { pwaActivityAllowsDownload, createPwaProgressAnnouncer } from '../src/runtime/pwa-client.mjs?v=a29fdfe6613afc4b';

const source = await fs.readFile(new URL('../src/runtime/pwa-worker.js?v=7b454e1799efbf1d', import.meta.url), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const file = (path, body, shell) => ({ path, body, shell, bytes: Buffer.byteLength(body), sha256: hash(body) });
const baseFiles = [file('index.html', '<title>Version one</title>', true), file('src/game.mjs', 'export const version=1;', true), file('assets/audio.mp3', '0123456789', false)];
function worker(files = baseFiles, shared = new Map(), networkOverride = null, putOverride = null, clientStates = new Map()) {
  const descriptor = { id: hash(JSON.stringify(files)).slice(0, 20), files: files.map(({ body, ...rest }) => rest), totalBytes: files.reduce((n, f) => n + f.bytes, 0), shellBytes: files.filter(f => f.shell).reduce((n, f) => n + f.bytes, 0) };
  const listeners = new Map(), fetched = [], lifecycle = [], activityMessages = [];
  const open = async name => {
    if (!shared.has(name)) shared.set(name, new Map());
    const records = shared.get(name);
    return { match: async key => records.get(String(key))?.clone(), put: async (key, response) => { putOverride?.(String(key)); records.set(String(key), response.clone()); }, keys: async () => [...records.keys()].map(key => new Request(key)), delete: async key => records.delete(String(key)) };
  };
  const context = vm.createContext({
    ASFALTO_PWA_RELEASE: descriptor, URL, Request, Response, Headers, DOMException, AbortController, MessageChannel, setTimeout, clearTimeout, crypto: webcrypto, btoa,
    caches: { open }, self: { registration: { scope: 'https://asfalto.test/Asfalto/' }, addEventListener: (name, listener) => listeners.set(name, listener), skipWaiting: () => lifecycle.push('skipWaiting'), clients: {
      claim: () => lifecycle.push('claim'),
      matchAll: async () => [...clientStates.entries()].map(([id, state]) => ({ id, url: 'https://asfalto.test/Asfalto/', postMessage: (message, ports) => {
        if (message.type === 'ASFALTO_PWA_ACTIVITY_QUERY') { if (state.respond !== false) ports[0].postMessage({ safe: state.safe }); }
        else activityMessages.push({ id, ...message });
      } })),
    } },
    fetch: async (request, options) => {
      const url = new URL(request.url || request), relative = decodeURIComponent(url.pathname.slice('/Asfalto/'.length));
      fetched.push(relative); options?.signal?.throwIfAborted();
      if (networkOverride) { const response = await networkOverride(relative, options); if (response) return response; }
      const known = files.find(value => value.path === relative);
      return known ? new Response(known.body, { headers: { 'content-type': known.path.endsWith('.html') ? 'text/html' : 'application/octet-stream' } }) : new Response('not found', { status: 404 });
    },
  });
  vm.runInContext(source, context);
  const lifecycleEvent = async name => { let work; listeners.get(name)({ waitUntil: promise => { work = promise; } }); await work; };
  const message = async (type, onProgress, payload = {}, clientId = 'main') => {
    let work, outcome;
    listeners.get('message')({ data: { type, ...payload }, source: { id: clientId, url: 'https://asfalto.test/Asfalto/' }, ports: [{ postMessage: data => { if (data.kind === 'progress') onProgress?.(data); else outcome = data; } }], waitUntil: promise => { work = promise; } });
    await work; return outcome;
  };
  const fetchEvent = async (relative, options) => {
    let work;
    listeners.get('fetch')({ request: new Request(new URL(relative, 'https://asfalto.test/Asfalto/'), options), respondWith: promise => { work = promise; } });
    return work ? await work : null;
  };
  return { install: () => lifecycleEvent('install'), activate: () => lifecycleEvent('activate'), message, fetchEvent, shared, fetched, lifecycle, descriptor, activityMessages };
}
test('install caches only the small shell and does not take over running pages', async () => {
  const app = worker(); await app.install(); await app.activate();
  assert.deepEqual(app.fetched.sort(), ['index.html', 'src/game.mjs']);
  assert.deepEqual(app.lifecycle, []);
  const status = (await app.message('STATUS')).value;
  assert.equal(status.complete, false); assert.equal(status.storedFiles, 2);
  assert.equal(await (await app.fetchEvent('./')).text(), baseFiles[0].body);
  assert.equal(await app.fetchEvent('https://other.test/index.html'), null);
});
test('explicit download completes offline content and supports media seeking', async () => {
  const app = worker(); await app.install();
  assert.equal((await app.message('DOWNLOAD')).value.complete, true);
  const response = await app.fetchEvent('assets/audio.mp3', { headers: { Range: 'bytes=2-5' } });
  assert.equal(response.status, 206); assert.equal(await response.text(), '2345');
  assert.equal(response.headers.get('content-range'), 'bytes 2-5/10');
  const removed = await app.message('REMOVE_DOWNLOADS');
  assert.equal(removed.value.complete, false); assert.equal(removed.value.storedFiles, 2);
});

test('runtime boot metadata stays available offline after removing optional downloads', async () => {
  const metadata=await fs.readFile(new URL('../assets/manifests/runtime.json',import.meta.url),'utf8');
  const descriptor=file('assets/manifests/runtime.json',metadata,true);
  const app=worker([...baseFiles,descriptor]);await app.install();await app.message('DOWNLOAD');
  await app.message('REMOVE_DOWNLOADS');
  const callsBefore=app.fetched.length;
  const response=await app.fetchEvent('assets/manifests/runtime.json');
  assert.equal(response.status,200);assert.equal(await response.text(),metadata);
  assert.equal(app.fetched.length,callsBefore,'Offline metadata must not request the network');
  assert.equal((await app.message('STATUS')).value.complete,false);
});
test('cancel keeps verified files, and retry downloads only missing files', async () => {
  const app = worker(); await app.install();
  let canceled = false;
  const result = await app.message('DOWNLOAD', value => { if (!canceled && value.filesDone === 2) { canceled = true; void app.message('CANCEL'); } });
  assert.equal(result.kind, 'error'); assert.equal(result.name, 'AbortError');
  assert.equal((await app.message('STATUS')).value.storedFiles, 2);
  const retry = await app.message('DOWNLOAD'); assert.equal(retry.value.complete, true);
  assert.equal(app.fetched.filter(value => value === 'index.html').length, 1);
});
test('changed or corrupt bytes never become a completed offline pack', async () => {
  const app = worker(baseFiles, new Map(), relative => relative === 'assets/audio.mp3' ? new Response('wrong') : null);
  await app.install(); const result = await app.message('DOWNLOAD');
  assert.equal(result.kind, 'error'); assert.match(result.message, /versión publicada cambió/);
  const status = (await app.message('STATUS')).value; assert.equal(status.complete, false); assert.equal(status.storedFiles, 2);
});
test('quota failure reports recoverable state and retains the shell', async () => {
  const app = worker(baseFiles, new Map(), null, key => { if (key.endsWith(baseFiles[2].sha256)) throw new DOMException('full', 'QuotaExceededError'); });
  await app.install(); const result = await app.message('DOWNLOAD');
  assert.equal(result.name, 'QuotaExceededError'); assert.match(result.message, /espacio/);
  assert.equal((await app.message('STATUS')).value.storedFiles, 2);
});
test('new release keeps old shell valid until activation and reuses unchanged content', async () => {
  const shared = new Map(), previous = worker(baseFiles, shared);
  await previous.install(); await previous.message('DOWNLOAD');
  const newFiles = [file('index.html', '<title>Version two</title>', true), file('src/game.mjs', 'export const version=2;', true), baseFiles[2]];
  const next = worker(newFiles, shared); await next.install();
  assert.equal(await (await previous.fetchEvent('src/game.mjs')).text(), baseFiles[1].body);
  await next.activate();
  assert.equal(await (await next.fetchEvent('src/game.mjs')).text(), newFiles[1].body);
  assert.equal((await next.message('STATUS')).value.complete, true);
  assert.equal(next.fetched.includes('assets/audio.mp3'), false);
});
test('departure and all driving phases prevent bulk downloads before racing begins', () => {
  const body = (names, phase) => ({ classList: { contains: name => names.includes(name) }, dataset: { v7Phase: phase } });
  assert.equal(pwaActivityAllowsDownload(body(['v6-menu-open'], 'workshop')), true);
  for (const [classes, phase] of [
    [['v6-menu-open', 'an-loading-open'], 'workshop'], [['v6-menu-open'], 'loading'],
    [['v6-menu-open', 'an-race-opening-active'], 'opening'], [['v6-driving'], 'driving'],
    [['v6-driving'], 'paused'], [['v6-menu-open', 'an-intro-open'], 'opening'], [[], undefined],
  ]) assert.equal(pwaActivityAllowsDownload(body(classes, phase)), false, `${classes}/${phase}`);
});
test('progress announcements are limited to once a second and a final result', () => {
  let at = 0; const spoken = [];
  const announce = createPwaProgressAnnouncer(value => spoken.push(value), { now: () => at });
  announce('first'); at = 100; announce('second'); at = 999; announce('third'); at = 1000; announce('fourth'); at = 1001; announce('done', { final: true });
  assert.deepEqual(spoken, ['first', 'fourth', 'done']);
});
test('another driving window blocks downloads even after worker state was restarted', async () => {
  const clients = new Map([['main', { safe: true }], ['driver', { safe: false }]]);
  const app = worker(baseFiles, new Map(), null, null, clients); await app.install();
  assert.equal((await app.message('STATUS')).value.activityBlocked, true);
  const result = await app.message('DOWNLOAD'); assert.equal(result.name, 'InvalidStateError');
  assert.equal(app.fetched.includes('assets/audio.mp3'), false);
  clients.get('driver').safe = true;
  assert.equal((await app.message('DOWNLOAD')).value.complete, true);
});
test('departure in another window aborts an in-flight file and retains completed hashes', async () => {
  const clients = new Map([['main', { safe: true }], ['driver', { safe: true }]]);
  let started; const pending = new Promise(resolve => { started = resolve; });
  const app = worker(baseFiles, new Map(), (relative, options) => relative === 'assets/audio.mp3' ? new Promise((_resolve, reject) => {
    started(); options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }) : null, null, clients);
  await app.install(); const downloading = app.message('DOWNLOAD'); await pending;
  clients.get('driver').safe = false;
  await app.message('ACTIVITY', null, { safe: false }, 'driver');
  const result = await downloading;
  assert.equal(result.name, 'AbortError'); assert.equal(result.message, 'Descarga pausada al salir a conducir. Podés continuar al volver al taller');
  assert.equal((await app.message('STATUS')).value.storedFiles, 2);
  assert.ok(app.activityMessages.some(value => value.activityBlocked));
});
test('unresponsive windows stop the download with a bounded, visible explanation', async () => {
  const clients = new Map([['main', { safe: true }], ['silent', { safe: true, respond: false }]]);
  const app = worker(baseFiles, new Map(), null, null, clients); await app.install();
  const began = performance.now(), result = await app.message('DOWNLOAD');
  assert.equal(result.name, 'InvalidStateError'); assert.match(result.message, /no respondió/);
  assert.ok(performance.now() - began < 2500, 'Parallel activity queries must be bounded near 1.5 seconds');
  assert.equal(app.fetched.includes('assets/audio.mp3'), false);
});
