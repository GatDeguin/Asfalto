import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const runtime=readFileSync(new URL('../src/legacy/v6-complete-runtime.js?v=4c89d18a6f7245e8',import.meta.url),'utf8');
const start=runtime.indexOf('async function togglePart('),end=runtime.indexOf('function renderTuning(',start);
assert.ok(start>0&&end>start);
const body=runtime.slice(start,end);
const lessonStart=runtime.indexOf('function awardWorkshopLesson(');
const lessonBody=lessonStart<0?'':runtime.slice(lessonStart,runtime.indexOf('function unlockByProgress(',lessonStart));
function fixture(){
 const awards=[],history=[];
 const scope={PARTS:[{id:'intake',name:'Admisión',axis:'mecanica',modern:'Doble plano',original:'De serie'}],
  profile:{parts:{intake:'original'}},confirmAction:async()=>true,
  addHistory(...args){history.push(args);},award(value){awards.push(value);},
  renderParts(){},renderProfileSummary(){},applyVehicleConfig(){},saveProfile(){}};
 const toggle=new Function('scope',`with(scope){${lessonBody};${body};return togglePart;}`)(scope);
 return {scope,awards,history,toggle};
}
test('repeating a workshop conversion and restoration cannot farm progression',async()=>{
 const f=fixture();
 for(let i=0;i<20;i++)await f.toggle('intake');
 assert.equal(f.scope.profile.parts.intake,'original');
 assert.equal(f.history.length,20,'every real mechanical change keeps its history');
 assert.deepEqual(f.awards,[{mecanica:2},{mecanica:2}],'learn each distinct operation once');
});
test('learned workshop operations remain bounded after a profile reload',async()=>{
 const f=fixture();await f.toggle('intake');await f.toggle('intake');
 f.scope.profile=JSON.parse(JSON.stringify(f.scope.profile));
 await f.toggle('intake');await f.toggle('intake');
 assert.equal(f.awards.length,2);assert.equal(f.scope.profile.parts.intake,'original');
});
test('canceling a conversion does not teach, award or change parts',async()=>{
 const f=fixture();f.scope.confirmAction=async()=>false;
 const before=structuredClone(f.scope.profile);await f.toggle('intake');
 assert.deepEqual(f.scope.profile,before);assert.equal(f.awards.length,0);assert.equal(f.history.length,0);
});
for(const control of ['#v6-appearance-apply','#v6-tuning-save'])test(`saving ${control} repeatedly cannot generate unlimited experience`,()=>{
 const f=fixture();let handler;
 f.scope.profile.appearance={body:'naranja'};f.scope.profile.tuning={frontPressure:29,rearPressure:31,brakeBias:60};
 Object.assign(f.scope,{BODY_COLORS:{naranja:{label:'Naranja'}},toast(){},q(selector){
  return selector===control?{addEventListener(_event,callback){handler=callback;}}:{value:selector.includes('height')?'0':'Serie 2'};
 }});
 const line=runtime.split('\n').find(line=>line.includes(`q('${control}').addEventListener`));assert.ok(line);
 new Function('scope',`with(scope){${lessonBody};${line}}`)(f.scope);
 for(let i=0;i<20;i++)handler();
 assert.equal(f.awards.length,1);assert.equal(f.history.length,20);
 f.scope.profile=JSON.parse(JSON.stringify(f.scope.profile));handler();assert.equal(f.awards.length,1);
});
test('workshop photography stays available after its one-time learning reward',async()=>{
 const f=fixture();let downloads=0;
 f.scope.profile.photos=[];
 Object.assign(f.scope,{workshop:{capture:()=> 'data:image/png;base64,AA=='},dateStamp:()=> 'test date',toast(){},
  document:{createElement:()=>({click(){downloads++;}})},q:()=>({value:'50',selectedOptions:[{text:'General'}]})});
 const photoStart=runtime.indexOf('async function capturePhoto('),photoEnd=runtime.indexOf('async function resetProfile(',photoStart);
 const capture=new Function('scope',`with(scope){${lessonBody};${runtime.slice(photoStart,photoEnd)};return capturePhoto;}`)(f.scope);
 for(let i=0;i<20;i++)await capture();
 assert.equal(downloads,20);assert.equal(f.scope.profile.photos.length,20);
 assert.deepEqual(f.awards,[{coleccion:3,historia:1}]);
 f.scope.profile=JSON.parse(JSON.stringify(f.scope.profile));await capture();assert.equal(f.awards.length,1);
});
