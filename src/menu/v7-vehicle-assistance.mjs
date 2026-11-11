import {createRolloverDetector} from '../game/rollover-detection.mjs?v=1cf152a1e215f4e6';

export function mountVehicleAssistance({document=globalThis.document,onRecover,onWorkshop}){
 const node=document.createElement('section');
 node.className='v7-vehicle-assistance';
 node.hidden=true;
 node.innerHTML=`<div class="v7-assistance-card">
   <span class="v7-assistance-eyebrow"></span>
   <h2 id="v7-assistance-title"></h2>
   <p id="v7-assistance-description"></p>
   <ul class="v7-assistance-faults" hidden></ul>
   <button type="button"></button>
 </div>`;
 const eyebrow=node.querySelector('span'),title=node.querySelector('h2'),copy=node.querySelector('p');
 const additional=node.querySelector('ul'),button=node.querySelector('button'),detector=createRolloverDetector();
 let mode=null,faults=[],busy=false,focusBefore=null,background=[],offroadSeconds=0;
 const link=document.createElement('link');link.rel='stylesheet';
 link.href=new URL('../../assets/styles/vehicle-assistance.css?v=56e4bfb8a1890d59',import.meta.url).href;
 document.head.append(link);document.body.append(node);

 function hide(){
  node.hidden=true;mode=null;faults=[];offroadSeconds=0;detector.reset();
  node.removeAttribute('aria-modal');delete node.dataset.mode;delete node.dataset.cause;
  for(const [element,inert] of background)element.inert=inert;
  background=[];document.body.classList.remove('an-vehicle-fault-open');
  if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
  focusBefore=null;
 }
 function show(next){
  if(mode===next&&next!=='fault')return;
  const fault=next==='fault',warning=next==='warning',first=faults[0];
  if(fault&&mode!=='fault'){
   focusBefore=document.activeElement;
   background=[...document.body.children].filter(element=>element!==node).map(element=>[element,element.inert]);
   for(const [element] of background)element.inert=true;
   document.body.classList.add('an-vehicle-fault-open');
  }
  mode=next;node.dataset.mode=next;
  if(first)node.dataset.cause=first.code||first.id;
  else delete node.dataset.cause;
  node.setAttribute('role',fault?'alertdialog':warning?'alert':'region');
  node.setAttribute('aria-labelledby',title.id);
  node.setAttribute('aria-describedby',copy.id);
  if(fault)node.setAttribute('aria-modal','true');
  else node.removeAttribute('aria-modal');
  eyebrow.textContent=fault?'VUELTA AL TALLER':warning?'AVERÍA CRÍTICA':'ASISTENCIA EN RUTA';
  title.textContent=fault||warning?first?.label||'Avería crítica':next==='offroad'?'Te saliste de la pista':'El auto quedó volcado';
  copy.textContent=warning?'La marcha se interrumpirá en unos segundos.':fault?first?.detail||'Revisá el auto en el taller antes de volver a salir.':'Pedí asistencia para volver a un punto seguro. Se conserva el daño y se aplica la penalización de recuperación.';
  const rows=fault?faults.slice(1).map(item=>{const li=document.createElement('li');li.textContent=item.label;return li;}):[];
  additional.replaceChildren(...rows);additional.hidden=rows.length===0;
  button.hidden=warning;
  button.textContent=fault?'Volver al taller':'Volver al circuito';
  node.hidden=false;
  if(fault)button.focus({preventScroll:true});
 }
 const click=async()=>{
  if(busy||mode==='warning'||!mode)return;
  const action=mode==='fault'?onWorkshop:onRecover;
  busy=true;button.disabled=true;
  try{await action?.();hide();}finally{button.disabled=false;busy=false;}
 };
 button.addEventListener('click',click);
 const key=e=>{
  if(mode!=='fault'||!['Tab','Escape'].includes(e.key))return;
  e.preventDefault();e.stopImmediatePropagation();button.focus();
 };
 document.addEventListener('keydown',key,true);
 return{
  preview(value){faults=value;show('warning');},
  fault(value){faults=value;show('fault');},
  update(input={}){
   if(mode==='fault'||mode==='warning')return;
   const result=detector.update(input);
   const offroad=['RUNNING','PAUSED'].includes(input.status)&&typeof input.surface==='string'&&input.surface.length>0&&!['asphalt','curb'].includes(input.surface);
   if(!offroad)offroadSeconds=0;
   else if(input.status==='RUNNING')offroadSeconds+=Number.isFinite(input.dt)?Math.max(0,input.dt):0;
   if(result.rolledOver)show('rollover');
   else if(offroad&&offroadSeconds>=5)show('offroad');
   else if(mode==='rollover'||mode==='offroad')hide();
  },
  hide,diagnostics:()=>({mode,faults,offroadSeconds,detector:detector.diagnostics()}),
  dispose(){hide();node.remove();link.remove();document.removeEventListener('keydown',key,true);},
 };
}
