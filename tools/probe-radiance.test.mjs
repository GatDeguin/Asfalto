import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {gunzipSync} from 'node:zlib';
import {buildRayBvh, traceRayBvh} from '../src/render/ray-bvh.mjs?v=700ea4faa3d0c8a6';
import {packProbeProxies, placeProbeGrid, PROBE_PRESETS} from '../src/render/probe-radiance-input.mjs?v=83e589831e106c72';
import {collectRayGeometry} from '../src/render/ray-geometry.mjs?v=47261d3fc43d50df';
import {createProbeMaterialBridge} from '../src/render/probe-radiance-materials.mjs?v=d7845f767a27abe5';

let three;
function loadThree() {
  return three ??= readFile(new URL('../assets/manifests/workshop-bootstrap.json', import.meta.url), 'utf8').then(text => {
    const source = gunzipSync(Buffer.from(JSON.parse(text).threeCoreGz, 'base64'));
    return import('data:text/javascript;base64,' + source.toString('base64'));
  });
}

test('BVH leaf reordering keeps the surface color with each exact triangle', () => {
  const vertices = new Float32Array(Array.from({length: 8}, (_, index) => {
    const x = 7 - index;
    return [x, 0, 0, x, 1, 0, x, 0, 1];
  }).flat());
  const colors = new Float32Array(Array.from({length: 8}, (_, index) => [index / 8, .25, .5]).flat());
  const result = buildRayBvh(vertices, colors);
  assert.equal(traceRayBvh(result, [-2, .2, .2], [1, 0, 0]), 2);
  for (let offset = 0; offset < result.triangles.length; offset += 12) {
    const triangle = result.triangles.subarray(offset, offset + 12);
    assert.deepEqual([triangle[3], triangle[7], triangle[11]], [(7 - triangle[0]) / 8, .25, .5]);
  }
});

test('grid placement is anchored to the track and field memory is bounded', () => {
  const {spacing, size, height, bytes} = PROBE_PRESETS.balanced;
  const first = placeProbeGrid([.2, 9.1, -1.1], PROBE_PRESETS.balanced);
  const second = placeProbeGrid([.3, 9.15, -1.2], PROBE_PRESETS.balanced);
  assert.deepEqual(first, second);
  assert.equal(first.origin[1], 9.5);
  assert.deepEqual(first.extent, [(size - 1) * spacing, height, (size - 1) * spacing]);
  assert.equal(bytes, size * size * 2 * 7 * 4);
  assert.ok(PROBE_PRESETS.high.bytes <= 2048);
});

test('SDF input gives nearby traffic priority, rejects invalid proxies and packs local coordinates', () => {
  const red = {center: [2, 5, 6], halfExtent: [1, .5, 2], rotation: [0, 0, 0, 2], color: [1, .1, .2]};
  const offGrid = {...red, center: [400, 5, 6]};
  const invalid = {...red, halfExtent: [NaN, .5, 2]};
  const packed = packProbeProxies({dynamic: [red, invalid], fixed: [offGrid, red]}, [0, 5, 0], 20, 8);
  assert.equal(packed.count, 2);
  assert.equal(packed.dynamicCount, 1);
  assert.deepEqual(Array.from(packed.data.slice(0, 3)), [2, 0, 6]);
  assert.equal(packed.data[7], 1);
  assert.deepEqual(Array.from(packed.data.slice(8, 12)), [0, 0, 0, 1]);
  assert.equal(packed.data[23], 0);
  assert.ok(packed.data[3] > 0 && packed.data[3] < .5);
});

test('colored capture preserves the exact world-space triangle, ignores glass and stops on cancellation', async () => {
  const T = await loadThree();
  const scene = new T.Group(), geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 2, 0, 0, 0, 2], 3));
  const red = new T.Mesh(geometry, new T.MeshStandardMaterial({color: 0xff0000}));
  red.position.x = 2;
  scene.add(red, new T.Mesh(geometry, new T.MeshPhysicalMaterial({transmission: 1})));
  const snapshot = await collectRayGeometry(T, scene, new T.Vector3(1, 0, 0), {surfaceColors: true, maxTriangles: 8});
  assert.deepEqual([...snapshot.vertices], [1, 0, 0, 1, 2, 0, 1, 0, 2]);
  assert.deepEqual([...snapshot.colors], [1, 0, 0]);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(collectRayGeometry(T, scene, new T.Vector3(), {surfaceColors: true, signal: abort.signal}), {name: 'AbortError'});
});

test('one atlas and shader patch are reused across updates and released on stop', async () => {
  const T = await loadThree();
  const root = new T.Group();
  const material = new T.MeshStandardMaterial();
  const other = new T.MeshStandardMaterial({transparent: true});
  root.add(new T.Mesh(new T.BoxGeometry(), material), new T.Mesh(new T.BoxGeometry(), other));
  const original = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  const bridge = createProbeMaterialBridge(T);
  assert.equal(bridge.setReceivers([root]), true);
  assert.equal(bridge.setReceivers([root]), false);
  assert.equal(bridge.diagnostics().materialCount, 1);
  const shader = {uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: '#include <aomap_fragment>'};
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /indirectDiffuse \+=/);
  assert.match(shader.fragmentShader, /indirectSpecular = mix/);
  const preset = PROBE_PRESETS.balanced;
  const grid = placeProbeGrid([0, 0, 0], preset);
  bridge.publish(grid, preset.size, new Uint8Array(preset.bytes).fill(64));
  const texture = shader.uniforms.anProbeAtlas.value;
  bridge.publish(grid, preset.size, new Uint8Array(preset.bytes).fill(128));
  assert.equal(shader.uniforms.anProbeAtlas.value, texture);
  assert.equal(texture.image.data[0], 110);
  bridge.invalidate();
  assert.equal(shader.uniforms.anProbeStrength.value, 0);
  assert.equal(shader.uniforms.anProbeAtlas.value, texture);
  assert.equal(bridge.setReceivers([root]), false);
  let releases = 0;
  texture.addEventListener('dispose', () => releases++);
  bridge.clear();
  assert.equal(releases, 1);
  assert.equal(bridge.diagnostics().textureBytes, 0);
  assert.equal(material.onBeforeCompile, original);
  assert.equal(material.customProgramCacheKey, key);
});
