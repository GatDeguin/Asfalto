import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync, gzipSync} from 'node:zlib';
import {BAKE_SCHEMA, decodeBinaryBake, encodeBinaryBake} from '../src/tracks/visuals/bake-binary-codec.mjs';
import {TERRAIN_MESHLET_MAX_VERTICES, TERRAIN_MESHLET_MAX_TRIANGLES} from '../src/render/terrain-meshlets.mjs?v=e25fb31f401ba6c9';

// Subdivide the authored triangle order, preserving its locality and winding.
// Leaves share the authored vertices through a byte-sized local index stream.
export function buildMeshlets(positions, indices) {
  if (!positions.length || positions.length % 3 || !indices.length || indices.length % 3) {
    throw new RangeError('Expected positions and indexed triangles');
  }
  const vertexCount = positions.length / 3;
  if (indices.some(value => !Number.isInteger(value) || value < 0 || value >= vertexCount)) throw new RangeError('Index outside the vertex buffer');
  if (positions.some(value => !Number.isFinite(value))) throw new TypeError('Non-finite vertex position');

  const localIndices = new Uint8Array(indices.length);
  const vertices = new Uint32Array(indices.length);
  const stamps = new Uint32Array(vertexCount);
  const localId = new Uint8Array(vertexCount);
  const meshlets = [], nodes = [], bounds = [];
  let stamp = 0, indexEnd = 0, vertexEnd = 0;

  function emitMeshlet(begin, end) {
    stamp++;
    let nextVertex = vertexEnd, nextIndex = indexEnd;
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = begin * 3; i < end * 3; i++) {
      const vertex = indices[i];
      if (stamps[vertex] !== stamp) {
        if (nextVertex - vertexEnd === TERRAIN_MESHLET_MAX_VERTICES) return null;
        stamps[vertex] = stamp;
        localId[vertex] = nextVertex - vertexEnd;
        vertices[nextVertex++] = vertex;
        for (let axis = 0; axis < 3; axis++) {
          const value = positions[vertex * 3 + axis];
          box[axis] = Math.min(box[axis], value);
          box[axis + 3] = Math.max(box[axis + 3], value);
        }
      }
      localIndices[nextIndex++] = localId[vertex];
    }
    meshlets.push(vertexEnd, nextVertex - vertexEnd, indexEnd, nextIndex - indexEnd);
    indexEnd = nextIndex;
    vertexEnd = nextVertex;
    return box;
  }

  function split(begin, end) {
    const node = nodes.length / 3;
    nodes.push(indexEnd, 0, 0);
    bounds.push(0, 0, 0, 0, 0, 0);
    let box = end - begin <= TERRAIN_MESHLET_MAX_TRIANGLES ? emitMeshlet(begin, end) : null;
    if (!box) {
      const middle = begin + Math.floor((end - begin) / 2);
      const left = split(begin, middle);
      nodes[node * 3 + 2] = nodes.length / 3;
      const right = split(middle, end);
      box = [Math.min(left[0], right[0]), Math.min(left[1], right[1]), Math.min(left[2], right[2]),
        Math.max(left[3], right[3]), Math.max(left[4], right[4]), Math.max(left[5], right[5])];
    }
    nodes[node * 3 + 1] = indexEnd;
    for (let j = 0; j < 6; j++) bounds[node * 6 + j] = box[j];
    return box;
  }

  split(0, indices.length / 3);
  return {meshlets: Uint32Array.from(meshlets), vertices: vertices.slice(0, vertexEnd), localIndices,
    nodes: Uint32Array.from(nodes), bounds: Float32Array.from(bounds)};
}

export function meshletTree(layout, authoredIndices) {
  const {meshlets, vertices, localIndices, nodes, bounds} = layout;
  const vertexCounts = new Uint8Array(meshlets.length / 4);
  for (let i = 0; i < vertexCounts.length; i++) {
    const [vertexStart, vertexCount, start, count] = meshlets.subarray(i * 4, i * 4 + 4);
    vertexCounts[i] = vertexCount;
    for (let j = start; j < start + count; j++) {
      assert.ok(localIndices[j] < vertexCount && vertices[vertexStart + localIndices[j]] === authoredIndices[j],
        'El índice local debe reconstruir el índice original');
    }
  }
  return {nodes, bounds, vertexCounts};
}

function copyViews(value) {
  if (ArrayBuffer.isView(value)) return value.slice();
  if (Array.isArray(value)) return value.map(copyViews);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyViews(item)]));
  return value;
}

const measuredTerrain = new Map([
  ['dos_lagos', () => true],
  // Garibaldi's HERO sheet uses the 48 m refinement. Transition and vista use 70 m and 130 m.
  ['paso_garibaldi', result => result.targetEdgeM === 48],
]);

export function bakeTerrainMeshlets(payload) {
  const select = measuredTerrain.get(payload.id);
  if (!select) return null;
  const refined = payload.entries.filter(([key, value]) =>
    key.startsWith('refine:') && value.result?.region === payload.id && select(value.result));
  assert.equal(refined.length, 1, `Se espera una malla de terreno medida para ${payload.id}`);
  const [key, value] = refined[0];
  const {attributes, index, groups} = value.geometry.data;
  assert.ok(index && !groups?.length, 'Se espera terreno indexado sin grupos de material');
  const layout = buildMeshlets(attributes.position.array, index.array);
  value.terrainMeshlets = meshletTree(layout, index.array);
  return {key, meshlets: layout.meshlets.length / 4, triangles: index.array.length / 3};
}

export function bakeDosLagosMeshlets(payload) {
  assert.equal(payload.id, 'dos_lagos');
  return bakeTerrainMeshlets(payload);
}

function compileTrack(sourceDirectory, outputDirectory, id) {
  assert.ok(measuredTerrain.has(id), `No hay una malla de terreno medida para ${id}`);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceDirectory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schema, BAKE_SCHEMA);
  const entry = manifest.tracks[id];
  assert.equal(entry.file, `${id}.bake.gz`);
  const source = fs.readFileSync(path.join(sourceDirectory, entry.file));
  assert.equal(source.length, entry.bytes);
  assert.equal(hash(source), entry.sha256);
  const bytes = Uint8Array.from(gunzipSync(source));
  assert.equal(bytes.length, entry.decodedBytes);
  const payload = copyViews(decodeBinaryBake(bytes.buffer));
  assert.equal(payload.id, id);
  assert.equal(payload.entries.length, entry.entries);
  const summary = bakeTerrainMeshlets(payload);
  const encoded = encodeBinaryBake(payload);
  assert.deepEqual(decodeBinaryBake(encoded.slice(0)), payload);
  const compressed = gzipSync(new Uint8Array(encoded), {level: 9});
  manifest.tracks[id] = {...entry, bytes: compressed.length, decodedBytes: encoded.byteLength, sha256: hash(compressed)};
  for (const file of ['src/tracks/visuals/terrain-refinement.mjs?v=95030aee7f9229d2', 'src/render/terrain-meshlets.mjs?v=e25fb31f401ba6c9', 'tools/build-terrain-meshlets.mjs']) {
    manifest.inputs[file] = hash(fs.readFileSync(new URL(`../${file}`, import.meta.url)));
  }
  fs.mkdirSync(outputDirectory, {recursive: true});
  fs.writeFileSync(path.join(outputDirectory, entry.file), compressed);
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({...summary,
    beforeBytes: source.length, afterBytes: compressed.length, beforeDecodedBytes: entry.decodedBytes, decodedBytes: encoded.byteLength}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, output, id = 'dos_lagos'] = process.argv.slice(2);
  assert.ok(source && output, 'Uso: node tools/build-terrain-meshlets.mjs <bake de origen> <directorio de salida> [circuito]');
  compileTrack(source, output, id);
}
