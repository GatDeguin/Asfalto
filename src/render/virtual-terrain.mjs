import {readExternalPayload} from '../runtime/asset-core.mjs?v=d795faf208f60d96';
import {assetDecodePool, AssetWorkerError} from '../runtime/asset-decode-pool.mjs?v=1be266bf7b1e2d93';
import {inflateBrowserGzip} from '../runtime/gzip-kernel.mjs?v=7cef6073fc46cbf3';
import {GARIBALDI_TERRAIN_MANIFEST, selectTerrainDetail, TERRAIN_DETAIL_SLOTS, TRIANGLE_BYTES, validateTerrainManifest}
  from './virtual-terrain-data.mjs?v=09bc75160261c900';
import {createTerrainResidency} from './virtual-terrain-residency.mjs?v=497442d1b9bbf4b7';

const PATH = new URL('../../assets/tracks/virtual-terrain/garibaldi/', import.meta.url);
const VISTA_NAME = 'TERRAIN_VISTA_WEB_MESH_Primitive_0';
const VISTA_OBJECT_ID = 1;

function readBytes({file, bytes, sha256}, signal) {
  return readExternalPayload({dataset: {externalUrl: new URL(file, PATH).href, bytes, sha256: sha256.toUpperCase()}},
    (url, options) => fetch(url, {...options, signal}));
}

async function readPage(payload, signal) {
  const bytes = await readBytes(payload, signal);
  const size = payload.decodedBytes;
  let buffer;
  try {
    ({buffer} = await assetDecodePool.run('gzip', {bytes, size}, {signal}));
  } catch (error) {
    signal.throwIfAborted();
    if (!(error instanceof AssetWorkerError)) throw error;
    buffer = await inflateBrowserGzip(bytes, size, signal);
  }
  signal.throwIfAborted();
  if (buffer.byteLength !== size) throw new Error('Tamaño de página de terreno incorrecto.');
  return new Float32Array(buffer);
}

export function createRaceVirtualTerrain({THREE, renderer, scene, camera, lighting = null}) {
  const rawRenderer = renderer.__rawRenderer || renderer;
  const viewProjection = new THREE.Matrix4();
  const mvp = new THREE.Matrix4();
  const viewport = new THREE.Vector4();
  const frustum = new THREE.Frustum();
  const surfaceFrame = {camera, frustum};
  const worldScale = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  let session = null;
  let disposed = false;
  let enabled = false;
  let surfacesRequested = false;
  let desiredPanorama = null;
  let status = 'off';
  let lastError = null;

  function release(entry) {
    entry.abort.abort();
    entry.residency?.dispose();
    entry.composite?.dispose();
    entry.surfaceComposite?.dispose();
    entry.atlas?.dispose();
    entry.raster?.dispose();
    entry.surfaces?.dispose();
    entry.device?.destroy();
    entry.surfaceActive = false;
    entry.residency = entry.composite = entry.surfaceComposite = entry.atlas = entry.raster = entry.surfaces = entry.device = null;
  }

  function suspend() {
    const previous = session;
    session = null;
    desiredPanorama = null;
    if (previous) release(previous);
    status = enabled ? 'suspended' : 'off';
  }

  function fail(entry, error, next = 'error') {
    if (session !== entry || entry.abort.signal.aborted) return;
    lastError = String(error?.message || error);
    status = next;
    release(entry);
  }

  async function prepareSurfaces(entry, device, signal) {
    const {createVirtualTerrainSurfaces} = await import('./virtual-terrain-surface.mjs?v=51250a3d4d356a8c');
    signal.throwIfAborted();
    let surfaces = null, failure = null;
    device.pushErrorScope('validation');
    try {
      surfaces = await createVirtualTerrainSurfaces(THREE, device, entry.root, entry.source, lighting, signal);
    } catch (error) {
      failure = error;
    }
    const validation = await device.popErrorScope().catch(error => error);
    if (signal.aborted || validation || failure) {
      surfaces?.dispose();
      signal.throwIfAborted();
      throw failure || validation;
    }
    return surfaces;
  }

  async function prepare(entry) {
    const {source, abort: {signal}} = entry;
    const adapter = await navigator.gpu?.requestAdapter({powerPreference: 'high-performance'});
    signal.throwIfAborted();
    if (!adapter || adapter.info?.isFallbackAdapter) {
      fail(entry, 'Adaptador WebGPU de hardware no disponible.', 'unsupported');
      return;
    }
    const [bytes, {createVirtualTerrainRaster},
      {createVirtualTerrainAtlas, createVirtualTerrainComposite, createVirtualTerrainSurfaceComposite}] = await Promise.all([
      readBytes(GARIBALDI_TERRAIN_MANIFEST, signal),
      import('./virtual-terrain-gpu.mjs?v=205571945c1d8e88'),
      import('./virtual-terrain-composite.mjs?v=1f674a88819b63b9'),
    ]);
    const manifest = validateTerrainManifest(JSON.parse(new TextDecoder().decode(bytes)));
    signal.throwIfAborted();
    if (source.geometry.userData.asfaltoBakeKey !== manifest.source || source.geometry.index?.count !== manifest.triangles * 3) {
      throw new Error('La geometría original no coincide con las páginas virtuales.');
    }
    const root = await readPage(manifest.root, signal);
    signal.throwIfAborted();
    const requiredFeatures = adapter.features.has('timestamp-query') ? ['timestamp-query'] : [];
    if (surfacesRequested && adapter.features.has('primitive-index')) requiredFeatures.push('primitive-index');
    const device = await adapter.requestDevice({requiredFeatures});
    if (signal.aborted) {
      device.destroy();
      return;
    }
    entry.device = device;
    device.addEventListener('uncapturederror', ({error}) => fail(entry, error));
    void device.lost.then(info => fail(entry, info.message || 'Se perdió el dispositivo WebGPU.'));
    const canvas = document.createElement('canvas');
    const slots = manifest.pages.length + TERRAIN_DETAIL_SLOTS;
    if (entry.surfacePanorama) {
      try {
        entry.surfaces = await prepareSurfaces(entry, device, signal);
      } catch (error) {
        signal.throwIfAborted();
        entry.surfaceError = String(error?.message || error);
      }
    }
    const raster = await createVirtualTerrainRaster(device, {
      canvas, slots, doubleSided: source.material.side === THREE.DoubleSide, surfaces: entry.surfaces,
    });
    if (signal.aborted) {
      raster.dispose();
      return;
    }
    entry.raster = raster;
    const atlas = entry.atlas = createVirtualTerrainAtlas(THREE, slots);
    const upload = (slot, vertices) => {
      raster.upload(slot, vertices);
      atlas.upload(slot, vertices);
    };
    for (const page of manifest.pages) {
      const first = page.coarseStart * TRIANGLE_BYTES / 4;
      upload(page.id, root.subarray(first, first + page.coarseCount * TRIANGLE_BYTES / 4));
    }
    entry.pages = manifest.pages.map(page => ({...page, box: new THREE.Box3(
      new THREE.Vector3(...page.bounds.slice(0, 3)), new THREE.Vector3(...page.bounds.slice(3)))}));
    entry.originalTriangles = manifest.triangles;
    entry.coarseTriangles = root.byteLength / TRIANGLE_BYTES;
    entry.residency = createTerrainResidency({pages: entry.pages,
      load: (page, signal) => readPage(page.detail, signal),
      upload,
    });
    entry.composite = createVirtualTerrainComposite(THREE, source, canvas, {atlas, objectId: VISTA_OBJECT_ID});
    scene.add(entry.composite.mesh);
    if (entry.surfaces) {
      entry.surfaceComposite = createVirtualTerrainSurfaceComposite(THREE, canvas);
      scene.add(entry.surfaceComposite.mesh);
    }
    status = 'ready';
  }

  function sync(adapter, active) {
    if (disposed || !enabled || !active) return;
    const root = adapter?.visualRoot;
    const panorama = surfacesRequested && lighting?.available() ? lighting.skyTexture() : null;
    desiredPanorama = panorama;
    if (root && root === session?.root && (session.incompatible || !panorama || panorama === session.surfacePanorama)) return;
    suspend();
    desiredPanorama = panorama;
    if (!root) { status = 'track'; return; }
    const source = root.getObjectByName(VISTA_NAME);
    if (!source?.isMesh || !source.geometry.userData.asfaltoBakeKey || !source.material?.isMeshStandardMaterial ||
      !source.material.map || source.material.transparent || ![THREE.FrontSide, THREE.DoubleSide].includes(source.material.side)) {
      status = 'track';
      // Remember an unsupported root to avoid searching it every frame.
      session = {root, incompatible: true, abort: new AbortController()};
      return;
    }
    lastError = null;
    status = 'preparing';
    const entry = {root, source, surfacePanorama: panorama, abort: new AbortController(), previousDetail: new Set(), frames: 0};
    session = entry;
    void prepare(entry).catch(error => fail(entry, error));
  }

  function select(entry, height) {
    mvp.multiplyMatrices(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), entry.source.matrixWorld);
    frustum.setFromProjectionMatrix(mvp);
    worldScale.setFromMatrixScale(entry.source.matrixWorld);
    const scale = Math.max(worldScale.x, worldScale.y, worldScale.z);
    cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    const projected = height * .5 * Math.abs(camera.projectionMatrix.elements[5]) * scale;
    const visible = [];
    for (const page of entry.pages) {
      if (!frustum.intersectsBox(page.box)) continue;
      const distance = Math.max(camera.near, page.worldBox.distanceToPoint(cameraPosition));
      visible.push({page, pixels: page.errorM * projected / distance});
    }
    const ids = selectTerrainDetail(visible, entry.previousDetail);
    entry.previousDetail = new Set(ids);
    entry.residency.select(ids);
    let triangles = 0;
    let detail = 0;
    const selected = visible.map(({page}) => {
      const fineSlot = entry.residency.slotFor(page.id);
      const count = fineSlot === undefined ? page.coarseCount : page.fineCount;
      triangles += count;
      detail += Number(fineSlot !== undefined);
      return {slot: fineSlot ?? page.id, triangles: count, objectId: VISTA_OBJECT_ID};
    });
    entry.visible = {pages: selected.length, detail, triangles};
    return selected;
  }

  function render(draw) {
    const entry = session;
    if (!entry?.composite || !entry.source.visible || !camera.isPerspectiveCamera || renderer.getContext().isContextLost()) return draw();
    let composite;
    let useSurfaces = false;
    try {
      renderer.getCurrentViewport(viewport);
      if (!entry.raster.fits(viewport.z, viewport.w) || Math.max(viewport.z, viewport.w) > renderer.capabilities.maxTextureSize) {
        if (status !== 'viewport') {
          entry.raster.releaseViewport();
          entry.composite.releaseViewport();
          entry.surfaceComposite?.releaseViewport();
        }
        status = 'viewport';
        entry.surfaceActive = false;
        entry.residency.select([]);
        return draw();
      }
      if (!entry.matrix?.equals(entry.source.matrixWorld)) {
        entry.matrix = entry.source.matrixWorld.clone();
        for (const page of entry.pages) page.worldBox = page.box.clone().applyMatrix4(entry.matrix);
      }
      const selected = select(entry, viewport.w);
      useSurfaces = Boolean(entry.surfaceComposite && desiredPanorama && desiredPanorama === entry.surfacePanorama && entry.surfaces.compatible() &&
        Math.abs(camera.projectionMatrixInverse.elements[2]) < 1e-7 && Math.abs(camera.projectionMatrixInverse.elements[6]) < 1e-7 &&
        entry.raster.fits(viewport.z, viewport.w, true) && viewport.z * 2 <= renderer.capabilities.maxTextureSize);
      if (!entry.raster.submit(selected, mvp.elements, camera.far, viewport.z, viewport.w, performance.now(),
        useSurfaces ? surfaceFrame : null)) {
        entry.surfaceActive = false;
        status = 'ready';
        return draw();
      }
      composite = useSurfaces ? entry.surfaceComposite : entry.composite;
      if (entry.surfaceActive !== useSurfaces) {
        (useSurfaces ? entry.composite : entry.surfaceComposite)?.releaseViewport();
      }
      composite.update(camera, viewport);
    } catch (error) {
      fail(entry, error);
      return draw();
    }
    const target = rawRenderer.getRenderTarget();
    const drawBuffer = rawRenderer.renderBufferDirect;
    // The same camera can reuse the already resolved surfaces in Three's
    // full-size transmission capture. Mirrors and water have their own cameras.
    rawRenderer.renderBufferDirect = function (passCamera, passScene, geometry, material, object, group) {
      const source = useSurfaces ? entry.surfaces.includes(object) : object === entry.source;
      if (source || object === composite.mesh) {
        const current = rawRenderer.getRenderTarget();
        const transmission = useSurfaces && current && current !== target &&
          current.texture.generateMipmaps && current.texture.type === THREE.HalfFloatType &&
          current.texture.colorSpace === THREE.LinearSRGBColorSpace && current.samples === 4 &&
          current.width === viewport.z && current.height === viewport.w && viewport.x === 0 && viewport.y === 0;
        const replaced = passCamera === camera && passScene === scene && (current === target || transmission);
        if (replaced === source) return;
      }
      return drawBuffer.call(this, passCamera, passScene, geometry, material, object, group);
    };
    composite.mesh.visible = true;
    try {
      draw();
    } finally {
      composite.mesh.visible = false;
      rawRenderer.renderBufferDirect = drawBuffer;
    }
    const program = renderer.properties.get(composite.mesh.material).currentProgram;
    if (program?.diagnostics?.runnable === false) {
      fail(entry, 'No se pudo componer el terreno virtualizado en WebGL.');
      return draw();
    }
    entry.frames++;
    entry.surfaceActive = useSurfaces;
    status = 'active';
  }

  return {
    sync, render, suspend,
    setEnabled(value) {
      if (Boolean(value) === enabled || disposed) return;
      enabled = Boolean(value);
      lastError = null;
      suspend();
    },
    setSurfaces(value) {
      if (Boolean(value) === surfacesRequested || disposed) return;
      surfacesRequested = Boolean(value);
      if (enabled) suspend();
    },
    getSurfaceStatus: () => session?.surfaceActive ? 'active' :
      session?.surfaceError ? 'error' : surfacesRequested ? 'fallback' : 'off',
    getStatus: () => status,
    diagnostics: () => ({enabled, status, lastError, frames: session?.frames || 0,
      originalTriangles: session?.originalTriangles || 0, coarseTriangles: session?.coarseTriangles || 0,
      attributeBytes: session?.atlas?.bytes || 0,
      surfaces: {requested: surfacesRequested, active: Boolean(session?.surfaceActive), error: session?.surfaceError || null,
        resources: session?.surfaces?.diagnostics() || null},
      visible: session?.visible || null, residency: session?.residency?.diagnostics() || null,
      gpu: session?.raster?.diagnostics() || null}),
    dispose() { disposed = true; enabled = false; suspend(); },
  };
}

export function installVirtualTerrainSettings(controller, vehicleId, {root = document,
  storage = globalThis.__asfaltoV7Storage} = {}) {
  const switches = [...root.querySelectorAll('[data-virtual-terrain-toggle]')];
  const surfaceSwitches = [...root.querySelectorAll('[data-webgpu-surface-toggle]')];
  const statuses = [...root.querySelectorAll('[data-virtual-terrain-status]')];
  const storageKey = () => `asfalto:nacional:v6:virtual-terrain:${vehicleId || 'default'}`;
  const surfaceKey = () => storageKey() + ':surfaces';
  const labels = {
    off: 'Desactivada',
    suspended: 'Disponible al conducir en Paso Garibaldi',
    track: 'Disponible en Paso Garibaldi',
    preparing: 'Preparando páginas de terreno…',
    ready: 'Lista · esperando terreno visible',
    active: 'Activa · relieve lejano de Paso Garibaldi',
    viewport: 'Terreno estándar · resolución fuera del presupuesto WebGPU',
    unsupported: 'Terreno estándar · WebGPU no disponible',
    error: 'Terreno estándar · el rasterizador virtual no está disponible',
  };
  let last = '';
  function refresh() {
    const status = controller.getStatus();
    const surfaces = controller.getSurfaceStatus();
    const label = status === 'active' && surfaces === 'active' ? 'Activa · calzada y terreno en WebGPU' :
      status === 'active' && surfaces !== 'off' ? 'Relieve lejano · respaldo de superficies WebGPU' : labels[status];
    if (label === last) return;
    last = label;
    for (const status of statuses) status.textContent = label;
  }
  function setEnabled(value, persist = true) {
    const enabled = Boolean(value);
    controller.setEnabled(enabled);
    if (persist) try { storage?.setItem(storageKey(), enabled ? '1' : '0'); } catch {}
    for (const input of switches) input.checked = enabled;
    for (const input of surfaceSwitches) input.disabled = !enabled;
    refresh();
  }
  function setSurfaces(value, persist = true) {
    const selected = Boolean(value);
    controller.setSurfaces(selected);
    if (persist) try { storage?.setItem(surfaceKey(), selected ? '1' : '0'); } catch {}
    for (const input of surfaceSwitches) input.checked = selected;
    refresh();
  }
  function read() {
    let value = false, surfaces = false;
    try {
      value = storage?.getItem(storageKey()) === '1';
      surfaces = storage?.getItem(surfaceKey()) === '1';
    } catch {}
    setSurfaces(surfaces, false);
    setEnabled(value, false);
  }
  const change = ({target}) => setEnabled(target.checked);
  const changeSurfaces = ({target}) => setSurfaces(target.checked);
  for (const input of switches) input.addEventListener('change', change);
  for (const input of surfaceSwitches) input.addEventListener('change', changeSurfaces);
  read();
  return {
    refresh, setEnabled,
    setVehicle(id) { if (id !== vehicleId) { vehicleId = id; read(); } },
    dispose() {
      for (const input of switches) input.removeEventListener('change', change);
      for (const input of surfaceSwitches) input.removeEventListener('change', changeSurfaces);
    },
  };
}
