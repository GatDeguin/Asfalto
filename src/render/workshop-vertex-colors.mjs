// Continuous, deterministic linear tints in workshop metres. Photographic maps
// retain fine detail; these vertex colors describe broad use and material aging.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return v-Math.floor(v);};
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),smooth=v=>v*v*(3-2*v);
 const u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);let n=0;
 for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)n+=hash(ix+a,iy+b,iz+c)*(a?u:1-u)*(b?v:1-v)*(c?w:1-w);
 return n;
}
export function sampleWorkshopTint(x,y,z,kind='steel'){
 const patch=noise(x*.72,y*.9,z*.72),fine=noise(x*2.7+13,y*2.1,z*2.7-7);
 const warm=noise(x*.32+8,y*.6,z*.32),base=.92+patch*.10+fine*.025;
 const floor=kind==='floor',wall=kind==='plaster'||kind==='blue-paint';
 const foot=wall?Math.exp(-Math.max(0,y-.18)*2.5)*.05:0;
 const traffic=floor?Math.exp(-((x+1.8)**2*.12+(z+1.6)**2*.2))*.045:0;
 const strength=kind==='steel'?.55:kind==='wood'?1.05:1;
 return [1+.030*(warm-.5),1+.007*(warm-.5),1-.034*(warm-.5)]
  .map(c=>clamp(1+(base*c-foot-traffic-1)*strength,.80,1.055));
}

// Clone before coloring so the original GLB and any shared source remain intact.
// Subdivision interpolates existing triangles only: room bounds/colliders do not move.
export function createWorkshopVertexGeometry(T,object,kind,{maxEdgeM=.85,maxTriangles=14000}={}){
 const source=object.geometry,position=source.attributes.position,index=source.index;
 const point=[new T.Vector3(),new T.Vector3(),new T.Vector3()],edgeA=new T.Vector3(),edgeB=new T.Vector3();
 const triangles=Math.floor((index?index.count:position.count)/3),plans=[];
 let total=0;
 for(let t=0;t<triangles;t++){
  const ids=[0,1,2].map(i=>index?index.getX(t*3+i):t*3+i);
  ids.forEach((id,i)=>point[i].fromBufferAttribute(position,id).applyMatrix4(object.matrixWorld));
  const longest=Math.max(point[0].distanceTo(point[1]),point[1].distanceTo(point[2]),point[2].distanceTo(point[0]));
  // Long thin trim needs a tint gradient, not a dense two-dimensional grid.
  const twiceArea=edgeA.subVectors(point[1],point[0]).cross(edgeB.subVectors(point[2],point[0])).length();
  const samplingLength=Math.min(longest,Math.sqrt(twiceArea)*1.5);
  const n=clamp(Math.ceil(samplingLength/maxEdgeM),1,24);
  plans.push({ids,n});total+=n*n;
 }
 if(total>maxTriangles&&total>triangles){
  // Reserve every original triangle first; spend only the remaining budget on subdivisions.
  const ratio=Math.max(0,maxTriangles-triangles)/(total-triangles);total=0;
  for(const p of plans){p.n=Math.max(1,Math.floor(Math.sqrt(1+(p.n*p.n-1)*ratio)));total+=p.n*p.n;}
 }
 let geometry;
 if(total===triangles||Object.keys(source.morphAttributes).length){geometry=source.clone();}
 else{
  geometry=new T.BufferGeometry();
  const attributes=Object.entries(source.attributes).filter(([name])=>name!=='tangent');
  const arrays=new Map(attributes.map(([name,a])=>[name,new Float32Array(total*3*a.itemSize)]));let vertex=0;
  function emit(ids,i,j,n){
   const b=i/n,c=j/n,a=1-b-c;
   for(const [name,attr]of attributes)for(let k=0;k<attr.itemSize;k++)arrays.get(name)[vertex*attr.itemSize+k]=attr.getComponent(ids[0],k)*a+attr.getComponent(ids[1],k)*b+attr.getComponent(ids[2],k)*c;
   vertex++;
  }
  for(const {ids,n}of plans)for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
   emit(ids,i,j,n);emit(ids,i+1,j,n);emit(ids,i,j+1,n);
   if(i+j<n-1){emit(ids,i+1,j,n);emit(ids,i+1,j+1,n);emit(ids,i,j+1,n);}
  }
  for(const [name,a]of attributes)geometry.setAttribute(name,new T.BufferAttribute(arrays.get(name),a.itemSize));
  if(geometry.attributes.normal)geometry.normalizeNormals();
 }
 const p=geometry.attributes.position,original=geometry.attributes.color,stride=original?.itemSize===4?4:3,values=new Float32Array(p.count*stride);
 for(let i=0;i<p.count;i++){
  point[0].fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);
  const tint=sampleWorkshopTint(point[0].x,point[0].y,point[0].z,kind);
  for(let c=0;c<3;c++)values[i*stride+c]=tint[c]*(original?.itemSize===3?.92+.08*original.getComponent(i,c):1);
  if(stride===4)values[i*stride+3]=original.getW(i);
 }
 geometry.setAttribute('color',new T.BufferAttribute(values,stride));
 geometry.deleteAttribute('tangent');geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.workshopVertexColors={kind,vertices:p.count,triangles:geometry.index?geometry.index.count/3:p.count/3};
 return geometry;
}

// Rigid accessory instances keep one geometry and add their own stable tint.
// The color buffer belongs to the InstancedMesh, so cylinder LOD swaps retain it.
export function tintWorkshopInstances(T,mesh,kind='steel'){
 const point=new T.Vector3(),matrix=new T.Matrix4(),color=new T.Color(),hadColor=!!mesh.instanceColor;
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
  const tint=sampleWorkshopTint(point.x,point.y,point.z,kind);
  if(hadColor)mesh.getColorAt(i,color);else color.setRGB(1,1,1);
  color.r*=tint[0];color.g*=tint[1];color.b*=tint[2];mesh.setColorAt(i,color);
 }
 if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 mesh.userData.workshopInstanceTint=true;
 return mesh.count;
}
