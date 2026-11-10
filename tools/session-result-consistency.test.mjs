import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=47ce1b15d58c3df5',import.meta.url),'utf8');
const resultFunctions=source.slice(source.indexOf('function finishJourney('),source.indexOf('function applyWear('));

function finishActivity(activity,{valid=true,finished=true,reasons=[]}={}){
 const activeSession={completed:false,valid,distance:1200,maxSpeed:100,startTime:0,series:[],reasons,definition:{title:'Sprint de club'}};
 const profile={journey:{km:0,routes:[]},championship:{events:0,points:0,wins:0}};
 const results=[],history=[],awards=[];
 const scope={activeSession,profile,sessionLoop:{stop(){}},dateStamp:()=>'',round:Math.round,q:()=>({value:'dos_lagos'}),addHistory(_title,entry){history.push(entry);},award(points){awards.push(points);},applyWear(){},saveProfile(){},showResults:result=>results.push(result),vehicleClass:()=> 'Histórica',fmtTime:()=>'',window:{}};
 const finish=new Function('scope',`with(scope){${resultFunctions};return {journey:finishJourney,competition:finishCompetition};}`)(scope);
 finish[activity]({finished,raw:{totalTime:12,raceProgress:1200}},12000);
 assert.equal(results.length,1);
 return {result:results[0],profile,history,awards};
}

for(const activity of ['journey','competition'])test(activity+' omits unmeasured consistency',()=>{
 const {result}=finishActivity(activity);
 assert.equal(result.distance,1200);
 assert.equal(Object.hasOwn(result,'consistency'),false);
});

test('valid competition finish records a rank and awards championship points',()=>{
 const {result,profile,history,awards}=finishActivity('competition');
 assert.equal(result.valid,true);
 assert.equal(result.main,'P1');
 assert.deepEqual(profile.championship,{events:1,points:6,wins:1});
 assert.match(history[0],/Puesto 1/);
 assert.ok(awards[0].competencia>0);
});

for(const attempt of [
 {name:'invalid finish',valid:false,finished:true,reasons:['PENALIZACIÓN'],reason:'PENALIZACIÓN'},
 {name:'time limit without a finish',valid:true,finished:false,reasons:[],reason:'TIEMPO LÍMITE SIN LLEGADA'},
])test(`${attempt.name} records the attempt without a rank, win or points`,()=>{
 const {result,profile,history,awards}=finishActivity('competition',attempt);
 assert.equal(result.valid,false);
 assert.equal(result.main,'—');
 assert.ok(result.reasons.includes(attempt.reason));
 assert.deepEqual(profile.championship,{events:1,points:0,wins:0});
 assert.match(history[0],/Sin clasificación/);
 assert.deepEqual(awards,[{dominio:4}]);
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
