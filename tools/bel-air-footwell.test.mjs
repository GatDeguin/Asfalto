import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {installClassicCabinSurfaces} from '../src/render/classic-cabin-surfaces.mjs?v=7acecb476191cf1b';
import {installVehiclePresentation} from '../src/render/vehicle-presentation.mjs?v=03174439df407898';
import {authoredCockpitAnchors} from '../src/game/expansion-vehicle-runtime.mjs?v=aaacadfb3c716f14';
import {createVehicleCameraRig} from '../src/game/vehicle-camera-rig.mjs';
import {HEAD_MOTION_LIMITS} from '../src/game/cockpit-head-motion.mjs';
import {sampleCockpitEntrance} from '../src/game/race-camera-entrance.mjs';
import {loadVehicleGeometry} from './vehicle-cabin-pilot-fixture.mjs?v=34e746db17e10157';

test('the Bel Air toe board closes the sight lines from the driver to the road under the dashboard', () => {
  const model = new T.Group();
  const trim = installClassicCabinSurfaces(T, model, 'belair_1957');
  const board = model.getObjectByName('BelAir_ToeBoard');
  assert.ok(board?.isMesh, 'the toe board must be solid cabin geometry');
  model.updateMatrixWorld(true);
  const ray = new T.Raycaster(), origin = new T.Vector3(.20, .184, .18);
  for (const [pitch, yaw] of [[-28, 15], [-35, -25], [-35, -20], [-35, -15], [-35, 15]]) {
    const p = T.MathUtils.degToRad(pitch), y = T.MathUtils.degToRad(yaw);
    ray.set(origin, new T.Vector3(-Math.cos(p) * Math.cos(y), Math.sin(p), Math.cos(p) * Math.sin(y)));
    assert.ok(ray.intersectObject(board).some(hit => hit.point.y > -.161), `open footwell at ${pitch}°, ${yaw}°`);
  }
  trim.dispose();
  assert.equal(model.getObjectByName('BelAir_ToeBoard'), undefined);
});

test('the Bel Air shipped cabin hides the road below the footwell along the game camera path', async t => {
  const vehicle = 'belair_1957';
  const model = await loadVehicleGeometry(vehicle, 0);
  const view = installVehiclePresentation(T, {vehicle, modelRoot:new T.Group(), lods:[model], physicalCalibration:true});
  t.after(() => view.dispose());
  const snapshot = {timeSeconds:1, chassis:{position:[0, 0, 0], rotation:[0, 0, 0, 1]}, wheels:[]};
  view.update({snapshot, cameraMode:'cockpit'});
  const camera = new T.PerspectiveCamera(35, 1.6, .02, 2200);
  const rig = createVehicleCameraRig({camera, cockpitPhysicalMotion:false});
  rig.setCockpitCalibration({lensMode:'manual', focalLengthMm:18});
  const {cockpit, lookDownDeg} = authoredCockpitAnchors(vehicle);
  rig.reset({currentSnapshot:snapshot, bodyMountedCockpit:true, cockpitAnchorM:cockpit, cockpitLookDownDeg:lookDownDeg});
  const eye = camera.position.clone();
  const eyeModel = view.root.worldToLocal(eye.clone()).toArray();
  const samples = [eye];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const shift = new T.Vector3(x, y, z).multiply(new T.Vector3(...HEAD_MOTION_LIMITS.translationM));
    samples.push(eye.clone().add(shift.applyQuaternion(camera.quaternion)));
  }
  for (const progress of [.68, .73, .78, .83, .88, .94]) {
    const {position, inside} = sampleCockpitEntrance(vehicle, eyeModel, progress);
    assert.ok(inside);
    samples.push(view.root.localToWorld(new T.Vector3(...position)));
  }

  const board = view.root.getObjectByName('BelAir_ToeBoard');
  const opaque = [];
  view.root.traverseVisible(node => {
    if (node.isMesh && node !== board && node.material.visible && !node.material.transparent && !node.material.transmission) {
      node.geometry.computeBoundingBox();
      opaque.push(node);
    }
  });
  const ray = new T.Raycaster();
  const inverseBody = view.root.matrixWorld.clone().invert();
  const localDirection = new T.Vector3(), floorPoint = new T.Vector3();
  let floorRays = 0;
  for (const sample of samples) {
    camera.position.copy(sample);
    camera.updateMatrixWorld(true);
    const localEye = sample.clone().applyMatrix4(inverseBody);
    for (let row = 0; row <= 14; row++) for (let column = 0; column <= 28; column++) {
      ray.setFromCamera({x:-1 + column * .07, y:-1 + row * .07}, camera);
      localDirection.copy(ray.ray.direction).transformDirection(inverseBody);
      if (localDirection.y >= 0) continue;
      floorPoint.copy(localEye).addScaledVector(localDirection, (-.16 - localEye.y) / localDirection.y);
      if (floorPoint.x < -.26 || floorPoint.x > .19 || Math.abs(floorPoint.z) > .345) continue;
      floorRays++;
      ray.near = camera.near;
      ray.far = (-.58 - sample.y) / ray.ray.direction.y;
      const blocked = ray.intersectObject(board, false).length || ray.intersectObjects(opaque, false).length;
      assert.ok(blocked, `the road is visible through the footwell at ${floorPoint.toArray()}`);
    }
  }
  assert.ok(floorRays >= 500);
  t.diagnostic(`${floorRays} rays toward the footwell from ${samples.length} game camera positions`);
});
