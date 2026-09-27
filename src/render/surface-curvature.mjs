import {bakeRead,bakeWrite,bakeSignature,bakeAttributeInput} from '../tracks/visuals/offline-track-bake.mjs?v=67e9450828b29db5';
/** Geometry-derived signed convexity. Positive = convex with respect to triangle winding.
 * This bounded, seam-welded one-ring estimator is a shading attribute, never displacement. */
const cache = new WeakMap();
const finite = value => Number.isFinite(value) ? value : 0;
export function computeSurfaceCurvature(T, geometry, {maxVertices=80000,maxTriangles=140000,smoothing=1}={}) {
  const position=geometry?.getAttribute?.('position'),index=geometry?.getIndex?.();
  const vertices=position?.count||0,triangles=Math.floor((index?.count||vertices)/3);
  const fail=reason=>({attribute:null,diagnostics:{vertices,triangles,weldedVertices:0,reason,physicalDeltaM:0}});
  if(!vertices||position.itemSize<3)return fail('missing-position');
  if(vertices>maxVertices)return fail('vertex-budget');
  if(triangles>maxTriangles)return fail('triangle-budget');
  const passes=Math.max(0,Math.min(3,Math.round(smoothing)));
  const key=[position,position.version??position.data?.version,position.offset,position.data?.stride,position.normalized,index,index?.version,index?.normalized,passes];
  const prior=cache.get(geometry);
  if(prior&&key.every((v,i)=>v===prior.key[i]))return {attribute:prior.attribute,diagnostics:{...prior.diagnostics,cached:true}};
  const bakeKey='curvature:'+bakeSignature([bakeAttributeInput(position),bakeAttributeInput(index),passes,T.REVISION,finite.toString(),computeSurfaceCurvature.toString()]);
  const baked=bakeRead(bakeKey);
  if(baked&&(Array.isArray(baked.values)||ArrayBuffer.isView(baked.values))&&baked.values.length===vertices&&baked.values.every(Number.isFinite)){
    const attribute=new T.BufferAttribute(new Float32Array(baked.values),1),diagnostics={...baked.diagnostics,cached:true};
    cache.set(geometry,{key,attribute,diagnostics});return {attribute,diagnostics};
  }
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let i=0;i<vertices;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i);if(!Number.isFinite(x+y+z))return fail('non-finite-position');minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);}
  const tolerance=Math.max(1e-7,Math.max(maxX-minX,maxY-minY,maxZ-minZ)*1e-6),weld=new Map(),ids=new Uint32Array(vertices),points=[];
  for(let i=0;i<vertices;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const key=[Math.round((x-minX)/tolerance),Math.round((y-minY)/tolerance),Math.round((z-minZ)/tolerance)].join(',');
    let id=weld.get(key);if(id===undefined){id=points.length;weld.set(key,id);points.push([x,y,z]);}ids[i]=id;
  }
  const count=points.length,normals=new Float64Array(count*3),neighbors=Array.from({length:count},()=>new Set());let degenerateTriangles=0;
  for(let face=0;face<triangles;face++){
    const a=ids[index?index.getX(face*3):face*3],b=ids[index?index.getX(face*3+1):face*3+1],c=ids[index?index.getX(face*3+2):face*3+2];
    if(a===b||b===c||c===a){degenerateTriangles++;continue;}
    const p=points[a],q=points[b],r=points[c],ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=r[0]-p[0],vy=r[1]-p[1],vz=r[2]-p[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(Math.hypot(nx,ny,nz)<tolerance*tolerance){degenerateTriangles++;continue;}
    for(const id of [a,b,c]){normals[id*3]+=nx;normals[id*3+1]+=ny;normals[id*3+2]+=nz;}
    neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);
  }
  let curvature=new Float32Array(count);
  for(let i=0;i<count;i++){
    const length=Math.hypot(normals[i*3],normals[i*3+1],normals[i*3+2]);if(length<1e-15)continue;
    const nx=normals[i*3]/length,ny=normals[i*3+1]/length,nz=normals[i*3+2]/length,p=points[i];let sum=0;
    for(const neighbor of neighbors[i]){const q=points[neighbor],dx=p[0]-q[0],dy=p[1]-q[1],dz=p[2]-q[2],distance=Math.hypot(dx,dy,dz);if(distance>tolerance)sum+=(dx*nx+dy*ny+dz*nz)/distance;}
    curvature[i]=finite(sum/Math.max(1,neighbors[i].size));
  }
  for(let pass=0;pass<passes;pass++){const smoothed=new Float32Array(count);for(let i=0;i<count;i++){let sum=0;for(const neighbor of neighbors[i])sum+=curvature[neighbor];smoothed[i]=curvature[i]*.65+sum/Math.max(1,neighbors[i].size)*.35;}curvature=smoothed;}
  const values=new Float32Array(vertices);let convex=0,concave=0,maximum=0;
  for(let i=0;i<vertices;i++){const value=curvature[ids[i]];values[i]=value;maximum=Math.max(maximum,Math.abs(value));if(value>.005)convex++;else if(value<-.005)concave++;}
  const attribute=new T.BufferAttribute(values,1),diagnostics={vertices,triangles,weldedVertices:count,convexVertices:convex,concaveVertices:concave,maximum,degenerateTriangles,reason:null,cached:false,physicalDeltaM:0};
  bakeWrite(bakeKey,{values:Array.from(values),diagnostics});
  cache.set(geometry,{key,attribute,diagnostics});return {attribute,diagnostics:{...diagnostics}};
}

/** Release cached CPU attribute data when its last presentation owner leaves. */
export function releaseSurfaceCurvatureCache(geometry) { return cache.delete(geometry); }

// Separate metric attribute for POM. Keep computeSurfaceCurvature and its bake
// signature unchanged: the existing baked convexity is dimensionless shading.
const reliefCache=new WeakMap();
export function computeReliefCurvature(T,geometry,{maxVertices=80000,maxTriangles=140000}={}){
 const p=geometry?.getAttribute?.('position'),idx=geometry?.getIndex?.(),count=p?.count||0;
 if(!count||count>maxVertices||(idx?.count||count)/3>maxTriangles)return null;
 const signature=[p,p.version??p.data?.version,idx,idx?.version];
 const cached=reliefCache.get(geometry);if(cached&&signature.every((x,i)=>x===cached.signature[i]))return cached.attribute;
 let span=0;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<count;i++)for(let c=0;c<3;c++){const v=p.getComponent(i,c);if(!Number.isFinite(v))return null;lo[c]=Math.min(lo[c],v);hi[c]=Math.max(hi[c],v);}
 for(let c=0;c<3;c++)span=Math.max(span,hi[c]-lo[c]);
 const epsilon=Math.max(1e-7,span*1e-6),weld=new Map(),points=[],ids=new Uint32Array(count);
 for(let i=0;i<count;i++){const q=[p.getX(i),p.getY(i),p.getZ(i)],key=q.map((v,c)=>Math.round((v-lo[c])/epsilon)).join(',');let id=weld.get(key);if(id===undefined){id=points.length;weld.set(key,id);points.push(q);}ids[i]=id;}
 const normals=new Float64Array(points.length*3),adjacency=Array.from({length:points.length},()=>new Set());
 const faces=Math.floor((idx?.count||count)/3);
 for(let f=0;f<faces;f++){
  const a=ids[idx?idx.getX(f*3):f*3],b=ids[idx?idx.getX(f*3+1):f*3+1],c=ids[idx?idx.getX(f*3+2):f*3+2];
  if(a===b||b===c||a===c)continue;
  const pa=points[a],pb=points[b],pc=points[c];if(!pa||!pb||!pc)continue;
  const ux=pb[0]-pa[0],uy=pb[1]-pa[1],uz=pb[2]-pa[2],vx=pc[0]-pa[0],vy=pc[1]-pa[1],vz=pc[2]-pa[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(nx*nx+ny*ny+nz*nz<epsilon**4)continue;
  for(const i of [a,b,c]){normals[i*3]+=nx;normals[i*3+1]+=ny;normals[i*3+2]+=nz;}
  adjacency[a].add(b).add(c);adjacency[b].add(a).add(c);adjacency[c].add(a).add(b);
 }
 const metric=new Float32Array(points.length);
 for(let i=0;i<points.length;i++){
  const n=i*3,length=Math.hypot(normals[n],normals[n+1],normals[n+2]);if(length<1e-15)continue;
  const q=points[i];let sum=0,weight=0;
  for(const j of adjacency[i]){const r=points[j],x=q[0]-r[0],y=q[1]-r[1],z=q[2]-r[2],d2=x*x+y*y+z*z;if(d2>epsilon*epsilon){sum+=2*(x*normals[n]+y*normals[n+1]+z*normals[n+2])/(length*d2);weight++;}}
  metric[i]=sum/Math.max(1,weight);
 }
 const attribute=new T.BufferAttribute(Float32Array.from(ids,id=>metric[id]),1);
 reliefCache.set(geometry,{signature,attribute});return attribute;
}
