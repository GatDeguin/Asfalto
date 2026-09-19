import { metalContactEmission } from './weather-dynamics.mjs';
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value) || 0));
export const WEATHER_EFFECTS_TIERS = Object.freeze({
  cinematic:Object.freeze({ rain:3200, snow:1600, clouds:16, mist:9, particles:560, transmission:.22 }),
  low:Object.freeze({ rain:650, snow:400, clouds:6, mist:3, particles:160, transmission:0 }),
  balanced:Object.freeze({ rain:1700, snow:950, clouds:10, mist:6, particles:320, transmission:.12 }),
  high:Object.freeze({ rain:3200, snow:1600, clouds:16, mist:9, particles:560, transmission:.22 }),
});
export function weatherEffectsPolicy(environment = {}, quality = 'balanced') {
  const tier = WEATHER_EFFECTS_TIERS[quality] || WEATHER_EFFECTS_TIERS.balanced;
  const type = environment.precipitation || 'none';
  const heavySnow = type === 'heavy-snow';
  const snow = type === 'light-snow' || heavySnow;
  const rainy = type === 'rain' || type === 'storm';
  const intensity = rainy || snow ? clamp(environment.precipitationIntensity ?? (heavySnow ? 1 : snow ? .35 : type === 'storm' ? 1 : .65), 0, 1) : 0;
  const weather = environment.weatherId || environment.weather || (type === 'none' ? 'clear' : type);
  const clouds = environment.weatherCycle?.clouds ?? (heavySnow ? .75 : weather === 'storm' ? .7 : weather === 'rain' || snow ? .5 : weather === 'cloudy' ? .45 : weather === 'fog' ? .24 : .07);
  return { tier, snow, heavySnow, snowIntensity:snow ? intensity : 0, rainy, intensity, precipitationCount:Math.round((snow ? tier.snow : tier.rain) * intensity),
    wetness:clamp(environment.roadWetness ?? environment.wetness ?? (rainy ? .7 : 0),0,1), clouds,
    mist:environment.weatherCycle?.mist ?? (heavySnow ? .36 : weather === 'fog' ? .42 : weather === 'storm' ? .23 : weather === 'rain' ? .1 : snow ? .12 : 0),
    wind:environment.weatherCycle?.wind ?? (heavySnow ? 6.5 : weather === 'storm' ? 7 : weather === 'rain' ? 3.5 : snow ? 1.8 : 1.2),
    opticalFogDensity:environment.weatherCycle?.opticalFogDensity ?? (heavySnow ? .006 : weather === 'fog' ? .0075 : weather === 'storm' ? .0028 : weather === 'rain' ? .0013 : snow ? .002 : weather === 'cloudy' ? .0007 : null),
  };
}
export function createVehicleEmissionState() {
  let throttle = 0, collisionCount = 0, hadImpact = false, hadMetal = false, cooldown = 0;
  return {
    update(value = {}) {
      const dt = clamp(value.dt,0,.05), speed = Math.abs(Number(value.speedMps) || 0), wet = clamp(value.wetness,0,1);
      cooldown = Math.max(0,cooldown-dt);
      const nextThrottle = clamp(value.throttle,0,1);
      const engineDamage = value.engineDamage || {};
      const engineFire = value.engineFire === true || engineDamage.fire === true
        ? clamp(engineDamage.fireIntensity ?? value.engineFireIntensity ?? 1, .15, 1) : 0;
      const engineSmoke = Math.max(clamp((Number(value.engineTemperatureC)-112)/45,0,.75),
        engineFire ? .45 + engineFire * .55 : 0,
        Number(value.rpm)>500 ? clamp((.75-Number(engineDamage.coolingCondition ?? 1))*.8,0,.45) : 0);
      const overrunPop = value.rpm > 3100 && throttle > .62 && nextThrottle < .12 && speed > 5 && value.popsLevel > 0 && cooldown <= 0;
      const fire = value.exhaustPop > 0 ? clamp(value.exhaustPop,0,1) : overrunPop ? clamp(value.popsLevel*.45,.04,.25) : 0;
      if (fire) cooldown = .5;
      const count = Math.max(0,Number(value.collisionCount) || 0);
      const impactEdge = value.impact && (!hadImpact || count > collisionCount);
      const metalStrength=metalContactEmission(value.metalContact);
      const sparks=metalStrength>0&&(!hadMetal||impactEdge)?metalStrength:0;hadMetal=metalStrength>0;
      collisionCount = count; hadImpact = !!value.impact; throttle = nextThrottle;
      return { fire, sparks,
        spray:wet > .15 && speed > 2 ? clamp((speed-2)/35,0,1)*wet : 0,
        dust:['gravel','dirt','grass','shoulder','sand'].includes(value.surface) && speed > 3 && wet < .4 ? clamp((speed-3)/24,0,1)*(1-wet*2.5) : 0,
        tireSmoke:wet < .25 && speed > 5 ? clamp((Number(value.slip)-.28)*1.8,0,.7) : 0,
        engineSmoke, engineFire,
      };
    },
    reset() { throttle=0;collisionCount=0;hadImpact=false;hadMetal=false;cooldown=0; },
  };
}
