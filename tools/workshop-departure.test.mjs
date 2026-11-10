import test from 'node:test';
import assert from 'node:assert/strict';
import {playWorkshopDeparture} from '../src/render/workshop-departure.mjs?v=bb1ca32ae4b8f7b2';

const vector=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});},clone(){return vector(this.x,this.y,this.z);},copy(v){this.set(v.x,v.y,v.z);}});
function fixture(t){
  const motion=Object.assign(new EventTarget(),{matches:false});
  const doc=Object.assign(new EventTarget(),{hidden:false,body:{classList:new Set()}});
  doc.body.classList.contains=doc.body.classList.has.bind(doc.body.classList);
  const frames=new Map();
  let id=0,time=0,gate=0,mode='off';
  const globals={document:doc,matchMedia:()=>motion,innerWidth:1280,innerHeight:800,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key)};
  for(const [key,value] of Object.entries(globals)){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);
  }
  const phases=[],draws=[];
  const workshop={loaded:true,car:{position:vector(),quaternion:vector(),rotation:vector()},
    camera:{position:vector(),quaternion:vector(),fov:46,aspect:1.2,clearViewOffset(){},updateProjectionMatrix(){},lookAt(){}},
    hemi:{intensity:1},key:{intensity:2},renderView:{isActive:()=>true,frame:draw=>draw()},
    renderer:{domElement:{height:800},render:()=>assert.fail('Departure bypassed the prepared pass')},
    presentation:{getDepartureGate:()=>gate,setDepartureGate:value=>{gate=value;}},
    vehiclePresentation:{setLightMode:value=>{mode=value;},getLightingDiagnostics:()=>({mode}),update(){}},
    advancedGraphics:{render:()=>draws.push({gate,z:workshop.car.position.z,key:workshop.key.intensity,mode})}};
  const step=delta=>{time+=delta;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);};
  const play=signal=>playWorkshopDeparture(workshop,{signal,settings:{soundEnabled:false},onPhase:name=>phases.push(name)});
  const assertRestored=()=>{
    assert.equal(frames.size,0);assert.equal(gate,0);assert.equal(mode,'off');
    assert.equal(workshop.car.position.z,0);assert.equal(workshop.key.intensity,2);assert.equal(workshop.camera.fov,46);
  };
  return {frames,motion,phases,draws,step,play,assertRestored};
}

test('a stalled frame preserves each phase and shows the car past the open gate',async t=>{
  const f=fixture(t),done=f.play();
  f.step(16);f.step(8200);
  assert.deepEqual(f.phases,['Arrancando el motor…']);
  for(let i=0;i<45&&f.frames.size;i++)f.step(90);
  await done;
  assert.deepEqual(f.phases,['Arrancando el motor…','Apagando las luces del taller…','Levantando la cortina…','Saliendo del taller…']);
  assert.ok(f.draws.some(row=>row.gate===1&&row.z>6.5&&row.key===0&&row.mode==='low'));
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
