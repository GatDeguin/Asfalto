import {collectRayGeometry} from './ray-geometry.mjs?v=47261d3fc43d50df';
import {createRayTracedOcclusion} from './ray-traced-occlusion.mjs?v=bce6dfbce11d570c';
import {createGpuProbeTracer} from './gpu-probe-tracer.mjs?v=26bd71466f666214';
import {packProbeProxies, placeProbeGrid, PROBE_PRESETS} from './probe-radiance-input.mjs?v=83e589831e106c72';
import {createProbeMaterialBridge} from './probe-radiance-materials.mjs?v=d7845f767a27abe5';

const workerUrl = new URL('./ray-bvh-worker.mjs?v=29067d610afcb095', import.meta.url);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function buildProbeBvh(vertices, colors, signal) {
  signal.throwIfAborted();
  const worker = new Worker(workerUrl, {type: 'module', name: 'asfalto-probe-bvh'});
  return new Promise((resolve, reject) => {
    let settled = false;
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    }
    const abort = () => finish(signal.reason);
    const timeout = setTimeout(() => finish(new Error('Tiempo agotado al preparar el BVH de iluminación.')), 8000);
    signal.addEventListener('abort', abort, {once: true});
    worker.onmessage = ({data}) => finish(data.error ? new Error(data.error) : null, data);
    worker.onmessageerror = () => finish(new Error('No se pudo leer el BVH de iluminación.'));
    worker.onerror = event => {
      event.preventDefault();
      finish(new Error(event.message || 'No se pudo preparar el BVH de iluminación.'));
    };
    try { worker.postMessage({id: 1, vertices, colors}, [vertices.buffer, colors.buffer]); }
    catch (error) { finish(error); }
  });
}

export function createRaceProbeLighting({
  THREE: T, renderer, scene, camera, excludeRoots, excludeOccluders, allowCompute = true,
  getLighting, getFixedProxies, getTraffic, onMaterialsChanged = () => {},
}) {
  const fallback = createRayTracedOcclusion({THREE: T, renderer, scene, camera, excludeRoots, excludeOccluders});
  const bridge = createProbeMaterialBridge(T);
  const supported = allowCompute && !!globalThis.navigator?.gpu && typeof globalThis.Worker === 'function'
    && renderer.capabilities.isWebGL2 && renderer.capabilities.maxTextures >= 16 && typeof T.Data3DTexture === 'function';
  const proxyCenter = new T.Vector3(), orientation = new T.Quaternion(), color = new T.Color();
  let requested = 'off', status = 'off', reason = supported ? null : 'WebGPU compute no disponible.';
  let device = null, initializing = false, deviceEpoch = 0, generation = 0, build = null, snapshot = null;
  let sceneKey = null, sceneRevision = -1, lastInputs = '', lastDispatch = -Infinity, disposed = false, contextLost = false;
  let latestPosition = null, dynamicCount = 0, proxyCount = 0, headlightCount = 0, rebuilds = 0, updates = 0, lastGpuMs = null;
  let lastTurnaroundMs = null, collectMs = null, buildMs = null, lastGeometryUpload = null;

  function clearField() {
    const hadMaterials = bridge.diagnostics().materialCount > 0;
    bridge.clear();
    if (hadMaterials) onMaterialsChanged();
  }

  function resetGeometry(removeReceivers = false) {
    generation++;
    build?.abort();
    build = null; snapshot = null; lastInputs = ''; lastGeometryUpload = null;
    dynamicCount = proxyCount = headlightCount = 0;
    if (removeReceivers) clearField();
    else bridge.invalidate();
  }

  function release() {
    deviceEpoch++;
    initializing = false;
    device?.dispose();
    device = null;
    resetGeometry(true);
    sceneKey = null; sceneRevision = -1;
  }

  function fail(error) {
    reason = String(error?.message || error);
    release();
    status = 'fallback';
  }

  function ensureDevice() {
    if (initializing || device) return;
    initializing = true;
    const epoch = deviceEpoch;
    void createGpuProbeTracer().then(tracer => {
      if (epoch !== deviceEpoch) { tracer?.dispose(); return; }
      if (!tracer) { fail('No hay adaptador WebGPU físico.'); return; }
      device = tracer;
      initializing = false;
    }).catch(error => { if (epoch === deviceEpoch) fail(error); });
  }

  async function rebuild(context, preset, desiredCenter) {
    const controller = new AbortController();
    const token = generation;
    build = controller;
    const started = performance.now();
    try {
      const center = new T.Vector3().fromArray(desiredCenter);
      const geometry = await collectRayGeometry(T, context.geometryRoot, center, {
        radius: preset.radius, maxTriangles: preset.triangles, surfaceColors: true, signal: controller.signal,
      });
      const collected = performance.now() - started;
      const bvh = await buildProbeBvh(geometry.vertices, geometry.colors, controller.signal);
      if (token !== generation) return;
      const origin = geometry.origin.toArray();
      if (distance(origin, latestPosition) > preset.radius * .55) return;
      snapshot = {bvh, origin, budgetReached: geometry.budgetReached};
      lastInputs = '';
      collectMs = collected;
      buildMs = bvh.buildMs;
      rebuilds++;
    } catch (error) {
      if (token === generation && !controller.signal.aborted) fail(error);
    } finally {
      if (build === controller) build = null;
    }
  }

  function trafficProxies() {
    const proxies = [];
    for (const pose of getTraffic()) {
      if (!pose.hull || !pose.car?.color) continue;
      orientation.fromArray(pose.rotation);
      proxyCenter.fromArray(pose.hull.center).applyQuaternion(orientation);
      proxyCenter.x += pose.position[0]; proxyCenter.y += pose.position[1]; proxyCenter.z += pose.position[2];
      proxies.push({center: proxyCenter.toArray(), halfExtent: pose.hull.halfExtents, rotation: pose.rotation,
        color: color.set(pose.car.color).toArray()});
    }
    return proxies;
  }

  function dispatch(context, preset, now) {
    const local = snapshot, tracer = device, token = generation;
    const grid = placeProbeGrid(context.position, preset);
    const lighting = getLighting();
    const proxies = packProbeProxies({dynamic: trafficProxies(), fixed: getFixedProxies()}, local.origin, preset.radius);
    const headlights = lighting.headlights.flatMap(spot =>
      [...spot.position, ...spot.direction, ...spot.color, spot.range, spot.inner, spot.outer, spot.intensity, spot.decay]);
    const inputs = [grid.origin, lighting.direction, lighting.intensity, lighting.color, lighting.sky, lighting.ground,
      ...headlights, ...proxies.data.subarray(0, proxies.count * 16)].flat().map(value => Math.round(value * 160)).join(',');
    lastDispatch = now;
    if (inputs === lastInputs) return;
    lastInputs = inputs;
    void tracer.trace({bvh: local.bvh, center: local.origin, grid, preset, proxies, lighting}).then(result => {
      if (token !== generation || local !== snapshot) return;
      if (lastGeometryUpload !== generation) {
        if (bridge.setReceivers(context.receivers)) onMaterialsChanged();
        lastGeometryUpload = generation;
      }
      bridge.publish(grid, preset.size, result.data);
      lastGpuMs = result.gpuMs; lastTurnaroundMs = result.turnaroundMs;
      dynamicCount = proxies.dynamicCount; proxyCount = proxies.count;
      headlightCount = lighting.headlights.length;
      updates++; status = 'compute-active';
    }).catch(error => { if (token === generation) fail(error); });
  }

  function setMode(mode) {
    if (disposed || mode !== 'off' && !Object.hasOwn(PROBE_PRESETS, mode)) return false;
    if (requested === mode) return true;
    requested = mode;
    fallback.setMode('off');
    if (mode === 'off') release();
    else resetGeometry();
    reason = supported ? null : 'WebGPU compute no disponible.';
    status = mode === 'off' ? 'off' : 'preparing';
    return true;
  }

  function update(context) {
    if (disposed || contextLost || requested === 'off' || !context.active) return;
    if (reason) {
      status = 'fallback';
      fallback.setMode(requested);
      fallback.update(context);
      return;
    }
    if (!context.geometryRoot || !context.position) return;
    if (sceneKey !== context.sceneKey || sceneRevision !== context.revision) {
      resetGeometry(sceneKey !== context.sceneKey);
      sceneKey = context.sceneKey;
      sceneRevision = context.revision;
      status = 'preparing';
    }
    ensureDevice();
    if (!device) return;
    if (device.diagnostics().error) { fail(device.diagnostics().error); return; }
    const preset = PROBE_PRESETS[requested], now = performance.now();
    latestPosition = context.position;
    const moved = snapshot ? distance(snapshot.origin, latestPosition) : Infinity;
    if (moved > preset.radius * .55 && snapshot) resetGeometry();
    const velocity = context.velocity;
    const speed = velocity?.length === 3 ? Math.hypot(...velocity) : 0;
    const anticipation = speed > 1 ? Math.min(.55, preset.radius * .37 / speed) : 0;
    const desired = anticipation ? latestPosition.map((coordinate, axis) => coordinate + velocity[axis] * anticipation) : latestPosition;
    if (!build && (!snapshot || distance(snapshot.origin, desired) > preset.spacing * .9)) void rebuild(context, preset, desired);
    if (snapshot && !device.diagnostics().pending && now - lastDispatch >= preset.intervalMs) dispatch(context, preset, now);
  }

  function suspend() {
    fallback.setMode('off');
    release();
    status = requested === 'off' ? 'off' : 'suspended';
  }
  function lost() { suspend(); contextLost = true; status = 'context-lost'; }
  function restored() { contextLost = false; status = requested === 'off' ? 'off' : 'preparing'; }
  renderer.domElement?.addEventListener('webglcontextlost', lost);
  renderer.domElement?.addEventListener('webglcontextrestored', restored);

  return {
    setMode, update, suspend,
    invalidate() { resetGeometry(); fallback.invalidate(); status = requested === 'off' ? 'off' : 'preparing'; },
    diagnostics() {
      const gpu = device?.diagnostics();
      const probes = {...bridge.diagnostics(), updates, rebuilds, collectMs, buildMs, lastGpuMs, lastTurnaroundMs,
        proxyCount, dynamicCount, headlightCount, gridSize: PROBE_PRESETS[requested]?.size ?? null,
        triangles: snapshot?.bvh.triangleCount || 0, budgetReached: snapshot?.budgetReached || false,
        nodeCount: snapshot?.bvh.nodeCount || 0, bufferBytes: gpu?.bufferBytes || 0,
        pending: !!(initializing || build || gpu?.pending), timestampQuery: gpu?.timestampQuery ?? false, adapter: gpu?.adapter ?? null};
      if (reason && !['off', 'suspended', 'disposed', 'context-lost'].includes(status)) {
        return {...fallback.diagnostics(), requested, backend: 'webgl2-ao', computeFallbackReason: reason, probes};
      }
      return {requested, status, supported, hardwareRT: false, gpuRayTraversal: !!device,
        reflectionsRT: false, reflections: status === 'compute-active' ? 'local-directional-probes' : null,
        backend: device ? 'webgpu-compute' : 'webgl2', probes};
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      status = 'disposed';
      fallback.dispose();
      renderer.domElement?.removeEventListener('webglcontextlost', lost);
      renderer.domElement?.removeEventListener('webglcontextrestored', restored);
    },
  };
}
