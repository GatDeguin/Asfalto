import {createChassisMechanism,rimNames,tireNames,brakeNames,wheelNames} from './chassis-mechanism.mjs?v=7552609a0f52f6b8';
import {DEFAULT_CHASSIS_CONFIG,sanitizeChassisConfig,chassisConfigFromProfile} from '../game/chassis-configuration.mjs?v=cb4421d5b87d806c';
import {ackermann} from '../game/chassis-lab-physics.mjs?v=9626fb121a066f25';
const IDS=['frontLeft','frontRight','rearLeft','rearRight'];
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const options=names=>names.map((name,i)=>'<option value="'+i+'">'+name+'</option>').join('');
const range=(key,label,min,max,unit)=>'<label class="v6-field"><span>'+label+' <output data-chassis-output="'+key+'"></output></span><input name="workshop-chassis-config-'+key+'" aria-label="'+label+'" data-chassis-config="'+key+'" type="range" min="'+min+'" max="'+max+'" step="1"><small>'+unit+'</small></label>';
export function createWorkshopChassis(T,workshop){
 const page=document.getElementById('v6-workshop-chassis'),menu=document.getElementById('v6-main-menu'),vp=workshop.vehiclePresentation,listeners=[];
 if(!page||!vp)return null;
 let disposed=false,active=false,mechanism=null,mode='car',selected=null,draft=chassisConfigFromProfile(globalThis.__chevyV6Complete?.profile()),saved=globalThis.__chevyV6Complete?.profile()?.chassis||null,dirty=false,environment=null,pointer=null,applying=false,geometrySignature='';
 const settings={...draft,wheel:0,view:'car',steer:0,brake:0,explode:0,demo:false,rpm:24,cut:false,thermal:false,isolated:null,layers:{body:true,tires:true,rims:true,brakes:true,steering:true,suspension:true,hydraulic:true,engine:false}};
 const mount=new T.Group();mount.name='Workshop_Rueda_Direccion_Frenos';mount.visible=false;mount.matrixAutoUpdate=false;vp.root.parent.add(mount);const inspectionLight=new T.DirectionalLight(0xe0edf4,2.2);inspectionLight.visible=false;workshop.scene.add(inspectionLight,inspectionLight.target);
 page.innerHTML='<section class="an-chassis-panel" aria-label="Ruedas, dirección y frenos">'+
 '<div class="an-chassis-heading"><span class="v6-kicker">Laboratorio del tren rodante</span><h3>Ruedas, dirección y frenos</h3><p>Probá combinaciones en el auto, explorá sus piezas y guardá la puesta a punto para conducir.</p></div>'+
 '<div class="an-chassis-views" aria-label="Vistas del conjunto"><button data-chassis-view="car" aria-pressed="true">Auto</button><button data-chassis-view="mechanism" aria-pressed="false">Mecánica</button><button data-chassis-view="wheel" aria-pressed="false">Una rueda</button><button data-chassis-action="fit">Encuadrar</button></div>'+
 '<p class="an-chassis-status" role="status"></p><div class="an-chassis-config">'+
 '<label class="v6-field"><span>Llanta</span><select name="workshop-chassis-config-rim" aria-label="Llanta del conjunto" data-chassis-config="rim">'+options(rimNames)+'</select></label>'+
 '<label class="v6-field"><span>Neumático</span><select name="workshop-chassis-config-tire" aria-label="Neumático del conjunto" data-chassis-config="tire">'+options(tireNames)+'</select></label>'+
 '<label class="v6-field"><span>Frenos</span><select name="workshop-chassis-config-kit" aria-label="Kit de frenos" data-chassis-config="kit">'+options(brakeNames)+'</select></label>'+
 '<p class="an-chassis-compound"></p><details open><summary>Presión, dirección y reparto</summary><div class="an-chassis-grid">'+
 range('frontPressure','Presión delantera',24,38,'psi')+range('rearPressure','Presión trasera',24,40,'psi')+
 range('steerRatio','Relación de dirección',14,22,'Menor relación: respuesta más directa')+range('brakeBias','Reparto delantero',52,68,'% del par de frenado')+
 '</div><label class="v6-switch"><span>Dirección asistida</span><input name="workshop-chassis-config-steeringAssist" data-chassis-config="steeringAssist" type="checkbox"></label><label class="v6-switch"><span>ABS</span><input name="workshop-chassis-config-abs" data-chassis-config="abs" type="checkbox"></label></details></div>'+
 '<div class="an-chassis-save"><button class="v6-btn v6-btn-primary" data-chassis-action="apply">Aplicar al auto</button><button class="v6-btn" data-chassis-action="revert">Descartar</button><button class="v6-btn" data-chassis-action="stock">Base clásica</button></div>'+
 '<details class="an-chassis-inspector"><summary>Inspeccionar y accionar</summary><label class="v6-field"><span>Rueda de inspección</span><select name="workshop-chassis-wheel" aria-label="Rueda de inspección" data-chassis-wheel>'+options(wheelNames)+'</select></label>'+
 '<div class="an-chassis-grid"><label class="v6-field"><span>Giro <output data-motion-output="steer">0°</output></span><input name="workshop-chassis-motion-steer" aria-label="Giro de inspección" data-chassis-motion="steer" type="range" min="-34" max="34" value="0"></label><label class="v6-field"><span>Pedal de freno <output data-motion-output="brake">0%</output></span><input name="workshop-chassis-motion-brake" aria-label="Pedal de inspección" data-chassis-motion="brake" type="range" min="0" max="100" value="0"></label></div>'+
 '<label class="v6-field"><span>Despiece <output data-motion-output="explode">0%</output></span><input name="workshop-chassis-motion-explode" aria-label="Despiece del tren rodante" data-chassis-motion="explode" type="range" min="0" max="100" value="0"></label>'+
 '<div class="an-chassis-views"><button data-chassis-action="cut" aria-pressed="false">Corte</button><button data-chassis-action="spin" aria-pressed="false">Girar ruedas</button><button data-chassis-action="reset">Restaurar vista</button></div>'+
 '<div class="an-chassis-layers"><label><input name="workshop-chassis-layer-tires" type="checkbox" data-chassis-layer="tires" checked> Neumáticos</label><label><input name="workshop-chassis-layer-rims" type="checkbox" data-chassis-layer="rims" checked> Llantas</label><label><input name="workshop-chassis-layer-brakes" type="checkbox" data-chassis-layer="brakes" checked> Frenos</label><label><input name="workshop-chassis-layer-steering" type="checkbox" data-chassis-layer="steering" checked> Dirección</label><label><input name="workshop-chassis-layer-hydraulic" type="checkbox" data-chassis-layer="hydraulic" checked> Hidráulica</label><label><input name="workshop-chassis-layer-suspension" type="checkbox" data-chassis-layer="suspension" checked> Suspensión</label></div>'+
 '<label class="v6-field"><span>Buscar pieza</span><input name="workshop-chassis-part-search" type="search" aria-label="Buscar pieza del tren rodante" placeholder="Disco, zapata, bieleta…"></label><div class="an-chassis-parts" aria-label="Piezas del tren rodante"></div>'+
 '<h4 class="an-chassis-part-title">Conjunto mecánico</h4><p class="an-chassis-part-description">Elegí una pieza en el modelo o en la lista.</p><div class="an-chassis-views"><button data-chassis-action="hide" disabled>Ocultar</button><button data-chassis-action="isolate" disabled>Aislar</button><button data-chassis-action="all">Mostrar todo</button></div><p class="an-chassis-note">El despiece y el movimiento del pedal son vistas de inspección. Solo “Aplicar al auto” guarda la configuración.</p></details></section>';
 const panel=page.firstElementChild,$=s=>panel.querySelector(s),$$=s=>[...panel.querySelectorAll(s)];
 const on=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
 const announce=text=>{$('.an-chassis-status').textContent=text;};
 const shouldBeActive=()=>!disposed&&workshop.active&&page.classList.contains('v6-active')&&document.getElementById('v6-workshop-panel').classList.contains('v6-active')&&menu.dataset.anView!=='home';
 function syncFields(){
  for(const input of $$('[data-chassis-config]')){const key=input.dataset.chassisConfig;if(input.type==='checkbox')input.checked=draft[key];else input.value=draft[key];}
  for(const output of $$('[data-chassis-output]')){const key=output.dataset.chassisOutput;output.textContent=draft[key]+(key==='steerRatio'?':1':key==='brakeBias'?'%':' psi');}
  $('.an-chassis-compound').textContent=['Radial clásico: referencia equilibrada para ruta.','Deportivo: más agarre en seco; menor tolerancia a ripio y agua.','Semislick: mayor agarre en seco; pierde eficacia con lluvia y sobre ripio.','Turismo / lluvia: prioriza superficies mojadas y uso de ruta.'][draft.tire];
  $('[data-chassis-action=revert]').disabled=!dirty;
 }
 function select(part){selected=part||null;$('.an-chassis-part-title').textContent=selected?.label||'Conjunto mecánico';$('.an-chassis-part-description').textContent=selected?.description||'Elegí una pieza en el modelo o en la lista.';for(const a of ['hide','isolate'])$('[data-chassis-action='+a+']').disabled=!selected;$('[data-chassis-action=hide]').textContent=selected?.hidden?'Mostrar':'Ocultar';filterParts();}
 function filterParts(){
  const search=normalize($('input[type=search]').value),list=$('.an-chassis-parts');list.replaceChildren();
  for(const part of mechanism?.parts||[]){if(mode==='wheel'&&part.wheel!==settings.wheel)continue;if(!normalize(part.label).includes(search))continue;const b=document.createElement('button');b.type='button';b.dataset.chassisPart=part.id;b.textContent=part.label;b.setAttribute('aria-pressed',String(part===selected));b.classList.toggle('is-hidden',part.hidden);list.append(b);}
 }
 function setEnvironment(){const next=workshop.presentation?.getRoomEnvironment()||null;if(!mechanism||next===environment)return;environment=next;mechanism.root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){m.envMap=next;m.envMapIntensity=.8;m.needsUpdate=true;}});}
 function ensureMechanism(){
  if(mechanism)return mechanism;
  vp.root.updateMatrix();mount.matrix.multiplyMatrices(vp.root.matrix,vp.getChassisInspectionMatrix());mechanism=createChassisMechanism(T,{settings,sourceWheels:vp.getChassisSourceWheels()});mount.add(mechanism.root);geometrySignature=[settings.rim,settings.tire,settings.kit,settings.cut].join(':');environment=undefined;setEnvironment();filterParts();return mechanism;
 }
 function rebuild(){if(!mechanism)return;const signature=[settings.rim,settings.tire,settings.kit,settings.cut].join(':');if(signature===geometrySignature)return;geometrySignature=signature;select(null);settings.isolated=null;mechanism.buildWheels();environment=undefined;setEnvironment();filterParts();}
 function preview(){Object.assign(settings,draft);vp.setChassisConfig(draft);rebuild();dirty=JSON.stringify(draft)!==JSON.stringify(saved||chassisConfigFromProfile(globalThis.__chevyV6Complete?.profile()));syncFields();workshop.rayTracing?.invalidate();}
 function setMode(value,frame=true){
  mode=['car','mechanism','wheel'].includes(value)?value:'car';settings.view=mode==='wheel'?'wheel':'car';
  if(mode!=='car'){ensureMechanism();mechanism.applyViews();}
  mount.visible=active&&mode!=='car';vp.root.visible=!mount.visible;if(mode==='car')workshop.camera.clearViewOffset();
  for(const b of $$('[data-chassis-view]'))b.setAttribute('aria-pressed',String(b.dataset.chassisView===mode));filterParts();if(frame)fit();
 }
 function fit(part=null){
  if(!active)return;if(mode==='car'){workshop.focus('general');return;}
  const box=new T.Box3();mount.updateWorldMatrix(true,true);
  if(part)box.setFromObject(part.node);else mechanism.root.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;box.expandByObject(o);});
  if(box.isEmpty())return;
  const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),fov=workshop.camera.fov*Math.PI/180,half=Math.min(fov/2,Math.atan(Math.tan(fov/2)*workshop.camera.aspect));
  const rect=workshop.canvas.getBoundingClientRect(),nav=document.getElementById('v6-menu-sidebar').getBoundingClientRect(),reserved=innerWidth>720?Math.max(0,nav.right-rect.left+20):0;const availableHalf=Math.min(half,Math.atan(Math.tan(fov/2)*Math.max(.25,(rect.width-reserved)/rect.height)));const radius=Math.max(.65,size.length()*.53/Math.sin(availableHalf));workshop.camera.setViewOffset(rect.width,rect.height,-reserved/2,0,rect.width,rect.height);
  const direction=new T.Vector3(-.45,.35,settings.wheel%2===0?.9:-.9).transformDirection(mount.matrixWorld);
  workshop.hotspots.chassisDetail={target:center.toArray(),radius,pitch:Math.asin(direction.y),yaw:Math.atan2(direction.x,direction.z)};workshop.focus('chassisDetail');
 }
 function resetView(){Object.assign(settings,{steer:0,brake:0,explode:0,demo:false,cut:false,isolated:null});for(const k of Object.keys(settings.layers))settings.layers[k]=true;if(mechanism){for(const part of mechanism.parts)part.hidden=false;rebuild();mechanism.applyViews();}for(const input of $$('[data-chassis-motion]'))input.value=0;for(const o of $$('[data-motion-output]'))o.textContent=o.dataset.motionOutput==='steer'?'0°':'0%';for(const input of $$('[data-chassis-layer]'))input.checked=true;for(const a of ['spin','cut'])$('[data-chassis-action='+a+']').setAttribute('aria-pressed','false');vp.setChassisInspection(null);select(null);}
 function setActive(value){
  value=!!value;if(disposed||active===value)return;active=value;
  if(active){saved=globalThis.__chevyV6Complete?.profile()?.chassis||null;draft=chassisConfigFromProfile(globalThis.__chevyV6Complete?.profile());Object.assign(settings,draft);dirty=false;syncFields();announce(saved?'Configuración aplicada · lista para inspeccionar.':'Configuración clásica · elegí los cambios para previsualizar.');setMode('car',false);}
  else {mechanism?.dispose();mechanism=null;environment=null;resetView();vp.setChassisConfig(saved);vp.setChassisInspection(null);vp.root.visible=true;mount.visible=false;inspectionLight.visible=false;workshop.camera.clearViewOffset();dirty=false;}
 }
 async function apply(){
  if(applying)return;applying=true;$('[data-chassis-action=apply]').disabled=true;
  try{const result=await globalThis.__chevyV6Complete.setChassisConfig(draft);if(disposed)return;saved=result;draft={...result};dirty=false;syncFields();announce('Configuración guardada y aplicada al auto y a la conducción.');}
  catch(error){if(!disposed)announce('No se pudo aplicar: '+error.message);}
  finally{applying=false;if(!disposed)$('[data-chassis-action=apply]').disabled=false;}
 }
 on(panel,'input',event=>{
  const input=event.target,key=input.dataset.chassisConfig;
  if(key){const next={...draft,[key]:input.type==='checkbox'?input.checked:Number(input.value)};if(key==='rim')next.kit=Math.min(next.kit,next.rim);draft=sanitizeChassisConfig(next);preview();announce(key==='kit'&&draft.rim>next.rim?'Se aumentó la llanta para alojar el kit. Cambios sin guardar.':'Previsualización · cambios sin guardar.');}
  const motion=input.dataset.chassisMotion;
  if(motion){settings[motion]=Number(input.value)/(motion==='steer'?1:100);$('[data-motion-output='+motion+']').textContent=input.value+(motion==='steer'?'°':'%');if(mode==='car'&&motion!=='steer')setMode('wheel');}
  const layer=input.dataset.chassisLayer;if(layer){settings.layers[layer]=input.checked;if(mode==='car')setMode('mechanism');mechanism.applyViews();}
 });
 on($('[data-chassis-motion=explode]'),'change',()=>fit());
 on($('[data-chassis-wheel]'),'change',e=>{settings.wheel=Number(e.target.value);if(mode==='car')setMode('wheel');else{mechanism.applyViews();filterParts();fit();}});
 on($('input[type=search]'),'input',()=>{if(mode==='car')setMode('wheel');filterParts();});
 on(panel,'click',event=>{
  const partId=event.target.closest('[data-chassis-part]')?.dataset.chassisPart;if(partId){select(mechanism.parts.find(p=>p.id===partId));return;}
  const view=event.target.closest('[data-chassis-view]')?.dataset.chassisView;if(view){setMode(view);return;}
  const action=event.target.closest('[data-chassis-action]')?.dataset.chassisAction;if(!action)return;
  if(action==='apply'){void apply();return;}
  if(action==='revert'){draft=chassisConfigFromProfile(globalThis.__chevyV6Complete.profile());preview();if(!saved)vp.setChassisConfig(null);announce('Cambios descartados.');return;}
  if(action==='stock'){draft={...DEFAULT_CHASSIS_CONFIG};preview();announce('Base clásica en previsualización. Aplicá para guardarla.');return;}
  if(action==='fit'){fit();return;}if(action==='reset'){resetView();fit();return;}
  if(mode==='car')setMode('wheel');
  if(action==='cut'){settings.cut=!settings.cut;rebuild();$('[data-chassis-action=cut]').setAttribute('aria-pressed',String(settings.cut));}
  if(action==='spin'){settings.demo=!settings.demo;$('[data-chassis-action=spin]').setAttribute('aria-pressed',String(settings.demo));}
  if(action==='hide'&&selected){selected.hidden=!selected.hidden;mechanism.applyViews();select(selected);}
  if(action==='isolate'&&selected){settings.isolated=selected.id;mechanism.applyViews();fit(selected);}
  if(action==='all'){settings.isolated=null;for(const p of mechanism.parts)p.hidden=false;for(const k of Object.keys(settings.layers))settings.layers[k]=true;for(const i of $$('[data-chassis-layer]'))i.checked=true;mechanism.applyViews();select(null);fit();}
 });
 const ray=new T.Raycaster();
 on(workshop.canvas,'pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,button:e.button};});
 on(workshop.canvas,'pointercancel',()=>{pointer=null;});
 on(workshop.canvas,'pointerup',e=>{const start=pointer;pointer=null;if(!active||mode==='car'||!start||start.button!==0||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const rect=workshop.canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),workshop.camera);const hit=ray.intersectObject(mount,true).find(h=>{if(h.object.userData.pickable===false)return false;for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return !!h.object.userData.part;});if(hit)select(hit.object.userData.part);});
 on(window,'chevy:vehicle-config',()=>{if(disposed)return;saved=globalThis.__chevyV6Complete?.profile()?.chassis||null;if(!active||!dirty){draft=chassisConfigFromProfile(globalThis.__chevyV6Complete?.profile());Object.assign(settings,draft);syncFields();rebuild();}vp.setChassisConfig(active&&dirty?draft:saved);});
 syncFields();vp.setChassisConfig(saved);setActive(shouldBeActive());
 return {setActive,fit,get root(){return mount;},get mechanism(){return mechanism;},
  update(dt){if(disposed)return;setActive(shouldBeActive());if(!active)return;
   // Only inspection inputs enter this display snapshot; driving input is untouched.
   const angles=ackermann(settings.steer);vp.setChassisInspection({wheels:IDS.map((id,i)=>({id,steerAngleRad:i<2?(i===0?angles.left:angles.right):0,rotationRad:0}))});
   inspectionLight.visible=mode!=='car';if(mode!=='car'){mechanism.update(dt);setEnvironment();mount.visible=true;vp.root.visible=false;if(workshop.engine?.root)workshop.engine.root.visible=false;inspectionLight.position.copy(workshop.camera.position);inspectionLight.target.position.copy(workshop.target);}
  },
  diagnostics:()=>({active,mode,dirty,applying,configuration:{...draft},applied:saved?{...saved}:null,selected:selected?.id||null,mechanism:mechanism?.diagnostics()||null,disposed}),
  dispose(){if(disposed)return;setActive(false);disposed=true;listeners.splice(0).forEach(off=>off());mechanism?.dispose();mount.removeFromParent();inspectionLight.removeFromParent();inspectionLight.target.removeFromParent();inspectionLight.dispose();panel.remove();}
 };
}
