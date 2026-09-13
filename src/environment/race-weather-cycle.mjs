import {resolveEnvironment,getWeatherOptionsForTrack} from './environment-profiles.mjs';
import {SURFACE_CONDITION_TABLE} from '../physics/surface-conditions.mjs';
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const mix=(a,b,t)=>a+(b-a)*t;
// Transitional optical values are consumed by the host's weather effects policy.
// All endpoint values retain that policy's calibrated regional rendering.
const OPTICS=Object.freeze({
 clear:[.07,0,1.2,null],cloudy:[.45,0,1.2,.0007],rain:[.5,.1,3.5,.0013],storm:[.7,.23,7,.0028],fog:[.24,.42,1.2,.0075],
 'light-snow':[.5,.12,1.8,.002],'heavy-snow':[.75,.36,6.5,.006],
});
const CLOUD_NEIGHBORS=Object.freeze({
 cataratas_iguazu:['rain','rain','fog','clear'],dos_lagos:['rain','fog','clear'],aconcagua_horcones:['clear','fog','rain','clear'],
 cuesta_lipan:['clear','clear','fog','light-snow','rain'],paso_garibaldi:['rain','fog','light-snow','light-snow'],
});
const NEIGHBORS=Object.freeze({clear:['cloudy'],rain:['cloudy','storm'],storm:['rain'],fog:['cloudy'],'light-snow':['cloudy','heavy-snow'],'heavy-snow':['light-snow']});
function hash(text){let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return value>>>0;}
/** Fill an owned output, never mutate the immutable regional profiles. This same
 * precipitation/temperature/wetness tuple is intended for rendering AND traction. */
export function blendRaceWeatherProfiles(a,b,blend,target){
 const t=clamp(blend),id=t<.5?a.weatherId:b.weatherId,precip=t===0?a.precipitation:t===1?b.precipitation:a.precipitation==='none'?b.precipitation:b.precipitation==='none'?a.precipitation:id;
 target.weatherId=id;target.weather=id;target.temperatureC=mix(a.temperatureC,b.temperatureC,t);target.roadWetness=mix(a.roadWetness,b.roadWetness,t);
 target.precipitationIntensity=mix(a.precipitationIntensity,b.precipitationIntensity,t);
 const snowy=precip==='light-snow'||precip==='heavy-snow';
 if(snowy)target.precipitationIntensity*=clamp((2-target.temperatureC)/3);
 target.precipitation=target.precipitationIntensity>0?precip:'none';
 target.surfaceState=t===0?a.surfaceState:t===1?b.surfaceState:snowy&&target.precipitationIntensity>0?precip:target.roadWetness>=.6?'wet':target.roadWetness>.04?'damp':a.surfaceState==='dust'||b.surfaceState==='dust'?'dust':'dry';
 target.headlightPolicy=a.headlightPolicy==='required'||b.headlightPolicy==='required'?'required':a.headlightPolicy==='available'||b.headlightPolicy==='available'?'available':'off';
 const surface=target.surfaceCondition||(target.surfaceCondition={}),surfaceA=SURFACE_CONDITION_TABLE[a.surfaceState],surfaceB=SURFACE_CONDITION_TABLE[b.surfaceState];
 surface.state=target.surfaceState;surface.gripMultiplier=mix(surfaceA.gripMultiplier,surfaceB.gripMultiplier,t);surface.rollingResistanceMultiplier=mix(surfaceA.rollingResistanceMultiplier,surfaceB.rollingResistanceMultiplier,t);
 surface.looseSurfaceDepthM=mix(surfaceA.looseSurfaceDepthM,surfaceB.looseSurfaceDepthM,t);surface.aquaplaningEnabled=target.roadWetness>=.6&&(surfaceA.aquaplaningEnabled||surfaceB.aquaplaningEnabled);surface.frictionMu=surface.gripMultiplier;surface.baseSurface='asphalt';surface.temperatureC=target.temperatureC;
 const optical=target.weatherCycle||(target.weatherCycle={}),from=OPTICS[a.weatherId],to=OPTICS[b.weatherId];
 optical.clouds=mix(from[0],to[0],t);optical.mist=mix(from[1],to[1],t);optical.wind=mix(from[2],to[2],t);optical.opticalFogDensity=a.weatherId==='clear'&&b.weatherId==='clear'?null:mix(from[3]??a.fog.density,to[3]??b.fog.density,t);
 return target;
}
/** Clock contract: completedCycles is accumulated (not a wrapped hour),
 * elapsedSeconds is within the current cycle, activeSeconds never wraps or
 * rescales. The latter keeps in-flight transitions steady when duration changes.
 * The host MUST pass allowEvolution:false for fixed championship canon. */
export function createRaceWeatherCycle({trackId,skyId='clear',weatherId='clear',enabled=true,allowEvolution=true,transitionSeconds=75}={}){
 const allowed=getWeatherOptionsForTrack(trackId),profiles=new Map();
 for(const id of allowed)profiles.set(id,resolveEnvironment(trackId,skyId,id));
 if(!profiles.has(weatherId))throw new RangeError('incompatible cycle weather: '+weatherId);
 const seed=hash(trackId+':'+weatherId),edges=new Map();
 for(const id of allowed)edges.set(id,(id==='cloudy'?CLOUD_NEIGHBORS[trackId]:NEIGHBORS[id]).filter(next=>allowed.includes(next)));
 const state={fromWeatherId:weatherId,toWeatherId:weatherId,blend:0,completedCycles:0,activeSeconds:0,evolving:false,weatherCycle:{}};
 let reached=0,from=weatherId,to=weatherId,startSeconds=0,lastActive=0,on=enabled!==false,permitted=allowEvolution!==false;
 const transition=Math.max(10,Math.min(120,Number(transitionSeconds)||75));
 function selected(){state.fromWeatherId=weatherId;state.toWeatherId=weatherId;state.blend=0;state.evolving=false;return blendRaceWeatherProfiles(profiles.get(weatherId),profiles.get(weatherId),0,state);}
 selected();
 return{state,
  setOptions(options={}){if('enabled'in options)on=options.enabled!==false;if('allowEvolution'in options)permitted=options.allowEvolution!==false;return state;},
  reset(){reached=0;from=weatherId;to=weatherId;startSeconds=0;lastActive=0;state.completedCycles=0;state.activeSeconds=0;return selected();},
  update({clock}={}){
   if(!clock)return state;
   const cycle=Math.max(0,Math.floor(Number(clock.completedCycles)||0)),active=Math.max(0,Number(clock.activeSeconds)||0);
   state.completedCycles=cycle;state.activeSeconds=active;
   if(!on||!permitted||clock.enabled===false){lastActive=active;return selected();}
   if(cycle<reached||active<lastActive){reached=0;from=weatherId;to=weatherId;}
   if(cycle!==reached){
    while(reached<cycle){from=to;reached++;const choices=edges.get(from),random=Math.imul(seed^Math.imul(reached,2654435761),2246822519)>>>0;to=choices[random%choices.length];}
    startSeconds=active-Math.max(0,Number(clock.elapsedSeconds)||0);
   }
   lastActive=active;state.fromWeatherId=from;state.toWeatherId=to;
   const progress=cycle>0?clamp((active-startSeconds)/transition):0;state.blend=progress*progress*(3-2*progress);state.evolving=cycle>0&&progress<1;
   return blendRaceWeatherProfiles(profiles.get(from),profiles.get(to),state.blend,state);
  },
  diagnostics(){return{trackId,initialWeatherId:weatherId,enabled:on,allowEvolution:permitted,fromWeatherId:state.fromWeatherId,toWeatherId:state.toWeatherId,weatherId:state.weatherId,blend:state.blend,completedCycles:state.completedCycles,activeSeconds:state.activeSeconds,evolving:state.evolving};},
 };
}
