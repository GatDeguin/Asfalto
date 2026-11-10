import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script=readFileSync(new URL('../src/menu/loading-presentation.js?v=4d87de17b02eb284',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(t){
 t.mock.timers.enable({apis:['setTimeout']});
 const plays=[];
 class Element extends EventTarget{
  constructor(){
   super();
   const classes=new Set();
   this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
   this.children=[];this.dataset={};this.nodes=new Map();this.attributes=new Map();
   this.style={setProperty(){},removeProperty(){}};
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  getClientRects(){return [{}];}
  get isConnected(){return true;}
  focus(){}
  setAttribute(key,value){this.attributes.set(key,value);}
  getAttribute(key){return this.attributes.get(key);}
  hasAttribute(key){return key==='src'?Boolean(this.src):this.attributes.has(key);}
  removeAttribute(key){if(key==='src')this.src='';else this.attributes.delete(key);}
  querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key);}
  querySelectorAll(key){
   if(key!=='video')return [];
   return [new Element(),new Element()].map(video=>Object.assign(video,{
    readyState:2,paused:true,load(){},pause(){this.paused=true;},play(){plays.push(this.src);this.paused=false;return Promise.resolve();}
   }));
  }
 }
 const body=new Element();
 const document=Object.assign(new EventTarget(),{body,hidden:false,readyState:'loading',
  currentScript:{src:'https://asfalto.test/src/menu/loading-presentation.js'},createElement:()=>new Element()});
 const scope={document,window:new EventTarget(),HTMLElement:Element,URL,navigator:{},setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,matchMedia:()=>Object.assign(new EventTarget(),{matches:false}),getComputedStyle:()=>({visibility:'visible'}),
  __asfaltoModalInert:{acquire:()=>()=>{}}};
 runInNewContext(script,scope);
 let finish;
 const departure=new Promise(resolve=>{finish=resolve;});
 const outer=scope.__asfaltoLoading.begin('Salida','Preparando auto',{track:'dos_lagos',departure});
 return {outer,finish,plays,begin:scope.__asfaltoLoading.begin,get overlay(){return body.children[0];}};
}

test('route preparation nested inside the garage departure cannot start the loading film',async t=>{
 const f=fixture(t);
 f.outer.departureStage('Levantando la cortina…','gate');
 const nested=f.begin('Ruta','Cargando terreno',{track:'dos_lagos'});
 await flush();
 assert.equal(f.overlay.dataset.departure,'true');
 assert.equal(f.overlay.dataset.departurePhase,'gate');
 assert.equal(f.plays.length,0);
 await nested.end();
 assert.equal(f.overlay.dataset.departurePhase,'gate');
});

test('a quick handoff from the garage finishes before starting a decoder',async t=>{
 const f=fixture(t);
 f.finish();await flush();
 assert.equal(f.overlay.dataset.handoff,'true');
 assert.equal(f.plays.length,0);
 const closing=f.outer.end();
 t.mock.timers.tick(1000);await closing;
 assert.equal(f.plays.length,0);
 assert.equal(f.overlay.hidden,true);
});

test('a pending load starts the film once the garage handoff window expires',async t=>{
 const f=fixture(t);
 f.finish();await flush();
 t.mock.timers.tick(499);
 assert.equal(f.plays.length,0);
 t.mock.timers.tick(1);await flush();
 assert.equal(f.overlay.dataset.departure,undefined);
 assert.equal(f.overlay.dataset.handoff,undefined);
 assert.equal(f.plays.length,1);
 assert.match(f.plays[0],/dos-lagos\.mp4$/);
 const closing=f.outer.end();
 t.mock.timers.tick(360);await closing;
 assert.equal(f.overlay.hidden,true);
});
