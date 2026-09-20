import { detectDeviceProfile } from '../performance/mobile-device-profile.mjs?v=f090574cb3e87b2d';

const ZERO = Object.freeze({ active:false, throttle:0, brake:0, clutch:0, handbrake:0 });
const HOLDS = new Set(['throttle','brake','clutch','handbrake']);
const PEDALS = new Set(['throttle','brake']);
const BLOCKED_CLASSES = ['v6-menu-open','an-intro-open','an-race-pause-visible','an-race-pause-open','editor-mode-active','race-menu-open','race-results-open'];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

/** Merge one additional input source without changing desktop, physics or assists. */
export function mergeMobileDrivingInput(base, mobile = ZERO) {
  if (!mobile.active) return base;
  return {
    ...base,
    throttle: Math.max(base.throttle || 0,mobile.throttle),
    brake: Math.max(base.brake || 0,mobile.brake),
    clutch: Math.max(base.clutch || 0,mobile.clutch),
    handbrake: Math.max(base.handbrake || 0,mobile.handbrake),
  };
}

/** Touch-only DOM controller; host retains the authoritative gate and gear validation. */
export function createMobileDrivingControls({
  document: doc = globalThis.document,
  events = globalThis,
  deviceProfile = detectDeviceProfile(),
  readContext = () => ({}),
  requestGear = () => false,
  setTransmissionMode = () => {},
  pause = () => {},
  beginInspection = () => {},
  cycleInspection = () => {},
  returnToCockpit = () => {},
  resume = () => {},
  releaseSteering = () => {},
  recover = () => {},
  onGesture = () => {},
} = {}) {
  if (!deviceProfile.phone) return Object.freeze({
    sample:()=>ZERO, canDrive:()=>true, refresh:()=>{}, releaseAll:()=>{}, dispose:()=>{},
    diagnostics:()=>({phone:false,disposed:false,pointers:0}),
  });
  if (!doc?.body) throw new TypeError('A document with a body is required.');
  const layer=doc.createElement('section');
  layer.id='an-mobile-driving-controls';
  layer.setAttribute('aria-label','Controles táctiles de conducción');
  layer.hidden=true;
  layer.innerHTML='<div class="an-mobile-deck"><div class="an-mobile-tools"><button type="button" data-mobile-command="pause">Pausa</button><details class="an-mobile-secondary"><summary>Mandos</summary><div class="an-mobile-secondary-panel"><p class="an-mobile-status" role="status" aria-live="polite"></p><nav class="an-mobile-commands" aria-label="Acciones de carrera"><button type="button" data-mobile-command="camera">Vista exterior</button><button type="button" data-mobile-command="recover">Recuperar</button><button type="button" data-mobile-command="mode" aria-label="Cambiar modo de transmisión">Manual</button></nav><div class="an-mobile-gears" aria-label="Caja de cambios"><button type="button" data-mobile-gear="R" aria-label="Marcha atrás">R</button><button type="button" data-mobile-gear="N" aria-label="Punto muerto">N</button><button type="button" data-mobile-gear="down" aria-label="Bajar una marcha">−</button><output class="an-mobile-gear" aria-label="Marcha actual">N</output><button type="button" data-mobile-gear="up" aria-label="Subir una marcha">+</button></div><div class="an-mobile-aux-pedals"><button type="button" data-mobile-hold="clutch" aria-label="Pisar embrague">EMBRAGUE</button><button type="button" data-mobile-hold="handbrake" aria-label="Freno de mano">F.M.</button><div class="an-mobile-rpm"><span>RPM</span><output aria-label="Revoluciones por minuto" aria-live="off">—</output></div></div></div></details></div><div class="an-mobile-pedals" aria-label="Pedales"><button type="button" data-mobile-hold="brake" aria-label="Freno">FRENO</button><button type="button" data-mobile-hold="throttle" aria-label="Acelerador">GAS</button></div></div>';
  doc.body.append(layer);
  const hadMarker=doc.body.classList.contains('an-phone-controls');
  doc.body.classList.add('an-phone-controls');
  const buttons=[...layer.querySelectorAll('button')],holds=buttons.filter(b=>b.dataset.mobileHold);
  const status=layer.querySelector('.an-mobile-status'),gearOutput=layer.querySelector('.an-mobile-gear'),rpmOutput=layer.querySelector('.an-mobile-rpm output'),secondary=layer.querySelector('details');
  const owners=new Map(),listeners=[];
  let disposed=false,inspecting=false,lastMode=null,lastGate=false,lastUiSignature=null;
  function listen(target,type,fn,options){if(!target?.addEventListener)return;target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
  function read(){
    let ctx;
    try{ctx=readContext()||{};}catch{ctx={};}
    const visible=!disposed&&!doc.hidden&&!layer.inert&&doc.body.classList.contains('v6-driving')
      &&!BLOCKED_CLASSES.some(c=>doc.body.classList.contains(c))
      &&doc.querySelector('#settings-panel')?.hidden!==false;
    const presentationHeld=!!ctx.presentationHeld;
    const active=visible&&!presentationHeld&&!ctx.blockDriving&&ctx.status==='RUNNING'&&!inspecting&&ctx.cameraMode==='cockpit';
    const canPause=visible&&!presentationHeld&&['RUNNING','COUNTDOWN'].includes(ctx.status);
    return {...ctx,visible:visible&&!presentationHeld,active,canPause,inspectionActive:inspecting&&visible&&!presentationHeld&&ctx.status==='PAUSED',manual:ctx.transmissionMode!=='automatic',maxGear:clamp(Math.trunc(ctx.forwardGears)||4,1,5)};
  }
  function active(action){for(const owner of owners.values())if(owner.action===action)return true;return false;}
  function paintHolds(){for(const button of holds){const held=active(button.dataset.mobileHold);if(button.classList.contains('active')!==held)button.classList.toggle('active',held);if(button.getAttribute('aria-pressed')!==String(held))button.setAttribute('aria-pressed',String(held));}}
  function releaseAll(){
    if(!owners.size)return;
    const captured=[...owners];owners.clear(); // Native release can synchronously emit lostpointercapture.
    for(const [id,owner]of captured)try{if(owner.button.hasPointerCapture?.(id))owner.button.releasePointerCapture?.(id);}catch{}
    paintHolds();
  }
  function release(event){
    const owner=owners.get(event.pointerId);if(!owner)return;
    owners.delete(event.pointerId);
    try{if(owner.button.hasPointerCapture?.(event.pointerId))owner.button.releasePointerCapture?.(event.pointerId);}catch{}
    paintHolds();
  }
  function refresh(){
    if(disposed)return;
    const ctx=read();
    if(!ctx.active||(lastMode!==null&&lastMode!==ctx.manual))releaseAll();
    if(lastGate&&!ctx.active)releaseSteering();
    lastGate=ctx.active;lastMode=ctx.manual;
    // Refresh this small readout independently of the gear/gate signature, only while visible.
    if(ctx.visible&&secondary.open){const rpm=Number.isFinite(ctx.rpm)&&ctx.rpm>=0?String(Math.round(ctx.rpm)):'—';if(rpmOutput.textContent!==rpm)rpmOutput.textContent=rpm;}
    const signature=[ctx.visible,ctx.active,ctx.canPause,ctx.inspectionActive,ctx.manual,ctx.maxGear,ctx.gear,ctx.requestedGear].join('|');
    if(signature===lastUiSignature)return ctx;
    lastUiSignature=signature;
    if(layer.hidden===ctx.visible)layer.hidden=!ctx.visible;
    for(const button of buttons){
      let enabled=ctx.active;
      if(button.dataset.mobileCommand==='pause')enabled=ctx.canPause||ctx.inspectionActive;
      if(button.dataset.mobileCommand==='camera')enabled=ctx.active||ctx.inspectionActive;
      if(button.dataset.mobileGear||button.dataset.mobileHold==='clutch')enabled=enabled&&ctx.manual;
      if(button.dataset.mobileGear==='up')enabled=enabled&&(['N','R'].includes(String(ctx.requestedGear||ctx.gear))||Number(ctx.requestedGear||ctx.gear)<ctx.maxGear);
      if(button.dataset.mobileGear==='down')enabled=enabled&&String(ctx.requestedGear||ctx.gear)!=='R';
      if(button.disabled===enabled)button.disabled=!enabled;
    }
    const mode=layer.querySelector('[data-mobile-command=mode]'),label=ctx.manual?'Manual':'Automático';
    if(mode.textContent!==label)mode.textContent=label;
    const pauseButton=layer.querySelector('[data-mobile-command=pause]'),cameraButton=layer.querySelector('[data-mobile-command=camera]');
    const pauseLabel=ctx.inspectionActive?'Volver a conducir':'Pausa',cameraLabel=ctx.inspectionActive?'Cambiar vista':'Vista exterior';
    if(pauseButton.textContent!==pauseLabel)pauseButton.textContent=pauseLabel;
    if(cameraButton.textContent!==cameraLabel)cameraButton.textContent=cameraLabel;
    const gear=String(ctx.gear||'N');if(gearOutput.textContent!==gear)gearOutput.textContent=gear;
    return ctx;
  }
  function gesture(){try{Promise.resolve(onGesture()).catch(()=>{});}catch{}}
  function onDown(event){
    const button=event.target.closest?.('[data-mobile-hold]');if(!button||!layer.contains(button))return;
    const action=button.dataset.mobileHold,ctx=refresh();
    if(!ctx?.active||button.disabled||!HOLDS.has(action)||(event.button!=null&&event.button!==0)||owners.has(event.pointerId))return;
    event.preventDefault();event.stopPropagation();gesture();
    try{button.setPointerCapture?.(event.pointerId);}catch{return;}
    owners.set(event.pointerId,{action,button,pedal:PEDALS.has(action)});paintHolds();
  }
  function onMove(event){
    const owner=owners.get(event.pointerId);if(!owner?.pedal)return;
    if(!read().active){releaseAll();return;}
    event.preventDefault();event.stopPropagation();
    const hit=doc.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-mobile-hold]');
    const next=hit&&layer.contains(hit)&&!hit.disabled&&PEDALS.has(hit.dataset.mobileHold)?hit.dataset.mobileHold:null;
    if(owner.action!==next){owner.action=next;paintHolds();}
  }
  function say(text){status.textContent=text;secondary.open=true;status.parentElement.scrollTop=0;}
  function onClick(event){
    const button=event.target.closest?.('button');if(!button||!layer.contains(button))return;
    event.preventDefault();event.stopPropagation();
    const ctx=refresh();if(button.disabled||!ctx)return;
    if(button.dataset.mobileHold)return;
    gesture();
    const command=button.dataset.mobileCommand;
    if(command==='pause'&&ctx.inspectionActive){
      releaseAll();releaseSteering();returnToCockpit();
      if(read().cameraMode!=='cockpit'){say('No se pudo volver al cockpit. La carrera sigue en pausa.');return;}
      inspecting=false;layer.querySelector('details').open=false;resume();refresh();return;
    }
    if(command==='pause'&&ctx.canPause){releaseAll();pause();refresh();return;}
    if(command==='camera'&&ctx.inspectionActive){releaseAll();releaseSteering();cycleInspection();refresh();return;}
    if(!ctx.active)return;
    if(command==='camera'){
      releaseAll();releaseSteering();inspecting=true;
      let entered=false;
      try{entered=beginInspection();}catch{}
      if(entered===false||read().status!=='PAUSED'){inspecting=false;say('No se pudo pausar para cambiar de vista.');refresh();return;}
      layer.querySelector('details').open=false;refresh();return;
    }
    if(command==='recover'){releaseAll();recover();refresh();return;}
    if(command==='mode'){releaseAll();setTransmissionMode(ctx.manual?'automatic':'manual');say('Transmisión '+(ctx.manual?'automática.':'manual.'));refresh();return;}
    if(!ctx.manual||!button.dataset.mobileGear)return;
    let target=button.dataset.mobileGear;
    const current=String(ctx.requestedGear||ctx.gear||'N');
    if(target==='up')target=String(current==='N'||current==='R'?1:Math.min(ctx.maxGear,Number(current)+1));
    if(target==='down')target=current==='N'||current==='1'?'N':String(Math.max(1,Number(current)-1));
    const accepted=requestGear(target); // Existing host guards reverse, speed, gear count and shift timing.
    say(accepted?'Marcha solicitada: '+target+'.':'No se puede engranar esa marcha ahora.');
    refresh();
  }
  function lifecycle(){releaseAll();releaseSteering();const ctx=read();if(ctx.status==='RUNNING'&&ctx.cameraMode==='cockpit')inspecting=false;refresh();}
  listen(layer,'pointerdown',onDown,{passive:false});listen(layer,'pointermove',onMove,{passive:false});listen(layer,'pointerup',release);
  listen(layer,'pointercancel',release);listen(layer,'lostpointercapture',release);
  listen(secondary,'toggle',refresh);
  listen(layer,'click',onClick);listen(layer,'contextmenu',event=>event.preventDefault());
  listen(events,'blur',lifecycle);listen(events,'pagehide',lifecycle);
  listen(events,'orientationchange',lifecycle);listen(events,'resize',lifecycle);
  listen(events.visualViewport,'resize',lifecycle);
  listen(doc,'visibilitychange',lifecycle);
  listen(events,'asfalto:race-state',lifecycle);listen(events,'asfalto:race-settings',lifecycle);
  listen(events,'asfalto:cockpit-settings',lifecycle);
  const Observer=doc.defaultView?.MutationObserver||globalThis.MutationObserver;
  const observer=Observer?new Observer(refresh):null;
  observer?.observe(doc.body,{attributes:true,attributeFilter:['class','inert']});
  refresh();
  return {
    refresh,releaseAll,canDrive:()=>read().active,
    sample(){
      const ctx=refresh();if(!ctx?.active||!owners.size)return ZERO;
      const frame={active:true,throttle:Number(active('throttle')),brake:Number(active('brake')),clutch:ctx.manual?Number(active('clutch')):0,handbrake:Number(active('handbrake'))};
      return frame.throttle||frame.brake||frame.clutch||frame.handbrake?frame:ZERO;
    },
    diagnostics:()=>({phone:true,disposed,inspecting,pointers:owners.size,visible:!layer.hidden,gate:lastGate}),
    dispose(){
      if(disposed)return;
      releaseAll();releaseSteering();disposed=true;observer?.disconnect();
      for(const remove of listeners.splice(0))remove();
      layer.remove();if(!hadMarker)doc.body.classList.remove('an-phone-controls');
    },
  };
}
