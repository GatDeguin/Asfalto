/** Live phone HUD with CSS depth; deliberately creates no WebGL context or model assets. */
function physicalSpeedKmh(){const velocity=globalThis.__cockpit?.raceWorld?.getRenderFrame?.()?.currentSnapshot?.chassis?.linearVelocity;return velocity?Math.hypot(velocity[0],velocity[2])*3.6:null;}
export function createMobileHud({doc=document,win=window,update,readSpeedKmh=physicalSpeedKmh,now=()=>performance.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
 let timer=null,disposed=false,cached=false,updates=0;const body=doc.body,hosts=[...doc.querySelectorAll('.chevy-hud-host')],previous=hosts.map(h=>h.dataset.renderState);
 const style=doc.createElement('link');style.rel='stylesheet';style.href=new URL('../../assets/styles/mobile-hud.css?v=3d6b4ab2d19af356',import.meta.url).href;doc.head.append(style);body.classList.add('an-phone-hud');hosts.forEach(h=>{h.dataset.renderState='mobile';});
 const speed=doc.createElement('div');speed.id='an-mobile-speed';speed.innerHTML='<output id="an-mobile-speed-value" aria-label="Velocidad">—</output><span>km/h</span>';doc.querySelector('#chevy-hud-navigation')?.append(speed);const speedValue=speed.querySelector('output');
 const visible=()=>!disposed&&!cached&&!doc.hidden&&body.classList.contains('v6-driving')&&!body.classList.contains('v6-menu-open')&&!body.classList.contains('an-race-paused');
 function stop(){if(timer!==null)clearTimer(timer);timer=null;}
 function tick(){stop();if(!visible())return;update(now());const velocity=readSpeedKmh(),label=Number.isFinite(velocity)?String(Math.round(Math.abs(velocity))):'—';if(speedValue.textContent!==label)speedValue.textContent=label;updates++;timer=setTimer(tick,50);}
 const onHide=event=>{cached=!!event.persisted;stop();if(!event.persisted)dispose();},onShow=event=>{if(event.persisted){cached=false;tick();}};
 const observer=new win.MutationObserver(tick);observer.observe(body,{attributes:true,attributeFilter:['class']});doc.addEventListener('visibilitychange',tick);win.addEventListener('pagehide',onHide);win.addEventListener('pageshow',onShow);
 function dispose(){if(disposed)return false;disposed=true;stop();observer.disconnect();doc.removeEventListener('visibilitychange',tick);win.removeEventListener('pagehide',onHide);win.removeEventListener('pageshow',onShow);hosts.forEach((h,i)=>{h.dataset.renderState=previous[i]||'';});body.classList.remove('an-phone-hud');speed.remove();style.remove();return true;}
 tick();return{render:tick,dispose,diagnostics:()=>({backend:'dom-mobile',contextCount:0,updates,disposed,cached})};
}
