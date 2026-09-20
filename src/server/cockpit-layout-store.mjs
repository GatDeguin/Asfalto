import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { sanitizeCompositionState } from '../game/composition-editor-state.mjs?v=8ed48999c4e7ed8b';
import { COCKPIT_LENS_PRESETS } from '../game/vehicle-camera-rig.mjs?v=11b71ce35d0b2e5d';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FILE_BYTES = 4 * MAX_BODY_BYTES; // Pretty JSON adds indentation to bounded request data.
const FILENAME = 'cockpit-layout.json';
const BACKUP_FILENAME = 'cockpit-layout.previous.json';

class CockpitError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const vector = value => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));
const validId = id => /^[a-z][a-z0-9-]{0,63}$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id);

function validTimestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day] = match.map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validateLayout(value) {
  const invalid = message => { throw new CockpitError(400, 'invalid_layout', message); };
  if (!record(value) || value.version !== 3) invalid('La configuración debe ser un objeto de versión 3.');
  if (typeof value.build !== 'string' || value.build.length > 256) invalid('build debe ser texto de hasta 256 caracteres.');
  if (!validTimestamp(value.updatedAt)) invalid('updatedAt debe ser una fecha ISO válida.');
  if (!record(value.transforms)) invalid('transforms debe ser un objeto.');
  for (const [id, transform] of Object.entries(value.transforms)) {
    if (!validId(id)) invalid('La configuración contiene un identificador de objeto inválido.');
    if (!record(transform) || !['position', 'rotation', 'scale'].every(key => vector(transform[key]))) {
      invalid(`El objeto ${id} requiere position, rotation y scale con tres números finitos.`);
    }
  }
  const camera = value.camera?.cockpit;
  if (!record(value.camera) || !record(camera) || !vector(camera.positionOffsetM) || !vector(camera.rotationOffsetDeg)) {
    invalid('camera.cockpit requiere posición y rotación con tres números finitos.');
  }
  if (!Object.hasOwn(COCKPIT_LENS_PRESETS, camera.lensMode) && camera.lensMode !== 'manual') invalid('El modo de lente del cockpit es inválido.');
  for (const field of ['focalLengthMm', 'baseHorizontalFovDeg']) {
    if ((field === 'focalLengthMm' && camera.lensMode === 'manual') || camera[field] !== undefined) {
      if (typeof camera[field] !== 'number' || !Number.isFinite(camera[field])) invalid(`${field} debe ser un número finito.`);
    }
  }
  return sanitizeCompositionState(value);
}

async function syncDirectory(directory) {
  // Windows does not expose directory fsync through Node. Both file contents
  // are flushed before their atomic rename on every supported platform.
  if (process.platform === 'win32') return;
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function atomicWrite(filename, contents) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(contents); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, filename);
    await syncDirectory(path.dirname(filename));
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

function createStore(directory) {
  const filename = path.join(path.resolve(directory), FILENAME);
  const backup = path.join(path.dirname(filename), BACKUP_FILENAME);
  let tail = Promise.resolve();
  const enqueue = action => {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  };
  async function readCurrent() {
    let contents;
    try {
      const details = await lstat(filename);
      if (!details.isFile() || details.isSymbolicLink() || details.size > MAX_FILE_BYTES) {
        throw new CockpitError(500, 'invalid_disk_layout', 'El archivo cockpit-layout.json no es un archivo de configuración válido.');
      }
      contents = await readFile(filename);
      if (contents.length > MAX_FILE_BYTES) throw new Error('oversize');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof CockpitError) throw error;
      throw new CockpitError(500, 'disk_read_failed', 'No se pudo leer cockpit-layout.json.');
    }
    try { return { contents, layout: validateLayout(JSON.parse(contents.toString('utf8'))) }; }
    catch { throw new CockpitError(500, 'invalid_disk_layout', 'cockpit-layout.json contiene una configuración inválida; el archivo se conservó.'); }
  }
  return {
    path: filename.replaceAll('\\', '/'),
    read: () => enqueue(async () => (await readCurrent())?.layout ?? null),
    save(value) {
      const layout = validateLayout(value);
      const contents = `${JSON.stringify(layout, null, 2)}\n`;
      if (Buffer.byteLength(contents) > MAX_FILE_BYTES) throw new CockpitError(413, 'body_too_large', 'La configuración normalizada supera el límite de almacenamiento.');
      return enqueue(async () => {
        const current = await readCurrent();
        if (current && Date.parse(layout.updatedAt) < Date.parse(current.layout.updatedAt)) {
          throw new CockpitError(409, 'stale_layout', 'Ya hay una configuración más reciente guardada.');
        }
        try {
          await mkdir(path.dirname(filename), { recursive: true });
          if (current) await atomicWrite(backup, current.contents);
          await atomicWrite(filename, contents);
        } catch {
          throw new CockpitError(500, 'disk_write_failed', 'No se pudo guardar cockpit-layout.json; se conservó el respaldo disponible.');
        }
        return layout;
      });
    },
  };
}

export function sendJSON(response, status, payload, headers = {}) {
  const contents = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(contents),
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  response.end(contents);
}

export function enforceSameOrigin(request) {
  const forbidden = () => { throw new CockpitError(403, 'forbidden_origin', 'La configuración solo está disponible desde el mismo servidor local.'); };
  const host = request.headers.host;
  let target;
  try { target = new URL(`http://${host}`); } catch { forbidden(); }
  if (!host || target.host !== host.toLowerCase() || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
    || Number(target.port || 80) !== request.socket.localPort
    || !['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(request.socket.remoteAddress)) forbidden();
  const origin = request.headers.origin;
  if ((request.method === 'PUT' && !origin) || (origin !== undefined && origin !== target.origin)
    || request.headers['sec-fetch-site'] === 'cross-site') forbidden();
}

export function readJSONBody(request) {
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(request.headers['content-type'] || '')) {
    throw new CockpitError(415, 'json_required', 'El cuerpo debe usar Content-Type: application/json.');
  }
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') {
    throw new CockpitError(415, 'encoding_not_supported', 'El cuerpo JSON no debe estar comprimido.');
  }
  return new Promise((resolve, reject) => {
    let size = 0, settled = false;
    const chunks = [];
    const fail = error => { if (!settled) { settled = true; chunks.length = 0; reject(error); } };
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) fail(new CockpitError(413, 'body_too_large', 'La configuración supera el límite de 64 KiB.'));
      else if (!settled) chunks.push(chunk);
    });
    request.once('end', () => {
      if (settled) return;
      try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); settled = true; resolve(value); }
      catch { fail(new CockpitError(400, 'invalid_json', 'El cuerpo no contiene JSON válido.')); }
    });
    request.once('aborted', () => fail(new CockpitError(400, 'incomplete_body', 'La solicitud de guardado quedó incompleta.')));
    request.once('error', () => fail(new CockpitError(400, 'incomplete_body', 'No se pudo recibir la configuración.')));
  });
}

// Server-only: storage is opt-in so QA servers never touch personal settings.
export function createCockpitLayoutEndpoint(directory = null) {
  if (directory !== null && (typeof directory !== 'string' || !directory)) throw new TypeError('cockpitDataDirectory debe ser una ruta o null.');
  const store = directory === null ? null : createStore(directory);
  return async (request, response) => {
    try {
      enforceSameOrigin(request);
      if (request.method !== 'GET' && request.method !== 'PUT') {
        sendJSON(response, 405, { error: 'Método no permitido.', code: 'method_not_allowed' }, { allow: 'GET, PUT' }); return;
      }
      if (!store) {
        if (request.method === 'GET') sendJSON(response, 200, { enabled: false });
        else sendJSON(response, 503, { error: 'El guardado en disco está desactivado.', code: 'persistence_disabled' });
        return;
      }
      if (request.method === 'GET') sendJSON(response, 200, { enabled: true, path: store.path, layout: await store.read() });
      else sendJSON(response, 200, { ok: true, path: store.path, layout: await store.save(await readJSONBody(request)) });
    } catch (error) {
      if (!response.destroyed) sendJSON(response, error instanceof CockpitError ? error.status : 500,
        { error: error instanceof CockpitError ? error.message : 'No se pudo procesar la configuración del cockpit.', code: error.code || 'cockpit_error' });
    } finally {
      if (!request.readableEnded) request.resume();
    }
  };
}
