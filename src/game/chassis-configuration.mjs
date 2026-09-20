/** Shared saved workshop setup. All physical changes are derived from an immutable vehicle specification. */
export const DEFAULT_CHASSIS_CONFIG = Object.freeze({ schema: 1, rim: 0, tire: 0, kit: 0,
  frontPressure: 29, rearPressure: 31, brakeBias: 60, steerRatio: 19, steeringAssist: false, abs: false });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ranges = Object.freeze({ rim: [0, 3], tire: [0, 3], kit: [0, 3], frontPressure: [24, 38],
  rearPressure: [24, 40], brakeBias: [52, 68], steerRatio: [14, 22] });
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function sanitizeChassisConfig(value, base = DEFAULT_CHASSIS_CONFIG) {
  const source = object(value), fallback = object(base), result = { schema: 1 };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const supplied = Number.isFinite(source[key]) ? source[key]
      : Number.isFinite(fallback[key]) ? fallback[key] : DEFAULT_CHASSIS_CONFIG[key];
    result[key] = clamp(['rim', 'tire', 'kit'].includes(key) ? Math.round(supplied) : supplied, min, max);
  }
  result.rim = Math.max(result.rim, result.kit);
  for (const key of ['steeringAssist', 'abs']) result[key] = typeof source[key] === 'boolean' ? source[key]
    : typeof fallback[key] === 'boolean' ? fallback[key] : DEFAULT_CHASSIS_CONFIG[key];
  return result;
}
export function chassisConfigFromProfile(profile) {
  const source = object(profile), tuning = object(source.tuning), parts = object(source.parts), appearance = object(source.appearance);
  const legacy = { ...tuning, rim: { steel: 0, sport73: 1, period: 1, restomod: 2 }[appearance.wheel] ?? 0,
    tire: { bias: 0, radial: 1, modern: 2 }[appearance.tire] ?? 0,
    kit: parts.brakes === 'restomod' ? 1 : 0, steeringAssist: parts.steering === 'restomod', abs: source.assists?.abs === true };
  return sanitizeChassisConfig(source.chassis, sanitizeChassisConfig(legacy));
}
export function chassisProfilePatch(value) {
  const chassis = sanitizeChassisConfig(value);
  return { chassis, appearance: { wheel: ['steel', 'sport73', 'restomod', 'restomod'][chassis.rim],
    tire: ['bias', 'radial', 'modern', 'modern'][chassis.tire] },
    parts: { brakes: chassis.kit > 0 ? 'restomod' : 'original', steering: chassis.steeringAssist ? 'restomod' : 'original' },
    tuning: { frontPressure: chassis.frontPressure, rearPressure: chassis.rearPressure,
      brakeBias: chassis.brakeBias, steerRatio: chassis.steerRatio } };
}

// Relative compound and brake geometry coefficients from the supplied laboratory.
// They tune the existing four-wheel solver; the laboratory's separate dynamics are not used here.
const compounds = Object.freeze([.88, 1.05, 1.18, .96]);
const wetPenalties = Object.freeze([1, .95, .61, 1.12]);
const gravelPenalties = Object.freeze([1, .94, .70, 1.16]);
const radii = Object.freeze([.3303, .336, .340, .333]);
const widths = Object.freeze([.236, .245, .255, .225]);
const kits = Object.freeze([
  { radius: .135, piston: .048, friction: .38, frontMass: 6, rearMass: 5.5, cooling: 15, fade: 330 },
  { radius: .150, piston: .052, friction: .40, frontMass: 7.5, rearMass: 6, cooling: 22, fade: 400 },
  { radius: .160, piston: .055, friction: .43, frontMass: 8, rearMass: 6.8, cooling: 26, fade: 480 },
  { radius: .175, piston: .058, friction: .46, frontMass: 9, rearMass: 7.5, cooling: 32, fade: 600 },
]);
export function chassisGripScale(value, environment = {}, axle = 'front') {
  if (!value) return 1;
  const config = sanitizeChassisConfig(value), pressure = axle === 'rear' ? config.rearPressure : config.frontPressure;
  const originalPressure = axle === 'rear' ? 31 : 29;
  const wetness = clamp(Number.isFinite(environment.wetness) ? environment.wetness
    : environment.surface === 'wet' || environment.waterDepthM > 0 ? 1 : 0, 0, 1);
  const loose = ['gravel', 'grass', 'dirt', 'sand', 'mud'].includes(environment.surface) || environment.surfaceState === 'dust';
  return compounds[config.tire] / compounds[0]
    * (loose ? gravelPenalties[config.tire] : 1 + (wetPenalties[config.tire] - 1) * wetness)
    * Math.exp(-Math.pow((pressure - originalPressure) / 30, 2));
}
export function chassisWheelInertia(value) {
  if (!value) return 1.8;
  const config = sanitizeChassisConfig(value);
  return 1.8 * (1 + config.rim * .04 + config.kit * .015) * (radii[config.tire] / radii[0]) ** 2;
}
export function chassisCoolingScale(value) { return value ? kits[sanitizeChassisConfig(value).kit].cooling / kits[0].cooling : 1; }
export function chassisVehicleSpec(baseSpec, value) {
  if (!value) return baseSpec;
  const config = sanitizeChassisConfig(value), kit = kits[config.kit], standard = kits[0];
  const torqueScale = (kit.piston / standard.piston) ** 2 * kit.friction / standard.friction * kit.radius / standard.radius;
  const tire = { ...baseSpec.tires, widthM: widths[config.tire],
    dryMu: baseSpec.tires.dryMu * compounds[config.tire] / compounds[0] };
  for (const axle of ['front', 'rear']) {
    const pressureScale = config[`${axle}Pressure`] / DEFAULT_CHASSIS_CONFIG[`${axle}Pressure`];
    tire[`${axle}CorneringStiffnessNprad`] = baseSpec.tires[`${axle}CorneringStiffnessNprad`] * Math.sqrt(pressureScale);
    tire[`${axle}LongitudinalStiffnessN`] = baseSpec.tires[`${axle}LongitudinalStiffnessN`] * Math.sqrt(pressureScale);
    tire[`${axle}RelaxationLengthM`] = baseSpec.tires[`${axle}RelaxationLengthM`] / pressureScale;
  }
  return { ...baseSpec, wheelRadiusM: baseSpec.wheelRadiusM * radii[config.tire] / radii[0], tires: tire,
    steering: { ...baseSpec.steering, ratio: config.steerRatio },
    assists: { ...baseSpec.assists, steering: config.steeringAssist, abs: config.abs },
    brakes: { ...baseSpec.brakes, frontBias: config.brakeBias / 100,
      masterTorqueNm: baseSpec.brakes.masterTorqueNm * torqueScale,
      frontFadeStartC: baseSpec.brakes.frontFadeStartC + kit.fade - standard.fade,
      rearFadeStartC: baseSpec.brakes.rearFadeStartC + kit.fade - standard.fade,
      frontHeatCapacityJpC: baseSpec.brakes.frontHeatCapacityJpC * kit.frontMass / standard.frontMass,
      rearHeatCapacityJpC: baseSpec.brakes.rearHeatCapacityJpC * kit.rearMass / standard.rearMass } };
}
