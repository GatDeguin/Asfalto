import test from 'node:test';
import assert from 'node:assert/strict';
import {interpolateVehicleSnapshot} from '../src/game/physical-render-bridge.mjs?v=3bfbde2ea40b338a';

test('render interpolation never freezes or retains the mutable physics buffers', () => {
  const current={
    chassis:{position:[2,1,0],rotation:[0,0,0,1],linearVelocity:[3,0,0],angularVelocity:[0,0,0],acceleration:[1,0,0]},
    wheels:[{id:'frontLeft',rotationRad:1,steerAngleRad:.1,compressionM:.12,localAnchorM:[1,0,1],point:[1,0,1],normal:[0,1,0],tire:{fxN:100,fyN:20}}],
    engine:{rpm:900,ignition:{state:'running'}},brakes:{locked:[false,false,false,false]},
    damage:{engine:{condition:1}},impacts:[{localPointM:[0,0,0]}],controls:{throttle:0},
  };
  const previous={...current,chassis:{...current.chassis,position:[0,1,0]}};
  const rendered=interpolateVehicleSnapshot(previous,current,.5);
  assert.equal(rendered.chassis.position[0],1);
  assert.ok(Object.isFrozen(rendered));assert.ok(Object.isFrozen(rendered.wheels[0].tire));
  assert.equal(Object.isFrozen(current.wheels[0].tire),false,'live tire is still writable');
  assert.equal(Object.isFrozen(current.chassis.linearVelocity),false,'live velocity is still writable');
  current.wheels[0].tire.fxN=250;current.chassis.linearVelocity[0]=8;
  current.engine.ignition.state='stalled';current.brakes.locked[0]=true;
  current.damage.engine.condition=.5;current.impacts[0].localPointM[0]=3;
  assert.equal(rendered.wheels[0].tire.fxN,100);assert.equal(rendered.chassis.linearVelocity[0],3);
  assert.equal(rendered.engine.ignition.state,'running');assert.equal(rendered.brakes.locked[0],false);
  assert.equal(rendered.damage.engine.condition,1);assert.equal(rendered.impacts[0].localPointM[0],0);
  assert.doesNotThrow(()=>interpolateVehicleSnapshot(previous,current,.75));
});

