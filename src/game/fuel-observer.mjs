import { FUEL_REFERENCE_MAP as map } from './fuel-reference-map.mjs?v=cffad6206216df15';
for (const row of map.fuelGramsPerSecond) Object.freeze(row);
Object.freeze(map.fuelGramsPerSecond);Object.freeze(map.speedRadps);Object.freeze(map.torqueNm);Object.freeze(map);
export const FUEL_MODEL_ID = 'asfalto-si-reference-accounting/v1';
function bracket(axis, value) {
  const v = Math.max(axis[0], Math.min(axis.at(-1), value));
  let lo = 0, hi = axis.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (axis[mid] <= v) lo = mid; else hi = mid; }
  return { lo, hi, mix: (v - axis[lo]) / (axis[hi] - axis[lo]), clamped: v !== value };
}

// A documented generic SI surrogate, not a historical Chevy/Falcon fuel calibration.
// Displacement scaling preserves BMEP and BSFC; it cannot change any physical force.
export function fuelFlowGramsPerSecond({ rpm, torqueNm, displacementLiters, fuelMultiplier = 1 }) {
  if (![rpm, torqueNm, displacementLiters, fuelMultiplier].every(Number.isFinite)
    || rpm < 0 || displacementLiters <= 0 || fuelMultiplier <= 0) throw new TypeError('Invalid fuel model input');
  const scale = displacementLiters / map.displacementLiters;
  const x = bracket(map.speedRadps, rpm * Math.PI / 30), y = bracket(map.torqueNm, torqueNm / scale);
  const values = map.fuelGramsPerSecond;
  const a = values[y.lo][x.lo] + (values[y.lo][x.hi] - values[y.lo][x.lo]) * x.mix;
  const b = values[y.hi][x.lo] + (values[y.hi][x.hi] - values[y.hi][x.lo]) * x.mix;
  return { gramsPerSecond: Math.max(0, a + (b - a) * y.mix) * scale * fuelMultiplier,
    referenceClamped: x.clamped || y.clamped };
}

export function createFuelObserver({ displacementLiters, fuelMultiplier = 1 }) {
  fuelFlowGramsPerSecond({ rpm: 0, torqueNm: 0, displacementLiters, fuelMultiplier });
  let lastTick = null, samples = 0, grams = 0, workJ = 0, clamped = 0, flow = 0;
  const reset = () => { lastTick = null; samples = 0; grams = 0; workJ = 0; clamped = 0; flow = 0; };
  return Object.freeze({
    sample({ tick, running, snapshot }) {
      if (!running) return;
      if (!Number.isSafeInteger(tick) || tick < 0) throw new TypeError('Invalid fuel sample tick');
      if (tick === lastTick) return;
      if (lastTick !== null && tick !== lastTick + 1) throw new Error('Noncontiguous fuel sample tick');
      const { rpm, torqueNm } = snapshot?.engine || {};
      const measured = fuelFlowGramsPerSecond({ rpm, torqueNm, displacementLiters, fuelMultiplier });
      flow = rpm > 0 ? measured.gramsPerSecond : 0;
      grams += flow / 120;
      workJ += Math.max(0, torqueNm * rpm * Math.PI / 30) / 120;
      if (measured.referenceClamped) clamped++;
      lastTick = tick; samples++;
    },
    getState() {
      return Object.freeze({ modelId: FUEL_MODEL_ID, referenceMapId: map.id,
        method: 'modeled-fuel-flow-from-physical-torque-rpm', modeled: true,
        displacementLiters, fuelMultiplier, sampleCount: samples, activeSeconds: samples / 120,
        lastTick, flowGramsPerSecond: flow, fuelUsedGrams: grams,
        fuelUsedLiters: grams / (map.densityKgPerLiter * 1000), positiveShaftWorkJ: workJ,
        averageBsfcGramsPerKWh: workJ > 0 ? grams / (workJ / 3.6e6) : null,
        referenceClampedSamples: clamped });
    },
    reset,
  });
}
