import { OCCUPANT_JOINTS, OCCUPANT_MESHES } from './traffic-occupant-meshes.mjs';

const DEG = Math.PI / 180;
const GRIP_CYCLE = 1.8;
const CONTACT_ARC = 1.2;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const wrap = (n, cycle) => ((n % cycle) + cycle) % cycle;
const ease = t => t * t * (3 - 2 * t);
const decode = source => Uint8Array.from(atob(source), char => char.charCodeAt(0));
const ignoreRay = () => {};

// Wrist at the origin, fingers along Y and palm facing -Z. Curled fingers
// leave space around the rim and fit in the same draw as the palm.
function makeGripGeometry(T, side) {
  const positions = [], index = [];
  function append(shape) {
    const offset = positions.length / 3;
    for (const value of shape.attributes.position.array) positions.push(value);
    for (const vertex of shape.index.array) index.push(offset + vertex);
    shape.dispose();
  }
  const oval = (x, y, z, sx, sy, sz) => new T.SphereGeometry(1, 12, 8).scale(sx, sy, sz).translate(x, y, z);
  append(oval(0, .023, -.002, .032, .038, .016));
  function curvedDigit(points, radius) {
    const path = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
    append(new T.TubeGeometry(path, 6, radius, 9, false));
    const tip = points.at(-1);
    append(oval(...tip, radius, radius, radius));
  }
  for (let finger = 0; finger < 4; finger++) {
    const x = (.025 - finger * .017) * side;
    const tip = [.074, .08, .076, .066][finger];
    curvedDigit([[x, .041, .001], [x, tip, -.012], [x * .96, tip - .009, -.035], [x * .9, tip - .021, -.041]], .008);
  }
  curvedDigit([[.021 * side, .005, 0], [.039 * side, .018, -.009], [.04 * side, .035, -.019], [.033 * side, .044, -.028]], .011);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// The near Blender mesh has rigid weights, so its sleeves can be kept in
// isolation and positioned at the shoulder and elbow.
function makeArms(T) {
  const { p, s, i } = OCCUPANT_MESHES.near[0];
  const points = new Int16Array(decode(p).buffer);
  const joints = decode(s);
  const indices = new Uint16Array(decode(i).buffer);
  const names = Object.keys(OCCUPANT_JOINTS);
  const sleeve = new T.MeshStandardMaterial({ name: 'Cockpit driver sleeves', color: 0x344650, roughness: .89 });
  const skin = new T.MeshStandardMaterial({ name: 'Cockpit driver hands', color: 0xc89370, roughness: .76 });
  const up = new T.Vector3(0, 1, 0), point = new T.Vector3();
  const root = new T.Group();
  root.name = 'CockpitDriverArms';
  const arms = ['L', 'R'].map((suffix, sideIndex) => {
    const pieces = ['upperArm', 'forearm'].map(part => {
      const name = `${part}.${suffix}`, joint = names.indexOf(name);
      const [from, to] = OCCUPANT_JOINTS[name];
      const origin = new T.Vector3(...from), direction = new T.Vector3(...to).sub(origin);
      const length = direction.length();
      const rotate = new T.Quaternion().setFromUnitVectors(direction.normalize(), up);
      const positions = [], index = [], vertices = new Map();
      for (let triangle = 0; triangle < indices.length; triangle += 3) {
        if (joints[indices[triangle]] !== joint) continue;
        for (let corner = 0; corner < 3; corner++) {
          const source = indices[triangle + corner];
          if (!vertices.has(source)) {
            const offset = source * 3;
            point.set(points[offset], points[offset + 1], points[offset + 2]).multiplyScalar(.0001).sub(origin).applyQuaternion(rotate);
            vertices.set(source, positions.length / 3);
            positions.push(point.x, point.y, point.z);
          }
          index.push(vertices.get(source));
        }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(index);
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, sleeve);
      mesh.name = `CockpitDriver_${name}`;
      mesh.raycast = ignoreRay;
      root.add(mesh);
      return { mesh, length };
    });
    const palm = new T.Mesh(makeGripGeometry(T, sideIndex === 0 ? 1 : -1), skin);
    palm.name = `CockpitDriver_hand.${suffix}`;
    palm.raycast = ignoreRay;
    root.add(palm);
    return { pieces, palm, shoulder: new T.Vector3(), elbow: new T.Vector3(), hand: new T.Vector3() };
  });
  return {
    root, arms,
    dispose() {
      root.removeFromParent();
      for (const mesh of root.children) mesh.geometry.dispose();
      sleeve.dispose();
      skin.dispose();
      root.clear();
    },
  };
}

function measureWheel(T, { parent, pivot, wheel, rest, axis, back }) {
  parent.updateWorldMatrix(true, false);
  pivot.parent.updateWorldMatrix(true, false);
  wheel.updateWorldMatrix(true, true);
  const restInCabin = new T.Matrix4().compose(pivot.position, rest, pivot.scale)
    .premultiply(pivot.parent.matrixWorld).premultiply(parent.matrixWorld.clone().invert());
  if (axis.clone().transformDirection(restInCabin).dot(back) < 0) axis.negate();
  const up = new T.Vector3(0, 1, 0).transformDirection(restInCabin.invert());
  up.addScaledVector(axis, -up.dot(axis)).normalize();
  if (up.lengthSq() < .5) return null;
  const right = new T.Vector3().crossVectors(up, axis).normalize();
  const inverse = pivot.matrixWorld.clone().invert(), transform = new T.Matrix4(), point = new T.Vector3();
  function sample(visit) {
    wheel.traverseVisible(node => {
      const positions = node.geometry?.attributes?.position;
      if (!node.isMesh || !positions) return;
      transform.multiplyMatrices(inverse, node.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(transform);
        visit(point.dot(right), point.dot(up), point.dot(axis));
      }
    });
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  sample((x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
  const x0 = (minX + maxX) * .5, y0 = (minY + maxY) * .5;
  const outer = Math.min(maxX - minX, maxY - minY) * .5;
  if (!(outer > .00001)) return null;
  let minDepth = Infinity, maxDepth = -Infinity;
  sample((x, y, depth) => {
    if (Math.hypot(x - x0, y - y0) < outer * .85) return;
    minDepth = Math.min(minDepth, depth);
    maxDepth = Math.max(maxDepth, depth);
  });
  if (!Number.isFinite(minDepth)) return null;
  return { right, up, center: right.clone().multiplyScalar(x0).addScaledVector(up, y0).addScaledVector(axis, (minDepth + maxDepth) * .5), radius: outer * .934 };
}

export function createCockpitDriverArms(T) {
  const up = new T.Vector3(0, 1, 0), right = new T.Vector3();
  const inverse = new T.Matrix4(), wheelFrame = new T.Matrix4(), restInverse = new T.Quaternion(), turn = new T.Quaternion();
  const center = new T.Vector3(), wheelHand = new T.Vector3(), wheelNormal = new T.Vector3(), radial = new T.Vector3();
  const knobGrip = new T.Vector3(), aim = new T.Vector3(), shiftAim = new T.Vector3();
  const direction = new T.Vector3(), pole = new T.Vector3(), delta = new T.Vector3();
  const palmRight = new T.Vector3(), palmBack = new T.Vector3(), palmBasis = new T.Matrix4();
  let mount = null, fit, model = null, disposed = false;
  let previousGear = null, progress = 0, linger = 0, shiftBlend = 0;

  function hide() {
    if (model) model.root.visible = false;
    previousGear = null;
    progress = linger = shiftBlend = 0;
  }
  function suspend() {
    hide();
    model?.dispose();
    model = null;
  }
  function bind({ parent, pivot, wheel = pivot, knob, axis = [0, 0, 1], back = [0, 0, 1], rest = pivot?.quaternion } = {}) {
    suspend();
    mount = parent && pivot && wheel ? { parent, pivot, wheel, knob, axis: new T.Vector3(...axis).normalize(), back: new T.Vector3(...back).normalize(), rest: rest.clone() } : null;
    fit = undefined;
    if (mount) {
      restInverse.copy(mount.rest).invert();
      right.crossVectors(up, mount.back).normalize();
    }
  }
  function alignSleeve(part, from, to, scale) {
    const { mesh, length } = part;
    delta.subVectors(to, from);
    const distance = delta.length();
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(up, delta.normalize());
    mesh.scale.set(scale, distance / length, scale);
  }
  function update({ settings, active, gear, shifting, grabbing, wheelSpinRad, dt, paused, reducedMotion } = {}) {
    if (disposed) return;
    if (!settings?.enabled) { if (model) suspend(); return; }
    if (!active || !mount) { if (model?.root.visible) hide(); return; }
    const { parent, pivot, axis, back, knob } = mount;
    if (fit === undefined) fit = measureWheel(T, mount);
    if (!fit) return;
    if (!model) { model = makeArms(T); parent.add(model.root); }
    model.root.visible = true;

    pivot.updateWorldMatrix(true, false);
    inverse.copy(parent.matrixWorld).invert();
    wheelFrame.multiplyMatrices(inverse, pivot.matrixWorld);
    center.copy(fit.center).applyMatrix4(wheelFrame);
    wheelNormal.copy(axis).transformDirection(wheelFrame);
    const scale = radial.copy(fit.center).addScaledVector(fit.right, fit.radius).applyMatrix4(wheelFrame).distanceTo(center) / .18;
    turn.copy(restInverse).multiply(pivot.quaternion);
    const twist = 2 * Math.atan2(turn.x * axis.x + turn.y * axis.y + turn.z * axis.z, turn.w);
    // The camera-space Chevy wheel can turn several full revolutions. Use its
    // actual unwrapped angle for regrips and the pivot for the final placement.
    const sweep = Number.isFinite(wheelSpinRad) ? wheelSpinRad * axis.z : twist;

    if (knob && settings.shiftEnabled && !reducedMotion) {
      knob.getWorldPosition(knobGrip).applyMatrix4(inverse);
      const reachable = knobGrip.distanceTo(center) < scale * .92;
      if (!paused && reachable) {
        const elapsed = clamp(dt || 0, 0, .05);
        if (shifting || grabbing || (previousGear !== null && gear !== previousGear)) linger = settings.shiftSeconds + .13;
        else linger = Math.max(0, linger - elapsed);
        progress = clamp(progress + (linger > 0 ? 1 : -.82) * elapsed / settings.shiftSeconds, 0, 1);
      }
      if (!reachable) progress = linger = 0;
    } else progress = linger = 0;
    if (!paused || previousGear === null) previousGear = gear ?? null;
    shiftBlend = ease(progress);

    for (let index = 0; index < model.arms.length; index++) {
      const arm = model.arms[index];
      const side = index === 0 ? -1 : 1;
      const phaseAtRest = index === 0 ? .61 : .54;
      const phase = wrap(phaseAtRest - side * sweep, GRIP_CYCLE);
      const release = clamp((phase - CONTACT_ARC) / (GRIP_CYCLE - CONTACT_ARC), 0, 1);
      const arc = release > 0 ? (1 - ease(release)) * CONTACT_ARC : phase;
      const angle = side * (settings.gripDeg * DEG + arc - phaseAtRest) + twist;
      wheelHand.copy(fit.center).addScaledVector(fit.up, Math.cos(angle) * fit.radius)
        .addScaledVector(fit.right, Math.sin(angle) * fit.radius).applyMatrix4(wheelFrame);
      radial.copy(wheelHand).sub(center).normalize();
      arm.hand.copy(wheelHand).addScaledVector(wheelNormal, scale * (.027 + .026 * Math.sin(Math.PI * release)));
      aim.copy(radial).multiplyScalar(-1).addScaledVector(wheelNormal, -.33).normalize();
      if (side === 1 && shiftBlend > 0) {
        wheelHand.copy(knobGrip).addScaledVector(up, scale * .036).addScaledVector(back, scale * .023);
        arm.hand.lerp(wheelHand, shiftBlend).addScaledVector(up, Math.sin(Math.PI * shiftBlend) * scale * .045);
        aim.lerp(shiftAim.copy(up).negate().addScaledVector(back, -.48).normalize(), shiftBlend).normalize();
      }
      arm.shoulder.copy(center).addScaledVector(back, scale * (.49 + settings.shoulderReachCm / 100))
        .addScaledVector(up, scale * (.022 + settings.shoulderHeightCm / 100)).addScaledVector(right, scale * .168 * side);
      direction.subVectors(arm.hand, arm.shoulder);
      const distance = Math.max(.00001, direction.length());
      direction.normalize();
      const armLength = Math.max(scale * .56, distance + scale * .012);
      const upper = armLength * .52, lower = armLength * .48;
      const along = clamp((upper * upper - lower * lower + distance * distance) / (2 * distance), -upper, upper);
      pole.copy(up).negate().addScaledVector(right, side * .36).addScaledVector(direction, -pole.dot(direction)).normalize();
      arm.elbow.copy(arm.shoulder).addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
      alignSleeve(arm.pieces[0], arm.shoulder, arm.elbow, scale);
      alignSleeve(arm.pieces[1], arm.elbow, arm.hand, scale);
      palmBack.copy(wheelNormal).lerp(back, side === 1 ? shiftBlend : 0);
      palmRight.crossVectors(aim, palmBack).normalize();
      palmBack.crossVectors(palmRight, aim);
      arm.palm.position.copy(arm.hand);
      arm.palm.quaternion.setFromRotationMatrix(palmBasis.makeBasis(palmRight, aim, palmBack));
      arm.palm.scale.setScalar(scale);
    }
  }

  return {
    bind, update, suspend,
    diagnostics: () => ({
      visible: model?.root.visible === true, fitted: !!fit, shiftBlend,
      hands: model?.arms.map(arm => arm.hand.toArray()) ?? [],
      shoulders: model?.arms.map(arm => arm.shoulder.toArray()) ?? [],
    }),
    dispose() { suspend(); mount = null; fit = undefined; disposed = true; },
  };
}
