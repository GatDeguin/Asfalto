import { CHEVY_V3_WHEEL_PARTITION } from './chevy-v3-wheel-partition-data.mjs?v=2c28b8f3c37d245b';

// The shipped V3 is a single quantized mesh, with fragmented tire/body topology.
// Surface ownership is compiled from that exact GLB's positions, UV atlas and
// normals; whole-component exclusions cut through its actual tire/rim surfaces.
// X is longitudinal, the nose is -X, and the axle/spin axis is +Z. The host's
// existing PI yaw maps the car to physical +X and positive spin to physical -Z.
// Physical contact IDs call +Z "Left". Host PI yaw maps authored low Z there.
const WHEELS = Object.freeze(CHEVY_V3_WHEEL_PARTITION.wheels.map(wheel =>
  Object.freeze({ id: wheel.id, center: Object.freeze([...wheel.center]) })));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function decodeChevyV3WheelPartition(partition = CHEVY_V3_WHEEL_PARTITION) {
  if (partition.triangles !== 378436 || typeof partition.encoded !== 'string' || partition.encoded.length > 100000) {
    throw new Error('Invalid Chevy V3 surface partition header.');
  }
  const binary = atob(partition.encoded), owners = new Uint8Array(partition.triangles);
  let cursor = 0, triangle = 0;
  while (cursor < binary.length) {
    let code = 0, shift = 0, byte;
    do {
      if (cursor >= binary.length || shift > 28) throw new Error('Truncated Chevy V3 surface partition.');
      byte = binary.charCodeAt(cursor++);
      code |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    const owner = code & 7, length = code >>> 3;
    if (owner > 4 || length === 0 || triangle + length > owners.length) throw new Error('Invalid Chevy V3 surface run.');
    owners.fill(owner, triangle, triangle + length);
    triangle += length;
  }
  if (triangle !== owners.length) throw new Error('Incomplete Chevy V3 surface partition.');
  return owners;
}

export function createChevyWheelVisualRig(THREE, modelRoot) {
  const meshes = [];
  modelRoot.traverse(object => { if (object.isMesh) meshes.push(object); });
  if (meshes.length !== 1) throw new Error('Chevy V3 wheel rig expects the original single mesh.');
  const body = meshes[0];
  const originalGeometry = body.geometry;
  const position = originalGeometry.getAttribute('position');
  const sourceIndex = originalGeometry.getIndex();
  if (position?.count !== 201686 || sourceIndex?.count !== 1135308) {
    throw new Error('Chevy V3 wheel rig cannot partition a different vehicle asset.');
  }
  const owners = decodeChevyV3WheelPartition();
  const indices = Array.from({ length: 5 }, () => []);
  for (let offset = 0; offset < sourceIndex.count; offset += 3) {
    const a = sourceIndex.getX(offset), b = sourceIndex.getX(offset + 1), c = sourceIndex.getX(offset + 2);
    // Whole triangles only: every original triangle has exactly one owner.
    indices[owners[offset / 3]].push(a, b, c);
  }
  const triangleCounts = indices.map(part => part.length / 3);
  const geometries = indices.map(part => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(originalGeometry.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(part), 1));
    // Three's computeBoundingBox includes unused shared vertices; bound only this part.
    const bounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    for (const index of part) bounds.expandByPoint(vertex.fromBufferAttribute(position, index));
    geometry.boundingBox = bounds;
    geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    return geometry;
  });
  const wheels = {};
  for (let index = 0; index < WHEELS.length; index++) {
    const authored = WHEELS[index];
    const pivot = new THREE.Group();
    pivot.name = 'ChevyV3_' + authored.id + '_Pivot';
    pivot.position.fromArray(authored.center);
    const steering = new THREE.Group();
    steering.name = 'ChevyV3_' + authored.id + '_Steering';
    const spin = new THREE.Group();
    spin.name = 'ChevyV3_' + authored.id + '_Spin';
    const mesh = new THREE.Mesh(geometries[index + 1], body.material);
    mesh.name = 'ChevyV3_' + authored.id + '_TireRim';
    mesh.position.fromArray(authored.center).multiplyScalar(-1);
    mesh.castShadow = body.castShadow;
    mesh.receiveShadow = body.receiveShadow;
    mesh.layers.mask = body.layers.mask;
    spin.add(mesh); steering.add(spin); pivot.add(steering); body.add(pivot);
    wheels[authored.id] = { pivot, steering, spin, mesh };
  }
  body.geometry = geometries[0];
  let disposed = false;

  function update(snapshot) {
    if (disposed) return false;
    for (const { id } of WHEELS) {
      const sample = snapshot?.wheels?.find(wheel => wheel.id === id);
      wheels[id].spin.rotation.z = finite(sample?.rotationRad);
      // Physics steers forward*cos(a) + side(+Z)*sin(a); Three's +Y yaw
      // sends +X toward -Z, so the visual steering yaw has the opposite sign.
      wheels[id].steering.rotation.y = id.startsWith('front') ? -finite(sample?.steerAngleRad) || 0 : 0;
      // Keep the authored suspension rest height: V3 has no verified strut/rest
      // metadata. Copying physical absolute wheel positions would stretch its fit.
    }
    return true;
  }

  return Object.freeze({
    body,
    wheels: Object.freeze(wheels),
    update,
    reset() { return update(null); },
    applyWheels(previous, current, alpha, interpolated) {
      const blend = Math.min(1, Math.max(0, finite(alpha, 1)));
      const samples = (interpolated?.wheels || []).map(wheel => {
        const before = previous?.wheels?.find(sample => sample.id === wheel.id);
        const after = current?.wheels?.find(sample => sample.id === wheel.id);
        if (!before || !after || blend === 1) return wheel;
        const start = finite(before.rotationRad), end = finite(after.rotationRad);
        const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
        return { ...wheel, rotationRad: start + delta * blend };
      });
      return update({ wheels: samples });
    },
    getDiagnostics() {
      return Object.freeze({
        asset: 'Chevy V3', disposed, bodyTriangles: triangleCounts[0],
        wheels: Object.freeze(WHEELS.map(({ id, center }) => Object.freeze({
          id, center, triangles: wheels[id].mesh.geometry.index.count / 3,
          rotationRad: wheels[id].spin.rotation.z,
          steerAngleRad: -wheels[id].steering.rotation.y || 0,
          visualSteerAngleRad: wheels[id].steering.rotation.y,
        }))),
      });
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      for (const wheel of Object.values(wheels)) wheel.pivot.removeFromParent();
      if (body.geometry === geometries[0]) body.geometry = originalGeometry;
      for (const geometry of geometries) geometry.dispose();
      // The static template and garage share attributes/material/textures: none
      // of those resources belong to this rig and they must not be disposed here.
      return true;
    },
  });
}
