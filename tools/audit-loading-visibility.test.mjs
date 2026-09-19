import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/legacy/v6-complete-runtime.js',import.meta.url),'utf8');
const runnerSource=source.slice(source.indexOf('async function getSessionRequestRunner(){'),source.indexOf('async function openOriginalSettings()'));
test('A1 loading presentation stops the hidden workshop and restores it on cancellation',async()=>{
 const calls=[];let configuration;
 const context=vm.createContext({sessionRequestRunner:null,sessionPresentationOwner:null,experienceToolsReady:Promise.resolve({createSessionTransactionRunner(options){configuration=options;return options;}}),setSessionPaused(){},sessionLoop:{stop(){}},window:{},document:{hidden:false,body:{classList:{contains:()=>true}}},workshop:{setActive(v){calls.push(v);},restoreAfterRace(){}},q:()=>null,openMenu(){}});
 vm.runInContext(runnerSource,context);await vm.runInContext('getSessionRequestRunner()',context);
 const presentation=configuration.begin({metadata:{},cancel(){},retry(){}});
 assert.deepEqual(calls,[false],'do not render a second full scene behind the loading overlay');
 await presentation.end(false);assert.deepEqual(calls,[false,true]);
});
test('A1 a visibility-change cannot restart the workshop while a session presentation owns the screen',()=>{
 const method=source.slice(source.indexOf(' setActive(v){'),source.indexOf('\n',source.indexOf(' setActive(v){')));
 const context=vm.createContext({__asfaltoRacePresentationHeld:true,cancelAnimationFrame(){},calls:0});
 vm.runInContext('globalThis.workshop={active:false,loaded:true,loop(){calls++;},'+method+'};workshop.setActive(true);',context);
 assert.equal(context.calls,0);assert.equal(context.workshop.active,false);
});
