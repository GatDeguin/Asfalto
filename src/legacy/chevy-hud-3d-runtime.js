
(() => {
'use strict';
const VERSION='1.0.0';
const reviewInterior=new URLSearchParams(location.search).get('ss250Interior')==='1';
const $=(selector,root=document)=>root.querySelector(selector);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const normalizeDegrees=value=>((Number(value)||0)%360+360)%360;
const ASSETS=Object.freeze({
  objective:{script:'chevy-hud-asset-objective',host:'chevy-hud-objective',required:['ObjectiveRoot']},
  timer:{script:'chevy-hud-asset-timer',host:'chevy-hud-timer',required:['TimerRoot']},
  navigation:{script:'chevy-hud-asset-navigation',host:'chevy-hud-navigation',required:['NavigationRoot','CompassNeedle']},
  telemetry:{script:'chevy-hud-asset-telemetry',host:'chevy-hud-telemetry',required:['TelemetryRoot',...Array.from({length:12},(_,i)=>`RpmSegment_${String(i+1).padStart(2,'0')}`)]}
});
const elements={
  canvas:$('#chevy-hud-webgl-canvas'),overlay:$('#chevy-hud-overlay'),notice:$('#chevy-hud-render-notice'),
  objectiveMain:$('#chevy-hud-objective-main'),objectiveSub:$('#chevy-hud-objective-sub'),
  timer:$('#chevy-hud-timer-value'),navHeading:$('#chevy-hud-navigation-heading'),navValue:$('#chevy-hud-navigation-value'),navMode:$('#chevy-hud-navigation-mode'),
  gear:$('#chevy-hud-gear'),rpm:$('#chevy-hud-rpm'),oil:$('#chevy-hud-oil'),temperature:$('#chevy-hud-temperature')
};
const publicState={
  objective:{main:'CONDUCCIÓN LIBRE',sub:'SIN MEDICIÓN ACTIVA'},timerMs:0,
  navigation:{heading:0,distanceKm:0,mode:'RECORRIDO'},
  telemetry:{gear:'—',rpm:null,oilStatus:'unavailable',temperatureC:null,temperatureStatus:'unavailable',oilSource:'unavailable',source:'unavailable'},
  renderer:{ready:false,errors:[],contextCount:1}
};
const api=window.__chevyHud3D={
  version:VERSION,ready:false,
  getState:()=>structuredClone?structuredClone(publicState):JSON.parse(JSON.stringify(publicState)),
  render:()=>renderer?.render(performance.now(),true),
  getDiagnostics:()=>({version:VERSION,ready:api.ready,renderer:{...publicState.renderer},assets:Object.fromEntries(entries.map(entry=>[entry.key,entry.host.dataset.renderState]))})
};
let renderer=null;
let entries=[];
let lastProfile=null;
let lastProfileRead=0;
let vehicleHudTelemetry=null;

function waitForThree(){
  const current=window.__chevyV6Three||window.THREE;
  if(current)return Promise.resolve(current);
  if(window.__chevyThreeLoadError)return Promise.reject(window.__chevyThreeLoadError);
  return new Promise((resolve,reject)=>{
    let settled=false;
    const cleanup=()=>{window.removeEventListener('chevy-three-ready',ready);window.removeEventListener('chevy-three-error',failed)};
    const finish=value=>{if(settled)return;settled=true;cleanup();value?resolve(value):reject(new Error('Three.js compartido no disponible'))};
    const ready=event=>finish(event?.detail||window.__chevyV6Three||window.THREE);
    const failed=event=>{if(settled)return;settled=true;cleanup();const reason=event?.detail||window.__chevyThreeLoadError||new Error('No se pudo cargar Three.js');reject(reason instanceof Error?reason:new Error(String(reason)))};
    window.addEventListener('chevy-three-ready',ready);
    window.addEventListener('chevy-three-error',failed);
    queueMicrotask(()=>{const late=window.__chevyV6Three||window.THREE;if(late)finish(late);else if(window.__chevyThreeLoadError)failed({detail:window.__chevyThreeLoadError})});
  });
}
async function decodeBase64Asset(scriptId){
  const node=document.getElementById(scriptId);
  if(!node)throw new Error(`Payload HUD ausente: ${scriptId}`);
  if(node.dataset.encoding==='external-url')return (await globalThis.AsfaltoV6AssetCore.readExternalPayload(node)).buffer; const clean=node.textContent.replace(/\s/g,'');
  const binary=atob(clean);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes.buffer;
}
function parseGlb(buffer){
  const view=new DataView(buffer);
  if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2)throw new Error('GLB HUD inválido');
  const declared=view.getUint32(8,true);
  if(declared>view.byteLength)throw new Error('GLB HUD truncado');
  let offset=12,json=null,bin=null;
  while(offset<declared){
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true),data=buffer.slice(offset+8,offset+8+length);
    if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(data).replace(/\0+$/,''));
    else if(type===0x004e4942)bin=data;
    offset+=8+length;
  }
  if(!json||!bin)throw new Error('GLB HUD incompleto');
  return {json,bin};
}
function readAccessor(parsed,index){
  const {json,bin}=parsed,accessor=json.accessors?.[index];
  if(!accessor)throw new Error(`Accessor HUD inexistente: ${index}`);
  const view=json.bufferViews?.[accessor.bufferView];
  if(!view)throw new Error(`BufferView HUD inexistente: ${accessor.bufferView}`);
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16}[accessor.type];
  const types={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const Ctor=types[accessor.componentType];
  if(!components||!Ctor)throw new Error(`Accessor HUD no compatible: ${accessor.type}/${accessor.componentType}`);
  const bytes=Ctor.BYTES_PER_ELEMENT,itemBytes=components*bytes,stride=view.byteStride||itemBytes;
  const start=(view.byteOffset||0)+(accessor.byteOffset||0);
  let array;
  if(stride===itemBytes&&start%bytes===0)array=new Ctor(bin,start,accessor.count*components).slice();
  else{
    array=new Ctor(accessor.count*components);
    const dv=new DataView(bin),getter={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[accessor.componentType];
    for(let i=0;i<accessor.count;i++)for(let c=0;c<components;c++)array[i*components+c]=dv[getter](start+i*stride+c*bytes,true);
  }
  return {array,itemSize:components,normalized:Boolean(accessor.normalized)};
}
async function imageSourceFromBlob(blob){
  if(typeof createImageBitmap==='function')return createImageBitmap(blob,{premultiplyAlpha:'none'});
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob),image=new Image();
    image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo decodificar una textura HUD'))};
    image.src=url;
  });
}
async function buildModel(T,buffer){
  const parsed=parseGlb(buffer),{json,bin}=parsed,resources=[];
  const images=[];
  for(let i=0;i<(json.images||[]).length;i++){
    const image=json.images[i];
    let blob=null;
    if(image.bufferView!=null){const view=json.bufferViews[image.bufferView],start=view.byteOffset||0;blob=new Blob([bin.slice(start,start+view.byteLength)],{type:image.mimeType||'image/png'})}
    else if(image.uri?.startsWith('data:')){const [head,data]=image.uri.split(','),mime=head.match(/data:([^;]+)/)?.[1]||'image/png';blob=new Blob([Uint8Array.from(atob(data),char=>char.charCodeAt(0))],{type:mime})}
    if(!blob){images[i]=null;continue}
    const source=await imageSourceFromBlob(blob),texture=new T.Texture(source);
    texture.needsUpdate=true;texture.flipY=false;images[i]=texture;resources.push(texture,source);
  }
  const wrap={33071:T.ClampToEdgeWrapping,33648:T.MirroredRepeatWrapping,10497:T.RepeatWrapping};
  const filter={9728:T.NearestFilter,9729:T.LinearFilter,9984:T.NearestMipmapNearestFilter,9985:T.LinearMipmapNearestFilter,9986:T.NearestMipmapLinearFilter,9987:T.LinearMipmapLinearFilter};
  const textures=(json.textures||[]).map(def=>{
    const texture=images[def.source]||null,sampler=json.samplers?.[def.sampler]||{};
    if(texture){texture.wrapS=wrap[sampler.wrapS]||T.RepeatWrapping;texture.wrapT=wrap[sampler.wrapT]||T.RepeatWrapping;texture.magFilter=filter[sampler.magFilter]||T.LinearFilter;texture.minFilter=filter[sampler.minFilter]||T.LinearMipmapLinearFilter}
    return texture;
  });
  const materials=(json.materials||[]).map((definition,index)=>{
    const pbr=definition.pbrMetallicRoughness||{},factor=pbr.baseColorFactor||[.55,.55,.55,1];
    const material=new T.MeshStandardMaterial({
      name:definition.name||`HudMaterial_${index}`,color:new T.Color(factor[0],factor[1],factor[2]),
      metalness:pbr.metallicFactor??.15,roughness:pbr.roughnessFactor??.7,
      transparent:definition.alphaMode==='BLEND'||factor[3]<1,opacity:factor[3],
      side:definition.doubleSided?T.DoubleSide:T.FrontSide,depthWrite:definition.alphaMode!=='BLEND'
    });
    if(pbr.baseColorTexture?.index!=null){material.map=textures[pbr.baseColorTexture.index];if(material.map&&'colorSpace'in material.map)material.map.colorSpace=T.SRGBColorSpace}
    if(pbr.metallicRoughnessTexture?.index!=null)material.metalnessMap=material.roughnessMap=textures[pbr.metallicRoughnessTexture.index];
    if(definition.normalTexture?.index!=null){material.normalMap=textures[definition.normalTexture.index];if(definition.normalTexture.scale!=null)material.normalScale.setScalar(definition.normalTexture.scale)}
    if(definition.occlusionTexture?.index!=null){material.aoMap=textures[definition.occlusionTexture.index];material.aoMapIntensity=definition.occlusionTexture.strength??1}
    if(definition.emissiveTexture?.index!=null){material.emissiveMap=textures[definition.emissiveTexture.index];if(material.emissiveMap&&'colorSpace'in material.emissiveMap)material.emissiveMap.colorSpace=T.SRGBColorSpace}
    if(definition.emissiveFactor)material.emissive=new T.Color(...definition.emissiveFactor);
    material.emissiveIntensity=definition.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1;
    material.alphaTest=definition.alphaMode==='MASK'?(definition.alphaCutoff??.5):0;
    resources.push(material);return material;
  });
  const fallbackMaterial=new T.MeshStandardMaterial({color:0x161616,roughness:.72,metalness:.25});resources.push(fallbackMaterial);
  const meshes=(json.meshes||[]).map((mesh,meshIndex)=>{
    const group=new T.Group();group.name=mesh.name||`HudMesh_${meshIndex}`;
    for(const [primitiveIndex,primitive] of (mesh.primitives||[]).entries()){
      if((primitive.mode??4)!==4||primitive.attributes?.POSITION==null)continue;
      const geometry=new T.BufferGeometry();
      for(const [semantic,accessorIndex] of Object.entries(primitive.attributes)){
        const attributeName={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TEXCOORD_1:'uv2',COLOR_0:'color',TANGENT:'tangent'}[semantic];
        if(!attributeName)continue;
        const attribute=readAccessor(parsed,accessorIndex);geometry.setAttribute(attributeName,new T.BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));
      }
      if(primitive.indices!=null){const index=readAccessor(parsed,primitive.indices);geometry.setIndex(new T.BufferAttribute(index.array,1))}
      if(!geometry.attributes.normal)geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const meshObject=new T.Mesh(geometry,materials[primitive.material]||fallbackMaterial);meshObject.name=`${group.name}_Primitive_${primitiveIndex}`;meshObject.castShadow=false;meshObject.receiveShadow=true;
      if(geometry.attributes.color){for(const mat of (Array.isArray(meshObject.material)?meshObject.material:[meshObject.material]))mat.vertexColors=true}
      group.add(meshObject);resources.push(geometry);
    }
    return group;
  });
  const nodes=(json.nodes||[]).map((definition,index)=>{
    const object=definition.mesh!=null?meshes[definition.mesh].clone():new T.Group();object.name=definition.name||`HudNode_${index}`;
    if(definition.matrix){object.matrix.fromArray(definition.matrix);object.matrixAutoUpdate=false}
    else{if(definition.translation)object.position.fromArray(definition.translation);if(definition.rotation)object.quaternion.fromArray(definition.rotation);if(definition.scale)object.scale.fromArray(definition.scale)}
    return object;
  });
  (json.nodes||[]).forEach((definition,index)=>(definition.children||[]).forEach(child=>nodes[index].add(nodes[child])));
  const sceneDefinition=(json.scenes||[])[json.scene||0]||{nodes:nodes.map((_,index)=>index)};
  const root=new T.Group();root.name='ChevyHudAsset';for(const index of sceneDefinition.nodes||[])root.add(nodes[index]);root.updateMatrixWorld(true);
  const nodeMap=new Map();root.traverse(node=>{if(node.name)nodeMap.set(node.name,node)});
  return {root,nodeMap,resources};
}
function fitHalfHeight(size,aspect,margin=1.055){return Math.max(size.y/2,size.x/(Math.max(.001,aspect)*2))*margin}
function scissorFor(rect,pixelRatio,canvasHeight){
  const left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(innerWidth,rect.right),bottom=Math.min(innerHeight,rect.bottom);
  const width=Math.max(0,right-left),height=Math.max(0,bottom-top);
  return {x:Math.round(left*pixelRatio),y:Math.round((innerHeight-bottom)*pixelRatio),width:Math.round(width*pixelRatio),height:Math.round(height*pixelRatio)};
}
class SharedHudRenderer{
  constructor(T){
    this.T=T;this.canvas=elements.canvas;this.pixelRatio=1;this.lastRender=0;this.running=true;
    this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
    this.renderer.autoClear=false;this.renderer.setClearColor(0x000000,0);this.renderer.toneMapping=T.ACESFilmicToneMapping??0;this.renderer.toneMappingExposure=1.12;
    if('outputColorSpace'in this.renderer)this.renderer.outputColorSpace=T.SRGBColorSpace;
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.running=false;markRenderFailure(new Error('Se perdió el contexto WebGL del HUD'))});
    this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  async initialize(){
    for(const [key,asset] of Object.entries(ASSETS)){
      const host=document.getElementById(asset.host);
      try{
        const model=await buildModel(this.T,await decodeBase64Asset(asset.script));
        const missing=asset.required.filter(name=>!model.nodeMap.has(name));if(missing.length)throw new Error(`${key}: nodos faltantes ${missing.join(', ')}`);
        const scene=new this.T.Scene(),root=new this.T.Group();root.add(model.root);scene.add(root);
        scene.add(new this.T.HemisphereLight(0xf2f2ed,0x090604,2.15));
        const keyLight=new this.T.DirectionalLight(0xfff2dd,3.2);keyLight.position.set(-4,6,8);scene.add(keyLight);
        const rim=new this.T.DirectionalLight(0xff6500,1.45);rim.position.set(5,-1,5);scene.add(rim);
        const bounds=new this.T.Box3().setFromObject(model.root),center=bounds.getCenter(new this.T.Vector3()),size=bounds.getSize(new this.T.Vector3());model.root.position.sub(center);model.root.updateMatrixWorld(true);
        const camera=new this.T.OrthographicCamera(-1,1,1,-1,.01,100);camera.position.set(0,0,10);camera.lookAt(0,0,0);
        const entry={key,host,scene,root,camera,size,nodeMap:model.nodeMap,resources:model.resources};
        if(key==='navigation'){entry.needle=model.nodeMap.get('CompassNeedle');entry.needleBase=entry.needle.rotation.z}
        if(key==='telemetry')prepareRpmSegments(entry);
        entries.push(entry);host.dataset.renderState='ready';
      }catch(error){host.dataset.renderState='error';markRenderFailure(error)}
    }
    publicState.renderer.ready=entries.length===4;
    this.render(performance.now(),true);
    requestAnimationFrame(time=>this.loop(time));
  }
  resize(){
    const ratio=Math.min(devicePixelRatio||1,innerWidth<700?1.15:1.5),width=Math.max(2,Math.round(innerWidth*ratio)),height=Math.max(2,Math.round(innerHeight*ratio));
    if(this.canvas.width!==width||this.canvas.height!==height){this.pixelRatio=ratio;this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false)}
  }
  loop(time){if(!this.running)return;if(time-this.lastRender>=33){this.lastRender=time;updateHudState(time);this.render(time)}requestAnimationFrame(next=>this.loop(next))}
  render(_time,force=false){
    this.resize();this.renderer.setScissorTest(false);this.renderer.clear(true,true,true);
    if(!document.body.classList.contains('v6-driving')&&!force)return;
    this.renderer.setScissorTest(true);
    for(const entry of entries){
      const rect=entry.host.getBoundingClientRect(),box=scissorFor(rect,this.pixelRatio,this.canvas.height);if(box.width<=0||box.height<=0)continue;
      const aspect=box.width/box.height,halfHeight=fitHalfHeight(entry.size,aspect),halfWidth=halfHeight*aspect;
      entry.camera.left=-halfWidth;entry.camera.right=halfWidth;entry.camera.top=halfHeight;entry.camera.bottom=-halfHeight;entry.camera.updateProjectionMatrix();
      this.renderer.setViewport(box.x,box.y,box.width,box.height);this.renderer.setScissor(box.x,box.y,box.width,box.height);this.renderer.clearDepth();this.renderer.render(entry.scene,entry.camera);
    }
    this.renderer.setScissorTest(false);
  }
}
function cloneMaterials(node){
  node.traverse(object=>{if(!object.isMesh||!object.material)return;object.material=Array.isArray(object.material)?object.material.map(material=>material.clone()):object.material.clone()});
}
function prepareRpmSegments(entry){
  entry.rpmSegments=[];
  for(let index=1;index<=12;index++){
    const node=entry.nodeMap.get(`RpmSegment_${String(index).padStart(2,'0')}`);if(!node)continue;cloneMaterials(node);
    node.traverse(object=>{if(!object.isMesh)return;for(const material of (Array.isArray(object.material)?object.material:[object.material])){material.userData.hudOriginalColor=material.color?.clone();material.userData.hudOriginalEmissive=material.emissive?.clone();material.userData.hudOriginalIntensity=material.emissiveIntensity??1}});
    entry.rpmSegments.push(node);
  }
}
function applyModelState(){
  const navigation=entries.find(entry=>entry.key==='navigation');
  if(navigation?.needle)navigation.needle.rotation.z=navigation.needleBase-publicState.navigation.heading*Math.PI/180;
  const telemetry=entries.find(entry=>entry.key==='telemetry'),active=Math.min(12,Math.max(0,Math.ceil(publicState.telemetry.rpm/8000*12)));
  const compact=reviewInterior&&document.body.classList.contains('an-ss250-clear-console')&&!document.body.classList.contains('an-phone-hud')&&innerWidth>900;
  for(const [name,node] of telemetry?.nodeMap||[])if(/^(OilIcon_|TemperatureIcon_)/.test(name))node.visible=!compact;
  telemetry?.rpmSegments?.forEach((node,index)=>{
    const isActive=index<active,color=index<7?0xff4d00:index<10?0xe93600:0xc91f00;
    node.traverse(object=>{if(!object.isMesh)return;for(const material of (Array.isArray(object.material)?object.material:[object.material])){
      if(material.color)material.color.setHex(isActive?color:0x391309);
      if(material.emissive)material.emissive.setHex(isActive?color:0x250500);
      if('emissiveIntensity'in material)material.emissiveIntensity=isActive?1.55:.12;
      material.needsUpdate=true;
    }});
  });
}
function markRenderFailure(error){
  const message=error instanceof Error?error.message:String(error);console.error('[Chevy HUD 3D]',error);
  if(!publicState.renderer.errors.includes(message))publicState.renderer.errors.push(message);
  elements.notice.textContent='Visualización 3D del HUD no disponible. La información continúa activa en modo textual.';
}
function formatTimer(milliseconds){
  const total=Math.max(0,Math.round(Number(milliseconds)||0)),minutes=Math.floor(total/60000),seconds=Math.floor(total/1000)%60,millis=total%1000;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(millis).padStart(3,'0')}`;
}
function parseClock(text){
  const match=String(text||'').trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})/);if(!match)return null;
  const hours=Number(match[1]||0),minutes=Number(match[2]||0),seconds=Number(match[3]||0),milliseconds=Number(match[4]||0);return ((hours*60+minutes)*60+seconds)*1000+milliseconds;
}
function cardinal(heading){return ['N','NE','E','SE','S','SO','O','NO'][Math.round(normalizeDegrees(heading)/45)%8]}
function formatDistance(kilometers){
  const value=Math.max(0,Number(kilometers)||0),digits=value>=10?0:1;return `${value.toLocaleString('es-AR',{minimumFractionDigits:digits,maximumFractionDigits:digits})} KM`;
}
function getCockpitState(){
  try{return window.__cockpit&&typeof window.__cockpit.getState==='function'?window.__cockpit.getState():null}catch(error){return null}
}
function readProfile(time){
  if(time-lastProfileRead<1000&&lastProfile)return lastProfile;lastProfileRead=time;
  try{lastProfile=window.__chevyV6Complete?.profile?.()||lastProfile}catch{}return lastProfile;
}
function objectiveText(){
  const main=$('#v6-objective-main')?.textContent?.trim()||'CONDUCCIÓN LIBRE',sub=$('#v6-objective-sub')?.textContent?.trim()||'SIN MEDICIÓN ACTIVA';
  return {main:main.toLocaleUpperCase('es-AR'),sub:sub.toLocaleUpperCase('es-AR')};
}
function deriveTimer(race){
  const direct=Number(race?.totalWithPenalty??race?.totalTime);if(Number.isFinite(direct)&&direct>=0)return direct*1000;
  for(const selector of ['#v5-time','#race-time']){const parsed=parseClock($(selector)?.textContent);if(parsed!=null)return parsed}
  return 0;
}
function trackHeadingRadians(race){
  const feedbackHeading=Number(race?.feedback?.track?.heading);if(Number.isFinite(feedbackHeading))return feedbackHeading;
  try{const track=window.__cockpit?.raceTrack?.()||window.__cockpit?.raceWorld?.track;const sampledHeading=Number(track?.sample?.(Number(race?.s)||0)?.heading);if(Number.isFinite(sampledHeading))return sampledHeading}catch{}
  return 0;
}
function deriveNavigation(race,objective){
  const headingError=Number(race?.headingError)||0;
  const heading=normalizeDegrees((trackHeadingRadians(race)+headingError)*180/Math.PI);
  const progress=Math.max(0,Number(race?.raceProgress??race?.s??0)||0),trackLength=Math.max(0,Number(race?.track?.length)||0),laps=Math.max(1,Number(race?.settings?.laps)||1),mode=race?.settings?.mode||'practice';
  let meters=progress,label='RECORRIDO';
  const progressMatch=objective.sub.match(/([\d.,]+)\s*\/\s*([\d.,]+)\s*M\b/i);
  if(progressMatch){const current=Number(progressMatch[1].replace(',','.'))||0,target=Number(progressMatch[2].replace(',','.'))||0;meters=Math.max(0,target-current);label='RESTANTE'}
  else if(/VIAJE/.test(objective.main)){const match=objective.sub.match(/([\d.,]+)\s*KM\b/i);meters=match?(Number(match[1].replace(',','.'))||0)*1000:progress;label='RECORRIDO'}
  else if(['race','timeTrial'].includes(mode)&&trackLength>0&&laps<50){meters=Math.max(0,trackLength*laps-progress);label='RESTANTE'}
  else if(mode==='speedTrap'&&trackLength>0){meters=Math.max(0,trackLength-progress%trackLength);label='AL PUNTO'}
  return {heading,distanceKm:meters/1000,mode:label};
}
function deriveTelemetry(full,race,time){
 const snapshot=window.__cockpit?.raceWorld?.getRenderFrame?.()?.currentSnapshot;
 return vehicleHudTelemetry(snapshot,readProfile(time)?.condition?.oil);
}

function statusWord(status){return status==='critical'?'CRÍTICO':status==='warning'?'ALERTA':status==='unavailable'?'SIN DATO':'NORMAL'}
function updateDom(){
  elements.objectiveMain.textContent=publicState.objective.main;elements.objectiveSub.textContent=publicState.objective.sub;
  elements.timer.value=formatTimer(publicState.timerMs);
  elements.navHeading.textContent=cardinal(publicState.navigation.heading);elements.navHeading.setAttribute('aria-label',`${cardinal(publicState.navigation.heading)}, ${Math.round(publicState.navigation.heading)} grados`);
  elements.navValue.value=formatDistance(publicState.navigation.distanceKm);elements.navMode.textContent=publicState.navigation.mode;
  elements.gear.value=publicState.telemetry.gear;elements.rpm.value=publicState.telemetry.rpm===null?'— RPM':`${String(publicState.telemetry.rpm).padStart(4,'0')} RPM`;
  elements.oil.textContent=`CONDICIÓN ACEITE ${statusWord(publicState.telemetry.oilStatus)}`;elements.oil.dataset.level=publicState.telemetry.oilStatus;
  elements.temperature.textContent=publicState.telemetry.temperatureC===null?'TEMPERATURA —':`TEMPERATURA ${publicState.telemetry.temperatureC}°`;elements.temperature.dataset.level=publicState.telemetry.temperatureStatus;
}
function updateHudState(time){
  const clearConsole=reviewInterior&&window.__asfaltoSelectedPlayerVehicle==='chevy_400_1957'&&window.__cockpit?.raceCameraMode?.()==='cockpit';
  document.body.classList.toggle('an-ss250-clear-console',clearConsole);
  const full=getCockpitState(),race=full?.race||{};publicState.objective=objectiveText();publicState.timerMs=deriveTimer(race);publicState.navigation=deriveNavigation(race,publicState.objective);publicState.telemetry=deriveTelemetry(full,race,time);updateDom();applyModelState();
}
async function boot(){
  try{const style=document.createElement('style');style.textContent=`@media(min-width:901px){body.v6-driving.an-ss250-clear-console:not(.an-phone-hud) #chevy-hud-telemetry{bottom:auto;top:calc(max(var(--chevy-hud-safe-top),3.3vh) + clamp(315px,27vw,455px)/4.12 + 12px);transform:scale(.62);transform-origin:100% 0%}body.v6-driving.an-ss250-clear-console:not(.an-phone-hud) #chevy-hud-statuses{font-size:18px;line-height:1.15;flex-direction:column;align-items:flex-start;gap:2px;bottom:8%}}`;document.head.append(style);({vehicleHudTelemetry}=await import(new URL('src/ui/vehicle-hud-telemetry.mjs?v=balance-20260917',document.baseURI)));await new Promise((resolve,reject)=>{let started=null;const poll=()=>{if(window.__cockpit?.ready){resolve();return}if(window.__cockpit?.error){reject(new Error(window.__cockpit.error));return}if(window.__asfaltoV7Startup?.diagnostics().phase==='prepared'){started??=performance.now();if(performance.now()-started>180000){reject(new Error('El cockpit no terminó de prepararse para el HUD.'));return}}setTimeout(poll,100);};poll();});const {detectDeviceProfile}=await import(new URL('src/performance/mobile-device-profile.mjs',document.baseURI));if(detectDeviceProfile().phone){const {createMobileHud}=await import(new URL('src/ui/mobile-hud.mjs',document.baseURI));renderer=createMobileHud({update:updateHudState});publicState.renderer.contextCount=0;publicState.renderer.backend='dom-mobile';publicState.renderer.ready=true;api.ready=true;window.dispatchEvent(new CustomEvent('chevy-hud-3d-ready',{detail:api.getDiagnostics()}));return;}const T=await waitForThree();renderer=new SharedHudRenderer(T);await renderer.initialize();updateHudState(performance.now());api.ready=true;publicState.renderer.ready=entries.length===4;window.dispatchEvent(new CustomEvent('chevy-hud-3d-ready',{detail:api.getDiagnostics()}));console.info('[Chevy HUD 3D] cuatro módulos cargados en un canvas compartido',api.getDiagnostics())}
  catch(error){markRenderFailure(error);for(const host of document.querySelectorAll('.chevy-hud-host'))host.dataset.renderState='error';api.ready=true;window.dispatchEvent(new CustomEvent('chevy-hud-3d-error',{detail:{message:error?.message||String(error)}}))}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
