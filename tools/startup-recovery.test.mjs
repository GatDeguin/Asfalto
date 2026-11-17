import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getEventListeners} from 'node:events';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const guard=scripts.find(match=>/\bid=["']asfalto-startup-recovery["']/.test(match[1]));

// Only DOM and navigation are substituted; every test executes the shipped inline script.
function fixture({parsed=true}={}){
 let reloads=0,timers=0;
 class Element extends EventTarget{
  constructor(tagName,id=''){
   super();this.tagName=tagName.toUpperCase();this.id=id;this.children=[];this.parentNode=null;
   this.attributes=new Map();this.style={};this.hidden=false;this.disabled=false;this.inert=false;this.text='';
   const classes=new Set();this.classList={add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)};
  }
  get textContent(){return this.text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this.text=String(value);for(const child of this.children)child.parentNode=null;this.children=[];}
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  removeAttribute(name){this.attributes.delete(name);}
  closest(selector){for(let element=this;element;element=element.parentNode)if(selector==='[inert]'&&element.inert)return element;return null;}
  focus(){
   if(this.closest('[inert]'))return;
   document.activeElement=this;
   const event=new Event('focusin');Object.defineProperty(event,'target',{value:this});window.dispatchEvent(event);
  }
 }
 const cover=new Element('div','loading'),status=new Element('p','loading-text');
 cover.classList.add('an-boot-cover');cover.setAttribute('aria-busy','true');
 status.textContent='Preparando el taller…';status.setAttribute('role','status');status.setAttribute('aria-live','polite');cover.append(status);
 const document=Object.assign(new EventTarget(),{
  readyState:parsed?'interactive':'loading',activeElement:null,
  getElementById(id){if(this.readyState==='loading')return null;return id==='loading'?cover:id==='loading-text'?status:null;},
  createElement:tagName=>new Element(tagName),
 });
 const window=Object.assign(new EventTarget(),{document,location:{reload(){reloads++;}}});
 const scope={window,document,location:window.location,setTimeout(){timers++;return timers;},clearTimeout(){}};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(scope,key,{get(){throw new Error('Recovery must not touch saved data');}});
 runInNewContext(guard?.[2]||'',scope,{filename:'index.html#asfalto-startup-recovery'});
 function dispatch(type,properties={}){
  const event=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value});
  window.dispatchEvent(event);return event;
 }
 const allNodes=()=>[cover,status,...status.children,...cover.children.filter(node=>node!==status)];
 return {window,document,cover,status,dispatch,Element,
  resourceError(tagName='script'){return dispatch('error',{target:new Element(tagName)});},
  parse(){document.readyState='interactive';document.dispatchEvent(new Event('readystatechange'));},
  get buttons(){return allNodes().filter(node=>node.tagName==='BUTTON');},
  get reloads(){return reloads;},get timers(){return timers;},
 };
}

test('recovery installs inline before all requested scripts, without another network dependency',()=>{
 assert.ok(guard,'The early recovery guard is missing');
 assert.equal(scripts[0],guard);
 assert.doesNotMatch(guard[1],/\b(?:src|async|defer)\b|\btype=["']module["']/i);
});

test('a failed module graph exposes one accessible retry inside the existing boot cover',()=>{
 const f=fixture();const event=f.resourceError();
 assert.equal(f.buttons.length,1,'A failed script must offer a retry');
 assert.equal(f.cover.hidden,false);assert.equal(f.cover.getAttribute('aria-busy'),'false');
 assert.equal(f.status.getAttribute('role'),'status');assert.equal(f.status.getAttribute('aria-live'),'polite');
 assert.match(f.status.textContent,/problema|interrump|no se pudo/i);
 const button=f.buttons[0];assert.equal(button.textContent,'Reintentar');assert.equal(button.type,'button');
 assert.equal(f.document.activeElement,button);assert.equal(event.defaultPrevented,false);
 f.resourceError();assert.equal(f.buttons.length,1);assert.equal(f.reloads,0);
 button.dispatchEvent(new Event('click'));assert.equal(f.reloads,1);
});

test('a script failure before the splash is parsed appears without waiting for deferred modules',()=>{
 const f=fixture({parsed:false});f.resourceError();assert.equal(f.buttons.length,0);
 f.parse();assert.equal(f.buttons.length,1);
});

test('uncaught script execution and rejected startup promises also offer recovery',()=>{
 for(const [type,properties] of [['error',{message:'Unexpected token',error:new SyntaxError('Unexpected token')}],['unhandledrejection',{reason:new TypeError('Failed to fetch dynamically imported module')}]]){
  const f=fixture();const event=f.dispatch(type,properties);
  assert.equal(f.buttons.length,1,type);assert.equal(event.defaultPrevented,false);
 }
});

test('slow loading and failed optional media never announce a startup failure or reload',()=>{
 const f=fixture();for(const tag of ['img','video','audio','link'])f.resourceError(tag);
 assert.equal(f.status.textContent,'Preparando el taller…');assert.equal(f.buttons.length,0);
 assert.equal(f.cover.getAttribute('aria-busy'),'true');assert.equal(f.timers,0);assert.equal(f.reloads,0);
});

test('a late menu mount cannot steal recovery focus or trap Tab behind the splash',()=>{
 const f=fixture();f.resourceError();const retry=f.buttons[0],menuButton=new f.Element('button','v6-tab-drive');
 menuButton.focus();assert.equal(f.document.activeElement,retry,'The menu mounts after the module error and tries to focus Conducir');
 for(const shiftKey of [false,true]){
  const event=f.dispatch('keydown',{key:'Tab',shiftKey});
  assert.equal(event.defaultPrevented,true);assert.equal(f.document.activeElement,retry);
 }
 const description=f.status.children.find(node=>node.id===retry.getAttribute('aria-describedby'));
 assert.ok(description,'Retry must reference its explanation');assert.match(description.textContent,/problema|interrump|no se pudo/i);
 assert.equal(f.dispatch('keydown',{key:'Enter'}).defaultPrevented,false,'Native keyboard activation must remain available');
 assert.equal(f.reloads,0);
});

test('recovery yields focus and Tab to a modal that owns the inert splash, then resumes after release',()=>{
 const f=fixture();f.resourceError();const retry=f.buttons[0],introSkip=new f.Element('button','intro-skip');
 f.cover.inert=true;introSkip.focus();assert.equal(f.document.activeElement,introSkip);
 for(const shiftKey of [false,true])assert.equal(f.dispatch('keydown',{key:'Tab',shiftKey}).defaultPrevented,false,'The intro must receive its own keyboard events');
 assert.equal(f.cover.inert,true,'Recovery must not release another owner\'s inert state');
 f.cover.inert=false;introSkip.focus();assert.equal(f.document.activeElement,retry);
 f.dispatch('asfalto-home-ready');introSkip.focus();assert.equal(f.document.activeElement,introSkip);
});

test('editor suppression is owned once per failed startup and removed at home readiness',()=>{
 const f=fixture(),styles=()=>f.cover.children.filter(node=>node.tagName==='STYLE');
 f.resourceError();assert.equal(styles().length,1,'The editor must not cover the recovery surface');
 for(let index=0;index<5;index++)f.resourceError();assert.equal(styles().length,1,'Repeated module errors must not accumulate styles');
 f.dispatch('asfalto-home-ready');assert.equal(styles().length,0);
 f.resourceError();assert.equal(styles().length,0,'Later race errors cannot hide the editor');
});

test('home readiness removes recovery and every listener, including its old retry action',()=>{
 const f=fixture();f.resourceError();const button=f.buttons[0];assert.ok(button);
 f.dispatch('asfalto-home-ready');
 assert.equal(f.buttons.length,0);assert.equal(f.cover.hidden,true);assert.equal(f.cover.classList.contains('hidden'),true);
 assert.doesNotMatch(f.status.textContent,/Reintentar|problema|interrump/i);
 for(const type of ['error','unhandledrejection','asfalto-home-ready','focusin','keydown'])assert.equal(getEventListeners(f.window,type).length,0,type);
 assert.equal(getEventListeners(f.document,'readystatechange').length,0);
 button.dispatchEvent(new Event('click'));assert.equal(f.reloads,0);
 f.resourceError();f.dispatch('unhandledrejection',{reason:new Error('Later race failure')});
 assert.equal(f.buttons.length,0);assert.equal(f.cover.hidden,true);
 const menuButton=new f.Element('button','v6-tab-drive');menuButton.focus();
 assert.equal(f.document.activeElement,menuButton);assert.equal(f.dispatch('keydown',{key:'Tab'}).defaultPrevented,false);
});

test('readiness also cancels a failure queued before the DOM exists',()=>{
 const f=fixture({parsed:false});f.resourceError();f.dispatch('asfalto-home-ready');f.parse();
 assert.equal(f.buttons.length,0);assert.equal(getEventListeners(f.window,'error').length,0);
 assert.equal(getEventListeners(f.document,'readystatechange').length,0);
});
