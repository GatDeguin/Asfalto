import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as activityRewards from '../src/menu/activity-rewards.mjs?v=684503a891f85e8a';

const source=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=efee936bdd03fcdd',import.meta.url),'utf8');
const resultFunctions=source.slice(source.indexOf('function finishJourney('),source.indexOf('function applyWear('));

async function finishActivity(activity,{valid=true,finished=true,reasons=[]}={}){
 const isRace=activity==='competition';
 const activityReceiptBase={type:activity,resultId:'result',sessionSequence:1,trackId:'dos_lagos',vehicleId:'chevy',class:'Histórica',startedAt:'2026-01-01T00:00:00Z',...(isRace?{title:'Sprint de club',competitionId:'sprint',mode:'race'}:{})};
 const activeSession={completed:false,valid,distance:1200,maxSpeed:100,startTime:0,series:[],reasons,definition:{title:'Sprint de club'},activityReceiptBase};
 let profile={workshopTokens:100,journey:{km:0,routes:[]},championship:{events:0,points:0,wins:0}},disk=JSON.stringify(profile);
 const results=[];
 const activityRewardStore=activityRewards.createActivityRewardStore({storage:{getItemPersistent:()=>disk,setItemPersistent(_key,value){disk=value;}},getProfile:()=>profile,replaceProfile:next=>{profile=next;},withLock:fn=>Promise.resolve().then(fn)});
 const final={complete:true,valid:true,fixedHz:120,participants:[{id:'player',status:'finished',valid:true,checkpointComplete:true,officialSeconds:12,finishTick:1440},{id:'falcon',status:'finished',valid:true,checkpointComplete:true,officialSeconds:13,finishTick:1560}]};
 const world={getPhysicalObservationState:()=>({qa:false,sessionSequence:1}),getFinalClassification:()=>final,pause(){}};
 const scope={activeSession,activityRewards,activityRewardStore,sessionLoop:{stop(){}},round:Math.round,applyWear(){},clearLocalCompetitionClassification(){},showResults:result=>results.push(result),vehicleClass:()=> 'Histórica',window:{__cockpit:{raceWorld:world}},location:{search:''}};
 const finish=new Function('scope',`with(scope){${resultFunctions};return {journey:finishJourney,competition:finishCompetition};}`)(scope);
 const state={finished,raw:{status:finished?'FINISHED':'RUNNING',finishReason:finished?'completed':null,totalTime:12,raceProgress:1200,completedLaps:finished?1:0,track:{id:'dos_lagos',length:1200}}};
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
 {name:'time limit without a finish',valid:true,finished:false,reasons:[],reason:'Tiempo límite sin completar el objetivo'},
])test(`${attempt.name} shows no rank and records no reward`,async()=>{
 const {result,profile}=await finishActivity('competition',attempt);
 assert.equal(result.valid,false);
 assert.equal(result.main,'—');
 assert.ok(result.reasons.includes(attempt.reason));
 assert.deepEqual(profile.championship,{events:0,points:0,wins:0});
 assert.equal(profile.workshopTokens,100);
});

test('the championship sheet uses the measured speed, route distance and Spanish result states',()=>{
 const nodes=new Map(),results=[];
 const scope={
  activeSession:{distance:22721,maxSpeed:77.2,series:[]},
  window:{__cockpit:{raceWorld:{state:{raceProgress:22717.5}}}},
  showResults:result=>results.push(result),document:{createElement:()=>({})},
  q(id){
   if(!nodes.has(id))nodes.set(id,{rows:[],replaceChildren(){this.rows.length=0;},append(row){this.rows.push(row);}});
   return nodes.get(id);
  },
 };
 const championship=source.slice(source.indexOf('function showChampionshipResults('),source.indexOf('function loadCollectionReader('));
 const show=new Function('scope',`with(scope){${championship};return showChampionshipResults;}`)(scope);
 show({phase:'result',run:{entrant:{class:'Histórica'},nextStageIndex:1,schedule:new Array(5)},final:{participants:[
  {id:'player',officialSeconds:1112.625,activeSeconds:1112.625,penaltySeconds:0,status:'finished'},
  {id:'falcon',officialSeconds:null,penaltySeconds:0,status:'dnf'},
 ]}});
 assert.equal(results[0].distance,22717.5);
 assert.equal(results[0].maxSpeed,77.2);
 assert.match(nodes.get('#v6-results-details').rows[0].textContent,/Vos · finalizó · 1112\.625 s/);
 assert.match(nodes.get('#v6-results-details').rows[1].textContent,/Falcon · abandono · sin tiempo/);
});
