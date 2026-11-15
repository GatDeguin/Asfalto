import { createCockpitDriverAvatar } from './cockpit-driver-avatar.mjs?v=c172d108037bb90d';

const DEG = Math.PI / 180;
const GRIP_CYCLE = 1.8;
const CONTACT_ARC = 1.12;
const FOLLOW_THROUGH = 34 * DEG;
const FULL_REGRIP = 106 * DEG;
const UPPER_GRIP = 40 * DEG;
const LOWER_GRIP = 146 * DEG;
const RIM_CLOSURE = .17;
// Segment lengths in the same reference scale as the authored hand.
const UPPER_ARM = .320;
const FOREARM = .260;
const reachAtBend = degrees => Math.sqrt(UPPER_ARM ** 2 + FOREARM ** 2 + 2 * UPPER_ARM * FOREARM * Math.cos(degrees * DEG));
const REACH_SHORT = reachAtBend(138);
const REACH_LONG = reachAtBend(24);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const wrap = (n, cycle) => ((n % cycle) + cycle) % cycle;
const ease = t => t * t * (3 - 2 * t);

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
  const tangent = new T.Vector3(), anchor = new T.Vector3(), gearAnchor = new T.Vector3(0, .075, -.028);
  const knobGrip = new T.Vector3(), aim = new T.Vector3(), shiftAim = new T.Vector3();
  const direction = new T.Vector3(), pole = new T.Vector3(), swivel = new T.Vector3(), forearm = new T.Vector3();
  const palmRight = new T.Vector3(), palmBack = new T.Vector3(), palmBasis = new T.Matrix4();
  const wristOffset = new T.Vector3(), wristDirection = new T.Vector3(), cuffAim = new T.Vector3();
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
    const regrip = reducedMotion ? 0 : ease(clamp((Math.abs(sweep) - FOLLOW_THROUGH) / (FULL_REGRIP - FOLLOW_THROUGH), 0, 1));
    const baseGrip = settings.gripDeg * DEG;

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
    // Reserve the wheel end of the shift for opening and closing on the rim.
    shiftBlend = ease(clamp((progress - RIM_CLOSURE) / (1 - RIM_CLOSURE), 0, 1));

    for (let index = 0; index < model.arms.length; index++) {
      const arm = model.arms[index], { handMesh, sleeve } = arm;
      const side = index === 0 ? -1 : 1;
      // Stagger the regrip windows so one hand always has the rim.
      const phaseAtRest = index === 0 ? .19 : .22;
      const phase = wrap(phaseAtRest - side * sweep, GRIP_CYCLE);
      const release = clamp((phase - CONTACT_ARC) / (GRIP_CYCLE - CONTACT_ARC), 0, 1);
      const arc = release > 0 ? (1 - ease(release)) * CONTACT_ARC : phase;
      // In an ordinary turn both hands first move with the actual rim. Larger
      // rotations gradually transfer into regrips within each hand's sector.
      const follow = clamp(baseGrip - side * sweep, UPPER_GRIP, LOWER_GRIP);
      const recover = clamp(baseGrip + arc - phaseAtRest, UPPER_GRIP, LOWER_GRIP);
      const sector = follow + (recover - follow) * regrip;
      const angle = side * sector + twist;
      wheelHand.copy(fit.center).addScaledVector(fit.up, Math.cos(angle) * fit.radius)
        .addScaledVector(fit.right, Math.sin(angle) * fit.radius).applyMatrix4(wheelFrame);
      const shift = side === 1 ? shiftBlend : 0;
      const onlyWheelHand = side === -1 && progress > 0;
      const reposition = onlyWheelHand ? 0 : regrip;
      const loosen = ease(clamp((release - .12) / .18, 0, 1)) * ease(clamp((.80 - release) / .18, 0, 1)) * reposition;
      const releaseFingers = ease(clamp(release / .18, 0, 1)) * ease(clamp((1 - release) / .16, 0, 1)) * reposition;
      const shiftFingers = side === 1 ? ease(clamp(progress / RIM_CLOSURE, 0, 1)) * (1 - ease(clamp(shift / .26, 0, 1))) : 0;
      const transit = Math.sin(Math.PI * shift);
      const grasp = ease(clamp((shift - .53) / .47, 0, 1));
      const open = transit * (1 - grasp);
      const rimOpen = Math.min(1 - open - grasp, Math.max(releaseFingers * (1 - shift), shiftFingers));
      radial.subVectors(wheelHand, center).normalize();
      tangent.crossVectors(wheelNormal, radial).multiplyScalar(side);
      arm.grip.copy(wheelHand).addScaledVector(wheelNormal, loosen * scale * .017);
      // The authored frame points toward the hub, along the rim and toward the driver.
      const { forward, back: dorsal } = model.wheel;
      aim.copy(radial).multiplyScalar(-forward.x).addScaledVector(tangent, forward.y).addScaledVector(wheelNormal, forward.z);
      palmBack.copy(radial).multiplyScalar(-dorsal.x).addScaledVector(tangent, dorsal.y).addScaledVector(wheelNormal, dorsal.z);
      if (shift > 0) {
        arm.grip.lerp(knobGrip, shift).addScaledVector(up, transit * scale * .080).addScaledVector(back, transit * scale * .067);
        aim.lerp(shiftAim.copy(back).negate().addScaledVector(up, -.24).normalize(), shift).normalize();
        palmBack.lerp(up, shift);
      }
      palmRight.crossVectors(aim, palmBack).normalize();
      palmBack.crossVectors(palmRight, aim);
      anchor.copy(model.wheel.anchor).lerp(gearAnchor, shift);
      handMesh.position.copy(arm.grip).addScaledVector(palmRight, side * anchor.x * scale)
        .addScaledVector(aim, -anchor.y * scale).addScaledVector(palmBack, -anchor.z * scale);
      // The grip frame follows the rim. The cuffs follow the authored wrist in
      // that frame, using the same weights as the surface morphs.
      const { wheel, reach, shifter } = model.wrists, planted = 1 - open - grasp;
      wristOffset.copy(wheel.offset).multiplyScalar(planted).addScaledVector(reach.offset, open).addScaledVector(shifter.offset, grasp);
      wristDirection.copy(wheel.direction).multiplyScalar(planted).addScaledVector(reach.direction, open).addScaledVector(shifter.direction, grasp);
      arm.wrist.copy(handMesh.position).addScaledVector(palmRight, -side * wristOffset.x * scale)
        .addScaledVector(aim, wristOffset.y * scale).addScaledVector(palmBack, wristOffset.z * scale);
      cuffAim.copy(palmRight).multiplyScalar(-side * wristDirection.x).addScaledVector(aim, wristDirection.y)
        .addScaledVector(palmBack, wristDirection.z).normalize();
      arm.contact = shift > .99 ? 'shifter' : shift > 0 || loosen > .02 ? 'reach' : 'wheel';
      arm.shoulder.copy(center).addScaledVector(back, scale * (.49 + settings.shoulderReachCm / 100))
        .addScaledVector(up, scale * (.062 + settings.shoulderHeightCm / 100)).addScaledVector(right, scale * .151 * side);
      direction.subVectors(arm.wrist, arm.shoulder);
      const requestedDistance = direction.length();
      direction.normalize();
      if (requestedDistance < 1e-5) direction.copy(back).negate();
      const distance = clamp(requestedDistance, scale * REACH_SHORT, scale * REACH_LONG);
      // Give extreme seat adjustments some shoulder travel. Bone lengths and
      // the contact at the wheel or knob come from the same rig at every frame.
      arm.shoulder.copy(arm.wrist).addScaledVector(direction, -distance);
      const upper = scale * UPPER_ARM, lower = scale * FOREARM;
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
      pole.copy(up).negate().addScaledVector(right, side * .32).addScaledVector(direction, -pole.dot(direction)).normalize();
      if (pole.lengthSq() < .5) pole.copy(right).multiplyScalar(side).addScaledVector(direction, -side * right.dot(direction)).normalize();
      swivel.crossVectors(direction, pole);
      forearm.copy(cuffAim).addScaledVector(palmBack, -.15).normalize();
      // Swivel within the downward elbow cone toward the wrist, without a
      // discontinuous flip when the steering changes direction.
      pole.addScaledVector(swivel, clamp(-2.15 * forearm.dot(swivel), -1.1, 1.1)).normalize();
      arm.elbow.copy(arm.shoulder).addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
      arm.wristAlignment = forearm.subVectors(arm.wrist, arm.elbow).normalize().dot(cuffAim);
      handMesh.quaternion.setFromRotationMatrix(palmBasis.makeBasis(palmRight, aim, palmBack));
      handMesh.scale.set(-side * scale, scale, scale);
      const targets = handMesh.morphTargetInfluences;
      targets[0] = open; targets[1] = grasp; targets[2] = rimOpen;
      if (sleeve.update(arm.shoulder, arm.elbow, arm.wrist, cuffAim, palmRight, scale)) sleeveUpdates++;
    }
  }

  return {
    bind, update, suspend,
    diagnostics: () => ({
      visible: model?.root.visible === true, fitted: !!fit, shiftBlend,
      hands: model?.arms.map(arm => arm.wrist.toArray()) ?? [],
      shoulders: model?.arms.map(arm => arm.shoulder.toArray()) ?? [],
      elbows: model?.arms.map(arm => arm.elbow.toArray()) ?? [],
      wristAngles: model?.arms.map(arm => Math.acos(clamp(arm.wristAlignment, -1, 1)) / DEG) ?? [],
      grips: model?.arms.map(arm => arm.grip.toArray()) ?? [],
      cuffs: model?.arms.map(arm => arm.sleeve.cuff.toArray()) ?? [],
      contacts: model?.arms.map(arm => arm.contact) ?? [],
      triangles: model?.triangles ?? 0, sleeveUpdates,
    }),
    dispose() { suspend(); mount = null; fit = undefined; disposed = true; },
  };
}
