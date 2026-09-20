const SHOTS = Object.freeze({ cockpit: [0, 0, -4.2], chase: [.7, .8, 2.6], hood: [0, .45, -2.2], cinematic: [1.8, 1.1, 3.2] });

/** Transient camera-space offset. Never writes a saved cockpit calibration. */
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
      const weight = 1 - t * t * t * (t * (t * 6 - 15) + 10);
      return { active: t < 1, progress: t, mode, offset: SHOTS[mode].map(v => v * weight), cockpitCompensationZ: mode === 'cockpit' ? -SHOTS.cockpit[2] * weight : 0 };
    },
  });
}
