const CONTACT_HOLD = .065;
const DRAG_REACH = .13;
const RETURN_RATIO = 1.12;
const ease = t => t * t * (3 - 2 * t);

// This owns the visible mechanism only. The gearbox runs its own accepted path
// immediately. Reusing its H-pattern and timing keeps the gesture believable.
export function createCockpitShiftMotion(buildPath, segmentSeconds) {
  const pose = { x: 0, y: 0, reach: 0, phase: 'wheel' };
  let observedPath, segments = null, segment = 0, time = 0, hold = 0, ownsLever = false;

  function copyPosition({ x, y }) {
    pose.x = x;
    pose.y = y;
  }

  function reset(gear) {
    observedPath = gear.path;
    segments = null;
    ownsLever = false;
    hold = 0;
    pose.reach = 0;
    pose.phase = 'wheel';
    copyPosition(gear);
    return pose;
  }

  function update(gear, { enabled, grabbing, paused, dt, reachSeconds, shiftSpeed }) {
    if (!enabled) return reset(gear);
    if (observedPath === undefined) copyPosition(gear.path?.[0] ?? gear);
    if (paused) return pose;
    let remaining = Math.max(0, Math.min(.05, dt || 0));
    const newPath = gear.path !== observedPath && gear.path;
    observedPath = gear.path;

    if (grabbing) {
      // The knob follows the pointer directly. The arm catches up to its live pose.
      segments = null;
      hold = 0;
      ownsLever = true;
      copyPosition(gear);
      pose.reach = Math.min(1, pose.reach + remaining / Math.min(DRAG_REACH, reachSeconds));
      pose.phase = pose.reach === 1 ? 'drag' : 'reach';
      return pose;
    }

    if (newPath) {
      const path = buildPath(pose, gear.requested);
      segments = path.slice(1).map((end, index) => {
        const start = path[index];
        return { start, end, duration: segmentSeconds(start, end, shiftSpeed) };
      });
      if (!segments.length) segments = null;
      ownsLever = true;
      segment = 0;
      time = hold = 0;
    }

    if (segments && pose.reach < 1) {
      const outstanding = (1 - pose.reach) * reachSeconds;
      const consumed = Math.min(remaining, outstanding);
      pose.reach = consumed === outstanding ? 1 : pose.reach + consumed / reachSeconds;
      pose.phase = 'reach';
      remaining -= consumed;
      if (pose.reach < 1) return pose;
    }

    if (segments) {
      pose.phase = 'shift';
      while (segments && remaining > 1e-7) {
        const { start, end, duration } = segments[segment];
        const outstanding = duration - time;
        const consumed = Math.min(remaining, outstanding);
        time += consumed;
        remaining -= consumed;
        if (time >= duration - 1e-7) {
          copyPosition(end);
          time = 0;
          if (++segment === segments.length) {
            segments = null;
            hold = CONTACT_HOLD;
          }
        } else {
          const t = ease(time / duration);
          pose.x = start.x + (end.x - start.x) * t;
          pose.y = start.y + (end.y - start.y) * t;
        }
      }
      if (segments) return pose;
    }

    if (hold > 0) {
      const consumed = Math.min(hold, remaining);
      hold -= consumed;
      pose.phase = 'hold';
      if (hold > 0) return pose;
      remaining -= consumed;
    }
    if (pose.reach > 0) {
      pose.reach = Math.max(0, pose.reach - remaining / (reachSeconds * RETURN_RATIO));
      pose.phase = 'return';
      if (pose.reach > 0) return pose;
    }
    if (!gear.path) ownsLever = false;
    if (!ownsLever) copyPosition(gear);
    pose.phase = 'wheel';
    return pose;
  }
  return { pose, update, reset };
}
