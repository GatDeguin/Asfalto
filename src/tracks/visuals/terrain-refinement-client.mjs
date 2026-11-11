import {assetDecodePool} from '../../runtime/asset-decode-pool.mjs?v=1be266bf7b1e2d93';
import {installRefinedTerrain} from './terrain-refinement.mjs?v=8ac034d3920ac072';
import {refineTerrainSurfaceOriginal} from './terrain-refinement-solver.mjs?v=eeee2ed24d0fed64';
import {packTerrainGeometry, terrainTransferList, unpackTerrainGeometry} from './terrain-geometry-transport.mjs?v=1bd13edef21b4c5a';

export async function refineStreamedTerrain(THREE, mesh, options, {samples, lengthM, signal}) {
  signal?.throwIfAborted();
  const {roadField, ...parameters} = options;
  const source = mesh.geometry;
  const count = source.index?.count || source.attributes.position.count;
  if (count / 3 > parameters.maxTriangles || /^COLLISION_/i.test(mesh.name)) return null;
  const geometry = packTerrainGeometry(source, true);
  mesh.updateWorldMatrix(true, false);
  let output;
  try {
    const response = await assetDecodePool.run('terrain', {name: mesh.name, geometry,
      matrix: mesh.matrixWorld.elements, samples, lengthM, options: parameters},
    {signal, transfers: terrainTransferList(geometry)});
    output = response.output;
  } catch (error) {
    signal?.throwIfAborted();
    console.warn('[Lipán] Refinado local del terreno:', error?.message || error);
    return refineTerrainSurfaceOriginal(THREE, mesh, options);
  }
  signal?.throwIfAborted();
  return output ? installRefinedTerrain(THREE, mesh, unpackTerrainGeometry(THREE, output.geometry), output.result) : null;
}
