import { createCockpitDriverAvatar } from './cockpit-driver-avatar.mjs?v=3757b6cb8ba6727a';

const DEG = Math.PI / 180;
const GRIP_CYCLE = 1.8;
const CONTACT_ARC = 1.12;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const wrap = (n, cycle) => ((n % cycle) + cycle) % cycle;
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

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
  const halfDepth = clamp((maxDepth - minDepth) * .5, outer * .035, outer * .115);
  return {
    right, up, halfDepth, radius: outer - halfDepth,
    center: right.clone().multiplyScalar(x0).addScaledVector(up, y0).addScaledVector(axis, (minDepth + maxDepth) * .5),
  };
}

export function createCockpitDriverArms(T) {
  const up = new T.Vector3(0, 1, 0), right = new T.Vector3();
  const inverse = new T.Matrix4(), wheelFrame = new T.Matrix4(), restInverse = new T.Quaternion(), turn = new T.Quaternion();
  const center = new T.Vector3(), wheelHand = new T.Vector3(), wheelNormal = new T.Vector3(), radial = new T.Vector3();
  const knobGrip = new T.Vector3(), aim = new T.Vector3(), shiftAim = new T.Vector3();
  const direction = new T.Vector3(), pole = new T.Vector3();
  const palmRight = new T.Vector3(), palmBack = new T.Vector3(), palmBasis = new T.Matrix4();
  let mount = null, fit, model = null, disposed = false;
  let previousGear = null, progress = 0, linger = 0, shiftBlend = 0, sleeveUpdates = 0;

  function hide() {
    if (model) model.root.visible = false;
    previousGear = null;
    progress = linger = shiftBlend = 0;
  }
  function suspend() {
    hide();
    model?.dispose();
    model = null;
    sleeveUpdates = 0;
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
  function update({ settings, active, gear, shifting, grabbing, wheelSpinRad, dt, paused, reducedMotion } = {}) {
    if (disposed) return;
    if (!settings?.enabled) { if (model) suspend(); return; }
    if (!active || !mount) { if (model?.root.visible) hide(); return; }
    const { parent, pivot, axis, back, knob } = mount;
    if (fit === undefined) fit = measureWheel(T, mount);
    if (!fit) return;
    if (!model) { model = createCockpitDriverAvatar(T, fit.halfDepth / fit.radius * .18); parent.add(model.root); }
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
      // Stagger the regrip windows so one hand always has the rim.
      const phaseAtRest = index === 0 ? .19 : .22;
      const phase = wrap(phaseAtRest - side * sweep, GRIP_CYCLE);
      const release = clamp((phase - CONTACT_ARC) / (GRIP_CYCLE - CONTACT_ARC), 0, 1);
      const arc = release > 0 ? (1 - ease(release)) * CONTACT_ARC : phase;
      const angle = side * (settings.gripDeg * DEG + arc - phaseAtRest) + twist;
      wheelHand.copy(fit.center).addScaledVector(fit.up, Math.cos(angle) * fit.radius)
        .addScaledVector(fit.right, Math.sin(angle) * fit.radius).applyMatrix4(wheelFrame);
      const shift = side === 1 ? shiftBlend : 0;
      const onlyWheelHand = side === -1 && shiftBlend > 0;
      const loosen = reducedMotion || onlyWheelHand ? 0 : Math.sin(Math.PI * release);
      const transit = Math.sin(Math.PI * shift);
      const grasp = ease(clamp((shift - .53) / .47, 0, 1));
      const open = Math.max(loosen * (1 - shift), transit) * (1 - grasp);
      radial.subVectors(wheelHand, center).normalize();
      arm.grip.copy(wheelHand).addScaledVector(wheelNormal, loosen * scale * .017);
      aim.copy(radial).negate().addScaledVector(wheelNormal, -model.wheel.lean).normalize();
      palmBack.copy(wheelNormal);
      if (shift > 0) {
        arm.grip.lerp(knobGrip, shift).addScaledVector(up, transit * scale * .080).addScaledVector(back, transit * scale * .067);
        aim.lerp(shiftAim.copy(back).negate().addScaledVector(up, -.24).normalize(), shift).normalize();
        palmBack.lerp(up, shift);
      }
      palmRight.crossVectors(aim, palmBack).normalize();
      palmBack.crossVectors(palmRight, aim);
      const anchorY = lerp(model.wheel.y, .075, shift);
      const anchorDepth = lerp(model.wheel.depth, .028, shift);
      arm.wrist.copy(arm.grip).addScaledVector(aim, -scale * anchorY).addScaledVector(palmBack, scale * anchorDepth);
      arm.contact = shift > .99 ? 'shifter' : shift > 0 || loosen > .02 ? 'reach' : 'wheel';
      arm.shoulder.copy(center).addScaledVector(back, scale * (.49 + settings.shoulderReachCm / 100))
        .addScaledVector(up, scale * (.062 + settings.shoulderHeightCm / 100)).addScaledVector(right, scale * .151 * side);
      direction.subVectors(arm.wrist, arm.shoulder);
      const distance = Math.max(.00001, direction.length());
      direction.normalize();
      const armLength = Math.max(scale * .56, distance + scale * .012);
      const upper = armLength * .52, lower = armLength * .48;
      const along = clamp((upper * upper - lower * lower + distance * distance) / (2 * distance), -upper, upper);
      pole.copy(up).negate().addScaledVector(right, side * .18).addScaledVector(direction, -pole.dot(direction)).normalize();
      arm.elbow.copy(arm.shoulder).addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
      const { handMesh, sleeve } = arm;
      handMesh.position.copy(arm.wrist);
      handMesh.quaternion.setFromRotationMatrix(palmBasis.makeBasis(palmRight, aim, palmBack));
      handMesh.scale.set(-side * scale, scale, scale);
      const targets = handMesh.morphTargetInfluences;
      targets[0] = open; targets[1] = grasp;
      if (sleeve.update(arm.shoulder, arm.elbow, arm.wrist, aim, palmRight, scale)) sleeveUpdates++;
    }
  }

  return {
    bind, update, suspend,
    diagnostics: () => ({
      visible: model?.root.visible === true, fitted: !!fit, shiftBlend,
      hands: model?.arms.map(arm => arm.wrist.toArray()) ?? [],
      shoulders: model?.arms.map(arm => arm.shoulder.toArray()) ?? [],
      grips: model?.arms.map(arm => arm.grip.toArray()) ?? [],
      cuffs: model?.arms.map(arm => arm.sleeve.cuff.toArray()) ?? [],
      contacts: model?.arms.map(arm => arm.contact) ?? [],
      triangles: model?.triangles ?? 0, sleeveUpdates,
    }),
    dispose() { suspend(); mount = null; fit = undefined; disposed = true; },
  };
}
