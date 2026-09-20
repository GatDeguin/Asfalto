/** Shared-resource scene copies. Each copy owns only nodes and its own instance buffer. */
const instanceSources=new WeakMap();
function abort(signal){if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');}
/** Snapshot authored matrices before culling, then cull using each copy's local camera coordinates.
 * source is the canonical staging buffer: edits must be committed with replace(source),
 * which invalidates packed selections and updates bounds for every render pass. */
export function installSharedInstanceWindow(T,mesh,{rangeM=500,matrices=null,eligible=null,beforeRender=null}={}){
 if(!mesh?.isInstancedMesh||!(rangeM>0))throw new TypeError('Instanced mesh and positive range required');
 const source=matrices?new Float32Array(matrices):mesh.instanceMatrix.array.slice(),maximum=source.length/16;if(!Number.isInteger(maximum)||maximum>mesh.instanceMatrix.count)throw new TypeError('Canonical instance matrices exceed capacity');
 const packedIndices=new Int32Array(maximum).fill(-1);
 // Conservative blocks preserve authored order and exact per-instance distance.
 // Rebuild only when the canonical staging buffer is committed through replace().
 const blockSize=32,blocks=[];let testedCandidates=0;
 function rebuildBlocks(){blocks.length=0;for(let first=0;first<maximum;first+=blockSize){const end=Math.min(maximum,first+blockSize),bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=first;i<end;i++)for(let a=0;a<3;a++){const value=source[i*16+12+a];bounds[a]=Math.min(bounds[a],value);bounds[a+3]=Math.max(bounds[a+3],value);}blocks.push({first,end,bounds});}}
 rebuildBlocks();
 const cameraLocal=new T.Vector3(),inverse=new T.Matrix4();let visibleCount=maximum;
 const state={source,rangeM,maximum,eligible,beforeRender};instanceSources.set(mesh,state);mesh.count=maximum;
 mesh.onBeforeRender=(_renderer,_scene,camera)=>{beforeRender?.();camera.getWorldPosition(cameraLocal);inverse.copy(mesh.matrixWorld).invert();cameraLocal.applyMatrix4(inverse);let count=0,changed=false;
  testedCandidates=0;
  for(const {first,end,bounds:b} of blocks){const dx=Math.max(b[0]-cameraLocal.x,0,cameraLocal.x-b[3]),dy=Math.max(b[1]-cameraLocal.y,0,cameraLocal.y-b[4]),dz=Math.max(b[2]-cameraLocal.z,0,cameraLocal.z-b[5]);if(dx*dx+dy*dy+dz*dz>rangeM*rangeM)continue;
  for(let i=first;i<end;i++){testedCandidates++;const o=i*16;if(eligible&&!eligible(i,source))continue;if((source[o+12]-cameraLocal.x)**2+(source[o+13]-cameraLocal.y)**2+(source[o+14]-cameraLocal.z)**2>rangeM*rangeM)continue;if(packedIndices[count]!==i){for(let k=0;k<16;k++)mesh.instanceMatrix.array[count*16+k]=source[o+k];packedIndices[count]=i;changed=true;}count++;}}
  mesh.count=visibleCount=count;
  // Repeated world/depth/mirror passes often select the same instances.
  // Upload only changed matrices, while still evaluating dynamic eligibility.
  if(changed){mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,count*16);mesh.instanceMatrix.needsUpdate=true;}
 };
 const canonicalInfo={maximum,rangeM,version:0};mesh.userData.asfaltoCanonicalInstances=canonicalInfo;
 mesh.userData.asfaltoCloneForChart=({acceptInstance}={})=>{const selected=[],point=new T.Vector3();for(let i=0;i<maximum;i++){if(eligible&&!eligible(i,source))continue;point.set(source[i*16+12],source[i*16+13],source[i*16+14]).applyMatrix4(mesh.matrixWorld);if(!acceptInstance||acceptInstance(point.toArray(),i,mesh))selected.push(...source.subarray(i*16,i*16+16));}
  if(!selected.length)return null;const copy=new T.InstancedMesh(mesh.geometry,mesh.material,selected.length/16);copy.name=mesh.name;copy.matrix.copy(mesh.matrix);copy.matrixAutoUpdate=false;copy.castShadow=mesh.castShadow;copy.receiveShadow=mesh.receiveShadow;copy.visible=mesh.visible;copy.layers.mask=mesh.layers.mask;copy.userData={...mesh.userData};copy.instanceMatrix.array.set(selected);copy.instanceMatrix.needsUpdate=true;copy.computeBoundingBox();copy.computeBoundingSphere();installSharedInstanceWindow(T,copy,{rangeM,matrices:selected,beforeRender});return copy;
 };
 return{source,replace(next){if(next.length!==source.length)throw new TypeError('Canonical replacement must preserve capacity');source.set(next);rebuildBlocks();packedIndices.fill(-1);canonicalInfo.version++;mesh.instanceMatrix.array.set(source);mesh.count=maximum;mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();},diagnostics:()=>({maximum,visibleCount,testedCandidates})};
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
