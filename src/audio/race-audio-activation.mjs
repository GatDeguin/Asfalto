// Browser audio permission is retried directly in the click, never after a timer.
export function installRaceAudioActivation({document:doc=globalThis.document,getState,isDriving,isEnabled,activate,setInterval:every=globalThis.setInterval,clearInterval:clear=globalThis.clearInterval}={}){
 const button=doc.createElement('button');button.type='button';button.className='an-race-audio-activate';button.textContent='Activar sonido';button.hidden=true;
 button.style.cssText='position:fixed;z-index:220;right:max(16px,env(safe-area-inset-right));top:calc(74px + env(safe-area-inset-top));min-height:44px;padding:8px 14px;border:1px solid #ffffff40;border-radius:6px;background:#15191bd9;color:#eee9df;font:12px/1.3 system-ui;touch-action:manipulation;cursor:pointer';
 doc.body.append(button);let disposed=false;
 function refresh(){if(disposed)return;const state=getState();button.hidden=!isEnabled()||!isDriving()||(state.started&&state.contextState==='running');}
 function click(){if(disposed)return;let attempt;try{attempt=activate();}catch{refresh();return;}Promise.resolve(attempt).then(refresh,refresh);}
 button.addEventListener('click',click);doc.addEventListener('visibilitychange',refresh);const timer=every(refresh,1000);refresh();
 return {refresh,dispose(){if(disposed)return;disposed=true;clear(timer);button.removeEventListener('click',click);doc.removeEventListener('visibilitychange',refresh);button.remove();}};
}
