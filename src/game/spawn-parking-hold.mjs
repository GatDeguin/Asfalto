export const SPAWN_PARKING_LABEL = 'Freno de estacionamiento · acelerá para salir';

// A spawn convenience only: the normal tyre/brake solver still supplies the holding force.
// Once the driver requests throttle, coasting (including neutral) remains fully physical.
export function createSpawnParkingHold() {
  let held = true;
  return Object.freeze({
    get held() { return held; },
    reset({ speedMps = 0 } = {}) { held = Math.abs(Number(speedMps) || 0) < 0.25; },
    apply(frame = {}) {
      if (Number(frame.throttle) > 0.05) held = false;
      return held ? { ...frame, brake: 1, handbrake: 1 } : frame;
    },
  });
}

export function syncSpawnParkingHint(cue, visible) {
  if (!cue) return;
  const ours = cue.dataset.spawnParkingHold === 'true' && cue.textContent === SPAWN_PARKING_LABEL;
  if (!ours) delete cue.dataset.spawnParkingHold;
  if (visible && (!cue.textContent || ours)) {
    if (!ours) cue.textContent = SPAWN_PARKING_LABEL;
    cue.dataset.spawnParkingHold = 'true';
    cue.classList.add('show');
  } else if (!visible && ours) {
    cue.textContent = '';
    delete cue.dataset.spawnParkingHold;
    cue.classList.remove('show');
  }
}
