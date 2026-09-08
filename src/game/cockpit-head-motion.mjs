// Physical driver response. Coordinates returned here are local to the base
// camera: +X right, +Y up, +Z backward. No clock oscillator or random shake.
const DEG = Math.PI / 180;
export const HEAD_MOTION_DEFAULTS = Object.freeze({ enabled: true, intensity: 1, responseSpeed: 1, translationScale: 1, rotationScale: 1 });
export const HEAD_MOTION_LIMITS = Object.freeze({ translationM: Object.freeze([.035, .025, .045]), rotationRad: Object.freeze([2.5 * DEG, 1.5 * DEG, 1.5 * DEG]) });
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const vec = v => [0, 1, 2].map(i => finite(v?.[i]));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const zero = () => [0, 0, 0];
const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export function sanitizeHeadMotionCalibration(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    intensity: clamp(finite(source.intensity, 1), 0, 2),
    responseSpeed: clamp(finite(source.responseSpeed, 1), .25, 3),
    translationScale: clamp(finite(source.translationScale, 1), 0, 2),
    rotationScale: clamp(finite(source.rotationScale, 1), 0, 2),
  });
}
function quaternion(v) { const a = [0, 1, 2, 3].map(i => finite(v?.[i], i === 3 ? 1 : 0)); const norm = Math.hypot(...a); return norm > 1e-10 ? a.map(x => x / norm) : [0, 0, 0, 1]; }
function rotate(v, q) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx];
}
function conjugate(q) { return [-q[0], -q[1], -q[2], q[3]]; }
function compression(snapshot) { const map = new Map((snapshot?.wheels || []).map(w => [w.id, finite(w.compressionM)])); return ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'].map(id => map.get(id) || 0); }
function spring(state, target, dt, frequency, limit) {
  const omega = 2 * Math.PI * frequency, displacement = state.value - target, coefficient = state.velocity + omega * displacement, decay = Math.exp(-omega * dt);
  state.value = target + (displacement + coefficient * dt) * decay;
  state.velocity = (state.velocity - omega * coefficient * dt) * decay;
  if (Math.abs(state.value) > limit) { state.value = clamp(state.value, -limit, limit); if (state.velocity * state.value > 0) state.velocity = 0; }
  if (Math.abs(state.value) < 1e-12 && Math.abs(state.velocity) < 1e-12) { state.value = 0; state.velocity = 0; }
  return state.value;
}
function transform(position, rotationVector) {
  const angle = Math.hypot(...rotationVector), ratio = angle > 1e-12 ? Math.sin(angle / 2) / angle : .5;
  const q = [...rotationVector.map(v => v * ratio), Math.cos(angle / 2)], inverse = conjugate(q);
  return { positionOffsetM: position, rotationVectorRad: rotationVector, quaternion: q, compensationPositionM: rotate(position.map(v => -v), inverse).map(v => v || 0), compensationQuaternion: inverse.map(v => v || 0) };
}
/**
 * Apply H after the base camera pose; put H^-1 on a child before the authored
 * cockpit/entrance root. Applying H to the camera alone cannot create parallax
 * in camera-parented geometry. The host owns that hierarchy and its lifetime.
 */
export function createCockpitHeadMotion(options = {}) {
  let calibration = sanitizeHeadMotionCalibration(options), mode = 'cockpit', disposed = false, initialized = false, clockTime = null, elapsedSeconds = 0;
  let rest = [0, 0, 0, 0], last = null;
  const translation = Array.from({ length: 3 }, () => ({ value: 0, velocity: 0 }));
  const rotation = Array.from({ length: 3 }, () => ({ value: 0, velocity: 0 }));
  function reset(snapshot = null) {
    for (const state of [...translation, ...rotation]) { state.value = 0; state.velocity = 0; }
    initialized = Boolean(snapshot?.chassis); rest = compression(snapshot); clockTime = Number.isFinite(snapshot?.timeSeconds) ? snapshot.timeSeconds : null; elapsedSeconds = 0;
    last = freeze({ ...transform(zero(), zero()), active: false, elapsedSeconds, source: { accelerationLocalMps2: zero(), angularVelocityLocalRadps: zero(), suspensionDeltaM: [0, 0, 0, 0] } });
    return last;
  }
  reset();
  return Object.freeze({
    update(snapshot, dt = 1 / 60, context = {}) {
      const nextMode = context.mode ?? mode;
      if (nextMode !== mode) { mode = nextMode; reset(); }
      if (disposed || mode !== 'cockpit' || !calibration.enabled || calibration.intensity === 0 || context.reducedMotion || !snapshot?.chassis) return reset();
      if (context.paused || finite(dt) <= 0) return last;
      if (!initialized) return reset(snapshot);
      let step = finite(dt), time = Number.isFinite(snapshot.timeSeconds) ? snapshot.timeSeconds : null;
      if (time !== null && clockTime !== null) {
        step = time - clockTime;
        if (step < -1e-8 || step > .25) return reset(snapshot);
        if (step <= 1e-8) return last;
      }
      if (step > .25) return reset(snapshot);
      clockTime = time;
      const body = quaternion(snapshot.chassis.rotation), forward = rotate([1, 0, 0], body), up = rotate([0, 1, 0], body), right = rotate([0, 0, 1], body);
      const acceleration = vec(snapshot.chassis.acceleration), angularVelocity = vec(snapshot.chassis.angularVelocity);
      const a = [dot(acceleration, right), dot(acceleration, up), -dot(acceleration, forward)];
      const w = [dot(angularVelocity, right), dot(angularVelocity, up), -dot(angularVelocity, forward)];
      const suspension = compression(snapshot).map((v, i) => v - rest[i]);
      const front = (suspension[0] + suspension[1]) * .5, rear = (suspension[2] + suspension[3]) * .5;
      const left = (suspension[0] + suspension[2]) * .5, rightCompression = (suspension[1] + suspension[3]) * .5;
      // Translation opposes acceleration; rotational lag and spring deflection
      // give a subtle neck response on braking, cornering and road compression.
      let translationTarget = [-a[0] * .0032, -a[1] * .0015 + (front + rear) * .05, -a[2] * .004];
      let rotationTarget = [-a[2] * .0035 + (front - rear) * .35 - w[0] * .012, -w[1] * .012, a[0] * .0025 + (rightCompression - left) * .25 - w[2] * .012];
      if (context.cameraWorldQuaternion) {
        const inverseCamera = conjugate(quaternion(context.cameraWorldQuaternion));
        const toCamera = values => rotate([0, 1, 2].map(i => right[i] * values[0] + up[i] * values[1] - forward[i] * values[2]), inverseCamera);
        translationTarget = toCamera(translationTarget); rotationTarget = toCamera(rotationTarget);
      }
      const translationGain = calibration.intensity * calibration.translationScale, rotationGain = calibration.intensity * calibration.rotationScale;
      const position = translation.map((state, i) => spring(state, clamp(translationTarget[i] * translationGain, -HEAD_MOTION_LIMITS.translationM[i], HEAD_MOTION_LIMITS.translationM[i]), step, 2.6 * calibration.responseSpeed, HEAD_MOTION_LIMITS.translationM[i]));
      const rotationVector = rotation.map((state, i) => spring(state, clamp(rotationTarget[i] * rotationGain, -HEAD_MOTION_LIMITS.rotationRad[i], HEAD_MOTION_LIMITS.rotationRad[i]), step, 3 * calibration.responseSpeed, HEAD_MOTION_LIMITS.rotationRad[i]));
      elapsedSeconds += step;
      last = freeze({ ...transform(position, rotationVector), active: true, elapsedSeconds, source: { accelerationLocalMps2: a, angularVelocityLocalRadps: w, suspensionDeltaM: suspension } });
      return last;
    },
    setCalibration(value = {}) {
      calibration = sanitizeHeadMotionCalibration(value && typeof value === 'object' && Object.keys(value).length ? { ...calibration, ...value } : {});
      if (!calibration.enabled || calibration.intensity === 0) reset();
      return { ...calibration };
    },
    getCalibration: () => ({ ...calibration }),
    getState: () => last,
    reset,
    diagnostics: () => ({ calibration: { ...calibration }, mode, disposed, initialized, limits: HEAD_MOTION_LIMITS, state: last }),
    dispose() { disposed = true; reset(); },
  });
}
