import { createCockpitDriverAvatar } from './cockpit-driver-avatar.mjs?v=1046ad36b705409b';

const DEG = Math.PI / 180;
const GRIP_CYCLE = 1.8;
const CONTACT_ARC = 1.12;
const FOLLOW_THROUGH = 34 * DEG;
const FULL_REGRIP = 106 * DEG;
const UPPER_GRIP = 40 * DEG;
const LOWER_GRIP = 146 * DEG;
const RIM_CLOSURE = .17;
const KNOB_CONTACT = .81;
const RIM_ADJUSTMENT = .006;
const STILL_WHEEL_RATE = .14;
const FIRST_GRIP_PAUSE = .64;
// Each finger group has its own opening and closing window within the gesture.
// Entries are [start, end, flexion] for index/middle, ring/little and thumb.
const RESTING_GRIP_GESTURES = [
  { hand: 1, pause: 1.25, duration: 1.14, wrist: .88, fingers: [[.10, .81, .16], [.02, .86, .30], [.22, .93, .13]] },
  { hand: 0, pause: .90, duration: 1.31, wrist: -.82, fingers: [[.11, .79, .20], [.24, .93, .17], [.02, .87, .12]] },
  { hand: 1, pause: 1.34, duration: .97, wrist: -.62, fingers: [[.01, .76, .20], [.19, .91, .11], [.16, .98, .10]] },
  { hand: 0, pause: .76, duration: 1.20, wrist: .76, fingers: [[.21, .88, .15], [.03, .77, .28], [.24, .99, .09]] },
  { hand: 1, pause: 1.08, duration: 1.28, wrist: .57, fingers: [[.18, .95, .12], [.18, .84, .20], [.04, .74, .12]] },
  { hand: 0, pause: 1.52, duration: 1.13, wrist: -.64, fingers: [[.04, .82, .17], [.13, .86, .23], [.21, .96, .10]] },
];
const GRIP_PAUSE_VARIATIONS = [0, .31, .09, .43, .17];
// Segment lengths in the same reference scale as the authored hand.
const UPPER_ARM = .320;
const FOREARM = .260;
const reachAtBend = degrees => Math.sqrt(UPPER_ARM ** 2 + FOREARM ** 2 + 2 * UPPER_ARM * FOREARM * Math.cos(degrees * DEG));
const REACH_SHORT = reachAtBend(138);
const REACH_LONG = reachAtBend(24);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const wrap = (n, cycle) => ((n % cycle) + cycle) % cycle;
const ease = t => t * t * (3 - 2 * t);
const unit = value => clamp(value, 0, 1);
function settle(value, target, rate, dt) {
  const next = target + (value - target) * Math.exp(-rate * dt);
  return Math.abs(next - target) < .0004 ? target : next;
}

function gripPulse(time, start, end) {
  const phase = (time - start) / (end - start);
  return ease(unit(phase / .37)) * ease(unit((1 - phase) / .58));
}

function createRestingGrip() {
  const pose = { hand: 1, wrist: 0, fingers: [0, 0, 0] };
  let index = 0, pauseVariation = 0, time = -FIRST_GRIP_PAUSE, blend = 0;

  function clearPose() {
    pose.wrist = 0;
    pose.fingers.fill(0);
  }
  function reset() {
    index = pauseVariation = blend = 0;
    time = -FIRST_GRIP_PAUSE;
    clearPose();
  }
  function update(dt, steady) {
    let gesture = RESTING_GRIP_GESTURES[index];
    blend = unit(blend + dt / (steady ? .24 : -.18));
    if (steady) time += dt;
    if (time >= gesture.duration || (!steady && blend === 0 && time >= 0)) {
      const remainder = Math.max(0, time - gesture.duration);
      index = (index + 1) % RESTING_GRIP_GESTURES.length;
      gesture = RESTING_GRIP_GESTURES[index];
      time = remainder - gesture.pause - GRIP_PAUSE_VARIATIONS[pauseVariation];
      pauseVariation = (pauseVariation + 1) % GRIP_PAUSE_VARIATIONS.length;
    }
    pose.hand = gesture.hand;
    if (time < 0 || blend === 0) {
      clearPose();
      return;
    }
    const phase = time / gesture.duration;
    const strength = ease(blend);
    pose.wrist = gesture.wrist * gripPulse(phase, 0, .96) * strength;
    for (let channel = 0; channel < pose.fingers.length; channel++) {
      const [start, end, amount] = gesture.fingers[channel];
      pose.fingers[channel] = amount * gripPulse(phase, start, end) * strength;
    }
  }
  return { pose, update, reset };
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
  const restingGrip = createRestingGrip();
  let mount = null, fit, model = null, disposed = false;
  let shiftBlend = 0, sleeveUpdates = 0;
  let previousSweep;

  function hide() {
    shiftBlend = 0;
    restingGrip.reset();
    previousSweep = undefined;
    if (!model) return;
    model.root.visible = false;
    for (const arm of model.arms) {
      arm.gripAdjustment = 0;
      arm.fingerFlex.fill(0);
    }
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
  function update({ settings, active, shiftProgress = 0, wheelSpinRad, steeringRateRadS = 0, dt, paused, reducedMotion } = {}) {
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
    let progress = 0;
    if (knob && shiftProgress > 0 && settings.shiftEnabled && !reducedMotion) {
      knob.getWorldPosition(knobGrip).applyMatrix4(inverse);
      if (knobGrip.distanceTo(center) < scale * .92) progress = unit(shiftProgress);
    }
    // Both ends of the reach reserve time for fingers to move at fixed contact.
    shiftBlend = ease(unit((progress - RIM_CLOSURE) / (KNOB_CONTACT - RIM_CLOSURE)));
    const steeringRate = Number.isFinite(steeringRateRadS) ? steeringRateRadS : 0;
    const steeringEffort = clamp(steeringRate / 4, -1, 1);
    const elapsed = clamp(dt || 0, 0, .05);
    if (reducedMotion) restingGrip.reset();
    else if (!paused && elapsed > 0) {
      const rimIsStable = previousSweep === undefined || Math.abs(sweep - previousSweep) <= STILL_WHEEL_RATE * elapsed;
      restingGrip.update(elapsed, rimIsStable && Math.abs(steeringRate) <= STILL_WHEEL_RATE && regrip < .1 && progress === 0);
    }
    previousSweep = sweep;
    const idle = restingGrip.pose;

    for (let index = 0; index < model.arms.length; index++) {
      const arm = model.arms[index], { handMesh, sleeve } = arm;
      const side = index === 0 ? -1 : 1;
      const adjustsAtRest = idle.hand === index;
      const handProgress = side === 1 ? progress : 0;
      const rimRelease = ease(unit(handProgress / RIM_CLOSURE));
      if (reducedMotion) {
        arm.gripAdjustment = 0;
        arm.fingerFlex.fill(0);
      } else if (!paused && elapsed > 0) {
        // The adjusting hand yields more than the hand bracing the wheel.
        const yieldOnRim = .28 * Math.abs(steeringEffort) + .72 * Math.max(0, side * steeringEffort);
        arm.gripAdjustment = settle(arm.gripAdjustment, -side * yieldOnRim, 11, elapsed);
        arm.fingerFlex[0] = settle(arm.fingerFlex[0], yieldOnRim * .20, 15, elapsed);
        arm.fingerFlex[1] = settle(arm.fingerFlex[1], yieldOnRim * .30, 8, elapsed);
        arm.fingerFlex[2] = settle(arm.fingerFlex[2], yieldOnRim * .13, 19, elapsed);
      }
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
      // Move the contact frame along the measured rim, preserving radial support.
      const wristAdjustment = clamp(arm.gripAdjustment + (adjustsAtRest ? side * idle.wrist : 0), -1, 1);
      const arcAdjustment = wristAdjustment * RIM_ADJUSTMENT * (1 - regrip) * (1 - rimRelease);
      const angle = side * sector + twist + arcAdjustment;
      wheelHand.copy(fit.center).addScaledVector(fit.up, Math.cos(angle) * fit.radius)
        .addScaledVector(fit.right, Math.sin(angle) * fit.radius).applyMatrix4(wheelFrame);
      const shift = side === 1 ? shiftBlend : 0;
      const onlyWheelHand = side === -1 && progress > 0;
      const reposition = onlyWheelHand ? 0 : regrip;
      const loosen = ease(clamp((release - .12) / .18, 0, 1)) * ease(clamp((.80 - release) / .18, 0, 1)) * reposition;
      const releaseFingers = ease(clamp(release / .18, 0, 1)) * ease(clamp((1 - release) / .16, 0, 1)) * reposition;
      const transit = 4 * shift * (1 - shift);
      const grasp = ease(unit((handProgress - KNOB_CONTACT) / (1 - KNOB_CONTACT)));
      const open = ease(unit((handProgress - RIM_CLOSURE) / .24)) * (1 - grasp);
      const rimOpen = (1 - open - grasp) * Math.max(releaseFingers * (1 - shift), rimRelease);
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
      arm.contact = grasp === 1 ? 'shifter' : shift > 0 || loosen > .02 ? 'reach' : 'wheel';
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
      const gripFlex = Math.max(0, 1 - open - grasp - rimOpen);
      for (let channel = 0; channel < arm.fingerFlex.length; channel++) {
        const pressure = Math.max(arm.fingerFlex[channel], adjustsAtRest ? idle.fingers[channel] : 0);
        targets[3 + channel] = pressure * gripFlex;
      }
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
      knob: shiftBlend > 0 ? knobGrip.toArray() : null,
      fingerFlex: model?.arms.map(arm => arm.handMesh.morphTargetInfluences.slice(3)) ?? [],
      cuffs: model?.arms.map(arm => arm.sleeve.cuff.toArray()) ?? [],
      contacts: model?.arms.map(arm => arm.contact) ?? [],
      triangles: model?.triangles ?? 0, sleeveUpdates,
    }),
    dispose() { suspend(); mount = null; fit = undefined; disposed = true; },
  };
}
