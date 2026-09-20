/** Garage interaction owns only presentation and camera focus, never the saved cockpit. */
export function createWorkshopInspection(T,workshop,{root=document.getElementById('v6-main-menu')}={}) {
  const records=[],owned=[],listeners=[];let hood=0,targetHood=0,disposed=false;
  const listen=(o,event,fn)=>{o.addEventListener(event,fn);listeners.push(()=>o.removeEventListener(event,fn));};
  const reduced=()=>document.body.classList.contains('v6-reduce-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const photo=root.querySelector('[data-workshop-page="photo"]'),mechanics=root.querySelector('[data-workshop-page="mechanics"]');
  const controls=document.createElement('div');controls.className='v6-form-grid an-garage-photo-controls';
  controls.innerHTML='<label class="v6-field"><span>Iluminación</span><select name="workshop-photo-lighting" aria-label="Iluminación del taller"><option value="day">Luz de ventana</option><option value="night">Taller de noche</option></select></label><label class="v6-field"><span>Encuadre</span><select name="workshop-photo-framing" aria-label="Encuadre fotográfico"><option value="free">Libre</option><option value="opening">El taller despierta · 35 mm</option><option value="portrait">Retrato de la Chevy · 50 mm</option><option value="mechanical">Mecánica · 85 mm</option></select></label>';
  photo.querySelector('.v6-form-grid').after(controls);owned.push(controls);
  const light=controls.querySelector('[aria-label="Iluminación del taller"]'),preset=controls.querySelector('[aria-label="Encuadre fotográfico"]');
  listen(light,'change',()=>workshop.presentation.setLighting(light.value));
  const hoodButton=document.createElement('button');hoodButton.type='button';hoodButton.className='v6-btn an-hood-control';hoodButton.textContent='Abrir capó · inspeccionar motor';hoodButton.setAttribute('aria-expanded','false');mechanics.prepend(hoodButton);owned.push(hoodButton);
  const overlay=document.createElement('div');overlay.className='an-component-points';root.append(overlay);owned.push(overlay);
  function visible(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
  const specs=[{key:'engine',label:'Motor',pattern:/engine.*(block|head)|engineblock|CylinderHead/i},{key:'wheel',label:'Tren delantero',pattern:/frontLeft/i},{key:'interior',label:'Habitáculo',pattern:/seat|steering|dashboard|Vehicle_Interior/i}];
  const bounds=new T.Box3(),position=new T.Vector3(),projected=new T.Vector3();
  for(const spec of specs){let object=null;workshop.vehiclePresentation.root.traverse(o=>{if(!object&&o.isMesh&&visible(o)){const names=[];for(let p=o;p&&p!==workshop.vehiclePresentation.root;p=p.parent)names.push(p.name);if(spec.pattern.test(names.join(' ')))object=o;}});if(!object)continue;
    const button=document.createElement('button');button.type='button';button.className='an-component-point';button.setAttribute('aria-label','Inspeccionar '+spec.label);button.innerHTML='<i></i><span>'+spec.label+'</span>';overlay.append(button);records.push({...spec,object,button});listen(button,'click',()=>{focus(spec.key);workshop.focus(spec.key);});}
  function updateTargets(){workshop.car.updateWorldMatrix(true,true);for(const record of records){bounds.setFromObject(record.object);bounds.getCenter(position);const old=workshop.hotspots[record.key];workshop.hotspots[record.key]={...old,target:position.toArray(),radius:record.key==='interior'?2.5:record.key==='engine'?3.0:2.5,yaw:record.key==='wheel'?-.85:record.key==='engine'?-1.1:-.55,pitch:record.key==='engine'?.42:.12};}}
  function setHood(value){targetHood=value?1:0;hoodButton.textContent=value?'Cerrar capó':'Abrir capó · inspeccionar motor';hoodButton.setAttribute('aria-expanded',String(!!value));}
  function focus(key){updateTargets();setHood(key.startsWith('engine'));}
  listen(hoodButton,'click',()=>{setHood(!targetHood);if(targetHood){updateTargets();workshop.focus('engine');}});
  listen(root,'click',event=>{const tab=event.target.closest('[data-workshop-tab]');if(tab){if(tab.dataset.workshopTab==='mechanics'){setHood(true);updateTargets();workshop.focus('engine');}else if(tab.dataset.workshopTab!=='photo')setHood(false);}});
  listen(preset,'change',()=>{
    if(preset.value==='free')return;updateTargets();workshop.camera.clearViewOffset();const box=new T.Box3().setFromObject(workshop.car),center=box.getCenter(new T.Vector3()),floor=workshop.car.userData.surfaceY??box.min.y;
    if(preset.value==='mechanical'){workshop.setLens(85);setHood(true);workshop.focus('engine');workshop.targetPose.radius=3.8;root.querySelector('#v6-photo-lens').value='85';root.querySelector('#v6-photo-focus').value='engine';return;}
    const opening=preset.value==='opening',mm=opening?35:50,height=floor+(opening?.98:1.05),radius=opening?8.4:7.2,targetY=floor+.86;
    workshop.setLens(mm);setHood(false);workshop.hotspots.storyboard={yaw:opening?-.92:-1.08,pitch:Math.asin((height-targetY)/radius),radius,target:[center.x,targetY,center.z]};workshop.focus('storyboard',reduced());root.querySelector('#v6-photo-lens').value=String(mm);root.querySelector('#v6-photo-focus').value='general';
  });
  updateTargets();
  return {
    focus,
    update(dt){if(disposed)return;hood=reduced()?targetHood:hood+(targetHood-hood)*(1-Math.exp(-Math.max(0,dt)*5));if(Math.abs(targetHood-hood)<.001)hood=targetHood;workshop.vehiclePresentation.setHoodOpen(hood);workshop.engine?.setHood(hood);workshop.engine?.update(dt);
      const inspect=root.dataset.anInspection==='true';overlay.hidden=!inspect;if(!inspect)return;
      const canvas=workshop.canvas.getBoundingClientRect(),container=root.getBoundingClientRect();workshop.camera.updateMatrixWorld();
      for(const record of records){bounds.setFromObject(record.object);bounds.getCenter(position);projected.copy(position).project(workshop.camera);const x=canvas.left-container.left+(projected.x*.5+.5)*canvas.width,y=canvas.top-container.top+(.5-projected.y*.5)*canvas.height;
        record.button.hidden=!visible(record.object)||projected.z<0||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1||(record.key==='engine'&&hood<.75);record.button.style.transform=`translate(${x}px,${y}px)`;}
    },
    diagnostics:()=>({hood,targetHood,lighting:light.value,photoPreset:preset.value,points:records.map(r=>({key:r.key,object:r.object.name})),reference:'GUION.md / shot 01: 35 mm, low view; exact camera height not supplied, reconstructed at 0.98 m above floor'}),
    dispose(){if(disposed)return;disposed=true;listeners.forEach(f=>f());owned.forEach(o=>o.remove());},
  };
}
