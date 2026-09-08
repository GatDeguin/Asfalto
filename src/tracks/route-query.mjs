import { wrapRouteDistance, signedRouteDistance } from './route-distances.mjs';
const SAFE_ID = /^[a-z][a-z0-9_-]{0,63}$/;
const EPS = 1e-4;
const SHOULDER_M = 2;
const MAX_HINT_JUMP_M = 150;

class RouteValidationError extends TypeError {
  constructor(errors) {
    super('Invalid route:\n- ' + errors.join('\n- '));
    this.name = 'RouteValidationError';
    this.errors = Object.freeze([...errors]);
  }
}

const finitePositive = (value) => Number.isFinite(value) && value > 0;
const finiteVector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const safeId = (value) => typeof value === 'string' && SAFE_ID.test(value);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const magnitude = (vector) => Math.sqrt(dot(vector, vector));
const lerp = (a, b, amount) => a + (b - a) * amount;
const lerpVector = (a, b, amount) => [
  lerp(a[0], b[0], amount),
  lerp(a[1], b[1], amount),
  lerp(a[2], b[2], amount),
];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function normalize(vector, fallback) {
  const size = magnitude(vector);
  return Number.isFinite(size) && size > 1e-8
    ? [vector[0] / size, vector[1] / size, vector[2] / size]
    : [...fallback];
}

function frameChecks(sample) {
  const normalized = [sample.tangent, sample.left, sample.normal]
    .every((vector) => Math.abs(magnitude(vector) - 1) <= EPS);
  const orthogonal = (
    Math.abs(dot(sample.tangent, sample.left)) <= EPS
    && Math.abs(dot(sample.tangent, sample.normal)) <= EPS
    && Math.abs(dot(sample.left, sample.normal)) <= EPS
  );
  const yUp = sample.normal[1] > 0 && dot(cross(sample.left, sample.tangent), sample.normal) > 1 - EPS;
  return { normalized, orthogonal, yUp };
}

function makeFrame(a, b, amount) {
  const tangent = normalize(lerpVector(a.tangent, b.tangent, amount), [0, 0, 1]);
  let left = lerpVector(a.left, b.left, amount);
  const along = dot(left, tangent);
  left = [left[0] - tangent[0] * along, left[1] - tangent[1] * along, left[2] - tangent[2] * along];
  if (magnitude(left) <= 1e-8) {
    left = cross(tangent, normalize(lerpVector(a.normal, b.normal, amount), [0, 1, 0]));
  }
  left = normalize(left, [-1, 0, 0]);
  let normal = normalize(cross(left, tangent), [0, 1, 0]);
  if (normal[1] < 0) {
    left = left.map((value) => -value);
    normal = normal.map((value) => -value);
  }
  return { tangent, left, normal };
}

function freezeFrame(frame) {
  return Object.freeze({
    tangent: Object.freeze(frame.tangent.map((value) => value === 0 ? 0 : value)),
    left: Object.freeze(frame.left.map((value) => value === 0 ? 0 : value)),
    normal: Object.freeze(frame.normal.map((value) => value === 0 ? 0 : value)),
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function segmentAt(samples, sM) {
  if (sM <= samples[0].sM) return 0;
  if (sM >= samples.at(-1).sM) return samples.length - 2;
  let low = 0;
  let high = samples.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (samples[middle].sM <= sM) low = middle;
    else high = middle;
  }
  return low;
}

function rawWidthAt(samples, sM) {
  const index = segmentAt(samples, sM);
  const a = samples[index];
  const b = samples[index + 1];
  const amount = Math.max(0, Math.min(1, (sM - a.sM) / (b.sM - a.sM)));
  return lerp(a.widthM, b.widthM, amount);
}

function validateRoute(route) {
  const value = route && typeof route === 'object' && !Array.isArray(route) ? route : {};
  const errors = [];
  const lengthValid = finitePositive(value.lengthM);

  if (value.schema !== 'asfalto-route/v1') errors.push('schema must equal asfalto-route/v1');
  if (value.coordinateSystem !== 'Y_UP_METERS') errors.push('coordinateSystem must equal Y_UP_METERS');
  if (!lengthValid) errors.push('lengthM must be finite and positive');
  if (!finitePositive(value.sampleStepM)) errors.push('sampleStepM must be finite and positive');

  const samples = Array.isArray(value.samples) ? value.samples : [];
  if (samples.length < 2) errors.push('samples must contain at least two records');
  let distancesValid = samples.length >= 2;
  let widthsValid = samples.length >= 2;
  let vectorsValid = samples.length >= 2;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
      errors.push('samples[' + index + '] must be an object');
      distancesValid = false;
      widthsValid = false;
      vectorsValid = false;
      continue;
    }
    if (!Number.isFinite(sample.sM)) {
      errors.push('samples[' + index + '].sM must be finite');
      distancesValid = false;
    }
    const finite = {};
    for (const field of ['position', 'tangent', 'left', 'normal']) {
      finite[field] = finiteVector(sample[field]);
      if (!finite[field]) {
        errors.push('samples[' + index + '].' + field + ' must contain three finite numbers');
        vectorsValid = false;
      }
    }
    if (finite.tangent && finite.left && finite.normal) {
      const checks = frameChecks(sample);
      if (!checks.normalized) errors.push('samples[' + index + '] frame vectors must be normalized');
      else if (!checks.orthogonal) errors.push('samples[' + index + '] frame vectors must be orthogonal');
      else if (!checks.yUp) errors.push('samples[' + index + '] frame must be Y-up compatible');
    }
    if (!finitePositive(sample.widthM)) {
      errors.push('samples[' + index + '].widthM must be finite and positive');
      widthsValid = false;
    }
    if (!safeId(sample.surfaceId)) errors.push('samples[' + index + '].surfaceId must be a safe stable identifier');
    if (!safeId(sample.sectorId)) errors.push('samples[' + index + '].sectorId must be a safe stable identifier');
  }

  let monotonic = distancesValid;
  if (monotonic) {
    for (let index = 1; index < samples.length; index += 1) {
      if (!(samples[index].sM > samples[index - 1].sM)) monotonic = false;
    }
    if (!monotonic) errors.push('samples sM values must be strictly increasing');
  }
  if (distancesValid && lengthValid && samples.length >= 2 && (samples[0].sM !== 0 || samples.at(-1).sM !== value.lengthM)) {
    errors.push('samples must span 0..lengthM');
  }

  const sectors = Array.isArray(value.sectors) ? value.sectors : [];
  if (sectors.length === 0) errors.push('sectors must contain at least one record');
  const sectorIds = new Set();
  let sectorsValid = sectors.length > 0;
  for (let index = 0; index < sectors.length; index += 1) {
    const sector = sectors[index];
    if (!sector || typeof sector !== 'object') {
      errors.push('sectors[' + index + '] must be an object');
      sectorsValid = false;
      continue;
    }
    if (!safeId(sector.id)) {
      errors.push('sectors[' + index + '].id must be a safe stable identifier');
      sectorsValid = false;
    } else if (sectorIds.has(sector.id)) {
      errors.push('sector ids must be unique');
      sectorsValid = false;
    } else sectorIds.add(sector.id);
    if (!Number.isFinite(sector.startM) || !Number.isFinite(sector.endM) || !(sector.endM > sector.startM)) {
      errors.push('sectors[' + index + '] must have finite increasing bounds');
      sectorsValid = false;
    } else if (lengthValid && (sector.startM < 0 || sector.endM > value.lengthM)) {
      errors.push('sectors[' + index + '] must be within 0..lengthM');
      sectorsValid = false;
    }
  }
  let sectorCoverageValid = false;
  if (sectorsValid && lengthValid) {
    sectorCoverageValid = sectors[0].startM === 0 && sectors.at(-1).endM === value.lengthM;
    for (let index = 1; index < sectors.length; index += 1) {
      if (sectors[index].startM !== sectors[index - 1].endM) sectorCoverageValid = false;
    }
    if (!sectorCoverageValid) errors.push('sectors must continuously cover 0..lengthM without gaps or overlaps');
  }
  if (sectorCoverageValid) {
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      const routeSample = samples[sampleIndex];
      if (!Number.isFinite(routeSample?.sM) || !safeId(routeSample?.sectorId)) continue;
      let expectedSector = null;
      for (let sectorIndex = 0; sectorIndex < sectors.length; sectorIndex += 1) {
        const sector = sectors[sectorIndex];
        const inSector = routeSample.sM >= sector.startM
          && (sectorIndex === sectors.length - 1 ? routeSample.sM <= sector.endM : routeSample.sM < sector.endM);
        if (inSector) {
          expectedSector = sector;
          break;
        }
      }
      if (expectedSector && routeSample.sectorId !== expectedSector.id) {
        errors.push('samples[' + sampleIndex + '].sectorId must match sector ' + expectedSector.id + ' at sM ' + routeSample.sM);
      }
    }
  }

  const checkpoints = Array.isArray(value.checkpoints) ? value.checkpoints : null;
  if (!checkpoints) errors.push('checkpoints must be an array');
  else {
    let ordered = true;
    for (let index = 0; index < checkpoints.length; index += 1) {
      const checkpoint = checkpoints[index];
      if (
        !checkpoint || checkpoint.index !== index || !Number.isFinite(checkpoint.sM)
        || (lengthValid && (checkpoint.sM < 0 || checkpoint.sM > value.lengthM))
        || (index > 0 && !(checkpoint.sM > checkpoints[index - 1]?.sM))
      ) ordered = false;
      if (!finitePositive(checkpoint?.halfWidthM)) {
        errors.push('checkpoints[' + index + '].halfWidthM must be finite and positive');
      }
    }
    if (!ordered) errors.push('checkpoints must have sequential indices and strictly increasing distances within 0..lengthM');
  }

  const respawns = Array.isArray(value.respawns) ? value.respawns : null;
  if (!respawns || respawns.length === 0) errors.push('respawns must contain at least one record');
  else {
    const canCheckWidth = distancesValid && widthsValid && vectorsValid && monotonic;
    for (let index = 0; index < respawns.length; index += 1) {
      const respawn = respawns[index];
      const sInBounds = Number.isFinite(respawn?.sM) && (!lengthValid || (respawn.sM >= 0 && respawn.sM <= value.lengthM));
      if (!sInBounds) errors.push('respawns[' + index + '].sM must be within 0..lengthM');
      if (!Number.isFinite(respawn?.lateralM)) errors.push('respawns[' + index + '].lateralM must be finite');
      else if (canCheckWidth && sInBounds && Math.abs(respawn.lateralM) > rawWidthAt(samples, respawn.sM) * 0.5) {
        errors.push('respawns[' + index + '].lateralM must be within the road width');
      }
    }
    for (let index = 1; index < respawns.length; index += 1) {
      if (!(respawns[index]?.sM > respawns[index - 1]?.sM)) {
        errors.push('respawns must be strictly ordered by sM');
        break;
      }
    }
  }

  if (errors.length) throw new RouteValidationError(errors);
}

function snapshot(route) {
  return deepFreeze({
    schema: route.schema,
    coordinateSystem: route.coordinateSystem,
    lengthM: route.lengthM,
    closed: route.closed === true,
    sampleStepM: route.sampleStepM,
    samples: route.samples.map((sample) => ({
      sM: sample.sM,
      position: [...sample.position],
      tangent: [...sample.tangent],
      left: [...sample.left],
      normal: [...sample.normal],
      widthM: sample.widthM,
      surfaceId: sample.surfaceId,
      sectorId: sample.sectorId,
    })),
    sectors: route.sectors.map((value) => ({ ...value })),
    checkpoints: route.checkpoints.map((value) => ({ ...value })),
    respawns: route.respawns.map((value) => ({ ...value })),
  });
}

export function createRouteQuery(rawRoute) {
  validateRoute(rawRoute);
  const route = snapshot(rawRoute);
  const samples = route.samples;
  const segmentCount = samples.length - 1;
  const cellSize = Math.max(25, route.sampleStepM * 8);
  const grid = new Map();
  const key = (cellX, cellZ) => cellX + ',' + cellZ;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let index = 0; index < segmentCount; index += 1) {
    const a = samples[index].position;
    const b = samples[index + 1].position;
    const x0 = Math.floor(Math.min(a[0], b[0]) / cellSize);
    const x1 = Math.floor(Math.max(a[0], b[0]) / cellSize);
    const z0 = Math.floor(Math.min(a[2], b[2]) / cellSize);
    const z1 = Math.floor(Math.max(a[2], b[2]) / cellSize);
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x1);
    minZ = Math.min(minZ, z0);
    maxZ = Math.max(maxZ, z1);
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      const cellKey = key(x, z);
      if (!grid.has(cellKey)) grid.set(cellKey, []);
      grid.get(cellKey).push(index);
    }
  }

  function cellRectangleDistanceSquared(positionX, positionZ, fromCellX, toCellX, fromCellZ, toCellZ) {
    if (fromCellX > toCellX || fromCellZ > toCellZ) return Infinity;
    const worldMinX = fromCellX * cellSize;
    const worldMaxX = (toCellX + 1) * cellSize;
    const worldMinZ = fromCellZ * cellSize;
    const worldMaxZ = (toCellZ + 1) * cellSize;
    const dx = positionX < worldMinX ? worldMinX - positionX : positionX > worldMaxX ? positionX - worldMaxX : 0;
    const dz = positionZ < worldMinZ ? worldMinZ - positionZ : positionZ > worldMaxZ ? positionZ - worldMaxZ : 0;
    return dx * dx + dz * dz;
  }

  function unvisitedCellLowerBoundSquared(positionX, positionZ, centerCellX, centerCellZ, radius) {
    return Math.min(
      cellRectangleDistanceSquared(positionX, positionZ, minX, Math.min(maxX, centerCellX - radius - 1), minZ, maxZ),
      cellRectangleDistanceSquared(positionX, positionZ, Math.max(minX, centerCellX + radius + 1), maxX, minZ, maxZ),
      cellRectangleDistanceSquared(positionX, positionZ, minX, maxX, minZ, Math.min(maxZ, centerCellZ - radius - 1)),
      cellRectangleDistanceSquared(positionX, positionZ, minX, maxX, Math.max(minZ, centerCellZ + radius + 1), maxZ),
    );
  }

  function sampleInternal(sM) {
    const distance = route.closed && (sM<0 || sM>route.lengthM) ? wrapRouteDistance(sM,route.lengthM) : Math.max(0, Math.min(route.lengthM, sM));
    const segmentIndex = segmentAt(samples, distance);
    const a = samples[segmentIndex];
    const b = samples[segmentIndex + 1];
    const amount = (distance - a.sM) / (b.sM - a.sM);
    const discrete = amount >= 1 ? b : a;
    return {
      sM: distance,
      position: lerpVector(a.position, b.position, amount),
      widthM: lerp(a.widthM, b.widthM, amount),
      surfaceId: discrete.surfaceId,
      sectorId: discrete.sectorId,
      frame: makeFrame(a, b, amount),
      segmentIndex,
    };
  }

  function immutableSample(value) {
    return Object.freeze({
      sM: value.sM,
      position: Object.freeze([...value.position]),
      widthM: value.widthM,
      surfaceId: value.surfaceId,
      sectorId: value.sectorId,
      frame: freezeFrame(value.frame),
    });
  }

  function sample(sM) {
    if (!Number.isFinite(sM)) throw new TypeError('sM must be finite');
    return immutableSample(sampleInternal(sM));
  }

  const seen = new Uint32Array(segmentCount);
  let stamp = 0;

  function project(position, hintSegment, options) {
    if (!finiteVector(position)) throw new TypeError('position must contain three finite numbers');
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
      throw new TypeError('options must be an object when provided');
    }
    stamp = (stamp + 1) >>> 0;
    if (stamp === 0) {
      seen.fill(0);
      stamp = 1;
    }
    const hintValid = Number.isInteger(hintSegment) && hintSegment >= 0 && hintSegment < segmentCount;
    let bestD2 = Infinity;
    let bestIndex = -1;
    let bestAmount = 0;

    function consider(index) {
      if (index < 0 || index >= segmentCount || seen[index] === stamp) return;
      seen[index] = stamp;
      const a = samples[index].position;
      const b = samples[index + 1].position;
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const denominator = dx * dx + dz * dz;
      let amount = denominator > 1e-12
        ? ((position[0] - a[0]) * dx + (position[2] - a[2]) * dz) / denominator
        : 0;
      amount = Math.max(0, Math.min(1, amount));
      const offsetX = position[0] - lerp(a[0], b[0], amount);
      const offsetZ = position[2] - lerp(a[2], b[2], amount);
      const distance = offsetX * offsetX + offsetZ * offsetZ;
      if (distance < bestD2 - 1e-12 || (Math.abs(distance - bestD2) <= 1e-12 && index < bestIndex)) {
        bestD2 = distance;
        bestIndex = index;
        bestAmount = amount;
      }
    }

    if (hintValid) for (let index = hintSegment - 2; index <= hintSegment + 2; index += 1) consider(index);
    const cellX = Math.max(minX, Math.min(maxX, Math.floor(position[0] / cellSize)));
    const cellZ = Math.max(minZ, Math.min(maxZ, Math.floor(position[2] / cellSize)));
    const maxRadius = Math.max(cellX - minX, maxX - cellX, cellZ - minZ, maxZ - cellZ);
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      const fromX = Math.max(minX, cellX - radius);
      const toX = Math.min(maxX, cellX + radius);
      const fromZ = Math.max(minZ, cellZ - radius);
      const toZ = Math.min(maxZ, cellZ + radius);
      for (let x = fromX; x <= toX; x += 1) for (let z = fromZ; z <= toZ; z += 1) {
        if (radius && x !== cellX - radius && x !== cellX + radius && z !== cellZ - radius && z !== cellZ + radius) continue;
        const bucket = grid.get(key(x, z));
        if (!bucket) continue;
        for (const index of bucket) consider(index);
      }
      const unvisitedLowerBound = unvisitedCellLowerBoundSquared(position[0], position[2], cellX, cellZ, radius);
      if (bestIndex >= 0 && unvisitedLowerBound > bestD2 + 1e-12) break;
    }

    const a = samples[bestIndex];
    const b = samples[bestIndex + 1];
    const sM = lerp(a.sM, b.sM, bestAmount);
    const hintDistance=hintValid?(route.closed?signedRouteDistance(samples[hintSegment].sM,sM,route.lengthM):sM-samples[hintSegment].sM):0;
    if (hintValid && options?.allowTeleport !== true && Math.abs(hintDistance) > MAX_HINT_JUMP_M) {
      throw new RangeError('projection jump exceeds 150 m from hint segment');
    }
    const frame = makeFrame(a, b, bestAmount);
    const routePosition = lerpVector(a.position, b.position, bestAmount);
    const offsetX = position[0] - routePosition[0];
    const offsetZ = position[2] - routePosition[2];
    const distanceXZ = Math.sqrt(bestD2);
    let leftX = frame.left[0];
    let leftZ = frame.left[2];
    let leftXZLength = Math.hypot(leftX, leftZ);
    if (leftXZLength <= 1e-12) {
      const segmentX = b.position[0] - a.position[0];
      const segmentZ = b.position[2] - a.position[2];
      const segmentXZLength = Math.hypot(segmentX, segmentZ);
      if (segmentXZLength > 1e-12) {
        leftX = -segmentZ / segmentXZLength;
        leftZ = segmentX / segmentXZLength;
        leftXZLength = 1;
      } else {
        leftX = -1;
        leftZ = 0;
        leftXZLength = 1;
      }
    }
    const side = offsetX * (leftX / leftXZLength) + offsetZ * (leftZ / leftXZLength);
    const lateralM = distanceXZ === 0 ? 0 : (side < -1e-12 ? -distanceXZ : distanceXZ);
    const discrete = bestAmount >= 1 ? b : a;
    const result = {
      sM,
      routeDistanceM: sM,
      lateralM,
      position: Object.freeze(routePosition),
      frame: freezeFrame(frame),
      widthM: lerp(a.widthM, b.widthM, bestAmount),
      surfaceId: discrete.surfaceId,
      sectorId: discrete.sectorId,
      segmentIndex: bestIndex,
      distanceXZ,
    };
    return Object.freeze(result);
  }

  function surfaceAt(position, hintSegment, options) {
    const projection = project(position, hintSegment, options);
    const roadEdgeM = projection.widthM * 0.5;
    const shoulderEdgeM = roadEdgeM + SHOULDER_M;
    const lateral = Math.abs(projection.lateralM);
    const surface = lateral <= roadEdgeM ? 'road' : lateral <= shoulderEdgeM ? 'shoulder' : 'offroad';
    return Object.freeze({
      sM: projection.sM,
      routeDistanceM: projection.sM,
      lateralM: projection.lateralM,
      surface,
      authoredSurfaceId: projection.surfaceId,
      frame: projection.frame,
      segmentIndex: projection.segmentIndex,
      roadEdgeM,
      shoulderEdgeM,
    });
  }

  function checkpointAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= route.checkpoints.length) {
      throw new RangeError('checkpoint index out of range: ' + index);
    }
    const checkpoint = route.checkpoints[index];
    const point = sampleInternal(checkpoint.sM);
    return Object.freeze({
      index,
      sM: checkpoint.sM,
      halfWidthM: checkpoint.halfWidthM,
      position: Object.freeze([...point.position]),
      frame: freezeFrame(point.frame),
      surfaceId: point.surfaceId,
      sectorId: point.sectorId,
    });
  }

  function respawnFor(sM) {
    if (!Number.isFinite(sM)) throw new TypeError('sM must be finite');
    const distance = route.closed ? wrapRouteDistance(sM,route.lengthM) : Math.max(0, Math.min(route.lengthM, sM));
    let index = 0;
    let low = 0;
    let high = route.respawns.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (route.respawns[middle].sM <= distance) low = middle + 1;
      else high = middle;
    }
    index = Math.max(0, low - 1);
    const respawn = route.respawns[index];
    const point = sampleInternal(respawn.sM);
    return Object.freeze({
      sM: respawn.sM,
      lateralM: respawn.lateralM,
      position: Object.freeze([
        point.position[0] + point.frame.left[0] * respawn.lateralM,
        point.position[1] + point.frame.left[1] * respawn.lateralM,
        point.position[2] + point.frame.left[2] * respawn.lateralM,
      ]),
      frame: freezeFrame(point.frame),
      surfaceId: point.surfaceId,
      sectorId: point.sectorId,
    });
  }

  return Object.freeze({ sample, project, surfaceAt, checkpointAt, respawnFor });
}
