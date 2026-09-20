
(function(){
'use strict';
const STORAGE='asfalto_nacional_v3_workshop_editor',DEG=Math.PI/180;
const PRESETS=Object.freeze({
 clear:{label:'Campo despejado',hemi:1.35,key:3.4,fill:1.05,warm:2.4,exposure:0,pos:[7,12,5]},
 overcast:{label:'Suelo nublado',hemi:1.65,key:1.45,fill:1.35,warm:.8,exposure:.25,pos:[3,14,4]},
 golden:{label:'Tarde dorada',hemi:1.05,key:3.8,fill:.72,warm:3.35,exposure:-.18,pos:[-8,7,5]},
 sunset:{label:'Atardecer',hemi:.82,key:2.75,fill:.58,warm:3.8,exposure:.08,pos:[-10,5,3]},
 moonrise:{label:'Salida de luna',hemi:.55,key:.62,fill:.36,warm:.28,exposure:.95,pos:[-7,10,-5]},
 night:{label:'Noche',hemi:.32,key:.24,fill:.2,warm:.18,exposure:1.45,pos:[-5,11,-7]}
});
if(!globalThis.AsfaltoV3WorkshopEditorState)return;
function saved(){try{return JSON.parse(localStorage.getItem(STORAGE)||'null')}catch{return null}}
const controller=globalThis.AsfaltoV3WorkshopEditorState.create(saved());
let selectedTab='camera',activeSky=null,skyGeneration=0,pmrem=null;

const style=document.createElement('style');
style.id='asfalto-v3-workshop-editor-style';
style.textContent=
"#workshop-editor-toggle{display:none;position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483000;width:28px;height:28px;padding:0;border:1px solid rgba(255,151,78,.78);border-radius:7px;background:rgba(12,14,15,.9);box-shadow:0 5px 18px #0009;color:#ffc08e;place-items:center;cursor:pointer;backdrop-filter:blur(8px)}"+
"body.v6-menu-open #workshop-editor-toggle{display:grid}body.v6-driving #workshop-editor-toggle{display:none}#workshop-editor-toggle:hover,#workshop-editor-toggle:focus-visible{color:#fff;border-color:#ff9a52;outline:none;background:#2b1c14}#workshop-editor-toggle svg{width:14px;height:14px;display:block}"+
"#workshop-editor-panel{display:none;position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(50px,calc(env(safe-area-inset-bottom) + 44px));z-index:2147482999;width:min(326px,calc(100vw - 24px));max-height:min(690px,calc(100vh - 104px));overflow:auto;border:1px solid rgba(255,139,62,.52);border-radius:12px;background:linear-gradient(165deg,rgba(25,27,28,.97),rgba(9,11,12,.96));box-shadow:0 18px 70px #000c;color:#f4eee7;font:600 11px/1.25 system-ui,sans-serif;backdrop-filter:blur(14px);overscroll-behavior:contain}"+
"body.v6-menu-open #workshop-editor-panel[data-open='true']{display:block}body.v6-driving #workshop-editor-panel{display:none!important}.we-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:11px 12px 9px;background:rgba(17,19,20,.98);border-bottom:1px solid #ffffff12}.we-head strong{font:800 11px/1 system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase}.we-close{width:25px;height:25px;border:0;border-radius:6px;background:#ffffff0c;color:#ddd;font-size:17px;cursor:pointer}"+
".we-tabs{position:sticky;top:46px;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:7px 8px;background:rgba(17,19,20,.96)}.we-tab{padding:8px 5px;border:1px solid #ffffff16;border-radius:6px;background:#ffffff07;color:#bcb7b1;font:800 9px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.we-tab[aria-selected='true']{border-color:#ff8a3d;background:#4a2817;color:#fff}.we-pane{padding:2px 10px 12px}.we-pane[hidden]{display:none}.we-group{margin:9px 0;padding:9px;border:1px solid #ffffff10;border-radius:8px;background:#ffffff05}.we-group>strong{display:block;margin-bottom:7px;color:#ffac70;font-size:9px;letter-spacing:.11em;text-transform:uppercase}.we-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.we-field{display:grid;gap:4px;color:#aaa39c;font-size:9px;text-transform:uppercase;letter-spacing:.06em}.we-field input,.we-field select,.we-wide select{box-sizing:border-box;width:100%;height:30px;border:1px solid #ffffff18;border-radius:5px;background:#090b0c;color:#f7f0e9;padding:5px 6px;font:700 11px/1 monospace}.we-wide{display:grid;gap:5px;color:#aaa39c;font-size:9px;text-transform:uppercase;letter-spacing:.06em}.we-reset{width:100%;margin-top:7px;padding:8px;border:1px solid #ffffff18;border-radius:6px;background:#ffffff08;color:#d7d1cb;font:800 9px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}.we-reset:hover{border-color:#ff8a3d;color:#fff}.we-note{margin:8px 2px 0;color:#8e8983;font:500 9px/1.35 system-ui,sans-serif}.we-status{padding:8px 11px;border-top:1px solid #ffffff10;color:#928b84;font:700 8px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}"+
"@media(max-width:600px){#workshop-editor-panel{right:8px;bottom:46px;width:calc(100vw - 16px);max-height:67vh}#workshop-editor-toggle{right:8px;bottom:8px}.we-tabs{top:45px}}";
document.head.appendChild(style);

const gear=document.createElement('button');
gear.id='workshop-editor-toggle';gear.type='button';gear.title='Ajustar taller';
gear.setAttribute('aria-label','Abrir ajustes del taller');gear.setAttribute('aria-expanded','false');
gear.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58-1.92-3.32-2.39.96a7.2 7.2 0 0 0-1.62-.94L14.87 3h-3.74l-.37 3.18c-.58.23-1.12.55-1.62.94l-2.38-.96-1.92 3.32 2.03 1.58c-.05.31-.07.64-.07.94s.02.63.07.94l-2.03 1.58 1.92 3.32 2.38-.96c.5.39 1.04.71 1.62.94l.37 3.18h3.74l.36-3.18c.59-.23 1.13-.55 1.63-.94l2.38.96 1.92-3.32-2.02-1.58ZM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>';
const panel=document.createElement('aside');panel.id='workshop-editor-panel';panel.dataset.open='false';panel.setAttribute('aria-label','Ajustes del taller');

function axes(section,group,labels,step,min,max){return labels.map(function(label,index){const axis=['x','y','z'][index];return '<label class="we-field">'+label+'<input name="workshop-editor-'+section+'.'+group+'.'+axis+'" type="number" inputmode="decimal" step="'+step+'" min="'+min+'" max="'+max+'" data-editor-path="'+section+'.'+group+'.'+axis+'"></label>'}).join('')}
panel.innerHTML=
'<div class="we-head"><strong>Ajustes del taller</strong><button class="we-close" type="button" aria-label="Cerrar">×</button></div>'+
'<div class="we-tabs" role="tablist"><button class="we-tab" type="button" data-workshop-editor-tab="camera">Cámara</button><button class="we-tab" type="button" data-workshop-editor-tab="chevy">Chevy</button><button class="we-tab" type="button" data-workshop-editor-tab="sky">Cielo</button></div>'+
'<section class="we-pane" data-workshop-editor-pane="camera"><div class="we-group"><strong>Posición</strong><div class="we-grid">'+axes('camera','position',['X','Y','Z'],.05,-20,20)+'</div></div><div class="we-group"><strong>Orientación · grados</strong><div class="we-grid">'+axes('camera','rotation',['X','Y','Z'],1,-180,180)+'</div></div><div class="we-group"><strong>Lente</strong><label class="we-wide">Tipo<select id="workshop-editor-lens-preset"><option value="">Personalizada</option><option value="12">Ultra gran angular · 12 mm</option><option value="24">Gran angular · 24 mm</option><option value="35">Natural · 35 mm</option><option value="50">Normal · 50 mm</option><option value="85">Tele corto · 85 mm</option><option value="135">Tele · 135 mm</option></select></label><label class="we-field" style="margin-top:7px">Focal personalizada · mm<input name="workshop-editor-camera.lens" type="number" step="1" min="12" max="200" data-editor-path="camera.lens"></label></div><button class="we-reset" type="button" data-editor-reset="camera">Restablecer cámara</button></section>'+
'<section class="we-pane" data-workshop-editor-pane="chevy" hidden><div class="we-group"><strong>Posición</strong><div class="we-grid">'+axes('chevy','position',['X','Y','Z'],.01,-10,10)+'</div></div><div class="we-group"><strong>Orientación · grados</strong><div class="we-grid">'+axes('chevy','rotation',['X','Y','Z'],1,-180,180)+'</div></div><div class="we-group"><strong>Escala independiente</strong><div class="we-grid">'+axes('chevy','scale',['X','Y','Z'],.01,.1,3)+'</div></div><button class="we-reset" type="button" data-editor-reset="chevy">Restablecer Chevy</button></section>'+
'<section class="we-pane" data-workshop-editor-pane="sky" hidden><div class="we-group"><strong>HDRI 1K</strong><label class="we-wide">Cielo<select id="workshop-editor-sky-id">'+Object.entries(PRESETS).map(function(entry){return '<option value="'+entry[0]+'">'+entry[1].label+'</option>'}).join('')+'</select></label><div class="we-grid" style="margin-top:8px"><label class="we-field">Rotación °<input name="workshop-editor-sky.rotation" type="number" step="1" min="0" max="359" data-editor-path="sky.rotation"></label><label class="we-field">Intensidad<input name="workshop-editor-sky.intensity" type="number" step=".05" min="0" max="2" data-editor-path="sky.intensity"></label><label class="we-field">Exposición EV<input name="workshop-editor-sky.exposure" type="number" step=".1" min="-4" max="4" data-editor-path="sky.exposure"></label></div><p class="we-note">El cielo ilumina el taller y genera los reflejos de la Chevy.</p></div><button class="we-reset" type="button" data-editor-reset="sky">Restablecer cielo</button></section>'+
'<div style="padding:0 10px 10px"><button class="we-reset" type="button" data-editor-reset="all">Restablecer todo</button></div><div class="we-status">Cambios guardados en este dispositivo</div>';
document.body.append(gear,panel);

function getPath(object,path){return path.split('.').reduce(function(value,key){return value&&value[key]},object)}
function patchPath(path,value){const keys=path.split('.');return keys.length===2?{[keys[1]]:value}:{[keys[1]]:{[keys[2]]:value}}}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(controller.snapshot()))}catch{}}
function sync(){const state=controller.snapshot();panel.querySelectorAll('[data-editor-path]').forEach(function(input){if(document.activeElement!==input)input.value=String(getPath(state,input.dataset.editorPath))});panel.querySelector('#workshop-editor-sky-id').value=state.sky.id;const known=['12','24','35','50','85','135'];panel.querySelector('#workshop-editor-lens-preset').value=known.includes(String(state.camera.lens))?String(state.camera.lens):''}
function tab(name){selectedTab=['camera','chevy','sky'].includes(name)?name:'camera';panel.querySelectorAll('[data-workshop-editor-tab]').forEach(function(button){button.setAttribute('aria-selected',String(button.dataset.workshopEditorTab===selectedTab))});panel.querySelectorAll('[data-workshop-editor-pane]').forEach(function(pane){pane.hidden=pane.dataset.workshopEditorPane!==selectedTab})}
function open(value){panel.dataset.open=String(Boolean(value));gear.setAttribute('aria-expanded',String(Boolean(value)));if(value){tab(selectedTab);sync()}}
function update(path,value){const section=path.split('.')[0],patch=patchPath(path,value);if(section==='camera')controller.updateCamera(patch);if(section==='chevy')controller.updateChevy(patch);if(section==='sky'){controller.updateSky(patch);requestSky(controller.snapshot().sky.id)}save();return controller.snapshot()}
gear.addEventListener('click',function(){open(panel.dataset.open!=='true')});
panel.querySelector('.we-close').addEventListener('click',function(){open(false)});
panel.querySelectorAll('[data-workshop-editor-tab]').forEach(function(button){button.addEventListener('click',function(){tab(button.dataset.workshopEditorTab)})});
panel.querySelectorAll('[data-editor-path]').forEach(function(input){input.addEventListener('input',function(){update(input.dataset.editorPath,Number(input.value))})});
panel.querySelector('#workshop-editor-sky-id').addEventListener('change',function(event){controller.updateSky({id:event.target.value});save();requestSky(event.target.value);sync()});
panel.querySelector('#workshop-editor-lens-preset').addEventListener('change',function(event){if(!event.target.value)return;controller.updateCamera({lens:Number(event.target.value)});save();sync()});
panel.querySelectorAll('[data-editor-reset]').forEach(function(button){button.addEventListener('click',function(){const section=button.dataset.editorReset;controller.reset(section==='all'?undefined:section);save();sync();if(section==='sky'||section==='all')requestSky(controller.snapshot().sky.id)})});
panel.addEventListener('pointerdown',function(event){event.stopPropagation()});panel.addEventListener('wheel',function(event){event.stopPropagation()},{passive:true});
document.addEventListener('keydown',function(event){if(event.key==='Escape'&&panel.dataset.open==='true')open(false)});

let v5WorkshopBridgeSignature=null;
function bridgeWorkshopEnvironment(runtime,state){
  const signature=JSON.stringify([state.sky.id,state.sky.intensity,state.sky.exposure,state.sky.rotation]);
  if(signature===v5WorkshopBridgeSignature)return;
  v5WorkshopBridgeSignature=signature;
  const api=globalThis.__asfaltoNacionalV5;
  if(!api?.applyWorkshopEnvironment)return;
  void api.applyWorkshopEnvironment(state,runtime).catch(function(error){console.error('[Workshop v5 environment]',error)});
}
function requestSky(id){bridgeWorkshopEnvironment(globalThis.__chevyV6Complete&&globalThis.__chevyV6Complete.workshop,controller.snapshot())}
function lighting(runtime,state){bridgeWorkshopEnvironment(runtime,state)}
function applyFrame(runtime,time){const state=controller.snapshot();if(!runtime||!runtime.camera||!runtime.renderer||!runtime.scene)return;const camera=runtime.camera;if(runtime.editorLensSeen!==state.camera.lens){const first=runtime.editorLensSeen==null;runtime.editorLensSeen=state.camera.lens;if(!first||!runtime.presentationLensMm){camera.filmGauge=35;camera.setFocalLength(state.camera.lens);camera.updateProjectionMatrix();runtime.presentationLensMm=state.camera.lens}}camera.position.x+=state.camera.position.x;camera.position.y+=state.camera.position.y;camera.position.z+=state.camera.position.z;camera.rotateX(state.camera.rotation.x*DEG);camera.rotateY(state.camera.rotation.y*DEG);camera.rotateZ(state.camera.rotation.z*DEG);if(runtime.car){const car=runtime.car;if(!car.userData.editorBaseScale){car.userData.editorBaseScale=car.scale.clone();car.userData.editorBasePosition=new runtime.T.Vector3(car.position.x,car.userData.floorY??car.position.y,car.position.z);car.userData.editorBaseRotation={x:car.rotation.x,y:car.rotation.y,z:car.rotation.z}}const bp=car.userData.editorBasePosition,br=car.userData.editorBaseRotation,bs=car.userData.editorBaseScale;car.position.set(bp.x+state.chevy.position.x,bp.y+state.chevy.position.y,bp.z+state.chevy.position.z);car.rotation.set(br.x+state.chevy.rotation.x*DEG,br.y+state.chevy.rotation.y*DEG,br.z+state.chevy.rotation.z*DEG);car.scale.set(bs.x*state.chevy.scale.x,bs.y*state.chevy.scale.y,bs.z*state.chevy.scale.z)}lighting(runtime,state);if(runtime.warm&&runtime.warm.userData.editorIntensity!=null)runtime.warm.intensity=runtime.warm.userData.editorIntensity;requestSky(state.sky.id)}
const api=Object.freeze({getState:function(){return controller.snapshot()},update:update,reset:function(section){controller.reset(section);save();sync();requestSky(controller.snapshot().sky.id);return controller.snapshot()},open:function(){open(true)},close:function(){open(false)},applyFrame:applyFrame});
globalThis.__asfaltoWorkshopEditor=api;tab('camera');sync();
const timer=0;
})();
