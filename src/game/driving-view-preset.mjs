import {sanitizeCockpitCalibration} from './vehicle-camera-rig.mjs?v=11b71ce35d0b2e5d';
export const DRIVING_VIEW=Object.freeze({id:'driving',focalLengthMm:24,horizontalFovDeg:2*Math.atan(36/48)*180/Math.PI,eyeOffsetM:Object.freeze([-.22,.12,0])});
export function resolveDrivingView(personal,{selected='personal',editing=false}={}){
 if(selected!=='driving'||editing)return{calibration:personal,eyeOffsetM:[0,0,0],effective:'personal'};
 return{calibration:sanitizeCockpitCalibration({...personal,lensMode:'manual',focalLengthMm:DRIVING_VIEW.focalLengthMm,positionOffsetM:personal.positionOffsetM.map((v,i)=>v+DRIVING_VIEW.eyeOffsetM[i])}),eyeOffsetM:[...DRIVING_VIEW.eyeOffsetM],effective:'driving'};
}
export function installDrivingViewPreset({THREE:T,root=document,storage=globalThis.__asfaltoV7Storage,mount}){
 const key='asfalto-v7-cockpit-view';let selected='personal',cachedPersonal,cachedEditing,cachedSelection,cached;
 try{if(storage?.getItem(key)==='driving')selected='driving';}catch{}
 const rows=[],offset=new T.Vector3(),bodyRotation=new T.Quaternion(),parentRotation=new T.Quaternion();
 for(const group of new Set([...root.querySelectorAll('[data-advanced-graphics-quality]')].map(s=>s.closest('.v6-setting-group')||s.parentElement?.parentElement).filter(Boolean))){
  const label=root.createElement('label');label.className='v6-tech-row';label.textContent='Vista cockpit';const select=root.createElement('select');select.setAttribute('aria-label','Encuadre de conducción');
  for(const [value,text]of [['personal','Mi composición'],['driving','Conducción v7 · 24 mm']]){const option=root.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=selected;const change=()=>setSelected(select.value);select.addEventListener('change',change);label.append(select);group.append(label);rows.push({label,select,change});
 }
 function setSelected(value){selected=value==='driving'?'driving':'personal';for(const r of rows)r.select.value=selected;try{storage?.setItem(key,selected);}catch{}return selected;}
 function resolve(personal,editing=false){if(personal!==cachedPersonal||editing!==cachedEditing||selected!==cachedSelection){cachedPersonal=personal;cachedEditing=editing;cachedSelection=selected;cached=resolveDrivingView(personal,{selected,editing});}return cached;}
 return{resolve,setSelected,getSelected:()=>selected,compensate(snapshot){
  if(!cached||cached.effective==='personal'){mount.position.set(0,0,0);return;}
  offset.fromArray(cached.eyeOffsetM);bodyRotation.fromArray(snapshot?.chassis?.rotation||[0,0,0,1]);offset.applyQuaternion(bodyRotation);
  mount.parent.getWorldQuaternion(parentRotation);offset.applyQuaternion(parentRotation.invert()).negate();mount.position.copy(offset);
 },diagnostics:()=>({selected,effective:cached?.effective||'personal',lens:cached?.effective==='driving'?{focalLengthMm:24,horizontalFovDeg:DRIVING_VIEW.horizontalFovDeg}:null,eyeOffsetM:cached?.eyeOffsetM||[0,0,0],personalSaved:false}),dispose(){mount.position.set(0,0,0);for(const {label,select,change}of rows){select.removeEventListener('change',change);label.remove();}}};
}
