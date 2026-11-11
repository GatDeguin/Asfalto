import test from 'node:test';
import assert from 'node:assert/strict';
import {bakeTerrainMeshlets, buildMeshlets, meshletTree} from './build-terrain-meshlets.mjs?v=efb2df9b9dd6246f';
import {createMeshletCuller, installTerrainMeshletRanges, registerTerrainMeshlets} from '../src/render/terrain-meshlets.mjs?v=e25fb31f401ba6c9';

function terrain(width, height) {
  const positions = [];
  const indices = [];
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      positions.push(x, (x + z) % 4 / 10, z);
      const a = z * width + x;
      if (x < width - 1 && z < height - 1) indices.push(a, a + width, a + 1, a + 1, a + width, a + width + 1);
    }
  }
  return {positions: Float32Array.from(positions), indices: Uint16Array.from(indices)};
}

function plane(x, y, z, constant) {
  return {normal: {x, y, z}, constant};
}

function view(xMin, xMax, zMin, zMax) {
  return [plane(1, 0, 0, -xMin), plane(-1, 0, 0, xMax), plane(0, 1, 0, 2),
    plane(0, -1, 0, 2), plane(0, 0, 1, -zMin), plane(0, 0, -1, zMax)];
}

test('meshlets respect local limits and preserve the exact authored index sequence', () => {
  const {positions, indices} = terrain(31, 24);
  const data = buildMeshlets(positions, indices);
  assert.ok(data.meshlets.length > 4);
  for (let i = 0; i < data.meshlets.length; i += 4) {
    const [vertexStart, vertexCount, start, count] = data.meshlets.subarray(i, i + 4);
    assert.ok(vertexCount > 0 && vertexCount <= 64 && vertexStart + vertexCount <= data.vertices.length);
    assert.ok(count > 0 && count <= 124 * 3 && count % 3 === 0);
    for (const local of data.localIndices.subarray(start, start + count)) assert.ok(local < vertexCount);
  }
  assert.equal(meshletTree(data, indices).vertexCounts.length, data.meshlets.length / 4);
  assert.deepEqual(buildMeshlets(positions, indices), data);
  const invalid = {...data, localIndices: data.localIndices.slice()};
  invalid.localIndices[0] = 255;
  assert.throws(() => meshletTree(invalid, indices), /índice local/);
});

test('distributed meshlets cover only the measured Dos Lagos and Garibaldi terrain sheets', () => {
  const {positions, indices} = terrain(15, 10);
  const refinement = (region, targetEdgeM) => ({
    result: {region, targetEdgeM},
    geometry: {data: {attributes: {position: {array: positions.slice()}}, index: {array: indices.slice()}}},
  });
  const hero = refinement('paso_garibaldi', 48);
  const transition = refinement('paso_garibaldi', 70);
  const vista = refinement('paso_garibaldi', 130);
  const prior = structuredClone(hero);
  const garibaldi = {id: 'paso_garibaldi', entries: [['refine:transition', transition], ['refine:hero', hero], ['refine:vista', vista]]};
  const expected = meshletTree(buildMeshlets(positions, indices), indices);
  assert.deepEqual(bakeTerrainMeshlets(garibaldi), {key: 'refine:hero', meshlets: expected.vertexCounts.length, triangles: indices.length / 3});
  assert.deepEqual(hero, {...prior, terrainMeshlets: expected});
  assert.equal(transition.terrainMeshlets, undefined);
  assert.equal(vista.terrainMeshlets, undefined);

  const dosLagos = refinement('dos_lagos', 48);
  assert.equal(bakeTerrainMeshlets({id: 'dos_lagos', entries: [['refine:continuous', dosLagos]]}).key, 'refine:continuous');
  assert.deepEqual(dosLagos.terrainMeshlets, expected);
  for (const id of ['aconcagua_horcones', 'cuesta_lipan', 'cataratas_iguazu']) {
    const surface = refinement(id, 48);
    assert.equal(bakeTerrainMeshlets({id, entries: [['refine:terrain', surface]]}), null);
    assert.equal(surface.terrainMeshlets, undefined);
  }
});

test('views conservatively include intersecting meshlets and recover after an empty pass', () => {
  const {positions, indices} = terrain(41, 37);
  const data = buildMeshlets(positions, indices);
  const cull = createMeshletCuller(data);
  const out = new Uint32Array(2);
  assert.equal(cull(view(-2, 42, -2, 38), out), true);
  assert.deepEqual([...out], [0, indices.length]);
  assert.equal(cull(view(100, 110, 50, 60), out), false);

  for (const [xMin, xMax, zMin, zMax] of [[8, 19, 3, 27], [30, 40, 31, 36], [-1, 4, -1, 4]]) {
    assert.equal(cull(view(xMin, xMax, zMin, zMax), out), true);
    assert.ok(out[1] - out[0] < indices.length);
    for (let i = 0; i < data.nodes.length; i += 3) {
      const [start, end, right] = data.nodes.subarray(i, i + 3);
      if (right) continue;
      const [lx, , lz, hx, , hz] = data.bounds.subarray(i * 2, i * 2 + 6);
      if (hx < xMin || lx > xMax || hz < zMin || lz > zMax) continue;
      assert.ok(start >= out[0] && end <= out[1]);
    }
  }
});

function geometryFor(positions, indices) {
  return {index: {array: indices, count: indices.length, version: 0}, attributes: {position: {array: positions, version: 0}},
    groups: [], drawRange: {start: 0, count: Infinity}};
}

test('an incompatible or corrupt hierarchy falls back to the authored mesh', () => {
  const {positions, indices} = terrain(15, 10);
  const data = meshletTree(buildMeshlets(positions, indices), indices);
  assert.equal(registerTerrainMeshlets(geometryFor(positions, indices.subarray(3)), data), false);
  const brokenTree = {...data, nodes: data.nodes.slice()};
  brokenTree.nodes[2] = 1;
  assert.equal(registerTerrainMeshlets(geometryFor(positions, indices), brokenTree), false);
});

test('each camera draws a single bounded range and changed geometry uses the ordinary draw', () => {
  const {positions, indices} = terrain(31, 24);
  const geometry = geometryFor(positions, indices);
  assert.equal(registerTerrainMeshlets(geometry, meshletTree(buildMeshlets(positions, indices), indices)), true);
  const draws = [];
  const original = (_camera, _scene, _geometry, _material, _object, group) => draws.push(group ? {...group} : null);
  const renderer = {isWebGLRenderer: true, renderBufferDirect: original};
  const THREE = {
    Matrix4: class {multiplyMatrices(planes) {this.planes = planes; return this;} multiply() {return this;}},
    Frustum: class {setFromProjectionMatrix(matrix) {this.planes = matrix.planes;}},
  };
  const lease = installTerrainMeshletRanges(THREE, renderer);
  const render = planes => renderer.renderBufferDirect({projectionMatrix: planes}, {}, geometry, {}, {}, null);
  render(view(-2, 5, -2, 5));
  render(view(27, 31, 18, 24));
  render(view(40, 42, -2, 5));
  assert.equal(draws.length, 2);
  assert.ok(draws[0].start < draws[1].start);
  assert.ok(draws.every(draw => draw.count > 0 && draw.count < indices.length));
  assert.deepEqual(geometry.drawRange, {start: 0, count: Infinity});
  geometry.index.version++;
  render(view(-2, 5, -2, 5));
  assert.equal(draws.at(-1), null);
  lease.dispose();
  assert.equal(renderer.renderBufferDirect, original);
});
