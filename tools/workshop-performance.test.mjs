import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {applyWorkshopPerformance,workshopPerformanceSetup} from '../src/game/workshop-performance.mjs?v=bc1ff950c62515a0';
import {createVehicleConditionSession} from '../src/game/vehicle-condition.mjs?v=92fc1e81f7682f9f';

const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../src/legacy/asfalto-v6-vehicle-model.js?v=cb996a51d98043a7',import.meta.url),'utf8'),context);
const core=context.AsfaltoV6VehicleCore, original=core.CHEVY_ORIGINAL_SPEC;
const configured=applyWorkshopPerformance(original,workshopPerformanceSetup({
  parts:{intake:'restomod',cooling:'restomod',differential:'restomod',lightweight:'restomod',longRangeTank:'restomod',suspension:'restomod'},
  tuning:{finalDrive:4,frontDamping:8,rideHeight:-12},
}));

test('stock profiles keep the original spec and installed parts change the real drivetrain',()=>{
  assert.equal(applyWorkshopPerformance(original),original);
  assert.equal(configured.fuelCapacityLiters,original.fuelCapacityLiters+18);
  assert.equal(configured.massKg,original.massKg-24);
  assert.ok(configured.gearbox.finalDrive>original.gearbox.finalDrive);
  assert.ok(configured.suspensionSetup.frontDamping>1);
  assert.equal(configured.suspensionSetup.heightM,-.012);
  const wheels=core.createVehicleState(original).wheels.map(w=>({...w,contact:w.id!=='rearRight',normalLoadN:3500,angularSpeedRadps:32}));
  const input={throttle:.7,gear:2,clutchEngagement:1};
  const start={gear:2,engineRpm:3100,engineTemperatureC:110,clutchEngagement:1};
  const base=core.stepPowertrain(start,input,wheels,1/120,original);
  const tuned=core.stepPowertrain(start,input,wheels,1/120,configured);
  const scratch=core.createDynamicsScratch();
  const hot=core.stepPowertrainInto(scratch.powertrain,start,input,wheels,1/120,configured);
  assert.ok(tuned.wheelDriveTorquesNm[2]>base.wheelDriveTorquesNm[2]);
  assert.ok(tuned.wheelDriveTorquesNm[2]>tuned.wheelDriveTorquesNm[3]*2.9);
  assert.ok(tuned.state.engineTemperatureC<base.state.engineTemperatureC);
  assert.deepEqual(Array.from(hot.wheelDriveTorquesNm),Array.from(tuned.wheelDriveTorquesNm));
});

test('the extra capacity reduces fuel percentage lost for the same physical engine work',()=>{
  const consume=(vehicleSpec)=>{
    const session=createVehicleConditionSession({vehicleId:'chevy',condition:{fuel:100},vehicleSpec});
    const snapshot={engine:{rpm:2500,torqueNm:170},chassis:{linearVelocity:[12,0,0]},impacts:[]};
    for(let tick=1;tick<=240;tick++)session.sample({tick,running:true,snapshot});
    return session.getCondition().fuel;
  };
  const stock=consume(original),extended=consume(configured);
  assert.ok(stock<extended&&extended<100);
});
