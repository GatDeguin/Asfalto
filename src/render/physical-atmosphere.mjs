import { AN_ATMOSPHERE_GLSL, AN_SKY_VERTEX_GLSL, AN_SKY_FRAGMENT_GLSL } from './volumetric-atmosphere.glsl.mjs?v=792f41a49b3f335a';
export { AN_ATMOSPHERE_GLSL } from './volumetric-atmosphere.glsl.mjs?v=792f41a49b3f335a';

const PI=Math.PI;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const QUALITY=Object.freeze({cinematic:{skySteps:16,volumeSteps:20,lightSteps:4},off:{skySteps:6,volumeSteps:0,lightSteps:0},low:{skySteps:6,volumeSteps:8,lightSteps:2},balanced:{skySteps:10,volumeSteps:12,lightSteps:3},high:{skySteps:16,volumeSteps:20,lightSteps:4},ultra:{skySteps:24,volumeSteps:32,lightSteps:4}});
const PRESETS={clear:{elevation:52,azimuth:320,lux:90000},overcast:{elevation:55,azimuth:340,lux:18000},'golden-hour':{elevation:14,azimuth:280,lux:34000},sunset:{elevation:4,azimuth:270,lux:10000},moonrise:{elevation:18,azimuth:80,lux:1200},night:{elevation:-8,azimuth:0,lux:0}};
const FOG_DENSITY={clear:.000045,cloudy:.0007,rain:.0013,storm:.0028,fog:.0075,'light-snow':.002,'heavy-snow':.006};
const BETA_R=[.0058,.0135,.0331]; // inverse kilometres in the spherical sky integrator
const vector=value=>Array.isArray(value)||ArrayBuffer.isView(value)?Array.from(value).slice(0,3):value&&'x'in value?[value.x,value.y,value.z]:null;
function normalized(value,fallback=[0,1,0]){const a=vector(value);if(!a||a.length!==3||!a.every(Number.isFinite))return fallback.slice();const length=Math.hypot(...a);return length>1e-8?a.map(component=>component/length):fallback.slice();}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const offset=(origin,direction,distance)=>origin.map((value,index)=>value+direction[index]*distance);
function sphere(origin,direction,radius){const b=dot(origin,direction),c=dot(origin,origin)-radius*radius,discriminant=b*b-c;if(discriminant<0)return [Infinity,-Infinity];const root=Math.sqrt(discriminant);return[-b-root,-b+root];}

/** Normalized Rayleigh phase, per steradian. */
export function rayleighPhase(cosine){const mu=clamp(finite(cosine),-1,1);return 3*(1+mu*mu)/(16*PI);}
/** Henyey-Greenstein Mie approximation: positive g points toward the sun. */
export function miePhase(cosine,g=.76){const mu=clamp(finite(cosine),-1,1),asymmetry=clamp(finite(g,.76),-.95,.95);return(1-asymmetry*asymmetry)/(4*PI*Math.pow(Math.max(.0001,1+asymmetry*asymmetry-2*asymmetry*mu),1.5));}

/** Density is inverse metres at baseHeight; optical depth is dimensionless.
 * The midpoint integral handles rays crossing the clamped ground layer without
 * division by directionY or a singularity at a horizontal viewing direction. */
export function heightFogOpticalDepth({distance=0,density=0,height=0,directionY=0,baseHeight=0,falloff=.0025}={}){
 const length=clamp(finite(distance),0,1000000),sigma=clamp(finite(density),0,1),origin=finite(height)-finite(baseHeight),slope=clamp(finite(directionY),-1,1),decay=clamp(finite(falloff),0,10);
 if(length===0||sigma===0)return 0;if(decay===0)return length*sigma;
 let sum=0;const steps=64,segment=length/steps;
 for(let index=0;index<steps;index++)sum+=Math.exp(-Math.max(0,origin+slope*(index+.5)*segment)*decay)*segment;
 return sigma*sum;
}

/** CPU reference for the shader's spherical single-scattering integral. It also
 * supplies diagnostic radiance so different sky presets can be checked without
 * reading back a GPU render target. Distances within this integral are km. */
export function sampleAtmosphereRadiance({viewDirection=[0,1,0],sunDirection=[0,1,0],altitude=2,sunIntensity=20,turbidity=1,steps=16}={}){
 const direction=normalized(viewDirection),sun=normalized(sunDirection),intensity=clamp(finite(sunIntensity),0,200);
 if(intensity===0)return[0,0,0];
 const planet=6360,top=6460,origin=[0,planet+clamp(finite(altitude,2),1,99000)*.001,0],atmosphere=sphere(origin,direction,top),ground=sphere(origin,direction,planet);
 let length=Math.max(0,atmosphere[1]);if(ground[0]>0)length=Math.min(length,ground[0]);
 const count=clamp(Math.round(finite(steps,16)),4,64),segment=length/count,betaM=.021*clamp(finite(turbidity,1),.1,8),sumR=[0,0,0],sumM=[0,0,0];let opticalR=0,opticalM=0;
 for(let index=0;index<count;index++){
  const point=offset(origin,direction,(index+.5)*segment),height=Math.max(0,Math.hypot(...point)-planet),rhoR=Math.exp(-height/8),rhoM=Math.exp(-height/1.2);
  opticalR+=rhoR*segment;opticalM+=rhoM*segment;
  if(sphere(point,sun,planet)[0]>0)continue;
  const sunSegment=Math.max(0,sphere(point,sun,top)[1])/6;let sunR=0,sunM=0;
  for(let light=0;light<6;light++){const sunHeight=Math.max(0,Math.hypot(...offset(point,sun,(light+.5)*sunSegment))-planet);sunR+=Math.exp(-sunHeight/8)*sunSegment;sunM+=Math.exp(-sunHeight/1.2)*sunSegment;}
  for(let channel=0;channel<3;channel++){const attenuation=Math.exp(-(BETA_R[channel]*(opticalR+sunR)+betaM*1.1*(opticalM+sunM)));sumR[channel]+=attenuation*rhoR*segment;sumM[channel]+=attenuation*rhoM*segment;}
 }
 const mu=dot(direction,sun),phaseR=rayleighPhase(mu),phaseM=miePhase(mu,.76);
 return sumR.map((value,channel)=>Math.max(0,intensity*(value*BETA_R[channel]*phaseR+sumM[channel]*betaM*phaseM)));
}

export function resolveAtmosphereParameters({scope='world',environment={},weather,skyId,fogOverride}={}){
 const id=skyId||environment.skyId||environment.presetId||(environment.night?'night':'clear'),preset=PRESETS[id]||PRESETS.clear;
 const weatherId=(typeof weather==='string'?weather:weather?.weatherId||weather?.weather||weather?.type)||environment.weatherId||environment.weather||'clear';
 const cycle=environment.dayCycle,nightFactor=Number.isFinite(cycle?.nightFactor)?clamp(cycle.nightFactor,0,1):null;
 const night=nightFactor===null?(id==='night'||id==='moonrise'||environment.night===true):nightFactor>=.9999;
 const lux=clamp(finite(environment.sun?.lux,preset.lux),0,150000);
 // One Three keylight unit corresponds to the clear-sky reference radiance 20.
 // Missing/invalid overrides retain the preset lux calibration; authored zero
 // must extinguish both volume lighting and the live sky contribution.
 const keyIntensity=Number.isFinite(environment.sunIntensity)?clamp(environment.sunIntensity,0,10):null;
 let sunIntensity=Number.isFinite(cycle?.atmosphereSunIntensity)?clamp(cycle.atmosphereSunIntensity,0,200):keyIntensity===null?20*lux/90000:20*keyIntensity;
 if(nightFactor===null){if(id==='night'||environment.night===true)sunIntensity=0;else if(id==='moonrise')sunIntensity=Math.min(.012,sunIntensity);}
 const elevation=finite(environment.sun?.elevationDeg,preset.elevation)*PI/180,azimuth=finite(environment.sun?.azimuthDeg,preset.azimuth)*PI/180;
 const weatherCloud=weatherId==='heavy-snow'?.75:weatherId==='storm'?.8:weatherId==='rain'?.65:weatherId==='cloudy'?.6:weatherId==='fog'?.35:0;
 const cloud=Math.max(weatherCloud,Number.isFinite(cycle?.cloudiness)?clamp(cycle.cloudiness,0,1):id==='overcast'?.6:0);
 const explicitDensity=Number.isFinite(fogOverride?.density)?fogOverride.density:Number.isFinite(environment.atmosphere?.density)?environment.atmosphere.density:null;
 const naturalDensity=weatherId==='clear'?finite(environment.fog?.density,FOG_DENSITY.clear):(FOG_DENSITY[weatherId]??FOG_DENSITY.clear);
 const density=clamp(explicitDensity??(scope==='workshop'?.0011:naturalDensity),0,.08);
 return {skyId:id,weatherId,night,sunIntensity:sunIntensity*(1-cloud*.5),sunDirection:[Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)],sunColor:environment.sun?.color||(night?'#a6bed9':'#fff5e4'),
  density,baseHeight:finite(environment.atmosphere?.baseHeight??environment.fog?.baseHeight),falloff:clamp(finite(environment.atmosphere?.heightFalloff,scope==='workshop'?.10:.0025),0,1),
  fogColor:fogOverride?.color||environment.fog?.color||(night?'#101727':'#bfd2df'),ambientIntensity:clamp(finite(environment.ambient?.intensity,night?.12:.7),0,4)*.35,
  turbidity:clamp(finite(environment.atmosphere?.turbidity,1+cloud*2.4+(weatherId==='fog'?1.6:0)),.1,8),
  skyBlend:.16*(1-(nightFactor??(night?1:0)))*(1-cloud*.65),mieG:scope==='workshop'?.70:.76,maxDistance:scope==='workshop'?80:2400,occlusionDistance:scope==='workshop'?24:180,shaftStrength:1-cloud*.8,
 };
}

export function createAtmosphereUniforms(T){return{
 anAtmoEnabled:{value:1},anAtmoCameraWorld:{value:new T.Matrix4()},anAtmoViewMatrix:{value:new T.Matrix4()},anAtmoProjection:{value:new T.Matrix4()},
 anAtmoSunDirection:{value:new T.Vector3(0,1,0)},anAtmoSunColor:{value:new T.Color(1,1,1)},anAtmoSunIntensity:{value:20},anAtmoAmbient:{value:new T.Color(.1,.12,.14)},
 anAtmoRayleigh:{value:new T.Vector3(.0000058,.0000135,.0000331)},anAtmoDensity:{value:.000045},anAtmoBaseHeight:{value:0},anAtmoFalloff:{value:.0025},anAtmoMieG:{value:.76},
 anAtmoMaxDistance:{value:2400},anAtmoOcclusionDistance:{value:180},anAtmoShaftStrength:{value:1},anAtmoTime:{value:0},anAtmoVolumeSteps:{value:20},anAtmoLightSteps:{value:4},
};}
function assignColor(target,value,fallback){if(value?.isColor)target.copy(value);else if(Array.isArray(value))target.setRGB(...value);else target.set(value??fallback);return target;}

/** Owns only the procedural sky mesh, geometry, material and uniform values.
 * scene.background/environment/fog and all source textures stay caller-owned.
 * The caller controls removal/restoration of legacy fog around its linear render
 * capture. The postprocess consumes .glsl and .uniforms after anViewPosition and
 * anReadDepth have been declared, and applies it before display tone mapping. */
export function createPhysicalAtmosphere(T,{scene,scope='world',quality='high'}={}){
 if(!scene?.isScene)throw new TypeError('createPhysicalAtmosphere requires a Three scene');
 const uniforms=createAtmosphereUniforms(T),skyUniforms={anSkySunDirection:{value:new T.Vector3(0,1,0)},anSkySunColor:{value:new T.Color(1,1,1)},anSkySunIntensity:{value:20},anSkyAltitude:{value:2},anSkyTurbidity:{value:1},anSkyBlend:{value:0},anSkyNight:{value:0},anSkySteps:{value:16}};
 const geometry=new T.SphereGeometry(1,32,16),material=new T.ShaderMaterial({name:'Atmósfera · Rayleigh y Mie',uniforms:skyUniforms,vertexShader:AN_SKY_VERTEX_GLSL,fragmentShader:AN_SKY_FRAGMENT_GLSL,side:T.BackSide,transparent:true,depthWrite:false,depthTest:true,fog:false,toneMapped:true});
 const sky=new T.Mesh(geometry,material);sky.name='Cielo físico · dispersión atmosférica';sky.frustumCulled=false;sky.renderOrder=-10000;sky.userData.physicalAtmosphereSky=true;sky.visible=false;scene.add(sky);
 let disposed=false,currentQuality=QUALITY[quality]?quality:'high',parameters=resolveAtmosphereParameters({scope}),updated=false,lastKey='',lastDiagnosticTime=-Infinity,zenithRadiance=[0,0,0];
 function applyQuality(){const tier=QUALITY[currentQuality];uniforms.anAtmoEnabled.value=!disposed&&currentQuality!=='off'?1:0;uniforms.anAtmoVolumeSteps.value=tier.volumeSteps;uniforms.anAtmoLightSteps.value=tier.lightSteps;skyUniforms.anSkySteps.value=tier.skySteps;sky.visible=!disposed&&updated&&currentQuality!=='off'&&scope==='world'&&(!parameters.night||!scene.background);}
 const controller={sky,uniforms,glsl:AN_ATMOSPHERE_GLSL,
  update({camera,time=0,environment={},weather,sunDirection,sunColor,skyId}={}){
   if(disposed)return;
   parameters=resolveAtmosphereParameters({scope,environment,weather,skyId,fogOverride:scene.userData?.asfaltoFogOverride});
   uniforms.anAtmoSunDirection.value.fromArray(normalized(sunDirection??environment.keyLightDirection??parameters.sunDirection));
   assignColor(uniforms.anAtmoSunColor.value,sunColor??parameters.sunColor,'#fff5e4');uniforms.anAtmoSunIntensity.value=parameters.sunIntensity;
   assignColor(uniforms.anAtmoAmbient.value,parameters.fogColor,'#bfd2df').multiplyScalar(parameters.ambientIntensity);
   for(const [name,key]of [['anAtmoDensity','density'],['anAtmoBaseHeight','baseHeight'],['anAtmoFalloff','falloff'],['anAtmoMieG','mieG'],['anAtmoMaxDistance','maxDistance'],['anAtmoOcclusionDistance','occlusionDistance'],['anAtmoShaftStrength','shaftStrength']])uniforms[name].value=parameters[key];
   uniforms.anAtmoTime.value=finite(time)%1000000;
   if(camera){
    camera.updateWorldMatrix(true,false);uniforms.anAtmoCameraWorld.value.copy(camera.matrixWorld);uniforms.anAtmoViewMatrix.value.copy(camera.matrixWorldInverse);uniforms.anAtmoProjection.value.copy(camera.projectionMatrix);
    camera.getWorldPosition(sky.position);sky.scale.setScalar(clamp(finite(camera.far,5000)*.95,10,1000000));skyUniforms.anSkyAltitude.value=clamp(sky.position.y,1,99000);
   }
   skyUniforms.anSkySunDirection.value.copy(uniforms.anAtmoSunDirection.value);skyUniforms.anSkySunColor.value.copy(uniforms.anAtmoSunColor.value);skyUniforms.anSkySunIntensity.value=parameters.sunIntensity;skyUniforms.anSkyTurbidity.value=parameters.turbidity;skyUniforms.anSkyNight.value=parameters.night?1:0;
   const sourceExists=!!scene.background;skyUniforms.anSkyBlend.value=sourceExists?parameters.skyBlend:1;
   // A captured HDRI already contains atmospheric extinction. Add a small live
   // scattering contribution rather than darkening or replacing that panorama.
   const blending=sourceExists?T.AdditiveBlending:T.NormalBlending;if(material.blending!==blending){material.blending=blending;material.needsUpdate=true;}
   const key=[parameters.skyId,parameters.turbidity,parameters.sunIntensity,...uniforms.anAtmoSunDirection.value.toArray(),Math.round(skyUniforms.anSkyAltitude.value/50)].join('|');
   if(key!==lastKey&&(!environment.dayCycle||time-lastDiagnosticTime>=.5||time<lastDiagnosticTime)){lastDiagnosticTime=time;lastKey=key;zenithRadiance=sampleAtmosphereRadiance({sunDirection:uniforms.anAtmoSunDirection.value.toArray(),altitude:skyUniforms.anSkyAltitude.value,sunIntensity:parameters.sunIntensity,turbidity:parameters.turbidity});}
   updated=true;applyQuality();return controller;
  },
  setQuality(value){if(!disposed){currentQuality=QUALITY[value]?value:'high';applyQuality();}return currentQuality;},
  diagnostics(){return{scope,quality:currentQuality,disposed,enabled:uniforms.anAtmoEnabled.value===1,skyVisible:sky.visible,skyId:parameters.skyId,night:parameters.night,skyModel:'spherical-single-scattering-rayleigh-mie',volumeModel:'height-density-beer-lambert',screenSpaceOcclusion:true,offscreenOcclusion:false,
   skySteps:skyUniforms.anSkySteps.value,volumeSteps:uniforms.anAtmoVolumeSteps.value,lightSteps:uniforms.anAtmoLightSteps.value,density:uniforms.anAtmoDensity.value,baseHeight:parameters.baseHeight,heightFalloff:parameters.falloff,sunIntensity:parameters.sunIntensity,skyBlend:skyUniforms.anSkyBlend.value,
   sharedEnvironmentPreserved:true,legacyFogManagedByCaller:true,zenithRadiance:zenithRadiance.slice(),ownedGeometries:disposed?0:1,ownedMaterials:disposed?0:1,ownedTextures:0};},
  dispose(){if(disposed)return;disposed=true;uniforms.anAtmoEnabled.value=0;sky.visible=false;sky.removeFromParent();geometry.dispose();material.dispose();},
 };
 applyQuality();return controller;
}
