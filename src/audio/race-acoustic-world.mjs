/** Read-only acoustic emitters measured from the prepared scene in world metres. */
export function createRaceAcousticWorld(T){
  let root=null,trackId='',falls=[],forest=[],samples=0;
  const p=new T.Vector3(),nearest=new T.Vector3(),bestPoint=new T.Vector3(),right=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4(),q=new T.Quaternion(),last=new T.Vector3(Infinity,Infinity,Infinity);
  const lastRotation=new T.Quaternion();let rotated=false;
  let result={waterfall:null,forest:null};
  function clear(){root=null;falls=[];forest=[];samples=0;rotated=false;last.set(Infinity,Infinity,Infinity);result={waterfall:null,forest:null};}
  function bind(visualRoot,id){clear();root=visualRoot;trackId=id||'';if(!root)return;root.updateWorldMatrix(true,true);const canopy=new Map();
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const data=mesh.userData?.asfaltoWaterfall;
      if(data){const pos=mesh.geometry?.attributes.position,index=mesh.geometry?.index,triangles=[],box=new T.Box3();if(!pos)return;const n=index?.count??pos.count;
        for(let i=0;i+2<n;i+=3){const vertices=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(pos,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));const triangle=new T.Triangle(...vertices);if(triangle.getArea()<.00001)continue;const bounds=new T.Box3().setFromPoints(vertices);triangles.push({triangle,bounds});box.union(bounds);}
        if(triangles.length)falls.push({name:mesh.name,triangles,box,metadata:data,bottom:new T.Vector3().fromArray(data.impactCenter||data.bottomCenter||[box.getCenter(new T.Vector3()).x,box.min.y,box.getCenter(new T.Vector3()).z])});
      }
      if(!['dos_lagos','paso_garibaldi','cataratas_iguazu'].includes(trackId))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(!materials.some(m=>/(leaf|palm|fern|foliage|canopy|needles)/i.test(m?.name||'')))return;
      mesh.geometry.computeBoundingBox();const center=mesh.geometry.boundingBox.getCenter(new T.Vector3());
      const count=mesh.isInstancedMesh?mesh.userData.asfaltoIguazuInstances?.maximum??mesh.count:1;
      for(let i=0;i<count;i++){matrix.copy(mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}p.copy(center).applyMatrix4(matrix);const key=[Math.floor(p.x/24),Math.floor(p.y/24),Math.floor(p.z/24)].join(',');if(!canopy.has(key))canopy.set(key,p.clone());}
    });forest=[...canopy.values()];
  }
  function pan(point,listener,rotation){if(!rotation)return 0;q.copy(rotation);right.set(0,0,1).applyQuaternion(q);nearest.copy(point).sub(listener);const distance=nearest.length();return distance?Math.max(-.8,Math.min(.8,nearest.dot(right)/distance)):0;}
  function sample(position,rotation){if(!position)return result;if(last.distanceToSquared(position)<.25&&(!rotation||rotated&&Math.abs(lastRotation.dot(rotation))>.99999))return result;last.copy(position);if(rotation){lastRotation.copy(rotation);rotated=true;}samples++;let selected=null,bestLevel=0;
    for(const field of falls){let distance=Infinity;
      for(const entry of field.triangles){if(entry.bounds.distanceToPoint(position)>=distance)continue;entry.triangle.closestPointToPoint(position,nearest);const d=nearest.distanceTo(position);if(d<distance){distance=d;bestPoint.copy(nearest);}}
      const impactDistance=field.bottom.distanceTo(position),scale=Math.min(1.5,Math.max(.35,Math.sqrt((field.metadata.heightM||20)*(field.metadata.baseWidthM||10))/65)),level=scale/(1+Math.pow(distance/150,1.4));
      if(level>bestLevel){bestLevel=level;selected={kind:'waterfall',name:field.name,distanceM:distance,impactDistanceM:impactDistance,impactPosition:field.bottom.toArray(),heightM:field.metadata.heightM,flowMps:field.metadata.speedMps,scale,pan:pan(bestPoint,position,rotation),position:bestPoint.toArray(),source:'world-mesh-triangle-distance'};}
    }
    let forestDistance=Infinity,forestPoint=null;for(const point of forest){const d=point.distanceToSquared(position);if(d<forestDistance){forestDistance=d;forestPoint=point;}}
    result={waterfall:selected,forest:forestPoint?{biome:trackId==='cataratas_iguazu'?'subtropical_forest':trackId==='paso_garibaldi'?'austral_forest':'andean_forest',distanceM:Math.sqrt(forestDistance),proximity:Math.exp(-Math.sqrt(forestDistance)/90),pan:pan(forestPoint,position,rotation),position:forestPoint.toArray(),source:'sampled-real-canopy-positions'}:null};return result;
  }
  return{bind,sample,diagnostics:()=>({trackId,waterfallEmitters:falls.length,waterfallTriangles:falls.reduce((n,f)=>n+f.triangles.length,0),canopyEmitters:forest.length,samples,distanceModel:'world-triangle-3d'}),dispose:clear};
}
