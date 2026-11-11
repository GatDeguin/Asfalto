import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gunzipSync, gzipSync} from 'node:zlib';
import {decodeBinaryBake} from '../src/tracks/visuals/bake-binary-codec.mjs';
import {MAX_PAGE_TRIANGLES, VIRTUAL_TERRAIN_SCHEMA, packTerrainTriangles, validateTerrainManifest}
  from '../src/render/virtual-terrain-data.mjs?v=09bc75160261c900';

const sourceKey = 'refine:655fc28c3c7222e4:1737255';
const meshoptDigest = 'b8fb6180d6ec894aa2a1a2b3c4415274f47e43d3f1fd5dc1c38177939f382db2';
const sha = buffer => createHash('sha256').update(buffer).digest('hex');

export function spatialTrianglePages(indices, position, maxTriangles = MAX_PAGE_TRIANGLES) {
  const centroids = new Float32Array(indices.length);
  for (let i = 0; i < indices.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      centroids[i + axis] = (position[indices[i] * 3 + axis] + position[indices[i + 1] * 3 + axis] +
        position[indices[i + 2] * 3 + axis]) / 3;
    }
  }
  const pages = [];
  function split(ids) {
    if (ids.length <= maxTriangles) {
      const page = new Uint32Array(ids.length * 3);
      for (const [i, id] of ids.entries()) page.set(indices.subarray(id * 3, id * 3 + 3), i * 3);
      pages.push(page);
      return;
    }
    const bounds = triangleBounds(ids, centroids);
    const axis = bounds[3] - bounds[0] >= bounds[5] - bounds[2] ? 0 : 2;
    ids.sort((a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis] || a - b);
    const middle = Math.floor(ids.length / 2);
    split(ids.slice(0, middle));
    split(ids.slice(middle));
  }
  split(Array.from({length: indices.length / 3}, (_, i) => i));
  return pages;
}

function triangleBounds(indices, position) {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const id of indices) for (let axis = 0; axis < 3; axis++) {
    const value = position[id * 3 + axis];
    bounds[axis] = Math.min(bounds[axis], value);
    bounds[axis + 3] = Math.max(bounds[axis + 3], value);
  }
  return bounds;
}

export function orientedBoundary(indices) {
  const edges = new Map();
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i + j];
    const b = indices[i + (j + 1) % 3];
    if (a === b) continue;
    const edge = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(edge, (edges.get(edge) || 0) + (a < b ? 1 : -1));
  }
  return [...edges].filter(([, count]) => count !== 0).map(([edge, count]) => `${edge}:${count}`).sort();
}

export async function readVistaBake() {
  const bytes = gunzipSync(await readFile(new URL('../assets/tracks/offline-bake/paso_garibaldi.bake.gz', import.meta.url)));
  const bake = decodeBinaryBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const source = bake.entries.find(([key]) => key === sourceKey)?.[1];
  if (source?.result?.region !== 'paso_garibaldi' || source.result.targetEdgeM !== 130) {
    throw new Error('No se encontró el terreno Vista de Paso Garibaldi en el bake.');
  }
  const {attributes, index} = source.geometry.data;
  return {position: attributes.position.array, normal: attributes.normal.array, indices: Uint32Array.from(index.array)};
}

export async function buildTerrainPages(meshoptPath, output = new URL('../assets/tracks/virtual-terrain/garibaldi/', import.meta.url)) {
  const tool = pathToFileURL(resolve(meshoptPath));
  if (sha(await readFile(tool)) !== meshoptDigest) throw new Error('Meshoptimizer v1.0: huella inesperada.');
  const {MeshoptSimplifier} = await import(tool.href);
  await MeshoptSimplifier.ready;
  const {position, normal, indices} = await readVistaBake();
  await mkdir(output, {recursive: true});
  const root = [];
  const pages = [];
  let coarseStart = 0;
  async function payload(file, buffer) {
    const gzip = gzipSync(buffer, {level: 9});
    const sha256 = sha(gzip);
    await writeFile(new URL(file, output), gzip);
    return {file, bytes: gzip.length, decodedBytes: buffer.length, sha256};
  }
  for (const [id, fine] of spatialTrianglePages(indices, position).entries()) {
    let [coarse, errorM] = MeshoptSimplifier.simplify(fine, position, 3, Math.max(3, Math.floor(fine.length / 10) * 3),
      35, ['LockBorder', 'ErrorAbsolute', 'Sparse']);
    // Pin the exact oriented seam, including external edges and any non-manifold input.
    if (coarse.length === fine.length || orientedBoundary(fine).join() !== orientedBoundary(coarse).join()) {
      coarse = fine;
      errorM = 0;
    }
    const coarseCount = coarse.length / 3;
    const fineCount = fine.length / 3;
    root.push(Buffer.from(packTerrainTriangles(coarse, position, normal).buffer));
    const detail = coarseCount === fineCount ? null :
      await payload(`detail-${String(id).padStart(2, '0')}.vt.gz`, Buffer.from(packTerrainTriangles(fine, position, normal).buffer));
    pages.push({id, coarseStart, coarseCount, fineCount, errorM, bounds: triangleBounds(fine, position), detail});
    coarseStart += coarseCount;
  }
  const manifest = validateTerrainManifest({schema: VIRTUAL_TERRAIN_SCHEMA, source: sourceKey,
    triangles: indices.length / 3, root: await payload('root.vt.gz', Buffer.concat(root)), pages});
  const encoded = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(new URL('manifest.json', output), encoded);
  return {pages: pages.length, fineTriangles: manifest.triangles, coarseTriangles: coarseStart,
    rootBytes: manifest.root.bytes, detailBytes: pages.reduce((total, p) => total + (p.detail?.bytes || 0), 0),
    manifestSha256: sha(encoded)};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Indicá la ubicación de meshopt_simplifier.mjs v1.0.');
  console.log(await buildTerrainPages(process.argv[2]));
}
