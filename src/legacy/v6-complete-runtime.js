
/* Chevy Serie 2 · V6 Taller Mecánico y capa de juego completo */
(async()=>{
'use strict';
await globalThis.__asfaltoV7Storage.ready;
const V6_VERSION='7.0.0-photorealism';
const STORAGE_KEY='chevy-serie2-v6-profile';
let experienceTools=null,sessionRequestRunner=null,lastExperienceUiTime=-Infinity,sessionPresentationOwner=null;
let collectionReaderPromise=null,collectionSyncVersion=0;
let roadTestSession=null,roadTestTools=null,roadTestToolsPromise=null,roadTestReceiptStore=null,roadTestConfigVersion=0;
const phoneMemoryReady=import(new URL('src/runtime/phone-start-memory.mjs?v=6a0bdd2c1832ac53',document.baseURI));
const startupDemandReady=import(new URL('src/runtime/startup-demand.mjs?v=d7f04a8f3c4b6613',document.baseURI));
const experienceToolsReady=import(new URL('src/menu/v7-session-runtime.mjs?v=0c7302a899376493',document.baseURI)).then(module=>(experienceTools=module));
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const round=(v,n=1)=>Number(Number(v||0).toFixed(n));
const safeJSON=(s,f)=>{try{return JSON.parse(s)}catch{return f}};
const deepClone=o=>JSON.parse(JSON.stringify(o));
const dateStamp=()=>new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date());
const fmtTime=ms=>{ms=Math.max(0,Number(ms)||0);const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000),d=Math.floor(ms%1000/10);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(d).padStart(2,'0')}`};
const AXES=['dominio','mecanica','historia','ruta','competencia','coleccion'];
const BODY_COLORS={
  naranja:{label:'Naranja Serie 2',hex:'#d66a24',historical:true},
  azul:{label:'Azul profundo',hex:'#31546b',historical:true},
  verde:{label:'Verde oliva',hex:'#5e6651',historical:true},
  blanco:{label:'Blanco marfil',hex:'#d8d1bd',historical:true},
  rojo:{label:'Rojo ladrillo',hex:'#923e32',historical:true},
  plata:{label:'Plata humo',hex:'#8b9090',historical:true}
};
const TESTS=[
 {id:'vmax',title:'Velocidad máxima',desc:'Alcanzá al menos 175 km/h y mantené la velocidad estable durante 3 segundos.',duration:'3–5 min',difficulty:'Media',surface:'Clima elegido',reward:'Dominio + Ruta',kind:'speed',target:175,route:'pampa'},
 {id:'accel100',title:'0–100 km/h',desc:'Detené el auto medio segundo y acelerá hasta 100 km/h.',duration:'2–3 min',difficulty:'Media',surface:'Clima elegido',reward:'Dominio + Mecánica',kind:'accel',target:100,route:'pampa'},
 {id:'accel160',title:'0–160 km/h',desc:'Detené el auto medio segundo y acelerá hasta 160 km/h.',duration:'3–4 min',difficulty:'Alta',surface:'Clima elegido',reward:'Dominio + Competencia',kind:'accel',target:160,route:'pampa',unlock:2},
 {id:'m500',title:'500 metros',desc:'Recorré 500 metros hacia adelante desde una salida detenida.',duration:'3 min',difficulty:'Media',surface:'Clima elegido',reward:'Historia + Dominio',kind:'distance',target:500,route:'pampa'},
 {id:'m1000',title:'1.000 metros',desc:'Recorré 1.000 metros hacia adelante desde una salida detenida.',duration:'4 min',difficulty:'Alta',surface:'Clima elegido',reward:'Mecánica + Historia',kind:'distance',target:1000,route:'pampa',unlock:2},
 {id:'recovery',title:'Recuperación 80–120',desc:'Pasá de 80 a 120 km/h en cuarta, sin cambiar ni pisar el embrague.',duration:'3 min',difficulty:'Media',surface:'Clima elegido',reward:'Mecánica',kind:'recovery',target:120,route:'pampa'},
 {id:'brake100',title:'Frenada 100–0',desc:'Alcanzá 100 km/h y frená hasta detenerte por completo. Se mide la distancia.',duration:'3 min',difficulty:'Alta',surface:'Clima elegido',reward:'Dominio + Mecánica',kind:'brake',target:100,route:'pampa'},
 {id:'slalom',title:'Slalom técnico',desc:'Cruzá las ocho puertas en orden y pasá completamente entre los conos.',duration:'4 min',difficulty:'Alta',surface:'Clima elegido',reward:'Dominio + Competencia',kind:'slalom',target:8,route:'sierra'},
 {id:'turn',title:'Diámetro de giro',desc:'Completá un círculo a baja velocidad, manteniendo el giro y el apoyo.',duration:'2 min',difficulty:'Baja',surface:'Zona amplia',reward:'Historia + Mecánica',kind:'turn',target:1,route:'pampa'},
 {id:'wet',title:'Ruta húmeda',desc:'Recorré 1,8 km bajo lluvia, frená al menos 10 km/h y tomá una curva con apoyo.',duration:'5 min',difficulty:'Alta',surface:'Húmeda',reward:'Ruta + Dominio',kind:'wet',target:1,route:'bosque',weather:'rain',unlock:2},
 {id:'speedo',title:'Error de velocímetro',desc:'Mantené 100 ±2 km/h durante 5 segundos para comparar la aguja con la velocidad de desplazamiento.',duration:'3 min',difficulty:'Baja',surface:'Clima elegido',reward:'Historia',kind:'speedo',target:100,route:'pampa'},
 {id:'consumption',title:'Consumo constante',desc:'Sostené 60 km/h durante al menos 2,4 km. El consumo se estima mediante un modelo.',duration:'8 min',difficulty:'Media',surface:'Clima elegido',reward:'Ruta + Mecánica',kind:'consumption',target:240,route:'costa'}
];
const COMPETITIONS=[
 {id:'sprint',title:'Sprint de club',desc:'Una pasada a la meta del circuito elegido, salida desde parrilla y ritmo máximo.',duration:'8–12 min',difficulty:'Media',surface:'Variable',reward:'Competencia',mode:'race',laps:3},
 {id:'regularity',title:'Regularidad',desc:'Repetir un tiempo objetivo con mínima dispersión.',duration:'12 min',difficulty:'Alta',surface:'Seca',reward:'Dominio + Historia',mode:'timeTrial',laps:5},
 {id:'circuit',title:'Carrera de circuito',desc:'Una pasada a la meta del circuito elegido con rivales, banderas y clasificación.',duration:'15–20 min',difficulty:'Alta',surface:'Variable',reward:'Competencia + Colección',mode:'race',laps:5},
 {id:'timetrial',title:'Contrarreloj',desc:'Una pasada a la meta del circuito elegido contra mejor marca y fantasma.',duration:'10 min',difficulty:'Media',surface:'Seca',reward:'Dominio',mode:'timeTrial',laps:3},
 {id:'drag',title:'Duelo de aceleración',desc:'Salida detenida y llegada a 500 metros.',duration:'4 min',difficulty:'Media',surface:'Seca',reward:'Mecánica + Competencia',mode:'speedTrap',laps:1},
 {id:'endurance',title:'Resistencia de ruta',desc:'Una pasada completa de la ruta elegida con desgaste, combustible y mantenimiento.',duration:'35–45 min',difficulty:'Alta',surface:'Variable',reward:'Ruta + Mecánica',mode:'race',laps:10,unlock:3},
 {id:'club',title:'Prueba del Automóvil Club',desc:'Evento compuesto: slalom, frenada y vuelta lanzada.',duration:'25 min',difficulty:'Experta',surface:'Seca',reward:'Historia + Colección',mode:'sectors',laps:5,unlock:4}
];
const PARTS=[
 {id:'transmission',name:'Transmisión',original:'Caja manual de 4 marchas',modern:'Conversión de 5 marchas',benefit:'Menor régimen de crucero y escalonamiento cerrado.',tradeoff:'Pierde configuración histórica; cambia sonido y peso.',axis:'mecanica'},
 {id:'brakes',name:'Frenos',original:'Disco/tambor original',modern:'Discos ventilados y servo revisado',benefit:'Menor fatiga y distancia de frenado.',tradeoff:'Respuesta menos fiel a época; mayor agarre requerido.',axis:'dominio'},
 {id:'steering',name:'Dirección',original:'Mecánica sin asistencia',modern:'Asistencia eléctrica discreta',benefit:'Menor esfuerzo a baja velocidad.',tradeoff:'Filtra carga del tren delantero; no cambia radio de giro.',axis:'mecanica'},
 {id:'cooling',name:'Refrigeración',original:'Radiador y ventilador mecánico',modern:'Radiador aluminio y electroventilador',benefit:'Temperatura más estable en tránsito y resistencia.',tradeoff:'Aspecto bajo capot no original.',axis:'ruta'},
 {id:'exhaust',name:'Escape',original:'Colector y línea original',modern:'Colector largo y línea deportiva',benefit:'Mejor respiración a alto régimen.',tradeoff:'Más ruido, menos torque bajo y clase Restomod.',axis:'competencia'},
 {id:'suspension',name:'Suspensión',original:'Espirales y amortiguadores de época',modern:'Amortiguadores regulables',benefit:'Control de balanceo y apoyo ajustable.',tradeoff:'Puede volverla áspera y menos progresiva.',axis:'dominio'}
];
const TUNING=[
 {id:'frontPressure',label:'Presión delantera',min:24,max:38,step:0.5,unit:' psi',base:29,desc:'Más presión agiliza respuesta; reduce huella y confort.'},
 {id:'rearPressure',label:'Presión trasera',min:24,max:40,step:0.5,unit:' psi',base:31,desc:'Afecta tracción, deriva y temperatura trasera.'},
 {id:'brakeBias',label:'Reparto de freno',min:52,max:68,step:1,unit:' % adelante',base:60,desc:'Más adelante estabiliza; exceso bloquea la trompa.'},
 {id:'finalDrive',label:'Relación final',min:3.08,max:4.11,step:0.01,unit:':1',base:3.55,desc:'Corta mejora aceleración; larga reduce régimen.'},
 {id:'frontDamping',label:'Amortiguación delantera',min:0,max:10,step:1,unit:' clics',base:4,desc:'Controla apoyo inicial y transferencia.'},
 {id:'rearDamping',label:'Amortiguación trasera',min:0,max:10,step:1,unit:' clics',base:4,desc:'Controla tracción y salida de curva.'},
 {id:'steerRatio',label:'Relación de dirección',min:14,max:22,step:0.5,unit:':1',base:19,desc:'Más rápida exige manos suaves; no suma agarre.'},
 {id:'rideHeight',label:'Altura funcional',min:-20,max:15,step:1,unit:' mm',base:0,desc:'Bajar reduce balanceo dentro de límites plausibles.'}
];
const CHASSIS_PART_IDS=new Set(['brakes','steering']);
const CHASSIS_TUNING_IDS=new Set(['frontPressure','rearPressure','brakeBias','steerRatio']);
const WORKSHOP_PARTS=PARTS.filter(part=>!CHASSIS_PART_IDS.has(part.id));
const WORKSHOP_TUNING=TUNING.filter(tuning=>!CHASSIS_TUNING_IDS.has(tuning.id));
const CONDITION_META={
 engine:{label:'Motor',desc:'Compresión, encendido y regulación del Chevrolet 250.'},
 oil:{label:'Aceite',desc:'Nivel, presión, temperatura y vida útil.'},
 brakes:{label:'Frenos',desc:'Pastillas, campanas, líquido y temperatura.'},
 tires:{label:'Neumáticos',desc:'Desgaste, presión y fatiga térmica.'},
 body:{label:'Carrocería',desc:'Alineación, suciedad y daños de uso.'},
 fuel:{label:'Combustible',desc:'Reserva disponible para ruta y competencia.'}
};
const COLLECTION=[
 {id:'manual1973',title:'Manual del propietario',copy:'Datos de operación, mantenimiento y advertencias de época.',type:'Documento',default:true},
 {id:'roadtestSheet',title:'Ficha Road Test',copy:'Planilla para cifras, tolerancias y observaciones del tester.',type:'Documento',default:true},
 {id:'workshopOrder',title:'Orden de trabajo 001',copy:'Primera inspección del taller y lista de observaciones.',type:'Taller',default:true},
 {id:'pampaMap',title:'Mapa Pampa GP',copy:'Referencias de frenada y sectores del circuito abierto.',type:'Ruta',default:true},
 {id:'sierraMap',title:'Mapa Sierra Técnica',copy:'Desniveles, curvas ciegas y zonas de enfriamiento.',type:'Ruta'},
 {id:'periodWheels',title:'Llantas deportivas 1973',copy:'Accesorio plausible desbloqueado por conocimiento histórico.',type:'Pieza'},
 {id:'timingCamera',title:'Cámara de cronometraje',copy:'Foco largo y exposición para documentar pruebas.',type:'Fotografía'},
 {id:'clubBadge',title:'Insignia del club',copy:'Reconocimiento por completar una competencia válida.',type:'Evento'},
 {id:'mechanicNotes',title:'Notas de Marta',copy:'Reglajes de presión, bujías y respuesta del tren delantero.',type:'Historia'},
 {id:'restomodCatalog',title:'Catálogo Restomod',copy:'Conversiones modernas etiquetadas y separadas del original.',type:'Pieza',default:true},
 {id:'coastRoute',title:'Bitácora Costa Azul',copy:'Consumo, viento lateral y temperatura en viaje sostenido.',type:'Viaje'},
 {id:'photoAlbum',title:'Álbum del taller',copy:'Fotografías del auto y su evolución mecánica.',type:'Fotografía',default:true}
];
const DEFAULT_PROFILE={
 version:6,createdAt:new Date().toISOString(),name:'Propietario',level:1,xp:0,
 axes:{dominio:0,mecanica:0,historia:0,ruta:0,competencia:0,coleccion:0},
 workshopTokens:100,
 appearance:{body:'naranja',stripe:'black',wheel:'steel',tire:'bias',height:0,plate:'C-1973',dirt:18},
 parts:Object.fromEntries(PARTS.map(p=>[p.id,'original'])),
 tuning:Object.fromEntries(TUNING.map(t=>[t.id,t.base])),
 condition:{engine:92,oil:84,brakes:88,tires:91,body:87,fuel:78},
 unlocked:COLLECTION.filter(x=>x.default).map(x=>x.id),
 history:[
  {date:'Abril 1973',title:'Ingreso al taller',copy:'Chevy Serie 2 recibida para inspección y prueba de referencia.',type:'Orden'},
  {date:'Mayo 1973',title:'Nota del tester',copy:'Motor parejo. Revisar presión delantera antes de medir frenada.',type:'Nota'}
 ],
 sheets:[],photos:[],championship:{points:0,events:0,wins:0},journey:{km:0,routes:[]},
 settings:{uiLarge:false,reducedMotion:false,highContrast:false,captions:true,photosafe:true,preset:'original'},
 selectedDrive:'free',selectedTest:null,selectedCompetition:null,lastPanel:'drive'
};
const PLAYABLE_TRACK_IDS=new Set(['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu']);
const persistedTrack=id=>PLAYABLE_TRACK_IDS.has(String(id||''))?String(id):'dos_lagos';
function migrateProfile(value){
 if(!value||typeof value!=='object'||Array.isArray(value))value={};
 const p=Object.assign(deepClone(DEFAULT_PROFILE),value||{});p.version=6;
 p.axes=Object.assign({},DEFAULT_PROFILE.axes,value?.axes||{});p.appearance=Object.assign({},DEFAULT_PROFILE.appearance,value?.appearance||{});p.parts=Object.assign({},DEFAULT_PROFILE.parts,value?.parts||{});p.tuning=Object.assign({},DEFAULT_PROFILE.tuning,value?.tuning||{});p.condition=Object.assign({},DEFAULT_PROFILE.condition,value?.condition||{});p.settings=Object.assign({},DEFAULT_PROFILE.settings,value?.settings||{});
 p.history=Array.isArray(value?.history)?value.history:deepClone(DEFAULT_PROFILE.history);p.sheets=Array.isArray(value?.sheets)?value.sheets:[];p.photos=Array.isArray(value?.photos)?value.photos:[];p.unlocked=Array.from(new Set([...(Array.isArray(value?.unlocked)?value.unlocked:[]),...DEFAULT_PROFILE.unlocked]));p.lastRoute=persistedTrack(value?.lastRoute);p.journey=Object.assign({},DEFAULT_PROFILE.journey,value.journey||{});p.journey.routes=Array.isArray(value.journey?.routes)?value.journey.routes:[];p.championship=Object.assign({},DEFAULT_PROFILE.championship,value.championship||{});return p;
}
let profile=migrateProfile(safeJSON(globalThis.__asfaltoV7Storage.getItem(STORAGE_KEY),null));
let profilePersistencePromise=null,profileExpectedRevision=`${profile.storageRevision||0}:${profile.motorsportV7?.revision||0}`,championshipMenu=null,championshipMenuPromise=null,championshipDayEnabled=null,championshipResultsVisible=false,earnedAlbum=null,earnedAlbumPromise=null;
function saveProfile(){renderProfileSummary();profilePersistencePromise||=import(new URL('src/runtime/profile-persistence.mjs?v=213f9a534191da55',document.baseURI));return profilePersistencePromise.then(m=>m.saveOrdinaryProfile({storage:globalThis.__asfaltoV7Storage,getProfile:()=>profile,getExpectedRevision:()=>profileExpectedRevision,onCommitted:revision=>profileExpectedRevision=revision})).then(()=>{void syncWorkshopCollection();return true;}).catch(error=>{toast('No se pudo guardar el archivo local: '+String(error.message||error)+'. Exportalo desde Historial.','warn');return false;});}
async function leaveChampionship(){earnedAlbum?.cancelCapture();const ending=championshipMenu?.cancel();if(championshipDayEnabled!==null){const enabled=championshipDayEnabled;championshipDayEnabled=null;await window.__cockpit?.raceWorld?.setDayCycleOptions?.({enabled},{persist:false});}await ending;}
async function loadEarnedAlbum(){if(earnedAlbum)return earnedAlbum;return earnedAlbumPromise||(earnedAlbumPromise=import(new URL('src/menu/v7-earned-album.mjs?v=6450d5f8f7782b83',document.baseURI)).then(m=>{earnedAlbum=m.createEarnedAlbum({getProfile:()=>profile,replaceProfile:p=>{profile=p;profileExpectedRevision=`${p.storageRevision||0}:${p.motorsportV7?.revision||0}`;renderProfileSummary();},getThree:()=>workshop.T,canSetPosters:()=>!!workshop.presentation?.setCollectionMemories,setPosters:posters=>workshop.presentation?.setCollectionMemories?.(posters),toast,onStatus:()=>{const status=q('#v7-earned-album-status');if(status)status.textContent='Consultá el cuaderno para ver fotos guardadas o pendientes.';}});return earnedAlbum;}).catch(error=>{earnedAlbumPromise=null;throw error;}));}
async function openEarnedAlbum(){try{await (await loadEarnedAlbum()).mount(q('#v7-earned-album'));q('#v7-earned-album').scrollIntoView({block:'nearest'});}catch(error){toast('No se pudo abrir el álbum: '+String(error.message||error),'warn');}}
async function loadChampionshipMenu(){
 if(championshipMenu)return championshipMenu;
 return championshipMenuPromise||(championshipMenuPromise=import(new URL('src/menu/v7-championship-menu.mjs?v=7a4b343d6b7b0c8c',document.baseURI)).then(m=>{
  const world=()=>window.__cockpit?.raceWorld;
  const getEntrant=async()=>{reconcileChassisConfig();const ui=world()?.getState?.().ui;if(!ui?.assists)throw Error('Las ayudas físicas todavía no están disponibles.');const configuration={vehicleId:workshop.vehicleId,class:vehicleClass(),parts:deepClone(profile.parts),tuning:deepClone(profile.tuning),chassis:profile.chassis?deepClone(profile.chassis):null,wheel:profile.appearance.wheel,tire:profile.appearance.tire,assists:deepClone(ui.assists),tireWear:ui.tireWear};return{vehicleId:workshop.vehicleId,class:vehicleClass(),configuration,configurationHash:await m.configurationFingerprint(configuration)};};
  championshipMenu=m.mountChampionshipMenu({root:q('#v7-championship-content'),getProfile:()=>profile,replaceProfile:p=>{profile=p;profileExpectedRevision=`${p.storageRevision||0}:${p.motorsportV7?.revision||0}`;renderProfileSummary();void syncWorkshopCollection();},world,getEntrant,toast,
   async prepare(){await saveProfile();await loadEarnedAlbum();const runner=await getSessionRequestRunner();return runner.run(async tx=>{tx.stage('Preparando el auto para la inscripción…');await tx.wait(waitForExistingGameReady(180000,{signal:tx.signal,onStage:tx.stage}));if(workshop.vehicleSelector?.diagnostics().pending)await tx.wait(workshop.vehicleSelector.whenSettled());return tx.isCurrent();},{championship:true});},
   prepareMemory:input=>earnedAlbum?.prepare(input),onAccepted:input=>earnedAlbum?.accepted(input),
   async configure(stage){const w=world();if(championshipDayEnabled===null)championshipDayEnabled=w.getDayCycleDiagnostics().enabled;await w.setDayCycleOptions({enabled:false},{persist:false});return configureExistingGame({track:stage.trackId,weather:stage.weather,skyId:stage.skyId,mode:'race',laps:1,difficulty:stage.difficulty,championship:true});},
   async getContext(){const entrant=await getEntrant(),w=world(),env=w.getAdvancedGraphicsEnvironment(),state=w.getState();return{configurationHash:entrant.configurationHash,trackId:state.track?.id,skyId:env.skyId,weather:env.weather,qaMode:new URLSearchParams(location.search).get('qa')==='1'};},
   async start(stage,run){championshipResultsVisible=true;const runner=await getSessionRequestRunner();const success=await runner.run(async tx=>{applyVehicleConfig();resetSession();activeSession.type='championship';activeSession.definition={id:run.championshipId,title:'Campeonato · etapa '+(run.nextStageIndex+1)+'/'+run.schedule.length};activeSession.config={track:stage.trackId,weather:stage.weather,skyId:stage.skyId};activeSession.startTime=performance.now();activeSession.lastTime=activeSession.startTime;activeSession.phase='running';tx.stage('Preparando la grilla y la salida…');await window.__cockpit.raceStart({signal:tx.signal,onStage:tx.stage});return openPreparedRace(tx);},{track:stage.trackId,championship:true});if(success){sessionLoop.start();}return success;},
   onChange(info){if(['saving','save-error','result','invalid'].includes(info.phase)){activeSession.completed=true;sessionLoop.stop();if(championshipResultsVisible)showChampionshipResults(info);}},returnToWorkshop:()=>openMenu('workshop')
  });
  const checkFrozenConfiguration=()=>{const attemptId=championshipMenu.diagnostics().attemptId;if(championshipMenu.diagnostics().phase!=='running'||activeSession.completed)return;void getEntrant().then(entrant=>{if(championshipMenu.diagnostics().attemptId===attemptId&&entrant.configurationHash!==championshipMenu.controller.run()?.entrant.configurationHash)world()?.invalidateChampionship?.('La configuración de inscripción fue modificada durante la etapa.');}).catch(()=>world()?.invalidateChampionship?.('No se pudo verificar la configuración de inscripción.'));};
  window.addEventListener('chevy:vehicle-config',checkFrozenConfiguration);document.addEventListener('change',event=>{if(event.target.closest?.('#race-settings'))queueMicrotask(checkFrozenConfiguration);});
  return championshipMenu;
 }).catch(error=>{championshipMenuPromise=null;toast(String(error.message||error),'warn');throw error;}));
}
function canLeaveWorkshop(){const state=globalThis.__asfaltoVehicleMaintenance?.getState();if(state&&!state.canDrive){toast(state.faults.map(f=>f.label).join(" · ")+". Repará el auto antes de salir.","warn");openMenu("workshop");return false;}return true;}
async function openChampionship(){if(!canLeaveWorkshop())return false;q('#v7-championship-content').hidden=false;try{const menu=await loadChampionshipMenu();menu.render();q('#v7-championship-select')?.focus();}catch(error){q('#v7-championship-content').textContent='No se pudo abrir el campeonato. Volvé a elegir Campeonato nacional para reintentar.';}}
function showChampionshipResults(info){
 const player=info.final?.participants?.find(p=>p.id==='player'),saved=info.phase==='result';showResults({title:'Clasificación de etapa',class:info.run?.entrant.class,main:player?.officialSeconds?.toFixed(3)||'—',unit:'segundos oficiales',elapsed:(player?.activeSeconds||0)*1000,valid:saved,reasons:info.error?[info.error]:[],series:activeSession.series,experienceFacts:{activeSeconds:player?.activeSeconds,penaltySeconds:player?.penaltySeconds,totalSeconds:player?.officialSeconds,valid:saved,progress:saved?'Etapa persistida.':'Sin publicar premios.'}});
 q('#v6-results-verdict').textContent=saved?'Clasificación guardada.':info.phase==='saving'?'Guardando clasificación…':info.error||'Intento inválido; la etapa no avanzó.';
 q('#v6-results-progress').textContent=saved?`${info.run.nextStageIndex}/${info.run.schedule.length} etapas guardadas. Los premios se derivan de las llegadas válidas.`:'No se publicaron premios de este intento.';
 q('#v6-results-details').replaceChildren();for(const p of info.final?.participants||[]){const row=document.createElement('li');row.textContent=(p.id==='player'?'Vos':'Falcon')+' · '+p.status+' · '+(Number.isFinite(p.officialSeconds)?p.officialSeconds.toFixed(3)+' s':'sin tiempo')+' · penalización '+(p.penaltySeconds||0)+' s';q('#v6-results-details').append(row);}
 const repeat=q('#v6-results-repeat');repeat.disabled=info.phase==='saving'||info.run?.status==='completed';repeat.textContent=info.phase==='save-error'?'Reintentar guardado':saved?'Siguiente etapa':'Reintentar etapa';
}

function loadCollectionReader(){return collectionReaderPromise||(collectionReaderPromise=import(new URL('src/menu/v7-earned-collection.mjs?v=d14e43cdb1271985',document.baseURI)).catch(error=>{collectionReaderPromise=null;throw error;}));}
function renderEarnedCollectionDetails(reader,items){
 const status=q('#v6-earned-collection-status'),list=q('#v6-earned-collection-list');
 if(status)status.textContent=items.length+' de 20 piezas obtenidas · '+(20-items.length)+' pendientes. Los espacios vacíos se conservan hasta un logro válido.';
 if(!reader||!list)return;
 const fragment=document.createDocumentFragment(),byId=new Map(items.map(item=>[item.id,item]));
 for(const award of reader.AWARD_CATALOG){const item=byId.get(award.id),row=document.createElement('li');row.textContent=award.title+' — '+(item?'Obtenido · '+item.class+' · '+item.vehicleId+' · '+new Date(item.earnedAt).toLocaleDateString('es-AR')+(item.shared?' · campeonato compartido':''):'Pendiente');fragment.append(row);}
 list.replaceChildren(fragment);
}
async function syncWorkshopCollection({details=false}={}){
 details=details||workshop.collectionFocusActive||!!q('#v6-collection-panel')?.classList.contains('v6-active');
 const version=++collectionSyncVersion,runs=profile.motorsportV7?.runs,receipts=profile.roadTestsV7?.receipts,hasRuns=(!!runs&&typeof runs==='object'&&!Array.isArray(runs)&&Object.keys(runs).length>0)||(!!receipts&&typeof receipts==='object'&&!Array.isArray(receipts)&&Object.keys(receipts).length>0);
 if(!details&&!hasRuns){workshop.presentation?.setCollection?.([]);renderEarnedCollectionDetails(null,[]);return[];}
 try{const reader=await loadCollectionReader();if(version!==collectionSyncVersion)return[];const items=reader.getEarnedDisplayItems(profile);workshop.presentation?.setCollection?.(items);if(details||workshop.collectionFocusActive||q('#v6-collection-panel')?.classList.contains('v6-active'))renderEarnedCollectionDetails(reader,items);return items;}
 catch(error){if(version===collectionSyncVersion&&details){const status=q('#v6-earned-collection-status');if(status)status.textContent='No se pudo leer la colección. Volvé a abrirla para reintentar.';toast('No se pudo leer la colección: '+String(error?.message||error),'warn');}return[];}
}
function addHistory(title,copy,type='Taller'){profile.history.unshift({date:dateStamp(),title,copy,type});profile.history=profile.history.slice(0,80);}
function award(points={}){let total=0;for(const [axis,v] of Object.entries(points)){if(AXES.includes(axis)){profile.axes[axis]=clamp((profile.axes[axis]||0)+v,0,100);total+=v;}}profile.xp+=total;const old=profile.level;profile.level=1+Math.floor(profile.xp/80);if(profile.level>old){toast(`Nivel de dominio ${profile.level}. Nuevos contextos disponibles.`,'ok');profile.workshopTokens+=1;}unlockByProgress();saveProfile();}
function unlockByProgress(){const unlock=[];if(profile.level>=2)unlock.push('sierraMap','periodWheels','mechanicNotes');if(profile.level>=3)unlock.push('timingCamera','coastRoute');if(profile.axes.competencia>=25)unlock.push('clubBadge');for(const id of unlock)if(!profile.unlocked.includes(id)){profile.unlocked.push(id);toast(`Archivo desbloqueado: ${COLLECTION.find(x=>x.id===id)?.title||id}`,'ok')}}
function isRestomod(){return Object.values(profile.parts).includes('restomod')||['restomod','modern'].includes(profile.appearance.wheel)||profile.appearance.tire==='modern'}
function vehicleClass(){return isRestomod()?'Restomod':'Histórica'}
function conditionAverage(){const values=Object.entries(profile.condition).filter(([id,v])=>typeof v==='number'&&id!=='dirt').map(([,v])=>v);return values.reduce((a,b)=>a+b,0)/Math.max(1,values.length)}
function toast(message,kind='info',ms=3800){const stack=q('#v6-toast-stack');if(!stack)return;const el=document.createElement('div');el.className='v6-toast';el.dataset.kind=kind;el.textContent=message;stack.append(el);q('#v6-a11y-live').textContent=message;setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(15px)';setTimeout(()=>el.remove(),220)},ms)}
let confirmResolve=null;
function confirmAction(title,copy){q('#v6-confirm-title').textContent=title;q('#v6-confirm-copy').textContent=copy;q('#v6-confirm').classList.add('v6-open');q('#v6-confirm-ok').focus();return new Promise(r=>confirmResolve=r)}
function closeConfirm(value){q('#v6-confirm').classList.remove('v6-open');if(confirmResolve){confirmResolve(value);confirmResolve=null}}
function renderProfileSummary(){
 const balance=q('.an-token-balance');if(balance){const text=new Intl.NumberFormat('es-AR').format(profile.workshopTokens??0)+' fichas';if(balance.textContent!==text)balance.textContent=text;}
 q('#v6-profile-name').textContent=`${profile.name} · Taller Central`;q('#v6-profile-class').textContent=`Clase ${vehicleClass().toLowerCase()} · ${profile.sheets.length} pruebas registradas`;
 q('#v6-profile-level').textContent=profile.level;q('#v6-profile-progress').style.width=`${profile.xp%80/80*100}%`;
 q('#v6-drive-class').textContent=vehicleClass();q('#v6-drive-config').textContent=isRestomod()?'Chevrolet 250 · Conversión Restomod':'Original Chevrolet 250';
 const avg=conditionAverage();q('#v6-drive-condition').textContent=avg>82?'Lista para salir':avg>65?'Requiere revisión':'Servicio necesario';q('#v6-drive-condition-detail').textContent=`Condición general ${Math.round(avg)} % · Combustible ${Math.round(profile.condition.fuel)} %`;
 q('#v6-workshop-class').textContent=isRestomod()?'Restomod':'Original';q('#v6-originality-title').textContent=isRestomod()?'Conversión moderna declarada':'Configuración histórica preservada';q('#v6-originality-copy').textContent=isRestomod()?'Las tablas de referencia y competencia se guardan en clase Restomod.':'Sin conversiones modernas instaladas.';
 document.documentElement.style.setProperty('--v6-body',BODY_COLORS[profile.appearance.body]?.hex||'#d66a24');document.documentElement.style.setProperty('--v6-stripe',profile.appearance.stripe==='white'?'#eee9dc':'#111315');
 renderCollection();renderConditions();
}
function openPanel(name,focus=true){
 if(name!=='workshop')workshop.collectionInspectionReturn=false;
 qa('.v6-nav-btn').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v6Panel===name)));qa('.v6-panel').forEach(p=>p.classList.toggle('v6-active',p.id===`v6-${name==='tests'?'roadtest':name}-panel`));
 profile.lastPanel=name;saveProfile();if(name==='workshop'&&window.__chevyV6Complete?.menuReady)workshop.ensureLoaded();workshop.setActive(['drive','tests','competition','workshop','collection','settings'].includes(name));if(focus)q(`#v6-${name==='tests'?'roadtest':name}-panel h2`)?.focus?.();
 globalThis.__asfaltoMenuPresentation?.onPanel(name);if(name==='collection')void syncWorkshopCollection({details:true});
}
let lastFocused=null;
function publishHomeReadiness(){
 const app=window.__chevyV6Complete;if(!app?.menuReady)return false;if(app.homeReady)return true;
 const workshopReady=!!workshop.homeFrameReady&&!!q('#v6-workshop-loading')?.classList.contains('v6-hidden'),technicalFallback=workshop.failed===true;

 if(!globalThis.__asfaltoLoading?.completeBoot?.({menuReady:true,workshopReady,technicalFallback}))return false;
 app.homeReady=true;app.homeReadyAt=performance.now();app.homeReadyMode=technicalFallback?'technical-fallback':workshopReady?'rendered-workshop':'menu-shell';window.dispatchEvent(new CustomEvent('asfalto-home-ready',{detail:{at:app.homeReadyAt,mode:app.homeReadyMode}}));return true;
}
function silenceLegacyV5(){const legacy=window.__cockpitV5App;if(legacy){for(const surface of [legacy.hub,legacy.pause,legacy.results])if(surface){surface.hidden=true;surface.style.setProperty('display','none','important')}legacy._clearModal?.();legacy.shell?.setAttribute('aria-hidden','true')}document.body.classList.remove('v5-menu-open');const shell=q('#v6-game-shell');if(shell)shell.inert=false}
function openMenu(panel=profile.lastPanel||'drive'){
 globalThis.__asfaltoVehicleMaintenance?.flush({end:true});globalThis.__asfaltoVehicleAssistance?.hide();
 championshipResultsVisible=false;void leaveChampionship();cancelRoadTest('return-to-workshop');
 sessionRequestRunner?.cancel('menu');window.__cockpit?.raceWorld?.clearInputs?.();window.__cockpit?.raceWorld?.releaseTouchCaptures?.();
 const returnFilm=document.body.classList.contains('v6-driving')?globalThis.__asfaltoLoading?.begin('De vuelta al taller','Abriendo el taller…',{scene:'return'}):null;
 setSessionPaused(true);sessionLoop.stop();window.__cockpit?.raceWorld?.pause?.({reason:'menu'});globalThis.__asfaltoRacePresentation?.closePause();
 silenceLegacyV5();workshop.restoreAfterRace();lastFocused=document.activeElement;document.body.classList.add('v6-menu-open');document.body.classList.remove('v6-driving');q('#v6-main-menu').classList.remove('v6-hidden');q('#v6-main-menu').setAttribute('aria-hidden','false');openPanel(panel,false);workshop.setActive(true);setTimeout(()=>q(`.v6-nav-btn[data-v6-panel="${panel}"]`)?.focus(),30);ambient.start();
 globalThis.__asfaltoMenuPresentation?.onMenu(true);if(panel==='workshop')globalThis.__asfaltoMenuPresentation?.onPanel(panel);void syncWorkshopCollection();
 if(returnFilm)void returnFilm.painted.then(()=>returnFilm.end());
}
function closeMenu(){silenceLegacyV5();document.body.classList.remove('v6-menu-open');document.body.classList.add('v6-driving');q('#v6-main-menu').classList.add('v6-hidden');q('#v6-main-menu').setAttribute('aria-hidden','true');workshop.setActive(false);ambient.stop();globalThis.__asfaltoMenuPresentation?.onMenu(false);globalThis.__asfaltoNacionalV41?.radio?.setKeyboardArmed?.(false);const playfield=q('#viewport canvas');if(playfield){playfield.tabIndex=-1;playfield.focus({preventScroll:true})}else document.activeElement?.blur?.();}
function trapFocus(e,root){if(e.key!=='Tab')return;const list=qa('button:not([disabled]),select:not([disabled]),input:not([disabled]),[tabindex="0"]',root).filter(x=>x.offsetParent!==null);if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
function syncTouchPause(){
 const button=q('#v6-touch-pause');if(!button)return;
 const status=window.__cockpit?.raceWorld?.getState?.().status,paused=status==='PAUSED';
 button.disabled=status!=='RUNNING'&&!paused;
 button.textContent=paused?'▶':'Ⅱ';
 button.setAttribute('aria-pressed',String(paused));
 button.setAttribute('aria-label',paused?'Reanudar carrera':'Pausar carrera');
 button.title=paused?'Reanudar carrera':'Pausar carrera';
}
function setupTouchPause(){
 if(q('#v6-touch-pause'))return;
 const button=document.createElement('button');button.id='v6-touch-pause';button.type='button';
 button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(globalThis.__asfaltoRacePresentation?.requestPause)globalThis.__asfaltoRacePresentation.requestPause();else q('#race-pause')?.click();syncTouchPause()});
 q('#v6-game-shell').append(button);syncTouchPause();
}
function setupNavigation(){
 window.addEventListener('asfalto:runtime-fault',event=>{
  openMenu('drive');
  toast('La conducción se pausó por un error gráfico. Podés reintentar con Iniciar; si continúa, recargá la página.','warn');
  const status=q('#v6-status');if(status)status.textContent=String(event.detail?.message||'Error de render');
 });
 setupTouchPause();
 qa('.v6-nav-btn').forEach(btn=>btn.addEventListener('click',()=>openPanel(btn.dataset.v6Panel)));
 qa('[data-open-panel]').forEach(btn=>btn.addEventListener('click',()=>openPanel(btn.dataset.openPanel)));
 q('#v6-menu-toggle').addEventListener('click',()=>openMenu());q('#v6-return-menu').addEventListener('click',()=>openMenu('drive'));
 q('#v6-main-menu').addEventListener('keydown',e=>{trapFocus(e,q('#v6-main-menu'));if(e.key==='Escape'){if(document.body.classList.contains('v6-driving'))return;e.preventDefault();e.stopPropagation();globalThis.__asfaltoMenuPresentation?.onBack()}if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)&&document.activeElement?.classList.contains('v6-nav-btn')){e.preventDefault();const list=qa('.v6-nav-btn'),i=list.indexOf(document.activeElement),d=['ArrowDown','ArrowRight'].includes(e.key)?1:-1;list[(i+d+list.length)%list.length].focus()}});
 document.addEventListener('keydown',e=>{const results=q('#v6-results-sheet');if(results?.classList.contains('v6-open')){trapFocus(e,results);if(e.key==='Escape'){e.preventDefault();closeResults('drive')}return}if(e.defaultPrevented)return;if(e.target.isContentEditable||e.target.closest?.('[contenteditable=true],.an-v7-preferences'))return;if((e.key==='m'||e.key==='M')&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();document.body.classList.contains('v6-menu-open')?globalThis.__asfaltoMenuPresentation?.onBack():openMenu()}if(e.key==='Escape'&&document.body.classList.contains('v6-driving')&&!document.body.classList.contains('editor-mode-active')&&document.querySelector('#settings-panel')?.hidden!==false){e.preventDefault();globalThis.__asfaltoRacePresentation?.requestPause()}});
 q('#v6-confirm-cancel').addEventListener('click',()=>closeConfirm(false));q('#v6-confirm-ok').addEventListener('click',()=>closeConfirm(true));
}
function renderModeCards(){
 const tests=q('#v6-test-cards');tests.innerHTML='';for(const t of TESTS){const locked=profile.level<(t.unlock||1);const card=document.createElement('article');card.className=`v6-card${locked?' v6-locked':''}`;card.tabIndex=0;card.setAttribute('role','button');card.dataset.testId=t.id;card.innerHTML=`<h3>${t.title}</h3><p>${t.desc}</p><div class="v6-card-meta"><span class="v6-chip">${t.duration}</span><span class="v6-chip">${t.difficulty}</span><span class="v6-chip">${t.surface}</span></div><span class="v6-reward">${locked?`Nivel ${t.unlock}`:t.reward}</span>`;card.addEventListener('click',()=>{if(locked){toast(`Se desbloquea en nivel ${t.unlock}.`,'warn');return}profile.selectedTest=t.id;qa('[data-test-id]').forEach(x=>x.setAttribute('aria-selected',String(x===card)));q('#v6-test-start').disabled=false;q('#v6-test-start').textContent=`Preparar · ${t.title}`;saveProfile()});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}});tests.append(card)}
 const comps=q('#v6-competition-cards');comps.innerHTML='';for(const c of COMPETITIONS){const locked=profile.level<(c.unlock||1);const card=document.createElement('article');card.className=`v6-card${locked?' v6-locked':''}`;card.tabIndex=0;card.setAttribute('role','button');card.dataset.compId=c.id;card.innerHTML=`<h3>${c.title}</h3><p>${c.desc}</p><div class="v6-card-meta"><span class="v6-chip">${c.duration}</span><span class="v6-chip">${c.difficulty}</span></div><span class="v6-reward">${locked?`Nivel ${c.unlock}`:c.reward}</span>`;card.addEventListener('click',()=>{if(locked){toast(`Se desbloquea en nivel ${c.unlock}.`,'warn');return}profile.selectedCompetition=c.id;qa('[data-comp-id]').forEach(x=>x.setAttribute('aria-selected',String(x===card)));q('#v6-competition-start').disabled=false;q('#v6-competition-start').textContent=`Inscribirse · ${c.title}`;q('#v6-comp-laps').value='1';saveProfile()});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}});comps.append(card)}
 if(profile.selectedTest)q(`[data-test-id="${profile.selectedTest}"]`)?.click();if(profile.selectedCompetition)q(`[data-comp-id="${profile.selectedCompetition}"]`)?.click();
}
function renderAppearance(){
 const wrap=q('#v6-body-swatches');wrap.innerHTML='';for(const [id,c] of Object.entries(BODY_COLORS)){const b=document.createElement('button');b.type='button';b.className='v6-swatch';b.style.setProperty('--swatch',c.hex);b.title=c.label;b.dataset.body=id;b.setAttribute('aria-label',c.label);b.setAttribute('aria-pressed',String(profile.appearance.body===id));b.addEventListener('click',()=>{profile.appearance.body=id;qa('.v6-swatch').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));workshop.setCarColor(c.hex);saveProfile()});wrap.append(b)}const paintVehicle=workshop.vehicleId||globalThis.__asfaltoV7Storage.getItem('asfalto:nacional:v6:selected-vehicle')||'chevy';workshop.setCarColor(profile.vehiclePaintV7?.[paintVehicle]||BODY_COLORS[profile.appearance.body]?.hex||'#d66a24');
 q('#v6-stripe-select').value=profile.appearance.stripe;q('#v6-height-range').value=profile.appearance.height;q('#v6-height-output').textContent=`${profile.appearance.height} mm`;q('#v6-plate-input').value=profile.appearance.plate;
}
function renderParts(){const list=q('#v6-parts-list');list.innerHTML='';for(const part of WORKSHOP_PARTS){const state=profile.parts[part.id];const el=document.createElement('article');el.className=`v6-part ${state==='restomod'?'v6-restomod':'v6-original'}`;el.innerHTML=`<div class="v6-part-col"><b>${part.name} · Original</b><small>${part.original}</small></div><div class="v6-part-col"><b>Conversión</b><small>${part.modern}<br><strong>Efecto:</strong> ${part.benefit}<br><strong>Contrapartida:</strong> ${part.tradeoff}</small></div><div class="v6-part-state"><span>${state==='restomod'?'Restomod instalado':'Original conservado'}</span><button type="button" class="v6-btn v6-btn-small" data-part-toggle="${part.id}">${state==='restomod'?'Volver a original':'Instalar conversión'}</button></div>`;list.append(el)}qa('[data-part-toggle]').forEach(b=>b.addEventListener('click',()=>togglePart(b.dataset.partToggle)))}
async function togglePart(id){const part=PARTS.find(x=>x.id===id),next=profile.parts[id]==='restomod'?'original':'restomod';const ok=await confirmAction(next==='restomod'?'Instalar conversión':'Conservar original',next==='restomod'?`${part.modern}. ${part.benefit} Contrapartida: ${part.tradeoff}`:`Se restablecerá ${part.original} y la referencia histórica.`);if(!ok)return;profile.parts[id]=next;addHistory(part.name,next==='restomod'?`Instalada conversión: ${part.modern}.`:`Restablecida pieza original: ${part.original}.`,next==='restomod'?'Restomod':'Conservación');award({[part.axis]:2});renderParts();renderProfileSummary();applyVehicleConfig();saveProfile()}
function renderTuning(){const box=q('#v6-tuning-controls');box.innerHTML='';for(const t of WORKSHOP_TUNING){const label=document.createElement('label');label.className='v6-field';label.innerHTML=`<span>${t.label}<span class="v6-range-line"><output id="v6-tune-${t.id}-out">${profile.tuning[t.id]}${t.unit}</output></span></span><input id="v6-tune-${t.id}" type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${profile.tuning[t.id]}"><small>${t.desc}</small>`;box.append(label);q(`#v6-tune-${t.id}`,label).addEventListener('input',e=>{profile.tuning[t.id]=Number(e.target.value);q(`#v6-tune-${t.id}-out`).textContent=`${e.target.value}${t.unit}`})}}
function conditionState(v){return v>=78?'ok':v>=50?'warn':'bad'}
function renderConditions(){if(globalThis.__asfaltoWorkshopService){globalThis.__asfaltoWorkshopService.refresh();return;}const box=q('#v6-condition-grid');if(!box)return;box.addEventListener('click',handleConditionService);box.innerHTML='';for(const [id,meta] of Object.entries(CONDITION_META)){const v=clamp(profile.condition[id],0,100),el=document.createElement('article');el.className='v6-condition';el.dataset.state=conditionState(v);el.innerHTML=`<div class="v6-condition-head"><span>${meta.label}</span><span>${Math.round(v)} %</span></div><div class="v6-gauge"><i style="width:${v}%"></i></div><p>${meta.desc}</p><button type="button" class="v6-btn v6-btn-small" data-service="${id}">${v>=90?'Verificar':'Atender'}</button>`;box.append(el)}}
function handleConditionService(event){const button=event.target.closest?.('[data-service]');if(button&&event.currentTarget.contains(button))serviceItem(button.dataset.service)}
async function serviceItem(id){const before=globalThis.__asfaltoVehicleMaintenance.getState(),item=before.services.find(s=>s.id===id);if(!item?.available){toast(item?.condition>=99.999?'Este componente ya está en condiciones.':'Faltan fichas para este servicio.','warn');return before;}const result=await globalThis.__asfaltoVehicleMaintenance.service(id);addHistory('Servicio: '+item.label,'Componente reparado y condición física restablecida.','Mantenimiento');renderConditions();applyVehicleConfig();await saveProfile();toast(item.label+': servicio completado.','ok');return result;}
function renderHistory(){const box=q('#v6-history-list');box.innerHTML='';const combined=[...profile.history,...profile.sheets.map(s=>({date:s.date,title:`Ficha: ${s.title}`,copy:`${s.main} · ${s.valid?'Intento válido':'Intento invalidado'}`,type:'Road Test'}))];for(const h of combined.slice(0,40)){const el=document.createElement('article');el.className='v6-history-item';el.innerHTML=`<time>${h.date}</time><div><b>${h.title}</b><p>${h.copy}</p></div><em>${h.type||'Archivo'}</em>`;box.append(el)}}
function renderCollection(){const axes=q('#v6-axis-grid'),grid=q('#v6-collection-grid');if(!axes||!grid)return;axes.innerHTML='';for(const id of AXES){const v=profile.axes[id]||0,el=document.createElement('article');el.className='v6-axis';el.innerHTML=`<b>${id}</b><span>${Math.round(v)}</span><div class="v6-gauge"><i style="width:${v}%"></i></div>`;axes.append(el)}grid.innerHTML='';for(const item of COLLECTION){const locked=!profile.unlocked.includes(item.id),el=document.createElement('article');el.className='v6-collectible';el.dataset.locked=String(locked);el.innerHTML=`<b>${locked?'Archivo pendiente':item.title}</b><p>${locked?'Se desbloquea mediante dominio, oficio o contexto histórico.':item.copy}</p><small>${locked?'No descubierto':item.type}</small>`;grid.append(el)}const low=AXES.slice().sort((a,b)=>profile.axes[a]-profile.axes[b])[0];q('#v6-next-objective').innerHTML=`<strong>Próximo objetivo · ${low.toUpperCase()}:</strong> ${objectiveForAxis(low)}`}
function objectiveForAxis(id){return {dominio:'completá una prueba de frenada o slalom válida.',mecanica:'inspeccioná el auto y compará una pieza original con su conversión.',historia:'registrá una ficha con configuración histórica.',ruta:'completá un viaje sin averías ni recuperación.',competencia:'terminá una carrera clasificada.',coleccion:'documentá una prueba y tomá una fotografía de taller.'}[id]}
function setValue(selectors,value){for(const s of selectors){const el=q(s);if(!el)continue;el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('input',{bubbles:true}));return true}return false}
function reflectValue(selectors,value){for(const s of selectors){const el=q(s);if(el){el.value=String(value);return true}}return false}
function clickFirst(selectors){for(const s of selectors){const el=q(s);if(el){el.click();return true}}return false}
function normalizeTrack(id){const value=String(id||'');if(PLAYABLE_TRACK_IDS.has(value))return value;throw new Error((value||'circuito desconocido')+' · NO DISPONIBLE')}
async function waitForExistingGameReady(timeoutMs=180000,{signal,onStage}={}){
 const {startupDemand,waitForSignal,waitForCondition}=await startupDemandReady;
 await globalThis.__asfaltoEngineBootstrap.start({signal});
 signal?.throwIfAborted();
 if(workshop.deviceProfile?.phone){onStage?.('Liberando el taller antes de cargar la pista…');await waitForSignal((await phoneMemoryReady).releasePhoneWorkshopForRace(workshop,{signal}),signal);}
 await startupDemand.request({signal,onStage});signal?.throwIfAborted();
 if(window.__cockpit?.ready===true)return window.__cockpit;
 toast('PREPARANDO JUEGO...','info');
 return waitForCondition(()=>{const cockpit=window.__cockpit;if(cockpit?.error)throw new Error(cockpit.error);return cockpit?.ready===true?cockpit:false;},{signal,timeoutMs});
}
async function getSessionRequestRunner(){
 const tools=await experienceToolsReady;
 if(!sessionRequestRunner)sessionRequestRunner=tools.createSessionTransactionRunner({
  onCancel:metadata=>openMenu(metadata?.editor?'settings':metadata?.championship?'competition':'drive'),
  begin({metadata,cancel,retry}){
   const presentationOwner={};sessionPresentationOwner=presentationOwner;const phoneLoadToken=globalThis.__asfaltoPhoneLoad?.begin();
   globalThis.__asfaltoRacePresentationHeld=true;workshop.setActive(false);
   setSessionPaused(true);sessionLoop.stop();window.__cockpit?.raceWorld?.clearInputs?.();window.__cockpit?.raceWorld?.releaseTouchCaptures?.();window.__cockpit?.raceWorld?.pause?.({reason:'menu'});
   const cinema=globalThis.__asfaltoLoading?.begin('Preparando la salida','Ajustando el auto y cargando la ruta…',{track:metadata.track});
   const ui=globalThis.__asfaltoV7Experience?.beginLoad({label:'Preparando la salida',cancel,retry});
   q('.an-v7-load-state [data-cancel]')?.focus({preventScroll:true});
   return {canRetry:!!ui,stage(label,done,total){globalThis.__asfaltoPhoneLoad?.stage(label,phoneLoadToken);cinema?.stage(label);ui?.stage(label,done,total);},fail(message){ui?.fail(message);toast(message,'warn');},async end(success){try{ui?.finish(success?(metadata.editor?'editor':'opening'):'workshop');await cinema?.end();}finally{if(sessionPresentationOwner===presentationOwner){globalThis.__asfaltoPhoneLoad?.finish(success,phoneLoadToken);globalThis.__asfaltoRacePresentationHeld=false;if(!success&&document.body.classList.contains('v6-menu-open')){workshop.restoreAfterRace();workshop.setActive(!document.hidden);}}}globalThis.__asfaltoV7Experience?.syncPhase();}};
  }
 });
 return sessionRequestRunner;
}
async function openOriginalSettings(){await leaveChampionship();cancelRoadTest('configuration-editor');const runner=await getSessionRequestRunner();const success=await runner.run(async transaction=>{transaction.stage('Preparando el editor del cockpit…');const cockpit=await transaction.wait(waitForExistingGameReady(180000,{signal:transaction.signal,onStage:transaction.stage}));if(!cockpit||!transaction.isCurrent())return false;return true;},{editor:true});if(success){closeMenu();window.__cockpit.openCockpitSettings(true);globalThis.__asfaltoV7Experience?.syncPhase();}return success;}
let gameLaunchPreparing=false;
async function configureExistingGame(options){
 if(gameLaunchPreparing)return false;gameLaunchPreparing=true;
 try{return await prepareExistingGame(options)}finally{gameLaunchPreparing=false}
}
async function prepareExistingGame(options){
 const runner=await getSessionRequestRunner();
 return runner.run(async transaction=>{
  transaction.stage('Preparando el vehículo seleccionado…');
  if(workshop.vehicleSelector?.diagnostics().pending){const loaded=await transaction.wait(workshop.vehicleSelector.whenSettled());if(!transaction.isCurrent())return false;if(!loaded)throw new Error('No se pudo preparar el auto seleccionado. Revisá el taller.');}
  return configureExistingGameReady(options,transaction);
 },options);
}
async function configureExistingGameReady({track,weather,skyId=profile.lastSky||'clear',mode,laps,difficulty},transaction){
 const check=()=>{if(!transaction.isCurrent())throw new DOMException('Carga cancelada','AbortError');};check();transaction.stage('Esperando al cockpit…');
 if(['light-snow','heavy-snow'].includes(weather)&&!['cuesta_lipan','paso_garibaldi'].includes(track)){toast('La nieve está disponible en Garibaldi y Lipán. Elegí otro clima para esta ruta.','warn');return false}
 const cockpit=await transaction.wait(waitForExistingGameReady(180000,{signal:transaction.signal,onStage:transaction.stage}));check();if(!cockpit)throw new Error('El cockpit no está listo. Podés reintentar.');
 transaction.stage('Preparando exterior del auto seleccionado…');
 const selection=await workshop.ensureRaceVehicleSelection();await selection.ensureApplied(cockpit,{signal:transaction.signal});check();
 transaction.stage('Auto seleccionado listo; preparando circuito…');
 const previousTrack=persistedTrack(cockpit.raceGetState?.()?.track?.id||profile.lastRoute);let selectedTrack;
 try{selectedTrack=normalizeTrack(track);transaction.stage('Cargando terreno, asfalto y entorno…');await cockpit.raceSelectCircuit(selectedTrack,{skyId,weather,signal:transaction.signal});check();}catch(error){if(transaction.signal.aborted)throw error;reflectValue(['#race-circuit','#race-track','#track-select','#circuit-select'],previousTrack);for(const selector of ['#v6-drive-route','#v6-comp-track'])reflectValue([selector],previousTrack);toast(`No se pudo cargar el circuito. ${String(error?.message||error)}`,'warn');return false}
 reflectValue(['#race-circuit','#race-track','#track-select','#circuit-select'],selectedTrack);
 // raceSelectCircuit commits the selected sky/weather in the same scene transaction.
 check();transaction.stage('Confirmando controles y sesión…');
 setValue(['#race-mode','#mode-select'],mode);setValue(['#race-laps','#laps-select'],mode==='practice'?1:clamp(Number(laps)||1,1,3));setValue(['#race-difficulty','#difficulty-select'],difficulty);
 check(); // raceStart prepares the complete final scene once, including the selected vehicle and weather.
 return true;
}
function persistPlayableRoute(id){const track=normalizeTrack(id);profile.lastRoute=track;reflectValue(['#v6-drive-route'],track);reflectValue(['#v6-comp-track'],track);const app=window.__cockpitV5App;if(app?.config){app.config.track=track;app._syncTrackCards?.();app._saveConfig?.()}else{const config=safeJSON(globalThis.__asfaltoV7Storage.getItem('cockpit-v5-config'),{})||{};config.track=track;try{globalThis.__asfaltoV7Storage.setItem('cockpit-v5-config',JSON.stringify(config))}catch{}}saveProfile();return track}function startExistingGame(){return clickFirst(['#race-start','#start-race','#garage-start','#start-button'])}
function getGameState(){
 const api=window.__cockpit||{};let state=null;
 try{state=api.race?.getState?.()||api.raceWorld?.getState?.()||api.getState?.()||null}catch{}
 const snapshot=api.raceWorld?.getRenderFrame?.().currentSnapshot||{};
 const velocity=snapshot.chassis?.linearVelocity;const speed=Array.isArray(velocity)&&velocity.every(Number.isFinite)?Math.hypot(...velocity)*3.6:Number(state?.speedKph??state?.speed??q('#speed-value')?.textContent??0)||0;
 const rpm=Number(state?.rpm??q('#rpm-value')?.textContent??0)||0;
 return {speed,rpm,gear:snapshot.gearbox?.gear??api.getState?.().gear??q('#gear-value')?.textContent??'N',snapshot,distance:Number(state?.distance??state?.raceDistance??0)||0,lateral:Number(state?.lateral??state?.playerX??0)||0,steer:Number(state?.steer??state?.steering??0)||0,offTrack:Boolean(state?.offTrack),collision:Boolean(state?.collision||state?.lastCollision),penalty:Number(state?.penaltyTime??state?.penalty??0)||0,lap:Number(state?.lap??0)||0,finished:Boolean(state?.finished||state?.phase==='FINISHED'||state?.status==='FINISHED'),raw:state};
}
function reconcileChassisConfig(){
 const m=globalThis.AsfaltoV6Chassis;if(!profile.chassis||!m)return;
 const previous=m.chassisProfilePatch(profile.chassis),next={...profile.chassis};
 for(const key of ['frontPressure','rearPressure','brakeBias','steerRatio'])next[key]=profile.tuning[key];
 if(profile.appearance.wheel!==previous.appearance.wheel){next.rim={steel:0,sport73:1,restomod:2}[profile.appearance.wheel]||0;next.kit=Math.min(next.kit,next.rim);}
 if(profile.appearance.tire!==previous.appearance.tire)next.tire={bias:0,radial:1,modern:2}[profile.appearance.tire]||0;
 if(profile.parts.brakes!==previous.parts.brakes)next.kit=profile.parts.brakes==='restomod'?1:0;
 next.steeringAssist=profile.parts.steering==='restomod';
 const patch=m.chassisProfilePatch(next);profile.chassis=patch.chassis;for(const key of ['appearance','parts','tuning'])Object.assign(profile[key],patch[key]);
}
async function setChassisConfig(value){
 const m=await import(new URL('src/game/chassis-configuration.mjs?v=cb4421d5b87d806c',document.baseURI));globalThis.AsfaltoV6Chassis=m;
 const patch=m.chassisProfilePatch(value);profile.chassis=patch.chassis;for(const key of ['appearance','parts','tuning'])Object.assign(profile[key],patch[key]);
 addHistory('Tren rodante actualizado','Llantas '+(patch.chassis.rim+1)+' · neumáticos '+(patch.chassis.tire+1)+' · frenos '+(patch.chassis.kit+1)+'; presiones '+patch.chassis.frontPressure+'/'+patch.chassis.rearPressure+' psi.','Mecánica');
 applyVehicleConfig();renderAll();saveProfile();return deepClone(profile.chassis);
}
function applyVehicleConfig(){
 reconcileChassisConfig();globalThis.__asfaltoChassisConfig=profile.chassis?deepClone(profile.chassis):null;workshop.vehiclePresentation?.setChassisConfig(globalThis.__asfaltoChassisConfig);
 const detail={version:V6_VERSION,class:vehicleClass(),appearance:deepClone(profile.appearance),parts:deepClone(profile.parts),tuning:deepClone(profile.tuning),condition:deepClone(profile.condition),chassis:profile.chassis?deepClone(profile.chassis):null};window.dispatchEvent(new CustomEvent('chevy:vehicle-config',{detail}));
 const api=window.__cockpit||{};try{api.setVehicleConfig?.(detail);api.race?.setVehicleConfig?.(detail)}catch{}
}
const activeSession={type:null,definition:null,startTime:0,lastTime:0,lastSpeed:0,distance:0,maxSpeed:0,series:[],thresholds:{},valid:true,reasons:[],phase:'idle',brakeStart:null,brakeDistance:0,steerChanges:0,lastSteerSign:0,lowSpeedTurns:0,completed:false,config:null,pausedAt:null,startMeasure:null};
function resetSession(){cancelRoadTest();lastExperienceUiTime=-Infinity;Object.assign(activeSession,{type:null,definition:null,startTime:0,lastTime:0,lastSpeed:0,distance:0,maxSpeed:0,series:[],thresholds:{},valid:true,reasons:[],phase:'idle',brakeStart:null,brakeDistance:0,steerChanges:0,lastSteerSign:0,lowSpeedTurns:0,completed:false,config:null,pausedAt:null,startMeasure:null})}
function cancelRoadTest(reason='attempt-canceled'){
 const previous=roadTestSession;roadTestSession=null;activeSession.roadTestSessionId=null;previous?.cancel(reason);window.__cockpit?.raceWorld?.clearRoadTestGates?.();roadTestReceiptStore?.clearPending();
}
function readRoadTestConfiguration(){
 reconcileChassisConfig();const ui=window.__cockpit?.raceWorld?.getState?.().ui;if(!ui?.assists)throw new Error('Las ayudas físicas todavía no están disponibles.');
 return {vehicleId:workshop.vehicleId,class:vehicleClass(),parts:deepClone(profile.parts),tuning:deepClone(profile.tuning),chassis:profile.chassis?deepClone(profile.chassis):null,wheel:profile.appearance.wheel,tire:profile.appearance.tire,assists:deepClone(ui.assists),tireWear:ui.tireWear};
}
async function loadRoadTestTools(){
 if(roadTestTools)return roadTestTools;
 return roadTestToolsPromise||(roadTestToolsPromise=Promise.all([import(new URL('src/menu/v7-roadtest-session.mjs?v=4450177759448c35',document.baseURI)),import(new URL('src/menu/v7-roadtest-profile.mjs?v=9d8202ef5e8ea7fd',document.baseURI))]).then(([session,store])=>{
  roadTestTools={...session,...store};roadTestReceiptStore=store.createRoadTestProfileStore({getProfile:()=>profile,replaceProfile:p=>{profile=p;profileExpectedRevision=(p.storageRevision||0)+':'+(p.motorsportV7?.revision||0);renderProfileSummary();void syncWorkshopCollection();}});return roadTestTools;
 }).catch(error=>{roadTestToolsPromise=null;throw error;}));
}
function invalidateRoadTestConfiguration(){roadTestConfigVersion++;if(activeSession.type==='roadtest'&&roadTestSession&&!activeSession.completed)roadTestSession.cancel('configuration-changed');}
function setSessionPaused(paused){
 const now=performance.now();
 if(paused){if(activeSession.pausedAt===null)activeSession.pausedAt=now;return}
 if(activeSession.pausedAt===null)return;
 const elapsed=now-activeSession.pausedAt;
 for(const key of ['startTime','brakeStart','startMeasure'])if(Number.isFinite(activeSession[key]))activeSession[key]+=elapsed;
 activeSession.lastTime=now;activeSession.pausedAt=null;
}
async function restartSession(){
 if(activeSession.type==='championship'){await leaveChampionship();return (await loadChampionshipMenu()).start();}
 const type=activeSession.type,config=activeSession.config||{};
 if(config.track)reflectValue(['#v6-drive-route','#v6-comp-track'],config.track);
 if(config.weather)reflectValue(['#v6-drive-weather','#v6-comp-weather'],config.weather);
 if(config.difficulty)reflectValue(['#v6-comp-difficulty'],config.difficulty);
 return type==='roadtest'?startRoadTest():type==='competition'?startCompetition():startDrive(type||'free');
}
function invalidate(reason){if(!activeSession.valid)return;activeSession.valid=false;activeSession.reasons.push(reason);toast(`INTENTO INVALIDADO · ${reason}`,'warn');updateObjective()}
async function openPreparedRace(tx){
 tx.stage('Confirmando la primera imagen de la carrera…');
 window.__cockpit.prepareRacePresentation();if(!tx.isCurrent())return false;
 closeMenu();q('#v6-objective-hud').classList.add('v6-visible');updateObjective();
 const {waitForAnimationFrame}=await startupDemandReady;
 await waitForAnimationFrame(tx.signal,()=>window.__cockpit.prepareRacePresentation());await waitForAnimationFrame(tx.signal);return tx.isCurrent();
}
async function startDrive(mode){
 if(!canLeaveWorkshop())return false;await leaveChampionship();cancelRoadTest();profile.selectedDrive=mode;await saveProfile();
 const requestedTrack=q('#v6-drive-route').value,weather=q('#v6-drive-weather').value,runner=await getSessionRequestRunner();
 const success=await runner.run(async tx=>{
  if(workshop.vehicleSelector?.diagnostics().pending){if(!await tx.wait(workshop.vehicleSelector.whenSettled()))return false;}
  if(!await configureExistingGameReady({track:requestedTrack,weather,mode:'practice',laps:1,difficulty:'normal'},tx))return false;
  const track=persistPlayableRoute(requestedTrack);applyVehicleConfig();resetSession();activeSession.type=mode;activeSession.definition={id:mode,title:mode==='journey'?'Viaje':'Conducción libre'};activeSession.startTime=performance.now();activeSession.lastTime=activeSession.startTime;activeSession.phase='running';activeSession.config={track,weather};
  tx.stage('Preparando el auto y el semáforo de largada…');await tx.wait(window.__cockpit.raceStart({signal:tx.signal,onStage:tx.stage}));if(!tx.isCurrent())return false;return openPreparedRace(tx);
 },{track:requestedTrack});
 if(success){toast(mode==='journey'?'VIAJE INICIADO · cuidá temperatura y combustible':'CONDUCCIÓN LIBRE · sin medición activa','ok');sessionLoop.start();}return success;
}
async function startRoadTest(){
 if(!canLeaveWorkshop())return false;
 await leaveChampionship();cancelRoadTest();const def=TESTS.find(t=>t.id===profile.selectedTest);if(!def)return false;
 try{
  const tools=await loadRoadTestTools(),track=normalizeTrack(q('#v6-drive-route').value),weather=def.weather||q('#v6-drive-weather').value||'clear',runner=await getSessionRequestRunner();
  const success=await runner.run(async tx=>{
   if(workshop.vehicleSelector?.diagnostics().pending){const loaded=await tx.wait(workshop.vehicleSelector.whenSettled());if(!loaded||!tx.isCurrent())return false;}
   if(!await configureExistingGameReady({track,weather,mode:'practice',laps:1,difficulty:'normal'},tx))return false;
   persistPlayableRoute(track);applyVehicleConfig();resetSession();
   const configuration=readRoadTestConfiguration(),configurationHash=await tools.configurationFingerprint(configuration),configurationKey=JSON.stringify(configuration),configVersion=roadTestConfigVersion,sessionId=crypto.randomUUID();
   if(!tx.isCurrent())return false;
   Object.assign(activeSession,{type:'roadtest',definition:def,startTime:performance.now(),lastTime:performance.now(),phase:'preparing',roadTestSessionId:sessionId,roadTestReceipt:null,roadTestSavePhase:null,config:{track,weather,class:configuration.class,configurationHash}});
   tx.stage('Preparando la prueba física…');await window.__cockpit.raceStart({signal:tx.signal,onStage:tx.stage});
   if(!tx.isCurrent()||activeSession.roadTestSessionId!==sessionId)return false;
   if(JSON.stringify(readRoadTestConfiguration())!==configurationKey||roadTestConfigVersion!==configVersion)throw new Error('La configuración cambió durante la preparación.');
   const w=window.__cockpit.raceWorld,context=w.getRoadTestContext(),observation=w.getPhysicalObservationState();
   if(context.qa!==false||observation.qa!==false||new URLSearchParams(location.search).get('qa')==='1')throw new Error('Esta sesión usa herramientas de prueba. Volvé al taller e iniciá una sesión normal para obtener medallas.');
   const definition={maxActiveSeconds:600,vehicleHalfWidthM:.93};
   if(def.id==='consumption'){if(!(context.displacementLiters>0))throw new Error('Falta la cilindrada documentada para estimar el consumo.');definition.displacementLiters=context.displacementLiters;}
   if(def.id==='slalom'){definition.gates=tools.createSlalomCourse({routeQuery:context.routeQuery,startProgressM:context.projection.raceProgress});w.setRoadTestGates(definition.gates,{sessionSequence:observation.sessionSequence});}
   const isCurrent=()=>activeSession.roadTestSessionId===sessionId&&roadTestConfigVersion===configVersion&&w.getPhysicalObservationState().sessionSequence===observation.sessionSequence&&w.getPhysicalObservationState().qa===false;
   activeSession.roadTestIsCurrent=isCurrent;
   roadTestSession=tools.createRoadTestSession({testId:def.id,sessionId,configurationHash,trackId:track,vehicleId:configuration.vehicleId,class:configuration.class,sessionSequence:observation.sessionSequence,definition,world:w,isCurrent,getInstrument:()=>window.__cockpit.getInstrumentReadings?.(),onCompleted:receipt=>queueMicrotask(()=>{void finishRoadTest(receipt,sessionId);}),onInvalidated:state=>queueMicrotask(()=>finishInvalidRoadTest(state,sessionId))});
   activeSession.phase=roadTestSession.getState().phase;return openPreparedRace(tx);
  },{track,roadtest:true});
  if(success){toast('PRUEBA PREPARADA · '+def.title,'ok');sessionLoop.start();}
  else cancelRoadTest();return success;
 }catch(error){cancelRoadTest();toast('No se pudo preparar la prueba: '+roadTestMessage(error),'warn');return false;}
}
async function startCompetition(){
 if(!canLeaveWorkshop())return false;await leaveChampionship();cancelRoadTest();const def=COMPETITIONS.find(c=>c.id===profile.selectedCompetition);if(!def)return false;
 const requestedTrack=q('#v6-comp-track').value,weather=q('#v6-comp-weather').value,difficulty=q('#v6-comp-difficulty').value,laps=clamp(Number(q('#v6-comp-laps').value)||1,1,3),runner=await getSessionRequestRunner();
 const success=await runner.run(async tx=>{
  if(workshop.vehicleSelector?.diagnostics().pending){if(!await tx.wait(workshop.vehicleSelector.whenSettled()))return false;}
  if(!await configureExistingGameReady({track:requestedTrack,weather,mode:def.mode,laps,difficulty},tx))return false;
  const track=persistPlayableRoute(requestedTrack);applyVehicleConfig();resetSession();activeSession.type='competition';activeSession.definition=def;activeSession.startTime=performance.now();activeSession.lastTime=activeSession.startTime;activeSession.phase='running';activeSession.config={track,weather,difficulty,laps,class:vehicleClass()};
  await tx.wait(window.__cockpit.raceStart({signal:tx.signal,onStage:tx.stage}));if(!tx.isCurrent())return false;return openPreparedRace(tx);
 },{track:requestedTrack});if(success){toast('COMPETENCIA · '+def.title,'ok');sessionLoop.start();}return success;
}function updateObjective(){const now=performance.now();if(now-lastExperienceUiTime<100)return;lastExperienceUiTime=now;const main=q('#v6-objective-main'),sub=q('#v6-objective-sub');if(!activeSession.type){main.textContent='Sin sesión';sub.textContent='Volvé al taller para elegir una actividad';return}const d=activeSession.definition,s=getGameState(),elapsed=(activeSession.pausedAt??performance.now())-activeSession.startTime;
 if(experienceTools)globalThis.__asfaltoV7Experience?.update(experienceTools.sessionTelemetry({snapshot:s.snapshot,race:s.raw||{},speedKph:s.speed,gear:s.gear,activity:activeSession.type}));main.textContent=d?.title||activeSession.type;if(activeSession.type==='roadtest'){
  const state=roadTestSession?.getState(),phase=state?.phase||activeSession.phase;
  let txt=Math.round(s.speed)+' km/h · '+fmtTime((state?.activeSeconds||0)*1000);
  if(['accel100','accel160','m500','m1000'].includes(d.id)&&['arming','armed'].includes(phase))txt=phase==='arming'?'Detené el auto durante medio segundo para armar la salida.':'Salida armada · acelerá desde reposo.';
  else if(['m500','m1000'].includes(d.id))txt='Recorrido total: '+Math.round(state?.distanceM||0)+' m · meta: '+d.target+' m desde la salida.';
  else if(d.id==='vmax')txt='Sostené al menos 175 km/h estables durante 3 s, con el acelerador bien presionado.';
  else if(d.id==='brake100')txt=phase==='running'?'Acelerá hasta 100 km/h.':phase==='ready-to-brake'?'FRENÁ AHORA · mantené el freno hasta detenerte.':'Detené el auto completamente y mantené el freno.';
  else if(d.id==='slalom')txt='Puertas '+(state?.gateIndex||0)+'/8 · cruzalas en orden.';
  else if(d.id==='recovery')txt='Mantené cuarta y embrague acoplado entre 80 y 120 km/h.';
  else if(d.id==='turn')txt='Completá un círculo entre 2 y 17 km/h, manteniendo el mismo giro sobre suelo firme.';
  else if(d.id==='wet')txt=Math.round(state?.distanceM||0)+'/1800 m · frenada y apoyo sobre asfalto húmedo.';
  else if(d.id==='speedo')txt='Sostené 100 ±2 km/h durante 5 s · lectura del instrumento real.';
  else if(d.id==='consumption')txt='Sostené 60 km/h durante al menos 2,4 km · consumo estimado por modelo.';
  sub.textContent=(phase==='invalid'?'INVALIDADO':'EN MEDICIÓN')+' · '+txt;
 }else if(activeSession.type==='journey')sub.textContent=`${(activeSession.distance/1000).toFixed(1)} km · combustible ${Math.round(profile.condition.fuel)} % · condición ${Math.round(conditionAverage())} %`;
 else if(activeSession.type==='championship'){const ledger=window.__cockpit?.raceWorld?.getChampionshipClassification?.();sub.textContent=ledger?.participants?.find(p=>p.id==='player')?.status==='finished'?'Llegada registrada · esperando a Falcon':Math.round(s.speed)+' km/h · duelo físico contra Falcon';}
 else if(activeSession.type==='competition')sub.textContent=`${Math.round(s.speed)} km/h · vuelta ${s.lap||1} · ${activeSession.valid?'clasificado':'con penalización'}`;
 else sub.textContent=`${Math.round(s.speed)} km/h · ${fmtTime(elapsed)}`;
}
const sessionLoop={running:false,stopFrame:null,start(){if(this.running)return;this.running=true;this.stopFrame=frameScheduler.subscribe('session',t=>{syncTouchPause();updateSession(t);},{hz:30,enabled:()=>this.running&&document.body.classList.contains('v6-driving')&&!document.body.classList.contains('an-race-paused')});},stop(){this.running=false;this.stopFrame?.();this.stopFrame=null;}};
window.addEventListener('asfalto:runtime-dispose',()=>{sessionLoop.stop();setSessionPaused(true);});
function updateSession(t){if(!activeSession.type||activeSession.completed||activeSession.pausedAt!==null)return;if(activeSession.type==='roadtest'){updateObjective();return;}const s=getGameState();if(s.raw?.status==='IDLE'||s.raw?.status==='COUNTDOWN'){activeSession.startTime+=Math.max(0,t-activeSession.lastTime);activeSession.lastTime=t;updateObjective();return;}const dt=clamp((t-activeSession.lastTime)/1000,0,0.1);activeSession.lastTime=t;activeSession.distance+=Math.max(0,s.speed)/3.6*dt;activeSession.maxSpeed=Math.max(activeSession.maxSpeed,s.speed);if(activeSession.series.length<2400&&(!activeSession.series.length||t-activeSession.startTime-activeSession.series.at(-1).t>100)){activeSession.series.push({t:t-activeSession.startTime,speed:s.speed,rpm:s.rpm,distance:activeSession.distance,lateral:s.lateral})}
 if(activeSession.type!=='championship'){if(s.offTrack)invalidate('SALIDA FUERA DE ZONA');if(s.collision)invalidate('CHOQUE');if(s.penalty>0&&!activeSession.reasons.includes('PENALIZACIÓN'))invalidate('PENALIZACIÓN');}
 if(activeSession.type==='journey')updateJourney(s,t,dt);else if(activeSession.type==='competition'&&(s.finished||t-activeSession.startTime>45*60*1000))finishCompetition(s,t);updateObjective();activeSession.lastSpeed=s.speed;
}
function updateJourney(s,t,dt){if(t-activeSession.startTime>20*60*1000)finishJourney(s,t)}
function roadTestMessage(value){
 const reason=String(value?.message||value||'');
 const messages={
  'recovery-gear-or-clutch':'Se cambió de marcha o se pisó el embrague. Repetí de 80 a 120 km/h manteniendo cuarta.',
  'reverse-during-measurement':'El auto retrocedió durante la medición. Repetí la prueba avanzando hacia la meta.',
  'physical-impact':'El auto recibió un golpe. Repetí la prueba sin chocar.',
  'unsupported-vehicle':'El auto perdió apoyo. Repetí la prueba manteniendo las ruedas sobre terreno firme.',
  'outside-measurement-zone':'Saliste de la zona de medición. Repetí la prueba dentro del camino.',
  'slalom-gate-missed':'No atravesaste una puerta completa. Repetí y pasá entre todos los conos en orden.',
  'time-limit-objective-incomplete':'Se agotaron los 10 minutos sin completar el objetivo. Repetí la prueba.',
  'circle-sample-budget':'No se pudo cerrar un círculo medible. Repetí en una zona plana y amplia.',
  'surface-not-physically-wet':'El suelo no está suficientemente húmedo. Volvé al taller y elegí lluvia.',
  'teleport-or-recovery':'La recuperación del auto interrumpió la medición. Empezá otra prueba.',
  'configuration-changed':'Cambió la configuración del auto. Empezá otra prueba con el ajuste elegido.',
  'session-or-configuration-changed':'Cambió la sesión o la configuración del auto. Empezá otra prueba.',
  'session-changed':'Cambió la sesión. Empezá otra prueba.',
  'attempt-canceled':'Se canceló el intento. Elegí la prueba para empezar de nuevo.',
  'return-to-workshop':'Volviste al taller. Elegí la prueba para empezar de nuevo.',
  'configuration-editor':'Se abrió la configuración. Empezá otra prueba después de ajustar el auto.',
  'receipt-creation-or-validation-failed':'No se pudo confirmar la medición. Volvé al taller y repetí la prueba.',
  'Otro taller actualizó el archivo. Recargá antes de guardar.':'El perfil cambió en otra ventana. Recargá la página antes de continuar.',
  'La configuración cambió durante la preparación.':'Cambió la configuración durante la preparación. Volvé a iniciar la prueba.',
  'Falta la cilindrada documentada para estimar el consumo.':'Este auto no tiene datos suficientes para estimar el consumo. Elegí otro auto.',
  'El intento ya no es la sesión actual.':'El intento terminó o cambió. Empezá otra prueba.',
  'El identificador del resultado ya existe con otra medición.':'Esta prueba ya tiene otro resultado guardado. Empezá una nueva.',
  'Archivo de pruebas no compatible.':'El archivo de pruebas no es compatible con esta versión. Revisá el perfil desde el taller.'
 };
 if(messages[reason])return messages[reason];
 if(/qa|herramientas de prueba/i.test(reason))return 'Esta sesión usa herramientas de prueba. Volvé al taller e iniciá una sesión normal para obtener medallas.';
 if(/lock unavailable/i.test(reason))return 'Este navegador no permite guardar la prueba. Abrila en Chrome y repetí el intento.';
 if(/persistent storage|quota|almacenamiento/i.test(reason))return 'El navegador no permite guardar. Revisá el permiso de almacenamiento y reintentá.';
 if(/guardado|disco|recibo|receipt/i.test(reason))return 'No se pudo confirmar el resultado. Reintentá el guardado sin repetir la conducción.';
 return 'La medición se interrumpió. Volvé al taller y repetí la prueba.';
}
function finishInvalidRoadTest(state,sessionId){
 if(activeSession.roadTestSessionId!==sessionId||activeSession.completed)return;activeSession.completed=true;activeSession.valid=false;activeSession.phase='invalid';activeSession.reasons=[...state.invalidReasons];sessionLoop.stop();window.__cockpit?.raceWorld?.pause?.({reason:'result'});
 const telemetry=roadTestSession?.getTelemetry()||{series:[],maxSpeed:0};showResults({title:activeSession.definition.title,main:'—',unit:'sin marca válida',valid:false,reasons:activeSession.reasons.map(roadTestMessage),elapsed:state.activeSeconds*1000,distance:state.distanceM,maxSpeed:telemetry.maxSpeed,series:telemetry.series,class:activeSession.config.class});
 q('#v6-results-progress').textContent='La prueba terminó sin una marca válida. Revisá el motivo y elegí Repetir actividad para intentarlo de nuevo.';
}
async function finishRoadTest(receipt,sessionId){
 if(activeSession.roadTestSessionId!==sessionId||!activeSession.roadTestIsCurrent?.()||activeSession.roadTestSavePhase==='saving')return false;
 activeSession.completed=true;activeSession.roadTestReceipt=receipt;activeSession.roadTestSavePhase='saving';sessionLoop.stop();window.__cockpit?.raceWorld?.pause?.({reason:'result'});
 const telemetry=roadTestSession?.getTelemetry()||{series:[],maxSpeed:0},sheet=roadTestTools.roadTestResultSheet(receipt,{title:activeSession.definition.title,series:telemetry.series});sheet.maxSpeed=telemetry.maxSpeed;
 showResults({...sheet,valid:false,reasons:['Guardando el resultado.']});q('#v6-results-verdict').textContent='Prueba completada. Guardando el resultado…';q('#v6-results-progress').textContent='Esperá a que termine el guardado para confirmar tu medalla.';q('#v6-results-repeat').disabled=true;
 try{
  await roadTestReceiptStore.accept(receipt,{isCurrent:activeSession.roadTestIsCurrent,sheet});
  if(activeSession.roadTestSessionId!==sessionId)return false;activeSession.roadTestSavePhase='saved';activeSession.valid=true;showResults(sheet);
  q('#v6-results-verdict').textContent='Prueba completada y resultado guardado.';
  q('#v6-results-progress').textContent=receipt.testId==='consumption'?'Medalla obtenida. El consumo mostrado es una estimación por modelo y no una medición de combustible real.':'Medalla obtenida. Podés verla en la colección del taller.';void syncWorkshopCollection();return true;
 }catch(error){
  if(activeSession.roadTestSessionId!==sessionId)return false;activeSession.roadTestSavePhase='save-error';activeSession.valid=false;showResults({...sheet,valid:false,reasons:[roadTestMessage(error)]});q('#v6-results-verdict').textContent=roadTestMessage(error);q('#v6-results-progress').textContent='La medalla todavía no está confirmada. Reintentá el guardado; no necesitás repetir la conducción.';q('#v6-results-repeat').textContent='Reintentar guardado';return false;
 }
}
function finishJourney(s,t){if(activeSession.completed)return;activeSession.completed=true;sessionLoop.stop();const km=activeSession.distance/1000;profile.journey.km+=km;profile.journey.routes.push({date:dateStamp(),km:round(km),route:q('#v6-drive-route').value});addHistory('Bitácora de viaje',`${km.toFixed(1)} km recorridos. Velocidad máxima ${Math.round(activeSession.maxSpeed)} km/h.`,'Ruta');award({ruta:Math.min(10,Math.max(2,km/4)),mecanica:2});applyWear(km/20);saveProfile();showResults({title:'Bitácora de viaje',valid:true,main:km.toFixed(1),unit:'kilómetros',maxSpeed:round(activeSession.maxSpeed),elapsed:t-activeSession.startTime,distance:activeSession.distance,consistency:82,series:activeSession.series,reasons:[],class:vehicleClass()})}
function finishCompetition(s,t){if(activeSession.completed)return;activeSession.completed=true;sessionLoop.stop();
 const race=s.raw||{},officialSeconds=[race.totalWithPenalty,race.totalTime].find(value=>Number.isFinite(value)&&value>=0);
 const elapsed=Number.isFinite(officialSeconds)?officialSeconds*1000:t-activeSession.startTime,distance=Number.isFinite(race.raceProgress)&&race.raceProgress>=0?race.raceProgress:activeSession.distance;
 // Match the HUD's progress ranking; equal endpoint progress is not a finish timestamp.
 const position=window.CockpitV5Core?.derivePosition?.(race)??(1+(Array.isArray(race.rivals)?race.rivals:[]).filter(r=>(Number(r.raceProgress)||0)>(Number(race.raceProgress)||0)).length);
 profile.championship.events++;profile.championship.points+=Math.max(1,8-position*2);if(position===1)profile.championship.wins++;addHistory(activeSession.definition.title,`Puesto ${position} · ${fmtTime(elapsed)} · ${vehicleClass()}.`,'Competencia');award({competencia:position===1?12:7,dominio:4,coleccion:position===1?4:1});applyWear(2);saveProfile();showResults({title:activeSession.definition.title,valid:activeSession.valid,main:`P${position}`,unit:'clasificación',maxSpeed:round(activeSession.maxSpeed),elapsed,distance,consistency:78,series:activeSession.series,reasons:activeSession.reasons,class:vehicleClass()})}
function applyWear(){globalThis.__asfaltoVehicleMaintenance?.flush();}
function verdictFor(r){if(!r.valid)return `El intento no produjo una marca válida: ${(r.reasons||[]).join(', ').toLowerCase()}.`;if(r.title?.includes('Frenada')&&Number(r.main)<48)return'Frenada consistente. El auto quedó alineado.';if(r.maxSpeed>170)return'Buena recta; régimen correcto y caja precisa.';if(r.consistency>88)return'Salida limpia y repetible. La configuración trabaja pareja.';return'Intento válido. Hay margen para afinar técnica y puesta a punto.'}
function showResults(r){
 q('#v6-results-repeat').disabled=false;q('#v6-results-repeat').textContent='Repetir actividad';
 const measured=getGameState(),temperatureC=measured.snapshot?.engine?.temperatureC,race=measured.raw||{};r.experienceFacts=r.experienceFacts||experienceTools?.sessionResultFacts({activity:activeSession.type,race,elapsedMs:r.elapsed,valid:r.valid,reason:(r.reasons||[]).join(', '),progress:r.valid?'Intento válido registrado.':'Intento registrado sin marca válida.'});
 window.__cockpit?.raceWorld?.clearInputs?.();window.__cockpit?.raceWorld?.releaseTouchCaptures?.();
 // Own the modern modal before either finish observer can let V5 reclaim it.
 document.body.classList.add('v6-menu-open');document.body.classList.remove('v6-driving');silenceLegacyV5();
 q('#v6-results-title').textContent=r.title||'Ficha técnica';q('#v6-results-subtitle').textContent=`Chevy Serie 2 · ${r.class||vehicleClass()} · ${dateStamp()}`;q('#v6-results-main').textContent=r.main??'—';q('#v6-results-unit').textContent=r.unit||'resultado';q('#v6-results-verdict').textContent=verdictFor(r);
 const metrics=[['Tiempo',fmtTime(r.elapsed||0)],['Velocidad máxima',`${Math.round(r.maxSpeed||0)} km/h`],['Distancia',`${Math.round(r.distance||0)} m`],['Consistencia',Number.isFinite(r.consistency)?`${Math.round(r.consistency)} %`:'Sin dato'],['Temperatura',Number.isFinite(temperatureC)?`${Math.round(temperatureC)} °C`:'Sin dato'],['Daño',`${Math.round(100-profile.condition.body)} %`]];q('#v6-results-metrics').innerHTML=metrics.map(([a,b])=>`<div class="v6-sheet-metric"><small>${a}</small><b>${b}</b></div>`).join('');
 const details=[`Clase registrada: ${r.class||vehicleClass()}`,`Condición general: ${Math.round(conditionAverage())} %`,`Neumáticos: ${Math.round(profile.condition.tires)} %`,`Frenos: ${Math.round(profile.condition.brakes)} %`,r.valid?'Intento válido para archivo.':`Invalidado: ${(r.reasons||[]).join(', ')}`];q('#v6-results-details').innerHTML=details.map(x=>`<li>${x}</li>`).join('');q('#v6-results-progress').innerHTML=`<div class="v6-note"><strong>Archivo actualizado.</strong> ${r.valid?'Se sumaron fichas de oficio y progreso coherente con la actividad.':'La experiencia suma conocimiento, pero no ingresa en la tabla de referencia.'}</div>`;drawResultChart(r.series||[]);q('#v6-results-sheet').classList.add('v6-open');if(r.experienceFacts)globalThis.__asfaltoV7Experience?.showResult(r.experienceFacts,q('#v6-results-metrics'));globalThis.__asfaltoV7Experience?.syncPhase();q('#v6-results-repeat').focus();
}
function drawResultChart(series){const c=q('#v6-results-chart'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#eee7d9';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#a49d90';ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(0,h*i/6);ctx.lineTo(w,h*i/6);ctx.stroke()}if(series.length<2)return;const max=Math.max(60,...series.map(x=>x.speed)),tmax=series.at(-1).t||1;ctx.strokeStyle='#b54e1c';ctx.lineWidth=3;ctx.beginPath();series.forEach((p,i)=>{const x=p.t/tmax*w,y=h-8-p.speed/max*(h-16);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle='#222';ctx.font='700 18px monospace';ctx.fillText('VELOCIDAD / TIEMPO',14,24)}
function closeResults(destination='drive'){q('#v6-results-sheet').classList.remove('v6-open');resetSession();q('#v6-objective-hud').classList.remove('v6-visible');openMenu(destination)}
function setupActions(){
 qa('[data-drive-mode]').forEach(card=>{card.addEventListener('click',()=>{profile.selectedDrive=card.dataset.driveMode;qa('[data-drive-mode]').forEach(x=>x.setAttribute('aria-selected',String(x===card)));saveProfile()});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}})});q(`[data-drive-mode="${profile.selectedDrive}"]`)?.click();
 q('#v7-championship-open').addEventListener('click',openChampionship);q('#v7-earned-album-open').addEventListener('click',openEarnedAlbum);window.addEventListener('pagehide',event=>{if(!event.persisted)earnedAlbum?.dispose();});
 q('#v6-drive-start').addEventListener('click',()=>startDrive(profile.selectedDrive));q('#v6-test-start').addEventListener('click',startRoadTest);q('#v6-competition-start').addEventListener('click',startCompetition);
 q('#v6-test-history').addEventListener('click',()=>{openPanel('workshop');openWorkshopTab('history')});q('#v6-championship-view').addEventListener('click',()=>toast(`Club: ${profile.championship.points} puntos · ${profile.championship.events} eventos · ${profile.championship.wins} victorias.`));
 qa('.v6-rail-btn').forEach(b=>b.addEventListener('click',()=>openWorkshopTab(b.dataset.workshopTab)));qa('[data-open-chassis]').forEach(b=>b.addEventListener('click',()=>{openWorkshopTab('chassis');q('[data-workshop-tab=chassis]')?.focus()}));
 q('#v6-height-range').addEventListener('input',e=>q('#v6-height-output').textContent=`${e.target.value} mm`);
 q('#v6-appearance-apply').addEventListener('click',()=>{profile.appearance.stripe=q('#v6-stripe-select').value;profile.appearance.height=Number(q('#v6-height-range').value);profile.appearance.plate=(q('#v6-plate-input').value||'C-1973').toUpperCase();addHistory('Apariencia actualizada',`${BODY_COLORS[profile.appearance.body].label}; franja ${profile.appearance.stripe}; ${profile.appearance.plate}.`,'Apariencia');award({historia:2,coleccion:1});applyVehicleConfig();renderProfileSummary();saveProfile();toast('APARIENCIA APLICADA','ok')});
 q('#v6-clean-car').addEventListener('click',()=>serviceItem('dirt'));
 q('#v6-appearance-original').addEventListener('click',async()=>{if(!await confirmAction('Restaurar apariencia','Se restablecerán la altura visual y la franja de referencia. Se conservan el color, la patente y la configuración de ruedas, dirección y frenos.'))return;Object.assign(profile.appearance,{stripe:'black',height:0});renderAppearance();renderProfileSummary();applyVehicleConfig();saveProfile();toast('CONFIGURACIÓN ORIGINAL RESTABLECIDA','ok')});
 q('#v6-tuning-save').addEventListener('click',()=>{addHistory('Puesta a punto guardada',`Presiones ${profile.tuning.frontPressure}/${profile.tuning.rearPressure} psi; reparto ${profile.tuning.brakeBias} %.`,'Ajuste');award({mecanica:3,dominio:1});applyVehicleConfig();saveProfile();toast('PUESTA A PUNTO GUARDADA','ok')});
 q('#v6-tuning-reset').addEventListener('click',()=>{for(const t of WORKSHOP_TUNING)profile.tuning[t.id]=DEFAULT_PROFILE.tuning[t.id];renderTuning();applyVehicleConfig();saveProfile();toast('BASE DE FÁBRICA RESTABLECIDA')});q('#v6-tuning-road').addEventListener('click',()=>startDrive('practice'));
 q('#v6-service-recommended').addEventListener('click',async()=>{for(const service of globalThis.__asfaltoVehicleMaintenance.getState().services.filter(s=>s.available).sort((a,b)=>a.condition-b.condition).slice(0,2))await serviceItem(service.id)});q('#v6-inspect-all').addEventListener('click',()=>{const state=globalThis.__asfaltoVehicleMaintenance.getState();addHistory('Inspección general',state.faults.length?state.faults.map(f=>f.label).join(' · '):'Condición '+Math.round(conditionAverage())+' %.','Inspección');saveProfile();renderHistory();toast('INSPECCIÓN REGISTRADA','ok')});
 q('#v6-export-profile').addEventListener('click',exportProfile);q('#v6-import-profile').addEventListener('click',()=>q('#v6-import-file').click());q('#v6-import-file').addEventListener('change',importProfile);
 q('#v6-photo-focus').addEventListener('change',e=>workshop.focus(e.target.value));q('#v6-photo-lens').addEventListener('change',e=>workshop.setLens(Number(e.target.value)));q('#v6-photo-exposure').addEventListener('input',e=>{q('#v6-photo-exposure-output').textContent=`${Number(e.target.value).toFixed(1)} EV`;workshop.setExposure(Number(e.target.value))});q('#v6-photo-capture').addEventListener('click',capturePhoto);q('#v6-photo-reset').addEventListener('click',()=>{workshop.focus('general');q('#v6-photo-focus').value='general';q('#v6-photo-lens').value='50';q('#v6-photo-exposure').value=0;workshop.setLens(50);workshop.setExposure(0)});
 q('#v6-open-original-settings').addEventListener('click',()=>void openOriginalSettings());document.addEventListener('click',event=>{if(event.target.closest?.('#settings-toggle')&&!window.__cockpit?.ready){event.preventDefault();event.stopImmediatePropagation();void openOriginalSettings();}},true);q('#v6-fullscreen').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.());q('#v6-reset-profile').addEventListener('click',resetProfile);
 qa('[data-v6-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.v6Preset)));for(const id of ['ui-large','reduce-motion','high-contrast','captions','photosafe'])q(`#v6-${id}`).addEventListener('change',readAccessibility);
 q('#v6-results-close').addEventListener('click',()=>closeResults('drive'));q('#v6-results-workshop').addEventListener('click',()=>closeResults('workshop'));q('#v6-results-repeat').addEventListener('click',()=>{q('#v6-results-sheet').classList.remove('v6-open');const type=activeSession.type,def=activeSession.definition;if(type==='championship'){void loadChampionshipMenu().then(menu=>menu.repeat());}else if(type==='roadtest'){if(activeSession.roadTestSavePhase==='save-error')void finishRoadTest(activeSession.roadTestReceipt,activeSession.roadTestSessionId);else{profile.selectedTest=def.id;startRoadTest()}}else if(type==='competition'){profile.selectedCompetition=def.id;startCompetition()}else startDrive(type||'free')});
 qa('[data-workshop-camera]').forEach(b=>b.addEventListener('click',()=>{qa('[data-workshop-camera]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(b.dataset.workshopCamera==='collection')openCollectionInspection();else workshop.focus(b.dataset.workshopCamera)}));
}
function openCollectionInspection(){workshop.collectionInspectionReturn=true;openPanel('workshop',false);openWorkshopTab('photo');const focus=q('#v6-photo-focus');if(focus)focus.value='collection';workshop.focus('collection');requestAnimationFrame(()=>q('#v6-photo-focus')?.focus({preventScroll:true}));}
function closeCollectionInspection(){if(!workshop.collectionInspectionReturn)return false;workshop.collectionInspectionReturn=false;openWorkshopTab('appearance');openPanel('collection',false);workshop.focus('general');requestAnimationFrame(()=>q('#v6-view-collection')?.focus({preventScroll:true}));return true;}
function openWorkshopTab(name){qa('.v6-rail-btn').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.workshopTab===name)));qa('.v6-workshop-tab').forEach(p=>p.classList.toggle('v6-active',p.dataset.workshopPage===name));workshop.chassis?.setActive(name==='chassis');if(name==='history')renderHistory();if(name==='photo')workshop.focus('general');globalThis.__asfaltoMenuPresentation?.onWorkshopTab()}
function exportProfile(){const data=JSON.stringify({format:'ChevySerie2Profile',version:6,exportedAt:new Date().toISOString(),profile},null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`Chevy_Serie2_Archivo_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ARCHIVO EXPORTADO','ok')}
async function importProfile(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.format!=='ChevySerie2Profile')throw new Error('Formato no reconocido');profile=migrateProfile(data.profile);applyVehicleConfig();saveProfile();renderAll();toast('ARCHIVO IMPORTADO','ok')}catch(err){toast(`No se pudo importar: ${err.message}`,'warn')}e.target.value=''}
async function capturePhoto(){try{const data=workshop.capture();if(!data)throw new Error('La vista 3D todavía no está lista');const a=document.createElement('a');a.href=data;a.download=`Chevy_Taller_${Date.now()}.png`;a.click();profile.photos.unshift({date:dateStamp(),focus:q('#v6-photo-focus').value,lens:q('#v6-photo-lens').value});profile.photos=profile.photos.slice(0,30);addHistory('Fotografía de taller',`${q('#v6-photo-focus').selectedOptions[0].text} · ${q('#v6-photo-lens').value} mm.`,'Fotografía');award({coleccion:3,historia:1});saveProfile();toast('FOTOGRAFÍA ARCHIVADA','ok')}catch(err){toast(err.message,'warn')}}
async function resetProfile(){if(!await confirmAction('Restablecer progreso','Se eliminarán fichas, historial, fotografías, configuraciones y progreso local. Esta acción no puede deshacerse.'))return;profile=deepClone(DEFAULT_PROFILE);applyVehicleConfig();saveProfile();renderAll();toast('PROGRESO RESTABLECIDO','warn')}
function applyPreset(id){profile.settings.preset=id;if(id==='original'){delete profile.chassis;profile.parts=deepClone(DEFAULT_PROFILE.parts);profile.tuning=deepClone(DEFAULT_PROFILE.tuning);Object.assign(profile.appearance,{wheel:'steel',tire:'bias',height:0,stripe:'black'})}else if(id==='balanced'){Object.assign(profile.tuning,{frontPressure:30,rearPressure:32,brakeBias:61,frontDamping:5,rearDamping:4})}else if(id==='assisted'){profile.settings.highContrast=true;profile.settings.uiLarge=true;profile.parts.steering='restomod'}else if(id==='restomod'){for(const p of PARTS)profile.parts[p.id]='restomod';profile.appearance.wheel='restomod';profile.appearance.tire='modern'}renderAll();applyVehicleConfig();saveProfile();toast(`PRESET ${id.toUpperCase()} APLICADO`,'ok')}
function readAccessibility(){profile.settings.uiLarge=q('#v6-ui-large').checked;profile.settings.reducedMotion=q('#v6-reduce-motion').checked;profile.settings.highContrast=q('#v6-high-contrast').checked;profile.settings.captions=q('#v6-captions').checked;profile.settings.photosafe=q('#v6-photosafe').checked;applyAccessibility();saveProfile()}
function applyAccessibility(){document.documentElement.style.setProperty('--v6-ui-scale',profile.settings.uiLarge?'1.16':'1');document.body.classList.toggle('v6-reduce-motion',profile.settings.reducedMotion);document.body.classList.toggle('v6-high-contrast',profile.settings.highContrast);document.body.classList.toggle('v6-photosafe',profile.settings.photosafe);q('#v6-ui-large').checked=profile.settings.uiLarge;q('#v6-reduce-motion').checked=profile.settings.reducedMotion;q('#v6-high-contrast').checked=profile.settings.highContrast;q('#v6-captions').checked=profile.settings.captions;q('#v6-photosafe').checked=profile.settings.photosafe}
async function decodeGzipBase64(text,onProgress){const clean=text.replace(/\s/g,''),chunk=1024*256,parts=[];let total=0;for(let i=0;i<clean.length;i+=chunk){const bin=atob(clean.slice(i,i+chunk));const arr=new Uint8Array(bin.length);for(let j=0;j<bin.length;j++)arr[j]=bin.charCodeAt(j);parts.push(arr);total+=arr.length;onProgress?.(i/clean.length*.42);await new Promise(r=>setTimeout(r,0))}const packed=new Uint8Array(total);let off=0;for(const p of parts){packed.set(p,off);off+=p.length}if(!('DecompressionStream'in window))throw new Error('Este navegador no puede descomprimir el taller autocontenido');const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')),buffer=await new Response(stream).arrayBuffer();onProgress?.(.5);return buffer}
async function loadThreeModule(){
 await globalThis.__asfaltoEngineBootstrap.start();
 const existing=window.__chevyV6Three||window.THREE;
 if(existing)return existing;
 if(window.__chevyThreeLoadError)throw window.__chevyThreeLoadError;
 return await new Promise((resolve,reject)=>{
  let settled=false;
  const cleanup=()=>{window.removeEventListener('chevy-three-ready',onReady);window.removeEventListener('chevy-three-error',onError)};
  const finish=value=>{if(settled)return;settled=true;cleanup();if(value)resolve(value);else reject(new Error('Three.js compartido no disponible'))};
  const fail=reason=>{if(settled)return;settled=true;cleanup();const error=reason?.detail||window.__chevyThreeLoadError||reason||new Error('No se pudo iniciar Three.js');reject(error instanceof Error?error:new Error(String(error)))};
  const onReady=event=>finish(event?.detail||window.__chevyV6Three||window.THREE);
  const onError=event=>fail(event);
  window.addEventListener('chevy-three-ready',onReady);
  window.addEventListener('chevy-three-error',onError);
  queueMicrotask(()=>{const current=window.__chevyV6Three||window.THREE;if(current)finish(current);else if(window.__chevyThreeLoadError)fail(window.__chevyThreeLoadError)});
 });
}
class WorkshopRenderer{
 constructor(){this.canvas=q('#v6-workshop-canvas');this.active=false;this.loading=false;this.loaded=false;this.failed=false;this.yaw=.72;this.pitch=.24;this.radius=8.6;this.target={x:0,y:1.35,z:0};this.targetPose=null;this.drag=null;this.raf=0;this.last=0;this.exposure=0;this.car=null;this.resources=[];this.hotspots={general:{yaw:.72,pitch:.24,radius:8.6,target:[0,1.35,0]},front:{yaw:1.55,pitch:.2,radius:5.8,target:[0,1.02,0]},engine:{yaw:1.45,pitch:.42,radius:4.6,target:[.4,1.12,0]},wheel:{yaw:1.0,pitch:.08,radius:3.8,target:[1.4,.55,1]},interior:{yaw:-.1,pitch:.18,radius:3.4,target:[-.2,1.12,0]},bench:{yaw:-1.4,pitch:.25,radius:8.5,target:[-5,1.7,-1]}};this.bind()}
 bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};this.canvas.setPointerCapture?.(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw=this.drag.yaw-(e.clientX-this.drag.x)*.006;this.pitch=clamp(this.drag.pitch+(e.clientY-this.drag.y)*.004,-.15,(this.engine?.diagnostics().active||this.chassis?.diagnostics().active) ? 1.55 : 1.1);this.targetPose=null});const end=()=>this.drag=null;this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.radius=clamp((this.camera?this.camera.position.distanceTo(this.target):this.radius)*Math.exp(e.deltaY*.001),(this.engine?.diagnostics().active||this.chassis?.diagnostics().active) ? .55 : 3.3,28);this.targetPose=null},{passive:false});window.addEventListener('resize',()=>this.resize());this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.failed=true;this.stopFrame?.();this.stopFrame=null;this.raf=0;q('#v6-workshop-fallback').classList.remove('v6-hidden');toast('El contexto 3D del taller se perdió. Se mantiene el menú técnico.','warn')});this.canvas.addEventListener('webglcontextrestored',async()=>{this.restoring=true;await this.loadingTask;this.releaseScene();this.failed=false;this.loading=false;this.restoring=false;this.ensureLoaded()})}
 releaseScene(){
  const remaining=snapshotSceneResources(this.scene,{borrowedRoots:[window.__chevyV3Template],disposeBorrowedGpu:true});
  const features=['advancedGraphics','chassis','vehicleSelector','rayTracing','engine','inspection','vehiclePresentation','presentation'];
  const resources=new Set(this.resources),renderer=this.renderer;this.resources=[];
  try{disposeAllSync([
   ()=>earnedAlbum?.releasePosters(),()=>this.stopFrame?.(),
   ...features.map(key=>()=>{const owner=this[key];this[key]=null;owner?.dispose();}),
   ()=>this.key?.shadow?.dispose(),...Array.from(resources,resource=>()=>{try{resource.dispose?.();}finally{resource.close?.();}}),
   ()=>remaining.dispose(),()=>renderer?.renderLists?.dispose(),()=>renderer?.dispose(),
  ],'No se pudo liberar todo el taller');}
  finally{this.stopFrame=null;this.raf=0;this.cameraConstraint=null;this.renderer=null;this.scene=null;this.car=null;this.workshopRoot=null;this.loaded=false;}
 }
 restoreAfterRace(){if(this.memorySuspended){this.memorySuspended=false;this.ensureLoaded();}}
 setActive(v){v=!!v&&!globalThis.__asfaltoRacePresentationHeld;if(this.memorySuspended){this.active=false;this.stopFrame?.();this.stopFrame=null;this.raf=0;return;}if(v&&!this.active)this.advancedGraphics?.beginFrameWindow();this.active=v;if(!v){this.engine?.suspend();this.chassis?.setActive(false);}if(v&&this.loaded)this.loop();else if(!v){cancelAnimationFrame(this.raf);this.raf=0}}
 async ensureRaceVehicleSelection(){
  if(this.raceVehicleSelection)return this.raceVehicleSelection;
  const [{createDeferredRaceVehicle},{getVehicleDefinition}]=await Promise.all([import(new URL('src/menu/deferred-race-vehicle.mjs?v=003597099ad21a01',document.baseURI)),import(new URL('src/render/vehicle-catalog.mjs?v=1fb2dbf31facc389',document.baseURI))]);
  const saved=globalThis.__asfaltoV7Storage.getItem('asfalto:nacional:v6:selected-vehicle');
  return this.raceVehicleSelection??=createDeferredRaceVehicle({initialSelected:getVehicleDefinition(saved)?saved:'chevy'});
 }
 ensureLoaded(){if(this.memorySuspended)return this.loadingTask;if(this.loaded||this.failed||this.restoring)return this.loadingTask;if(this.loading)return this.loadingTask;this.loadingTask=this.loadScene();return this.loadingTask}
 async loadScene(){this.loading=true;q('#v6-workshop-stage').classList.remove('an-load-failed');const loading=q('#v6-workshop-loading');const stage=globalThis.__asfaltoLoading.workshop(loading);const bar=q('.v6-progress>i',loading);loading.classList.remove('v6-hidden');try{stage('Preparando el taller…');bar.style.width='4%';this.T=await loadThreeModule();stage('Cargando paredes, herramientas y materiales…');bar.style.width='12%';const node=q('#v6-workshop-payload');if(!node)throw new Error('Modelo del taller no encontrado');const glb=node.dataset.encoding === 'external-url' ? (await globalThis.AsfaltoV6AssetCore.readExternalPayload(node)).buffer : await decodeGzipBase64(node.textContent,p=>bar.style.width=`${12+p*62}%`);stage('Montando el auto, luces y reflejos…');bar.style.width='76%';await this.initScene(glb,p=>bar.style.width=`${76+p*22}%`);stage('Preparando el auto seleccionado…');if(this.vehicleSelector&&!(await this.vehicleSelector.restore()))throw new Error('No se pudo preparar el vehículo seleccionado');stage('Preparando materiales y reflejos…');const {preparePrograms}=await import(new URL('src/render/shader-preparation.mjs?v=528cb164c75c6707',document.baseURI));this.advancedGraphics.refresh();this.advancedGraphics.update({time:0});await this.advancedGraphics.prepare(()=>preparePrograms(this.renderer,this.scene,this.camera));this.loaded=true;this.loading=false;stage('Taller listo');loading.setAttribute('aria-busy','false');stage.dispose?.();bar.style.width='100%';setTimeout(()=>{loading.classList.add('v6-hidden');publishHomeReadiness();},450);q('#v6-workshop-fallback').classList.add('v6-hidden');this.loop();toast('TALLER MECÁNICO 1973 CARGADO','ok')}catch(err){console.error('[V6 workshop]',err);this.releaseScene();this.failed=true;this.loading=false;loading.setAttribute('aria-busy','false');stage.dispose?.();loading.classList.remove('an-cinema-loading');q('#v6-workshop-stage').classList.add('an-load-failed');loading.replaceChildren();const message=document.createElement('p');message.textContent=`No se pudo abrir el taller: ${err.message}`;const retry=document.createElement('button');retry.type='button';retry.textContent=err.requiresReload?'Recargar página':'Reintentar';retry.addEventListener('click',()=>{if(err.requiresReload){location.reload();return;}this.failed=false;loading.innerHTML='<span>Preparando el taller…</span><div class="v6-progress"><i></i></div>';this.ensureLoaded();},{once:true});loading.append(message,retry);q('#v6-workshop-fallback').classList.remove('v6-hidden');publishHomeReadiness();}}
 async initScene(glb,onProgress){const {detectDeviceProfile,deviceGraphicsQuality}=await import(new URL('src/performance/mobile-device-profile.mjs?v=f090574cb3e87b2d',document.baseURI));this.deviceProfile=detectDeviceProfile();const T=this.T;this.renderer=createOwnedRenderer(T,{canvas:this.canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.deviceProfile.phone?1.25:innerWidth<720?1.25:1.75));this.renderer.toneMapping=T.ACESFilmicToneMapping??0;this.renderer.toneMappingExposure=1.06;if('outputColorSpace'in this.renderer)this.renderer.outputColorSpace=T.SRGBColorSpace;this.scene=new T.Scene();this.scene.background=new T.Color(0x111416);this.scene.fog=new T.FogExp2(0x111416,.018);this.camera=new T.PerspectiveCamera(46,1,.05,120);this.hemi=new T.HemisphereLight(0xc9d7dd,0x342418,1.45);this.scene.add(this.hemi);this.key=new T.DirectionalLight(0xffe2bd,3.2);this.key.position.set(7,12,5);this.scene.add(this.key);this.fill=new T.DirectionalLight(0x9ebcd2,1.15);this.fill.position.set(-8,7,-7);this.scene.add(this.fill);this.warm=new T.PointLight(0xff8b42,2.8,18,1.5);this.warm.position.set(4,3,-3);this.scene.add(this.warm);
 const parsed=this.parseGLB(glb),root=await this.buildGLTF(parsed,onProgress);this.scene.add(root);const box=new T.Box3().setFromObject(root),size=new T.Vector3(),center=new T.Vector3();box.getSize(size);box.getCenter(center);const max=Math.max(size.x,size.z,size.y*.7)||1,scale=18/max;root.scale.set(scale,scale*.8,scale);root.position.set(-center.x*scale,-box.min.y*scale*.8,-center.z*scale);root.rotation.y=Math.PI;root.updateMatrixWorld(true);const rotatedBox=new T.Box3().setFromObject(root),rotatedCenter=new T.Vector3();rotatedBox.getCenter(rotatedCenter);root.position.x-=rotatedCenter.x;root.position.y-=rotatedBox.min.y;root.position.z-=rotatedCenter.z;root.updateMatrixWorld(true);this.workshopRoot=root;this.addChevyV3Car();const appearance=await import(new URL('src/render/workshop-presentation.mjs?v=2eadb5f26606283a',document.baseURI));await appearance.enhanceWorkshop(this);const {createVehiclePresentation}=await import(new URL('src/render/vehicle-presentation.mjs?v=6698fa8c93c2dcfc',document.baseURI));this.vehiclePresentation=await createVehiclePresentation(T,{vehicle:'chevy',lodLevels:[0],modelRoot:this.car,loadGlb:window.__asfaltoLoadVehicleModel,paintColor:this.paintColor||globalThis.__chevyPaintColor||'#d66a24'});const exteriorBounds=new T.Box3().setFromObject(this.vehiclePresentation.root);this.car.position.y+=(this.car.userData.surfaceY||0)-exteriorBounds.min.y;this.car.userData.floorY=this.car.position.y;this.vehiclePresentation.setEnvironment(this.presentation.getRoomEnvironment());const {createWorkshopInspection}=await import(new URL('src/render/workshop-inspection.mjs?v=f49feba020fb38ff',document.baseURI));this.inspection=createWorkshopInspection(T,this);const {createWorkshopEngine}=await import(new URL('src/render/workshop-engine.mjs?v=f57b4eeb4ba5e02f',document.baseURI));this.engine=createWorkshopEngine(T,this);const {createWorkshopChassis}=await import(new URL('src/render/workshop-chassis.mjs?v=13b36eb3a7d8a770',document.baseURI));this.chassis=createWorkshopChassis(T,this);const {createWorkshopCameraConstraint}=await import(new URL('src/render/workshop-camera-constraint.mjs?v=6bb6a252c77710d0',document.baseURI));this.cameraConstraint=createWorkshopCameraConstraint(T,root,{obstacleRoots:[root,...this.scene.children.filter(o=>o.name==='Workshop_Blender_Service_Details'||o.name==='Workshop_Detail_Pass_1973'||o.name==='WorkshopCollection'||o.name==='Workshop_Architecture_E31'||o.name==='Workshop_LivedIn_E31')]});const {createRayTracedOcclusion}=await import(new URL('src/render/ray-traced-occlusion.mjs?v=6eb33370562f7d1a',document.baseURI));this.rayTracing=createRayTracedOcclusion({THREE:T,renderer:this.renderer,scene:this.scene,camera:this.camera,excludeOccluders:()=>[this.car,this.engine?.mount],mode:globalThis.__asfaltoRayTracing?.getMode()||'off'});this.resize();this.focus('general',true);globalThis.__asfaltoMenuPresentation?.configureWorkshop(this);const {installWorkshopVehicleSelector}=await import(new URL('src/menu/workshop-vehicle-selector.mjs?v=07ed16267b944629',document.baseURI));const {prepareWorkshopVehicle}=await import(new URL('src/render/workshop-vehicle-selection.mjs?v=ec939da84cd5b6bc',document.baseURI));const {createDeferredRaceVehicle}=await import(new URL('src/menu/deferred-race-vehicle.mjs?v=003597099ad21a01',document.baseURI));this.raceVehicleSelection??=createDeferredRaceVehicle();this.vehicleSelector=installWorkshopVehicleSelector({workshop:this,prepareWorkshop:id=>prepareWorkshopVehicle(T,this,id),prepareRace:id=>this.raceVehicleSelection.prepare(id)});const {createAdvancedGraphics}=await import(new URL('src/render/advanced-graphics.mjs?v=49c9ba840e7a5576',document.baseURI));this.advancedGraphics=createAdvancedGraphics(T,{renderer:this.renderer,scene:this.scene,camera:this.camera,scope:'workshop',phone:this.deviceProfile.phone,getMaximumQuality:()=>{let master='auto';try{master=globalThis.__asfaltoAdvancedGraphics?.getMasterQuality?.()||JSON.parse(globalThis.__asfaltoV7Storage?.getItem('cockpit-chevy-settings-v6')||'{}').graphicsQuality||'auto';}catch{}return deviceGraphicsQuality(master,this.deviceProfile);},getEnvironment:()=>({skyId:this.presentation?.diagnostics().lighting==='night'?'night':'clear',weather:'clear',keyLightDirection:this.key.position.toArray(),keyLightColor:'#'+this.key.color.getHexString(),sunIntensity:this.key.intensity})});}
 parseGLB(buffer){const dv=new DataView(buffer);if(dv.getUint32(0,true)!==0x46546c67)throw new Error('GLB inválido');const length=dv.getUint32(8,true);let off=12,json=null,bin=null;while(off<length){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true),data=buffer.slice(off+8,off+8+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(data).replace(/\0+$/,''));else if(type===0x004e4942)bin=data;off+=8+len}if(!json||!bin)throw new Error('GLB incompleto');return{json,bin}}
 accessor(parsed,index){const {json,bin}=parsed,a=json.accessors[index],v=json.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16}[a.type],types={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Ctor=types[a.componentType],bytes=Ctor.BYTES_PER_ELEMENT,itemBytes=components*bytes,stride=v.byteStride||itemBytes,start=(v.byteOffset||0)+(a.byteOffset||0);let array;if(stride===itemBytes&&start%bytes===0)array=new Ctor(bin,start,a.count*components).slice();else{array=new Ctor(a.count*components);const view=new DataView(bin);const getter={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType];for(let i=0;i<a.count;i++)for(let c=0;c<components;c++)array[i*components+c]=view[getter](start+i*stride+c*bytes,true)}return{array,itemSize:components,normalized:Boolean(a.normalized),count:a.count}}
 async buildGLTF(parsed,onProgress){const mobileDecode=this.deviceProfile?.phone?(await import(new URL('src/performance/mobile-image-decode.mjs?v=7924431ea96dad26',document.baseURI))).decodeMobileBoundedImage:null;const T=this.T,{json,bin}=parsed,images=[];for(let i=0;i<(json.images||[]).length;i++){const im=json.images[i];try{let blob;if(im.bufferView!=null){const v=json.bufferViews[im.bufferView],bytes=bin.slice(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);blob=new Blob([bytes],{type:im.mimeType||'image/png'})}else if(im.uri?.startsWith('data:')){const [head,b64]=im.uri.split(',');blob=new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:head.match(/data:([^;]+)/)?.[1]||'image/png'})}else{images[i]=null;continue}const bitmap=mobileDecode?await mobileDecode(blob,1536):await createImageBitmap(blob,{premultiplyAlpha:'none'}),tex=new T.Texture(bitmap);tex.needsUpdate=true;tex.flipY=false;if('colorSpace'in tex)tex.colorSpace=T.NoColorSpace||'';tex.wrapS=tex.wrapT=T.RepeatWrapping;images[i]=tex;this.resources.push(tex,bitmap)}catch(e){console.warn('Workshop texture',i,e);images[i]=null}onProgress?.((i+1)/Math.max(1,(json.images||[]).length)*.25)}
 const textures=(json.textures||[]).map(t=>images[t.source]||null),workshopColors=Object.freeze({MAT_Steel_Blackened:0x17191a,MAT_Wall_Blue_OilPaint:0x234b52,MAT_Wall_Plaster_Aged:0x8f7453,MAT_PaintedMetal_Teal:0x285f5b,MAT_Wood_Dark_Oiled:0x3a1f12,MAT_PaintedMetal_Red:0x7d2319,MAT_Wall_Grime:0x2a2018}),materials=(json.materials||[]).map((m,i)=>{const p=m.pbrMetallicRoughness||{},extensions=m.extensions||{},clearcoat=extensions.KHR_materials_clearcoat,transmission=extensions.KHR_materials_transmission,ior=extensions.KHR_materials_ior,emissiveStrength=extensions.KHR_materials_emissive_strength?.emissiveStrength??1,Physical=T.MeshPhysicalMaterial||T.MeshStandardMaterial,MaterialType=(clearcoat||transmission||ior)?Physical:T.MeshStandardMaterial,hasBase=Array.isArray(p.baseColorFactor),alpha=hasBase?(p.baseColorFactor[3]??1):1,color=hasBase?new T.Color(...p.baseColorFactor.slice(0,3)):new T.Color(workshopColors[m.name]??0xffffff),mat=new MaterialType({name:m.name||('Material_'+i),color,metalness:p.metallicFactor??.15,roughness:p.roughnessFactor??.7,transparent:m.alphaMode==='BLEND'||alpha<1||(transmission?.transmissionFactor??0)>0,opacity:alpha,side:m.doubleSided?T.DoubleSide:T.FrontSide});if(p.baseColorTexture?.index!=null){mat.map=textures[p.baseColorTexture.index];if(mat.map&&'colorSpace'in mat.map)mat.map.colorSpace=T.SRGBColorSpace;mat.map&&(mat.map.needsUpdate=true)}if(p.metallicRoughnessTexture?.index!=null){const data=textures[p.metallicRoughnessTexture.index];mat.metalnessMap=mat.roughnessMap=data;if(data&&'colorSpace'in data)data.colorSpace=T.NoColorSpace||'';data&&(data.needsUpdate=true)}if(m.normalTexture?.index!=null){mat.normalMap=textures[m.normalTexture.index];const normalScale=Math.round((m.normalTexture.scale??1)*1000)/1000;mat.normalScale?.set(normalScale,normalScale);if(mat.normalMap&&'colorSpace'in mat.normalMap)mat.normalMap.colorSpace=T.NoColorSpace||'';mat.normalMap&&(mat.normalMap.needsUpdate=true)}if(m.emissiveTexture?.index!=null){mat.emissiveMap=textures[m.emissiveTexture.index];if(mat.emissiveMap&&'colorSpace'in mat.emissiveMap)mat.emissiveMap.colorSpace=T.SRGBColorSpace;mat.emissiveMap&&(mat.emissiveMap.needsUpdate=true)}if(m.emissiveFactor)mat.emissive=new T.Color(...m.emissiveFactor);mat.emissiveIntensity=emissiveStrength;if(clearcoat&&'clearcoat'in mat){mat.clearcoat=clearcoat.clearcoatFactor??0;mat.clearcoatRoughness=clearcoat.clearcoatRoughnessFactor??0}if(transmission&&'transmission'in mat)mat.transmission=transmission.transmissionFactor??0;if(ior&&'ior'in mat)mat.ior=ior.ior??1.5;mat.alphaTest=m.alphaMode==='MASK'?(m.alphaCutoff??.5):0;mat.depthWrite=m.alphaMode!=='BLEND';this.resources.push(mat);return mat}),defaultMat=new T.MeshStandardMaterial({name:'Material_Default',color:0xffffff,roughness:.75,metalness:.12});this.resources.push(defaultMat);
 const meshes=(json.meshes||[]).map((mesh,mi)=>{const group=new T.Group();group.name=mesh.name||`Mesh_${mi}`;for(const [pi,p] of (mesh.primitives||[]).entries()){if((p.mode??4)!==4||p.attributes?.POSITION==null)continue;const g=new T.BufferGeometry();for(const [sem,ai] of Object.entries(p.attributes)){const map={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv2',COLOR_0:'color',TANGENT:'tangent'}[sem];if(!map)continue;const a=this.accessor(parsed,ai);g.setAttribute(map,new T.BufferAttribute(a.array,a.itemSize,a.normalized))}if(p.indices!=null){const a=this.accessor(parsed,p.indices);g.setIndex(new T.BufferAttribute(a.array,1))}if(!g.attributes.normal)g.computeVertexNormals();g.computeBoundingSphere();const object=new T.Mesh(g,materials[p.material]||defaultMat);object.name=`${group.name}_Primitive_${pi}`;object.castShadow=false;object.receiveShadow=true;group.add(object);this.resources.push(g)}return group});
 const nodes=(json.nodes||[]).map((n,i)=>{const o=n.mesh!=null?meshes[n.mesh].clone():new T.Group();o.name=n.name||`Node_${i}`;if(n.matrix)o.matrix.fromArray(n.matrix),o.matrixAutoUpdate=false;else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale)}return o});(json.nodes||[]).forEach((n,i)=>(n.children||[]).forEach(ci=>nodes[i].add(nodes[ci])));const sceneDef=(json.scenes||[])[json.scene||0]||{nodes:nodes.map((_,i)=>i)},root=new T.Group();root.name='Taller_Mecanico_Argentino_1973';for(const ni of sceneDef.nodes||[])root.add(nodes[ni]);onProgress?.(.95);return root}
 addChevyV3Car(){const T=this.T,template=window.__chevyV3Template;if(!template)throw new Error('Chevy V3 no disponible');const source=template.clone(true),g=new T.Group();g.name='Chevy_V3_Workshop';g.add(source);g.updateMatrixWorld(true);const initialBox=new T.Box3().setFromObject(g),initialSize=new T.Vector3();initialBox.getSize(initialSize);const longest=Math.max(initialSize.x,initialSize.z)||1;g.scale.setScalar(5.25/longest);g.updateMatrixWorld(true);const box=new T.Box3().setFromObject(g),center=new T.Vector3();box.getCenter(center);g.position.x-=center.x;g.position.y-=box.min.y;g.position.z-=center.z;const floorBounds=new T.Box3();this.workshopRoot?.traverse(o=>{const list=Array.isArray(o.material)?o.material:[o.material];if(list.some(material=>material?.name==='MAT_Floor_Concrete_Oily'))floorBounds.union(new T.Box3().setFromObject(o))});const workshopFloorY=floorBounds.isEmpty()?0:floorBounds.max.y;g.position.y+=workshopFloorY;g.userData.surfaceY=workshopFloorY;g.userData.floorY=g.position.y;g.rotation.y=-.34;g.updateMatrixWorld(true);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});this.scene.add(g);this.car=g}
 addReflectionCards(){const T=this.T,mat=new T.MeshBasicMaterial({color:0xffd5ad,transparent:true,opacity:.08,side:T.DoubleSide});for(const [x,y,z,ry] of [[4,4,-3,-.5],[-4,3,2,.7]]){const m=new T.Mesh(new T.PlaneGeometry(4,2.3),mat);m.position.set(x,y,z);m.rotation.y=ry;this.scene.add(m)}this.resources.push(mat)}
 setCarColor(hex){if(typeof hex!=='string'||!/^#[a-f\d]{6}$/i.test(hex))return false;this.paintColor=hex.toLowerCase();this.presentation?.setPaintColor(this.paintColor);this.vehiclePresentation?.setPaintColor(this.paintColor);document.documentElement.style.setProperty('--v6-body',this.paintColor);globalThis.__chevyPaintColor=this.paintColor;window.dispatchEvent(new CustomEvent('chevy:paint-change',{detail:{hex:this.paintColor}}));return true}
 focus(name,instant=false){q('#v6-main-menu')?.classList.toggle('an-collection-inspection',name==='collection');if(name==='collection'){this.setLens(28);const lens=q('#v6-photo-lens');if(lens)lens.value='28';}this.inspection?.focus(name);this.collectionFocusActive=name==='collection';if(name==='collection'){const status=q('#v6-earned-collection-status');if(status)status.textContent='Preparando la vitrina…';void Promise.resolve().then(async()=>{if(!this.presentation)await this.ensureLoaded?.();if(!this.presentation?.prepareCollection)throw new Error('La vitrina todavía no está disponible');await this.presentation.prepareCollection();await syncWorkshopCollection({details:true});if(profile.motorsportV7?.memories)await (await loadEarnedAlbum()).syncPosters();}).catch(error=>{const node=q('#v6-earned-collection-status');if(node)node.textContent='No se pudo preparar la vitrina. Elegí Colección para reintentar.';toast('No se pudo preparar la vitrina: '+String(error?.message||error),'warn');});}const p=this.hotspots[name]||this.hotspots.general;this.targetPose={yaw:p.yaw,pitch:p.pitch,radius:p.radius,target:p.target};if(instant){this.yaw=p.yaw;this.pitch=p.pitch;this.radius=p.radius;[this.target.x,this.target.y,this.target.z]=p.target;this.targetPose=null}}
 setLens(mm){if(!this.camera)return;this.presentationLensMm=clamp(Number(mm)||50,20,150);this.camera.filmGauge=35;this.camera.setFocalLength(clamp(Number(mm)||50,20,150));this.camera.updateProjectionMatrix()}
 setExposure(ev){this.exposure=ev;if(this.renderer)this.renderer.toneMappingExposure=1.06*Math.pow(2,ev)}
 resize(){if(!this.renderer||!this.camera)return;const r=this.canvas.getBoundingClientRect(),w=Math.max(2,Math.floor(r.width)),h=Math.max(2,Math.floor(r.height));if(this.advancedGraphics)this.advancedGraphics.resizeRenderer({width:w,height:h,pixelRatio:Math.min(devicePixelRatio||1,this.deviceProfile.phone?1.25:innerWidth<720?1.25:1.75)});else{const size=this.renderer.getSize(new this.T.Vector2());if(size.x!==w||size.y!==h)this.renderer.setSize(w,h,false);}this.camera.aspect=w/h;this.camera.updateProjectionMatrix();globalThis.__asfaltoMenuPresentation?.frameWorkshop(this);this.chassis?.fit()}
 loop(){if(!this.active||!this.loaded||this.failed||this.restoring||this.stopFrame)return;const frame=t=>{if(!this.active||!this.loaded||this.failed||this.restoring)return;const dt=Math.min(.05,(t-this.last)/1000||.016);this.last=t;if(this.targetPose){const k=1-Math.exp(-dt*4.5);this.yaw=lerp(this.yaw,this.targetPose.yaw,k);this.pitch=lerp(this.pitch,this.targetPose.pitch,k);this.radius=lerp(this.radius,this.targetPose.radius,k);this.target.x=lerp(this.target.x,this.targetPose.target[0],k);this.target.y=lerp(this.target.y,this.targetPose.target[1],k);this.target.z=lerp(this.target.z,this.targetPose.target[2],k);if(Math.abs(this.radius-this.targetPose.radius)<.02&&Math.abs(this.yaw-this.targetPose.yaw)<.003&&Math.abs(this.pitch-this.targetPose.pitch)<.003&&Math.hypot(this.target.x-this.targetPose.target[0],this.target.y-this.targetPose.target[1],this.target.z-this.targetPose.target[2])<.01)this.targetPose=null}const cp=Math.cos(this.pitch),pos=[this.target.x+Math.sin(this.yaw)*cp*this.radius,this.target.y+Math.sin(this.pitch)*this.radius,this.target.z+Math.cos(this.yaw)*cp*this.radius];this.camera.position.set(...pos);this.camera.lookAt(this.target.x,this.target.y,this.target.z);globalThis.__asfaltoWorkshopEditor?.applyFrame?.(this,t);if(this.cameraConstraint?.constrain(this.camera,this.target))this.camera.lookAt(this.target.x,this.target.y,this.target.z);this.presentation?.update(t);if(this.presentation?.isPreparing())return;this.inspection?.update(dt);this.chassis?.update(dt);this.vehiclePresentation?.setEnvironment(this.presentation?.getRoomEnvironment()||null);this.vehiclePresentation?.update({dt,camera:this.camera,viewportHeight:this.canvas.height,speedMps:0,rpm:0,quality:this.advancedGraphics?.getRendererQuality()||'high'});this.advancedGraphics?.update({time:t/1000});globalThis.__asfaltoAdvancedGraphics?.refreshStatus?.();this.rayTracing?.setMode(globalThis.__asfaltoRayTracing?.getMode()||'off');this.rayTracing?.update();globalThis.__asfaltoRayTracing?.refresh();if(this.advancedGraphics)this.advancedGraphics.render();else this.renderer.render(this.scene,this.camera);if(!this.homeFrameReady){this.homeFrameReady=true;publishHomeReadiness();}};this.stopFrame=frameScheduler.subscribe('workshop',frame,{enabled:()=>this.active&&this.loaded&&!this.failed&&!this.restoring})}
 capture(){if(!this.renderer||!this.loaded)return null;if(this.cameraConstraint?.constrain(this.camera,this.target))this.camera.lookAt(this.target.x,this.target.y,this.target.z);if(this.advancedGraphics)this.advancedGraphics.render();else this.renderer.render(this.scene,this.camera);return this.canvas.toDataURL('image/png')}
}
const {getFrameScheduler}=await import(new URL('src/runtime/frame-scheduler.mjs?v=05cd8f6febcf672e',document.baseURI));
const frameScheduler=getFrameScheduler();
const {createOwnedRenderer}=await import(new URL('src/runtime/owned-renderer.mjs?v=fc0e8ac1ca6f0f58',document.baseURI));
const {disposeAllSync}=await import(new URL('src/runtime/dispose-all.mjs?v=f303ef6bb4ac5e2b',document.baseURI));
const {snapshotSceneResources}=await import(new URL('src/runtime/scene-resources.mjs?v=df7fa85b2177e284',document.baseURI));
const workshop=new WorkshopRenderer();
class WorkshopAmbient{
 start(){globalThis.__asfaltoRacePresentation?.syncAudio()}
 stop(){globalThis.__asfaltoRacePresentation?.syncAudio()}
}

const ambient=new WorkshopAmbient();
function renderAll(){renderModeCards();renderAppearance();renderParts();renderTuning();renderConditions();renderHistory();renderProfileSummary();applyAccessibility()}
function applySavedSelectors(){
 profile.lastRoute=persistedTrack(profile.lastRoute);q('#v6-drive-route').value=profile.lastRoute;q('#v6-comp-track').value=profile.lastRoute;reflectValue(['#race-circuit'],profile.lastRoute);
 const saved=safeJSON(globalThis.__asfaltoV7Storage.getItem('cockpit-v5-config'),{})||{};
 profile.lastWeather=['clear','cloudy','rain','storm','fog','light-snow','heavy-snow'].includes(profile.lastWeather||saved.weather)?profile.lastWeather||saved.weather:'clear';
 const previousSky=profile.lastSky||saved.skyId;
 profile.lastSky=['clear','overcast','golden-hour','sunset','moonrise','night'].includes(previousSky)?previousSky:({dawn:'golden-hour',afternoon:'golden-hour',sunset:'sunset',moonrise:'moonrise',night:'night'}[saved.timeOfDay]||(saved.weather==='cloudy'?'overcast':'clear'));
 reflectEnvironmentValues(['#v6-drive-weather','#v6-comp-weather'],profile.lastWeather);reflectEnvironmentValues(['#v6-drive-sky','#v6-comp-sky'],profile.lastSky);syncMenuWeatherAvailability();
}
function reflectEnvironmentValues(selectors,value){for(const selector of selectors)reflectValue([selector],value)}
function persistEnvironmentChoices(){
 const app=window.__cockpitV5App,config=app?.config||safeJSON(globalThis.__asfaltoV7Storage.getItem('cockpit-v5-config'),{})||{};
 Object.assign(config,{skyId:profile.lastSky,weather:profile.lastWeather,timeOfDay:({clear:'day',overcast:'day','golden-hour':'afternoon',sunset:'sunset',moonrise:'moonrise',night:'night'})[profile.lastSky]});
 if(app?.config){app._syncConfigUI?.();app._saveConfig?.()}else try{globalThis.__asfaltoV7Storage.setItem('cockpit-v5-config',JSON.stringify(config))}catch{}
 saveProfile();
}
function syncMenuWeatherAvailability(){
 const snow=['cuesta_lipan','paso_garibaldi'].includes(q('#v6-drive-route')?.value);
 for(const id of ['#v6-drive-weather','#v6-comp-weather'])for(const option of q(id)?.options||[])if(['light-snow','heavy-snow'].includes(option.value))option.disabled=!snow;
}
function bindRoutePersistence(){
 window.addEventListener?.('asfalto:environment-choice',event=>{const choice=event.detail;if(!choice?.skyId||!choice?.weather)return;profile.lastSky=choice.skyId;profile.lastWeather=choice.weather;reflectEnvironmentValues(['#v6-drive-sky','#v6-comp-sky'],profile.lastSky);reflectEnvironmentValues(['#v6-drive-weather','#v6-comp-weather'],profile.lastWeather);persistEnvironmentChoices();syncMenuWeatherAvailability()});
 q('#v6-drive-route').addEventListener('change',e=>{if(PLAYABLE_TRACK_IDS.has(e.target.value))q('#v6-comp-track').value=e.target.value;syncMenuWeatherAvailability()});
 q('#v6-comp-track').addEventListener('change',e=>{if(PLAYABLE_TRACK_IDS.has(e.target.value))q('#v6-drive-route').value=e.target.value;syncMenuWeatherAvailability()});
 for(const id of ['#v6-drive-weather','#v6-comp-weather'])q(id)?.addEventListener('change',e=>{profile.lastWeather=e.target.value;reflectEnvironmentValues(['#v6-drive-weather','#v6-comp-weather'],profile.lastWeather);persistEnvironmentChoices()});
 for(const id of ['#v6-drive-sky','#v6-comp-sky'])q(id)?.addEventListener('change',e=>{profile.lastSky=e.target.value;reflectEnvironmentValues(['#v6-drive-sky','#v6-comp-sky'],profile.lastSky);persistEnvironmentChoices()});
}
async function initV6(){
 if(window.__chevyV6Complete?.initialized)return;
 const {createVehicleMaintenance}=await import(new URL('src/game/vehicle-maintenance.mjs?v=97c59e29fe64aeb9',document.baseURI));
 const {mountVehicleAssistance}=await import(new URL('src/menu/v7-vehicle-assistance.mjs?v=de10376380ee537a',document.baseURI));
 const selectedVehicle=()=>workshop.vehicleId||globalThis.__asfaltoV7Storage.getItem('asfalto:nacional:v6:selected-vehicle')||'chevy';
 globalThis.__asfaltoVehicleAssistance=mountVehicleAssistance({onRecover:()=>window.__cockpit?.raceWorld?.recover?.(),onWorkshop:()=>openMenu('workshop')});
 globalThis.__asfaltoVehicleMaintenance=createVehicleMaintenance({getProfile:()=>profile,getVehicleId:selectedVehicle,save:saveProfile,onChanged:condition=>{workshop.vehiclePresentation?.setPersistentCondition?.(condition);globalThis.__asfaltoVehiclePresentations?.chevy?.setPersistentCondition?.(condition);window.dispatchEvent(new CustomEvent('asfalto-vehicle-service-changed'));},onFault:faults=>{window.__cockpit?.raceWorld?.clearInputs?.();window.__cockpit?.raceWorld?.pause?.({reason:'vehicle-fault'});setSessionPaused(true);globalThis.__asfaltoVehicleAssistance.fault(faults);}});
 const restoreVehiclePaint=id=>{profile.vehiclePaintV7||={};const hex=profile.vehiclePaintV7[id]||({chevy_400_1957:'#b91518',belair_1957:'#087782',pickup_3100:'#188fc5'}[id]||workshop.paintColor||globalThis.__chevyPaintColor||'#d66a24');profile.vehiclePaintV7[id]=hex;workshop.setCarColor(hex);};
 window.addEventListener('chevy:paint-change',event=>{if(!/^#[a-f0-9]{6}$/i.test(event.detail?.hex||''))return;profile.vehiclePaintV7||={};profile.vehiclePaintV7[selectedVehicle()]=event.detail.hex;});
 window.addEventListener('asfalto:vehicle-selected',event=>{globalThis.__asfaltoVehicleMaintenance.selected(event.detail.id);restoreVehiclePaint(event.detail.id);void saveProfile();});restoreVehiclePaint(selectedVehicle());
 window.addEventListener('pagehide',()=>globalThis.__asfaltoVehicleMaintenance.flush());
 if(window.__chevyV6Complete?.initialized)return;silenceLegacyV5();window.__chevyV6Complete={initialized:true,menuReady:false,homeReady:false,version:V6_VERSION,profile:()=>deepClone(profile),getVehicleServiceState:()=>globalThis.__asfaltoVehicleMaintenance.getState(),serviceVehicle:serviceItem,setChassisConfig,openMenu,prepareCockpit:options=>waitForExistingGameReady(180000,options),openOriginalSettings,openCollectionInspection,closeCollectionInspection,startRoadTest,startDrive,startCompetition,openChampionship,openEarnedAlbum,albumDiagnostics:()=>earnedAlbum?.diagnostics()||null,championshipDiagnostics:()=>championshipMenu?.diagnostics()||null,restartSession,setSessionPaused,sessionTitle:()=>activeSession.definition?.title||'',sessionDiagnostics:()=>({type:activeSession.type,paused:activeSession.pausedAt!==null,completed:activeSession.completed,activeMilliseconds:Math.max(0,(activeSession.pausedAt??performance.now())-activeSession.startTime),samples:activeSession.type==='roadtest'?(roadTestSession?.getState().sampleCount||0):activeSession.series.length,roadTest:roadTestSession?.getState()||null,roadTestSave:roadTestReceiptStore?.diagnostics()||null,request:sessionRequestRunner?.diagnostics()||null}),workshop,setMenuAudioActive:active=>globalThis.__asfaltoRacePresentation?.setMenuAudioActive(active),manifest:{
  mainMenu:true,workshop3D:true,appearance:true,mechanics:true,tuning:true,condition:true,history:true,photography:true,collection:true,progression:true,narrative:true,roadTests:TESTS.map(x=>x.id),competitions:COMPETITIONS.map(x=>x.id),travel:true,resultsSheets:true,persistence:true,exportImport:true,accessibility:true,originalRestomodSeparation:true
 }};
 setupNavigation();setupActions();bindRoutePersistence();applySavedSelectors();renderAll();applyVehicleConfig();q('#v6-main-menu').classList.remove('v6-hidden');document.body.classList.add('v6-menu-open');document.body.classList.remove('v6-driving');openPanel(profile.lastPanel||'drive',false);
 window.__chevyV6Complete.menuReady=true;publishHomeReadiness();window.dispatchEvent(new CustomEvent('asfalto-menu-ready'));
 document.addEventListener('focusin',event=>{if(event.target.isContentEditable||event.target.closest?.('input,textarea,select,[contenteditable=true],[role=dialog]')){window.__cockpit?.raceWorld?.clearInputs?.();window.__cockpit?.raceWorld?.releaseTouchCaptures?.();}});
 const begin=()=>ambient.start();document.addEventListener('pointerdown',begin,{once:true});
 window.addEventListener('chevy:vehicle-config',invalidateRoadTestConfiguration);document.addEventListener('change',event=>{if(event.target.closest?.('#race-settings'))invalidateRoadTestConfiguration();});
 window.addEventListener('beforeunload',saveProfile);document.addEventListener('visibilitychange',()=>{if(document.hidden){ambient.stop();workshop.setActive(false)}else if(document.body.classList.contains('v6-menu-open')){ambient.start();workshop.setActive(true)}});
 console.info('[Chevy V6] Taller mecánico y capa de juego completo inicializados',window.__chevyV6Complete.manifest);
}
const beginV6=()=>initV6().catch(error=>{console.error('[V7] Initialization failed',error);globalThis.__asfaltoLoading?.fail?.(error);});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',beginV6,{once:true});else beginV6();
})();
