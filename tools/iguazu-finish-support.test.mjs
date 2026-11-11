import assert from 'node:assert/strict';
import test from 'node:test';
import {THREE as T} from './cinematic-three.mjs';
import {reseatIguazuFinishPlants} from '../src/tracks/visuals/iguazu-landscape.mjs?v=f0712ba4b9d1ee26';

function finishFixture(regraded) {
  const root = new T.Group();
  const surface = new T.PlaneGeometry(20, 20).rotateX(-Math.PI / 2);
  const ground = new T.MeshBasicMaterial();
  for (const side of [-1, 1]) {
    const owner = new T.Group();
    if (regraded || side < 0) owner.userData.iguazuFinishRegrade = 1;
    const bank = new T.Mesh(surface, ground);
    bank.name = `APPROACH_FINISH_TERRAIN_${side}`;
    bank.position.set(side * 15, 3, 0);
    owner.add(bank);
    root.add(owner);
  }
  const family = 'APPROACH_FINISH_CANOPY_tree_';
  const trunk = new T.InstancedMesh(new T.BoxGeometry(1, 2, 1), new T.MeshBasicMaterial({name:'MAT_bark'}), 2);
  const crown = new T.InstancedMesh(new T.BoxGeometry(3, 3, 3), new T.MeshBasicMaterial({name:'MAT_leaf'}), 2);
  trunk.name = family + '0';
  crown.name = family + '1';
  const matrix = new T.Matrix4();
  for (const [i, x] of [15, 150].entries()) {
    trunk.setMatrixAt(i, matrix.makeScale(1, 2, 1).setPosition(x, 12, 2));
    crown.setMatrixAt(i, matrix.makeTranslation(x + .2, 18, 2));
  }
  root.add(trunk, crown);
  function position(mesh, i) {
    mesh.getMatrixAt(i, matrix);
    return matrix.elements.slice(12, 15);
  }
  return {root, trunk, crown, position};
}

test('Iguazú seats trees and crowns together on mounted terrain', () => {
  const {root, trunk, crown, position} = finishFixture(true);
  const previousCrown = position(crown, 0);
  const details = reseatIguazuFinishPlants(T, root);
  const base = position(trunk, 0);
  const canopy = position(crown, 0);
  assert.deepEqual([details.supported, details.unsupported], [1, 1]);
  assert.deepEqual([base[0], base[2]], [15, 2]);
  assert.deepEqual([canopy[0], canopy[2]], [previousCrown[0], previousCrown[2]]);
  assert.ok(Math.abs(base[1] - 2 - 2.94) < 1e-5);
  assert.ok(Math.abs(canopy[1] - base[1] - 6) < 1e-5);
  assert.deepEqual(position(trunk, 1), [150, 12, 2]);
  assert.ok(trunk.boundingSphere?.radius > 0);
  assert.ok(crown.boundingBox?.containsPoint(new T.Vector3(...canopy)));
  reseatIguazuFinishPlants(T, root);
  assert.deepEqual(position(trunk, 0), base);
  assert.deepEqual(position(crown, 0), canopy);
});

test('Iguazú retains procedural plant placements if the pair of authored banks is unavailable', () => {
  const {root, trunk, crown, position} = finishFixture(false);
  assert.equal(reseatIguazuFinishPlants(T, root), null);
  assert.deepEqual(position(trunk, 0), [15, 12, 2]);
  assert.ok(Math.abs(position(crown, 0)[1] - 18) < 1e-6);
  assert.equal(root.userData.asfaltoIguazuFinish, undefined);
});
