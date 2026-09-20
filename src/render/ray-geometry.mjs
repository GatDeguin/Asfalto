const opaque=m=>m&&m.visible!==false&&!m.transparent&&!(m.alphaTest>0)&&!(m.transmission>0);
// Collect in short tasks. Large terrain meshes are clipped by triangle bounds,
// without decimation; a strict cap bounds both worker memory and texture size.
export async function collectRayGeometry(T,scene,center,{radius=32,maxTriangles=24000,excludeRoots=[],signal,yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}) {
  const origin=center.clone(),excluded=new Set(excludeRoots.filter(Boolean)),candidates=[],box=new T.Box3(),matrix=new T.Matrix4(),instance=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let sliceStart=performance.now(),instances=0;
  const check=async()=>{if(signal?.aborted)throw new DOMException('Ray geometry cancelled','AbortError');if(performance.now()-sliceStart>4){await yieldTask();sliceStart=performance.now();}};
  scene.updateMatrixWorld(true);
  const stack=[scene];while(stack.length){const node=stack.pop();if(!node.visible||excluded.has(node)||node.userData.rayTracingDynamic)continue;for(const child of node.children)stack.push(child);
    const g=node.geometry,position=g?.attributes?.position;if(!node.isMesh||!position||node.isSkinnedMesh||g.morphAttributes?.position?.length)continue;const materials=Array.isArray(node.material)?node.material:[node.material];if(!materials.some(opaque))continue;if(!g.boundingBox)g.computeBoundingBox();
    for(let i=0,n=node.isInstancedMesh?node.count:1;i<n;i++){matrix.copy(node.matrixWorld);if(node.isInstancedMesh){node.getMatrixAt(i,instance);matrix.multiply(instance);}box.copy(g.boundingBox).applyMatrix4(matrix);const distance=box.distanceToPoint(center);if(distance<=radius)candidates.push({node,g,materials,matrix:matrix.clone(),distance,instance:node.isInstancedMesh});await check();}
  }
  candidates.sort((a,b)=>a.distance-b.distance);const output=new Float32Array(maxTriangles*9);let triangles=0,budgetReached=false;
  for(const entry of candidates){const {g,materials}=entry,p=g.attributes.position,index=g.index,end=Math.min(index?.count??p.count,(g.drawRange?.start||0)+(g.drawRange?.count??Infinity)),begin=g.drawRange?.start||0;let added=false;
    for(let i=begin;i+2<end;i+=3){const materialIndex=g.groups.length?g.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex??0:0;if(!opaque(materials[Array.isArray(entry.node.material)?materialIndex:0]))continue;
      a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(entry.matrix);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(entry.matrix);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(entry.matrix);
      box.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);if(box.distanceToPoint(center)>radius)continue;if(![a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z].every(Number.isFinite))continue;
      if(triangles>=maxTriangles){budgetReached=true;break;}a.sub(origin).toArray(output,triangles*9);b.sub(origin).toArray(output,triangles*9+3);c.sub(origin).toArray(output,triangles*9+6);triangles++;added=true;if(i%192===0)await check();
    }if(added&&entry.instance)instances++;if(budgetReached)break;await check();
  }
  if(signal?.aborted)throw new DOMException('Ray geometry cancelled','AbortError');return{vertices:output.slice(0,triangles*9),origin,triangles,instances,budgetReached,candidates:candidates.length};
}
