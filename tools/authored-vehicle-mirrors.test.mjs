import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {attachAuthoredMirrors} from '../src/render/authored-vehicle-mirrors.mjs?v=bf8a84d1ba17af31';
import {loadVehicleGeometry} from './vehicle-cabin-pilot-fixture.mjs?v=34e746db17e10157';

for (const lod of [0, 1, 2]) {
  test(`Chevrolet 400 LOD${lod} uses the same driver-side lens for live and passive views`, async () => {
    const root = new T.Group();
    root.add(await loadVehicleGeometry('chevy_400_1957', lod));
    const silver = root.getObjectByName('Details__26_Mirror_optical_silver').getObjectByProperty('isMesh', true);
    const chrome = root.getObjectByName('Details__03_Polished_chrome').getObjectByProperty('isMesh', true);
    const {geometry:originalGeometry, material:originalMaterial} = silver;
    const originalChrome = chrome.geometry;
    const feed = new T.MeshBasicMaterial();
    const mirrors = attachAuthoredMirrors(T, {root}, 'chevy_400_1957', {
      center: {glass: {material: feed}}, left: {glass: {material: feed}},
    });
    try {
      mirrors.setVisible(true);
      root.updateWorldMatrix(true, true);
      assert.ok(Array.isArray(silver.material), 'the original lens must draw the live feed');
      assert.equal(silver.material[0], originalMaterial);
      assert.equal(silver.material[1], feed);
      assert.equal(chrome.geometry, originalChrome);
      assert.equal(silver.geometry.index.count, originalGeometry.index.count);
      const triangles = geometry => {
        const triangles = [];
        for (let index = 0; index < geometry.index.count; index += 3) {
          triangles.push([0, 1, 2].map(offset => geometry.index.getX(index + offset)).join(','));
        }
        return triangles.sort();
      };
      assert.deepEqual(triangles(silver.geometry), triangles(originalGeometry));

      const {index, attributes:{position, uv}, groups} = silver.geometry;
      const point = new T.Vector3(), original = new T.Vector3();
      assert.equal(groups.length, 2);
      for (const {start, count, materialIndex} of groups) {
        assert.ok(count > 0 && count % 3 === 0);
        for (let i = start; i < start + count; i++) {
          const vertex = index.getX(i);
          point.fromBufferAttribute(position, vertex).applyMatrix4(silver.matrixWorld);
          original.fromBufferAttribute(originalGeometry.attributes.position, vertex).applyMatrix4(silver.matrixWorld);
          assert.equal(point.z > 0, materialIndex === 1);
          if (materialIndex === 1) {
            assert.ok(uv.getX(vertex) >= 0 && uv.getX(vertex) <= 1);
            assert.ok(uv.getY(vertex) >= 0 && uv.getY(vertex) <= 1);
            assert.ok(point.distanceTo(original) < .0002);
          } else assert.ok(point.distanceTo(original) < 1e-7);
        }
      }

      const driverEye = new T.Vector3(.22, .235, .158654915);
      const target = root.getObjectByName('AuthoredMirrorFace_left').getWorldPosition(new T.Vector3());
      const ray = new T.Raycaster(driverEye, target.sub(driverEye).normalize());
      const hit = ray.intersectObjects([silver, chrome])[0];
      assert.equal(hit?.object.name, silver.name);
      assert.equal(hit.face.materialIndex, 1);

      mirrors.setVisible(false);
      assert.equal(silver.geometry, originalGeometry);
      assert.equal(silver.material, originalMaterial);
      mirrors.setVisible(true);
    } finally {
      mirrors.dispose();
      feed.dispose();
    }
    assert.equal(silver.geometry, originalGeometry);
    assert.equal(silver.material, originalMaterial);
  });
}
