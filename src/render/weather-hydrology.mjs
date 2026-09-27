import {computeWaterField,computeRoadField} from './hydrology-compute.mjs?v=d280021eea2b85af';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
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
export function createWaterHydrology(THREE,mesh,{jobs}={}){
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const metadata={kind:materials.some(material=>/RIVER/.test(material?.name||''))?'river':'lake',...mesh.userData?.asfaltoWater},boundary=waterBoundarySegments(THREE,mesh),segments=metadata.shoreSegments?.length?metadata.shoreSegments:boundary;
  const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3()),resolution=96,maxDepth=Math.max(.1,Number(metadata.maxDepthM)||(metadata.kind==='river'?2:18));
  const input={segments:new Float64Array(segments.flatMap(({a,b})=>[...a,...b])),bounds:[bounds.min.x,bounds.min.z,size.x,size.z],maxDepth,resolution,depthSamples:new Float64Array((metadata.depthSamples||[]).flat())};
  const controller=new AbortController();let disposed=false;
  const diagnostics={segments:segments.length,depthSource:input.depthSamples.length?(metadata.depthSource||'authored-depth-samples'):'geometric-shore-wedge',maxDepthM:maxDepth,status:jobs?'pending':'ready',worker:!!jobs};
  const texture=new THREE.DataTexture(jobs?new Float32Array(resolution*resolution*4):computeWaterField(input),resolution,resolution,THREE.RGBAFormat,THREE.FloatType);texture.name='AN_GeometricWaterDepthShore';texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  const ready=jobs?jobs.run('water',input,{signal:controller.signal}).catch(error=>{if(disposed)return null;diagnostics.worker=false;diagnostics.fallback=String(error?.message||error);return computeWaterField(input);}).then(values=>{if(disposed||!values)return false;texture.image.data=values;texture.needsUpdate=true;diagnostics.status='ready';return true;}):Promise.resolve(true);
  return{texture,ready,distanceToWater:createWaterDistance(boundary,(bounds.min.y+bounds.max.y)*.5),bounds:new THREE.Vector4(bounds.min.x,bounds.min.z,Math.max(.001,size.x),Math.max(.001,size.z)),metadata,diagnostics,dispose(){if(disposed)return;disposed=true;controller.abort();diagnostics.status='disposed';texture.dispose();}};
}
/** Vertex drainage from neighbouring measured road heights; flat roads retain only a film. */
export function installRoadHydrology(THREE,mesh,{jobs}={}){
  const geometry=mesh.geometry,position=geometry?.attributes.position;if(!position)return()=>{};
  const previous=geometry.getAttribute('anFxHydrology'),positions=new Float64Array(position.count*3),v=new THREE.Vector3();mesh.updateWorldMatrix(true,false);
  for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);positions.set([v.x,v.y,v.z],i*3);}
  const input={positions},values=jobs?new Float32Array(position.count*2):computeRoadField(input),attribute=new THREE.BufferAttribute(values,2),controller=new AbortController();let disposed=false;
  geometry.setAttribute('anFxHydrology',attribute);
  const restore=()=>{if(disposed)return;disposed=true;controller.abort();if(geometry.getAttribute('anFxHydrology')!==attribute)return;if(previous)geometry.setAttribute('anFxHydrology',previous);else geometry.deleteAttribute('anFxHydrology');};
  restore.ready=jobs?jobs.run('road',input,{signal:controller.signal}).catch(()=>disposed?null:computeRoadField(input)).then(result=>{if(disposed||!result||geometry.getAttribute('anFxHydrology')!==attribute)return false;attribute.array.set(result);attribute.needsUpdate=true;return true;}):Promise.resolve(true);
  return restore;
}
