// Intersect a delivered curtain with actual horizontal basin triangles, not their bounding boxes.
function triangles(T,mesh){
 const g=mesh.geometry,p=g?.attributes?.position,index=g?.index,rows=[];if(!p)return rows;
 const point=new T.Vector3();for(let i=0;i<(index?.count||p.count);i+=3){const row=[];for(let j=0;j<3;j++)row.push(point.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray());rows.push(row);}return rows;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
function clipSegment(a,b,t){
 const sign=Math.sign(cross(t[0],t[1],t[2]));if(!sign)return null;let lo=0,hi=1;
 for(let i=0;i<3;i++){const p=t[i],q=t[(i+1)%3],fa=sign*cross(p,q,a),fb=sign*cross(p,q,b),delta=fb-fa;
  if(Math.abs(delta)<1e-9){if(fa<-.00001)return null;continue;}
  const at=-fa/delta;if(delta>0)lo=Math.max(lo,at);else hi=Math.min(hi,at);if(lo>=hi)return null;
 }
 return [a.map((v,i)=>v+(b[i]-v)*lo),a.map((v,i)=>v+(b[i]-v)*hi)];
}
export function findWaterfallImpact(T,fall,riverMeshes){
 const fallTriangles=triangles(T,fall),sum=[0,0,0],sources=new Set(),segments=[],receivers=new Map();let length=0;
 for(const river of riverMeshes)for(const water of triangles(T,river)){
  const waterY=(water[0][1]+water[1][1]+water[2][1])/3;if(water.some(p=>Math.abs(p[1]-waterY)>.01))continue;
  const xmin=Math.min(...water.map(p=>p[0])),xmax=Math.max(...water.map(p=>p[0])),zmin=Math.min(...water.map(p=>p[2])),zmax=Math.max(...water.map(p=>p[2]));
  for(const triangle of fallTriangles){
   if(triangle.every(p=>p[1]>waterY)||triangle.every(p=>p[1]<waterY)||triangle.every(p=>p[0]<xmin)||triangle.every(p=>p[0]>xmax)||triangle.every(p=>p[2]<zmin)||triangle.every(p=>p[2]>zmax))continue;
   const crossings=[];for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],dy=b[1]-a[1];if(Math.abs(dy)<1e-9)continue;const f=(waterY-a[1])/dy;if(f>=0&&f<=1){const p=a.map((v,k)=>v+(b[k]-v)*f);if(!crossings.some(q=>Math.hypot(...q.map((v,k)=>v-p[k]))<1e-6))crossings.push(p);}}
   if(crossings.length!==2)continue;const clipped=clipSegment(...crossings,water);if(!clipped)continue;const [a,b]=clipped,l=Math.hypot(a[0]-b[0],a[2]-b[2]);if(l<1e-5)continue;
   length+=l;segments.push({a,b});receivers.set(water.flat().join(','),water);sources.add(river.name);for(let k=0;k<3;k++)sum[k]+=(a[k]+b[k])*.5*l;
  }
 }
 return length>0?{impactCenter:sum.map(v=>v/length),impactSpanM:length,impactSegments:segments,impactReceiverTriangles:[...receivers.values()],impactSource:[...sources],impactMethod:'curtain_basin_triangle_intersection'}:null;
}

/** Sculpt the delivered front in world metres. No extra transparent layers.
 * Both the upstream lip and real basin intersection stay fixed. Source buffers
 * remain owned by a hidden child so unload handles both geometries. */
export function refineWaterfallVolume(T,mesh,{impactCenter}={}){
 if(!mesh?.isMesh||!mesh.geometry?.attributes?.position)return null;
 if(mesh.userData.asfaltoWaterfallVolume)return mesh.userData.asfaltoWaterfallVolume;
 mesh.updateWorldMatrix(true,false);
 const source=mesh.geometry,box=new T.Box3().setFromObject(mesh),bottom=impactCenter?.[1]??box.min.y,height=box.max.y-bottom;
 if(height<2)return null;
 const g=source.clone(),p=g.attributes.position,n=source.attributes.normal,world=new T.Vector3(),normal=new T.Vector3(),direction=new T.Vector3(),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),inverse=mesh.matrixWorld.clone().invert();
 if(n)for(let i=0;i<n.count;i++){normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix);normal.y=0;direction.add(normal);}
 if(direction.lengthSq()<.001)direction.set(0,0,1);direction.normalize();
 const axis=new T.Vector3(-direction.z,0,direction.x),center=box.getCenter(new T.Vector3());
 let minAlong=Infinity,maxAlong=-Infinity;
 for(let i=0;i<p.count;i++){world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const along=world.dot(axis);minAlong=Math.min(minAlong,along);maxAlong=Math.max(maxAlong,along);}
 const contactVertices=new Set(),worldY=new Float64Array(p.count),index=g.index;
 for(let i=0;i<p.count;i++)worldY[i]=world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).y;
 // A basin often intersects between source rows. Freeze the full crossing
 // triangle, otherwise interpolated contact drifts even when y=bottom is fixed.
 for(let i=0;i<(index?.count||p.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),ys=ids.map(k=>worldY[k]);if(Math.min(...ys)<=bottom+.001&&Math.max(...ys)>=bottom-.001)for(const k of ids)contactVertices.add(k);}
 const width=Math.max(.1,maxAlong-minAlong),phase=center.x*.037+center.z*.019;let maximumBowM=0;
 for(let i=0;i<p.count;i++){
  world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
  const drop=Math.max(0,Math.min(1,(box.max.y-world.y)/height)),u=(world.dot(axis)-minAlong)/width;
  const bank=Math.sin(Math.PI*Math.max(0,Math.min(1,u)));
  const sheet=.68+.21*Math.sin(u*13+phase)+.11*Math.sin(u*29-phase);
  const bow=(contactVertices.has(i)?0:Math.sin(Math.PI*drop))*Math.sqrt(drop)*Math.min(5,height*.055)*bank*sheet;
  world.addScaledVector(direction,bow);maximumBowM=Math.max(maximumBowM,Math.abs(bow));
  world.applyMatrix4(inverse);p.setXYZ(i,world.x,world.y,world.z);
 }
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
 const owner=new T.Mesh(source,mesh.material);owner.name='ASFALTO_WATERFALL_SOURCE_OWNER';owner.visible=false;mesh.add(owner);
 return mesh.userData.asfaltoWaterfallVolume=Object.freeze({maximumBowM,triangles:(g.index?.count||p.count)/3,basinContactPreserved:true,lipHeightM:box.max.y,impactHeightM:bottom});
}

/** Extend a truncated sidefall only into a delivered horizontal river triangle.
 * No new basin, inferred water plane or collider is introduced. */
export function connectSidefallToBasin(T,mesh,riverMeshes,{maxGapM=45}={}){
 if(mesh.userData.asfaltoSidefallConnection)return mesh.userData.asfaltoSidefallConnection;
 const source=mesh.geometry,p=source?.attributes.position;if(!p)return{connected:false,reason:'no geometry'};
 mesh.updateWorldMatrix(true,false);const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3()),candidate=[];
 for(const river of riverMeshes)for(const triangle of triangles(T,river)){
  const y=triangle.reduce((s,p)=>s+p[1],0)/3;if(triangle.some(p=>Math.abs(p[1]-y)>.02)||y>box.min.y-.05||box.min.y-y>maxGapM)continue;
  candidate.push({triangle,y,name:river.name});
 }
 function floorAt(point){let result=null;for(const c of candidate){const sign=Math.sign(cross(...c.triangle));if(!sign)continue;if(c.triangle.every((p,i)=>cross(p,c.triangle[(i+1)%3],point)*sign>=-.001)&&(!result||c.y>result.y))result=c;}return result;}
 const lower=[];const point=new T.Vector3();for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(point.y<=box.min.y+.03)lower.push(point.toArray());}
 const supports=lower.map(floorAt),valid=supports.filter(Boolean);
 if(valid.length!==lower.length||valid.length<2)return mesh.userData.asfaltoSidefallConnection={connected:false,reason:'no continuous delivered basin beneath lower lip',supported:valid.length,lowerVertices:lower.length};
 const targetY=Math.max(...valid.map(s=>s.y));if(valid.some(s=>Math.abs(s.y-targetY)>.02))return{connected:false,reason:'inconsistent receiving water levels'};
 const geometry=source.clone(),out=geometry.attributes.position,inverse=mesh.matrixWorld.clone().invert(),gap=box.min.y-targetY+.12,height=box.max.y-box.min.y;
 for(let i=0;i<out.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const t=Math.max(0,1-(point.y-box.min.y)/Math.max(1,height*.65));point.y-=gap*t*t;point.applyMatrix4(inverse);out.setXYZ(i,point.x,point.y,point.z);}
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 const owner=new T.Mesh(source,mesh.material);owner.name='ASFALTO_SIDEFALL_SOURCE_OWNER';owner.visible=false;mesh.add(owner);
 return mesh.userData.asfaltoSidefallConnection={connected:true,extensionM:gap,basinY:targetY,basins:[...new Set(valid.map(v=>v.name))],sourcePreserved:true};
}

/** Six delivered sidefalls contain world-space vertices and an obsolete local
 * yaw. Cancel only that known extra transform; keep mesh buffers and root frame. */
export function repairBakedSidefallTransform(T,mesh){
 if(!/^SIDEFALL_[0-5]$/.test(mesh?.name||''))return{corrected:false};
 if(mesh.userData.asfaltoBakedSidefallTransform)return mesh.userData.asfaltoBakedSidefallTransform;
 const owner=mesh.parent?.name===mesh.name?mesh.parent:mesh;
 mesh.geometry.computeBoundingBox();const c=mesh.geometry.boundingBox.getCenter(new T.Vector3());
 if(Math.hypot(c.x,c.z)<100||owner.position.lengthSq()>.001)return{corrected:false,reason:'not known baked-world layout'};
 const originalQuaternion=owner.quaternion.toArray();owner.quaternion.identity();owner.updateMatrix();owner.updateWorldMatrix(true,true);
 return mesh.userData.asfaltoBakedSidefallTransform={corrected:true,originalQuaternion,verticesPreserved:true};
}

/** A local receiving ledge for each repaired sidefall. The delivered terrain
 * supports the basalt bed; its water surface is a small pool at the actual foot,
 * not a guessed extension through metres of solid ground to a distant river. */
export function createSidefallReceivingLedge(T,fall,{heightAt,query,root,material}={}){
 fall.updateWorldMatrix(true,false);const box=new T.Box3().setFromObject(fall),center=box.getCenter(new T.Vector3());center.y=box.min.y;
 const ground=heightAt(center.x,center.z);if(!Number.isFinite(ground))return null;
 if(query&&query.project(center.toArray()).distanceXZ<18)return null;
 const p=fall.geometry.attributes.position,lower=[],v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(fall.matrixWorld);if(v.y<box.min.y+.03)lower.push(v.clone());}
 if(lower.length<2)return null;
 let a=lower[0],b=lower[1],width=0;for(const x of lower)for(const y of lower){const d=x.distanceTo(y);if(d>width){width=d;a=x;b=y;}}
 const axis=b.clone().sub(a).normalize(),normal=new T.Vector3(-axis.z,0,axis.x),level=box.min.y-.18,depth=3.4,half=width*.5+1.2;
 center.copy(a).add(b).multiplyScalar(.5);center.y=level;
 const verts=[];for(const [u,w]of[[-half,-depth],[half,-depth],[half,depth],[-half,depth]])verts.push(...center.clone().addScaledVector(axis,u).addScaledVector(normal,w).toArray());
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,2,1,0,3,2]);geometry.computeVertexNormals();
 const water=new T.Mesh(geometry,material);water.name=fall.name+'_RECEIVING_POOL';water.userData.asfaltoSidefallPool={terrainY:ground,waterY:level,constructedAdaptation:true};root.add(water);water.updateWorldMatrix(true,false);
 const rockMaterial=new T.MeshStandardMaterial({name:'MAT_basalt_SIDEFALL_LEDGE',color:'#39433c',roughness:.88,metalness:0});
 const bed=new T.Mesh(new T.IcosahedronGeometry(1,1),rockMaterial);bed.name=fall.name+'_BASALT_CONTACT_LEDGE';
 const bottom=Math.min(ground-.65,level-.9),height=level-bottom;bed.position.copy(center);bed.position.y=bottom+height*.5-.14;bed.scale.set(half+1.5,height*.65,depth+1);bed.rotation.y=-Math.atan2(axis.z,axis.x);bed.updateMatrix();root.add(bed);
 return water;
}
