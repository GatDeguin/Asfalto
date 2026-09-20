import {createLightingPresetStore} from '../game/lighting-preset-file.mjs?v=08f05a1bfa379595';
import {lightingPresetKey,sanitizeLightingOverrides,LUT_DEFAULTS} from '../game/lighting-presets.mjs?v=746ea306bd370d04';
import {captureLightingState,captureVehicleLightingState,mergeLightingState,applyLightingState} from '../render/lighting-preview.mjs?v=ba3ba040d167357f';
const types={HemisphereLight:'Hemisférica',DirectionalLight:'Direccional',AmbientLight:'Ambiente',PointLight:'Puntual',SpotLight:'Proyector',RectAreaLight:'Área'};
export function createLightingEditor({scene,renderer,getLights,getEffectiveFogState=()=>null,getVehicles=()=>({}),setLut=()=>{},document:doc=document,store=createLightingPresetStore()}={}){
 const host=doc.querySelector('#settings-panel .settings-scroll');let context=null,base=null,overrides={},lights=[],values=null,disposed=false,active=false,lutEntries=[];
 const section=doc.createElement('section');section.className='settings-section an-lighting-editor';section.id='lighting-settings-section';
 section.innerHTML='<details data-lighting-section><summary>Iluminación</summary><p class="an-lighting-context">Preparando el ambiente de la carrera…</p><p class="editor-tip">Cada circuito, HDRI y clima conserva sus propios ajustes. Los cambios se ven al instante y se guardan automáticamente.</p><div data-lighting-fields></div><div class="an-lighting-actions"><button type="button" data-lighting-save>Guardar ahora</button><button type="button" data-lighting-reset>Restaurar iluminación</button></div></details><details data-lut-section><summary>LUTs y color</summary><p class="editor-tip">El color se aplica a la escena y al cockpit. Se guarda junto a la iluminación de esta combinación.</p><div data-lut-fields></div><button type="button" data-lut-reset>Restaurar color</button></details><p data-lighting-status role="status" aria-live="polite">Cargando ajustes…</p>';
 const composition=host.querySelector('#editor-settings-section');composition?composition.before(section):host.append(section);
 const fieldHost=section.querySelector('[data-lighting-fields]'),lutHost=section.querySelector('[data-lut-fields]'),status=section.querySelector('[data-lighting-status]');
 const refs=new Map(),vehicleStatus=new Map(),listeners=[];let vehicleValues={};const on=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
 const at=(object,path)=>path.reduce((value,key)=>value?.[key],object);
 function write(path,value){let object=overrides;for(const key of path.slice(0,-1))object=object[key]??={};object[path.at(-1)]=value;}
 function removeOverride(path){const chain=[overrides];for(const key of path.slice(0,-1)){const child=chain.at(-1)?.[key];if(!child)return;chain.push(child);}delete chain.at(-1)[path.at(-1)];for(let i=chain.length-1;i>0;i--){if(Object.keys(chain[i]).length)break;delete chain[i-1][path[i-1]];}}
 function field(parent,path,label,{min=0,max=10,step=.01,type='number',options,slider=false}={}){
  const vehicle=path[0]==='vehicles',separateLabel=vehicle||slider,row=doc.createElement(separateLabel?'div':'label');row.className='an-lighting-field';const span=doc.createElement(separateLabel?'label':'span');span.textContent=label;row.append(span);let input;
  if(options){input=doc.createElement('select');for(const [value,text]of options){const option=doc.createElement('option');option.value=value;option.textContent=text;input.append(option);}}
  else{input=doc.createElement('input');input.type=type;if(type==='number'){input.min=min;input.max=max;input.step=step;input.inputMode='decimal';}}
  input.setAttribute('aria-label',label);input.dataset.lightingPath=path.join('.');input.id='an-lighting-'+path.join('-');input.name=input.id;if(separateLabel)span.htmlFor=input.id;row.append(input);
  let range=null;
  if(slider){row.classList.add('an-lighting-slider');range=doc.createElement('input');range.type='range';range.id=input.id+'-range';range.name=input.name+'-range';range.min=String(min);range.max=String(max);range.step=String(step);range.setAttribute('aria-label',label+' · deslizador');range.dataset.lightingSlider=path.join('.');row.append(range);on(range,'input',()=>{input.value=range.value;input.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));});}
  let automatic=null,effective=null;
  if(vehicle){
   effective=doc.createElement('small');effective.id=input.id+'-effective';effective.dataset.lightingEffective=path.join('.');effective.style.gridColumn='1';row.append(effective);input.setAttribute('aria-describedby',effective.id);
   automatic=doc.createElement('button');automatic.type='button';automatic.textContent='Automático';automatic.dataset.lightingAuto=path.join('.');automatic.setAttribute('aria-label','Usar ajuste automático: '+label);row.append(automatic);
   on(automatic,'click',()=>{if(!active)return;removeOverride(path);apply();store.set(context,overrides);syncInputs();});
  }
  parent.append(row);refs.set(path.join('.'),{input,path,range,automatic,effective});
  on(input,type==='color'||type==='number'?'input':'change',()=>{if(!active)return;let value=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;if(type==='number'&&(input.value===''||!Number.isFinite(value)||value<min||value>max))return;
   if(typeof path.at(-1)==='number'){const vectorPath=path.slice(0,-1),vector=[...at(values,vectorPath)];vector[path.at(-1)]=value;write(vectorPath,vector);}else write(path,value);
   try{overrides=sanitizeLightingOverrides(overrides);apply();if(range){range.value=String(at(values,path));range.setAttribute('aria-valuetext',String(at(values,path)));}store.set(context,overrides);if(vehicle)syncVehicleInputs();}catch(error){status.textContent=error.message;}
  });return input;
 }
 function group(parent,label){const el=doc.createElement('details');el.className='an-lighting-group';const summary=doc.createElement('summary');summary.textContent=label;el.append(summary);parent.append(el);return el;}
 function numeric(parent,path,label,min,max,step=.01){return field(parent,path,label,{min,max,step,slider:path[0]==='hdri'});}
 function vector(parent,path,label,min,max,step){for(let i=0;i<3;i++)numeric(parent,[...path,i],label+' '+['X','Y','Z'][i],min,max,step);}
 function build(){for(const remove of listeners.splice(0))remove();refs.clear();vehicleStatus.clear();fieldHost.replaceChildren();lutHost.replaceChildren();
  const h=group(fieldHost,'HDRI y exposición');h.open=true;
  numeric(h,['hdri','backgroundIntensity'],'Brillo del fondo HDRI',0,20,.001);numeric(h,['hdri','environmentIntensity'],'Luz ambiental del HDRI',0,20,.00001);numeric(h,['hdri','exposure'],'Exposición',.001,16,.001);numeric(h,['hdri','backgroundBlurriness'],'Desenfoque del HDRI',0,1,.01);
  vector(h,['hdri','rotation'],'Rotación del fondo',-180,180,1);vector(h,['hdri','environmentRotation'],'Rotación de la luz HDRI',-180,180,1);
  for(const {id,label,object}of lights){const root=group(fieldHost,label+' · '+(types[object.type]||object.type)),path=['lights',id],s=base.lights[id];field(root,[...path,'enabled'],'Activar '+label,{type:'checkbox'});numeric(root,[...path,'intensity'],'Intensidad de '+label,0,object.isPointLight||object.isSpotLight?100000:20,.001);field(root,[...path,'color'],'Color de '+label,{type:'color'});if(s.groundColor)field(root,[...path,'groundColor'],'Color del suelo de '+label,{type:'color'});vector(root,[...path,'position'],'Posición de '+label,-100000,100000,.1);if(s.target)vector(root,[...path,'target'],'Destino de '+label,-100000,100000,.1);
   if(s.distance!==undefined)numeric(root,[...path,'distance'],'Alcance de '+label,0,2000,1);if(s.decay!==undefined)numeric(root,[...path,'decay'],'Caída de '+label,0,4,.1);if(s.angleDeg!==undefined)numeric(root,[...path,'angleDeg'],'Apertura de '+label,1,89,.1);if(s.penumbra!==undefined)numeric(root,[...path,'penumbra'],'Penumbra de '+label,0,1,.01);
   if(s.castShadow!==undefined){field(root,[...path,'castShadow'],'Sombras de '+label,{type:'checkbox'});numeric(root,[...path,'shadowBias'],'Sesgo de sombra de '+label,-.05,.05,.00001);numeric(root,[...path,'shadowNormalBias'],'Separación de sombra de '+label,0,2,.001);}
  }
  for(const id of ['player','rival']){const label=id==='player'?'Faros del auto':'Faros del rival',root=group(fieldHost,label+' · Proyectores'),path=['vehicles',id];const live=doc.createElement('p');live.className='editor-tip';live.dataset.lightingVehicle=id;root.append(live);vehicleStatus.set(id,live);field(root,[...path,'enabled'],'Activar '+label.toLowerCase(),{type:'checkbox'});numeric(root,[...path,'intensityScale'],'Potencia de '+label.toLowerCase(),0,5,.01);field(root,[...path,'color'],'Color de '+label.toLowerCase(),{type:'color'});numeric(root,[...path,'distanceScale'],'Alcance relativo de '+label.toLowerCase(),.1,3,.01);numeric(root,[...path,'angleDeg'],'Apertura de '+label.toLowerCase(),1,80,.1);numeric(root,[...path,'penumbra'],'Penumbra de '+label.toLowerCase(),0,1,.01);numeric(root,[...path,'decay'],'Caída de '+label.toLowerCase(),0,4,.1);numeric(root,[...path,'aimHorizontalDeg'],'Orientación horizontal de '+label.toLowerCase(),-30,30,.1);numeric(root,[...path,'aimVerticalDeg'],'Orientación vertical de '+label.toLowerCase(),-20,20,.1);field(root,[...path,'castShadow'],'Sombras de '+label.toLowerCase(),{type:'checkbox'});}
  if(base.fog){const fog=group(fieldHost,'Niebla ambiental');field(fog,['fog','color'],'Color de la niebla',{type:'color'});numeric(fog,['fog','density'],'Densidad de la niebla',0,.02,.00001);}
  field(lutHost,['lut','lutId'],'LUT activo',{type:'select',options:[['none','Sin LUT'],...lutEntries.map(l=>[l.id,l.label])]});numeric(lutHost,['lut','intensity'],'Intensidad del LUT',0,1,.01);numeric(lutHost,['lut','contrast'],'Contraste',0,2,.01);numeric(lutHost,['lut','saturation'],'Saturación',0,2,.01);numeric(lutHost,['lut','temperature'],'Temperatura de color',-1,1,.01);numeric(lutHost,['lut','tint'],'Matiz verde / magenta',-1,1,.01);
  on(section.querySelector('[data-lighting-save]'),'click',()=>void store.flush());on(section.querySelector('[data-lighting-reset]'),'click',()=>{if(!active)return;overrides=overrides.lut?{lut:overrides.lut}:{};apply();store.set(context,overrides);syncInputs();});on(section.querySelector('[data-lut-reset]'),'click',()=>{if(!active)return;delete overrides.lut;apply();store.set(context,overrides);syncInputs();});syncInputs();
 }
 function applyVehicles(){
  const controllers=getVehicles();
  // The controller setter merges partial objects. Reset first so deleting one
  // field restores that field's automatic behavior while retaining other edits.
  for(const id of ['player','rival']){const controller=controllers[id];controller?.setLightingCalibration?.({});const fields=overrides.vehicles?.[id];if(fields&&Object.keys(fields).length)controller?.setLightingCalibration?.(fields);}
 }
 function syncVehicleInputs(){
  vehicleValues=captureVehicleLightingState(getVehicles());
  const modeLabels={off:'Apagados',position:'Posición',low:'Bajas',high:'Altas'};
  for(const [id,node]of vehicleStatus){const state=vehicleValues[id];node.textContent=state.available?(modeLabels[state.mode]||state.mode)+' · '+state.beams.visible+' de '+state.beams.count+' proyectores encendidos':'Sin proyectores disponibles';}
  for(const {input,path,automatic,effective}of refs.values()){
   if(!automatic)continue;
   const state=vehicleValues[path[1]],custom=at(overrides,path)!==undefined;
   const value=custom?at(overrides,path):state.values[path[2]];
   input.disabled=!active||!state.available;automatic.disabled=!active||!custom;
   // Refresh readback while keeping a number currently being typed untouched.
   if(doc.activeElement!==input){if(input.type==='checkbox'){input.checked=value===true;input.indeterminate=value===null;}else if(value!==null&&value!==undefined)input.value=typeof value==='number'?Number(value.toFixed(6)):value;else input.value='';}
   input.hidden=input.type==='color'&&!state.available;
   effective.textContent=(custom?'Personalizado':'Automático')+(path[2]==='castShadow'&&state.available?' · '+state.beams.shadows+' de '+state.beams.count+' proyectores con sombra':'');
  }
 }
 function syncInputs(){for(const {input,path,range,automatic}of refs.values()){if(automatic)continue;const value=at(values,path);input.disabled=!active;if(input.type==='checkbox')input.checked=!!value;else input.value=value===undefined||value===null?'':typeof value==='number'?Number(value.toFixed(6)):value;if(range){range.disabled=!active;range.value=input.value;range.setAttribute('aria-valuetext',input.value);}}syncVehicleInputs();}
 function apply(){if(!base||disposed)return;values=mergeLightingState(base,overrides);scene.userData.asfaltoFogOverride=overrides.fog?structuredClone(overrides.fog):null;applyLightingState(scene,renderer,lights,values);applyVehicles();void Promise.resolve(setLut(values.lut)).catch(error=>{status.textContent='No se pudo cargar el LUT: '+error.message;});}
 function beforePreset(){scene.userData.asfaltoFogOverride=null;if(base){applyLightingState(scene,renderer,lights,base);for(const c of Object.values(getVehicles()))c?.setLightingCalibration?.({});}active=false;syncInputs();}
 function setContext(next){if(disposed)return;context={trackId:next.trackId,skyId:next.skyId,weather:next.weather};lightingPresetKey(context);lights=getLights();base=captureLightingState(scene,renderer,lights);const effectiveFog=getEffectiveFogState();if(effectiveFog)base.fog={...effectiveFog};overrides=store.get(context);active=true;apply();section.querySelector('.an-lighting-context').textContent=[next.trackLabel||next.trackId,next.skyLabel||next.skyId,next.weatherLabel||next.weather].join(' · ');build();}
 const unsubscribe=store.subscribe(d=>{status.textContent=d.state==='loading'?'Cargando ajustes…':d.state==='saving'?'Guardando…':d.state==='saved'?'Guardado en iluminacion-carreras.json':d.state==='local'?'Guardado en este navegador'+(d.error?' · no se pudo guardar en disco':''):'No se pudo guardar el ajuste';});
 const onHide=()=>{if(doc.hidden)void store.flush();};doc.addEventListener('visibilitychange',onHide);
 const lightingDetails=section.querySelector('[data-lighting-section]');
 const refreshVisibleVehicles=()=>{if(!disposed&&active&&!doc.hidden&&lightingDetails.open&&section.getClientRects().length)syncVehicleInputs();};
 lightingDetails.addEventListener('toggle',refreshVisibleVehicles);
 const vehicleRefresh=doc.defaultView.setInterval(refreshVisibleVehicles,250);
 void store.load().then(()=>{if(context&&active){overrides=store.get(context);apply();syncInputs();}});
 void fetch(new URL('../../assets/luts/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('LUTs no disponibles');return r.json();}).then(data=>{lutEntries=data.luts||[];if(base)build();}).catch(()=>{});
 return {beforePreset,setContext,reapply(){if(base){active=true;apply();syncInputs();}},applyVehicles,diagnostics:()=>({context,active,overrides:structuredClone(overrides),values:structuredClone(values),vehicles:structuredClone(vehicleValues),store:store.diagnostics(),lutCount:lutEntries.length}),flush:store.flush,dispose(){if(disposed)return;void store.flush();beforePreset();disposed=true;doc.defaultView.clearInterval(vehicleRefresh);lightingDetails.removeEventListener('toggle',refreshVisibleVehicles);unsubscribe();store.dispose();for(const remove of listeners)remove();doc.removeEventListener('visibilitychange',onHide);section.remove();}};
}
