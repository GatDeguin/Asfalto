const SHOTS = Object.freeze({ cockpit: [0, 0, 0], chase: [.7, .8, 2.6], hood: [0, .45, -2.2], cinematic: [1.8, 1.1, 3.2] });

// The approach points lie on the shipped windshields. In model space -X is
// forward, +Y is up and +Z is the driver's side.
const WINDSHIELD = Object.freeze({
  chevy: [-.2349, .158, .145],
  chevrolet_1969: [-.2209, .165, .14],
  chevy_400_1957: [-.1842, .220, .14],
  belair_1957: [-.1777, .190, .17],
  pickup_3100: [-.1758, .300, .125],
});
const APPROACH_END = .68;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

export function sampleCockpitEntrance(vehicle, eye, progress) {
  if (!Object.hasOwn(WINDSHIELD, vehicle)) return null;
  const glass = WINDSHIELD[vehicle];
  if (eye.length !== 3 || !eye.every(Number.isFinite)) return null;
  const [x, y, z] = glass;
  // Saved eye positions can be moved outside the car by the camera editor.
  if (eye[0] <= x + .008) return null;
  const inside = [Math.min(x + .065, eye[0]), y, z];
  if (progress < APPROACH_END) {
    const t = ease(progress / APPROACH_END);
    return { position: [lerp(x - 1.45, inside[0], t), y, z], inside: false };
  }
  const t = ease((progress - APPROACH_END) / (1 - APPROACH_END));
  return { position: inside.map((value, axis) => lerp(value, eye[axis], t)), inside: true };
}

/** Transient intro progress. Never writes a saved cockpit calibration. */
export function createRaceCameraEntrance({ duration = 2.25 } = {}) {
  let elapsed = duration, mode = 'cockpit';
  return Object.freeze({
    start(nextMode, { reducedMotion = false } = {}) {
      mode = Object.hasOwn(SHOTS, nextMode) ? nextMode : 'cockpit';
      elapsed = reducedMotion ? duration : 0;
    },
    cancel() { elapsed = duration; },
    step(dt = 0, { paused = false, currentMode = mode } = {}) {
      if (currentMode !== mode) elapsed = duration;
      if (!paused) elapsed = Math.min(duration, elapsed + Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0)));
      const t = Math.min(1, elapsed / duration);
      const weight = 1 - ease(t);
      return { active: t < 1, progress: t, mode, offset: SHOTS[mode].map(v => v * weight) };
    },
  });
}
