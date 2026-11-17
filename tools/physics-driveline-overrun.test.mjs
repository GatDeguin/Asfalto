import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const context=vm.createContext({console,WebAssembly,TextDecoder,TextEncoder,atob,btoa,performance});
for(const file of ['asfalto-v6-rapier.js','asfalto-v6-vehicle-model.js','asfalto-v6-physics-runtime.js'])vm.runInContext(fs.readFileSync(new URL('../src/legacy/'+file,import.meta.url),'utf8'),context);
const R=context.AsfaltoV6Rapier,C=context.AsfaltoV6VehicleCore,P=context.AsfaltoV6Physics;await R.init();
const spec=C.CHEVY_ORIGINAL_SPEC,ratio=spec.gearbox.forward[0]*spec.gearbox.finalDrive,ceiling=(spec.engine.mechanicalLimitRpm+250)*2*Math.PI/60;

function createCar({mu=.407,surface='grass',gear=1}={}){
  const world=new R.World({x:0,y:-9.81,z:0});world.createCollider(R.ColliderDesc.cuboid(1000,.1,1000).setTranslation(0,-.1,0));world.step();
  const car=new P.VehiclePhysicsSession({RAPIER:R,world,core:C,spec,spawn:{x:0,y:.56,z:0},mutableSnapshots:true,environment:()=>({mu,surface,waterDepthM:0})});
  car.reset({spawn:{x:0,y:.56,z:0},initialGear:0});for(let i=0;i<360;i++)car.stepFixedMutable({brake:1,requestedGear:0,clutchEngagement:0});
  return{car,gear,dispose(){car.dispose();world.free();}};
}

for(const steer of [0,.48])test(`constant human-reachable pedal on low grip cannot accelerate the shaft past its engine (${steer} steering)`,()=>{
  const run=createCar();let peak=0,peakPower=0,minimumContacts=4;
  try{
    for(let i=0;i<120*20;i++){
      const s=run.car.stepFixedMutable({throttle:1,brake:0,handbrake:0,steer,requestedGear:1,clutchEngagement:1});
      const drivenOmega=(s.wheels[2].angularSpeedRadps+s.wheels[3].angularSpeedRadps)/2;
      peak=Math.max(peak,drivenOmega*ratio);peakPower=Math.max(peakPower,s.clutch.slipPowerW);
      minimumContacts=Math.min(minimumContacts,s.wheels.filter(w=>w.contact).length);
      assert.equal(s.impact,false);
    }
    assert.equal(minimumContacts,4);
    // Small one-step tire-reaction overshoot is allowed; hundreds of thousands
    // of shaft RPM with a 5,450 RPM engine is not a possible clutch coupling.
    assert.ok(peak<ceiling*1.1,`shaft ${peak} rad/s, engine ceiling ${ceiling}; clutch ${peakPower} W`);
  }finally{run.dispose();}
});

for(const gear of [1,-1])test(`an overrunning engaged clutch opposes shaft motion in gear ${gear}, including closed throttle`,()=>{
  const state={engineRpm:spec.engine.mechanicalLimitRpm+250,gear,clutchEngagement:1,temperatureC:20};
  const wheelOmega=Math.sign(gear)*ceiling*1.5/ratio;
  const wheels=C.createVehicleState(spec).wheels.map(w=>({...w,angularSpeedRadps:wheelOmega,normalLoadN:3500,contact:true,wheelInertiaKgM2:1.8}));
  const result=C.stepPowertrain(state,{throttle:0},wheels,1/120,spec);
  const power=result.wheelDriveTorquesNm.reduce((sum,torque,i)=>sum+torque*wheels[i].angularSpeedRadps,0);
  assert.ok(power<0,`overrun coupling must absorb wheel energy, got ${power} W`);
  assert.ok(result.clutchSlipPowerW>0);
});

for(const gear of [0,1])test(`neutral/open clutch does not couple an overrunning wheel (gear ${gear})`,()=>{
  const state={engineRpm:spec.engine.idleRpm,gear,clutchEngagement:gear===0?1:0,temperatureC:20};
  const wheels=C.createVehicleState(spec).wheels.map(w=>({...w,angularSpeedRadps:500,normalLoadN:3500,contact:true}));
  const result=C.stepPowertrain(state,{throttle:1},wheels,1/120,spec);
  assert.ok(result.wheelDriveTorquesNm.every(torque=>torque===0));assert.equal(result.clutchSlipPowerW,0);
});

test('first gear opposing rollback never adds torque in the rollback direction',()=>{
  const wheels=C.createVehicleState(spec).wheels.map(w=>({...w,angularSpeedRadps:-100,normalLoadN:3500,contact:true}));
  const result=C.stepPowertrain({engineRpm:1000,gear:1,clutchEngagement:1,temperatureC:20},{throttle:.5},wheels,1/120,spec);
  assert.ok(result.wheelDriveTorquesNm.slice(2).every(torque=>torque>0));
});

test('limited-slip coupling respects unequal wheel inertia and its 75/25 torque split',()=>{
  const lsd={...spec,drivetrain:{...spec.drivetrain,differential:'limited-slip'}},omega=(ceiling-1)/ratio;
  const wheels=C.createVehicleState(lsd).wheels.map((w,i)=>({...w,angularSpeedRadps:omega,normalLoadN:i===3?0:3500,contact:i!==3,wheelInertiaKgM2:i===3?10.8:1.8}));
  const state={engineRpm:spec.engine.mechanicalLimitRpm+245,gear:1,clutchEngagement:1,temperatureC:20};
  const result=C.stepPowertrain(state,{throttle:1},wheels,1/120,lsd);
  assert.ok(result.wheelDriveTorquesNm[2]>result.wheelDriveTorquesNm[3]);
  const nextShaft=wheels.slice(2).reduce((sum,w,i)=>sum+(w.angularSpeedRadps+result.wheelDriveTorquesNm[i+2]/w.wheelInertiaKgM2/120)*ratio*(i===0?.75:.25),0);
  assert.ok(nextShaft<=ceiling+1e-9,`LSD impulse exceeded the engine speed constraint: ${nextShaft} > ${ceiling}`);
});

test('limited-slip speed, torque and heat account for the same transmitted power',()=>{
  const lsd={...spec,drivetrain:{...spec.drivetrain,differential:'limited-slip'}};
  const wheels=C.createVehicleState(lsd).wheels.map((w,i)=>({...w,angularSpeedRadps:i===3?20:80,normalLoadN:i===3?0:3500,contact:i!==3,wheelInertiaKgM2:i===3?10.8:1.8}));
  const state={engineRpm:spec.engine.mechanicalLimitRpm+250,gear:1,clutchEngagement:1,temperatureC:20};
  const result=C.stepPowertrain(state,{throttle:.7},wheels,1/120,lsd);
  const clutchTorque=result.driveTorqueNm/(ratio*spec.drivetrain.efficiency),shaftOmega=result.state.engineRpm*2*Math.PI/60-result.state.clutchSlipRadps;
  const outputPower=result.wheelDriveTorquesNm.reduce((sum,torque,i)=>sum+torque*wheels[i].angularSpeedRadps,0);
  assert.ok(outputPower<0,'overrunning LSD must absorb energy');
  assert.ok(Math.abs(outputPower-clutchTorque*shaftOmega*spec.drivetrain.efficiency)<1e-8,'differential power must balance');
  const hot=C.createDynamicsScratch();
  const plain=value=>JSON.parse(JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?Array.from(item):item));
  assert.deepEqual(plain(C.stepPowertrainInto(hot.powertrain,state,{throttle:.7},wheels,1/120,lsd)),plain(result));
});

for(const gear of [1,-1])test(`driven airborne wheels respond to torque and brakes in gear ${gear}`,()=>{
  const world=new R.World({x:0,y:-9.81,z:0});world.createCollider(R.ColliderDesc.cuboid(100,.1,100).setTranslation(0,-.1,0));world.step();
  const car=new P.VehiclePhysicsSession({RAPIER:R,world,core:C,spec,spawn:{x:0,y:3,z:0},mutableSnapshots:true});
  try{
    car.reset({spawn:{x:0,y:3,z:0},initialGear:gear});
    for(let i=0;i<12;i++)car.stepFixedMutable({throttle:.6,requestedGear:gear,clutchEngagement:1});
    const before=car.getSnapshotCopy();assert.ok(before.wheels.every(w=>!w.contact));
    assert.ok(before.wheels.slice(2).every(w=>w.angularSpeedRadps*Math.sign(gear)>.1),'unloaded driven wheels must spin');
    for(let i=0;i<12;i++)car.stepFixedMutable({throttle:0,brake:1,requestedGear:0,clutchEngagement:0});
    const after=car.getSnapshotCopy();assert.ok(after.wheels.every(w=>!w.contact));
    assert.ok(after.wheels.slice(2).every(w=>Math.abs(w.angularSpeedRadps)<.01),'airborne brakes must stop the free wheels');
  }finally{car.dispose();world.free();}
});
