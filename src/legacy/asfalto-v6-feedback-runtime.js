
(function exposeAsfaltoV6Feedback(root) {
  'use strict';

  const WHEEL_IDS = Object.freeze([
    'frontLeft',
    'frontRight',
    'rearLeft',
    'rearRight',
  ]);
  const HORIZONTAL_FOV_DEG = 63;
  const MAX_DYNAMIC_FOV_DEG = 6;
  const MAX_COCKPIT_ROLL_RAD = 1.5 * Math.PI / 180;
  const CHASE_DISTANCE_M = 5.8;
  const CHASE_HEIGHT_M = 1.28;

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function lerp(a, b, alpha) {
    return a + (b - a) * alpha;
  }

  function vector(value, length, fallback) {
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      result[index] = finite(value?.[index], fallback?.[index] ?? 0);
    }
    return result;
  }

  function suppliedFinite(value, fallback, path) {
    if (value == null) return fallback;
    if (!Number.isFinite(value)) throw new TypeError(path + ' debe ser finito');
    return value;
  }

  function suppliedVector(value, length, fallback, path) {
    if (value == null) return fallback.slice(0, length);
    const result = new Array(length);
    for (let index = 0; index < length; index += 1) {
      result[index] = suppliedFinite(
        value[index],
        fallback[index] ?? 0,
        path + '[' + index + ']',
      );
    }
    return result;
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    );
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function normalizeWheel(value, id) {
    return {
      id,
      angularSpeedRadps: finite(value?.angularSpeedRadps, 0),
      rotationRad: finite(value?.rotationRad, 0),
      slipRatio: finite(value?.slipRatio, 0),
      slipAngleRad: finite(value?.slipAngleRad, 0),
      normalLoadN: Math.max(0, finite(value?.normalLoadN, 0)),
      contact: Boolean(value?.contact),
      compressionM: Math.max(0, finite(value?.compressionM, 0)),
      compressionVelocityMps: finite(value?.compressionVelocityMps, 0),
      steerAngleRad: finite(value?.steerAngleRad, 0),
      surface: typeof value?.surface === 'string' ? value.surface : 'asphalt',
      waterDepthM: Math.max(0, finite(value?.waterDepthM, 0)),
      temperatureC: finite(value?.temperatureC, 20),
      aligningTorqueNm: suppliedFinite(
        value?.aligningTorqueNm ?? value?.tire?.aligningTorqueNm,
        0,
        id + '.aligningTorqueNm',
      ),
      combinedUtilization: clamp(suppliedFinite(
        value?.combinedUtilization ?? value?.tire?.utilization,
        0,
        id + '.combinedUtilization',
      ), 0, 1),
      damage: cloneValue(value?.damage || {}),
      point: vector(value?.point, 3, [0, 0, 0]),
      normal: vector(value?.normal, 3, [0, 1, 0]),
    };
  }

  function createFeedbackSnapshot(input) {
    if (!input?.chassis) throw new TypeError('FeedbackSnapshot requiere chassis');
    const wheelMap = new Map((input.wheels || []).map(wheel => [wheel?.id, wheel]));
    const wheels = WHEEL_IDS.map((id) => normalizeWheel(wheelMap.get(id), id));
    const snapshot = {
      version: 1,
      fixedHz: finite(input.fixedHz, 120),
      timeSeconds: finite(input.timeSeconds, 0),
      chassis: {
        position: vector(input.chassis.position, 3, [0, 0, 0]),
        rotation: vector(input.chassis.rotation, 4, [0, 0, 0, 1]),
        linearVelocity: vector(input.chassis.linearVelocity, 3, [0, 0, 0]),
        angularVelocity: vector(input.chassis.angularVelocity, 3, [0, 0, 0]),
        acceleration: suppliedVector(
          input.chassis.acceleration,
          3,
          [0, 0, 0],
          'chassis.acceleration',
        ),
      },
      wheels,
      steering: {
        frontAligningTorqueNm: suppliedFinite(
          input.steering?.frontAligningTorqueNm,
          wheels[0].aligningTorqueNm + wheels[1].aligningTorqueNm,
          'steering.frontAligningTorqueNm',
        ),
        frontContactRatio: clamp(suppliedFinite(
          input.steering?.frontContactRatio,
          wheels.filter(wheel => wheel.id.startsWith('front') && wheel.contact).length / 2,
          'steering.frontContactRatio',
        ), 0, 1),
      },
      engine: {
        rpm: Math.max(0, finite(input.engine?.rpm, 0)),
        load: clamp(finite(input.engine?.load, 0), 0, 1),
        temperatureC: finite(input.engine?.temperatureC, 20),
        torqueNm: finite(input.engine?.torqueNm, 0),
      },
      gearbox: {
        gear: Number.isInteger(input.gearbox?.gear) ? input.gearbox.gear : 0,
        requestedGear: Number.isInteger(input.gearbox?.requestedGear)
          ? input.gearbox.requestedGear
          : 0,
      },
      clutch: {
        engagement: clamp(finite(input.clutch?.engagement, 1), 0, 1),
        slipRadps: finite(input.clutch?.slipRadps, 0),
      },
      brakes: {
        pedal: clamp(finite(input.brakes?.pedal, input.controls?.brake || 0), 0, 1),
        frontTemperatureC: finite(input.brakes?.frontTemperatureC, 20),
        rearTemperatureC: finite(input.brakes?.rearTemperatureC, 20),
        locked: WHEEL_IDS.map((_, index) => Boolean(input.brakes?.locked?.[index])),
        frontFade: clamp(finite(input.brakes?.frontFade, 0), 0, 1),
        rearFade: clamp(finite(input.brakes?.rearFade, 0), 0, 1),
      },
      controls: {
        handwheelAngleRad: suppliedFinite(
          input.controls?.handwheelAngleRad,
          0,
          'controls.handwheelAngleRad',
        ),
        throttle: clamp(suppliedFinite(input.controls?.throttle, 0, 'controls.throttle'), 0, 1),
        brake: clamp(suppliedFinite(input.controls?.brake, 0, 'controls.brake'), 0, 1),
        clutchEngagement: clamp(suppliedFinite(
          input.controls?.clutchEngagement,
          1,
          'controls.clutchEngagement',
        ), 0, 1),
        handbrake: clamp(suppliedFinite(
          input.controls?.handbrake,
          0,
          'controls.handbrake',
        ), 0, 1),
      },
      damage: cloneValue(input.damage || {}),
      environment: {
        windMps: vector(input.environment?.windMps, 3, [0, 0, 0]),
        rainIntensity: clamp(finite(input.environment?.rainIntensity, 0), 0, 1),
        trackTemperatureC: finite(input.environment?.trackTemperatureC, 25),
      },
      impacts: (input.impacts || []).map((impact, index) => ({
        id: impact?.id ?? index,
        magnitude: Math.max(0, finite(impact?.magnitude, 0)),
        zone: typeof impact?.zone === 'string' ? impact.zone : 'unknown',
        point: vector(impact?.point, 3, [0, 0, 0]),
      })),
      projection: {
        s: finite(input.projection?.s, 0),
        raceProgress: finite(input.projection?.raceProgress, input.projection?.s || 0),
        lateral: finite(input.projection?.lateral, 0),
        headingError: finite(input.projection?.headingError, 0),
        speedAlongRouteMps: finite(input.projection?.speedAlongRouteMps, 0),
        surface: typeof input.projection?.surface === 'string'
          ? input.projection.surface
          : 'asphalt',
      },
    };
    return deepFreeze(snapshot);
  }

  function setVector3(target, values) {
    if (!target) return;
    if (typeof target.set === 'function') target.set(values[0], values[1], values[2]);
    else {
      target.x = values[0];
      target.y = values[1];
      target.z = values[2];
    }
  }

  function setQuaternion(target, values) {
    if (!target) return;
    if (typeof target.set === 'function') target.set(values[0], values[1], values[2], values[3]);
    else {
      target.x = values[0];
      target.y = values[1];
      target.z = values[2];
      target.w = values[3];
    }
  }

  function interpolateQuaternion(a, b, alpha) {
    let bx = b[0];
    let by = b[1];
    let bz = b[2];
    let bw = b[3];
    if (a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw < 0) {
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }
    const result = [
      lerp(a[0], bx, alpha),
      lerp(a[1], by, alpha),
      lerp(a[2], bz, alpha),
      lerp(a[3], bw, alpha),
    ];
    const magnitude = Math.hypot(...result) || 1;
    return result.map(value => value / magnitude);
  }

  class VehicleRenderAdapter {
    constructor(options) {
      if (!options?.body) throw new TypeError('VehicleRenderAdapter requiere body');
      this.body = options.body;
      this.wheelsById = options.wheelsById || {};
    }

    apply(previous, current, interpolation) {
      const alpha = clamp(finite(interpolation, 1), 0, 1);
      const position = current.chassis.position.map((value, index) => (
        lerp(previous.chassis.position[index], value, alpha)
      ));
      const rotation = interpolateQuaternion(
        previous.chassis.rotation,
        current.chassis.rotation,
        alpha,
      );
      setVector3(this.body.position, position);
      setQuaternion(this.body.quaternion, rotation);
      const wheelResult = {};
      for (const id of WHEEL_IDS) {
        const before = previous.wheels.find(wheel => wheel.id === id);
        const after = current.wheels.find(wheel => wheel.id === id);
        const target = this.wheelsById[id];
        if (!before || !after || !target) continue;
        const rotationRad = lerp(before.rotationRad, after.rotationRad, alpha);
        const steerAngleRad = lerp(before.steerAngleRad, after.steerAngleRad, alpha);
        const compressionM = lerp(before.compressionM, after.compressionM, alpha);
        const restPosition = target.restPosition || [
          finite(target.position?.x, 0),
          finite(target.position?.y, 0),
          finite(target.position?.z, 0),
        ];
        setVector3(target.position, [
          restPosition[0],
          restPosition[1] - compressionM,
          restPosition[2],
        ]);
        if (target.rotation) {
          target.rotation.y = steerAngleRad;
          target.rotation.z = rotationRad;
        }
        wheelResult[id] = {
          rotationRad,
          steerAngleRad,
          compressionM,
        };
      }
      return deepFreeze({
        position,
        rotation,
        wheels: wheelResult,
      });
    }
  }

  function createVehicleRenderAdapter(options) {
    return new VehicleRenderAdapter(options);
  }

  class CockpitFeedbackAdapter {
    constructor(options) {
      if (!options?.targets) throw new TypeError('CockpitFeedbackAdapter requiere targets');
      this.targets = options.targets;
    }

    apply(snapshot) {
      const speedKmh = Math.hypot(...snapshot.chassis.linearVelocity) * 3.6;
      if (this.targets.steeringWheel) {
        this.targets.steeringWheel.angleRad = snapshot.controls.handwheelAngleRad;
      }
      if (this.targets.shifter) this.targets.shifter.gear = snapshot.gearbox.gear;
      if (this.targets.gauges) {
        this.targets.gauges.rpm = snapshot.engine.rpm;
        this.targets.gauges.speedKmh = speedKmh;
        this.targets.gauges.engineTemperatureC = snapshot.engine.temperatureC;
      }
      if (this.targets.pedals) {
        this.targets.pedals.throttle = snapshot.controls.throttle;
        this.targets.pedals.brake = snapshot.controls.brake;
        this.targets.pedals.clutch = 1 - snapshot.controls.clutchEngagement;
      }
      return deepFreeze({
        handwheelAngleRad: snapshot.controls.handwheelAngleRad,
        gear: snapshot.gearbox.gear,
        rpm: snapshot.engine.rpm,
        speedKmh,
        engineTemperatureC: snapshot.engine.temperatureC,
      });
    }
  }

  function createCockpitFeedbackAdapter(options) {
    return new CockpitFeedbackAdapter(options);
  }

  function horizontalToVerticalFov(horizontalDegrees, aspect) {
    const horizontal = horizontalDegrees * Math.PI / 180;
    return 2 * Math.atan(Math.tan(horizontal * 0.5) / Math.max(0.2, aspect))
      * 180 / Math.PI;
  }

  class CameraFeedbackAdapter {
    constructor(options) {
      if (!options?.camera) throw new TypeError('CameraFeedbackAdapter requiere camera');
      this.camera = options.camera;
      this.mode = options.mode || 'cockpit';
      this.rollRad = 0;
      this.pitchRad = 0;
      this.heaveM = 0;
      this.dynamicFovDeg = 0;
    }

    apply(snapshot, deltaSeconds) {
      const dt = clamp(finite(deltaSeconds, 0), 0, 0.1);
      const speedMps = Math.hypot(...snapshot.chassis.linearVelocity);
      const frontCompression = (
        snapshot.wheels[0].compressionM + snapshot.wheels[1].compressionM
      ) * 0.5;
      const rearCompression = (
        snapshot.wheels[2].compressionM + snapshot.wheels[3].compressionM
      ) * 0.5;
      const leftCompression = (
        snapshot.wheels[0].compressionM + snapshot.wheels[2].compressionM
      ) * 0.5;
      const rightCompression = (
        snapshot.wheels[1].compressionM + snapshot.wheels[3].compressionM
      ) * 0.5;
      const targetPitch = clamp(
        -snapshot.chassis.acceleration[0] * 0.0045
          + (frontCompression - rearCompression) * 0.16,
        -0.055,
        0.055,
      );
      const targetRoll = clamp(
        -snapshot.chassis.angularVelocity[2] * 0.035
          + (leftCompression - rightCompression) * 0.25,
        -MAX_COCKPIT_ROLL_RAD,
        MAX_COCKPIT_ROLL_RAD,
      );
      const targetHeave = clamp(
        -snapshot.chassis.acceleration[1] * 0.006
          + (frontCompression + rearCompression - 0.2) * 0.08,
        -0.045,
        0.045,
      );
      const targetDynamicFov = clamp((speedMps - 8) / 6, 0, MAX_DYNAMIC_FOV_DEG);
      const blend = 1 - Math.exp(-8 * dt);
      this.pitchRad = lerp(this.pitchRad, targetPitch, blend);
      this.rollRad = clamp(
        lerp(this.rollRad, targetRoll, blend),
        -MAX_COCKPIT_ROLL_RAD,
        MAX_COCKPIT_ROLL_RAD,
      );
      this.heaveM = lerp(this.heaveM, targetHeave, blend);
      this.dynamicFovDeg = lerp(this.dynamicFovDeg, targetDynamicFov, blend);
      const horizontalFovDeg = HORIZONTAL_FOV_DEG + this.dynamicFovDeg;
      this.camera.fov = horizontalToVerticalFov(
        horizontalFovDeg,
        finite(this.camera.aspect, 16 / 9),
      );
      this.camera.updateProjectionMatrix?.();
      if (this.camera.rotation) {
        this.camera.rotation.x = this.pitchRad;
        this.camera.rotation.z = this.rollRad;
      }
      const basePosition = snapshot.chassis.position;
      if (this.mode === 'chase') {
        setVector3(this.camera.position, [
          basePosition[0] - CHASE_DISTANCE_M,
          basePosition[1] + CHASE_HEIGHT_M + this.heaveM,
          basePosition[2],
        ]);
      } else {
        setVector3(this.camera.position, [
          basePosition[0],
          basePosition[1] + this.heaveM,
          basePosition[2],
        ]);
      }
      return deepFreeze({
        mode: this.mode,
        horizontalFovDeg,
        dynamicFovDeg: this.dynamicFovDeg,
        rollRad: this.rollRad,
        pitchRad: this.pitchRad,
        heaveM: this.heaveM,
        chaseDistanceM: CHASE_DISTANCE_M,
        chaseHeightM: CHASE_HEIGHT_M,
      });
    }
  }

  function createCameraFeedbackAdapter(options) {
    return new CameraFeedbackAdapter(options);
  }

  function wheelSlipIntensity(wheel) {
    if (!wheel.contact || wheel.normalLoadN <= 0) return 0;
    return clamp(Math.max(
      Math.abs(wheel.slipAngleRad) / 0.25,
      Math.abs(wheel.slipRatio) / 0.38,
    ), 0, 1);
  }

  class AudioVfxAdapter {
    constructor(options) {
      this.audio = options?.audio || {};
      this.vfx = options?.vfx || {};
    }

    apply(snapshot) {
      const speedMps = Math.hypot(...snapshot.chassis.linearVelocity);
      const frontTires = Math.max(
        wheelSlipIntensity(snapshot.wheels[0]),
        wheelSlipIntensity(snapshot.wheels[1]),
      );
      const rearTires = Math.max(
        wheelSlipIntensity(snapshot.wheels[2]),
        wheelSlipIntensity(snapshot.wheels[3]),
      );
      const maximumWaterDepthM = Math.max(
        ...snapshot.wheels.map(wheel => wheel.contact ? wheel.waterDepthM : 0),
      );
      const engine = clamp(
        snapshot.engine.rpm / 5200 * 0.62 + snapshot.engine.load * 0.48,
        0,
        1,
      );
      const wind = clamp(
        (speedMps + Math.hypot(...snapshot.environment.windMps)) / 52,
        0,
        1,
      );
      const rain = clamp(
        snapshot.environment.rainIntensity * 0.55
          + maximumWaterDepthM / 0.015 * 0.45,
        0,
        1,
      );
      const impact = clamp(
        Math.max(0, ...snapshot.impacts.map(item => item.magnitude)),
        0,
        1,
      );
      const audioState = {
        engine,
        frontTires,
        rearTires,
        rain,
        wind,
        impact,
      };
      for (const [name, value] of Object.entries(audioState)) {
        if (typeof this.audio[name] === 'function') this.audio[name](value, snapshot);
      }

      const emissions = [];
      for (const wheel of snapshot.wheels) {
        if (!wheel.contact || wheel.normalLoadN <= 0 || speedMps < 2) continue;
        const emit = (type, intensity) => {
          const item = deepFreeze({
            type,
            wheelId: wheel.id,
            intensity: clamp(intensity, 0, 1),
            point: [...wheel.point],
            normal: [...wheel.normal],
          });
          emissions.push(item);
          this.vfx.emit?.(type, item);
        };
        if (['gravel', 'grass', 'dirt', 'shoulder'].includes(wheel.surface)) {
          emit('dust', speedMps / 32);
        }
        if (wheel.waterDepthM >= 0.002) {
          emit('spray', wheel.waterDepthM / 0.015 + speedMps / 70);
        }
        if (Math.abs(wheel.slipRatio) >= 0.35 || Math.abs(wheel.slipAngleRad) >= 0.28) {
          emit('smoke', wheelSlipIntensity(wheel));
        }
      }
      return deepFreeze({
        audio: audioState,
        emissions,
      });
    }
  }

  function createAudioVfxAdapter(options) {
    return new AudioVfxAdapter(options);
  }

  root.AsfaltoV6Feedback = Object.freeze({
    WHEEL_IDS,
    HORIZONTAL_FOV_DEG,
    MAX_DYNAMIC_FOV_DEG,
    MAX_COCKPIT_ROLL_RAD,
    CHASE_DISTANCE_M,
    CHASE_HEIGHT_M,
    createFeedbackSnapshot,
    VehicleRenderAdapter,
    createVehicleRenderAdapter,
    CockpitFeedbackAdapter,
    createCockpitFeedbackAdapter,
    CameraFeedbackAdapter,
    createCameraFeedbackAdapter,
    AudioVfxAdapter,
    createAudioVfxAdapter,
  });
}(globalThis));
