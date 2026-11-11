import {bakeRead,bakeWrite,bakeGeometryInput} from './offline-track-bake.mjs?v=6f7a9d7b48d68a4c';
import {registerTerrainMeshlets} from '../../render/terrain-meshlets.mjs?v=e25fb31f401ba6c9';
import {refineTerrainSurfaceOriginal, terrainRefinementIdentity} from './terrain-refinement-solver.mjs?v=eeee2ed24d0fed64';

/** Adjacent Dos Lagos tiles are one continuous sheet, not independent cliffs. */
export function joinTerrainTiles(THREE,root,meshes){
  if(meshes.length<2)return meshes[0]||null;
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),point=new THREE.Vector3();
  const positions=[],colors=[],indices=[];let colorSize=meshes[0].geometry.attributes.color?.itemSize||0;
  if(meshes.some(m=>(m.geometry.attributes.color?.itemSize||0)!==colorSize))colorSize=0;
  for(const mesh of meshes){
    const g=mesh.geometry,p=g.attributes.position,c=g.attributes.color,offset=positions.length/3;
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);positions.push(point.x,point.y,point.z);if(colorSize)for(let k=0;k<colorSize;k++)colors.push(c.getComponent(i,k));}
    for(let i=0;i<(g.index?.count||p.count);i++)indices.push(offset+(g.index?g.index.getX(i):i));
    mesh.userData.asfaltoReplacedTerrain=true;g.setDrawRange(0,0);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  if(colorSize)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,colorSize));
  geometry.computeVertexNormals();const joined=new THREE.Mesh(geometry,meshes[0].material);joined.name='ASFALTO_CONTINUOUS_TERRAIN';joined.receiveShadow=true;root.add(joined);return joined;
}

export function installRefinedTerrain(THREE, mesh, geometry, result) {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const owner = new THREE.Mesh(mesh.geometry, mesh.material);
  owner.name = 'ASFALTO_TERRAIN_SOURCE_OWNER';
  owner.visible = false;
  mesh.add(owner);
  mesh.geometry = geometry;
  return mesh.userData.asfaltoTerrainRefinement = Object.freeze({...result});
}

export function refineTerrainSurface(THREE,mesh,options={},refineMissing){
  if(!mesh?.isMesh||!mesh.geometry?.attributes?.position||!options.roadField?.bakeSignature||mesh.userData.asfaltoTerrainRefinement)return refineTerrainSurfaceOriginal(THREE,mesh,options);
  const {roadField,...rest}=options;
  const key='refine:'+bakeGeometryInput(mesh,[rest,roadField.bakeSignature,THREE.REVISION,terrainRefinementIdentity]);
  const saved=bakeRead(key);
  if(saved){
    try{
      const geometry=new THREE.BufferGeometryLoader().parse(saved.geometry);
      if(!geometry.attributes.position||!geometry.attributes.normal)throw Error('invalid baked geometry');
      geometry.userData.asfaltoBakeKey=key;
      if(saved.terrainMeshlets)registerTerrainMeshlets(geometry,saved.terrainMeshlets);
      return installRefinedTerrain(THREE,mesh,geometry,saved.result);
    }catch{} // A stale or malformed optional artifact uses the authored path.
  }
  if(refineMissing&&!globalThis.__ASFALTO_CAPTURE_BAKE__)return refineMissing(THREE,mesh,options);
  const result=refineTerrainSurfaceOriginal(THREE,mesh,options);
  if(result&&globalThis.__ASFALTO_CAPTURE_BAKE__){const geometry=mesh.geometry.toJSON();delete geometry.uuid;bakeWrite(key,{geometry,result});}return result;
}
