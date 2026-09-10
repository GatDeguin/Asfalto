
(function exposeAsfaltoV6Input(root) {
  'use strict';

  const PROFILE_STORAGE_KEY = 'asfalto-nacional-v6-profile';
  const DEG_TO_RAD = Math.PI / 180;
  const RAD_TO_DEG = 180 / Math.PI;
  const MAX_HANDWHEEL_DEGREES = 990;
  const MAX_HANDWHEEL_RAD = MAX_HANDWHEEL_DEGREES * DEG_TO_RAD;
  const MAX_ROAD_WHEEL_RAD = 0.48;
  const ACTION_NAMES = Object.freeze([
    'steerLeft',
    'steerRight',
    'throttle',
    'brake',
    'clutch',
    'handbrake',
  ]);
  const STEERING_MODES = Object.freeze(['none', 'keyboard', 'pointer', 'analog']);

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function approach(value, target, maximumDelta) {
    if (value < target) return Math.min(target, value + maximumDelta);
    if (value > target) return Math.max(target, value - maximumDelta);
    return target;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function normalizeSteeringMode(value) {
    return STEERING_MODES.includes(value) ? value : 'none';
  }

  function normalizeAnalogFrame(frame) {
    return {
      brake: clamp(finite(frame?.brake, 0), 0, 1),
      clutch: clamp(finite(frame?.clutch, 0), 0, 1),
      handbrake: clamp(finite(frame?.handbrake, 0), 0, 1),
      steer: clamp(finite(frame?.steer, 0), -1, 1),
      steeringMode: normalizeSteeringMode(frame?.steeringMode),
      throttle: clamp(finite(frame?.throttle, 0), 0, 1),
    };
  }

  const BASE_ASSISTS = Object.freeze({
    steering: false,
    abs: false,
    tcs: false,
    stability: false,
  });

  const ORIGINAL_DEFAULTS = deepFreeze({
    version: 1,
    physicsProfile: 'original',
    classification: 'historical',
    gearCount: 4,
    rivalCount: 1,
    assists: { ...BASE_ASSISTS },
    steeringRatio: 24,
    lockToLockTurns: 5.5,
    maxHandwheelDegrees: MAX_HANDWHEEL_DEGREES,
    maximumRoadWheelAngleRad: MAX_ROAD_WHEEL_RAD,
    pedalRates: {
      throttleAttack: 2.2,
      throttleRelease: 3.1,
      brakeAttack: 3.2,
      brakeRelease: 3.6,
      clutchAttack: 2.4,
      clutchRelease: 3.2,
      handbrakeAttack: 4.5,
      handbrakeRelease: 5.5,
    },
  });

  const RESTOMOD_DEFAULTS = deepFreeze({
    ...ORIGINAL_DEFAULTS,
    physicsProfile: 'restomod',
    classification: 'restomod',
    gearCount: 5,
    assists: { ...BASE_ASSISTS },
    pedalRates: { ...ORIGINAL_DEFAULTS.pedalRates },
  });

  function parseProfile(value) {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return typeof value === 'object' ? value : null;
  }

  function normalizeAssists(value, fallback) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      steering: typeof source.steering === 'boolean' ? source.steering : fallback.steering,
      abs: typeof source.abs === 'boolean' ? source.abs : fallback.abs,
      tcs: typeof source.tcs === 'boolean' ? source.tcs : fallback.tcs,
      stability: typeof source.stability === 'boolean' ? source.stability : fallback.stability,
    };
  }

  function migrateV6Profile(value, legacy) {
    const parsed = parseProfile(value);
    const profileName = parsed?.physicsProfile === 'restomod' ? 'restomod' : 'original';
    const defaults = profileName === 'restomod' ? RESTOMOD_DEFAULTS : ORIGINAL_DEFAULTS;
    const isExistingV6 = parsed?.physicsProfile === 'original'
      || parsed?.physicsProfile === 'restomod';
    const assists = isExistingV6
      ? normalizeAssists(parsed.assists, defaults.assists)
      : { ...ORIGINAL_DEFAULTS.assists };
    const chassis = parsed?.chassis && root.AsfaltoV6Chassis?.sanitizeChassisConfig
      ? root.AsfaltoV6Chassis.sanitizeChassisConfig(parsed.chassis) : null;
    if (chassis) { assists.steering = chassis.steeringAssist; assists.abs = chassis.abs; }
    return deepFreeze({
      ...defaults,
      version: 1,
      physicsProfile: profileName,
      classification: defaults.classification,
      gearCount: defaults.gearCount,
      rivalCount: 1,
      assists,
      ...(chassis ? { chassis } : {}),
      steeringRatio: chassis?.steerRatio ?? 24,
      lockToLockTurns: 5.5,
      maxHandwheelDegrees: MAX_HANDWHEEL_DEGREES,
      maximumRoadWheelAngleRad: MAX_ROAD_WHEEL_RAD,
      pedalRates: {
        ...defaults.pedalRates,
      },
      migratedFromLegacy: !isExistingV6 && Boolean(legacy),
    });
  }

  function safeStorageGet(storage, key) {
    try {
      return storage?.getItem?.(key) ?? null;
    } catch {
      return null;
    }
  }

  function safeStorageSet(storage, key, value) {
    try {
      storage?.setItem?.(key, value);
      return Boolean(storage?.setItem);
    } catch {
      return false;
    }
  }

  class InputAdapterV6 {
    constructor(options) {
      this.storage = options?.storage === undefined
        ? (() => {
          try {
            return globalThis.__asfaltoV7Storage || null;
          } catch {
            return null;
          }
        })()
        : options.storage;
      const suppliedProfile = options?.profile === undefined
        ? safeStorageGet(this.storage, PROFILE_STORAGE_KEY)
        : options.profile;
      this.profile = migrateV6Profile(suppliedProfile, options?.legacyConfig);
      this.actions = Object.fromEntries(ACTION_NAMES.map((name) => [name, false]));
      this.analogFrame = normalizeAnalogFrame(null);
      this.handwheelAngleRad = 0;
      this.handwheelAngularVelocityRadps = 0;
      this.targetHandwheelAngleRad = 0;
      this.pointerSteeringActive = false;
      this.throttle = 0;
      this.brake = 0;
      this.clutchPedal = 0;
      this.handbrake = 0;
      this.engagedGear = 1;
      this.requestedGear = 1;
      this.gearRequestPending = false;
      this.gearRequestRejected = false;
      this.gearRejectionReason = null;
      this.lastOutput = null;
      this._saveProfile();
    }

    _saveProfile() {
      safeStorageSet(this.storage, PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    }

    getProfile() {
      return {
        ...this.profile,
        assists: { ...this.profile.assists },
        ...(this.profile.chassis ? { chassis: { ...this.profile.chassis } } : {}),
        pedalRates: { ...this.profile.pedalRates },
      };
    }

    setProfile(value) {
      const normalizedValue = typeof value === 'string'
        ? { physicsProfile: value }
        : value;
      this.profile = migrateV6Profile({ ...normalizedValue,
        chassis: normalizedValue?.chassis === undefined ? this.profile.chassis : normalizedValue.chassis }, null);
      if (this.engagedGear > this.profile.gearCount) this.engagedGear = 1;
      if (this.requestedGear > this.profile.gearCount) this.requestedGear = this.engagedGear;
      this.gearRequestPending = false;
      this.gearRequestRejected = false;
      this.gearRejectionReason = null;
      this._saveProfile();
      return this.getProfile();
    }

    setChassisConfig(value) {
      return this.setProfile({ ...this.getProfile(), chassis: value || null,
        ...(value ? {} : { assists: { ...this.profile.assists, steering: false, abs: false } }) });
    }

    setAction(name, pressed) {
      if (!(name in this.actions)) return false;
      this.actions[name] = Boolean(pressed);
      return true;
    }

    clearActions() {
      for (const name of ACTION_NAMES) this.actions[name] = false;
      return true;
    }

    setAnalogFrame(frame) {
      this.analogFrame = normalizeAnalogFrame(frame);
      return { ...this.analogFrame };
    }

    setPointerSteering(angleRad, active) {
      this.pointerSteeringActive = active !== false;
      this.targetHandwheelAngleRad = clamp(
        finite(angleRad, this.targetHandwheelAngleRad),
        -MAX_HANDWHEEL_RAD,
        MAX_HANDWHEEL_RAD,
      );
      return this.targetHandwheelAngleRad;
    }

    releasePointerSteering() {
      this.pointerSteeringActive = false;
      this.targetHandwheelAngleRad = 0;
      if (this.analogFrame.steeringMode === 'pointer') {
        this.analogFrame = normalizeAnalogFrame({
          ...this.analogFrame,
          steer: 0,
          steeringMode: 'none',
        });
      }
      return true;
    }

    reset() {
      this.clearActions();
      this.analogFrame = normalizeAnalogFrame(null);
      this.pointerSteeringActive = false;
      this.handwheelAngleRad = 0;
      this.handwheelAngularVelocityRadps = 0;
      this.targetHandwheelAngleRad = 0;
      this.throttle = 0;
      this.brake = 0;
      this.clutchPedal = 0;
      this.handbrake = 0;
      this.requestedGear = this.engagedGear;
      this.gearRequestPending = false;
      this.gearRequestRejected = false;
      this.gearRejectionReason = null;
      this.lastOutput = null;
      return this.getState();
    }

    requestGear(gear) {
      const requested = Number(gear);
      const valid = Number.isInteger(requested)
        && requested >= -1
        && requested <= this.profile.gearCount;
      if (!valid) {
        this.gearRequestRejected = true;
        this.gearRejectionReason = 'gear-unavailable-for-profile';
        this.gearRequestPending = false;
        return false;
      }
      this.requestedGear = requested;
      this.gearRequestPending = requested !== this.engagedGear;
      this.gearRequestRejected = false;
      this.gearRejectionReason = null;
      return true;
    }

    reportGearResult(result) {
      if (result?.accepted) {
        const gear = Number(result.gear);
        if (Number.isInteger(gear) && gear >= -1 && gear <= this.profile.gearCount) {
          this.engagedGear = gear;
          this.requestedGear = gear;
          this.gearRequestPending = false;
          this.gearRequestRejected = false;
          this.gearRejectionReason = null;
          return true;
        }
      }
      this.gearRequestPending = false;
      this.gearRequestRejected = true;
      this.gearRejectionReason = result?.reason || 'powertrain-rejected';
      this.requestedGear = this.engagedGear;
      return false;
    }

    _updateSteering(dt, speedMps, vehicleState) {
      const left = this.actions.steerLeft ? 1 : 0;
      const right = this.actions.steerRight ? 1 : 0;
      const keyboardDirection = right - left;
      const analogPositionActive = this.analogFrame.steeringMode === 'pointer'
        || this.analogFrame.steeringMode === 'analog';
      const positionActive = this.pointerSteeringActive || analogPositionActive;
      const speedKmh = Math.abs(speedMps) * 3.6;
      let desiredVelocityRadps;
      let accelerationRadps2;

      if (analogPositionActive && !this.pointerSteeringActive) {
        this.targetHandwheelAngleRad = this.analogFrame.steer * MAX_HANDWHEEL_RAD;
      }

      if (positionActive) {
        const difference = this.targetHandwheelAngleRad - this.handwheelAngleRad;
        const maximumPointerRate = 1440 * DEG_TO_RAD;
        desiredVelocityRadps = clamp(difference * 18, -maximumPointerRate, maximumPointerRate);
        accelerationRadps2 = 14000 * DEG_TO_RAD;
      } else if (keyboardDirection !== 0
        && (this.analogFrame.steeringMode === 'keyboard'
          || this.analogFrame.steeringMode === 'none')) {
        const speedFactor = clamp(speedKmh / 100, 0, 1);
        const maximumKeyboardRate = (950 + (400 - 950) * speedFactor) * DEG_TO_RAD;
        desiredVelocityRadps = keyboardDirection * maximumKeyboardRate;
        accelerationRadps2 = (10000 + (5200 - 10000) * speedFactor) * DEG_TO_RAD;
        this.targetHandwheelAngleRad = keyboardDirection * MAX_HANDWHEEL_RAD;
      } else {
        this.targetHandwheelAngleRad = 0;
        const aligningTorqueNm = Math.abs(finite(vehicleState?.aligningTorqueNm, 0));
        const frontContactRatio = clamp(finite(vehicleState?.frontContactRatio, 1), 0, 1);
        const steeringCondition = clamp(finite(vehicleState?.steeringCondition, 1), 0.25, 1);
        const physicalReturnScale = clamp(
          (1 + aligningTorqueNm * 0.018 * frontContactRatio) * steeringCondition,
          0.55,
          2.2,
        );
        const returnRate = (220 + clamp(speedKmh, 0, 120) * 2.2)
          * physicalReturnScale * DEG_TO_RAD;
        desiredVelocityRadps = clamp(
          -this.handwheelAngleRad
            * (1.8 + clamp(speedKmh / 80, 0, 1) * 1.6)
            * physicalReturnScale,
          -returnRate,
          returnRate,
        );
        accelerationRadps2 = (18000 + clamp(speedKmh, 0, 120) * 28)
          * physicalReturnScale * DEG_TO_RAD;
      }

      if (this.profile.chassis?.steeringAssist && (positionActive || keyboardDirection !== 0)) {
        const assistance = 1 + .35 * (1 - clamp(speedKmh / 100, 0, 1));
        desiredVelocityRadps *= assistance;
        accelerationRadps2 *= assistance;
      }
      this.handwheelAngularVelocityRadps = approach(
        this.handwheelAngularVelocityRadps,
        desiredVelocityRadps,
        accelerationRadps2 * dt,
      );
      let nextAngle = this.handwheelAngleRad + this.handwheelAngularVelocityRadps * dt;
      if (positionActive) {
        const before = this.targetHandwheelAngleRad - this.handwheelAngleRad;
        const after = this.targetHandwheelAngleRad - nextAngle;
        if (before !== 0 && Math.sign(before) !== Math.sign(after)) {
          nextAngle = this.targetHandwheelAngleRad;
          this.handwheelAngularVelocityRadps = 0;
        }
      } else if (keyboardDirection === 0) {
        if (this.handwheelAngleRad !== 0
          && Math.sign(this.handwheelAngleRad) !== Math.sign(nextAngle)) {
          nextAngle = 0;
          this.handwheelAngularVelocityRadps = 0;
        }
      }
      this.handwheelAngleRad = clamp(nextAngle, -MAX_HANDWHEEL_RAD, MAX_HANDWHEEL_RAD);
      if (Math.abs(this.handwheelAngleRad) >= MAX_HANDWHEEL_RAD - 1e-9) {
        const pushingOutward = Math.sign(this.handwheelAngularVelocityRadps)
          === Math.sign(this.handwheelAngleRad);
        if (pushingOutward) this.handwheelAngularVelocityRadps = 0;
      }
    }

    _updatePedals(dt) {
      const rates = this.profile.pedalRates;
      const throttleTarget = Math.max(this.actions.throttle ? 1 : 0, this.analogFrame.throttle);
      const brakeTarget = Math.max(this.actions.brake ? 1 : 0, this.analogFrame.brake);
      const clutchTarget = Math.max(this.actions.clutch ? 1 : 0, this.analogFrame.clutch);
      const handbrakeTarget = Math.max(
        this.actions.handbrake ? 1 : 0,
        this.analogFrame.handbrake,
      );
      this.throttle = approach(
        this.throttle,
        throttleTarget,
        (throttleTarget > this.throttle ? rates.throttleAttack : rates.throttleRelease) * dt,
      );
      this.brake = approach(
        this.brake,
        brakeTarget,
        (brakeTarget > this.brake ? rates.brakeAttack : rates.brakeRelease) * dt,
      );
      this.clutchPedal = approach(
        this.clutchPedal,
        clutchTarget,
        (clutchTarget > this.clutchPedal ? rates.clutchAttack : rates.clutchRelease) * dt,
      );
      this.handbrake = approach(
        this.handbrake,
        handbrakeTarget,
        (handbrakeTarget > this.handbrake
          ? rates.handbrakeAttack
          : rates.handbrakeRelease) * dt,
      );
    }

    update(deltaSeconds, vehicleState) {
      const dt = clamp(finite(deltaSeconds, 0), 0, 0.05);
      const speedMps = finite(vehicleState?.speedMps, 0);
      this._updateSteering(dt, speedMps, vehicleState);
      this._updatePedals(dt);
      const roadSteerRad = clamp(
        this.handwheelAngleRad / this.profile.steeringRatio,
        -this.profile.maximumRoadWheelAngleRad,
        this.profile.maximumRoadWheelAngleRad,
      );
      const output = {
        steer: roadSteerRad,
        roadSteerRad,
        handwheelAngleRad: this.handwheelAngleRad,
        handwheelDegrees: clamp(
          this.handwheelAngleRad * RAD_TO_DEG,
          -MAX_HANDWHEEL_DEGREES,
          MAX_HANDWHEEL_DEGREES,
        ),
        handwheelAngularVelocityRadps: this.handwheelAngularVelocityRadps,
        throttle: this.throttle,
        brake: this.brake,
        clutchEngagement: 1 - this.clutchPedal,
        handbrake: this.handbrake,
        requestedGear: this.gearRequestPending ? this.requestedGear : this.engagedGear,
        engagedGear: this.engagedGear,
        gearRequestPending: this.gearRequestPending,
        gearRequestRejected: this.gearRequestRejected,
      };
      this.lastOutput = output;
      return { ...output };
    }

    getState() {
      return {
        profile: this.getProfile(),
        actions: { ...this.actions },
        analogFrame: { ...this.analogFrame },
        handwheelAngleRad: this.handwheelAngleRad,
        handwheelDegrees: clamp(
          this.handwheelAngleRad * RAD_TO_DEG,
          -MAX_HANDWHEEL_DEGREES,
          MAX_HANDWHEEL_DEGREES,
        ),
        handwheelAngularVelocityRadps: this.handwheelAngularVelocityRadps,
        targetHandwheelAngleRad: this.targetHandwheelAngleRad,
        targetHandwheelDegrees: clamp(
          this.targetHandwheelAngleRad * RAD_TO_DEG,
          -MAX_HANDWHEEL_DEGREES,
          MAX_HANDWHEEL_DEGREES,
        ),
        pointerSteeringActive: this.pointerSteeringActive,
        throttle: this.throttle,
        brake: this.brake,
        clutchPedal: this.clutchPedal,
        handbrake: this.handbrake,
        engagedGear: this.engagedGear,
        requestedGear: this.requestedGear,
        gearRequestPending: this.gearRequestPending,
        gearRequestRejected: this.gearRequestRejected,
        gearRejectionReason: this.gearRejectionReason,
      };
    }
  }

  function createInputAdapter(options) {
    return new InputAdapterV6(options || {});
  }

  function bindCockpitWheel(options) {
    const wheel = options?.wheel;
    const adapter = options?.adapter;
    if (!wheel?.addEventListener || !adapter?.setPointerSteering) {
      throw new TypeError('bindCockpitWheel requiere wheel y adapter');
    }
    const documentTarget = options.documentTarget || root.document;
    const windowTarget = options.windowTarget || root;
    const pauseTarget = options.pauseTarget || null;
    const cameraTarget = options.cameraTarget || null;
    const dragPixelsForFullLock = Math.max(40, finite(options.dragPixelsForFullLock, 240));
    const protectedElements = Array.isArray(options.protectedElements)
      ? options.protectedElements.filter(Boolean)
      : [];
    const listeners = [];
    let pointerId = null;
    let dragStartX = 0;
    let dragStartAngleRad = 0;
    let disposed = false;

    function listen(target, type, listener) {
      if (!target?.addEventListener) return;
      target.addEventListener(type, listener);
      listeners.push({ target, type, listener });
    }

    function release() {
      if (pointerId === null) return false;
      const releasedPointer = pointerId;
      pointerId = null;
      try {
        if (wheel.hasPointerCapture?.(releasedPointer)) {
          wheel.releasePointerCapture?.(releasedPointer);
        } else {
          wheel.releasePointerCapture?.(releasedPointer);
        }
      } catch {
        // Capture can already be gone after lostpointercapture.
      }
      adapter.releasePointerSteering();
      return true;
    }

    function onPointerDown(event) {
      if (disposed || pointerId !== null || finite(event.button, 0) !== 0) return;
      pointerId = event.pointerId;
      dragStartX = finite(event.clientX, 0);
      dragStartAngleRad = finite(
        adapter.getState?.().handwheelAngleRad,
        0,
      );
      adapter.setPointerSteering(dragStartAngleRad, true);
      try {
        wheel.setPointerCapture?.(pointerId);
      } catch {
        pointerId = null;
        adapter.releasePointerSteering();
        return;
      }
      event.preventDefault?.();
    }

    function onPointerMove(event) {
      if (disposed || event.pointerId !== pointerId) return;
      const deltaPixels = finite(event.clientX, dragStartX) - dragStartX;
      const target = dragStartAngleRad
        + deltaPixels * (MAX_HANDWHEEL_RAD / dragPixelsForFullLock);
      adapter.setPointerSteering(clamp(target, -MAX_HANDWHEEL_RAD, MAX_HANDWHEEL_RAD), true);
      event.preventDefault?.();
    }

    function onPointerEnd(event) {
      if (pointerId === null) return;
      if (event?.pointerId != null && event.pointerId !== pointerId) return;
      release();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') release();
    }

    function stopProtectedPointer(event) {
      event.stopPropagation?.();
    }

    listen(wheel, 'pointerdown', onPointerDown);
    listen(wheel, 'pointermove', onPointerMove);
    listen(wheel, 'pointerup', onPointerEnd);
    listen(wheel, 'pointercancel', onPointerEnd);
    listen(wheel, 'lostpointercapture', onPointerEnd);
    listen(documentTarget, 'keydown', onKeyDown);
    listen(windowTarget, 'blur', release);
    listen(pauseTarget, 'pause', release);
    listen(cameraTarget, 'change', release);
    for (const element of protectedElements) {
      listen(element, 'pointerdown', stopProtectedPointer);
    }

    return Object.freeze({
      activePointerId: () => pointerId,
      release,
      onPause: release,
      onCameraChange: release,
      dispose() {
        if (disposed) return false;
        release();
        disposed = true;
        for (const entry of listeners) {
          entry.target.removeEventListener?.(entry.type, entry.listener);
        }
        listeners.length = 0;
        return true;
      },
    });
  }

  root.AsfaltoV6Input = Object.freeze({
    PROFILE_STORAGE_KEY,
    ORIGINAL_DEFAULTS,
    RESTOMOD_DEFAULTS,
    migrateV6Profile,
    InputAdapterV6,
    createInputAdapter,
    bindCockpitWheel,
  });
}(globalThis));
