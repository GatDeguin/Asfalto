// Derived read-only asset validation from v6; acceptance is owned by validate_asfalto_v7_modular.mjs.
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
export const DEFAULT_RELEASE_ROOT = ROOT;
export const RELEASE_MANIFEST_RELATIVE = 'assets/manifests/release.json';
const EXPECTED_TRACKS = ['dos_lagos', 'aconcagua_horcones', 'paso_garibaldi', 'cuesta_lipan', 'cataratas_iguazu'];
const EXPECTED_PRESETS = ['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night'];
const SKY_LOCKS = Object.freeze({
  clear: ['clear.av3hdri', 3145744, '4FAE12BD002076D36C1390BCF9B07F5251BB699AE60147D20BA28B2F4F61DD94'],
  overcast: ['overcast.av3hdri', 3145744, 'B047E339DD95935AAE51E65F39359ABD52148144872644E0918B7464C5A35CBF'],
  'golden-hour': ['golden.av3hdri', 3145744, '603C3F7DD38C850BCA04D9C532B1787D78D77AB480EA3129FDA3E2D3D1A5F29E'],
  sunset: ['sunset.av3hdri', 3145744, '9B83B12E2E0AB7E6F9933E920B49BA0DE8F662829AEC562D9E7B974AFF6D253A'],
  moonrise: ['moonrise.av3hdri', 3145744, 'DE48E823ED893A8999622AC8E5873337EDA7114237E650B739C9CE47F178CD3B'],
  night: ['night.av3hdri', 3145744, 'B7DA232FB2F34C595F2C2519DEF9A03537850123E33C93B25F1066935869A94E'],
});

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
function posix(value) { return value.split(path.sep).join('/'); }
function invariant(value, message) { if (!value) throw new Error(message); }
function safeRelative(value, label = 'path') {
  invariant(typeof value === 'string' && value.length > 0, `${label} is required`);
  invariant(!value.includes('\\') && !value.includes('\0') && !value.includes('%'), `${label} is not canonical`);
  invariant(!value.startsWith('/') && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value), `${label} must be relative`);
  const cleaned = value.startsWith('./') ? value.slice(2) : value;
  invariant(cleaned && cleaned.split('/').every(part => part && part !== '.' && part !== '..'), `${label} escapes release root`);
  return cleaned;
}
function json(bytes, label) { try { return JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`${label} is invalid JSON: ${error.message}`); } }

async function walkFiles(root) {
  const output = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '.local-data' || entry.name === 'node_modules' || entry.name.endsWith('.log')) continue;
      const absolute = path.join(directory, entry.name);
      const details = await lstat(absolute);
      invariant(!details.isSymbolicLink(), `release symlink is forbidden: ${posix(path.relative(root, absolute))}`);
      if (details.isDirectory()) await visit(absolute);
      else if (details.isFile()) output.push(posix(path.relative(root, absolute)));
    }
  }
  await visit(root);
  return output.sort();
}

async function inventory(root) {
  const files = (await walkFiles(root)).filter(relative => relative !== RELEASE_MANIFEST_RELATIVE);
  return Promise.all(files.map(async relative => {
    const bytes = await readFile(path.join(root, ...relative.split('/')));
    return Object.freeze({ path: relative, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }));
}

export function inspectGlb(bytes, label = 'asset') {
  invariant(bytes.byteLength >= 20, `${label} GLB is truncated`);
  invariant(bytes.readUInt32LE(0) === 0x46546c67, `${label} GLB magic mismatch`);
  invariant(bytes.readUInt32LE(4) === 2, `${label} GLB version mismatch`);
  invariant(bytes.readUInt32LE(8) === bytes.byteLength, `${label} GLB declared length mismatch`);
  let offset = 12;
  let document = null;
  let binaryBytes = 0;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    invariant(offset + 8 <= bytes.byteLength, `${label} GLB chunk header is truncated`);
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    invariant(chunkLength % 4 === 0, `${label} GLB chunk alignment mismatch`);
    invariant(offset + chunkLength <= bytes.byteLength, `${label} GLB chunk is truncated`);
    const chunk = bytes.subarray(offset, offset + chunkLength);
    if (chunkIndex === 0) {
      invariant(chunkType === 0x4e4f534a, `${label} first GLB chunk is not JSON`);
      document = json(Buffer.from(chunk.toString('utf8').replace(/[\u0000\u0020]+$/g, '')), `${label} GLB document`);
    } else if (chunkType === 0x004e4942) {
      binaryBytes += chunkLength;
    }
    offset += chunkLength;
    chunkIndex += 1;
  }
  invariant(offset === bytes.byteLength && document, `${label} GLB chunks do not cover file`);
  invariant(document.asset?.version === '2.0', `${label} glTF asset version mismatch`);
  invariant(Array.isArray(document.nodes) && document.nodes.length > 0, `${label} GLB nodes missing`);
  invariant(Array.isArray(document.meshes) && document.meshes.length > 0, `${label} GLB meshes missing`);
  invariant(Array.isArray(document.accessors), `${label} GLB accessors missing`);
  invariant(Array.isArray(document.bufferViews), `${label} GLB bufferViews missing`);
  const meshNodeNames = [];
  for (const [index, node] of document.nodes.entries()) {
    if (node.mesh == null) continue;
    invariant(Number.isInteger(node.mesh) && document.meshes[node.mesh], `${label} node ${index} mesh invalid`);
    meshNodeNames.push(String(node.name || `node_${index}`));
  }
  let trianglePrimitives = 0;
  for (const [meshIndex, mesh] of document.meshes.entries()) {
    invariant(Array.isArray(mesh.primitives) && mesh.primitives.length > 0, `${label} mesh ${meshIndex} primitives missing`);
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      invariant(primitive.mode == null || primitive.mode === 4, `${label} mesh ${meshIndex}/${primitiveIndex} is not triangles`);
      const positionAccessor = document.accessors[primitive.attributes?.POSITION];
      invariant(positionAccessor?.type === 'VEC3' && Number.isInteger(positionAccessor.count)
        && positionAccessor.count >= 3, `${label} mesh ${meshIndex}/${primitiveIndex} POSITION invalid`);
      if (primitive.indices != null) {
        const indexAccessor = document.accessors[primitive.indices];
        invariant(indexAccessor && Number.isInteger(indexAccessor.count)
          && indexAccessor.count >= 3 && indexAccessor.count % 3 === 0,
        `${label} mesh ${meshIndex}/${primitiveIndex} indices invalid`);
      } else {
        invariant(positionAccessor.count % 3 === 0, `${label} mesh ${meshIndex}/${primitiveIndex} vertices invalid`);
      }
      trianglePrimitives += 1;
    }
  }
  invariant(meshNodeNames.length > 0 && trianglePrimitives > 0, `${label} has no instanced triangle mesh`);
  const declaredBufferBytes = (document.buffers || []).reduce((sum, buffer) => {
    invariant(Number.isInteger(buffer.byteLength) && buffer.byteLength > 0, `${label} GLB buffer length invalid`);
    if (buffer.uri || buffer.extensions?.EXT_meshopt_compression) return sum;
    return sum + buffer.byteLength;
  }, 0);
  invariant(binaryBytes >= declaredBufferBytes, `${label} GLB BIN chunk is shorter than declared buffers`);
  return Object.freeze({
    document,
    nodeNames: Object.freeze(document.nodes.map(node => String(node.name || ''))),
    meshNodeNames: Object.freeze(meshNodeNames),
    meshCount: document.meshes.length,
    trianglePrimitives,
    binaryBytes,
  });
}

function stationOf(record) { return Number(record?.sM ?? record?.s); }
function sectorStart(record) { return Number(record?.startM ?? (record?.km_start * 1000)); }
function sectorEnd(record) { return Number(record?.endM ?? (record?.km_end * 1000)); }

export function validateRoute(route, manifest, label = manifest?.id || 'track', registryEntry = null) {
  invariant(Array.isArray(route.samples) && route.samples.length >= 2, `${label} route samples missing`);
  const routeLengthM = Number(route.lengthM ?? route.routeLengthM);
  invariant(Number.isFinite(routeLengthM) && routeLengthM > 100, `${label} route length missing`);
  invariant(Math.abs(Number(manifest.lengthM) - routeLengthM) <= 0.5, `${label} manifest route length mismatch`);
  if (registryEntry) {
    invariant(Math.abs(Number(registryEntry.lengthM) - routeLengthM) <= 0.5, `${label} registry route length mismatch`);
  }
  const sampleStepM = Number(route.sampleStepM);
  invariant(Number.isFinite(sampleStepM) && sampleStepM > 0 && sampleStepM <= 100, `${label} sample step invalid`);
  let previous = null;
  let previousStation = -Infinity;
  for (const [index, sample] of route.samples.entries()) {
    const station = stationOf(sample);
    invariant(Number.isFinite(station) && station >= 0 && station <= routeLengthM + 0.5, `${label} sample ${index} station invalid`);
    invariant(station > previousStation, `${label} sample stations are not strictly ordered at ${index}`);
    if (index > 0) invariant(station - previousStation <= sampleStepM * 1.51, `${label} route station gap at ${index}`);
    const position = sample.position || [sample.x, sample.y, sample.z];
    invariant(Array.isArray(position) && position.length === 3 && position.every(Number.isFinite), `${label} sample ${index} position invalid`);
    if (previous) invariant(Math.hypot(position[0] - previous[0], position[1] - previous[1], position[2] - previous[2]) < 1000, `${label} route discontinuity at ${index}`);
    for (const field of ['tangent', 'left']) {
      const vector = sample[field];
      invariant(Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite), `${label} sample ${index} ${field} invalid`);
      const magnitude = Math.hypot(...vector);
      invariant(magnitude >= 0.75 && magnitude <= 1.25, `${label} sample ${index} ${field} is not normalized`);
    }
    const dot = sample.tangent.reduce((sum, value, axis) => sum + value * sample.left[axis], 0);
    invariant(Math.abs(dot) < 0.25, `${label} sample ${index} route frame is not orthogonal`);
    const widthM = Number(sample.widthM ?? sample.width);
    invariant(Number.isFinite(widthM) && widthM >= 4 && widthM <= 30, `${label} sample ${index} width invalid`);
    const curvature = Number(sample.curvaturePerM ?? sample.curvature);
    invariant(Number.isFinite(curvature) && Math.abs(curvature) <= 1, `${label} sample ${index} curvature invalid`);
    previous = position;
    previousStation = station;
  }
  invariant(stationOf(route.samples[0]) <= sampleStepM * 0.1, `${label} route does not begin at zero`);
  invariant(routeLengthM - stationOf(route.samples.at(-1)) <= sampleStepM * 1.1, `${label} route does not cover finish`);

  invariant(Array.isArray(route.sectors) && route.sectors.length > 0, `${label} sectors missing`);
  if (registryEntry) invariant(route.sectors.length === registryEntry.sectors, `${label} sector count mismatch`);
  let coveredUntil = 0;
  const sectorIds = new Set();
  for (const [index, sector] of route.sectors.entries()) {
    const startM = sectorStart(sector);
    const endM = sectorEnd(sector);
    invariant(typeof sector.id === 'string' && sector.id && !sectorIds.has(sector.id), `${label} sector ${index} id invalid`);
    invariant(Number.isFinite(startM) && Number.isFinite(endM) && endM > startM, `${label} sector ${index} bounds invalid`);
    invariant(Math.abs(startM - coveredUntil) <= 1, `${label} sectors are not contiguous at ${index}`);
    invariant(endM <= routeLengthM + 0.5, `${label} sector ${index} exceeds route`);
    sectorIds.add(sector.id);
    coveredUntil = endM;
  }
  invariant(Math.abs(coveredUntil - routeLengthM) <= 1, `${label} sectors do not cover finish`);

  if (Array.isArray(route.checkpoints)) {
    invariant(route.checkpoints.length >= route.sectors.length, `${label} checkpoints missing`);
    let checkpointStation = -Infinity;
    for (const [index, checkpoint] of route.checkpoints.entries()) {
      const station = stationOf(checkpoint);
      invariant(Number.isFinite(station) && station > checkpointStation && station <= routeLengthM + 0.5,
        `${label} checkpoint ${index} invalid`);
      invariant(Number(checkpoint.halfWidthM) >= 2 && Number(checkpoint.halfWidthM) <= 20,
        `${label} checkpoint ${index} width invalid`);
      checkpointStation = station;
    }
    invariant(stationOf(route.checkpoints[0]) <= 0.5, `${label} start checkpoint missing`);
    invariant(routeLengthM - stationOf(route.checkpoints.at(-1)) <= 0.5, `${label} finish checkpoint missing`);
  } else {
    invariant(Array.isArray(route.wowPoints) && route.wowPoints.length >= route.sectors.length,
      `${label} authored checkpoint landmarks missing`);
    let landmarkStation = -Infinity;
    for (const [index, landmark] of route.wowPoints.entries()) {
      const station = Number(landmark.chainage_km) * 1000;
      invariant(Number.isFinite(station) && station > landmarkStation && station <= routeLengthM + 0.5,
        `${label} landmark ${index} invalid`);
      landmarkStation = station;
    }
    invariant(routeLengthM - Number(route.wowPoints.at(-1).chainage_km) * 1000 <= 0.5,
      `${label} finish landmark missing`);
  }
  if (Array.isArray(route.respawns)) {
    invariant(route.respawns.length >= route.sectors.length, `${label} respawns missing`);
    for (const [index, respawn] of route.respawns.entries()) {
      const station = stationOf(respawn);
      invariant(Number.isFinite(station) && station >= 0 && station <= routeLengthM,
        `${label} respawn ${index} station invalid`);
      invariant(Number.isFinite(Number(respawn.lateralM)) && Math.abs(Number(respawn.lateralM)) <= 10,
        `${label} respawn ${index} lateral invalid`);
    }
  }
  return Object.freeze({ routeLengthM, sampleStepM, sampleCount: route.samples.length, sectorCount: route.sectors.length });
}

export function validateEnvironmentProfile(environment, manifest, label = manifest?.id || 'track') {
  invariant(environment?.schema === 'asfalto-environment-profile/v1', `${label} environment schema mismatch`);
  invariant(environment.trackId === manifest.id, `${label} environment track identity mismatch`);
  invariant(environment.defaultPreset === manifest.environment.defaultPreset, `${label} environment default mismatch`);
  invariant(Array.isArray(environment.allowedSurfaceStates) && environment.allowedSurfaceStates.length > 0,
    `${label} surface states missing`);
  const surfaceStates = new Set(environment.allowedSurfaceStates);
  invariant(surfaceStates.size === environment.allowedSurfaceStates.length
    && [...surfaceStates].every(value => typeof value === 'string' && value), `${label} surface states invalid`);
  const minimumTemperatureC = Number(environment.climateBounds?.minTemperatureC);
  const maximumTemperatureC = Number(environment.climateBounds?.maxTemperatureC);
  invariant(Number.isFinite(minimumTemperatureC) && Number.isFinite(maximumTemperatureC)
    && minimumTemperatureC >= -80 && maximumTemperatureC <= 80
    && minimumTemperatureC < maximumTemperatureC, `${label} climate bounds invalid`);
  invariant(environment.presets && typeof environment.presets === 'object'
    && JSON.stringify(Object.keys(environment.presets)) === JSON.stringify(EXPECTED_PRESETS),
  `${label} environment preset definitions mismatch`);
  for (const presetId of EXPECTED_PRESETS) {
    const preset = environment.presets[presetId];
    invariant(surfaceStates.has(preset.surfaceState), `${label} ${presetId} surface state invalid`);
    invariant(Number.isFinite(preset.temperatureC)
      && preset.temperatureC >= minimumTemperatureC && preset.temperatureC <= maximumTemperatureC,
    `${label} ${presetId} temperature outside climate bounds`);
    invariant(preset.precipitation == null || ['none', 'rain', 'storm', 'light-snow'].includes(preset.precipitation),
      `${label} ${presetId} precipitation invalid`);
  }
  return Object.freeze({ presets: EXPECTED_PRESETS.length, surfaceStates: surfaceStates.size });
}

async function validateSemanticContracts(root, manifestFiles) {
  const registryPath = path.join(root, 'tracks', 'registry.json');
  const registry = json(await readFile(registryPath), 'track registry');
  invariant(registry.schema === 'asfalto-track-registry/v1', 'track registry schema mismatch');
  invariant(Array.isArray(registry.tracks) && registry.tracks.length === EXPECTED_TRACKS.length, 'release must contain five tracks');
  invariant(new Set(registry.tracks.map(track => track.id)).size === EXPECTED_TRACKS.length, 'track ids must be unique');
  invariant(EXPECTED_TRACKS.every(id => registry.tracks.some(track => track.id === id && track.status === 'ready')), 'every circuit must be enabled');

  const inventorySet = new Set(manifestFiles.map(file => file.path));
  const trackSummary = [];
  for (const entry of registry.tracks) {
    safeRelative(entry.manifest, `${entry.id} manifest`);
    const relativeManifest = posix(path.join('tracks', safeRelative(entry.manifest, `${entry.id} manifest`)));
    invariant(inventorySet.has(relativeManifest), `${entry.id} manifest not inventoried`);
    const manifest = json(await readFile(path.join(root, ...relativeManifest.split('/'))), `${entry.id} manifest`);
    invariant(manifest.id === entry.id, `${entry.id} manifest identity mismatch`);
    invariant(Array.isArray(manifest.visual) && manifest.visual.length > 0, `${entry.id} visual assets missing`);
    invariant(Array.isArray(manifest.collision) && manifest.collision.length > 0, `${entry.id} collision assets missing`);
    invariant(manifest.environment?.defaultPreset === entry.defaultEnvironment, `${entry.id} registry environment default mismatch`);
    invariant(JSON.stringify(manifest.environment?.availablePresets) === JSON.stringify(EXPECTED_PRESETS), `${entry.id} environment presets mismatch`);
    const base = path.posix.dirname(relativeManifest);
    const referenced = [manifest.route, manifest.environment.profile, ...manifest.visual, ...manifest.collision];
    const glbSummaries = new Map();
    for (const reference of referenced) {
      const target = path.posix.normalize(path.posix.join(base, safeRelative(reference, `${entry.id} asset`)));
      invariant(target.startsWith(`${base}/`) && inventorySet.has(target), `${entry.id} missing release asset ${reference}`);
      if (/\.glb$/i.test(target)) {
        const bytes = await readFile(path.join(root, ...target.split('/')));
        glbSummaries.set(reference, inspectGlb(bytes, target));
      }
    }
    const routeRelative = path.posix.normalize(path.posix.join(base, safeRelative(manifest.route, `${entry.id} route`)));
    const routeBytes = await readFile(path.join(root, ...routeRelative.split('/')));
    const route = json(routeBytes, `${entry.id} route`);
    const routeSummary = validateRoute(route, manifest, entry.id, entry);
    const environmentRelative = path.posix.normalize(path.posix.join(base, safeRelative(manifest.environment.profile, `${entry.id} environment`)));
    const environment = json(await readFile(path.join(root, ...environmentRelative.split('/'))), `${entry.id} environment`);
    validateEnvironmentProfile(environment, manifest, entry.id);

    const routeLock = manifest.integrity?.route;
    invariant(routeLock?.bytes === routeBytes.byteLength
      && String(routeLock.sha256).toUpperCase() === sha256(routeBytes), `${entry.id} route integrity mismatch`);
    for (const role of ['visual', 'collision']) {
      const roleLocks = manifest.integrity?.[role];
      invariant(roleLocks && typeof roleLocks === 'object', `${entry.id} ${role} integrity missing`);
      invariant(JSON.stringify(Object.keys(roleLocks)) === JSON.stringify(manifest[role]),
        `${entry.id} ${role} integrity inventory mismatch`);
      for (const reference of manifest[role]) {
        const target = path.posix.normalize(path.posix.join(base, safeRelative(reference, `${entry.id} ${role}`)));
        const bytes = await readFile(path.join(root, ...target.split('/')));
        const lock = roleLocks[reference];
        invariant(lock?.bytes === bytes.byteLength
          && String(lock.sha256).toUpperCase() === sha256(bytes), `${entry.id} ${role} integrity mismatch: ${reference}`);
      }
    }

    const collisionNodeNames = manifest.collision.flatMap(reference => glbSummaries.get(reference)?.nodeNames || []);
    invariant(collisionNodeNames.some(name => /road|asphalt|pavement/i.test(name)),
      `${entry.id} collision road mesh missing`);
    if(entry.id==='cataratas_iguazu'){
      // Authored road and shoulder support, without fictional boundary walls.
      const summaries=manifest.collision.map(reference=>glbSummaries.get(reference));
      invariant(collisionNodeNames.filter(name=>/^COLLISION_ROAD_/.test(name)).length===64,'Iguazu road support contract mismatch');
      invariant(collisionNodeNames.filter(name=>/^COLLISION_SHOULDER_/.test(name)).length===80,'Iguazu shoulder support contract mismatch');
      let triangles=0;for(const {document:d}of summaries)for(const mesh of d.meshes)for(const primitive of mesh.primitives)triangles+=d.accessors[primitive.indices??primitive.attributes.POSITION].count/3;
      invariant(triangles===84848,'Iguazu source support triangles mismatch');
    }else{
      invariant(collisionNodeNames.some(name => /guardrail|barrier|track[_\-\s]?limit|wall/i.test(name))
        || entry.id === 'cuesta_lipan', entry.id+' collision boundary mesh missing');
    }
    for (const requiredName of manifest.collisionNodes || []) {
      invariant(collisionNodeNames.includes(requiredName), `${entry.id} collision node missing: ${requiredName}`);
    }
    invariant(manifest.collision.reduce((sum, reference) => sum + glbSummaries.get(reference).trianglePrimitives, 0) > 0,
      `${entry.id} collision coverage is empty`);

    if (entry.id === 'cuesta_lipan') {
      for (let index = 1; index <= entry.sectors; index += 1) {
        const sector = `S${String(index).padStart(2, '0')}`;
        invariant(manifest.visual.some(reference => reference.includes(`/sectors/${sector}/`) && /lod0\.glb$/i.test(reference)),
          `${entry.id} ${sector} streaming LOD0 missing`);
        invariant(manifest.collision.some(reference => reference.includes(`/sectors/${sector}/`) && /collision\.glb$/i.test(reference)),
          `${entry.id} ${sector} collision missing`);
      }
    }
    trackSummary.push({
      id: entry.id,
      lengthM: routeSummary.routeLengthM,
      defaultPreset: manifest.environment.defaultPreset,
      routeSamples: routeSummary.sampleCount,
      sectors: routeSummary.sectorCount,
      collisionPrimitives: manifest.collision.reduce(
        (sum, reference) => sum + glbSummaries.get(reference).trianglePrimitives,
        0,
      ),
    });
  }

  const catalog = json(await readFile(path.join(root, 'assets', 'skies', 'catalog.json')), 'sky catalog');
  invariant(JSON.stringify(catalog.presets?.map(item => item.id)) === JSON.stringify(EXPECTED_PRESETS), 'sky preset order mismatch');
  for (const preset of catalog.presets) {
    const [file, bytes, digest] = SKY_LOCKS[preset.id] || [];
    invariant(preset.file === file && preset.byteLength === bytes && preset.sha256 === digest, `sky lock mismatch: ${preset.id}`);
    const payload = await readFile(path.join(root, 'assets', 'skies', file));
    invariant(payload.byteLength === bytes && sha256(payload) === digest, `sky payload mismatch: ${preset.id}`);
    invariant(payload.subarray(0, 8).toString('ascii') === 'AV3HDRI1', `sky header mismatch: ${preset.id}`);
    invariant(payload.readUInt32LE(8) === 1024 && payload.readUInt32LE(12) === 512,
      `sky dimensions mismatch: ${preset.id}`);
    invariant(payload.byteLength === 16 + payload.readUInt32LE(8) * payload.readUInt32LE(12) * 3 * 2,
      `sky pixel payload mismatch: ${preset.id}`);
  }

  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/\b(?:src|href|data-external-url)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1];
    if (value.startsWith('#')) continue;
    if (/^data:image\//i.test(value)) continue;
    invariant(!/^(?:file:|blob:|data:|https?:|\/\/)/i.test(value), `persistent external URL is forbidden: ${value.slice(0, 80)}`);
    safeRelative(value, 'HTML asset URL');
  }
  invariant(!/<script[^>]+id=["']asfalto-v5-dos-lagos-(?:visual|collision)["'][^>]*>[^<]+/i.test(html), 'old embedded circuit payload detected');
  return { tracks: trackSummary, presets: EXPECTED_PRESETS };
}

export async function buildReleaseManifest(releaseRoot = DEFAULT_RELEASE_ROOT) {
  const root = await realpath(releaseRoot);
  const files = await inventory(root);
  const semantics = await validateSemanticContracts(root, files);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return {
    schema: 'asfalto-nacional-v7-modular-release/v1',
    schemaVersion: 2,
    builder: 'tools/validate_asfalto_v6_modular.mjs',
    entry: 'index.html',
    tracks: semantics.tracks,
    environmentPresets: semantics.presets,
    sourceLocks: { skies: Object.fromEntries(Object.entries(SKY_LOCKS).map(([id, [, bytes, digest]]) => [id, { bytes, sha256: digest }])) },
    files,
    fileCount: files.length,
    totalBytes,
    inventorySha256: sha256(Buffer.from(JSON.stringify(files))),
  };
}

export async function writeReleaseManifest(releaseRoot = DEFAULT_RELEASE_ROOT) {
  const manifest = await buildReleaseManifest(releaseRoot);
  const target = path.join(releaseRoot, ...RELEASE_MANIFEST_RELATIVE.split('/'));
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, target);
  return manifest;
}
