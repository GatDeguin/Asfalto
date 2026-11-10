/** Shared-resource scene copies. Each copy owns only nodes and its own instance buffer. */
const viewSelections=new WeakMap();
function abort(signal){if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');}
/** Snapshot authored matrices before culling, then cull using each copy's local camera coordinates.
 * source is the canonical staging buffer: edits must be committed with replace(source),
 * which invalidates packed selections and updates bounds for every render pass. */
export function installSharedInstanceWindow(T,mesh,{rangeM=500,matrices=null,eligible=null,beforeRender=null,viewPartitions=null}={}){
 if(!mesh?.isInstancedMesh||!(rangeM>0))throw new TypeError('Instanced mesh and positive range required');
 const source=matrices?new Float32Array(matrices):mesh.instanceMatrix.array.slice(),maximum=source.length/16;if(!Number.isInteger(maximum)||maximum>mesh.instanceMatrix.count)throw new TypeError('Canonical instance matrices exceed capacity');
 const packedIndices=new Int32Array(maximum).fill(-1);
 const partitions=viewPartitions?[...viewPartitions]:[maximum];
 if(partitions.some(n=>!Number.isInteger(n)||n<0)||partitions.reduce((sum,n)=>sum+n,0)!==maximum)throw new TypeError('Instance partitions must cover the canonical buffer');
 const rangeSquared=rangeM*rangeM,blockSize=32,blocks=[];
 const viewFrustum=viewPartitions?new T.Frustum():null;
 const clipMatrix=viewFrustum?new T.Matrix4():null;
 const instanceMatrix=viewFrustum?new T.Matrix4():null;
 const instanceBox=viewFrustum?new T.Box3():null;
 if(viewFrustum){
  mesh.geometry.computeBoundingBox();
  // The instance window uses conservative, padded bounds for every view.
  mesh.frustumCulled=false;
 }
 let testedCandidates=0;
 function rebuildBlocks(){
  blocks.length=0;
  let offset=0;
  for(const size of partitions){
   const limit=offset+size;
   for(let first=offset;first<limit;first+=blockSize){
    const end=Math.min(limit,first+blockSize),bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    const viewBounds=viewFrustum?new T.Box3():null;
    for(let i=first;i<end;i++){
     for(let axis=0;axis<3;axis++){
      const value=source[i*16+12+axis];
      bounds[axis]=Math.min(bounds[axis],value);bounds[axis+3]=Math.max(bounds[axis+3],value);
     }
     if(viewBounds){
      instanceMatrix.fromArray(source,i*16);
      viewBounds.union(instanceBox.copy(mesh.geometry.boundingBox).applyMatrix4(instanceMatrix));
     }
    }
    // Preserve moving foliage at the view edge.
    viewBounds?.expandByScalar(1);
    blocks.push({first,end,bounds,viewBounds});
   }
   offset=limit;
  }
 }
 rebuildBlocks();
 const cameraLocal=new T.Vector3(),inverse=new T.Matrix4();let visibleCount=maximum;
 mesh.count=maximum;
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
 if(mesh.frustumCulled&&mesh.boundingSphere===null)mesh.computeBoundingSphere();
 function select(camera){
  camera.getWorldPosition(cameraLocal);inverse.copy(mesh.matrixWorld).invert();cameraLocal.applyMatrix4(inverse);let count=0,firstChanged=-1,lastChanged=-1;
  if(viewFrustum){
   clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(mesh.matrixWorld);
   viewFrustum.setFromProjectionMatrix(clipMatrix,camera.coordinateSystem,camera.reversedDepth);
  }
  testedCandidates=0;
  for(const {first,end,bounds:b,viewBounds} of blocks){
   const dx=Math.max(b[0]-cameraLocal.x,0,cameraLocal.x-b[3]),dy=Math.max(b[1]-cameraLocal.y,0,cameraLocal.y-b[4]),dz=Math.max(b[2]-cameraLocal.z,0,cameraLocal.z-b[5]);
   if(dx*dx+dy*dy+dz*dz>rangeSquared||(viewBounds&&!viewFrustum.intersectsBox(viewBounds)))continue;
   for(let i=first;i<end;i++){
    testedCandidates++;
    const o=i*16;
    if((source[o+12]-cameraLocal.x)**2+(source[o+13]-cameraLocal.y)**2+(source[o+14]-cameraLocal.z)**2>rangeSquared)continue;
    if(eligible&&!eligible(i,source))continue;
    if(packedIndices[count]!==i){
     for(let k=0;k<16;k++)mesh.instanceMatrix.array[count*16+k]=source[o+k];
     packedIndices[count]=i;
     if(firstChanged<0)firstChanged=count;
     lastChanged=count;
    }
    count++;
   }
  }
  mesh.count=visibleCount=count;
  // Repeated world/depth/mirror passes often select the same instances.
  // Upload only changed matrices, while still evaluating dynamic eligibility.
  if(firstChanged>=0){mesh.instanceMatrix.addUpdateRange(firstChanged*16,(lastChanged-firstChanged+1)*16);mesh.instanceMatrix.needsUpdate=true;}
 }
 const selection={T,mesh,select,bound:false};
 viewSelections.set(mesh,selection);
 mesh.onBeforeRender=(_renderer,_scene,camera)=>{
  beforeRender?.();
  if(!viewFrustum&&!selection.bound)select(camera);
 };
 const canonicalInfo={maximum,rangeM,version:0};mesh.userData.asfaltoCanonicalInstances=canonicalInfo;
 mesh.userData.asfaltoCloneForChart=({acceptInstance}={})=>{
  const selected=[],selectedPartitions=[],point=new T.Vector3();
  let first=0;
  for(const size of partitions){
   const end=first+size,before=selected.length;
   for(let i=first;i<end;i++){
    if(eligible&&!eligible(i,source))continue;
    point.set(source[i*16+12],source[i*16+13],source[i*16+14]).applyMatrix4(mesh.matrixWorld);
    if(!acceptInstance||acceptInstance(point.toArray(),i,mesh))selected.push(...source.subarray(i*16,i*16+16));
   }
   if(selected.length>before)selectedPartitions.push((selected.length-before)/16);
   first=end;
  }
  if(!selected.length)return null;
  const copy=new T.InstancedMesh(mesh.geometry,mesh.material,selected.length/16);copy.name=mesh.name;copy.matrix.copy(mesh.matrix);copy.matrixAutoUpdate=false;copy.castShadow=mesh.castShadow;copy.receiveShadow=mesh.receiveShadow;copy.visible=mesh.visible;copy.layers.mask=mesh.layers.mask;copy.userData={...mesh.userData};copy.instanceMatrix.array.set(selected);copy.instanceMatrix.needsUpdate=true;copy.computeBoundingBox();copy.computeBoundingSphere();
  installSharedInstanceWindow(T,copy,{rangeM,matrices:selected,beforeRender,viewPartitions:viewFrustum?selectedPartitions:null});
  return copy;
 };
 return{source,replace(next){if(next.length!==source.length)throw new TypeError('Canonical replacement must preserve capacity');source.set(next);rebuildBlocks();packedIndices.fill(-1);canonicalInfo.version++;mesh.instanceMatrix.array.set(source);mesh.count=maximum;mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();},diagnostics:()=>({maximum,visibleCount,testedCandidates})};
}

/** Three uploads instance buffers while building the render list, before object callbacks. */
export function bindSharedInstanceWindows(scene,root){
 const selections=[];
 root.traverse(node=>{
  const entry=viewSelections.get(node);
  if(entry&&!entry.bound){entry.bound=true;selections.push(entry);}
 });
 if(!selections.length)return ()=>{};
 const {T}=selections[0],frustum=new T.Frustum(),projection=new T.Matrix4();
 const previous=scene.onBeforeRender;
 function prepare(renderer,world,camera,target){
  previous.call(this,renderer,world,camera,target);
  if(!root.visible)return;
  let frustumReady=false;
  for(const {mesh,select} of selections){
   if(!mesh.visible||!mesh.layers.test(camera.layers))continue;
   let ancestor=mesh.parent;
   while(ancestor?.visible)ancestor=ancestor.parent;
   if(ancestor)continue;
   if(mesh.frustumCulled){
    if(!frustumReady){projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);frustumReady=true;}
    if(!frustum.intersectsObject(mesh))continue;
   }
   select(camera);
  }
 }
 scene.onBeforeRender=prepare;
 return ()=>{
  if(scene.onBeforeRender===prepare)scene.onBeforeRender=previous;
  for(const entry of selections)entry.bound=false;
  selections.length=0;
 };
}
/** Unknown mesh callbacks fail explicitly: root.clone() would otherwise retain closure state from a different chart. */
export function createSeamCopyFactory(T,sourceRoot,{maxCopies=3}={}){
 if(!sourceRoot?.isObject3D||!Number.isInteger(maxCopies)||maxCopies<1||maxCopies>3)throw new TypeError('Source root and one to three copy slots required');let disposed=false;const live=new Set(),defaultCallback=T.Object3D.prototype.onBeforeRender;
 function create({chart,transform=null,signal,acceptNode=null,acceptInstance=null}={}){
  if(disposed)throw new Error('Seam copy factory disposed');abort(signal);if(live.size>=maxCopies)throw new Error('Seam copy capacity exceeded');if([...live].some(copy=>copy.chart===chart))throw new Error('Chart already exists');if(!Number.isSafeInteger(chart))throw new TypeError('Safe integer chart required');sourceRoot.updateMatrixWorld(true);const owned=[];
  function clone(node){abort(signal);if(node!==sourceRoot&&acceptNode&&!acceptNode(node))return null;
   let copy;if(node.userData.asfaltoCloneForChart)copy=node.userData.asfaltoCloneForChart({chart,acceptInstance});else{
    if(node.isMesh&&node.onBeforeRender!==defaultCallback)throw new Error('Dynamic mesh callback requires asfaltoCloneForChart: '+node.name);
    if(node.isSkinnedMesh)throw new Error('Skinned scenery requires an explicit chart copy factory');if(node.isInstancedMesh&&acceptInstance)throw new Error('Instance filtering requires an explicit chart copy factory: '+node.name);copy=node.clone(false);
   }if(!copy)return null;owned.push(copy);for(const child of node.children){const descendant=clone(child);if(descendant)copy.add(descendant);}return copy;
  }
  try{const root=clone(sourceRoot);if(!root)throw new Error('Source root cannot be excluded');root.name=sourceRoot.name+'_CHART_'+chart;root.matrixAutoUpdate=false;root.matrix.copy(sourceRoot.matrixWorld);if(transform){if(!Array.isArray(transform.matrix)||transform.matrix.length!==16||!transform.matrix.every(Number.isFinite))throw new TypeError('Finite chart matrix required');root.matrix.premultiply(new T.Matrix4().fromArray(transform.matrix));}root.updateMatrixWorld(true);
   let released=false;const result={root,chart,dispose(){if(released)return;released=true;root.removeFromParent();for(const node of owned)if(node.isInstancedMesh)node.dispose();root.clear();live.delete(result);}};live.add(result);return result;
  }catch(error){for(const node of owned)if(node.isInstancedMesh)node.dispose();throw error;}
 }
 return{create,dispose(){if(disposed)return;disposed=true;for(const copy of [...live])copy.dispose();},diagnostics:()=>({disposed,copies:live.size,sharedGeometry:true,sharedMaterials:true})};
}
