export const PROBE_SLABS = 7; // Diffuse plus one slab per signed axis.
export const PROBE_RADIANCE_RANGE = 2;
export const MAX_PROBE_PROXIES = 16;
export const PROBE_PROXY_STRIDE = 16;

function preset(size, spacing, rays, intervalMs, triangles, radius, traceDistance) {
  return Object.freeze({size, spacing, height: 3.5, rays, intervalMs, triangles, radius, traceDistance,
    bytes: size * size * 2 * PROBE_SLABS * 4});
}

export const PROBE_PRESETS = Object.freeze({
  balanced: preset(3, 7, 2, 150, 8000, 32, 20),
  high: preset(5, 5, 3, 105, 16000, 40, 26),
});

export function placeProbeGrid(position, {size, spacing, height}) {
  const span = (size - 1) * spacing;
  const snap = value => Math.round(value / (spacing * .5)) * spacing * .5 - span * .5;
  return {
    origin: [snap(position[0]), Math.round(position[1] * 2) * .5 + .5, snap(position[2])],
    extent: [span, height, span],
  };
}

export function packProbeProxies({dynamic = [], fixed = []}, origin, radius, limit = MAX_PROBE_PROXIES) {
  const data = new Float32Array(limit * PROBE_PROXY_STRIDE);
  let count = 0, dynamicCount = 0;
  for (const [source, moving] of [[dynamic, true], [fixed, false]]) {
    const near = [];
    for (const proxy of source) {
      const {center, halfExtent, rotation, color} = proxy;
      if (center?.length !== 3 || halfExtent?.length !== 3 || rotation?.length !== 4 || color?.length !== 3
        || ![...center, ...halfExtent, ...rotation, ...color].every(Number.isFinite)
        || halfExtent.some(side => side <= .025) || Math.hypot(...rotation) < .0001) continue;
      const relative = center.map((axis, index) => axis - origin[index]);
      const distance = Math.hypot(...relative) - Math.hypot(...halfExtent);
      if (distance <= radius) near.push({relative, distance, halfExtent, rotation, color});
    }
    near.sort((left, right) => left.distance - right.distance);
    for (const proxy of near) {
      if (count >= limit) break;
      const {relative, halfExtent, rotation, color} = proxy;
      const rounding = Math.min(.24, Math.min(...halfExtent) * .34);
      const length = Math.hypot(...rotation);
      data.set([...relative, rounding, ...halfExtent.map(side => side - rounding), moving ? 1 : 0,
        ...rotation.map(value => value / length), ...color.map(channel => Math.min(1, Math.max(0, channel))), 0],
      count * PROBE_PROXY_STRIDE);
      count++;
      if (moving) dynamicCount++;
    }
  }
  return {data, count, dynamicCount};
}
