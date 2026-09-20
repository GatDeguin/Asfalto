import {resolveEnvironment} from './environment-profiles.mjs';
import {resolveRaceLighting} from './race-lighting.mjs';
export const DAY_CYCLE_SECONDS=12*60;
const wrap=hour=>((hour%24)+24)%24;
const linear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
const knot=(hour,skyId,rotation=0)=>{
 const lighting=resolveRaceLighting(skyId),rgb=parseInt(lighting.keyLightColor.slice(1),16),direction=lighting.keyLightDirection.slice();
 if(rotation){direction[0]*=-1;direction[2]*=-1;}
 return Object.freeze({hour,skyId,rotation,key:skyId+(rotation?':dawn':':evening'),lighting,direction,color:[linear((rgb>>16)/255),linear(((rgb>>8)&255)/255),linear((rgb&255)/255)],nightFactor:skyId==='night'||skyId==='moonrise'?1:skyId==='sunset'?.3:0,cloudiness:skyId==='overcast'?.6:0});
};
// Dawn reuses the warm panoramas with the bright horizon turned east. No new
// image downloads or synthesized daytime fill are introduced at night.
export const DAY_CYCLE_KNOTS=Object.freeze([knot(0,'night'),knot(4.5,'night'),knot(6,'sunset',Math.PI),knot(7,'golden-hour',Math.PI),knot(10,'clear'),knot(13,'overcast'),knot(15,'clear'),knot(17,'golden-hour'),knot(18.5,'sunset'),knot(20,'moonrise'),knot(23,'night'),knot(24,'night')]);
const START_HOURS={clear:10,overcast:13,'golden-hour':17,golden:17,sunset:18.5,moonrise:20,night:0};
export function sampleRaceDayCycle(hour,target={direction:[0,1,0],color:[1,1,1]}){
 hour=wrap(Number.isFinite(hour)?hour:10);let index=0;
 while(index<DAY_CYCLE_KNOTS.length-2&&hour>=DAY_CYCLE_KNOTS[index+1].hour)index++;
 const a=DAY_CYCLE_KNOTS[index],b=DAY_CYCLE_KNOTS[index+1],progress=(hour-a.hour)/(b.hour-a.hour),blend=progress*progress*(3-2*progress),inverse=1-blend;
 target.hour=hour;target.index=index;target.from=a;target.to=b;target.next=DAY_CYCLE_KNOTS[(index+2)%(DAY_CYCLE_KNOTS.length-1)];target.blend=blend;
 target.skyId=blend<.5?a.skyId:b.skyId;target.phase=hour<4.5||hour>=20?'night':hour<10?'dawn':hour<17?'day':'sunset';
 for(const key of ['keyLightIntensity','exposure'])target[key]=a.lighting[key]*inverse+b.lighting[key]*blend;
  target.atmosphereSunIntensity=(a.skyId==='moonrise'?Math.min(.012,a.lighting.keyLightIntensity*20):a.lighting.keyLightIntensity*20)*inverse+(b.skyId==='moonrise'?Math.min(.012,b.lighting.keyLightIntensity*20):b.lighting.keyLightIntensity*20)*blend;target.nightFactor=a.nightFactor*inverse+b.nightFactor*blend;target.cloudiness=a.cloudiness*inverse+b.cloudiness*blend;
 for(let i=0;i<3;i++){target.direction[i]=a.direction[i]*inverse+b.direction[i]*blend;target.color[i]=a.color[i]*inverse+b.color[i]*blend;}
 const length=Math.hypot(...target.direction)||1;for(let i=0;i<3;i++)target.direction[i]/=length;
 return target;
}
export function createRaceDayCycle({skyId='clear',durationSeconds=DAY_CYCLE_SECONDS,enabled=true}={}){
 let elapsed=0,startHour=START_HOURS[skyId]??10,duration=DAY_CYCLE_SECONDS,on=enabled!==false;
 const state=sampleRaceDayCycle(startHour);
 function setOptions(options={}){if('enabled'in options)on=options.enabled!==false;if(Number.isFinite(options.durationSeconds)){const next=Math.max(60,Math.min(86400,options.durationSeconds));elapsed*=next/duration;duration=next;}return diagnostics();}
 function diagnostics(){return{enabled:on,durationSeconds:duration,elapsedSeconds:elapsed,hour:state.hour,phase:state.phase,from:state.from.skyId,to:state.to.skyId,blend:state.blend};}
 setOptions({durationSeconds});
 return{state,setOptions,diagnostics,
  reset(id=skyId){skyId=id;startHour=START_HOURS[id]??10;elapsed=0;return sampleRaceDayCycle(startHour,state);},
  update({dt=0,status='IDLE',active=false}={}){if(on&&active&&status==='RUNNING'&&Number.isFinite(dt)&&dt>0){elapsed=(elapsed+dt)%duration;sampleRaceDayCycle(startHour+elapsed*24/duration,state);}return state;},
 };
}
/** Build once per selected track/weather. Render-only output; the immutable
 * regional environment still owns temperature, grip, wetness and precipitation. */
export function createRaceDayEnvironment(T,base){
 const profiles=new Map();for(const skyId of ['clear','overcast','golden-hour','sunset','moonrise','night']){
  const profile=resolveEnvironment(base.trackId,skyId,base.weatherId||base.weather||'clear');profiles.set(skyId,{profile,fogColor:new T.Color(profile.fog.color),ambientColor:new T.Color(profile.ambient.color)});
 }
 const output={...base,dayCycle:{nightFactor:0,cloudiness:0,hour:0,phase:'day',atmosphereSunIntensity:0},sun:{...base.sun,color:new T.Color(base.sun.color)},fog:{...base.fog,color:new T.Color(base.fog.color)},ambient:{...base.ambient,color:new T.Color(base.ambient.color)}};
 return{environment:output,update(state){const a=profiles.get(state.from.skyId),b=profiles.get(state.to.skyId),t=state.blend;
  output.skyId=state.skyId;output.exposure=state.exposure;output.dayCycle.nightFactor=state.nightFactor;output.dayCycle.cloudiness=state.cloudiness;output.dayCycle.hour=state.hour;output.dayCycle.phase=state.phase;output.dayCycle.atmosphereSunIntensity=state.atmosphereSunIntensity;
  output.sun.lux=state.keyLightIntensity*90000/.95;output.sunIntensity=state.keyLightIntensity;output.sun.color.setRGB(...state.color);output.sun.elevationDeg=Math.asin(state.direction[1])*180/Math.PI;output.sun.azimuthDeg=Math.atan2(state.direction[0],state.direction[2])*180/Math.PI;
  output.fog.color.copy(a.fogColor).lerp(b.fogColor,t);output.fog.density=a.profile.fog.density+(b.profile.fog.density-a.profile.fog.density)*t;
  output.ambient.color.copy(a.ambientColor).lerp(b.ambientColor,t);output.ambient.intensity=a.profile.ambient.intensity+(b.profile.ambient.intensity-a.profile.ambient.intensity)*t;return output;
 }};
}