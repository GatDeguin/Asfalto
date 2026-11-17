import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ctx = vm.createContext({console, WebAssembly, TextDecoder, TextEncoder, atob, btoa, performance});
for (const file of ['asfalto-v6-rapier.js', 'asfalto-v6-vehicle-model.js', 'asfalto-v6-physics-runtime.js']) {
  const source=process.env.PHYSICS_BRAKE_RUNTIME_ROOT ? path.join(process.env.PHYSICS_BRAKE_RUNTIME_ROOT,'src/legacy',file) : new URL('../src/legacy/' + file, import.meta.url);
  vm.runInContext(fs.readFileSync(source, 'utf8'), ctx);
}
const R = ctx.AsfaltoV6Rapier;
await R.init();

// Reproduces the physical 100–0 activity failure: delayed longitudinal tire
// relaxation keeps pushing backwards after locked wheels have stopped.
for (const direction of [1, -1]) test(`full service brake settles from ${direction * 100} km/h without reversing`, () => {
  const world = new R.World({x:0,y:-9.81,z:0});
  world.createCollider(R.ColliderDesc.cuboid(200,.1,200).setTranslation(0,-.1,0));
  world.step();
  const car = new ctx.AsfaltoV6Physics.VehiclePhysicsSession({RAPIER:R, world,
    core:ctx.AsfaltoV6VehicleCore, spec:ctx.AsfaltoV6VehicleCore.CHEVY_ORIGINAL_SPEC,
    spawn:{x:0,y:.56,z:0}, mutableSnapshots:true});
  try {
    car.reset({spawn:{x:0,y:.56,z:0}, initialGear:0});
    for (let i=0;i<120;i++) car.stepFixed({brake:1,requestedGear:0,clutchEngagement:0});
    car.body.setLinvel({x:direction*100/3.6,y:0,z:0},true);
    for (const wheel of car.wheels) wheel.angularSpeedRadps=direction*100/3.6/car.spec.wheelRadiusM;
    let minimum=Infinity, restingTicks=0, peakAtRest=0,minimumSample;
    for(let i=0;i<1200;i++){
      const snapshot=car.stepFixed({brake:1,throttle:0,requestedGear:0,clutchEngagement:0});
      const speed=snapshot.chassis.linearVelocity[0]*direction;
      if(speed<minimum){minimum=speed;minimumSample={tick:i,rotation:snapshot.chassis.rotation,wheels:snapshot.wheels.map(w=>({omega:w.angularSpeedRadps,fx:w.tire.fxN,capacity:w.tire.capacityN,load:w.normalLoadN}))};}
      if(i>720){peakAtRest=Math.max(peakAtRest,Math.hypot(...snapshot.chassis.linearVelocity));
        if(Math.hypot(...snapshot.chassis.linearVelocity)<.1&&snapshot.wheels.every(w=>w.contact))restingTicks++;}
    }
    assert.ok(minimum>-.1, `braking pushed the car in reverse at ${minimum} m/s: ${JSON.stringify(minimumSample)}`);
    assert.ok(restingTicks>=400, `only ${restingTicks} supported rest ticks, peak ${peakAtRest} m/s`);
  } finally {car.dispose();world.free();}
});

test('locked brakes cannot hold a steep slope beyond tire adhesion and keep reporting slip',()=>{
  const slope=.3,world=new R.World({x:0,y:-9.81,z:0});
  const rotation={x:0,y:0,z:Math.sin(slope/2),w:Math.cos(slope/2)};
  world.createCollider(R.ColliderDesc.cuboid(200,.1,200).setTranslation(0,-.1,0).setRotation(rotation));world.step();
  const car=new ctx.AsfaltoV6Physics.VehiclePhysicsSession({RAPIER:R,world,core:ctx.AsfaltoV6VehicleCore,
    spec:ctx.AsfaltoV6VehicleCore.CHEVY_ORIGINAL_SPEC,spawn:{x:0,y:.56,z:0},mutableSnapshots:true,
    environment:()=>({mu:.12,surface:'asphalt',waterDepthM:0})});
  try{
    car.reset({spawn:{x:0,y:.56,z:0},initialGear:0});car.body.setRotation(rotation,true);
    let movingLockedSamples=0;
    for(let i=0;i<720;i++){
      const snapshot=car.stepFixed({brake:1,requestedGear:0,clutchEngagement:0});
      const speed=Math.abs(snapshot.chassis.linearVelocity[0]);
      if(speed>.2&&speed<.8){for(const wheel of snapshot.wheels){
        if(wheel.contact&&wheel.angularSpeedRadps===0&&wheel.tire.saturated){movingLockedSamples++;assert.ok(Math.abs(wheel.slipRatio)>.1,'sliding locked contact reports slip');}
      }}
    }
    assert.ok(movingLockedSamples>0,'test exercises sliding locked contacts');
    assert.ok(car.getSnapshot().chassis.linearVelocity[0]<-1,'insufficient grip permits downhill slide');
  }finally{car.dispose();world.free();}
});

for(const slope of [-.08,.08]) test(`brake holds on ${slope*100}% approximate grade and releases without glue`,()=>{
  const world=new R.World({x:0,y:-9.81,z:0});
  const rotation={x:0,y:0,z:Math.sin(slope/2),w:Math.cos(slope/2)};
  world.createCollider(R.ColliderDesc.cuboid(200,.1,200).setTranslation(0,-.1,0).setRotation(rotation));world.step();
  const car=new ctx.AsfaltoV6Physics.VehiclePhysicsSession({RAPIER:R,world,core:ctx.AsfaltoV6VehicleCore,
    spec:ctx.AsfaltoV6VehicleCore.CHEVY_ORIGINAL_SPEC,spawn:{x:0,y:.56,z:0},mutableSnapshots:true});
  try{
    car.reset({spawn:{x:0,y:.56,z:0},initialGear:0});car.body.setRotation(rotation,true);
    for(let i=0;i<240;i++)car.stepFixed({brake:1,requestedGear:0,clutchEngagement:0});
    const start=car.getSnapshotCopy();let maxSpeed=0;
    for(let i=0;i<480;i++){
      const snapshot=car.stepFixed({brake:1,requestedGear:0,clutchEngagement:0});
      maxSpeed=Math.max(maxSpeed,Math.hypot(...snapshot.chassis.linearVelocity));
      for(const wheel of snapshot.wheels)assert.ok(Math.hypot(wheel.tire.fxN,wheel.tire.fyN)<=wheel.tire.capacityN+1e-6,'contact force respects tire capacity');
    }
    const held=car.getSnapshotCopy();
    assert.ok(maxSpeed<.1,`held speed ${maxSpeed}`);
    assert.ok(Math.abs(held.chassis.position[0]-start.chassis.position[0])<.1,'held position');
    for(let i=0;i<240;i++)car.stepFixed({brake:0,requestedGear:0,clutchEngagement:0});
    assert.ok(car.getSnapshot().chassis.linearVelocity[0]*-Math.sign(slope)>.15,'releasing brake permits downhill roll');
  }finally{car.dispose();world.free();}
});
