export function createRaceOpeningOverlay({onSkip,canSkip=()=>true,root=document.body}={}){
 const element=document.createElement('div');element.className='an-race-opening';element.hidden=true;
 const veil=document.createElement('div');veil.className='an-race-opening-veil';const caption=document.createElement('div');caption.className='an-race-opening-caption';
 const label=document.createElement('span');label.textContent='ASFALTO NACIONAL';const title=document.createElement('strong');const button=document.createElement('button');button.type='button';button.textContent='Saltar presentación · Enter';const skip=()=>{if(canSkip())onSkip();};button.addEventListener('click',skip);caption.append(label,title,button);element.append(veil,caption);root.append(element);
 let visible=false;const key=e=>{if(visible&&e.code==='Enter'&&!e.repeat&&canSkip()&&!document.body.classList.contains('v6-menu-open')){e.preventDefault();onSkip();}};window.addEventListener('keydown',key);
 return {update(state,name=''){visible=state.blocking;document.body.classList.toggle('an-race-opening-active',state.blocking);element.hidden=!state.active;veil.style.opacity=String(state.opacity);caption.hidden=!state.blocking;title.textContent=name;},dispose(){window.removeEventListener('keydown',key);button.removeEventListener('click',skip);document.body.classList.remove('an-race-opening-active');element.remove();}};
}
