export const VIRTUAL_TERRAIN_SCHEMA = 'asfalto-virtual-terrain/1';
export const MAX_TERRAIN_PAGES = 32;
export const MAX_PAGE_TRIANGLES = 1280;
export const TERRAIN_DETAIL_SLOTS = 6;
export const TRIANGLE_BYTES = 48;
// The opaque canvas preserves three ID bytes. Vista keeps its resident-slot
// format. The joint pass needs a wider address for the authored triangles.
export const VISTA_OBJECT_SHIFT = 16;
export const VISTA_TRIANGLE_MASK = (1 << VISTA_OBJECT_SHIFT) - 1;
export const VISIBILITY_OBJECT_SHIFT = 21;
export const VISIBILITY_TRIANGLE_MASK = (1 << VISIBILITY_OBJECT_SHIFT) - 1;
export const GARIBALDI_TERRAIN_MANIFEST = Object.freeze({
  file: 'manifest.json', bytes: 15516, sha256: '0ecad55849022f171a9d3242fc597f8d7923a3db7a2955521248e1b1d9714551',
});

function requirePage(condition, reason) {
  if (!condition) throw new Error(`Geometría virtualizada: ${reason}.`);
}

function checkPayload(payload, name, triangles) {
  requirePage(payload?.file === name, 'nombre de página inválido');
  requirePage(Number.isInteger(payload.bytes) && payload.bytes >= 18 &&
    payload.bytes <= triangles * TRIANGLE_BYTES + 1024, 'tamaño comprimido inválido');
  requirePage(payload.decodedBytes === triangles * TRIANGLE_BYTES, 'tamaño de página inválido');
  requirePage(typeof payload.sha256 === 'string' && /^[a-f0-9]{64}$/.test(payload.sha256), 'huella inválida');
}

export function validateTerrainManifest(data) {
  requirePage(data?.schema === VIRTUAL_TERRAIN_SCHEMA, 'versión de página desconocida');
  requirePage(typeof data.source === 'string' && /^refine:[a-f0-9]{16}:\d+$/.test(data.source), 'origen inválido');
  requirePage(Array.isArray(data.pages) && data.pages.length > 0 && data.pages.length <= MAX_TERRAIN_PAGES,
    'cantidad de páginas inválida');
  let coarse = 0;
  let fine = 0;
  for (const [id, page] of data.pages.entries()) {
    requirePage(page?.id === id && page.coarseStart === coarse, 'páginas fuera de orden');
    requirePage(Number.isInteger(page.coarseCount) && Number.isInteger(page.fineCount) &&
      page.coarseCount > 0 && page.coarseCount <= page.fineCount && page.fineCount <= MAX_PAGE_TRIANGLES,
    'cantidad de triángulos inválida');
    requirePage(Array.isArray(page.bounds) && page.bounds.length === 6 && page.bounds.every(Number.isFinite) &&
      page.bounds.slice(0, 3).every((min, i) => min <= page.bounds[i + 3]), 'límites inválidos');
    requirePage(Number.isFinite(page.errorM) && page.errorM >= 0 && page.errorM <= 100, 'error geométrico inválido');
    if (page.coarseCount === page.fineCount) {
      requirePage(page.detail === null && page.errorM === 0, 'detalle redundante');
    } else {
      checkPayload(page.detail, `detail-${String(id).padStart(2, '0')}.vt.gz`, page.fineCount);
    }
    coarse += page.coarseCount;
    fine += page.fineCount;
  }
  requirePage(data.triangles === fine, 'origen incompleto');
  checkPayload(data.root, 'root.vt.gz', coarse);
  return data;
}

export function packTerrainNormal(x, y, z) {
  const sum = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
  let u = x / sum;
  let v = y / sum;
  if (z < 0) {
    const oldU = u;
    u = (1 - Math.abs(v)) * (u < 0 ? -1 : 1);
    v = (1 - Math.abs(oldU)) * (v < 0 ? -1 : 1);
  }
  return Math.round((u * .5 + .5) * 255) + 256 * Math.round((v * .5 + .5) * 255);
}

export function packTerrainTriangles(indices, position, normal) {
  const packed = new Float32Array(indices.length * 4);
  for (let i = 0; i < indices.length; i++) {
    const source = indices[i] * 3;
    const dest = i * 4;
    packed[dest] = position[source];
    packed[dest + 1] = position[source + 1];
    packed[dest + 2] = position[source + 2];
    packed[dest + 3] = packTerrainNormal(normal[source], normal[source + 1], normal[source + 2]);
  }
  return packed;
}

/** Select by projected error. A previously selected detail page has a lower exit threshold. */
export function selectTerrainDetail(visible, previous, capacity = TERRAIN_DETAIL_SLOTS) {
  return visible.filter(({page, pixels}) => page.detail && pixels >= (previous.has(page.id) ? .9 : 1.5))
    .sort((a, b) => b.pixels - a.pixels || a.page.id - b.page.id)
    .slice(0, capacity).map(({page}) => page.id);
}
