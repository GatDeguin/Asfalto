import {yieldToMain} from '../runtime/cooperative-work.mjs';
import {inflateGzipBytes} from '../runtime/inflate.mjs';
import {createOwnedRenderer} from '../runtime/owned-renderer.mjs';
import {createContextRecovery} from '../runtime/context-recovery.mjs';
import {disposeAll} from '../runtime/dispose-all.mjs';
import {snapshotSceneResources} from '../runtime/scene-resources.mjs';
import {createEventOwner} from '../runtime/event-owner.mjs';
const runtimeEvents=createEventOwner();
import {readCockpitSourcePart} from '../runtime/cockpit-source-loader.mjs';
import {getFrameScheduler} from '../runtime/frame-scheduler.mjs';
import {resolveRenderBudget} from '../render/render-budget.mjs?v=ef65ac852f9d069d';
import {createFrameFailureBoundary} from '../runtime/frame-failure-boundary.mjs?v=45cae02f43885377';
import {decodeVehicleTransport} from '../runtime/vehicle-transport.mjs?v=5ba37f6b7223e2cb';
import {ss250InteriorReviewEnabled,ss250ConsoleInspection} from '../render/ss250-interior-review.mjs?v=db912e338dc25bdb';
import {createVehicleCockpitWheel} from '../render/vehicle-cockpit-wheel.mjs?v=93135f40172f5ad5';
import { attachAuthoredMirrors } from '../render/authored-vehicle-mirrors.mjs?v=0b191acce02ffc8e';
import {buildVehiclePhysicsSpec,authoredCockpitAnchors,authoredWindshieldMount} from '../game/expansion-vehicle-runtime.mjs?v=284dfdbf6002963b';
globalThis.__asfaltoBuildSelectedVehicleSpec=buildVehiclePhysicsSpec;
import {installRaceAudioActivation} from '../audio/race-audio-activation.mjs?v=f121798153e0087e';
import {createAuxiliaryCaptureSchedule} from '../render/auxiliary-capture-schedule.mjs?v=f03a5f52446e9baf';
import {installEmptyInstanceDrawGuard} from '../render/empty-instance-draw-guard.mjs?v=7709e0d0cc6afa58';
import {createOpaqueTransmissionReuse} from '../render/opaque-transmission-reuse.mjs?v=ffea8a1e8a60133c';
import {prepareSoundscapeBanks} from '../audio/prepare-soundscape-banks.mjs?v=1f384c94ad27b37c';
import {waitForGpuFrame} from '../render/phone-gpu-ready.mjs?v=44a0f13e4afdfe4b';
import {attachPhoneDisplayReference,phoneDisplayReferenceBox,swappableCockpitBindings} from '../render/phone-display-reference.mjs?v=f13bd5abc7e36553';
import {createBootRenderGate} from '../render/boot-render-gate.mjs?v=245b55478acd5ee7';
import {attributeStorage,createSerialTextureQueue} from '../runtime/phone-resource-memory.mjs?v=361c3449ac80a066';
const phoneTextureQueue=createSerialTextureQueue();
import {readPhoneCockpitPart} from '../runtime/phone-start-memory.mjs?v=928a3aa725daa5ed';
import {applyPhoneCockpitProjection} from '../render/phone-cockpit-projection.mjs?v=d32f2235b16f78e7';
import {phoneWheelDragPixels} from '../ui/mobile-wheel-drag.mjs?v=9061e7de37f317d9';
import {createMobileDrivingControls,mergeMobileDrivingInput} from '../ui/mobile-driving-controls.mjs?v=2516c5bf5d442d85';
import {detectDeviceProfile,deviceGraphicsQuality,devicePixelRatioLimit,automaticTextureLimit} from '../performance/mobile-device-profile.mjs?v=f090574cb3e87b2d';
import {createPhoneCockpitTextureSelector} from '../performance/phone-cockpit-texture-pack.mjs?v=d7d90ba74e239463';
const runtimeDeviceProfile=detectDeviceProfile();
document.body.classList.toggle('an-phone-device',runtimeDeviceProfile.phone);
let mobileTextureQuality='auto';
const phoneCockpitTextureSelector=createPhoneCockpitTextureSelector({getProfile:()=>runtimeDeviceProfile,getQuality:()=>mobileTextureQuality});
import {prepareRaceStart} from '../game/race-start-preparation.mjs?v=a3c853ada0df5ea6';
import {createRoadTestCoursePresentation} from '../render/road-test-course.mjs?v=b2092657baf7e1a5';
import {createPresentedFrameCapture} from '../render/presented-frame-capture.mjs?v=91937b992a2962b8';
import {createChampionshipClassificationLedger} from '../game/championship-classification.mjs?v=ae78b625f42d9dd9';
import {startupDemand} from '../runtime/startup-demand.mjs?v=d7f04a8f3c4b6613';
import {loadWorkshopBootstrap,readDeferredPayload} from '../runtime/workshop-bootstrap.mjs?v=2451a6adbe22e7d9';
import {installDrivingViewPreset} from '../game/driving-view-preset.mjs?v=0958da2fd48484da';
import {loadCockpitDisplayLods} from '../render/cockpit-display-lod.mjs?v=15e8f09e2eadaf19';
import {createFramePacer} from '../performance/frame-pacer.mjs?v=29ce1359ddeca000';
import {installFramePacingSettings} from '../render/frame-pacing-settings.mjs?v=938a78863582c3c2';
import {prepareRenderPolicies,prewarmStableScene,prewarmViews,createRenderPreparationCache,renderPreparationKey} from '../performance/render-warmup.mjs?v=5c145330ca1f1ad7';
import {renderPixelRatio} from '../render/render-resolution.mjs?v=8517adbdd01bbfef';
import {withFrameMatrices} from '../render/frame-matrices.mjs?v=77d5ecd9e37f8b66';
import {createGpuFrameTimer} from '../performance/gpu-frame-timer.mjs?v=6a956910f5908350';
import {restoreCockpitFront,installCockpitFrontFinish} from '../render/vehicle-cockpit-front.mjs?v=7f95058a7b9fc2c7';
import {createPmremCache} from '../render/pmrem-cache.mjs?v=c042c9baa6b51abe';
import {getVehicleDefinition} from '../render/vehicle-catalog.mjs?v=1fb2dbf31facc389';
import {createAuthoredControlMounts} from '../render/authored-control-mounts.mjs?v=58acc62683bb4eac';
import {createAdvancedGraphics} from '../render/advanced-graphics.mjs?v=ad69177148c2bd2a';
import {isHighGraphicsQuality,graphicsQualityFamily} from '../render/graphics-quality-policy.mjs?v=778703e2dae501e6';
import {installAdvancedGraphicsSettings,readAdvancedGraphics} from '../render/advanced-graphics-settings.mjs?v=faddc4d7745bf11f';
import {setSurfaceReliefQuality,surfaceReliefDiagnostics} from '../tracks/visuals/surface-relief.mjs?v=dc7a4421c4479e97';
import { connectModularHost } from '../app/modular-bootstrap.mjs?v=d42221a6484c9e05';
import * as chassisConfiguration from '../game/chassis-configuration.mjs?v=cb4421d5b87d806c';
import { createDriverControlPipeline } from '../game/driver-control-pipeline.mjs?v=1276b85e67c42976';
import { createSpawnParkingHold, syncSpawnParkingHint } from '../game/spawn-parking-hold.mjs?v=bc7bf5b2d6806a8a';
import { enableCustomLogarithmicDepth } from '../render/logarithmic-depth.mjs?v=b106b53188041997';
import { createPhysicalRenderBridge } from '../game/physical-render-bridge.mjs?v=a7a3e535c754e44b';
import { createChevyWheelVisualRig } from '../game/chevy-wheel-visual-rig.mjs?v=953e830bf733a7ab';
import { createRaceCameraEntrance } from '../game/race-camera-entrance.mjs?v=9c2541ec2c0fc94e';
import {createCockpitHeadMotion} from '../game/cockpit-head-motion.mjs';
import {installHeadMotionControls} from '../game/cockpit-head-motion-controls.mjs?v=b505d29d36fc2156';
import { createRaceOpening } from '../game/race-opening.mjs?v=8211392789cad055';
import { createRaceOpeningOverlay } from '../menu/race-opening-overlay.mjs?v=6178e38252dbfb9e';
import {createLightingEditor} from '../menu/lighting-editor.mjs?v=e4535be24a4eafe4';
import {createRaceColorGrade} from '../render/race-color-grade.mjs?v=fbad3331a323c852';
import { createCockpitMirrors } from '../render/cockpit-mirrors.mjs?v=65dc630621a26ab7';
import { loadCockpitIgnition } from '../render/cockpit-ignition.mjs?v=d730e0b995acbd9c';
import { loadCockpitLightSwitch } from '../render/cockpit-light-switch.mjs?v=a2ccd04ee211ccf4';
import { createVehicleLightControl } from '../game/vehicle-light-control.mjs?v=c1775e5ac0ca65c0';
import { createRayTracedOcclusion } from '../render/ray-traced-occlusion.mjs?v=6eb33370562f7d1a';
import { installRayTracingSettings } from '../render/ray-tracing-settings.mjs?v=ad9cf23a91b437ab';
import { createCockpitRenderPass } from '../render/cockpit-render-pass.mjs?v=94cfe8a9d3150ce6';
import { createChevyPaintController } from '../render/chevy-paint-controller.mjs?v=491e881b58b262ea';
import { createRaceWeatherEffects } from '../render/race-weather-effects.mjs?v=3800632085437a10';
import { createRaceSoundscape } from '../audio/race-soundscape.mjs?v=b3d0520149736731';
import { createRaceDrivingAudio } from '../audio/race-driving-audio.mjs?v=5dc564db7a89a5ef';
import { createVehiclePresentation } from '../render/vehicle-presentation.mjs?v=6698fa8c93c2dcfc';
import { createClosedRoute } from '../tracks/visuals/route-closure.mjs?v=afe90245eed77656';
import {engineMix} from '../audio/v7-audio-state.mjs?v=eecccc1986f61671';
import { drivingAudioState } from '../audio/race-driving-state.mjs?v=84ddd7aeddea355c';
import { weatherEffectsPolicy } from '../render/weather-effects-policy.mjs?v=8f494b5f9b0bf7b4';
import { createVehicleCameraRig, COCKPIT_CALIBRATION_DEFAULTS } from '../game/vehicle-camera-rig.mjs?v=11b71ce35d0b2e5d';
import { createCameraBoomCollisionQuery } from '../game/camera-boom-collision.mjs?v=32104ba795e573bb';
import { COMPOSITION_STATE_DEFAULTS, createCompositionState, createTargetDescriptor, migrateCompositionState, sanitizeCompositionState, sanitizeTransform as sanitizeCompositionTransform, serializeCompositionState } from '../game/composition-editor-state.mjs?v=8ed48999c4e7ed8b';
import { createCockpitLayoutFile } from '../game/cockpit-layout-file.mjs?v=d4f75d48fa9bb1e0';
import { TRACK_ENVIRONMENT_DEFAULTS, getTrackEnvironmentPolicy, resolveEnvironment } from '../environment/environment-profiles.mjs?v=315916d6c7fab528';
import { clearHdriPresetCache, loadHdriPreset } from '../environment/av3hdri-loader.mjs?v=801e455862a54ff2';
import { resolveRaceLighting, applyRaceLightingSupport, orientHdriRows } from '../environment/race-lighting.mjs';
import { createTrackMaterialController } from '../environment/track-material-controller.mjs?v=f0941494f843e94b';
import {createRaceDayCycle,createRaceDayEnvironment} from '../environment/race-day-cycle.mjs?v=7e778f2f4e357b6f';
import {createHdriTransition} from '../render/hdri-transition.mjs?v=04b4461330c3a53f';
import {readRaceDayCycleOptions,reflectRaceDayCycleOptions} from '../ui/race-day-cycle-controls.mjs?v=5f87a759443055e0';
import {createRaceStartSignal} from '../render/race-start-signal.mjs?v=fc9c40c043869086';
import {createRaceWeatherCycle} from '../environment/race-weather-cycle.mjs?v=98d02c4ab5b936e1';
import { resolveSurfaceCondition } from '../physics/surface-conditions.mjs?v=5e9c1e4343b15d6c';
import { createEnvironmentSelectController, environmentPresetForLegacySettings, legacySettingsForEnvironmentPreset } from '../ui/environment-select-controller.mjs?v=605a38aac4871749';
import { TRACK_RENDER_POLICIES, createTrackPerformanceGovernor, maximumTierForGraphicsQuality } from '../performance/track-performance-governor.mjs?v=80b7bc7f721a38cf';
import { MeshoptDecoder } from '../../assets/vendor/meshopt/meshopt_decoder.module.js';

'use strict';

const ENGINE_SPEC = Object.freeze({
  name: 'Chevrolet 250 Serie 2',
  displacementLiters: 4.097,
  cylinders: 6,
  configuration: 'inline-6',
  firingEventsPerRevolution: 3,
  idleRpm: 820,
  torquePeakRpm: 1800,
  peakTorqueNm: 333,
  powerPeakRpm: 4400,
  redlineRpm: 5200,
  limiterRpm: 5450,
  hardLimitRpm: 5650,
  finalDrive: 3.36,
  wheelRadiusM: 0.315,
  massKg: 1495,
  drivetrainEfficiency: 0.80,
  maxForwardSpeedMps: 58,
  maxReverseSpeedMps: 13.5,
});

const GEAR_POSITIONS = Object.freeze({
  N: Object.freeze({ x: 0, y: 0 }),
  1: Object.freeze({ x: -1, y: 1 }),
  2: Object.freeze({ x: -1, y: -1 }),
  3: Object.freeze({ x: 0, y: 1 }),
  4: Object.freeze({ x: 0, y: -1 }),
  5: Object.freeze({ x: 1, y: 1 }),
  R: Object.freeze({ x: 1, y: -1 }),
});

// Primera a cuarta siguen una caja clásica; quinta es una sobremarcha de conversión.
const GEAR_RATIOS = Object.freeze({ N: 0, 1: 3.11, 2: 2.20, 3: 1.47, 4: 1.00, 5: 0.82, R: -3.11 });
const FORWARD_GEARS = Object.freeze(['1', '2', '3', '4', '5']);
const TORQUE_CURVE = Object.freeze([
  Object.freeze([650, 205]),
  Object.freeze([820, 236]),
  Object.freeze([1200, 302]),
  Object.freeze([1800, 333]),
  Object.freeze([2400, 327]),
  Object.freeze([3200, 310]),
  Object.freeze([4000, 287]),
  Object.freeze([4400, 272]),
  Object.freeze([4800, 238]),
  Object.freeze([5200, 192]),
  Object.freeze([5600, 110]),
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * Math.max(0, dt)));
}
function stepSpring(state, target, dt, stiffness, damping, min, max) {
  const safeDt = clamp(Number.isFinite(dt) ? dt : 0, 0, 1 / 20);
  const acceleration = stiffness * (target - state.value) - damping * state.velocity;
  let velocity = state.velocity + acceleration * safeDt;
  let value = state.value + velocity * safeDt;
  if (value < min) { value = min; if (velocity < 0) velocity = 0; }
  if (value > max) { value = max; if (velocity > 0) velocity = 0; }
  return { value, velocity };
}
function stepSteering(state, input, dt, returnStrength = 1) {
  const next = stepSpring(
    { value: state.steer, velocity: state.velocity },
    clamp(input, -1, 1), dt,
    34 * clamp(returnStrength, 0.5, 1.8),
    10.5 * Math.sqrt(clamp(returnStrength, 0.5, 1.8)), -1, 1,
  );
  if (Math.abs(input) < 1e-5 && Math.abs(next.value) < 1e-5 && Math.abs(next.velocity) < 1e-4) {
    return { steer: 0, velocity: 0 };
  }
  return { steer: next.value, velocity: next.velocity };
}
function stepPedal(state, target, dt) {
  const next = stepSpring(state, clamp(target, 0, 1), dt, 86, 16, 0, 1);
  if (!target && next.value < 0.0005 && Math.abs(next.velocity) < 0.005) return { value: 0, velocity: 0 };
  return next;
}
function steerToWheelRotation(steer, maxAngle) { return -clamp(steer, -1, 1) * maxAngle; }
function valueToNeedleRotation(value, min, max) {
  const fraction = clamp((value - min) / Math.max(max - min, 1e-9), 0, 1);
  let angle = (-135 - fraction * 270) * Math.PI / 180;
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}
function gearFromLever(x, y) {
  if (Math.abs(y) < 0.52) return 'N';
  const lane = x < -0.5 ? -1 : x > 0.5 ? 1 : 0;
  if (lane === -1) return y > 0 ? '1' : '2';
  if (lane === 0) return y > 0 ? '3' : '4';
  return y > 0 ? '5' : 'R';
}
function buildShiftPathFrom(current, targetGear) {
  const target = GEAR_POSITIONS[targetGear];
  if (!target) throw new Error(`Marcha inválida: ${targetGear}`);
  const points = [{ x: current.x, y: current.y }];
  const pushDistinct = (point) => {
    const last = points[points.length - 1];
    if (Math.abs(last.x - point.x) > 1e-6 || Math.abs(last.y - point.y) > 1e-6) points.push(point);
  };
  if (Math.abs(current.y) > 0.04) pushDistinct({ x: current.x, y: 0 });
  if (Math.abs(target.x - points[points.length - 1].x) > 0.04) pushDistinct({ x: target.x, y: 0 });
  pushDistinct({ x: target.x, y: target.y });
  return points;
}
function wheelRpmForSpeed(speedMps) {
  return Math.abs(speedMps) / (Math.PI * 2 * ENGINE_SPEC.wheelRadiusM) * 60;
}
function rpmForSpeed(speedMps, gear) {
  const ratio = Math.abs(GEAR_RATIOS[String(gear)] || 0);
  if (!ratio) return ENGINE_SPEC.idleRpm;
  return wheelRpmForSpeed(speedMps) * ratio * ENGINE_SPEC.finalDrive;
}
function speedForRpm(rpm, gear) {
  const ratio = Math.abs(GEAR_RATIOS[String(gear)] || 0);
  if (!ratio) return 0;
  const wheelRpm = Math.max(0, rpm) / (ratio * ENGINE_SPEC.finalDrive);
  return wheelRpm * (Math.PI * 2 * ENGINE_SPEC.wheelRadiusM) / 60;
}
function torqueAtRpm(rpm) {
  const r = clamp(Number(rpm) || 0, TORQUE_CURVE[0][0], TORQUE_CURVE[TORQUE_CURVE.length - 1][0]);
  for (let i = 1; i < TORQUE_CURVE.length; i++) {
    const [nextRpm, nextTorque] = TORQUE_CURVE[i];
    const [prevRpm, prevTorque] = TORQUE_CURVE[i - 1];
    if (r <= nextRpm) return lerp(prevTorque, nextTorque, (r - prevRpm) / (nextRpm - prevRpm));
  }
  return TORQUE_CURVE[TORQUE_CURVE.length - 1][1];
}
function evaluateShift(targetGear, speedMps, directionSign = Math.sign(speedMps) || 1) {
  const target = String(targetGear).toUpperCase();
  if (!(target in GEAR_RATIOS)) return { allowed: false, reason: 'invalid', predictedRpm: 0 };
  if (target === 'R' && (speedMps > 0.75 || directionSign > 0 && Math.abs(speedMps) > 0.75)) {
    return { allowed: false, reason: 'reverse-lockout', predictedRpm: rpmForSpeed(speedMps, 'R') };
  }
  if (FORWARD_GEARS.includes(target) && speedMps < -0.75) {
    return { allowed: false, reason: 'direction-lockout', predictedRpm: rpmForSpeed(speedMps, target) };
  }
  const predictedRpm = target === 'N' ? ENGINE_SPEC.idleRpm : rpmForSpeed(speedMps, target);
  if (target !== 'N' && predictedRpm > ENGINE_SPEC.hardLimitRpm * 1.015) {
    return { allowed: false, reason: 'overrev', predictedRpm };
  }
  return { allowed: true, reason: 'ok', predictedRpm };
}
function createVehicleState() {
  return {
    speedMps: 0,
    rpm: ENGINE_SPEC.idleRpm,
    clutch: 0,
    clutchSlip: 0,
    driveForce: 0,
    engineLoad: 0,
    longitudinalAccel: 0,
    previousSpeedMps: 0,
    brakingIntensity: 0,
    limiterCut: 1,
    effectiveThrottle: 0,
  };
}
function stepVehicle(state, controls, dt) {
  const safeDt = clamp(Number.isFinite(dt) ? dt : 0, 0, 1 / 20);
  const ratio = GEAR_RATIOS[String(controls.gear)] || 0;
  const direction = Math.sign(ratio);
  const throttleInput = clamp(controls.throttle, 0, 1);
  const brake = clamp(controls.brake, 0, 1);
  const shiftCut = clamp(controls.shiftCut || 0, 0, 1);
  const throttleBlip = clamp(controls.throttleBlip || 0, 0, 1);
  const throttle = clamp(throttleInput * (1 - shiftCut * 0.94) + throttleBlip, 0, 1);
  const brakeStrength = clamp(Number(controls.brakeStrength) || 1, 0.45, 1.7);
  const speedSign = Math.sign(state.speedMps);
  const absSpeed = Math.abs(state.speedMps);
  const coupledRpm = rpmForSpeed(absSpeed, controls.gear);
  const directionCompatible = absSpeed < 0.55 || speedSign === direction;
  const launchWindow = clamp((absSpeed * 3.6 + throttle * 10 + 0.8) / 13.5, 0.045, 1);
  const commandedClutch = ratio === 0 ? 0 : clamp(controls.clutch, 0, 1);
  const clutch = commandedClutch * launchWindow * (directionCompatible ? 1 : 0.045);
  const freeRevTarget = ENGINE_SPEC.idleRpm + Math.pow(throttle, 0.78) * (ENGINE_SPEC.redlineRpm - ENGINE_SPEC.idleRpm) * 0.98;
  const coupledTarget = Math.max(ENGINE_SPEC.idleRpm - 80, coupledRpm);
  const slipFlare = ENGINE_SPEC.idleRpm + throttle * 1320 * (1 - clutch);
  const rpmTarget = ratio === 0 ? freeRevTarget : lerp(freeRevTarget, Math.max(coupledTarget, slipFlare), clutch);
  const rpmResponse = ratio === 0 ? 4.2 : lerp(4.3, 9.0, clutch);
  state.rpm = damp(state.rpm, rpmTarget, rpmResponse, safeDt);
  const limiterBand = ENGINE_SPEC.limiterRpm - ENGINE_SPEC.redlineRpm;
  const limiterCut = state.rpm > ENGINE_SPEC.redlineRpm
    ? clamp(1 - (state.rpm - ENGINE_SPEC.redlineRpm) / Math.max(limiterBand, 1), 0, 1)
    : 1;
  state.rpm = clamp(state.rpm, ENGINE_SPEC.idleRpm - 75, ENGINE_SPEC.hardLimitRpm);

  const baseTorque = torqueAtRpm(state.rpm);
  const lugFactor = clamp((state.rpm - 620) / 520, 0.18, 1);
  const combustionTorque = baseTorque * Math.pow(throttle, 0.92) * limiterCut * lugFactor;
  const rawDriveForce = ratio === 0 ? 0
    : combustionTorque * Math.abs(ratio) * ENGINE_SPEC.finalDrive * ENGINE_SPEC.drivetrainEfficiency
      / ENGINE_SPEC.wheelRadiusM * clutch * direction;
  const tractionLimit = ENGINE_SPEC.massKg * 9.81 * (0.51 + Math.min(absSpeed / 35, 1) * 0.04);
  const driveForce = clamp(rawDriveForce, -tractionLimit, tractionLimit);
  const motionSign = absSpeed > 0.025 ? speedSign : direction;
  const rolling = absSpeed > 0.025 ? motionSign * (218 + 3.1 * absSpeed) : 0;
  const aero = absSpeed > 0.025 ? motionSign * (0.50 * absSpeed * absSpeed) : 0;
  const engineBrakeMagnitude = ratio !== 0 && absSpeed > 0.05
    ? (1 - throttle) * (230 + 125 * Math.abs(ratio) + 0.040 * state.rpm) * clutch
    : 0;
  const engineBrake = motionSign * engineBrakeMagnitude;
  const brakeForce = absSpeed > 0.025 ? brake * 9100 * brakeStrength * speedSign : 0;
  const acceleration = (driveForce - rolling - aero - engineBrake - brakeForce) / ENGINE_SPEC.massKg;
  const previousSpeed = state.speedMps;
  state.speedMps += acceleration * safeDt;
  if (brake > 0.04 && previousSpeed !== 0 && Math.sign(previousSpeed) !== Math.sign(state.speedMps)) state.speedMps = 0;
  if (Math.abs(state.speedMps) < 0.018 && throttle < 0.025) state.speedMps = 0;
  state.speedMps = clamp(state.speedMps, -ENGINE_SPEC.maxReverseSpeedMps, ENGINE_SPEC.maxForwardSpeedMps);
  state.previousSpeedMps = previousSpeed;
  state.longitudinalAccel = acceleration;
  state.clutch = clutch;
  state.clutchSlip = ratio === 0 ? 0 : clamp(Math.abs(state.rpm - coupledRpm) / 1900, 0, 1) * (1 - clutch * 0.35);
  state.driveForce = driveForce;
  state.engineLoad = clamp(Math.pow(throttleInput, 0.9) * clutch - engineBrakeMagnitude / 1450, -1, 1);
  state.brakingIntensity = brake * clamp(absSpeed / 2.5, 0, 1);
  state.limiterCut = limiterCut;
  state.effectiveThrottle = throttle;
  return state;
}
function createAutomaticTransmissionState() {
  return { cooldown: 0, holdTimer: 0, lastTarget: 'N', kickdownTimer: 0, lastThrottle: 0 };
}
function chooseAutomaticGear(autoState, vehicle, options = {}, dt = 0) {
  const safeDt = Math.max(0, dt);
  autoState.cooldown = Math.max(0, (autoState.cooldown || 0) - safeDt);
  autoState.holdTimer = Math.max(0, (autoState.holdTimer || 0) - safeDt);
  autoState.kickdownTimer = Math.max(0, (autoState.kickdownTimer || 0) - safeDt);
  const current = String(vehicle.currentGear || 'N');
  if (vehicle.shifting || autoState.cooldown > 0) return { targetGear: null, reason: 'busy' };
  if (current === 'R') return { targetGear: null, reason: 'reverse' };
  const throttle = clamp(vehicle.throttle || 0, 0, 1);
  const brake = clamp(vehicle.brake || 0, 0, 1);
  const speed = Math.abs(vehicle.speedMps || 0);
  const rpm = vehicle.rpm || ENGINE_SPEC.idleRpm;
  const aggression = clamp(Number(options.aggression) || 0.55, 0, 1);
  const throttleRise = throttle - (autoState.lastThrottle || 0);
  autoState.lastThrottle = throttle;
  if (speed < 0.55 && brake > 0.75 && throttle < 0.03) {
    return current === '1' || current === 'N' ? { targetGear: null, reason: 'hold' } : { targetGear: '1', reason: 'standstill' };
  }
  if (current === 'N') {
    if (throttle > 0.025 || speed > 0.25) return { targetGear: '1', reason: 'launch' };
    return { targetGear: null, reason: 'idle' };
  }
  const index = FORWARD_GEARS.indexOf(current);
  if (index < 0) return { targetGear: null, reason: 'not-forward' };
  const upshiftRpm = 2450 + aggression * 520 + throttle * (1220 + aggression * 480);
  const downshiftRpm = 1120 + throttle * 380 + (1 - aggression) * 170;
  const predictedLower = index > 0 ? rpmForSpeed(speed, FORWARD_GEARS[index - 1]) : Infinity;
  if (autoState.holdTimer > 0) {
    if (index < FORWARD_GEARS.length - 1 && rpm > ENGINE_SPEC.redlineRpm * 1.01) {
      return { targetGear: FORWARD_GEARS[index + 1], reason: 'overrev-protection' };
    }
    if (index > 0 && rpm < ENGINE_SPEC.idleRpm * 0.88) {
      return { targetGear: FORWARD_GEARS[index - 1], reason: 'anti-stall' };
    }
    return { targetGear: null, reason: 'shift-hold' };
  }
  const hardKickdown = throttle > 0.91 && index > 0 && rpm < 3450
    && autoState.kickdownTimer <= 0 && (throttleRise > 0.16 || rpm < 2450);
  if (hardKickdown) {
    let targetIndex = index - 1;
    if (index > 1) {
      const twoDownRpm = rpmForSpeed(speed, FORWARD_GEARS[index - 2]);
      if (twoDownRpm < ENGINE_SPEC.redlineRpm * 0.92 && rpm < 2800) targetIndex = index - 2;
    }
    autoState.kickdownTimer = 0.85;
    return { targetGear: FORWARD_GEARS[targetIndex], reason: 'kickdown' };
  }
  if (index < FORWARD_GEARS.length - 1 && rpm >= upshiftRpm && speed > 4.0) {
    return { targetGear: FORWARD_GEARS[index + 1], reason: 'upshift' };
  }
  const loadDownshiftRpm = 1740 + throttle * 500 + aggression * 180;
  const demandDownshift = throttle > 0.74 && rpm < loadDownshiftRpm
    && predictedLower < ENGINE_SPEC.redlineRpm * 0.93;
  if (index > 0 && (rpm <= downshiftRpm || demandDownshift)) {
    return { targetGear: FORWARD_GEARS[index - 1], reason: rpm <= downshiftRpm ? 'low-rpm' : 'load' };
  }
  return { targetGear: null, reason: 'hold' };
}
function defaultSettings() {
  return {
    driveMode: 'manual',
    audio: {
      enabled: true,
      master: 0.78,
      engine: 1.0,
      exhaust: 0.92,
      intake: 0.62,
      mechanical: 0.38,
      road: 0.44,
      brakes: 0.56,
      cabin: 0.55,
    },
    driving: {
      autoAggression: 0.56,
      brakeStrength: 1.0,
      steeringReturn: 1.0,
      shiftSpeed: 1.0,
    },
    graphics: { quality: 'high' },
  };
}
function mergeSettings(candidate = {}) {
  const defaults = defaultSettings();
  return {
    driveMode: candidate.driveMode === 'automatic' ? 'automatic' : 'manual',
    audio: Object.fromEntries(Object.entries(defaults.audio).map(([key, value]) => [key,
      key === 'enabled' ? candidate.audio?.[key] !== false : clamp(Number(candidate.audio?.[key] ?? value), 0, 1.25),
    ])),
    driving: {
      autoAggression: clamp(Number(candidate.driving?.autoAggression ?? defaults.driving.autoAggression), 0, 1),
      brakeStrength: clamp(Number(candidate.driving?.brakeStrength ?? defaults.driving.brakeStrength), 0.55, 1.55),
      steeringReturn: clamp(Number(candidate.driving?.steeringReturn ?? defaults.driving.steeringReturn), 0.55, 1.6),
      shiftSpeed: clamp(Number(candidate.driving?.shiftSpeed ?? defaults.driving.shiftSpeed), 0.65, 1.45),
    },
    graphics: { quality: ['eco', 'balanced', 'high'].includes(candidate.graphics?.quality) ? candidate.graphics.quality : 'high' },
  };
}

const exported = {
  ENGINE_SPEC, GEAR_POSITIONS, GEAR_RATIOS, FORWARD_GEARS, TORQUE_CURVE,
  clamp, lerp, smoothstep, damp, stepSpring, stepSteering, stepPedal,
  steerToWheelRotation, valueToNeedleRotation, gearFromLever, buildShiftPathFrom,
  wheelRpmForSpeed, rpmForSpeed, speedForRpm, torqueAtRpm, evaluateShift,
  createVehicleState, stepVehicle, createAutomaticTransmissionState, chooseAutomaticGear,
  defaultSettings, mergeSettings,
};
if (typeof module !== 'undefined' && module.exports) module.exports = exported;
if (typeof globalThis !== 'undefined') globalThis.__cockpitCore = exported;


'use strict';

async function completeRadioGlbToObject(THREE, bytes, label) {
  loadingTextEl.textContent = 'Preparando ' + label + '…';
  const { json, bin } = parseGlb(bytes);
  const textureCache = new Map();

  async function loadTexture(info, srgb = false) {
    if (!info || info.index == null) return null;
    const transform = info.extensions?.KHR_texture_transform || null;
    const cacheKey = info.index + ':' + (srgb ? 'srgb' : 'linear') + ':' + JSON.stringify(transform);
    if (!textureCache.has(cacheKey)) {
      textureCache.set(cacheKey, textureFromInfo(THREE, json, bin, info, srgb));
    }
    return textureCache.get(cacheKey);
  }

  const materials = await Promise.all((json.materials || []).map(async (definition, index) => {
    const pbr = definition.pbrMetallicRoughness || {};
    const extensions = definition.extensions || {};
    const clearcoat = extensions.KHR_materials_clearcoat;
    const transmission = extensions.KHR_materials_transmission;
    const ior = extensions.KHR_materials_ior;
    const emissiveStrength = extensions.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    const PhysicalMaterial = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
    const MaterialType = clearcoat || transmission || ior || extensions.KHR_materials_sheen || extensions.KHR_materials_volume ? PhysicalMaterial : THREE.MeshStandardMaterial;
    const base = pbr.baseColorFactor || [1, 1, 1, 1];
    const emissive = definition.emissiveFactor || [0, 0, 0];
    const [map, metalRoughMap, normalMap, emissiveMap, occlusionMap] = await Promise.all([
      loadTexture(pbr.baseColorTexture, true),
      loadTexture(pbr.metallicRoughnessTexture, false),
      loadTexture(definition.normalTexture, false),
      loadTexture(definition.emissiveTexture, true),
      loadTexture(definition.occlusionTexture, false),
    ]);
    const material = new MaterialType({
      name: definition.name || 'RadioMaterial_' + index,
      color: new THREE.Color(base[0], base[1], base[2]),
      opacity: base[3] ?? 1,
      transparent: definition.alphaMode === 'BLEND' || (base[3] ?? 1) < 1 || (transmission?.transmissionFactor ?? 0) > 0,
      alphaTest: definition.alphaMode === 'MASK' ? (definition.alphaCutoff ?? 0.5) : 0,
      depthWrite: definition.alphaMode !== 'BLEND',
      side: definition.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      map,
      metalness: pbr.metallicFactor ?? 1,
      roughness: pbr.roughnessFactor ?? 1,
      metalnessMap: metalRoughMap,
      roughnessMap: metalRoughMap,
      normalMap,
      emissive: new THREE.Color(emissive[0], emissive[1], emissive[2]),
      emissiveMap,
      emissiveIntensity: emissiveStrength,
      aoMap: occlusionMap,
      aoMapIntensity: definition.occlusionTexture?.strength ?? 1,
    });
    // Preserve authored surface ownership and semantic metadata from Blender.
    if (definition.extras && typeof definition.extras === 'object') {
      material.userData = { ...material.userData, ...JSON.parse(JSON.stringify(definition.extras)) };
    }
    if (normalMap && material.normalScale) {
      const scale = definition.normalTexture?.scale ?? 1;
      material.normalScale.set(scale, scale);
    }
    await globalThis.AsfaltoV5GlbCore.applyPhysicalMaterialExtensions(THREE,material,extensions,loadTexture);
    return material;
  }));
  const fallbackMaterial = new THREE.MeshStandardMaterial({
    name: 'RadioMaterial_Default',
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.05,
  });

  const meshTemplates = (json.meshes || []).map((meshDefinition, meshIndex) => {
    const group = new THREE.Group();
    group.name = meshDefinition.name || 'RadioMesh_' + meshIndex;
    for (const [primitiveIndex, primitive] of (meshDefinition.primitives || []).entries()) {
      if ((primitive.mode ?? 4) !== 4 || primitive.attributes?.POSITION == null) continue;
      const geometry = new THREE.BufferGeometry();
      const semanticNames = {
        POSITION: 'position',
        NORMAL: 'normal',
        TEXCOORD_0: 'uv',
        TEXCOORD_1: 'uv2',
        COLOR_0: 'color',
        TANGENT: 'tangent',
      };
      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes)) {
        const attributeName = semanticNames[semantic];
        if (attributeName) geometry.setAttribute(attributeName, makeAttribute(THREE, json, bin, accessorIndex));
      }
      if (primitive.indices != null) geometry.setIndex(makeAttribute(THREE, json, bin, primitive.indices));
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const object = new THREE.Mesh(geometry, materials[primitive.material] || fallbackMaterial);
      object.name = group.name + '_Primitive_' + primitiveIndex;
      object.castShadow = false;
      object.receiveShadow = false;
      group.add(object);
    }
    return group;
  });

  const nodes = (json.nodes || []).map((definition, index) => {
    const object = definition.mesh != null ? meshTemplates[definition.mesh].clone(true) : new THREE.Group();
    object.name = definition.name || 'RadioNode_' + index;
    if (definition.extras && typeof definition.extras === 'object') Object.assign(object.userData, definition.extras);
    if (definition.matrix) {
      object.matrix.fromArray(definition.matrix);
      object.matrixAutoUpdate = false;
    } else {
      if (definition.translation) object.position.fromArray(definition.translation);
      if (definition.rotation) object.quaternion.fromArray(definition.rotation);
      if (definition.scale) object.scale.fromArray(definition.scale);
    }
    return object;
  });

  (json.nodes || []).forEach((definition, index) => {
    for (const childIndex of definition.children || []) nodes[index].add(nodes[childIndex]);
  });
  const sceneDefinition = (json.scenes || [])[json.scene || 0] || { nodes: nodes.map((_, index) => index) };
  const root = new THREE.Group();
  root.name = label;
  for (const nodeIndex of sceneDefinition.nodes || []) root.add(nodes[nodeIndex]);
  root.updateMatrixWorld(true);
  return root;
}


function createCockpitRadioController({
  THREE,
  root,
  mount,
  renderer,
  camera,
  engineSound,
  manifest,
  isEditorActive = () => false,
  requestRender = () => {},
}) {
  const stateApi = globalThis.AsfaltoNacionalRadioState;
  const displayApi = globalThis.AsfaltoNacionalRadioDisplay;
  const functionalCore = globalThis.AsfaltoNacionalRadioCore;
  if (!stateApi) throw new Error('No se encontró el controlador de estado de Radio Chevrolet 1973.');
  if (!displayApi) throw new Error('No se encontró el display compartido de Radio Chevrolet 1973.');
  if (!functionalCore) throw new Error('No se encontró el core funcional de Radio Chevrolet 1973.');

  const CONTROL_NAMES = Object.freeze([
    'CTRL_POWER_VOLUME',
    'CTRL_PREVIOUS',
    'CTRL_REWIND',
    'CTRL_PLAY_PAUSE',
    'CTRL_FORWARD',
    'CTRL_NEXT',
    'CTRL_TUNING_SEEK',
  ]);
  const controlNameSet = new Set(CONTROL_NAMES);
  const controls = new Map();
  const pressUntil = new Map();

  root.name = 'RadioChevy1973Interactiva';
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = false;
      object.receiveShadow = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const cloned = materials.map((material) => {
        if (!material) return material;
        const next = material.clone();
        if ('envMapIntensity' in next) next.envMapIntensity = 0.78;
        return next;
      });
      object.material = Array.isArray(object.material) ? cloned : cloned[0];
    }
    if (controlNameSet.has(object.name)) {
      object.userData.radioBasePosition = object.position.clone();
      object.userData.radioBaseRotationZ = object.rotation.z;
      controls.set(object.name, object);
    }
  });

  function findFirstMesh(object) {
    if (!object) return null;
    if (object.isMesh) return object;
    let match = null;
    object.traverse?.((candidate) => {
      if (!match && candidate.isMesh) match = candidate;
    });
    return match;
  }

  const displaySurface = root.getObjectByName('DISPLAY_SURFACE');
  const powerLight = root.getObjectByName('LIGHT_POWER');
  const displaySurfaceMesh = findFirstMesh(displaySurface);
  const powerLightMesh = findFirstMesh(powerLight);
  const missingParts = CONTROL_NAMES.filter((name) => !controls.has(name));
  if (!displaySurface || !displaySurfaceMesh) missingParts.push('DISPLAY_SURFACE');
  if (!powerLight || !powerLightMesh) missingParts.push('LIGHT_POWER');
  if (missingParts.length) {
    throw new Error('Radio Chevrolet 1973 incompleta: faltan ' + missingParts.join(', ') + '.');
  }

  const live = document.createElement('div');
  live.className = 'asfalto-radio-sr';
  live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);

  const toast = document.createElement('div');
  toast.className = 'asfalto-radio-toast';
  toast.hidden = true;
  document.body.appendChild(toast);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.name = 'radio-chevrolet-mp3';
  fileInput.accept = 'audio/mpeg,.mp3';
  fileInput.multiple = true;
  fileInput.className = 'asfalto-radio-file';
  fileInput.setAttribute('aria-label', 'Agregar MP3 a Radio Chevrolet 1973');
  document.body.appendChild(fileInput);

  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = 1024;
  displayCanvas.height = 224;
  const displayContext = displayCanvas.getContext('2d');
  if (!displayContext) throw new Error('No se pudo crear el display de Radio Chevrolet 1973.');
  const displayTexture = new THREE.CanvasTexture(displayCanvas);
  displayTexture.colorSpace = THREE.SRGBColorSpace;
  displayTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  displayTexture.minFilter = THREE.LinearFilter;
  displayTexture.magFilter = THREE.LinearFilter;

  const displayOverlay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.096, 0.019),
    new THREE.MeshBasicMaterial({
      map: displayTexture,
      toneMapped: false,
      transparent: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  displayOverlay.name = 'RadioChevy1973DisplayDinamico';
  displayOverlay.position.z = 0.00125;
  displayOverlay.renderOrder = 950;
  displaySurface.add(displayOverlay);

  const playlist = (manifest?.tracks || []).map((track, index) => ({
    id: String(track?.id || 'embedded-' + String(index + 1)),
    title: String(track?.title || track?.filename || 'MP3'),
    artist: String(track?.artist || ''),
    filename: String(track?.filename || ''),
    duration: Math.max(0, Number(track?.duration) || 0),
    mime: String(track?.mime || 'audio/mpeg'),
    payloadId: String(track?.payloadId || track?.id || ''),
  }));
  const embeddedUrls = new Map();
  const removers = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const animatedScale = new THREE.Vector3();
  let radioAudio = null;
  let viewState = null;
  let hoveredControl = null;
  let activePointer = null;
  let toastTimer = 0;
  let renderTimer = null;
  let lastDisplayDraw = -Infinity;
  let disposed = false;

  function listen(target, type, handler, options) {
    target?.addEventListener?.(type, handler, options);
    removers.push(() => target?.removeEventListener?.(type, handler, options));
  }

  function announce(message, duration = 2200) {
    live.textContent = String(message || '');
    toast.textContent = String(message || '');
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, duration);
  }

  async function decodeEmbeddedPayload(track) {
    if (embeddedUrls.has(track.id)) return embeddedUrls.get(track.id);
    const node = document.querySelector('.asfalto-v4-1-radio-track[data-track-id="' + track.payloadId + '"]');
    if (!node) throw new Error('Falta el audio embebido ' + track.filename + '.');
    if (node.dataset.encoding === 'external-url') { const url = URL.createObjectURL(new Blob([await globalThis.AsfaltoV6AssetCore.readExternalPayload(node)], { type: track.mime || 'audio/mpeg' })); embeddedUrls.set(track.id, url); node.remove(); return url; } const encoded = node.textContent.replace(/\s/g, '');
    const parts = [];
    const chunkSize = 4 * 1024 * 1024;
    for (let offset = 0; offset < encoded.length;) {
      let end = Math.min(encoded.length, offset + chunkSize);
      if (end < encoded.length) end -= (end - offset) % 4;
      const binary = atob(encoded.slice(offset, end));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      parts.push(bytes);
      offset = end;
    }
    const url = URL.createObjectURL(new Blob(parts, { type: track.mime || 'audio/mpeg' }));
    embeddedUrls.set(track.id, url);
    node.remove();
    return url;
  }

  function updateIndicator(state) {
    const material = Array.isArray(powerLightMesh.material) ? powerLightMesh.material[0] : powerLightMesh.material;
    material?.emissive?.setHex(state.powered ? 0xff4b0c : 0x120200);
    if (material) material.emissiveIntensity = state.powered ? 4 : 0.04;
    material?.color?.setHex(state.powered ? 0xff5d14 : 0x3b1008);
  }

  function scheduleRender() {
    if (disposed || renderTimer !== null) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      if (disposed) return;
      try { requestRender(); } catch {}
    }, 0);
  }

  function syncVisualState(state, render = true) {
    if (disposed) return;
    viewState = state;
    const frame = displayApi.createRadioDisplayFrame({
      state,
      mediaDuration: radio.getMediaDiagnostics().duration,
    });
    displayApi.drawRadioDisplay({
      context: displayContext,
      width: displayCanvas.width,
      height: displayCanvas.height,
      frame,
    });
    displayTexture.needsUpdate = true;
    updateIndicator(state);
    if (render) scheduleRender();
  }

  const radio = functionalCore.createRadioFunctionalCore({
    tracks: playlist,
    stateApi,
    createAudio: () => {
      radioAudio = new Audio();
      radioAudio.preload = 'metadata';
      return radioAudio;
    },
    acquireAudioGraph: async () => {
      const ready = await engineSound.ensureStarted();
      if (!ready || !engineSound.context || !engineSound.masterGain) throw Object.assign(new Error('Audio maestro no disponible'), { code: 'shared-audio-unavailable' });
      return { context: engineSound.context, destination: engineSound.masterGain, shared: true };
    },
    resolveEmbeddedTrack: async (track) => await decodeEmbeddedPayload(track),
    storage: globalThis.__asfaltoV7Storage,
    storageKey: 'asfalto-v4.1-radio-state-v2',
    createObjectURL: (file) => URL.createObjectURL(file),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    now: () => Date.now(),
    announce,
    onStateChange: syncVisualState,
    visibilityTarget: document,
    pageLifecycleTarget: window,
  });
  viewState = radio.getState();
  syncVisualState(viewState, false);

  function currentTrack() {
    return viewState?.tracks?.[viewState.currentIndex] || null;
  }

  function findControl(object) {
    let current = object;
    while (current && current !== mount) {
      if (controlNameSet.has(current.name)) return current;
      current = current.parent;
    }
    return null;
  }

  function visibleInScene(object) {
    let current = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  function hitControl(clientX, clientY) {
    if (isEditorActive() || !visibleInScene(root)) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    for (const intersection of raycaster.intersectObject(root, true)) {
      const control = findControl(intersection.object);
      if (control) return control;
    }
    return null;
  }

  function activateControl(name) {
    pressUntil.set(name, performance.now() + 145);
    radio.setFocused(true);
    const pending = Promise.resolve(radio.activate(name));
    const state = radio.getState();
    if (name === 'CTRL_POWER_VOLUME') {
      announce(state.powered ? 'Radio encendida · ' + (state.tracks[state.currentIndex]?.title || '') : 'Radio apagada');
    } else if (name === 'CTRL_PREVIOUS' || name === 'CTRL_NEXT') {
      announce(state.tracks[state.currentIndex]?.title || 'Sin canción');
    }
    return pending.catch((error) => {
      announce(error?.message || 'No se pudo operar la radio');
      return radio.getState();
    });
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function releaseActivePointer() {
    if (!activePointer) return;
    const pointerId = activePointer.id;
    activePointer = null;
    try { renderer.domElement.releasePointerCapture?.(pointerId); } catch {}
  }

  function releaseFocus() {
    radio.setFocused(false);
    hoveredControl = null;
    releaseActivePointer();
  }

  function onPointerDown(event) {
    if (isEditorActive()) {
      releaseFocus();
      return;
    }
    const control = hitControl(event.clientX, event.clientY);
    if (!control) {
      releaseFocus();
      return;
    }
    consume(event);
    radio.setFocused(true);
    renderer.domElement.focus?.({ preventScroll: true });
    activePointer = {
      id: event.pointerId,
      control,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      moved: false,
    };
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (isEditorActive()) {
      releaseFocus();
      return;
    }
    if (!activePointer) {
      hoveredControl = hitControl(event.clientX, event.clientY);
      return;
    }
    if (event.pointerId !== activePointer.id) return;
    consume(event);
    const dx = event.clientX - activePointer.lastX;
    activePointer.lastX = event.clientX;
    if (Math.hypot(event.clientX - activePointer.startX, event.clientY - activePointer.startY) > 4) activePointer.moved = true;
    if (!activePointer.moved) return;
    if (activePointer.control.name === 'CTRL_POWER_VOLUME') {
      radio.dispatch({ type: 'SET_VOLUME', volume: radio.getState().volume + dx * 0.008 });
    } else if (activePointer.control.name === 'CTRL_TUNING_SEEK') {
      radio.dispatch({ type: 'SEEK_BY', seconds: dx * 0.25 });
    }
  }

  function finishPointer(event) {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    if (isEditorActive()) {
      releaseFocus();
      return;
    }
    consume(event);
    const control = activePointer.control;
    const moved = activePointer.moved;
    releaseActivePointer();
    if (!moved) void activateControl(control.name);
  }

  function cancelPointer(event) {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    const pointerId = activePointer.id;
    activePointer = null;
    if (event.type === 'pointercancel') {
      consume(event);
      try { renderer.domElement.releasePointerCapture?.(pointerId); } catch {}
    }
  }

  function onWheel(event) {
    if (isEditorActive()) {
      releaseFocus();
      return;
    }
    const control = hitControl(event.clientX, event.clientY);
    if (control?.name === 'CTRL_POWER_VOLUME') {
      consume(event);
      radio.setFocused(true);
      radio.dispatch({ type: 'SET_VOLUME', volume: radio.getState().volume - Math.sign(event.deltaY) * 0.04 });
    } else if (control?.name === 'CTRL_TUNING_SEEK') {
      consume(event);
      radio.setFocused(true);
      radio.dispatch({ type: 'SEEK_BY', seconds: -Math.sign(event.deltaY) * 5 });
    }
  }

  function keyboardActionForEvent(event) {
    const key = String(event?.key || '').toLowerCase();
    if (key === 'p') return { type: 'activate', control: 'CTRL_POWER_VOLUME' };
    if (event?.code === 'Space') return { type: 'activate', control: 'CTRL_PLAY_PAUSE' };
    if (event?.key === 'ArrowLeft') return { type: 'activate', control: 'CTRL_PREVIOUS' };
    if (event?.key === 'ArrowRight') return { type: 'activate', control: 'CTRL_NEXT' };
    if (event?.key === 'ArrowUp') return { type: 'volume', delta: 0.05 };
    if (event?.key === 'ArrowDown') return { type: 'volume', delta: -0.05 };
    if (key === 'o') return { type: 'files' };
    if (key === '?') return { type: 'help' };
    return null;
  }

  function isEditableKeyboardTarget(target) {
    const tagName = String(target?.tagName || '').toUpperCase();
    return target === fileInput || Boolean(target?.isContentEditable)
      || tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA' || tagName === 'BUTTON';
  }

  function ownsKeyboardEvent(event) {
    return !disposed && radio.isFocused() && !isEditorActive()
      && !isEditableKeyboardTarget(event?.target) && keyboardActionForEvent(event) !== null;
  }

  function onKeyDown(event) {
    if (isEditorActive()) {
      releaseFocus();
      return;
    }
    if (!ownsKeyboardEvent(event)) return;
    const action = keyboardActionForEvent(event);
    if (action.type === 'activate') void activateControl(action.control);
    else if (action.type === 'volume') radio.dispatch({ type: 'SET_VOLUME', volume: radio.getState().volume + action.delta });
    else if (action.type === 'files') fileInput.click();
    else if (action.type === 'help') announce('P encender · Espacio pausa · Flechas pista/volumen · O agregar MP3', 5200);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  async function addFiles(fileList) {
    const selection = await radio.addFiles(Array.from(fileList || []));
    if (selection.additions.length) {
      announce(String(selection.additions.length) + ' MP3 agregado' + (selection.additions.length === 1 ? '' : 's'));
    } else if (selection.duplicates.length) {
      announce('MP3 ya agregado');
    }
    return selection.additions.length;
  }

  function onFileChange() {
    void addFiles(fileInput.files).catch((error) => announce(error?.message || 'No se pudo agregar el MP3'));
    fileInput.value = '';
  }

  function onDragOver(event) {
    if (!Array.from(event.dataTransfer?.items || []).some((item) => item.kind === 'file')) return;
    event.preventDefault();
    document.body.classList.add('asfalto-radio-dropping');
  }

  function onDragLeave() {
    document.body.classList.remove('asfalto-radio-dropping');
  }

  function onDrop(event) {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    document.body.classList.remove('asfalto-radio-dropping');
    void addFiles(event.dataTransfer.files).catch((error) => announce(error?.message || 'No se pudo agregar el MP3'));
  }

  function onDocumentPointerDown(event) {
    if (isEditorActive() || event.target !== renderer.domElement) releaseFocus();
  }

  if (!renderer.domElement.hasAttribute?.('tabindex')) renderer.domElement.tabIndex = 0;
  listen(fileInput, 'change', onFileChange);
  listen(renderer.domElement, 'pointerdown', onPointerDown, true);
  listen(renderer.domElement, 'pointermove', onPointerMove, true);
  listen(renderer.domElement, 'pointerup', finishPointer, true);
  listen(renderer.domElement, 'pointercancel', cancelPointer, true);
  listen(renderer.domElement, 'lostpointercapture', cancelPointer, true);
  listen(renderer.domElement, 'wheel', onWheel, { capture: true, passive: false });
  listen(renderer.domElement, 'blur', releaseFocus);
  listen(document, 'pointerdown', onDocumentPointerDown, true);
  listen(window, 'blur', releaseFocus);
  listen(window, 'keydown', onKeyDown, true);
  listen(window, 'dragover', onDragOver);
  listen(window, 'dragleave', onDragLeave);
  listen(window, 'drop', onDrop);

  function safeState() {
    return { ...radio.getState(), keyboardArmed: radio.isFocused() };
  }

  function projectControl(name) {
    const control = controls.get(name);
    if (!control) return null;
    const projected = control.getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    };
  }

  function getMediaDiagnostics() {
    return {
      ...radio.getMediaDiagnostics(),
      readyState: radioAudio?.readyState ?? 0,
      errorCode: radioAudio?.error?.code ?? null,
    };
  }

  function update(time = performance.now()) {
    if (disposed) return;
    if (isEditorActive()) releaseFocus();
    for (const [name, control] of controls) {
      const base = control.userData.radioBasePosition;
      const pressed = (pressUntil.get(name) || 0) > time;
      const targetScale = hoveredControl === control && !isEditorActive() ? 1.035 : 1;
      animatedScale.set(targetScale, targetScale, targetScale);
      control.scale.lerp(animatedScale, 0.16);
      control.position.x = base.x;
      control.position.y = base.y;
      control.position.z += ((base.z - (pressed ? 0.0036 : 0)) - control.position.z) * 0.26;
      if (name === 'CTRL_POWER_VOLUME') {
        const target = control.userData.radioBaseRotationZ + (viewState.volume - 0.5) * 2.4;
        control.rotation.z += (target - control.rotation.z) * 0.18;
      } else if (name === 'CTRL_TUNING_SEEK') {
        const duration = currentTrack()?.duration || radio.getMediaDiagnostics().duration || 1;
        const target = control.userData.radioBaseRotationZ + (viewState.currentTime / duration) * Math.PI * 2;
        control.rotation.z += (target - control.rotation.z) * 0.12;
      }
    }
    if (viewState.powered && time - lastDisplayDraw > 100) {
      syncVisualState(radio.getState(), false);
      lastDisplayDraw = time;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (renderTimer !== null) {
      window.clearTimeout(renderTimer);
      renderTimer = null;
    }
    releaseFocus();
    radio.dispose();
    if (toastTimer) clearTimeout(toastTimer);
    for (const remove of removers.splice(0)) {
      try { remove(); } catch {}
    }
    for (const url of embeddedUrls.values()) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    embeddedUrls.clear();
    document.body.classList.remove('asfalto-radio-dropping');
    displaySurface.remove(displayOverlay);
    displayOverlay.geometry.dispose();
    displayOverlay.material.dispose();
    displayTexture.dispose();
    fileInput.remove();
    live.remove();
    toast.remove();
  }

  const api = Object.freeze({
    ready: true,
    getState: safeState,
    dispatch: (action) => radio.dispatch(action),
    activateControl,
    addFiles,
    openFiles: () => fileInput.click(),
    setKeyboardArmed: (value) => radio.setFocused(value),
    releaseFocus,
    ownsKeyboardEvent,
    getControlNames: () => Array.from(controls.keys()).sort(),
    projectControl,
    getMediaDiagnostics,
    getSoundDiagnostics: () => adaptCockpitSoundDiagnostics(radio.getSoundDiagnostics(), engineSound),
    getPersistenceDiagnostics: radio.getPersistenceDiagnostics,
    update,
    dispose,
    mount,
  });

  globalThis.__asfaltoNacionalV41 = Object.freeze({
    version: '4.1.1',
    base: 'Asfalto_Nacional_v3',
    editorTargets: Object.freeze(['radio']),
    radio: api,
  });
  listen(window, 'pagehide', event=>{if(!event.persisted)dispose();});
  listen(window, 'asfalto:runtime-dispose', dispose);
  announce('Radio Chevrolet 1973 lista · tocá un control para operarla', 4200);
  return api;
}

const adaptCockpitSoundDiagnostics = (coreDiagnostics, engineSound) => {
  const readNormalizedGain = (read) => {
    let value;
    try { value = read(); } catch { return null; }
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.min(1, Math.max(0, value));
  };
  let audioSettings = null;
  try {
    audioSettings = typeof engineSound.getSettings === 'function' ? engineSound.getSettings()?.audio : null;
  } catch {}
  let masterGain;
  if (audioSettings) {
    try {
      masterGain = audioSettings.enabled ? readNormalizedGain(() => audioSettings.master) : 0;
    } catch {}
  }
  if (!Number.isFinite(masterGain)) {
    masterGain = readNormalizedGain(() => engineSound.masterGain?.gain?.value) ?? 0;
  }
  const localGain = typeof coreDiagnostics.localGain === 'number' && Number.isFinite(coreDiagnostics.localGain)
    ? coreDiagnostics.localGain
    : null;
  return {
    ...coreDiagnostics,
    masterGain,
    effectiveGain: Number.isFinite(localGain) ? masterGain * localGain : null,
  };
};


const COCKPIT_BUILD = '10.0.0-racing-pov-100-autocontenido-v4.1-radio';
const REFERENCE_IMAGE = Object.freeze({ width: 1122, height: 1402 });
const REFERENCE_HORIZONTAL_FOV_DEG = 52;
const DESKTOP_REFERENCE_ASPECT = 1122 / 720;

const SETTINGS_STORAGE_KEY = 'cockpit-chevy-settings-v6';
const EDITOR_STORAGE_KEY = 'cockpit-chevy-layout-editor-v1';
const BACKGROUND_STORAGE_KEY = 'cockpit-chevy-background-editor-v1';
const FRONT_CUT_STORAGE_KEY = 'cockpit-chevy-front-cut-editor-v1';
const EDITOR_SCHEMA_VERSION = 3;
const DEFAULT_GAME_SETTINGS = Object.freeze({
  transmissionMode: 'manual',
  autoAggression: 0.56,
  soundEnabled: true,
  audioProfile: 'original',
  idleRoughness: 0.38,
  exhaustCharacter: 0.52,
  intakeCharacter: 0.48,
  transmissionCharacter: 0.42,
  popsLevel: 0.24,
  stereoWidth: 0.68,
  audioQuality: 'auto',
  masterVolume: 0.78,
  engineVolume: 1.00,
  exhaustVolume: 0.92,
  intakeVolume: 0.62,
  mechanicalVolume: 0.38,
  roadVolume: 0.44,
  brakeVolume: 0.56,
  cabinAmount: 0.55,
  steeringSensitivity: 1.00,
  pedalResponse: 1.00,
  brakeStrength: 1.00,
  shiftSpeed: 1.00,
  graphicsQuality: 'auto',
});

const COCKPIT_LAYOUT = Object.freeze({
  camera: Object.freeze({
    position: Object.freeze([0, 0.10, 2.65]),
    lookAt: Object.freeze([0, -0.10, 0.05]),
  }),
  cabin: Object.freeze({
    targetWidth: 2.20,
    position: Object.freeze([0, 0.080, -0.50]),
    rotation: Object.freeze([0, 0, 0]),
  }),
  roof: Object.freeze({
    targetWidth: 2.60,
    // Extend the headliner over the observer so it meets the upper viewport
    // instead of appearing as an isolated panel beyond the windshield.
    position: Object.freeze([0, 1.550, 2.45]),
    rotation: Object.freeze([0, 0, 0]),
    scale: Object.freeze([1, 1, 2]),
  }),
  front: Object.freeze({
    targetWidth: 2.20,
    position: Object.freeze([0, -0.250, -2.18]),
    rotation: Object.freeze([0, 0, 0]),
    modelRotationY: -Math.PI / 2,
    defaultCutPercent: 36.8857962522,
    minCutPercent: 5,
    maxCutPercent: 100,
  }),
  rearview: Object.freeze({
    planeWidth: 0.74,
    aspect: 3.55,
    position: Object.freeze([0, 1.280, 1.18]),
    rotation: Object.freeze([-0.07677, 0, 0]),
    scale: Object.freeze([1, 1, 1]),
  }),
  dashboard: Object.freeze({
    targetWidth: 1.80,
    position: Object.freeze([0, 0.243, -0.10]),
  }),
  wheel: Object.freeze({
    targetWidth: 0.845,
    position: Object.freeze([-0.144, 0.055, 0.78]),
  }),
  pedals: Object.freeze({
    targetWidth: 0.39,
    position: Object.freeze([0.482, -0.222, 0.45]),
    scaleY: 0.70,
    rotationZ: Math.PI,
    acceleratorRotationZ: Math.PI,
  }),
  shifter: Object.freeze({
    targetWidth: 0.235,
    position: Object.freeze([0.650, 0.145, 0.60]),
    rotationX: -Math.PI / 2,
    rotationZ: 0,
  }),
  radio: Object.freeze({
    position: Object.freeze([0.56, 0.325, 0.82]),
    rotation: Object.freeze([0, 0, 0]),
    scale: Object.freeze([0.9, 0.9, 0.9]),
  }),
  gauges: Object.freeze({
    speed: Object.freeze([-0.327, 0.257, 0.335]),
    rpm: Object.freeze([-0.032, 0.257, 0.335]),
    radius: 0.145,
  }),
});

function verticalFovFromHorizontalFov(horizontalFovDeg, aspect) {
  const safeAspect = Math.max(0.1, Number(aspect) || 1);
  const horizontal = horizontalFovDeg * Math.PI / 180;
  return 2 * Math.atan(Math.tan(horizontal / 2) / safeAspect) * 180 / Math.PI;
}

function horizontalFovFromVerticalFov(verticalFovDeg, aspect) {
  const safeAspect = Math.max(0.1, Number(aspect) || 1);
  const vertical = verticalFovDeg * Math.PI / 180;
  return 2 * Math.atan(Math.tan(vertical / 2) * safeAspect) * 180 / Math.PI;
}

const payloadScript = document.getElementById('cockpit-payload');
const startupPayload = globalThis.__asfaltoBootstrapDocument || (payloadScript.dataset.encoding === 'external-url' ? await loadWorkshopBootstrap(payloadScript) : {payload:JSON.parse(payloadScript.textContent),full:true});
delete globalThis.__asfaltoBootstrapDocument;
const payload = startupPayload.payload; payloadScript.textContent = '';
const EMBEDDED_BACKGROUND_DATA_URL = payload.backgroundPngDataUrl || '';
const EMBEDDED_REARVIEW_DATA_URL = payload.rearviewPngDataUrl || '';
delete payload.backgroundPngDataUrl;
delete payload.rearviewPngDataUrl;

const viewport = document.getElementById('viewport');
const sceneBackgroundEl = document.getElementById('scene-background');
const sceneBackgroundImageEl = document.getElementById('scene-background-image');
const loadingEl = document.getElementById('loading');
const loadingTextEl = document.getElementById('loading-text');
const errorEl = document.getElementById('error');
const angleEl = document.getElementById('angle');
const directionEl = document.getElementById('direction');
const meterFillEl = document.getElementById('meter-fill');
const keyAEl = document.getElementById('key-a');
const keyDEl = document.getElementById('key-d');
const keyWEl = document.getElementById('key-w');
const keySEl = document.getElementById('key-s');
const speedValueEl = document.getElementById('speed-value');
const rpmValueEl = document.getElementById('rpm-value');
const gearValueEl = document.getElementById('gear-value');
const modeValueEl = document.getElementById('mode-value');
const gearKeys = [...document.querySelectorAll('[data-gear]')];
const manualGearControlsEl = document.getElementById('manual-gear-controls');
const gearHintEl = document.getElementById('gear-hint');
const settingsToggleEl = document.getElementById('settings-toggle');
const settingsPanelEl = document.getElementById('settings-panel');
const settingsCloseEl = document.getElementById('settings-close');
const settingsResetEl = document.getElementById('settings-reset');
const audioStatusEl = document.getElementById('audio-status');
const transmissionButtons = [...document.querySelectorAll('[data-transmission]')];
const autoAggressionRowEl = document.getElementById('auto-aggression-row');
const editorModeToggleEl = document.getElementById('editor-mode-toggle');
const editorControlsEl = document.getElementById('editor-controls');
const editorElementSelectEl = document.getElementById('editor-element-select');
const editorShowGuidesEl = document.getElementById('editor-show-guides');
const editorLockScaleEl = document.getElementById('editor-lock-scale');
const editorFrontCutCardEl = document.getElementById('editor-front-cut-card');
const editorFrontCutEl = document.getElementById('editor-front-cut');
const editorFrontCutValueEl = document.getElementById('editor-front-cut-value');
const editorFrontCutResetEl = document.getElementById('editor-front-cut-reset');
const editorSaveEl = document.getElementById('editor-save');
const editorResetElementEl = document.getElementById('editor-reset-element');
const editorResetAllEl = document.getElementById('editor-reset-all');
const editorSaveStatusEl = document.getElementById('editor-save-status');
const editorBackgroundEnabledEl = document.getElementById('editor-background-enabled');
const editorBackgroundFitEl = document.getElementById('editor-background-fit');
const editorBackgroundOpacityEl = document.getElementById('editor-background-opacity');
const editorBackgroundOpacityValueEl = document.getElementById('editor-background-opacity-value');
const editorBackgroundZoomEl = document.getElementById('editor-background-zoom');
const editorBackgroundZoomValueEl = document.getElementById('editor-background-zoom-value');
const editorBackgroundPositionXEl = document.getElementById('editor-background-position-x');
const editorBackgroundPositionXValueEl = document.getElementById('editor-background-position-x-value');
const editorBackgroundPositionYEl = document.getElementById('editor-background-position-y');
const editorBackgroundPositionYValueEl = document.getElementById('editor-background-position-y-value');
const editorBackgroundUploadEl = document.getElementById('editor-background-upload');
const editorBackgroundDefaultEl = document.getElementById('editor-background-default');
const editorBackgroundRemoveEl = document.getElementById('editor-background-remove');
const editorBackgroundFileEl = document.getElementById('editor-background-file');
const editorBackgroundStatusEl = document.getElementById('editor-background-status');
const editorAvailabilityEl = document.getElementById('editor-availability');
const editorCameraLensEl = document.getElementById('editor-camera-lens');
const editorCameraFocalLengthEl = document.getElementById('editor-camera-focal-length');
const editorScaleGroupEl = document.getElementById('editor-scale-group');
const editorPositionGroupEl = document.getElementById('editor-position-group');
const editorRotationGroupEl = document.getElementById('editor-rotation-group');
const editorUi = Object.freeze({
  toggle: editorModeToggleEl, controls: editorControlsEl, select: editorElementSelectEl,
  showGuides: editorShowGuidesEl, lockScale: editorLockScaleEl, save: editorSaveEl, resetElement: editorResetElementEl,
  resetAll: editorResetAllEl, status: editorSaveStatusEl, settingsPanel: settingsPanelEl,
  availability: editorAvailabilityEl, cameraLens: editorCameraLensEl, cameraFocalLength: editorCameraFocalLengthEl, scaleGroup: editorScaleGroupEl, positionGroup: editorPositionGroupEl, rotationGroup: editorRotationGroupEl,
});
const frontCutUi = Object.freeze({
  card: editorFrontCutCardEl,
  range: editorFrontCutEl,
  value: editorFrontCutValueEl,
  reset: editorFrontCutResetEl,
});
const backgroundUi = Object.freeze({
  root: sceneBackgroundEl,
  image: sceneBackgroundImageEl,
  enabled: editorBackgroundEnabledEl,
  fit: editorBackgroundFitEl,
  opacity: editorBackgroundOpacityEl,
  opacityValue: editorBackgroundOpacityValueEl,
  zoom: editorBackgroundZoomEl,
  zoomValue: editorBackgroundZoomValueEl,
  positionX: editorBackgroundPositionXEl,
  positionXValue: editorBackgroundPositionXValueEl,
  positionY: editorBackgroundPositionYEl,
  positionYValue: editorBackgroundPositionYValueEl,
  upload: editorBackgroundUploadEl,
  useDefault: editorBackgroundDefaultEl,
  remove: editorBackgroundRemoveEl,
  file: editorBackgroundFileEl,
  status: editorBackgroundStatusEl,
});

const settingsInputs = Object.freeze({
  autoAggression: document.getElementById('auto-aggression'),
  soundEnabled: document.getElementById('sound-enabled'),
  audioProfile: document.getElementById('audio-profile'),
  idleRoughness: document.getElementById('idle-roughness'),
  exhaustCharacter: document.getElementById('exhaust-character'),
  intakeCharacter: document.getElementById('intake-character'),
  transmissionCharacter: document.getElementById('transmission-character'),
  popsLevel: document.getElementById('pops-level'),
  stereoWidth: document.getElementById('stereo-width'),
  audioQuality: document.getElementById('audio-quality'),
  masterVolume: document.getElementById('master-volume'),
  engineVolume: document.getElementById('engine-volume'),
  exhaustVolume: document.getElementById('exhaust-volume'),
  intakeVolume: document.getElementById('intake-volume'),
  mechanicalVolume: document.getElementById('mechanical-volume'),
  roadVolume: document.getElementById('road-volume'),
  brakeVolume: document.getElementById('brake-volume'),
  cabinAmount: document.getElementById('cabin-amount'),
  steeringSensitivity: document.getElementById('steering-sensitivity'),
  pedalResponse: document.getElementById('pedal-response'),
  brakeStrength: document.getElementById('brake-strength'),
  shiftSpeed: document.getElementById('shift-speed'),
  graphicsQuality: document.getElementById('graphics-quality'),
});
const settingsOutputs = Object.freeze({
  autoAggression: document.getElementById('auto-aggression-value'),
  idleRoughness: document.getElementById('idle-roughness-value'),
  exhaustCharacter: document.getElementById('exhaust-character-value'),
  intakeCharacter: document.getElementById('intake-character-value'),
  transmissionCharacter: document.getElementById('transmission-character-value'),
  popsLevel: document.getElementById('pops-level-value'),
  stereoWidth: document.getElementById('stereo-width-value'),
  masterVolume: document.getElementById('master-volume-value'),
  engineVolume: document.getElementById('engine-volume-value'),
  exhaustVolume: document.getElementById('exhaust-volume-value'),
  intakeVolume: document.getElementById('intake-volume-value'),
  mechanicalVolume: document.getElementById('mechanical-volume-value'),
  roadVolume: document.getElementById('road-volume-value'),
  brakeVolume: document.getElementById('brake-volume-value'),
  cabinAmount: document.getElementById('cabin-amount-value'),
  steeringSensitivity: document.getElementById('steering-sensitivity-value'),
  pedalResponse: document.getElementById('pedal-response-value'),
  brakeStrength: document.getElementById('brake-strength-value'),
  shiftSpeed: document.getElementById('shift-speed-value'),
});


function base64ToBytes(base64, chunkChars = 1 << 20) {
  const clean = String(base64 || '').replace(/\s/g, '');
  const safeChunk = Math.max(4, chunkChars - (chunkChars % 4));
  const estimated = Math.floor(clean.length * 3 / 4);
  const bytes = new Uint8Array(estimated);
  let write = 0;
  for (let offset = 0; offset < clean.length; offset += safeChunk) {
    const binaryChunk = atob(clean.slice(offset, offset + safeChunk));
    for (let i = 0; i < binaryChunk.length; i++) bytes[write++] = binaryChunk.charCodeAt(i);
  }
  return write === bytes.length ? bytes : bytes.subarray(0, write);
}

function base64ToText(base64) {
  return new TextDecoder().decode(base64ToBytes(base64));
}

let gzipWorker = null;
let gzipWorkerSequence = 0;
const gzipWorkerPending = new Map();
function stopGzipWorker(reason=new DOMException('La página se cerró','AbortError')) {
 const worker=gzipWorker;gzipWorker=null;for(const pending of gzipWorkerPending.values())pending.reject(reason);gzipWorkerPending.clear();worker?.terminate();
}
globalThis.addEventListener?.('pagehide',event=>{if(!event.persisted)stopGzipWorker();});
globalThis.addEventListener?.('asfalto:runtime-dispose',()=>stopGzipWorker());

function getGzipWorker() {
  if (gzipWorker || typeof Worker === 'undefined' || typeof DecompressionStream === 'undefined') return gzipWorker;
  const workerSource = `self.onmessage=async(e)=>{const{id,base64}=e.data;try{const clean=String(base64||'').replace(/\\s/g,'');const size=Math.floor(clean.length*3/4);const bytes=new Uint8Array(size);let write=0;const chunk=1048576-(1048576%4);for(let offset=0;offset<clean.length;offset+=chunk){const part=atob(clean.slice(offset,offset+chunk));for(let i=0;i<part.length;i++)bytes[write++]=part.charCodeAt(i)}const compressed=write===bytes.length?bytes:bytes.subarray(0,write);const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));const buffer=await new Response(stream).arrayBuffer();self.postMessage({id,buffer},[buffer]);}catch(error){self.postMessage({id,error:String(error&&error.message||error)});}};`;
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  gzipWorker = new Worker(url, { name: 'cockpit-gzip-worker' });
  URL.revokeObjectURL(url);
  gzipWorker.onmessage = ({ data }) => {
    const pending = gzipWorkerPending.get(data.id);
    if (!pending) return;
    gzipWorkerPending.delete(data.id);
    if (data.error) pending.reject(new Error(data.error));
    else pending.resolve(new Uint8Array(data.buffer));
    queueMicrotask(()=>{if(!gzipWorkerPending.size)stopGzipWorker();});
  };
  gzipWorker.onerror = (event) => {
    for (const pending of gzipWorkerPending.values()) pending.reject(event.error || new Error(event.message || 'Worker gzip falló'));
    gzipWorkerPending.clear();
    gzipWorker.terminate();
    gzipWorker = null;
  };
  return gzipWorker;
}

async function gunzipBase64(base64) {
  if (base64 instanceof Uint8Array) return base64;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no soporta DecompressionStream/gzip. Actualizá Chrome, Edge, Firefox o Safari.');
  }
  const worker = getGzipWorker();
  if (worker) {
    try {
      const id = ++gzipWorkerSequence;
      return await new Promise((resolve, reject) => {
        const timer=setTimeout(()=>stopGzipWorker(new DOMException('La descompresión excedió el tiempo de espera','TimeoutError')),45000);
        gzipWorkerPending.set(id, {resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
        try{worker.postMessage({ id, base64 });}catch(error){stopGzipWorker(error);}
      });
    } catch (error) {
      if(error?.name==='AbortError'||error?.name==='TimeoutError')throw error;
      console.warn('Descompresión en worker no disponible; se usa el hilo principal.', error);
    }
  }
  const compressed = base64ToBytes(base64);
  return inflateGzipBytes(compressed,{timeoutMs:45000});
}

async function gunzipBase64ToText(base64) {
  return new TextDecoder().decode(await gunzipBase64(base64));
}

let DOS_LAGOS_ROUTE_DATA;

async function loadThree() {
  loadingTextEl.textContent = 'Iniciando motor 3D…';
  const coreCompressedSource = payload.threeCoreGz;
  delete payload.threeCoreGz;
  const coreSource = await gunzipBase64ToText(coreCompressedSource);
  const coreUrl = URL.createObjectURL(new Blob([coreSource], { type: 'text/javascript' }));
  const moduleCompressedSource = payload.threeModuleGz;
  delete payload.threeModuleGz;
  const moduleSource = (await gunzipBase64ToText(moduleCompressedSource))
    .replaceAll('./three.core.min.js', coreUrl);
  const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));
  try {
    return await import(moduleUrl);
  } finally {
    queueMicrotask(() => {
      URL.revokeObjectURL(moduleUrl);
      URL.revokeObjectURL(coreUrl);
    });
  }
}

const qaTrackLifetimeEnabled = new URLSearchParams(globalThis.location.search).get('qa') === '1';
const qaTrackLifetimeReferences = [];
function rememberQaTrackResource(kind, value, label = '') {
  if (!qaTrackLifetimeEnabled || typeof WeakRef !== 'function'
      || (!value || (typeof value !== 'object' && typeof value !== 'function'))) return value;
  qaTrackLifetimeReferences.push({ kind, label, reference: new WeakRef(value) });
  return value;
}
function qaTrackLifetimeDiagnostics() {
  const alive = [];
  const counts = {};
  const labels = {};
  let arrayBufferBytes = 0;
  for (const record of qaTrackLifetimeReferences) {
    const value = record.reference.deref();
    if (!value) continue;
    alive.push(record);
    counts[record.kind] = (counts[record.kind] || 0) + 1;
    labels[record.label] = (labels[record.label] || 0) + 1;
    if (record.kind === 'glb-buffer' && value instanceof ArrayBuffer) arrayBufferBytes += value.byteLength;
  }
  qaTrackLifetimeReferences.splice(0, qaTrackLifetimeReferences.length, ...alive);
  return Object.freeze({ trackedAlive: alive.length, arrayBufferBytes, counts: Object.freeze(counts), labels: Object.freeze(labels) });
}

function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('GLB inválido: magic incorrecto.');
  if (view.getUint32(4, true) !== 2) throw new Error('GLB inválido: se esperaba glTF 2.0.');

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(chunk).replace(/\u0000+$/g, '').trimEnd());
    } else if (type === 0x004e4942) {
      bin = chunk;
    }
  }
  if (!json || !bin) throw new Error('GLB incompleto: faltan chunks JSON/BIN.');
  return { json, bin };
}

const COMPONENTS = {
  5120: { Ctor: Int8Array, bytes: 1 },
  5121: { Ctor: Uint8Array, bytes: 1 },
  5122: { Ctor: Int16Array, bytes: 2 },
  5123: { Ctor: Uint16Array, bytes: 2 },
  5124: { Ctor: Int32Array, bytes: 4 },
  5125: { Ctor: Uint32Array, bytes: 4 },
  5126: { Ctor: Float32Array, bytes: 4 }
};
const TYPE_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function makeAttribute(THREE, json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const component = COMPONENTS[accessor.componentType];
  if (!component) throw new Error(`Component type no soportado: ${accessor.componentType}`);
  const itemSize = TYPE_SIZE[accessor.type];
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const strideBytes = bufferView.byteStride || itemSize * component.bytes;
  const strideElements = strideBytes / component.bytes;
  const absoluteOffset = bin.byteOffset + byteOffset;

  if (strideElements === itemSize) {
    const array = new component.Ctor(bin.buffer, absoluteOffset, accessor.count * itemSize);
    return new THREE.BufferAttribute(attributeStorage(array,runtimeDeviceProfile.phone), itemSize, !!accessor.normalized);
  }

  const totalElements = Math.floor(bufferView.byteLength / component.bytes);
  const array = new component.Ctor(bin.buffer, bin.byteOffset + (bufferView.byteOffset || 0), totalElements);
  const interleaved = new THREE.InterleavedBuffer(attributeStorage(array,runtimeDeviceProfile.phone), strideElements);
  const attributeOffset = (accessor.byteOffset || 0) / component.bytes;
  return new THREE.InterleavedBufferAttribute(interleaved, itemSize, attributeOffset, !!accessor.normalized);
}

function samplerToThree(THREE, value, fallback) {
  const map = {
    9728: THREE.NearestFilter,
    9729: THREE.LinearFilter,
    9984: THREE.NearestMipmapNearestFilter,
    9985: THREE.LinearMipmapNearestFilter,
    9986: THREE.NearestMipmapLinearFilter,
    9987: THREE.LinearMipmapLinearFilter
  };
  return map[value] ?? fallback;
}

function wrapToThree(THREE, value) {
  if (value === 33071) return THREE.ClampToEdgeWrapping;
  if (value === 33648) return THREE.MirroredRepeatWrapping;
  return THREE.RepeatWrapping;
}

function textureDecodeLimit() {
  // Bound phone source images before GPU upload; PC retains its texture policy.
  if(runtimeDeviceProfile.phone)return 512;
  const quality = typeof gameSettings !== 'undefined' ? gameSettings.graphicsQuality : 'auto';
  if (quality === 'eco') return 1024;
  if (quality === 'balanced') return 1536;
  if (quality === 'high') return 2048;
  const memory = Number(navigator.deviceMemory) || 0;
  return memory > 0 && memory <= 4 ? 1024 : 2048;
}

async function decodeTextureBitmap(blob) {
  const original = await createImageBitmap(blob);
  const limit = textureDecodeLimit();
  if (!limit || Math.max(original.width, original.height) <= limit) return original;
  const scale = limit / Math.max(original.width, original.height);
  const resizeWidth = Math.max(1, Math.round(original.width * scale));
  const resizeHeight = Math.max(1, Math.round(original.height * scale));
  try {
    const resized = await createImageBitmap(original, 0, 0, original.width, original.height, {
      resizeWidth,
      resizeHeight,
      resizeQuality: 'high',
    });
    if(runtimeDeviceProfile.phone&&(resized.width>resizeWidth||resized.height>resizeHeight)){if(resized!==original)resized.close?.();throw new Error('ImageBitmap no respetó el tamaño solicitado');}
    original.close?.();
    return resized;
  } catch {
    if(!runtimeDeviceProfile.phone)return original;
    try{const canvas=document.createElement('canvas');canvas.width=resizeWidth;canvas.height=resizeHeight;const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la textura móvil');context.drawImage(original,0,0,resizeWidth,resizeHeight);original.close?.();return canvas;}
    catch(error){original.close?.();throw error;}
  }
}

async function textureFromInfo(THREE, json, bin, textureInfo, srgb = false) {
  const decode=()=>decodeTextureFromInfo(THREE,json,bin,textureInfo,srgb);
  return runtimeDeviceProfile.phone?phoneTextureQueue(decode):decode();
}
async function decodeTextureFromInfo(THREE, json, bin, textureInfo, srgb = false) {
  if (!textureInfo) return null;
  const textureDef = json.textures[textureInfo.index];
  const sourceIndex = textureDef.extensions?.EXT_texture_webp?.source ?? textureDef.source;
  const imageDef = json.images[sourceIndex];
  const imageView = json.bufferViews[imageDef.bufferView];
  const start = bin.byteOffset + (imageView.byteOffset || 0);
  const imageBytes = new Uint8Array(bin.buffer, start, imageView.byteLength);
  const blob = new Blob([imageBytes], { type: imageDef.mimeType || 'image/webp' });
  const decodeBlob = await phoneCockpitTextureSelector.select(blob);
  if(json.__phoneLabel)globalThis.__asfaltoPhoneLoad?.stage('Textura de '+json.__phoneLabel+': mapa '+textureInfo.index+' · decodificando');
  const bitmap = await decodeTextureBitmap(decodeBlob);
  if(json.__phoneLabel)globalThis.__asfaltoPhoneLoad?.stage('Textura de '+json.__phoneLabel+': mapa '+textureInfo.index+' · lista');
  rememberQaTrackResource('bitmap', bitmap, imageDef.name || imageDef.uri || 'embedded-image');
  const texture = new THREE.Texture(bitmap);
  let bitmapClosed = false;
  texture.addEventListener('dispose', () => {
    if (bitmapClosed) return;
    bitmapClosed = true;
    bitmap.close?.();
    texture.image = null;
  });
  texture.needsUpdate = true;
  texture.flipY = false;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;

  const sampler = json.samplers?.[textureDef.sampler] || {};
  texture.magFilter = samplerToThree(THREE, sampler.magFilter, THREE.LinearFilter);
  texture.minFilter = samplerToThree(THREE, sampler.minFilter, THREE.LinearMipmapLinearFilter);
  texture.wrapS = wrapToThree(THREE, sampler.wrapS);
  texture.wrapT = wrapToThree(THREE, sampler.wrapT);

  const transform = textureInfo.extensions?.KHR_texture_transform;
  if (transform) {
    if (transform.offset) texture.offset.fromArray(transform.offset);
    if (transform.scale) texture.repeat.fromArray(transform.scale);
    if (typeof transform.rotation === 'number') texture.rotation = transform.rotation;
  }
  return texture;
}

async function compactGlbToObject(THREE, bytes, label) {
  loadingTextEl.textContent = `Preparando ${label}…`;
  const { json, bin } = parseGlb(bytes);
  if(runtimeDeviceProfile.phone)json.__phoneLabel=label;
  const primitive = json.meshes?.[0]?.primitives?.[0];
  if (!primitive) throw new Error(`${label}: no se encontró una malla utilizable.`);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', makeAttribute(THREE, json, bin, primitive.attributes.POSITION));
  if (primitive.attributes.NORMAL != null) geometry.setAttribute('normal', makeAttribute(THREE, json, bin, primitive.attributes.NORMAL));
  if (primitive.attributes.TEXCOORD_0 != null) geometry.setAttribute('uv', makeAttribute(THREE, json, bin, primitive.attributes.TEXCOORD_0));
  if (primitive.indices != null) geometry.setIndex(makeAttribute(THREE, json, bin, primitive.indices));
  geometry.computeBoundingSphere();

  const materialDef = json.materials?.[primitive.material] || {};
  const pbr = materialDef.pbrMetallicRoughness || {};
  const [map, metalRoughMap, normalMap, emissiveMap] = await Promise.all([
    textureFromInfo(THREE, json, bin, pbr.baseColorTexture, true),
    textureFromInfo(THREE, json, bin, pbr.metallicRoughnessTexture, false),
    textureFromInfo(THREE, json, bin, materialDef.normalTexture, false),
    textureFromInfo(THREE, json, bin, materialDef.emissiveTexture, true),
  ]);

  const base = pbr.baseColorFactor || [1, 1, 1, 1];
  const emissive = materialDef.emissiveFactor || [0, 0, 0];
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(base[0], base[1], base[2]),
    opacity: base[3],
    transparent: base[3] < 1,
    map,
    metalness: pbr.metallicFactor ?? 1,
    roughness: pbr.roughnessFactor ?? 1,
    metalnessMap: metalRoughMap,
    roughnessMap: metalRoughMap,
    normalMap,
    emissive: new THREE.Color(emissive[0], emissive[1], emissive[2]),
    emissiveMap,
    emissiveIntensity: emissiveMap ? 1.0 : 0,
    side: materialDef.doubleSided ? THREE.DoubleSide : THREE.FrontSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = label;
  attachPhoneDisplayReference(mesh,json,runtimeDeviceProfile.phone);
  const node = json.nodes?.find(n => n.mesh === 0) || {};
  if (node.translation) mesh.position.fromArray(node.translation);
  if (node.scale) mesh.scale.fromArray(node.scale);
  if (node.rotation) mesh.quaternion.fromArray(node.rotation);
  if (node.matrix) mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
  mesh.updateMatrixWorld(true);
  return mesh;
}

function splitPedalMesh(THREE, sourceMesh) {
  const source = sourceMesh.geometry;
  source.computeBoundingBox();
  const position = source.getAttribute('position');
  const sourceIndex = source.getIndex();
  const indexArray = sourceIndex ? sourceIndex.array : null;

  // El corte se expresa en el espacio visual del GLB. Esto evita que una franja
  // del pedal de freno sea asignada al acelerador y aparezca como una media luna
  // independiente al aplicar el giro de 180° solicitado al acelerador.
  const pedalSplitWorldX = -0.20;
  const threshold = clamp(
    (pedalSplitWorldX - sourceMesh.position.x) / Math.max(Math.abs(sourceMesh.scale.x), 1e-9),
    source.boundingBox.min.x,
    source.boundingBox.max.x,
  );
  const low = [];
  const high = [];
  const triangleCount = sourceIndex ? sourceIndex.count / 3 : position.count / 3;
  for (let t = 0; t < triangleCount; t++) {
    const a = sourceIndex ? indexArray[t * 3] : t * 3;
    const b = sourceIndex ? indexArray[t * 3 + 1] : t * 3 + 1;
    const c = sourceIndex ? indexArray[t * 3 + 2] : t * 3 + 2;
    const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    (cx < threshold ? low : high).push(a, b, c);
  }

  function makePart(indices, name) {
    if (!indices.length) throw new Error(`${name}: el corte no produjo geometría.`);
    const geometry = new THREE.BufferGeometry();
    for (const attrName of Object.keys(source.attributes)) geometry.setAttribute(attrName, source.getAttribute(attrName));
    const IndexCtor = position.count > 65535 ? Uint32Array : Uint16Array;
    geometry.setIndex(new THREE.BufferAttribute(new IndexCtor(indices), 1));

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < indices.length; i++) {
      const vertex = indices[i];
      const x = position.getX(vertex);
      const y = position.getY(vertex);
      const z = position.getZ(vertex);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const min = new THREE.Vector3(minX, minY, minZ);
    const max = new THREE.Vector3(maxX, maxY, maxZ);
    geometry.boundingBox = new THREE.Box3(min, max);
    const sphereCenter = min.clone().add(max).multiplyScalar(0.5);
    let radiusSq = 0;
    for (let i = 0; i < indices.length; i++) {
      const vertex = indices[i];
      const dx = position.getX(vertex) - sphereCenter.x;
      const dy = position.getY(vertex) - sphereCenter.y;
      const dz = position.getZ(vertex) - sphereCenter.z;
      radiusSq = Math.max(radiusSq, dx * dx + dy * dy + dz * dz);
    }
    geometry.boundingSphere = new THREE.Sphere(sphereCenter, Math.sqrt(radiusSq));

    const hinge = new THREE.Vector3((minX + maxX) * 0.5, maxY, (minZ + maxZ) * 0.5);
    const center = new THREE.Vector3((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    const pivot = new THREE.Group();
    pivot.name = `${name}Pivot`;
    pivot.position.copy(hinge);
    const orientation = new THREE.Group();
    orientation.name = `${name}Orientation`;
    orientation.position.copy(center).sub(hinge);
    const mesh = new THREE.Mesh(geometry, sourceMesh.material);
    mesh.name = name;
    mesh.position.copy(center).multiplyScalar(-1);
    mesh.userData.control = name === 'PedalAcelerador' ? 'accelerator' : 'brake';
    orientation.add(mesh);
    pivot.add(orientation);
    return { pivot, orientation, mesh };
  }

  const root = new THREE.Group();
  root.name = 'PedalesSeparadosSinArtefactos';
  root.position.copy(sourceMesh.position);
  root.quaternion.copy(sourceMesh.quaternion);
  root.scale.copy(sourceMesh.scale);
  const acceleratorPart = makePart(low, 'PedalAcelerador');
  const brakePart = makePart(high, 'PedalFreno');
  root.add(acceleratorPart.pivot, brakePart.pivot);
  return {
    root,
    acceleratorPivot: acceleratorPart.pivot,
    acceleratorOrientation: acceleratorPart.orientation,
    acceleratorMesh: acceleratorPart.mesh,
    brakePivot: brakePart.pivot,
    brakeOrientation: brakePart.orientation,
    brakeMesh: brakePart.mesh,
  };
}

async function compressedAssetToObject(THREE, key, label, { signal } = {}) {
  if (signal?.aborted) throw signal.reason;
  globalThis.__asfaltoPhoneLoad?.stage("Cargando pieza: "+label);
  const compressedSource = payload[key];
  delete payload[key];
  const bytes = runtimeDeviceProfile.phone ? await readPhoneCockpitPart(key,signal) : await readCockpitSourcePart(key,{signal});
  if (signal?.aborted) throw signal.reason;
  globalThis.__asfaltoPhoneLoad?.stage("Decodificando pieza: "+label);
  const object = await compactGlbToObject(THREE, bytes, label);
  if (signal?.aborted) throw signal.reason;
  return object;
}

async function dataUrlToTexture(THREE, dataUrl, label = 'Textura') {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) throw new Error(`${label}: imagen embebida inválida.`);
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, (texture) => {
      texture.name = label;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      resolve(texture);
    }, undefined, (error) => reject(new Error(`${label}: no se pudo cargar (${error?.message || error}).`)));
  });
}


function createAdjustableFrontCut({
  THREE,
  mesh,
  ui,
  defaultPercent,
  minPercent = 5,
  maxPercent = 100,
  onChange = () => {},
}) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute('vehicleReferencePosition') || geometry?.getAttribute('position');
  const sourceIndex = geometry?.getIndex();
  if (!geometry || !position || !sourceIndex) throw new Error('Frente del auto: la malla no permite un corte ajustable.');

  geometry.computeBoundingBox();
  const fullBox = geometry.boundingBox.clone();
  const longitudinalMin = fullBox.min.x;
  const longitudinalMax = fullBox.max.x;
  const longitudinalSpan = Math.max(longitudinalMax - longitudinalMin, 1e-9);
  const triangleCount = Math.floor(sourceIndex.count / 3);
  const sourceIndices = sourceIndex.array;
  const bucketCount = Math.floor(clamp(Math.ceil(longitudinalSpan) + 1, 1024, 32768));
  const counts = new Uint32Array(bucketCount);
  const triangleBuckets = bucketCount <= 65535 ? new Uint16Array(triangleCount) : new Uint32Array(triangleCount);
  const bucketMinX = new Float64Array(bucketCount); bucketMinX.fill(Infinity);
  const bucketMinY = new Float64Array(bucketCount); bucketMinY.fill(Infinity);
  const bucketMinZ = new Float64Array(bucketCount); bucketMinZ.fill(Infinity);
  const bucketMaxX = new Float64Array(bucketCount); bucketMaxX.fill(-Infinity);
  const bucketMaxY = new Float64Array(bucketCount); bucketMaxY.fill(-Infinity);
  const bucketMaxZ = new Float64Array(bucketCount); bucketMaxZ.fill(-Infinity);

  const bucketForCoordinate = (coordinate) => Math.floor(clamp(
    Math.ceil(((coordinate - longitudinalMin) / longitudinalSpan) * (bucketCount - 1) - 1e-7),
    0,
    bucketCount - 1,
  ));
  const bucketForPercent = (percent) => Math.floor(clamp(
    Math.round((clamp(percent, minPercent, maxPercent) / 100) * (bucketCount - 1)),
    0,
    bucketCount - 1,
  ));

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const offset = triangle * 3;
    const a = sourceIndices[offset];
    const b = sourceIndices[offset + 1];
    const c = sourceIndices[offset + 2];
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a);
    const bx = position.getX(b), by = position.getY(b), bz = position.getZ(b);
    const cx = position.getX(c), cy = position.getY(c), cz = position.getZ(c);
    const bucket = bucketForCoordinate(Math.max(ax, bx, cx));
    triangleBuckets[triangle] = bucket;
    counts[bucket] += 1;
    bucketMinX[bucket] = Math.min(bucketMinX[bucket], ax, bx, cx);
    bucketMinY[bucket] = Math.min(bucketMinY[bucket], ay, by, cy);
    bucketMinZ[bucket] = Math.min(bucketMinZ[bucket], az, bz, cz);
    bucketMaxX[bucket] = Math.max(bucketMaxX[bucket], ax, bx, cx);
    bucketMaxY[bucket] = Math.max(bucketMaxY[bucket], ay, by, cy);
    bucketMaxZ[bucket] = Math.max(bucketMaxZ[bucket], az, bz, cz);
  }

  const offsets = new Uint32Array(bucketCount);
  const cumulativeCounts = new Uint32Array(bucketCount);
  let indexCursor = 0;
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    offsets[bucket] = indexCursor;
    indexCursor += counts[bucket] * 3;
    cumulativeCounts[bucket] = indexCursor;
  }
  const writeOffsets = offsets.slice();
  const IndexCtor = sourceIndices.constructor;
  const sortedIndices = new IndexCtor(sourceIndex.count);
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const sourceOffset = triangle * 3;
    const bucket = triangleBuckets[triangle];
    const destination = writeOffsets[bucket];
    sortedIndices[destination] = sourceIndices[sourceOffset];
    sortedIndices[destination + 1] = sourceIndices[sourceOffset + 1];
    sortedIndices[destination + 2] = sourceIndices[sourceOffset + 2];
    writeOffsets[bucket] += 3;
  }
  geometry.setIndex(new THREE.BufferAttribute(sortedIndices, 1));

  const cumulativeMinX = new Float64Array(bucketCount);
  const cumulativeMinY = new Float64Array(bucketCount);
  const cumulativeMinZ = new Float64Array(bucketCount);
  const cumulativeMaxX = new Float64Array(bucketCount);
  const cumulativeMaxY = new Float64Array(bucketCount);
  const cumulativeMaxZ = new Float64Array(bucketCount);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    if (counts[bucket] > 0) {
      minX = Math.min(minX, bucketMinX[bucket]);
      minY = Math.min(minY, bucketMinY[bucket]);
      minZ = Math.min(minZ, bucketMinZ[bucket]);
      maxX = Math.max(maxX, bucketMaxX[bucket]);
      maxY = Math.max(maxY, bucketMaxY[bucket]);
      maxZ = Math.max(maxZ, bucketMaxZ[bucket]);
    }
    cumulativeMinX[bucket] = minX;
    cumulativeMinY[bucket] = minY;
    cumulativeMinZ[bucket] = minZ;
    cumulativeMaxX[bucket] = maxX;
    cumulativeMaxY[bucket] = maxY;
    cumulativeMaxZ[bucket] = maxZ;
  }

  const localBoxForBucket = (requestedBucket) => {
    let bucket = Math.floor(clamp(requestedBucket, 0, bucketCount - 1));
    while (bucket < bucketCount - 1 && cumulativeCounts[bucket] === 0) bucket += 1;
    if (!Number.isFinite(cumulativeMinX[bucket])) return fullBox.clone();
    return new THREE.Box3(
      new THREE.Vector3(cumulativeMinX[bucket], cumulativeMinY[bucket], cumulativeMinZ[bucket]),
      new THREE.Vector3(cumulativeMaxX[bucket], cumulativeMaxY[bucket], cumulativeMaxZ[bucket]),
    );
  };
  const localBoxForPercent = (percent) => localBoxForBucket(bucketForPercent(percent));
  const defaultLocalBox = localBoxForPercent(defaultPercent);
  let currentPercent = clamp(Number(defaultPercent) || 36.8857962522, minPercent, maxPercent);

  function syncUi() {
    if (ui?.range) ui.range.value = currentPercent.toFixed(3);
    if (ui?.value) ui.value.textContent = `${currentPercent.toFixed(1)}%`;
  }

  function getState() {
    const bucket = bucketForPercent(currentPercent);
    const visibleIndexCount = cumulativeCounts[bucket];
    return {
      percent: Number(currentPercent.toFixed(4)),
      coordinate: Number((longitudinalMin + longitudinalSpan * currentPercent / 100).toFixed(4)),
      visibleTriangles: Math.floor(visibleIndexCount / 3),
      totalTriangles: triangleCount,
      visibleIndexCount,
      bucket,
    };
  }

  function apply(nextPercent, { persist = true, notify = true } = {}) {
    currentPercent = clamp(Number(nextPercent) || defaultPercent, minPercent, maxPercent);
    const bucket = bucketForPercent(currentPercent);
    const visibleIndexCount = cumulativeCounts[bucket];
    const visibleBox = localBoxForBucket(bucket);
    geometry.setDrawRange(0, visibleIndexCount);
    geometry.boundingBox = visibleBox.clone();
    const center = visibleBox.getCenter(new THREE.Vector3());
    const size = visibleBox.getSize(new THREE.Vector3());
    geometry.boundingSphere = new THREE.Sphere(center, size.length() * 0.5);
    mesh.frustumCulled = false;
    syncUi();
    if (persist) {
      try {
        globalThis.__asfaltoV7Storage.setItem(FRONT_CUT_STORAGE_KEY, JSON.stringify({ version: 1, percent: currentPercent }));
      } catch {}
    }
    if (notify) onChange(getState());
    return getState();
  }

  function restore() {
    try {
      const saved = JSON.parse(globalThis.__asfaltoV7Storage.getItem(FRONT_CUT_STORAGE_KEY) || 'null');
      if (saved && saved.version === 1 && Number.isFinite(Number(saved.percent))) currentPercent = Number(saved.percent);
    } catch {}
    apply(currentPercent, { persist: false, notify: false });
  }

  function reset({ persist = true } = {}) {
    if (persist) try { globalThis.__asfaltoV7Storage.removeItem(FRONT_CUT_STORAGE_KEY); } catch {}
    return apply(defaultPercent, { persist: false, notify: true });
  }

  ui?.range?.addEventListener('input', () => apply(ui.range.value));
  ui?.reset?.addEventListener('click', reset);
  restore();
  syncUi();

  return {
    getState,
    snapshotState: () => ({ currentPercent }),
    restoreState: (snapshot) => apply(snapshot?.currentPercent, { persist: false, notify: true }),
    getDefaultLocalBox: () => defaultLocalBox.clone(),
    setPercent: (percent, options = {}) => apply(percent, options),
    reset,
    setVisible(visible) {
      if (ui?.card) ui.card.hidden = !visible;
    },
  };
}

function normalizeObject(THREE, object, targetWidth, localReferenceBox = null) {
  localReferenceBox ||= phoneDisplayReferenceBox(THREE,object);
  const wrapper = new THREE.Group();
  wrapper.add(object);
  object.updateMatrixWorld(true);
  const box = localReferenceBox?.isBox3 && !localReferenceBox.isEmpty()
    ? localReferenceBox.clone().applyMatrix4(object.matrixWorld)
    : new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  wrapper.scale.setScalar(targetWidth / Math.max(size.x, 1e-6));
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

function makeEnvironment(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#dce8f4');
  gradient.addColorStop(0.42, '#8b929a');
  gradient.addColorStop(0.58, '#3b3e43');
  gradient.addColorStop(1, '#101216');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function setLoading(text) {
  globalThis.__asfaltoPhoneLoad?.stage(text);
  loadingTextEl.textContent = text;
}


'use strict';

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function dialAngle(value, max) {
  return valueToNeedleRotation(value, 0, max);
}

function createDialCanvas(kind, emission = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const cx = 512;
  const cy = 512;
  const outer = 480;
  const max = kind === 'speed' ? 220 : 6;
  const minorStep = kind === 'speed' ? 10 : 0.2;
  const majorStep = kind === 'speed' ? 20 : 1;

  if (emission) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1024, 1024); }
  if (!emission) {
  const background = ctx.createRadialGradient(cx - 105, cy - 135, 30, cx, cy, outer);
  background.addColorStop(0, '#272a2c');
  background.addColorStop(0.28, '#111315');
  background.addColorStop(0.74, '#050607');
  background.addColorStop(1, '#020303');
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, outer - 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, outer - 3, 0, Math.PI * 2);
  ctx.stroke();

  }
  const count = Math.round(max / minorStep);
  for (let i = 0; i <= count; i++) {
    const value = i * minorStep;
    const angle = dialAngle(value, max);
    const major = Math.abs(value / majorStep - Math.round(value / majorStep)) < 0.001;
    const red = kind === 'rpm' && value >= 5.2;
    const r1 = outer - 60;
    const r2 = outer - (major ? 108 : 83);
    const x1 = cx + Math.cos(angle) * r1;
    const y1 = cy - Math.sin(angle) * r1;
    const x2 = cx + Math.cos(angle) * r2;
    const y2 = cy - Math.sin(angle) * r2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = red ? '#ef3f38' : (major ? '#f6f7f3' : 'rgba(239,241,236,.78)');
    ctx.lineWidth = major ? 10 : 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  if (kind === 'rpm') {
    const start = dialAngle(5.2, max);
    const end = dialAngle(6, max);
    // Canvas usa Y hacia abajo: se invierte el signo del ángulo matemático.
    ctx.beginPath();
    ctx.arc(cx, cy, outer - 42, -start, -end, true);
    ctx.strokeStyle = 'rgba(225,41,35,.88)';
    ctx.lineWidth = 18;
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = kind === 'speed' ? '700 45px Arial, sans-serif' : '700 49px Arial, sans-serif';
  ctx.fillStyle = '#f5f6f1';
  ctx.shadowColor = 'rgba(255,255,255,.18)';
  ctx.shadowBlur = emission ? 0 : 5;
  for (let value = 0; value <= max + 0.001; value += majorStep) {
    const angle = dialAngle(value, max);
    const radius = outer - 155;
    const x = cx + Math.cos(angle) * radius;
    const y = cy - Math.sin(angle) * radius;
    const label = kind === 'speed' ? String(Math.round(value)) : String(Math.round(value));
    ctx.fillStyle = kind === 'rpm' && value >= 5 ? '#ff5950' : '#f3f4ef';
    ctx.fillText(label, x, y);
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e7e9e5';
  ctx.font = '600 31px Arial, sans-serif';
  ctx.fillText(kind === 'speed' ? 'km/h' : 'RPM x1000', cx, cy + 162);
  ctx.fillStyle = 'rgba(232,235,229,.74)';
  ctx.font = '700 23px Arial, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText(kind === 'speed' ? 'CHEVY SS' : 'CHEVY 250', cx, cy + 208);

  // Marcas de tornillos y reflejos muy sutiles para integrar el instrumento al tablero.
  for (const a of (emission ? [] : [0.25, 2.89, 3.39, 6.03])) {
    const x = cx + Math.cos(a) * (outer - 22);
    const y = cy + Math.sin(a) * (outer - 22);
    const screw = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 15);
    screw.addColorStop(0, '#d7d9d9');
    screw.addColorStop(0.35, '#7b7f82');
    screw.addColorStop(1, '#151719');
    ctx.fillStyle = screw;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function createDigitalDisplay(THREE, width, height, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  let previous = '';

  function update(text, subtext = '') {
    const key = `${text}|${subtext}`;
    if (key === previous) return;
    previous = key;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(1,4,4,.98)');
    gradient.addColorStop(1, 'rgba(7,12,11,.98)');
    ctx.fillStyle = gradient;
    roundedRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,192,184,.18)';
    ctx.lineWidth = 5;
    roundedRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 27);
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 92px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(text, canvas.width / 2, canvas.height * 0.48);
    ctx.shadowBlur = 0;
    if (subtext) {
      ctx.fillStyle = 'rgba(196,224,213,.82)';
      ctx.font = '600 27px Arial, sans-serif';
      ctx.fillText(subtext, canvas.width / 2, canvas.height * 0.82);
    }
    texture.needsUpdate = true;
  }

  update('0');
  return { mesh, update, texture };
}

function createGauge(THREE, kind, radius) {
  const group = new THREE.Group();
  group.name = kind === 'speed' ? 'VelocimetroFuncional' : 'CuentavueltasFuncional';

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.08, 96),
    new THREE.MeshStandardMaterial({ color: 0x030404, roughness: 0.45, metalness: 0.25 }),
  );
  shadow.position.z = -0.012;
  group.add(shadow);

  const faceTexture = new THREE.CanvasTexture(createDialCanvas(kind));
  const emissionTexture = new THREE.CanvasTexture(createDialCanvas(kind, true));
  emissionTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.minFilter = THREE.LinearMipmapLinearFilter;
  faceTexture.magFilter = THREE.LinearFilter;
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 96),
    new THREE.MeshStandardMaterial({ map:faceTexture,roughness:.78,metalness:0,emissiveMap:emissionTexture,emissive:0xc9d5ac,emissiveIntensity:0 }),
  );
  group.add(face);

  const bezel = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.025, radius * 0.055, 18, 96),
    new THREE.MeshStandardMaterial({ color: 0x6f7478, metalness: 0.92, roughness: 0.22 }),
  );
  bezel.position.z = 0.018;
  group.add(bezel);

  const needleLength = radius * 0.80;
  const needleTail = radius * 0.18;
  const needleWidth = radius * 0.032;
  const needleGeometry = new THREE.BufferGeometry();
  needleGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -needleTail, -needleWidth * 0.72, 0,
    needleLength, 0, 0,
    -needleTail, needleWidth * 0.72, 0,
  ], 3));
  needleGeometry.setIndex([0, 1, 2]);
  needleGeometry.computeVertexNormals();
  const needle = new THREE.Mesh(
    needleGeometry,
    new THREE.MeshStandardMaterial({ color: 0xf0eee6, metalness: 0.42, roughness: 0.34, emissive: 0xc9d5ac, emissiveIntensity: 0 }),
  );
  needle.position.z = 0.037;
  group.add(needle);

  const redTailGeometry = new THREE.BufferGeometry();
  redTailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -needleWidth * 0.55, 0,
    -needleTail * 1.25, 0, 0,
    0, needleWidth * 0.55, 0,
  ], 3));
  redTailGeometry.setIndex([0, 1, 2]);
  const redTail = new THREE.Mesh(redTailGeometry, new THREE.MeshBasicMaterial({ color: 0xb9302c }));
  redTail.position.z = 0.039;
  needle.add(redTail);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.095, radius * 0.12, radius * 0.05, 48),
    new THREE.MeshStandardMaterial({ color: 0x17191a, metalness: 0.78, roughness: 0.24 }),
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.047;
  group.add(hub);

  const display = createDigitalDisplay(THREE, radius * 0.63, radius * 0.20, kind === 'speed' ? '#d8fff0' : '#e8fff6');
  display.mesh.position.set(0, -radius * 0.50, 0.032);
  group.add(display.mesh);

  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.965, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.035,
      roughness: 0.18,
      metalness: 0,
      transmission: 0,
      depthWrite: false,
    }),
  );
  glass.position.z = 0.052;
  group.add(glass);

  let spring = { value: kind === 'rpm' ? ENGINE_SPEC.idleRpm : 0, velocity: 0 };
  const maximum = kind === 'speed' ? 220 : 6000;
  function update(value, dt, gear = 'N') {
    const target = clamp(value, 0, maximum);
    spring = stepSpring(spring, target, dt, kind === 'speed' ? 62 : 72, kind === 'speed' ? 14 : 16, 0, maximum);
    needle.rotation.z = valueToNeedleRotation(spring.value, 0, maximum);
    if (kind === 'speed') {
      display.update(String(Math.round(spring.value)).padStart(3, '0'), 'km/h');
    } else {
      display.update(`${gear} ${String(Math.round(spring.value)).padStart(4, '0')}`, 'RPM');
    }
  }

  update(kind === 'rpm' ? ENGINE_SPEC.idleRpm : 0, 1 / 60, 'N');
  return { group, update, needle, display, getReading:()=>({value:spring.value,digitalValue:Math.round(spring.value)}), setIllumination(power,night){
    const level = Number.isFinite(power) ? clamp(power,0,1) : 0;
    face.material.emissiveIntensity = level * .5;
    needle.material.emissiveIntensity = level * .4;
    display.mesh.material.color.setScalar(night ? .1 + .7 * level : .85);
    redTail.material.color.setHex(0xb9302c).multiplyScalar(night ? .2 + .65 * level : 1);
  } };
}

function createGaugeCluster(THREE, layout) {
  const group = new THREE.Group();
  group.name = 'InstrumentalChevyFuncional';
  const speed = createGauge(THREE, 'speed', layout.radius);
  speed.group.position.fromArray(layout.speed);
  const rpm = createGauge(THREE, 'rpm', layout.radius);
  rpm.group.position.fromArray(layout.rpm);
  group.add(speed.group, rpm.group);
  return {
    group,
    update(speedKmh, rpmValue, gear, dt) {
      speed.update(Math.abs(speedKmh), dt, gear);
      rpm.update(rpmValue, dt, gear);
    },
    speed,
    rpm,
  };
}

function createLeatherTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = 21 + Math.random() * 20;
    image.data[i] = grain;
    image.data[i + 1] = grain * 0.84;
    image.data[i + 2] = grain * 0.69;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * 256;
    ctx.strokeStyle = Math.random() > 0.5 ? '#090807' : '#4b3b2f';
    ctx.lineWidth = Math.random() * 1.2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(70, y + Math.random() * 8 - 4, 190, y + Math.random() * 8 - 4, 256, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.1);
  return texture;
}

function createBootGeometry(THREE, radialSegments = 28, verticalSegments = 7) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let ring = 0; ring <= verticalSegments; ring++) {
    const v = ring / verticalSegments;
    for (let segment = 0; segment <= radialSegments; segment++) {
      const u = segment / radialSegments;
      const angle = u * Math.PI * 2;
      positions.push(Math.cos(angle), v, Math.sin(angle));
      uvs.push(u, v);
    }
  }
  for (let ring = 0; ring < verticalSegments; ring++) {
    for (let segment = 0; segment < radialSegments; segment++) {
      const a = ring * (radialSegments + 1) + segment;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.radialSegments = radialSegments;
  geometry.userData.verticalSegments = verticalSegments;
  return geometry;
}

function updateBootGeometry(geometry, leverX, leverY) {
  const radialSegments = geometry.userData.radialSegments;
  const verticalSegments = geometry.userData.verticalSegments;
  const position = geometry.getAttribute('position');
  const topOffsetX = leverX * 0.014;
  const topOffsetZ = -leverY * 0.012;
  let cursor = 0;
  for (let ring = 0; ring <= verticalSegments; ring++) {
    const t = ring / verticalSegments;
    const bend = Math.pow(t, 1.42);
    const pleat = 1 + Math.sin(t * Math.PI * 7) * 0.10 * (1 - t * 0.42);
    const radiusX = lerp(0.055, 0.014, t) * pleat;
    const radiusZ = lerp(0.043, 0.012, t) * pleat;
    const centerX = topOffsetX * bend;
    const centerZ = topOffsetZ * bend;
    const centerY = lerp(-0.026, 0.025, t) + Math.sin(t * Math.PI * 6) * 0.0018 * (1 - t);
    for (let segment = 0; segment <= radialSegments; segment++) {
      const angle = segment / radialSegments * Math.PI * 2;
      const facing = Math.cos(angle) * leverX + Math.sin(angle) * (-leverY);
      const compression = 1 - 0.10 * Math.abs(facing) * t;
      position.setXYZ(
        cursor++,
        centerX + Math.cos(angle) * radiusX * compression,
        centerY,
        centerZ + Math.sin(angle) * radiusZ * compression,
      );
    }
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function createManualShifter(THREE, knobModel) {
  const group = new THREE.Group();
  group.name = 'MecanismoPalancaManual';

  const leather = createLeatherTexture(THREE);
  const bootGeometry = createBootGeometry(THREE);
  const bootGroup = new THREE.Group();
  bootGroup.name = 'AjusteFuellePalanca';
  group.add(bootGroup);

  const boot = new THREE.Mesh(
    bootGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x201711,
      map: leather,
      bumpMap: leather,
      bumpScale: 0.0028,
      roughness: 0.86,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  boot.name = 'FuelleCueroDeformable';
  bootGroup.add(boot);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.006, 14, 64),
    new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.67, metalness: 0.22 }),
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.029;
  collar.scale.y = 0.78;
  group.add(collar);

  const shaftRig = new THREE.Group();
  shaftRig.name = 'AjusteEjePalanca';
  group.add(shaftRig);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0068, 1, 24),
    new THREE.MeshStandardMaterial({ color: 0x666b6e, metalness: 0.90, roughness: 0.18 }),
  );
  shaft.name = 'EjePalanca';
  shaftRig.add(shaft);

  const knobMotion = new THREE.Group();
  knobMotion.name = 'MovimientoMecanicoBocha';
  group.add(knobMotion);
  const knobRig = new THREE.Group();
  knobRig.name = 'AjustePomoPalanca';
  knobRig.position.set(0, 0.101, 0);
  knobMotion.add(knobRig);

  if (!knobModel?.isObject3D) throw new TypeError('Falta el modelo de la bocha grabada.');
  const knob = knobModel;
  knob.name = 'PomoPalancaInteractivo';
  knob.userData.control = 'shifter';
  knobRig.add(knob);

  const basePoint = new THREE.Vector3();
  const shaftTop = new THREE.Vector3();
  const knobPoint = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function update(leverX, leverY) {
    const offsetX = clamp(leverX, -1, 1) * 0.030;
    const offsetZ = -clamp(leverY, -1, 1) * 0.025;
    basePoint.set(offsetX * 0.10, 0.018, offsetZ * 0.10);
    shaftTop.set(offsetX * 0.88, 0.077, offsetZ * 0.88);
    knobPoint.set(offsetX, 0.101, offsetZ);
    direction.copy(shaftTop).sub(basePoint);
    const length = direction.length();
    midpoint.copy(basePoint).add(shaftTop).multiplyScalar(0.5);
    shaftRig.position.copy(midpoint);
    shaftRig.quaternion.setFromUnitVectors(up, direction.normalize());
    shaft.position.set(0, 0, 0);
    shaft.scale.set(1, length, 1);
    // Mechanical travel belongs to the parent, never to the saved editor pose.
    knobMotion.position.set(knobPoint.x, 0, knobPoint.z);
    knob.position.set(0, 0, 0);
    updateBootGeometry(bootGeometry, leverX, leverY);
  }

  update(0, 0);
  return { group, knob, boot, bootGroup, shaft, shaftRig, knobRig, update };
}


'use strict';

const ENGINE_WORKLET_SOURCE = String.raw`
'use strict';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;
const PROFILE_EXHAUST = new Float32Array([1.00, 1.07, 1.15]);
const PROFILE_INTAKE = new Float32Array([1.00, 1.10, 1.21]);
const PROFILE_MECHANICAL = new Float32Array([0.92, 1.00, 1.14]);
const PROFILE_POP = new Float32Array([0.58, 0.90, 1.18]);
const PROFILE_DRIVE = new Float32Array([1.00, 1.03, 1.07]);
const PROFILE_NORMALIZATION = new Float32Array([1.00, 0.70, 0.76]);
const GEAR_RATIO = new Float32Array([0, 2.95, 1.94, 1.34, 1.00, 0.78]);

function clampValue(value, minimum, maximum) {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function softClip(value, drive) {
  const driven = value * drive;
  const absolute = Math.abs(driven);
  return driven / (1 + absolute * 0.72);
}

class OnePoleFilter {
  constructor(cutoff) {
    this.state = 0;
    this.coefficient = 0.1;
    this.setCutoff(cutoff || 1000);
  }
  setCutoff(cutoff) {
    const frequency = clampValue(cutoff, 1, sampleRate * 0.44);
    this.coefficient = 1 - Math.exp(-TAU * frequency / sampleRate);
  }
  process(input) {
    this.state += (input - this.state) * this.coefficient;
    return this.state;
  }
}

class StateVariableFilter {
  constructor(frequency, resonance) {
    this.low = 0;
    this.band = 0;
    this.high = 0;
    this.frequency = 0.1;
    this.damping = 0.5;
    this.set(frequency || 1000, resonance || 0.6);
  }
  set(frequency, resonance) {
    const normalized = clampValue(frequency, 10, sampleRate * 0.20);
    this.frequency = Math.min(0.92, 2 * Math.sin(Math.PI * normalized / sampleRate));
    this.damping = clampValue(2 * (1 - Math.pow(clampValue(resonance, 0, 0.99), 0.25)), 0.08, 1.85);
  }
  process(input) {
    this.low += this.frequency * this.band;
    this.high = input - this.low - this.damping * this.band;
    this.band += this.frequency * this.high;
    return this.band;
  }
}

class ModalResonator {
  constructor() {
    this.y1 = 0;
    this.y2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.normalization = 0;
    this.gain = 0;
  }
  set(frequency, decaySeconds, gain) {
    const safeFrequency = clampValue(frequency, 18, sampleRate * 0.43);
    const safeDecay = clampValue(decaySeconds, 0.0025, 0.24);
    const radius = Math.exp(-1 / (safeDecay * sampleRate));
    this.a1 = 2 * radius * Math.cos(TAU * safeFrequency / sampleRate);
    this.a2 = -radius * radius;
    this.normalization = (1 - radius) * 7.5;
    this.gain = gain;
  }
  process(input) {
    const output = input + this.a1 * this.y1 + this.a2 * this.y2;
    this.y2 = this.y1;
    this.y1 = output;
    return output * this.normalization * this.gain;
  }
}

class VariableModalBank {
  constructor(maximumModes) {
    this.maximumModes = maximumModes;
    this.activeModes = maximumModes;
    this.modes = new Array(maximumModes);
    for (let index = 0; index < maximumModes; index++) this.modes[index] = new ModalResonator();
  }
  configure(frequencies, decays, gains, frequencyScale, decayScale, gainScale, activeModes) {
    this.activeModes = Math.min(this.maximumModes, Math.max(1, activeModes | 0));
    for (let index = 0; index < this.activeModes; index++) {
      this.modes[index].set(
        frequencies[index] * frequencyScale,
        decays[index] * decayScale,
        gains[index] * gainScale,
      );
    }
  }
  process(input) {
    let output = 0;
    for (let index = 0; index < this.activeModes; index++) output += this.modes[index].process(input);
    return output;
  }
}

class DcBlocker {
  constructor() {
    this.inputPrevious = 0;
    this.outputPrevious = 0;
  }
  process(input) {
    const output = input - this.inputPrevious + 0.995 * this.outputPrevious;
    this.inputPrevious = input;
    this.outputPrevious = output;
    return output;
  }
}

class CylinderPulseEngine {
  constructor() {
    this.phase = 0;
    this.fastEnvelope = 0;
    this.bodyEnvelope = 0;
    this.tailEnvelope = 0;
    this.pulseAmplitude = 0;
    this.pulseCursor = 0;
    this.pulseLength = 6;
    this.cylinderCursor = 0;
    this.timingBias = 0;
    this.fired = 0;
    this.eventAmplitude = 0;
    this.firingOrder = new Int8Array([0, 4, 2, 5, 1, 3]);
    this.cylinderGain = new Float32Array([1.000, 0.979, 1.014, 0.988, 1.007, 0.972]);
    this.fastDecay = Math.exp(-1 / (sampleRate * 0.00062));
    this.bodyDecay = Math.exp(-1 / (sampleRate * 0.0032));
    this.tailDecay = Math.exp(-1 / (sampleRate * 0.0125));
  }
  process(firingHz, pressure, roughness, fuel, limiter, randomValue) {
    this.fired = 0;
    const rate = Math.max(1, firingHz * (1 + this.timingBias * roughness));
    this.phase += rate / sampleRate;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      const sequenceIndex = this.cylinderCursor % 6;
      const cylinder = this.firingOrder[sequenceIndex];
      const cylinderVariation = this.cylinderGain[cylinder];
      const limiterPattern = limiter < 0.995 && (sequenceIndex % 3 === 1 || sequenceIndex % 5 === 4)
        ? Math.max(0.025, limiter * 0.20)
        : limiter;
      const amplitude = pressure * fuel * limiterPattern * cylinderVariation * (0.965 + randomValue * 0.035);
      this.fastEnvelope += amplitude * 0.90;
      this.bodyEnvelope += amplitude * 0.78;
      this.tailEnvelope += amplitude * 0.36;
      this.pulseAmplitude += amplitude;
      this.pulseCursor = this.pulseLength;
      this.timingBias = randomValue * 0.022;
      this.cylinderCursor++;
      this.fired = 1;
      this.eventAmplitude = amplitude;
    }
    let antiAliasedPulse = 0;
    if (this.pulseCursor > 0) {
      const progress = (this.pulseLength - this.pulseCursor + 1) / (this.pulseLength + 1);
      antiAliasedPulse = this.pulseAmplitude * (0.5 - 0.5 * Math.cos(TAU * progress));
      this.pulseCursor--;
      if (this.pulseCursor === 0) this.pulseAmplitude = 0;
    }
    this.fastEnvelope *= this.fastDecay;
    this.bodyEnvelope *= this.bodyDecay;
    this.tailEnvelope *= this.tailDecay;
    return antiAliasedPulse * 0.70
      + this.fastEnvelope * 0.52
      - this.bodyEnvelope * 0.38
      + this.tailEnvelope * 0.11;
  }
}

class Chevy250EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const k = (name, defaultValue, minValue, maxValue) => ({
      name,
      defaultValue,
      minValue,
      maxValue,
      automationRate: 'k-rate',
    });
    return [
      k('rpm', 820, 0, 6000), k('throttle', 0, 0, 1), k('load', 0, -1, 1),
      k('speed', 0, 0, 70), k('brake', 0, 0, 1), k('accel', 0, -15, 15),
      k('clutch', 0, 0, 1), k('gear', 0, -1, 5), k('limiter', 1, 0, 1),
      k('engineLevel', 1, 0, 1.25), k('exhaustLevel', 0.92, 0, 1.25),
      k('intakeLevel', 0.62, 0, 1.25), k('mechanicalLevel', 0.38, 0, 1.25),
      k('roadLevel', 0.44, 0, 1.25), k('brakeLevel', 0.56, 0, 1.25),
      k('profile', 0, 0, 2), k('idleRoughness', 0.38, 0, 1),
      k('exhaustCharacter', 0.52, 0, 1), k('intakeCharacter', 0.48, 0, 1),
      k('transmissionCharacter', 0.42, 0, 1), k('popsLevel', 0.24, 0, 1),
      k('stereoWidth', 0.68, 0, 1), k('quality', 1, 0, 1),
    ];
  }

  constructor() {
    super();
    this.cylinders = new CylinderPulseEngine();
    this.exhaustBank = new VariableModalBank(8);
    this.intakeBank = new VariableModalBank(4);
    this.blockBank = new VariableModalBank(4);
    this.popBank = new VariableModalBank(3);
    this.brakeResonator = new ModalResonator();
    this.intakeFilter = new StateVariableFilter(900, 0.62);
    this.roadFilterLeft = new StateVariableFilter(180, 0.32);
    this.roadFilterRight = new StateVariableFilter(190, 0.30);
    this.brakeFilterLeft = new StateVariableFilter(1250, 0.48);
    this.brakeFilterRight = new StateVariableFilter(1320, 0.46);
    this.pulseLow = new OnePoleFilter(760);
    this.windLowLeft = new OnePoleFilter(1500);
    this.windLowRight = new OnePoleFilter(1560);
    this.dcLeft = new DcBlocker();
    this.dcRight = new DcBlocker();

    this.exhaustFrequencies = new Float32Array([66, 104, 158, 242, 356, 518, 760, 1080]);
    this.exhaustDecays = new Float32Array([0.072, 0.061, 0.052, 0.044, 0.036, 0.030, 0.024, 0.019]);
    this.exhaustGains = new Float32Array([1.38, 1.12, 0.91, 0.70, 0.52, 0.36, 0.24, 0.14]);
    this.intakeFrequencies = new Float32Array([320, 610, 960, 1480]);
    this.intakeDecays = new Float32Array([0.019, 0.014, 0.010, 0.007]);
    this.intakeGains = new Float32Array([0.88, 0.66, 0.44, 0.28]);
    this.blockFrequencies = new Float32Array([82, 166, 278, 418]);
    this.blockDecays = new Float32Array([0.040, 0.026, 0.018, 0.012]);
    this.blockGains = new Float32Array([0.72, 0.48, 0.31, 0.18]);
    this.popFrequencies = new Float32Array([58, 112, 208]);
    this.popDecays = new Float32Array([0.088, 0.052, 0.030]);
    this.popGains = new Float32Array([1.00, 0.68, 0.36]);

    this.seedLeft = 0x4d595df4;
    this.seedRight = 0x7f4a7c15;
    this.rpmSmooth = 820;
    this.throttleSmooth = 0;
    this.loadSmooth = 0;
    this.speedSmooth = 0;
    this.brakeSmooth = 0;
    this.clutchSmooth = 0;
    this.lastThrottleTarget = 0;
    this.crankPhase = 0;
    this.wheelPhase = 0;
    this.gearPhase = 0;
    this.starterPhase = 0;
    this.brakePhase = 0;
    this.valveEnvelope = 0;
    this.shiftEnvelope = 0;
    this.popEnvelope = 0;
    this.startEnvelope = 0;
    this.shutdownEnvelope = 1;
    this.overrunAccumulator = 0;
    this.lastGear = 0;
    this.profile = 0;
    this.quality = 1;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'start') {
        this.startEnvelope = 1;
        this.shutdownEnvelope = 1;
        this.rpmSmooth = Math.max(220, Number(data.rpm) || 320);
      } else if (data.type === 'stop') {
        this.shutdownEnvelope = 0;
      } else if (data.type === 'shift') {
        this.shiftEnvelope = Math.max(this.shiftEnvelope, clampValue(Number(data.intensity) || 0.72, 0.15, 1.35));
      } else if (data.type === 'pop') {
        this.popEnvelope = Math.max(this.popEnvelope, clampValue(Number(data.intensity) || 0.72, 0.15, 1.45));
      }
    };
  }

  randomLeft() {
    let value = this.seedLeft | 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.seedLeft = value | 0;
    return ((value >>> 0) / 2147483648) - 1;
  }

  randomRight() {
    let value = this.seedRight | 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.seedRight = value | 0;
    return ((value >>> 0) / 2147483648) - 1;
  }

  configureBanks(rpm, load, throttle, profile, quality, exhaustCharacter, intakeCharacter) {
    const rpmNorm = clampValue((rpm - 700) / 4700, 0, 1);
    const loadPositive = Math.max(0, load);
    const exhaustScale = 0.985 + profile * 0.025 + exhaustCharacter * 0.080 + loadPositive * 0.018;
    const exhaustDecay = 0.90 + exhaustCharacter * 0.42 + profile * 0.13;
    const exhaustGain = PROFILE_EXHAUST[profile] * (0.84 + exhaustCharacter * 0.38) * (0.92 + loadPositive * 0.14);
    this.exhaustBank.configure(
      this.exhaustFrequencies,
      this.exhaustDecays,
      this.exhaustGains,
      exhaustScale,
      exhaustDecay,
      exhaustGain,
      quality ? 8 : 5,
    );

    const intakeScale = 0.96 + intakeCharacter * 0.16 + rpmNorm * 0.05;
    const intakeDecay = 0.85 + intakeCharacter * 0.40;
    const intakeGain = PROFILE_INTAKE[profile] * (0.76 + intakeCharacter * 0.52) * (0.70 + throttle * 0.40);
    this.intakeBank.configure(
      this.intakeFrequencies,
      this.intakeDecays,
      this.intakeGains,
      intakeScale,
      intakeDecay,
      intakeGain,
      quality ? 4 : 2,
    );

    this.blockBank.configure(
      this.blockFrequencies,
      this.blockDecays,
      this.blockGains,
      0.98 + rpmNorm * 0.055,
      0.95 + loadPositive * 0.18,
      0.92 + profile * 0.08,
      quality ? 4 : 3,
    );
    this.popBank.configure(
      this.popFrequencies,
      this.popDecays,
      this.popGains,
      0.96 + profile * 0.035,
      0.95 + profile * 0.18,
      PROFILE_POP[profile],
      3,
    );
    this.brakeResonator.set(1750 + this.speedSmooth * 15, 0.012, 0.66);
    this.intakeFilter.set(620 + rpm * (0.105 + intakeCharacter * 0.030), 0.58 + intakeCharacter * 0.20);
    this.roadFilterLeft.set(135 + this.speedSmooth * 12.5, 0.24);
    this.roadFilterRight.set(147 + this.speedSmooth * 12.0, 0.22);
    this.brakeFilterLeft.set(980 + this.speedSmooth * 28, 0.42);
    this.brakeFilterRight.set(1060 + this.speedSmooth * 30, 0.40);
    this.pulseLow.setCutoff(560 + rpm * 0.15 + exhaustCharacter * 380);
    this.windLowLeft.setCutoff(1550 + this.speedSmooth * 58);
    this.windLowRight.setCutoff(1620 + this.speedSmooth * 61);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;
    const left = output[0];
    const right = output[1] || output[0];
    const p = (name) => parameters[name][0];

    const rpmTarget = p('rpm');
    const throttleTarget = p('throttle');
    const loadTarget = p('load');
    const speedTarget = p('speed');
    const brakeTarget = p('brake');
    const acceleration = p('accel');
    const clutchTarget = p('clutch');
    const gear = p('gear');
    const limiter = p('limiter');
    const engineLevel = p('engineLevel');
    const exhaustLevel = p('exhaustLevel');
    const intakeLevel = p('intakeLevel');
    const mechanicalLevel = p('mechanicalLevel');
    const roadLevel = p('roadLevel');
    const brakeLevel = p('brakeLevel');
    const profile = clampValue(Math.round(p('profile')), 0, 2);
    const idleRoughness = p('idleRoughness');
    const exhaustCharacter = p('exhaustCharacter');
    const intakeCharacter = p('intakeCharacter');
    const transmissionCharacter = p('transmissionCharacter');
    const popsLevel = p('popsLevel');
    const stereoWidth = p('stereoWidth');
    const quality = p('quality') >= 0.5 ? 1 : 0;

    this.profile = profile;
    this.quality = quality;
    this.configureBanks(
      Math.max(180, this.rpmSmooth),
      this.loadSmooth,
      this.throttleSmooth,
      profile,
      quality,
      exhaustCharacter,
      intakeCharacter,
    );

    const smoothRpm = 1 - Math.exp(-1 / (sampleRate * 0.046));
    const smoothFast = 1 - Math.exp(-1 / (sampleRate * 0.014));
    const smoothLoad = 1 - Math.exp(-1 / (sampleRate * 0.032));
    const valveDecay = Math.exp(-1 / (sampleRate * 0.00072));
    const shiftDecay = Math.exp(-1 / (sampleRate * 0.048));
    const popDecay = Math.exp(-1 / (sampleRate * 0.044));
    const startDecay = Math.exp(-1 / (sampleRate * 0.92));
    const width = 0.34 + stereoWidth * 0.66;
    const exhaustPan = 0.30 * width;
    const intakePan = -0.28 * width;
    const blockPan = -0.08 * width;
    const transmissionPan = 0.08 * width;
    const exhaustLeft = Math.sqrt(0.5 * (1 - exhaustPan));
    const exhaustRight = Math.sqrt(0.5 * (1 + exhaustPan));
    const intakeLeft = Math.sqrt(0.5 * (1 - intakePan));
    const intakeRight = Math.sqrt(0.5 * (1 + intakePan));
    const blockLeft = Math.sqrt(0.5 * (1 - blockPan));
    const blockRight = Math.sqrt(0.5 * (1 + blockPan));
    const transmissionLeft = Math.sqrt(0.5 * (1 - transmissionPan));
    const transmissionRight = Math.sqrt(0.5 * (1 + transmissionPan));
    const profileDrive = PROFILE_DRIVE[profile];
    const profileMechanical = PROFILE_MECHANICAL[profile];
    const profilePops = PROFILE_POP[profile];

    if (this.lastThrottleTarget > 0.36 && throttleTarget < 0.07 && rpmTarget > 2050) {
      this.popEnvelope = Math.max(this.popEnvelope, (0.28 + rpmTarget / 9500) * popsLevel * profilePops);
    }
    this.lastThrottleTarget = throttleTarget;
    if (gear !== this.lastGear) {
      this.shiftEnvelope = Math.max(this.shiftEnvelope, 0.28 + transmissionCharacter * 0.54);
      this.lastGear = gear;
    }

    for (let index = 0; index < left.length; index++) {
      this.rpmSmooth += (rpmTarget - this.rpmSmooth) * smoothRpm;
      this.throttleSmooth += (throttleTarget - this.throttleSmooth) * smoothFast;
      this.loadSmooth += (loadTarget - this.loadSmooth) * smoothLoad;
      this.speedSmooth += (speedTarget - this.speedSmooth) * smoothLoad;
      this.brakeSmooth += (brakeTarget - this.brakeSmooth) * smoothFast;
      this.clutchSmooth += (clutchTarget - this.clutchSmooth) * smoothFast;

      const noiseLeft = this.randomLeft();
      const noiseRight = this.randomRight();
      const rpm = Math.max(180, this.rpmSmooth);
      const revHz = rpm / 60;
      const rpmNorm = clampValue((rpm - 650) / 4700, 0, 1);
      const lowIdle = clampValue((1150 - rpm) / 520, 0, 1);
      const roughness = idleRoughness * lowIdle;
      const roughModulation = 1
        + roughness * 0.018 * Math.sin(this.crankPhase * 0.47 + Math.sin(this.crankPhase * 0.091) * 0.9)
        + roughness * noiseLeft * 0.003;
      const firingHz = revHz * 3 * roughModulation;
      const positiveLoad = Math.max(0, this.loadSmooth);
      const overrun = this.throttleSmooth < 0.028 && this.loadSmooth < -0.055 && rpm > 1450;
      const idlePressure = 0.20 + lowIdle * (0.055 + idleRoughness * 0.045);
      const combustionPressure = (idlePressure + 0.80 * Math.pow(this.throttleSmooth, 0.57))
        * (0.76 + positiveLoad * 0.43)
        * profileDrive;
      const fuel = overrun ? 0.035 + popsLevel * 0.015 : 1;
      const limiterFactor = rpm > 5050 ? clampValue(limiter, 0.02, 1) : 1;
      const pressurePulse = this.cylinders.process(
        firingHz,
        combustionPressure,
        roughness,
        fuel,
        limiterFactor,
        noiseLeft,
      );

      if (this.cylinders.fired) {
        this.valveEnvelope += (0.14 + rpmNorm * 0.20) * (0.75 + profile * 0.12);
        if (overrun) {
          this.overrunAccumulator += (0.010 + popsLevel * 0.055) * (0.7 + rpmNorm);
          if (this.overrunAccumulator > 1 || noiseRight > 0.988 - popsLevel * 0.018) {
            this.popEnvelope = Math.max(
              this.popEnvelope,
              (0.18 + 0.55 * popsLevel) * profilePops * (0.72 + rpmNorm * 0.40),
            );
            this.overrunAccumulator = 0;
          }
        } else {
          this.overrunAccumulator *= 0.90;
        }
      }

      this.valveEnvelope *= valveDecay;
      this.shiftEnvelope *= shiftDecay;
      this.popEnvelope *= popDecay;
      this.startEnvelope *= startDecay;

      this.crankPhase += TAU * revHz / sampleRate;
      if (this.crankPhase > TAU) this.crankPhase -= TAU;
      const wheelHz = this.speedSmooth / (TAU * 0.315);
      this.wheelPhase += TAU * wheelHz / sampleRate;
      if (this.wheelPhase > TAU) this.wheelPhase -= TAU;

      const pressureLow = this.pulseLow.process(pressurePulse);
      const pressureCrack = pressurePulse - pressureLow;
      const popExcitation = this.popEnvelope * (0.72 + noiseLeft * 0.18);
      const exhaustDrive = pressurePulse * (0.82 + positiveLoad * 0.34 + this.throttleSmooth * 0.18)
        + popExcitation * 0.62;
      const exhaustModal = this.exhaustBank.process(exhaustDrive);
      const popBody = this.popBank.process(popExcitation);
      const exhaust = (
        exhaustModal * 0.80
        + pressureCrack * (0.14 + exhaustCharacter * 0.20 + profile * 0.035)
        + popBody * popsLevel * 0.72
      ) * exhaustLevel;

      const intakeBand = this.intakeFilter.process((noiseLeft + noiseRight) * 0.5);
      const intakeModal = this.intakeBank.process(pressurePulse * (0.25 + this.throttleSmooth * 0.80));
      const carburetion = intakeBand
        * Math.pow(this.throttleSmooth, 1.10)
        * (0.055 + rpmNorm * 0.095)
        * (0.72 + intakeCharacter * 0.65);
      const intake = (intakeModal * 0.64 + carburetion) * intakeLevel;

      const crankOrder = Math.sin(this.crankPhase) * (0.105 + positiveLoad * 0.035)
        + Math.sin(this.crankPhase * 2 + 0.31) * 0.060
        + Math.sin(this.crankPhase * 3 + 1.16) * (0.025 + rpmNorm * 0.016);
      const camOrder = Math.sin(this.crankPhase * 0.5 + 0.83) * 0.052;
      const valvetrain = this.valveEnvelope * (0.10 + noiseRight * 0.040);
      const pistonSlap = lowIdle * Math.max(0, positiveLoad - 0.12) * Math.sin(this.crankPhase * 2 + 0.9) * 0.045;
      const blockModal = this.blockBank.process(pressurePulse * 0.30 + crankOrder * 0.05);
      const mechanical = (crankOrder + camOrder + valvetrain + pistonSlap + blockModal * 0.62)
        * mechanicalLevel * profileMechanical;

      const absoluteGear = Math.abs(Math.round(gear));
      const ratio = gear < 0 ? 3.10 : absoluteGear > 0 ? GEAR_RATIO[absoluteGear] : 0;
      const meshHz = Math.max(24, wheelHz * ratio * 3.08 * (gear < 0 ? 17 : 13));
      this.gearPhase += TAU * meshHz / sampleRate;
      if (this.gearPhase > TAU) this.gearPhase -= TAU;
      const transmissionLoad = ratio > 0
        ? (0.15 + Math.abs(this.loadSmooth) * 0.55 + this.throttleSmooth * 0.30)
          * clampValue(this.speedSmooth / 5.5, 0, 1)
          * this.clutchSmooth
        : 0;
      const gearMesh = (Math.sin(this.gearPhase) * 0.050 + Math.sin(this.gearPhase * 2 + 0.5) * 0.022)
        * transmissionLoad;
      const reverseWhine = gear < 0
        ? (Math.sin(this.gearPhase * 1.53) * 0.088 + Math.sin(this.gearPhase * 3.06 + 0.2) * 0.033)
          * clampValue(this.speedSmooth / 11, 0, 1)
        : 0;
      const clutchChatter = ratio > 0 && this.clutchSmooth > 0.12 && this.clutchSmooth < 0.88
        ? noiseLeft * (1 - Math.abs(this.clutchSmooth - 0.5) * 2) * Math.max(0, positiveLoad) * 0.035
        : 0;
      const shiftImpact = this.shiftEnvelope
        * (Math.sin(this.gearPhase * 0.17 + HALF_PI) * 0.22 + noiseRight * 0.15);
      const transmission = (gearMesh + reverseWhine + clutchChatter + shiftImpact)
        * (0.42 + transmissionCharacter * 1.08);

      const speedNorm = clampValue(this.speedSmooth / 45, 0, 1.25);
      const roadLeftBand = this.roadFilterLeft.process(noiseLeft);
      const roadRightBand = this.roadFilterRight.process(noiseRight);
      const tireOrderLeft = Math.sin(this.wheelPhase * 11.7 + 0.2) * 0.026
        + Math.sin(this.wheelPhase * 17.9) * 0.013;
      const tireOrderRight = Math.sin(this.wheelPhase * 12.1 + 0.7) * 0.025
        + Math.sin(this.wheelPhase * 18.4 + 0.3) * 0.013;
      const roadLeft = (roadLeftBand * (0.10 + speedNorm * 0.30) + tireOrderLeft) * speedNorm;
      const roadRight = (roadRightBand * (0.10 + speedNorm * 0.30) + tireOrderRight) * speedNorm;
      const windHighLeft = noiseLeft - this.windLowLeft.process(noiseLeft);
      const windHighRight = noiseRight - this.windLowRight.process(noiseRight);
      const windAmount = Math.pow(speedNorm, 1.70) * 0.075;
      const travelLeft = (roadLeft + windHighLeft * windAmount) * roadLevel;
      const travelRight = (roadRight + windHighRight * windAmount) * roadLevel;

      const brakeSpeed = clampValue(this.speedSmooth / 18, 0, 1);
      const brakeBandLeft = this.brakeFilterLeft.process(noiseLeft);
      const brakeBandRight = this.brakeFilterRight.process(noiseRight);
      const brakeFriction = Math.pow(this.brakeSmooth, 1.28) * brakeSpeed;
      const squealGate = brakeFriction
        * Math.max(0, 1 - Math.abs(this.brakeSmooth - 0.46) * 2.2)
        * (0.35 + 0.65 * quality);
      this.brakePhase += TAU * (1760 + this.speedSmooth * 14 + Math.sin(this.wheelPhase * 0.11) * 180) / sampleRate;
      if (this.brakePhase > TAU) this.brakePhase -= TAU;
      const brakeSqueal = this.brakeResonator.process(
        (brakeBandLeft + brakeBandRight) * 0.055 + Math.sin(this.brakePhase) * 0.004,
      ) * squealGate;
      const hardBraking = Math.max(0, -acceleration - 2.8) * 0.030;
      const brakesLeft = (brakeBandLeft * brakeFriction * (0.62 + hardBraking) + brakeSqueal * 1.35) * brakeLevel;
      const brakesRight = (brakeBandRight * brakeFriction * (0.62 + hardBraking) + brakeSqueal * 1.22) * brakeLevel;

      this.starterPhase += TAU * (62 + this.startEnvelope * 38 + rpm * 0.006) / sampleRate;
      if (this.starterPhase > TAU) this.starterPhase -= TAU;
      const starter = this.startEnvelope
        * (Math.sin(this.starterPhase) * 0.074 + Math.sin(this.starterPhase * 2.31) * 0.026 + noiseLeft * 0.025);

      const engineScale = engineLevel * this.shutdownEnvelope * PROFILE_NORMALIZATION[profile];
      let mixedLeft = (
        exhaust * exhaustLeft
        + intake * intakeLeft
        + mechanical * blockLeft
      ) * engineScale;
      let mixedRight = (
        exhaust * exhaustRight
        + intake * intakeRight
        + mechanical * blockRight
      ) * engineScale;
      mixedLeft += transmission * transmissionLeft + travelLeft * (0.70 + width * 0.30) + brakesLeft + starter * 0.66;
      mixedRight += transmission * transmissionRight + travelRight * (0.70 + width * 0.30) + brakesRight + starter * 0.58;

      const mid = (mixedLeft + mixedRight) * 0.5;
      const side = (mixedLeft - mixedRight) * 0.5 * (0.72 + width * 0.58);
      mixedLeft = mid + side;
      mixedRight = mid - side;

      const dcLeft = this.dcLeft.process(mixedLeft * 0.105);
      const dcRight = this.dcRight.process(mixedRight * 0.105);
      const drive = 1.12 + profile * 0.13 + exhaustCharacter * 0.10;
      const outputLeft = softClip(dcLeft, drive);
      const outputRight = softClip(dcRight, drive);
      left[index] = Number.isFinite(outputLeft) ? clampValue(outputLeft, -1, 1) : 0;
      right[index] = Number.isFinite(outputRight) ? clampValue(outputRight, -1, 1) : 0;
    }
    return true;
  }
}

registerProcessor('chevy-250-engine-v2', Chevy250EngineProcessor);
`;

class EngineSoundSynth {
  constructor(getSettings, onStatus = () => {}) {
    this.getSettings = getSettings;
    this.onStatus = onStatus;
    this.context = null;
    this.source = null;
    this.params = null;
    this.masterGain = null;
    this.dryGain = null;
    this.wetGain = null;
    this.cabinLowpass = null;
    this.lowShelf = null;
    this.presence = null;
    this.saturator = null;
    this.compressor = null;
    this.safetyLimiter = null;
    this.started = false;
    this.starting = null;
    this.backend = 'none';
    this.lastGear = 'N';
    this.fallback = null;
    this.saturationDrive = -1;
    this.onStatus('Esperando interacción', 'armed');
  }

  async ensureStarted() {
    if(this.disposed)return false;
    const settings = this.getSettings();
    if (!settings.audio.enabled) return false;
    if (this.started && this.context && this.context.state !== 'closed') {
      const context=this.context;
      if (context.state !== 'running') await context.resume();
      return !this.disposed&&this.context===context&&context.state==='running';
    }
    this.started=false;
    if (this.starting) {
      // iOS may keep the first resume pending. Every new gesture must reach
      // the existing context synchronously, before sharing initialization.
      if(this.context&&this.context.state!=='running'&&this.context.state!=='closed'){
        try{void this.context.resume().catch(()=>{});}catch{}
      }
      return this.starting;
    }
    this.starting = this.startInternal().finally(() => { this.starting = null; });
    return this.starting;
  }

  async startInternal() {
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) {
      this.onStatus('Web Audio no disponible', 'error');
      return false;
    }
    try {
      const context = this.context = new AudioContextCtor({ latencyHint: 'interactive', sampleRate: 48000 });
      await context.resume();
      if(this.disposed||this.context!==context){if(context.state!=='closed')await context.close();return false;}
      this.buildOutputBus();
      try {
        if (globalThis.location?.protocol === 'file:' || !this.context.audioWorklet || typeof AudioWorkletNode === 'undefined') throw Object.assign(new Error('AudioWorklet no disponible'), { expectedFallback: globalThis.location?.protocol === 'file:' });
        const url = URL.createObjectURL(new Blob([ENGINE_WORKLET_SOURCE], { type: 'text/javascript' }));
        try { await context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
        if(this.disposed||this.context!==context)return false;
        const node = new AudioWorkletNode(this.context, 'chevy-250-engine-v2', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          channelCount: 2,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        });
        node.connect(this.cabinLowpass);
        this.source = node;
        this.params = node.parameters;
        this.backend = 'AudioWorklet PTR v2';
        // The physics ignition sequence triggers the start impulse when a session starts.
      } catch (workletError) {
        if(this.disposed)return false;
        if (!workletError?.expectedFallback) console.warn('AudioWorklet no disponible; se usa síntesis nativa avanzada de respaldo.', workletError);
        this.createNativeFallback();
        this.backend = 'Web Audio estéreo de respaldo';
      }
      this.started = true;
      this.applySettings();
      this.onStatus('Activo · ' + this.backend, 'active');
      return true;
    } catch (error) {
      console.warn('No se pudo iniciar el sintetizador de motor.', error);
      this.onStatus('No se pudo activar', 'error');
      try { await this.context?.close(); } catch (_) {}
      this.context = null;
      return false;
    }
  }

  resolveAudioQuality(mode) {
    if (mode === 'high') return 1;
    if (mode === 'efficient') return 0;
    const cores = Number(globalThis.navigator?.hardwareConcurrency) || 4;
    const memory = Number(globalThis.navigator?.deviceMemory) || 4;
    const coarsePointer = globalThis.matchMedia?.('(pointer: coarse)')?.matches === true;
    return cores >= 6 && memory >= 4 && !coarsePointer ? 1 : 0;
  }

  buildOutputBus() {
    const ctx = this.context;
    this.cabinLowpass = ctx.createBiquadFilter();
    this.cabinLowpass.type = 'lowpass';
    this.cabinLowpass.frequency.value = 11800;
    this.cabinLowpass.Q.value = 0.42;

    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = 148;
    this.lowShelf.gain.value = 2.8;

    this.presence = ctx.createBiquadFilter();
    this.presence.type = 'peaking';
    this.presence.frequency.value = 980;
    this.presence.Q.value = 0.74;
    this.presence.gain.value = 1.2;

    this.saturator = ctx.createWaveShaper();
    this.saturator.curve = this.createSaturationCurve(1.65);
    this.saturator.oversample = '2x';

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.normalize = true;
    convolver.buffer = this.createCabinImpulse(ctx);

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -15;
    this.compressor.knee.value = 17;
    this.compressor.ratio.value = 2.8;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;

    this.safetyLimiter = ctx.createDynamicsCompressor();
    this.safetyLimiter.threshold.value = -2.2;
    this.safetyLimiter.knee.value = 0;
    this.safetyLimiter.ratio.value = 20;
    this.safetyLimiter.attack.value = 0.001;
    this.safetyLimiter.release.value = 0.075;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;

    this.cabinLowpass.connect(this.lowShelf).connect(this.presence).connect(this.saturator);
    this.saturator.connect(this.dryGain).connect(this.compressor);
    this.saturator.connect(convolver).connect(this.wetGain).connect(this.compressor);
    this.compressor.connect(this.safetyLimiter).connect(this.masterGain).connect(ctx.destination);
  }

  createSaturationCurve(amount = 1.65) {
    const length = 32768;
    const curve = new Float32Array(length);
    const normalization = Math.tanh(amount) || 1;
    for (let index = 0; index < length; index++) {
      const input = index * 2 / (length - 1) - 1;
      curve[index] = Math.tanh(input * amount) / normalization;
    }
    return curve;
  }

  createCabinImpulse(ctx) {
    const length = Math.floor(ctx.sampleRate * 0.185);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let seed = 0x13579bdf ^ (channel * 0x9e3779b9);
      const random = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return ((seed >>> 0) / 2147483648) - 1;
      };
      for (let index = 0; index < length; index++) {
        const time = index / ctx.sampleRate;
        const earlyDecay = Math.exp(-time * 26);
        const highDamping = Math.exp(-time * 42);
        data[index] = random() * earlyDecay * highDamping * 0.075;
      }
      const reflections = channel === 0
        ? [[0, 0.50], [0.0049, 0.31], [0.0097, -0.24], [0.0168, 0.20], [0.027, -0.13], [0.047, 0.08], [0.071, -0.045]]
        : [[0, 0.48], [0.0054, -0.29], [0.0105, 0.25], [0.0179, -0.18], [0.029, 0.12], [0.050, -0.075], [0.074, 0.042]];
      for (const [time, amplitude] of reflections) {
        const sampleIndex = Math.min(length - 1, Math.floor(time * ctx.sampleRate));
        data[sampleIndex] += amplitude;
      }
    }
    return buffer;
  }

  createNoiseBuffer(seconds = 3) {
    const ctx = this.context;
    const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let seed = 0x2468ace1 ^ (channel * 0x6d2b79f5);
      for (let index = 0; index < data.length; index++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        data[index] = (((seed >>> 0) / 2147483648) - 1) * 0.52;
      }
    }
    return buffer;
  }

  createNativeFallback() {
    const ctx = this.context;
    const bus = ctx.createGain();
    bus.gain.value = 0.62;
    bus.connect(this.cabinLowpass);

    const orderDefinitions = [
      [0.5, 0.020, -0.12, 'sine'],
      [1.0, 0.038, -0.08, 'sine'],
      [2.0, 0.026, 0.02, 'triangle'],
      [3.0, 0.105, 0.18, 'sawtooth'],
      [4.5, 0.032, 0.12, 'sine'],
      [6.0, 0.021, 0.22, 'sine'],
    ];
    const harmonics = orderDefinitions.map(([order, level, pan, type]) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      oscillator.connect(gain).connect(panner).connect(bus);
      oscillator.start();
      return { oscillator, gain, panner, order, level, basePan: pan };
    });

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.createNoiseBuffer();
    noiseSource.loop = true;

    const exhaustFilter = ctx.createBiquadFilter();
    exhaustFilter.type = 'lowpass';
    exhaustFilter.frequency.value = 780;
    exhaustFilter.Q.value = 0.8;
    const exhaustGain = ctx.createGain();
    exhaustGain.gain.value = 0;
    const exhaustPanner = ctx.createStereoPanner();
    exhaustPanner.pan.value = 0.28;
    noiseSource.connect(exhaustFilter).connect(exhaustGain).connect(exhaustPanner).connect(bus);

    const intakeFilter = ctx.createBiquadFilter();
    intakeFilter.type = 'bandpass';
    intakeFilter.frequency.value = 980;
    intakeFilter.Q.value = 0.72;
    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0;
    const intakePanner = ctx.createStereoPanner();
    intakePanner.pan.value = -0.28;
    noiseSource.connect(intakeFilter).connect(intakeGain).connect(intakePanner).connect(bus);

    const roadFilter = ctx.createBiquadFilter();
    roadFilter.type = 'bandpass';
    roadFilter.frequency.value = 210;
    roadFilter.Q.value = 0.48;
    const roadGain = ctx.createGain();
    roadGain.gain.value = 0;
    const roadPanner = ctx.createStereoPanner();
    roadPanner.pan.value = -0.06;
    noiseSource.connect(roadFilter).connect(roadGain).connect(roadPanner).connect(bus);

    const brakeFilter = ctx.createBiquadFilter();
    brakeFilter.type = 'highpass';
    brakeFilter.frequency.value = 900;
    brakeFilter.Q.value = 0.62;
    const brakeGain = ctx.createGain();
    brakeGain.gain.value = 0;
    const brakePanner = ctx.createStereoPanner();
    brakePanner.pan.value = 0.08;
    noiseSource.connect(brakeFilter).connect(brakeGain).connect(brakePanner).connect(bus);

    const gearOscillator = ctx.createOscillator();
    gearOscillator.type = 'sine';
    const gearGain = ctx.createGain();
    gearGain.gain.value = 0;
    const gearPanner = ctx.createStereoPanner();
    gearPanner.pan.value = 0.08;
    gearOscillator.connect(gearGain).connect(gearPanner).connect(bus);
    gearOscillator.start();
    noiseSource.start();

    this.fallback = {
      bus,
      harmonics,
      noiseSource,
      exhaustFilter,
      exhaustGain,
      exhaustPanner,
      intakeFilter,
      intakeGain,
      intakePanner,
      roadFilter,
      roadGain,
      roadPanner,
      brakeFilter,
      brakeGain,
      brakePanner,
      gearOscillator,
      gearGain,
      gearPanner,
    };
  }

  setParam(name, value, timeConstant = 0.025) {
    if (!this.context || !Number.isFinite(value)) return false;
    const param = this.params?.get(name);
    if (!param) return false;
    // Collision acceleration is valid physics, but each audio control has its
    // own nominal range. Preserve the physical telemetry and bound only sound.
    const target = Math.max(param.minValue, Math.min(param.maxValue, value));
    const tau = Number.isFinite(timeConstant) ? Math.max(0, timeConstant) : 0.025;
    const targets = this.paramTargets || (this.paramTargets = new WeakMap());
    const previous = targets.get(param);
    // A repeated identical target already follows the same exponential ramp.
    if (previous?.value === target && previous.tau === tau) return false;
    param.setTargetAtTime(target, this.context.currentTime, tau);
    if (previous) { previous.value = target; previous.tau = tau; }
    else targets.set(param, { value: target, tau });
    return true;
  }

  applySettings() {
    this.cameraMode=null;
    if (!this.context) return;
    const settings = this.getSettings();
    const audio = settings.audio;
    const now = this.context.currentTime;
    const enabled = audio.enabled ? audio.master : 0;
    this.masterGain?.gain.setTargetAtTime(enabled, now, 0.045);

    const cabin = audio.cabin;
    this.dryGain?.gain.setTargetAtTime(0.93 - cabin * 0.09, now, 0.06);
    this.wetGain?.gain.setTargetAtTime(0.025 + cabin * 0.20, now, 0.06);
    this.cabinLowpass?.frequency.setTargetAtTime(15100 - cabin * 5450, now, 0.06);

    const profileIndex = audio.profile === 'race' ? 2 : audio.profile === 'sport' ? 1 : 0;
    const qualityIndex = this.resolveAudioQuality(audio.quality);
    this.lowShelf?.gain.setTargetAtTime(2.9 - profileIndex * 0.55 + audio.exhaustCharacter * 0.35, now, 0.08);
    this.presence?.gain.setTargetAtTime(0.9 + profileIndex * 0.85 + audio.intakeCharacter * 0.55, now, 0.08);
    this.presence?.frequency.setTargetAtTime(900 + profileIndex * 170 + audio.intakeCharacter * 140, now, 0.08);

    const saturationDrive = 1.48 + profileIndex * 0.18 + audio.exhaustCharacter * 0.28;
    if (this.saturator && Math.abs(saturationDrive - this.saturationDrive) > 0.015) {
      this.saturationDrive = saturationDrive;
      this.saturator.curve = this.createSaturationCurve(saturationDrive);
    }

    for (const [name, key] of [
      ['engineLevel', 'engine'],
      ['exhaustLevel', 'exhaust'],
      ['intakeLevel', 'intake'],
      ['mechanicalLevel', 'mechanical'],
      ['roadLevel', 'road'],
      ['brakeLevel', 'brakes'],
    ]) {
      this.setParam(name, audio[key], 0.05);
    }
    this.setParam('profile', profileIndex, 0.05);
    this.setParam('idleRoughness', audio.idleRoughness, 0.05);
    this.setParam('exhaustCharacter', audio.exhaustCharacter, 0.05);
    this.setParam('intakeCharacter', audio.intakeCharacter, 0.05);
    this.setParam('transmissionCharacter', audio.transmissionCharacter, 0.05);
    this.setParam('popsLevel', audio.pops, 0.05);
    this.setParam('stereoWidth', audio.stereoWidth, 0.05);
    this.setParam('quality', qualityIndex, 0.05);
  }

  update(vehicle, controls, gear, {cameraMode='cockpit',physicalRoad=false,ignition=null}={}) {
    if (!this.context || !this.started) return;
    const audio=this.getSettings().audio,now=this.context.currentTime,inside=cameraMode==='cockpit';
    if(Number.isSafeInteger(ignition?.sequence)&&ignition.sequence>0&&ignition.sequence!==this.lastIgnitionSequence){this.lastIgnitionSequence=ignition.sequence;this.source?.port?.postMessage({type:'start',rpm:vehicle.rpm});}
    if(this.cameraMode!==cameraMode){this.cameraMode=cameraMode;const cabin=inside?audio.cabin:0;this.cabinLowpass?.frequency.setTargetAtTime(inside?4600+4400*(1-cabin):14500,now,.18);this.wetGain?.gain.setTargetAtTime(inside?.025+cabin*.18:.012,now,.18);}
    this.setParam('roadLevel',physicalRoad?0:audio.road,.04);this.setParam('brakeLevel',physicalRoad?0:audio.brakes,.04);
    const v7Prefs=globalThis.__asfaltoV7Experience?.preferences?.()||{};
    const v7Mix=engineMix({rpm:vehicle.rpm,load:vehicle.engineLoad||0,throttle:vehicle.effectiveThrottle??controls.throttle,cameraMode,reducedRange:v7Prefs.reducedRange});
    this.setParam('engineLevel',audio.engine*v7Mix.engineLevel*(v7Prefs.engineVolume??1),.08);
    this.setParam('exhaustLevel',audio.exhaust*v7Mix.exhaustLevel,.10);
    this.setParam('intakeLevel',audio.intake*v7Mix.intakeLevel,.10);
    this.setParam('mechanicalLevel',audio.mechanical*v7Mix.mechanicalLevel,.10);
    this.setParam('popsLevel',audio.pops*v7Mix.popsLevel,.10);
    this.setParam('stereoWidth',audio.stereoWidth*v7Mix.stereoWidth,.12);
    for(const field of ['threshold','ratio','knee'])this.compressor?.[field]?.setTargetAtTime(v7Mix.compressor[field],now,.12);
    const numericGear = gear === 'R' ? -1 : gear === 'N' ? 0 : Number(gear) || 0;
    this.setParam('rpm', vehicle.rpm, 0.020);
    this.setParam('throttle', vehicle.effectiveThrottle ?? controls.throttle, 0.014);
    this.setParam('load', vehicle.engineLoad || 0, 0.028);
    this.setParam('speed', Math.abs(vehicle.speedMps || 0), 0.038);
    this.setParam('brake', controls.brake || 0, 0.013);
    this.setParam('accel', vehicle.longitudinalAccel || 0, 0.026);
    this.setParam('clutch', vehicle.clutch || 0, 0.022);
    this.setParam('gear', numericGear, 0.020);
    this.setParam('limiter', vehicle.limiterCut ?? 1, 0.006);

    if (!this.fallback) return;
    const ctx = this.context;
    const profileIndex = audio.profile === 'race' ? 2 : audio.profile === 'sport' ? 1 : 0;
    const revFrequency = Math.max(14, vehicle.rpm / 60);
    const throttle = Math.max(0, Math.min(1, vehicle.effectiveThrottle ?? controls.throttle));
    const load = Math.max(0, vehicle.engineLoad || 0);
    const speed = Math.abs(vehicle.speedMps || 0);
    const profileDrive = [1.0, 1.08, 1.14][profileIndex];
    this.fallback.harmonics.forEach((voice) => {
      voice.oscillator.frequency.setTargetAtTime(revFrequency * voice.order, ctx.currentTime, 0.022);
      const firingEmphasis = voice.order === 3 ? 1.0 : 0.68;
      voice.gain.gain.setTargetAtTime(
        voice.level * firingEmphasis * (0.20 + throttle * 0.76 + load * 0.28)
          * audio.engine * v7Mix.engineLevel * (v7Prefs.engineVolume??1) * profileDrive,
        ctx.currentTime,
        0.026,
      );
      voice.panner.pan.setTargetAtTime(voice.basePan * (0.52 + audio.stereoWidth * 0.70), ctx.currentTime, 0.08);
    });

    this.fallback.exhaustFilter.frequency.setTargetAtTime(
      430 + vehicle.rpm * (0.13 + audio.exhaustCharacter * 0.05),
      ctx.currentTime,
      0.045,
    );
    this.fallback.exhaustGain.gain.setTargetAtTime(
      (0.018 + throttle * 0.11 + load * 0.055) * audio.exhaust * v7Mix.exhaustLevel * (v7Prefs.engineVolume??1) * profileDrive,
      ctx.currentTime,
      0.030,
    );
    this.fallback.intakeFilter.frequency.setTargetAtTime(
      560 + vehicle.rpm * (0.18 + audio.intakeCharacter * 0.04),
      ctx.currentTime,
      0.045,
    );
    this.fallback.intakeGain.gain.setTargetAtTime(
      Math.pow(throttle, 1.12) * (0.025 + vehicle.rpm / 6000 * 0.085) * audio.intake * v7Mix.intakeLevel * (v7Prefs.engineVolume??1),
      ctx.currentTime,
      0.025,
    );
    this.fallback.roadFilter.frequency.setTargetAtTime(130 + speed * 17, ctx.currentTime, 0.05);
    this.fallback.roadGain.gain.setTargetAtTime((physicalRoad?0:Math.pow(Math.min(1.2, speed / 45), 1.25) * 0.085 * audio.road), ctx.currentTime, 0.04);
    this.fallback.brakeFilter.frequency.setTargetAtTime(900 + speed * 32, ctx.currentTime, 0.04);
    this.fallback.brakeGain.gain.setTargetAtTime((physicalRoad?0:(controls.brake || 0) * Math.min(1, speed / 16) * 0.16 * audio.brakes), ctx.currentTime, 0.025);

    const gearRatio = numericGear < 0 ? 3.10 : [0, 2.95, 1.94, 1.34, 1.0, 0.78][Math.abs(numericGear)] || 0;
    const wheelFrequency = speed / (Math.PI * 2 * 0.315);
    const gearFrequency = Math.max(24, wheelFrequency * gearRatio * 3.08 * (numericGear < 0 ? 17 : 13));
    this.fallback.gearOscillator.frequency.setTargetAtTime(gearFrequency, ctx.currentTime, 0.022);
    this.fallback.gearGain.gain.setTargetAtTime(
      gearRatio > 0
        ? Math.min(1, speed / 8) * (0.012 + audio.transmissionCharacter * 0.045) * (numericGear < 0 ? 2.1 : 1)
        : 0,
      ctx.currentTime,
      0.025,
    );
  }

  notifyShift(fromGear, toGear, intensity = 0.72) {
    if (this.source?.port) this.source.port.postMessage({ type: 'shift', fromGear, toGear, intensity });
    if (this.fallback && this.context) {
      const ctx = this.context;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(82, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.115);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.17 * intensity, ctx.currentTime + 0.007);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
      panner.pan.value = 0.08;
      oscillator.connect(gain).connect(panner).connect(this.cabinLowpass);
      oscillator.onended = () => { try { oscillator.disconnect(); } catch {} try { gain.disconnect(); } catch {} try { panner.disconnect(); } catch {} };
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    }
  }

  async setEnabled(enabled) {
    if (!enabled && this.context) {
      this.masterGain?.gain.setTargetAtTime(0, this.context.currentTime, 0.035);
      this.onStatus('Silenciado', 'muted');
      return;
    }
    if (enabled) await this.ensureStarted();
    this.applySettings();
  }

  async dispose() {
    if(this.disposed)return;this.disposed=true;this.started=false;
    this.source?.disconnect();this.source?.port?.close();this.source=null;
    const context=this.context;this.context=null;this.fallback=null;this.params=null;
    for(const key of ['masterGain','dryGain','wetGain','cabinLowpass','lowShelf','presence','saturator','compressor','safetyLimiter']){this[key]?.disconnect();this[key]=null;}
    if(context&&context.state!=='closed')await context.close();
  }

  async suspend() {
    if (this.context?.state === 'running') await this.context.suspend();
  }

  async resume() {
    if (this.getSettings().audio.enabled) await this.ensureStarted();
  }

  getState() {
    return {
      started: this.started,
      backend: this.backend,
      contextState: this.context?.state || 'closed',
      sampleRate: this.context?.sampleRate || 0,
      profile: this.getSettings().audio.profile,
      quality: this.getSettings().audio.quality,
    };
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ENGINE_WORKLET_SOURCE, EngineSoundSynth };
if (typeof globalThis !== 'undefined') Object.assign(globalThis, { ENGINE_WORKLET_SOURCE, EngineSoundSynth });


'use strict';



function createBackgroundEditor({ defaultDataUrl, ui, onChange = () => {} }) {
  const DEFAULT_STATE = Object.freeze({
    enabled: true,
    fit: 'cover',
    opacity: 1,
    zoom: 1,
    positionX: 50,
    positionY: 50,
    source: 'default',
    customDataUrl: '',
  });
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalize = (raw = {}) => ({
    enabled: raw.enabled !== false,
    fit: ['cover', 'contain', 'fill'].includes(raw.fit) ? raw.fit : DEFAULT_STATE.fit,
    opacity: clamp(finite(raw.opacity, DEFAULT_STATE.opacity), 0, 1),
    zoom: clamp(finite(raw.zoom, DEFAULT_STATE.zoom), 0.5, 2.5),
    positionX: clamp(finite(raw.positionX, DEFAULT_STATE.positionX), 0, 100),
    positionY: clamp(finite(raw.positionY, DEFAULT_STATE.positionY), 0, 100),
    source: raw.source === 'custom' && typeof raw.customDataUrl === 'string' && raw.customDataUrl.startsWith('data:image/') ? 'custom' : 'default',
    customDataUrl: typeof raw.customDataUrl === 'string' && raw.customDataUrl.startsWith('data:image/') ? raw.customDataUrl : '',
  });
  let state = normalize(DEFAULT_STATE);
  let customPersistenceAvailable = true;

  function setStatus(message, statusState = '') {
    ui.status.textContent = message;
    ui.status.dataset.state = statusState;
  }

  function readSaved() {
    try {
      const raw = JSON.parse(globalThis.__asfaltoV7Storage.getItem(BACKGROUND_STORAGE_KEY) || 'null');
      if (raw && typeof raw === 'object') state = normalize(raw);
    } catch (error) {
      console.warn('No se pudo restaurar el fondo:', error);
      state = normalize(DEFAULT_STATE);
    }
  }

  function persist({ announce = false } = {}) {
    try {
      globalThis.__asfaltoV7Storage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(state));
      customPersistenceAvailable = true;
      if (announce) setStatus(state.source === 'custom' ? 'Fondo personalizado guardado' : 'Fondo incluido guardado', 'saved');
      return true;
    } catch (error) {
      customPersistenceAvailable = false;
      console.warn('No se pudo guardar el fondo:', error);
      setStatus('Fondo activo sólo durante esta sesión', 'error');
      return false;
    }
  }

  function currentSource() {
    return state.source === 'custom' && state.customDataUrl ? state.customDataUrl : defaultDataUrl;
  }

  function syncUi() {
    ui.enabled.checked = state.enabled;
    ui.fit.value = state.fit;
    ui.opacity.value = String(state.opacity);
    ui.opacityValue.textContent = `${Math.round(state.opacity * 100)}%`;
    ui.zoom.value = String(state.zoom);
    ui.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    ui.positionX.value = String(state.positionX);
    ui.positionXValue.textContent = `${Math.round(state.positionX)}%`;
    ui.positionY.value = String(state.positionY);
    ui.positionYValue.textContent = `${Math.round(state.positionY)}%`;
  }

  function apply({ render = true } = {}) {
    const source = currentSource();
    ui.root.hidden = !state.enabled;
    if (source && ui.image.src !== source) ui.image.src = source;
    ui.image.style.objectFit = state.fit;
    ui.image.style.objectPosition = `${state.positionX}% ${state.positionY}%`;
    ui.image.style.opacity = String(state.opacity);
    ui.image.style.transform = `scale(${state.zoom})`;
    syncUi();
    if (render) onChange();
  }

  function commit(message = 'Fondo actualizado') {
    apply();
    const saved = persist();
    if (saved) setStatus(message, 'saved');
  }

  function resetToDefault({ announce = true, save = true } = {}) {
    state = normalize(DEFAULT_STATE);
    apply();
    if (save) persist();
    if (announce) setStatus('Fondo nocturno incluido restaurado', 'saved');
    return getState();
  }

  function setState(next = {}, { save = true, announce = true } = {}) {
    state = normalize({ ...state, ...(next && typeof next === 'object' ? next : {}) });
    apply();
    if (save) persist();
    if (announce) setStatus(state.enabled ? 'Fondo actualizado' : 'Fondo oculto', save ? 'saved' : '');
    return getState();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('La imagen seleccionada no se pudo abrir.'));
      image.src = dataUrl;
    });
  }

  async function optimizeImage(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Elegí un archivo de imagen válido.');
    const source = await readFileAsDataUrl(file);
    const image = await loadImage(source);
    const maxWidth = 1920;
    const maxHeight = 1080;
    const ratio = Math.min(1, maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    let optimized = canvas.toDataURL('image/webp', 0.86);
    if (!optimized.startsWith('data:image/webp')) optimized = canvas.toDataURL('image/jpeg', 0.86);
    if (optimized.length > 3_600_000) {
      const scale = Math.min(1, 1280 / width, 720 / height);
      const reduced = document.createElement('canvas');
      reduced.width = Math.max(1, Math.round(width * scale));
      reduced.height = Math.max(1, Math.round(height * scale));
      const reducedContext = reduced.getContext('2d', { alpha: false });
      reducedContext.imageSmoothingEnabled = true;
      reducedContext.imageSmoothingQuality = 'high';
      reducedContext.drawImage(canvas, 0, 0, reduced.width, reduced.height);
      optimized = reduced.toDataURL('image/webp', 0.76);
      if (!optimized.startsWith('data:image/webp')) optimized = reduced.toDataURL('image/jpeg', 0.76);
    }
    return optimized;
  }

  ui.enabled.addEventListener('change', () => {
    state.enabled = ui.enabled.checked;
    commit(state.enabled ? 'Fondo visible' : 'Fondo oculto');
  });
  ui.fit.addEventListener('change', () => {
    state.fit = ['cover', 'contain', 'fill'].includes(ui.fit.value) ? ui.fit.value : 'cover';
    commit('Ajuste del fondo guardado');
  });
  ui.opacity.addEventListener('input', () => {
    state.opacity = clamp(finite(ui.opacity.value, 1), 0, 1);
    apply();
  });
  ui.opacity.addEventListener('change', () => commit('Opacidad del fondo guardada'));
  ui.zoom.addEventListener('input', () => {
    state.zoom = clamp(finite(ui.zoom.value, 1), 0.5, 2.5);
    apply();
  });
  ui.zoom.addEventListener('change', () => commit('Zoom del fondo guardado'));
  ui.positionX.addEventListener('input', () => {
    state.positionX = clamp(finite(ui.positionX.value, 50), 0, 100);
    apply();
  });
  ui.positionX.addEventListener('change', () => commit('Encuadre horizontal guardado'));
  ui.positionY.addEventListener('input', () => {
    state.positionY = clamp(finite(ui.positionY.value, 50), 0, 100);
    apply();
  });
  ui.positionY.addEventListener('change', () => commit('Encuadre vertical guardado'));
  ui.upload.addEventListener('click', () => ui.file.click());
  ui.file.addEventListener('change', async () => {
    const [file] = ui.file.files || [];
    if (!file) return;
    ui.upload.disabled = true;
    setStatus('Optimizando imagen…', 'working');
    try {
      const customDataUrl = await optimizeImage(file);
      state = normalize({ ...state, enabled: true, source: 'custom', customDataUrl });
      apply();
      const saved = persist();
      setStatus(saved ? `Fondo personalizado · ${file.name}` : `Fondo de sesión · ${file.name}`, saved ? 'saved' : 'error');
    } catch (error) {
      console.error(error);
      setStatus(error?.message || 'No se pudo cargar el fondo', 'error');
    } finally {
      ui.upload.disabled = false;
      ui.file.value = '';
    }
  });
  ui.useDefault.addEventListener('click', () => resetToDefault());
  ui.remove.addEventListener('click', () => {
    state.enabled = false;
    commit('Fondo oculto');
  });
  ui.image.addEventListener('error', () => {
    if (state.source === 'custom') {
      state = normalize({ ...state, source: 'default', customDataUrl: '' });
      apply();
      persist();
      setStatus('La imagen personalizada falló; se restauró el fondo incluido', 'error');
    }
  });

  readSaved();
  apply({ render: false });
  setStatus(state.source === 'custom' ? 'Fondo personalizado restaurado' : 'Fondo nocturno incluido', 'saved');

  function getState() {
    return {
      enabled: state.enabled,
      fit: state.fit,
      opacity: state.opacity,
      zoom: state.zoom,
      positionX: state.positionX,
      positionY: state.positionY,
      source: state.source,
      customStored: state.source === 'custom' && !!state.customDataUrl && customPersistenceAvailable,
    };
  }

  return {
    getState,
    getDefaultState: () => normalize(DEFAULT_STATE),
    snapshotState: () => ({ state: { ...state }, customPersistenceAvailable }),
    restoreState(snapshot) {
      state = normalize(snapshot?.state || DEFAULT_STATE);
      customPersistenceAvailable = snapshot?.customPersistenceAvailable !== false;
      apply();
      return getState();
    },
    setState, resetToDefault, persist, apply,
  };
}

function createCompositionEditor({ THREE, scene, renderer, targets, ui, compositionState, initialLayout = null, fileStore = null, getCameraMode = () => 'cockpit', onCockpitCalibration = () => {}, onResetAllTransaction = () => ({ ok: true }), onActiveChange = () => {}, onSelectionChange = () => {}, onChange = () => {} }) {
  const targetMap = new Map();
  const objectTargetMap = new Map();
  const defaults = Object.create(null);
  let active = false;
  let selectedId = targets.find((target) => target?.defaultSelected)?.id || targets[0]?.id || null;
  let showGuides = true;
  let dirty = false;
  let saveTimer = 0;

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeDegrees = (value) => {
    const degrees = finite(value, 0);
    const wrapped = ((degrees % 360) + 540) % 360 - 180;
    return wrapped === -180 && degrees > 0 ? 180 : wrapped;
  };
  const captureExact = (object) => ({ position: object.position.toArray(), rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map(THREE.MathUtils.radToDeg), scale: object.scale.toArray() });
  const capture = (object) => ({ position: captureExact(object).position.map(value => Number(value.toFixed(6))), rotation: captureExact(object).rotation.map(value => Number(value.toFixed(6))), scale: captureExact(object).scale.map(value => Number(value.toFixed(6))) });
  const sanitizeTransform = (value, fallback) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
      position: [0, 1, 2].map((index) => {
        const limit = index === 1 ? 2.5 : 4;
        return clamp(finite(source.position?.[index], fallback.position[index]), -limit, limit);
      }),
      rotation: [0, 1, 2].map((index) => normalizeDegrees(finite(source.rotation?.[index], fallback.rotation[index]))),
      scale: [0, 1, 2].map((index) => clamp(finite(source.scale?.[index], fallback.scale[index]), 0.05, 4)),
    };
  };
  const applyTransform = (object, transform) => {
    object.position.fromArray(transform.position);
    object.rotation.set(...transform.rotation.map(THREE.MathUtils.degToRad), 'XYZ');
    object.scale.fromArray(transform.scale);
    object.updateMatrixWorld(true);
  };

  const factoryDefaults = fileStore?.defaults || COMPOSITION_STATE_DEFAULTS;
  for (const descriptor of targets) {
    if (!descriptor?.id) continue;
    const typedTarget = descriptor.kind === 'cockpit-camera'
      ? createTargetDescriptor({ ...descriptor, defaultState: factoryDefaults.camera.cockpit })
      : createTargetDescriptor({
        id: descriptor.id, label: descriptor.label || descriptor.id, kind: 'object',
        capabilities: descriptor.capabilities || { position: true, rotation: true, scale: true, lens: false },
        defaultState: factoryDefaults.transforms[descriptor.id] || captureExact(descriptor.object), getState: () => captureExact(descriptor.object),
        applyState: state => applyTransform(descriptor.object, sanitizeCompositionTransform(state, captureExact(descriptor.object))),
        pickRoots: descriptor.pickRoots || [descriptor.object], availability: descriptor.availability || ((mode) => (mode === 'cockpit' ? { available: true, reason: '' } : { available: false, reason: 'Este objeto interior requiere la vista cockpit' })),
      });
    // Object references are host-only; the reusable descriptor remains typed.
    const target = { ...typedTarget, object: descriptor.object || null, defaultSelected: descriptor.defaultSelected };
    targetMap.set(target.id, target);
    if (target.object) {
      defaults[target.id] = factoryDefaults.transforms[target.id] || capture(target.object);
      target.object.traverse((node) => objectTargetMap.set(node.uuid, target.id));
    }
    const option = document.createElement('option');
    option.value = target.id;
    option.textContent = target.label;
    ui.select.appendChild(option);
  }
  if (!targetMap.has(selectedId)) selectedId = targetMap.keys().next().value || null;

  const selectionBox = new THREE.Box3();
  const selectionHelper = new THREE.Box3Helper(selectionBox, 0xffb75f);
  selectionHelper.name = 'EditorCajaSeleccion';
  selectionHelper.material.depthTest = false;
  selectionHelper.material.transparent = true;
  selectionHelper.material.opacity = 0.9;
  selectionHelper.renderOrder = 1000;
  selectionHelper.visible = false;
  scene.add(selectionHelper);

  const axes = new THREE.Group();
  axes.name = 'EditorEjesXYZ';
  const axisData = [
    [new THREE.Vector3(1, 0, 0), 0xff4d55],
    [new THREE.Vector3(0, 1, 0), 0x43d17b],
    [new THREE.Vector3(0, 0, 1), 0x4d8dff],
  ];
  for (const [direction, color] of axisData) {
    const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(), 1, color, 0.18, 0.08);
    arrow.traverse((node) => {
      if (!node.material) return;
      node.material.depthTest = false;
      node.material.transparent = true;
      node.material.opacity = 0.96;
    });
    arrow.renderOrder = 1001;
    axes.add(arrow);
  }
  axes.visible = false;
  scene.add(axes);

  const numberInputs = [...ui.controls.querySelectorAll('[data-editor-kind][data-editor-axis]')];
  const rangeInputs = [...ui.controls.querySelectorAll('[data-editor-range-kind][data-editor-range-axis]')];
  const axisNames = ['x', 'y', 'z'];

  function setStatus(message, state = '') {
    ui.status.textContent = message;
    ui.status.dataset.state = state;
  }

  function loadSavedLayout() {
    try {
      const raw = initialLayout || JSON.parse(globalThis.__asfaltoV7Storage.getItem(EDITOR_STORAGE_KEY) || 'null');
      if (!raw || ![1, 2, EDITOR_SCHEMA_VERSION].includes(raw.version) || !raw.transforms || typeof raw.transforms !== 'object') return false;
      const migrated = migrateCompositionState(raw);
      const saved = sanitizeCompositionState(raw);
      for (const [id, target] of targetMap) {
        if (target.kind === 'cockpit-camera') {
          target.applyState(saved.camera.cockpit);
          compositionState.setCockpitCalibration(saved.camera.cockpit);
          onCockpitCalibration(compositionState.getState().camera.cockpit);
        } else if (migrated.transforms[id] && target.object) target.applyState(sanitizeCompositionTransform(migrated.transforms[id], defaults[id]));
      }
      setStatus('Composición guardada restaurada', 'saved');
      return true;
    } catch (error) {
      console.warn('No se pudo restaurar la composición:', error);
      setStatus('No se pudo leer el guardado; se usa el diseño original');
      return false;
    }
  }

  function serialize() {
    const transforms = { ...compositionState.getState().transforms };
    for (const [id, target] of targetMap) if (target.object) transforms[id] = target.getState();
    return JSON.parse(serializeCompositionState({ transforms, camera: { cockpit: compositionState.getState().camera.cockpit } }, COCKPIT_BUILD));
  }

  let fileSaveSequence = 0, fileSavesPending = 0, lastFileSnapshot = null;
  function persistFile(snapshot, { announce = true, immediate = false } = {}) {
    if (!fileStore?.enabled) return;
    lastFileSnapshot = snapshot;
    const sequence = ++fileSaveSequence;
    fileSavesPending++;
    if (announce) setStatus('Guardando archivo del cockpit…', 'dirty');
    void fileStore.save(snapshot, { immediate }).then(result => {
      fileSavesPending--;
      if (sequence !== fileSaveSequence || dirty) return;
      if (result.ok) {
        ui.status.title = result.path || '';
        if (announce) setStatus('Guardado en cockpit-layout.json', 'saved');
      } else {
        dirty = true;
        if (announce) setStatus('No se pudo guardar el archivo · tocá Guardar para reintentar', 'error');
        ui.status.title = result.error || '';
      }
    });
  }

  function saveNow({ announce = true, immediate = false } = {}) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    const snapshot = serialize();
    let localSaved = false;
    try {
      globalThis.__asfaltoV7Storage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(snapshot));
      localSaved = true;
      dirty = false;
      if (announce && !fileStore?.enabled) setStatus('Composición guardada en este dispositivo', 'saved');
    } catch (error) {
      if (announce && !fileStore?.enabled) setStatus('El navegador bloqueó el guardado local', 'error');
    }
    if (fileStore?.enabled) { dirty = false; persistFile(snapshot, { announce, immediate }); }
    return localSaved || fileStore?.enabled === true;
  }

  function scheduleSave() {
    dirty = true;
    setStatus('Cambios pendientes · guardado automático…', 'dirty');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveNow(), 420);
  }

  function selectedTarget() { return selectedId ? targetMap.get(selectedId) || null : null; }

  function selectedAvailability() {
    const target = selectedTarget();
    if (!target) return { available: false, reason: 'No hay objeto seleccionado' };
    const availability = target.availability(getCameraMode()) || {};
    return {
      available: availability.available !== false,
      reason: availability.available === false ? (availability.reason || 'No disponible en esta vista') : '',
    };
  }

  function fieldValue(kind, axis) {
    const target = selectedTarget();
    if (!target) return 0;
    if (target.kind === 'cockpit-camera') {
      const current = target.getState();
      const state = { ...current, positionOffsetM: [...current.positionOffsetM], rotationOffsetDeg: [...current.rotationOffsetDeg] };
      if (kind === 'position') return state.positionOffsetM[axisNames.indexOf(axis)] || 0;
      if (kind === 'rotation') return state.rotationOffsetDeg[axisNames.indexOf(axis)] || 0;
      return 1;
    }
    const state = target.getState();
    if (kind === 'position') return state.position[axisNames.indexOf(axis)];
    if (kind === 'scale') return state.scale[axisNames.indexOf(axis)];
    return state.rotation[axisNames.indexOf(axis)];
  }

  function syncFields() {
    const target = selectedTarget();
    if (!target) return;
    const available = selectedAvailability();
    const controlsEnabled = available.available !== false;
    const cameraTarget = target.kind === 'cockpit-camera';
    const capabilities = target.capabilities;
    if (ui.lockScale) { ui.lockScale.disabled = !controlsEnabled || !capabilities.scale; ui.lockScale.setAttribute('aria-disabled', String(ui.lockScale.disabled)); }
    ui.resetElement.disabled = !controlsEnabled;
    ui.resetElement.setAttribute('aria-disabled', String(!controlsEnabled));
    const rotationNames = cameraTarget ? ['Pitch', 'Yaw', 'Roll'] : ['X', 'Y', 'Z'];
    const rotationLimits = cameraTarget ? [[-45, 45], [-70, 70], [-30, 30]] : [[-180, 180], [-180, 180], [-180, 180]];
    ui.select.value = selectedId;
    ui.availability.hidden = controlsEnabled;
    ui.availability.textContent = controlsEnabled ? '' : (available.reason || 'No disponible en esta vista');
    ui.availability.dataset.state = controlsEnabled ? '' : 'unavailable';
    ui.cameraLens.hidden = !cameraTarget || !capabilities.lens;
    for (const [group, enabled] of [[ui.positionGroup, capabilities.position], [ui.rotationGroup, capabilities.rotation], [ui.scaleGroup, capabilities.scale && !cameraTarget]]) {
      group.classList.toggle('editor-capability-hidden', !enabled); group.hidden = !enabled;
    }
    if (ui.cameraLens) ui.cameraLens.querySelectorAll('input,select').forEach(input => { input.disabled = !controlsEnabled; input.setAttribute('aria-disabled', String(!controlsEnabled)); });
    if (cameraTarget) {
      const cameraState = target.getState();
      const preset = ui.cameraLens?.querySelector('select');
      if (preset) preset.value = cameraState.lensMode;
      if (ui.cameraFocalLength) ui.cameraFocalLength.value = String(cameraState.focalLengthMm);
    }
    for (const input of numberInputs) {
      const kind = input.dataset.editorKind;
      const axis = input.dataset.editorAxis;
      if (kind === 'rotation') {
        const index = axisNames.indexOf(axis);
        const [minimum, maximum] = rotationLimits[index];
        input.min = String(minimum); input.max = String(maximum);
        const axisLabel = input.closest('.editor-axis-row')?.querySelector('b');
        if (axisLabel) axisLabel.textContent = rotationNames[index];
        input.setAttribute('aria-label', `${rotationNames[index]} de rotación`);
      }
      input.value = fieldValue(kind, axis).toFixed(kind === 'rotation' ? 1 : 3);
      input.disabled = !controlsEnabled || !capabilities[kind] || (target.kind === 'cockpit-camera' && kind === 'scale');
      input.setAttribute('aria-disabled', String(input.disabled));
    }
    for (const input of rangeInputs) {
      const kind = input.dataset.editorRangeKind;
      const axis = input.dataset.editorRangeAxis;
      if (kind === 'rotation') {
        const index = axisNames.indexOf(axis);
        const [minimum, maximum] = rotationLimits[index];
        input.min = String(minimum); input.max = String(maximum);
        const axisLabel = input.closest('.editor-axis-row')?.querySelector('b');
        if (axisLabel) axisLabel.textContent = rotationNames[index];
        input.setAttribute('aria-label', `${rotationNames[index]} de rotación deslizante`);
      }
      input.value = String(fieldValue(kind, axis));
      input.disabled = !controlsEnabled || !capabilities[kind] || (target.kind === 'cockpit-camera' && kind === 'scale');
      input.setAttribute('aria-disabled', String(input.disabled));
    }
  }

  function setSelected(id, { announce = true } = {}) {
    if (!targetMap.has(id)) return false;
    selectedId = id;
    syncFields();
    updateGuides();
    if (announce) setStatus(`${targetMap.get(id).label} seleccionado`);
    onSelectionChange(selectedId, targetMap.get(selectedId));
    onChange();
    return true;
  }

  function applyField(kind, axis, rawValue) {
    const target = selectedTarget();
    if (!target || !axisNames.includes(axis)) return;
    if (target.availability(getCameraMode()).available === false || !target.capabilities[kind]) return;
    if (target.kind === 'cockpit-camera') {
      const current = target.getState();
      const state = { ...current, positionOffsetM: [...current.positionOffsetM], rotationOffsetDeg: [...current.rotationOffsetDeg] };
      const index = axisNames.indexOf(axis);
      if (kind === 'position') state.positionOffsetM[index] = finite(rawValue, state.positionOffsetM[index]);
      else if (kind === 'rotation') state.rotationOffsetDeg[index] = finite(rawValue, state.rotationOffsetDeg[index]);
      else return;
      target.applyState(state);
      compositionState.setCockpitCalibration(state);
      onCockpitCalibration(compositionState.getState().camera.cockpit);
      syncFields(); scheduleSave(); onChange(); return;
    }
    const state = target.getState();
    const index = axisNames.indexOf(axis);
    if (kind === 'position') state.position[index] = clamp(finite(rawValue, state.position[index]), axis === 'y' ? -2.5 : -4, axis === 'y' ? 2.5 : 4);
    else if (kind === 'rotation') state.rotation[index] = normalizeDegrees(rawValue);
    else if (kind === 'scale') { const value = clamp(finite(rawValue, state.scale[index]), 0.05, 4); if (ui.lockScale?.checked) state.scale = [value, value, value]; else state.scale[index] = value; }
    else return;
    target.applyState(state);
    syncFields();
    updateGuides();
    scheduleSave();
    onChange();
  }

  function resetElement() {
    const target = selectedTarget();
    if (!target || target.availability(getCameraMode()).available === false) return;
    if (target.kind === 'cockpit-camera') {
      target.reset();
      compositionState.setCockpitCalibration(target.getState());
      onCockpitCalibration(compositionState.getState().camera.cockpit);
      syncFields(); scheduleSave(); setStatus(`${target.label} restablecido`, 'dirty'); onChange(); return;
    }
    target.reset();
    syncFields();
    updateGuides();
    scheduleSave();
    setStatus(`${target.label} restablecido`, 'dirty');
    onChange();
  }

  function resetAll() {
    const wasDirty = dirty;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    dirty = false;
    const previousTransforms = Object.fromEntries([...targetMap].filter(([, target]) => target.object).map(([id, target]) => [id, target.getState()]));
    const resetResult = onResetAllTransaction();
    if (!resetResult?.ok) {
      for (const [id, transform] of Object.entries(previousTransforms)) targetMap.get(id).applyState(transform);
      dirty = wasDirty;
      if (wasDirty) saveTimer = window.setTimeout(() => saveNow(), 420);
      setStatus(`No se pudo restablecer: ${resetResult?.error || 'guardado local bloqueado'}`, 'error');
      return false;
    }
    for (const [id, target] of targetMap) {
      if (target.kind === 'cockpit-camera') {
        target.reset();
        compositionState.setCockpitCalibration(target.getState());
        onCockpitCalibration(compositionState.getState().camera.cockpit);
      } else target.reset();
    }
    syncFields();
    updateGuides();
    setStatus('Todos los elementos fueron restablecidos', 'saved');
    persistFile(serialize());
    onChange();
    return true;
  }

  function setActive(next) {
    const enabled = !!next;
    if (active === enabled) return active;
    active = enabled;
    ui.controls.hidden = !active;
    ui.toggle.classList.toggle('active', active);
    ui.toggle.setAttribute('aria-pressed', String(active));
    ui.toggle.querySelector('em').textContent = active ? 'Salir' : 'Entrar';
    ui.settingsPanel.classList.toggle('editor-active', active);
    renderer.domElement.classList.toggle('editor-mode', active);
    document.body.classList.toggle('editor-mode-active', active);
    if (!active) {
      renderer.domElement.classList.remove('editor-hit');
      if (dirty) saveNow();
    } else {
      syncFields();
      setStatus(`${selectedTarget()?.label || 'Elemento'} seleccionado`);
    }
    updateGuides();
    onActiveChange(active);
    onChange();
    return active;
  }

  function availablePickRoots() {
    return [...targetMap.values()]
      .filter((target) => target.object && target.availability(getCameraMode()).available !== false)
      .flatMap((target) => target.pickRoots);
  }

  function pick(raycaster) {
    if (selectedAvailability().available === false) return null;
    const roots = availablePickRoots();
    const hits = raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node) {
        const id = objectTargetMap.get(node.uuid);
        if (id) return id;
        node = node.parent;
      }
    }
    return null;
  }

  function updateGuides() {
    const target = selectedTarget();
    const visible = active && showGuides && !!target?.object && target.availability(getCameraMode()).available !== false;
    selectionHelper.visible = visible;
    axes.visible = visible;
    if (!visible) return;
    target.object.updateWorldMatrix(true, true);
    selectionBox.setFromObject(target.object);
    if (selectionBox.isEmpty()) {
      selectionHelper.visible = false;
      axes.visible = false;
      return;
    }
    const size = selectionBox.getSize(new THREE.Vector3());
    const maximum = Math.max(size.x, size.y, size.z, 0.08);
    target.object.getWorldPosition(axes.position);
    target.object.getWorldQuaternion(axes.quaternion);
    axes.scale.setScalar(clamp(maximum * 0.62, 0.075, 0.32));
    axes.updateMatrixWorld(true);
    selectionHelper.updateMatrixWorld(true);
  }

  ui.toggle.addEventListener('click', () => setActive(!active));
  ui.select.addEventListener('change', () => setSelected(ui.select.value));
  ui.showGuides.addEventListener('change', () => {
    showGuides = ui.showGuides.checked;
    updateGuides();
    onChange();
  });
  ui.lockScale?.addEventListener('change', () => {
    const target = selectedTarget();
    if (ui.lockScale.checked && target?.object && target.capabilities.scale && target.availability(getCameraMode()).available !== false) {
      const state = target.getState();
      const uniform = clamp(finite(state.scale[0], 1), 0.05, 4);
      target.applyState({ ...state, scale: [uniform, uniform, uniform] });
      syncFields();
      updateGuides();
      scheduleSave();
      onChange();
    }
  });
  for (const input of numberInputs) {
    input.addEventListener('input', () => applyField(input.dataset.editorKind, input.dataset.editorAxis, input.value));
    input.addEventListener('change', () => applyField(input.dataset.editorKind, input.dataset.editorAxis, input.value));
  }
  for (const input of rangeInputs) {
    input.addEventListener('input', () => applyField(input.dataset.editorRangeKind, input.dataset.editorRangeAxis, input.value));
  }
  ui.cameraLens?.querySelector('select')?.addEventListener('change', (event) => {
    const target = selectedTarget();
    if (target?.kind !== 'cockpit-camera' || !target.capabilities.lens || target.availability(getCameraMode()).available === false) return;
    const next = { ...target.getState(), lensMode: event.target.value };
    target.applyState(next); compositionState.setCockpitCalibration(next); onCockpitCalibration(compositionState.getState().camera.cockpit); scheduleSave(); syncFields();
  });
  ui.cameraFocalLength?.addEventListener('change', () => {
    const target = selectedTarget();
    if (target?.kind !== 'cockpit-camera' || !target.capabilities.lens || target.availability(getCameraMode()).available === false) return;
    const next = { ...target.getState(), lensMode: 'manual', focalLengthMm: Number(ui.cameraFocalLength.value) };
    target.applyState(next); compositionState.setCockpitCalibration(next); onCockpitCalibration(compositionState.getState().camera.cockpit); scheduleSave(); syncFields();
  });
  ui.save.addEventListener('click', () => saveNow());
  ui.resetElement.addEventListener('click', resetElement);
  ui.resetAll.addEventListener('click', resetAll);
  function flushFileOnClose() {
    if (dirty) saveNow({ announce: false, immediate: true });
    else if (fileSavesPending && lastFileSnapshot) persistFile(lastFileSnapshot, { announce: false, immediate: true });
  }
  runtimeEvents.listen(window,'pagehide', flushFileOnClose);

  const restored = loadSavedLayout();
  ui.select.value = selectedId || '';
  ui.showGuides.checked = true;
  if (ui.lockScale) ui.lockScale.checked = true;
  syncFields();
  onSelectionChange(selectedId, selectedTarget());
  if (!restored) setStatus('Diseño original cargado');
  if (fileStore?.enabled) {
    const snapshot = serialize();
    // A newly created default file must not supersede an older browser's genuine edits.
    snapshot.updatedAt = initialLayout?.updatedAt || '1970-01-01T00:00:00.000Z';
    persistFile(snapshot);
  } else if (fileStore?.error) {
    setStatus('Archivo no disponible · guardado del navegador activo', 'error');
    ui.status.title = fileStore.error;
  }

  return {
    isActive: () => active,
    renderOverlays: [selectionHelper, axes],
    getSelectedId: () => selectedId,
    setActive,
    select: setSelected,
    pick,
    updateGuides,
    refreshAvailability() { syncFields(); updateGuides(); },
    save: saveNow,
    resetElement,
    resetAll,
    getState() {
      const availability = selectedAvailability();
      return {
        active,
        selectedId,
        availability,
        pickEnabled: active && availability.available && availablePickRoots().length > 0,
        showGuides,
        dirty,
        stored: serialize(),
      };
    },
    setTransform(id, transform, { save = true } = {}) {
      const target = targetMap.get(id);
      if (!target) return false;
      if (target.kind === 'cockpit-camera') throw new TypeError('cockpit-camera requires setCockpitCameraCalibration');
      const current = target.getState();
      const next = { ...current };
      for (const kind of ['position', 'rotation', 'scale']) if (target.capabilities[kind] && transform?.[kind] !== undefined) next[kind] = transform[kind];
      target.applyState(sanitizeCompositionTransform(next, current));
      if (id === selectedId) syncFields();
      updateGuides();
      if (save) scheduleSave();
      onChange();
      return true;
    },
    setTargetState(id, state, options = {}) {
      if (id === 'cockpit-camera') return this.setCockpitCameraCalibration(state, options);
      return this.setTransform(id, state, options);
    },
    setCockpitCameraCalibration(state, { save = true } = {}) {
      const target = targetMap.get('cockpit-camera');
      if (!target) return false;
      target.applyState(state);
      compositionState.setCockpitCalibration(state);
      onCockpitCalibration(compositionState.getState().camera.cockpit);
      if (selectedId === 'cockpit-camera') syncFields();
      if (save) scheduleSave();
      onChange();
      return true;
    },
  };
}

function normalizeGameSettings(raw = {}) {
  const settings = { ...DEFAULT_GAME_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  const finite = (value, fallback, min, max) => {
    const numeric = Number(value);
    return clamp(Number.isFinite(numeric) ? numeric : fallback, min, max);
  };
  settings.transmissionMode = settings.transmissionMode === 'automatic' ? 'automatic' : 'manual';
  settings.autoAggression = finite(settings.autoAggression, DEFAULT_GAME_SETTINGS.autoAggression, 0, 1);
  settings.soundEnabled = settings.soundEnabled !== false;
  settings.audioProfile = ['original', 'sport', 'race'].includes(settings.audioProfile) ? settings.audioProfile : 'original';
  settings.idleRoughness = finite(settings.idleRoughness, DEFAULT_GAME_SETTINGS.idleRoughness, 0, 1);
  settings.exhaustCharacter = finite(settings.exhaustCharacter, DEFAULT_GAME_SETTINGS.exhaustCharacter, 0, 1);
  settings.intakeCharacter = finite(settings.intakeCharacter, DEFAULT_GAME_SETTINGS.intakeCharacter, 0, 1);
  settings.transmissionCharacter = finite(settings.transmissionCharacter, DEFAULT_GAME_SETTINGS.transmissionCharacter, 0, 1);
  settings.popsLevel = finite(settings.popsLevel, DEFAULT_GAME_SETTINGS.popsLevel, 0, 1);
  settings.stereoWidth = finite(settings.stereoWidth, DEFAULT_GAME_SETTINGS.stereoWidth, 0, 1);
  settings.audioQuality = ['auto', 'high', 'efficient'].includes(settings.audioQuality) ? settings.audioQuality : 'auto';
  settings.masterVolume = finite(settings.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume, 0, 1);
  settings.engineVolume = finite(settings.engineVolume, DEFAULT_GAME_SETTINGS.engineVolume, 0, 1.25);
  settings.exhaustVolume = finite(settings.exhaustVolume, DEFAULT_GAME_SETTINGS.exhaustVolume, 0, 1.25);
  settings.intakeVolume = finite(settings.intakeVolume, DEFAULT_GAME_SETTINGS.intakeVolume, 0, 1.25);
  settings.mechanicalVolume = finite(settings.mechanicalVolume, DEFAULT_GAME_SETTINGS.mechanicalVolume, 0, 1.25);
  settings.roadVolume = finite(settings.roadVolume, DEFAULT_GAME_SETTINGS.roadVolume, 0, 1.25);
  settings.brakeVolume = finite(settings.brakeVolume, DEFAULT_GAME_SETTINGS.brakeVolume, 0, 1.25);
  settings.cabinAmount = finite(settings.cabinAmount, DEFAULT_GAME_SETTINGS.cabinAmount, 0, 1);
  settings.steeringSensitivity = finite(settings.steeringSensitivity, DEFAULT_GAME_SETTINGS.steeringSensitivity, 0.55, 1.6);
  settings.pedalResponse = finite(settings.pedalResponse, DEFAULT_GAME_SETTINGS.pedalResponse, 0.65, 1.45);
  settings.brakeStrength = finite(settings.brakeStrength, DEFAULT_GAME_SETTINGS.brakeStrength, 0.55, 1.55);
  settings.shiftSpeed = finite(settings.shiftSpeed, DEFAULT_GAME_SETTINGS.shiftSpeed, 0.65, 1.45);
  settings.graphicsQuality = ['auto', 'high', 'balanced', 'eco'].includes(settings.graphicsQuality) ? settings.graphicsQuality : 'auto';
  return settings;
}

function loadGameSettings() {
  try {
    return normalizeGameSettings(JSON.parse(globalThis.__asfaltoV7Storage.getItem(SETTINGS_STORAGE_KEY) || '{}'));
  } catch {
    return normalizeGameSettings();
  }
}

function saveGameSettings(settings) {
  try { globalThis.__asfaltoV7Storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

let modularHostInitialization = null;
let bootFailureDisposer = () => false;
let stopDrivingFrame=null;
try {
  if(runtimeDeviceProfile.phone)mobileTextureQuality=loadGameSettings().graphicsQuality;
  const THREE = await loadThree();
  const chevyV3PayloadNode = document.getElementById('chevy-v3-payload');
  if (!chevyV3PayloadNode) throw new Error('No se encontró el modelo autocontenido Chevy V3.');
  const chevyV3Bytes = chevyV3PayloadNode.dataset.encoding === 'external-url' ? await globalThis.AsfaltoV6AssetCore.readExternalPayload(chevyV3PayloadNode) : await gunzipBase64(chevyV3PayloadNode.textContent);
  const chevyV3Template = await compactGlbToObject(THREE, chevyV3Bytes, 'Chevy V3');
  chevyV3Template.name = 'Chevy_V3_Template';
  window.__chevyV3Template = chevyV3Template;
  window.__asfaltoLoadVehicleModel=async(url,label,signal)=>{globalThis.__asfaltoPhoneLoad?.stage('Cargando exterior: '+label);const response=await fetch(url,{signal,credentials:'same-origin'});if(!response.ok)throw new Error(label+': HTTP '+response.status);const bytes=await decodeVehicleTransport(new Uint8Array(await response.arrayBuffer()),signal);if(signal?.aborted)throw signal.reason;globalThis.__asfaltoPhoneLoad?.stage('Decodificando exterior: '+label);return globalThis.AsfaltoV5GlbCore.completeGlbToObject(THREE,bytes,label,{parseGlb,makeAttribute,textureFromInfo,meshoptDecoder:MeshoptDecoder});};
  window.__chevyV3ModelInfo = Object.freeze({ source: 'Referencias/Chevy v3.glb', bytes: chevyV3Bytes.byteLength, embedded: true });
  chevyV3PayloadNode.textContent = '';
  window.__chevyV6Three = THREE;
  window.__chevyThreeLoadError = null;
  window.dispatchEvent(new CustomEvent('chevy-three-ready', { detail: THREE }));
  // Publish the exact shared Three/template for home before any cockpit/race preparation.
  const deferredStartupAssets = await startupDemand.run(async ({signal,stage}) => {
    stage('Preparando física determinista…',0,2);
    await globalThis.__asfaltoEngineBootstrap.physics({signal});
    stage('Cargando recursos del cockpit…',0,2);
    const fullPayload = {}; // Original PC parts stream independently and losslessly on demand.
    stage('Cargando trazado inicial…',1,2);
    const routeNode = document.getElementById('asfalto-v5-dos-lagos-route');
    const routeBytes = routeNode.dataset.encoding === 'external-url' ? await readDeferredPayload(routeNode,signal) : await globalThis.AsfaltoV5PayloadCore.decodePayloadById(document,'asfalto-v5-dos-lagos-route',gunzipBase64);
    if(signal.aborted)throw signal.reason;
    const route=JSON.parse(new TextDecoder().decode(routeBytes));
    stage('Construyendo cockpit y preparando controles…');
    return {fullPayload,route};
  });
  Object.assign(payload,deferredStartupAssets.fullPayload);
  delete payload.threeCoreGz;delete payload.threeModuleGz;delete payload.backgroundPngDataUrl;delete payload.rearviewPngDataUrl;
  DOS_LAGOS_ROUTE_DATA=deferredStartupAssets.route;
  setLoading('Creando cockpit…');
  let gameSettings = loadGameSettings();
  mobileTextureQuality=gameSettings.graphicsQuality;
  const bootRenderGate=createBootRenderGate(runtimeDeviceProfile.phone);
  let firstPhoneFrame=runtimeDeviceProfile.phone;
  const markFirstFrame=label=>{if(firstPhoneFrame)globalThis.__asfaltoPhoneLoad?.stage(label);};
  const backgroundEditor = createBackgroundEditor({
    defaultDataUrl: EMBEDDED_BACKGROUND_DATA_URL,
    ui: backgroundUi,
    onChange() {
      if (typeof renderFrame === 'function') renderFrame();
    },
  });
  const engineSoundSettings = () => ({
    audio: {
      enabled: gameSettings.soundEnabled && !document.hidden && !document.body.classList.contains('v6-menu-open') && !document.body.classList.contains('an-intro-open') && !document.body.classList.contains('an-race-paused'),
      profile: gameSettings.audioProfile,
      idleRoughness: gameSettings.idleRoughness,
      exhaustCharacter: gameSettings.exhaustCharacter,
      intakeCharacter: gameSettings.intakeCharacter,
      transmissionCharacter: gameSettings.transmissionCharacter,
      pops: gameSettings.popsLevel,
      stereoWidth: gameSettings.stereoWidth,
      quality: gameSettings.audioQuality,
      master: gameSettings.masterVolume,
      engine: gameSettings.engineVolume,
      exhaust: gameSettings.exhaustVolume,
      intake: gameSettings.intakeVolume,
      mechanical: gameSettings.mechanicalVolume,
      road: gameSettings.roadVolume,
      brakes: gameSettings.brakeVolume,
      cabin: gameSettings.cabinAmount,
    },
  });
  let audioStatus = { message: 'Esperando interacción', state: 'armed' };
  const engineSound = new EngineSoundSynth(engineSoundSettings, (message, state = 'armed') => {
    audioStatus = { message, state };
    audioStatusEl.textContent = message;
    audioStatusEl.dataset.state = state;
  });

  const renderer = createOwnedRenderer(THREE,{
    antialias: !runtimeDeviceProfile.phone,
    logarithmicDepthBuffer: true,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  bootFailureDisposer=()=>disposeAll([()=>renderer.dispose(),()=>engineSound.dispose()],'Inicialización del renderer');
  let currentFrameBudget=null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, runtimeDeviceProfile.phone ? 1.15 : 1.5));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  renderer.transmissionResolutionScale = runtimeDeviceProfile.phone ? .5 : 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const emptyInstanceDrawGuard=installEmptyInstanceDrawGuard(renderer,{enabled:()=>!visualPrecompileInProgress});
  const auxiliaryCaptureSchedule=createAuxiliaryCaptureSchedule();
  const opaqueTransmissionReuse=createOpaqueTransmissionReuse(THREE,{renderer,enabled:!runtimeDeviceProfile.phone});
  runtimeEvents.listen(renderer.domElement,'webglcontextlost',()=>globalThis.__asfaltoPhoneLoad?.stage('Contexto gráfico perdido'));
  renderer.domElement.setAttribute('aria-label', 'Cockpit Chevy interactivo en 3D');
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  bootFailureDisposer=()=>disposeAll([()=>snapshotSceneResources(scene,{borrowedRoots:[chevyV3Template]}).dispose(),()=>renderer.dispose(),()=>scene.clear(),()=>engineSound.dispose()],'Inicialización de la escena');
  scene.environment = makeEnvironment(THREE);

  function createChevyV3Instance(name, targetLength = 4.95) {
    const source = chevyV3Template.clone(true);
    const root = new THREE.Group();
    root.name = name;
    root.add(source);
    root.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(root);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    root.scale.setScalar(targetLength / Math.max(initialSize.x, initialSize.z, 0.001));
    root.updateMatrixWorld(true);
    const normalizedBox = new THREE.Box3().setFromObject(root);
    const center = normalizedBox.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.y -= normalizedBox.min.y;
    root.position.z -= center.z;
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return root;
  }

  const raceChevyPhysicalRoot = new THREE.Group();
  raceChevyPhysicalRoot.name = 'ChevyV6PhysicalBody';
  const raceChevyV3 = new THREE.Group();
  raceChevyV3.name = 'Chevy_V3_Race_Editable';
  const raceChevyV3Model = createChevyV3Instance('Chevy_V3_Race_Model');
  // Race-only authored stance, calibrated against all four real contact planes.
  // Keep the Auto editor's -.72 m / PI defaults and the grounded garage intact.
  raceChevyV3Model.position.y += 0.16;
  const raceChevyWheelVisualRig = createChevyWheelVisualRig(THREE, raceChevyV3Model);
  const racePaint = createChevyPaintController(THREE, raceChevyV3Model, { color:globalThis.__chevyPaintColor || '#d66a24' });
  let raceChevyPresentation=null,cockpitFrontPaint=null,cockpitHoodPaintMaterial=null,authoredMirrors=null,authoredControlMounts=null,mobileDrivingControls=null;
  const updateRacePaint = event => {const hex=event.detail?.hex;if(typeof hex!=='string'||!/^#[a-f\d]{6}$/i.test(hex))return;racePaint.setColor(hex);raceChevyPresentation?.setPaintColor(hex);cockpitFrontPaint?.setColor(hex);cockpitHoodPaintMaterial?.color.set(hex);};
  runtimeEvents.listen(window,'chevy:paint-change', updateRacePaint);
  window.__chevyWheelVisualRig = raceChevyWheelVisualRig;
  function disposeRaceChevyWheels() {
    window.removeEventListener('chevy:paint-change', updateRacePaint);
    if(window.__asfaltoVehiclePresentations?.chevy===raceChevyPresentation)delete window.__asfaltoVehiclePresentations;
    mobileDrivingControls?.dispose();authoredControlMounts?.dispose();authoredMirrors?.dispose();authoredControlMounts=null;authoredMirrors=null;raceChevyPresentation?.dispose();raceChevyPresentation=null;
    cockpitFrontPaint?.dispose();cockpitFrontPaint=null;cockpitHoodPaintMaterial=null;
    racePaint.dispose();
    const released = raceChevyWheelVisualRig.dispose();
    if (window.__chevyWheelVisualRig === raceChevyWheelVisualRig) delete window.__chevyWheelVisualRig;
    return released;
  }
  // Own these geometries immediately: cockpit assets can fail before the
  // modular world/roof shutdown owner is installed later in initialization.
  const disposeBeforeRaceChevyWheels = bootFailureDisposer;
  bootFailureDisposer = () => {
    try { return disposeBeforeRaceChevyWheels(); } finally { disposeRaceChevyWheels(); }
  };
  // Physics, route frames and cameras define vehicle forward as local +X.
  // Chevy v3 is lengthwise on X but its nose is authored toward -X.
  raceChevyV3.rotation.y = Math.PI;
  raceChevyV3.position.set(0, -0.72, 0);
  raceChevyV3.scale.set(1, 1, 1);
  raceChevyV3.add(raceChevyV3Model);
  raceChevyV3.visible = false;
  raceChevyPhysicalRoot.add(raceChevyV3);
  scene.add(raceChevyPhysicalRoot);

  const raceCameraState = globalThis.AsfaltoV3CameraState.create('cockpit');
  let vehicleCameraRig = null;
  const vehicleCockpitCalibrations=new Map();let appliedCockpitVehicle=null;
  function rememberCockpitCalibration(state){vehicleCockpitCalibrations.set(window.__asfaltoSelectedPlayerVehicle||'chevy',structuredClone(state));vehicleCameraRig?.setCockpitCalibration(state);}
  const headMotion=createCockpitHeadMotion();let headMotionControls=null;
  const headMotionOffset=new THREE.Vector3(),headMotionQuaternion=new THREE.Quaternion();
  const cameraEntrance = createRaceCameraEntrance();
  let lightingEditor=null,colorGrading=null,advancedGraphics=null,graphicsSettings=null;
  const cameraOpening = createRaceOpening();
  const cameraOpeningOverlay = createRaceOpeningOverlay({onSkip:()=>cameraOpening.skip(),canSkip:()=>!globalThis.__cockpit?.raceWorld?.isPaused});
  const entranceOffset = new THREE.Vector3();
  const raceCameraLabels = Object.freeze({ cockpit: 'Cockpit', chase: 'Persecución', hood: 'Capó', cinematic: 'Cinemática' });
  const raceCameraButton = document.createElement('button');
  raceCameraButton.id = 'race-camera-control';
  raceCameraButton.type = 'button';
  raceCameraButton.dataset.mode = raceCameraState.current;
  raceCameraButton.setAttribute('aria-live', 'polite');
  viewport.appendChild(raceCameraButton);
  let cinematicCameraEpoch = performance.now();

  function updateRaceCameraUi() {
    const label = raceCameraLabels[raceCameraState.current];
    raceCameraButton.dataset.mode = raceCameraState.current;
    raceCameraButton.innerHTML = 'Cámara · ' + label + ' <small>[C]</small>';
    raceCameraButton.setAttribute('aria-label', 'Cámara ' + label + '. Pulsá C o activá este botón para cambiar.');
  }
  function setRaceCameraMode(mode) {
    const previous = raceCameraState.current;
    const current = raceCameraState.set(mode);
    if (current === 'cinematic' && previous !== current) cinematicCameraEpoch = performance.now();
    updateRaceCameraUi();
    return current;
  }
  function cycleRaceCamera() {
    const current = raceCameraState.next();
    if (current === 'cinematic') cinematicCameraEpoch = performance.now();
    updateRaceCameraUi();
    return current;
  }
  raceCameraButton.addEventListener('click', cycleRaceCamera);
  updateRaceCameraUi();
  window.__asfaltoNacionalV3 = Object.freeze({
    version: '3.0.0',
    model: window.__chevyV3ModelInfo,
    cameraModes: raceCameraState.modes,
    getCameraMode: () => raceCameraState.current,
    setCameraMode: setRaceCameraMode,
    nextCamera: cycleRaceCamera,
  });

  const referenceAspect = REFERENCE_IMAGE.width / REFERENCE_IMAGE.height;
  const referenceVerticalFov = verticalFovFromHorizontalFov(REFERENCE_HORIZONTAL_FOV_DEG, referenceAspect);
  const desktopHorizontalFov = horizontalFovFromVerticalFov(referenceVerticalFov, DESKTOP_REFERENCE_ASPECT);
  const camera = new THREE.PerspectiveCamera(referenceVerticalFov, 1, 0.02, 32000);
  camera.position.fromArray(COCKPIT_LAYOUT.camera.position);

  const cockpit = new THREE.Group();
  cockpit.name = 'CockpitChevyCompleto';
  cockpit.scale.setScalar(0.72);
  cockpit.position.set(0,-0.50,-2.85);
  scene.add(camera);
  const cockpitEntranceRoot = new THREE.Group();
  cockpitEntranceRoot.name = 'Camera entrance compensation';
  const cockpitHeadRoot=new THREE.Group();cockpitHeadRoot.name='Physical head compensation';
  camera.add(cockpitHeadRoot);cockpitHeadRoot.add(cockpitEntranceRoot);
  const cockpitViewMount=new THREE.Group();cockpitViewMount.name='Optional driving eye compensation';
  cockpitEntranceRoot.add(cockpitViewMount);cockpitViewMount.add(cockpit);

  const hemi = new THREE.HemisphereLight(0xe9f1ff, 0x191a1d, 1.15);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.45);
  keyLight.position.set(2.8, 3.1, 4.5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x9bb7d8, 1.0);
  fillLight.position.set(-3.5, 1.1, 2.2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffead2, 0.78);
  rimLight.position.set(1.5, 2.0, -3.0);
  scene.add(rimLight);



  // ──────────────────────────────────────────────────────────────────────────
  // RACING POV WORLD V3 · 100 mejoras · núcleo determinista + runtime Three.js
  // Sistemas adaptados del RAR: scatter determinista, GrassField con viento,
  // SkyDome, groundMask y WaterFloor con Voronoi/ripples.
  // ──────────────────────────────────────────────────────────────────────────
const RaceCore = (() => {
  const TAU = Math.PI * 2;
  const EPS = 1e-9;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (value, length) => ((value % length) + length) % length;
  const wrapAngle = (angle) => mod(angle + Math.PI, TAU) - Math.PI;
  const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-Math.max(0, lambda) * Math.max(0, dt)));

  function seededRandom(seed = 1) {
    let state = (Math.trunc(seed) * 1664525 + 1013904223) >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }

  const TRACK_BLUEPRINTS = Object.freeze({
    dos_lagos: Object.freeze({ id: 'dos_lagos', name: 'Dos Lagos', available: true }),
    cuesta_lipan: Object.freeze({ id: 'cuesta_lipan', name: 'Cuesta de Lipán', available: true }),
    aconcagua_horcones: Object.freeze({ id: 'aconcagua_horcones', name: 'Aconcagua · Horcones', available: true }),
    paso_garibaldi: Object.freeze({ id: 'paso_garibaldi', name: 'Paso Garibaldi', available: true }),
    cataratas_iguazu: Object.freeze({id:'cataratas_iguazu',name:'Cataratas del Iguazú',available:true}),
  });

  function periodicValue(terms, u, base = 0) {
    let value = base;
    for (const [amplitude, frequency, phase] of terms || []) value += amplitude * Math.sin(TAU * frequency * u + phase);
    return value;
  }

  function catmull(points, t) {
    const n = points.length;
    const wrapped = mod(t, n);
    const i1 = Math.floor(wrapped);
    const u = wrapped - i1;
    const i0 = (i1 - 1 + n) % n;
    const i2 = (i1 + 1) % n;
    const i3 = (i1 + 2) % n;
    const p0 = points[i0];
    const p1 = points[i1];
    const p2 = points[i2];
    const p3 = points[i3];
    const u2 = u * u;
    const u3 = u2 * u;
    const component = (index) => 0.5 * (
      2 * p1[index]
      + (-p0[index] + p2[index]) * u
      + (2 * p0[index] - 5 * p1[index] + 4 * p2[index] - p3[index]) * u2
      + (-p0[index] + 3 * p1[index] - 3 * p2[index] + p3[index]) * u3
    );
    return { x: component(0), z: component(1) };
  }

  function binarySearchCumulative(cumulative, value) {
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function createTrack(id) {
    const requestedId = typeof id === 'string' ? id : id?.id;
    const blueprint = TRACK_BLUEPRINTS[requestedId];
    if (!blueprint) throw new Error('Circuito desconocido: ' + requestedId);
    if (!blueprint.available) throw new Error(blueprint.name + ' · PRÓXIMAMENTE');
    if (blueprint.id !== 'dos_lagos') throw new Error('Circuito no está implementado: ' + blueprint.id);
    return globalThis.AsfaltoV5TrackCore.createDosLagosTrack(DOS_LAGOS_ROUTE_DATA);
  }

  function createDefaultSettings(overrides = {}) {
    const defaults = {
      mode: 'timeTrial',
      laps: 3,
      countdownSeconds: 3,
      weather: 'clear',
      timeOfDay: 'day',
      rivalCount: 5,
      difficulty: 0.62,
      seed: 77,
      vehicleWidth: 1.82,
      wheelBase: 2.68,
      maxSteerRadians: 0.48,
      recoveryPenalty: 3.5,
      checkpointPenalty: 5,
      offroadInvalidSeconds: 2.2,
      speedTrapAttempts: 3,
      focusSector: 1,
      tireWear: true,
      assists: { steering: true, abs: true, tcs: true, stability: true },
    };
    return {
      ...defaults,
      ...overrides,
      laps: Math.max(1, Math.min(20, Math.trunc(overrides.laps ?? defaults.laps))),
      rivalCount: Math.max(0, Math.min(12, Math.trunc(overrides.rivalCount ?? defaults.rivalCount))),
      difficulty: clamp(overrides.difficulty ?? defaults.difficulty, 0, 1),
      speedTrapAttempts: Math.max(1, Math.min(12, Math.trunc(overrides.speedTrapAttempts ?? defaults.speedTrapAttempts))),
      focusSector: Math.max(1, Math.min(8, Math.trunc(overrides.focusSector ?? defaults.focusSector))),
      tireWear: overrides.tireWear !== false,
      assists: { ...defaults.assists, ...(overrides.assists || {}) },
    };
  }

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  }

  function defaultStorage() {
    try { return typeof globalThis !== 'undefined' ? (globalThis.__asfaltoV7Storage || null) : null; }
    catch { return null; }
  }

  class RaceSimulation {
    constructor({ track, settings = {}, storage } = {}) {
      if (!track) throw new Error('RaceSimulation requiere un circuito');
      this.track = track;
      this.settings = createDefaultSettings(settings);
      if (this.track.closed === false) this.settings.laps = 1;
      this.storage = storage === undefined ? defaultStorage() : storage;
      this.state = this._makeInitialState();
      this._loadRecord();
    }

    _recordKey() {
      const a = this.settings.assists;
      const diff = Math.round(this.settings.difficulty * 100);
      return `cockpit-race-v5:${this.track.id}:${this.settings.mode}:${this.settings.weather}:${this.settings.timeOfDay}:${diff}:${this.settings.rivalCount}:${a.steering ? 1 : 0}${a.abs ? 1 : 0}${a.tcs ? 1 : 0}${a.stability ? 1 : 0}`;
    }

    _legacyRecordKey() {
      const a = this.settings.assists;
      return `cockpit-race-v3:${this.track.id}:${this.settings.mode}:${this.settings.weather}:${this.settings.timeOfDay}:${a.steering ? 1 : 0}${a.abs ? 1 : 0}${a.tcs ? 1 : 0}${a.stability ? 1 : 0}`;
    }

    _makeRivals() {
      if (this.settings.mode !== 'race' || this.settings.rivalCount <= 0) return [];
      const rng = seededRandom(this.settings.seed + this.track.seed * 13);
      const difficulty = clamp(this.settings.difficulty, 0, 1);
      return Array.from({ length: this.settings.rivalCount }, (_, index) => {
        const skill = clamp(0.30 + rng() * 0.34 + difficulty * 0.42, 0.25, 1.08);
        return {
          id: `rival-${index + 1}`,
          s: this.track.closed === false ? 0 : mod(-8 - index * 7.5, this.track.length),
          raceProgress: this.track.closed === false ? 0 : -8 - index * 7.5,
          lateral: ((index % 2) * 2 - 1) * (0.55 + (index % 3) * 0.28),
          speed: 16 + difficulty * 7 + rng() * 5,
          skill,
          aggression: clamp(0.22 + difficulty * 0.62 + rng() * 0.18, 0.15, 1),
          reaction: clamp(0.24 + (1 - difficulty) * 0.55 + rng() * 0.16, 0.18, 0.95),
          laneIntent: 0,
          colorIndex: index % 6,
        };
      });
    }

    _sectorRange() {
      const count = this.track.checkpoints.length;
      const focus = Math.max(1, Math.min(count, this.settings.focusSector || 1));
      const startS = focus <= 1 ? 0 : this.track.checkpoints[focus - 2];
      const endS = this.track.checkpoints[focus - 1];
      return { focus, startS, endS };
    }

    _makeInitialState() {
      return {
        status: 'IDLE',
        finishReason: null,
        countdown: 0,
        s: 0,
        raceProgress: 0,
        completedLaps: 0,
        lap: 1,
        nextCheckpointIndex: 0,
        lastCheckpointProgress: 0,
        missedCheckpoint: false,
        totalTime: 0,
        lapStartTime: 0,
        sectorStartTime: 0,
        currentSectorTimes: [],
        lastSectorTimes: [],
        lastLapTime: null,
        bestLapTime: null,
        bestSectorTimes: [],
        penaltyTime: 0,
        invalidLap: false,
        lateral: 0,
        headingError: 0,
        yawRate: 0,
        lateralVelocity: 0,
        surface: 'asphalt',
        grip: 1,
        offroadTime: 0,
        collisionCount: 0,
        impact: false,
        slip: 0,
        camera: { pitch: 0, roll: 0, heave: 0, shake: 0, lookAhead: 0 },
        rivals: this._makeRivals(),
        ghostSamples: [],
        ghostAccumulator: 0,
        tireTemp: 0.72,
        tireWear: 0,
        cutDistance: 0,
        speedTrap: { active: false, peakMps: 0, attempts: 0, bestKmh: 0, lastKmh: 0, complete: false },
        sectorPractice: { ...this._sectorRange(), completed: 0, bestTime: null, lastTime: null },
        events: [],
      };
    }

    _loadRecord() {
      if (!this.storage) return;
      try {
        const record = safeParse(this.storage.getItem(this._recordKey()), null)
          || safeParse(this.storage.getItem(this._legacyRecordKey()), null);
        if (!record || !Number.isFinite(record.bestLapTime)) return;
        this.state.bestLapTime = record.bestLapTime;
        this.state.bestSectorTimes = Array.isArray(record.bestSectorTimes) ? [...record.bestSectorTimes] : [];
        const ghost = record.ghost && Array.isArray(record.ghost.samples) ? record.ghost : null;
        this._ghost = ghost && this.track.closed === false
          ? { ...ghost, samples: ghost.samples.map(sample => ({ ...sample, s: clamp(sample.s, 0, this.track.length) })) }
          : ghost;
      } catch { /* Storage can be unavailable in privacy modes. */ }
    }

    _saveRecord() {
      if (!this.storage || !Number.isFinite(this.state.bestLapTime)) return;
      const record = {
        version: 5,
        circuit: this.track.id,
        bestLapTime: this.state.bestLapTime,
        bestSectorTimes: [...this.state.bestSectorTimes],
        ghost: this._ghost || null,
      };
      try { this.storage.setItem(this._recordKey(), JSON.stringify(record)); } catch { /* quota/private mode */ }
    }

    _event(type, data = {}) {
      this.state.events.push({ type, at: this.state.totalTime, ...data });
      if (this.state.events.length > 32) this.state.events.shift();
    }

    configure(settings = {}) {
      this.settings = createDefaultSettings({ ...this.settings, ...settings, assists: { ...this.settings.assists, ...(settings.assists || {}) } });
      if (this.track.closed === false) this.settings.laps = 1;
      this.state.rivals = this._makeRivals();
      this._loadRecord();
      return this.getState();
    }

    selectTrack(track) {
      this.track = track;
      if (this.track.closed === false) this.settings.laps = 1;
      const record = { bestLapTime: null, bestSectorTimes: [] };
      this.state = { ...this._makeInitialState(), ...record };
      this._ghost = null;
      this._loadRecord();
      return this.getState();
    }

    start() {
      const bestLapTime = this.state.bestLapTime;
      const bestSectorTimes = [...this.state.bestSectorTimes];
      this.state = this._makeInitialState();
      this.state.bestLapTime = bestLapTime;
      this.state.bestSectorTimes = bestSectorTimes;
      if (this.settings.mode === 'sectors') {
        const range = this._sectorRange();
        this.state.sectorPractice = { ...range, completed: 0, bestTime: null, lastTime: null };
        this.state.s = range.startS;
        this.state.raceProgress = range.startS;
        this.state.lastCheckpointProgress = range.startS;
        this.state.nextCheckpointIndex = range.focus - 1;
      }
      this.state.status = 'COUNTDOWN';
      this.state.countdown = Math.max(0, this.settings.countdownSeconds);
      this._event('countdown', { seconds: this.state.countdown });
      return this.getState();
    }

    pause() {
      if (this.state.status === 'RUNNING' || this.state.status === 'COUNTDOWN') {
        this.state.previousStatus = this.state.status;
        this.state.status = 'PAUSED';
        this._event('pause');
      }
      return this.getState();
    }

    resume() {
      if (this.state.status === 'PAUSED') {
        this.state.status = this.state.previousStatus === 'COUNTDOWN' ? 'COUNTDOWN' : 'RUNNING';
        this.state.previousStatus = null;
        this._event('resume');
      }
      return this.getState();
    }

    togglePause() { return this.state.status === 'PAUSED' ? this.resume() : this.pause(); }

    finish(reason = 'completed') {
      if (this.state.status === 'FINISHED') return this.getState();
      this.state.status = 'FINISHED';
      this.state.finishReason = reason;
      this._event('finish', { reason, time: this.state.totalTime + this.state.penaltyTime });
      return this.getState();
    }

    recover() {
      const progress = Math.max(0, Number(this.state.lastCheckpointProgress) || 0);
      this.state.raceProgress = this.track.closed === false ? clamp(progress, 0, this.track.length) : progress;
      this.state.s = this.track.closed === false ? clamp(progress, 0, this.track.length) : mod(progress, this.track.length);
      this.state.lateral = 0;
      this.state.headingError = 0;
      this.state.yawRate = 0;
      this.state.lateralVelocity = 0;
      this.state.missedCheckpoint = false;
      this.state.invalidLap = true;
      if (this.settings.mode === 'sectors') {
        const range = this._sectorRange();
        this.state.raceProgress = range.startS;
        this.state.s = range.startS;
        this.state.nextCheckpointIndex = range.focus - 1;
        this.state.lastCheckpointProgress = range.startS;
        this.state.sectorStartTime = this.state.totalTime;
      }
      this.state.penaltyTime += this.settings.recoveryPenalty;
      this._event('recover', { penalty: this.settings.recoveryPenalty, invalidLap: true });
      return this.getState();
    }

    _weatherGrip() {
      return { clear: 1, cloudy: 0.98, rain: 0.78, storm: 0.69, fog: 0.92 }[this.settings.weather] || 1;
    }

    _updateRivals(dt) {
      if (!this.state.rivals.length) return;
      const difficulty = clamp(this.settings.difficulty, 0, 1);
      const weatherPace = { clear: 1, cloudy: 0.985, rain: 0.82, storm: 0.72, fog: 0.88 }[this.settings.weather] || 1;
      const sorted = [...this.state.rivals].sort((a, b) => a.raceProgress - b.raceProgress);
      for (const rival of this.state.rivals) {
        const here = this.track.sample(rival.s);
        const ahead1 = this.track.sample(rival.s + 45);
        const ahead2 = this.track.sample(rival.s + 100);
        const curvature = Math.max(Math.abs(here.curvature), Math.abs(ahead1.curvature), Math.abs(ahead2.curvature) * 0.82);
        const cornerLimit = clamp(47 / (1 + curvature * 285), 10, 46);
        const pace = 0.70 + rival.skill * 0.23 + difficulty * 0.22;
        let target = cornerLimit * pace * weatherPace;
        const leader = sorted.find(other => other !== rival && other.raceProgress > rival.raceProgress && other.raceProgress - rival.raceProgress < 24);
        if (leader) {
          const gap = leader.raceProgress - rival.raceProgress;
          const side = Math.sign(rival.id.charCodeAt(rival.id.length - 1) % 2 ? 1 : -1);
          rival.laneIntent = side * clamp((24 - gap) / 24, 0, 1) * here.width * 0.20 * rival.aggression;
          if (gap < 7) target = Math.min(target, leader.speed + 0.4 + rival.aggression * 1.4);
        } else rival.laneIntent = damp(rival.laneIntent, 0, 2.5, dt);
        rival.speed = damp(rival.speed, target, 0.55 + rival.skill * 1.4, dt);
        rival.raceProgress += rival.speed * dt;
        if (this.track.closed === false) rival.raceProgress = clamp(rival.raceProgress, 0, this.track.length);
        rival.s = this.track.closed === false ? rival.raceProgress : mod(rival.raceProgress, this.track.length);
        const desiredLane = this.track.idealLineOffset(rival.s) * (0.45 + rival.skill * 0.45) + rival.laneIntent;
        rival.lateral = damp(rival.lateral, clamp(desiredLane, -here.width * 0.38, here.width * 0.38), 1.25 + rival.skill, dt);
      }
    }

    _updateSpeedTrap(previousProgress, nextProgress, speedMps) {
      if (this.settings.mode !== 'speedTrap' || nextProgress <= previousProgress || !this.track.speedTrap) return;
      const trap = this.state.speedTrap;
      const length = this.track.length;
      const lapBase = Math.floor(previousProgress / length) * length;
      for (const base of [lapBase, lapBase + length]) {
        const start = base + this.track.speedTrap.start;
        const end = base + this.track.speedTrap.end;
        if (previousProgress < start && nextProgress >= start) {
          trap.active = true;
          trap.peakMps = Math.max(0, speedMps);
          this._event('speed-trap-enter');
        }
        if (trap.active) trap.peakMps = Math.max(trap.peakMps, speedMps);
        if (trap.active && previousProgress < end && nextProgress >= end) {
          trap.active = false;
          trap.attempts += 1;
          trap.lastKmh = trap.peakMps * 3.6;
          trap.bestKmh = Math.max(trap.bestKmh, trap.lastKmh);
          trap.peakMps = 0;
          this._event('speed-trap', { attempt: trap.attempts, speedKmh: trap.lastKmh, bestKmh: trap.bestKmh });
          if (this.track.closed !== false && trap.attempts >= this.settings.speedTrapAttempts) {
            trap.complete = true;
            this.finish('speed-trap-complete');
          }
        }
      }
    }

    _recordGhost(dt, speedMps) {
      if (this.state.status !== 'RUNNING') return;
      this.state.ghostAccumulator += dt;
      if (this.state.ghostAccumulator < 0.04) return;
      this.state.ghostAccumulator %= 0.04;
      this.state.ghostSamples.push({
        t: this.state.totalTime - this.state.lapStartTime,
        s: this.track.closed === false ? clamp(this.state.raceProgress, 0, this.track.length) : this.state.raceProgress - this.state.completedLaps * this.track.length,
        lateral: this.state.lateral,
        speed: speedMps,
        heading: this.state.headingError,
        slip: this.state.slip,
      });
      if (this.state.ghostSamples.length > 4000) this.state.ghostSamples.shift();
    }

    _checkpointCrossing(previousProgress, nextProgress) {
      if (this.state.status !== 'RUNNING' || nextProgress <= previousProgress) return;
      let guard = 0;
      while (guard++ < 8 && this.state.status === 'RUNNING') {
        const cpIndex = this.state.nextCheckpointIndex;
        const target = this.state.completedLaps * this.track.length + this.track.checkpoints[cpIndex];
        if (!(previousProgress < target && nextProgress >= target)) break;
        const gateWidth = this.track.widthAt(target) * 0.5 + this.track.shoulder;
        const inGate = Math.abs(this.state.lateral) <= gateWidth && Math.abs(this.state.headingError) < 0.75;
        if (!inGate) {
          this.state.missedCheckpoint = true;
          this.state.invalidLap = true;
          this.state.penaltyTime += this.settings.checkpointPenalty;
          this._event('checkpoint-missed', { index: cpIndex, penalty: this.settings.checkpointPenalty });
          break;
        }
        this.state.missedCheckpoint = false;
        this.state.lastCheckpointProgress = target;
        const sectorTime = this.state.totalTime - this.state.sectorStartTime;
        this.state.currentSectorTimes.push(sectorTime);
        this.state.sectorStartTime = this.state.totalTime;
        this._event('sector', { index: cpIndex, time: sectorTime });
        if (this.track.closed !== false && this.settings.mode === 'sectors' && cpIndex === this.state.sectorPractice.focus - 1) {
          const practice = this.state.sectorPractice;
          practice.completed += 1;
          practice.lastTime = sectorTime;
          practice.bestTime = !Number.isFinite(practice.bestTime) ? sectorTime : Math.min(practice.bestTime, sectorTime);
          this._event('sector-practice-complete', { sector: practice.focus, time: sectorTime, best: practice.bestTime });
          this.state.raceProgress = practice.startS;
          this.state.s = practice.startS;
          this.state.lateral = 0;
          this.state.headingError = 0;
          this.state.yawRate = 0;
          this.state.lateralVelocity = 0;
          this.state.lastCheckpointProgress = practice.startS;
          this.state.nextCheckpointIndex = practice.focus - 1;
          this.state.currentSectorTimes = [];
          this.state.invalidLap = false;
          return;
        }
        if (cpIndex === this.track.checkpoints.length - 1) {
          this.debugCompleteLap(!this.state.invalidLap);
        } else {
          this.state.nextCheckpointIndex += 1;
        }
      }
    }

    debugCompleteLap(valid = true) {
      const lapTime = Math.max(0, this.state.totalTime - this.state.lapStartTime);
      this.state.lastLapTime = lapTime;
      this.state.lastSectorTimes = [...this.state.currentSectorTimes];
      const isBest = valid && lapTime > 0 && (!Number.isFinite(this.state.bestLapTime) || lapTime < this.state.bestLapTime);
      if (isBest) {
        this.state.bestLapTime = lapTime;
        this.state.bestSectorTimes = [...this.state.currentSectorTimes];
        this._ghost = { version: 1, lapTime, samples: this.state.ghostSamples.map((sample) => ({ ...sample })) };
        this._saveRecord();
        this._event('best-lap', { time: lapTime });
      } else {
        this._event('lap', { time: lapTime, valid });
      }
      this.state.completedLaps += 1;
      this.state.lap = this.track.closed === false ? 1 : this.state.completedLaps + 1;
      this.state.nextCheckpointIndex = 0;
      this.state.lapStartTime = this.state.totalTime;
      this.state.sectorStartTime = this.state.totalTime;
      this.state.currentSectorTimes = [];
      this.state.invalidLap = false;
      this.state.offroadTime = 0;
      this.state.ghostSamples = [];
      this.state.ghostAccumulator = 0;
      if ((this.track.closed === false || !['practice', 'sectors', 'speedTrap'].includes(this.settings.mode))
        && this.state.completedLaps >= this.settings.laps
        && this.state.status === 'RUNNING') this.finish('completed');
      return this.getState();
    }

    _stepSub(dt, input, feedback) {
      const state = this.state;
      if (state.status === 'FINISHED') {
        feedback.speedMps = 0;
        return;
      }
      if (state.status === 'PAUSED') {
        feedback.speedMps = 0;
        return;
      }
      if (state.status === 'COUNTDOWN') {
        state.countdown = Math.max(0, state.countdown - dt);
        feedback.speedMps = 0;
        if (state.countdown <= EPS) {
          state.status = 'RUNNING';
          state.countdown = 0;
          state.totalTime = 0;
          state.lapStartTime = 0;
          state.sectorStartTime = 0;
          this._event('green');
        }
        return;
      }

      let speedMps = Number.isFinite(feedback.speedMps) ? feedback.speedMps : 0;
      const steerInput = clamp(input.steer, -1, 1);
      const throttle = clamp(input.throttle, 0, 1);
      const brake = clamp(input.brake, 0, 1);
      const handbrake = clamp(input.handbrake, 0, 1);
      const speedAbs = Math.abs(speedMps);
      const trackSample = this.track.sample(state.s);
      let surface = this.track.surfaceAt(state.s, state.lateral, this.settings.vehicleWidth * 0.5);
      const weatherGrip = this._weatherGrip();
      const thermalLoad = clamp((speedAbs / 48) * (0.35 + Math.abs(steerInput) * 0.75 + brake * 0.55), 0, 1.6);
      state.tireTemp = damp(state.tireTemp, clamp(0.48 + thermalLoad * 0.42, 0.35, 1.18), 0.38, dt);
      if (this.settings.tireWear && state.status === 'RUNNING') state.tireWear = clamp(state.tireWear + dt * thermalLoad * 0.000055, 0, 0.35);
      const temperatureGrip = clamp(1 - Math.abs(state.tireTemp - 0.78) * 0.26 - state.tireWear * 0.38, 0.72, 1.03);
      const grip = surface.grip * weatherGrip * temperatureGrip * (1 - handbrake * 0.58);
      const speedSteerScale = this.settings.assists.steering ? clamp(1.18 - speedAbs / 72, 0.43, 1) : 1;
      const steerAngle = steerInput * this.settings.maxSteerRadians * speedSteerScale;
      const targetYawRate = speedMps / this.settings.wheelBase * Math.tan(steerAngle) * grip;
      state.yawRate = damp(state.yawRate, targetYawRate, 4.2 + grip * 4.8, dt);
      const curvatureYaw = speedMps * trackSample.curvature / Math.max(0.35, 1 - trackSample.curvature * state.lateral);
      state.headingError = wrapAngle(state.headingError + (state.yawRate - curvatureYaw) * dt);

      const stability = this.settings.assists.stability ? 2.2 : 0.8;
      const desiredLateralVelocity = speedMps * Math.sin(state.headingError);
      state.lateralVelocity = damp(state.lateralVelocity, desiredLateralVelocity, 1.2 + grip * 3.4, dt);
      state.lateralVelocity -= state.headingError * stability * grip * dt * Math.max(1, speedAbs * 0.12);
      if (handbrake > 0.05) state.lateralVelocity += steerInput * speedAbs * handbrake * 0.18;
      state.lateral += state.lateralVelocity * dt;
      state.headingError = wrapAngle(state.headingError);

      surface = this.track.surfaceAt(state.s, state.lateral, this.settings.vehicleWidth * 0.5);
      state.surface = surface.kind;
      state.grip = surface.grip * weatherGrip;
      state.impact = false;
      const drag = surface.drag + handbrake * 0.8 + (this.settings.weather === 'rain' ? 0.015 : 0);
      speedMps *= Math.exp(-drag * dt);

      if (surface.kind === 'barrier') {
        const resolved = this.track.resolveBarrierCollision(
          state.s,
          state.lateral,
          state.lateralVelocity,
          this.settings.vehicleWidth * 0.5,
        );
        state.lateral = resolved.lateral;
        state.lateralVelocity = resolved.lateralSpeedMps;
        state.headingError *= -0.18;
        speedMps *= 0.54;
        state.collisionCount += 1;
        state.impact = true;
        feedback.impact = true;
        this._event('impact', { speed: speedAbs, side: surface.side });
      }

      const ds = speedMps * Math.cos(state.headingError) * dt;
      const previousProgress = state.raceProgress;
      const nextProgress = state.raceProgress + ds;
      state.raceProgress = this.track.closed === false ? clamp(nextProgress, 0, this.track.length) : nextProgress;
      state.s = this.track.closed === false ? clamp(state.s + ds, 0, this.track.length) : mod(state.s + ds, this.track.length);
      this._updateSpeedTrap(previousProgress, state.raceProgress, Math.abs(speedMps));
      if (state.status === 'RUNNING') {
        state.totalTime += dt;
        this._checkpointCrossing(previousProgress, state.raceProgress);
        const offroad = !['asphalt', 'curb'].includes(surface.kind);
        state.offroadTime = offroad ? state.offroadTime + dt : Math.max(0, state.offroadTime - dt * 2);
        state.cutDistance = offroad && ds > 0 ? state.cutDistance + ds : Math.max(0, state.cutDistance - dt * 3);
        if (state.offroadTime >= this.settings.offroadInvalidSeconds || state.cutDistance > 35) state.invalidLap = true;
        this._recordGhost(dt, speedMps);
      }

      this._updateRivals(dt);
      const slip = clamp(Math.abs(state.lateralVelocity - desiredLateralVelocity) / Math.max(5, speedAbs), 0, 1);
      state.slip = damp(state.slip, slip + handbrake * 0.4, 5, dt);
      const rough = surface.roughness || 0;
      state.camera.pitch = damp(state.camera.pitch, brake * 0.026 - throttle * 0.015, 5.5, dt);
      state.camera.roll = damp(state.camera.roll, -steerInput * clamp(speedAbs / 35, 0, 1) * 0.038 - trackSample.bank * 0.22, 6, dt);
      state.camera.heave = Math.sin(state.totalTime * (5 + speedAbs * 0.25)) * rough * 0.008;
      state.camera.shake = damp(state.camera.shake, rough * clamp(speedAbs / 30, 0, 1) + (state.impact ? 0.9 : 0), 8, dt);
      state.camera.lookAhead = damp(state.camera.lookAhead, steerInput * clamp(speedAbs / 28, 0, 1) * 0.22, 4, dt);

      feedback.speedMps = speedMps;
      feedback.surface = surface.kind;
      feedback.grip = state.grip;
      feedback.roughness = rough;
      feedback.slip = state.slip;
      feedback.curbIntensity = surface.kind === 'curb' ? clamp(speedAbs / 24, 0, 1) : 0;
      feedback.camera = { ...state.camera };
      feedback.track = trackSample;
    }

    step(seconds, input = {}) {
      let remaining = clamp(seconds, 0, 2);
      const feedback = {
        speedMps: Number.isFinite(input.speedMps) ? input.speedMps : 0,
        surface: this.state.surface,
        grip: this.state.grip,
        roughness: 0,
        slip: this.state.slip,
        curbIntensity: 0,
        impact: false,
        camera: { ...this.state.camera },
        track: this.track.sample(this.state.s),
      };
      while (remaining > EPS) {
        const dt = Math.min(1 / 60, remaining);
        this._stepSub(dt, input, feedback);
        remaining -= dt;
      }
      return feedback;
    }

    debugSet(partial = {}, { publish = true } = {}) {
      Object.assign(this.state, partial);
      if (partial.s != null) this.state.s = this.track.closed === false ? clamp(partial.s, 0, this.track.length) : mod(partial.s, this.track.length);
      if (partial.raceProgress != null && this.track.closed === false) this.state.raceProgress = clamp(partial.raceProgress, 0, this.track.length);
      return publish ? this.getState() : undefined;
    }

    getGhost() { return this._ghost ? JSON.parse(JSON.stringify(this._ghost)) : { version: 1, lapTime: null, samples: [] }; }

    _ghostBracket(value, key) {
      const samples = this._ghost?.samples;
      if (!samples?.length) return null;
      let lo = 0, hi = samples.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((samples[mid][key] ?? 0) < value) lo = mid + 1;
        else hi = mid;
      }
      const upper = lo;
      return [Math.max(0, upper - 1), upper];
    }

    getGhostPose(lapTime) {
      const ghost = this._ghost;
      if (!ghost || !ghost.samples?.length || !Number.isFinite(lapTime)) return null;
      const t = this.track.closed === false ? clamp(lapTime, 0, ghost.lapTime || ghost.samples.at(-1).t || 0) : mod(lapTime, ghost.lapTime || ghost.samples.at(-1).t || 1);
      const bracket = this._ghostBracket(t, 't');
      if (!bracket) return null;
      const [lo, hi] = bracket, a = ghost.samples[lo], b = ghost.samples[hi];
      const p = b.t === a.t ? 0 : clamp((t - a.t) / (b.t - a.t), 0, 1);
      return { t, s: this.track.closed === false ? clamp(lerp(a.s, b.s, p), 0, this.track.length) : lerp(a.s, b.s, p), lateral: lerp(a.lateral, b.lateral, p), speed: lerp(a.speed, b.speed, p), heading: lerp(a.heading || 0, b.heading || 0, p), slip: lerp(a.slip || 0, b.slip || 0, p) };
    }

    getGhostPoseAtDistance(distance) {
      const ghost = this._ghost;
      if (!ghost || !ghost.samples?.length || !Number.isFinite(distance)) return null;
      const s = this.track.closed === false ? clamp(distance, 0, this.track.length) : mod(distance, this.track.length);
      const bracket = this._ghostBracket(s, 's');
      if (!bracket) return null;
      const [lo, hi] = bracket, a = ghost.samples[lo], b = ghost.samples[hi];
      const span = Math.max(EPS, b.s - a.s);
      const p = clamp((s - a.s) / span, 0, 1);
      return { t: lerp(a.t, b.t, p), s, lateral: lerp(a.lateral, b.lateral, p), speed: lerp(a.speed, b.speed, p), heading: lerp(a.heading || 0, b.heading || 0, p), slip: lerp(a.slip || 0, b.slip || 0, p) };
    }

    getState() {
      const state = this.state;
      return {
        ...state,
        camera: { ...state.camera },
        rivals: state.rivals.map(rival => ({ ...rival })),
        ghostSamples: state.ghostSamples.map(sample => ({ ...sample })),
        currentSectorTimes: [...state.currentSectorTimes],
        lastSectorTimes: [...state.lastSectorTimes],
        bestSectorTimes: [...state.bestSectorTimes],
        events: state.events.map(event => ({ ...event })),
        speedTrap: { ...state.speedTrap },
        sectorPractice: { ...state.sectorPractice },
        track: { id: this.track.id, name: this.track.name, length: this.track.length, checkpoints: [...this.track.checkpoints], speedTrap: { ...this.track.speedTrap } },
        settings: { ...this.settings, assists: { ...this.settings.assists } },
        totalWithPenalty: state.totalTime + state.penaltyTime,
      };
    }
  }

  return Object.freeze({
    TAU,
    TRACK_BLUEPRINTS,
    clamp,
    lerp,
    damp,
    mod,
    wrapAngle,
    seededRandom,
    createTrack,
    createDefaultSettings,
    RaceSimulation,
  });
})();



/* Cockpit Chevy Racing POV v3 · runtime Three.js autocontenido.
 * Diseñado para empaquetarse dentro del módulo principal sin imports ni URLs.
 */
function createAdvancedRaceWorld(THREE, scene, options = {}) {
  if (typeof RaceCore === 'undefined') throw new Error('RaceCore no está disponible.');
  const renderer = options.renderer || null;
  const camera = options.camera || null;
  const cockpit = options.cockpit || null;
  const viewport = options.viewport || document.getElementById('viewport');
  const app = viewport?.closest('#app') || document.getElementById('app') || document.body;
  const ensureAudioStarted = typeof options.ensureAudioStarted === 'function' ? options.ensureAudioStarted : async () => true;
  const getSharedAudioContext = typeof options.getSharedAudioContext === 'function' ? options.getSharedAudioContext : () => null;
  const getSharedAudioDestination = typeof options.getSharedAudioDestination === 'function' ? options.getSharedAudioDestination : () => null;
  const onVehicleReset = typeof options.onVehicleReset === 'function' ? options.onVehicleReset : () => {};
  const onRecoveryReset = typeof options.onRecoveryReset === 'function' ? options.onRecoveryReset : () => {};
  const onInputCaptureRelease = typeof options.onInputCaptureRelease === 'function' ? options.onInputCaptureRelease : () => {};
  const onRenderingScaleChanged = typeof options.onRenderingScaleChanged === 'function' ? options.onRenderingScaleChanged : () => {};
  const playerVisualBody = options.playerVisualBody || null;
  const playerWheelVisualRig = options.playerWheelVisualRig || null;
  const storage = (() => { try { return globalThis.__asfaltoV7Storage; } catch { return null; } })();

  const clamp = RaceCore.clamp;
  const lerp = RaceCore.lerp;
  const damp = RaceCore.damp;
  const mod = RaceCore.mod;
  const wrapAngle = RaceCore.wrapAngle;
  const rngFor = RaceCore.seededRandom;
  const ROAD_Y = -1.035;
  const VIEW_Z = 1.35;
  const MAX_SEGMENTS = 190;
  const MAX_RIVALS = 12;
  const START_GATE_S = 24;
  const PIT_LANE_START_S = 16;
  const PIT_LANE_LENGTH = 96;
  const PIT_LANE_SEGMENTS = 64;
  const UI_STORAGE_KEY = 'cockpit-race-ui-v5';

  const element = (id) => document.getElementById(id);
  const ui = {
    hud: element('race-hud'), circuit: element('race-circuit'), mode: element('race-mode'), laps: element('race-laps'),
    start: element('race-start'), pause: element('race-pause'), recover: element('race-recover'),
    lap: element('race-lap'), time: element('race-time'), best: element('race-best'), delta: element('race-delta'),
    sector: element('race-sector'), position: element('race-position'), surface: element('race-surface'),
    minimap: element('race-minimap'), message: element('race-message'), live: element('race-live'), offroad: element('race-offroad'),
    settingsToggle: element('race-settings-toggle'), settings: element('race-settings'), settingsClose: element('race-settings-close'),
    environmentPreset: element('race-environment-preset'), weather: element('race-weather'), timeOfDay: element('race-time-of-day'), difficulty: element('race-difficulty'),
    difficultyValue: element('race-difficulty-value'), rivals: element('race-rivals'), rivalsValue: element('race-rivals-value'),
    idealLine: element('race-ideal-line'), hudProfile: element('race-hud-profile'), hudScale: element('race-hud-scale'),
    hudScaleValue: element('race-hud-scale-value'), hudOpacity: element('race-hud-opacity'), hudOpacityValue: element('race-hud-opacity-value'),
    touchEnabled: element('race-touch-enabled'), gyroEnabled: element('race-gyro-enabled'), fullscreen: element('race-fullscreen'),
    audioAmbient: element('race-audio-ambient'), audioAmbientValue: element('race-audio-ambient-value'),
    audioTires: element('race-audio-tires'), audioTiresValue: element('race-audio-tires-value'),
    audioImpacts: element('race-audio-impacts'), audioImpactsValue: element('race-audio-impacts-value'),
    audioSignals: element('race-audio-signals'), audioSignalsValue: element('race-audio-signals-value'),
    resetBindings: element('race-reset-bindings'), results: element('race-results'), resultsSummary: element('race-results-summary'),
    resultsRestart: element('race-results-restart'), resultsClose: element('race-results-close'), touchControls: element('race-touch-controls'),
    touchLeft: element('race-touch-left'), touchRight: element('race-touch-right'), touchAccelerate: element('race-touch-accelerate'),
    touchBrake: element('race-touch-brake'), touchHandbrake: element('race-touch-handbrake'), idealLineHint: element('race-ideal-line-hint'),
  };
  if (!ui.hud || !ui.circuit || !ui.start) throw new Error('La interfaz avanzada de carrera no está presente.');

  const DEFAULT_BINDINGS = Object.freeze({
    steerLeft: 'KeyA', steerRight: 'KeyD', accelerate: 'KeyW', brake: 'KeyS', clutch: 'ShiftLeft', handbrake: 'Space',
    pause: 'KeyP', recover: 'Backspace', lookBack: 'KeyV', hideHud: 'KeyH', fullscreen: 'KeyF',
  });
  const DEFAULT_UI_SETTINGS = Object.freeze({
    weather: 'clear', timeOfDay: 'day', difficulty: 0.62, rivalCount: 1, idealLine: true,
    focusSector: 1, speedTrapAttempts: 3, tireWear: true, rearviewEnabled: true,
    hudProfile: 'competition', hudScale: 1, hudOpacity: 0.94, touchEnabled: false, gyroEnabled: false,
    audioAmbient: 0.65, audioTires: 0.75, audioImpacts: 0.78, audioSignals: 0.82,
    dynamicResolution: true, keyBindings: DEFAULT_BINDINGS,
    assists: { steering: true, abs: true, tcs: true, stability: true },
  });
  function safeJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
  function loadUiSettings() {
    const stored = storage ? safeJson(storage.getItem(UI_STORAGE_KEY), {}) : {};
    return {
      ...DEFAULT_UI_SETTINGS,
      ...stored,
      skyId: stored.skyId || (Object.keys(stored).length ? environmentPresetForLegacySettings(stored) : undefined),
      difficulty: clamp(stored.difficulty ?? DEFAULT_UI_SETTINGS.difficulty, 0, 1),
      rivalCount: Math.round(clamp(stored.rivalCount ?? DEFAULT_UI_SETTINGS.rivalCount, 0, 12)),
      hudScale: clamp(stored.hudScale ?? DEFAULT_UI_SETTINGS.hudScale, 0.72, 1.35),
      hudOpacity: clamp(stored.hudOpacity ?? DEFAULT_UI_SETTINGS.hudOpacity, 0.4, 1),
      audioAmbient: clamp(stored.audioAmbient ?? DEFAULT_UI_SETTINGS.audioAmbient, 0, 1),
      audioTires: clamp(stored.audioTires ?? DEFAULT_UI_SETTINGS.audioTires, 0, 1),
      audioImpacts: clamp(stored.audioImpacts ?? DEFAULT_UI_SETTINGS.audioImpacts, 0, 1),
      audioSignals: clamp(stored.audioSignals ?? DEFAULT_UI_SETTINGS.audioSignals, 0, 1),
      keyBindings: { ...DEFAULT_BINDINGS, ...(stored.keyBindings || {}), lookBack: stored.keyBindings?.lookBack === 'KeyC' ? 'KeyV' : (stored.keyBindings?.lookBack || DEFAULT_BINDINGS.lookBack) },
      assists: { ...DEFAULT_UI_SETTINGS.assists, ...(stored.assists || {}) },
    };
  }
  let settings = loadUiSettings();
  function saveUiSettings({ environment = false } = {}) {
    try { storage?.setItem(UI_STORAGE_KEY, JSON.stringify(settings)); } catch { /* privacy/quota */ }
    if (environment) window.dispatchEvent(new CustomEvent('asfalto:environment-choice', { detail: normalizedEnvironmentSettings(settings) }));
  }

  function formatTime(seconds, empty = '—') {
    if (!Number.isFinite(seconds)) return empty;
    const value = Math.max(0, seconds);
    const minutes = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    const millis = Math.floor((value % 1) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }
  function formatDelta(seconds) {
    if (!Number.isFinite(seconds) || Math.abs(seconds) < 0.0005) return '±0.000';
    return `${seconds > 0 ? '+' : '−'}${Math.abs(seconds).toFixed(3)}`;
  }
  function labelForCode(code) {
    const labels = { Space: 'Espacio', Backspace: 'Retroceso', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
    if (labels[code]) return labels[code];
    return String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
  }

  const modularRaceCue = document.createElement("div");
  modularRaceCue.id = "modular-race-cue"; modularRaceCue.setAttribute("role", "status"); modularRaceCue.setAttribute("aria-live", "polite"); document.body.appendChild(modularRaceCue);
  const modularRaceCueStyle = document.createElement("style"); modularRaceCueStyle.id = "modular-race-cue-style"; modularRaceCueStyle.textContent = "#modular-race-cue{position:fixed;z-index:80;right:max(18px,env(safe-area-inset-right));top:max(18px,env(safe-area-inset-top));max-width:min(280px,42vw);padding:8px 11px;border-left:3px solid #d7b36a;background:rgba(10,12,12,.82);color:#f7edd7;font:700 12px/1.2 system-ui;letter-spacing:.08em;text-transform:uppercase;opacity:0;pointer-events:none;transform:translateY(-4px);transition:opacity .16s,transform .16s}#modular-race-cue.show{opacity:1;transform:none}#modular-race-cue[data-spawn-parking-hold=true]{left:50%;right:auto;top:112px;max-width:min(430px,46vw);transform:translateX(-50%);text-align:center;font-size:11px}@media(prefers-reduced-motion:reduce){#modular-race-cue{transition:none}}"; document.head.appendChild(modularRaceCueStyle);

  let messageTimer = 0;
  function showMessage(text, { duration = 1200, kind = '', countdown = false, announce = true } = {}) {
    window.clearTimeout(messageTimer);
    ui.message.textContent = text;
    ui.message.className = `race-message show${kind ? ` ${kind}` : ''}${countdown ? ' countdown' : ''}`;
    if (announce) ui.live.textContent = text;
    const criticalRaceCue = /PAUSA|RECUPERACIÓN/.test(text); modularRaceCue.textContent = criticalRaceCue ? text : ""; modularRaceCue.classList.toggle("show", criticalRaceCue);
    if (duration > 0) messageTimer = window.setTimeout(() => { ui.message.className = 'race-message'; modularRaceCue.classList.remove("show"); modularRaceCue.textContent = ""; }, duration);
  }

  const bindingButtons = Array.from(document.querySelectorAll('[data-binding]'));
  const assistInputs = Array.from(document.querySelectorAll('[data-assist]'));
  let listeningBinding = null;
  let settingsOpen = false;
  let resumeAfterMenu = false;
  let resultsOpen = false;
  let touchSteer = 0;
  const touchActions = { steerLeft: false, steerRight: false, accelerate: false, brake: false, handbrake: false };
  const keyActions = new Set();
  const activeTouchPointers = new Map();
  const touchPointerOwners = new Map();
  let gyroSteer = 0;
  let gyroCenter = null;
  let gyroLastTimestamp = null;
  let lastGamepadButtons = [];
  let lookBack = false;
  let falseStartApplied = false;
  let gamepadName = null;

  function bindingActionForCode(code) {
    return Object.entries(settings.keyBindings).find(([, bound]) => bound === code)?.[0] || null;
  }
  function syncBindingButtons() {
    for (const button of bindingButtons) button.textContent = labelForCode(settings.keyBindings[button.dataset.binding]);
  }
  function releaseTouchCaptures() {
    for (const [pointerId, button] of touchPointerOwners) {
      try { if (button?.hasPointerCapture?.(pointerId)) button.releasePointerCapture?.(pointerId); } catch {}
    }
    touchPointerOwners.clear();
    activeTouchPointers.clear();
  }
  function clearInputs() {
    keyActions.clear();
    releaseTouchCaptures();
    for (const key of Object.keys(touchActions)) touchActions[key] = false;
    touchSteer = 0;
    lookBack = false;
    for (const control of [ui.touchLeft, ui.touchRight, ui.touchAccelerate, ui.touchBrake, ui.touchHandbrake]) control?.classList.remove('active');
  }

  function rawInputFromKeyboardTouchGyro() {
    const keyboardSteer = (keyActions.has('steerRight') ? 1 : 0) - (keyActions.has('steerLeft') ? 1 : 0);
    const digitalTouchSteer = (touchActions.steerRight ? 1 : 0) - (touchActions.steerLeft ? 1 : 0);
    const steer = clamp(keyboardSteer || digitalTouchSteer || touchSteer || (settings.gyroEnabled ? gyroSteer : 0), -1, 1);
    return {
      steer,
      throttle: keyActions.has('accelerate') || touchActions.accelerate ? 1 : 0,
      brake: keyActions.has('brake') || touchActions.brake ? 1 : 0,
      clutch: keyActions.has('clutch') ? 1 : 0,
      handbrake: keyActions.has('handbrake') || touchActions.handbrake ? 1 : 0,
      lookBack: keyActions.has('lookBack') || lookBack,
    };
  }

  function getGamepadInput() {
    const output = { steer: 0, throttle: 0, brake: 0, clutch: 0, handbrake: 0, lookBack: false };
    if (!navigator.getGamepads) return output;
    const pads = navigator.getGamepads();
    const pad = Array.from(pads || []).find(Boolean);
    if (!pad) { gamepadName = null; return output; }
    gamepadName = pad.id || 'Gamepad';
    const deadzone = 0.11;
    const axis = Math.abs(pad.axes?.[0] || 0) < deadzone ? 0 : pad.axes[0];
    output.steer = clamp(axis * 1.08, -1, 1);
    output.brake = clamp(pad.buttons?.[6]?.value || Math.max(0, -(pad.axes?.[2] || 0)), 0, 1);
    output.throttle = clamp(pad.buttons?.[7]?.value || Math.max(0, pad.axes?.[2] || 0), 0, 1);
    output.clutch = clamp(pad.buttons?.[4]?.value || 0, 0, 1);
    output.handbrake = pad.buttons?.[0]?.pressed ? 1 : 0;
    output.lookBack = !!pad.buttons?.[2]?.pressed;
    const pausePressed = !!pad.buttons?.[9]?.pressed;
    const recoverPressed = !!pad.buttons?.[3]?.pressed;
    if (pausePressed && !lastGamepadButtons[9]) togglePause();
    if (recoverPressed && !lastGamepadButtons[3]) recover();
    lastGamepadButtons = pad.buttons.map((button) => !!button.pressed);
    return output;
  }

  function vibrate(pattern, strength = 0.5) {
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
    try {
      const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
      const actuator = pad?.vibrationActuator || pad?.hapticActuators?.[0];
      actuator?.playEffect?.('dual-rumble', { duration: Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern, strongMagnitude: strength, weakMagnitude: strength * 0.65 });
    } catch { /* unsupported */ }
  }

  function mergedRaceInput() {
    const digital = rawInputFromKeyboardTouchGyro();
    const gamepad = getGamepadInput();
    const gamepadActive = Math.abs(gamepad.steer) > 0.02 || gamepad.throttle > 0.02 || gamepad.brake > 0.02 || gamepad.clutch > 0.02 || gamepad.handbrake > 0;
    return {
      steer: gamepadActive ? gamepad.steer : digital.steer,
      throttle: Math.max(digital.throttle, gamepad.throttle),
      brake: Math.max(digital.brake, gamepad.brake),
      clutch: Math.max(digital.clutch, gamepad.clutch),
      handbrake: Math.max(digital.handbrake, gamepad.handbrake),
      lookBack: digital.lookBack || gamepad.lookBack,
    };
  }

  function onKeyDown(event) {
    if (document.body.classList.contains('v6-menu-open') || document.body.classList.contains('an-intro-open') || document.body.classList.contains('an-race-pause-visible')) return;
    if (globalThis.__asfaltoNacionalV41?.radio?.ownsKeyboardEvent?.(event)) return;
    if (listeningBinding) {
      event.preventDefault();
      settings.keyBindings = { ...settings.keyBindings, [listeningBinding]: event.code };
      listeningBinding = null;
      bindingButtons.forEach((button) => button.classList.remove('listening'));
      syncBindingButtons();
      saveUiSettings();
      return;
    }
    if (event.code === 'Escape') {
      if (resultsOpen) { closeResults(); event.preventDefault(); return; }
      if (settingsOpen) { setSettingsOpen(false); event.preventDefault(); return; }
    }
    if(globalThis.__asfaltoV7Experience?.shouldBlockDrivingInput(event))return;
    const formControl = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement;
    if (formControl) return;
    const action = bindingActionForCode(event.code);
    if (!action) return;
    if (['steerLeft', 'steerRight', 'accelerate', 'brake', 'clutch', 'handbrake', 'lookBack'].includes(action)) {
      event.preventDefault();
      keyActions.add(action);
      if (action === 'lookBack') lookBack = true;
      void ensureAudioStarted();
    }
    if (event.repeat) return;
    if (action === 'pause') { event.preventDefault(); togglePause(); }
    if (action === 'recover') { event.preventDefault(); recover(); }
    if (action === 'hideHud') { event.preventDefault(); cycleHudProfile(); }
    if (action === 'fullscreen') { event.preventDefault(); void toggleFullscreen(); }
  }
  function onKeyUp(event) {
    const action = bindingActionForCode(event.code);
    if (!action) return;
    keyActions.delete(action);
    if (action === 'lookBack') lookBack = false;
  }

  function bindTouchButton(button, action) {
    if (!button) return;
    const press = (event) => {
      event.preventDefault();
      void ensureAudioStarted();
      button.setPointerCapture?.(event.pointerId);
      activeTouchPointers.set(event.pointerId, action);
      touchPointerOwners.set(event.pointerId, button);
      touchActions[action] = true;
      button.classList.add('active');
    };
    const release = (event) => {
      const assigned = activeTouchPointers.get(event.pointerId);
      if (assigned) {
        activeTouchPointers.delete(event.pointerId);
        touchPointerOwners.delete(event.pointerId);
        touchActions[assigned] = Array.from(activeTouchPointers.values()).includes(assigned);
      }
      button.classList.toggle('active', !!touchActions[action]);
    };
    button.addEventListener('pointerdown', press, { passive: false });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    listeners.push(() => {
      button.removeEventListener('pointerdown', press);
      button.removeEventListener('pointerup', release);
      button.removeEventListener('pointercancel', release);
      button.removeEventListener('lostpointercapture', release);
    });
  }

  async function requestGyroPermission(enabled) {
    if (!enabled) { settings.gyroEnabled = false; gyroSteer = 0; gyroCenter = null; gyroLastTimestamp = null; return; }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') throw new Error('Permiso denegado');
      }
      settings.gyroEnabled = true;
      gyroCenter = null;
      gyroLastTimestamp = null;
      showMessage('Inclinación activada · mantené el dispositivo centrado', { duration: 1100, kind: 'success' });
    } catch {
      settings.gyroEnabled = false;
      if (ui.gyroEnabled) ui.gyroEnabled.checked = false;
      showMessage('No se pudo activar el sensor', { duration: 1500, kind: 'danger' });
    }
    saveUiSettings();
  }
  function onDeviceOrientation(event) {
    if (!settings.gyroEnabled || !Number.isFinite(event.gamma)) return;
    const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
    if (gyroCenter === null) {
      gyroCenter = event.gamma;
      gyroLastTimestamp = timestamp;
      gyroSteer = 0;
      return;
    }
    const gyroDt = clamp((timestamp - gyroLastTimestamp) / 1000, 1 / 240, 0.1);
    gyroLastTimestamp = timestamp;
    gyroSteer = damp(gyroSteer, clamp((event.gamma - gyroCenter) / 28, -1, 1), 7, gyroDt);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await app.requestFullscreen?.({ navigationUI: 'hide' });
      else await document.exitFullscreen?.();
    } catch { showMessage('Pantalla completa no disponible', { kind: 'danger' }); }
  }
  function onFullscreenChange() { if (ui.fullscreen) ui.fullscreen.textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'; }

  function createRaceAudio() {
    let soundscape=null,drivingFx=null;
    const audioLifetime=new AbortController();
    let context = null;
    let master = null;
    let ambientGain = null;
    let surfaceGain = null;
    let tireGain = null;
    let rivalGain = null;
    let ambientFilter = null;
    let surfaceFilter = null;
    let tireFilter = null;
    let ambientSource = null;
    let surfaceSource = null;
    let tireSource = null;
    let rivalOscillator = null;
    let rivalPan = null;
    let convolver = null;
    let reverbSend = null;
    let reverbReturn = null;
    let started = false,starting=null,disposed=false;
    const startupAbort=new AbortController();
    const signalSources=new Set();
    let ownsContext = false;
    let lastImpactAt = 0;
    const ambientMix = { target: 0, current: 0 };
    const surfaceNoise = { target: 0, current: 0 };
    const tireSlip = { target: 0, current: 0 };

    function ensureStarted(){if(disposed)return Promise.resolve(false);const shared=ensureAudioStarted();if(starting){void shared.catch(()=>{});return starting;}starting=ensureStartedInternal(shared).finally(()=>starting=null);return starting;}
    async function ensureStartedInternal(shared) {
      const sharedAudioReady = await shared;
      if(sharedAudioReady===false)return false;
      if(disposed||audioLifetime.signal.aborted)return false;
      if (started && context && context.state!=='closed') { if (context.state !== 'running') await context.resume(); return context.state==='running'; }
      if(started){soundscape?.dispose();drivingFx?.dispose();master?.disconnect();started=false;}
      globalThis.__asfaltoV7Experience?.bindAudio(getSharedAudioContext(),options.getUiAudioDestination?.()||getSharedAudioDestination());
      context = getSharedAudioContext() || null;
      ownsContext = false;
      if (!context && sharedAudioReady === false) return false;
      if (!context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;
        context = new AudioContextClass({ latencyHint: 'interactive' });
        ownsContext = true;
      }
      if(!master||master.context!==context){master?.disconnect();master=context.createGain();master.gain.value=.7;master.connect(getSharedAudioDestination()||context.destination);}
      let prepared;
      try{prepared=await prepareSoundscapeBanks(context,{signal:startupAbort.signal});}
      catch(error){if(disposed)return false;throw error;}
      if(disposed)return false;
      soundscape=createRaceSoundscape({context,destination:master,prepared});
      drivingFx=createRaceDrivingAudio({context,destination:master,prepared:prepared.drivingBuffers});
      started = true;
      await context.resume();
      return !disposed;
    }
    function raceSignal(type) {
      if (disposed || !context || !master || context.state !== 'running' || !document.body.classList.contains('v6-driving') || document.hidden || simulation.state.status==='PAUSED' || signalSources.size>12) return;
      const patterns = { countdown: [[520, .08]], green: [[760, .08], [980, .16]], sector: [[690, .07]], best: [[660, .07], [880, .07], [1120, .14]], penalty: [[190, .18]], finish: [[740, .1], [930, .1], [1180, .24]] };
      const pattern = patterns[type] || patterns.sector;
      let offset = 0;
      for (const [frequency, duration] of pattern) {
        const osc = context.createOscillator(); const gain = context.createGain();
        osc.type = type === 'penalty' ? 'square' : 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(Math.max(.002, settings.audioSignals * .12), context.currentTime + offset + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + offset + duration);
        osc.connect(gain).connect(master);const voice={osc,dispose(){osc.disconnect();gain.disconnect();signalSources.delete(voice);}};signalSources.add(voice);osc.onended=voice.dispose;osc.start(context.currentTime + offset); osc.stop(context.currentTime + offset + duration + .02);
        offset += duration + .035;
      }
    }
    function impact(intensity=.5){drivingFx?.impact({intensity:clamp(intensity)*settings.audioImpacts});}
    const audioListenerPosition=new THREE.Vector3(),audioRivalDirection=new THREE.Vector3();
    function update(dt,feedback,state,input,renderFrame) {
      if(!context||!started)return;
      const driving=document.body.classList.contains('v6-driving')&&!document.body.classList.contains('v6-menu-open')&&!document.hidden&&state.status!=='PAUSED';
      if(!driving){silenceSignals();soundscape?.setActive(false);drivingFx?.setActive(false);master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(0,context.currentTime);return;}
      master.gain.setTargetAtTime(.82,context.currentTime,.025);
      const weather=raceWeatherEffects.getSoundscapeState(),cameraMode=options.getCameraMode?.()||'cockpit',speed=Math.abs(feedback.speedMps||0);
      soundscape?.update({...weather,active:true,cameraMode,speedMps:speed,ambientGain:settings.audioAmbient});
      const snapshot=renderFrame?.currentSnapshot||{},other=renderFrame?.rivals?.falcon?.currentSnapshot;
      let rival=null;
      if(other?.chassis){camera.getWorldPosition(audioListenerPosition);audioRivalDirection.fromArray(other.chassis.position).sub(audioListenerPosition);const distanceM=audioRivalDirection.length();audioRivalDirection.normalize();
        const relative=(other.chassis.linearVelocity||[0,0,0]).map((v,i)=>v-(snapshot.chassis?.linearVelocity?.[i]||0)),m=camera.matrixWorld.elements;
        rival={distanceM,rpm:other.engine?.rpm,throttle:other.engine?.load,pan:audioRivalDirection.x*m[0]+audioRivalDirection.y*m[1]+audioRivalDirection.z*m[2],radialSpeedMps:relative[0]*audioRivalDirection.x+relative[1]*audioRivalDirection.y+relative[2]*audioRivalDirection.z};}
      const levels=options.getDrivingAudioLevels?.()||{};
      drivingFx?.update({snapshot,controls:input,speedMps:speed,wetness:weather.wetness,active:true,cameraMode,tiresGain:settings.audioTires,roadGain:levels.road??.44,brakesGain:levels.brakes??.56,impactsGain:settings.audioImpacts,rival});
      const diagnostic=drivingFx?.diagnostics();ambientMix.current=weather.rainIntensity||0;surfaceNoise.current=diagnostic?.targets?.rollingLeft||0;tireSlip.current=diagnostic?.targets?.skidLeft||0;
      if(feedback.impact){const event=snapshot.impacts?.at(-1);drivingFx?.impact({intensity:clamp((event?.impulseNs||0)/1400,.15,1)*settings.audioImpacts,eventId:event?event.timeSeconds+'|'+event.otherId:null,metal:['falcon','chevy'].includes(event?.otherId)});}
    }
    function silenceSignals(){for(const voice of [...signalSources]){try{voice.osc.stop();}catch{}voice.dispose();}}
    async function suspend() { silenceSignals();drivingFx?.setActive(false);soundscape?.setActive(false);if(master&&context)master.gain.setValueAtTime(0,context.currentTime);try { if (ownsContext) await context?.suspend(); } catch { /* ignored */ } }
    async function resume() { try { await context?.resume(); } catch { /* ignored */ } }
    async function dispose() {
      if(disposed)return;disposed=true;startupAbort.abort();
      audioLifetime.abort();
      silenceSignals();
      drivingFx?.dispose();drivingFx=null;soundscape?.dispose();soundscape=null;
      for (const source of [ambientSource, surfaceSource, tireSource, rivalOscillator]) try { source?.stop(); } catch { /* stopped */ }
      for (const node of [ambientGain, surfaceGain, tireGain, rivalGain, reverbSend, reverbReturn, convolver, master]) try { node?.disconnect(); } catch { /* disconnected */ }
      try { if (ownsContext) await context?.close(); } catch { /* ignored */ }
      context = null; ownsContext = false; started = false;
    }
    return { ensureStarted, update, raceSignal, impact, suspend, resume, dispose, thunder:event=>soundscape?.thunder(event), soundscapeDiagnostics:()=>({ambient:soundscape?.diagnostics(),driving:drivingFx?.diagnostics()}), getState: () => ({ started, contextState: context?.state || 'closed', ambientMix: ambientMix.current, surfaceNoise: surfaceNoise.current, tireSlip: tireSlip.current, reverb: reverbSend?.gain?.value || 0 }) };
  }
  const raceAudio = createRaceAudio();

  const listeners = [];
  const listen = (target, type, handler, opts) => { target?.addEventListener(type, handler, opts); listeners.push(() => target?.removeEventListener(type, handler, opts)); };

  function getSelectedV6Profile() {
    try {
      const workshop = globalThis.__chevyV6Complete?.profile?.()
        || JSON.parse(storage?.getItem?.('chevy-serie2-v6-profile') || 'null');
      if (workshop?.parts?.transmission) return workshop.parts.transmission === 'restomod' ? 'restomod' : 'original';
      const saved = JSON.parse(storage?.getItem?.('asfalto-nacional-v6-profile') || 'null');
      return saved?.physicsProfile === 'restomod' ? 'restomod' : 'original';
    } catch {
      return 'original';
    }
  }

  function coreSettingsFromUi() {
    const mode = ui.mode?.value || 'timeTrial';
    const laps = track.closed===false?1:Math.max(1,Math.min(20,Math.trunc(Number(ui.laps?.value)||settings.laps||1)));
    return {
      mode,
      laps,
      weather: settings.weather,
      timeOfDay: settings.timeOfDay,
      skyId: settings.skyId,
      difficulty: settings.difficulty,
      rivalCount: mode === 'race' ? 1 : 0,
      assists: { ...settings.assists },
      focusSector: settings.focusSector || 1,
      speedTrapAttempts: settings.speedTrapAttempts || 3,
      tireWear: settings.tireWear !== false,
      seed: 77,
    };
  }
  globalThis.AsfaltoV6Chassis = chassisConfiguration;
  function getSavedChassisConfig() {
    try {
      const profile = globalThis.__chevyV6Complete?.profile?.()
        || JSON.parse(storage?.getItem?.('chevy-serie2-v6-profile') || 'null');
      return profile?.chassis ? chassisConfiguration.chassisConfigFromProfile(profile) : null;
    } catch { return null; }
  }
  let appliedChassisConfig = getSavedChassisConfig();
  globalThis.__asfaltoChassisConfig = appliedChassisConfig;
  const activeTrack = globalThis.__asfaltoV6Modular.trackManager.active;
  if (!activeTrack?.ready) throw new Error('active track is not ready');
  let track = activeTrack.gameplay;
  let simulation = globalThis.AsfaltoV6Integration.createRaceSimulation({
    vehicleMaintenance:globalThis.__asfaltoVehicleMaintenance || null,
  RaceCore, THREE, track, settings: coreSettingsFromUi(), storage,
  vehicleProfile: getSelectedV6Profile(),
  chassisConfig: appliedChassisConfig,
  rivalCount: (ui.mode?.value || 'timeTrial') === 'race' ? 1 : 0,
  trackAdapter: activeTrack,
  routeQuery: activeTrack.routeQuery,
  ...activeTrack.physicsBridge,
  getEnvironmentState: () => readEnvironmentSimulationState(),
});
const startSignal=createRaceStartSignal(THREE,{scene});
let startSignalSubscription=null;
function prepareStartSignal(){const context=simulation.getRoadTestContext();startSignal.set(context.routeQuery.sample((context.projection?.s||0)+18));startSignalSubscription?.();startSignalSubscription=simulation.subscribePhysicalSteps({sample(){},rebase:event=>startSignal.rebase(event),invalidated:()=>startSignal.clear()});}
const roadTestCourse=createRoadTestCoursePresentation(THREE,{scene});
let roadTestCourseUnsubscribe=null;
function clearRoadTestGates(){roadTestCourseUnsubscribe?.();roadTestCourseUnsubscribe=null;roadTestCourse.clear();}
function setRoadTestGates(gates,{sessionSequence}={}){
 const state=simulation.getPhysicalObservationState();if(state.sessionSequence!==sessionSequence)throw new Error('Road-test gate session changed');
 const result=roadTestCourse.set(gates,{sessionSequence,referenceChart:state.referenceChart});roadTestCourseUnsubscribe?.();
 roadTestCourseUnsubscribe=simulation.subscribePhysicalSteps({sample(){},rebase:event=>roadTestCourse.rebase(event),invalidated:()=>clearRoadTestGates()});return result;
}
const v6InputAdapter = globalThis.AsfaltoV6Input.createInputAdapter();
v6InputAdapter.setProfile(getSelectedV6Profile());
v6InputAdapter.setChassisConfig(appliedChassisConfig);
const driverControlPipeline = createDriverControlPipeline({ adapter: v6InputAdapter });
listen(window,'chevy:vehicle-config',(event)=>{
  const transmission=event.detail?.parts?.transmission;
  const physicsProfile=transmission
    ? (transmission==='restomod'?'restomod':'original')
    : (event.detail?.class==='Restomod'?'restomod':'original');
  appliedChassisConfig = event.detail?.chassis
    ? chassisConfiguration.sanitizeChassisConfig(event.detail.chassis) : null;
  globalThis.__asfaltoChassisConfig = appliedChassisConfig;
  v6InputAdapter.setProfile(physicsProfile);
  v6InputAdapter.setChassisConfig(appliedChassisConfig);
  driverControlPipeline.reset();
  simulation.setVehicleProfile(physicsProfile);
  simulation.setChassisConfig(appliedChassisConfig);
  globalThis.__asfaltoVehiclePresentations?.chevy?.setChassisConfig?.(appliedChassisConfig);
});
  let feedback = {
  speedMps: 0, surface: 'asphalt', grip: 1, slip: 0, impact: false,
  camera: { ...simulation.state.camera }, track: track.sample(0),
};
  let lastState = simulation.getState();
  let lastEventSignature = '';
  let latestInput = { steer: 0, throttle: 0, brake: 0, clutch: 0, handbrake: 0, lookBack: false };
  let maxSpeedMps = 0;
  let resultShownForFinish = false;
  let lastCountdownNumber = null;
  let lastSurface = 'asphalt';
  let contextLost = false,contextRecovery=null;
  const isAsfaltoV5Qa = new URLSearchParams(globalThis.location.search).get('qa') === '1';
  let visualRoot = null;
  let collisionRoot = null;
  let falconVisualRig = null,falconPresentation=null;
  const exteriorTimes=new WeakMap();
  const drivingLights=createVehicleLightControl({storage});let environmentLightRequest=null;
  function activeHeadlightObjects(){const lights=options.getPlayerPresentation?.()?.getLights?.();return lights?.length?lights:environmentHeadlights;}
  function setDrivingLights(kind,value){if(kind==='mode')drivingLights.setMode(value);else if(kind==='position')drivingLights.setPosition(value);else if(kind==='cycle')drivingLights.cycle();else if(kind==='beam')drivingLights.toggleBeam();else if(kind==='dimmer')drivingLights.setDimmer(value);else if(kind==='automatic')drivingLights.setAutomatic(value);const player=options.getPlayerPresentation?.();player?.setLightMode?.(drivingLights.getState().mode);if(environmentLightRequest)applyEnvironmentLightState(environmentLightRequest);return drivingLights.getState();}
  function updateExterior(controller,snapshot){if(!controller||!snapshot)return;const time=snapshot.timeSeconds||0,dt=Math.max(0,Math.min(.1,time-(exteriorTimes.get(controller)??time)));exteriorTimes.set(controller,time);const weather=raceWeatherEffects.getSoundscapeState();const player=controller===options.getPlayerPresentation?.(),lightMode=player?drivingLights.getState().mode:(environmentLightRequest?.headlights?'low':'off');if(player&&falconPhysicalBody?.visible===false)falconPresentation?.setActive?.(false);if(controller.setLightMode)controller.setLightMode(lightMode);else controller.setHeadlights(lightMode==='low'||lightMode==='high');controller.update({dt,cameraMode:options.getCameraMode?.(),allowGlare:!player||!['cockpit','hood'].includes(options.getCameraMode?.()),active:player||!!falconPhysicalBody?.visible,phase:settings.timeOfDay,nightAmount:raceDayActive?raceDayClock.state.nightFactor:undefined,snapshot,speedMps:Math.hypot(...(snapshot.chassis?.linearVelocity||[0,0,0])),brake:snapshot.controls?.brake||0,camera,viewportHeight:renderer.domElement.height,quality:performanceState.qualityTier,trackId:track.id,surface:snapshot.wheels?.find(w=>w.contact)?.surface||'asphalt',rain:weather.rainIntensity,wetness:weather.wetness,reducedMotion:document.body.classList.contains('v6-reduce-motion')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,editing:document.body.classList.contains('editor-mode-active'),paused:simulation.state.status==='PAUSED'});if(player&&controller.getLightingDiagnostics?.().projectorsActive){for(const light of environmentHeadlights){light.visible=false;light.intensity=0;}refreshEnvironmentLightingState();}}
  let falconPhysicalBody = null;
  let physicalRenderBridge = null;
  let authoredCollisionProbe = null;
  let authoredCollisionBridge = null;
  let environmentPmremGenerator = null;
  let environmentPmremCache=null;const environmentBuildTimings=[];
  let environmentHostDisposed = false;
  let environmentHostDisposal = null;
  let environmentSettingsSignature = null;
  let environmentPendingSignature = null;
  let environmentSyncPromise = null;
  let environmentSyncState = 'idle';
  const environmentSyncErrors = [];
  let environmentSelectController = null;
  let wetMaterialCount = 0;
  let regionalEnvironment = null;
  const raceDayClock=createRaceDayCycle(readRaceDayCycleOptions(storage));
  let raceSkyTransition=null,raceDayActive=false,raceDayPrepareToken=0,raceDayEnvironment=null,raceDayBase=null,raceDayPalette=null,raceWeatherCycle=null;
  let regionalSurfaceCondition = null;
  let trackMaterialController = null;
  let trackMaterialControllerTrackId = null;
  const environmentDecodedCache = new Map();
  const environmentCacheCounters = { hits: 0, misses: 0 };
  let environmentBaseline = null;
  let environmentBaselineCaptures = 0;
  let environmentBaselineRestores = 0;
  let environmentRigCreations = 0;
  let environmentRigDisposals = 0;
  let environmentCapturedBaselineSnapshot = null;
  let environmentLastRestoreSnapshot = null;
  const environmentObjectIds = new WeakMap();
  let environmentObjectId = 0;
  let environmentOwner = 'race';
  let environmentRotation = 0;
  let workshopEnvironmentSignature = null;
  let workshopEnvironmentToken = 0;
  let workshopEnvironmentPromise = null;
  let environmentWorkshopRuntime = null;
  let environmentRigRoot = null;
  const environmentHeadlights = [];
  const environmentArtificialLights = [];
  const environmentCreatedLights = [];
  let environmentLightingState = Object.freeze({
    headlights: false, artificialLights: false,
    headlightObjects: 0, artificialLightObjects: 0,
    headlightVisible: 0, artificialLightVisible: 0,
    headlightIntensity: 0, artificialLightIntensity: 0,
  });
  let lastAuthoredFrame = null;
  const routeOriginVector = new THREE.Vector3();
  function legacyTrackLayers() { return [
    roadMesh, shoulderMesh, curbMesh, terrainMesh, centerDashes, roadDecals,
    waterMesh, seabedMesh, grassMesh, flowerMesh, trunkMesh, canopyMesh,
    treeContactShadows, rockMesh, barrierMesh, pitLane, pitStripe,
  ]; }

  function disableLegacyTrackLayers() {
    for (const layer of legacyTrackLayers()) layer.visible = false;
    if (rarGrassSceneRockMesh) rarGrassSceneRockMesh.visible = false;
  }


  function legacyTrackLayersEnabled() {
    return legacyTrackLayers().some(layer => layer.visible)
      || Boolean(rarGrassSceneRockMesh?.visible);
  }
  function countMeshes(target) {
    let count = 0;
    target?.traverse?.(object => { if (object?.isMesh) count += 1; });
    return count;
  }

  function updateActiveTrackScene() {
    if (!visualRoot || !collisionRoot) return false;
    const frame = track.sample(lastState.s);
    lastAuthoredFrame = Object.freeze({ x: frame.x, y: frame.y, z: frame.z, heading: frame.heading });
    return true;
  }

  function rebuildPhysicalRenderBridge() {
    physicalRenderBridge?.dispose();
    physicalRenderBridge = null;
    if (!playerVisualBody || !visualRoot || !collisionRoot) return null;
    const falcon = falconPhysicalBody && falconVisualRig
      ? {
        body: falconPhysicalBody,
        applyWheels(_previous, _current, _alpha, interpolated) {
          falconVisualRig.update(interpolated);
          updateExterior(falconPresentation,interpolated);
        },
      }
      : null;
    physicalRenderBridge = createPhysicalRenderBridge({
      player: { body: playerVisualBody, applyWheels(...args){playerWheelVisualRig?.applyWheels?.(...args);updateExterior(options.getPlayerPresentation?.(),args[3]);} },
      falcon,
      trackRoots: [visualRoot, collisionRoot],
    });
    return physicalRenderBridge;
  }

  function updatePhysicalVehicleVisuals(renderFrame = simulation.getRenderFrame(), reset = false) {
    if (!physicalRenderBridge) rebuildPhysicalRenderBridge();
    if (!physicalRenderBridge) return false;
    return reset
      ? physicalRenderBridge.reset(renderFrame)
      : physicalRenderBridge.apply(renderFrame);
  }

  function setAuthoredTrackVisuals(authored,{replace=false}={}) {
    raceWeatherEffects.setTrack({});
    if (visualRoot || collisionRoot) {
      if (!replace) throw new Error('Escena authored activa ya instalada');
      visualRoot?.removeFromParent?.();
      collisionRoot?.removeFromParent?.();
      visualRoot=null;
      collisionRoot=null;
      authoredCollisionProbe=null;
      authoredCollisionBridge=null;
      renderer?.renderLists?.dispose?.();
    }
    if (!authored?.visualRoot || !authored?.collisionRoot || !authored?.collisionProbe) {
      throw new Error('Escena authored activa incompleta');
    }
    visualRoot = authored.visualRoot;
    collisionRoot = authored.collisionRoot;
    authoredCollisionProbe = authored.collisionProbe;
    authoredCollisionBridge = null;
    visualRoot.name = 'ActiveTrackAuthoredVisual';
    collisionRoot.name = 'ActiveTrackAuthoredCollision';
    visualRoot.matrixAutoUpdate = false;
    collisionRoot.matrixAutoUpdate = false;
    collisionRoot.visible = false;
    scene.add(visualRoot);
    const fxAdapter = globalThis.__asfaltoV6Modular?.trackManager?.active;
    raceWeatherEffects.setTrack({id:fxAdapter?.id || track.id,visualRoot,materialBindings:fxAdapter?.getMaterialBindings?.() || []});
    disableLegacyTrackLayers();
    visualRoot.updateMatrixWorld?.(true);
    collisionRoot.updateMatrixWorld?.(true);
    updateActiveTrackScene();
    rebuildPhysicalRenderBridge();
    updatePhysicalVehicleVisuals(simulation.getRenderFrame(), true);
    return getAuthoredSceneDiagnostics();
  }

  function updateFalconVisual() {
    return updatePhysicalVehicleVisuals(simulation.getRenderFrame());
  }

  function setFalconVisualRig(rig) {
    if(falconVisualRig)throw new Error('Rig Falcon ya instalado');
    if(!visualRoot||!rig?.root||typeof rig.update!=='function')
      throw new Error('Rig Falcon incompleto');
    falconVisualRig=rig;
    falconVisualRig.root.name='FalconV6PhysicalVisual';
    falconPhysicalBody = new THREE.Group();
    falconPhysicalBody.name = 'FalconV6PhysicalBody';
    // The prepared Falcon and the physical chassis both use +X forward.
    falconVisualRig.root.rotation.y = 0;
    falconPhysicalBody.add(falconVisualRig.root);
    scene.add(falconPhysicalBody);
    rebuildPhysicalRenderBridge();
    updatePhysicalVehicleVisuals(simulation.getRenderFrame(), true);
    return true;
  }

  function normalizedEnvironmentSettings(value = settings) {
    const weather = ['cloudy', 'rain', 'storm', 'fog', 'light-snow', 'heavy-snow'].includes(value.weather)
      ? value.weather : 'clear';
    return legacySettingsForEnvironmentPreset(environmentPresetForLegacySettings(value), { weather });
  }

  function trackEnvironmentDefault(trackId, adapter = globalThis.__asfaltoV6Modular?.trackManager?.active) {
    const manifestDefault = adapter?.id === trackId ? adapter.environmentProfile?.defaultPreset : null;
    const presetId = manifestDefault || TRACK_ENVIRONMENT_DEFAULTS[trackId];
    if (!presetId) throw new RangeError('Missing track environment default: ' + trackId);
    return presetId;
  }

  function applyEnvironmentPresetToSettings(presetId) {
    const legacy = legacySettingsForEnvironmentPreset(presetId, settings);
    settings.skyId = legacy.skyId;
    settings.timeOfDay = legacy.timeOfDay;
    if (ui.environmentPreset) ui.environmentPreset.value = presetId;
    if (ui.weather) ui.weather.value = settings.weather;
    if (ui.timeOfDay) ui.timeOfDay.value = settings.timeOfDay;
    return presetId;
  }

  const regionalPresetByLegacyId = Object.freeze({
    clear_day: 'clear', overcast_day: 'overcast', golden_hour: 'golden-hour',
    sunset: 'sunset', moonrise: 'moonrise', dark_night: 'night',
  });
  const adapterPresetByRegionalId = Object.freeze({ 'golden-hour': 'golden' });

  function resolveRaceEnvironmentPreset(requested) {
    const core = globalThis.AsfaltoV5EnvironmentCore;
    const base = core.getEnvironmentPreset(core.chooseEnvironmentPreset(requested));
    const adapter = globalThis.__asfaltoV6Modular?.trackManager?.active;
    if (!adapter?.ready) return { ...core.selectPreset(requested), ...resolveRaceLighting(base.hdri) };
    const resolved = resolveEnvironment(adapter.id, requested.skyId, requested.weather);
    return { ...base, ...resolveRaceLighting(base.hdri), precipitation: resolved.precipitation, precipitationIntensity: resolved.precipitationIntensity, roadWetness: resolved.roadWetness,
      headlights: base.headlights || resolved.headlightPolicy === 'required',
      fogDensity: resolved.fog.density };
  }

  async function applyRegionalEnvironment(legacyPresetId, requested = normalizedEnvironmentSettings()) {
    const adapter = globalThis.__asfaltoV6Modular?.trackManager?.active;
    if (!adapter?.ready) return null;
    const presetId = regionalPresetByLegacyId[legacyPresetId];
    if (!presetId) throw new RangeError('Invalid regional environment preset: ' + legacyPresetId);
    const nextEnvironment = resolveEnvironment(adapter.id, presetId, requested.weather);
    const nextCondition = resolveSurfaceCondition({
      baseSurface: { kind: 'asphalt', mu: 1 },
      trackProfile: getTrackEnvironmentPolicy(adapter.id),
      preset: nextEnvironment,
      temperatureC: nextEnvironment.temperatureC,
    });
    const adapterPreset = adapterPresetByRegionalId[presetId] || presetId;
    const previous = Object.freeze({
      adapterId: adapter.id,
      adapterPreset: adapter.getDiagnostics?.().environment || null,
      environment: regionalEnvironment,
      surfaceCondition: regionalSurfaceCondition,
      materialController: trackMaterialController,
      materialControllerTrackId: trackMaterialControllerTrackId,
      wetMaterialCount,
    });
    const reusesMaterialController = previous.materialController
      && previous.materialControllerTrackId === adapter.id;
    const candidateMaterialController = reusesMaterialController
      ? previous.materialController
      : createTrackMaterialController(adapter);
    let rolledBack = false;
    async function rollback() {
      if (rolledBack) return false;
      rolledBack = true;
      const failures = [];
      if (adapter.ready && previous.adapterId === adapter.id && previous.adapterPreset) {
        try { await adapter.applyEnvironment(previous.adapterPreset); }
        catch (error) { failures.push(error); }
      }
      if (reusesMaterialController && previous.environment) {
        try { previous.materialController.apply(previous.environment); }
        catch (error) { failures.push(error); }
      }
      if (!reusesMaterialController) candidateMaterialController?.dispose?.();
      trackMaterialController = previous.materialController;
      trackMaterialControllerTrackId = previous.materialControllerTrackId;
      wetMaterialCount = previous.wetMaterialCount;
      regionalEnvironment = previous.environment;
      regionalSurfaceCondition = previous.surfaceCondition;
      if (failures.length) {
        throw new AggregateError(failures, 'regional environment rollback failed');
      }
      return true;
    }
    try {
      await adapter.applyEnvironment(adapterPreset);
      const nextWetMaterialCount = candidateMaterialController.apply(nextEnvironment);
      trackMaterialController = candidateMaterialController;
      trackMaterialControllerTrackId = adapter.id;
      wetMaterialCount = nextWetMaterialCount;
      regionalEnvironment = nextEnvironment;
      regionalSurfaceCondition = nextCondition;
      return Object.freeze({
        environment: nextEnvironment,
        surfaceCondition: nextCondition,
        rollback,
        commit() {
          if (!reusesMaterialController) previous.materialController?.dispose?.();
        },
      });
    } catch (error) {
      try {
        await rollback();
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'regional environment apply and rollback failed',
          { cause: error },
        );
      }
      throw error;
    }
  }

  function createRaceHdriTexture(validated, id) {
    return globalThis.AsfaltoV5EnvironmentCore.createEnvironmentDataTexture(
      THREE, validated, id,
    );
  }

  const externalHdriId = id => id === 'golden' ? 'golden-hour' : id;
  const externalHdriCatalogUrl = new URL('../../assets/skies/catalog.json', import.meta.url).href;
  async function decodeRaceHdri(id) {
    const cached = environmentDecodedCache.get(id);
    if (cached) {
      environmentCacheCounters.hits += 1;
      return createRaceHdriTexture(cached, id);
    }
    environmentCacheCounters.misses += 1;
    const payload = await loadHdriPreset(externalHdriId(id), { catalogUrl: externalHdriCatalogUrl });
    const componentCount = payload.width * payload.height * 3;
    if (payload.pixels.byteLength !== componentCount * 2) throw new Error('Invalid external HDRI payload: ' + id);
    const view = new DataView(payload.pixels.buffer, payload.pixels.byteOffset, payload.pixels.byteLength);
    const rgb = new Uint16Array(componentCount);
    for (let index = 0; index < componentCount; index += 1) rgb[index] = view.getUint16(index * 2, true);
    const validated = Object.freeze({ width: payload.width, height: payload.height, rgb: orientHdriRows(rgb, payload.width, payload.height), sourceSha256: payload.sourceSha256 });
    environmentDecodedCache.set(id, validated);
    return createRaceHdriTexture(validated, id);
  }

  function buildRacePmrem(source) {
    environmentPmremCache ||= createPmremCache({maxIdle:runtimeDeviceProfile.phone?1:2,build:source=>{
      const start=performance.now();environmentPmremGenerator ||= new THREE.PMREMGenerator(renderer);
      environmentPmremGenerator.compileEquirectangularShader?.();
      const target=environmentPmremGenerator.fromEquirectangular(source);
      if(target?.texture)target.texture.name='AsfaltoV5_PMREM_'+source.name.replace('AsfaltoV5_HDRI_','');
      environmentBuildTimings.push({source:source.name,ms:performance.now()-start});if(environmentBuildTimings.length>32)environmentBuildTimings.shift();return target;
    }});
    const key=source.name+'|'+source.image.width+'x'+source.image.height+'|'+!!source.userData.asfaltoHdriHalfTurn;
    return environmentPmremCache.acquire(key,source);
  }

  function setNamedEnvironmentLights(rootTarget, expression, enabled, seenObjects, seenMaterials) {
    let count = 0;
    rootTarget?.traverse?.((object) => {
      const objectName = String(object?.name || '');
      if (object?.isLight && expression.test(objectName) && !seenObjects.has(object)) {
        seenObjects.add(object);
        object.userData ||= {};
        if (!Object.prototype.hasOwnProperty.call(object.userData, 'v5EnvironmentIntensity')) {
          object.userData.v5EnvironmentIntensity = object.intensity;
        }
        object.intensity = enabled ? object.userData.v5EnvironmentIntensity : 0;
        object.visible = enabled;
        count += 1;
      }
      if (!object?.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material || seenMaterials.has(material)
            || !expression.test(String(material.name || objectName))) continue;
        seenMaterials.add(material);
        material.userData ||= {};
        if (!Object.prototype.hasOwnProperty.call(material.userData, 'v5EnvironmentEmissiveIntensity')) {
          material.userData.v5EnvironmentEmissiveIntensity =
            Number.isFinite(material.emissiveIntensity) ? material.emissiveIntensity : 1;
        }
        if ('emissiveIntensity' in material) {
          material.emissiveIntensity =
            enabled ? material.userData.v5EnvironmentEmissiveIntensity : 0;
        }
        // emissiveIntensity is a uniform; its shader program is unchanged.
        count += 1;
      }
    });
    return count;
  }

  function applyExistingLightingSystems(preset) {
    const seenObjects = new Set();
    const seenMaterials = new Set();
    const headlightExpression = /headlight|headlamp|faro/i;
    const artificialExpression = /street.?light|lamp|luz|poste/i;
    const headlightObjects = setNamedEnvironmentLights(
      cockpit, headlightExpression, preset.headlights, seenObjects, seenMaterials,
    ) + setNamedEnvironmentLights(
      visualRoot, headlightExpression, preset.headlights, seenObjects, seenMaterials,
    );
    const artificialLightObjects = setNamedEnvironmentLights(
      visualRoot, artificialExpression, preset.artificialLights, seenObjects, seenMaterials,
    );
    environmentLightingState = Object.freeze({
      headlights: preset.headlights,
      artificialLights: preset.artificialLights,
      headlightObjects,
      artificialLightObjects,
    });
  }

  function collectEnvironmentLights(rootTarget, expression, output) {
    rootTarget?.traverse?.((object) => {
      if (!object?.isLight || !expression.test(String(object.name || '')) || output.includes(object)) return;
      object.userData ||= {};
      object.userData.v5EnvironmentIntensity =
        Number.isFinite(object.intensity) && object.intensity > 0 ? object.intensity : 1;
      output.push(object);
    });
  }

  function effectiveVisibilityDetails(object) {
    const ancestors = [];
    for (let current = object; current; current = current.parent) {
      ancestors.push(Object.freeze({ name: current.name || current.type || '', visible: current.visible !== false }));
      if (current.visible === false) return Object.freeze({ effectiveVisible: false, ancestors: Object.freeze(ancestors) });
    }
    return Object.freeze({ effectiveVisible: true, ancestors: Object.freeze(ancestors) });
  }

  function syncEnvironmentRigToVehicle() {
    if (!environmentRigRoot) return;
    // The simulation keeps the Chevy fixed at scene origin and moves the authored track around it.
    // Keep lighting in that physical vehicle frame, independent from v5 cockpit composition tuning.
    environmentRigRoot.matrix.identity();
    environmentRigRoot.matrixWorldNeedsUpdate = true;
    environmentRigRoot.updateMatrixWorld(true);
  }

  function environmentRigFollowsVehicle() {
    if (!environmentRigRoot || environmentRigRoot.parent !== scene) return false;
    syncEnvironmentRigToVehicle();
    const vehicleMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return environmentRigRoot.matrix.elements.every(
      (value, index) => Math.abs(value - vehicleMatrix[index]) <= 1e-6,
    );
  }

  function createEnvironmentLightRig() {
    const headlightExpression = /headlight|headlamp|faro/i;
    const artificialExpression = /street.?light|lamp|luz|poste/i;
    collectEnvironmentLights(cockpit, headlightExpression, environmentHeadlights);
    collectEnvironmentLights(visualRoot, headlightExpression, environmentHeadlights);
    collectEnvironmentLights(visualRoot, artificialExpression, environmentArtificialLights);
    if (environmentHeadlights.length === 0) {
      environmentRigRoot = new THREE.Group();
      environmentRigRoot.name = 'AsfaltoV5_EnvironmentHeadlightRig';
      environmentRigRoot.matrixAutoUpdate = false;
      scene.add(environmentRigRoot);
      syncEnvironmentRigToVehicle();
      environmentRigCreations += 1;
      for (const x of [-0.46, 0.46]) {
        const light = new THREE.SpotLight('#fff3d6', 0, 150, Math.PI / 7, 0.38, 1.15);
        light.name = 'AsfaltoV5_Headlight_' + (x < 0 ? 'L' : 'R');
        light.position.set(x, -0.55, -1.10);
        light.userData.v5EnvironmentIntensity = 130;
        light.visible = false;
        const target = new THREE.Object3D();
        target.name = light.name + '_Target';
        target.position.set(x * 0.35, -1.15, -42);
        environmentRigRoot.add(light, target);
        light.target = target;
        environmentHeadlights.push(light);
        environmentCreatedLights.push(light, target);
      }
    }
    if (environmentArtificialLights.length === 0) {
      const light = new THREE.PointLight('#ffd28a', 0, 55, 1.8);
      light.name = 'AsfaltoV5_ArtificialLight';
      light.position.set(0, 7.5, -10);
      light.userData.v5EnvironmentIntensity = 3.0;
      light.visible = false;
      scene.add(light);
      environmentArtificialLights.push(light);
      environmentCreatedLights.push(light);
    }
    refreshEnvironmentLightingState();
  }

  function refreshEnvironmentLightingState() {
    syncEnvironmentRigToVehicle();
    const visible = lights => lights.filter(
      light => light.intensity > 0 && effectiveVisibilityDetails(light).effectiveVisible,
    );
    const headlights=activeHeadlightObjects();
    const headlightVisible = visible(headlights);
    const artificialLightVisible = visible(environmentArtificialLights);
    environmentLightingState = Object.freeze({
      headlights: headlightVisible.length > 0,
      artificialLights: artificialLightVisible.length > 0,
      headlightObjects: headlights.length,
      artificialLightObjects: environmentArtificialLights.length,
      headlightVisible: headlightVisible.length,
      artificialLightVisible: artificialLightVisible.length,
      headlightIntensity: headlightVisible.reduce((sum, light) => sum + light.intensity, 0),
      artificialLightIntensity: artificialLightVisible.reduce((sum, light) => sum + light.intensity, 0),
      headlightTargetsParented: headlights.every(
        light => !light.isSpotLight || Boolean(light.target?.parent),
      ),
      environmentRigParent: environmentRigRoot?.parent === scene ? 'scene' : environmentRigRoot?.parent?.name || null,
      environmentRigFollowsVehicle: environmentRigFollowsVehicle(),
      effectiveVisibilityMeasured: true,
    });
  }

  function applyEnvironmentLightState(preset) {
    environmentLightRequest=preset;drivingLights.setEnvironment(preset.headlights);const mode=drivingLights.getState().mode,projected=options.getPlayerPresentation?.()?.getLightingDiagnostics?.().projectorsActive;const beam=(mode==='low'||mode==='high')&&!projected;
    for (const light of environmentHeadlights) {
      light.color?.set?.('#fff3d6');
      light.intensity = beam ? light.userData.v5EnvironmentIntensity*(mode==='high'?1.8:1) : 0;
      light.visible = beam && light.intensity > 0;
    }
    for (const light of environmentArtificialLights) {
      light.color?.set?.('#ffd28a');
      const enabled = preset.artificialLights && !(preset.syntheticArtificialLight === false && light.name === 'AsfaltoV5_ArtificialLight');
      light.intensity = enabled ? light.userData.v5EnvironmentIntensity : 0;
      light.visible = enabled && light.intensity > 0;
    }
    refreshEnvironmentLightingState();
  }

  function environmentIdentity(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object' && typeof value !== 'function') return String(value);
    if (value.uuid) return 'uuid:' + value.uuid;
    if (!environmentObjectIds.has(value)) {
      environmentObjectIds.set(value, 'object:' + (++environmentObjectId));
    }
    return environmentObjectIds.get(value);
  }

  function readEnvironmentRoadRoughness() {
    const materials = new Set();
    visualRoot?.traverse?.((object) => {
      if (!object?.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material && /asphalt|road/i.test(material.name || '')) materials.add(material);
      }
    });
    return [...materials].map(material => Object.freeze({
      identity: environmentIdentity(material),
      name: material.name || '',
      roughness: material.roughness,
      dryRoughness: material.userData?.v5DryRoughness ?? material.roughness,
    }));
  }

  // Physics needs surface conditions, not renderer ownership/material diagnostics.
  // Keep this live so weather changes take effect on the very next fixed step.
  function readEnvironmentSimulationState() {
    const dynamic=raceDayActive&&environmentOwner==='race'?raceDayEnvironment:null;
    return {regionalEnvironment:dynamic||regionalEnvironment,surfaceCondition:dynamic?.surfaceCondition||regionalSurfaceCondition,rain:{visible:dynamic?['rain','storm'].includes(dynamic.precipitation):rain.visible,intensity:dynamic?(['rain','storm'].includes(dynamic.precipitation)?dynamic.precipitationIntensity:0):rainUniforms.uIntensity.value}};
  }

  function readEnvironmentPhysicalState() {
    const lights = [...environmentHeadlights, ...environmentArtificialLights];
    return Object.freeze({
      background: environmentIdentity(scene.background),
      environment: environmentIdentity(scene.environment),
      fog: scene.fog ? Object.freeze({
        identity: environmentIdentity(scene.fog),
        color: '#' + scene.fog.color.getHexString(),
        density: scene.fog.density,
      }) : null,
      backgroundIntensity: scene.backgroundIntensity ?? null,
      environmentIntensity: scene.environmentIntensity ?? null,
      backgroundRotation: scene.backgroundRotation?.y ?? 0,
      environmentRotation: scene.environmentRotation?.y ?? 0,
      exposure: renderer.toneMappingExposure,
      keyLight: Object.freeze({
        color: '#' + keyLight.color.getHexString(),
        intensity: keyLight.intensity,
        direction: Object.freeze(keyLight.position.toArray()),
        visible: keyLight.visible,
      }),
      supportLights: Object.freeze([hemi, fillLight, rimLight].map((light, index) => Object.freeze({role: ['hemi','fill','rim'][index], color: '#' + light.color.getHexString(), groundColor: light.groundColor ? '#' + light.groundColor.getHexString() : null, intensity: light.intensity, position: Object.freeze(light.position.toArray()), visible: light.visible}))),
      skyVisible: sky.visible,
      rain: Object.freeze({
        visible: rain.visible,
        intensity: rainUniforms.uIntensity.value,
      }),
      regionalEnvironment:raceDayActive?raceDayEnvironment:regionalEnvironment,
      surfaceCondition:raceDayActive?raceDayEnvironment?.surfaceCondition:regionalSurfaceCondition,
      roadRoughness: Object.freeze(readEnvironmentRoadRoughness()),
      environmentLightDetails: Object.freeze(lights.map(light => { const visibility = effectiveVisibilityDetails(light); return Object.freeze({ name: light.name || '', type: light.type || '', position: Object.freeze(light.position?.toArray?.() || []), targetPosition: Object.freeze(light.target?.position?.toArray?.() || []), intensity: light.intensity, visible: light.visible, effectiveVisible: visibility.effectiveVisible, ancestors: visibility.ancestors, distance: light.distance ?? null, angle: light.angle ?? null, penumbra: light.penumbra ?? null, decay: light.decay ?? null }); })),
      lights: Object.freeze(lights.map(light => Object.freeze({
        identity: environmentIdentity(light),
        name: light.name || '',
        color: light.color ? '#' + light.color.getHexString() : null,
        intensity: light.intensity,
        visible: light.visible,
        effectiveVisible: effectiveVisibilityDetails(light).effectiveVisible,
      }))),
    });
  }


  function captureEnvironmentBaseline() {
    if (environmentBaseline) return environmentBaseline;
    const lights = [...environmentHeadlights, ...environmentArtificialLights];
    environmentBaseline = {
      background: scene.background,
      environment: scene.environment,
      fog: scene.fog,
      backgroundIntensity: scene.backgroundIntensity,
      environmentIntensity: scene.environmentIntensity,
      backgroundRotation: scene.backgroundRotation?.y ?? 0,
      environmentRotation: scene.environmentRotation?.y ?? 0,
      exposure: renderer.toneMappingExposure,
      keyColor: keyLight.color.clone(),
      keyIntensity: keyLight.intensity,
      keyPosition: keyLight.position.clone(),
      keyVisible: keyLight.visible,
      supportLights: [hemi, fillLight, rimLight].map(light => ({light, intensity:light.intensity, visible:light.visible})),
      skyVisible: sky.visible,
      rainVisible: rain.visible,
      rainIntensity: rainUniforms.uIntensity.value,
      snowFactor: rainUniforms.uSnow.value,
      lights: lights.map(light => ({
        light,
        color: light.color?.clone?.() || null,
        intensity: light.intensity,
        visible: light.visible,
      })),
    };
    environmentBaselineCaptures += 1;
    environmentCapturedBaselineSnapshot = readEnvironmentPhysicalState();
    return environmentBaseline;
  }

  function restoreEnvironmentBaseline() {
    if (!environmentBaseline) return;
    const baseline = environmentBaseline;
    scene.background = baseline.background;
    scene.environment = baseline.environment;
    scene.fog = baseline.fog;
    if ('backgroundIntensity' in scene) scene.backgroundIntensity = baseline.backgroundIntensity;
    if ('environmentIntensity' in scene) scene.environmentIntensity = baseline.environmentIntensity;
    if (scene.backgroundRotation) scene.backgroundRotation.y = baseline.backgroundRotation;
    if (scene.environmentRotation) scene.environmentRotation.y = baseline.environmentRotation;
    renderer.toneMappingExposure = baseline.exposure;
    keyLight.color.copy(baseline.keyColor);
    keyLight.intensity = baseline.keyIntensity;
    keyLight.position.copy(baseline.keyPosition);
    keyLight.visible = baseline.keyVisible;
    for (const state of baseline.supportLights) { state.light.intensity = state.intensity; state.light.visible = state.visible; }
    sky.visible = baseline.skyVisible;
    rain.visible = baseline.rainVisible;
    rainUniforms.uIntensity.value = baseline.rainIntensity;
    rainUniforms.uSnow.value = baseline.snowFactor;
    wetMaterialCount = globalThis.AsfaltoV5EnvironmentCore.applyTrackWetness(visualRoot, 0);
    for (const state of baseline.lights) {
      state.light.color?.copy?.(state.color);
      state.light.intensity = state.intensity;
      state.light.visible = state.visible;
    }
    environmentOwner = 'baseline';
    environmentRotation = 0;
    refreshEnvironmentLightingState();
    environmentBaselineRestores += 1;
    environmentLastRestoreSnapshot = readEnvironmentPhysicalState();
  }

  function disposeEnvironmentLightRig() {
    if (environmentCreatedLights.length > 0 || environmentRigRoot) {
      environmentRigDisposals += 1;
    }
    for (const object of environmentCreatedLights) object.parent?.remove?.(object);
    environmentCreatedLights.length = 0;
    environmentHeadlights.length = 0;
    environmentArtificialLights.length = 0;
    environmentRigRoot?.parent?.remove?.(environmentRigRoot);
    environmentRigRoot = null;
    refreshEnvironmentLightingState();
  }

  function applyPrecipitationState(state) {
    const snow = ['light-snow', 'heavy-snow'].includes(state.precipitation);
    rain.visible = false; // Replaced by world-space precipitation quads.
    rainUniforms.uIntensity.value = state.precipitationIntensity ?? 0;
    rainUniforms.uSnow.value = snow ? 1 : 0;
  }

  function applyEnvironmentScene(state) {
    releaseRaceDayCycle();
    lightingEditor?.beforePreset();
    if (!state) return restoreEnvironmentBaseline();
    captureEnvironmentBaseline();
    const preset = state.preset;
    scene.background = state.source;
    scene.environment = state.environment;
    if ('backgroundIntensity' in scene) scene.backgroundIntensity = preset.backgroundIntensity ?? preset.environmentIntensity;
    if ('environmentIntensity' in scene) scene.environmentIntensity = preset.environmentIntensity;
    renderer.toneMappingExposure = preset.exposure;
    keyLight.color.set(preset.keyLightColor);
    keyLight.intensity = preset.keyLightIntensity;
    keyLight.position.fromArray(preset.keyLightDirection);
    // Zero intensity keeps night dark without compiling a different light-count shader.
    keyLight.visible = true;
    applyRaceLightingSupport([hemi, fillLight, rimLight], preset);
    scene.fog = new THREE.FogExp2(new THREE.Color(preset.fogColor), preset.fogDensity);
    sky.visible = false;
    applyPrecipitationState(preset);
    wetMaterialCount = globalThis.AsfaltoV5EnvironmentCore.applyTrackWetness(
      visualRoot, preset.roadWetness, { skip: true },
    );
    applyEnvironmentLightState(preset);
  }

  createEnvironmentLightRig();
  lightingEditor=createLightingEditor({scene,renderer,
    getEffectiveFogState:()=>raceWeatherEffects.getEffectiveFogState(regionalEnvironment),
    getLights:()=>[{id:'key',label:'Luz principal',object:keyLight},{id:'hemi',label:'Ambiente hemisférico',object:hemi},{id:'fill',label:'Luz de relleno',object:fillLight},{id:'rim',label:'Contraluz',object:rimLight},...environmentArtificialLights.map((object,index)=>({id:'point-'+index,label:'Luz puntual '+(index+1),object}))],
    getVehicles:()=>({player:globalThis.__asfaltoVehiclePresentations?.chevy,rival:globalThis.__asfaltoVehiclePresentations?.falcon}),
    setLut:value=>colorGrading?.setSettings(value),
  });
  const environmentController = globalThis.AsfaltoV5EnvironmentCore.createEnvironmentController({
    decodeHdri: decodeRaceHdri,
    buildPmrem: buildRacePmrem,
    applyScene: applyEnvironmentScene,
    resolvePreset: resolveRaceEnvironmentPreset,
  });

  raceSkyTransition=createHdriTransition(THREE,{scene,renderer,keyLight,loadSource:decodeRaceHdri,buildPmrem:buildRacePmrem});
  function releaseRaceDayCycle(){raceDayPrepareToken++;raceSkyTransition?.release();raceDayActive=false;raceDayEnvironment=null;raceDayBase=null;raceDayPalette=null;raceWeatherCycle=null;}
  function getRaceRenderEnvironment(){return raceDayActive&&environmentOwner==='race'&&raceDayEnvironment?raceDayEnvironment:(regionalEnvironment||{});}
  async function prepareRaceDayCycle(){
    releaseRaceDayCycle();const token=raceDayPrepareToken;raceDayClock.reset(settings.skyId);
    if(!raceDayClock.diagnostics().enabled||environmentOwner!=='race'||environmentHostDisposed)return false;
    const ready=await raceSkyTransition.prepare(raceDayClock.state,{skyId:settings.skyId});
    if(token!==raceDayPrepareToken||environmentHostDisposed)return false;
    raceDayActive=ready;if(ready)updateRaceDayCycle(0);return ready;
  }
  function updateRaceDayCycle(dt){
    if(!raceDayActive||environmentOwner!=='race')return;
    const active=document.body.classList.contains('v6-driving')&&!document.body.classList.contains('v6-menu-open')&&!document.body.classList.contains('an-intro-open');
    const state=raceDayClock.update({dt,status:simulation.state.status,active});
    if(!raceSkyTransition.update({state,dt,quality:performanceState.qualityTier}))return;
    if(regionalEnvironment&&(raceDayBase!==regionalEnvironment||!raceDayPalette)){raceDayBase=regionalEnvironment;raceDayPalette=createRaceDayEnvironment(THREE,regionalEnvironment);raceWeatherCycle=createRaceWeatherCycle({trackId:regionalEnvironment.trackId,skyId:regionalEnvironment.presetId,weatherId:regionalEnvironment.weatherId,allowEvolution:!simulation.getChampionshipClassification?.()});}
    if(raceDayPalette)raceDayEnvironment=raceDayPalette.update(state,raceWeatherCycle.update({clock:state}));
    const required=state.nightFactor>.12||['rain','storm','fog','light-snow','heavy-snow'].includes(raceDayEnvironment?.weatherId||settings.weather);
    if(environmentLightRequest&&environmentLightRequest.headlights!==required)applyEnvironmentLightState({...environmentLightRequest,headlights:required});
  }
  async function setDayCycleOptions(options={}, {persist=true}={}){const result=raceDayClock.setOptions(options);if(('enabled'in options||'durationSeconds'in options)&&persist)reflectRaceDayCycleOptions(result,{document,storage});if(!result.enabled)releaseRaceDayCycle();else if(!raceDayActive&&['RUNNING','COUNTDOWN','PAUSED'].includes(simulation.state.status))await prepareRaceDayCycle();return raceDayClock.diagnostics();}

  function environmentCacheDiagnostics() {
    let bytes = 0;
    for (const cached of environmentDecodedCache.values()) bytes += cached.rgb.byteLength;
    return Object.freeze({ entries: environmentDecodedCache.size, bytes, hits: environmentCacheCounters.hits, misses: environmentCacheCounters.misses, source: 'external-av3hdri' });
  }

  function getEnvironmentDiagnostics() {
    refreshEnvironmentLightingState();
    const diagnostics = environmentController.getDiagnostics();
    return Object.freeze({
      environmentPreset: diagnostics.preset,
      environmentSource: diagnostics.source,
      environmentSourcePath: diagnostics.sourcePath,
      pmremActive: diagnostics.pmremActive && scene.environment != null,
      environmentDisposed: diagnostics.disposed,
      environmentBackgroundName: scene.background?.name || null,
      environmentTextureName: scene.environment?.name || null,
      environmentBackgroundIdentity: scene.background?.uuid || scene.background?.name || null,
      environmentTextureIdentity: scene.environment?.uuid || scene.environment?.name || null,
      environmentFog: scene.fog ? Object.freeze({ color: '#' + scene.fog.color.getHexString(), density: scene.fog.density }) : null,
      environmentKeyLight: Object.freeze({
        color: '#' + keyLight.color.getHexString(),
        intensity: keyLight.intensity,
        direction: Object.freeze(keyLight.position.toArray()),
        visible: keyLight.visible,
      }),
      environmentSupportLights: Object.freeze([hemi, fillLight, rimLight].map((light,index) => Object.freeze({role:['hemi','fill','rim'][index],color:'#'+light.color.getHexString(),groundColor:light.groundColor?'#'+light.groundColor.getHexString():null,intensity:light.intensity,position:Object.freeze(light.position.toArray()),visible:light.visible}))),
      environmentLightingPolicy: 'hdri-scene-v1',
      environmentExposure: renderer.toneMappingExposure,
      environmentBackgroundIntensity: scene.backgroundIntensity,
      environmentIntensity: scene.environmentIntensity,
      environmentOwner,
      environmentRotation,
      headlights: environmentLightingState.headlights,
      artificialLights: environmentLightingState.artificialLights,
      headlightObjects: environmentLightingState.headlightObjects,
      artificialLightObjects: environmentLightingState.artificialLightObjects,
      headlightVisible: environmentLightingState.headlightVisible,
      artificialLightVisible: environmentLightingState.artificialLightVisible,
      headlightIntensity: environmentLightingState.headlightIntensity,
      artificialLightIntensity: environmentLightingState.artificialLightIntensity,
      environmentRigParent: environmentLightingState.environmentRigParent,
      environmentRigFollowsVehicle: environmentLightingState.environmentRigFollowsVehicle,
      environmentVehicleFrame: 'scene_origin_track_relative_vehicle',
      environmentRigMatrixWorld: Object.freeze(environmentRigRoot?.matrixWorld?.toArray?.() || []),
      effectiveVisibilityMeasured: environmentLightingState.effectiveVisibilityMeasured,
      headlightTargetsParented: environmentLightingState.headlightTargetsParented,
      environmentRigObjects: environmentRigRoot?.parent ? 1 : 0,
      environmentLifecycle: Object.freeze({
        baselineCaptures: environmentBaselineCaptures,
        baselineRestores: environmentBaselineRestores,
        rigCreations: environmentRigCreations,
        rigDisposals: environmentRigDisposals,
      }),
      environmentPhysicalState: readEnvironmentPhysicalState(),
      environmentBaselineState: environmentCapturedBaselineSnapshot,
      environmentLastRestoreState: environmentLastRestoreSnapshot,
      environmentRain: Object.freeze({
        visible: rain.visible,
        intensity: rainUniforms.uIntensity.value,
      }),
      precipitation: raceDayActive?raceDayEnvironment?.precipitation:diagnostics.precipitation,
      roadWetness: raceDayActive?raceDayEnvironment?.roadWetness:diagnostics.wetness,
      wetMaterials: wetMaterialCount,
      regionalEnvironment,
      surfaceCondition: regionalSurfaceCondition,
      environmentCache: environmentCacheDiagnostics(),
      dayCycle: Object.freeze({...raceDayClock.diagnostics(),active:raceDayActive,resources:raceSkyTransition?.diagnostics()}),
      environmentRequests: diagnostics.requests,
      environmentResources: diagnostics.resources,
      environmentDisposals: diagnostics.disposals,
      environmentState: environmentSyncState,
      environmentErrors: Object.freeze([...environmentSyncErrors]),
    });
  }

  function reportEnvironmentSyncError(error) {
    const message = String(error?.message || error);
    if (!environmentSyncErrors.includes(message)) environmentSyncErrors.push(message);
    environmentSyncState = 'error';
    console.error('[Asfalto v5 environment]', error);
  }

  function mirrorEnvironmentToWorkshop(runtime = environmentWorkshopRuntime) {
    if (!runtime?.loaded || !runtime.scene || !runtime.renderer) return;
    environmentWorkshopRuntime = runtime;
    runtime.scene.background = scene.background;
    runtime.scene.environment = scene.environment;
    if ('backgroundIntensity' in runtime.scene) runtime.scene.backgroundIntensity = scene.backgroundIntensity;
    if ('environmentIntensity' in runtime.scene) runtime.scene.environmentIntensity = scene.environmentIntensity;
    runtime.renderer.toneMappingExposure = renderer.toneMappingExposure;
    if (runtime.scene.backgroundRotation) runtime.scene.backgroundRotation.y = environmentRotation;
    if (runtime.scene.environmentRotation) runtime.scene.environmentRotation.y = environmentRotation;
  }

  async function syncEnvironment({prepareCycle=true}={}) {
    const pendingWorkshop = workshopEnvironmentPromise;
    workshopEnvironmentToken += 1;
    workshopEnvironmentSignature = null;
    workshopEnvironmentPromise = null;
    if (pendingWorkshop) environmentController.cancelPending();
    environmentOwner = 'race';
    environmentRotation = 0;
    if (scene.backgroundRotation) scene.backgroundRotation.y = 0;
    if (scene.environmentRotation) scene.environmentRotation.y = 0;
    mirrorEnvironmentToWorkshop();
    const requested = normalizedEnvironmentSettings(settings);
    const activeTrackId = globalThis.__asfaltoV6Modular?.trackManager?.active?.id || track?.id || 'unknown';
    const signature = activeTrackId + '|' + globalThis.AsfaltoV5EnvironmentCore.getEnvironmentStateSignature(requested);
    if (environmentOwner === 'race' && environmentSettingsSignature === signature && !environmentSyncPromise) {
      lightingEditor?.reapply();
      environmentSyncState = 'ready';
      return environmentController.getDiagnostics();
    }
    if (environmentPendingSignature === signature && environmentSyncPromise) {
      return environmentSyncPromise;
    }
    environmentPendingSignature = signature;
    environmentSyncErrors.length = 0;
    environmentSyncState = 'loading';
    const pending = environmentController.apply(requested, {
      contextKey: activeTrackId,
      beforeCommit: async ({ id, settings: requestSettings }) => {
        const transaction = await applyRegionalEnvironment(id, requestSettings);
        return transaction ? {
          rollback: transaction.rollback,
          commit: transaction.commit,
        } : null;
      },
    });
    environmentSyncPromise = pending;
    try {
      const diagnostics = await pending;
      if (environmentPendingSignature === signature && environmentSyncPromise === pending) {
        environmentSettingsSignature = signature;
        environmentOwner = 'race';
        environmentRotation = 0;
        if (scene.backgroundRotation) scene.backgroundRotation.y = 0;
        if (scene.environmentRotation) scene.environmentRotation.y = 0;
        lightingEditor?.setContext({trackId:activeTrackId,skyId:requested.skyId,weather:requested.weather,trackLabel:track.name});
        environmentRotation=scene.environmentRotation?.y||0;
        mirrorEnvironmentToWorkshop();
      }
      if (environmentSyncPromise === pending) {environmentSyncState = 'ready';if(prepareCycle&&['RUNNING','COUNTDOWN','PAUSED'].includes(simulation.state.status)&&environmentOwner==='race')await prepareRaceDayCycle();}
      return diagnostics;
    } catch (error) {
      if (environmentSyncPromise === pending) reportEnvironmentSyncError(error);
      throw error;
    } finally {
      if (environmentSyncPromise === pending) {
        environmentPendingSignature = null;
        environmentSyncPromise = null;
      }
    }
  }

  const environmentSelectionState = { revision: 0, pending: 0, committed: null };
  function beginEnvironmentSelection() {
    const capture = () => ({ skyId: settings.skyId, weather: settings.weather, timeOfDay: settings.timeOfDay });
    if (environmentSelectionState.pending === 0) environmentSelectionState.committed = capture();
    const revision = ++environmentSelectionState.revision;
    environmentSelectionState.pending++;
    let ended = false;
    const isCurrent = () => revision === environmentSelectionState.revision;
    return {
      isCurrent,
      previous: () => ({ ...environmentSelectionState.committed }),
      commit() { if (isCurrent()) environmentSelectionState.committed = capture(); },
      rollback() {
        if (!isCurrent()) return false;
        Object.assign(settings, environmentSelectionState.committed);
        if (ui.environmentPreset) ui.environmentPreset.value = settings.skyId;
        if (ui.weather) ui.weather.value = settings.weather;
        if (ui.timeOfDay) ui.timeOfDay.value = settings.timeOfDay;
        return true;
      },
      finish() {
        if (ended) return;
        ended = true;
        environmentSelectionState.pending--;
        if (environmentSelectionState.pending === 0) environmentSelectionState.committed = null;
      },
    };
  }
  async function selectEnvironmentPreset(presetId, { announce = true, weather = settings.weather } = {}) {
    const transition = beginEnvironmentSelection();
    try {
      applyEnvironmentPresetToSettings(presetId);
      settings.weather = weather;
      if (ui.weather) ui.weather.value = weather;
      await syncEnvironment();
      if (!transition.isCurrent()) return getEnvironmentDiagnostics();
      transition.commit();
      configureSimulation({rebuildTheme:false});
      saveUiSettings({ environment: true });
      applyTheme({ announce, rebuildGeometry:false });
      return getEnvironmentDiagnostics();
    } catch (error) {
      if (transition.rollback()) { configureSimulation({rebuildTheme:false}); applyTheme({ announce: false, rebuildGeometry:false }); }
      throw error;
    } finally {
      transition.finish();
    }
  }
  const workshopEnvironmentPresets = Object.freeze({
    clear: 'clear_day',
    overcast: 'overcast_day',
    golden: 'golden_hour',
    sunset: 'sunset',
    moonrise: 'moonrise',
    night: 'dark_night',
  });

  async function applyWorkshopEnvironment(state, runtime = environmentWorkshopRuntime) {
    const skyState = state?.sky || {};
    const presetId = workshopEnvironmentPresets[skyState.id];
    if (!presetId) throw new RangeError('Invalid Workshop environment preset');
    const intensity = Math.max(0, Math.min(2, Number(skyState.intensity)));
    const exposureEv = Math.max(-4, Math.min(4, Number(skyState.exposure)));
    const rotationDegrees = ((Number(skyState.rotation) % 360) + 360) % 360;
    if (![intensity, exposureEv, rotationDegrees].every(Number.isFinite)) {
      throw new TypeError('Invalid Workshop environment controls');
    }
    const signature = JSON.stringify([presetId, intensity, exposureEv, rotationDegrees]);
    if (signature === workshopEnvironmentSignature) {
      if (workshopEnvironmentPromise) return workshopEnvironmentPromise;
      if (environmentOwner === 'workshop') {
        mirrorEnvironmentToWorkshop(runtime);
        return getEnvironmentDiagnostics();
      }
    }
    const token = ++workshopEnvironmentToken;
    workshopEnvironmentSignature = signature;
    environmentWorkshopRuntime = runtime || environmentWorkshopRuntime;
    const base = globalThis.AsfaltoV5EnvironmentCore.getEnvironmentPreset(presetId);
    const pending = environmentController.applyPreset(presetId, {
      environmentIntensity: base.environmentIntensity * intensity,
      keyLightIntensity: base.keyLightIntensity * intensity,
      exposure: base.exposure * Math.pow(2, exposureEv),
      precipitation: 'none',
      roadWetness: 0,
    });
    workshopEnvironmentPromise = pending;
    try {
      await pending;
      if (token !== workshopEnvironmentToken) return getEnvironmentDiagnostics();
      environmentOwner = 'workshop';
      environmentSettingsSignature = null;
      environmentRotation = rotationDegrees * Math.PI / 180;
      if (scene.backgroundRotation) scene.backgroundRotation.y = environmentRotation;
      if (scene.environmentRotation) scene.environmentRotation.y = environmentRotation;
      mirrorEnvironmentToWorkshop(runtime);
      return getEnvironmentDiagnostics();
    } catch (error) {
      if (token === workshopEnvironmentToken) workshopEnvironmentSignature = null;
      throw error;
    } finally {
      if (workshopEnvironmentPromise === pending) workshopEnvironmentPromise = null;
    }
  }


  function getRouteOrigin() {
    if (!visualRoot) return Object.freeze([0, ROAD_Y, VIEW_Z]);
    const frame = track.sample(lastState.s);
    lastAuthoredFrame = Object.freeze({ x: frame.x, y: frame.y, z: frame.z, heading: frame.heading });
    visualRoot.updateMatrixWorld(true);
    routeOriginVector.set(frame.x, frame.y, frame.z);
    routeOriginVector.applyMatrix4(visualRoot.matrixWorld);
    return Object.freeze([routeOriginVector.x, routeOriginVector.y, routeOriginVector.z]);
  }

  function debugSetRaceState(candidate) {
    if (!isAsfaltoV5Qa) throw new Error('QA bridge deshabilitado');
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new TypeError('QA race seed debe ser un objeto');
    }
    const allowed = ['s', 'raceProgress', 'completedCheckpoints', 'speedMps'];
    const keys = Object.keys(candidate);
    if (keys.length !== allowed.length || keys.some(key => !allowed.includes(key))
      || allowed.some(key => !Object.hasOwn(candidate, key))) {
      throw new TypeError('QA race seed requiere sólo s, raceProgress, completedCheckpoints y speedMps');
    }
    const { s, raceProgress, completedCheckpoints, speedMps } = candidate;
    if (![s, raceProgress, completedCheckpoints, speedMps].every(Number.isFinite)) {
      throw new TypeError('QA race seed requiere números finitos');
    }
    if (simulation.state.status !== 'RUNNING' || simulation.state.completedLaps !== 0) {
      throw new Error('QA race seed requiere la primera pasada en RUNNING');
    }
    if (s !== raceProgress || s < 0 || s >= track.length) {
      throw new RangeError('QA race seed debe ser prefinish dentro de la ruta');
    }
    const crossed = track.checkpoints.filter(checkpoint => checkpoint <= raceProgress).length;
    if (!Number.isInteger(completedCheckpoints)
      || completedCheckpoints < 0
      || completedCheckpoints >= track.checkpoints.length
      || completedCheckpoints !== crossed) {
      throw new RangeError('QA race seed no coincide con los checkpoints cruzados');
    }
    if (speedMps <= 0 || speedMps > 80) throw new RangeError('QA race seed speedMps fuera de rango');
    const now = simulation.state.totalTime;
    const events = simulation.state.events
      .filter(event => !['sector', 'finish', 'lap', 'best-lap'].includes(event.type))
      .concat(Array.from({ length: completedCheckpoints }, (_, index) => ({
        type: 'sector', at: now, index, time: 0,
      })));
    simulation.debugSet({
      status: 'RUNNING', s, raceProgress, completedLaps: 0, lap: 1,
      nextCheckpointIndex: completedCheckpoints,
      lastCheckpointProgress: completedCheckpoints ? track.checkpoints[completedCheckpoints - 1] : 0,
      lateral: 0, headingError: 0, yawRate: 0, lateralVelocity: 0,
      missedCheckpoint: false, invalidLap: false, sectorStartTime: now,

      currentSectorTimes: Array.from({ length: completedCheckpoints }, () => 0),
      lastSectorTimes: [], events,
    });
    feedback = { ...feedback, speedMps };
    lastState = simulation.getState();
    updateActiveTrackScene();
    updatePhysicalVehicleVisuals(simulation.getRenderFrame(), true);
    return getState();
  }
  async function debugDrivePhysicalRoute(options) {
    if (!isAsfaltoV5Qa) throw new Error('QA bridge deshabilitado');
    const result = await simulation.debugDrivePhysicalRoute(options);
    lastState = result.state;
    updateActiveTrackScene();
    updatePhysicalVehicleVisuals(simulation.getRenderFrame(), true);
    updateHud();
    return Object.freeze({ state: getState(), evidence: result.evidence });
  }
  function debugTeleportPhysicalVehicle(options) {
    if (!isAsfaltoV5Qa) throw new Error('QA bridge deshabilitado');
    simulation.debugTeleportPhysicalVehicle(options);
    raceWeatherEffects.reset();
    lastState = simulation.getState();
    updateActiveTrackScene();
    updatePhysicalVehicleVisuals(simulation.getRenderFrame(), true);
    updateHud();
    return getState();
  }
  function getAuthoredSceneDiagnostics() {
    const probeState = authoredCollisionProbe?.getState?.() || {
      sampleCount: 0,
      lastResult: {
        groundHit: false,
        groundDistance: null,
        collided: false,
        obstacleDistance: null,
      },
    };
    const bridgeState = authoredCollisionBridge?.getState?.() || { sampleCount: 0 };
    return Object.freeze({
      ready: Boolean(
        visualRoot && visualRoot.parent === scene
        && collisionRoot && collisionRoot.parent === null && collisionRoot.visible === false
        && authoredCollisionProbe && physicalRenderBridge
      ),
      circuit: track.id,
      routeLength: track.length,
      visualMeshes: countMeshes(visualRoot),
      collisionMeshes: countMeshes(collisionRoot),
      legacyTracksEnabled: legacyTrackLayersEnabled(),
      routeOrigin: getRouteOrigin(),
      canonicalSample: (() => { const frame = track.sample(lastState.s); return Object.freeze({ x: frame.x, y: frame.y, z: frame.z, heading: frame.heading }); })(),
      liveFrame: lastAuthoredFrame,
      visualRootMatrix: Object.freeze(visualRoot?.matrixWorld?.toArray?.() || []),
      collisionRootMatrix: Object.freeze(collisionRoot?.matrixWorld?.toArray?.() || []),
      collisionProbe: Object.freeze({
        ...probeState.lastResult,
        sampleCount: probeState.sampleCount,
        bridgeSampleCount: bridgeState.sampleCount,
        latched: Boolean(bridgeState.latched),
      }),
      collisionAuthority: 'rapier-track-collider',
      renderBridge: physicalRenderBridge?.diagnostics?.() || null,
      ...getEnvironmentDiagnostics(),
    });
  }

  const root = new THREE.Group();
  root.name = 'RacingPOVWorldV5';
  root.renderOrder = -20;
  scene.add(root);

  const backgroundImage = element('scene-background-image');
  const priorBackgroundOpacity = backgroundImage?.style.opacity || '';
  if (backgroundImage) backgroundImage.style.opacity = '0';

  const originalFog = scene.fog;
  const originalLightState = [];
  scene.traverse((object) => {
    if (!object.isLight) return;
    originalLightState.push({ object, intensity: object.intensity, color: object.color.clone(), groundColor: object.groundColor?.clone?.() || null });
  });

  const makeDynamicRibbon = (verticesPerRow, rows = MAX_SEGMENTS + 1) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rows * verticesPerRow * 3);
    const normals = new Float32Array(rows * verticesPerRow * 3);
    const uvs = new Float32Array(rows * verticesPerRow * 2);
    for (let i = 0; i < normals.length; i += 3) normals[i + 1] = 1;
    const indices = [];
    if (verticesPerRow === 2) {
      for (let row = 0; row < rows - 1; row++) {
        const a = row * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, c, b, b, c, d);
      }
    } else if (verticesPerRow === 4) {
      for (let row = 0; row < rows - 1; row++) {
        const a = row * 4;
        indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        indices.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  };

  function makeCheckeredTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4ec'; ctx.fillRect(x * 8, y * 8, 8, 8);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; return texture;
  }

  const skyUniforms = {
    uTime: { value: 0 }, uCloud: { value: 0.22 }, uNight: { value: 0 }, uStorm: { value: 0 },
    uTop: { value: new THREE.Color(track.palette.skyTop) }, uHorizon: { value: new THREE.Color(track.palette.skyHorizon) },
    uSunColor: { value: new THREE.Color(0xffe6a3) }, uSunDir: { value: new THREE.Vector3(-0.35, 0.55, -0.74).normalize() },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: `varying vec3 vDir;void main(){vec4 world=modelMatrix*vec4(position,1.0);vDir=normalize(world.xyz-cameraPosition);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `precision highp float;varying vec3 vDir;uniform float uTime;uniform float uCloud;uniform float uNight;uniform float uStorm;uniform vec3 uTop;uniform vec3 uHorizon;uniform vec3 uSunColor;uniform vec3 uSunDir;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+17.1;a*=.5;}return v;}
      void main(){float h=clamp(vDir.y*.72+.36,0.,1.);vec3 col=mix(uHorizon,uTop,pow(h,.72));float sun=pow(max(dot(vDir,uSunDir),0.),420.);float glow=pow(max(dot(vDir,uSunDir),0.),18.);vec2 cp=vDir.xz/max(.16,vDir.y+.55);float clouds=smoothstep(.54,.76,fbm(cp*2.3+vec2(uTime*.006,uTime*.003)));clouds*=smoothstep(-.1,.45,vDir.y)*uCloud;col=mix(col,mix(vec3(.85),vec3(.28),uStorm),clouds*.56);col+=uSunColor*(sun*1.45+glow*.17)*(1.-uStorm*.7);col=mix(col,col*.13+vec3(.015,.025,.05),uNight);gl_FragColor=vec4(col,1.);}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(430, 32, 18), skyMaterial); sky.name = 'SkyDomeRARAdapted'; sky.frustumCulled = false; root.add(sky);

  const roadGeometry = makeDynamicRibbon(2);
  let roadShader = null;
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x303336, roughness: 0.91, metalness: 0.02, side: THREE.DoubleSide });
  roadMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uWetness = { value: 0 };
    shader.uniforms.uRaceTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRaceUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvRaceUv=uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRaceUv;uniform float uWetness;uniform float uRaceTime;float raceHash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat aggregate=raceHash(floor(vRaceUv*vec2(420.0,1800.0)));diffuseColor.rgb*=mix(.84,1.09,aggregate);float rubber=smoothstep(.18,.02,abs(vRaceUv.x-.5))*smoothstep(.35,.9,fract(vRaceUv.y*8.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055),rubber*.17);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.54+vec3(.035,.045,.05),uWetness*.62);');
    roadShader = shader;
  };
  const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial); roadMesh.name = 'RoadContinuousRibbon'; roadMesh.receiveShadow = true; root.add(roadMesh);

  const shoulderGeometry = makeDynamicRibbon(4);
  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(track.palette.dirt), roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const shoulderMesh = new THREE.Mesh(shoulderGeometry, shoulderMaterial); shoulderMesh.name = 'ShouldersVariableProfile'; root.add(shoulderMesh);

  const curbGeometry = makeDynamicRibbon(4);
  const curbColors = new Float32Array((MAX_SEGMENTS + 1) * 4 * 3);
  curbGeometry.setAttribute('color', new THREE.BufferAttribute(curbColors, 3).setUsage(THREE.DynamicDrawUsage));
  const curbMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84, metalness: 0, side: THREE.DoubleSide });
  const curbMesh = new THREE.Mesh(curbGeometry, curbMaterial); curbMesh.name = 'CurbsAlternating'; root.add(curbMesh);

  const terrainGeometry = makeDynamicRibbon(4);
  const terrainUniforms = {
    uGround: { value: new THREE.Color(track.palette.ground) }, uDirt: { value: new THREE.Color(track.palette.dirt) },
    uGrassBottom: { value: new THREE.Color(track.palette.grassBottom) }, uGrassTop: { value: new THREE.Color(track.palette.grassTop) },
    uTime: { value: 0 }, uWetness: { value: 0 }, uFogColor: { value: new THREE.Color(track.palette.fog) }, uFogDensity: { value: .002 },
  };
  const terrainMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, uniforms: terrainUniforms, fog: false,
    vertexShader: `varying vec2 vUv2;varying vec3 vWorld;void main(){vUv2=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `precision highp float;varying vec2 vUv2;varying vec3 vWorld;uniform vec3 uGround;uniform vec3 uDirt;uniform vec3 uGrassBottom;uniform vec3 uGrassTop;uniform vec3 uFogColor;uniform float uTime;uniform float uWetness;uniform float uFogDensity;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){float n=noise(vWorld.xz*.12)+noise(vWorld.xz*.51)*.35;float groundMask=smoothstep(.22,.82,n+abs(vUv2.x-.5)*.3);vec3 grass=mix(uGrassBottom,uGrassTop,clamp(n,0.,1.));vec3 col=mix(mix(uGround,grass,.72),uDirt,groundMask*.22);col=mix(col,col*.58+vec3(.025,.035,.026),uWetness*.48);float fog=1.-exp(-uFogDensity*uFogDensity*dot(vWorld-cameraPosition,vWorld-cameraPosition));col=mix(col,uFogColor,clamp(fog,0.,.92));gl_FragColor=vec4(col,1.);}`,
  });
  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial); terrainMesh.name = 'GroundMaskTerrain'; root.add(terrainMesh);

  const centerDashGeometry = new THREE.BoxGeometry(.075, .014, 4.2);
  const centerDashMaterial = new THREE.MeshBasicMaterial({ color: 0xf3f0df });
  const centerDashes = new THREE.InstancedMesh(centerDashGeometry, centerDashMaterial, 72); centerDashes.name = 'CenterLineDashes'; centerDashes.frustumCulled = false; root.add(centerDashes);

  const roadDecalGeometry = new THREE.PlaneGeometry(1, 1);
  roadDecalGeometry.rotateX(-Math.PI / 2);
  const roadDecalMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, transparent: true, opacity: .32,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const roadDecals = new THREE.InstancedMesh(roadDecalGeometry, roadDecalMaterial, 128);
  roadDecals.name = 'RoadDecalsInstanced';
  roadDecals.frustumCulled = false;
  roadDecals.renderOrder = 2;
  roadDecals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(roadDecals);

  const idealLineGeometry = new THREE.BufferGeometry();
  idealLineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((MAX_SEGMENTS + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
  idealLineGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array((MAX_SEGMENTS + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idealLineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .74, depthTest: true });
  const idealLine = new THREE.Line(idealLineGeometry, idealLineMaterial); idealLine.name = 'DynamicIdealLine'; idealLine.renderOrder = 3; root.add(idealLine);

  const waterGeometry = makeDynamicRibbon(2);
  const waterUniforms = {
    uTime: { value: 0 }, uDeep: { value: new THREE.Color(track.palette.waterDeep || '#074d73') },
    uMid: { value: new THREE.Color(track.palette.waterMid || '#198fb2') }, uHighlight: { value: new THREE.Color(track.palette.waterHighlight || '#9ae8ef') },
    uStorm: { value: 0 }, uWaterRipple: { value: 0 },
  };
  const waterMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: waterUniforms,
    vertexShader: `varying vec2 vUv2;varying vec3 vWorld;uniform float uTime;void main(){vUv2=uv;vec3 p=position;p.y+=sin((p.x+p.z)*.14+uTime*1.3)*.07+sin(p.z*.33-uTime*1.8)*.035;vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `precision highp float;varying vec2 vUv2;varying vec3 vWorld;uniform float uTime;uniform float uStorm;uniform float uWaterRipple;uniform vec3 uDeep;uniform vec3 uMid;uniform vec3 uHighlight;
      vec2 hash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}float voronoi(vec2 x){vec2 n=floor(x),f=fract(x);float f1=8.,f2=8.;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 o=hash2(n+g);o=.5+.5*sin(uTime*.35+6.2831*o);float d=length(g+o-f);if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}return f2-f1;}float waterRipple(vec2 p){float r=length(p-vec2(.54,.43));return sin(r*70.-uTime*4.)*exp(-r*5.)*uWaterRipple;}
      void main(){float cell=voronoi(vWorld.xz*.095+vec2(uTime*.025,-uTime*.018));float waves=sin(vWorld.x*.17+uTime*1.1)*.5+.5;float foam=smoothstep(.13,0.,vUv2.x)+smoothstep(.88,1.,vUv2.x);float sparkle=pow(max(cell,0.),4.)*(.4+.6*waves);float ripple=waterRipple(vUv2);vec3 col=mix(uDeep,uMid,clamp(vUv2.x*.8+cell*.35,0.,1.));col=mix(col,uHighlight,clamp(sparkle*.8+foam*.72+ripple*.12,0.,.8));col=mix(col,vec3(.18,.22,.26),uStorm*.28);gl_FragColor=vec4(col,.72+foam*.12);}`,
  });
  const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial); waterMesh.name = 'WaterWaveSimulationRARAdapted'; waterMesh.visible = track.environment === 'coast'; waterMesh.renderOrder = 1; root.add(waterMesh);
  const seabedGeometry = makeDynamicRibbon(2);
  const seabedMaterial = new THREE.MeshStandardMaterial({ color: 0x8e845e, roughness: 1, metalness: 0, transparent: true, opacity: .68, side: THREE.DoubleSide });
  const seabedMesh = new THREE.Mesh(seabedGeometry, seabedMaterial); seabedMesh.name = 'SeabedFloor'; seabedMesh.visible = waterMesh.visible; root.add(seabedMesh);

  function makeCrossedGrassGeometry() {
    const geometry = new THREE.BufferGeometry();
    const w = .055, h = .48;
    const positions = new Float32Array([
      -w,0,0, w,0,0, w,h,0, -w,h,0,
      0,0,-w, 0,0,w, 0,h,w, 0,h,-w,
    ]);
    const uvs = new Float32Array([0,0,1,0,1,1,0,1, 0,0,1,0,1,1,0,1]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs,2));
    geometry.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
    geometry.computeVertexNormals();
    return geometry;
  }
  const grassGeometry = makeCrossedGrassGeometry();
  let grassShader = null;
  const grassMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, vertexColors: true });
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.windStrength = { value: .1 };
    shader.uniforms.windSpeed = { value: 1.3 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;uniform float windStrength;uniform float windSpeed;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat bladeHeight=uv.y;float phase=(instanceMatrix[3].x+instanceMatrix[3].z)*.13;float sway=(sin(uTime*windSpeed+phase)+sin(uTime*windSpeed*.43+phase*2.7)*.45)*windStrength*bladeHeight*bladeHeight;transformed.x+=sway;transformed.z+=sway*.32;');
    grassShader = shader;
  };
  const grassMesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, 1800); grassMesh.name = 'GrassFieldInstancedWind'; grassMesh.frustumCulled = false; grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(grassMesh);

  const flowerGeometry = new THREE.IcosahedronGeometry(.055, 0);
  const flowerMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const flowerMesh = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, 320); flowerMesh.name = 'FlowerMaterialScatter'; flowerMesh.frustumCulled = false; flowerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(flowerMesh);

  const trunkGeometry = new THREE.CylinderGeometry(.09, .14, 1.4, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3b25, roughness: 1, vertexColors: true });
  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, 260); trunkMesh.name = 'BarkMaterialInstanced'; trunkMesh.frustumCulled = false; trunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(trunkMesh);
  const canopyGeometry = new THREE.ConeGeometry(.82, 2.55, 7, 2);
  const canopyMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const canopyMesh = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, 260); canopyMesh.name = 'PineLeafMaterialInstanced'; canopyMesh.frustumCulled = false; canopyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(canopyMesh);
  const contactShadowGeometry = new THREE.CircleGeometry(1, 14);
  const contactShadowMaterial = new THREE.MeshBasicMaterial({ color: 0x07100b, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const treeContactShadows = new THREE.InstancedMesh(contactShadowGeometry, contactShadowMaterial, 260); treeContactShadows.name = 'TreeContactShadows'; treeContactShadows.frustumCulled = false; treeContactShadows.renderOrder = 1; treeContactShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(treeContactShadows);

  const rockGeometry = new THREE.DodecahedronGeometry(.42, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x77746b, roughness: .98, vertexColors: true });
  const rockMesh = new THREE.InstancedMesh(rockGeometry, rockMaterial, 150); rockMesh.name = 'RockScatter'; rockMesh.frustumCulled = false; rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(rockMesh);
  let rarGrassSceneRockMesh = null;

  const barrierGeometry = new THREE.BoxGeometry(.18, .46, 1.8);
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xc4c8c8, roughness: .78, metalness: .42 });
  const barrierMesh = new THREE.InstancedMesh(barrierGeometry, barrierMaterial, 180); barrierMesh.name = 'CollisionBarrierProxies'; barrierMesh.frustumCulled = false; barrierMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(barrierMesh);

  const markerGeometry = new THREE.BoxGeometry(.12, 1.25, .7);
  const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xf3eee1, roughness: .7 });
  const brakingMarkerMesh = new THREE.InstancedMesh(markerGeometry, markerMaterial, 32); brakingMarkerMesh.name = 'BrakingMarkers15010050'; brakingMarkerMesh.frustumCulled = false; brakingMarkerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(brakingMarkerMesh);

  const rivalBodyGeometry = new THREE.BoxGeometry(1.72, .48, 3.85);
  rivalBodyGeometry.translate(0, .28, 0);
  const rivalBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .45, metalness: .38, vertexColors: true });
  const rivalBodies = new THREE.InstancedMesh(rivalBodyGeometry, rivalBodyMaterial, MAX_RIVALS); rivalBodies.name = 'AIRivalBodies'; rivalBodies.frustumCulled = false; rivalBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(rivalBodies);
  const rivalRoofGeometry = new THREE.BoxGeometry(1.35, .46, 1.75); rivalRoofGeometry.translate(0, .72, -.1);
  const rivalRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x17222b, roughness: .24, metalness: .18, transparent: true, opacity: .92 });
  const rivalRoofs = new THREE.InstancedMesh(rivalRoofGeometry, rivalRoofMaterial, MAX_RIVALS); rivalRoofs.name = 'AIRivalCabins'; rivalRoofs.frustumCulled = false; rivalRoofs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(rivalRoofs);
  const rivalContactShadowMaterial = new THREE.MeshBasicMaterial({ color: 0x030507, transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide, fog: true });
  const rivalContactShadows = new THREE.InstancedMesh(contactShadowGeometry, rivalContactShadowMaterial, MAX_RIVALS); rivalContactShadows.name = 'RivalContactShadows'; rivalContactShadows.frustumCulled = false; rivalContactShadows.renderOrder = 2; rivalContactShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(rivalContactShadows);

  const ghostGroup = new THREE.Group(); ghostGroup.name = 'BestLapGhost';
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x7ee8ff, transparent: true, opacity: .26, depthWrite: false });
  const ghostBody = new THREE.Mesh(rivalBodyGeometry, ghostMaterial); const ghostRoof = new THREE.Mesh(rivalRoofGeometry, ghostMaterial); ghostGroup.add(ghostBody, ghostRoof); root.add(ghostGroup);

  const startGate = new THREE.Group(); startGate.name = 'StartingGridAndPitLane';
  const gateMaterial = new THREE.MeshStandardMaterial({ color: 0xbfc5c6, roughness: .48, metalness: .62 });
  const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(.22, 4.2, .22), gateMaterial); const gateRight = gateLeft.clone();
  const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(9.8, .28, .28), gateMaterial);
  const checkeredMaterial = new THREE.MeshBasicMaterial({ map: makeCheckeredTexture(), side: THREE.DoubleSide });
  const checkeredBanner = new THREE.Mesh(new THREE.PlaneGeometry(7.6, .8), checkeredMaterial); checkeredBanner.position.z = -.16;
  const startLights = [];
  const lightOffMaterial = new THREE.MeshBasicMaterial({ color: 0x2b0908 });
  for (let i = 0; i < 5; i++) { const light = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 6), lightOffMaterial.clone()); light.position.set(-.72 + i * .36, .05, -.24); gateBeam.add(light); startLights.push(light); }
  gateLeft.position.set(-4.45,1.05,0); gateRight.position.set(4.45,1.05,0); gateBeam.position.set(0,3.05,0); checkeredBanner.position.y=2.45;
  startGate.add(gateLeft,gateRight,gateBeam,checkeredBanner); root.add(startGate);

  const pitLaneGeometry = makeDynamicRibbon(2, PIT_LANE_SEGMENTS + 1);
  const pitLaneMaterial = new THREE.MeshStandardMaterial({ color: 0x282b2d, roughness: .92, metalness: .02, side: THREE.DoubleSide });
  const pitLane = new THREE.Mesh(pitLaneGeometry, pitLaneMaterial); pitLane.name = 'PitLaneSurfaceDynamic'; pitLane.receiveShadow = true; root.add(pitLane);
  const pitStripeGeometry = makeDynamicRibbon(2, PIT_LANE_SEGMENTS + 1);
  const pitStripeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36f, side: THREE.DoubleSide, transparent:true,opacity:.86 });
  const pitStripe = new THREE.Mesh(pitStripeGeometry, pitStripeMaterial); pitStripe.name = 'PitLaneStripeDynamic'; root.add(pitStripe);

  const rainCount = 520;
  const rainPositions = new Float32Array(rainCount * 3);
  const rainRng = rngFor(7043);
  for (let i=0;i<rainCount;i++){rainPositions[i*3]=(rainRng()-.5)*55;rainPositions[i*3+1]=rainRng()*24;rainPositions[i*3+2]=8-rainRng()*150;}
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rainUniforms = {uTime:{value:0},uIntensity:{value:0},uSnow:{value:0}};
  const rainMaterial = new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:rainUniforms,
    vertexShader:`precision mediump float;uniform float uTime;uniform float uIntensity;uniform float uSnow;void main(){vec3 p=position;p.y=mod(position.y-uTime*mix(28.+uIntensity*20.,4.5,uSnow),24.);p.z+=sin(uTime*.8+position.x)*1.2;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=mix(2.8+uIntensity*3.2,4.,uSnow);}`,
    fragmentShader:`precision mediump float;uniform float uIntensity;uniform float uSnow;void main(){vec2 q=gl_PointCoord-vec2(.5);float streak=(1.-smoothstep(.018,.14,abs(q.x)))*(1.-smoothstep(.08,.52,abs(q.y)));float shape=mix(streak,1.-smoothstep(.15,.48,length(q)),uSnow);if(shape<.02)discard;gl_FragColor=vec4(mix(vec3(.68,.84,1.),vec3(.95,.97,1.),uSnow),(.18+uIntensity*.42)*shape);}`});
  const rain = new THREE.Points(rainGeometry,rainMaterial); rain.name='RainWeatherParticles'; rain.frustumCulled=false; rain.visible=false; root.add(rain);
  for (const material of [skyMaterial, terrainMaterial, waterMaterial, rainMaterial]) enableCustomLogarithmicDepth(material);

  const tempMatrix = new THREE.Matrix4();
  const tempPosition = new THREE.Vector3();
  const tempQuaternion = new THREE.Quaternion();
  const tempScale = new THREE.Vector3();
  const tempColor = new THREE.Color();
  const yAxis = new THREE.Vector3(0,1,0);
  const xAxis = new THREE.Vector3(1,0,0);
  const scatter = { grass: [], flowers: [], trees: [], rocks: [], decals: [] };
  let minimapSamples = [];

  function groundMask(lateral, width, shoulder) {
    const edge = width * .5 + shoulder;
    return clamp((Math.abs(lateral) - edge) / 12, 0, 1);
  }

  function rebuildScatter() {
    scatter.grass.length = scatter.flowers.length = scatter.trees.length = scatter.rocks.length = scatter.decals.length = 0;
    const random = rngFor(track.seed + 9901);
    const density = { open: .72, mountain: .54, coast: .48, forest: 1 }[track.environment] || .7;
    const grassCount = Math.round(1800 * density);
    const treeCount = Math.round(250 * ({ open: .35, mountain: .62, coast: .34, forest: 1 }[track.environment] || .6));
    const rockCount = Math.round(145 * ({ open: .25, mountain: 1, coast: .75, forest: .45 }[track.environment] || .5));
    const flowerCount = Math.round(300 * ({ open: 1, mountain: .35, coast: .55, forest: .42 }[track.environment] || .5));
    for (let i=0;i<grassCount;i++) {
      const s=random()*track.length, width=track.widthAt(s), side=random()<.5?-1:1;
      const lateral=side*(width*.5+track.shoulder+.3+Math.pow(random(),1.7)*20);
      if (groundMask(lateral,width,track.shoulder)<.02) continue;
      scatter.grass.push({s,lateral,scale:.55+random()*1.35,yaw:random()*Math.PI,color:random()});
    }
    for (let i=0;i<treeCount;i++) {
      const s=random()*track.length,width=track.widthAt(s),side=random()<.5?-1:1;
      scatter.trees.push({s,lateral:side*(width*.5+track.shoulder+4+random()*27),scale:.72+random()*1.5,yaw:random()*Math.PI,color:random()});
    }
    for (let i=0;i<rockCount;i++) {
      const s=random()*track.length,width=track.widthAt(s),side=random()<.5?-1:1;
      scatter.rocks.push({s,lateral:side*(width*.5+track.shoulder+1.4+random()*20),scale:.35+random()*1.65,yaw:random()*Math.PI,color:random()});
    }
    for (let i=0;i<flowerCount;i++) {
      const s=random()*track.length,width=track.widthAt(s),side=random()<.5?-1:1;
      scatter.flowers.push({s,lateral:side*(width*.5+track.shoulder+.7+random()*14),scale:.5+random()*.9,yaw:random()*Math.PI,color:random()});
    }
    for (let i=0;i<118;i++) {
      const s=random()*track.length;
      const sample=track.sample(s);
      const severity=clamp(Math.abs(sample.curvature)*260,0,1);
      if (severity < .14 && random() < .58) continue;
      const lateral=(random()-.5)*Math.max(.5,sample.width*.48);
      const patch=random()>.72;
      scatter.decals.push({
        s,lateral,yaw:(random()-.5)*.13,
        scaleX:patch?.35+random()*1.1:.055+random()*.12,
        scaleZ:patch?.65+random()*2.1:1.5+severity*4.8+random()*2.2,
        color:patch?.32+random()*.12:.05+random()*.08,
      });
    }
    minimapSamples = Array.from({length:260},(_,i)=>track.sample(track.length*i/259));
    grassMesh.count=flowerMesh.count=trunkMesh.count=canopyMesh.count=rockMesh.count=roadDecals.count=0;
    if(rarGrassSceneRockMesh)rarGrassSceneRockMesh.count=0;
  }

  function currentCarFrame(state) {
    const base = track.sample(state.s);
    const heading = base.heading + state.headingError;
    return { base, heading, tx: Math.sin(heading), tz: -Math.cos(heading), rx: Math.cos(heading), rz: Math.sin(heading) };
  }
  function localTrackPoint(sample, lateral, frame, verticalOffset = 0) {
    const bankY = Math.sin(sample.bank || 0) * lateral;
    const worldX = sample.x + sample.rx * lateral;
    const worldZ = sample.z + sample.rz * lateral;
    const carX = frame.base.x + frame.base.rx * lastState.lateral;
    const carZ = frame.base.z + frame.base.rz * lastState.lateral;
    const dx = worldX - carX;
    const dz = worldZ - carZ;
    return {
      x: dx * frame.rx + dz * frame.rz,
      y: ROAD_Y + (sample.y - frame.base.y) + bankY + verticalOffset,
      z: VIEW_Z - (dx * frame.tx + dz * frame.tz),
    };
  }
  function setVertex(array, index, point) { const p=index*3;array[p]=point.x;array[p+1]=point.y;array[p+2]=point.z; }
  function setUv(array,index,u,v){const p=index*2;array[p]=u;array[p+1]=v;}

  const colorA = new THREE.Color(); const colorB = new THREE.Color(); const idealGreen = new THREE.Color(0x53dc88); const idealYellow = new THREE.Color(0xffdf62); const idealRed = new THREE.Color(0xef665c);
  let drawDistance = 330;
  let behindDistance = 48;
  let visibleRoadStep = (drawDistance + behindDistance) / MAX_SEGMENTS;

  function updateAuthoredRoadGuides() {
    const state=lastState,frame=currentCarFrame(state);
    idealLine.visible=!!settings.idealLine;
    if(idealLine.visible){
      const positions=idealLineGeometry.attributes.position.array,colors=idealLineGeometry.attributes.color.array;
      for(let row=0;row<=MAX_SEGMENTS;row++){
        const ahead=-behindDistance+row*visibleRoadStep,sample=track.sample(state.s+ahead);
        setVertex(positions,row,localTrackPoint(sample,track.idealLineOffset(sample.s),frame,.026));
        const severity=clamp(Math.abs(track.sample(sample.s+38).curvature)*260,0,1);
        const color=severity<.35?idealGreen:severity<.68?idealYellow:idealRed;
        colors[row*3]=color.r;colors[row*3+1]=color.g;colors[row*3+2]=color.b;
      }
      idealLineGeometry.attributes.position.needsUpdate=true;
      idealLineGeometry.attributes.color.needsUpdate=true;
      idealLineGeometry.computeBoundingSphere();
    }
    let markerCount=0;
    for(const marker of track.brakingMarkers){
      for(let index=0;index<3;index++){
        const markerS=marker.s+index*34;const ahead=track.shortestDistance(state.s,markerS);if(ahead<-20||ahead>drawDistance)continue;
        const sample=track.sample(markerS);const lateral=sample.width*.5+track.shoulder+1.1;const p=localTrackPoint(sample,lateral,frame,.62);tempPosition.set(p.x,p.y,p.z);tempQuaternion.setFromAxisAngle(yAxis,-wrapAngle(sample.heading-frame.heading));tempScale.set(1,1,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);brakingMarkerMesh.setMatrixAt(markerCount++,tempMatrix);if(markerCount>=32)break;
      }
      if(markerCount>=32)break;
    }
    brakingMarkerMesh.count=markerCount;brakingMarkerMesh.instanceMatrix.needsUpdate=true;

    const startAhead=track.shortestDistance(state.s,START_GATE_S);startGate.visible=Math.abs(startAhead)<drawDistance;
    if(startGate.visible){const sample=track.sample(START_GATE_S);const p=localTrackPoint(sample,0,frame,0);startGate.position.set(p.x,p.y,p.z);startGate.rotation.set(0,-wrapAngle(sample.heading-frame.heading),-sample.bank);}
  }

  function updateRoadGeometry() {
    // Authored tracks supply the road, shoulders, barriers and pit geometry.
    // Only these live guides remain from the procedural renderer.
    if(visualRoot){updateAuthoredRoadGuides();return;}
    const state = lastState;
    const frame = currentCarFrame(state);
    const roadPos = roadGeometry.attributes.position.array, roadUv = roadGeometry.attributes.uv.array;
    const shoulderPos = shoulderGeometry.attributes.position.array, shoulderUv = shoulderGeometry.attributes.uv.array;
    const curbPos = curbGeometry.attributes.position.array, curbUv = curbGeometry.attributes.uv.array, curbColor = curbGeometry.attributes.color.array;
    const terrainPos = terrainGeometry.attributes.position.array, terrainUv = terrainGeometry.attributes.uv.array;
    const idealPos = idealLineGeometry.attributes.position.array, idealColors = idealLineGeometry.attributes.color.array;
    const wet = ['rain','storm'].includes(settings.weather) ? .85 : settings.weather==='fog' ? .2 : 0;
    for (let row=0;row<=MAX_SEGMENTS;row++) {
      const ahead = -behindDistance + row * visibleRoadStep;
      const sample = track.sample(state.s + ahead);
      const half = sample.width*.5;
      const curb = .36;
      const shoulder = track.shoulder;
      const outer = half + shoulder + 46;
      const roadLeft = localTrackPoint(sample,-half,frame,.008), roadRight=localTrackPoint(sample,half,frame,.008);
      setVertex(roadPos,row*2,roadLeft);setVertex(roadPos,row*2+1,roadRight);setUv(roadUv,row*2,0,ahead*.035);setUv(roadUv,row*2+1,1,ahead*.035);
      const shLeftOuter=localTrackPoint(sample,-half-shoulder,frame,.003),shLeftInner=localTrackPoint(sample,-half-curb,frame,.004);
      const shRightInner=localTrackPoint(sample,half+curb,frame,.004),shRightOuter=localTrackPoint(sample,half+shoulder,frame,.003);
      for(const [idx,p,u] of [[0,shLeftOuter,0],[1,shLeftInner,1],[2,shRightInner,0],[3,shRightOuter,1]]){setVertex(shoulderPos,row*4+idx,p);setUv(shoulderUv,row*4+idx,u,ahead*.04);}
      const c0=localTrackPoint(sample,-half-curb,frame,.014),c1=localTrackPoint(sample,-half,frame,.015),c2=localTrackPoint(sample,half,frame,.015),c3=localTrackPoint(sample,half+curb,frame,.014);
      const stripe=(Math.floor(mod(sample.s,10)/5)%2)===0;colorA.set(track.palette.curbA);colorB.set(track.palette.curbB);const stripeColor=stripe?colorA:colorB;
      for(const [idx,p,u] of [[0,c0,0],[1,c1,1],[2,c2,0],[3,c3,1]]){setVertex(curbPos,row*4+idx,p);setUv(curbUv,row*4+idx,u,ahead*.08);const ci=(row*4+idx)*3;curbColor[ci]=stripeColor.r;curbColor[ci+1]=stripeColor.g;curbColor[ci+2]=stripeColor.b;}
      const t0=localTrackPoint(sample,-outer,frame,-.07),t1=localTrackPoint(sample,-half-shoulder,frame,-.025),t2=localTrackPoint(sample,half+shoulder,frame,-.025),t3=localTrackPoint(sample,outer,frame,-.07);
      for(const [idx,p,u] of [[0,t0,0],[1,t1,1],[2,t2,0],[3,t3,1]]){setVertex(terrainPos,row*4+idx,p);setUv(terrainUv,row*4+idx,u,ahead*.013);}
      const lineOffset=track.idealLineOffset(sample.s);const linePoint=localTrackPoint(sample,lineOffset,frame,.026);setVertex(idealPos,row,linePoint);
      const severity=clamp(Math.abs(track.sample(sample.s+38).curvature)*260,0,1);const lineColor=severity<.35?idealGreen:severity<.68?idealYellow:idealRed;idealColors[row*3]=lineColor.r;idealColors[row*3+1]=lineColor.g;idealColors[row*3+2]=lineColor.b;
    }
    for(const geometry of [roadGeometry,shoulderGeometry,curbGeometry,terrainGeometry,idealLineGeometry]) {
      geometry.attributes.position.needsUpdate=true; if(geometry.attributes.uv)geometry.attributes.uv.needsUpdate=true; if(geometry.attributes.color)geometry.attributes.color.needsUpdate=true; geometry.computeBoundingSphere();
    }
    idealLine.visible=!!settings.idealLine;
    if(roadShader){roadShader.uniforms.uWetness.value=wet;roadShader.uniforms.uRaceTime.value=lastState.totalTime;}

    let dashCount=0;
    for(let ahead=-20;ahead<drawDistance&&dashCount<72;ahead+=12){
      const sample=track.sample(state.s+ahead+2);const p=localTrackPoint(sample,0,frame,.022);tempPosition.set(p.x,p.y,p.z);tempQuaternion.setFromAxisAngle(yAxis,-wrapAngle(sample.heading-frame.heading));tempScale.set(1,1,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);centerDashes.setMatrixAt(dashCount++,tempMatrix);
    }
    centerDashes.count=dashCount;centerDashes.instanceMatrix.needsUpdate=true;

    let barrierCount=0;
    const barrierSpacing=track.environment==='open'?12:8;
    for(let ahead=-28;ahead<drawDistance&&barrierCount<180;ahead+=barrierSpacing){
      const sample=track.sample(state.s+ahead);const half=sample.width*.5;const severity=Math.abs(sample.curvature)*230;
      if(track.environment==='open'&&severity<.42&&mod(sample.s,420)>115)continue;
      for(const side of [-1,1]){
        if(barrierCount>=180)break;const lateral=side*(half+track.barrier-.18);const p=localTrackPoint(sample,lateral,frame,.25);tempPosition.set(p.x,p.y,p.z);tempQuaternion.setFromAxisAngle(yAxis,-wrapAngle(sample.heading-frame.heading));tempScale.set(1,.95,barrierSpacing/1.8);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);barrierMesh.setMatrixAt(barrierCount++,tempMatrix);
      }
    }
    barrierMesh.count=barrierCount;barrierMesh.instanceMatrix.needsUpdate=true;

    let markerCount=0;
    for(const marker of track.brakingMarkers){
      for(let index=0;index<3;index++){
        const markerS=marker.s+index*34;const ahead=track.shortestDistance(state.s,markerS);if(ahead<-20||ahead>drawDistance)continue;
        const sample=track.sample(markerS);const lateral=sample.width*.5+track.shoulder+1.1;const p=localTrackPoint(sample,lateral,frame,.62);tempPosition.set(p.x,p.y,p.z);tempQuaternion.setFromAxisAngle(yAxis,-wrapAngle(sample.heading-frame.heading));tempScale.set(1,1,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);brakingMarkerMesh.setMatrixAt(markerCount++,tempMatrix);if(markerCount>=32)break;
      }
      if(markerCount>=32)break;
    }
    brakingMarkerMesh.count=markerCount;brakingMarkerMesh.instanceMatrix.needsUpdate=true;

    const startAhead=track.shortestDistance(state.s,START_GATE_S);startGate.visible=Math.abs(startAhead)<drawDistance;
    if(startGate.visible){const sample=track.sample(START_GATE_S);const p=localTrackPoint(sample,0,frame,0);startGate.position.set(p.x,p.y,p.z);startGate.rotation.set(0,-wrapAngle(sample.heading-frame.heading),-sample.bank);}
    const pitMidS=PIT_LANE_START_S+PIT_LANE_LENGTH*.5;const pitAhead=track.shortestDistance(state.s,pitMidS);pitLane.visible=pitStripe.visible=Math.abs(pitAhead)<drawDistance+PIT_LANE_LENGTH*.65;
    if(pitLane.visible){const lanePos=pitLaneGeometry.attributes.position.array,laneUv=pitLaneGeometry.attributes.uv.array,stripePos=pitStripeGeometry.attributes.position.array,stripeUv=pitStripeGeometry.attributes.uv.array;
      for(let row=0;row<=PIT_LANE_SEGMENTS;row++){const t=row/PIT_LANE_SEGMENTS;const sample=track.sample(PIT_LANE_START_S+t*PIT_LANE_LENGTH);const center=sample.width*.5+track.shoulder+1.5+Math.sin(Math.PI*t)*.55;const left=localTrackPoint(sample,center-1.1,frame,.012);const right=localTrackPoint(sample,center+1.1,frame,.012);setVertex(lanePos,row*2,left);setVertex(lanePos,row*2+1,right);setUv(laneUv,row*2,0,t*6);setUv(laneUv,row*2+1,1,t*6);const lineLeft=localTrackPoint(sample,center-1.15,frame,.026);const lineRight=localTrackPoint(sample,center-1.02,frame,.026);setVertex(stripePos,row*2,lineLeft);setVertex(stripePos,row*2+1,lineRight);setUv(stripeUv,row*2,0,t*8);setUv(stripeUv,row*2+1,1,t*8);}
      for(const geometry of [pitLaneGeometry,pitStripeGeometry]){geometry.attributes.position.needsUpdate=true;geometry.attributes.uv.needsUpdate=true;geometry.computeBoundingSphere();}}

  }

  function updateWaterGeometry() {
    const visible=track.environment==='coast';waterMesh.visible=seabedMesh.visible=visible;if(!visible)return;
    const frame=currentCarFrame(lastState);const pos=waterGeometry.attributes.position.array,uv=waterGeometry.attributes.uv.array;const seabedPos=seabedGeometry.attributes.position.array,seabedUv=seabedGeometry.attributes.uv.array;
    for(let row=0;row<=MAX_SEGMENTS;row++){
      const ahead=-behindDistance+row*visibleRoadStep;const sample=track.sample(lastState.s+ahead);const half=sample.width*.5;const inner=half+track.shoulder+4.5;const outer=inner+82;
      const a=localTrackPoint(sample,inner,frame,-1.02),b=localTrackPoint(sample,outer,frame,-1.18);setVertex(pos,row*2,a);setVertex(pos,row*2+1,b);setUv(uv,row*2,0,ahead*.018);setUv(uv,row*2+1,1,ahead*.018);
      const sa={...a,y:a.y-1.05},sb={...b,y:b.y-2.8};setVertex(seabedPos,row*2,sa);setVertex(seabedPos,row*2+1,sb);setUv(seabedUv,row*2,0,ahead*.018);setUv(seabedUv,row*2+1,1,ahead*.018);
    }
    for(const geometry of [waterGeometry,seabedGeometry]){geometry.attributes.position.needsUpdate=true;geometry.attributes.uv.needsUpdate=true;geometry.computeBoundingSphere();}
  }

  function objectPose(item,height=0,scale=1){
    const frame=currentCarFrame(lastState);const sample=track.sample(item.s);const p=localTrackPoint(sample,item.lateral,frame,height);const ahead=track.shortestDistance(lastState.s,item.s);return{p,ahead,yaw:-wrapAngle(sample.heading-frame.heading)+(item.yaw||0),scale:(item.scale||1)*scale};
  }
  let environmentFrame=0;
  function updateEnvironmentInstances(force=false) {
    environmentFrame++;if(!force&&environmentFrame%2&&!isHighGraphicsQuality(performanceState.qualityTier))return;
    const maxByTier=isHighGraphicsQuality(performanceState.qualityTier)?{grass:1500,flowers:300,trees:240,rocks:140}:performanceState.qualityTier==='balanced'?{grass:980,flowers:180,trees:170,rocks:95}:{grass:520,flowers:80,trees:100,rocks:50};
    let count=0;
    for(const item of scatter.grass){if(count>=maxByTier.grass)break;const pose=objectPose(item);if(pose.ahead<-35||pose.ahead>drawDistance)continue;tempPosition.set(pose.p.x,pose.p.y,pose.p.z);tempQuaternion.setFromAxisAngle(yAxis,pose.yaw);tempScale.setScalar(pose.scale);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);grassMesh.setMatrixAt(count,tempMatrix);tempColor.set(track.palette.grassBottom).lerp(new THREE.Color(track.palette.grassTop),item.color);grassMesh.setColorAt(count,tempColor);count++;}grassMesh.count=count;grassMesh.instanceMatrix.needsUpdate=true;if(grassMesh.instanceColor)grassMesh.instanceColor.needsUpdate=true;
    count=0;
    for(const item of scatter.flowers){if(count>=maxByTier.flowers)break;const pose=objectPose(item,.05);if(pose.ahead<-25||pose.ahead>drawDistance*.88)continue;tempPosition.set(pose.p.x,pose.p.y,pose.p.z);tempQuaternion.setFromAxisAngle(yAxis,pose.yaw);tempScale.setScalar(pose.scale);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);flowerMesh.setMatrixAt(count,tempMatrix);tempColor.setHSL(mod(item.color+.02,1),.72,.58);flowerMesh.setColorAt(count,tempColor);count++;}flowerMesh.count=count;flowerMesh.instanceMatrix.needsUpdate=true;if(flowerMesh.instanceColor)flowerMesh.instanceColor.needsUpdate=true;
    let treeCount=0;
    const treeBottom=new THREE.Color(track.palette.treeBottom),treeTop=new THREE.Color(track.palette.treeTop);
    for(const item of scatter.trees){if(treeCount>=maxByTier.trees)break;const pose=objectPose(item);if(pose.ahead<-48||pose.ahead>drawDistance+35)continue;
      tempPosition.set(pose.p.x,pose.p.y+.7*pose.scale,pose.p.z);tempQuaternion.setFromAxisAngle(yAxis,pose.yaw);tempScale.set(pose.scale,pose.scale,pose.scale);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);trunkMesh.setMatrixAt(treeCount,tempMatrix);tempColor.set(0x563920).lerp(new THREE.Color(0x876442),item.color*.35);trunkMesh.setColorAt(treeCount,tempColor);
      tempPosition.set(pose.p.x,pose.p.y+2.25*pose.scale,pose.p.z);tempScale.set(pose.scale*(track.environment==='forest'?1.15:1),pose.scale,pose.scale*(track.environment==='forest'?1.15:1));tempMatrix.compose(tempPosition,tempQuaternion,tempScale);canopyMesh.setMatrixAt(treeCount,tempMatrix);tempColor.copy(treeBottom).lerp(treeTop,item.color);canopyMesh.setColorAt(treeCount,tempColor);
      tempPosition.set(pose.p.x,pose.p.y+.018,pose.p.z);tempQuaternion.setFromAxisAngle(xAxis,-Math.PI/2);tempScale.set(pose.scale*1.18,pose.scale*.72,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);treeContactShadows.setMatrixAt(treeCount,tempMatrix);treeCount++;
    }trunkMesh.count=canopyMesh.count=treeContactShadows.count=treeCount;trunkMesh.instanceMatrix.needsUpdate=canopyMesh.instanceMatrix.needsUpdate=treeContactShadows.instanceMatrix.needsUpdate=true;if(trunkMesh.instanceColor)trunkMesh.instanceColor.needsUpdate=true;if(canopyMesh.instanceColor)canopyMesh.instanceColor.needsUpdate=true;
    count=0;
    for(const item of scatter.rocks){if(count>=maxByTier.rocks)break;const pose=objectPose(item,.15);if(pose.ahead<-30||pose.ahead>drawDistance)continue;tempPosition.set(pose.p.x,pose.p.y,pose.p.z);tempQuaternion.setFromAxisAngle(yAxis,pose.yaw);tempScale.set(pose.scale,pose.scale*.62,pose.scale*.85);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);rockMesh.setMatrixAt(count,tempMatrix);tempColor.set(track.environment==='mountain'?0x77736d:track.environment==='coast'?0xb2a37c:0x68675c).offsetHSL(0,0,(item.color-.5)*.12);rockMesh.setColorAt(count,tempColor);count++;}rockMesh.count=count;rockMesh.instanceMatrix.needsUpdate=true;if(rockMesh.instanceColor)rockMesh.instanceColor.needsUpdate=true;
    if(rarGrassSceneRockMesh){count=0;const maxRar=isHighGraphicsQuality(performanceState.qualityTier)?72:performanceState.qualityTier==='balanced'?48:24;for(let i=0;i<scatter.rocks.length&&count<maxRar;i+=2){const item=scatter.rocks[i];const pose=objectPose(item,.04);if(pose.ahead<-32||pose.ahead>drawDistance)continue;tempPosition.set(pose.p.x,pose.p.y,pose.p.z);tempQuaternion.setFromAxisAngle(yAxis,pose.yaw);tempScale.setScalar(pose.scale*.82);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);rarGrassSceneRockMesh.setMatrixAt(count,tempMatrix);count++;}rarGrassSceneRockMesh.count=count;rarGrassSceneRockMesh.instanceMatrix.needsUpdate=true;}
    count=0;const maxDecals=performanceState.qualityTier==='low'?52:96;for(const item of scatter.decals){if(count>=maxDecals)break;const pose=objectPose(item,.022);if(pose.ahead<-30||pose.ahead>drawDistance)continue;tempPosition.set(pose.p.x,pose.p.y,pose.p.z);tempQuaternion.setFromAxisAngle(yAxis,pose.yaw);tempScale.set(item.scaleX,1,item.scaleZ);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);roadDecals.setMatrixAt(count,tempMatrix);tempColor.setRGB(item.color,item.color*.98,item.color*.9);roadDecals.setColorAt(count,tempColor);count++;}roadDecals.count=count;roadDecals.instanceMatrix.needsUpdate=true;if(roadDecals.instanceColor)roadDecals.instanceColor.needsUpdate=true;
  }

  function legacyGrassSceneAssetDisabled(asset) {
    if (!asset || rarGrassSceneRockMesh) return !!rarGrassSceneRockMesh;
    asset.updateMatrixWorld?.(true);
    let sourceMesh = null;
    asset.traverse?.((child) => { if (!sourceMesh && child?.isMesh && child.geometry) sourceMesh = child; });
    if (!sourceMesh && asset.isMesh && asset.geometry) sourceMesh = asset;
    if (!sourceMesh) return false;
    const geometry = sourceMesh.geometry.clone();
    geometry.applyMatrix4(sourceMesh.matrixWorld || new THREE.Matrix4());
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const normalizer = 1.05 / Math.max(.001, size.x, size.y, size.z);
    geometry.translate(-center.x, -box.min.y, -center.z);
    geometry.scale(normalizer, normalizer, normalizer);
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const sourceMaterial = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material;
    const material = sourceMaterial?.clone?.() || new THREE.MeshStandardMaterial({ color: 0x77736d, roughness: .96 });
    material.roughness = Math.max(.72, Number(material.roughness) || .9);
    material.metalness = Math.min(.08, Number(material.metalness) || 0);
    rarGrassSceneRockMesh = new THREE.InstancedMesh(geometry, material, 80);
    rarGrassSceneRockMesh.name = 'RARGrassSceneGLBRocks';
    rarGrassSceneRockMesh.frustumCulled = false;
    rarGrassSceneRockMesh.castShadow = isHighGraphicsQuality(performanceState.qualityTier);
    rarGrassSceneRockMesh.receiveShadow = true;
    rarGrassSceneRockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(rarGrassSceneRockMesh);
    asset.traverse?.((child) => {
      if (child === sourceMesh) return;
      child.geometry?.dispose?.();
      for (const childMaterial of (Array.isArray(child.material) ? child.material : [child.material])) childMaterial?.dispose?.();
    });
    updateEnvironmentInstances(true);
    return true;
  }

  function updateRivals() {
    const state=lastState;const frame=currentCarFrame(state);const colors=[0xd8483c,0x2f84ce,0xe0b33d,0x4fae70,0x8c57bd,0xe7e7df];let count=0;
    for(const rival of state.rivals||[]){if(rival.id==='falcon')continue;if(count>=MAX_RIVALS)break;let ahead=rival.raceProgress-state.raceProgress;while(ahead>track.length*.5)ahead-=track.length;while(ahead<-track.length*.5)ahead+=track.length;if(ahead<-55||ahead>drawDistance)continue;const sample=track.sample(rival.s);const p=localTrackPoint(sample,rival.lateral,frame,.05);tempPosition.set(p.x,p.y,p.z);tempQuaternion.setFromAxisAngle(yAxis,-wrapAngle(sample.heading-frame.heading));tempScale.set(1,1,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);rivalBodies.setMatrixAt(count,tempMatrix);rivalRoofs.setMatrixAt(count,tempMatrix);rivalBodies.setColorAt(count,tempColor.setHex(colors[rival.colorIndex%colors.length]));tempPosition.set(p.x,p.y+.015,p.z);tempQuaternion.setFromAxisAngle(xAxis,-Math.PI/2);tempScale.set(1.15,2.15,1);tempMatrix.compose(tempPosition,tempQuaternion,tempScale);rivalContactShadows.setMatrixAt(count,tempMatrix);count++;}
    rivalBodies.count=rivalRoofs.count=rivalContactShadows.count=count;rivalBodies.instanceMatrix.needsUpdate=rivalRoofs.instanceMatrix.needsUpdate=rivalContactShadows.instanceMatrix.needsUpdate=true;if(rivalBodies.instanceColor)rivalBodies.instanceColor.needsUpdate=true;
  }

  function updateGhost() {
    const lapTime=Math.max(0,lastState.totalTime-lastState.lapStartTime);const pose=simulation.getGhostPose(lapTime);ghostGroup.visible=!!pose&&lastState.status==='RUNNING';if(!ghostGroup.visible)return;let ahead=track.shortestDistance(lastState.s,pose.s);if(ahead<-45||ahead>drawDistance){ghostGroup.visible=false;return;}const frame=currentCarFrame(lastState);const sample=track.sample(pose.s);const p=localTrackPoint(sample,pose.lateral,frame,.07);ghostGroup.position.set(p.x,p.y,p.z);ghostGroup.rotation.set(0,-wrapAngle(sample.heading-frame.heading),0);
  }

  function updateSkyAndWeather(dt) {
    updateRaceDayCycle(dt);
    syncEnvironmentRigToVehicle();
    skyUniforms.uTime.value += dt;
    terrainUniforms.uTime.value += dt;
    waterUniforms.uTime.value += dt;
    rainUniforms.uTime.value += dt;
    if (grassShader) grassShader.uniforms.uTime.value += dt;
    const environmentState = environmentController.getDiagnostics();
    const precipitation = environmentState.precipitation;
    terrainUniforms.uWetness.value = environmentState.wetness;
    waterUniforms.uStorm.value = precipitation === 'storm' ? 1 : 0;
    waterUniforms.uWaterRipple.value =
      precipitation === 'storm' ? 1 : precipitation === 'rain' ? 0.7 : 0.12;
    applyPrecipitationState(environmentState);
    if (grassShader) {
      grassShader.uniforms.windStrength.value =
        precipitation === 'storm' ? 0.31 : precipitation === 'rain' ? 0.18 : 0.08;
      grassShader.uniforms.windSpeed.value =
        precipitation === 'storm' ? 3.2 : precipitation === 'rain' ? 2 : 1.1;
    }
  }

  function drawMinimap() {
    const canvas=ui.minimap;if(!canvas)return;const rect=canvas.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,width,height);ctx.fillStyle='rgba(5,8,10,.66)';ctx.fillRect(0,0,width,height);
    const xs=minimapSamples.map(p=>p.x),zs=minimapSamples.map(p=>p.z);const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);const pad=9*dpr,scale=Math.min((width-pad*2)/Math.max(1,maxX-minX),(height-pad*2)/Math.max(1,maxZ-minZ));const mapPoint=(sample)=>({x:pad+(sample.x-minX)*scale,y:height-pad-(sample.z-minZ)*scale});
    ctx.lineWidth=5*dpr;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(255,255,255,.18)';ctx.beginPath();minimapSamples.forEach((sample,i)=>{const p=mapPoint(sample);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath();ctx.stroke();ctx.lineWidth=1.5*dpr;ctx.strokeStyle=track.palette.curbA;ctx.stroke();
    for(const cp of track.checkpoints){const p=mapPoint(track.sample(cp));ctx.fillStyle='rgba(255,211,112,.68)';ctx.fillRect(p.x-1*dpr,p.y-1*dpr,2*dpr,2*dpr);}
    for(const rival of lastState.rivals||[]){const p=mapPoint(track.sample(rival.s));ctx.fillStyle='#ff766d';ctx.beginPath();ctx.arc(p.x,p.y,2*dpr,0,Math.PI*2);ctx.fill();}
    const ghostPose=simulation.getGhostPose(Math.max(0,lastState.totalTime-lastState.lapStartTime));if(ghostPose){const p=mapPoint(track.sample(ghostPose.s));ctx.fillStyle='rgba(126,232,255,.75)';ctx.beginPath();ctx.arc(p.x,p.y,1.8*dpr,0,Math.PI*2);ctx.fill();}
    const player=mapPoint(track.sample(lastState.s));ctx.save();ctx.translate(player.x,player.y);ctx.rotate(-track.sample(lastState.s).heading);ctx.fillStyle='#ffe1a7';ctx.beginPath();ctx.moveTo(0,-4*dpr);ctx.lineTo(3*dpr,3*dpr);ctx.lineTo(-3*dpr,3*dpr);ctx.closePath();ctx.fill();ctx.restore();
  }

  const frameBudget = 1000/60;
  const hardwarePerformanceTier=runtimeDeviceProfile.phone?'balanced':(navigator.deviceMemory&&navigator.deviceMemory<=4)||navigator.hardwareConcurrency<=4?'low':'high';
  const requestedMaximumTier=maximumTierForGraphicsQuality(deviceGraphicsQuality(gameSettings.graphicsQuality,runtimeDeviceProfile),readAdvancedGraphics().quality);
  const initialPerformanceTier=requestedMaximumTier==='cinematic'?'cinematic':gameSettings.graphicsQuality==='auto'?hardwarePerformanceTier:requestedMaximumTier;
  const performanceState = {
    dynamicResolution: true,
    performanceScale: TRACK_RENDER_POLICIES[initialPerformanceTier].resolutionScale,
    qualityTier: initialPerformanceTier,
    averageFrameMs: frameBudget,
    p50FrameMs: 0,
    p95FrameMs: 0,
    p50FrameWorkMs: 0,
    p95FrameWorkMs: 0,
    lastScaleChange: 0,
  };
  function applyPerformanceTier() {
    setSurfaceReliefQuality(performanceState.qualityTier);
    if(isHighGraphicsQuality(performanceState.qualityTier)){drawDistance=350;behindDistance=52;}
    else if(performanceState.qualityTier==='balanced'){drawDistance=280;behindDistance=45;}
    else{drawDistance=205;behindDistance=36;}
    visibleRoadStep=(drawDistance+behindDistance)/MAX_SEGMENTS;
  }
  const performanceGovernor=createTrackPerformanceGovernor({initialTier:initialPerformanceTier,maximumTier:requestedMaximumTier,onTierChange:transition=>{performanceState.qualityTier=transition.tier;performanceState.performanceScale=transition.renderPolicy.resolutionScale;performanceState.lastScaleChange=transition.atMs;renderer.shadowMap.enabled=transition.renderPolicy.shadows;applyPerformanceTier();updateEnvironmentInstances(true);onRenderingScaleChanged(performanceState.performanceScale);}});
  setSurfaceReliefQuality(initialPerformanceTier);
  const raceWeatherEffects = createRaceWeatherEffects({THREE,scene,camera,renderer,qualityTier:initialPerformanceTier,onThunder:event=>raceAudio.thunder(event)});
  const fxPosition = new THREE.Vector3(), fxVelocity = new THREE.Vector3(), fxQuaternion = new THREE.Quaternion();
  let lastMetalImpactKey=null;
  const fxImpactPosition=new THREE.Vector3(),fxMetalMaterials=new Set(['metal','steel','guardrail','vehicle-metal']);
  function reportFrame(frameDt, frameWorkMs=0) {
    rearviewRenderAccumulator += Math.max(0, Number(frameDt) || 0);
    const intervalSeconds=Number(frameDt);const ms=Number.isFinite(intervalSeconds)&&intervalSeconds>=0?Math.max(.001,intervalSeconds*1000):1000;performanceState.averageFrameMs=lerp(performanceState.averageFrameMs,ms,.045);
    if(!performanceState.dynamicResolution||contextLost)return performanceState.performanceScale;
    const targetFps=options.getTargetFps?.()||60;
    if(performanceState.targetFps!==targetFps){performanceState.targetFps=targetFps;performanceGovernor.beginWindow('presentation-'+targetFps);}
    const diagnostics=performanceGovernor.sample({targetFps,frameMs:ms,frameWorkMs:Math.max(0,Number(frameWorkMs)||0),heapBytes:Math.max(0,Number(globalThis.performance?.memory?.usedJSHeapSize)||0),gpuTextures:Math.max(0,Number(renderer.info?.memory?.textures)||0),gpuGeometries:Math.max(0,Number(renderer.info?.memory?.geometries)||0)});
    performanceState.p50FrameMs=diagnostics.p50FrameMs;performanceState.p95FrameMs=diagnostics.p95FrameMs;performanceState.p50FrameWorkMs=diagnostics.p50FrameWorkMs;performanceState.p95FrameWorkMs=diagnostics.p95FrameWorkMs;
    return performanceState.performanceScale;
  }
  let graphicsPreparationActive=false,visualWarmup=null,racePreparation=null;const visualWarmupCache=createRenderPreparationCache();
  async function prepareVisualPolicies(signal){
    if(!options.precompileGraphics)return;
    graphicsPreparationActive=true;try{
    const key=renderPreparationKey(scene,{track:track?.id,vehicle:globalThis.__asfaltoSelectedPlayerVehicle,features:readAdvancedGraphics(),sky:settings.skyId,weather:settings.weather});
    visualWarmup=await visualWarmupCache.prepare(key,{signal,maximumTier:performanceGovernor.diagnostics().maximumTier,getTier:()=>performanceState.qualityTier,applyTier:tier=>{const policy=TRACK_RENDER_POLICIES[tier];performanceState.qualityTier=tier;performanceState.performanceScale=policy.resolutionScale;renderer.shadowMap.enabled=policy.shadows;applyPerformanceTier();onRenderingScaleChanged(policy.resolutionScale);},prepare:()=>options.precompileGraphics({signal}),paint:()=>new Promise(resolve=>requestAnimationFrame(resolve))});
    performanceGovernor.beginWindow('prepared');
    }finally{graphicsPreparationActive=false;}
  }
  function getPerformanceScale(){return performanceState.performanceScale;}
  function getPerformanceTier(){return performanceState.qualityTier;}
  const onAdvancedGraphicsQuality=()=>setPerformanceQuality(gameSettings.graphicsQuality);
  runtimeEvents.listen(window,'asfalto:advanced-graphics',onAdvancedGraphicsQuality);
  listeners.push(()=>window.removeEventListener('asfalto:advanced-graphics',onAdvancedGraphicsQuality));
  function setPerformanceQuality(mode){return performanceGovernor.setMaximumTier(maximumTierForGraphicsQuality(deviceGraphicsQuality(mode,runtimeDeviceProfile),readAdvancedGraphics().quality));}
  function getPerformanceDiagnostics(){return {...performanceGovernor.diagnostics(),surfaceRelief:surfaceReliefDiagnostics(),warmup:visualWarmup,warmupCache:visualWarmupCache.diagnostics(),preparation:racePreparation};}
  renderer.shadowMap.enabled=TRACK_RENDER_POLICIES[initialPerformanceTier].shadows;
  applyPerformanceTier();

  function applyTheme({announce=false,rebuildGeometry=true}={}) {
    const palette=track.palette;
    skyUniforms.uTop.value.set(palette.skyTop);skyUniforms.uHorizon.value.set(palette.skyHorizon);
    terrainUniforms.uGround.value.set(palette.ground);terrainUniforms.uDirt.value.set(palette.dirt);terrainUniforms.uGrassBottom.value.set(palette.grassBottom);terrainUniforms.uGrassTop.value.set(palette.grassTop);terrainUniforms.uFogColor.value.set(palette.fog);
    shoulderMaterial.color.set(palette.dirt);waterUniforms.uDeep.value.set(palette.waterDeep||'#074d73');waterUniforms.uMid.value.set(palette.waterMid||'#198fb2');waterUniforms.uHighlight.value.set(palette.waterHighlight||'#9ae8ef');
    roadMaterial.color.set(settings.weather==='rain'||settings.weather==='storm'?0x24292d:0x303336);waterMesh.visible=seabedMesh.visible=track.environment==='coast';
    if(rebuildGeometry){rebuildScatter();updateRoadGeometry();updateWaterGeometry();updateEnvironmentInstances(true);drawMinimap();}
    if(announce)showMessage(`${track.name} · ${track.description}`,{duration:1800});
  }

  function syncUiSettings() {
    for (const option of ui.weather?.options || []) if (['light-snow', 'heavy-snow'].includes(option.value)) option.disabled = !['cuesta_lipan','paso_garibaldi'].includes(track.id);
    if(ui.environmentPreset)ui.environmentPreset.value=environmentPresetForLegacySettings(settings);ui.weather.value=settings.weather;ui.timeOfDay.value=settings.timeOfDay;ui.difficulty.value=String(settings.difficulty);ui.difficultyValue.textContent=`${Math.round(settings.difficulty*100)}%`;ui.rivals.value=String(settings.rivalCount);ui.rivalsValue.textContent=String(settings.rivalCount);ui.idealLine.checked=!!settings.idealLine;
    ui.hudProfile.value=settings.hudProfile;ui.hudScale.value=String(settings.hudScale);ui.hudScaleValue.textContent=`${Math.round(settings.hudScale*100)}%`;ui.hudOpacity.value=String(settings.hudOpacity);ui.hudOpacityValue.textContent=`${Math.round(settings.hudOpacity*100)}%`;
    ui.touchEnabled.checked=!!settings.touchEnabled;ui.gyroEnabled.checked=!!settings.gyroEnabled;ui.audioAmbient.value=String(settings.audioAmbient);ui.audioAmbientValue.textContent=`${Math.round(settings.audioAmbient*100)}%`;ui.audioTires.value=String(settings.audioTires);ui.audioTiresValue.textContent=`${Math.round(settings.audioTires*100)}%`;ui.audioImpacts.value=String(settings.audioImpacts);ui.audioImpactsValue.textContent=`${Math.round(settings.audioImpacts*100)}%`;ui.audioSignals.value=String(settings.audioSignals);ui.audioSignalsValue.textContent=`${Math.round(settings.audioSignals*100)}%`;
    for(const input of assistInputs)input.checked=!!settings.assists[input.dataset.assist];
    ui.hud.dataset.profile=settings.hudProfile;ui.hud.style.setProperty('--race-hud-scale',String(settings.hudScale));ui.hud.style.setProperty('--race-hud-opacity',String(settings.hudOpacity));
    ui.touchControls.hidden=!settings.touchEnabled;document.body.classList.toggle('race-touch-active',!!settings.touchEnabled);ui.idealLineHint.hidden=!settings.idealLine;
    syncBindingButtons();onFullscreenChange();
  }

  function configureSimulation({rebuildTheme=true}={}) {
    simulation.configure(coreSettingsFromUi());lastState=simulation.getState();resultShownForFinish=false;lastEventSignature='';if(rebuildTheme)applyTheme();updateHud();
  }
  function resetRaceToIdle({vehicle=true}={}) {
    simulation.selectTrack(track);simulation.configure(coreSettingsFromUi());lastState=simulation.getState();feedback=simulation.step(0,{speedMps:0,steer:0,throttle:0,brake:0,handbrake:0});maxSpeedMps=0;resultShownForFinish=false;falseStartApplied=false;lastCountdownNumber=null;if(vehicle)onVehicleReset({reason:'race-reset',speedMps:0});updateHud();
  }
  let pendingRacePreparations=0;
  async function withRacePreparation(operation) {
    pendingRacePreparations++;
    try {
      if(pendingRacePreparations===1){clearInputs();onInputCaptureRelease('preparation');driverControlPipeline.reset();}
      return await operation();
    } finally {pendingRacePreparations--;}
  }
  let circuitSelectionTail=Promise.resolve();
  function selectCircuit(id,options={}) {
    const operation=circuitSelectionTail.then(()=>withRacePreparation(async()=>{
      options?.signal?.throwIfAborted();
      const loading=globalThis.__asfaltoLoading?.begin('Preparando la ruta','Cargando terreno, asfalto y entorno…',{track:id});
      await loading?.painted;
      try{return await performCircuitSelection(id,options)}finally{await loading?.end()}
    }));
    const settled=operation.then(()=>undefined,()=>undefined);
    circuitSelectionTail=settled;
    settled.then(()=>{if(circuitSelectionTail===settled)circuitSelectionTail=Promise.resolve();});
    return operation;
  }
  async function performCircuitSelection(id,{announce=true,skyId,weather,signal}={}) {
    signal?.throwIfAborted();
    const environmentTransition = beginEnvironmentSelection();
    const facade=globalThis.__asfaltoV6Modular;
    const manager=facade.trackManager;
    const previousId=manager?.active?.id||track?.id||ui.circuit.value;
    const previousTrack=track;
    const previousUiValue=previousId;
    const previousFlags={maxSpeedMps,resultShownForFinish,falseStartApplied,lastCountdownNumber,lastEventSignature};
    let candidate=null;
    async function applyCandidateEnvironment() {
      if (environmentTransition.isCurrent()) {
        applyEnvironmentPresetToSettings(skyId||settings.skyId||trackEnvironmentDefault(id,candidate));
        if (weather != null) settings.weather = weather;
      }
      syncUiSettings(); await syncEnvironment();
      signal?.throwIfAborted();
    }
    function commitCandidateEnvironment() {
      signal?.throwIfAborted();
      if (environmentTransition.isCurrent()) {
        environmentTransition.commit();
        saveUiSettings({ environment: skyId != null || weather != null });
      }
    }
    try {
      candidate=await facade.selectTrack(id,{signal});
      signal?.throwIfAborted();
      if(candidate.id===previousId&&simulation.track===candidate.gameplay){
        if (skyId != null || weather != null) await applyCandidateEnvironment();
        ui.circuit.value=id;resetRaceToIdle({vehicle:true});applyTheme({announce});commitCandidateEnvironment();return getState();
      }
      await simulation.replaceTrack({track:candidate.gameplay,trackAdapter:candidate,physicsBridge:candidate.physicsBridge});
      signal?.throwIfAborted();
      track=candidate.gameplay;
      setAuthoredTrackVisuals({visualRoot:candidate.visualRoot,collisionRoot:candidate.collisionRoot,collisionProbe:candidate.collisionProbe},{replace:true});
       ui.circuit.value=id;await applyCandidateEnvironment();simulation.configure(coreSettingsFromUi());lastState=simulation.getState();feedback=simulation.step(0,{speedMps:0,steer:0,throttle:0,brake:0,handbrake:0});maxSpeedMps=0;resultShownForFinish=false;falseStartApplied=false;lastCountdownNumber=null;lastEventSignature='';applyTheme({announce});onVehicleReset({reason:'circuit-change',speedMps:0});updateHud();commitCandidateEnvironment();return getState();
    } catch(error) {
      const managerChanged=manager?.active?.id&&manager.active.id!==previousId;
      if(!managerChanged){track=previousTrack;ui.circuit.value=previousUiValue;environmentTransition.rollback();syncUiSettings();throw error;}
      try {
        const previousAdapter=await facade.selectTrack(previousId);
        await simulation.replaceTrack({track:previousAdapter.gameplay,trackAdapter:previousAdapter,physicsBridge:previousAdapter.physicsBridge});
        track=previousAdapter.gameplay;
        setAuthoredTrackVisuals({visualRoot:previousAdapter.visualRoot,collisionRoot:previousAdapter.collisionRoot,collisionProbe:previousAdapter.collisionProbe},{replace:true});
        ui.circuit.value=previousUiValue;environmentTransition.rollback();syncUiSettings();await syncEnvironment();simulation.configure(coreSettingsFromUi());lastState=simulation.getState();feedback=simulation.step(0,{speedMps:0,steer:0,throttle:0,brake:0,handbrake:0});maxSpeedMps=previousFlags.maxSpeedMps;resultShownForFinish=previousFlags.resultShownForFinish;falseStartApplied=previousFlags.falseStartApplied;lastCountdownNumber=previousFlags.lastCountdownNumber;lastEventSignature=previousFlags.lastEventSignature;applyTheme({announce:false});onVehicleReset({reason:'circuit-rollback',speedMps:0});updateHud();
      } catch(rollbackError) {
        throw new AggregateError([error,rollbackError],'circuit selection and rollback failed',{cause:error});
      }
      throw error;
    } finally {
      environmentTransition.finish();
    }
  }
  async function start({signal,onStage=()=>{}}={}) {
    return withRacePreparation(async()=>{
    signal?.throwIfAborted();if(environmentHostDisposed)throw new Error('Race world disposed');
    if(ui.mode.value==='race'){onStage('Preparando el rival…');await options.ensureRivalVisual?.();signal?.throwIfAborted();}
    releaseRaceDayCycle();raceWeatherEffects.reset();
    await prepareRaceStart({signal,onStage,onUpdate:state=>{racePreparation=state;},paint:()=>new Promise(resolve=>requestAnimationFrame(resolve)),
      environment:()=>syncEnvironment({prepareCycle:false}),dayCycle:()=>prepareRaceDayCycle(),physics:()=>simulation.prepare(),
      graphics:()=>prepareVisualPolicies(signal),audio:()=>Promise.allSettled([ensureAudioStarted(),raceAudio.ensureStarted()])});
    const initialGear=options.getTransmissionMode?.()==='automatic'?1:0;
    closeResults();clearInputs();driverControlPipeline.reset();onVehicleReset({reason:'race-start',speedMps:0,gear:initialGear===0?'N':'1'});falconPresentation?.resetCondition();simulation.configure(coreSettingsFromUi());simulation.start({initialGear});prepareStartSignal();lastState=simulation.getState();maxSpeedMps=0;resultShownForFinish=false;falseStartApplied=false;lastCountdownNumber=null;ui.start.blur();ui.start.classList.add('active');ui.start.textContent='REINICIAR';ui.pause.disabled=false;raceAudio.raceSignal('countdown');showMessage(String(Math.ceil(lastState.countdown||3)),{duration:0,countdown:true});window.dispatchEvent(new CustomEvent('asfalto:race-state',{detail:{status:lastState.status,reason:'start'}}));return getState();
    });
  }
  function pause({reason='pause'}={}) {simulation.pause();lastState=simulation.getState();ui.pause.textContent='▶';ui.pause.setAttribute('aria-label','Reanudar carrera');showMessage('PAUSA',{duration:0});clearInputs();onInputCaptureRelease('pause');driverControlPipeline.reset();window.dispatchEvent(new CustomEvent('asfalto:race-state',{detail:{status:lastState.status,reason}}));return getState();}
  function retryRaceAudioFromGesture(){if(document.hidden||!document.body.classList.contains('v6-driving')||document.body.classList.contains('v6-menu-open')||document.body.classList.contains('an-race-paused'))return;void raceAudio.ensureStarted().catch(()=>{});}
  listen(window,'pointerdown',retryRaceAudioFromGesture,{passive:true});
  listen(window,'keydown',retryRaceAudioFromGesture);
  function resume() {if(!contextRecovery.canResume()){if(contextRecovery.diagnostics().state==='failed')void contextRecovery.restore();return getState();}if(options.beforeResume?.()===false)return getState();modularRaceCue.classList.remove("show");modularRaceCue.textContent="";simulation.resume();lastState=simulation.getState();ui.pause.textContent='Ⅱ';ui.pause.setAttribute('aria-label','Pausar carrera');showMessage(lastState.status==='COUNTDOWN'?String(Math.ceil(lastState.countdown)):'REANUDAR',{duration:650,countdown:lastState.status==='COUNTDOWN'});window.dispatchEvent(new CustomEvent('asfalto:race-state',{detail:{status:lastState.status}}));retryRaceAudioFromGesture();return getState();}
  function togglePause() {if(['IDLE','FINISHED'].includes(simulation.state.status))return getState();return simulation.state.status==='PAUSED'?resume():pause();}
  function recover() {if(simulation.state.status==='COUNTDOWN')return getState();simulation.requestRecovery('manual','backspace');lastState=simulation.getState();processLatestEvent();return getState();}

  function setSettingsOpen(open) {
    settingsOpen=!!open;ui.settings.hidden=!settingsOpen;ui.settingsToggle.setAttribute('aria-expanded',String(settingsOpen));ui.settingsToggle.setAttribute('aria-label',settingsOpen?'Cerrar ajustes de carrera':'Abrir ajustes de carrera');document.body.classList.toggle('race-menu-open',settingsOpen);
    if(settingsOpen){resumeAfterMenu=['RUNNING','COUNTDOWN'].includes(simulation.state.status);if(resumeAfterMenu)pause({reason:'settings'});ui.settings.querySelector('button,select,input')?.focus({preventScroll:true});}
    else{ui.settingsToggle.focus({preventScroll:true});if(resumeAfterMenu){resumeAfterMenu=false;resume();}}
    window.dispatchEvent(new CustomEvent('asfalto:race-settings',{detail:{open:settingsOpen}}));
  }
  function cycleHudProfile() {const profiles=['competition','compact','full','hidden'];settings.hudProfile=profiles[(profiles.indexOf(settings.hudProfile)+1)%profiles.length];syncUiSettings();saveUiSettings();showMessage(`HUD ${settings.hudProfile}`,{duration:700});}

  function showResults() {
    if(resultShownForFinish)return;resultShownForFinish=true;
    if(document.querySelector('#v6-game-shell') || (window.__cockpitV5App && !isAsfaltoV5Qa)){resultsOpen=false;return;}
    resultsOpen=true;document.body.classList.add('race-results-open');ui.results.hidden=false;if(isAsfaltoV5Qa){ui.results.style.setProperty('display','grid','important');ui.results.setAttribute('aria-hidden','false');}const state=lastState;const position=1+(state.rivals||[]).filter(r=>r.raceProgress>state.raceProgress).length;
    const cells=[['Tiempo total',formatTime(state.totalWithPenalty)],['Mejor vuelta',formatTime(state.bestLapTime)],['Última vuelta',formatTime(state.lastLapTime)],['Velocidad máxima',`${Math.round(maxSpeedMps*3.6)} km/h`],['Posición',`${position}/${(state.rivals?.length||0)+1}`],['Penalizaciones',`+${state.penaltyTime.toFixed(1)} s`],['Impactos',String(state.collisionCount)],['Circuito',track.name]];
    ui.resultsSummary.innerHTML=cells.map(([label,value],index)=>`<div class="race-result-cell${index===7?' full':''}"><small>${label}</small><b>${value}</b></div>`).join('');ui.resultsRestart.focus({preventScroll:true});
  }
  function closeResults() {resultsOpen=false;ui.results.hidden=true;document.body.classList.remove('race-results-open');ui.start.focus({preventScroll:true});}

  function processLatestEvent() {
    const event=lastState.events?.at(-1);if(!event)return;const signature=JSON.stringify(event);if(signature===lastEventSignature)return;lastEventSignature=signature;
    if(event.type==='green'){showMessage('¡LARGÁ!',{duration:800,kind:'success'});raceAudio.raceSignal('green');vibrate(55,.45);}
    if(event.type==='sector'){showMessage(`SECTOR ${event.index+1} · ${formatTime(event.time)}`,{duration:900});raceAudio.raceSignal('sector');}
    if(event.type==='checkpoint-missed'){showMessage(`CHECKPOINT OMITIDO +${event.penalty.toFixed(0)} s`,{duration:1500,kind:'danger'});raceAudio.raceSignal('penalty');}
    if(event.type==='best-lap'){showMessage(`MEJOR VUELTA · ${formatTime(event.time)}`,{duration:1600,kind:'success'});raceAudio.raceSignal('best');vibrate([35,25,35,25,80],.55);}
    if(event.type==='lap'){showMessage(event.valid?`VUELTA · ${formatTime(event.time)}`:'VUELTA INVALIDADA',{duration:1300,kind:event.valid?'':'danger'});}
    if(event.type==='impact'){showMessage('IMPACTO',{duration:500,kind:'danger',announce:false});vibrate([45,20,80],.9);}
    if(event.type==='recover'){raceWeatherEffects.reset();clearInputs();driverControlPipeline.reset();updatePhysicalVehicleVisuals(simulation.getRenderFrame(),true);onVehicleReset({reason:event.reason,source:event.source,speedMps:0});onRecoveryReset(event);raceAudio.raceSignal('penalty');vibrate([45,25,65],.65);showMessage(`RECUPERACIÓN +${simulation.settings.recoveryPenalty.toFixed(1)} s`,{kind:'danger'});}
    if(event.type==='finish'){ui.start.classList.remove('active');ui.start.textContent='OTRA CARRERA';ui.pause.disabled=true;showMessage(`META · ${formatTime(event.time)}`,{duration:1900,kind:'success'});raceAudio.raceSignal('finish');window.setTimeout(showResults,650);}
  }

  function updateStartLights() {
    startSignal.update(lastState);
    const status=lastState.status,countdown=Math.ceil(lastState.countdown||0);for(let i=0;i<startLights.length;i++){const on=status==='COUNTDOWN'&&i>=Math.max(0,5-countdown*2);startLights[i].material.color.set(on?0xff1f16:status==='RUNNING'?0x22e879:0x2b0908);}
  }
  let minimapAccumulator=0;
  function updateHud(dt=0) {
    const state=lastState;ui.lap.textContent=`${Math.min(state.lap,simulation.settings.laps)}/${simulation.settings.laps}`;ui.time.textContent=formatTime(state.totalWithPenalty, '00:00.000');ui.best.textContent=formatTime(state.bestLapTime);
    const ghost=simulation.getGhostPose(Math.max(0,state.totalTime-state.lapStartTime));let delta=0;if(ghost){const distance=track.shortestDistance(ghost.s,state.s);delta=-distance/Math.max(8,(Math.abs(feedback.speedMps)+Math.abs(ghost.speed||0))*.5);}ui.delta.textContent=formatDelta(delta);ui.delta.parentElement?.classList.toggle('positive',delta>0.0005);ui.delta.parentElement?.classList.toggle('negative',delta<-.0005);
    ui.sector.textContent=`S${Math.min(track.checkpoints.length,state.nextCheckpointIndex+1)}`;const position=1+(state.rivals||[]).filter(r=>r.raceProgress>state.raceProgress).length;ui.position.textContent=`${position}/${(state.rivals?.length||0)+1}`;ui.surface.textContent=String(state.surface||'asphalt').toUpperCase();ui.surface.dataset.surface=state.surface||'asphalt';const offroad=!['asphalt','curb'].includes(state.surface);ui.offroad.classList.toggle('active',offroad);ui.offroad.classList.toggle('danger',state.surface==='barrier');
    ui.pause.disabled=['IDLE','FINISHED'].includes(state.status);ui.start.classList.toggle('active',['COUNTDOWN','RUNNING','PAUSED'].includes(state.status));
    if(state.status==='COUNTDOWN'){const number=Math.max(1,Math.ceil(state.countdown));if(number!==lastCountdownNumber){lastCountdownNumber=number;showMessage(String(number),{duration:0,countdown:true,announce:true});raceAudio.raceSignal('countdown');}}
    if(state.status==='RUNNING'&&lastCountdownNumber!==0){lastCountdownNumber=0;}
    updateStartLights();minimapAccumulator+=dt;if(minimapAccumulator>.09){minimapAccumulator%=.09;drawMinimap();}
  }

  function getInput() {
    const input=mergedRaceInput();const state=simulation.state;const locked=settingsOpen||resultsOpen||state.status==='PAUSED'||state.status==='COUNTDOWN';
    let throttle=input.throttle,brake=input.brake,steer=input.steer;
    if(settings.assists.tcs&&lastState.slip>.32)throttle*=clamp(1-(lastState.slip-.32)*1.25,.28,1);
    if(settings.assists.abs&&brake>.72&&Math.abs(feedback.speedMps)>8)brake=.72+Math.sin(performance.now()*.045)*.12;
    latestInput={...input,steer,throttle:clamp(throttle,0,1),brake:clamp(brake,0,1)};
    if(locked)return{steer:0,throttle:0,brake:state.status==='COUNTDOWN'?1:0,clutch:0,handbrake:0,lookBack:input.lookBack};
    return{...latestInput};
  }
  function getControlGate(){const status=simulation.state.status;return{blockDriving:settingsOpen||resultsOpen||status==='PAUSED'||status==='COUNTDOWN',holdBrake:status==='COUNTDOWN',status};}

  function checkRivalCollision(currentFeedback) { return currentFeedback; }

  let visualAccumulator=0;
  function currentPhysicalInputFeedback() {
    const snapshot=simulation.getRenderFrame?.().currentSnapshot||simulation.state.physicsSnapshot||null;
    const velocity=snapshot?.chassis?.linearVelocity||[0,0,0];
    const wheels=Array.isArray(snapshot?.wheels)?snapshot.wheels:[];
    const frontWheels=wheels.filter(wheel=>wheel?.id==='frontLeft'||wheel?.id==='frontRight');
    const aligningTorqueNm=frontWheels.reduce(
      (sum,wheel)=>sum+(Number(wheel?.aligningTorqueNm)||0),0,
    );
    const frontContactRatio=frontWheels.length
      ?frontWheels.filter(wheel=>wheel?.contact).length/frontWheels.length:1;
    return {
      speedMps:Math.hypot(Number(velocity[0])||0,Number(velocity[2])||0),
      aligningTorqueNm,
      frontContactRatio,
      steeringCondition:clamp(Number(snapshot?.damage?.steering?.condition)||1,.2,1),
    };
  }
  function update(dt, vehicleStateOrSpeed=0, steerLegacy=0) {
    if(globalThis.__asfaltoRacePresentationHeld)dt=0;
    const external=typeof vehicleStateOrSpeed==='number'?{speedMps:vehicleStateOrSpeed,steer:steerLegacy,throttle:0,brake:0,handbrake:0}:vehicleStateOrSpeed||{};
    const sourceSteer=clamp(external.steer??latestInput.steer,-1,1);
    const v6Controls=driverControlPipeline.sample(dt,{
      steer:sourceSteer,
      steeringMode:external.steeringMode||'none',
      throttle:clamp(external.throttle??latestInput.throttle,0,1),
      brake:clamp(external.brake??latestInput.brake,0,1),
      clutch:clamp(
        external.clutch??(external.clutchEngagement==null?latestInput.clutch:1-external.clutchEngagement),
        0,1,
      ),
      handbrake:clamp(external.handbrake??latestInput.handbrake,0,1),
      requestedGear:Number.isInteger(external.requestedGear)?external.requestedGear:null,
      digitalActions:external.digitalActions||{},
      inputRegion:external.inputRegion,
      protectedInteraction:external.protectedInteraction,
    },currentPhysicalInputFeedback());
    const input={
      ...v6Controls,
      requestedGear: Number.isInteger(external.requestedGear)
        ? external.requestedGear : v6Controls.requestedGear,
      clutchEngagement: Math.min(
        v6Controls.clutchEngagement,
        clamp(external.automaticClutchEngagement??1,0,1),
      ),
    };
    if(simulation.state.status==='PAUSED')feedback={...feedback,camera:{...lastState.camera},track:track.sample(lastState.s)};else feedback=simulation.step(options.isCameraIntroductionActive?.()?0:dt,input);
    const renderFrame=simulation.getRenderFrame();
    const currentSnapshot=renderFrame.currentSnapshot;
    if(!document.body.classList.contains("v6-menu-open"))globalThis.__asfaltoVehicleAssistance?.update({snapshot:currentSnapshot,status:simulation.state.status,dt,routeNormal:renderFrame.projection?.routeFrame?.normal});
    if(Number.isInteger(currentSnapshot?.gearbox?.gear)
      && currentSnapshot.gearbox.gear===input.requestedGear){
      v6InputAdapter.reportGearResult({
        accepted:true,
        gear:currentSnapshot.gearbox.gear,
      });
    }
    lastState=simulation.getState();updateFalconVisual();feedback=checkRivalCollision(feedback);lastState=simulation.getState();maxSpeedMps=Math.max(maxSpeedMps,Math.abs(feedback.speedMps||0));
    if(feedback.surface!==lastSurface){lastSurface=feedback.surface;if(!['asphalt','curb'].includes(lastSurface))showMessage(lastSurface==='barrier'?'BARRERA':String(lastSurface).toUpperCase(),{duration:500,kind:lastSurface==='barrier'?'danger':'',announce:false});}
    updateSkyAndWeather(dt);updateActiveTrackScene();
    if (currentSnapshot?.chassis && playerVisualBody) {
      playerVisualBody.getWorldPosition(fxPosition); playerVisualBody.getWorldQuaternion(fxQuaternion);
      fxVelocity.fromArray(currentSnapshot.chassis.linearVelocity || [0,0,0]);
      let contactHeight=0,contactCount=0;
      for(const wheel of currentSnapshot.wheels||[])if(wheel.contact&&Array.isArray(wheel.point)){contactHeight+=wheel.point[1];contactCount++;}
      const groundY=contactCount?contactHeight/contactCount:(feedback.track?.y ?? track.sample(lastState.s).y);
      const impacts=currentSnapshot.impacts||[];let metalEvent=null;
      if(!impacts.length)lastMetalImpactKey=null;
      for(let i=impacts.length-1;i>=0;i--){const event=impacts[i];if(fxMetalMaterials.has(event.material)||event.otherId==='falcon'||event.otherId==='chevy'){metalEvent=event;break;}}
      const metalKey=metalEvent?metalEvent.timeSeconds+'|'+metalEvent.otherId+'|'+metalEvent.impulseNs:null;
      let metalContact=null;
      if(metalKey&&metalKey!==lastMetalImpactKey){
        lastMetalImpactKey=metalKey;fxImpactPosition.fromArray(metalEvent.localPointM||[0,0,0]).applyQuaternion(fxQuaternion).add(fxPosition);
        const otherVelocity=renderFrame.rivals?.[metalEvent.otherId]?.currentSnapshot?.chassis?.linearVelocity;
        const relativeVelocity=metalEvent.relativeVelocityMps||[fxVelocity.x-(otherVelocity?.[0]||0),fxVelocity.y-(otherVelocity?.[1]||0),fxVelocity.z-(otherVelocity?.[2]||0)];
        metalContact={point:fxImpactPosition.toArray(),relativeVelocity,impulseNs:metalEvent.impulseNs,material:fxMetalMaterials.has(metalEvent.material)?metalEvent.material:'vehicle-metal'};
      }
      raceWeatherEffects.update({dt,environment:getRaceRenderEnvironment(),qualityTier:performanceState.qualityTier,camera,cameraMode:options.getCameraMode?.()||'cockpit',
        paused:simulation.state.status==='PAUSED',active:graphicsPreparationActive||document.body.classList.contains('v6-driving')&&!document.body.classList.contains('v6-menu-open')&&!document.body.classList.contains('an-intro-open'),
        rivals:falconPhysicalBody?.visible&&renderFrame.rivals?.falcon?.currentSnapshot?.chassis?[{id:'falcon',snapshot:renderFrame.rivals.falcon.currentSnapshot}]:[],
        vehicle:{id:globalThis.__asfaltoSelectedPlayerVehicle||'chevy',visualRoot:playerVisualBody,metalContact,position:fxPosition,quaternion:fxQuaternion,velocity:fxVelocity,speedMps:feedback.speedMps,groundY,wheelContacts:currentSnapshot.wheels,impacts:currentSnapshot.impacts,enclosed:true,
          surface:feedback.surface,slip:feedback.slip,impact:feedback.impact,collisionCount:lastState.collisionCount,
          rpm:currentSnapshot.engine?.rpm ?? external.rpm,throttle:input.throttle,popsLevel:external.popsLevel,
          engineTemperatureC:currentSnapshot.engine?.temperatureC,engineDamage:currentSnapshot.damage?.engine,engineFire:currentSnapshot.damage?.engine?.fire === true}});
    }
    visualAccumulator+=dt;const targetVisualRate=isHighGraphicsQuality(performanceState.qualityTier)?1/60:performanceState.qualityTier==='balanced'?1/40:1/28;if(visualAccumulator>=targetVisualRate){visualAccumulator%=targetVisualRate;updateRoadGeometry();disableLegacyTrackLayers();updateRivals();updateGhost();}
    processLatestEvent();updateHud(dt);raceAudio.update(dt,feedback,lastState,input,renderFrame);if(feedback.curbIntensity>.45&&Math.random()<dt*7)vibrate(16,.22+feedback.curbIntensity*.25);return{...feedback,controls:input,renderFrame,state:lastState};
  }

  let rearviewMaterial = null;
  let rearviewRenderAccumulator = Infinity;
  const rearPreviousViewport = new THREE.Vector4();
  const rearPreviousScissor = new THREE.Vector4();
  let rearviewTarget = renderer ? new THREE.WebGLRenderTarget(512,144,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:true,stencilBuffer:false}) : null;
  if(rearviewTarget){rearviewTarget.texture.name='RearviewRenderTarget';rearviewTarget.texture.colorSpace=THREE.SRGBColorSpace;}
  const rearCamera = camera?.clone?.() || null;
  if(rearCamera){rearCamera.near=.08;rearCamera.far=430;rearCamera.fov=48;rearCamera.aspect=512/144;rearCamera.updateProjectionMatrix();}
  let renderingRearview=false;
  function syncRearviewMaterial() {
    if(!rearviewMaterial)return;
    const enabled=settings.rearviewEnabled!==false;
    rearviewMaterial.map=enabled&&rearviewTarget?rearviewTarget.texture:null;
    rearviewMaterial.color.setHex(enabled?0xffffff:0x111820);
    rearviewMaterial.needsUpdate=true;
  }
  function attachRearview(material) {rearviewMaterial=material||null;syncRearviewMaterial();return!!rearviewMaterial;}
  function renderRearview(force=false, physicalRearPose=null) {
    if(settings.rearviewEnabled === false) return false;
    const rearviewInterval = isHighGraphicsQuality(performanceState.qualityTier) ? 1 / 30 : performanceState.qualityTier === 'balanced' ? 1 / 22 : 1 / 15;
    if (!force && rearviewRenderAccumulator < rearviewInterval) return false;
    if(renderingRearview||contextLost||!renderer||!rearCamera||!rearviewTarget||!rearviewMaterial||!camera)return false;
    rearviewRenderAccumulator=0;
    renderingRearview=true;const previousTarget=renderer.getRenderTarget();const previousCockpitVisible=cockpit?.visible;const previousShadow=renderer.shadowMap?.autoUpdate;const previousScissorTest=renderer.getScissorTest?.()||false;renderer.getViewport(rearPreviousViewport);renderer.getScissor(rearPreviousScissor);try{
      if(cockpit)cockpit.visible=false;if(renderer.shadowMap)renderer.shadowMap.autoUpdate=false;const hasPhysicalRearPose=Array.isArray(physicalRearPose?.position)&&Array.isArray(physicalRearPose?.look);if(hasPhysicalRearPose){rearCamera.position.fromArray(physicalRearPose.position);rearCamera.up.copy(camera.up);rearCamera.lookAt(new THREE.Vector3().fromArray(physicalRearPose.look));}else{rearCamera.position.copy(camera.position);rearCamera.position.y+=.02;const behind=new THREE.Vector3(0,-.04,13).applyQuaternion(camera.quaternion).add(rearCamera.position);rearCamera.up.copy(camera.up);rearCamera.lookAt(behind);}renderer.setRenderTarget(rearviewTarget);renderer.setScissorTest(false);renderer.clear(true,true,true);renderer.render(scene,rearCamera);return true;
    }finally{renderer.setRenderTarget(previousTarget);renderer.setViewport(rearPreviousViewport);renderer.setScissor(rearPreviousScissor);renderer.setScissorTest(previousScissorTest);if(cockpit)cockpit.visible=previousCockpitVisible;if(renderer.shadowMap)renderer.shadowMap.autoUpdate=previousShadow;renderingRearview=false;}
  }
  function resize() {
    if(!rearviewTarget||!viewport)return;const width=viewport.clientWidth||800;const scale=getPerformanceScale();const targetWidth=Math.max(256,Math.min(768,Math.round(width*.62*scale)));const targetHeight=Math.round(targetWidth/3.55);rearviewTarget.setSize(targetWidth,targetHeight);rearviewRenderAccumulator=Infinity;if(rearCamera){rearCamera.aspect=targetWidth/targetHeight;rearCamera.updateProjectionMatrix();}drawMinimap();
  }
  function getCameraMotion() {
    const motion=feedback.camera||lastState.camera||{};return{pitch:motion.pitch||0,roll:motion.roll||0,heave:motion.heave||0,shake:motion.shake||0,lookAhead:motion.lookAhead||0,lookBack:latestInput.lookBack||lookBack,surface:lastState.surface};
  }

  contextRecovery=createContextRecovery({pause:()=>pause({reason:'context-lost'}),
    // Browser-dispatched listeners can checkpoint microtasks between callbacks.
    // Let all compositor restoration listeners finish before capturing their targets.
    prepare:async()=>{await yieldToMain();visualWarmupCache.invalidate();await globalThis.__cockpit.prepareRendering();},
    onState({state,error}){contextLost=state!=='ready';ui.live.textContent=state==='ready'?'Contexto gráfico restaurado. Podés reanudar.':state==='failed'?'No se pudo restaurar la imagen: '+error+'. Reanudar vuelve a intentarlo.':'La carrera está pausada mientras se recupera el contexto gráfico.';showMessage(ui.live.textContent,{duration:state==='ready'?1600:0,kind:state==='ready'?'success':'danger'});},
  });
  function onContextLost(event) {event.preventDefault();contextRecovery.lost();}
  function onContextRestored() {rearviewRenderAccumulator=Infinity;void contextRecovery.restore();}


  function setNumericSetting(key,value,min=0,max=1){settings[key]=clamp(Number(value),min,max);syncUiSettings();saveUiSettings();}
  listen(window,'keydown',onKeyDown,{capture:true,passive:false});listen(window,'keyup',onKeyUp,{capture:true});listen(window,'blur',clearInputs);listen(document,'visibilitychange',()=>{if(document.hidden){clearInputs();if(['RUNNING','COUNTDOWN'].includes(simulation.state.status))pause();void raceAudio.suspend();}else void raceAudio.resume();});listen(window,'pagehide',()=>{clearInputs();void raceAudio.suspend();});listen(window,'deviceorientation',onDeviceOrientation);listen(document,'fullscreenchange',onFullscreenChange);listen(window,'gamepadconnected',(event)=>{gamepadName=event.gamepad?.id||'Gamepad';showMessage('Gamepad conectado',{duration:900,kind:'success'});});listen(window,'gamepaddisconnected',()=>{gamepadName=null;lastGamepadButtons=[];});
  if(renderer?.domElement){listen(renderer.domElement,'webglcontextlost',onContextLost,false);listen(renderer.domElement,'webglcontextrestored',onContextRestored,false);}

  bindTouchButton(ui.touchLeft,'steerLeft');bindTouchButton(ui.touchRight,'steerRight');bindTouchButton(ui.touchAccelerate,'accelerate');bindTouchButton(ui.touchBrake,'brake');bindTouchButton(ui.touchHandbrake,'handbrake');
  for(const button of bindingButtons){listen(button,'click',()=>{listeningBinding=button.dataset.binding;bindingButtons.forEach(b=>b.classList.toggle('listening',b===button));button.textContent='Pulsá…';});}
  listen(ui.resetBindings,'click',()=>{settings.keyBindings={...DEFAULT_BINDINGS};listeningBinding=null;syncBindingButtons();saveUiSettings();showMessage('Teclas restablecidas',{duration:800});});

  listen(ui.start,'click',()=>{void start();});listen(ui.pause,'click',togglePause);listen(ui.recover,'click',recover);
  listen(ui.circuit,'change',()=>{void selectCircuit(ui.circuit.value).catch(error=>showMessage(String(error?.message||error),{duration:1800,kind:'danger'}));});listen(ui.mode,'change',()=>{configureSimulation();showMessage(ui.mode.selectedOptions[0]?.textContent||'Modo actualizado',{duration:900});});listen(ui.laps,'change',configureSimulation);
  listen(ui.settingsToggle,'click',()=>setSettingsOpen(!settingsOpen));listen(ui.settingsClose,'click',()=>setSettingsOpen(false));listen(ui.resultsRestart,'click',()=>void start());listen(ui.resultsClose,'click',closeResults);
  listen(ui.weather,'change',()=>{const presetId=environmentPresetForLegacySettings(settings);void selectEnvironmentPreset(presetId,{weather:ui.weather.value}).catch(error=>{showMessage(String(error?.message||error),{duration:1800,kind:'danger'});});});listen(ui.timeOfDay,'change',()=>{const candidate={...settings,skyId:undefined,timeOfDay:ui.timeOfDay.value};const presetId=environmentPresetForLegacySettings(candidate);void selectEnvironmentPreset(presetId).catch(error=>{showMessage(String(error?.message||error),{duration:1800,kind:'danger'});});});
  listen(ui.difficulty,'input',()=>{settings.difficulty=clamp(ui.difficulty.value,0,1);ui.difficultyValue.textContent=`${Math.round(settings.difficulty*100)}%`;simulation.configure(coreSettingsFromUi());saveUiSettings();});listen(ui.rivals,'input',()=>{settings.rivalCount=Math.round(clamp(ui.rivals.value,0,12));ui.rivalsValue.textContent=String(settings.rivalCount);simulation.configure(coreSettingsFromUi());saveUiSettings();});
  listen(ui.idealLine,'change',()=>{settings.idealLine=ui.idealLine.checked;idealLine.visible=settings.idealLine;syncUiSettings();saveUiSettings();});listen(ui.hudProfile,'change',()=>{settings.hudProfile=ui.hudProfile.value;syncUiSettings();saveUiSettings();});listen(ui.hudScale,'input',()=>setNumericSetting('hudScale',ui.hudScale.value,.72,1.35));listen(ui.hudOpacity,'input',()=>setNumericSetting('hudOpacity',ui.hudOpacity.value,.4,1));
  listen(ui.touchEnabled,'change',()=>{settings.touchEnabled=ui.touchEnabled.checked;syncUiSettings();saveUiSettings();});listen(ui.gyroEnabled,'change',()=>{void requestGyroPermission(ui.gyroEnabled.checked).then(syncUiSettings);});listen(ui.fullscreen,'click',()=>void toggleFullscreen());
  listen(ui.audioAmbient,'input',()=>setNumericSetting('audioAmbient',ui.audioAmbient.value));listen(ui.audioTires,'input',()=>setNumericSetting('audioTires',ui.audioTires.value));listen(ui.audioImpacts,'input',()=>setNumericSetting('audioImpacts',ui.audioImpacts.value));listen(ui.audioSignals,'input',()=>setNumericSetting('audioSignals',ui.audioSignals.value));
  for(const input of assistInputs){listen(input,'change',()=>{settings.assists={...settings.assists,[input.dataset.assist]:input.checked};simulation.configure(coreSettingsFromUi());saveUiSettings();});}
  listen(document,'pointerdown',(event)=>{if(settingsOpen&&!ui.settings.contains(event.target)&&!ui.settingsToggle.contains(event.target))setSettingsOpen(false);});

  if(ui.environmentPreset){environmentSelectController=createEnvironmentSelectController({select:ui.environmentPreset,createOption:({id,label})=>{const option=document.createElement('option');option.value=id;option.textContent=label;return option;},getTrackDefault:id=>trackEnvironmentDefault(id),initialPreset:settings.skyId||trackEnvironmentDefault(track.id),getCurrent:()=>environmentPresetForLegacySettings(settings),onSelect:presetId=>selectEnvironmentPreset(presetId),onError:error=>{showMessage(String(error?.message||error),{duration:1800,kind:'danger'});}});}
  const initialEnvironmentAdapter=globalThis.__asfaltoV6Modular?.trackManager?.active;
  if(initialEnvironmentAdapter?.id)applyEnvironmentPresetToSettings(settings.skyId||trackEnvironmentDefault(initialEnvironmentAdapter.id,initialEnvironmentAdapter));
  if(window.matchMedia?.('(pointer: coarse)').matches&&!storage?.getItem(UI_STORAGE_KEY))settings.touchEnabled=true;
  syncUiSettings();rebuildScatter();applyTheme({announce:false});updateHud();resize();showMessage(`${track.name} · LISTO`,{duration:1200});

  async function setSettings(next={}) {
    const transition = beginEnvironmentSelection();
    try {
    if(next.mode && ui.mode) ui.mode.value=String(next.mode);
    if(ui.laps&&next.laps!=null)ui.laps.value=String(Math.max(1,Math.min(20,Math.trunc(Number(next.laps)||1))));
    settings={...settings,...next,keyBindings:{...settings.keyBindings,...(next.keyBindings||{})},assists:{...settings.assists,...(next.assists||{})}};
    if (next.timeOfDay != null && next.skyId == null) settings.skyId = undefined;
    Object.assign(settings, normalizedEnvironmentSettings(settings));
    settings.difficulty=clamp(settings.difficulty,0,1);
    settings.rivalCount=Math.round(clamp(settings.rivalCount,0,12));
    settings.focusSector=Math.max(1,Math.min(track.checkpoints.length,Math.trunc(settings.focusSector||1)));
    settings.speedTrapAttempts=Math.max(1,Math.min(12,Math.trunc(settings.speedTrapAttempts||3)));
    settings.tireWear=settings.tireWear!==false;
    settings.rearviewEnabled=settings.rearviewEnabled!==false;
    settings.hudScale=clamp(settings.hudScale,.72,1.35);
    settings.hudOpacity=clamp(settings.hudOpacity,.4,1);
    simulation.configure(coreSettingsFromUi());
    syncUiSettings();
    syncRearviewMaterial();
    applyTheme();
    await syncEnvironment();
    if (!transition.isCurrent()) return getState();
    transition.commit();
    saveUiSettings({ environment: next.skyId != null || next.weather != null || next.timeOfDay != null });
    return getState();
    } catch (error) {
      if (transition.rollback()) { simulation.configure(coreSettingsFromUi()); syncUiSettings(); applyTheme(); }
      throw error;
    } finally {
      transition.finish();
    }
  }
  function getState() {return{...simulation.getState(),ghost:simulation.getGhost(),feedback:{...feedback,camera:{...(feedback.camera||{})}},ui:{...settings,keyBindings:{...settings.keyBindings},settingsOpen,resultsOpen,touchSteer,gamepadName},performance:{...performanceState},audio:raceAudio.getState(),contextLost,trackDescription:track.description,maxSpeedKmh:maxSpeedMps*3.6};}
  function getResourceLifetimeDiagnostics(){const environment=getEnvironmentDiagnostics();const trackDiagnostics=globalThis.__asfaltoV6Modular?.trackManager?.active?.getDiagnostics?.()||null;const physics=simulation.getDiagnostics();return Object.freeze({track:Object.freeze({id:trackDiagnostics?.id||null,state:trackDiagnostics?.state||null,live:trackDiagnostics?.live||null,ownershipRemainder:trackDiagnostics?.ownershipRemainder??null,ownershipErrors:trackDiagnostics?.ownershipErrors??0}),environment:Object.freeze({sources:environment.environmentResources.sourcesCreated-environment.environmentDisposals.sources,targets:environment.environmentResources.targetsCreated-environment.environmentDisposals.targets,cacheEntries:environment.environmentCache.entries,cacheBytes:environment.environmentCache.bytes}),rapier:Object.freeze({dynamicBodies:physics.dynamicBodyCount??null,playerContacts:physics.playerContacts??null,rivalCount:physics.rivalCount??null}),renderer:getPerformanceDiagnostics().resources,qaWeakResources:qaTrackLifetimeDiagnostics()});}
  function dispose() {
    if (environmentHostDisposal) return environmentHostDisposal;
    environmentHostDisposed = true;
    options.onDispose?.();
    environmentHostDisposal = (async () => {
    clearRoadTestGates();roadTestCourse.dispose();
    falconPresentation?.dispose();falconPresentation=null;
    raceWeatherEffects.dispose();contextRecovery?.dispose();
    releaseRaceDayCycle();raceSkyTransition?.dispose();startSignalSubscription?.();startSignal.dispose();
    environmentController.dispose();
    trackMaterialController?.dispose?.();
    trackMaterialController = null;
    trackMaterialControllerTrackId = null;
    regionalEnvironment = null;
    regionalSurfaceCondition = null;
    disposeEnvironmentLightRig();
    environmentBaseline = null;
    environmentWorkshopRuntime = null;
    environmentPmremCache?.dispose();environmentPmremCache=null;
    environmentPmremGenerator?.dispose();
    environmentPmremGenerator = null;
    environmentDecodedCache.clear();
    clearHdriPresetCache();
    environmentSelectController?.dispose?.();
    environmentSelectController = null;
    if (typeof physicalRenderBridge !== 'undefined') {
      physicalRenderBridge?.dispose();
      physicalRenderBridge = null;
    }
    if (typeof falconPhysicalBody !== 'undefined') {
      falconPhysicalBody?.removeFromParent?.();
      falconPhysicalBody = null;
    }
    await simulation.dispose?.();
    window.clearTimeout(messageTimer);modularRaceCue.remove(); modularRaceCueStyle.remove();clearInputs();for(const remove of listeners.splice(0))try{remove();}catch{/* ignored */}raceAudio.dispose();rearviewTarget?.dispose();
    if(backgroundImage)backgroundImage.style.opacity=priorBackgroundOpacity;scene.fog=originalFog;for(const item of originalLightState){item.object.intensity=item.intensity;item.object.color.copy(item.color);if(item.groundColor&&item.object.groundColor)item.object.groundColor.copy(item.groundColor);}
    root.traverse(object=>{if(object.geometry)object.geometry.dispose?.();if(object.material){for(const material of(Array.isArray(object.material)?object.material:[object.material])){material.map?.dispose?.();material.dispose?.();}}});scene.remove(root);document.body.classList.remove('race-menu-open','race-results-open','race-touch-active');
    return true;
    })();
    return environmentHostDisposal;
  }

  return {
    update,getInput,getControlGate,start,pause,resume,togglePause,recover,selectCircuit,setSettings,setSettingsOpen,getState,getCameraMotion,
    getForwardGearCount:()=>v6InputAdapter.profile.gearCount,
    ...(isAsfaltoV5Qa ? { debugSetRaceState, debugDrivePhysicalRoute, debugTeleportPhysicalVehicle } : {}),
    beginPerformanceWindow:phase=>performanceGovernor.beginWindow(phase),renderRearview,attachRearview,setAuthoredTrackVisuals,setFalconVisualRig,setFalconPresentation:controller=>{falconPresentation=controller;},getFalconVisualRoot:()=>falconVisualRig?.root||null,getRenderFrame:()=>simulation.getRenderFrame(),invalidateVehiclePhysics:()=>simulation.disposePhysicalStack(),getV6Diagnostics:()=>({...simulation.getDiagnostics(),driving:driverControlPipeline.diagnostics(),renderBridge:physicalRenderBridge?.diagnostics?.()||null,playerWheelVisuals:playerWheelVisualRig?.getDiagnostics?.()||null,playerVisualYawOffsetRad:raceChevyV3.rotation.y,falconVisualInstalled:!!falconVisualRig,falconVisualVisible:!!falconPhysicalBody?.visible,falconVisualMeshes:falconVisualRig?countMeshes(falconVisualRig.root):0}),updateActiveTrackScene,getAuthoredSceneDiagnostics,syncEnvironment,selectEnvironmentPreset,applyWorkshopEnvironment,getEnvironmentDiagnostics,getEnvironmentPerformance:()=>({shaderPrograms:renderer.info.programs?.length||0,builds:[...environmentBuildTimings],cache:environmentPmremCache?.diagnostics()}),resize,reportFrame,getPerformanceScale,getPerformanceTier,setPerformanceQuality,getPerformanceDiagnostics,isPreparing:()=>pendingRacePreparations>0,getContextRecoveryState:()=>contextRecovery.diagnostics(),getResourceLifetimeDiagnostics,clearInputs,releaseTouchCaptures,dispose,
    getAdvancedGraphicsEnvironment:()=>({...getRaceRenderEnvironment(),skyId:raceDayActive?raceDayClock.state.skyId:settings.skyId,weather:raceDayActive?raceDayEnvironment?.weatherId:settings.weather,keyLightDirection:keyLight.position.toArray(),keyLightColor:'#'+keyLight.color.getHexString(),sunIntensity:keyLight.visible?keyLight.intensity:0}),
    subscribePhysicalSteps:observer=>simulation.subscribePhysicalSteps(observer),
    getPhysicalObservationState:()=>simulation.getPhysicalObservationState(),
    getRoadTestContext:()=>simulation.getRoadTestContext(),
    setRoadTestGates,clearRoadTestGates,getRoadTestGatesDiagnostics:()=>roadTestCourse.diagnostics(),
    configureChampionship:({enabled=false,onFinalClassification}={})=>simulation.configureChampionship({enabled,createLedger:createChampionshipClassificationLedger,onFinalClassification}),
    getChampionshipClassification:()=>simulation.getChampionshipClassification(),
    getFinalClassification:()=>simulation.getFinalClassification(),
    retireChampionshipParticipant:(id,status,reason)=>simulation.retireChampionshipParticipant(id,status,reason),
    invalidateChampionship:reason=>simulation.invalidateChampionship(reason),
    renderWaterReflections:options=>raceWeatherEffects.renderWaterReflections(options),
    activateAudio:()=>raceAudio.ensureStarted(),
    getStartSignalDiagnostics:()=>startSignal.diagnostics(),
    getWeatherEffectsDiagnostics:()=>({...raceWeatherEffects.diagnostics(),policy:weatherEffectsPolicy(getRaceRenderEnvironment() || {},performanceState.qualityTier)}),
    getEffectiveFogState:()=>raceWeatherEffects.getEffectiveFogState(regionalEnvironment),
    prepareFogRender:options=>raceWeatherEffects.prepareFogRender(options),
    attachWeatherWindshield:config=>raceWeatherEffects.attachWindshield(config),
    attachWeatherSurfaces:roots=>raceWeatherEffects.attachVehicleSurfaces(roots),
    getSoundscapeDiagnostics:()=>raceAudio.soundscapeDiagnostics(),
    setDayCycleOptions,getDayCycleDiagnostics:()=>({...raceDayClock.diagnostics(),active:raceDayActive,resources:raceSkyTransition.diagnostics()}),
    getDrivingLights:()=>({...drivingLights.getState(),phase:raceDayActive?raceDayClock.state.phase:settings.timeOfDay}),setDrivingLights,
    refreshWeatherEffectSurfaces:adapter=>raceWeatherEffects.refreshTrack({getMaterialBindings:()=>adapter.getMaterialBindings?.() || []}),
    get track(){return track;},get state(){return simulation.state;},get circuits(){return RaceCore.TRACK_BLUEPRINTS;},
    get isPaused(){return simulation.state.status==='PAUSED';},get isRenderingRearview(){return renderingRearview;},get rearviewEnabled(){return settings.rearviewEnabled !== false;},
  };
}

  const trackGlbHelpers = { parseGlb, makeAttribute, textureFromInfo, meshoptDecoder: MeshoptDecoder };
  function disposeTrackObjectRoot(root) {
    if (!root || typeof root.traverse !== 'function') return false;
    // Detach first so render decorators restore the owner's source resources before disposal.
    root.removeFromParent?.();
    advancedGraphics?.refresh();
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse(object => {
      if(object.isInstancedMesh||object.isBatchedMesh)object.dispose?.();object.shadow?.dispose?.();
      if (object?.geometry?.dispose && !geometries.has(object.geometry)) {
        geometries.add(object.geometry);
        object.geometry.dispose();
      }
      for (const material of (Array.isArray(object?.material) ? object.material : [object?.material])) {
        if (!material || materials.has(material)) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture && value.dispose && !textures.has(value)) {
            textures.add(value);
            value.dispose();
          }
        }
        material.dispose?.();
      }
    });
    root.removeFromParent?.();
    root.clear?.();
    return true;
  }
  let modularRaceWorld = null;
  let techoMount = null;
  let roofDisposed = false;
  function disposeCockpitRoof() {
    if (roofDisposed || !techoMount) return false;
    roofDisposed = true;
    const mount = techoMount;
    techoMount = null;
    return disposeTrackObjectRoot(mount);
  }
  let shifterKnobRoot = null;
  function disposeShifterKnob() {
    if (!shifterKnobRoot) return false;
    const root = shifterKnobRoot;
    shifterKnobRoot = null;
    return disposeTrackObjectRoot(root);
  }
  function ownShifterKnob(root) {
    // A decoded model may arrive after cancellation; retain no orphaned GPU data.
    if (modularHostInitialization.signal.aborted || modularRuntimeShutdown) {
      disposeTrackObjectRoot(root);
      throw modularHostInitialization.signal.reason || new Error('Bocha: host shutdown');
    }
    shifterKnobRoot = root;
    return root;
  }
  const disposeBeforeCockpitRoof = bootFailureDisposer;
  bootFailureDisposer = () => {
    try { return disposeBeforeCockpitRoof(); } finally { disposeCockpitRoof(); }
  };
  let raceAudioActivation=null;
  let gpuFrameTimer=null;
  let cockpitDisplayLods=null,framePacingSettings=null,visualPrecompileInProgress=false,cockpitViewPreset=null,lastEffectiveCockpitView=null;
  let cockpitMirrors = null,vehicleCockpitWheel=null;
  let cockpitIgnition = null,cockpitLightSwitch=null;
  let rayTracing=null,rayTracingSettings=null;
  let modularRuntimeShutdown = null;
  const modularRuntimeCleanup = { attempts: 0, completed: 0, failures: [] };
  function disposeModularRuntime() {
    if (modularRuntimeShutdown) return modularRuntimeShutdown;
    modularRuntimeCleanup.attempts += 1;const remainingResources=snapshotSceneResources(scene,{borrowedRoots:[chevyV3Template]});stopDrivingFrame?.();stopDrivingFrame=null;
    window.dispatchEvent(new CustomEvent('asfalto:runtime-dispose'));runtimeEvents.dispose();
    modularRuntimeShutdown = disposeAll([
      ()=>advancedGraphics?.dispose(),()=>{advancedGraphics=null;graphicsSettings?.dispose();graphicsSettings=null;},
      ()=>modularRaceWorld?.dispose?.(),()=>cameraOpening.cancel(),()=>cameraOpeningOverlay.dispose(),
      ()=>headMotionControls?.dispose(),()=>headMotion.dispose(),()=>lightingEditor?.dispose(),()=>colorGrading?.dispose(),
      ()=>rayTracingSettings?.dispose(),()=>rayTracing?.dispose(),()=>gpuFrameTimer?.dispose(),()=>raceAudioActivation?.dispose(),
      ()=>opaqueTransmissionReuse.dispose(),()=>emptyInstanceDrawGuard?.dispose(),()=>vehicleCockpitWheel?.dispose(),
      ()=>cockpitDisplayLods?.dispose(),()=>framePacingSettings?.dispose(),()=>cockpitViewPreset?.dispose(),
      ()=>authoredMirrors?.dispose(),()=>cockpitMirrors?.dispose(),()=>cockpitIgnition?.dispose(),()=>cockpitLightSwitch?.dispose(),
      ()=>disposeRaceChevyWheels(),()=>disposeCockpitRoof(),()=>disposeShifterKnob(),
      ()=>remainingResources.dispose(),()=>renderer.renderLists.dispose(),()=>renderer.dispose(),()=>scene.clear(),()=>engineSound.dispose(),
    ],'No se pudo liberar todo el runtime').then(()=>{modularRuntimeCleanup.completed+=1;},error=>{modularRuntimeCleanup.failures.push(String(error?.message||error));throw error;});
    modularRuntimeShutdown.catch(() => {});
    return modularRuntimeShutdown;
  }
  function modularRuntimeDisposalHandle() { return Object.freeze({ promise: disposeModularRuntime(), cancel() {} }); }
  bootFailureDisposer = () => modularRuntimeDisposalHandle();
  modularHostInitialization = globalThis.__asfaltoV6Modular.beginHostInitialization();
  await modularHostInitialization.own(async () => {
  const activeTrackAdapter = await modularHostInitialization.waitFor(connectModularHost({
    trackId: document.getElementById('race-circuit')?.value || 'dos_lagos',
    prepareClosedRoute(sourceRoute,{id}={}){const closure=createClosedRoute(sourceRoute,{id});return {...closure,createRoots(materials={}){return closure.createRoots(THREE,materials);}};},
    async fetchBytes(url, { signal } = {}) {
      const response = await fetch(url, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('track request failed: ' + response.status + ' ' + url);
      return new Uint8Array(await response.arrayBuffer());
    },
    async completeGlbToObject(bytes, label, { signal } = {}) {
      if (signal?.aborted) throw signal.reason;
      rememberQaTrackResource('glb-bytes', bytes, label);
      rememberQaTrackResource('glb-buffer', bytes.buffer, label);
      const root = await globalThis.AsfaltoV5GlbCore.completeGlbToObject(
        THREE, bytes, label, trackGlbHelpers,
      );
      rememberQaTrackResource('root', root, label);
      if (signal?.aborted) { disposeTrackObjectRoot(root); throw signal.reason; }
      return root;
    },
    createTrackRoot(label) {
      const root = new THREE.Group();
      root.name = label;
      return root;
    },
    disposeObjectRoot(root) { return disposeTrackObjectRoot(root); },
    createCollisionProbe(root) {
      return globalThis.AsfaltoV5GlbCore.createCollisionProbe(THREE, root);
    },
    createPhysicsBridge({ collisionRoot }) {
      return {
        browserStackFactory: globalThis.AsfaltoV6Integration.createBrowserPhysicalStack,
        getCollisionRoot: () => collisionRoot,
        dispose() { return false; },
      };
    },
    detachPhysicsBridge() { return false; },
    disposeRuntime: disposeModularRuntime,
    getRuntimeCleanupDiagnostics() { return Object.freeze({ attempts: modularRuntimeCleanup.attempts, completed: modularRuntimeCleanup.completed, failures: [...modularRuntimeCleanup.failures] }); },
    onBootError(error) { setLoading("Error de pista modular: " + String(error?.message || error)); globalThis.__chevyThreeLoadError = error; },
    installVisualRoot(root) { scene.add(root); },
    detachVisualRoot(root) { root?.removeFromParent?.(); },
    installCollisionRoot(root) { root.visible = false; },
    detachCollisionRoot(root) { root?.removeFromParent?.(); },
    applyVisualEnvironment() {},
  }));

  modularHostInitialization.assertActive();
  const spawnParkingHold = createSpawnParkingHold();
  let mobileDrivingControls = null;
  const raceWorld = createAdvancedRaceWorld(THREE, scene, {
    renderer,
    camera,
    cockpit,
    playerVisualBody: raceChevyPhysicalRoot,
    getPlayerPresentation:()=>raceChevyPresentation,
    playerWheelVisualRig: raceChevyWheelVisualRig,
    viewport,
    getCameraMode:()=>raceCameraState.current,
    isCameraIntroductionActive:()=>cameraOpening.blocking,
    ensureAudioStarted,
    getSharedAudioContext: () => engineSound.context,
    getSharedAudioDestination: () => engineSound.safetyLimiter || engineSound.masterGain,
    getUiAudioDestination:()=>engineSound.masterGain,
    getDrivingAudioLevels: () => ({road:gameSettings.roadVolume,brakes:gameSettings.brakeVolume}),
    getTransmissionMode:()=>gameSettings.transmissionMode,
    onVehicleReset({ speedMps = 0, gear = 'N', reason } = {}) {
      // Track/reset discontinuities must not interpolate from the previous route.
      raceCameraInitialized=false;lastPhysicalCameraPose=null;
      mobileDrivingControls?.releaseAll();
      raceChevyPresentation?.resetCondition();
      cockpitIgnition?.resetMotion();
      headMotion.reset();cockpitHeadRoot.position.set(0,0,0);cockpitHeadRoot.quaternion.identity();
      if (reason === 'race-start') {
        const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || globalThis.__chevyV6Complete?.profile?.().settings?.reducedMotion;
        const cameras=globalThis.__asfaltoV6Modular?.trackManager?.active?.visualRoot?.userData?.asfaltoRegionalCameras;
        headMotion.reset();
        cameraOpening.start(cameras?.openingShot?.status==='rendered_reviewed'?cameras.openingShot:null,{reducedMotion,durationS:cameras?.openingDurationS});
        cameraEntrance.start(raceCameraState.current,{reducedMotion});
      } else { cameraEntrance.cancel();cameraOpening.cancel(); }
      spawnParkingHold.reset({ speedMps });
      vehicle = createVehicleState();
      vehicle.speedMps = Number(speedMps) || 0;
      steering = { steer: 0, velocity: 0 };
      accelerator = { value: 0, velocity: 0 };
      brake = { value: 0, velocity: 0 };
      debugControls.steer = null;
      debugControls.throttle = null;
      debugControls.brake = null;
      if (typeof gearState !== 'undefined') {
        const target = GEAR_POSITIONS[gear] ? gear : 'N';
        gearState.gear = target;
        gearState.requested = target;
        gearState.x = GEAR_POSITIONS[target].x;
        gearState.y = GEAR_POSITIONS[target].y;
        gearState.path = null;
        gearState.pathIndex = 0;
        gearState.segmentTime = 0;
        gearState.clutch = target === 'N' ? 0 : 1;
        gearState.torqueCut = 0;
        gearState.throttleBlip = 0;
        setGearUi();
      }
      updateKeyUi();
    },
    onInputCaptureRelease() {
      releaseCockpitInputCaptures();
    },
    onRecoveryReset() {
      keys.clear();
      releaseCockpitInputCaptures();
      raceCameraInitialized = false;
      lastPhysicalCameraPose = null;
      vehicleCameraRig?.reset(raceWorld.getRenderFrame());
      headMotion.reset(raceWorld.getRenderFrame().currentSnapshot);cockpitHeadRoot.position.set(0,0,0);cockpitHeadRoot.quaternion.identity();
      updateKeyUi();
    },
    ensureRivalVisual:()=>ensureRivalVisual(),
    onDispose:()=>mobileDrivingControls?.dispose(),
    beforeResume:()=>{if(!runtimeDeviceProfile.phone)return true;setRaceCameraMode('cockpit');return raceCameraState.current==='cockpit';},
    getTargetFps:()=>framePacingSettings?.getTargetFps()||60,
    precompileGraphics:({signal}={})=>{signal?.throwIfAborted();return prepareRendering({signal});},
    onRenderingScaleChanged() {
      if (typeof resize === 'function') resize();
    },
  });

  modularHostInitialization.assertActive();
  modularRaceWorld = raceWorld;
  setLoading('Cargando pista modular…');
  const { visualRoot, collisionRoot, collisionProbe } = activeTrackAdapter;
  raceWorld.setAuthoredTrackVisuals({ visualRoot, collisionRoot, collisionProbe });
  window.__asfaltoVehiclePresentations={chevy:null,falcon:null};
  let rivalVisualPromise=null;
  async function ensureRivalVisual(){
    if(rivalVisualPromise)return rivalVisualPromise;
    rivalVisualPromise=(async()=>{
      let sourceRoot=null,rig=null,presentation=null,installed=false;
      const assertRivalActive=()=>{modularHostInitialization.assertActive();if(modularRuntimeShutdown)throw new Error('Rival: host shutdown');};
      try{
        assertRivalActive();
        const bytes=await globalThis.AsfaltoV5PayloadCore.decodePayloadById(document,'asfalto-v6-falcon',gunzipBase64);
        assertRivalActive();
        sourceRoot=await globalThis.AsfaltoV5GlbCore.completeGlbToObject(THREE,bytes,'Falcon v6',trackGlbHelpers);
        assertRivalActive();
        const manifest=JSON.parse(document.getElementById('asfalto-v6-falcon-rig').textContent);
        rig=globalThis.AsfaltoV6Falcon.createFalconVisualRig(THREE,sourceRoot,manifest);
        presentation=await createVehiclePresentation(THREE,{vehicle:'falcon',modelRoot:rig.root,physicalCalibration:true,lightScene:scene,loadGlb:window.__asfaltoLoadVehicleModel,signal:modularHostInitialization.signal});
        assertRivalActive();
        raceWorld.setFalconVisualRig(rig);
        raceWorld.setFalconPresentation(presentation);
        installed=true;
        window.__asfaltoVehiclePresentations.falcon=presentation;lightingEditor?.applyVehicles();
        return presentation;
      }finally{
        if(!installed){presentation?.dispose();if(rig?.root&&rig.root!==sourceRoot)disposeTrackObjectRoot(rig.root);disposeTrackObjectRoot(sourceRoot);}
      }
    })().catch(error=>{rivalVisualPromise=null;throw error;});
    return rivalVisualPromise;
  }
  raceChevyPresentation=await modularHostInitialization.waitFor(createVehiclePresentation(THREE,{vehicle:'chevy',modelRoot:raceChevyV3Model,physicalCalibration:true,lightScene:scene,loadGlb:window.__asfaltoLoadVehicleModel,signal:modularHostInitialization.signal,paintColor:globalThis.__chevyPaintColor||'#d66a24'}),'chevy-presentation');
  raceChevyPresentation.setChassisConfig(globalThis.__asfaltoChassisConfig || null);
  window.__asfaltoVehiclePresentations.chevy=raceChevyPresentation;lightingEditor?.applyVehicles();
  await modularHostInitialization.waitFor(raceWorld.syncEnvironment());


  setLoading('Agregando retrovisores…');
  cockpitMirrors = createCockpitMirrors({ THREE, cockpitRoot:cockpit, excludeRoots:() => [raceChevyPhysicalRoot] });
  cockpit.add(cockpitMirrors.leftDoorMount);
  // Keep the historical editor transform and its scale. New geometry lives
  // inside it, so previously saved mirror positions remain meaningful.
  const rearviewMount = new THREE.Group();
  rearviewMount.name = 'RetrovisorChevyEditable';
  rearviewMount.position.fromArray(COCKPIT_LAYOUT.rearview.position);
  rearviewMount.rotation.fromArray(COCKPIT_LAYOUT.rearview.rotation);
  rearviewMount.scale.fromArray(COCKPIT_LAYOUT.rearview.scale).multiplyScalar(.52);
  cockpitMirrors.rearviewMount.position.set(0,0,0);
  cockpitMirrors.rearviewMount.rotation.set(0,0,0);
  cockpitMirrors.rearviewMount.scale.setScalar(1.48);
  rearviewMount.add(cockpitMirrors.rearviewMount);
  cockpit.add(rearviewMount);

  function tuneAsset(object) {
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
      if (child.geometry) {
        child.geometry.deleteAttribute?.('tangent');
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        material.envMapIntensity = 0.72;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
          if (material[key]) material[key].anisotropy = anisotropy;
        }
      }
    });
  }

  let compositionEditor = null;

  // Carga secuencial para contener el pico de memoria en teléfonos.
  const frontMesh = await modularHostInitialization.waitFor(compressedAssetToObject(THREE, 'frenteGz', 'Frente del auto completo para corte', { signal: modularHostInitialization.signal }), 'cockpit-frenteGz');
  tuneAsset(frontMesh);
  const restoredFront=restoreCockpitFront(THREE,frontMesh);
  cockpitFrontPaint=createChevyPaintController(THREE,frontMesh,{color:globalThis.__chevyPaintColor||'#d66a24',partitionWheels:false});
  if(restoredFront.restored)installCockpitFrontFinish(cockpitFrontPaint,restoredFront);
  frontMesh.rotation.y = COCKPIT_LAYOUT.front.modelRotationY;
  frontMesh.updateMatrixWorld(true);
  const frontCutController = createAdjustableFrontCut({
    THREE,
    mesh: frontMesh,
    ui: frontCutUi,
    defaultPercent: COCKPIT_LAYOUT.front.defaultCutPercent,
    minPercent: COCKPIT_LAYOUT.front.minCutPercent,
    maxPercent: COCKPIT_LAYOUT.front.maxCutPercent,
    onChange() {
      compositionEditor?.updateGuides();
      if (typeof renderFrame === 'function') renderFrame();
    },
  });
  const frontMount = new THREE.Group();
  frontMount.name = 'MontajeFrenteAutoEditable';
  frontMount.position.fromArray(COCKPIT_LAYOUT.front.position);
  frontMount.rotation.fromArray(COCKPIT_LAYOUT.front.rotation);
  cockpit.add(frontMount);
  const front = normalizeObject(THREE, frontMesh, COCKPIT_LAYOUT.front.targetWidth, frontCutController.getDefaultLocalBox());
  front.name = 'ChevyFrenteCorteAjustable';
  frontMount.add(front);

  // Construct only after both independent facets exist. This state survives the
  // lazy camera and writes the actual three globalThis.__asfaltoV7Storage keys transactionally.
  const browserCompositionLayout = (() => { try { return JSON.parse(globalThis.__asfaltoV7Storage.getItem(EDITOR_STORAGE_KEY) || 'null'); } catch { return null; } })();
  const cockpitLayoutFile = createCockpitLayoutFile();
  const compositionInitialLayout = await modularHostInitialization.waitFor(cockpitLayoutFile.initialize(browserCompositionLayout), 'cockpit-file-layout');
  if (compositionInitialLayout) {
    try { globalThis.__asfaltoV7Storage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(compositionInitialLayout)); } catch {}
  }
  const compositionState = createCompositionState({
    storage: globalThis.__asfaltoV7Storage,
    keys: { layout: EDITOR_STORAGE_KEY, background: BACKGROUND_STORAGE_KEY, frontCut: FRONT_CUT_STORAGE_KEY },
    initial: compositionInitialLayout || {},
    defaults: cockpitLayoutFile.defaults,
    build: COCKPIT_BUILD,
    background: backgroundEditor.getState(),
    frontCut: { version: 1, percent: frontCutController.getState().percent },
  });

  const lowPolyHoodWidth = Math.max(0.7, COCKPIT_LAYOUT.front.targetWidth * 0.92);
  const lowPolyHoodGeometry = new THREE.BoxGeometry(
    lowPolyHoodWidth,
    Math.max(0.065, lowPolyHoodWidth * 0.075),
    Math.max(0.58, lowPolyHoodWidth * 0.82),
    1, 1, 1,
  );
  lowPolyHoodGeometry.translate(0, lowPolyHoodWidth * 0.035, 0);
  const lowPolyHoodMaterial = new THREE.MeshStandardMaterial({ color: globalThis.__chevyPaintColor||'#d66a24', roughness: 0.26, metalness: 0.1 });
  const lowPolyHoodProxy = new THREE.Mesh(lowPolyHoodGeometry, lowPolyHoodMaterial);
  cockpitHoodPaintMaterial=lowPolyHoodMaterial;
  lowPolyHoodProxy.name = 'LowPolyHoodProxy';
  lowPolyHoodProxy.position.set(0, lowPolyHoodWidth * 0.045, 0);
  lowPolyHoodProxy.rotation.x = -0.035;
  lowPolyHoodProxy.visible = false;
  frontMount.add(lowPolyHoodProxy);
  frontMount.userData.asfaltoCockpitRain=true;
  raceWorld.attachWeatherSurfaces([raceChevyPhysicalRoot,frontMount]);

  function applyCockpitLod() {
    cockpitDisplayLods?.update({editing:compositionEditor?.isActive()});
    const memoryConstrained = Number(navigator.deviceMemory || 8) <= 4;
    const narrowDevice = (viewport.clientWidth || window.innerWidth || 1024) < 460;
    const automaticEco = gameSettings.graphicsQuality === 'auto' && (memoryConstrained || narrowDevice);
    const useProxy = !compositionEditor?.isActive() && (gameSettings.graphicsQuality === 'eco' || automaticEco);
    front.visible = !useProxy;
    lowPolyHoodProxy.visible = useProxy;
    return useProxy;
  }

  const cabinMesh = await modularHostInitialization.waitFor(compressedAssetToObject(THREE, 'cabinaGz', 'Cabina', { signal: modularHostInitialization.signal }), 'cockpit-cabinaGz');
  tuneAsset(cabinMesh);
  const cabinMount = new THREE.Group();
  cabinMount.name = 'MontajeCabinaEditable';
  cabinMount.position.fromArray(COCKPIT_LAYOUT.cabin.position);
  cabinMount.rotation.fromArray(COCKPIT_LAYOUT.cabin.rotation);
  cockpit.add(cabinMount);
  const cabin = normalizeObject(THREE, cabinMesh, COCKPIT_LAYOUT.cabin.targetWidth);
  cabin.name = 'CabinaChevyIntegrada';
  cabinMount.add(cabin);
  raceWorld.attachWeatherWindshield({cabinMount});

  try {
    const techoBytes = await modularHostInitialization.waitFor(globalThis.AsfaltoV5PayloadCore.decodePayloadById(
      document, 'asfalto-v6-cockpit-roof-payload', gunzipBase64,
    ), 'cockpit-roof-payload');
    const techoMesh = await modularHostInitialization.waitFor(globalThis.AsfaltoV5GlbCore.completeGlbToObject(
      THREE, techoBytes, 'Techo', trackGlbHelpers,
    ), 'cockpit-roof-conversion');
    tuneAsset(techoMesh);
    techoMount = new THREE.Group();
    techoMount.name = 'MontajeTechoEditable';
    // The editable root is identity so v3 reset/reload persists exact transforms.
    const techoLayout = new THREE.Group();
    techoLayout.name = 'TechoChevyLayoutAuthored';
    techoLayout.position.fromArray(COCKPIT_LAYOUT.roof.position);
    techoLayout.rotation.fromArray(COCKPIT_LAYOUT.roof.rotation);
    techoLayout.scale.fromArray(COCKPIT_LAYOUT.roof.scale);
    cockpit.add(techoMount);
    techoMount.add(techoLayout);
    const techo = normalizeObject(THREE, techoMesh, COCKPIT_LAYOUT.roof.targetWidth);
    techo.name = 'TechoChevyIntegrado';
    techoLayout.add(techo);
  } catch (error) {
    throw new Error(`Techo: ${error?.message || error}`);
  }

  const dashboardMesh = await modularHostInitialization.waitFor(compressedAssetToObject(THREE, 'tableroGz', 'Tablero', { signal: modularHostInitialization.signal }), 'cockpit-tableroGz');
  tuneAsset(dashboardMesh);
  const dashboard = normalizeObject(THREE, dashboardMesh, COCKPIT_LAYOUT.dashboard.targetWidth);
  dashboard.name = 'TableroNuevo';
  dashboard.position.fromArray(COCKPIT_LAYOUT.dashboard.position);
  cockpit.add(dashboard);

  const gaugeCluster = createGaugeCluster(THREE, COCKPIT_LAYOUT.gauges);
  let instrumentPhysicalTimeSeconds=null;
  cockpit.add(gaugeCluster.group);

  const wheelMesh = await modularHostInitialization.waitFor(compressedAssetToObject(THREE, 'volanteGz', 'Volante', { signal: modularHostInitialization.signal }), 'cockpit-volanteGz');
  tuneAsset(wheelMesh);
  const wheelMount = new THREE.Group();
  wheelMount.name = 'MontajeVolanteEditable';
  wheelMount.position.fromArray(COCKPIT_LAYOUT.wheel.position);
  cockpit.add(wheelMount);
  const wheelPivot = normalizeObject(THREE, wheelMesh, COCKPIT_LAYOUT.wheel.targetWidth);
  wheelPivot.name = 'VolanteInteractivo';
  wheelMount.add(wheelPivot);
  vehicleCockpitWheel=createVehicleCockpitWheel(THREE,{pivot:wheelPivot,sharedWheel:wheelMesh,targetWidth:COCKPIT_LAYOUT.wheel.targetWidth,loadGlb:window.__asfaltoLoadVehicleModel,tune:tuneAsset});

  const pedalsMesh = await modularHostInitialization.waitFor(compressedAssetToObject(THREE, 'pedalesGz', 'Pedales', { signal: modularHostInitialization.signal }), 'cockpit-pedalesGz');
  tuneAsset(pedalsMesh);
  const pedalParts = splitPedalMesh(THREE, pedalsMesh);
  const acceleratorPivot = pedalParts.acceleratorPivot;
  const acceleratorOrientation = pedalParts.acceleratorOrientation;
  const brakePivot = pedalParts.brakePivot;
  acceleratorOrientation.rotation.z = COCKPIT_LAYOUT.pedals.acceleratorRotationZ;
  const pedalsMount = new THREE.Group();
  pedalsMount.name = 'MontajePedaleraEditable';
  pedalsMount.position.fromArray(COCKPIT_LAYOUT.pedals.position);
  pedalsMount.rotation.z = COCKPIT_LAYOUT.pedals.rotationZ;
  cockpit.add(pedalsMount);
  const pedals = normalizeObject(THREE, pedalParts.root, COCKPIT_LAYOUT.pedals.targetWidth);
  pedals.name = 'PedaleraInteractivaLimpia';
  pedals.scale.y *= COCKPIT_LAYOUT.pedals.scaleY;
  pedalsMount.add(pedals);

  const shifterAssembly = new THREE.Group();
  shifterAssembly.name = 'MontajePalancaEditable';
  shifterAssembly.position.fromArray(COCKPIT_LAYOUT.shifter.position);
  cockpit.add(shifterAssembly);

  const shifterBaseMesh = await modularHostInitialization.waitFor(compressedAssetToObject(THREE, 'palancaGz', 'BasePalanca', { signal: modularHostInitialization.signal }), 'cockpit-palancaGz');
  tuneAsset(shifterBaseMesh);
  shifterBaseMesh.rotation.x = COCKPIT_LAYOUT.shifter.rotationX;
  const shifter = normalizeObject(THREE, shifterBaseMesh, COCKPIT_LAYOUT.shifter.targetWidth);
  shifter.name = 'BasePalancaConDiagramaInferior';
  shifter.rotation.z = COCKPIT_LAYOUT.shifter.rotationZ;
  shifterAssembly.add(shifter);
  cockpitDisplayLods = await modularHostInitialization.waitFor(loadCockpitDisplayLods({
    THREE, signal:modularHostInitialization.signal, editing:compositionEditor?.isActive(),
    bindings:swappableCockpitBindings({cabina:cabinMesh,tablero:dashboardMesh,volante:wheelMesh,'pedales-accelerator':pedalParts.acceleratorMesh,'pedales-brake':pedalParts.brakeMesh,palanca:shifterBaseMesh}),
  }), 'cockpit-display-lods');

  const knobBytes = await modularHostInitialization.waitFor(globalThis.AsfaltoV5PayloadCore.decodePayloadById(
    document, 'asfalto-v6-shifter-knob-payload', gunzipBase64,
  ), 'shifter-knob-payload');
  const knobModel = await modularHostInitialization.waitFor(globalThis.AsfaltoV5GlbCore.completeGlbToObject(
    THREE, knobBytes, 'Bocha grabada', trackGlbHelpers,
  ).then(ownShifterKnob), 'shifter-knob-conversion');
  tuneAsset(knobModel);
  const shifterMechanism = createManualShifter(THREE, knobModel);
  shifterMechanism.group.position.set(0, 0.010, 0.075);
  shifterAssembly.add(shifterMechanism.group);

  setLoading('Montando cerradura, llave y llavero…');
  cockpitIgnition = await modularHostInitialization.waitFor(loadCockpitIgnition({
    THREE,
    signal: modularHostInitialization.signal,
    async fetchBytes(url, options) {
      const response = await fetch(url, { ...options, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`No se pudo cargar el contacto (${response.status}).`);
      return new Uint8Array(await response.arrayBuffer());
    },
    decodeGlb: (bytes, label) => globalThis.AsfaltoV5GlbCore.completeGlbToObject(THREE, bytes, label, trackGlbHelpers),
  }).then(contact => {
    if (modularHostInitialization.signal.aborted || modularRuntimeShutdown) {
      contact.dispose();
      throw modularHostInitialization.signal.reason || new Error('Contacto: host shutdown');
    }
    cockpitIgnition = contact;
    return contact;
  }), 'cockpit-ignition');
  tuneAsset(cockpitIgnition.mount);
  cockpit.add(cockpitIgnition.mount);

  setLoading('Montando el selector de luces Chevrolet 1973…');
  cockpitLightSwitch=await modularHostInitialization.waitFor(loadCockpitLightSwitch({THREE,signal:modularHostInitialization.signal,renderer,camera,cockpit,
    decodeGlb:(bytes,label)=>globalThis.AsfaltoV5GlbCore.completeGlbToObject(THREE,bytes,label,trackGlbHelpers),
    getState:()=>raceWorld.getDrivingLights(),onChange:(kind,value)=>raceWorld.setDrivingLights(kind,value),
    isDriving:()=>document.body.classList.contains('v6-driving')&&!document.body.classList.contains('an-race-pause-visible')&&!document.body.classList.contains('v6-menu-open'),
    isCockpit:()=>raceCameraState.current==='cockpit',
    isEditing:()=>compositionEditor?.isActive()||false,
  }).then(control=>{if(modularHostInitialization.signal.aborted||modularRuntimeShutdown){control.dispose();throw modularHostInitialization.signal.reason||new Error('Selector: host shutdown');}cockpitLightSwitch=control;return control;}),'cockpit-light-switch');
  tuneAsset(cockpitLightSwitch.mount);cockpit.add(cockpitLightSwitch.mount);

  setLoading('Integrando Radio Chevrolet 1973…');
  const radioModelPayload = document.getElementById('asfalto-v4-1-radio-model');
  const radioManifestPayload = document.getElementById('asfalto-v4-1-radio-manifest');
  if (!radioModelPayload || !radioManifestPayload) throw new Error('Falta el paquete autocontenido de Radio Chevrolet 1973.');
  setLoading('Radio: descargando modelo…');
  const radioModelBytes = radioModelPayload.dataset.encoding === 'external-url'
    ? await modularHostInitialization.waitFor(globalThis.AsfaltoV6AssetCore.readExternalPayload(radioModelPayload, (url, options = {}) => fetch(url, { ...options, signal: modularHostInitialization.signal })), 'radio-external-decode')
    : await modularHostInitialization.waitFor(gunzipBase64(radioModelPayload.textContent), 'radio-embedded-decode');
  radioModelPayload.textContent = '';
  setLoading('Radio: decodificando modelo y texturas…');
  const radioModel = await modularHostInitialization.waitFor(completeRadioGlbToObject(THREE, radioModelBytes, 'Radio Chevrolet 1973'), 'radio-conversion');
  tuneAsset(radioModel);
  const radioMount = new THREE.Group();
  radioMount.name = 'MontajeRadioChevy1973Editable';
  radioMount.position.fromArray(COCKPIT_LAYOUT.radio.position);
  radioMount.rotation.fromArray(COCKPIT_LAYOUT.radio.rotation);
  radioMount.scale.fromArray(COCKPIT_LAYOUT.radio.scale);
  radioMount.add(radioModel);
  cockpit.add(radioMount);
  const radioManifest = JSON.parse(radioManifestPayload.textContent);
  setLoading('Radio: conectando controles y display…');
  const radioController = createCockpitRadioController({
    THREE,
    root: radioModel,
    mount: radioMount,
    renderer,
    camera,
    engineSound,
    manifest: radioManifest,
    isEditorActive: () => compositionEditor?.isActive() || false,
    requestRender: () => {
      if (typeof renderFrame === 'function') renderFrame();
    },
  });

  setLoading('Radio lista; preparando controles de conducción…');
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = new Set();
  const maxWheelAngle = THREE.MathUtils.degToRad(300);
  let steering = { steer: 0, velocity: 0 };
  let accelerator = { value: 0, velocity: 0 };
  let brake = { value: 0, velocity: 0 };
  let vehicle = createVehicleState();
  const cockpitPointers = new Map();
  const hasCockpitPointerMode = (mode) => [...cockpitPointers.values()].some(pointer => pointer.mode === mode);
  let wheelDragTarget = 0;
  let shifterDragOrigin = null;
  function releaseCockpitInputCaptures() {
    mobileDrivingControls?.releaseAll();
    const capturedPointerIds = [...cockpitPointers.keys()];
    // Clear ownership before native release can dispatch lostpointercapture.
    cockpitPointers.clear();
    wheelDragTarget = 0;
    shifterDragOrigin = null;
    renderer.domElement.classList.remove('dragging', 'control-hover', 'wheel-hover');
    for (const capturedPointerId of capturedPointerIds) {
      if (renderer.domElement.hasPointerCapture(capturedPointerId)) {
        try { renderer.domElement.releasePointerCapture(capturedPointerId); } catch {}
      }
    }
    raceWorld?.clearInputs?.();
    globalThis.__asfaltoNacionalV41?.radio?.releaseFocus?.();
    updateKeyUi();
  }
  let hoverControl = null;
  let pointerVisualX = 0;
  let pointerVisualY = 0;
  let renderingEnabled = true;
  let menuOpen = false;
  let dragPixelsForFullLock = runtimeDeviceProfile.phone?phoneWheelDragPixels(viewport.clientWidth,viewport.clientHeight):Math.max(180, Math.min(340, viewport.clientWidth * 0.42));
  const debugControls = { steer: null, throttle: null, brake: null };

  const gearState = {
    gear: 'N',
    requested: 'N',
    x: 0,
    y: 0,
    path: null,
    pathIndex: 0,
    segmentTime: 0,
    clutch: 0,
    clutchDelay: 0,
    blockedReverseUntil: 0,
    blockedReason: null,
    autoCooldown: 0,
    shiftKind: 'none',
    torqueCut: 0,
    throttleBlip: 0,
    previousGear: 'N',
  };
  const automaticTransmission = createAutomaticTransmissionState();

  let resumeAfterCompositionEdit = false;
  setLoading('Preparando composición del cockpit…');
  compositionEditor = createCompositionEditor({
    THREE,
    scene,
    renderer,
    ui: editorUi,
    compositionState,
    initialLayout: compositionInitialLayout,
    fileStore: cockpitLayoutFile,
    getCameraMode: () => raceCameraState.current,
    onCockpitCalibration: (state) => {rememberCockpitCalibration(state);headMotion.setCalibration(state.headMotion);headMotionControls?.refresh();},
    onResetAllTransaction: () => {
      const previousBackground = backgroundEditor.snapshotState();
      const previousFrontCut = frontCutController.snapshotState();
      compositionState.replaceFacets({
        background: previousBackground,
        frontCut: previousFrontCut,
      });
      backgroundEditor.resetToDefault({ announce: false, save: false });
      frontCutController.reset({ persist: false });
      const result = compositionState.resetAll({
        background: backgroundEditor.getState(),
        frontCut: { version: 1, percent: frontCutController.getState().percent },
      });
      if (!result.ok) {
        backgroundEditor.restoreState(previousBackground);
        frontCutController.restoreState(previousFrontCut);
      }
      return result;
    },
    targets: [
      { id: 'auto', label: 'Auto', object: raceChevyV3, capabilities: { position: true, rotation: true, scale: true, lens: false }, availability: (mode) => (mode === 'chase' || mode === 'cinematic' ? { available: true, reason: '' } : { available: false, reason: 'El Auto requiere una vista exterior' }) },
      { id: 'cockpit-camera', label: 'Cámara cockpit', kind: 'cockpit-camera', capabilities: { position: true, rotation: true, scale: false, lens: true }, getState: () => compositionState.getState().camera.cockpit, applyState: (state) => compositionState.setCockpitCalibration(state), pickRoots: [], availability: (mode) => (mode === 'cockpit' ? { available: true, reason: '' } : { available: false, reason: 'La Cámara cockpit requiere la vista cockpit' }) },
      { id: 'cockpit-complete', label: 'Cockpit Completo', object: cockpit },
      { id: 'front', label: 'Frente del auto', object: frontMount },
      { id: 'cabin', label: 'Cabina', object: cabinMount },
      { id: 'roof', label: 'Techo', object: techoMount, capabilities: { position: true, rotation: true, scale: true, lens: false }, pickRoots: [techoMount], availability: (mode) => (mode === 'cockpit' ? { available: true, reason: '' } : { available: false, reason: 'El Techo requiere la vista cockpit' }) },
      { id: 'rearview', label: 'Retrovisor interior', object: rearviewMount },
      { ...cockpitMirrors.editorTargets[1], availability: (mode) => ({ available:mode === 'cockpit', reason:mode === 'cockpit' ? '' : 'El espejo lateral requiere la vista cockpit' }) },
      { id: 'dashboard', label: 'Tablero', object: dashboard },
      { id: 'radio', label: 'Radio Chevrolet 1973', object: radioMount, defaultSelected: true },
      { id: 'speedometer', label: 'Velocímetro', object: gaugeCluster.speed.group },
      { id: 'tachometer', label: 'Cuentarrevoluciones', object: gaugeCluster.rpm.group },
      { id: 'wheel', label: 'Volante', object: wheelMount },
      ...cockpitIgnition.editorTargets,
      ...cockpitLightSwitch.editorTargets,
      { id: 'pedals', label: 'Pedalera', object: pedalsMount },
      { id: 'shifter', label: 'Palanca de cambios · conjunto', object: shifterAssembly },
      { id: 'shifter-base', label: 'Palanca · base y chapa', object: shifter },
      { id: 'shifter-boot', label: 'Palanca · cuero/fuelle', object: shifterMechanism.bootGroup },
      { id: 'shifter-shaft', label: 'Palanca · eje', object: shifterMechanism.shaftRig },
      { id: 'shifter-knob', label: 'Palanca · bocha/pomo', object: shifterMechanism.knobRig },
    ],
    onSelectionChange(id) {
      frontCutController.setVisible(id === 'front');headMotionControls?.refresh();
    },
    onActiveChange(enabled) {
      releaseCockpitInputCaptures();
      if (enabled) {
        cameraEntrance.cancel();cameraOpening.cancel();
        cockpitEntranceRoot.position.z = 0;
        resumeAfterCompositionEdit = ['RUNNING','COUNTDOWN'].includes(raceWorld.state.status);
        if (resumeAfterCompositionEdit) raceWorld.pause({reason:'settings'});
        setSettingsPanelOpen(true);
        keys.clear();
        updateKeyUi();
      } else if (resumeAfterCompositionEdit) {
        resumeAfterCompositionEdit = false;
        raceWorld.resume();
      }
      applyCockpitLod();
    },
    onChange() {
      if (typeof renderFrame === 'function') requestAnimationFrame(() => renderFrame());
    },
  });
  headMotion.setCalibration(compositionState.getState().camera.cockpit.headMotion);
  headMotionControls=installHeadMotionControls({getValue:()=>compositionState.getState().camera.cockpit.headMotion,onChange:headMotion=>compositionEditor.setCockpitCameraCalibration({...compositionState.getState().camera.cockpit,headMotion})});
  editorResetElementEl.addEventListener('click', () => {
    if (editorElementSelectEl.value === 'front') frontCutController.reset();
  });

  function formatPercent(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
  }

  function updateAudioStatus() {
    const state = engineSound.getState();
    if (!gameSettings.soundEnabled) {
      audioStatusEl.textContent = 'Sonido desactivado';
      audioStatusEl.dataset.state = 'muted';
    } else if (state.contextState === 'running') {
      audioStatusEl.textContent = `Activo · ${state.backend}`;
      audioStatusEl.dataset.state = 'active';
    } else {
      audioStatusEl.textContent = audioStatus.message || 'Tocá o pulsá una tecla para activar';
      audioStatusEl.dataset.state = audioStatus.state || 'armed';
    }
  }

  async function ensureAudioStarted() {
    if (!gameSettings.soundEnabled) return false;
    const result = await engineSound.ensureStarted();
    updateAudioStatus();
    return result;
  }

  function syncSettingsUi() {
    transmissionButtons.forEach((button) => button.classList.toggle('active', button.dataset.transmission === gameSettings.transmissionMode));
    settingsInputs.soundEnabled.checked = gameSettings.soundEnabled;
    for (const [key, input] of Object.entries(settingsInputs)) {
      if (['soundEnabled', 'graphicsQuality', 'audioProfile', 'audioQuality'].includes(key)) continue;
      input.value = String(gameSettings[key]);
      if (settingsOutputs[key]) settingsOutputs[key].textContent = formatPercent(gameSettings[key]);
    }
    settingsInputs.audioProfile.value = gameSettings.audioProfile;
    settingsInputs.audioQuality.value = gameSettings.audioQuality;
    settingsInputs.graphicsQuality.value = gameSettings.graphicsQuality;
    const automatic = gameSettings.transmissionMode === 'automatic';
    modeValueEl.textContent = automatic ? 'AUTO' : 'MAN';
    manualGearControlsEl.classList.toggle('auto-disabled', automatic);
    gearHintEl.textContent = automatic ? 'cambios automáticos' : 'caja H manual';
    autoAggressionRowEl.classList.toggle('disabled', !automatic);
    settingsInputs.autoAggression.disabled = !automatic;
    updateAudioStatus();
  }

  function applySettings({ persist = true } = {}) {
    mobileTextureQuality=gameSettings.graphicsQuality;
    gameSettings = normalizeGameSettings(gameSettings);
    if (persist) saveGameSettings(gameSettings);
    engineSound.applySettings();
    window.dispatchEvent(new CustomEvent('asfalto:audio-settings'));
    applyCockpitLod();
    raceWorld.setPerformanceQuality(gameSettings.graphicsQuality);
    if (!gameSettings.soundEnabled) void engineSound.setEnabled(false);
    syncSettingsUi();
    if (typeof resize === 'function') resize();
  }

  function setSettingsPanelOpen(open) {
    const wasOpen = menuOpen;
    menuOpen = !!open;
    settingsPanelEl.hidden = !menuOpen;
    settingsToggleEl.setAttribute('aria-expanded', String(menuOpen));
    settingsToggleEl.setAttribute('aria-label', menuOpen ? 'Cerrar configuración' : 'Abrir configuración');
    if (menuOpen) settingsPanelEl.querySelector('button, input, select')?.focus({ preventScroll: true });
    else if (wasOpen) {
      const playfield = document.querySelector('#viewport canvas');
      if (playfield && document.body.classList.contains('v6-driving')
        && !document.body.classList.contains('v6-menu-open')
        && !document.body.classList.contains('an-intro-open')) {
        playfield.tabIndex = -1;
        playfield.focus({ preventScroll: true });
      } else settingsToggleEl.focus({ preventScroll: true });
    }
    window.dispatchEvent(new CustomEvent('asfalto:race-settings',{detail:{open:menuOpen}}));
  }

  function changeTransmissionMode(mode) {
    const next = mode === 'automatic' ? 'automatic' : 'manual';
    if (gameSettings.transmissionMode === next) return;
    gameSettings.transmissionMode = next;
    automaticTransmission.cooldown = 0;
    automaticTransmission.holdTimer = 0;
    automaticTransmission.kickdownTimer = 0;
    automaticTransmission.lastThrottle = 0;
    automaticTransmission.lastTarget = gearState.gear;
    gearState.autoCooldown = 0;
    if (next === 'automatic') {
      for (const [pointerId, pointer] of cockpitPointers) {
        if (pointer.mode === 'shifter') endPointer({ type: 'pointercancel', pointerId });
      }
      if (gearState.gear === 'R') requestGear('N', 'automatic');
    }
    applySettings();
  }

  function setGearUi() {
    gearValueEl.textContent = gearState.gear;
    gearKeys.forEach((element) => {
      const requested = element.dataset.gear === gearState.requested;
      const engaged = element.dataset.gear === gearState.gear;
      element.classList.toggle('active', engaged);
      element.classList.toggle('requested', requested && !engaged);
    });
  }

  function requestGear(rawTarget, source = 'manual') {
    const target = String(rawTarget).toUpperCase();
    if (!GEAR_POSITIONS[target]) return false;
    if (Number(target) > (Number(raceWorld.getV6Diagnostics?.().forwardGears) || 4)) {
      gearState.blockedReverseUntil = performance.now() + 1150;
      gearState.blockedReason = 'Quinta disponible sólo en Restomod';
      gearState.requested = gearState.gear;
      setGearUi();
      return false;
    }
    if (gameSettings.transmissionMode === 'automatic' && source === 'manual') return false;
    const targetPosition = GEAR_POSITIONS[target];
    const leverAlreadyThere = Math.hypot(gearState.x - targetPosition.x, gearState.y - targetPosition.y) < 0.045;
    if (target === gearState.gear && !gearState.path && leverAlreadyThere) {
      gearState.requested = target;
      setGearUi();
      return true;
    }

    const validation = evaluateShift(target, vehicle.speedMps, Math.sign(vehicle.speedMps) || 1);
    if (!validation.allowed) {
      gearState.blockedReverseUntil = performance.now() + 1150;
      gearState.blockedReason = validation.reason;
      gearState.requested = gearState.gear;
      setGearUi();
      return false;
    }

    const from = gearState.gear;
    const fromIndex = FORWARD_GEARS.indexOf(from);
    const targetIndex = FORWARD_GEARS.indexOf(target);
    let shiftKind = 'engage';
    if (target === 'N') shiftKind = 'neutral';
    else if (fromIndex >= 0 && targetIndex >= 0) shiftKind = targetIndex > fromIndex ? 'up' : 'down';
    else if (from === 'R' || target === 'R') shiftKind = 'direction';

    gearState.previousGear = from;
    gearState.shiftKind = shiftKind;
    gearState.requested = target;
    gearState.gear = 'N';
    gearState.clutch = 0;
    gearState.clutchDelay = 0;
    gearState.torqueCut = target === 'N' ? 0.35 : 1;
    gearState.throttleBlip = shiftKind === 'down'
      ? clamp((validation.predictedRpm - vehicle.rpm) / 2550, 0.12, 0.68)
      : 0;
    gearState.path = buildShiftPathFrom({ x: gearState.x, y: gearState.y }, target);
    gearState.pathIndex = 0;
    gearState.segmentTime = 0;
    const intensity = shiftKind === 'down' ? 0.92 : shiftKind === 'up' ? 0.72 : 0.62;
    engineSound.notifyShift(from, target, intensity);
    setGearUi();
    return true;
  }

  function finishShift() {
    gearState.path = null;
    gearState.pathIndex = 0;
    gearState.segmentTime = 0;
    gearState.gear = gearState.requested;
    gearState.clutchDelay = gearState.gear === 'N' ? 0 : (gearState.shiftKind === 'down' ? 0.070 : 0.100);
    const baseCooldown = 0.50 + (1 - gameSettings.autoAggression) * 0.24;
    automaticTransmission.cooldown = baseCooldown;
    automaticTransmission.holdTimer = gearState.shiftKind === 'up'
      ? 1.05 + (1 - gameSettings.autoAggression) * 0.38
      : gearState.shiftKind === 'down' ? 0.62 : 0.42;
    automaticTransmission.lastTarget = gearState.gear;
    gearState.autoCooldown = automaticTransmission.cooldown;
    gearState.torqueCut = gearState.gear === 'N' ? 0 : 0.26;
    if (gearState.gear === 'N') gearState.clutch = 0;
    setGearUi();
  }

  function updateGear(dt) {
    gearState.autoCooldown = automaticTransmission.cooldown;
    if (gearState.path) {
      gearState.torqueCut = damp(gearState.torqueCut, 1, 12, dt);
      const blipTarget = gearState.shiftKind === 'down' && Math.abs(gearState.y) < 0.60 ? gearState.throttleBlip : 0;
      gearState.throttleBlip = damp(gearState.throttleBlip, blipTarget, 10, dt);
      let remaining = Math.max(0, dt);
      while (gearState.path && remaining > 1e-7) {
        const start = gearState.path[gearState.pathIndex];
        const end = gearState.path[gearState.pathIndex + 1];
        if (!end) {
          finishShift();
          break;
        }
        const distance = Math.hypot(end.x - start.x, end.y - start.y);
        const duration = (0.105 + distance * 0.108) / gameSettings.shiftSpeed;
        const segmentRemaining = Math.max(0, duration - gearState.segmentTime);
        const consumed = Math.min(remaining, segmentRemaining);
        gearState.segmentTime += consumed;
        remaining -= consumed;
        const t = smoothstep(gearState.segmentTime / duration);
        gearState.x = lerp(start.x, end.x, t);
        gearState.y = lerp(start.y, end.y, t);
        if (gearState.segmentTime >= duration - 1e-7) {
          gearState.x = end.x;
          gearState.y = end.y;
          gearState.pathIndex += 1;
          gearState.segmentTime = 0;
          if (gearState.pathIndex >= gearState.path.length - 1) finishShift();
        }
      }
    } else if (!shifterDragOrigin) {
      if (gearState.clutchDelay > 0) gearState.clutchDelay = Math.max(0, gearState.clutchDelay - dt);
      else gearState.clutch = damp(gearState.clutch, gearState.gear === 'N' ? 0 : 1, 5.8, dt);
      gearState.torqueCut = damp(gearState.torqueCut, 0, 8.5, dt);
      gearState.throttleBlip = damp(gearState.throttleBlip, 0, 9.5, dt);
    }
  }

  function updateAutomaticTransmission(controls, dt) {
    if (gameSettings.transmissionMode !== 'automatic') return;
    const decision = chooseAutomaticGear(automaticTransmission, {
      currentGear: gearState.gear,
      requestedGear: gearState.requested,
      shifting: !!gearState.path,
      speedMps: vehicle.speedMps,
      rpm: vehicle.rpm,
      throttle: controls.throttle,
      brake: controls.brake,
    }, { aggression: gameSettings.autoAggression }, dt);
    gearState.autoCooldown = automaticTransmission.cooldown;
    if (decision.targetGear && decision.targetGear !== gearState.gear && !gearState.path) {
      requestGear(decision.targetGear, 'automatic');
    }
  }

  function eventToNdc(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerVisualX = pointer.x;
    pointerVisualY = pointer.y;
  }

  function firstIntersection(object) {
    const hits = raycaster.intersectObject(object, true).filter(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});
    return hits.length ? hits[0] : null;
  }

  function hitTest(event) {
    eventToNdc(event);
    raycaster.setFromCamera(pointer, camera);
    const authoredTargets=raceChevyPresentation?.getSteeringTargets?.()||[];
    const candidates = [
      ...(gameSettings.transmissionMode === 'manual' && !gearState.path
        ? [{ type: 'shifter', hit: firstIntersection(shifterMechanism.knob) }]
        : []),
      { type: 'accelerator', hit: firstIntersection(raceChevyPresentation?.getPedalTarget?.('accelerator')||acceleratorPivot) },
      { type: 'brake', hit: firstIntersection(raceChevyPresentation?.getPedalTarget?.('brake')||brakePivot) },
      { type: 'wheel', hit: authoredTargets.length?raycaster.intersectObjects(authoredTargets,true)[0]:firstIntersection(wheelPivot) },
    ].filter((candidate) => candidate.hit);
    candidates.sort((a, b) => a.hit.distance - b.hit.distance);
    return candidates[0]?.type || null;
  }

  function interactionTargetDiagnostics() {
    camera.updateMatrixWorld(true);
    const rect = renderer.domElement.getBoundingClientRect();
    const describe = object => {
      object?.updateWorldMatrix?.(true, true);
      const bounds = new THREE.Box3();
      let meshCount = 0;
      let nodeCount = 0;
      let vertexCount = 0;
      let visibleMeshCount = 0;
      let firstGeometryBounds = null;
      object?.traverse?.(node => {
        nodeCount += 1;
        const position = node.geometry?.getAttribute?.('position');
        if (!position) return;
        meshCount += 1;
        vertexCount += position.count;
        if (node.visible) visibleMeshCount += 1;
        node.geometry.computeBoundingBox?.();
        if (node.geometry.boundingBox && !node.geometry.boundingBox.isEmpty()) {
          if (!firstGeometryBounds) firstGeometryBounds = Object.freeze({
            min: Object.freeze(node.geometry.boundingBox.min.toArray()),
            max: Object.freeze(node.geometry.boundingBox.max.toArray()),
          });
          bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
        }
      });
      const center = bounds.getCenter(new THREE.Vector3());
      const projected = center.clone().project(camera);
      const screen = [
        rect.left + (projected.x + 1) * 0.5 * rect.width,
        rect.top + (1 - projected.y) * 0.5 * rect.height,
      ];
      return Object.freeze({
        centerWorld: Object.freeze(center.toArray()),
        boundsEmpty: bounds.isEmpty(),
        firstGeometryBounds,
        inViewport: projected.x >= -1 && projected.x <= 1
          && projected.y >= -1 && projected.y <= 1
          && projected.z >= -1 && projected.z <= 1,
        ndc: Object.freeze(projected.toArray()),
        meshCount,
        nodeCount,
        objectMatrixWorld: Object.freeze(object.matrixWorld.toArray()),
        objectPosition: Object.freeze(object.position.toArray()),
        objectScale: Object.freeze(object.scale.toArray()),
        screen: Object.freeze(screen),
        vertexCount,
        visibleMeshCount,
      });
    };
    return Object.freeze({
      accelerator: describe(acceleratorPivot),
      brake: describe(brakePivot),
      shifter: describe(shifterMechanism.knob),
      wheel: describe(raceChevyPresentation?.getSteeringTargets?.()[0]||wheelPivot),
    });
  }

  function keyboardSteerTarget() {
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    if (left === right) return null;
    return left ? -1 : 1;
  }

  function controlTargets() {
    if (compositionEditor?.isActive()) return { steer: 0, throttle: 0, brake: 0, clutch: 0, handbrake: 0 };
    const raceInput = mergeMobileDrivingInput(raceWorld.getInput(),mobileDrivingControls?.sample());
    const gate = raceWorld.getControlGate();
    const keyboardSteer = keyboardSteerTarget();
    const cockpitSteer = keyboardSteer ?? (hasCockpitPointerMode('wheel') ? wheelDragTarget : 0);
    const rawSteer = debugControls.steer != null
      ? clamp(debugControls.steer, -1, 1)
      : Math.abs(raceInput.steer) > Math.abs(cockpitSteer) ? raceInput.steer : cockpitSteer;
    const cockpitThrottle = keys.has('KeyW') || hasCockpitPointerMode('accelerator') ? 1 : 0;
    const cockpitBrake = keys.has('KeyS') || hasCockpitPointerMode('brake') ? 1 : 0;
    const throttle = debugControls.throttle != null
      ? clamp(debugControls.throttle, 0, 1)
      : Math.max(cockpitThrottle, raceInput.throttle || 0);
    const braking = debugControls.brake != null
      ? clamp(debugControls.brake, 0, 1)
      : Math.max(cockpitBrake, raceInput.brake || 0);
    if (gate.blockDriving) {
      syncSpawnParkingHint(document.getElementById('modular-race-cue'), false);
      return { steer: 0, throttle: 0, brake: gate.holdBrake ? 1 : 0, clutch: 0, handbrake: 0 };
    }
    const steeringMode=keyboardSteer!==null?'keyboard'
      :hasCockpitPointerMode('wheel')?'pointer'
      :(Math.abs(raceInput.steer)>0.02||debugControls.steer!=null)?'analog':'none';
    const targets = spawnParkingHold.apply({ steer: clamp(rawSteer, -1, 1), throttle, brake: braking, clutch: raceInput.clutch || 0, handbrake: raceInput.handbrake || 0, steeringMode });
    syncSpawnParkingHint(document.getElementById('modular-race-cue'), spawnParkingHold.held && gate.status === 'RUNNING' && !document.body.classList.contains('v6-menu-open'),{manualNeutral:gameSettings.transmissionMode==='manual'&&gearState.requested==='N'});
    return targets;
  }

  function updateKeyUi() {
    keyAEl.classList.toggle('active', keys.has('KeyA') || keys.has('ArrowLeft'));
    keyDEl.classList.toggle('active', keys.has('KeyD') || keys.has('ArrowRight'));
    keyWEl.classList.toggle('active', keys.has('KeyW') || hasCockpitPointerMode('accelerator') || (debugControls.throttle || 0) > 0.05);
    keySEl.classList.toggle('active', keys.has('KeyS') || hasCockpitPointerMode('brake') || (debugControls.brake || 0) > 0.05);
  }

  const gearKeyMap = {
    Digit1: '1', Numpad1: '1', Digit2: '2', Numpad2: '2',
    Digit3: '3', Numpad3: '3', Digit4: '4', Numpad4: '4',
    Digit5: '5', Numpad5: '5', KeyR: 'R', KeyN: 'N',
  };

  runtimeEvents.listen(window,'keydown', (event) => {
    if (document.body.classList.contains('v6-menu-open') || document.body.classList.contains('an-intro-open') || document.body.classList.contains('an-race-pause-visible')) return;
    if (event.code === 'Escape' && compositionEditor?.isActive()) {
      event.preventDefault();
      compositionEditor.setActive(false);
      return;
    }
    if (event.code === 'Escape' && menuOpen) {
      event.preventDefault();
      setSettingsPanelOpen(false);
      return;
    }
    if(globalThis.__asfaltoV7Experience?.shouldBlockDrivingInput(event))return;
    const formControl = event.target instanceof HTMLInputElement
      || event.target instanceof HTMLSelectElement
      || event.target instanceof HTMLButtonElement;
    if (formControl) return;
    if (event.code === 'KeyC' && !event.repeat) {
      event.preventDefault();
      cycleRaceCamera();
      return;
    }
    if (compositionEditor?.isActive()) {
      if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyR', 'KeyN'].includes(event.code)) event.preventDefault();
      return;
    }
    const controlCodes = ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS'];
    if (controlCodes.includes(event.code)) {
      event.preventDefault();
      void ensureAudioStarted();
      keys.add(event.code);
      updateKeyUi();
    }
    const gear = gearKeyMap[event.code];
    if (gear && !event.repeat && gameSettings.transmissionMode === 'manual') {
      event.preventDefault();
      void ensureAudioStarted();
      requestGear(gear, 'manual');
    }
  }, { passive: false });

  runtimeEvents.listen(window,'keyup', (event) => {
    keys.delete(event.code);
    updateKeyUi();
  });

  function setPointerCapture(event) {
    renderer.domElement.setPointerCapture(event.pointerId);
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    void ensureAudioStarted();
    if (compositionEditor?.isActive()) {
      event.preventDefault();
      eventToNdc(event);
      raycaster.setFromCamera(pointer, camera);
      const selected = compositionEditor.pick(raycaster);
      if (selected) compositionEditor.select(selected);
      return;
    }
    if(runtimeDeviceProfile.phone&&!mobileDrivingControls?.canDrive())return;
    const hit = hitTest(event);
    if (!hit || cockpitPointers.has(event.pointerId) || hasCockpitPointerMode(hit)) return;
    event.preventDefault();
    cockpitPointers.set(event.pointerId, { mode: hit, lastX: event.clientX });
    setPointerCapture(event);
    if (hit === 'wheel') {
      wheelDragTarget = steering.steer;
      renderer.domElement.classList.add('dragging');
    } else if (hit === 'shifter') {
      shifterDragOrigin = {
        x: gearState.x,
        y: gearState.y,
        gear: gearState.gear,
        requested: gearState.requested,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      gearState.path = null;
      gearState.gear = 'N';
      gearState.requested = 'N';
      gearState.clutch = 0;
      gearState.torqueCut = 1;
      renderer.domElement.classList.add('dragging');
      setGearUi();
    } else {
      renderer.domElement.classList.add('control-hover');
    }
    updateKeyUi();
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    eventToNdc(event);
    if (compositionEditor?.isActive()) {
      raycaster.setFromCamera(pointer, camera);
      renderer.domElement.classList.toggle('editor-hit', !!compositionEditor.pick(raycaster));
      return;
    }
    const ownedPointer = cockpitPointers.get(event.pointerId);
    if (ownedPointer?.mode === 'wheel') {
      const dx = event.clientX - ownedPointer.lastX;
      ownedPointer.lastX = event.clientX;
      wheelDragTarget = clamp(wheelDragTarget + dx / dragPixelsForFullLock, -1, 1);
      return;
    }
    if (ownedPointer?.mode === 'shifter' && shifterDragOrigin) {
      const rawX = clamp(shifterDragOrigin.x + (event.clientX - shifterDragOrigin.clientX) / 58, -1, 1);
      const rawY = clamp(shifterDragOrigin.y - (event.clientY - shifterDragOrigin.clientY) / 54, -1, 1);
      let x = rawX;
      const y = rawY;
      if (Math.abs(y) > 0.34) {
        const laneSource = Math.abs(gearState.y) > 0.34 ? gearState.x : rawX;
        x = laneSource < -0.5 ? -1 : laneSource > 0.5 ? 1 : 0;
      }
      gearState.x = x;
      gearState.y = y;
      return;
    }
    if (cockpitPointers.size) return;
    const nextHover = hitTest(event);
    if (nextHover !== hoverControl) {
      hoverControl = nextHover;
      renderer.domElement.classList.toggle('wheel-hover', nextHover === 'wheel' || nextHover === 'shifter');
      renderer.domElement.classList.toggle('control-hover', nextHover === 'accelerator' || nextHover === 'brake');
    }
  });

  function restoreLeverAfterRejectedDrag(origin) {
    const fallbackGear = origin && GEAR_POSITIONS[origin.gear] ? origin.gear : 'N';
    gearState.gear = 'N';
    gearState.requested = 'N';
    gearState.clutch = 0;
    if (requestGear(fallbackGear, 'restore')) return;
    const fallback = GEAR_POSITIONS[fallbackGear] || GEAR_POSITIONS.N;
    gearState.x = fallback.x;
    gearState.y = fallback.y;
    gearState.gear = fallbackGear;
    gearState.requested = fallbackGear;
    gearState.clutch = fallbackGear === 'N' ? 0 : 1;
    gearState.path = null;
    setGearUi();
  }

  function endPointer(event) {
    const ownedPointer = cockpitPointers.get(event.pointerId);
    if (!ownedPointer) return;
    cockpitPointers.delete(event.pointerId);
    if (ownedPointer.mode === 'shifter' && shifterDragOrigin) {
      const selected = gearFromLever(gearState.x, gearState.y);
      const origin = shifterDragOrigin;
      shifterDragOrigin = null;
      if (event.type !== 'pointerup' || !requestGear(selected, 'manual')) restoreLeverAfterRejectedDrag(origin);
    }
    if (ownedPointer.mode === 'wheel') wheelDragTarget = 0;
    renderer.domElement.classList.toggle('dragging', hasCockpitPointerMode('wheel') || hasCockpitPointerMode('shifter'));
    renderer.domElement.classList.toggle('control-hover', hasCockpitPointerMode('accelerator') || hasCockpitPointerMode('brake'));
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    updateKeyUi();
  }
  renderer.domElement.addEventListener('pointerup', endPointer);
  renderer.domElement.addEventListener('pointercancel', endPointer);
  renderer.domElement.addEventListener('lostpointercapture', endPointer);
  runtimeEvents.listen(window,'blur', () => { keys.clear(); releaseCockpitInputCaptures(); raceWorld.clearInputs(); updateKeyUi(); });
  raceCameraState.subscribe((mode) => {
    cameraEntrance.cancel();cameraOpening.cancel();
    cockpitEntranceRoot.position.z = 0;
    releaseCockpitInputCaptures();
    const lever = GEAR_POSITIONS[gearState.gear] || GEAR_POSITIONS.N;
    gearState.x = lever.x;
    gearState.y = lever.y;
    vehicleCameraRig?.setMode(mode);
    vehicleCameraRig?.reset(raceWorld.getRenderFrame());
    compositionEditor?.refreshAvailability();
    updateKeyUi();
  });
  renderer.domElement.addEventListener('pointerleave', (event) => {
    if (cockpitPointers.has(event.pointerId) && event.buttons === 0) endPointer(event);
    if (!cockpitPointers.size) {
      hoverControl = null;
      renderer.domElement.classList.remove('wheel-hover', 'control-hover');
    }
  });

  gearKeys.forEach((element) => {
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (compositionEditor?.isActive() || gameSettings.transmissionMode !== 'manual') return;
      void ensureAudioStarted();
      requestGear(element.dataset.gear, 'manual');
    });
  });

  mobileDrivingControls = createMobileDrivingControls({
    document,events:window,deviceProfile:runtimeDeviceProfile,
    readContext(){const gate=raceWorld.getControlGate();return {...gate,blockDriving:gate.blockDriving||menuOpen||!!compositionEditor?.isActive(),presentationHeld:!!globalThis.__asfaltoRacePresentationHeld||!!cameraOpening.blocking,cameraMode:raceCameraState.current,transmissionMode:gameSettings.transmissionMode,gear:gearState.gear,requestedGear:gearState.requested,rpm:vehicle.rpm,forwardGears:raceWorld.getForwardGearCount?.()||4};},
    requestGear:target=>requestGear(target,'manual'),
    setTransmissionMode:mode=>changeTransmissionMode(mode),
    pause:()=>{if(globalThis.__asfaltoRacePresentation?.requestPause)globalThis.__asfaltoRacePresentation.requestPause();else raceWorld.pause();},
    beginInspection:()=>{const state=raceWorld.pause({reason:'mobile-inspection'});if(state.status!=='PAUSED')return false;setRaceCameraMode('chase');return true;},
    cycleInspection:()=>{if(cycleRaceCamera()==='cockpit')cycleRaceCamera();},
    returnToCockpit:()=>setRaceCameraMode('cockpit'),resume:()=>raceWorld.resume(),
    releaseSteering:()=>releaseCockpitInputCaptures(),
    recover:()=>raceWorld.recover(),onGesture:()=>ensureAudioStarted(),
  });

  settingsToggleEl.addEventListener('click', () => {
    void ensureAudioStarted();
    if (menuOpen && compositionEditor?.isActive()) compositionEditor.setActive(false);
    setSettingsPanelOpen(!menuOpen);
  });
  settingsCloseEl.addEventListener('click', () => {
    if (compositionEditor?.isActive()) compositionEditor.setActive(false);
    setSettingsPanelOpen(false);
  });
  runtimeEvents.listen(document,'pointerdown', (event) => {
    if (!menuOpen) return;
    if (settingsPanelEl.contains(event.target) || settingsToggleEl.contains(event.target)) return;
    if (compositionEditor?.isActive()) return;
    setSettingsPanelOpen(false);
  });

  transmissionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      void ensureAudioStarted();
      changeTransmissionMode(button.dataset.transmission);
    });
  });

  settingsInputs.soundEnabled.addEventListener('change', () => {
    gameSettings.soundEnabled = settingsInputs.soundEnabled.checked;
    applySettings();
    if (gameSettings.soundEnabled) void ensureAudioStarted();
    else void engineSound.setEnabled(false);
  });
  settingsInputs.audioProfile.addEventListener('change', () => {
    gameSettings.audioProfile = settingsInputs.audioProfile.value;
    applySettings();
    void ensureAudioStarted();
  });
  settingsInputs.audioQuality.addEventListener('change', () => {
    gameSettings.audioQuality = settingsInputs.audioQuality.value;
    applySettings();
  });
  settingsInputs.graphicsQuality.addEventListener('change', () => {
    gameSettings.graphicsQuality = settingsInputs.graphicsQuality.value;
    applySettings();
  });

  const numericSettingKeys = [
    'autoAggression', 'masterVolume', 'idleRoughness', 'exhaustCharacter', 'intakeCharacter',
    'transmissionCharacter', 'popsLevel', 'stereoWidth', 'engineVolume', 'exhaustVolume', 'intakeVolume',
    'mechanicalVolume', 'roadVolume', 'brakeVolume', 'cabinAmount',
    'steeringSensitivity', 'pedalResponse', 'brakeStrength', 'shiftSpeed',
  ];
  numericSettingKeys.forEach((key) => {
    settingsInputs[key].addEventListener('input', () => {
      gameSettings[key] = Number(settingsInputs[key].value);
      if (key === 'autoAggression') automaticTransmission.cooldown = 0;
      applySettings();
    });
  });
  settingsResetEl.addEventListener('click', () => {
    gameSettings = normalizeGameSettings(DEFAULT_GAME_SETTINGS);
    backgroundEditor.resetToDefault();
    frontCutController.reset();
    automaticTransmission.cooldown = 0;
    automaticTransmission.holdTimer = 0;
    automaticTransmission.kickdownTimer = 0;
    automaticTransmission.lastThrottle = 0;
    applySettings();
    if (gameSettings.soundEnabled) void ensureAudioStarted();
  });

  function physicalGearLabel(value) {
    if (value === -1) return 'R';
    if (value === 0) return 'N';
    return String(clamp(Number(value) || 1, 1, 5));
  }

  function mirrorPhysicalSnapshot(raceFeedback) {
    const snapshot=raceFeedback?.renderFrame?.currentSnapshot
      ||raceFeedback?.physicsSnapshot
      ||raceWorld.getRenderFrame?.().currentSnapshot
      ||null;
    if(!snapshot)return null;
    const controls=raceFeedback?.controls||snapshot.controls||{};
    const velocity=snapshot.chassis?.linearVelocity||[0,0,0];
    const projectedSpeed=Number(raceFeedback?.speedMps);
    const speedMps=Number.isFinite(projectedSpeed)
      ?projectedSpeed
      :Math.hypot(Number(velocity[0])||0,Number(velocity[2])||0);
    vehicle={...vehicle,...drivingAudioState({snapshot,controls,speedMps}).engine,speedMps};
    const handwheelAngleRad=Number(controls.handwheelAngleRad);
    steering={
      steer:clamp(
        Number.isFinite(handwheelAngleRad)
          ?handwheelAngleRad/(Math.PI*5.5)
          :(Number(controls.steer)||0)/(Math.PI*5.5/24),
        -1,1,
      ),
      velocity:(Number(controls.handwheelAngularVelocityRadps)||0)/(Math.PI*5.5),
    };
    accelerator={value:clamp(Number(controls.throttle)||0,0,1),velocity:0};
    brake={value:clamp(Number(controls.brake)||0,0,1),velocity:0};
    gearState.gear=physicalGearLabel(snapshot.gearbox?.gear);
    gearState.clutch=clamp(Number(snapshot.clutch?.engagement),0,1);
    return {controls,snapshot};
  }

  const ignitionMotionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function simulationStep(dt) {
    const requestedTargets = controlTargets();
    const paused = raceWorld.isPaused;
    const targets = paused
      ? { steer:0, throttle:0, brake:0, clutch:0, handbrake:0, steeringMode:'none' }
      : requestedTargets;
    if(!paused) {
      updateAutomaticTransmission({ throttle:targets.throttle, brake:targets.brake },dt);
      updateGear(dt);
    }
    const requestedGear=gearState.gear==='R'?-1
      :gearState.gear==='N'?0
      :clamp(Number.parseInt(gearState.gear,10)||0,0,5);
    const raceFeedback=raceWorld.update(dt,{
      popsLevel:gameSettings.popsLevel, rpm:vehicle.rpm,
      steer:targets.steer,
      throttle:targets.throttle,
      brake:targets.brake,
      clutch:targets.clutch,
      handbrake:targets.handbrake||0,
      steeringMode:targets.steeringMode,
      requestedGear,
      automaticClutchEngagement:clamp(gearState.clutch,0,1),
      digitalActions:{
        throttle:keys.has('KeyW'),
        brake:keys.has('KeyS'),
        clutch:keys.has('ShiftLeft'),
        handbrake:keys.has('Space'),
      },
    });
    const physical=mirrorPhysicalSnapshot(raceFeedback);
    cockpitIgnition?.update(physical?.snapshot, {
      dt, paused, editing:compositionEditor?.isActive() || false,
      reducedMotion:ignitionMotionPreference?.matches || document.body.classList.contains('v6-reduce-motion'),
    });
    cockpitLightSwitch?.update(dt);
    const physicalControls=physical?.controls||{
      throttle:0,brake:0,clutchEngagement:1,handbrake:0,
    };
    gaugeCluster.update(Math.abs(vehicle.speedMps)*3.6,vehicle.rpm,gearState.gear,dt);
    instrumentPhysicalTimeSeconds=Number.isFinite(raceWorld.state?.physicsSnapshot?.timeSeconds)?raceWorld.state.physicsSnapshot.timeSeconds:null;
    const instrument= raceWorld.getDrivingLights(),dark=/night|dusk|sunset|noche/.test(instrument.phase||'');gaugeCluster.speed.setIllumination(instrument.instrumentPower,dark);gaugeCluster.rpm.setIllumination(instrument.instrumentPower,dark);
    engineSound.update(vehicle,{
      throttle:physicalControls.throttle,
      brake:physicalControls.brake,
    },gearState.gear,{cameraMode:raceCameraState.current,physicalRoad:true,ignition:physical?.snapshot?.engine?.ignition});
  }

  function advanceSimulation(seconds) {
    let remaining = clamp(Number(seconds) || 0, 0, 120);
    while (remaining > 1e-8) {
      const dt = Math.min(1 / 60, remaining);
      cameraOpening.step(dt,{paused:raceWorld.isPaused});
      simulationStep(dt);
      remaining -= dt;
    }
    updateRaceCamera(0);
  }

  function updateHud() {
    const wheelAngle = steerToWheelRotation(steering.steer, maxWheelAngle);
    const displayDeg = Math.round(THREE.MathUtils.radToDeg(wheelAngle));
    angleEl.textContent = `${Math.abs(displayDeg)}°`;
    directionEl.textContent = Math.abs(displayDeg) < 2 ? 'CENTRO' : displayDeg > 0 ? 'IZQUIERDA' : 'DERECHA';
    meterFillEl.style.transform = `scaleX(${Math.max(0.02, Math.abs(steering.steer))})`;
    meterFillEl.dataset.side = steering.steer < -0.01 ? 'left' : steering.steer > 0.01 ? 'right' : 'center';
    speedValueEl.textContent = String(Math.round(Math.abs(vehicle.speedMps) * 3.6)).padStart(3, '0');
    rpmValueEl.textContent = String(Math.round(vehicle.rpm));
    gearValueEl.textContent = performance.now() < gearState.blockedReverseUntil ? '!' : gearState.gear;
    setGearUi();
  }

  function applyMechanicalVisuals() {
    acceleratorPivot.rotation.x = accelerator.value * 0.30;
    brakePivot.rotation.x = brake.value * 0.24;
    wheelPivot.rotation.z = steerToWheelRotation(steering.steer, maxWheelAngle);
    shifterMechanism.update(gearState.x, gearState.y);
    updateHud();
  }

  let raceCameraInitialized = false;
  let lastPhysicalCameraPose = null;

  function updateRaceCamera(frameDt = 1 / 60) {
    const mode = raceCameraState.current;
    const isCockpit = mode === 'cockpit';
    const authoredAnchors=authoredCockpitAnchors(window.__asfaltoSelectedPlayerVehicle);
    cockpit.visible = isCockpit&&!authoredAnchors;authoredMirrors?.setVisible(isCockpit);
    raceChevyV3.visible = !!authoredAnchors || mode === 'chase' || mode === 'cinematic';
    const renderFrame = raceWorld.getRenderFrame();
    const speedMps = Math.hypot(...(renderFrame.currentSnapshot?.chassis?.linearVelocity || [0, 0, 0]));
    const previewDistance = clamp(12 + speedMps * 0.55, 12, 42);
    const preview = raceWorld.track.sample((renderFrame.projection?.s || 0) + previewDistance);
    const cameraFrame = {
      ...renderFrame,
      bodyMountedCockpit:!!authoredAnchors,cockpitAnchorM:authoredAnchors?.cockpit,hoodAnchorM:authoredAnchors?.hood,cockpitLookDownDeg:authoredAnchors?.lookDownDeg,
      lookBack: raceWorld.getCameraMotion().lookBack,
      routeLookAhead: [Number(preview.x) || 0, Number(preview.y) || 0, Number(preview.z) || 0],
    };
    if (!vehicleCameraRig) {
      vehicleCameraRig = createVehicleCameraRig({
        camera,
        cockpitPhysicalMotion:false,
        collisionQuery: createCameraBoomCollisionQuery(THREE, {
          getObstacles: () => [raceWorld.getFalconVisualRoot?.()].filter(Boolean),
        }),
      });
      vehicleCameraRig.setCockpitCalibration(compositionState.getState().camera.cockpit);
      vehicleCameraRig.setMode(mode);
    }
    const cockpitVehicle=window.__asfaltoSelectedPlayerVehicle||'chevy';
    if(appliedCockpitVehicle!==cockpitVehicle){
      vehicleCameraRig.setCockpitCalibration(vehicleCockpitCalibrations.get(cockpitVehicle)||(authoredAnchors?{...COCKPIT_CALIBRATION_DEFAULTS,positionOffsetM:[0,0,0],rotationOffsetDeg:[0,0,0],lensMode:'manual',focalLengthMm:18}:compositionState.getState().camera.cockpit));
      appliedCockpitVehicle=cockpitVehicle;
    }
    lastPhysicalCameraPose = raceCameraInitialized
      ? vehicleCameraRig.update(cameraFrame, frameDt)
      : vehicleCameraRig.reset(cameraFrame);
    raceCameraInitialized = Boolean(lastPhysicalCameraPose);
    const opening=cameraOpening.step(frameDt,{paused:raceWorld.isPaused});
    cameraOpeningOverlay.update(opening,raceWorld.track.name);
    const entry = cameraEntrance.step(opening.blocking?0:frameDt, { currentMode:mode, paused:raceWorld.isPaused });
    cockpitEntranceRoot.position.z = entry.cockpitCompensationZ;
    if (entry.active) {
      entranceOffset.fromArray(entry.offset).applyQuaternion(camera.quaternion);
      camera.position.add(entranceOffset);
      camera.updateMatrixWorld();
    }
    const head=headMotion.update(renderFrame.currentSnapshot,frameDt,{mode:opening.blocking?'cinematic':mode,paused:raceWorld.isPaused,reducedMotion:compositionEditor?.isActive()||ignitionMotionPreference?.matches||document.body.classList.contains('v6-reduce-motion'),cameraWorldQuaternion:camera.quaternion.toArray()});
    headMotionOffset.fromArray(head.positionOffsetM).applyQuaternion(camera.quaternion);camera.position.add(headMotionOffset);headMotionQuaternion.fromArray(head.quaternion);camera.quaternion.multiply(headMotionQuaternion);
    cockpitHeadRoot.position.fromArray(head.compensationPositionM);cockpitHeadRoot.quaternion.fromArray(head.compensationQuaternion);camera.updateMatrixWorld();
    cockpitViewPreset?.compensate(renderFrame.currentSnapshot);
    if(opening.shot){
      cockpit.visible=false;raceChevyV3.visible=true;
      camera.position.fromArray(opening.shot.position);camera.up.set(0,1,0);camera.lookAt(...opening.shot.target);camera.fov=opening.shot.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    }
    // Portrait phones keep a usable road view instead of expanding to a fisheye cabin lens.
    if(runtimeDeviceProfile.phone&&isCockpit&&!opening.shot&&!compositionEditor?.isActive())applyPhoneCockpitProjection(camera);
  }

  setLoading('Preparando oclusión de la escena…');
  rayTracing=createRayTracedOcclusion({THREE,renderer,scene,camera,excludeRoots:()=>[cockpit,...(compositionEditor?.renderOverlays||[])],excludeOccluders:()=>[raceChevyPhysicalRoot,raceWorld.getFalconVisualRoot?.()]});
  rayTracingSettings=installRayTracingSettings({controller:rayTracing,getDiagnostics:()=>globalThis.__chevyV6Complete?.workshop?.active?(globalThis.__chevyV6Complete.workshop.rayTracing?.diagnostics()||rayTracing.diagnostics()):rayTracing.diagnostics()});
  globalThis.__asfaltoRayTracing={refresh:()=>rayTracingSettings.refresh(),getMode:()=>rayTracingSettings.getMode(),setMode:value=>rayTracingSettings.setMode(value),diagnostics:()=>rayTracing.diagnostics()};
  async function preparePlayerVehicle(vehicle,{signal}={}) {
    const stage=new THREE.Group();stage.name=`RaceVehicle_${vehicle}`;stage.userData.vehicleSelectionMount=true;stage.visible=false;raceChevyV3Model.add(stage);let presentation,committed=false,released=false;
    try { presentation=await createVehiclePresentation(THREE,{vehicle,signal,lodLevels:runtimeDeviceProfile.phone?[0]:[0,1,2],modelRoot:stage,physicalCalibration:true,lightScene:scene,loadGlb:window.__asfaltoLoadVehicleModel,paintColor:getVehicleDefinition(vehicle)?.defaultPaint||globalThis.__chevyPaintColor||'#d66a24'}); presentation.setChassisConfig(globalThis.__asfaltoChassisConfig || null); } catch(error) { stage.removeFromParent();throw error; }
    return { commit(){if(committed||released)return;authoredControlMounts?.restore();authoredMirrors?.dispose();raceChevyPresentation?.dispose();for(const child of [...raceChevyV3Model.children])if(child!==stage){if(child.userData.vehicleSelectionMount)child.removeFromParent();else child.visible=false;}raceChevyPresentation=presentation;window.__asfaltoVehiclePresentations.chevy=presentation;window.__asfaltoSelectedPlayerVehicle=vehicle;authoredControlMounts??=createAuthoredControlMounts(THREE,{radio:radioMount,ignition:cockpitIgnition.mount,lights:cockpitLightSwitch.mount,illumination:cockpitLightSwitch.instrumentLight,shifter:shifterAssembly});authoredControlMounts.attach(presentation.root,vehicle);authoredMirrors=attachAuthoredMirrors(THREE,presentation,vehicle,cockpitMirrors.feeds);raceWorld.attachWeatherWindshield(authoredWindshieldMount(THREE,presentation,vehicle)||{cabinMount});raceCameraInitialized=false;void raceWorld.invalidateVehiclePhysics();stage.visible=true;committed=true;presentation.setLightMode(raceWorld.getDrivingLights().mode);lightingEditor?.applyVehicles();rayTracing?.invalidate();},dispose(){if(released||committed)return;released=true;presentation.dispose();stage.removeFromParent();} };
  }
  setLoading('Preparando vegetación y efectos gráficos…');
  advancedGraphics=createAdvancedGraphics(THREE,{renderer,scene,camera,phone:runtimeDeviceProfile.phone,allowPivotPainter:!runtimeDeviceProfile.phone,samples:runtimeDeviceProfile.phone?0:2,onRenderStage:markFirstFrame,getEnvironment:()=>raceWorld.getAdvancedGraphicsEnvironment(),getQuality:()=>raceWorld.getPerformanceTier(),getQualityDiagnostics:()=>raceWorld.getPerformanceDiagnostics()});
  graphicsSettings=installAdvancedGraphicsSettings({getDiagnostics:()=>{const active=globalThis.__chevyV6Complete?.workshop?.active?globalThis.__chevyV6Complete.workshop.advancedGraphics:advancedGraphics;return{targetFps:framePacingSettings?.getTargetFps()||60,effectiveQuality:active?.getEffectiveQuality()};}});
  globalThis.__asfaltoAdvancedGraphics={getMasterQuality:()=>gameSettings.graphicsQuality,refreshStatus:()=>graphicsSettings?.refresh(),getSettings:()=>graphicsSettings.getSettings(),setSettings:value=>graphicsSettings.setSettings(value),setMode:value=>graphicsSettings.setMode(value),diagnostics:()=>(globalThis.__chevyV6Complete?.workshop?.active?globalThis.__chevyV6Complete.workshop.advancedGraphics:advancedGraphics)?.diagnostics(),refresh:()=>{advancedGraphics?.refresh();globalThis.__chevyV6Complete?.workshop?.advancedGraphics?.refresh();}};
  framePacingSettings=installFramePacingSettings();
  cockpitViewPreset=installDrivingViewPreset({THREE,mount:cockpitViewMount});
  const cockpitRenderPass = createCockpitRenderPass({ renderer, scene, camera, cockpit, prepareWorld:compile=>colorGrading.prepare(({linearOutput=false}={})=>{const restore=raceWorld.prepareFogRender({linearOutput});try{return advancedGraphics.prepare(compile);}finally{restore?.();}}), prepareInterior:compile=>colorGrading.prepare(({linearOutput=false}={})=>{const restore=raceWorld.prepareFogRender({linearOutput});try{return compile();}finally{restore?.();}}), overlays:compositionEditor?.renderOverlays || [],renderWorld:()=>advancedGraphics.render(()=>{const restore=scene.fog?raceWorld.prepareFogRender({linearOutput:!!renderer.getRenderTarget()}):null;try{renderer.render(scene,camera);}finally{restore?.();}}) });
  raceAudioActivation=installRaceAudioActivation({getState:()=>engineSound.getState(),isEnabled:()=>gameSettings.soundEnabled,isDriving:()=>!document.hidden&&document.body.classList.contains('v6-driving')&&!document.body.classList.contains('v6-menu-open')&&!document.body.classList.contains('an-race-paused')&&!globalThis.__asfaltoRacePresentationHeld,activate:()=>raceWorld.activateAudio()});
  setLoading('Preparando compositor de color…');
  colorGrading=createRaceColorGrade({THREE,renderer,phone:runtimeDeviceProfile.phone,getQuality:()=>raceWorld.getPerformanceTier(),samples:runtimeDeviceProfile.phone?0:2,onStage:markFirstFrame});lightingEditor?.reapply();
  let trackStreamingError=null;
  let trackStreamingPromise=null;
  function reportTrackStreamingError(error) {
    const message=String(error?.message||error);
    if(message!==trackStreamingError)globalThis.dispatchEvent?.(new CustomEvent('asfalto-v6-streaming-error',{detail:{message}}));
    trackStreamingError=message;
    globalThis.__asfaltoV6TrackStreamingError=message;
  }
  let renderingPreparation=Promise.resolve();
  function prepareRendering({signal}={}){
    // Serialize shared-material compile polling even if two launch requests overlap.
    const next=renderingPreparation.catch(()=>{}).then(async()=>{
      modularHostInitialization.assertActive();
      const adapter=globalThis.__asfaltoV6Modular?.trackManager?.active;
      await adapter?.updateStreaming({sM:Number(raceWorld.state?.raceProgress)||0,quality:graphicsQualityFamily(raceWorld.getPerformanceTier()),distanceM:2});
      signal?.throwIfAborted();if(adapter)raceWorld.refreshWeatherEffectSurfaces(adapter);
      advancedGraphics.refresh();
      raceWorld.update(0,{throttle:0,brake:0,steer:0});
      applyMechanicalVisuals();updateRaceCamera(0);advancedGraphics.update({time:performance.now()/1000});
      await modularHostInitialization.waitFor(cockpitRenderPass.prepare({signal}), 'selected-vehicle-shader-preparation');
      modularHostInitialization.assertActive();
      await cockpitMirrors.prepare({renderer,scene,carPose:raceWorld.getRenderFrame(),cameraPoses:authoredMirrors?()=>authoredMirrors.cameraPoses(raceWorld.getRenderFrame()):null,quality:raceWorld.getPerformanceTier(),signal});
      await raceWorld.renderWaterReflections({renderer,scene,camera,quality:raceWorld.getPerformanceTier(),prepareOnly:true,signal,excludeRoots:[cockpit,...(compositionEditor?.renderOverlays||[])]});
      signal?.throwIfAborted();bootRenderGate.release();
    });
    renderingPreparation=next;return next;
  }

  gpuFrameTimer=createGpuFrameTimer(renderer.getContext());
  const publishPresentedRacePhoto=createPresentedFrameCapture({renderer,camera,getBridge:()=>globalThis.__asfaltoV7RacePhoto,getMetadata:()=>{const environment=raceWorld.getAdvancedGraphicsEnvironment();return{trackId:raceWorld.track.id,skyId:environment.skyId,weather:environment.weather,vehicleId:globalThis.__asfaltoSelectedPlayerVehicle||'chevy',qa:new URLSearchParams(globalThis.location.search).get('qa')==='1'};}});
  function renderFrame() {
    if(!bootRenderGate.allowed()||document.body.classList.contains('v6-menu-open')||document.body.classList.contains('an-intro-open'))return;
    markFirstFrame('Primer cuadro: cámara y controles');
    if (!raceCameraInitialized) updateRaceCamera(1);

    compositionEditor?.updateGuides();
    radioController?.update(performance.now());
    const cameraPosition=[Number(camera.position.x)||0,Number(camera.position.y)||0,Number(camera.position.z)||0];
    const physicalPosition=raceWorld.state?.physicsSnapshot?.chassis?.position;
    const routeSample=raceWorld.track.sample(raceWorld.state?.raceProgress||0);
    const vehiclePosition=Array.isArray(physicalPosition)&&physicalPosition.length===3&&physicalPosition.every(Number.isFinite)?[...physicalPosition]:[Number(routeSample.x)||0,Number(routeSample.y)||0,Number(routeSample.z)||0];
    const distanceM=Math.hypot(cameraPosition[0]-vehiclePosition[0],cameraPosition[1]-vehiclePosition[1],cameraPosition[2]-vehiclePosition[2]);
    try {
      const activeAdapter=globalThis.__asfaltoV6Modular.trackManager?.active;
      const requestedQuality=gameSettings.graphicsQuality==='eco'?'low':gameSettings.graphicsQuality==='balanced'?'balanced':'high';
      const governedQuality=graphicsQualityFamily(raceWorld.getPerformanceTier()); // Rendering must not change physical streaming policy.
      const qualityRank={low:0,balanced:1,high:2};
      const quality=qualityRank[requestedQuality]<=qualityRank[governedQuality]?requestedQuality:governedQuality;
      const result=visualPrecompileInProgress?null:activeAdapter?.updateStreaming({sM:Number(raceWorld.state?.raceProgress)||0,quality,distanceM,cameraPosition,vehiclePosition});
      if(result&&typeof result.then==='function'){
        const observed=Promise.resolve(result);
        if(observed!==trackStreamingPromise){
          trackStreamingPromise=observed;
          observed.then(()=>{if(trackStreamingPromise===observed && activeAdapter===globalThis.__asfaltoV6Modular.trackManager?.active){raceWorld.refreshWeatherEffectSurfaces(activeAdapter);trackStreamingError=null;globalThis.__asfaltoV6TrackStreamingError=null;}},reportTrackStreamingError);
        }
      }else{
        trackStreamingError=null;
        globalThis.__asfaltoV6TrackStreamingError=null;
      }
    } catch(error) {
      reportTrackStreamingError(error);
    }
    markFirstFrame('Primer cuadro: vegetación y atmósfera');
    advancedGraphics.update({time:performance.now()/1000});colorGrading?.setSamples(runtimeDeviceProfile.phone?0:advancedGraphics.getEffectiveQuality()==='cinematic'?4:2);graphicsSettings.refresh();
    rayTracing.update({sceneKey:globalThis.__asfaltoV6Modular.trackManager?.active||scene});rayTracingSettings.refresh();
    gpuFrameTimer.begin();
    try{withFrameMatrices(scene,()=>{
    const captureNow=performance.now(),captureQuality=raceWorld.getPerformanceTier();
    const captureSchedule=!visualPrecompileInProgress?auxiliaryCaptureSchedule:null;
    captureSchedule?.beginFrame(captureNow,{quality:captureQuality,mirrors:raceCameraState.current==='cockpit'&&raceWorld.rearviewEnabled});
    markFirstFrame('Primer cuadro: reflejos del agua');
    const waterCaptured=raceWorld.renderWaterReflections({renderer,scene,camera,quality:captureQuality,nowMs:captureNow,captureSchedule,excludeRoots:[cockpit,...(compositionEditor?.renderOverlays||[])]});
    if(!waterCaptured)captureSchedule?.skip('water');
    markFirstFrame('Primer cuadro: espejos');
    cockpitMirrors.update({ renderer, scene, carPose:raceWorld.getRenderFrame(), cockpitVisible:raceCameraState.current==='cockpit', cameraPoses:authoredMirrors?()=>authoredMirrors.cameraPoses(raceWorld.getRenderFrame()):null, enabled:raceWorld.rearviewEnabled, quality:captureQuality, nowMs:captureNow, captureSchedule });
    markFirstFrame('Primer cuadro: render del mundo y cockpit');
    colorGrading.render(({linearOutput=false}={})=>{const restore=raceWorld.prepareFogRender({linearOutput});try{cockpitRenderPass.render();}finally{restore?.();}});
    });publishPresentedRacePhoto();markFirstFrame('Cuadro enviado a GPU');firstPhoneFrame=false;}finally{gpuFrameTimer.end();}
  }

  function qualityPixelRatioLimit(width) {return devicePixelRatioLimit({quality:gameSettings.graphicsQuality,width,memory:navigator.deviceMemory,profile:runtimeDeviceProfile});}

  function resize() {
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);
    const aspect = width / height;
    currentFrameBudget=resolveRenderBudget({width,height,pixelRatio:renderPixelRatio({devicePixelRatio:window.devicePixelRatio||1,qualityLimit:qualityPixelRatioLimit(width),renderScale:raceWorld.getPerformanceScale()}),quality:raceWorld.getPerformanceTier(),phone:runtimeDeviceProfile.phone});
    renderer.setPixelRatio(currentFrameBudget.pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = aspect;
    if(vehicleCameraRig&&raceCameraInitialized)updateRaceCamera(0);
    else {camera.fov = aspect < DESKTOP_REFERENCE_ASPECT ? verticalFovFromHorizontalFov(desktopHorizontalFov, aspect) : referenceVerticalFov;camera.updateProjectionMatrix();}
    dragPixelsForFullLock = runtimeDeviceProfile.phone?phoneWheelDragPixels(width,height):Math.max(150, Math.min(340, width * 0.42));
    raceWorld.resize();
    // The next scheduled frame observes the new size; never render recursively
    // from the performance governor while the current frame is still running.
  }
  const syncAudioScene=()=>{const canPlay=engineSoundSettings().audio.enabled;void (canPlay&&engineSound.getState().started?engineSound.resume():engineSound.suspend()).catch(error=>console.error('Audio scene transition failed',error));};
  runtimeEvents.listen(window,'asfalto:race-state',syncAudioScene);
  const audioSceneObserver=new MutationObserver(syncAudioScene);audioSceneObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  runtimeEvents.listen(window,'asfalto:runtime-dispose',()=>audioSceneObserver.disconnect(),{once:true});
  runtimeEvents.listen(window,'resize', resize);
  runtimeEvents.listen(document,'visibilitychange', () => {
    if (document.hidden) {
      void engineSound.suspend().finally(updateAudioStatus);
      return;
    }
    if (gameSettings.soundEnabled && engineSound.getState().started) {
      void engineSound.resume().finally(updateAudioStatus);
    }
  });
  runtimeEvents.listen(window,'pagehide', () => { void engineSound.suspend(); });
  runtimeEvents.listen(window,'pageshow',event=>{if(event.persisted){resize();updateAudioStatus();}});
  resize();

  let accumulator = 0;
  const clock = new THREE.Clock();
  let previousDrivingFrame=false, accumulatedFrameWorkMs=0;
  const framePacer=createFramePacer();
  const resetDrivingClock=()=>{clock.getDelta();accumulator=0;previousDrivingFrame=false;accumulatedFrameWorkMs=0;framePacer.reset();};
  runtimeEvents.listen(window,'asfalto:race-state',resetDrivingClock);
  runtimeEvents.listen(document,'visibilitychange',resetDrivingClock);
  const presentationStats={frames:0,timestampMs:null,intervalMs:null,targetFps:60};
  const frameFailureBoundary=createFrameFailureBoundary({onFault:error=>{
    renderingEnabled=false;
    // Reuse the real input/pause owners; never reset or modify mechanical settings.
    try{raceWorld.pause({reason:'runtime-fault'});}catch(pauseError){console.error('No se pudo completar la pausa',pauseError);}
    keys.clear();releaseCockpitInputCaptures();raceWorld.clearInputs();
    accumulator=0;previousDrivingFrame=false;accumulatedFrameWorkMs=0;framePacer.reset();
    void engineSound.suspend().catch(()=>{});
    console.error('Asfalto: conducción suspendida por un error',error);
    window.dispatchEvent(new CustomEvent('asfalto:runtime-fault',{detail:{message:String(error?.message||error)}}));
  }});
  function recoverDrivingFrame(){
    if(!frameFailureBoundary.recover(()=>{if(renderer.getContext().isContextLost())throw Error('El contexto gráfico todavía no está disponible.');applyMechanicalVisuals();renderFrame();}))throw Error('No se pudo recuperar la vista. Volvé al taller o recargá la página.');
    renderingEnabled=true;clock.getDelta();accumulator=0;framePacer.reset();
  }
  function animate(timestamp=performance.now()) {
    try { frameFailureBoundary.run(()=>{
    const rawFrameDt = Math.max(0, clock.getDelta());
    const simulationFrameDt = Math.min(rawFrameDt, 0.05);
    const raceSurfaceVisible = !document.hidden && !document.body.classList.contains('v6-menu-open') && !document.body.classList.contains('an-intro-open');
    if (renderingEnabled && raceSurfaceVisible && !raceWorld.isPreparing?.()) {
      if(!previousDrivingFrame)raceWorld.beginPerformanceWindow('driving');
      previousDrivingFrame=true;
      const frameWorkStarted = performance.now();
      accumulator += simulationFrameDt;
      while (accumulator >= 1 / 60) {
        simulationStep(1 / 60);
        accumulator -= 1 / 60;
      }
      applyMechanicalVisuals();
      updateRaceCamera(simulationFrameDt);
      const presentation=framePacer.sample(timestamp,framePacingSettings.getTargetFps());
      if(presentation.render){renderFrame();presentationStats.frames++;presentationStats.timestampMs=timestamp;presentationStats.intervalMs=presentation.intervalMs;presentationStats.targetFps=presentation.targetFps;}
      accumulatedFrameWorkMs += Math.max(0,performance.now()-frameWorkStarted);
      if(presentation.render){
        if(presentation.intervalMs!==null)raceWorld.reportFrame(presentation.intervalMs/1000,accumulatedFrameWorkMs);
        accumulatedFrameWorkMs=0;
      }
    } else {accumulator=0;previousDrivingFrame=false;accumulatedFrameWorkMs=0;framePacer.reset();}
    }); } finally { /* Scheduling belongs to the shared visual clock. */ }
  }

  setLoading('Aplicando presupuesto gráfico y controles…');
  applySettings({ persist: false });
  setSettingsPanelOpen(false);
  applyMechanicalVisuals();
  setGearUi();
  if(runtimeDeviceProfile.phone){
    setLoading('Cockpit preparado; esperando auto y circuito…');
    await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    modularHostInitialization.assertActive();
  }
  loadingEl.classList.add('hidden');
  viewport.classList.add('ready');

  modularHostInitialization.assertActive();
  window.__cockpit = {
    preparePlayerVehicle,prepareRendering,
    setFrontRestoration:value=>{restoredFront.setEnabled?.(value);renderFrame();return !!value;},
    v7FrontDiagnostics:()=>({...restoredFront,setEnabled:undefined}),
    getInstrumentReadings:()=>{const r=gaugeCluster.speed.getReading();return{indicatedKph:r.value,digitalKph:r.digitalValue,physicalTimeSeconds:instrumentPhysicalTimeSeconds,physicalTick:instrumentPhysicalTimeSeconds===null?null:Math.round(instrumentPhysicalTimeSeconds*120)};},
    v7PhoneTextureDiagnostics:()=>phoneCockpitTextureSelector.diagnostics(),
    v7RenderDiagnostics:()=>({output:{target:renderer.getRenderTarget()?.texture?.name||null,viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),layers:camera.layers.mask,cockpitVisible:cockpit.visible,sceneVisible:scene.visible},frameBudget:currentFrameBudget,gpu:gpuFrameTimer.diagnostics(),render:{...renderer.info.render},resources:{...renderer.info.memory},deviceBudget:{phone:runtimeDeviceProfile.phone,textureDecodeLimit:textureDecodeLimit(),antialias:renderer.getContext().getContextAttributes()?.antialias??null,transmissionScale:renderer.transmissionResolutionScale},camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,near:camera.near,far:camera.far},drawingBuffer:[renderer.domElement.width,renderer.domElement.height],exposure:renderer.toneMappingExposure}),
    v7BeginMeasurement:()=>{raceWorld.beginPerformanceWindow('driving');gpuFrameTimer.beginWindow();},
    v7DrivingView:{set:value=>cockpitViewPreset.setSelected(value),diagnostics:()=>cockpitViewPreset.diagnostics()},
    v7VehicleCockpitWheelDiagnostics:()=>vehicleCockpitWheel?.diagnostics(),
    v7CockpitLodDiagnostics:()=>({...cockpitDisplayLods?.diagnostics(),phoneDirect:[cabinMesh,dashboardMesh,wheelMesh,shifterBaseMesh].filter(m=>m.userData.phoneDisplay).map(m=>({name:m.userData.phoneDisplay.name,triangles:m.geometry.index.count/3,sourceRestorable:false}))}),
    v7SetCockpitDisplayLod:value=>{cockpitDisplayLods?.setEnabled(value);renderFrame();return cockpitDisplayLods?.diagnostics();},
    v7Presentation:{diagnostics:()=>({...presentationStats}),getTargetFps:()=>framePacingSettings.getTargetFps(),setTargetFps:value=>framePacingSettings.setTargetFps(value)},
    rayTracingDiagnostics:()=>rayTracing?.diagnostics(),
    raceCameraDiagnostics:()=>({rig:vehicleCameraRig?.diagnostics(),fov:camera.fov,aspect:camera.aspect,projection:camera.projectionMatrix.toArray()}),
    raceOpeningDiagnostics:()=>cameraOpening.diagnostics(),
    raceEntranceDiagnostics:()=>cameraEntrance.step(0,{paused:true}),
    headMotionDiagnostics:()=>headMotion.diagnostics(),
    lightingEditorDiagnostics:()=>lightingEditor?.diagnostics(),
    flushLightingPresets:()=>lightingEditor?.flush(),
    advancedGraphicsDiagnostics:()=>advancedGraphics?.diagnostics(),
    colorGradingDiagnostics:()=>colorGrading?.diagnostics(),
    build: COCKPIT_BUILD,
    ready: true,
    getState() {
      return {
        steering: { ...steering },
        accelerator: { ...accelerator },
        brake: { ...brake },
        vehicle: { ...vehicle, speedKmh: Math.abs(vehicle.speedMps) * 3.6 },
        gear: {
          gear: gearState.gear,
          requested: gearState.requested,
          x: gearState.x,
          y: gearState.y,
          clutch: gearState.clutch,
          shifting: !!gearState.path,
          autoCooldown: gearState.autoCooldown,
          shiftKind: gearState.shiftKind,
          torqueCut: gearState.torqueCut,
          throttleBlip: gearState.throttleBlip,
        },
        settings: { ...gameSettings },
        audio: engineSound.getState(),
        editor: compositionEditor?.getState() || null,
        background: backgroundEditor.getState(),
        frontCut: frontCutController.getState(),
        race: raceWorld.getState(),
        objects: {
          rearviewName: rearviewMount.name,
          rearviewPosition: rearviewMount.position.toArray(),
          rearviewRotation: [rearviewMount.rotation.x, rearviewMount.rotation.y, rearviewMount.rotation.z],
          rearviewScale: rearviewMount.scale.toArray(),
          acceleratorRotationZ: acceleratorOrientation.rotation.z,
          pedalsRotationZ: pedalsMount.rotation.z,
          shifterPosition: shifterAssembly.position.toArray(),
          shifterBaseRotationX: shifterBaseMesh.rotation.x,
          dashboardName: dashboard.name,
          shifterHasDeformableBoot: shifterMechanism.boot.name === 'FuelleCueroDeformable',
          shifterKnobPosition: shifterMechanism.knob.position.toArray(),
          bootTopSample: (() => {
            const attribute = shifterMechanism.boot.geometry.getAttribute('position');
            const index = Math.max(0, attribute.count - 29);
            return [attribute.getX(index), attribute.getY(index), attribute.getZ(index)];
          })(),
          gaugeNames: [gaugeCluster.speed.group.name, gaugeCluster.rpm.group.name],
        },
      };
    },
    getVisualEvidence() {
      const root = raceWorld.getFalconVisualRoot?.();
      const canvas = renderer.domElement;
      if (!root || !canvas) return Object.freeze({ visible: false, inFrustum: false, pixelRect: null, intersectionArea: 0 });
      root.updateWorldMatrix(true, true); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const projected = center.clone(); projected.project(camera);
      const rect = canvas.getBoundingClientRect();
      const pixelRect = Object.freeze({ x: rect.left + (projected.x + 1) * .5 * rect.width, y: rect.top + (1 - projected.y) * .5 * rect.height, width: Math.max(1, size.length() * rect.width / Math.max(1, center.distanceTo(camera.position))), height: Math.max(1, size.length() * rect.height / Math.max(1, center.distanceTo(camera.position))) });
      const left = Math.max(rect.left, pixelRect.x - pixelRect.width / 2), top = Math.max(rect.top, pixelRect.y - pixelRect.height / 2), right = Math.min(rect.right, pixelRect.x + pixelRect.width / 2), bottom = Math.min(rect.bottom, pixelRect.y + pixelRect.height / 2);
      const intersectionArea = Math.max(0, right - left) * Math.max(0, bottom - top);
      const targetWidth = Math.max(1, Math.min(320, Math.round(rect.width))); const targetHeight = Math.max(1, Math.min(200, Math.round(rect.height)));
      const target = new THREE.WebGLRenderTarget(targetWidth, targetHeight, { depthBuffer: true }); const withFalcon = new Uint8Array(targetWidth * targetHeight * 4); const withoutFalcon = new Uint8Array(targetWidth * targetHeight * 4);
      const priorTarget = renderer.getRenderTarget(); const priorVisible = root.visible; const priorOverride = scene.overrideMaterial; const priorAutoClear = renderer.autoClear; const visibility = []; const meshState = []; let pixelContribution = 0; let isolatedPixelContribution = 0; let unoccludedPixelContribution = 0;
      const countPixels = (first, second = null) => { let count = 0; for (let index = 0; index < first.length; index += 4) { const value = second ? Math.abs(first[index] - second[index]) + Math.abs(first[index + 1] - second[index + 1]) + Math.abs(first[index + 2] - second[index + 2]) : first[index] + first[index + 1] + first[index + 2]; if (value >= 24) count += 1; } return count; };
      let isolatedOverrideMaterial = null;
      try { renderer.autoClear = false; renderer.setRenderTarget(target); renderer.clear(true, true, true); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, targetWidth, targetHeight, withFalcon); root.visible = false; renderer.clear(true, true, true); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, targetWidth, targetHeight, withoutFalcon); pixelContribution = countPixels(withFalcon, withoutFalcon); const keep = new Set(); root.traverse(node => keep.add(node)); for (let ancestor = root.parent; ancestor; ancestor = ancestor.parent) keep.add(ancestor); scene.traverse(node => { visibility.push([node, node.visible]); if (!keep.has(node)) node.visible = false; }); root.traverse(node => { if (!node.isMesh) return; const materials = Array.isArray(node.material) ? node.material : [node.material]; meshState.push([node, node.frustumCulled, node.renderOrder, materials.map(material => [material, material.depthTest, material.depthWrite])]); node.frustumCulled = false; node.renderOrder = 999; for (const material of materials) { material.depthTest = false; material.depthWrite = false; } }); scene.overrideMaterial = isolatedOverrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); const isolatedPixels = new Uint8Array(targetWidth * targetHeight * 4); root.visible = true; renderer.clear(true, true, true); renderer.clearDepth(); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, targetWidth, targetHeight, isolatedPixels); isolatedPixelContribution = countPixels(isolatedPixels); for (const [node, visible] of visibility) node.visible = visible; scene.overrideMaterial = priorOverride; const unoccluded = new Uint8Array(targetWidth * targetHeight * 4); const noFalcon = new Uint8Array(targetWidth * targetHeight * 4); renderer.clear(true, true, true); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, targetWidth, targetHeight, unoccluded); root.visible = false; renderer.clear(true, true, true); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, targetWidth, targetHeight, noFalcon); unoccludedPixelContribution = countPixels(unoccluded, noFalcon); } finally { for (const [node, visible] of visibility) node.visible = visible; for (const [node, frustumCulled, renderOrder, materials] of meshState) { node.frustumCulled = frustumCulled; node.renderOrder = renderOrder; for (const [material, depthTest, depthWrite] of materials) { material.depthTest = depthTest; material.depthWrite = depthWrite; } } root.visible = priorVisible; scene.overrideMaterial = priorOverride; renderer.autoClear = priorAutoClear; renderer.setRenderTarget(priorTarget); target.dispose(); isolatedOverrideMaterial?.dispose(); }
      const projectedVertexStats=(()=>{const s={sampled:0,clipped:0,visible:0,minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity,localMinX:Infinity,localMaxX:-Infinity,localMinY:Infinity,localMaxY:-Infinity,localMinZ:Infinity,localMaxZ:-Infinity};const v=new THREE.Vector3(),p=new THREE.Vector3(),unique=new Set(),attributeStats=[];root.traverse(n=>{const a=n.isMesh?n.geometry?.getAttribute?.('position'):null;if(!a)return;attributeStats.push(Object.freeze({name:n.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,arrayType:a.array?.constructor?.name||null,indexCount:n.geometry?.index?.count||0,geometryBounds:n.geometry?.boundingBox?Object.freeze({min:Object.freeze(n.geometry.boundingBox.min.toArray()),max:Object.freeze(n.geometry.boundingBox.max.toArray())}):null}));const limit=Math.min(a.count,4096-s.sampled);for(let j=0;j<limit;j++){const i=a.count<=limit?j:Math.min(a.count-1,Math.floor((((j+1)*.6180339887498949)%1)*a.count));v.fromBufferAttribute(a,i);unique.add(v.x.toPrecision(9)+','+v.y.toPrecision(9)+','+v.z.toPrecision(9));s.localMinX=Math.min(s.localMinX,v.x);s.localMaxX=Math.max(s.localMaxX,v.x);s.localMinY=Math.min(s.localMinY,v.y);s.localMaxY=Math.max(s.localMaxY,v.y);s.localMinZ=Math.min(s.localMinZ,v.z);s.localMaxZ=Math.max(s.localMaxZ,v.z);v.applyMatrix4(n.matrixWorld);p.copy(v).project(camera);s.sampled++;s.minX=Math.min(s.minX,p.x);s.maxX=Math.max(s.maxX,p.x);s.minY=Math.min(s.minY,p.y);s.maxY=Math.max(s.maxY,p.y);s.minZ=Math.min(s.minZ,p.z);s.maxZ=Math.max(s.maxZ,p.z);if(p.x<-1||p.x>1||p.y<-1||p.y>1||p.z<-1||p.z>1)s.clipped++;else s.visible++}});return Object.freeze({sampled:s.sampled,clipped:s.clipped,visible:s.visible,sampleStrategy:'golden-ratio',uniqueLocalPositions:unique.size,localBounds:s.sampled?Object.freeze({minX:s.localMinX,maxX:s.localMaxX,minY:s.localMinY,maxY:s.localMaxY,minZ:s.localMinZ,maxZ:s.localMaxZ}):null,ndcBounds:s.sampled?Object.freeze({minX:s.minX,maxX:s.maxX,minY:s.minY,maxY:s.maxY,minZ:s.minZ,maxZ:s.maxZ}):null,attributeStats:Object.freeze(attributeStats)})})();
      const overlayScene=new THREE.Scene(),overlayTarget=new THREE.WebGLRenderTarget(targetWidth,targetHeight,{depthBuffer:true}),bright=new Uint8Array(targetWidth*targetHeight*4),blank=new Uint8Array(targetWidth*targetHeight*4),sentinel=new Uint8Array(targetWidth*targetHeight*4),sentinelScene=new THREE.Scene(),sentinelCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10),sentinelGeometry=new THREE.PlaneGeometry(2,2),sentinelMaterial=new THREE.MeshBasicMaterial({color:0xff00ff,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:false,opacity:1,toneMapped:false,fog:false}),sentinelMesh=new THREE.Mesh(sentinelGeometry,sentinelMaterial),priorTarget2=renderer.getRenderTarget(),priorAutoClear2=renderer.autoClear,priorViewport=new THREE.Vector4(),priorScissor=new THREE.Vector4(),priorScissorTest=renderer.getScissorTest(),overlays=[],overlaySources=[];renderer.getViewport(priorViewport);renderer.getScissor(priorScissor);let brightOverlayPixelContribution=0;
      let overlayRenderStats=Object.freeze({calls:0,triangles:0,targetIsCurrent:false,targetUuid:null,targetTextureUuid:null,children:0,sourceWorldMatrix:Object.freeze([]),overlayWorldMatrix:Object.freeze([]),worldMatrixMaxAbsDiff:null,bright:Object.freeze({nonzero:0,checksum:0}),blank:Object.freeze({nonzero:0,checksum:0}),diffPixels:0});let sentinelBufferStats=Object.freeze({calls:0,triangles:0,nonzero:0,checksum:0,targetIsCurrent:false});
      try{sentinelCamera.position.z=1;sentinelCamera.updateMatrixWorld();sentinelScene.add(sentinelMesh);root.traverse(n=>{if(!n.isMesh||!n.geometry)return;const o=new THREE.Mesh(n.geometry,new THREE.MeshBasicMaterial({color:0xff00ff,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:false,opacity:1,toneMapped:false,fog:false}));o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;o.matrixWorldNeedsUpdate=false;o.matrix.copy(n.matrixWorld);o.matrixWorld.copy(n.matrixWorld);o.layers.mask=camera.layers.mask;o.frustumCulled=false;overlayScene.add(o);overlays.push(o);overlaySources.push(n)});renderer.autoClear=false;renderer.setRenderTarget(overlayTarget);renderer.setScissorTest(false);renderer.clear(true,true,true);overlayScene.updateMatrixWorld(true);renderer.info.reset();renderer.render(overlayScene,camera);const overlayRenderCalls=renderer.info.render.calls,overlayRenderTriangles=renderer.info.render.triangles;renderer.readRenderTargetPixels(overlayTarget,0,0,targetWidth,targetHeight,bright);renderer.clear(true,true,true);renderer.readRenderTargetPixels(overlayTarget,0,0,targetWidth,targetHeight,blank);for(let i=0;i<bright.length;i+=4){if(Math.abs(bright[i]-blank[i])+Math.abs(bright[i+1]-blank[i+1])+Math.abs(bright[i+2]-blank[i+2])>=24)brightOverlayPixelContribution++}const sourceWorldMatrix=overlaySources[0]?.matrixWorld.toArray()||[],overlayWorldMatrix=overlays[0]?.matrixWorld.toArray()||[],worldMatrixMaxAbsDiff=sourceWorldMatrix.length===overlayWorldMatrix.length?sourceWorldMatrix.reduce((max,value,index)=>Math.max(max,Math.abs(value-overlayWorldMatrix[index])),0):null;overlayRenderStats=Object.freeze({calls:overlayRenderCalls,triangles:overlayRenderTriangles,targetIsCurrent:renderer.getRenderTarget()===overlayTarget,targetUuid:overlayTarget.uuid,targetTextureUuid:overlayTarget.texture.uuid,children:overlayScene.children.length,sourceName:overlaySources[0]?.name||null,sourceWorldMatrix:Object.freeze(sourceWorldMatrix),overlayWorldMatrix:Object.freeze(overlayWorldMatrix),worldMatrixMaxAbsDiff,bright:Object.freeze({nonzero:bright.reduce((count,value)=>count+(value?1:0),0),checksum:bright.reduce((sum,value)=>(sum+value)>>>0,0)}),blank:Object.freeze({nonzero:blank.reduce((count,value)=>count+(value?1:0),0),checksum:blank.reduce((sum,value)=>(sum+value)>>>0,0)}),diffPixels:brightOverlayPixelContribution,glError:renderer.getContext().getError()});renderer.clear(true,true,true);renderer.info.reset();renderer.render(sentinelScene,sentinelCamera);const sentinelCalls=renderer.info.render.calls,sentinelTriangles=renderer.info.render.triangles;renderer.readRenderTargetPixels(overlayTarget,0,0,targetWidth,targetHeight,sentinel);sentinelBufferStats=Object.freeze({calls:sentinelCalls,triangles:sentinelTriangles,nonzero:sentinel.reduce((count,value)=>count+(value?1:0),0),checksum:sentinel.reduce((sum,value)=>(sum+value)>>>0,0),targetIsCurrent:renderer.getRenderTarget()===overlayTarget,glError:renderer.getContext().getError()})}finally{renderer.autoClear=priorAutoClear2;renderer.setRenderTarget(priorTarget2);renderer.setViewport(priorViewport);renderer.setScissor(priorScissor);renderer.setScissorTest(priorScissorTest);for(const o of overlays)o.material.dispose();sentinelGeometry.dispose();sentinelMaterial.dispose();overlayTarget.dispose()}
      const originalMaterialOverlayAfterClearDepth=isolatedPixelContribution;
      const renderBufferStats = Object.freeze({ visible: Object.freeze({ nonzero: withFalcon.reduce((count, value) => count + (value ? 1 : 0), 0), checksum: withFalcon.reduce((sum, value) => (sum + value) >>> 0, 0) }), hidden: Object.freeze({ nonzero: withoutFalcon.reduce((count, value) => count + (value ? 1 : 0), 0), checksum: withoutFalcon.reduce((sum, value) => (sum + value) >>> 0, 0) }), diffPixels: pixelContribution, target: Object.freeze({ width: targetWidth, height: targetHeight, format: target.texture.format, type: target.texture.type }), camera: Object.freeze({ near: camera.near, far: camera.far }) });
      const centerInFrustum = projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1 && projected.z >= -1 && projected.z <= 1;
      const geometryInFrustum = projectedVertexStats.visible > 0;
      return Object.freeze({ name: root.name, visible: root.visible, inFrustum: geometryInFrustum || centerInFrustum, pixelRect, intersectionArea, pixelContribution, renderBufferStats, isolatedPixelContribution, unoccludedPixelContribution, originalMaterialOverlayAfterClearDepth, brightOverlayPixelContribution, projectedVertexStats, overlayRenderStats, sentinelBufferStats, rendered: pixelContribution >= 24, canvas: Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }) });
    },
    setGear,
    setSettings(settings = {}) {
      gameSettings = normalizeGameSettings({ ...gameSettings, ...settings });
      applySettings();
      if (gameSettings.soundEnabled && settings.soundEnabled === true) void ensureAudioStarted();
      return this.getState();
    },
    setTransmissionMode(mode) {
      changeTransmissionMode(mode);
      return this.getState();
    },
    startAudio() {
      return ensureAudioStarted();
    },
    setEditorMode(enabled) {
      compositionEditor?.setActive(enabled);
      return this.getState();
    },
    selectEditorElement(id) {
      compositionEditor?.select(id);
      return this.getState();
    },
    setElementTransform(id, transform, options = {}) {
      if (id === 'cockpit-camera') throw new TypeError('cockpit-camera requires setCockpitCameraCalibration');
      compositionEditor?.setTransform(id, transform, options);
      return this.getState();
    },
    setTargetState(id, state, options = {}) {
      compositionEditor?.setTargetState(id, state, options);
      return this.getState();
    },
    setCockpitCameraCalibration(state) {
      compositionState.setCockpitCalibration(state);
      rememberCockpitCalibration(compositionState.getState().camera.cockpit);
      compositionEditor?.setCockpitCameraCalibration(compositionState.getState().camera.cockpit);
      return this.getState();
    },
    saveLayout() {
      compositionEditor?.save();
      return this.getState();
    },
    resetLayout() {
      compositionEditor?.resetAll();
      return this.getState();
    },
    setFrontCut(percent) {
      frontCutController.setPercent(percent);
      return this.getState();
    },
    resetFrontCut() {
      frontCutController.reset();
      return this.getState();
    },
    setBackground(settings = {}) {
      backgroundEditor.setState(settings);
      return this.getState();
    },
    resetBackground() {
      backgroundEditor.resetToDefault();
      return this.getState();
    },
    setControls(controls = {}) {
      if ('steer' in controls) debugControls.steer = controls.steer == null ? null : clamp(Number(controls.steer), -1, 1);
      if ('throttle' in controls) debugControls.throttle = controls.throttle == null ? null : clamp(Number(controls.throttle), 0, 1);
      if ('brake' in controls) debugControls.brake = controls.brake == null ? null : clamp(Number(controls.brake), 0, 1);
      updateKeyUi();
      return this.getState();
    },
    clearControls() {
      debugControls.steer = null;
      debugControls.throttle = null;
      debugControls.brake = null;
      updateKeyUi();
    },
    advance(seconds) {
      advanceSimulation(seconds);
      applyMechanicalVisuals();
      renderFrame();
      return this.getState();
    },
    setRendering(enabled) {
      if(enabled&&frameFailureBoundary.diagnostics().fault)recoverDrivingFrame();
      renderingEnabled = !!enabled;
      clock.getDelta();
      return renderingEnabled;
    },
    isRendering() {
      return renderingEnabled;
    },
    render() {
      applyMechanicalVisuals();
      renderFrame();
    },
    prepareRacePresentation() {
      raceWorld.update(0,{throttle:0,brake:0,steer:0});updateRaceCamera(1);applyMechanicalVisuals();renderFrame();
      return {status:raceWorld.getState().status,trackId:raceWorld.track.id,physicalTime:raceWorld.getRenderFrame().currentSnapshot?.timeSeconds};
    },
    runtimeFailureDiagnostics:()=>frameFailureBoundary.diagnostics(),
    raceStart(options={}) {
      options.signal?.throwIfAborted();
      if(frameFailureBoundary.diagnostics().fault)recoverDrivingFrame();
      return raceWorld.start(options);
    },
    racePause() {
      return raceWorld.togglePause();
    },
    raceRecover() {
      return raceWorld.recover();
    },
    raceSelectCircuit(id, options) {
      return raceWorld.selectCircuit(id, options);
    },
    raceSetSettings(settings = {}) {
      return raceWorld.setSettings(settings);
    },
    raceGetState() {
      return raceWorld.getState();
    },
    raceCameraMode() {
      return raceCameraState.current;
    },
    raceSetCamera(mode) {
      return setRaceCameraMode(mode);
    },
    raceNextCamera() {
      return cycleRaceCamera();
    },
    raceWorld,
    refreshAudioGate() { engineSound.applySettings(); },
    openCockpitSettings: (open)=>{setSettingsPanelOpen(open);if(open&&runtimeDeviceProfile.phone){bootRenderGate.release();resize();}},
    mirrorDiagnostics: () => cockpitMirrors.diagnostics(),
    ignitionDiagnostics: () => cockpitIgnition.diagnostics(),
    lightSwitchDiagnostics:()=>cockpitLightSwitch?.diagnostics(),
    setDrivingLights:(kind,value)=>raceWorld.setDrivingLights(kind,value),
    interiorDiagnostics:()=>({controls:raceChevyPresentation?.getInteriorDiagnostics?.(),equipment:authoredControlMounts?.diagnostics()}),
    paintDiagnostics: () => racePaint.diagnostics(),
    raceTrack() { return raceWorld.track; },
  };
  window.dispatchEvent(new CustomEvent('chevy-v6-runtime-ready'));
  const asfaltoV6DiagnosticsApi = {};
  Object.defineProperties(asfaltoV6DiagnosticsApi, {
    trackId: {
      enumerable: true,
      get: () => globalThis.__asfaltoV6Modular?.trackManager?.active?.id || raceWorld.track?.id || null,
    },
    environment: {
      enumerable: true,
      get: () => {
        const diagnostics = raceWorld.getEnvironmentDiagnostics();
        return Object.freeze({
          presetId: diagnostics.regionalEnvironment?.presetId || null,
          state: diagnostics.environmentState,
          skyId: diagnostics.regionalEnvironment?.skyId || null,
          surfaceState: diagnostics.regionalEnvironment?.surfaceState || null,
          source: diagnostics.environmentCache?.source || null,
        });
      },
    },
    errors: {
      enumerable: true,
      get: () => Object.freeze([...raceWorld.getEnvironmentDiagnostics().environmentErrors]),
    },
    performance: {
      enumerable: true,
      get: () => raceWorld.getPerformanceDiagnostics(),
    },
    lifetime: {
      enumerable: true,
      get: () => raceWorld.getResourceLifetimeDiagnostics(),
    },
    driving: {
      enumerable: true,
      get: () => raceWorld.getV6Diagnostics().driving,
    },
    renderBridge: {
      enumerable: true,
      get: () => raceWorld.getV6Diagnostics().renderBridge,
    },
    camera: {
      enumerable: true,
      get: () => vehicleCameraRig?.diagnostics?.() || Object.freeze({
        initialized: false,
        lastOutput: null,
        mode: raceCameraState.current,
        trace: Object.freeze([]),
      }),
    },
    interactions: {
      enumerable: true,
      get: () => interactionTargetDiagnostics(),
    },
  });
  Object.defineProperty(globalThis, '__ASFALTO_V6_DIAGNOSTICS__', {
    configurable: true,
    enumerable: false,
    value: Object.freeze(asfaltoV6DiagnosticsApi),
    writable: false,
  });
  const asfaltoV5QaEnabled = new URLSearchParams(globalThis.location.search).get('qa') === '1';
  const asfaltoV5Catalog = Object.freeze(Object.values(raceWorld.circuits).map(circuit => Object.freeze({
    id: circuit.id,
    status: circuit.available ? 'ready' : 'coming_soon',
  })));
  function readAsfaltoV5Diagnostics() {
    const raceState = raceWorld.getState();
    return Object.freeze({
      version: '5.0.0',
      sourceVersion: '4.1.1',
      ...raceWorld.getAuthoredSceneDiagnostics(),
      sectorCount: raceWorld.track.checkpoints.length,
      radioReady: globalThis.__asfaltoNacionalV41?.radio?.ready === true,
      raceReady: globalThis.__cockpit?.ready === true && typeof raceWorld.update === 'function',
      catalog: asfaltoV5Catalog,
      camera: globalThis.__cockpit?.raceCameraMode?.() ?? null,
      raceStatus: raceState.status,
      raceProgress: raceState.raceProgress,
      completedPasses: raceState.completedLaps,
      recoveryCount: raceState.events.filter(event => event.type === 'recover').length,
      cockpitComposition: Object.freeze({ cameraFov: camera.fov, cockpitVisible: cockpit.visible, cockpitScale: Object.freeze(cockpit.scale.toArray()), cockpitPosition: Object.freeze(cockpit.position.toArray()), rearviewScale: Object.freeze(rearviewMount.scale.toArray()), rearviewPosition: Object.freeze(rearviewMount.position.toArray()) }),
    });
  }
  const initialAuthoredDiagnostics = readAsfaltoV5Diagnostics();
  if (!initialAuthoredDiagnostics.ready) throw new Error('Asfalto v5 authored scene no está instalada');
  if (initialAuthoredDiagnostics.legacyTracksEnabled) throw new Error('Asfalto v5 authored scene did not disable legacy track layers');
  const asfaltoV5Api = {
    version: '5.0.0',
    sourceVersion: '4.1.1',
    get ready() { return raceWorld.getAuthoredSceneDiagnostics().ready; },
    get circuit() { return raceWorld.getAuthoredSceneDiagnostics().circuit; },
    get routeLength() { return raceWorld.getAuthoredSceneDiagnostics().routeLength; },
    get visualMeshes() { return raceWorld.getAuthoredSceneDiagnostics().visualMeshes; },
    get collisionMeshes() { return raceWorld.getAuthoredSceneDiagnostics().collisionMeshes; },
    get legacyTracksEnabled() { return raceWorld.getAuthoredSceneDiagnostics().legacyTracksEnabled; },
    get routeOrigin() { return raceWorld.getAuthoredSceneDiagnostics().routeOrigin; },
    get collisionProbe() { return raceWorld.getAuthoredSceneDiagnostics().collisionProbe; },
    get environmentPreset() { return raceWorld.getEnvironmentDiagnostics().environmentPreset; },
    get environmentSource() { return raceWorld.getEnvironmentDiagnostics().environmentSource; },
    get pmremActive() { return raceWorld.getEnvironmentDiagnostics().pmremActive; },
    get environmentKeyLight() { return raceWorld.getEnvironmentDiagnostics().environmentKeyLight; },
    get environmentExposure() { return raceWorld.getEnvironmentDiagnostics().environmentExposure; },
    get headlights() { return raceWorld.getEnvironmentDiagnostics().headlights; },
    get artificialLights() { return raceWorld.getEnvironmentDiagnostics().artificialLights; },
    get precipitation() { return raceWorld.getEnvironmentDiagnostics().precipitation; },
    get roadWetness() { return raceWorld.getEnvironmentDiagnostics().roadWetness; },
    get wetMaterials() { return raceWorld.getEnvironmentDiagnostics().wetMaterials; },
    get environmentCache() { return raceWorld.getEnvironmentDiagnostics().environmentCache; },
    get environmentRequests() { return raceWorld.getEnvironmentDiagnostics().environmentRequests; },
    get environmentResources() { return raceWorld.getEnvironmentDiagnostics().environmentResources; },
    get environmentDisposals() { return raceWorld.getEnvironmentDiagnostics().environmentDisposals; },
    getDiagnostics() { return readAsfaltoV5Diagnostics(); },
    applyWorkshopEnvironment(state, runtime) { return raceWorld.applyWorkshopEnvironment(state, runtime); },
    setDayCycleOptions(options) { return raceWorld.setDayCycleOptions(options); },
    getDayCycleDiagnostics() { return raceWorld.getDayCycleDiagnostics(); },
  };
  if (asfaltoV5QaEnabled) {
    asfaltoV5Api.debugSetRaceState = candidate => raceWorld.debugSetRaceState(candidate);
    asfaltoV5Api.debugDrivePhysicalRoute = options => raceWorld.debugDrivePhysicalRoute(options);
    asfaltoV5Api.debugTeleportPhysicalVehicle = options => raceWorld.debugTeleportPhysicalVehicle(options);
  }
  modularHostInitialization.assertActive();
  globalThis.__asfaltoNacionalV5 = Object.freeze(asfaltoV5Api);

  function setGear(target) {
    requestGear(target, 'debug');
    return window.__cockpit.getState();
  }

  stopDrivingFrame=getFrameScheduler().subscribe('driving',animate,{enabled:()=>!modularRuntimeShutdown&&document.body.classList.contains('v6-driving')&&!document.body.classList.contains('an-race-paused')});
  });
} catch (error) {
  runtimeEvents.dispose();
  try { const cleanup=bootFailureDisposer();await (cleanup?.promise||cleanup); } catch (disposeError) { console.error(disposeError); }
  modularHostInitialization?.fail(error);
  // A post-mount boot failure must also unload the selected track roots/physics.
  void globalThis.__asfaltoV6Modular?.shutdown?.().catch(cleanupError => console.error(cleanupError));
  if (!modularHostInitialization?.signal?.aborted) {
  window.__chevyThreeLoadError = error;
  window.dispatchEvent(new CustomEvent('chevy-three-error', { detail: error }));
  console.error(error);
  loadingEl.classList.add('hidden');
  errorEl.hidden = false;
  errorEl.textContent = `No se pudo iniciar el cockpit: ${error?.message || error}`;
  window.__cockpit = { ready: false, error: String(error?.stack || error) };
  }
}
