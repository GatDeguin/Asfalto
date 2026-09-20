import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {createRaceDayCycle,createRaceDayEnvironment,sampleRaceDayCycle} from '../src/environment/race-day-cycle.mjs?v=7e778f2f4e357b6f';
import {resolveEnvironment,getWeatherOptionsForTrack} from '../src/environment/environment-profiles.mjs?v=315916d6c7fab528';
const weatherModule=await import('../src/environment/race-weather-cycle.mjs?v=98d02c4ab5b936e1').catch(()=>({}));
const advance=(c,dt)=>c.update({dt,status:'RUNNING',active:true});
function create(options){assert.equal(typeof weatherModule.createRaceWeatherCycle,'function','regional weather controller exists');return weatherModule.createRaceWeatherCycle(options);}
test('first cycle holds selected rain; second cycle starts at the same intensity and changes gradually',()=>{
 const c=createRaceDayCycle({durationSeconds:360}),w=create({trackId:'cataratas_iguazu',weatherId:'rain'}),state=w.state;
 advance(c,359.99);w.update({clock:c.state});assert.equal(w.state,state);assert.equal(state.weatherId,'rain');assert.equal(state.precipitationIntensity,.65);
 advance(c,.01);w.update({clock:c.state});assert.equal(state.blend,0);assert.equal(state.precipitationIntensity,.65);assert.notEqual(state.toWeatherId,'rain');
 const next=state.toWeatherId;advance(c,30);w.update({clock:c.state});assert.ok(state.blend>0&&state.blend<1);assert.equal(state.toWeatherId,next);assert.ok(Math.abs(state.precipitationIntensity-.65)<.65);
 const blend=state.blend;c.setOptions({durationSeconds:720});w.update({clock:c.state});assert.equal(state.blend,blend,'changing day duration must not jump a live weather transition');
 c.update({dt:120,status:'PAUSED',active:true});w.update({clock:c.state});assert.equal(state.blend,blend);
 advance(c,45);w.update({clock:c.state});assert.equal(state.blend,1);
});
test('regional walks are reproducible, never select forbidden snow, and avoid clear-to-storm jumps',()=>{
 for(const trackId of ['cataratas_iguazu','dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi']){
  const a=create({trackId}),b=create({trackId}),clock={enabled:true,durationSeconds:360,completedCycles:0,elapsedSeconds:0,activeSeconds:0};let previous='clear';
  for(let cycle=0;cycle<25;cycle++){
   Object.assign(clock,{completedCycles:cycle,elapsedSeconds:100,activeSeconds:cycle*360+100});a.update({clock});b.update({clock});
   assert.equal(a.state.weatherId,b.state.weatherId);assert.ok(getWeatherOptionsForTrack(trackId).includes(a.state.weatherId));
   if(cycle>0)assert.notEqual(a.state.toWeatherId,previous);if(previous==='clear'&&cycle>0)assert.equal(a.state.toWeatherId,'cloudy');
   if(a.state.precipitation.includes('snow'))assert.ok(a.state.temperatureC<=2);previous=a.state.toWeatherId;
  }
 }
});
test('host canon permission and fixed mode keep selected conditions across arbitrary cycles',()=>{
 for(const options of [{allowEvolution:false},{enabled:false}]){
  const w=create({trackId:'dos_lagos',weatherId:'storm',...options});w.update({clock:{enabled:true,durationSeconds:360,completedCycles:8,elapsedSeconds:200,activeSeconds:3080}});assert.equal(w.state.weatherId,'storm');assert.equal(w.state.precipitationIntensity,1);
 }
 const w=create({trackId:'dos_lagos'});w.update({clock:{enabled:false,durationSeconds:360,completedCycles:8,elapsedSeconds:200,activeSeconds:3080}});assert.equal(w.state.weatherId,'clear');
});
test('day palette accepts evolving weather without resetting day clock or mutating the regional source',()=>{
 const base=resolveEnvironment('dos_lagos','clear','clear'),palette=createRaceDayEnvironment(THREE,base),day=sampleRaceDayCycle(12),weather={fromWeatherId:'clear',toWeatherId:'rain',blend:.5};
 const env=palette.update(day,weather),identity=env.fog.color;
 assert.equal(env.precipitation,'rain');assert.equal(env.precipitationIntensity,.325);assert.equal(env.roadWetness,.35);assert.ok(env.fog.density>.001);assert.ok(env.weatherCycle.clouds>.07);
 assert.equal(base.roadWetness,0);assert.equal(base.precipitation,'none');assert.equal(env.dayCycle.hour,12);assert.equal(palette.update(day,weather),env);assert.equal(env.fog.color,identity);
 weather.blend=1;palette.update(day,weather);assert.equal(env.surfaceState,'wet');assert.equal(env.roadWetness,.7);
});

test('traction transitions continuously with wetness instead of retaining dry grip until a categorical switch',()=>{
 const palette=createRaceDayEnvironment(THREE,resolveEnvironment('dos_lagos','clear','clear')),env=palette.update(sampleRaceDayCycle(10),{fromWeatherId:'clear',toWeatherId:'rain',blend:.5});
 assert.ok(env.surfaceCondition,'same environment carries host-ready surface coefficients');assert.equal(env.surfaceCondition.gripMultiplier,.9);assert.equal(env.surfaceCondition.frictionMu,.9);assert.ok(Math.abs(env.surfaceCondition.rollingResistanceMultiplier-1.07)<1e-12);assert.equal(env.surfaceCondition.aquaplaningEnabled,false);
 const condition=env.surfaceCondition;palette.update(sampleRaceDayCycle(10),{fromWeatherId:'clear',toWeatherId:'rain',blend:1});assert.equal(env.surfaceCondition,condition);assert.equal(condition.gripMultiplier,.8);assert.equal(condition.aquaplaningEnabled,true);
});
