import { terrainHeightSampler } from './reference-landscape.mjs?v=body-r3-20260916';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const terrainNode=o=>o.isMesh&&!o.userData?.asfaltoReplacedTerrain&&!/^(COLLISION_|ASFALTO_TERRAIN_SOURCE_OWNER|RETURN_)/.test(o.name||'')&&(/ENV_Terrain_|TERRAIN_HERO|TERRAIN_TRANSITION/.test(o.name||'')||/^(V2_TERRAIN_PBR|MAT_P1_TERRAIN_|M_Terrain_Andean|MAT_TERRAIN_|MAT_PEAT|MAT_forest_floor|MAT_earthen_bank_PBR)/.test(o.material?.name||''));
export function routeSpatialField(samples,cellM=300){
  const grid=new Map(),segments=[];
  for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],record={a,b};segments.push(record);
    for(let x=Math.floor(Math.min(a.position[0],b.position[0])/cellM);x<=Math.floor(Math.max(a.position[0],b.position[0])/cellM);x++)
      for(let z=Math.floor(Math.min(a.position[2],b.position[2])/cellM);z<=Math.floor(Math.max(a.position[2],b.position[2])/cellM);z++){const key=x+':'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(record);}
  }
  return (x,z,maxDistance=1500)=>{
    const cx=Math.floor(x/cellM),cz=Math.floor(z/cellM),radius=Math.ceil(maxDistance/cellM);let best=null,bestD=maxDistance*maxDistance;
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)for(const {a,b} of grid.get((cx+dx)+':'+(cz+dz))||[]){
      const vx=b.position[0]-a.position[0],vz=b.position[2]-a.position[2],u=clamp(((x-a.position[0])*vx+(z-a.position[2])*vz)/(vx*vx+vz*vz||1),0,1),px=a.position[0]+vx*u,pz=a.position[2]+vz*u,d=(x-px)**2+(z-pz)**2;
      if(d<bestD){bestD=d;best={distance:Math.sqrt(d),height:a.position[1]+(b.position[1]-a.position[1])*u,sM:a.sM+(b.sM-a.sM)*u,widthM:a.widthM+(b.widthM-a.widthM)*u};}
    }return best;
  };
}
// A geometric valley with a maximum 1:4 transverse slope; authored road surfaces
// and the complete original driving envelope remain unchanged.
export function carveReturnValley(THREE,root,returnField,sourceField){
  root.updateMatrixWorld(true);const point=new THREE.Vector3(),inverse=new THREE.Matrix4(),owners=[],report={meshes:0,vertices:0,maxLoweringM:0,sourceEnvelopeProtected:true};
  root.traverse(mesh=>{
    if(!terrainNode(mesh)||mesh.userData.asfaltoReturnValley)return;
    const original=mesh.geometry,p=original.attributes.position,changes=[];
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const q=returnField(point.x,point.z,1600);if(!q)continue;
      const allowed=q.height-.18+.25*(Math.sqrt(q.distance*q.distance+1600)-40);
      if(point.y<=allowed)continue;
      const s=sourceField(point.x,point.z,60),protection=s?smooth((s.distance-s.widthM*.5-1)/8):1;if(protection<=0)continue;
      const nextY=point.y+(allowed-point.y)*protection;
      if(point.y-nextY<.001)continue;changes.push([i,nextY]);report.maxLoweringM=Math.max(report.maxLoweringM,point.y-nextY);
    }
    if(!changes.length)return;
    const geometry=original.clone(),positions=geometry.attributes.position;inverse.copy(mesh.matrixWorld).invert();
    for(const [index,y] of changes){point.fromBufferAttribute(p,index).applyMatrix4(mesh.matrixWorld);point.y=y;point.applyMatrix4(inverse);positions.setXYZ(index,point.x,point.y,point.z);}
    positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;mesh.userData.asfaltoReturnValley={vertices:changes.length,maxSlope:.25};
    const owner=new THREE.Mesh(original);owner.name='ASFALTO_TERRAIN_SOURCE_OWNER_RETURN';owner.visible=false;owner.material.dispose();owner.material=mesh.material;owners.push(owner);report.meshes++;report.vertices+=changes.length;
  });for(const owner of owners)root.add(owner);
  root.userData.asfaltoReturnValley=report;return report;
}
export function createReturnLandscape(THREE,{samples,sourceSamples,sourceRoot,material,id}){
  if(!sourceRoot?.isObject3D)sourceRoot=null;
  const returnField=routeSpatialField(samples),sourceField=routeSpatialField(sourceSamples||[]);
  if(sourceRoot)relocateDistantRidges(THREE,sourceRoot,[...sourceSamples,...samples]);
  const needsValley=sourceRoot&&(id==='dos_lagos'||id==='cuesta_lipan'||id==='cataratas_iguazu'),before=needsValley?terrainHeightSampler(THREE,sourceRoot):null;
  const valley=needsValley?carveReturnValley(THREE,sourceRoot,returnField,sourceField):null;
  const sampler=sourceRoot?terrainHeightSampler(THREE,sourceRoot):null,raw=sampler?.raw||(()=>NaN);
  if(sourceRoot)reprojectValleyScenery(THREE,sourceRoot,before?.raw||raw,raw,returnField);
  const xs=samples.map(s=>s.position[0]),zs=samples.map(s=>s.position[2]),extent=6000;
  const bounds={minX:Math.min(...xs)-extent,maxX:Math.max(...xs)+extent,minZ:Math.min(...zs)-extent,maxZ:Math.max(...zs)+extent};
  const area=(bounds.maxX-bounds.minX)*(bounds.maxZ-bounds.minZ),step=Math.max(75,Math.sqrt(area/125000));
  const nx=Math.ceil((bounds.maxX-bounds.minX)/step),nz=Math.ceil((bounds.maxZ-bounds.minZ)/step),dx=(bounds.maxX-bounds.minX)/nx,dz=(bounds.maxZ-bounds.minZ)/nz,count=(nx+1)*(nz+1);
  const heights=new Float32Array(count),sourceHeight=new Float32Array(count).fill(NaN),nearest=new Int32Array(count).fill(-1),queue=new Int32Array(count);let head=0,tail=0;
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x,wx=bounds.minX+x*dx,wz=bounds.minZ+z*dz,y=raw(wx,wz);if(Number.isFinite(y)){sourceHeight[i]=y;nearest[i]=i;queue[tail++]=i;}}
  while(head<tail){const i=queue[head++],x=i%(nx+1),z=Math.floor(i/(nx+1));for(const j of [x>0?i-1:-1,x<nx?i+1:-1,z>0?i-nx-1:-1,z<nz?i+nx+1:-1])if(j>=0&&nearest[j]<0){nearest[j]=nearest[i];queue[tail++]=j;}}
  const forest=id==='dos_lagos'||id==='paso_garibaldi'||id==='cataratas_iguazu',mean=samples.reduce((n,s)=>n+s.position[1],0)/samples.length;
  function regional(x,z,q){const relief=(forest?100:320)*( .55+.28*Math.sin(x/670+Math.sin(z/940))+.17*Math.cos(z/420-x/1150));return(q?.height??mean)-15+relief;}
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const i=z*(nx+1)+x,wx=bounds.minX+x*dx,wz=bounds.minZ+z*dz,q=returnField(wx,wz,1900);let y=regional(wx,wz,q),known=nearest[i];
    const underlayM=id==='cataratas_iguazu'?24:2;
    if(Number.isFinite(sourceHeight[i]))y=sourceHeight[i]-underlayM;
    else if(known>=0){const sx=known%(nx+1),sz=Math.floor(known/(nx+1)),d=Math.hypot((x-sx)*dx,(z-sz)*dz),u=smooth(d/1800);y=sourceHeight[known]-underlayM+(y-sourceHeight[known]+underlayM)*u;}
    if(q){const valleyY=q.height-2+.25*(Math.sqrt(q.distance*q.distance+1600)-40);y=Math.min(y,valleyY);if(q.distance<140)y=Math.min(y,q.height-3);}
    const authored=sourceField(wx,wz,id==='cuesta_lipan'?1600:180);
    if(authored){
      // A 180m hard cutoff raised adjacent grid cells by hundreds of metres.
      // Continue the same underlay cap into a footslope, then merge into relief.
      const clearance=Math.max(0,authored.distance-authored.widthM*.5-8);
      const envelope=id==='cuesta_lipan'?authored.height-20+.38*(Math.sqrt(clearance*clearance+1600)-40):authored.height-20+clearance*.12;
      y=Math.min(y,envelope);
    }
    heights[i]=y;
  }
  function heightAt(x,z){const gx=clamp((x-bounds.minX)/dx,0,nx-.000001),gz=clamp((z-bounds.minZ)/dz,0,nz-.000001),ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*(nx+1)+ix;return heights[i]*(1-u)*(1-v)+heights[i+1]*u*(1-v)+heights[i+nx+1]*(1-u)*v+heights[i+nx+2]*u*v;}
  const positions=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const i=z*(nx+1)+x;positions.set([bounds.minX+x*dx,heights[i],bounds.minZ+z*dz],i*3);uv.set([x*dx/10,z*dz/10],i*2);if(x<nx&&z<nz)indices.push(i,i+nx+1,i+nx+2,i,i+nx+2,i+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='RETURN_REGIONAL_TERRAIN';mesh.receiveShadow=true;mesh.userData.asfaltoReturnLandscape={bounds,stepM:step,vertices:count,sourceSamplesPreserved:true,valley};
  return {mesh,heightAt,returnField,carveSourceTerrain:root=>(id==='dos_lagos'||id==='cuesta_lipan'||id==='cataratas_iguazu')?carveReturnValley(THREE,root,returnField,sourceField):null};
}

function relocateDistantRidges(T,root,samples){
  const xs=samples.map(s=>s.position[0]),zs=samples.map(s=>s.position[2]),centerX=(Math.min(...xs)+Math.max(...xs))/2,centerZ=(Math.min(...zs)+Math.max(...zs))/2,halfX=(Math.max(...xs)-Math.min(...xs))/2,halfZ=(Math.max(...zs)-Math.min(...zs))/2;
  root.traverse(mesh=>{
    // Geographic relief has an explicitly audited scenic matrix, never an elliptical envelope.
    if(!mesh.userData?.asfaltoDistantRidge||mesh.userData.asfaltoClosedRidge||mesh.userData.asfaltoGeographicDEM)return;
    const layer=mesh.userData.asfaltoDistantRidge.layer,p=mesh.geometry.attributes.position,box=new T.Box3().setFromBufferAttribute(p),oldX=(box.min.x+box.max.x)/2,oldZ=(box.min.z+box.max.z)/2,oldRx=(box.max.x-box.min.x)/3.6,oldRz=(box.max.z-box.min.z)/3.6;
    let rx=halfX+4200+layer*1900,rz=halfZ+4200+layer*1900,clearance=1;
    for(const s of samples)clearance=Math.max(clearance,Math.hypot((s.position[0]-centerX)/rx,(s.position[2]-centerZ)/rz)*1.05);
    rx*=clearance;rz*=clearance;
    for(let i=0;i<p.count;i++)p.setXYZ(i,centerX+(p.getX(i)-oldX)/oldRx*rx,p.getY(i),centerZ+(p.getZ(i)-oldZ)/oldRz*rz);
    p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.userData.asfaltoClosedRidge={rx,rz,clearanceM:4200};
  });
}
function reprojectValleyScenery(T,root,before,after,returnField){
  let moved=0,removed=0;const map=(x,z,y,radiusM=4.5)=>{const road=returnField(x,z,Math.max(30,radiusM+10));if(road&&road.distance<road.widthM*.5+radiusM){removed++;return null;}const a=before(x,z),b=after(x,z);return Number.isFinite(a)&&Number.isFinite(b)&&a-b>.35?y+b-a:NaN;};
  root.updateMatrixWorld(true);const matrix=new T.Matrix4(),point=new T.Vector3();
  root.traverse(mesh=>{
    if(/ASFALTO_DETAIL_(guard-|continuous-guardrail|guard-terminal|sign-|curve-approach|retaining-wall|kilometre-post|culvert-headwall)/.test(mesh.name))return;
    if(typeof mesh.userData?.asfaltoReprojectInstances==='function'){moved+=mesh.userData.asfaltoReprojectInstances(map);return;}
    if(!mesh.isInstancedMesh||!/^Forest canopy /.test(mesh.name))return;
    const inverse=mesh.matrixWorld.clone().invert();let changed=false;
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);const y=map(point.x,point.z,point.y);if(y===null){matrix.scale(new T.Vector3(0,0,0));mesh.setMatrixAt(i,matrix);changed=true;continue;}if(!Number.isFinite(y))continue;point.y=y;point.applyMatrix4(inverse);matrix.setPosition(point);mesh.setMatrixAt(i,matrix);moved++;changed=true;}
    if(changed){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  });root.userData.asfaltoValleySceneryMoved=moved;root.userData.asfaltoReturnSceneryExcluded=removed;
}

