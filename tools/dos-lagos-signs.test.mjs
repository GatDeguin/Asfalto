import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { THREE as T } from './cinematic-three.mjs';
import { readCircuitSource } from './fixtures/closed-circuit-source.mjs';
import { decodeGlbDocument, parseGlbContainer } from '../src/runtime/glb-decode-worker.mjs?v=4e5a55f83b79f7c1';
import { makeGlbAttribute } from '../src/runtime/glb-accessors.mjs';
import { createRouteQuery } from '../src/tracks/route-query.mjs';
import { addDosLagosPostSupport } from '../src/tracks/visuals/dos-lagos-post-support.mjs?v=18ce66c786808c77';
import { prepareDosLagosSigns } from '../src/tracks/visuals/dos-lagos-signs.mjs?v=fe86c890cfd4a00a';
import { terrainHeightSampler } from '../src/tracks/visuals/reference-landscape.mjs?v=30a528c61c10745d';

const name = 'ASFALTO_DOS_LAGOS_AUTHORED_SIGNS';

test('Dos Lagos replaces the authored plates with five grounded identifications facing traffic', async () => {
  const bytes = await readFile(new URL('../tracks/dos-lagos/scene.glb', import.meta.url));
  const decodedDocument = await decodeGlbDocument(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const root = await globalThis.AsfaltoV5GlbCore.completeGlbToObject(T, bytes, 'Dos Lagos', {
    decodedDocument, parseGlb: parseGlbContainer, makeAttribute: makeGlbAttribute, textureFromInfo: () => null,
  });
  const source = readCircuitSource('dos_lagos');
  const query = createRouteQuery(source);
  const options = { THREE: T, query, heightAt: terrainHeightSampler(T, root) };
  const ground = terrainHeightSampler(T, root, mesh => mesh.name.startsWith('ROAD_Shoulder_')).raw;
  const legacy = [], guards = [];
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (/^(SIGN_P[1-8]_|PROP_SignPosts_)/.test(mesh.name)) legacy.push(mesh);
    if (mesh.name.startsWith('PROP_Guardrail_')) guards.push([mesh, mesh.geometry]);
  });
  assert.equal(legacy.length, 9);
  assert.equal(guards.length, 2);

  const signs = prepareDosLagosSigns(root, options);
  assert.deepEqual(signs.map(sign => [sign.sM, sign.kind, sign.name.replace('\n', ' ')]), [
    [365, 'place', 'Lago Villarino'], [4825, 'place', 'Balcón de Dos Aguas'],
    [5245, 'place', 'Cruce del canal'], [6095, 'place', 'Lago Falkner'],
    [10195, 'place', 'Mirador Viento Sur'],
  ]);
  assert.ok(legacy.every(mesh => !mesh.visible && mesh.parent));
  for (const [mesh, geometry] of guards) {
    assert.ok(mesh.visible);
    assert.equal(mesh.geometry, geometry);
  }
  assert.equal(prepareDosLagosSigns(root, options), signs);

  root.updateMatrixWorld(true);
  const faces = root.getObjectByName(name + '_FACES');
  const supports = root.getObjectByName(name + '_SUPPORTS');
  assert.equal(faces.userData.collision, false);
  assert.equal(supports.userData.collision, false);
  assert.equal(supports.count, 9);
  const positions = faces.geometry.attributes.position;
  const position = index => new T.Vector3().fromBufferAttribute(positions, index).applyMatrix4(faces.matrixWorld);
  const matrix = new T.Matrix4();
  let supportIndex = 0;
  signs.forEach((sign, index) => {
    const start = index * 24;
    const plate = [0, 1, 2, 3].map(offset => position(start + offset));
    const normal = new T.Triangle(...plate.slice(0, 3)).getNormal(new T.Vector3());
    const center = new T.Box3().setFromPoints(plate).getCenter(new T.Vector3());
    const approach = query.sample(sign.sM - 32);
    const driver = new T.Vector3(...approach.position).addScaledVector(new T.Vector3(...approach.frame.left), 1.7);
    assert.ok(normal.dot(driver.sub(center).normalize()) > .9, sign.name);
    for (const corner of plate) {
      const projection = query.project(corner.toArray());
      assert.ok(projection.distanceXZ - projection.widthM / 2 > .15, sign.name);
    }
    const posts = index === signs.length - 1 ? 1 : 2;
    for (let post = 0; post < posts; post++) {
      supports.getMatrixAt(supportIndex++, matrix);
      matrix.premultiply(supports.matrixWorld);
      for (const x of [-.5, .5]) for (const z of [-.5, .5]) {
        const foot = new T.Vector3(x, -.5, z).applyMatrix4(matrix);
        const top = new T.Vector3(x, .5, z).applyMatrix4(matrix);
        assert.ok(foot.y <= ground(foot.x, foot.z) - .08, `${sign.name} footing`);
        assert.ok(normal.dot(top.sub(center)) < -.02, `${sign.name} post behind plate`);
      }
    }
  });
});

test('Dos Lagos omits pads for retired sign posts while supporting visible guardrails', () => {
  const root = new T.Group(), material = new T.MeshStandardMaterial();
  const add = (name, geometry, x, y, z) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  add('TERRAIN_cut', new T.PlaneGeometry(60, 30).rotateX(-Math.PI / 2), 20, 0, 0);
  add('ROAD_Shoulder_L', new T.PlaneGeometry(50, 1).rotateX(-Math.PI / 2), 20, 10, 4);
  add('PROP_Guardrail_Posts_Primitive_0', new T.BoxGeometry(.1, 1, .15), 20, 10.5, 5);
  add('PROP_SignPosts_Primitive_0', new T.BoxGeometry(.1, 2, .15), 24, 11, 5).visible = false;
  const query = {
    project: ([x, , z]) => ({ sM: x, lateralM: z }),
    sample: x => ({ position: [x, 10, 0], widthM: 7, frame: { left: [0, 0, 1] } }),
  };
  assert.deepEqual(addDosLagosPostSupport(T, root, query, 60), { feet: 1, pads: 1 });
});
