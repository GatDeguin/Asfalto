export function createRaceOpeningOverlay({onSkip,canSkip=()=>true,root=document.body}={}){
 const element=document.createElement('div');element.className='an-race-opening';element.hidden=true;
 const veil=document.createElement('div');veil.className='an-race-opening-veil';veil.setAttribute('aria-hidden','true');
 const caption=document.createElement('section');caption.className='an-race-opening-caption';caption.setAttribute('aria-labelledby','an-race-opening-title');
 const label=document.createElement('span');label.textContent='PRESENTACIÓN DEL CIRCUITO';
 const title=document.createElement('strong');title.id='an-race-opening-title';
 const button=document.createElement('button');button.type='button';button.textContent='Saltar';
 button.setAttribute('aria-label','Saltar presentación del circuito');button.setAttribute('aria-keyshortcuts','Enter');
 const shortcut=document.createElement('kbd');shortcut.textContent='Enter';shortcut.setAttribute('aria-hidden','true');button.append(shortcut);
 let visible=false;
 const available=()=>visible&&canSkip()&&!document.body.classList.contains('v6-menu-open')&&!document.body.classList.contains('an-loading-open');
 const skip=()=>{if(available())onSkip();};
 const key=e=>{if(e.code==='Enter'&&!e.repeat&&available()){e.preventDefault();onSkip();}};
 button.addEventListener('click',skip);window.addEventListener('keydown',key);
 caption.hidden=true;caption.append(label,title,button);element.append(veil,caption);root.append(element);
 return {
  update(state,name=''){
   if(visible!==state.blocking){
    const hadFocus=document.activeElement===button;
    visible=state.blocking;document.body.classList.toggle('an-race-opening-active',visible);caption.hidden=!visible;
    if(!visible&&hadFocus)document.querySelector('#viewport canvas')?.focus({preventScroll:true});
   }
   if(element.hidden===state.active)element.hidden=!state.active;
   if(visible&&title.textContent!==name)title.textContent=name;
   const opacity=String(state.opacity);if(veil.style.opacity!==opacity)veil.style.opacity=opacity;
  },
  dispose(){window.removeEventListener('keydown',key);button.removeEventListener('click',skip);document.body.classList.remove('an-race-opening-active');element.remove();}
 };
}
