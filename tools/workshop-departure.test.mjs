import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {playWorkshopDeparture} from '../src/render/workshop-departure.mjs?v=d21cd95e25016d6e';
import {installVehiclePresentation} from '../src/render/vehicle-presentation.mjs?v=a10017b2e2c64441';
import {createWorkshopArchitectureE31,WORKSHOP_E31_LAYOUT} from '../src/render/workshop-architecture-e31.mjs?v=e487a58aa1bf61ed';

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
  const exterior={visible:false};
  const view={enabled:true,fullWidth:1280,fullHeight:800,offsetX:80,offsetY:0,width:1200,height:800};
  const workshop={loaded:true,homeFrameReady:true,car:{position:vector(),quaternion:vector(),rotation:vector()},
    camera:{position:vector(),quaternion:vector(),view,fov:46,aspect:1.2,clearViewOffset(){this.view.enabled=false;},setViewOffset(){this.view.enabled=true;},updateProjectionMatrix(){},lookAt(){}},
    hemi:{intensity:1},key:{intensity:2},fill:{intensity:.5,position:vector(2,3,-4)},warm:{intensity:5},renderView:{isActive:()=>true,frame:draw=>draw()},
    scene:{getObjectByName:name=>name==='Workshop_Detail_Pass_1973'?{traverse:fn=>fn(practical)}:name==='E31_DepartureExterior'?exterior:null},workshopRoot:{traverse:fn=>fn({material:tube})},
    renderer:{domElement:{height:800},render:()=>assert.fail('Departure bypassed the prepared pass')},
    presentation:{getDepartureGate:()=>gate,setDepartureGate:value=>{gate=value;}},
    vehiclePresentation:{setLightMode:value=>{mode=value;},getLightingDiagnostics:()=>({mode}),update(){},
      beginDepartureCue:()=>({setFrame(values){lamp=values.headlamps;spin=values.wheelRotationRad;},restore(){lamp=spin=0;}})},
    advancedGraphics:{render:()=>draws.push({phase:phases.at(-1),gate,x:workshop.car.position.x,z:workshop.car.position.z,yaw:workshop.car.rotation.y,key:workshop.key.intensity,mode,lamp,spin,fade,position:workshop.camera.position.clone(),fov:workshop.camera.fov,fill:workshop.fill.intensity,practical:practical.intensity,tube:tube.emissiveIntensity,exterior:exterior.visible})}};
  const step=delta=>{time+=delta;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);};
  const play=(signal,settings={soundEnabled:false})=>playWorkshopDeparture(workshop,{signal,settings,onPhase:name=>phases.push(name),onFade:()=>fade++});
  const assertRestored=()=>{
    assert.equal(frames.size,0);assert.equal(gate,0);assert.equal(mode,'off');
    assert.equal(workshop.car.position.z,0);assert.equal(workshop.key.intensity,2);assert.equal(workshop.camera.fov,46);
    assert.equal(workshop.camera.view,view);assert.equal(view.enabled,true);assert.equal(workshop.camera.aspect,1.2);
    assert.equal(workshop.fill.position.z,-4);assert.equal(workshop.fill.intensity,.5);assert.equal(lamp,0);assert.equal(spin,0);
    assert.equal(practical.intensity,140);assert.equal(tube.emissiveIntensity,3.2);
    assert.equal(exterior.visible,false);
  };
  return {workshop,frames,motion,phases,draws,step,play,assertRestored};
}

test('the route uses its loading fallback until the workshop has rendered a frame',t=>{
  const f=fixture(t);
  f.workshop.homeFrameReady=false;
  assert.equal(f.play(),null);
  f.workshop.homeFrameReady=true;
  f.workshop.deviceProfile={phone:true};
  assert.equal(f.play(),null);
  f.assertRestored();
});

test('a stalled frame preserves each phase and shows the car past the open gate',async t=>{
  const f=fixture(t),done=f.play();
  f.step(16);f.step(8200);
  assert.deepEqual(f.phases,['Arrancando el motor…']);
  for(let i=0;i<110&&f.frames.size;i++)f.step(90);
  await done;
  assert.deepEqual(f.phases,['Arrancando el motor…','Apagando las luces del taller…','Levantando la cortina…','Saliendo del taller…']);
  assert.ok(f.draws.some(row=>row.gate===1&&row.z>6.5&&row.key===0&&row.lamp>.8&&row.spin<-10&&row.practical===0&&row.tube===0));
  f.assertRestored();
});

test('the car clears the gate and completes a right turn before the fade',async t=>{
  const f=fixture(t),done=f.play();
  for(let frame=0;frame<570&&f.frames.size;frame++)f.step(16.667);
  await done;
  const shots=f.phases.map(phase=>f.draws.filter(row=>row.phase===phase));
  const [ignition,lights,gate,exit]=shots;
  assert.ok(ignition.length>=60&&lights.length>=40&&gate.length>=90&&exit.length>=130);
  assert.ok(ignition[0].position.z>2&&ignition[0].position.y<1.35&&ignition[0].fov<49);
  assert.ok(lights.every(row=>row.gate===0&&row.position.z<-2));
  assert.ok(lights.some(row=>row.practical===0&&row.lamp===1));
  assert.ok(gate.some(row=>row.gate>.1&&row.gate<.8&&row.fov>lights.at(-1).fov+8&&row.fill>.5));
  assert.ok(exit.at(-1).position.z>exit[0].position.z+5);
  assert.ok(exit.some(row=>row.fade===0&&row.gate===1&&row.z>=9));
  assert.ok([...gate,...exit].every(row=>row.exterior));
  const turn=exit.filter(row=>row.yaw<Math.PI/2);
  assert.ok(turn.every(row=>row.z>=9.55&&row.gate===1&&row.x<0));
  const fadeStart=f.draws.find(row=>row.fade===1);
  assert.equal(fadeStart.yaw,0);
  assert.ok(fadeStart.x<=-7&&fadeStart.z>=14&&fadeStart.z<15);
  assert.equal(f.draws.at(-1).fade,1);
  assert.ok(f.draws.length>=510&&f.draws.length<=550);
  f.assertRestored();
});

test('canceling or enabling reduced motion restores the workshop even mid-departure',async t=>{
  const f=fixture(t);
  for(let i=0;i<20;i++){
    const controller=new AbortController(),done=f.play(controller.signal);
    f.step(16);for(let frame=0;frame<(i===19?79:6+i*4);frame++)f.step(100);
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
    createOscillator(){
      const context=this,frequency=this.param();
      return {frequency,start(){},stop(when){
        if(Number.isFinite(when))context.clicks.push({
          frequency:frequency.value,phase:f.phases.at(-1),z:f.workshop.car.position.z,gate:f.workshop.presentation.getDepartureGate(),
        });
      },connect(next){return next;}};
    }
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
  for(let i=0;i<68;i++)f.step(90);
  assert.ok(audio.clicks.some(cue=>cue.frequency===220&&cue.phase==='Apagando las luces del taller…'));
  assert.ok(audio.clicks.some(cue=>cue.frequency===308&&cue.phase==='Levantando la cortina…'&&cue.gate<1));
  assert.ok(audio.clicks.some(cue=>cue.frequency===148&&cue.gate===1));
  assert.ok(audio.clicks.some(cue=>cue.frequency===96&&cue.phase==='Saliendo del taller…'&&cue.z>=6.5&&cue.z<7.2));
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
  const steer=pivot.rotation.y,order=pivot.rotation.order;
  const cue=view.beginDepartureCue();
  cue.setFrame({wheelRotationRad:-3,steeringRad:.46,headlamps:.7,brake:1});
  assert.equal(pivot.rotation.z,angle-3);
  assert.equal(pivot.rotation.y,steer-.46);
  assert.ok(material.emissiveIntensity>emission);
  assert.equal(material.version,version);
  assert.deepEqual(view.diagnostics(),state);
  cue.restore();cue.restore();
  assert.equal(pivot.rotation.z,angle);
  assert.equal(pivot.rotation.y,steer);
  assert.equal(pivot.rotation.order,order);
  assert.equal(material.emissiveIntensity,emission);
  view.dispose();
});

test('the departure exterior is one prepared draw, with continuous ground under the exit',async()=>{
  const payload=JSON.parse(readFileSync(new URL('../assets/manifests/cockpit-payload.json',import.meta.url),'utf8'));
  const T=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(payload.threeCoreGz,'base64')).toString('base64'));
  const scene=new T.Scene(),workshopRoot=new T.Group();scene.add(workshopRoot);
  const architecture=createWorkshopArchitectureE31(T,{scene,workshopRoot});
  const exterior=scene.getObjectByName('E31_DepartureExterior');
  assert.ok(exterior?.isMesh);
  assert.equal(exterior.visible,false);
  assert.equal(exterior.userData.asfaltoPrewarm,true);
  assert.equal(exterior.userData.cameraCollision,false);
  assert.equal(exterior.geometry.attributes.color.count,exterior.geometry.attributes.position.count);
  assert.ok(exterior.geometry.index.count/3<750);
  const floor=WORKSHOP_E31_LAYOUT.floorY;
  for(const z of [6.50,9.45,11.70,16.20]){
    const hit=new T.Raycaster(new T.Vector3(.11,2,z),new T.Vector3(0,-1,0)).intersectObject(exterior)[0];
    assert.ok(hit&&Math.abs(hit.point.y-floor)<.015);
  }
  const look=new T.Raycaster(new T.Vector3(-.21,2.72,8),new T.Vector3(0,0,1)).intersectObject(exterior)[0];
  assert.ok(look&&look.distance>9&&look.distance<20);
  const alongStreet=new T.Raycaster(new T.Vector3(-7,2,14.35),new T.Vector3(-1,0,0)).intersectObject(exterior)[0];
  assert.ok(alongStreet&&alongStreet.point.x===-64);
  let disposed=0;exterior.geometry.addEventListener('dispose',()=>disposed++);
  architecture.dispose();
  assert.equal(disposed,1);
});
