// Read-only route sampling, used only to constrain visible terrain and vegetation.
export function visualRoadField(query, lengthM) {
  const cells=new Map(), samples=[], size=180, step=20;
  for(let s=0;s<=lengthM;s+=step){
    const sample=query.sample(s), record={position:sample.position,widthM:sample.widthM||8}; samples.push(record);
    const key=Math.floor(record.position[0]/size)+':'+Math.floor(record.position[2]/size);
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(record);
  }
  return (x,z)=>{
    const cx=Math.floor(x/size),cz=Math.floor(z/size); let best=null,d2=Infinity;
    const consider=record=>{const p=record.position,d=(p[0]-x)**2+(p[2]-z)**2;if(d<d2){d2=d;best=record;}};
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(const record of cells.get((cx+dx)+':'+(cz+dz))||[])consider(record);
    if(!best)for(let i=0;i<samples.length;i+=10)consider(samples[i]);
    return {distanceM:Math.max(0,Math.sqrt(d2)-step),position:best?.position||[x,0,z],widthM:best?.widthM||8};
  };
}

function noise(x,z){return Math.sin(x*.024+Math.sin(z*.018)*1.4)*.48+Math.sin(z*.043-x*.017)*.29+Math.sin(x*.083+z*.064)*.13+Math.sin(x*.17-z*.11)*.06;}

export function refineForestTerrain(THREE,mesh,{roadField,waterLevel=-Infinity,maxTriangles=180000}={}){
  if(!mesh?.geometry?.attributes?.position||/^COLLISION_/i.test(mesh.name)||mesh.userData.asfaltoForestRelief||!roadField)return null;
  const source=mesh.geometry,p=source.attributes.position,index=source.index,count=index?.count||p.count;
  if(count/3>maxTriangles)return null;
  mesh.updateWorldMatrix(true,false);const inverse=mesh.matrixWorld.clone().invert();
  const vertices=[],indices=[],lookup=new Map(),triangles=[];
  const get=i=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
  const add=point=>{
    const key=[point.x,point.y,point.z].map(v=>Math.round(v*1000)).join(':');
    if(lookup.has(key))return lookup.get(key);
    const q=roadField(point.x,point.z),clear=q.distanceM-q.widthM/2;
    const t=Math.max(0,Math.min(1,(clear-12)/65)),blend=t*t*(3-2*t);
    const shore=Math.max(0,Math.min(1,(point.y-waterLevel-1)/12));
    // Reduce the authored vertical exaggeration outside the roadway and add
    // connected erosion relief. Shore vertices stay below the same water level.
    point.y+=blend*shore*(noise(point.x,point.z)*12-Math.max(0,point.y-q.position[1]-45)*.24);
    const x=point.x,z=point.z;
    point.x+=noise(x+137,z-79)*8*blend*shore;
    point.z+=noise(x-21,z+441)*8*blend*shore;
    point.applyMatrix4(inverse);const id=vertices.length/3;vertices.push(point.x,point.y,point.z);lookup.set(key,id);return id;
  };
  const split=(a,b,c,depth)=>{
    if(depth<3&&triangles.length/3+count/3<maxTriangles&&Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>40){
      const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);
      split(a,ab,ca,depth+1);split(ab,b,bc,depth+1);split(ca,bc,c,depth+1);split(ab,bc,ca,depth+1);
    }else triangles.push(a,b,c);
  };
  for(let i=0;i<count;i+=3)split(get(i),get(i+1),get(i+2),0);
  for(const point of triangles)indices.push(add(point.clone()));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  mesh.geometry=geometry;
  const owner=new THREE.Mesh(source,mesh.material);owner.name='ASFALTO_TERRAIN_SOURCE_OWNER';owner.visible=false;mesh.add(owner);
  mesh.userData.asfaltoForestRelief={triangles:indices.length/3,vertices:vertices.length/3};
  return mesh.userData.asfaltoForestRelief;
}

export function forestBackfill({heightAt,roadField,maxTrees=16000,valleyDepthM=55}){
  const box=heightAt.bounds;if(!box||box.isEmpty())return[];
  const area=(box.max.x-box.min.x)*(box.max.z-box.min.z),step=Math.max(28,Math.sqrt(area/(maxTrees*1.2)));
  const trees=[];let state=67439;const rng=()=>{state=Math.imul(state,1664525)+1013904223>>>0;return state/4294967296;};
  for(let z=box.min.z;z<box.max.z;z+=step)for(let x=box.min.x;x<box.max.x;x+=step){
    const px=x+rng()*step,pz=z+rng()*step,y=heightAt(px,pz);if(!Number.isFinite(y))continue;
    const q=roadField(px,pz);if(q.distanceM<160||y<q.position[1]-valleyDepthM)continue;
    const yx=heightAt(px+4,pz),yz=heightAt(px,pz+4);
    if(!Number.isFinite(yx)||!Number.isFinite(yz)||Math.hypot(yx-y,yz-y)/4>1.35)continue;
    trees.push({position:[px,y-.2,pz],roadDistanceM:q.distanceM,height:14+rng()*17,width:.75+rng()*.35,rotation:rng()*Math.PI*2,variation:0});
  }
  return trees.length>maxTrees?Array.from({length:maxTrees},(_,i)=>trees[Math.floor(i*trees.length/maxTrees)]):trees;
}
