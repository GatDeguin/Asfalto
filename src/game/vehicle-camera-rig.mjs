import { HEAD_MOTION_DEFAULTS, sanitizeHeadMotionCalibration } from './cockpit-head-motion.mjs';
import { interpolateVehicleSnapshot } from './physical-render-bridge.mjs?v=a7a3e535c754e44b';
import { MAX_LIFT_M, reframeCameraBoom } from './camera-boom-collision.mjs?v=32104ba795e573bb';

const DEG = Math.PI / 180;
const MODES = Object.freeze(['cockpit', 'chase', 'hood', 'cinematic']);
const TRACE_LIMIT = 600;

export const CAMERA_TOKENS = Object.freeze({
  cockpit: Object.freeze({ horizontalFovDeg: 63, anchorM: Object.freeze([0.28, 0.5, -0.34]) }),
  chase: Object.freeze({ horizontalFovDeg: 58, distanceM: 7.2, heightM: 1.45, lookAheadM: 2.8 }),
  hood: Object.freeze({ horizontalFovDeg: 63, anchorM: Object.freeze([1.72, 0.18, 0]) }),
  cinematic: Object.freeze({ horizontalFovDeg: 56, shotLengthM: 80 }),
  dynamicFovMaxDeg: 6,
  gameplayRollMaxDeg: 1.5,
});

const LENS_SENSOR_WIDTH_MM = 36;

function horizontalFovForFocalLength(focalLengthMm) {
  return 2 * Math.atan(LENS_SENSOR_WIDTH_MM / (2 * focalLengthMm)) / DEG;
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}

const cockpitLensPreset = (lensMode, focalLengthMm) => freeze({
  lensMode,
  focalLengthMm,
  baseHorizontalFovDeg: horizontalFovForFocalLength(focalLengthMm),
});

export const COCKPIT_LENS_PRESETS = freeze({
  original: freeze({ lensMode: 'original', baseHorizontalFovDeg: 63, focalLengthMm: 29.3733 }),
  '28mm': cockpitLensPreset('28mm', 28),
  '35mm': cockpitLensPreset('35mm', 35),
  '50mm': cockpitLensPreset('50mm', 50),
  '80mm': cockpitLensPreset('80mm', 80),
});

export const COCKPIT_CALIBRATION_DEFAULTS = freeze({
  positionOffsetM: [0, 0, 0],
  rotationOffsetDeg: [0, 0, 0],
  ...COCKPIT_LENS_PRESETS.original,
  headMotion: HEAD_MOTION_DEFAULTS,
});

function calibrationVector(value, fallback, minimum = -Infinity, maximum = Infinity) {
  return [0, 1, 2].map(index => clamp(finite(Array.isArray(value) ? value[index] : NaN, fallback[index]), minimum, maximum));
}

function roundedManualFocalLength(value) {
  return Math.round(clamp(finite(value, COCKPIT_CALIBRATION_DEFAULTS.focalLengthMm), 18, 120) * 10) / 10;
}

export function sanitizeCockpitCalibration(value = {}) {
  const candidate = value && typeof value === 'object' ? value : {};
  const lensMode = Object.hasOwn(COCKPIT_LENS_PRESETS, candidate.lensMode)
    ? candidate.lensMode : candidate.lensMode === 'manual' ? 'manual' : 'original';
  const lens = lensMode === 'manual'
    ? freeze({
      lensMode,
      focalLengthMm: roundedManualFocalLength(candidate.focalLengthMm),
      baseHorizontalFovDeg: horizontalFovForFocalLength(roundedManualFocalLength(candidate.focalLengthMm)),
    })
    : COCKPIT_LENS_PRESETS[lensMode];
  return freeze({
    positionOffsetM: [
      clamp(finite(candidate.positionOffsetM?.[0], COCKPIT_CALIBRATION_DEFAULTS.positionOffsetM[0]), -4, 4),
      clamp(finite(candidate.positionOffsetM?.[1], COCKPIT_CALIBRATION_DEFAULTS.positionOffsetM[1]), -2.5, 2.5),
      clamp(finite(candidate.positionOffsetM?.[2], COCKPIT_CALIBRATION_DEFAULTS.positionOffsetM[2]), -4, 4),
    ],
    rotationOffsetDeg: [
      ...calibrationVector(candidate.rotationOffsetDeg, COCKPIT_CALIBRATION_DEFAULTS.rotationOffsetDeg, -45, 45).slice(0, 1),
      ...calibrationVector(candidate.rotationOffsetDeg, COCKPIT_CALIBRATION_DEFAULTS.rotationOffsetDeg, -70, 70).slice(1, 2),
      ...calibrationVector(candidate.rotationOffsetDeg, COCKPIT_CALIBRATION_DEFAULTS.rotationOffsetDeg, -30, 30).slice(2, 3),
    ],
    ...lens,
    headMotion: sanitizeHeadMotionCalibration(candidate.headMotion),
  });
}

function copyCockpitCalibration(value) {
  return freeze({
    positionOffsetM: [...value.positionOffsetM],
    rotationOffsetDeg: [...value.rotationOffsetDeg],
    lensMode: value.lensMode,
    baseHorizontalFovDeg: value.baseHorizontalFovDeg,
    focalLengthMm: value.focalLengthMm,
    headMotion: { ...value.headMotion },
  });
}

function vector(value, fallback = [0, 0, 0]) {
  return Array.isArray(value) && value.length >= 3
    ? [finite(value[0], fallback[0]), finite(value[1], fallback[1]), finite(value[2], fallback[2])]
    : [...fallback];
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, amount) { return [a[0] * amount, a[1] * amount, a[2] * amount]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function length(a) { return Math.hypot(a[0], a[1], a[2]); }
function normalize(a, fallback = [1, 0, 0]) {
  const magnitude = length(a);
  return magnitude > 1e-9 ? scale(a, 1 / magnitude) : [...fallback];
}

function rotateAroundAxis(vectorValue, axis, angleRad) {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);
  return add(add(scale(vectorValue, cosine), scale(axis, dot(axis, vectorValue) * (1 - cosine))),
    scale([axis[1] * vectorValue[2] - axis[2] * vectorValue[1], axis[2] * vectorValue[0] - axis[0] * vectorValue[2], axis[0] * vectorValue[1] - axis[1] * vectorValue[0]], sine));
}

function rotateCockpitVector(vectorValue, basis, rotationOffsetDeg) {
  const [pitchDeg, yawDeg, rollDeg] = rotationOffsetDeg;
  // qYaw(+Y) * qPitch(+Z) * qRoll(+X): vectors receive roll, then pitch, then yaw.
  return rotateAroundAxis(
    rotateAroundAxis(
      rotateAroundAxis(vectorValue, basis.forward, rollDeg * DEG),
      basis.right, pitchDeg * DEG),
    basis.up, yawDeg * DEG);
}

function rotateByQuaternion(local, rawQuaternion) {
  const q = Array.isArray(rawQuaternion) ? rawQuaternion : [0, 0, 0, 1];
  const x = finite(q[0]); const y = finite(q[1]); const z = finite(q[2]); const w = finite(q[3], 1);
  const tx = 2 * (y * local[2] - z * local[1]);
  const ty = 2 * (z * local[0] - x * local[2]);
  const tz = 2 * (x * local[1] - y * local[0]);
  return [
    local[0] + w * tx + (y * tz - z * ty),
    local[1] + w * ty + (z * tx - x * tz),
    local[2] + w * tz + (x * ty - y * tx),
  ];
}

function bodyBasis(snapshot) {
  const rotation = snapshot?.chassis?.rotation || [0, 0, 0, 1];
  return {
    forward: normalize(rotateByQuaternion([1, 0, 0], rotation), [1, 0, 0]),
    up: normalize(rotateByQuaternion([0, 1, 0], rotation), [0, 1, 0]),
    right: normalize(rotateByQuaternion([0, 0, 1], rotation), [0, 0, 1]),
  };
}

function localPoint(origin, basis, local) {
  return add(origin, add(scale(basis.forward, local[0]), add(
    scale(basis.up, local[1]), scale(basis.right, local[2]),
  )));
}

function verticalFov(horizontalDeg, aspect) {
  const safeAspect = Math.max(0.2, finite(aspect, 16 / 9));
  return 2 * Math.atan(Math.tan(horizontalDeg * DEG * 0.5) / safeAspect) / DEG;
}

function spring(state, target, dt, frequencyHz) {
  const safeDt = clamp(finite(dt), 0, 1 / 20);
  const omega = Math.PI * 2 * frequencyHz;
  // Exact critically damped response. Semi-implicit Euler becomes unstable
  // for this frequency at the supported 50 ms frame interval.
  const displacement = state.value - target;
  const coefficient = state.velocity + omega * displacement;
  const decay = Math.exp(-omega * safeDt);
  state.value = target + (displacement + coefficient * safeDt) * decay;
  state.velocity = (state.velocity - omega * coefficient * safeDt) * decay;
  return state.value;
}

function wheelCompression(snapshot, id) {
  const wheel = snapshot?.wheels?.find?.(entry => entry?.id === id);
  return finite(wheel?.compressionM);
}

function interpolatedFromFrame(frame) {
  return interpolateVehicleSnapshot(
    frame?.previousSnapshot || frame?.currentSnapshot,
    frame?.currentSnapshot,
    frame?.alpha ?? 1,
  );
}

function setVector(target, values) {
  if (!target) return;
  if (typeof target.set === 'function') target.set(values[0], values[1], values[2]);
  else { target.x = values[0]; target.y = values[1]; target.z = values[2]; }
}

function poseTarget(mode, snapshot, frame, motion, cockpitCalibration) {
  const origin = vector(snapshot.chassis.position);
  const basis = bodyBasis(snapshot);
  let position;
  let look;
  let baseHorizontalFovDeg = CAMERA_TOKENS[mode].horizontalFovDeg;
  if (mode === 'cockpit') {
    position = localPoint(origin, basis, add(vector(frame.cockpitAnchorM,CAMERA_TOKENS.cockpit.anchorM), cockpitCalibration.positionOffsetM));
    look = add(add(position, scale(basis.forward, 14)),scale(basis.up,-Math.tan(clamp(finite(frame.cockpitLookDownDeg),0,30)*DEG)*14));
    baseHorizontalFovDeg = cockpitCalibration.baseHorizontalFovDeg;
  } else if (mode === 'hood') {
    position = localPoint(origin, basis, vector(frame.hoodAnchorM,CAMERA_TOKENS.hood.anchorM));
    look = add(position, scale(basis.forward, 18));
  } else if (mode === 'chase') {
    position = add(origin, add(
      scale(basis.forward, -CAMERA_TOKENS.chase.distanceM),
      scale(basis.up, CAMERA_TOKENS.chase.heightM),
    ));
    look = add(origin, scale(basis.forward, CAMERA_TOKENS.chase.lookAheadM));
  } else {
    const progress = Math.max(0, finite(frame?.projection?.raceProgress));
    const phase = Math.floor(progress / CAMERA_TOKENS.cinematic.shotLengthM) % 4;
    const offsets = [
      [-10.5, 2.1, 3.6],
      [5.5, 1.65, -3.1],
      [-0.8, 2.45, 6.2],
      [-7.1, 1.25, -2.4],
    ];
    position = localPoint(origin, basis, offsets[phase]);
    look = add(origin, scale(basis.forward, 4.5));
  }

  position = add(position, scale(basis.up, motion.heaveM));
  const velocity = vector(snapshot.chassis.linearVelocity);
  const speedMps = length(velocity);
  const velocityDirection = speedMps > 2 ? normalize(velocity, basis.forward) : basis.forward;
  let lookDirection = normalize(add(scale(basis.forward, 0.82), scale(velocityDirection, 0.18)), basis.forward);
  if (frame?.lookBack) lookDirection = scale(basis.forward, -1);
  const routePoint = Array.isArray(frame?.routeLookAhead)
    ? frame.routeLookAhead
    : frame?.routeLookAhead?.position;
  if (Array.isArray(routePoint) && routePoint.length >= 3) {
    const routeDirection = normalize(subtract(vector(routePoint), origin), lookDirection);
    lookDirection = normalize(add(scale(lookDirection, 0.9), scale(routeDirection, 0.1)), lookDirection);
  }
  let up = basis.up;
  if (mode === 'cockpit') {
    const dynamicDirectionDelta = subtract(lookDirection, basis.forward);
    lookDirection = normalize(add(rotateCockpitVector(basis.forward, basis, cockpitCalibration.rotationOffsetDeg), dynamicDirectionDelta), basis.forward);
    up = normalize(rotateCockpitVector(basis.up, basis, cockpitCalibration.rotationOffsetDeg), basis.up);
  }
  lookDirection = normalize(add(lookDirection, scale(basis.up, -motion.pitchRad)), lookDirection);
  const lookDistance = mode === 'chase' || mode === 'cinematic' ? 8 : 14;
  look = frame?.lookBack
    ? add(position, scale(lookDirection, lookDistance))
    : add(look, scale(subtract(lookDirection, basis.forward), lookDistance));
  const dynamicFov = clamp(speedMps / 60, 0, 1) * CAMERA_TOKENS.dynamicFovMaxDeg;
  const dynamicFovDeltaDeg = mode === 'cockpit' ? dynamicFov * 0.25
    : mode === 'hood' ? dynamicFov * 0.5 : dynamicFov;
  const horizontalFovDeg = baseHorizontalFovDeg + dynamicFovDeltaDeg;
  const roll = clamp(
    motion.rollRad,
    -CAMERA_TOKENS.gameplayRollMaxDeg * DEG,
    CAMERA_TOKENS.gameplayRollMaxDeg * DEG,
  );
  up = normalize(add(up, scale(basis.right, Math.tan(roll))), up);
  return { baseHorizontalFovDeg, basis, dynamicFovDeltaDeg, horizontalFovDeg, look, position, speedMps, up };
}

export function createVehicleCameraRig(options = {}) {
  const camera = options.camera;
  if (!camera?.position || !camera?.up || typeof camera.lookAt !== 'function') {
    throw new TypeError('createVehicleCameraRig requiere camera Three compatible');
  }
  const collisionQuery = typeof options.collisionQuery === 'function' ? options.collisionQuery : null;
  let mode = 'cockpit';
  let initialized = false;
  let position = [0, 0, 0];
  let look = [1, 0, 0];
  let rearPosition = [0, 0, 0];
  let rearLook = [-1, 0, 0];
  let collisionLiftM = 0;
  let lastOutput = null;
  const trace = [];
  const pitch = { value: 0, velocity: 0 };
  const roll = { value: 0, velocity: 0 };
  const heave = { value: 0, velocity: 0 };
  let cockpitCalibration = COCKPIT_CALIBRATION_DEFAULTS;

  function resetMotion() {
    for (const state of [pitch, roll, heave]) { state.value = 0; state.velocity = 0; }
    collisionLiftM = 0;
  }

  function physicalMotion(snapshot, dt) {
    const basis = bodyBasis(snapshot);
    const acceleration = vector(snapshot.chassis.acceleration);
    const angularVelocity = vector(snapshot.chassis.angularVelocity);
    const front = (wheelCompression(snapshot, 'frontLeft') + wheelCompression(snapshot, 'frontRight')) * 0.5;
    const rear = (wheelCompression(snapshot, 'rearLeft') + wheelCompression(snapshot, 'rearRight')) * 0.5;
    const left = (wheelCompression(snapshot, 'frontLeft') + wheelCompression(snapshot, 'rearLeft')) * 0.5;
    const right = (wheelCompression(snapshot, 'frontRight') + wheelCompression(snapshot, 'rearRight')) * 0.5;
    const average = (front + rear) * 0.5;
    const pitchTarget = clamp(-dot(acceleration, basis.forward) * 0.004 + (front - rear) * 0.55, -3 * DEG, 3 * DEG);
    const rollTarget = clamp(-dot(acceleration, basis.right) * 0.003 + (right - left) * 0.55
      + dot(angularVelocity, basis.forward) * 0.006, -1.5 * DEG, 1.5 * DEG);
    const heaveTarget = clamp(dot(acceleration, basis.up) * 0.002 - average * 0.15, -0.08, 0.08);
    return {
      pitchRad: spring(pitch, pitchTarget, dt, 2.8),
      rollRad: spring(roll, rollTarget, dt, 3.2),
      heaveM: spring(heave, heaveTarget, dt, 3.6),
    };
  }

  function resolveCollision(snapshot, target, aim) {
    if (!collisionQuery || (mode !== 'chase' && mode !== 'cinematic')) return target;
    const origin = vector(snapshot.chassis.position);
    const result = collisionQuery({ from: origin, to: [...target], look: aim ? [...aim] : undefined, baseHeight: position[1], radius: 0.24, mode });
    if (Array.isArray(result)) return vector(result, target);
    if (Array.isArray(result?.position)) return vector(result.position, target);
    return target;
  }

  function apply(frame, dt, snap) {
    const snapshot = interpolatedFromFrame(frame);
    if (!snapshot) return false;
    const suppressCockpitMotion = mode === 'cockpit' && options.cockpitPhysicalMotion === false;
    const motion = snap || suppressCockpitMotion ? { pitchRad: 0, rollRad: 0, heaveM: 0 } : physicalMotion(snapshot, dt);
    const target = poseTarget(mode, snapshot, frame, motion, cockpitCalibration);
    // Geometry-based interiors share the interpolated chassis pose; world-space lag
    // would pull the eye outside the cabin at speed. Head motion is applied separately.
    if (!initialized || snap || (mode === 'cockpit' && frame.bodyMountedCockpit)) {
      position = [...target.position];
      look = [...target.look];
    } else {
      const delta = subtract(target.position, position);
      if (mode === 'chase') {
        const longitudinal = dot(delta, target.basis.forward);
        const vertical = dot(delta, target.basis.up);
        const lateral = dot(delta, target.basis.right);
        position = add(position, add(
          scale(target.basis.forward, longitudinal * (1 - Math.exp(-5 * dt))),
          add(scale(target.basis.up, vertical * (1 - Math.exp(-7 * dt))),
            scale(target.basis.right, lateral * (1 - Math.exp(-9 * dt)))),
        ));
      } else {
        const response = 1 - Math.exp(-(mode === 'cockpit' ? 12 : 8) * dt);
        position = position.map((value, index) => value + (target.position[index] - value) * response);
      }
      const lookResponse = 1 - Math.exp(-10 * dt);
      look = look.map((value, index) => value + (target.look[index] - value) * lookResponse);
    }

    // Keep the unobstructed smoothing state independent of collision response.
    // Only the rendered pose lifts: no shortening or horizontal drift, and
    // height/orientation share one release state instead of separate damping.
    const baseView = { from: vector(snapshot.chassis.position), to: position, look, up: target.up, mode };
    let resolved = resolveCollision(snapshot, position, look);
    // Solve the compensated aim before temporal release; otherwise the
    // correction feeds back into itself and a stationary obstacle creeps up.
    if (resolved[1] > position[1]) {
      for (let i = 0; i < 16; i++) {
        const aim = reframeCameraBoom(baseView, resolved).look;
        const next = resolveCollision(snapshot, resolved, aim);
        const delta = next[1] - resolved[1];
        resolved = next;
        if (delta <= 0) break;
        if (delta < 1e-5) {
          resolved = [resolved[0], Math.min(position[1] + 4, resolved[1] + 1e-4), resolved[2]];
          break;
        }
      }
    }
    const requiredLift = Math.max(0, resolved[1] - position[1]);
    // Integrate dL/dt = -min(7L, 8 m/s) exactly: the longer boom must
    // return smoothly at every render rate without delaying obstacle clearance.
    const releaseThreshold = 8 / 7;
    const linearTime = Math.min(dt, Math.max(0, (collisionLiftM - releaseThreshold) / 8));
    const releasedLift = (collisionLiftM - linearTime * 8) * Math.exp(-7 * (dt - linearTime));
    collisionLiftM = Math.max(requiredLift, (!initialized || snap) ? 0 : releasedLift);
    if (collisionLiftM < 1e-6) collisionLiftM = 0;
    let viewPosition = collisionLiftM > 0 ? [resolved[0], position[1] + collisionLiftM, resolved[2]] : resolved;
    let view = reframeCameraBoom(baseView, viewPosition);
    if (collisionLiftM > 0) {
      // Recheck the actual compensated aim line as well as the subject boom.
      viewPosition = resolveCollision(snapshot, viewPosition, view.look);
      collisionLiftM = Math.max(collisionLiftM, viewPosition[1] - position[1]);
      view = reframeCameraBoom(baseView, viewPosition);
    }

    const rearTargetPosition = localPoint(vector(snapshot.chassis.position), target.basis, [0.1, 0.52, 0]);
    const rearTargetLook = add(rearTargetPosition, scale(target.basis.forward, -12));
    if (!initialized || snap || (mode === 'cockpit' && frame.bodyMountedCockpit)) {
      rearPosition = rearTargetPosition;
      rearLook = rearTargetLook;
    } else {
      const rearResponse = 1 - Math.exp(-12 * dt);
      rearPosition = rearPosition.map((value, index) => value + (rearTargetPosition[index] - value) * rearResponse);
      rearLook = rearLook.map((value, index) => value + (rearTargetLook[index] - value) * rearResponse);
    }

    setVector(camera.position, viewPosition);
    setVector(camera.up, view.up);
    camera.lookAt(view.look[0], view.look[1], view.look[2]);
    const verticalFovDeg = verticalFov(target.horizontalFovDeg, camera.aspect);
    camera.fov = verticalFovDeg;
    camera.updateProjectionMatrix?.();
    initialized = true;
    lastOutput = freeze({
      mode,
      position: [...viewPosition],
      look: [...view.look],
      up: [...view.up],
      horizontalFovDeg: target.horizontalFovDeg,
      baseHorizontalFovDeg: target.baseHorizontalFovDeg,
      dynamicFovDeltaDeg: target.dynamicFovDeltaDeg,
      finalHorizontalFovDeg: target.horizontalFovDeg,
      verticalFovDeg,
      motion: { ...motion },
      collision: {
        basePosition: [...position],
        appliedLiftM: viewPosition[1] - position[1],
        maxLiftM: MAX_LIFT_M,
      },
      rearPose: { position: [...rearPosition], look: [...rearLook] },
    });
    trace.push(lastOutput);
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
    return lastOutput;
  }

  return Object.freeze({
    setMode(value) {
      const next = MODES.includes(value) ? value : 'cockpit';
      if (next !== mode) {
        mode = next;
        initialized = false;
        resetMotion();
      }
      return mode;
    },
    applyReferenceFrame(transform) {
      if (!transform || typeof transform.point !== 'function' || typeof transform.vector !== 'function') throw new TypeError('camera reference transform is required');
      const remap = output => output ? freeze({ ...output,
        position:transform.point(output.position),look:transform.point(output.look),up:transform.vector(output.up),
        collision:{...output.collision,basePosition:transform.point(output.collision.basePosition)},
        rearPose:{position:transform.point(output.rearPose.position),look:transform.point(output.rearPose.look)},
      }) : output;
      const renderedPosition=transform.point([camera.position.x,camera.position.y,camera.position.z]);
      position=transform.point(position);look=transform.point(look);rearPosition=transform.point(rearPosition);rearLook=transform.point(rearLook);
      lastOutput=remap(lastOutput);for(let i=0;i<trace.length;i++)trace[i]=remap(trace[i]);
      setVector(camera.position,renderedPosition);setVector(camera.up,transform.vector([camera.up.x,camera.up.y,camera.up.z]));
      const aim=lastOutput?.look||look;camera.lookAt(aim[0],aim[1],aim[2]);
      return lastOutput;
    },
    update(frame, dt = 1 / 60) { return apply(frame, clamp(finite(dt, 1 / 60), 0, 1 / 20), false); },
    reset(frame) {
      initialized = false;
      resetMotion();
      return apply(frame, 0, true);
    },
    setCockpitCalibration(value) {
      cockpitCalibration = sanitizeCockpitCalibration(value);
      return copyCockpitCalibration(cockpitCalibration);
    },
    getCockpitCalibration() { return copyCockpitCalibration(cockpitCalibration); },
    resetCockpitCalibration() {
      cockpitCalibration = COCKPIT_CALIBRATION_DEFAULTS;
      return copyCockpitCalibration(cockpitCalibration);
    },
    diagnostics() {
      return freeze({
        mode,
        initialized,
        tokens: CAMERA_TOKENS,
        cockpitCalibration: copyCockpitCalibration(cockpitCalibration),
        baseHorizontalFovDeg: lastOutput?.baseHorizontalFovDeg ?? cockpitCalibration.baseHorizontalFovDeg,
        dynamicFovDeltaDeg: lastOutput?.dynamicFovDeltaDeg ?? 0,
        finalHorizontalFovDeg: lastOutput?.finalHorizontalFovDeg ?? cockpitCalibration.baseHorizontalFovDeg,
        lastOutput,
        trace: [...trace],
      });
    },
  });
}

export { MODES as CAMERA_MODES };
