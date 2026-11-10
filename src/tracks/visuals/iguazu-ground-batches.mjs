const SECTOR_M=768;
const GROUND=/^(TERRAIN_\d+|(?:SHOULDER|VERGE|EDGE)_\d+_-?1|CENTER_\d+)$/;

// Pack the static visual sheets after the final terrain edits.
// Authored vertices, surface attributes and the independent collision GLB stay intact.
export function batchIguazuGround(T,root){
 const sectors=new Map();
 root.updateMatrixWorld(true);
 for(const owner of root.children){
  if(!GROUND.test(owner.name)||!owner.visible||owner.renderOrder!==0)continue;
  const mesh=owner.isMesh?owner:owner.children.length===1?owner.children[0]:null;
  if(!mesh?.isMesh||mesh.isInstancedMesh||mesh.children.length||!mesh.visible||!mesh.frustumCulled||!mesh.matrixWorld.equals(root.matrixWorld))continue;
  const {geometry,material}=mesh;
  if(!material?.isMaterial||material.transparent||geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||Object.keys(geometry.morphAttributes).length)continue;
  const names=Object.keys(geometry.attributes).sort();
  const count=geometry.attributes.position?.count;
  if(!count||names.some(name=>{
   const attribute=geometry.attributes[name];
   return !attribute.isBufferAttribute||attribute.isInstancedBufferAttribute||attribute.count!==count;
  }))continue;
  geometry.computeBoundingBox();
  const {min,max}=geometry.boundingBox;
  const x=Math.floor((min.x+max.x)/(2*SECTOR_M)),z=Math.floor((min.z+max.z)/(2*SECTOR_M));
  const layout=names.map(name=>{
   const a=geometry.attributes[name];
   return `${name}:${a.array.constructor.name}:${a.itemSize}:${a.normalized}:${a.gpuType}`;
  }).join(',');
  const key=[owner.name.split('_')[0],x,z,material.uuid,mesh.castShadow,mesh.receiveShadow,mesh.layers.mask,mesh.renderOrder,layout].join('|');
  if(!sectors.has(key))sectors.set(key,[]);
  sectors.get(key).push({owner,mesh,names,count});
 }

 const retired=new Set();let sourceMeshes=0,batches=0;
 for(const entries of sectors.values()){
  if(entries.length<2)continue;
  const first=entries[0],geometry=new T.BufferGeometry();
  const vertices=entries.reduce((sum,e)=>sum+e.count,0);
  const indexCount=entries.reduce((sum,e)=>sum+(e.mesh.geometry.index?.count??e.count),0);
  const indices=vertices<65536?new Uint16Array(indexCount):new Uint32Array(indexCount);
  for(const name of first.names){
   const attribute=first.mesh.geometry.attributes[name];
   const packed=new T.BufferAttribute(new attribute.array.constructor(vertices*attribute.itemSize),attribute.itemSize,attribute.normalized);
   packed.gpuType=attribute.gpuType;
   geometry.setAttribute(name,packed);
  }
  let vertex=0,nextIndex=0;
  for(const {mesh,names,count} of entries){
   const original=mesh.geometry,index=original.index;
   for(const name of names){
    const source=original.attributes[name];
    geometry.attributes[name].array.set(source.array,vertex*source.itemSize);
   }
   for(let i=0;i<(index?.count??count);i++)indices[nextIndex++]=vertex+(index?index.getX(i):i);
   vertex+=count;
  }
  geometry.setIndex(new T.BufferAttribute(indices,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const packed=new T.Mesh(geometry,first.mesh.material);
  packed.name=first.owner.name.split('_')[0]+'_BATCH_'+batches;
  packed.receiveShadow=first.mesh.receiveShadow;packed.castShadow=first.mesh.castShadow;
  packed.layers.mask=first.mesh.layers.mask;packed.renderOrder=first.mesh.renderOrder;
  root.add(packed);
  for(const {owner,mesh} of entries){owner.removeFromParent();retired.add(mesh.geometry);}
  sourceMeshes+=entries.length;batches++;
 }
 if(retired.size){
  root.traverse(mesh=>retired.delete(mesh.geometry));
  for(const geometry of retired)geometry.dispose();
 }
 return {sourceMeshes,batches};
}
