import {createRolloverDetector} from '../game/rollover-detection.mjs';
export function mountVehicleAssistance({document=globalThis.document,onRecover,onWorkshop}){
 const node=document.createElement('section');node.className='v7-vehicle-assistance';node.hidden=true;node.setAttribute('role','region');node.setAttribute('aria-label','Asistencia en ruta');
 node.innerHTML='<div><span class="v7-assistance-eyebrow">ASISTENCIA EN RUTA</span><h2></h2><p></p><button type="button"></button></div>';
 const title=node.querySelector('h2'),copy=node.querySelector('p'),button=node.querySelector('button'),detector=createRolloverDetector();let mode=null,faults=[],busy=false,focusBefore=null;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../../assets/styles/vehicle-assistance.css',import.meta.url).href;document.head.append(link);document.body.append(node);
 function hide(){node.hidden=true;mode=null;node.removeAttribute('aria-modal');node.setAttribute('role','region');detector.reset();if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});focusBefore=null;}
 function show(next){if(mode===next)return;mode=next;node.hidden=false;node.dataset.mode=next;const broken=next==='fault';node.setAttribute('role',broken?'alertdialog':'region');if(broken){node.setAttribute('aria-modal','true');focusBefore=document.activeElement;}
  title.textContent=broken?'El auto necesita volver al taller':'El auto quedó volcado';copy.textContent=broken?faults.map(f=>f.label).join(' · '):'Podés solicitar asistencia para volver a un punto seguro del circuito. Se conserva el daño y se aplica la penalización de recuperación.';button.textContent=broken?'Volver al taller':'Volver al circuito';if(broken)button.focus({preventScroll:true});
 }
 const click=async()=>{if(busy)return;busy=true;button.disabled=true;try{if(mode==='fault')await onWorkshop?.();else await onRecover?.();hide();}finally{button.disabled=false;busy=false;}};
 button.addEventListener('click',click);
 const key=e=>{if(mode==='fault'&&e.key==='Tab'){e.preventDefault();button.focus();}if(mode==='fault'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();button.focus();}};
 document.addEventListener('keydown',key,true);
 return{fault(value){faults=value;show('fault');},update(input){if(mode==='fault')return;const result=detector.update(input);if(result.rolledOver)show('rollover');else if(mode==='rollover')hide();},hide,diagnostics:()=>({mode,faults,detector:detector.diagnostics()}),dispose(){node.remove();link.remove();document.removeEventListener('keydown',key,true);}};
}
