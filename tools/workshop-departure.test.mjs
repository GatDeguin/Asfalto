import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {playWorkshopDeparture} from '../src/render/workshop-departure.mjs?v=20fadee3f1fcfa74';
import {installVehiclePresentation} from '../src/render/vehicle-presentation.mjs?v=d3030bcc742688dc';

const vector=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});},clone(){return vector(this.x,this.y,this.z);},copy(v){this.set(v.x,v.y,v.z);}});
function fixture(t){
  const motion=Object.assign(new EventTarget(),{matches:false});
  const doc=Object.assign(new EventTarget(),{hidden:false,body:{classList:new Set()}});
  doc.body.classList.contains=doc.body.classList.has.bind(doc.body.classList);
  const frames=new Map();
  let id=0,time=0,gate=0,mode='off',lamp=0,spin=0,fade=0;
  const globals={document:doc,matchMedia:()=>motion,innerWidth:1280,innerHeight:800,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key)};
  for(const [key,value] of Object.entries(globals)){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
  }
  const phases=[],draws=[];
  const practical={isPointLight:true,intensity:140},tube={name:'MAT_Fluorescent_Emission',emissiveIntensity:3.2};
  const view={enabled:true,fullWidth:1280,fullHeight:800,offsetX:80,offsetY:0,width:1200,height:800};
  const workshop={loaded:true,homeFrameReady:true,car:{position:vector(),quaternion:vector(),rotation:vector()},
    camera:{position:vector(),quaternion:vector(),view,fov:46,aspect:1.2,clearViewOffset(){this.view.enabled=false;},setViewOffset(){this.view.enabled=true;},updateProjectionMatrix(){},lookAt(){}},
    hemi:{intensity:1},key:{intensity:2},fill:{intensity:.5,position:vector(2,3,-4)},warm:{intensity:5},renderView:{isActive:()=>true,frame:draw=>draw()},
    scene:{getObjectByName:name=>name==='Workshop_Detail_Pass_1973'?{traverse:fn=>fn(practical)}:null},workshopRoot:{traverse:fn=>fn({material:tube})},
    renderer:{domElement:{height:800},render:()=>assert.fail('Departure bypassed the prepared pass')},
    presentation:{getDepartureGate:()=>gate,setDepartureGate:value=>{gate=value;}},
    vehiclePresentation:{setLightMode:value=>{mode=value;},getLightingDiagnostics:()=>({mode}),update(){},
      beginDepartureCue:()=>({setFrame(values){lamp=values.headlamps;spin=values.wheelRotationRad;},restore(){lamp=spin=0;}})},
    advancedGraphics:{render:()=>draws.push({gate,z:workshop.car.position.z,key:workshop.key.intensity,mode,lamp,spin,fade,position:workshop.camera.position.clone(),fov:workshop.camera.fov,fill:workshop.fill.intensity,practical:practical.intensity,tube:tube.emissiveIntensity})}};
  const step=delta=>{time+=delta;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);};
  const play=(signal,settings={soundEnabled:false})=>playWorkshopDeparture(workshop,{signal,settings,onPhase:name=>phases.push(name),onFade:()=>fade++});
  const assertRestored=()=>{
    assert.equal(frames.size,0);assert.equal(gate,0);assert.equal(mode,'off');
    assert.equal(workshop.car.position.z,0);assert.equal(workshop.key.intensity,2);assert.equal(workshop.camera.fov,46);
    assert.equal(workshop.camera.view,view);assert.equal(view.enabled,true);assert.equal(workshop.camera.aspect,1.2);
    assert.equal(workshop.fill.position.z,-4);assert.equal(workshop.fill.intensity,.5);assert.equal(lamp,0);assert.equal(spin,0);
    assert.equal(practical.intensity,140);assert.equal(tube.emissiveIntensity,3.2);
  };
  return {workshop,frames,motion,phases,draws,step,play,assertRestored};
}

test('the route uses its loading fallback until the workshop has rendered a frame',t=>{
  const f=fixture(t);
  f.workshop.homeFrameReady=false;
  assert.equal(f.play(),null);
  f.assertRestored();
});

test('a stalled frame preserves each phase and shows the car past the open gate',async t=>{
  const f=fixture(t),done=f.play();
  f.step(16);f.step(8200);
  assert.deepEqual(f.phases,['Arrancando el motor…']);
  for(let i=0;i<45&&f.frames.size;i++)f.step(90);
  await done;
  assert.deepEqual(f.phases,['Arrancando el motor…','Apagando las luces del taller…','Levantando la cortina…','Saliendo del taller…']);
  assert.ok(f.draws.some(row=>row.gate===1&&row.z>6.5&&row.key===0&&row.lamp>.8&&row.spin<-10&&row.practical===0&&row.tube===0));
  f.assertRestored();
});

test('ignition, reveal and exit have distinct coverage, with a single fade at the threshold',async t=>{
  const f=fixture(t),done=f.play();
  for(let frame=0;frame<185&&f.frames.size;frame++)f.step(16.667);
  await done;
  assert.ok(f.draws[0].position.z>2&&f.draws[0].position.y<1.35&&f.draws[0].fov<49);
  assert.ok(f.draws.some(row=>row.gate>.1&&row.gate<.8&&row.position.z<-2&&row.fill>.5));
  assert.ok(f.draws.at(-1).position.z>f.draws.find(row=>row.gate===1).position.z+2);
  assert.equal(f.draws.find(row=>row.fade===1).gate,1);
  assert.ok(f.draws.find(row=>row.fade===1).z>6.5);
  assert.equal(f.draws.at(-1).fade,1);
  assert.ok(f.draws.length<180);
  f.assertRestored();
});

test('canceling or enabling reduced motion restores the workshop even mid-departure',async t=>{
  const f=fixture(t);
  for(let i=0;i<20;i++){
    const controller=new AbortController(),done=f.play(controller.signal);
    f.step(16);for(let frame=0;frame<10;frame++)f.step(100);
    if(i===19){f.motion.matches=true;f.motion.dispatchEvent(new Event('change'));}
    else controller.abort();
    await done;
    f.assertRestored();
  }
  assert.equal(f.play(),null);
});

test('procedural voices start with the matching visible beats and close after abort',async t=>{
  const f=fixture(t),contexts=[];
  class AudioContext {
    state='running';currentTime=0;sampleRate=8000;destination={};voices=[];clicks=[];
    constructor(){contexts.push(this);}
    param(){return {value:0,events:[],setTargetAtTime(value){this.events.push({phase:f.phases.at(-1),value});},
      setValueAtTime(value){this.value=value;},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};}
    createGain(){const gain=this.param();this.voices.push(gain);return {gain,connect(next){return next;},disconnect(){}};}
    createBiquadFilter(){return {frequency:this.param(),Q:this.param(),connect(next){return next;}};}
    createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){return {start(){},stop(){},connect(next){return next;}};}
    createOscillator(){const context=this;return {frequency:this.param(),start(){},stop(){context.clicks.push(f.phases.at(-1));},connect(next){return next;}};}
    resume(){return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  const old=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
  Object.defineProperty(globalThis,'AudioContext',{value:AudioContext,configurable:true});
  t.after(()=>old?Object.defineProperty(globalThis,'AudioContext',old):delete globalThis.AudioContext);
  for(const settings of [{soundEnabled:false},{masterVolume:0}]){
    const controller=new AbortController(),done=f.play(controller.signal,settings);f.step(16);controller.abort();await done;
  }
  assert.equal(contexts.length,0);
  const controller=new AbortController(),done=f.play(controller.signal,{soundEnabled:true,masterVolume:.25});
  const audio=contexts[0];
  assert.ok(audio.voices[0].value>0&&audio.voices[0].value<=.25);
  f.step(16);f.step(8200);
  assert.ok(audio.voices.some(voice=>voice.events.some(e=>e.phase==='Arrancando el motor…'&&e.value>0)));
  for(let i=0;i<23;i++)f.step(90);
  assert.ok(audio.clicks.includes('Apagando las luces del taller…'));
  assert.ok(audio.clicks.includes('Levantando la cortina…'));
  assert.ok(audio.voices.some(voice=>voice.events.some(e=>e.phase==='Saliendo del taller…'&&e.value>0)));
  controller.abort();await done;
  assert.equal(audio.state,'closed');
  f.assertRestored();
});

test('the prepared vehicle animates lamps and wheels without advancing driving state or invalidating materials',async()=>{
  const payload=JSON.parse(readFileSync(new URL('../assets/manifests/cockpit-payload.json',import.meta.url),'utf8'));
  const T=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64'));
  const model=new T.Group(),modelRoot=new T.Group(),geometry=new T.BoxGeometry();
  const headlamp=new T.Mesh(geometry,new T.MeshStandardMaterial({name:'Vehicle_Headlamp'}));
  const wheel=new T.Mesh(geometry,new T.MeshStandardMaterial({name:'Vehicle_Rubber'}));
  wheel.name='chevy_wheel_frontLeft_Tire';
  model.add(headlamp,wheel);
  const view=installVehiclePresentation(T,{modelRoot,lods:[model]});
  const state=view.diagnostics(),material=headlamp.material,version=material.version,emission=material.emissiveIntensity;
  const pivot=view.root.getObjectByName('chevy_frontLeft_PresentationPivot'),angle=pivot.rotation.z;
  const cue=view.beginDepartureCue();
  cue.setFrame({wheelRotationRad:-3,headlamps:.7,brake:1});
  assert.equal(pivot.rotation.z,angle-3);
  assert.ok(material.emissiveIntensity>emission);
  assert.equal(material.version,version);
  assert.deepEqual(view.diagnostics(),state);
  cue.restore();cue.restore();
  assert.equal(pivot.rotation.z,angle);
  assert.equal(material.emissiveIntensity,emission);
  view.dispose();
});
