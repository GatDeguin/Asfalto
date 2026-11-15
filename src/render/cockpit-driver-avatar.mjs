import { COCKPIT_HAND_MESH } from './cockpit-hand-mesh.mjs?v=5c638abbe34caac8';
import { createCockpitDriverMaterials } from './cockpit-driver-materials.mjs?v=55c04d12129bea83';
import { createCockpitDriverSleeve } from './cockpit-driver-sleeve.mjs?v=f317b0ca312cefec';

const ignoreRay = () => {};
const decode = source => Uint8Array.from(atob(source), character => character.charCodeAt(0)).buffer;
const lerp = (a, b, t) => a + (b - a) * t;

function fitRim(points, { y, depth, lean, tube }) {
  const unit = 1 / Math.hypot(1, lean), tilt = lean * unit;
  const centerY = y + .18 * unit, centerZ = -depth + .18 * tilt;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i], dy = points[i + 1] - centerY, dz = points[i + 2] - centerZ;
    const radial = dy * unit + dz * tilt, normal = dz * unit - dy * tilt;
    const delta = 1 - .18 / Math.hypot(x, radial);
    const dx = x * delta, dr = radial * delta;
    const distance = Math.hypot(dx, dr, normal);
    const correction = tube - .0011 - distance;
    if (correction <= 0 || distance < 1e-6) continue;
    const amount = Math.min(.008, correction) / distance;
    points[i] += dx * amount;
    points[i + 1] += (dr * unit - normal * tilt) * amount;
    points[i + 2] += (dr * tilt + normal * unit) * amount;
  }
}

function handGeometry(T, tube) {
  const { units, index, weld, uv, poses, grip: { lean, thin, thick } } = COCKPIT_HAND_MESH;
  const geometry = new T.BufferGeometry(), welded = new T.BufferGeometry();
  const indices = new Uint16Array(decode(index)), sourceVertices = new Uint16Array(decode(weld));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  geometry.setAttribute('uv', new T.BufferAttribute(new Uint16Array(decode(uv)), 2, true));
  welded.setIndex(new T.BufferAttribute(Uint16Array.from(indices, i => sourceVertices[i]), 1));
  // Shade the closed sculpt first, then give each UV seam its own attribute.
  function withUvSeams(source, name) {
    const expanded = new Float32Array(sourceVertices.length * 3);
    for (let i = 0; i < sourceVertices.length; i++) {
      const original = sourceVertices[i] * 3, target = i * 3;
      expanded[target] = source[original];
      expanded[target + 1] = source[original + 1];
      expanded[target + 2] = source[original + 2];
    }
    const attribute = new T.BufferAttribute(expanded, 3);
    attribute.name = name;
    return attribute;
  }
  const fit = Math.min(1, Math.max(0, (tube - thin.tube) / (thick.tube - thin.tube)));
  const wheel = { tube, lean, y: lerp(thin.y, thick.y, fit), depth: lerp(thin.depth, thick.depth, fit) };
  const coordinates = name => new Int16Array(decode(poses[name]));
  const narrow = coordinates('thin'), wide = coordinates('thick');
  const base = Float32Array.from(narrow, (value, i) => lerp(value, wide[i], fit) / units);
  fitRim(base, wheel);
  const positions = [], normals = [];
  for (const name of ['wheel', 'reach', 'shifter']) {
    const pose = name === 'wheel' ? base : Float32Array.from(coordinates(name), value => value / units);
    welded.setAttribute('position', new T.BufferAttribute(pose, 3));
    welded.computeVertexNormals();
    positions.push(withUvSeams(pose, name));
    normals.push(withUvSeams(welded.getAttribute('normal').array, name));
  }
  geometry.setAttribute('position', positions[0]);
  geometry.setAttribute('normal', normals[0]);
  geometry.morphAttributes.position = positions.slice(1);
  geometry.morphAttributes.normal = normals.slice(1);
  geometry.computeBoundingSphere();
  return { surface: geometry, wheel };
}

export function createCockpitDriverAvatar(T, tube) {
  const root = new T.Group();
  root.name = 'CockpitDriverArms';
  const { surface, wheel } = handGeometry(T, tube);
  const materials = createCockpitDriverMaterials(T);
  const wrists = Object.fromEntries(Object.entries(COCKPIT_HAND_MESH.wrists).map(([name, { offset, direction }]) => [
    name, { offset: new T.Vector3(...offset), direction: new T.Vector3(...direction) },
  ]));
  const arms = ['L', 'R'].map(side => {
    const handMesh = new T.Mesh(surface, materials.skin);
    handMesh.name = `CockpitDriver_hand.${side}`;
    handMesh.raycast = ignoreRay;
    const sleeve = createCockpitDriverSleeve(T, materials.fabric, side);
    root.add(sleeve.mesh, handMesh);
    return { sleeve, handMesh, shoulder: new T.Vector3(), elbow: new T.Vector3(), wrist: new T.Vector3(), grip: new T.Vector3(), contact: 'wheel' };
  });
  return {
    root, arms, wheel, wrists,
    triangles: surface.index.count * 2 / 3 + arms.reduce((sum, arm) => sum + arm.sleeve.mesh.geometry.index.count / 3, 0),
    dispose() {
      root.removeFromParent();
      for (const arm of arms) arm.sleeve.mesh.geometry.dispose();
      surface.dispose();
      materials.dispose();
      root.clear();
    },
  };
}
