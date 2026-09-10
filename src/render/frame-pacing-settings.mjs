const KEY='asfalto-v7-presentation-fps';
export function installFramePacingSettings({root=document,storage=globalThis.__asfaltoV7Storage}={}){
 let fps=60;try{fps=Number(storage?.getItem(KEY))===30?30:60;}catch{}
 const rows=[];
 for(const group of new Set([...root.querySelectorAll('[data-advanced-graphics-quality]')].map(s=>s.closest('.v6-setting-group')||s.parentElement?.parentElement).filter(Boolean))){
  const label=root.createElement('label');label.className='v6-tech-row';label.textContent='Fluidez';
  const select=root.createElement('select');select.setAttribute('aria-label','Límite de presentación');select.dataset.v7FrameRate='';
  for(const [value,text]of [[60,'60 FPS'],[30,'30 FPS estable']]){const option=root.createElement('option');option.value=String(value);option.textContent=text;select.append(option);}
  select.value=String(fps);const change=()=>setTargetFps(Number(select.value));select.addEventListener('change',change);label.append(select);group.append(label);rows.push({label,select,change});
 }
 function setTargetFps(value){fps=value===30?30:60;try{storage?.setItem(KEY,String(fps));}catch{}for(const {select}of rows)select.value=String(fps);return fps;}
 return {getTargetFps:()=>fps,setTargetFps,dispose(){for(const {label,select,change}of rows){select.removeEventListener('change',change);label.remove();}}};
}
