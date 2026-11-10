import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=fe417d7c7cf47bfe',import.meta.url),'utf8');
const resultFunctions=source.slice(source.indexOf('function finishJourney('),source.indexOf('function applyWear('));

function resultFor(activity){
 const activeSession={completed:false,valid:true,distance:1200,maxSpeed:100,startTime:0,series:[],reasons:[],definition:{title:'Sprint de club'}};
 const profile={journey:{km:0,routes:[]},championship:{events:0,points:0,wins:0}};
 const results=[];
 const scope={activeSession,profile,sessionLoop:{stop(){}},dateStamp:()=>'',round:Math.round,q:()=>({value:'dos_lagos'}),addHistory(){},award(){},applyWear(){},saveProfile(){},showResults:result=>results.push(result),vehicleClass:()=> 'Histórica',fmtTime:()=>'',window:{}};
 const finish=new Function('scope',`with(scope){${resultFunctions};return {journey:finishJourney,competition:finishCompetition};}`)(scope);
 finish[activity]({raw:{totalTime:12,raceProgress:1200}},12000);
 assert.equal(results.length,1);
 return results[0];
}

for(const activity of ['journey','competition'])test(activity+' omits unmeasured consistency',()=>{
 const result=resultFor(activity);
 assert.equal(result.distance,1200);
 assert.equal(Object.hasOwn(result,'consistency'),false);
});
