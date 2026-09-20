/** One media element; race returns can restart while temporary pauses retain position. */
export function createMenuMusic({ audio, tracks, volume = .32 } = {}) {
  let enabled = false, disposed = false, epoch = 0, index = 0;
  audio.preload = 'metadata'; audio.volume = volume;
  function select() { audio.src = tracks[index]; }
  async function play() {
    if (!enabled || disposed) return false;
    const request = ++epoch;
    try { await audio.play(); if (disposed || !enabled || request !== epoch) { if (!enabled || disposed) audio.pause(); return false; } return true; }
    catch { return false; }
  }
  const ended = () => { if (disposed) return; index = (index + 1) % tracks.length; select(); void play(); };
  audio.addEventListener('ended', ended); select();
  return Object.freeze({
    setActive(value, { restart = false } = {}) {
      if (disposed) return;
      const next = !!value;
      if (next && restart) audio.currentTime = 0;
      if (next === enabled) return;
      enabled = next;
      if (enabled) void play(); else { epoch++; audio.pause(); }
    },
    retry: play,
    setVolume(value) { audio.volume = Math.max(0, Math.min(1, Number(value) || 0)); },
    diagnostics() { return { enabled, index, paused:audio.paused, volume:audio.volume, currentTime:audio.currentTime }; },
    dispose() { if (disposed) return; disposed = true; enabled = false; epoch++; audio.pause(); audio.removeEventListener('ended', ended); audio.removeAttribute('src'); audio.load(); },
  });
}
