import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as activityRewards from '../src/menu/activity-rewards.mjs?v=7736130247585143';

const source=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=4c89d18a6f7245e8',import.meta.url),'utf8');
const resultFunctions=source.slice(source.indexOf('function finishJourney('),source.indexOf('function applyWear('));

async function finishActivity(activity,{valid=true,finished=true,reasons=[],playerStatus='finished',finishReason=finished?'completed':null}={}){
 const isRace=activity==='competition';
 const activityReceiptBase={type:activity,resultId:'result',sessionSequence:1,trackId:'dos_lagos',vehicleId:'chevy',class:'Histórica',startedAt:'2026-01-01T00:00:00Z',...(isRace?{title:'Sprint de club',competitionId:'sprint',mode:'race'}:{})};
 const activeSession={completed:false,valid,distance:1200,maxSpeed:100,startTime:0,series:[],reasons,definition:{title:'Sprint de club'},activityReceiptBase};
 let profile={workshopTokens:100,journey:{km:0,routes:[]},championship:{events:0,points:0,wins:0}},disk=JSON.stringify(profile);
 const results=[];
 const activityRewardStore=activityRewards.createActivityRewardStore({storage:{getItemPersistent:()=>disk,setItemPersistent(_key,value){disk=value;}},getProfile:()=>profile,replaceProfile:next=>{profile=next;},withLock:fn=>Promise.resolve().then(fn)});
 const player=playerStatus==='finished'?{id:'player',status:'finished',valid:true,checkpointComplete:true,officialSeconds:12,finishTick:1440}:{id:'player',status:playerStatus,valid:false,checkpointComplete:false,officialSeconds:null,terminalReason:'Avería crítica'};
 const final={complete:true,valid:true,fixedHz:120,participants:[player,{id:'falcon',status:'finished',valid:true,checkpointComplete:true,officialSeconds:13,finishTick:1560}]};
 const world={getPhysicalObservationState:()=>({qa:false,sessionSequence:1}),getFinalClassification:()=>final,pause(){}};
 const scope={activeSession,activityRewards,activityRewardStore,sessionLoop:{stop(){}},round:Math.round,applyWear(){},clearLocalCompetitionClassification(){},showResults:result=>results.push(result),vehicleClass:()=> 'Histórica',window:{__cockpit:{raceWorld:world}},location:{search:''}};
 const finish=new Function('scope',`with(scope){${resultFunctions};return {journey:finishJourney,competition:finishCompetition};}`)(scope);
 const state={finished,raw:{status:finished?'FINISHED':'RUNNING',finishReason,totalTime:12,raceProgress:1200,completedLaps:finished?1:0,track:{id:'dos_lagos',length:1200}}};
 finish[activity](state,12000);finish[activity](state,12000);
 await new Promise(resolve=>setImmediate(resolve));
 return {result:results.at(-1),results,profile};
}

for(const activity of ['journey','competition'])test(activity+' omits unmeasured consistency and publishes the confirmed reward',async()=>{
 const {result,results}=await finishActivity(activity);
 assert.equal(result.distance,1200);
 assert.equal(Object.hasOwn(result,'consistency'),false);
 assert.equal(results.length,2);
 assert.equal(results[0].saving,true);
 assert.match(result.progress, /fichas obtenidas/);
});

test('valid competition finish records a physical rank and awards points once',async()=>{
 const {result,profile}=await finishActivity('competition');
 assert.equal(result.valid,true);
 assert.equal(result.main,'P1');
 assert.deepEqual(profile.championship,{events:1,points:6,wins:1});
 assert.match(profile.history[0].copy,/Puesto 1/);
 assert.equal(profile.workshopTokens,105);
});

for(const attempt of [
 {name:'invalid finish',valid:false,finished:true,reasons:['PENALIZACIÓN'],reason:'PENALIZACIÓN'},
 {name:'time limit after an infraction',valid:false,finished:false,reasons:['PENALIZACIÓN'],reason:'Tiempo límite sin completar el objetivo'},
 {name:'player DNF',playerStatus:'dnf',reason:'Abandono · Avería crítica'},
])test(`${attempt.name} shows no rank and records no reward`,async()=>{
 const {result,profile}=await finishActivity('competition',attempt);
 assert.equal(result.valid,false);
 assert.equal(result.main,'—');
 assert.equal(result.showRaceTiming,false);
 assert.ok(result.reasons.includes(attempt.reason));
 assert.deepEqual(profile.championship,{events:0,points:0,wins:0});
 assert.equal(profile.workshopTokens,100);
});

test('ending a free drive voluntarily pauses the car and shows one unscored result using active time',()=>{
 const results=[],pauses=[];
 const freeDrive=source.slice(source.indexOf('function finishFreeDrive('),source.indexOf('function roadTestMessage('));
 const activeSession={type:'free',completed:false,startTime:5000,pausedAt:17000,distance:415,maxSpeed:61,series:[]};
 const world={state:{status:'PAUSED'},pause:input=>pauses.push(input)};
 const scope={activeSession,sessionLoop:{stop(){}},window:{__cockpit:{raceWorld:world}},vehicleClass:()=> 'Histórica',applyWear(){},showResults:result=>results.push(result)};
 const finish=new Function('scope',`with(scope){${freeDrive};return finishFreeDrive;}`)(scope);
 finish(22000,{voluntary:true});finish(22000,{voluntary:true});
 assert.equal(results.length,1);
 assert.equal(results[0].unscored,true);
 assert.equal(results[0].elapsed,12000);
 assert.equal(results[0].distance,415);
 assert.match(results[0].verdict,/recorrido finalizado/i);
 assert.deepEqual(pauses,[{reason:'result'}]);
});

test('the championship sheet uses the measured speed, route distance and Spanish result states',()=>{
 const results=[];
 const scope={
  activeSession:{distance:22721,maxSpeed:77.2,series:[]},
  window:{__cockpit:{raceWorld:{state:{raceProgress:22717.5}}}},
  showResults:result=>results.push(result),
 };
 const championship=source.slice(source.indexOf('function showChampionshipResults('),source.indexOf('function loadCollectionReader('));
 const show=new Function('scope',`with(scope){${championship};return showChampionshipResults;}`)(scope);
 show({phase:'result',run:{entrant:{class:'Histórica'},nextStageIndex:1,schedule:new Array(5)},final:{participants:[
  {id:'player',officialSeconds:1112.625,activeSeconds:1112.625,penaltySeconds:0,status:'finished'},
  {id:'falcon',officialSeconds:null,penaltySeconds:0,status:'dnf'},
 ]}});
 assert.equal(results[0].distance,22717.5);
 assert.equal(results[0].maxSpeed,77.2);
 assert.match(results[0].details[0],/Vos · finalizó · 1112\.625 s/);
 assert.match(results[0].details[1],/Falcon · abandono · sin tiempo/);
 assert.equal(results[0].showRaceTiming,true);
 scope.classificationEnding=()=> 'Abandono';
 show({phase:'invalid',run:{entrant:{class:'Histórica'},nextStageIndex:0,schedule:new Array(5)},final:{participants:[
  {id:'player',officialSeconds:null,activeSeconds:3.125,penaltySeconds:0,status:'dnf'},
  {id:'falcon',officialSeconds:121,activeSeconds:121,penaltySeconds:0,status:'finished'},
 ]}});
 assert.equal(results[1].main,'—');
 assert.equal(results[1].elapsed,3125);
 assert.equal(results[1].showRaceTiming,false);
});
