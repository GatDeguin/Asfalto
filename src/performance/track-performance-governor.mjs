const TIERS = Object.freeze(['high', 'balanced', 'low']);
const RING_SIZE = 600;
const DOWNGRADE_SAMPLES = 240;
const UPGRADE_SAMPLES = 600;
const HIGH_MAX = 16.7;
const BALANCED_MAX = 25;
const POLICIES = Object.freeze({
  high: Object.freeze({ resolutionScale: 1, shadows: true, vegetationLod: 'high', mirrorHz: 30, sectorPreloadRadius: 2 }),
  balanced: Object.freeze({ resolutionScale: 0.86, shadows: true, vegetationLod: 'balanced', mirrorHz: 22, sectorPreloadRadius: 1 }),
  low: Object.freeze({ resolutionScale: 0.7, shadows: false, vegetationLod: 'low', mirrorHz: 15, sectorPreloadRadius: 0 }),
});

function finiteNonNegative(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return value;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function nowMs() {
  return Number(globalThis.performance?.now?.() ?? Date.now());
}

export function createTrackPerformanceGovernor({ initialTier, onTierChange }) {
  if (!TIERS.includes(initialTier)) throw new RangeError(`Invalid performance tier: ${initialTier}`);
  if (typeof onTierChange !== 'function') throw new TypeError('Performance tier callback is required');
  const initial = initialTier;
  const ring = new Float64Array(RING_SIZE);
  const workRing = new Float64Array(RING_SIZE);
  let count = 0;
  let cursor = 0;
  let currentTier = initial;
  let slow = 0;
  let healthy = 0;
  let transitions = 0;
  let transitionReason = 'initial';
  let lastTransitionMs = 0;
  let resources = Object.freeze({ heapBytes: 0, gpuTextures: 0, gpuGeometries: 0 });

  const values = source => Array.from(source.slice(0, count < RING_SIZE ? count : RING_SIZE));
  const transition = (nextTier, reason) => {
    if (nextTier === currentTier) return;
    const previousTier = currentTier;
    currentTier = nextTier;
    slow = 0;
    healthy = 0;
    transitions += 1;
    transitionReason = reason;
    lastTransitionMs = nowMs();
    onTierChange(Object.freeze({ previousTier, tier: nextTier, reason, renderPolicy: POLICIES[nextTier], atMs: lastTransitionMs }));
  };

  function sample(input = {}) {
    const frameMs = finiteNonNegative(input.frameMs, 'frameMs');
    const frameWorkMs = finiteNonNegative(input.frameWorkMs ?? frameMs, 'frameWorkMs');
    resources = Object.freeze({
      heapBytes: finiteNonNegative(input.heapBytes, 'heapBytes'),
      gpuTextures: finiteNonNegative(input.gpuTextures, 'gpuTextures'),
      gpuGeometries: finiteNonNegative(input.gpuGeometries, 'gpuGeometries'),
    });
    ring[cursor] = frameMs;
    workRing[cursor] = frameWorkMs;
    cursor = (cursor + 1) % RING_SIZE;
    count = Math.min(RING_SIZE, count + 1);

    const slowBoundary = currentTier === 'high' ? HIGH_MAX : currentTier === 'balanced' ? BALANCED_MAX : Infinity;
    const healthyBoundary = currentTier === 'low' ? BALANCED_MAX : currentTier === 'balanced' ? HIGH_MAX : -Infinity;
    slow = frameMs > slowBoundary ? slow + 1 : 0;
    healthy = frameMs <= healthyBoundary ? healthy + 1 : 0;
    if (currentTier === 'high' && slow >= DOWNGRADE_SAMPLES) transition('balanced', 'p95-above-16.7ms');
    else if (currentTier === 'balanced' && slow >= DOWNGRADE_SAMPLES) transition('low', 'p95-above-25.0ms');
    else if (currentTier === 'low' && healthy >= UPGRADE_SAMPLES) transition('balanced', '600-healthy-at-25.0ms');
    else if (currentTier === 'balanced' && healthy >= UPGRADE_SAMPLES) transition('high', '600-healthy-at-16.7ms');
    return diagnostics();
  }

  function diagnostics() {
    const frames = values(ring);
    const frameWork = values(workRing);
    return Object.freeze({
      tier: currentTier,
      p50FrameMs: percentile(frames, 0.5),
      p95FrameMs: percentile(frames, 0.95),
      maxFrameIntervalMs: frames.length ? Math.max(...frames) : 0,
      p50FrameWorkMs: percentile(frameWork, 0.5),
      p95FrameWorkMs: percentile(frameWork, 0.95),
      maxFrameWorkMs: frameWork.length ? Math.max(...frameWork) : 0,
      samples: count,
      capacity: RING_SIZE,
      consecutiveSlow: slow,
      consecutiveHealthy: healthy,
      transitions,
      transitionReason,
      lastTransitionMs,
      renderPolicy: POLICIES[currentTier],
      resources,
      thresholds: Object.freeze({ highMaxFrameMs: HIGH_MAX, balancedMaxFrameMs: BALANCED_MAX, downgradeSamples: DOWNGRADE_SAMPLES, upgradeSamples: UPGRADE_SAMPLES }),
    });
  }

  function reset() {
    ring.fill(0);
    workRing.fill(0);
    count = 0; cursor = 0; currentTier = initial; slow = 0; healthy = 0;
    transitions = 0; transitionReason = 'reset'; lastTransitionMs = 0;
    resources = Object.freeze({ heapBytes: 0, gpuTextures: 0, gpuGeometries: 0 });
    return diagnostics();
  }

  return Object.freeze({ sample, tier: () => currentTier, reset, diagnostics });
}

export { POLICIES as TRACK_RENDER_POLICIES };
