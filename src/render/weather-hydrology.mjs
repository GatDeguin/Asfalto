const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function distanceSegment(x,z,a,b){const dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);}
/** Geometric perimeter, not a painted noise mask. Quantization joins GLB split vertices. */
export function waterBoundarySegments(THREE,mesh){
  mesh.updateWorldMatrix(true,false);const position=mesh.geometry?.attributes.position,index=mesh.geometry?.index;
  if(!position)return[];const points=[],keys=[],v=new THREE.Vector3(),edges=new Map();
  for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);points.push(v.toArray());keys.push(`${Math.round(v.x*100)},${Math.round(v.y*100)},${Math.round(v.z*100)}`);}
  const count=index?.count??position.count;
  for(let i=0;i+2<count;i+=3){const triangle=[index?index.getX(i):i,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2];
    for(let e=0;e<3;e++){const a=triangle[e],b=triangle[(e+1)%3],key=keys[a]<keys[b]?keys[a]+'|'+keys[b]:keys[b]+'|'+keys[a];const entry=edges.get(key);if(entry)entry.count++;else edges.set(key,{a:points[a],b:points[b],count:1});}}
  return [...edges.values()].filter(e=>e.count===1&&Math.hypot(e.a[0]-e.b[0],e.a[2]-e.b[2])>.01).map(({a,b})=>({a,b}));
}
/** Acoustic distance to the actual mesh boundary, including height; interior water remains audible. */
export function createWaterDistance(segments,fallbackY=0){
  return position=>{
    let inside=false,nearestSq=Infinity,nearestY=fallbackY;
    for(const {a,b} of segments){
      const dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((position.x-a[0])*dx+(position.z-a[2])*dz)/(dx*dx+dz*dz||1),0,1);
      const px=a[0]+dx*t,pz=a[2]+dz*t,d=(position.x-px)**2+(position.z-pz)**2;
      if(d<nearestSq){nearestSq=d;nearestY=a[1]+(b[1]-a[1])*t;}
      if((a[2]>position.z)!==(b[2]>position.z)&&position.x<(b[0]-a[0])*(position.z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
    }
    return Math.hypot(inside?0:Math.sqrt(nearestSq),position.y-nearestY);
  };
}
export function createWaterHydrology(THREE,mesh){
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const metadata={kind:materials.some(material=>/RIVER/.test(material?.name||''))?'river':'lake',...mesh.userData?.asfaltoWater},boundary=waterBoundarySegments(THREE,mesh),segments=metadata.shoreSegments?.length?metadata.shoreSegments:boundary;
  const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3()),resolution=96;
  const data=new Float32Array(resolution*resolution*4),maxDepth=Math.max(.1,Number(metadata.maxDepthM)||(metadata.kind==='river'?2:18));
  // Explicitly a conservative shore wedge when no authored depth field exists.
  // The field remains in metres; it is not an assertion of surveyed bathymetry.
  const depthSamples=metadata.depthSamples||[],step=Math.max(1,Math.ceil(segments.length/2048));
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const wx=bounds.min.x+size.x*x/(resolution-1),wz=bounds.min.z+size.z*y/(resolution-1);let shore=Infinity;
    for(let e=0;e<segments.length;e+=step)shore=Math.min(shore,distanceSegment(wx,wz,segments[e].a,segments[e].b));
    if(!Number.isFinite(shore))shore=maxDepth/.22;
    let depth=clamp(shore*.22+.06,0,maxDepth);
    if(depthSamples.length){let numerator=0,denominator=0;for(const s of depthSamples){const d=Math.hypot(wx-s[0],wz-s[2]),weight=1/Math.max(.2,d*d);numerator+=Math.max(0,s[3])*weight;denominator+=weight;}depth=numerator/denominator;}
    const offset=(y*resolution+x)*4;data[offset]=depth;data[offset+1]=shore;data[offset+2]=0;data[offset+3]=1;
  }
  const texture=new THREE.DataTexture(data,resolution,resolution,THREE.RGBAFormat,THREE.FloatType);texture.name='AN_GeometricWaterDepthShore';texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return{texture,distanceToWater:createWaterDistance(boundary,(bounds.min.y+bounds.max.y)*.5),bounds:new THREE.Vector4(bounds.min.x,bounds.min.z,Math.max(.001,size.x),Math.max(.001,size.z)),metadata,
    diagnostics:{segments:segments.length,depthSource:depthSamples.length?(metadata.depthSource||'authored-depth-samples'):'geometric-shore-wedge',maxDepthM:maxDepth},dispose(){texture.dispose();}};
}
/** Vertex drainage from neighbouring measured road heights; flat roads retain only a film. */
export function installRoadHydrology(THREE,mesh){
  const geometry=mesh.geometry,position=geometry?.attributes.position;if(!position)return()=>{};
  const previous=geometry.getAttribute('anFxHydrology'),values=new Float32Array(position.count*2),world=[],grid=new Map(),v=new THREE.Vector3(),cell=3;
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);world.push(v.clone());const key=`${Math.floor(v.x/cell)},${Math.floor(v.z/cell)}`;const g=grid.get(key)||{sum:0,count:0};g.sum+=v.y;g.count++;grid.set(key,g);}
  for(let i=0;i<world.length;i++){const p=world[i],cx=Math.floor(p.x/cell),cz=Math.floor(p.z/cell);let sum=0,n=0,min=Infinity,max=-Infinity;
    for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){const g=grid.get(`${cx+x},${cz+z}`);if(g){const h=g.sum/g.count;sum+=h;n++;min=Math.min(min,h);max=Math.max(max,h);}}
    const local=grid.get(`${cx},${cz}`),localHeight=local.sum/local.count;
    // Remove the broad road grade so a continuous uphill grade cannot become a puddle.
    let curvature=0,pairs=0;for(const [x,z] of [[1,0],[0,1],[1,1],[1,-1]]){const a=grid.get(`${cx+x},${cz+z}`),b=grid.get(`${cx-x},${cz-z}`);if(a&&b){curvature+=(a.sum/a.count+b.sum/b.count)*.5-localHeight;pairs++;}}
    const bowl=pairs?Math.max(0,curvature/pairs):0;values[i*2]=clamp(bowl,0,.035);values[i*2+1]=clamp((max-min)/(cell*2),0,1);
  }
  geometry.setAttribute('anFxHydrology',new THREE.BufferAttribute(values,2));
  return()=>{if(geometry.getAttribute('anFxHydrology')?.array!==values)return;if(previous)geometry.setAttribute('anFxHydrology',previous);else geometry.deleteAttribute('anFxHydrology');};
}
