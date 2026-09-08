(function publishRecoveryGuard(root) {
  'use strict';

  const RECOVERY_GUARD_DEFAULTS = Object.freeze({
    safeContactCount: 2,
    safeNormalLoadN: 600,
    safeSeparationMinM: -1,
    safeSeparationMaxM: 2.5,
    safeChassisUpDot: 0.20,
    supportedLateralMarginM: 0.15,
    unsupportedLateralMarginM: 0.35,
    minDownwardSpeedMps: 2,
    minAccumulatedFallM: 1,
    belowRouteSeparationM: 6,
    unsupportedSeconds: 0.45,
    projectionLostSeconds: 0.60,
    projectionDistanceM: 80,
    rearmSeconds: 0.20,
  });

  const finite = value => Number.isFinite(value);
  const numberOr = (value, fallback = null) => finite(value) ? value : fallback;

  function validateOptions(options) {
    if (options === undefined) return Object.freeze({ ...RECOVERY_GUARD_DEFAULTS });
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('RecoveryGuard options must be an object');
    for (const key of Object.keys(options)) {
      if (!Object.prototype.hasOwnProperty.call(RECOVERY_GUARD_DEFAULTS, key)) throw new TypeError(`Unknown RecoveryGuard option: ${key}`);
      if (!finite(options[key])) throw new TypeError(`Invalid RecoveryGuard option "${key}": expected a finite number`);
    }
    const settings = { ...RECOVERY_GUARD_DEFAULTS, ...options };
    const positive = ['minDownwardSpeedMps', 'minAccumulatedFallM', 'belowRouteSeparationM', 'unsupportedSeconds', 'projectionLostSeconds', 'projectionDistanceM', 'rearmSeconds'];
    for (const key of positive) {
      if (settings[key] <= 0) throw new RangeError(`Invalid RecoveryGuard option "${key}": must be > 0`);
    }
    if (!Number.isInteger(settings.safeContactCount) || settings.safeContactCount < 1 || settings.safeContactCount > 4) throw new RangeError('Invalid RecoveryGuard option "safeContactCount": must be an integer from 1 to 4');
    if (settings.safeNormalLoadN < 0 || settings.supportedLateralMarginM < 0 || settings.unsupportedLateralMarginM < 0) throw new RangeError('Invalid RecoveryGuard option: load and lateral margins must be >= 0');
    if (settings.safeChassisUpDot < -1 || settings.safeChassisUpDot > 1) throw new RangeError('Invalid RecoveryGuard option "safeChassisUpDot": must be between -1 and 1');
    if (settings.safeSeparationMinM > settings.safeSeparationMaxM) throw new RangeError('Invalid RecoveryGuard options: safeSeparationMinM must be <= safeSeparationMaxM');
    return Object.freeze(settings);
  }

  function vector(value) {
    if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(finite)) return value.slice(0, 3);
    if (value && finite(value.x) && finite(value.y) && finite(value.z)) return [value.x, value.y, value.z];
    return null;
  }

  function quaternion(value) {
    if (Array.isArray(value) && value.length >= 4 && value.slice(0, 4).every(finite)) return value.slice(0, 4);
    if (value && finite(value.x) && finite(value.y) && finite(value.z) && finite(value.w)) return [value.x, value.y, value.z, value.w];
    return null;
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function normalized(value) {
    const length = Math.hypot(value[0], value[1], value[2]);
    return finite(length) && length > 0 ? value.map(component => component / length) : null;
  }

  function chassisUp(rotation) {
    const [x, y, z, w] = rotation;
    return [
      2 * (x * y - w * z),
      1 - 2 * (x * x + z * z),
      2 * (y * z + w * x),
    ];
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const copy = {};
      for (const key of Object.keys(value)) copy[key] = clone(value[key]);
      return copy;
    }
    return value;
  }

  function freezeDeep(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.keys(value).forEach(key => freezeDeep(value[key]));
      Object.freeze(value);
    }
    return value;
  }

  function readContacts(snapshot) {
    const wheels = snapshot && (snapshot.wheelContacts || snapshot.wheels || snapshot.wheelStates);
    if (!Array.isArray(wheels)) return { count: 0, normalLoadN: 0 };
    let count = 0;
    let normalLoadN = 0;
    for (const wheel of wheels) {
      if (!wheel || wheel.contact !== true) continue;
      count += 1;
      normalLoadN += numberOr(wheel.normalLoadN, numberOr(wheel.normalLoad, 0));
    }
    return { count, normalLoadN };
  }

  function routeEvidence(input) {
    const raw = input && input.rawProjection;
    const routeFrame = raw && raw.routeFrame || input && input.routeFrame;
    const routePosition = raw && vector(raw.routePosition);
    const normal = routeFrame && normalized(vector(routeFrame.normal));
    const tangent = routeFrame && vector(routeFrame.tangent);
    const left = routeFrame && vector(routeFrame.left);
    const valid = Boolean(raw && raw.valid === true && routePosition && normal && tangent && left
      && finite(raw.distanceM) && finite(raw.lateralM) && finite(raw.segmentIndex));
    return {
      raw,
      valid,
      continuous: Boolean(raw && raw.continuous === true),
      routePosition,
      normal,
      routeFrame: valid ? { tangent, left, normal } : null,
      distanceM: numberOr(raw && raw.distanceM),
      lateralM: numberOr(raw && raw.lateralM),
      segmentIndex: numberOr(raw && raw.segmentIndex),
    };
  }

  function frameEvidence(input, settings) {
    const snapshot = input && input.snapshot;
    const position = vector(snapshot && snapshot.position);
    const rotation = quaternion(snapshot && snapshot.rotation);
    const linearVelocity = vector(snapshot && (snapshot.linearVelocity || snapshot.linvel));
    const route = routeEvidence(input);
    const halfWidthM = numberOr(input && input.routeHalfWidthM);
    const fixedDt = numberOr(input && input.fixedDt, 0);
    const poseFinite = Boolean(position && rotation && linearVelocity);
    const contacts = readContacts(snapshot);
    const safeMetadata = {
      raceProgressM: numberOr(input && input.raceProgressM, numberOr(snapshot && snapshot.raceProgressM)),
      sM: numberOr(input && input.sM, numberOr(snapshot && snapshot.sM)),
      timestampS: numberOr(input && input.fixedTimeS, numberOr(input && input.timeS, numberOr(snapshot && snapshot.fixedTimeS))),
    };
    const separationM = poseFinite && route.valid && route.continuous ? dot([
      position[0] - route.routePosition[0],
      position[1] - route.routePosition[1],
      position[2] - route.routePosition[2],
    ], route.normal) : null;
    const safe = Boolean(
      poseFinite && route.valid && route.continuous && finite(halfWidthM) && halfWidthM >= settings.supportedLateralMarginM
      && finite(separationM)
      && contacts.count >= settings.safeContactCount
      && contacts.normalLoadN >= settings.safeNormalLoadN
      && separationM >= settings.safeSeparationMinM
      && separationM <= settings.safeSeparationMaxM
      && dot(chassisUp(rotation), route.normal) > settings.safeChassisUpDot
      && Math.abs(route.lateralM) <= halfWidthM - settings.supportedLateralMarginM
      && finite(safeMetadata.raceProgressM) && finite(safeMetadata.sM) && finite(safeMetadata.timestampS),
    );
    return { snapshot, position, rotation, linearVelocity, route, halfWidthM, fixedDt: Math.max(0, fixedDt), poseFinite, contacts, safeMetadata, separationM, safe };
  }

  function candidateFor(evidence) {
    if (!evidence.safe) return null;
    return freezeDeep({
      snapshot: clone(evidence.snapshot),
      raceProgressM: evidence.safeMetadata.raceProgressM,
      sM: evidence.safeMetadata.sM,
      segmentIndex: evidence.route.segmentIndex,
      routeFrame: clone(evidence.route.routeFrame),
      timestampS: evidence.safeMetadata.timestampS,
    });
  }

  function createRecoveryGuard(options = {}) {
    const settings = validateOptions(options);
    let armed = true;
    let rearmSafeSeconds = 0;
    let unsupportedSeconds = 0;
    let projectionLostSeconds = 0;
    let fallOriginSeparationM = null;
    let fallDistanceM = 0;
    let previousSeparationM = null;
    let previousProjectionDistanceM = null;
    let lastReason = null;

    function diagnostics() {
      return freezeDeep({
        armed,
        rearmSafeSeconds,
        unsupportedSeconds,
        projectionLostSeconds,
        fallOriginSeparationM,
        fallDistanceM,
        previousSeparationM,
        previousProjectionDistanceM,
        lastReason,
      });
    }

    function clearFallEvidence() {
      unsupportedSeconds = 0;
      fallOriginSeparationM = null;
      fallDistanceM = 0;
    }

    function reset() {
      armed = true;
      rearmSafeSeconds = 0;
      projectionLostSeconds = 0;
      previousSeparationM = null;
      previousProjectionDistanceM = null;
      lastReason = null;
      clearFallEvidence();
      return diagnostics();
    }

    function markRecovered() {
      armed = false;
      rearmSafeSeconds = 0;
      projectionLostSeconds = 0;
      previousSeparationM = null;
      previousProjectionDistanceM = null;
      clearFallEvidence();
      return diagnostics();
    }

    function observe(input) {
      const evidence = frameEvidence(input, settings);
      const safeFrameCandidate = candidateFor(evidence);
      const hasAnyContact = evidence.contacts.count > 0;
      const unsupported = evidence.route.valid && finite(evidence.halfWidthM)
        && !hasAnyContact && Math.abs(evidence.route.lateralM) > evidence.halfWidthM + settings.unsupportedLateralMarginM;

      if (evidence.safe) {
        clearFallEvidence();
        projectionLostSeconds = 0;
        if (!armed) {
          rearmSafeSeconds += evidence.fixedDt;
          if (rearmSafeSeconds >= settings.rearmSeconds) armed = true;
        }
      } else {
        rearmSafeSeconds = 0;
        if (hasAnyContact) clearFallEvidence();
      }

      if (unsupported && evidence.route.continuous && finite(evidence.separationM)) {
        unsupportedSeconds += evidence.fixedDt;
        if (fallOriginSeparationM === null) fallOriginSeparationM = evidence.separationM;
        fallDistanceM = Math.max(0, fallOriginSeparationM - evidence.separationM);
      } else if (!unsupported || !evidence.route.continuous) {
        clearFallEvidence();
      }

      if (evidence.route.valid && evidence.route.continuous
        && evidence.route.distanceM < settings.projectionDistanceM) {
        projectionLostSeconds = 0;
      } else if (!evidence.route.valid || !evidence.route.continuous
        || (evidence.route.distanceM !== null && evidence.route.distanceM >= settings.projectionDistanceM)) {
        projectionLostSeconds += evidence.fixedDt;
      }

      let reason = null;
      if (armed) {
        if (!evidence.poseFinite) {
          reason = 'non-finite-pose';
        } else if (evidence.route.valid && evidence.route.continuous && !hasAnyContact
          && evidence.separationM <= -settings.belowRouteSeparationM) {
          reason = 'below-route';
        } else if (unsupported && evidence.route.continuous && dot(evidence.linearVelocity, evidence.route.normal) <= -settings.minDownwardSpeedMps
          && fallDistanceM >= settings.minAccumulatedFallM && unsupportedSeconds >= settings.unsupportedSeconds) {
          reason = 'falling-without-contact';
        } else if ((evidence.route.valid && evidence.route.distanceM >= settings.projectionDistanceM)
          || projectionLostSeconds >= settings.projectionLostSeconds) {
          reason = 'projection-lost';
        }
      }

      previousSeparationM = evidence.separationM;
      previousProjectionDistanceM = evidence.route.distanceM;
      if (reason) {
        lastReason = reason;
        armed = false;
        rearmSafeSeconds = 0;
      }
      return freezeDeep({ reason, safeFrameCandidate, diagnostics: diagnostics() });
    }

    return Object.freeze({ observe, reset, markRecovered, diagnostics });
  }

  root.AsfaltoV6RecoveryGuard = Object.freeze({ RECOVERY_GUARD_DEFAULTS, createRecoveryGuard });
})(globalThis);
