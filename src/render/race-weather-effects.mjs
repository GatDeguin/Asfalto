import { createRoadWetnessField } from './weather-road-wetness.mjs';
import { createRivalWeatherParticles } from './weather-rival-particles.mjs?v=balance-20260917';
import { createWaterfallEffects } from './weather-waterfalls.mjs';
import { createRaceAcousticWorld } from '../audio/race-acoustic-world.mjs';
import { weatherEffectsPolicy, createVehicleEmissionState } from './weather-effects-policy.mjs';
import { createWeatherLayers } from './weather-layers.mjs';
import { createWeatherSurfaceController } from './weather-surfaces.mjs?v=balance-20260917';
import { createVehicleWeatherParticles } from './vehicle-weather-particles.mjs?v=balance-20260917';
import { createSkyMatchedFog } from './sky-matched-fog.mjs';
import { createWeatherDynamics } from './weather-dynamics.mjs';
import { createWeatherWind } from './weather-wind.mjs';
import { createWeatherLightning } from './weather-lightning.mjs';
import { createWeatherWindshield } from './weather-windshield.mjs?v=balance-20260917';
import { createVehicleRainSurfaces } from './weather-vehicle-surface.mjs';

/** Visual-only effects in the live renderer's metre-scale scene coordinates. */
export function createRaceWeatherEffects({THREE,scene,camera,renderer,qualityTier='balanced',onThunder}={}) {
  if(!THREE?.Group||!scene?.add||!camera)throw new TypeError('THREE, scene and camera are required');
  const root=new THREE.Group();root.name='AsfaltoRaceWeatherEffects';scene.add(root);
  const roadWetness=createRoadWetnessField(THREE),rivalEffects=createRivalWeatherParticles(THREE,root);
  const layers=createWeatherLayers(THREE,root),surfaces=createWeatherSurfaceController(THREE,{roadWetness}),particles=createVehicleWeatherParticles(THREE,root),emissions=createVehicleEmissionState();
  const velocity=new THREE.Vector3(),position=new THREE.Vector3(),fogAlignment=createSkyMatchedFog({THREE,scene,renderer});
  const acoustics=createRaceAcousticWorld(THREE),waterfalls=createWaterfallEffects(THREE,root);
  const dynamics=createWeatherDynamics(),wind=createWeatherWind(THREE),lightning=createWeatherLightning(THREE,root,event=>onThunder?.(event));
  let windshield=null,trackRoot=null,trackChildren=[];
  const bodyRain=createVehicleRainSurfaces(THREE);let bodyRoots=[];
  const soundscape={windMps:wind.uniforms.uAnWindVector.value,rainIntensity:0,wetness:0,water:null,trackId:null,active:false};
  let disposed=false,time=0,updates=0,trackId=null,environment={},policy=weatherEffectsPolicy({},qualityTier),active=true;
  const smooth={clouds:policy.clouds,mist:0,intensity:0};
  function setTrack({id,trackId:nextId,visualRoot,materialBindings=[]}={}) {
    if(disposed)return false;
    waterfalls.clear();rivalEffects.clear();wind.clear();roadWetness.bind(visualRoot);surfaces.setTrack({visualRoot,materialBindings});trackRoot=visualRoot||null;trackChildren=visualRoot?[...visualRoot.children]:[];wind.bind(visualRoot);if(!visualRoot)fogAlignment.restore();trackId=id||nextId||null;acoustics.bind(visualRoot,trackId);waterfalls.setTrack({visualRoot});particles.reset();emissions.reset();dynamics.reset();lightning.reset();return true;
  }
  function update(options={}) {
    if(disposed)return;
    if(options.active!==undefined)active=!!options.active;root.visible=active;soundscape.active=active&&!options.paused;if(!active){fogAlignment.restore();windshield?.update({active:false});return;}
    camera=options.camera||camera;
    if(options.qualityTier)qualityTier=options.qualityTier;
    if(options.environment)environment=options.environment;
    const target=weatherEffectsPolicy(environment,qualityTier);
    const dt=options.paused?0:Math.max(0,Math.min(.05,Number(options.dt)||0));time+=dt;updates++;
    const blend=1-Math.exp(-dt*3);for(const key of ['clouds','mist','intensity'])smooth[key]+=(target[key]-smooth[key])*blend;
    policy={...target,clouds:smooth.clouds,mist:smooth.mist,intensity:smooth.intensity,precipitationCount:target.precipitationCount?Math.round(target.precipitationCount*smooth.intensity/Math.max(.001,target.intensity)):0};
    dynamics.update({dt,environment,wetness:target.wetness,rain:target.rainy?policy.intensity:0,snow:target.snow?target.intensity:0});policy.wetness=dynamics.state.wetness;
    wind.update({dt,time,environment,speed:policy.wind});
    fogAlignment.update(policy,environment);
    const vehicle=options.vehicle||{},rivals=rivalEffects.prepare(options.rivals||[]),vehiclePolicy={...policy,tier:{...policy.tier,particles:Math.max(1,Math.floor(policy.tier.particles/(1+rivals.length)))}};
    roadWetness.update({dt,vehicle,rivals,wetness:policy.wetness,qualityTier});
    if(vehicle.visualRoot&&!bodyRoots.includes(vehicle.visualRoot)){bodyRoots=[vehicle.visualRoot,...bodyRoots.filter(root=>root.userData?.asfaltoCockpitRain)];bodyRain.bind(bodyRoots);}
    bodyRain.update({time,rain:policy.rainy?policy.intensity:0,wetness:policy.wetness});
    soundscape.rainIntensity=policy.rainy?policy.intensity:0;soundscape.wetness=policy.wetness;soundscape.water=surfaces.waterAudioAt(vehicle.position);soundscape.trackId=trackId;const acoustic=acoustics.sample(vehicle.position,vehicle.quaternion);soundscape.waterfall=acoustic.waterfall;soundscape.forest=acoustic.forest;soundscape.night=['night','moonrise'].includes(environment.skyId);
    const speed=Number(vehicle.speedMps)||0;
    velocity.copy(vehicle.velocity||position.set(0,0,-speed));
    const windVector=wind.uniforms.uAnWindVector.value;
    layers.update({time,camera,policy,velocity,groundY:vehicle.groundY??vehicle.position?.y??0,color:scene.fog?.color||'#c1d0d5',wind:windVector,vehicle,valleyFloorM:trackRoot?.userData.asfaltoWeather?.valleyFloorM});
    waterfalls.update({time,camera,wind:windVector,qualityTier,color:scene.fog?.color,vehicle});
    surfaces.update({time,policy,skyFog:fogAlignment.shaderState,wind:windVector,dynamics:dynamics.state});
    windshield?.update({dt,rain:policy.rainy?policy.intensity:0,speedMps:speed,cameraMode:options.cameraMode||vehicle.cameraMode||'chase',paused:options.paused,active,wiperMode:options.wiperMode||'auto'});
    lightning.update({dt,storm:(environment.weatherId||environment.weather||environment.precipitation)==='storm',position:vehicle.position});
    rivalEffects.update({dt,policy:vehiclePolicy,wind:windVector});
    if(dt>0){const emission=emissions.update({...vehicle,dt,wetness:policy.wetness});particles.update({dt,vehicle,emission,policy:vehiclePolicy,velocity,wind:windVector});}
  }
  return{setTrack,update,
    renderWaterReflections(options){if(disposed||!active)return false;return surfaces.renderReflections({...options,excludeRoots:[root,...(options.excludeRoots||[])],prepareRender:options=>fogAlignment.prepareRender(options)});},
    refreshTrack(options){if(disposed||!trackRoot||trackRoot.children.length===trackChildren.length&&trackChildren.every((child,i)=>trackRoot.children[i]===child))return false;waterfalls.clear();wind.clear();const changed=surfaces.refresh(options);wind.bind(trackRoot);roadWetness.bind(trackRoot);acoustics.bind(trackRoot,trackId);waterfalls.setTrack({visualRoot:trackRoot});trackChildren=[...trackRoot.children];return changed;},
    attachWindshield(options){windshield?.dispose();windshield=options?.cabinMount?createWeatherWindshield(THREE,{camera,...options}):null;return !!windshield;},
    attachVehicleSurfaces(roots){bodyRoots=(roots||[]).filter(Boolean);bodyRain.bind(bodyRoots);},
    getSoundscapeState(){return soundscape;},
    getEffectiveFogState(nextEnvironment=environment){return disposed?null:fogAlignment.getEffectiveState(weatherEffectsPolicy(nextEnvironment||environment,qualityTier),nextEnvironment||environment);},
    prepareFogRender(options){return disposed?null:fogAlignment.prepareRender(options)},
    reset(){particles.reset();emissions.reset();rivalEffects.reset();roadWetness.resetContacts();},
    setActive(value){active=!!value;root.visible=active;if(!active){fogAlignment.restore();windshield?.update({active:false});}},
    diagnostics:()=>({disposed,active,trackId,updates,time,qualityTier,layers:layers.diagnostics(),surfaces:surfaces.diagnostics(),particles:particles.diagnostics(),rivalParticles:rivalEffects.diagnostics(),roadWetness:roadWetness.diagnostics(),bodyRain:bodyRain.diagnostics(),acoustics:acoustics.diagnostics(),waterfalls:waterfalls.diagnostics(),fogAlignment:fogAlignment.diagnostics(),dynamics:{...dynamics.state},wind:wind.diagnostics(),lightning:lightning.diagnostics(),windshield:windshield?.diagnostics()||null,ownedDrawBatches:5+(windshield?5:0)+waterfalls.diagnostics().drawBatches+rivalEffects.diagnostics().drawBatches}),
    dispose(){if(disposed)return;disposed=true;windshield?.dispose();bodyRain.dispose();bodyRoots=[];wind.clear();layers.dispose();particles.dispose();rivalEffects.dispose();roadWetness.dispose();lightning.dispose();acoustics.dispose();waterfalls.dispose();surfaces.dispose();root.removeFromParent();fogAlignment.restore();trackRoot=null;trackChildren=[];},
  };
}
