const STEERING_MODES = Object.freeze(new Set(['none', 'keyboard', 'pointer', 'analog']));
const PROTECTED_REGIONS = Object.freeze(new Set(['radio', 'panel']));
const TRACE_LIMIT = 600;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeRawFrame(frame) {
  const protectedInteraction = Boolean(frame?.protectedInteraction)
    || PROTECTED_REGIONS.has(frame?.inputRegion);
  const brake = clamp(finite(frame?.brake), 0, 1);
  const clutch = clamp(finite(frame?.clutch), 0, 1);
  const digitalActions = {
    brake: Boolean(frame?.digitalActions?.brake),
    clutch: Boolean(frame?.digitalActions?.clutch),
    handbrake: Boolean(frame?.digitalActions?.handbrake),
    throttle: Boolean(frame?.digitalActions?.throttle),
  };
  const handbrake = clamp(finite(frame?.handbrake), 0, 1);
  const requestedGear = Number.isInteger(frame?.requestedGear) ? frame.requestedGear : null;
  const throttle = clamp(finite(frame?.throttle), 0, 1);
  if (protectedInteraction) {
    return {
      brake,
      clutch,
      digitalActions,
      handbrake,
      inputRegion: PROTECTED_REGIONS.has(frame?.inputRegion) ? frame.inputRegion : 'protected',
      protectedInteraction: true,
      requestedGear,
      steer: 0,
      steeringMode: 'none',
      throttle,
    };
  }
  const requestedMode = STEERING_MODES.has(frame?.steeringMode)
    ? frame.steeringMode
    : 'none';
  return {
    brake,
    clutch,
    digitalActions,
    handbrake,
    inputRegion: frame?.inputRegion || 'driving',
    protectedInteraction: false,
    requestedGear,
    steer: clamp(finite(frame?.steer), -1, 1),
    steeringMode: requestedMode,
    throttle,
  };
}

function normalizeVehicleFeedback(feedback) {
  return {
    aligningTorqueNm: finite(feedback?.aligningTorqueNm),
    frontContactRatio: clamp(finite(feedback?.frontContactRatio, 1), 0, 1),
    speedMps: finite(feedback?.speedMps),
    steeringCondition: clamp(finite(feedback?.steeringCondition, 1), 0, 1),
  };
}

function assertAdapter(adapter) {
  for (const method of ['setAction', 'setAnalogFrame', 'update']) {
    if (typeof adapter?.[method] !== 'function') {
      throw new TypeError('createDriverControlPipeline requiere adapter.' + method);
    }
  }
}

function normalizeControls(output) {
  const roadSteerRad = finite(output?.roadSteerRad, finite(output?.steer));
  return deepFreeze({
    brake: clamp(finite(output?.brake), 0, 1),
    clutchEngagement: clamp(finite(output?.clutchEngagement, 1), 0, 1),
    engagedGear: Number.isInteger(output?.engagedGear) ? output.engagedGear : 1,
    gearRequestPending: Boolean(output?.gearRequestPending),
    gearRequestRejected: Boolean(output?.gearRequestRejected),
    handbrake: clamp(finite(output?.handbrake), 0, 1),
    handwheelAngleRad: finite(output?.handwheelAngleRad),
    handwheelAngularVelocityRadps: finite(output?.handwheelAngularVelocityRadps),
    requestedGear: Number.isInteger(output?.requestedGear) ? output.requestedGear : 1,
    roadSteerRad,
    steer: roadSteerRad,
    throttle: clamp(finite(output?.throttle), 0, 1),
  });
}

export function createDriverControlPipeline(options = {}) {
  const adapter = options.adapter;
  assertAdapter(adapter);
  let sampleCount = 0;
  let adapterUpdateCount = 0;
  let lastRawFrame = null;
  let lastVehicleFeedback = null;
  let lastControls = null;
  const trace = [];

  const diagnostics = () => deepFreeze({
    adapterUpdateCount,
    lastControls,
    lastRawFrame,
    lastVehicleFeedback,
    sampleCount,
    trace: [...trace],
  });

  return Object.freeze({
    sample(deltaSeconds, rawFrame, vehicleFeedback) {
      const dt = clamp(finite(deltaSeconds), 0, 0.05);
      const raw = normalizeRawFrame(rawFrame);
      const feedback = normalizeVehicleFeedback(vehicleFeedback);
      const keyboard = raw.steeringMode === 'keyboard';

      if (raw.steeringMode !== 'pointer') adapter.releasePointerSteering?.();
      adapter.setAction('steerLeft', keyboard && raw.steer < 0);
      adapter.setAction('steerRight', keyboard && raw.steer > 0);
      for (const name of ['throttle', 'brake', 'clutch', 'handbrake']) {
        adapter.setAction(name, raw.digitalActions[name]);
      }
      adapter.setAnalogFrame({
        brake: raw.brake,
        clutch: raw.clutch,
        handbrake: raw.handbrake,
        steer: keyboard ? 0 : raw.steer,
        steeringMode: raw.steeringMode,
        throttle: raw.throttle,
      });
      if (raw.requestedGear !== null) adapter.requestGear?.(raw.requestedGear);

      const output = adapter.update(dt, feedback);
      adapterUpdateCount += 1;
      sampleCount += 1;
      lastRawFrame = deepFreeze({ ...raw, digitalActions: { ...raw.digitalActions } });
      lastVehicleFeedback = deepFreeze({ ...feedback });
      lastControls = normalizeControls(output);
      trace.push(deepFreeze({
        controls: lastControls,
        deltaSeconds: dt,
        rawFrame: lastRawFrame,
        sample: sampleCount,
        vehicleFeedback: lastVehicleFeedback,
      }));
      if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
      return lastControls;
    },

    reset() {
      if (typeof adapter.reset === 'function') {
        adapter.reset();
      } else {
        adapter.clearActions?.();
        adapter.releasePointerSteering?.();
        adapter.setAnalogFrame({
          brake: 0,
          clutch: 0,
          handbrake: 0,
          steer: 0,
          steeringMode: 'none',
          throttle: 0,
        });
      }
      sampleCount = 0;
      adapterUpdateCount = 0;
      lastRawFrame = null;
      lastVehicleFeedback = null;
      lastControls = null;
      trace.length = 0;
      return true;
    },

    diagnostics,
  });
}
