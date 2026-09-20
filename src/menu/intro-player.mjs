/** One playback session. Media events, first-frame timeout and stale play promises
 * share the same terminal guard, so skipping never leaves hidden audio running. */
const owners = new WeakMap();

export function createIntroSession({ video, onFinish, onBlocked = () => {},
  automatic = false, timeoutMs = 12000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
  const owner = {};
  let finished = false;
  let started = false;
  let suspended = false;
  let attempt = 0;
  let timer = null;
  const clearTimer = () => { if (timer !== null) clearTimeoutFn(timer); timer = null; };
  const playing = () => clearTimer();
  const ended = () => stop('ended');
  const error = () => stop('error');
  function stop(reason = 'skip') {
    if (finished) return;
    finished = true;
    attempt++;
    clearTimer();
    video.removeEventListener('playing', playing);
    video.removeEventListener('ended', ended);
    video.removeEventListener('error', error);
    if (owners.get(video) === owner) {
      owners.delete(video);
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    onFinish(reason);
  }
  async function resume({ unmute = false } = {}) {
    if (finished || !started) return false;
    suspended = false;
    const current = ++attempt;
    if (unmute) video.muted = false;
    async function play(allowMutedFallback) {
      clearTimer();
      timer = setTimeoutFn(() => stop('timeout'), timeoutMs);
      try {
        await video.play();
        if (finished) {
          // A late fulfillment can restart media after pause/load. Do not pause
          // a newer visible session that has since claimed this same element.
          if (!owners.has(video)) video.pause();
          return false;
        }
        if (suspended) { video.pause(); return false; }
        // play() on an already playing, muted video can resolve without a new
        // playing event. A first-frame watchdog must not become a clip cutoff.
        if (current === attempt && !video.paused && video.readyState >= 2) clearTimer();
        return current === attempt;
      } catch (failure) {
        if (finished || current !== attempt) return false;
        if (failure?.name === 'NotAllowedError') {
          clearTimer();
          if (allowMutedFallback && automatic && !video.muted) {
            video.muted = true;
            onBlocked({ muted: true });
            return play(false);
          }
          onBlocked({ muted: video.muted });
        } else stop('error');
        return false;
      }
    }
    return play(true);
  }
  function suspend() {
    if (finished || !started) return;
    suspended = true;
    attempt++;
    clearTimer();
    video.pause();
  }
  function start(src) {
    if (started || finished) return Promise.resolve();
    started = true;
    owners.set(video, owner);
    video.addEventListener('playing', playing);
    video.addEventListener('ended', ended);
    video.addEventListener('error', error);
    video.src = src;
    video.muted = false;
    video.load();
    return resume();
  }
  return { start, resume, suspend, stop, get finished() { return finished; } };
}
