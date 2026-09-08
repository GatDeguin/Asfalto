
(function installAsfaltoV6VehicleCore(root) {
  'use strict';

  function clamp(value, minimum, maximum) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return minimum;
    return Math.min(maximum, Math.max(minimum, numeric));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object') return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    for (const child of Object.values(value)) deepFreeze(child, visited);
    return Object.freeze(value);
  }

  function finiteSnapshot(value, path) {
    const location = path || 'snapshot';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError(location + ' debe ser finito');
      return value;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      return Object.freeze(value.map((child, index) => finiteSnapshot(child, location + '[' + index + ']')));
    }
    if (value && typeof value === 'object') {
      const copy = {};
      for (const [key, child] of Object.entries(value)) {
        copy[key] = finiteSnapshot(child, location + '.' + key);
      }
      return Object.freeze(copy);
    }
    throw new TypeError(location + ' contiene un valor no serializable');
  }

  const CHEVY_ORIGINAL_SPEC = deepFreeze({
    id: 'chevy-serie-2-original',
    label: 'Chevy Serie 2 Original',
    profile: 'original',
    isCalibrationOnly: false,
    massKg: 1495,
    dimensionsM: { length: 4.86, width: 1.843, height: 1.398 },
    wheelbaseM: 2.819,
    groundClearanceM: 0.172,
    fuelCapacityLiters: 68,
    frontTrackM: 1.48,
    rearTrackM: 1.47,
    frontWeightFraction: 0.54,
    cgHeightM: 0.56,
    wheelRadiusM: 0.315,
    steering: {
      ratio: 24,
      turnsLockToLock: 5.5,
      minimumTurningDiameterM: 11.2,
      maximumRoadWheelAngleRad: 0.48,
    },
    engine: {
      displacementLiters: 4.097,
      idleRpm: 825,
      powerPeakRpm: 4400,
      mechanicalLimitRpm: 5200,
      torqueCurveNm: [
        [800, 190], [1200, 270], [1800, 333], [2400, 325],
        [3600, 305], [4400, 275], [5200, 205],
      ],
    },
    gearbox: {
      forward: [3.11, 2.2, 1.47, 1],
      reverse: 3.11,
      finalDrive: 3.36,
    },
    drivetrain: {
      drivenAxle: 'rear',
      efficiency: 0.67,
      differential: 'open',
    },
    aero: {
      dragCoefficient: 0.36,
      frontalAreaM2: 2.1,
      linearDamping: 0.002,
    },
    tires: {
      dryMu: 1,
      frontCorneringStiffnessNprad: 50000,
      rearCorneringStiffnessNprad: 58000,
      frontLongitudinalStiffnessN: 52000,
      rearLongitudinalStiffnessN: 50000,
      frontRelaxationLengthM: 0.5,
      rearRelaxationLengthM: 0.42,
    },
    brakes: {
      masterTorqueNm: 6650,
      frontBias: 0.62,
      pressureBuildSeconds: 0.65,
      pressureReleaseSeconds: 0.18,
      frontColdFrictionFactor: 0.62,
      rearColdFrictionFactor: 0.62,
      frontOptimalTemperatureC: 42,
      rearOptimalTemperatureC: 35,
      frontFadeStartC: 300,
      rearFadeStartC: 190,
      frontFadeSpanC: 220,
      rearFadeSpanC: 170,
      rearMaximumFade: 0.75,
      frontHeatCapacityJpC: 12000,
      rearHeatCapacityJpC: 10000,
      highSpeedFrictionStartMps: 24,
      highSpeedFrictionSpanMps: 18,
      highSpeedMaximumFrictionLoss: 0.382,
    },
    assists: {
      steering: false,
      abs: false,
      tcs: false,
      stability: false,
    },
  });

  const CHEVY_RESTOMOD_SPEC = deepFreeze({
    ...CHEVY_ORIGINAL_SPEC,
    id: 'chevy-serie-2-restomod',
    label: 'Chevy Serie 2 Restomod',
    profile: 'restomod',
    gearbox: {
      ...CHEVY_ORIGINAL_SPEC.gearbox,
      forward: [3.11, 2.2, 1.47, 1, 0.82],
    },
  });

  const FALCON_CALIBRATED_SPEC = deepFreeze({
    id: 'ford-falcon-calibrated-rival',
    label: 'Ford Falcon rival',
    profile: 'falcon-calibration',
    isCalibrationOnly: true,
    massKg: 1450,
    dimensionsM: { length: 4.65, width: 1.78, height: 1.42 },
    wheelbaseM: 2.79,
    groundClearanceM: 0.17,
    fuelCapacityLiters: 60,
    frontTrackM: 1.47,
    rearTrackM: 1.46,
    frontWeightFraction: 0.53,
    cgHeightM: 0.57,
    wheelRadiusM: 0.32,
    steering: {
      ratio: 22,
      turnsLockToLock: 5.2,
      minimumTurningDiameterM: 11.3,
      maximumRoadWheelAngleRad: 0.46,
    },
    engine: {
      displacementLiters: 3.62,
      idleRpm: 800,
      powerPeakRpm: 4400,
      mechanicalLimitRpm: 5000,
      torqueCurveNm: [
        [800, 175], [1400, 245], [2200, 285], [3200, 278], [4400, 235], [5000, 190],
      ],
    },
    gearbox: {
      forward: [3.05, 2.12, 1.43, 1],
      reverse: 3.05,
      finalDrive: 3.5,
    },
    drivetrain: {
      drivenAxle: 'rear',
      efficiency: 0.79,
      differential: 'open',
    },
    aero: {
      dragCoefficient: 0.46,
      frontalAreaM2: 2.08,
    },
    tires: {
      dryMu: 0.98,
      frontCorneringStiffnessNprad: 51000,
      rearCorneringStiffnessNprad: 55000,
      frontLongitudinalStiffnessN: 51000,
      rearLongitudinalStiffnessN: 49000,
      frontRelaxationLengthM: 0.48,
      rearRelaxationLengthM: 0.44,
    },
    assists: {
      steering: false,
      abs: false,
      tcs: false,
      stability: false,
    },
  });

  function requirePositiveNumber(value, label) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(label + ' debe ser positivo y finito');
  }

  function validateVehicleSpec(spec) {
    if (!spec || typeof spec !== 'object') throw new TypeError('VehicleSpec requerido');
    for (const key of [
      'massKg', 'wheelbaseM', 'groundClearanceM', 'fuelCapacityLiters',
      'frontTrackM', 'rearTrackM', 'frontWeightFraction', 'cgHeightM', 'wheelRadiusM',
    ]) requirePositiveNumber(spec[key], key);
    if (spec.frontWeightFraction >= 1) throw new TypeError('frontWeightFraction debe ser menor que uno');
    for (const key of ['length', 'width', 'height']) requirePositiveNumber(spec.dimensionsM?.[key], 'dimensionsM.' + key);
    requirePositiveNumber(spec.steering?.ratio, 'steering.ratio');
    requirePositiveNumber(spec.steering?.turnsLockToLock, 'steering.turnsLockToLock');
    requirePositiveNumber(spec.steering?.minimumTurningDiameterM, 'steering.minimumTurningDiameterM');
    requirePositiveNumber(spec.steering?.maximumRoadWheelAngleRad, 'steering.maximumRoadWheelAngleRad');
    for (const key of [
      'dryMu',
      'frontCorneringStiffnessNprad',
      'rearCorneringStiffnessNprad',
      'frontLongitudinalStiffnessN',
      'rearLongitudinalStiffnessN',
      'frontRelaxationLengthM',
      'rearRelaxationLengthM',
    ]) requirePositiveNumber(spec.tires?.[key], 'tires.' + key);
    if (!Array.isArray(spec.gearbox?.forward) || spec.gearbox.forward.length < 1
        || spec.gearbox.forward.some((ratio) => !Number.isFinite(ratio) || ratio <= 0)) {
      throw new TypeError('gearbox.forward contiene una relacion invalida');
    }
    requirePositiveNumber(spec.gearbox.reverse, 'gearbox.reverse');
    requirePositiveNumber(spec.gearbox.finalDrive, 'gearbox.finalDrive');
    if (!['front', 'rear', 'all'].includes(spec.drivetrain?.drivenAxle)) {
      throw new TypeError('drivetrain.drivenAxle invalido');
    }
    requirePositiveNumber(spec.drivetrain.efficiency, 'drivetrain.efficiency');
    if (spec.drivetrain.efficiency > 1) throw new TypeError('drivetrain.efficiency debe ser menor o igual a uno');
    requirePositiveNumber(spec.engine?.displacementLiters, 'engine.displacementLiters');
    requirePositiveNumber(spec.engine?.idleRpm, 'engine.idleRpm');
    requirePositiveNumber(spec.engine?.powerPeakRpm, 'engine.powerPeakRpm');
    requirePositiveNumber(spec.engine?.mechanicalLimitRpm, 'engine.mechanicalLimitRpm');
    if (!Array.isArray(spec.engine?.torqueCurveNm) || spec.engine.torqueCurveNm.length < 2
        || spec.engine.torqueCurveNm.some((point) => !Array.isArray(point) || point.length !== 2
          || point.some((value) => !Number.isFinite(value) || value <= 0))) {
      throw new TypeError('engine.torqueCurveNm invalida');
    }
    for (const key of ['steering', 'abs', 'tcs', 'stability']) {
      if (typeof spec.assists?.[key] !== 'boolean') throw new TypeError('assists.' + key + ' debe ser booleano');
    }
    return true;
  }

  const WHEEL_IDS = Object.freeze(['frontLeft', 'frontRight', 'rearLeft', 'rearRight']);

  function createVehicleState(spec) {
    validateVehicleSpec(spec);
    const frontX = spec.wheelbaseM * (1 - spec.frontWeightFraction);
    const rearX = -spec.wheelbaseM * spec.frontWeightFraction;
    const wheels = WHEEL_IDS.map((id, index) => {
      const front = index < 2;
      const left = index % 2 === 0;
      return {
        id,
        axle: front ? 'front' : 'rear',
        side: left ? 'left' : 'right',
        localAnchorM: [front ? frontX : rearX, -spec.cgHeightM, (left ? 1 : -1) * (front ? spec.frontTrackM : spec.rearTrackM) * 0.5],
        angularSpeedRadps: 0,
        rotationRad: 0,
        steerAngleRad: 0,
        slipAngleRad: 0,
        slipRatio: 0,
        normalLoadN: 0,
        compressionM: 0,
        compressionVelocityMps: 0,
        contact: false,
        surface: 'asphalt',
        waterDepthM: 0,
        temperatureC: 20,
        pressureRatio: 1,
        condition: 1,
      };
    });
    return {
      specId: spec.id,
      timeSeconds: 0,
      chassis: {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        linearVelocity: [0, 0, 0],
        angularVelocity: [0, 0, 0],
      },
      controls: { steering: 0, throttle: 0, brake: 0, clutch: 1, handbrake: 0 },
      engine: { rpm: spec.engine.idleRpm, load: 0, temperatureC: 20 },
      gearbox: { gear: 0, requestedGear: 0, shiftRejected: false },
      clutch: { engagement: 0, slipRadps: 0, temperatureC: 20 },
      brakes: { frontTemperatureC: 20, rearTemperatureC: 20, fade: 0 },
      wheels,
    };
  }

  class FixedStepClock {
    constructor(options) {
      const config = options || {};
      requirePositiveNumber(config.stepSeconds, 'stepSeconds');
      if (!Number.isInteger(config.maxSubsteps) || config.maxSubsteps < 1) {
        throw new TypeError('maxSubsteps debe ser un entero positivo');
      }
      this.stepSeconds = config.stepSeconds;
      this.maxSubsteps = config.maxSubsteps;
      this.accumulatorSeconds = 0;
      this.overruns = 0;
      this.paused = false;
    }

    get alpha() {
      return this.accumulatorSeconds / this.stepSeconds;
    }

    reset() {
      this.accumulatorSeconds = 0;
      this.overruns = 0;
      return true;
    }

    pause() {
      this.paused = true;
      this.accumulatorSeconds = 0;
      return true;
    }

    resume() {
      this.paused = false;
      this.accumulatorSeconds = 0;
      return true;
    }

    advance(deltaSeconds, callback) {
      if (typeof callback !== 'function') throw new TypeError('callback de fixed step requerido');
      const delta = Number(deltaSeconds);
      if (this.paused || !Number.isFinite(delta) || delta <= 0) {
        return Object.freeze({ steps: 0, alpha: this.alpha, overruns: this.overruns, droppedSeconds: 0 });
      }
      this.accumulatorSeconds += delta;
      let steps = 0;
      while (steps < this.maxSubsteps
          && this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds) {
        callback(this.stepSeconds);
        this.accumulatorSeconds -= this.stepSeconds;
        if (Math.abs(this.accumulatorSeconds) < 1e-12) this.accumulatorSeconds = 0;
        steps += 1;
      }
      let droppedSeconds = 0;
      if (this.accumulatorSeconds + Number.EPSILON >= this.stepSeconds) {
        droppedSeconds = this.accumulatorSeconds;
        this.accumulatorSeconds = 0;
        this.overruns += 1;
      }
      return Object.freeze({
        steps,
        alpha: this.alpha,
        overruns: this.overruns,
        droppedSeconds,
      });
    }
  }

  function finiteNumber(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function computeSuspensionForce(input) {
    const values = input || {};
    if (values.contact === false) {
      return Object.freeze({
        normalForceN: 0,
        springForceN: 0,
        damperForceN: 0,
        bumpStopForceN: 0,
        compressionM: 0,
        travelLimited: false,
      });
    }
    const maxTravelM = Math.max(1e-4, finiteNumber(values.maxTravelM, 0.18));
    const compressionM = clamp(finiteNumber(values.compressionM, 0), 0, maxTravelM);
    const velocity = finiteNumber(values.compressionVelocityMps, 0);
    const springRate = Math.max(0, finiteNumber(values.springRateNpm, 0));
    const bumpRate = Math.max(0, finiteNumber(values.damperBumpNsPm, 0));
    const reboundRate = Math.max(0, finiteNumber(values.damperReboundNsPm, 0));
    const bumpStopStartM = clamp(finiteNumber(values.bumpStopStartM, maxTravelM), 0, maxTravelM);
    const springForceN = springRate * compressionM;
    const damperForceN = (velocity >= 0 ? bumpRate : reboundRate) * velocity;
    const stopRange = Math.max(1e-4, maxTravelM - bumpStopStartM);
    const stopCompression = Math.max(0, compressionM - bumpStopStartM);
    const stopProgress = clamp(stopCompression / stopRange, 0, 1);
    const bumpStopRateNpm = Math.max(120_000, springRate * 4);
    const bumpStopForceN = bumpStopRateNpm * stopCompression * (1 + 4 * stopProgress * stopProgress);
    return Object.freeze({
      normalForceN: Math.max(0, springForceN + damperForceN + bumpStopForceN),
      springForceN,
      damperForceN,
      bumpStopForceN,
      compressionM,
      travelLimited: finiteNumber(values.compressionM, 0) >= maxTravelM,
    });
  }

  function computeAxleCoupling(input) {
    const values = input || {};
    const differenceM = finiteNumber(values.leftCompressionM, 0)
      - finiteNumber(values.rightCompressionM, 0);
    const antiRollRateNpm = Math.max(0, finiteNumber(values.antiRollRateNpm, 0));
    const rigidRateNpm = values.rigidAxle
      ? Math.max(0, finiteNumber(values.rigidCouplingRateNpm, 0))
      : 0;
    const transferN = differenceM * (antiRollRateNpm + rigidRateNpm);
    return Object.freeze({
      leftAdjustmentN: transferN,
      rightAdjustmentN: -transferN,
      transferN,
    });
  }

  const SURFACE_GRIP = Object.freeze({
    asphalt: 1,
    'wet-asphalt': 0.72,
    gravel: 0.64,
    dirt: 0.58,
    grass: 0.46,
  });

  function tireCapacity(input) {
    const load = Math.max(0, finiteNumber(input?.normalLoadN, 0));
    const baseMu = Math.max(0, finiteNumber(input?.mu, 0));
    const surfaceFactor = SURFACE_GRIP[input?.surface || 'asphalt'] ?? 0.55;
    if (load === 0 || baseMu === 0) return Object.freeze({ capacityN: 0, muEffective: 0 });
    const loadFactor = Math.pow(load / 4000, -0.08);
    const muSurface = baseMu * surfaceFactor;
    const muEffective = clamp(muSurface * loadFactor, muSurface * 0.55, muSurface * 1.25);
    return Object.freeze({ capacityN: muEffective * load, muEffective });
  }

  function computeFialaLateral(input) {
    const angle = clamp(finiteNumber(input?.slipAngleRad, 0), -0.75, 0.75);
    const stiffness = Math.max(1, finiteNumber(input?.corneringStiffnessNprad, 1));
    const capacity = tireCapacity(input);
    if (angle === 0 || capacity.capacityN === 0) {
      return Object.freeze({
        forceN: 0,
        aligningTorqueNm: 0,
        saturationAngleRad: 0,
        utilization: 0,
        warning: false,
        saturated: false,
        ...capacity,
      });
    }
    const saturationAngleRad = Math.atan(3 * capacity.capacityN / stiffness);
    const tangent = Math.tan(angle);
    let forceN;
    let saturated = Math.abs(angle) >= saturationAngleRad;
    if (saturated) {
      forceN = -Math.sign(angle) * capacity.capacityN;
    } else {
      const c2 = stiffness * stiffness;
      const c3 = c2 * stiffness;
      const f = capacity.capacityN;
      forceN = -stiffness * tangent
        + c2 * Math.abs(tangent) * tangent / (3 * f)
        - c3 * tangent * tangent * tangent / (27 * f * f);
      forceN = clamp(forceN, -capacity.capacityN, capacity.capacityN);
      saturated = Math.abs(forceN) >= capacity.capacityN;
    }
    const utilization = capacity.capacityN > 0 ? Math.min(1, Math.abs(forceN) / capacity.capacityN) : 0;
    const warning = Math.abs(angle) >= saturationAngleRad * 0.7;
    const aligningTorqueNm = -forceN * 0.085 * Math.max(0, 1 - utilization);
    return Object.freeze({
      forceN,
      aligningTorqueNm,
      saturationAngleRad,
      utilization,
      warning,
      saturated,
      ...capacity,
    });
  }

  function computeLongitudinalBrush(input) {
    const ratio = clamp(finiteNumber(input?.slipRatio, 0), -2, 2);
    const stiffness = Math.max(1, finiteNumber(input?.longitudinalStiffnessN, 1));
    const capacity = tireCapacity(input);
    const raw = stiffness * ratio;
    const forceN = clamp(raw, -capacity.capacityN, capacity.capacityN);
    const utilization = capacity.capacityN > 0 ? Math.min(1, Math.abs(raw) / capacity.capacityN) : 0;
    return Object.freeze({
      forceN,
      utilization,
      warning: utilization >= 0.75,
      saturated: capacity.capacityN > 0 && Math.abs(raw) >= capacity.capacityN,
      ...capacity,
    });
  }

  function combineTireForces(input) {
    const capacityN = Math.max(0, finiteNumber(input?.capacityN, 0));
    const rawFxN = finiteNumber(input?.rawFxN, 0);
    const rawFyN = finiteNumber(input?.rawFyN, 0);
    const demand = capacityN > 0 ? Math.hypot(rawFxN / capacityN, rawFyN / capacityN) : 0;
    const scale = demand > 1 ? 1 / demand : 1;
    return Object.freeze({
      fxN: rawFxN * scale,
      fyN: rawFyN * scale,
      aligningTorqueNm: finiteNumber(input?.aligningTorqueNm, 0) * scale,
      utilization: Math.min(1, demand),
      warning: Boolean(input?.warning) || demand >= 0.75,
      saturated: demand >= 1,
      capacityN,
    });
  }

  function computeTireForces(input) {
    const lateral = computeFialaLateral(input);
    const longitudinal = computeLongitudinalBrush(input);
    const capacityN = Math.min(lateral.capacityN, longitudinal.capacityN);
    const combined = combineTireForces({
      rawFxN: longitudinal.forceN,
      rawFyN: lateral.forceN,
      capacityN,
      aligningTorqueNm: lateral.aligningTorqueNm,
      warning: lateral.warning || longitudinal.warning,
    });
    return Object.freeze({
      ...combined,
      muEffective: lateral.muEffective,
      warning: combined.warning,
      saturated: combined.saturated || lateral.saturated || longitudinal.saturated,
      saturationAngleRad: lateral.saturationAngleRad,
    });
  }

  function computeAckermann(input) {
    const center = clamp(finiteNumber(input?.centerSteerRad, 0), -1.2, 1.2);
    if (center === 0) return Object.freeze({ frontLeftRad: 0, frontRightRad: 0 });
    const wheelbase = Math.max(0.1, finiteNumber(input?.wheelbaseM, 0.1));
    const track = Math.max(0.1, finiteNumber(input?.frontTrackM, 0.1));
    const sign = Math.sign(center);
    const radius = wheelbase / Math.tan(Math.abs(center));
    const inner = Math.atan(wheelbase / Math.max(0.05, radius - track * 0.5));
    const outer = Math.atan(wheelbase / (radius + track * 0.5));
    return sign > 0
      ? Object.freeze({ frontLeftRad: inner, frontRightRad: outer })
      : Object.freeze({ frontLeftRad: -outer, frontRightRad: -inner });
  }

  function stepWheelState(state, input, dt) {
    const stepSeconds = finiteNumber(dt, 0);
    if (stepSeconds <= 0) throw new TypeError('dt de rueda debe ser positivo');
    const speed = Math.abs(finiteNumber(input?.longitudinalSpeedMps, 0));
    const relaxationLength = Math.max(0.05, finiteNumber(input?.relaxationLengthM, 0.45));
    const relaxationAlpha = 1 - Math.exp(-Math.max(0.5, speed) * stepSeconds / relaxationLength);
    const slipAngleRad = lerp(
      finiteNumber(state?.slipAngleRad, 0),
      clamp(finiteNumber(input?.targetSlipAngleRad, 0), -0.75, 0.75),
      relaxationAlpha,
    );
    const slipRatio = lerp(
      finiteNumber(state?.slipRatio, 0),
      clamp(finiteNumber(input?.targetSlipRatio, 0), -2, 2),
      relaxationAlpha,
    );
    const pressureRatio = clamp(finiteNumber(state?.pressureRatio, 1), 0.2, 1.2);
    const condition = clamp(finiteNumber(state?.condition, 1), 0, 1);
    const tire = computeTireForces({
      ...input,
      slipAngleRad,
      slipRatio,
      mu: Math.max(0, finiteNumber(input?.mu, 0)) * (0.65 + 0.35 * pressureRatio) * condition,
    });
    const wheelRadius = Math.max(0.05, finiteNumber(input?.wheelRadiusM, 0.3));
    const angularTarget = finiteNumber(input?.longitudinalSpeedMps, 0) * (1 + slipRatio) / wheelRadius;
    const angularBlend = 1 - Math.exp(-12 * stepSeconds);
    const angularSpeedRadps = lerp(finiteNumber(state?.angularSpeedRadps, 0), angularTarget, angularBlend);
    const rotationRad = (finiteNumber(state?.rotationRad, 0) + angularSpeedRadps * stepSeconds) % (Math.PI * 2);
    const previousTemperature = clamp(finiteNumber(state?.temperatureC, 20), 0, 200);
    const slipWork = (Math.abs(tire.fxN * slipRatio)
      + Math.abs(tire.fyN * Math.tan(slipAngleRad))) * speed;
    const temperatureC = clamp(
      previousTemperature + slipWork * stepSeconds / 90_000
        - Math.max(0, previousTemperature - 20) * 0.015 * stepSeconds,
      20,
      140,
    );
    return Object.freeze({
      ...state,
      slipAngleRad,
      slipRatio,
      angularSpeedRadps,
      rotationRad,
      temperatureC,
      pressureRatio,
      condition,
      relaxationAlpha,
      tire,
    });
  }

  function torqueAtRpm(spec, rpm, throttle) {
    validateVehicleSpec(spec);
    const curve = spec.engine.torqueCurveNm;
    const speed = clamp(finiteNumber(rpm, spec.engine.idleRpm), curve[0][0], curve[curve.length - 1][0]);
    let torque = curve[curve.length - 1][1];
    for (let index = 1; index < curve.length; index += 1) {
      const previous = curve[index - 1];
      const next = curve[index];
      if (speed <= next[0]) {
        torque = lerp(previous[1], next[1], (speed - previous[0]) / (next[0] - previous[0]));
        break;
      }
    }
    const pedal = clamp(finiteNumber(throttle, 0), 0, 1);
    const response = pedal === 0 ? 0 : 0.08 * pedal + 0.92 * Math.pow(pedal, 1.1);
    return torque * response;
  }

  function requestGear(state, spec, requestedGear) {
    validateVehicleSpec(spec);
    if (!Number.isInteger(requestedGear) || requestedGear < -1) {
      throw new RangeError('marcha solicitada invalida');
    }
    if (requestedGear > spec.gearbox.forward.length) {
      if (requestedGear === 5 && spec.profile === 'original') {
        throw new RangeError('quinta disponible solo en Restomod');
      }
      throw new RangeError('marcha fuera de la caja');
    }
    return Object.freeze({
      accepted: true,
      reason: null,
      state: Object.freeze({ ...state, gear: requestedGear, requestedGear }),
    });
  }

  function drivenWheelIndexes(spec, wheels) {
    const axle = spec.drivetrain.drivenAxle;
    const indexes = [];
    for (let index = 0; index < wheels.length; index += 1) {
      if (axle === 'all' || wheels[index].axle === axle) indexes.push(index);
    }
    return indexes;
  }

  function stepPowertrain(state, controls, wheels, dt, spec) {
    validateVehicleSpec(spec);
    const stepSeconds = finiteNumber(dt, 0);
    if (stepSeconds <= 0) throw new TypeError('dt de powertrain debe ser positivo');
    if (!Array.isArray(wheels) || wheels.length !== 4) throw new TypeError('powertrain requiere cuatro ruedas');
    const gear = Number.isInteger(state?.gear) ? state.gear : 0;
    if (gear < -1 || gear > spec.gearbox.forward.length) throw new RangeError('estado de marcha invalido');
    const ratio = gear === -1 ? -spec.gearbox.reverse
      : gear === 0 ? 0
        : spec.gearbox.forward[gear - 1];
    const throttle = clamp(finiteNumber(controls?.throttle, 0), 0, 1);
    const clutchEngagement = clamp(finiteNumber(state?.clutchEngagement, 0), 0, 1);
    const driven = drivenWheelIndexes(spec, wheels);
    const meanWheelOmega = driven.length
      ? driven.reduce((sum, index) => sum + Math.abs(finiteNumber(wheels[index].angularSpeedRadps, 0)), 0) / driven.length
      : 0;
    const drivelineRpm = Math.abs(ratio) > 0
      ? meanWheelOmega * 60 / (Math.PI * 2) * Math.abs(ratio) * spec.gearbox.finalDrive
      : spec.engine.idleRpm;
    const previousRpm = clamp(
      finiteNumber(state?.engineRpm, spec.engine.idleRpm),
      spec.engine.idleRpm,
      spec.engine.mechanicalLimitRpm + 250,
    );
    const freeTargetRpm = spec.engine.idleRpm
      + throttle * (spec.engine.mechanicalLimitRpm - spec.engine.idleRpm);
    const coupledTargetRpm = Math.max(spec.engine.idleRpm, drivelineRpm);
    const targetRpm = ratio === 0
      ? freeTargetRpm
      : lerp(freeTargetRpm, coupledTargetRpm, clutchEngagement);
    const rpmRate = ratio === 0 ? 3.2 : 8.0;
    const engineRpm = clamp(
      lerp(previousRpm, targetRpm, 1 - Math.exp(-rpmRate * stepSeconds)),
      spec.engine.idleRpm,
      spec.engine.mechanicalLimitRpm + 250,
    );
    const clutchSlipRadps = ratio === 0 ? 0 : (engineRpm - coupledTargetRpm) * Math.PI * 2 / 60;
    const engineTorqueNm = torqueAtRpm(spec, engineRpm, throttle);
    const openDiffUnloaded = driven.some((index) => wheels[index].contact === false
      || finiteNumber(wheels[index].normalLoadN, 0) < 100);
    const differentialFactor = openDiffUnloaded && spec.drivetrain.differential === 'open' ? 0.08 : 1;
    const driveTorqueNm = ratio === 0 ? 0
      : engineTorqueNm * ratio * spec.gearbox.finalDrive * spec.drivetrain.efficiency
        * clutchEngagement * differentialFactor;
    const wheelDriveTorquesNm = [0, 0, 0, 0];
    for (const index of driven) wheelDriveTorquesNm[index] = driveTorqueNm / driven.length;
    // Coolant temperature is independent of clutch slip heat. The thermostat
    // opens above 80 C; radiator damage and measured wheel speed affect cooling.
    const engineCooling = clamp(finiteNumber(controls?.engineCoolingCondition, 1), 0.05, 1);
    const previousEngineTemperature = clamp(finiteNumber(state?.engineTemperatureC, 20), -30, 220);
    const roadSpeedMps = meanWheelOmega * spec.wheelRadiusM;
    const thermalLoad = 0.28 + throttle * 0.55 + engineRpm / spec.engine.mechanicalLimitRpm * 0.22;
    const radiatorCooling = Math.max(0, previousEngineTemperature - 80) * 0.042
      * engineCooling * (1 + Math.min(40, roadSpeedMps) / 45);
    const engineTemperatureC = clamp(previousEngineTemperature
      + (thermalLoad + (controls?.engineFire === true ? 3 : 0) - radiatorCooling) * stepSeconds, -30, 220);
    const nextState = Object.freeze({
      ...state,
      engineTemperatureC,
      engineRpm,
      gear,
      clutchEngagement,
      clutchSlipRadps,
      temperatureC: clamp(finiteNumber(state?.temperatureC, 20)
        + Math.abs(clutchSlipRadps * engineTorqueNm) * stepSeconds / 60_000, 20, 220),
    });
    return Object.freeze({
      state: nextState,
      engineTorqueNm,
      driveTorqueNm,
      wheelDriveTorquesNm: Object.freeze(wheelDriveTorquesNm),
      differentialUnloaded: openDiffUnloaded,
    });
  }

  function brakeFade(temperatureC, startC, spanC = 350, maximum = 0.65) {
    return clamp(
      (temperatureC - startC) / Math.max(1, spanC), 0, maximum,
    );
  }

  function brakeWarmFactor(temperatureC, optimalC, coldFactor) {
    const cold = clamp(coldFactor, 0.35, 1);
    if (temperatureC >= optimalC) return 1;
    return lerp(
      cold, 1, clamp((temperatureC - 20) / Math.max(1, optimalC - 20), 0, 1),
    );
  }

  function stepBrakes(state, controls, wheels, dt, spec) {
    validateVehicleSpec(spec);
    const stepSeconds = finiteNumber(dt, 0);
    if (stepSeconds <= 0) throw new TypeError('dt de frenos debe ser positivo');
    if (!Array.isArray(wheels) || wheels.length !== 4) throw new TypeError('frenos requieren cuatro ruedas');
    const pedal = clamp(finiteNumber(controls?.brake, 0), 0, 1);
    const handbrake = clamp(finiteNumber(controls?.handbrake, 0), 0, 1);
    const normalized = clamp((pedal - 0.06) / 0.94, 0, 1);
    const previousPressure = clamp(
      finiteNumber(state?.hydraulicPressure, normalized), 0, 1,
    );
    const buildSeconds = Math.max(0, finiteNumber(spec.brakes?.pressureBuildSeconds, 0));
    const releaseSeconds = Math.max(0, finiteNumber(spec.brakes?.pressureReleaseSeconds, 0));
    const pressureStep = normalized >= previousPressure
      ? (buildSeconds > 0 ? stepSeconds / buildSeconds : 1)
      : (releaseSeconds > 0 ? stepSeconds / releaseSeconds : 1);
    const hydraulicPressure = previousPressure
      + clamp(normalized - previousPressure, -pressureStep, pressureStep);
    const servo = hydraulicPressure
      * (0.55 + 0.45 * Math.min(1, hydraulicPressure / 0.22));
    const frontTemperatureC = clamp(finiteNumber(state?.frontTemperatureC, 20), 20, 1000);
    const rearTemperatureC = clamp(finiteNumber(state?.rearTemperatureC, 20), 20, 1000);
    const frontFade = brakeFade(
      frontTemperatureC,
      finiteNumber(spec.brakes?.frontFadeStartC, 420),
      finiteNumber(spec.brakes?.frontFadeSpanC, 350),
    );
    const rearFade = brakeFade(
      rearTemperatureC,
      finiteNumber(spec.brakes?.rearFadeStartC, 300),
      finiteNumber(spec.brakes?.rearFadeSpanC, 350),
      finiteNumber(spec.brakes?.rearMaximumFade, 0.65),
    );
    const averageWheelSpeedMps = wheels.reduce((sum, wheel) => sum
      + Math.abs(finiteNumber(wheel.angularSpeedRadps, 0))
        * Math.max(0.05, finiteNumber(wheel.wheelRadiusM, spec.wheelRadiusM)), 0) / wheels.length;
    const highSpeedFrictionLoss = clamp(
      (averageWheelSpeedMps - finiteNumber(spec.brakes?.highSpeedFrictionStartMps, 24))
        / Math.max(1, finiteNumber(spec.brakes?.highSpeedFrictionSpanMps, 18)),
      0,
      finiteNumber(spec.brakes?.highSpeedMaximumFrictionLoss, 0.36),
    );
    const masterTorqueNm = finiteNumber(spec.brakes?.masterTorqueNm, 4800)
      * servo * (1 - highSpeedFrictionLoss);
    const frontBias = clamp(finiteNumber(spec.brakes?.frontBias, 0.62), 0.5, 0.8);
    const frontWarmFactor = brakeWarmFactor(
      frontTemperatureC,
      finiteNumber(spec.brakes?.frontOptimalTemperatureC, 20),
      finiteNumber(spec.brakes?.frontColdFrictionFactor, 1),
    );
    const rearWarmFactor = brakeWarmFactor(
      rearTemperatureC,
      finiteNumber(spec.brakes?.rearOptimalTemperatureC, 20),
      finiteNumber(spec.brakes?.rearColdFrictionFactor, 1),
    );
    const frontPerWheelNm = masterTorqueNm * frontBias * 0.5 * frontWarmFactor * (1 - frontFade);
    const rearPerWheelNm = masterTorqueNm * (1 - frontBias) * 0.5 * rearWarmFactor * (1 - rearFade) + 1600 * handbrake;
    const wheelBrakeTorquesNm = Object.freeze([
      frontPerWheelNm, frontPerWheelNm, rearPerWheelNm, rearPerWheelNm,
    ]);
    const locked = Object.freeze(wheels.map((wheel, index) => {
      const capacityNm = Math.max(0, finiteNumber(wheel.normalLoadN, 0))
        * Math.max(0, finiteNumber(wheel.mu, 0.92))
        * Math.max(0.05, finiteNumber(wheel.wheelRadiusM, spec.wheelRadiusM));
      return Math.abs(finiteNumber(wheel.angularSpeedRadps, 0)) > 0.5
        && wheelBrakeTorquesNm[index] > capacityNm;
    }));
    const frontPowerW = Math.abs(frontPerWheelNm)
      * (Math.abs(finiteNumber(wheels[0].angularSpeedRadps, 0))
        + Math.abs(finiteNumber(wheels[1].angularSpeedRadps, 0)));
    const rearPowerW = Math.abs(rearPerWheelNm)
      * (Math.abs(finiteNumber(wheels[2].angularSpeedRadps, 0))
        + Math.abs(finiteNumber(wheels[3].angularSpeedRadps, 0)));
    const frontHeatCapacityJpC = Math.max(1000, finiteNumber(spec.brakes?.frontHeatCapacityJpC, 95_000));
    const rearHeatCapacityJpC = Math.max(1000, finiteNumber(spec.brakes?.rearHeatCapacityJpC, 120_000));
    const nextFrontTemperatureC = clamp(frontTemperatureC
      + frontPowerW * stepSeconds / frontHeatCapacityJpC - Math.max(0, frontTemperatureC - 20) * 0.01 * stepSeconds, 20, 1000);
    const nextRearTemperatureC = clamp(rearTemperatureC
      + rearPowerW * stepSeconds / rearHeatCapacityJpC - Math.max(0, rearTemperatureC - 20) * 0.008 * stepSeconds, 20, 1000);
    return Object.freeze({
      state: Object.freeze({
        ...state,
        frontTemperatureC: nextFrontTemperatureC,
        hydraulicPressure,
        rearTemperatureC: nextRearTemperatureC,
      }),
      wheelBrakeTorquesNm,
      locked,
      frontFade,
      rearFade,
    });
  }

  function waterGripFactor(input) {
    const speed = Math.abs(finiteNumber(input?.speedMps, 0));
    const depth = Math.max(0, finiteNumber(input?.waterDepthM, 0));
    const load = Math.max(0, finiteNumber(input?.normalLoadN, 0));
    if (speed === 0 || depth <= 0.001) return 1;
    const onsetSpeedMps = 20 + Math.sqrt(load) * 0.08;
    if (speed <= onsetSpeedMps) return 1;
    const speedSeverity = clamp((speed - onsetSpeedMps) / 25, 0, 1);
    const depthSeverity = clamp((depth - 0.001) / 0.008, 0, 1);
    return clamp(1 - 0.55 * speedSeverity * depthSeverity, 0.35, 1);
  }

  function createDamageState() {
    return deepFreeze({
      body: { frontCondition: 1, sideCondition: 1, undersideCondition: 1 },
      steering: { condition: 1, offsetRad: 0 },
      suspension: {
        frontLeft: { condition: 1 }, frontRight: { condition: 1 },
        rearLeft: { condition: 1 }, rearRight: { condition: 1 },
      },
      tires: {
        frontLeft: { condition: 1, pressureRatio: 1 },
        frontRight: { condition: 1, pressureRatio: 1 },
        rearLeft: { condition: 1, pressureRatio: 1 },
        rearRight: { condition: 1, pressureRatio: 1 },
      },
      brakes: { condition: 1, fade: 0 },
      drivetrain: { condition: 1 },
      gearbox: { condition: 1, shiftReliability: 1 },
      engine: { condition: 1, powerFactor: 1, coolingCondition: 1, fire: false, fireIntensity: 0, heatExposureSeconds: 0, fuelLeak: 0 },
    });
  }

  function mutableDamageCopy(state) {
    const source = state || createDamageState();
    // Explicit structural copies avoid a JSON serialization/parse at 120 Hz.
    // Every branch later frozen or modified stays independent of prior snapshots.
    const next = { ...source };
    for (const key of ['body', 'steering', 'brakes', 'drivetrain', 'gearbox', 'engine']) next[key] = { ...source[key] };
    for (const key of ['suspension', 'tires']) {
      next[key] = { ...source[key] };
      for (const wheel of ['frontLeft', 'frontRight', 'rearLeft', 'rearRight']) next[key][wheel] = { ...source[key][wheel] };
    }
    return next;
  }

  function conditionAfter(value, loss, minimum) {
    return clamp(finiteNumber(value, 1) - Math.max(0, loss), minimum ?? 0, 1);
  }

  function applyImpactDamage(state, event) {
    const next = mutableDamageCopy(state);
    const impulse = Math.max(0, finiteNumber(event?.impulseNs, 0));
    const loss = impulse / (impulse + 60_000) * 0.9;
    const point = Array.isArray(event?.localPointM) ? event.localPointM : [0, 0, 0];
    const x = finiteNumber(point[0], 0);
    const y = finiteNumber(point[1], 0);
    const z = finiteNumber(point[2], 0);
    if (x > 0.8) next.body.frontCondition = conditionAfter(next.body.frontCondition, loss, 0.15);
    if (x > 0.8 && Math.abs(z) < 0.9 && y > -0.6 && y < 0.8) {
      next.engine.coolingCondition = conditionAfter(next.engine.coolingCondition, loss * 1.2, 0.2);
      next.engine.condition = conditionAfter(next.engine.condition, loss * 0.45, 0.15);
      next.engine.fuelLeak = clamp(finiteNumber(next.engine.fuelLeak, 0) + Math.max(0, impulse - 18000) / 65000, 0, 1);
      // A major engine-bay crush can rupture fuel lines and ignite immediately.
      // Low impulse, side and rear contacts cannot trip this condition.
      if (impulse >= 45000 && next.engine.fuelLeak >= 0.4) {
        next.engine.fire = true;
        next.engine.fireIntensity = Math.max(finiteNumber(next.engine.fireIntensity, 0), 0.4 + next.engine.fuelLeak * 0.6);
      }
    }
    if (Math.abs(z) > 0.5) next.body.sideCondition = conditionAfter(next.body.sideCondition, loss * 0.8, 0.15);
    if (y < -0.25) next.body.undersideCondition = conditionAfter(next.body.undersideCondition, loss * 0.9, 0.1);
    if (x > 0.5 || Math.abs(z) > 0.5) {
      next.steering.condition = conditionAfter(next.steering.condition, loss * 0.75, 0.2);
      next.steering.offsetRad = clamp(next.steering.offsetRad + Math.sign(z || 1) * loss * 0.08, -0.18, 0.18);
    }
    const wheel = (x >= 0 ? 'front' : 'rear') + (z >= 0 ? 'Right' : 'Left');
    next.suspension[wheel].condition = conditionAfter(next.suspension[wheel].condition, loss * 0.85, 0.1);
    next.tires[wheel].condition = conditionAfter(next.tires[wheel].condition, loss * 0.55, 0.05);
    next.tires[wheel].pressureRatio = conditionAfter(next.tires[wheel].pressureRatio, loss * 0.6, 0.15);
    if (x < -0.4 || y < -0.25) next.drivetrain.condition = conditionAfter(next.drivetrain.condition, loss * 0.6, 0.15);
    return deepFreeze(next);
  }

  function applyMechanicalWear(state, telemetry, dt) {
    const stepSeconds = finiteNumber(dt, 0);
    if (stepSeconds <= 0) throw new TypeError('dt de desgaste debe ser positivo');
    const next = mutableDamageCopy(state);
    const overrev = clamp((finiteNumber(telemetry?.engineRpm, 0) - 5200) / 1000, 0, 2);
    const engineTemperatureC = finiteNumber(telemetry?.engineTemperatureC, 20);
    const engineHeat = clamp((engineTemperatureC - 105) / 40, 0, 2);
    const thermalExposure = Math.max(0, (engineTemperatureC - 135) / 20);
    const exposureRate = thermalExposure > 0 ? Math.min(2, thermalExposure) : -2;
    next.engine.heatExposureSeconds = clamp(finiteNumber(next.engine.heatExposureSeconds, 0) + exposureRate * stepSeconds, 0, 30);
    const leakingFuel = finiteNumber(next.engine.fuelLeak, 0);
    next.engine.fire = next.engine.fire === true || next.engine.heatExposureSeconds >= 8
      || (leakingFuel > 0.35 && engineTemperatureC > 125 && next.engine.heatExposureSeconds >= 3);
    next.engine.fireIntensity = next.engine.fire ? clamp(Math.max(finiteNumber(next.engine.fireIntensity, 0), 0.35 + leakingFuel * 0.45 + engineHeat * 0.2), 0.35, 1) : 0;
    const frontHeat = clamp((finiteNumber(telemetry?.frontBrakeTemperatureC, 20) - 420) / 350, 0, 2);
    const rearHeat = clamp((finiteNumber(telemetry?.rearBrakeTemperatureC, 20) - 300) / 350, 0, 2);
    const clutchStress = clamp(finiteNumber(telemetry?.clutchSlipPowerW, 0) / 100_000, 0, 2);
    const shiftShock = clamp(finiteNumber(telemetry?.shiftShock, 0), 0, 2);
    const bottomOut = clamp(finiteNumber(telemetry?.bottomOut, 0), 0, 2);
    next.engine.condition = conditionAfter(next.engine.condition, (overrev * 0.02 + engineHeat * 0.01 + next.engine.fireIntensity * 0.02) * stepSeconds, 0.15);
    next.engine.powerFactor = conditionAfter(next.engine.powerFactor, (overrev * 0.03 + engineHeat * 0.02 + next.engine.fireIntensity * 0.03) * stepSeconds, 0.2);
    next.engine.coolingCondition = conditionAfter(next.engine.coolingCondition, engineHeat * 0.015 * stepSeconds, 0.2);
    next.brakes.condition = conditionAfter(next.brakes.condition, (frontHeat + rearHeat) * 0.012 * stepSeconds, 0.15);
    next.brakes.fade = clamp(next.brakes.fade + (frontHeat + rearHeat) * 0.01 * stepSeconds, 0, 0.8);
    next.gearbox.condition = conditionAfter(next.gearbox.condition, shiftShock * 0.01 * stepSeconds, 0.15);
    next.gearbox.shiftReliability = conditionAfter(next.gearbox.shiftReliability, shiftShock * 0.015 * stepSeconds, 0.2);
    next.drivetrain.condition = conditionAfter(next.drivetrain.condition, clutchStress * 0.012 * stepSeconds, 0.15);
    for (const wheel of ['frontLeft', 'frontRight', 'rearLeft', 'rearRight']) {
      next.suspension[wheel].condition = conditionAfter(
        next.suspension[wheel].condition,
        bottomOut * 0.01 * stepSeconds,
        0.1,
      );
    }
    return deepFreeze(next);
  }

  function recoverDamage(state) {
    return state;
  }

  root.AsfaltoV6VehicleCore = Object.freeze({
    CHEVY_ORIGINAL_SPEC,
    CHEVY_RESTOMOD_SPEC,
    FALCON_CALIBRATED_SPEC,
    FixedStepClock,
    clamp,
    lerp,
    finiteSnapshot,
    createVehicleState,
    validateVehicleSpec,
    computeSuspensionForce,
    computeAxleCoupling,
    computeFialaLateral,
    computeLongitudinalBrush,
    combineTireForces,
    computeTireForces,
    computeAckermann,
    stepWheelState,
    torqueAtRpm,
    requestGear,
    stepPowertrain,
    stepBrakes,
    waterGripFactor,
    createDamageState,
    applyImpactDamage,
    applyMechanicalWear,
    recoverDamage,
  });
}(globalThis));
