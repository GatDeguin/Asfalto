/** Batch fixed room props in world coordinates. Imported objects remain available for camera constraints. */
export function createWorkshopStaticBatches(T,scene,roots) {
 const group=new T.Group();group.name='Workshop_Static_Batches';const buckets=new Map(),changed=[],owned=[],bounds=new T.Box3(),center=new T.Vector3(),size=new T.Vector3();let disposed=false;
 const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 for(const root of roots){root.updateWorldMatrix(true,true);root.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh||object.isSkinnedMesh||Array.isArray(object.material)||!visible(object)||!object.geometry?.attributes.position)return;
  const mat=object.material;if(!mat||mat.transparent||mat.transmission>0||/Glass|Fluorescent|Emission/i.test(mat.name)||Object.keys(object.geometry.morphAttributes||{}).length)return;
  bounds.setFromObject(object);bounds.getCenter(center);bounds.getSize(size);const fine=Math.max(size.x,size.y,size.z)<.28,cell=fine?`${Math.floor(center.x/3)},${Math.floor(center.z/3)}`:'room';
  const attributes=Object.keys(object.geometry.attributes).filter(k=>k!=='tangent').sort();const key=[mat.uuid,object.castShadow,object.receiveShadow,attributes.map(k=>k+object.geometry.attributes[k].itemSize).join(','),fine,cell].join('|');
  if(!buckets.has(key))buckets.set(key,{mat,cast:object.castShadow,receive:object.receiveShadow,attributes,objects:[],fine});buckets.get(key).objects.push(object);
 });}
 for(const bucket of buckets.values()){
  const pieces=bucket.objects.map(object=>{let g=object.geometry.clone();g.deleteAttribute('tangent');g.applyMatrix4(object.matrixWorld);if(g.index){const indexed=g;g=indexed.toNonIndexed();indexed.dispose();}return g;});
  const merged=new T.BufferGeometry();for(const name of bucket.attributes){const itemSize=pieces[0].attributes[name].itemSize,count=pieces.reduce((n,g)=>n+g.attributes[name].count,0),data=new Float32Array(count*itemSize);let offset=0;for(const piece of pieces){const attr=piece.attributes[name];for(let i=0;i<attr.count;i++)for(let j=0;j<itemSize;j++)data[offset++]=attr.getComponent(i,j);}merged.setAttribute(name,new T.BufferAttribute(data,itemSize));}
  pieces.forEach(g=>g.dispose());merged.computeBoundingBox();merged.computeBoundingSphere();owned.push(merged);
  const mesh=new T.Mesh(merged,bucket.mat);mesh.name='Workshop_Batch_'+bucket.mat.name;mesh.castShadow=bucket.cast;mesh.receiveShadow=bucket.receive;mesh.userData.fineProp=bucket.fine;mesh.userData.center=merged.boundingSphere.center.clone();group.add(mesh);
  for(const object of bucket.objects){changed.push([object,object.visible]);object.visible=false;}
 }
 scene.add(group);
 return {group,update(camera,{forceAll=false}={}){if(disposed||!camera?.position)return;const p=camera.getWorldPosition?camera.getWorldPosition(center):camera.position;for(const mesh of group.children)mesh.visible=forceAll||!mesh.userData.fineProp||p.distanceTo(mesh.userData.center)<11;},diagnostics:()=>({sourceMeshes:changed.length,batches:group.children.length,fineBatches:group.children.filter(m=>m.userData.fineProp).length,triangles:owned.reduce((n,g)=>n+g.attributes.position.count/3,0),disposed}),dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const[o,v]of changed)o.visible=v;owned.forEach(g=>g.dispose());}};
}
