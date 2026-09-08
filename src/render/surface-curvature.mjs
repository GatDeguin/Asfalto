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
  const key=[position,position.version,index,index?.version,passes];
  const prior=cache.get(geometry);
  if(prior&&key.every((v,i)=>v===prior.key[i]))return {attribute:prior.attribute,diagnostics:{...prior.diagnostics,cached:true}};
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
  cache.set(geometry,{key,attribute,diagnostics});return {attribute,diagnostics:{...diagnostics}};
}

/** Release cached CPU attribute data when its last presentation owner leaves. */
export function releaseSurfaceCurvatureCache(geometry) { return cache.delete(geometry); }
