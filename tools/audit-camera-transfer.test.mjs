import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/legacy/module-02.mjs?v=137fa1d93f159138',import.meta.url),'utf8');
const start=source.indexOf("    onVehicleReset({ speedMps = 0, gear = 'N', reason } = {}) {");
const end=source.indexOf('    onInputCaptureRelease()',start);
const method=source.slice(start,end).trim().replace(/,$/,'');

test('the real host invalidates camera interpolation on circuit transfer, rollback and restart without changing calibration',()=>{
 assert.ok(start>0&&end>start);
 for(const reason of ['circuit-change','circuit-rollback','race-reset','race-start']){
  const calibration=Object.freeze({focalLengthMm:35,positionOffsetM:[1,2,3]});
  const context={raceCameraInitialized:true,lastPhysicalCameraPose:{position:[0,2.5,1]},calibration,
   raceCameraState:{current:"chase"},mobileDrivingControls:null,raceChevyPresentation:null,cockpitIgnition:null,
   headMotion:{reset(){}},cockpitHeadRoot:{position:{set(){}},quaternion:{identity(){}}},
   cameraEntrance:{cancel(){},start(){}},cameraOpening:{cancel(){},start(){}},
   window:{matchMedia:()=>({matches:true})},spawnParkingHold:{reset(){}},createVehicleState:()=>({}),debugControls:{},updateKeyUi(){},reason};
  vm.createContext(context);vm.runInContext(`({${method}}).onVehicleReset({reason});`,context);
  assert.equal(context.raceCameraInitialized,false,reason+' must snap to the new physical pose on its first frame');
  assert.equal(context.lastPhysicalCameraPose,null);assert.strictEqual(context.calibration,calibration);
 }
});
