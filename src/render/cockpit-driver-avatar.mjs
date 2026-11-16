import { COCKPIT_HAND_MESH } from './cockpit-hand-mesh.mjs?v=ecf8eef834b29fbf';
import { createCockpitDriverMaterials } from './cockpit-driver-materials.mjs?v=4ab97e6ded9f33f6';
import { createCockpitDriverSleeve } from './cockpit-driver-sleeve.mjs?v=f455f5f654775538';

const ignoreRay = () => {};
const decode = source => Uint8Array.from(atob(source), character => character.charCodeAt(0)).buffer;
const lerp = (a, b, t) => a + (b - a) * t;
const REFERENCE_RADIUS = .18;
const THUMB_RIM_TRAVEL = .066;
const THUMB_PAD_ROLL = .53;

// Offset from the nearest point on the rim's centerline, in hand coordinates.
function rimOffset(delta, planar, { center, normal }) {
  delta.sub(center);
  planar.copy(delta).addScaledVector(normal, -delta.dot(normal)).normalize();
  return delta.addScaledVector(planar, -REFERENCE_RADIUS);
}

function fitRim(T, points, wheel) {
  const delta = new T.Vector3(), planar = new T.Vector3();
  for (let i = 0; i < points.length; i += 3) {
    const distance = rimOffset(delta.fromArray(points, i), planar, wheel).length();
    const correction = wheel.tube - .0011 - distance;
    if (correction <= 0 || distance < 1e-6) continue;
    const amount = Math.min(.008, correction) / distance;
    points[i] += delta.x * amount;
    points[i + 1] += delta.y * amount;
    points[i + 2] += delta.z * amount;
  }
}

function gripColors(T, points, normals, wheel) {
  const delta = new T.Vector3(), planar = new T.Vector3(), normal = new T.Vector3();
  const colors = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    const distance = rimOffset(delta.fromArray(points, i), planar, wheel).length();
    const proximity = Math.min(1, Math.max(0, 1 - (distance - wheel.tube) / .014));
    const facingRim = Math.max(0, -normal.fromArray(normals, i).dot(delta) / Math.max(distance, .00001));
    const shade = 1 - .27 * proximity * proximity * facingRim;
    colors.fill(shade, i, i + 3);
  }
  return colors;
}

function wristPose(T, base, digits, { offset, direction }) {
  const pose = base.slice();
  const axis = new T.Vector3(0, 1, 0);
  const rotation = new T.Quaternion().setFromUnitVectors(axis, direction);
  const point = new T.Vector3(), moved = new T.Vector3();
  // Leave the support pads (above .036 in the authored hand) and fingers fixed.
  for (let vertex = 0; vertex < digits.length; vertex++) {
    const i = vertex * 3;
    if (digits[vertex] || base[i + 1] >= .034) continue;
    const t = Math.min(1, Math.max(0, (.034 - base[i + 1]) / .026));
    const influence = t * t * (3 - 2 * t);
    point.fromArray(base, i);
    moved.copy(point).applyQuaternion(rotation).add(offset);
    point.lerp(moved, influence).toArray(pose, i);
  }
  return pose;
}

function thumbContactPose(T, base, digits, tipVertices, wheel) {
  const pose = base.slice();
  let rootY = Infinity, tipY = 0;
  for (let vertex = 0; vertex < digits.length; vertex++) {
    if (digits[vertex] === 5) rootY = Math.min(rootY, base[vertex * 3 + 1]);
  }
  for (const vertex of tipVertices) tipY += base[vertex * 3 + 1];
  tipY /= tipVertices.length;
  const span = tipY - rootY;
  const relative = new T.Vector3(), planar = new T.Vector3();
  for (let vertex = 0; vertex < digits.length; vertex++) {
    if (digits[vertex] !== 5) continue;
    const i = vertex * 3;
    const t = Math.min(1, Math.max(0, (base[i + 1] - rootY - .16 * span) / (.69 * span)));
    const bend = t * t * (3 - 2 * t);
    relative.fromArray(base, i).sub(wheel.center);
    const face = relative.dot(wheel.normal);
    planar.copy(relative).addScaledVector(wheel.normal, -face);
    const radius = planar.length(), offset = radius - REFERENCE_RADIUS;
    // Turn the pad around the rim's cross-section and slide it along the ring.
    // Both transformations preserve its distance from the measured centerline.
    const roll = THUMB_PAD_ROLL * bend, sin = Math.sin(roll), cos = Math.cos(roll);
    const rolledRadius = REFERENCE_RADIUS + offset * cos - face * sin;
    const rolledDepth = offset * sin + face * cos;
    planar.multiplyScalar(rolledRadius / radius).applyAxisAngle(wheel.normal, THUMB_RIM_TRAVEL * bend)
      .addScaledVector(wheel.normal, rolledDepth).add(wheel.center).toArray(pose, i);
  }
  return pose;
}

function handGeometry(T, tube, restingWrist) {
  const { units, index, weld, uv, poses, grip, digits, thumb } = COCKPIT_HAND_MESH;
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
  const [narrow, wide] = tube <= grip.medium.tube ? ['thin', 'medium'] : ['medium', 'thick'];
  const first = grip[narrow], second = grip[wide];
  const fit = Math.min(1, Math.max(0, (tube - first.tube) / (second.tube - first.tube)));
  const [thumbward, forward, back] = grip.basis.map(axis => new T.Vector3(...axis));
  const toHand = vector => new T.Vector3(vector.dot(thumbward), vector.dot(forward), vector.dot(back));
  const origin = new T.Vector3(...first.origin).lerp(new T.Vector3(...second.origin), fit);
  const wheel = {
    tube, forward, back,
    anchor: toHand(origin.clone().negate()),
    center: toHand(new T.Vector3(REFERENCE_RADIUS, 0, 0).sub(origin)),
    normal: toHand(new T.Vector3(0, 0, 1)),
  };
  const coordinates = name => new Int16Array(decode(poses[name]));
  const rimPose = suffix => {
    const from = coordinates(narrow + suffix), to = coordinates(wide + suffix);
    const pose = Float32Array.from(from, (value, i) => lerp(value, to[i], fit) / units);
    fitRim(T, pose, wheel);
    return pose;
  };
  const base = rimPose(''), rimOpen = rimPose('Open');
  const loadPose = name => Float32Array.from(coordinates(name), value => value / units);
  const digit = new Uint8Array(decode(digits));
  // Keep the paired steering poses and add corrections for each trailing
  // finger so resting poses can vary its timing. The palm is outside both.
  const fingerPose = (first, last) => Float32Array.from(base, (value, i) => {
    const owner = digit[Math.floor(i / 3)];
    return owner >= first && owner <= last ? rimOpen[i] : value;
  });
  const poseVertices = [
    ['wheel', base],
    ['reach', loadPose('reach')],
    ['shifter', loadPose('shifter')],
    ['rimOpen', rimOpen],
    ['indexFlex', fingerPose(1, 2)],
    ['outerFlex', fingerPose(3, 4)],
    ['thumbFlex', thumbContactPose(T, base, digit, new Uint16Array(decode(thumb)), wheel)],
    ['middleFlex', fingerPose(2, 2)],
    ['littleFlex', fingerPose(4, 4)],
    ['wristSettle', wristPose(T, base, digit, restingWrist)],
  ];
  const positions = [], normals = [], colors = [];
  const noContact = new Float32Array(base.length).fill(1);
  for (const [name, pose] of poseVertices) {
    welded.setAttribute('position', new T.BufferAttribute(pose, 3));
    welded.computeVertexNormals();
    positions.push(withUvSeams(pose, name));
    const normal = welded.getAttribute('normal').array;
    normals.push(withUvSeams(normal, name));
    // As a hand releases, only the localized rim contact shading fades away.
    colors.push(withUvSeams(name === 'reach' || name === 'shifter' ? noContact : gripColors(T, pose, normal, wheel), name));
  }
  geometry.setAttribute('position', positions[0]);
  geometry.setAttribute('normal', normals[0]);
  geometry.setAttribute('color', colors[0]);
  geometry.morphAttributes.position = positions.slice(1);
  geometry.morphAttributes.normal = normals.slice(1);
  geometry.morphAttributes.color = colors.slice(1);
  geometry.computeBoundingSphere();
  return { surface: geometry, wheel };
}

export function createCockpitDriverAvatar(T, tube) {
  const root = new T.Group();
  root.name = 'CockpitDriverArms';
  const wrists = Object.fromEntries(Object.entries(COCKPIT_HAND_MESH.wrists).map(([name, { offset, direction }]) => [
    name, { offset: new T.Vector3(...offset), direction: new T.Vector3(...direction) },
  ]));
  wrists.settle = { offset: new T.Vector3(.0034, -.0013, .0042), direction: new T.Vector3(-.12, .984, -.132).normalize() };
  const { surface, wheel } = handGeometry(T, tube, wrists.settle);
  const materials = createCockpitDriverMaterials(T);
  const arms = ['L', 'R'].map(side => {
    const handMesh = new T.Mesh(surface, materials.skin);
    handMesh.name = `CockpitDriver_hand.${side}`;
    handMesh.raycast = ignoreRay;
    const sleeve = createCockpitDriverSleeve(T, materials.fabric, side);
    root.add(sleeve.mesh, handMesh);
    return { sleeve, handMesh, shoulder: new T.Vector3(), elbow: new T.Vector3(), wrist: new T.Vector3(), grip: new T.Vector3(),
      contact: 'wheel', gripAdjustment: 0, fingerFlex: [0, 0, 0] };
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
