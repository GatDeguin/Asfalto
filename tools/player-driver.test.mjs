import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {VEHICLE_CATALOG} from '../src/render/vehicle-catalog.mjs';
import {createPlayerDriver,playerDriverSeat} from '../src/render/player-driver.mjs?v=a3c74be7a204ea16';
import {createVehicleCameraRig} from '../src/game/vehicle-camera-rig.mjs?v=93a85b29944b9925';

test('each selectable exterior seats its driver below the roof and articulates both hands',()=>{
  for(const def of Object.values(VEHICLE_CATALOG).filter(d=>d.selectable)){
    const seat=playerDriverSeat(def.id),driver=createPlayerDriver(T,def.id);
    assert.ok(seat.eye[0]>seat.wheel[0]&&seat.eye[1]>seat.wheel[1],def.id);
    assert.ok(seat.eye[2]>0&&seat.wheel[2]>0,def.id);
    assert.equal(driver.root.visible,false);
    driver.update('chase',0);
    assert.equal(driver.root.visible,true);
    assert.ok(new T.Box3().setFromObject(driver.root).max.y<=seat.roofM,def.id);
    const hands=driver.root.children.filter(node=>/^DriverArm_.*_2$/.test(node.name));
    const rest=hands.map(mesh=>mesh.position.toArray());
    driver.update('cinematic',.52);
    assert.equal(driver.root.visible,true);
    assert.ok(hands.every((mesh,i)=>mesh.position.distanceTo(new T.Vector3(...rest[i]))>.04));
    driver.update('hood',0);
    assert.equal(driver.root.visible,false);
    driver.update('cockpit',0);
    assert.equal(driver.root.visible,false);
    driver.dispose();
    assert.equal(driver.root.children.length,0);
  }
});

test('external cameras frame the driver immediately after a discontinuous relocation',()=>{
  const camera=new T.PerspectiveCamera(48,1.6,.1,1000),rig=createVehicleCameraRig({camera});
  const frame=(x,raceProgress)=>({projection:{raceProgress},currentSnapshot:{chassis:{
    position:[x,1,0],rotation:[0,0,0,1],linearVelocity:[0,0,0],
  }}});
  rig.setMode('chase');
  rig.reset(frame(0,0));
  const chase=rig.update(frame(2000,80),1/60);
  assert.ok(Math.abs(chase.position[0]-2000)<10);
  rig.setMode('cinematic');
  const cinema=rig.update(frame(2000,80),1/60);
  assert.ok(Math.abs(cinema.look[0]-2000)<1.1);
  camera.updateMatrixWorld(true);
  const seat=playerDriverSeat('chevy'),head=new T.Vector3(2000-seat.eye[0],1+seat.eye[1],-seat.eye[2]).project(camera);
  assert.ok(Math.abs(head.x)<.5&&Math.abs(head.y)<.5);
});
