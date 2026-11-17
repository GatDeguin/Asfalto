import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {registerRenderPreparation,disposeRenderPreparation,rememberPreparedVariant,hasPreparedVariant} from '../src/render/pass-preparation.mjs?v=926cddc76a9af3b4';

function fixture(){
 let lost=false;
 const renderer={info:{programs:[]},getContext:()=>({isContextLost:()=>lost})};
 const T={Scene:class{}};
 registerRenderPreparation(renderer,T);
 return {renderer,T,lose:value=>{lost=value;}};
}
test('prepared lighting variants are reusable only for their exact scene and context identity',()=>{
 const {renderer}=fixture();
 const off='scene=1,context=0,lights=off',low='scene=1,context=0,lights=low';
 assert.equal(hasPreparedVariant(renderer,off),false);
 rememberPreparedVariant(renderer,off);rememberPreparedVariant(renderer,low);
 assert.equal(hasPreparedVariant(renderer,off),true);assert.equal(hasPreparedVariant(renderer,low),true);
 assert.equal(hasPreparedVariant(renderer,'scene=2,context=0,lights=off'),false);
 assert.equal(hasPreparedVariant(renderer,'scene=1,context=1,lights=off'),false);
});
test('context loss and program-list replacement invalidate all recorded readiness',()=>{
 const f=fixture();rememberPreparedVariant(f.renderer,'off');
 f.lose(true);assert.equal(hasPreparedVariant(f.renderer,'off'),false);
 f.lose(false);assert.equal(hasPreparedVariant(f.renderer,'off'),false);
 rememberPreparedVariant(f.renderer,'low');f.renderer.info.programs=[];
 assert.equal(hasPreparedVariant(f.renderer,'low'),false);
});
test('disposal cannot leak ready variants into a new render lifecycle',()=>{
 const {renderer,T}=fixture();rememberPreparedVariant(renderer,'off');disposeRenderPreparation(renderer);
 assert.equal(hasPreparedVariant(renderer,'off'),false);rememberPreparedVariant(renderer,'low');
 registerRenderPreparation(renderer,T);assert.equal(hasPreparedVariant(renderer,'off'),false);assert.equal(hasPreparedVariant(renderer,'low'),false);
});
test('program disposal followed by replacement in the same array invalidates readiness',()=>{
 const {renderer}=fixture(),original={program:{}},replacement={program:{}};
 renderer.info.programs.push(original);const identity=renderer.info.programs;
 rememberPreparedVariant(renderer,'off');
 renderer.info.programs.pop();renderer.info.programs.push(replacement);
 assert.equal(renderer.info.programs,identity);assert.equal(renderer.info.programs.length,1);
 assert.equal(hasPreparedVariant(renderer,'off'),false);
});
test('adding a live program does not discard previously completed variants',()=>{
 const {renderer}=fixture();renderer.info.programs.push({program:{}});
 rememberPreparedVariant(renderer,'off');renderer.info.programs.push({program:{}});
 assert.equal(hasPreparedVariant(renderer,'off'),true);
});
test('readiness history stays bounded when many routes or revisions are prepared',()=>{
 const {renderer}=fixture();
 for(let i=0;i<64;i++)rememberPreparedVariant(renderer,'revision='+i);
 assert.equal(hasPreparedVariant(renderer,'revision=0'),false);assert.equal(hasPreparedVariant(renderer,'revision=47'),false);
 for(let i=48;i<64;i++)assert.equal(hasPreparedVariant(renderer,'revision='+i),true);
});
function renderGuardFixture(){
 const source=readFileSync(new URL('../src/legacy/module-02.mjs?v=9000f422d2f58b6c',import.meta.url),'utf8');
 const begin=source.indexOf('    const shaderVariant=renderPreparationVariant();');
 const end=source.indexOf('    gpuFrameTimer.begin();',begin);
 assert.ok(begin>0&&end>begin);
 const ready=new Set(['A']);
 const context={renderer:{},renderingPreparedVariant:'A',renderingPending:0,renderingFailedVariant:null,
  requested:'A',draws:0,preparations:0,
  renderPreparationVariant:()=>context.requested,hasPreparedVariant:(_renderer,key)=>ready.has(key),
  prepareRendering:()=>{context.renderingPending++;context.preparations++;return Promise.resolve();},
  reportTrackStreamingError:()=>{},gpuFrameTimer:{begin:()=>{context.draws++;}}};
 const render=vm.runInNewContext('(function(){'+source.slice(begin,end)+'gpuFrameTimer.begin();})',context);
 return {context,ready,render};
}
test('rapid A to B to A cannot draw while a primary compile owns shared materials',()=>{
 const {context,render}=renderGuardFixture();
 context.requested='B';render();assert.equal(context.preparations,1);assert.equal(context.draws,0);
 context.requested='A';render();assert.equal(context.draws,0);assert.equal(context.preparations,1);
 context.renderingPending=0;render();assert.equal(context.draws,1);
});
test('return to a live prepared variant draws without scheduling a scene traversal',()=>{
 const {context,render}=renderGuardFixture();context.renderingPreparedVariant='B';
 render();assert.equal(context.draws,1);assert.equal(context.preparations,0);assert.equal(context.renderingPreparedVariant,'A');
});
