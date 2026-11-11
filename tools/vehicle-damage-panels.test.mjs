import assert from 'node:assert/strict';
import test from 'node:test';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {loadVehicleGeometry} from './vehicle-cabin-pilot-fixture.mjs';
import {createVehicleDamagePanels} from '../src/render/vehicle-damage-panels.mjs?v=212e81c2b33906ed';

function fixture({cameraCanHideMount = false} = {}) {
  const scene = new T.Scene();
  const mount = new T.Group();
  const model = new T.Group();
  const material = new T.MeshStandardMaterial();
  scene.add(mount);
  mount.add(model);
  mount.position.set(3, .6, -8);
  mount.rotation.y = Math.PI;
  mount.scale.set(2.6, 2.4, 2.1);

  function mesh(name, size, location, parent = model) {
    const object = new T.Mesh(new T.BoxGeometry(...size), material);
    object.name = name;
    object.position.fromArray(location);
    parent.add(object);
    return object;
  }

  const left = mesh('Puerta_I_Chapa_Separada', [.51, .22, .02], [0, -.06, .35]);
  const right = mesh('Puerta_D_Chapa_Separada', [.51, .22, .02], [0, -.06, -.35]);
  const glass = mesh('Ventanilla_Puerta_Izquierdo__13', [.34, .13, .01], [.02, .14, .31]);
  const quarter = mesh('Ventanilla_Cuarto_Izquierdo__13', [.2, .13, .01], [.34, .14, .31]);
  const hoods = Array.from({length: 2}, (_, i) => {
    const pivot = new T.Group();
    model.add(pivot);
    pivot.position.set(-.306, .093, 0);
    mesh('HoodPart'+i, [.6, .025, .25], [-.3, 0, (i ? 1 : -1)*.125], pivot);
    return pivot;
  });
  const rig = createVehicleDamagePanels(T, {model, vehicle: 'chevrolet_1969', hoods, scene,
    visibilityRoot: cameraCanHideMount ? model : null});
  const pivot = id => model.getObjectByName('chevrolet_1969_'+id+'_DamageHinge');
  const debris = id => scene.getObjectByName('chevrolet_1969_'+id+'_DamageDebris');
  return {scene, mount, model, material, left, right, glass, quarter, hoods, rig, pivot, debris};
}

test('left door jams outward with its front glass and repairs to the exact original meshes', () => {
  const f = fixture();
  const before = f.model.children.slice();
  const originalGeometry = f.left.geometry;
  const position = f.left.position.clone();
  let originalDisposals = 0;
  originalGeometry.addEventListener('dispose', () => originalDisposals++);
  f.rig.setDamage({leftDoor: .41});
  assert.deepEqual(f.model.children, before);
  f.rig.setDamage({leftDoor: .58});
  assert.equal(f.rig.diagnostics().leftDoor.state, 'jammed');
  const leaf = f.pivot('leftDoor').getObjectByName(f.left.name);
  assert.ok(f.model.worldToLocal(leaf.getWorldPosition(new T.Vector3())).z > position.z);
  assert.ok(f.pivot('leftDoor').getObjectByName(f.glass.name));
  assert.equal(f.pivot('leftDoor').getObjectByName(f.quarter.name), undefined);
  assert.equal(f.left.visible, false);
  assert.equal(f.right.visible, true);
  assert.equal(f.quarter.visible, true);
  f.rig.setDamage({});
  assert.deepEqual(f.model.children, before);
  assert.equal(f.left.geometry, originalGeometry);
  assert.ok(f.left.position.equals(position));
  assert.equal(f.left.visible, true);
  assert.equal(f.glass.visible, true);
  assert.equal(originalDisposals, 0);
  f.rig.dispose();
});

test('a multi-piece hood launches once, remains in world space, and clears when repaired', () => {
  const f = fixture();
  f.rig.setHoodOpen(.5);
  assert.ok(f.hoods.every(hood => hood.rotation.z === -.52));
  f.rig.setHoodOpen(0);
  f.rig.setDamage({hood: .65});
  assert.ok(f.hoods.every(hood => hood.rotation.z < -.08));
  const snapshot = {chassis: {position: [3, .6, -8], linearVelocity: [35, 0, 2]},
    wheels: [{contact: true, point: [3, 0, -8], normal: [0, 1, 0]}]};
  f.rig.setDamage({hood: .92}, {spawnDebris: true});
  f.rig.update({dt: .016, snapshot, paused: true});
  const part = f.debris('hood');
  assert.ok(part);
  assert.equal(part.parent, f.scene);
  assert.equal(part.children.length, 2);
  assert.equal(f.hoods[0].visible, false);
  assert.equal(f.hoods[1].visible, false);
  const start = part.getWorldPosition(new T.Vector3());
  f.mount.position.x += 80;
  f.rig.update({dt: .1, snapshot, paused: true});
  assert.ok(part.getWorldPosition(new T.Vector3()).equals(start));
  f.rig.setDamage({hood: .98}, {spawnDebris: true});
  for (let i = 0; i < 60; i++) f.rig.update({dt: .05, snapshot});
  const settled = part.getWorldPosition(new T.Vector3());
  assert.ok(settled.distanceTo(start) > 1 && settled.distanceTo(start) < 8);
  assert.equal(f.rig.diagnostics().hood.debris, 'settled');
  f.rig.update({dt: .1, snapshot});
  assert.ok(part.getWorldPosition(new T.Vector3()).equals(settled));
  assert.equal(f.scene.getObjectsByProperty('name', part.name).length, 1);
  let disposals = 0;
  for (const mesh of part.children) mesh.geometry.addEventListener('dispose', () => disposals++);
  f.rig.setDamage({});
  assert.equal(f.debris('hood'), undefined);
  assert.equal(disposals, 2);
  assert.ok(f.hoods.every(hood => hood.visible && hood.rotation.z === 0));
  f.rig.dispose();
});

test('saved, hidden LOD, and reduced-motion damage remove panels without replaying their launch', () => {
  const f = fixture();
  f.rig.setDamage({leftDoor: .9});
  f.rig.update({dt: .02});
  assert.equal(f.left.visible, false);
  assert.equal(f.debris('leftDoor'), undefined);
  f.mount.visible = false;
  f.rig.setDamage({leftDoor: .9, rightDoor: .9}, {spawnDebris: true});
  f.mount.visible = true;
  f.rig.update({dt: .02});
  assert.equal(f.right.visible, false);
  assert.equal(f.debris('rightDoor'), undefined);
  f.rig.setDamage({hood: .9}, {spawnDebris: true});
  f.rig.update({dt: .02, reducedMotion: true});
  f.rig.update({dt: .02});
  assert.equal(f.debris('hood'), undefined);
  assert.ok(f.hoods.every(hood => !hood.visible));
  f.rig.dispose();
  assert.ok(f.hoods.every(hood => hood.visible));
  assert.equal(f.left.visible, true);
  assert.equal(f.right.visible, true);
});

test('cockpit visibility leaves the selected LOD eligible, and restart clears existing world debris', () => {
  const f = fixture({cameraCanHideMount: true});
  f.mount.visible = false;
  f.rig.setDamage({leftDoor: .9}, {spawnDebris: true});
  f.rig.update({paused: true});
  assert.ok(f.debris('leftDoor'));
  f.rig.clearDebris();
  assert.equal(f.debris('leftDoor'), undefined);
  assert.equal(f.left.visible, false);
  f.rig.setDamage({leftDoor: .9}, {spawnDebris: true});
  f.rig.update();
  assert.equal(f.debris('leftDoor'), undefined);
  f.model.visible = false;
  f.rig.setDamage({leftDoor: .9, rightDoor: .9}, {spawnDebris: true});
  f.model.visible = true;
  f.rig.update();
  assert.equal(f.debris('rightDoor'), undefined);
  f.rig.dispose();
});

test('a split seam follows later dents in the live geometry and frees only its own buffers', () => {
  const model = new T.Group();
  const original = new T.BoxGeometry(.55, .28, .03, 5, 2, 1);
  const door = new T.Mesh(original, new T.MeshStandardMaterial());
  door.name = 'V7_SheetMetal_L_Door';
  door.position.z = .34;
  model.add(door);
  const rig = createVehicleDamagePanels(T, {model, vehicle: 'chevy_400_1957'});
  door.geometry = original.clone().translate(.065, 0, 0);
  rig.setDamage({leftDoor: .58});
  const pivot = model.getObjectByName('chevy_400_1957_leftDoor_DamageHinge');
  const cut = pivot.children[0].geometry;
  assert.ok(Math.abs(cut.boundingBox.max.x - .104) < .0001);
  door.geometry.translate(.03, 0, 0);
  rig.setDamage({leftDoor: .58});
  assert.equal(pivot.children[0].geometry, cut);
  assert.ok(Math.abs(cut.boundingBox.max.x - .134) < .0001);
  let cutDisposals = 0, liveDisposals = 0;
  cut.addEventListener('dispose', () => cutDisposals++);
  door.geometry.addEventListener('dispose', () => liveDisposals++);
  rig.setDamage({});
  assert.equal(cutDisposals, 1);
  assert.equal(liveDisposals, 0);
  assert.equal(door.visible, true);
  rig.dispose();
});

const assets = {
  chevy: {door: 'chevy_Body_paint', glass: 'chevy_static_Vehicle_Glass'},
  chevrolet_1969: {door: 'Puerta_I_Chapa_Separada', glass: 'Ventanilla_Puerta_Izquierdo__13', fixed: 'Ventanilla_Cuarto_Izquierdo__13'},
  chevy_400_1957: {door: 'V7_SheetMetal_L_Door', glass: 'V7_GlassPane_01', fixed: 'V7_GlassPane_03'},
  belair_1957: {door: 'belair_1957_doorSide_right_BA57_Paint_Turquoise', fixed: 'belair_1957_static_BA57_Glass'},
  pickup_3100: {door: 'pickup_3100_doorSide_right_C3100_Paint_Turquoise', glass: 'pickup_3100_static_C3100_Glass'},
};

test('all selectable shipping LODs isolate both doors and their authored hood parts', async () => {
  for (const [vehicle, {door, glass, fixed}] of Object.entries(assets)) {
    for (const lod of [0, 1, 2]) {
      const model = await loadVehicleGeometry(vehicle, lod);
      const hoodParts = [];
      model.traverse(node => {
        if (node.userData.hoodHingeAuthored) hoodParts.push(node);
      });
      const hoods = hoodParts.map(part => {
        const pivot = new T.Group();
        pivot.position.fromArray(part.userData.hoodHingeAuthored);
        model.add(pivot);
        pivot.attach(part);
        return pivot;
      });
      const rig = createVehicleDamagePanels(T, {model, vehicle, hoods});
      const tag = vehicle+' LOD'+lod;
      const doorNode = model.getObjectByName(door);
      const glassNode = glass && model.getObjectByName(glass);
      const fixedNode = fixed && model.getObjectByName(fixed);
      const originals = [];
      model.traverse(node => { if (node.isMesh) originals.push([node, node.visible, node.geometry]); });
      rig.setDamage({hood: .9, leftDoor: .62, rightDoor: .68});
      assert.ok(hoods.length && hoods.every(pivot => !pivot.visible), tag);
      const left = model.getObjectByName(vehicle+'_leftDoor_DamageHinge');
      const right = model.getObjectByName(vehicle+'_rightDoor_DamageHinge');
      assert.ok(left?.children.length && left.rotation.y < 0, tag);
      assert.ok(right?.children.length && right.rotation.y > 0, tag);
      const isCopyOf = owner => copy => owner.children.some(mesh => mesh.isMesh && mesh.name === copy.name);
      assert.ok(left.children.some(isCopyOf(doorNode)), tag);
      assert.ok(!doorNode.children.some(mesh => mesh.isMesh && mesh === left.children[0]), tag);
      if (glassNode) assert.ok(left.children.some(isCopyOf(glassNode)), tag);
      if (fixedNode) assert.ok(fixedNode.children.every(mesh => mesh.visible), tag);
      if (vehicle === 'chevy_400_1957' || vehicle === 'chevy') {
        left.rotation.y = right.rotation.y = 0;
        model.updateWorldMatrix(true, true);
        const inverse = model.matrixWorld.clone().invert(), v = new T.Vector3();
        for (const pivot of vehicle === 'chevy' ? [left, right] : [left]) {
          for (const copy of pivot.children.filter(mesh =>
            isCopyOf(doorNode)(mesh) || (vehicle === 'chevy_400_1957' && isCopyOf(glassNode)(mesh)))) {
            const matrix = inverse.clone().multiply(copy.matrixWorld);
            const position = copy.geometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
              v.fromBufferAttribute(position, i).applyMatrix4(matrix);
              if (vehicle === 'chevy_400_1957') assert.ok(v.x <= .0391, tag);
              else {
                // Coarse LOD triangles can span the entire door seam and
                // should retain their fender or quarter-panel portions.
                assert.ok(v.x >= -.2191 && v.x <= .2151, tag);
                assert.ok(v.y >= -.1731 && v.y <= .1111, tag);
                assert.ok(Math.abs(v.z) >= .3049, tag);
              }
            }
          }
        }
      }
      rig.setDamage({});
      for (const [node, visible, geometry] of originals) {
        assert.equal(node.visible, visible, tag);
        assert.equal(node.geometry, geometry, tag);
      }
      assert.equal(left.parent, null, tag);
      assert.equal(right.parent, null, tag);
      rig.dispose();
    }
  }
});
