import { interpolateVehicleSnapshot } from '../game/physical-render-bridge.mjs';

const QUALITY = Object.freeze({
  high: { center: [512, 144, 24], left: [256, 192, 18] },
  balanced: { center: [384, 108, 15], left: [192, 144, 12] },
  low: { center: [256, 72, 8], left: [128, 96, 6] },
});

function chassisFrom(value) {
  if (value?.currentSnapshot) return interpolateVehicleSnapshot(value.previousSnapshot || value.currentSnapshot, value.currentSnapshot, value.alpha ?? 1)?.chassis;
  return value?.chassis || value;
}

// The physical vehicle's local axes are forward +X, up +Y, right +Z.
// These capture anchors are independent of the editable interior presentation mounts.
export function mirrorCameraPoses(THREE, carPose) {
  const chassis = chassisFrom(carPose);
  if (!Array.isArray(chassis?.position) || chassis.position.length < 3 || !chassis.position.every(Number.isFinite)) return null;
  const rotation = chassis.rotation || [0, 0, 0, 1];
  if (!Array.isArray(rotation) || rotation.length !== 4 || !rotation.every(Number.isFinite)) return null;
  const origin = new THREE.Vector3().fromArray(chassis.position);
  const quaternion = new THREE.Quaternion().fromArray(rotation).normalize();
  const point = value => new THREE.Vector3().fromArray(value).applyQuaternion(quaternion).add(origin).toArray();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).toArray();
  return {
    center: { position: point([.05, .55, 0]), look: point([-22, .53, 0]), up },
    left: { position: point([.55, .58, -1.02]), look: point([-18, .42, -4.8]), up },
  };
}

function roundedShape(THREE, width, height, radius) {
  const shape = new THREE.Shape(), x = -width / 2, y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  shape.moveTo(x + r, y); shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r); shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function mirrorGlass(THREE, width, height, radius, material) {
  const geometry = new THREE.ShapeGeometry(roundedShape(THREE, width, height, radius), 12);
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setXY(i, 1 - (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Reflective glass';
  return mesh;
}

function roundedBody(THREE, width, height, radius, depth, material, name) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(THREE, width, height, radius), {
    depth, steps: 1, curveSegments: 8, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
  return mesh;
}

function stem(THREE, from, to, radius, material, name) {
  const a = new THREE.Vector3().fromArray(from), b = new THREE.Vector3().fromArray(to), direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); mesh.name = name;
  return mesh;
}

export function createCockpitMirrors({ THREE, cockpitRoot = null, excludeRoots = () => [], quality = 'balanced' } = {}) {
  if (!THREE?.WebGLRenderTarget || !THREE?.ExtrudeGeometry) throw new TypeError('Three.js is required for cockpit mirrors');
  const chrome = new THREE.MeshStandardMaterial({ name: 'Mirror polished chrome', color: '#d9dddf', metalness: .94, roughness: .2, envMapIntensity: 1.05 });
  const gasket = new THREE.MeshStandardMaterial({ name: 'Mirror dark rubber gasket', color: '#101214', metalness: .05, roughness: .82 });
  const back = new THREE.MeshStandardMaterial({ name: 'Interior mirror back', color: '#242628', metalness: .32, roughness: .5 });
  const mounts = { center: new THREE.Group(), left: new THREE.Group() };
  mounts.center.name = 'rearview-mirror'; mounts.center.position.set(0, 1.22, 1.18); mounts.center.rotation.x = -.055;
  mounts.left.name = 'left-door-mirror'; mounts.left.position.set(-1.13, .68, 1.05); mounts.left.rotation.y = .24;
  const feeds = {};
  for (const id of ['center', 'left']) {
    const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false, samples: 0 });
    target.texture.name = id === 'center' ? 'Interior mirror live view' : 'Left door mirror live view';
    target.texture.colorSpace = THREE.SRGBColorSpace; target.texture.generateMipmaps = false;
    const glassMaterial = new THREE.MeshBasicMaterial({ name: target.texture.name + ' glass', map: target.texture, color: '#dce9eb', toneMapped: false, fog: false, depthTest: true, depthWrite: true, side: THREE.FrontSide });
    const isCenter = id === 'center';
    const glass = mirrorGlass(THREE, isCenter ? .466 : .23, isCenter ? .13125 : .1725, isCenter ? .023 : .082, glassMaterial);
    // Extruded seals include a .004 m bevel beyond their cap. Keep the
    // reflective face in front of it; otherwise depth testing hides the feed.
    glass.position.z = isCenter ? .034 : .041;
    const camera = new THREE.PerspectiveCamera(35, 1, .08, 2200); camera.name = id === 'center' ? 'Interior rear-facing capture camera' : 'Left rear-quarter capture camera';
    feeds[id] = { target, camera, glass, lastRenderMs: -Infinity, frames: 0 };
    const shell = roundedBody(THREE, isCenter ? .5 : .258, isCenter ? .162 : .198, isCenter ? .035 : .094, isCenter ? .034 : .05, chrome, 'Chrome mirror shell');
    mounts[id].add(shell);
    const rubber = roundedBody(THREE, isCenter ? .478 : .24, isCenter ? .144 : .183, isCenter ? .029 : .086, .006, gasket, 'Glass perimeter seal'); rubber.position.z = isCenter ? .021 : .028;
    mounts[id].add(rubber, glass);
  }
  const rearHousing = roundedBody(THREE, .47, .135, .029, .026, back, 'Interior rear housing'); rearHousing.position.z = -.027; mounts.center.add(rearHousing);
  mounts.center.add(stem(THREE, [0, .066, -.019], [0, .165, -.047], .009, chrome, 'Windshield mirror support'));
  const headerPlate = roundedBody(THREE, .082, .034, .012, .014, chrome, 'Windshield support foot'); headerPlate.position.set(0, .17, -.048); mounts.center.add(headerPlate);
  const doorPlate = roundedBody(THREE, .12, .034, .015, .048, chrome, 'Door mounting foot'); doorPlate.position.set(.025, -.18, -.06); doorPlate.rotation.x = -.55; mounts.left.add(doorPlate);
  mounts.left.add(stem(THREE, [.025, -.16, -.055], [-.008, -.082, -.047], .011, chrome, 'Bent door support lower'));
  mounts.left.add(stem(THREE, [-.008, -.082, -.047], [0, -.012, -.034], .009, chrome, 'Door mirror support upper'));
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(.023, 12, 8), chrome); pivot.name = 'Door mirror adjustment ball'; pivot.position.set(0, -.012, -.033); mounts.left.add(pivot);
  for (const mount of Object.values(mounts)) mount.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = false; } });

  let currentQuality = null, disposed = false, rendering = false, feedsEnabled = true;
  const priorViewport = new THREE.Vector4(), priorScissor = new THREE.Vector4(), priorClearColor = new THREE.Color();
  function setQuality(value) {
    const next = Object.hasOwn(QUALITY, value) ? value : 'balanced';
    if (next === currentQuality) return;
    currentQuality = next;
    for (const id of ['center', 'left']) {
      const [width, height] = QUALITY[next][id], feed = feeds[id];
      feed.target.setSize(width, height); feed.camera.aspect = width / height;
      const horizontalFov = id === 'center' ? 62 : 70;
      feed.camera.fov = 2 * Math.atan(Math.tan(horizontalFov * Math.PI / 360) / feed.camera.aspect) * 180 / Math.PI;
      feed.camera.updateProjectionMatrix(); feed.lastRenderMs = -Infinity;
    }
  }
  function setEnabled(enabled) {
    if (enabled === feedsEnabled) return;
    feedsEnabled = enabled;
    for (const feed of Object.values(feeds)) {
      feed.glass.material.map = enabled ? feed.target.texture : null;
      feed.glass.material.color.set(enabled ? '#dce9eb' : '#182328'); feed.glass.material.needsUpdate = true;
      if (enabled) feed.lastRenderMs = -Infinity;
    }
  }
  setQuality(quality);

  function update({ renderer, scene, carPose, cameraPoses = null, cockpitVisible = true, enabled = true, quality: nextQuality = currentQuality, nowMs = globalThis.performance?.now?.() || Date.now(), force = false, captureSchedule = null } = {}) {
    if (disposed || rendering) return 0;
    setEnabled(Boolean(enabled));
    if (!renderer || !scene || !cockpitVisible || !enabled || renderer.getContext?.().isContextLost?.()) return 0;
    const poses = cameraPoses || mirrorCameraPoses(THREE, carPose);
    if (!poses) return 0;
    setQuality(nextQuality);
    const due = ['center', 'left'].filter(id => force || (captureSchedule ? captureSchedule.take(id) : nowMs < feeds[id].lastRenderMs || nowMs - feeds[id].lastRenderMs >= 1000 / QUALITY[currentQuality][id][2]));
    if (!due.length) return 0;
    const previousTarget = renderer.getRenderTarget(), previousCubeFace = renderer.getActiveCubeFace?.() || 0, previousMipmap = renderer.getActiveMipmapLevel?.() || 0;
    const previousScissorTest = renderer.getScissorTest(), previousAlpha = renderer.getClearAlpha(), previousAutoClear = renderer.autoClear;
    const previousShadowAuto = renderer.shadowMap?.autoUpdate, previousShadowDirty = renderer.shadowMap?.needsUpdate, previousXR = renderer.xr?.enabled;
    renderer.getViewport(priorViewport); renderer.getScissor(priorScissor); renderer.getClearColor(priorClearColor);
    const hidden = new Map();
    const additional = typeof excludeRoots === 'function' ? excludeRoots() : excludeRoots;
    for (const root of new Set([cockpitRoot, mounts.center, mounts.left, ...(additional || [])].filter(Boolean))) hidden.set(root, root.visible);
    rendering = true;
    let rendered = 0;
    try {
      for (const root of hidden.keys()) root.visible = false;
      renderer.autoClear = false;
      if (renderer.shadowMap) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false; }
      if (renderer.xr) renderer.xr.enabled = false;
      for (const id of due) {
        const feed = feeds[id], pose = poses[id];
        feed.camera.position.fromArray(pose.position); feed.camera.up.fromArray(pose.up); feed.camera.lookAt(...pose.look); feed.camera.updateMatrixWorld(true);
        renderer.setRenderTarget(feed.target); renderer.setScissorTest(false);
        renderer.clear(true, true, true); renderer.render(scene, feed.camera);
        feed.lastRenderMs = nowMs; feed.frames++; rendered++;
      }
    } finally {
      renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmap);
      renderer.setViewport(priorViewport); renderer.setScissor(priorScissor); renderer.setScissorTest(previousScissorTest);
      renderer.setClearColor(priorClearColor, previousAlpha); renderer.autoClear = previousAutoClear;
      if (renderer.shadowMap) { renderer.shadowMap.autoUpdate = previousShadowAuto; renderer.shadowMap.needsUpdate = previousShadowDirty; }
      if (renderer.xr) renderer.xr.enabled = previousXR;
      for (const [root, visible] of hidden) root.visible = visible;
      rendering = false;
    }
    return rendered;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), materials = new Set();
    for (const mount of Object.values(mounts)) {
      mount.removeFromParent();
      mount.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material); } });
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const feed of Object.values(feeds)) feed.target.dispose();
  }
  return Object.freeze({
    rearviewMount: mounts.center, leftDoorMount: mounts.left,
    editorTargets: Object.freeze([
      { id: 'rearview-mirror', label: 'Retrovisor interior', object: mounts.center, capabilities: { position: true, rotation: true, scale: true, lens: false } },
      { id: 'left-door-mirror', label: 'Espejo lateral izquierdo', object: mounts.left, capabilities: { position: true, rotation: true, scale: true, lens: false } },
    ]),
    feeds: Object.freeze(feeds), update, dispose,
    diagnostics: () => ({ disposed, rendering, quality: currentQuality, enabled: feedsEnabled, centerFrames: feeds.center.frames, leftFrames: feeds.left.frames, centerSize: [feeds.center.target.width, feeds.center.target.height], leftSize: [feeds.left.target.width, feeds.left.target.height] }),
  });
}
