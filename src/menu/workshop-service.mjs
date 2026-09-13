import {workshopServicePresentation} from './workshop-service-state.mjs';

const notes={engine:'Funcionamiento y potencia del motor.',oil:'Lubricación y conservación del motor.',brakes:'Capacidad de frenado.',tires:'Agarre y desgaste de los neumáticos.',steering:'Precisión y respuesta de la dirección.',suspension:'Apoyo y estabilidad del chasis.',drivetrain:'Transmisión de potencia a las ruedas.',gearbox:'Funcionamiento de la caja de cambios.',body:'Golpes y deformaciones de la carrocería.',paint:'Desgaste de la terminación.',fuel:'Combustible disponible en el tanque.',dirt:'Limpieza exterior. El lavado conserva los golpes y el desgaste de pintura.'};

export function mountWorkshopService({root,game}){
  const page=root.querySelector('[data-workshop-page="condition"]'),grid=root.querySelector('#v6-condition-grid');
  if(!page||!grid)return {refresh(){},dispose(){}};
  let busy=false,disposed=false,lastSignature='',message='';
  const diagnosis=document.createElement('section');diagnosis.className='an-service-diagnosis';
  diagnosis.innerHTML='<p class="an-service-kicker">Diagnóstico del vehículo</p><h3></h3><p class="an-service-faults"></p><p class="an-service-result" role="status" aria-live="polite"></p><button type="button" class="v6-btn an-service-jump" hidden></button>';
  root.querySelector('.an-workshop-vehicle-select').after(diagnosis);grid.classList.add('an-service-grid');
  root.querySelector('#v6-workshop-panel .v6-panel-head p').textContent='Revisá este auto, repará lo necesario y prepará tu próxima salida.';
  page.querySelector('.v6-section-title').textContent='Diagnóstico y reparación';
  const rail=root.querySelector('#v6-workshop-rail');
  const groups=[['Revisar y reparar',['condition']],['Configurar',['mechanics','chassis','tuning']],['Aspecto y archivo',['appearance','photo','history']]];
  for(const [label,tabs] of groups){
    const group=document.createElement('div');group.className='an-workshop-tab-group';group.setAttribute('role','presentation');
    const title=document.createElement('span');title.className='an-workshop-group-label';title.textContent=label;group.append(title);
    for(const id of tabs){const button=rail.querySelector(`[data-workshop-tab="${id}"]`);if(!button)continue;if(id==='condition')button.textContent='Diagnóstico';if(id==='mechanics')button.textContent='Motor y conversiones';group.append(button);}
    rail.append(group);
  }
  const footer=document.createElement('p');footer.className='an-service-note';footer.textContent='Los daños y el combustible se conservan por vehículo. Elegí el servicio que necesita este auto.';grid.after(footer);
  const collection=document.createElement('button');collection.type='button';collection.className='v6-btn an-workshop-collection-link';collection.textContent='Ver colección y trofeos →';
  collection.addEventListener('click',()=>root.querySelector('[data-v6-panel="collection"]')?.click());root.querySelector('[data-workshop-page="history"]').prepend(collection);
  function refresh(){
    if(disposed||root.dataset.anView!=='section'||root.dataset.anPanel!=='workshop')return;
    diagnosis.hidden=root.querySelector('[data-workshop-tab=condition]')?.getAttribute('aria-selected')!=='true';
    const current=game.getVehicleServiceState?.();
    if(!current){diagnosis.querySelector('h3').textContent='Preparando diagnóstico…';return;}
    const view=workshopServicePresentation(current,{busy});
    const signature=JSON.stringify([view,message]);if(signature===lastSignature)return;lastSignature=signature;
    const activeId=grid.contains(document.activeElement)?document.activeElement?.dataset?.v7Service:null;
    const priority=view.services.find(service=>current.faults?.some(fault=>fault.id===service.id)&&!service.disabled),jump=diagnosis.querySelector('.an-service-jump');jump.hidden=!priority;jump.dataset.serviceTarget=priority?.id||'';jump.textContent=priority?`Ir a ${priority.id==='fuel'?'repostar':priority.label.toLowerCase()}`:'';
    diagnosis.dataset.canDrive=String(view.canDrive);diagnosis.querySelector('h3').textContent=view.canDrive?'Listo para salir':'Atención antes de salir';
    diagnosis.querySelector('.an-service-faults').textContent=view.faults.length?view.faults.join(' · '):'Revisá el estado y atendé el desgaste que quieras corregir.';
    diagnosis.querySelector('.an-service-result').textContent=message;page.setAttribute('aria-busy',String(busy));
    grid.replaceChildren();
    for(const [group,label] of [['mechanical','Mecánica y combustible'],['finish','Chapa, pintura y limpieza']]){
      const heading=document.createElement('h4');heading.className='an-service-group-heading';heading.textContent=label;grid.append(heading);
      for(const service of view.services.filter(s=>s.group===group)){
        const card=document.createElement('article');card.className='v6-condition an-service-item';card.dataset.state=service.severity;card.tabIndex=-1;card.setAttribute('aria-label',`${service.label}: ${service.value} %`);
        const head=document.createElement('div');head.className='v6-condition-head';
        const name=document.createElement('span');name.textContent=service.label;const value=document.createElement('b');value.textContent=`${service.value} %`;head.append(name,value);
        const meter=document.createElement('meter');meter.min=0;meter.max=100;meter.low=50;meter.high=78;meter.optimum=100;meter.value=service.value;meter.setAttribute('aria-label',service.id==='dirt'?'Limpieza exterior':service.label);
        const note=document.createElement('p');note.textContent=notes[service.id]||'';
        const action=document.createElement('button');action.type='button';action.className='v6-btn v6-btn-small';action.dataset.v7Service=service.id;action.disabled=service.disabled;
        action.textContent=`${service.action} · ${service.costLabel}`;action.setAttribute('aria-label',`${service.action}: ${service.label}. ${service.costLabel}`);
        card.append(head,meter,note,action);grid.append(card);
      }
    }
    if(activeId)grid.querySelector(`[data-v7-service="${activeId}"]`)?.focus({preventScroll:true});
  }
  async function onService(event){
    const button=event.target.closest('[data-v7-service]');if(!button||busy||button.disabled)return;
    const id=button.dataset.v7Service,vehicleId=game.getVehicleServiceState?.().vehicleId;
    busy=true;message='Realizando servicio…';refresh();
    try{const result=await game.serviceVehicle(id);message=result?.vehicleId===vehicleId?'Servicio completado. Estado actualizado.':'Estado del vehículo actualizado.';}
    catch(error){message=error?.message||'No se pudo completar el servicio. Podés reintentar.';}
    finally{busy=false;refresh();if(!disposed&&game.getVehicleServiceState?.().vehicleId===vehicleId){const current=grid.querySelector(`[data-v7-service="${id}"]`);(current?.disabled?current.closest('article'):current)?.focus({preventScroll:true});}}
  }
  function onSelection(){message='';refresh();}
  function focusRequiredService(){const id=diagnosis.querySelector('.an-service-jump').dataset.serviceTarget,button=grid.querySelector(`[data-v7-service="${id}"]`);button?.closest('article')?.scrollIntoView({block:'center',behavior:'instant'});button?.focus({preventScroll:true});}
  diagnosis.querySelector('.an-service-jump').addEventListener('click',focusRequiredService);
  grid.addEventListener('click',onService);globalThis.addEventListener('asfalto-vehicle-service-changed',refresh);root.querySelector('#v6-workshop-vehicle')?.addEventListener('change',onSelection);
  const api={refresh,dispose(){disposed=true;diagnosis.querySelector('.an-service-jump').removeEventListener('click',focusRequiredService);grid.removeEventListener('click',onService);globalThis.removeEventListener('asfalto-vehicle-service-changed',refresh);root.querySelector('#v6-workshop-vehicle')?.removeEventListener('change',onSelection);if(globalThis.__asfaltoWorkshopService===api)delete globalThis.__asfaltoWorkshopService;}};
  globalThis.__asfaltoWorkshopService=api;refresh();return api;
}
