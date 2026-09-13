
/**
 * Lipan-only visual replacement. Reads one sector's COLLISION_BARRIER mesh;
 * never edits colliders, route, other furniture, or assets.
 * Folded section is an authored approximation of FHWA M617-10 (312 x 83 mm).
 * Placement comes solely from the game collider, not a claim about RN52 as built.
 */
export function readSectorBarrierRuns(THREE, collisionRoot, sectorId) {
 if(!/^S\d{2}$/.test(sectorId)||!collisionRoot?.isObject3D)throw new TypeError('A single Lipan collision sector is required');
 collisionRoot.updateMatrixWorld(true);
 const nodes=new Map(),edges=[],sources=[];
 const pointKey=p=>p.toArray().map(v=>v.toFixed(5)).join(',');
 const key=(a,b)=>[pointKey(a),pointKey(b)].sort().join('|');
 function node(a,b){
  if(a.y>b.y)[a,b]=[b,a];const k=key(a,b);
  if(!nodes.has(k))nodes.set(k,{key:k,bottom:a.clone(),top:b.clone(),center:a.clone().add(b).multiplyScalar(.5),edges:[]});
  return nodes.get(k);
 }
 collisionRoot.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.name.startsWith(sectorId+'_COLLISION_BARRIER'))return;
  const g=mesh.geometry,p=g?.attributes?.position,index=g?.index,count=index?.count??p?.count??0;
  if(count%6!==0)throw new TypeError('Unsupported barrier triangle topology: '+mesh.name);
  sources.push(mesh.name);
  const vertex=i=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);
  for(let i=0;i<count;i+=6){
   const a=vertex(i),b=vertex(i+1),c=vertex(i+2),aa=vertex(i+3),cc=vertex(i+4),d=vertex(i+5);
   if(a.distanceTo(aa)>1e-5||c.distanceTo(cc)>1e-5||a.distanceTo(d)>.9||b.distanceTo(c)>.9)throw new TypeError('Unsupported barrier quad: '+mesh.name);
   const first=node(a,d),last=node(b,c);
   if(first===last)continue;
   const edgeKey=[first.key,last.key].sort().join('>');
   if(edges.some(e=>e.key===edgeKey))continue;
   const e={key:edgeKey,a:first,b:last};edges.push(e);first.edges.push(e);last.edges.push(e);
  }
 });
 for(const n of nodes.values())if(n.edges.length>2)throw new TypeError('Branched collision barrier cannot form one rail');
 const visited=new Set(),runs=[];
 function walk(start){
  const run=[start];let at=start;
  while(true){const edge=at.edges.find(e=>!visited.has(e));if(!edge)break;visited.add(edge);at=edge.a===at?edge.b:edge.a;run.push(at);}
  if(run.length>1)runs.push(run);
 }
 for(const n of nodes.values())if(n.edges.length===1)walk(n);
 for(const edge of edges)if(!visited.has(edge))walk(edge.a);
 return {sectorId,runs,sources,segments:edges.length};
}

export function addSectorCollisionGuardrails(THREE, root, {collisionRoot,sectorId,query,heightAt}) {
 const existing=root.userData.asfaltoCollisionGuardrails;
 if(existing){if(existing.sectorId!==sectorId)throw new TypeError('Visual root already owns another sector');return existing;}
 // Validate every source quad before changing any source visibility.
 const data=readSectorBarrierRuns(THREE,collisionRoot,sectorId),group=new THREE.Group();
 group.name='ASFALTO_COLLISION_GUARDRAILS_'+sectorId;
 root.updateMatrixWorld(true);group.matrix.copy(root.matrixWorld).invert();group.matrixAutoUpdate=false;
 const railPos=[],railIndex=[],postPos=[],postIndex=[],diagnosticRuns=[],postSupports=[],hidden=[],fillPositions=[],fillIndices=[];
 const profile=[[.040,-.156],[.012,-.142],[0,-.102],[.064,-.047],[.083,0],[.064,.047],[0,.102],[.012,.142],[.040,.156]].map(([x,y])=>[x-.0415,y]);
 const thickness=.003,section=profile.concat([...profile].reverse().map(([x,y])=>[x+thickness,y])),sectionCount=section.length;
 const unitY=new THREE.Vector3(0,1,0);
 const supportMeshes=[],supportRay=new THREE.Raycaster();
 root.traverse(mesh=>{if(mesh.isMesh&&new RegExp('^(?:'+sectorId+'_(?:SHOULDER|ROADBED)|V2_ROAD_DETAIL_'+sectorId+'_SHOULDER_BLEND)').test(mesh.name))supportMeshes.push(mesh);});

 function shoulderAt(point){
  supportRay.set(new THREE.Vector3(point.x,point.y+2,point.z),new THREE.Vector3(0,-1,0));supportRay.near=0;supportRay.far=12;
  return supportRay.intersectObjects(supportMeshes,false).find(h=>h.point.y<point.y+.06);
 }
 function supportAt(axis,normal){
  const terrain=heightAt(axis.x,axis.z),direct=shoulderAt(axis);
  if(direct&&(!Number.isFinite(terrain)||direct.point.y>=terrain))return{height:direct.point.y,source:'authored-shoulder'};
  // The authored shoulder ends before the barrier, while the old transition
  // starts farther outside. Extend only this missing support, from a measured
  // shoulder point to a measured terrain toe; never move the road or collider.
  for(const inset of[.30,.50,.70,1.0,1.3]){
   const inner=axis.clone().addScaledVector(normal,-inset),projection=query.project(inner.toArray());
   if(Math.abs(projection.lateralM)<projection.widthM/2+.08)continue;
   const hit=shoulderAt(inner);if(!hit)continue;
   const f=projection.frame.left,planeY=point=>hit.point.y+((point.x-inner.x)*f[0]+(point.z-inner.z)*f[2])*f[1];
   const height=planeY(axis);
   if(Number.isFinite(terrain)&&height-terrain<.25)break;
   inner.y=hit.point.y;const edge=axis.clone().addScaledVector(normal,.18);edge.y=planeY(edge);
   const toe=axis.clone().addScaledVector(normal,1.40),toeY=heightAt(toe.x,toe.z);
   if(!Number.isFinite(toeY)||toeY>edge.y+.2)break;
   toe.y=toeY;
   return{height,source:'anchored-shoulder-fill',footprint:[inner,edge,toe]};
  }
  return{height:terrain,source:'terrain'};
 }
 function fillTriangle(a,b,c){
  const p=i=>new THREE.Vector3(...fillPositions.slice(i*3,i*3+3));
  if(p(b).sub(p(a)).cross(p(c).sub(p(a))).y<0)[b,c]=[c,b];
  fillIndices.push(a,b,c);
 }

 function addBox(center,right,depth,width,height,length){
  const base=postPos.length/3;
  for(const y of[-.5,.5])for(const z of[-.5,.5])for(const x of[-.5,.5]){
   const v=center.clone().addScaledVector(right,x*width).addScaledVector(unitY,y*height).addScaledVector(depth,z*length);postPos.push(...v.toArray());
  }
  for(const face of[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])postIndex.push(base+face[0],base+face[1],base+face[2],base+face[0],base+face[2],base+face[3]);
 }
 function frame(run,index){
  const n=run[index],up=n.top.clone().sub(n.bottom).normalize(),tangent=run[Math.min(run.length-1,index+1)].center.clone().sub(run[Math.max(0,index-1)].center).normalize(),projection=query.project(n.center.toArray()),away=new THREE.Vector3(...projection.frame.left).multiplyScalar(Math.sign(projection.lateralM)||1);
  const normal=tangent.clone().cross(up).normalize();if(normal.dot(away)<0)normal.negate();
  return {up,normal,tangent,projection};
 }
 for(const run of data.runs){
  const frames=run.map((_,i)=>frame(run,i)),start=railPos.length/3,record={nodes:[],postCount:0};let previousFill=null;
  for(let i=0;i<run.length;i++){
   const n=run[i],f=frames[i];
   record.nodes.push({center:n.center.toArray(),bottom:n.bottom.toArray(),top:n.top.toArray(),normal:f.normal.toArray(),up:f.up.toArray(),sM:f.projection.sM,lateralM:f.projection.lateralM,vertexOffset:railPos.length/3});
   // Every adjacent span shares the exact same indexed ring: no pitch/yaw Euler,
   // independent end-cap or coincident duplicate at bank/grade changes.
   for(const [x,y]of section)railPos.push(...n.center.clone().addScaledVector(f.normal,x).addScaledVector(f.up,y).toArray());
   if(i)for(let j=0;j<sectionCount;j++){const a=start+(i-1)*sectionCount+j,b=start+i*sectionCount+j,k=(j+1)%sectionCount;railIndex.push(a,b,start+(i-1)*sectionCount+k,b,start+i*sectionCount+k,start+(i-1)*sectionCount+k);}
  }
  // Close the thin sheet at both free ends without extending beyond the collider.
  for(const i of[0,run.length-1])for(let j=0;j<profile.length-1;j++){const a=start+i*sectionCount+j,b=start+i*sectionCount+sectionCount-1-j,c=start+i*sectionCount+j+1,d=start+i*sectionCount+sectionCount-2-j;railIndex.push(a,b,c,c,b,d);}
  for(let i=0;i<run.length-1;i++){
   const a=run[i],b=run[i+1],distance=a.center.distanceTo(b.center),count=Math.max(1,Math.ceil(distance/1.905));
   for(let j=0;j<count+(i===run.length-2?1:0);j++){
    const t=j/count,center=a.center.clone().lerp(b.center,t),normal=frames[i].normal.clone().lerp(frames[i+1].normal,t).normalize(),along=unitY.clone().cross(normal).normalize();
    const axis=center.clone().addScaledVector(normal,.13),support=supportAt(axis,normal),sampled=support.height,q=query.project(axis.toArray()),road=query.sample(q.sM),routeBase=road.position[1]+road.frame.left[1]*q.lateralM;
    const ground=Number.isFinite(sampled)?sampled:routeBase,top=center.y+.085,bottom=ground-.14,height=top-bottom;
    if(height<=.10)throw new RangeError('Terrain covers barrier post in '+sectorId+' at '+q.sM);
    if(support.footprint){
     const rows=[];
     // The end post has a finite footprint: the support extends 12 cm behind
     // and beyond that footprint, while the metal still ends at the collider.
     const tangent=b.center.clone().sub(a.center).normalize();
     if(previousFill===null)rows.push(support.footprint.map(p=>p.clone().addScaledVector(tangent,-.12)));
     rows.push(support.footprint);
     if(i===run.length-2&&j===count)rows.push(support.footprint.map(p=>p.clone().addScaledVector(tangent,.12)));
     for(const points of rows){
      const row=fillPositions.length/3;for(const p of points)fillPositions.push(...p.toArray());
      if(previousFill!==null){for(let k=0;k<2;k++){fillTriangle(previousFill+k,row+k,row+k+1);fillTriangle(previousFill+k,row+k+1,previousFill+k+1);}}
      else fillTriangle(row,row+1,row+2);
      previousFill=row;
     }
    }else if(previousFill!==null){
     const row=fillPositions.length/3,tangent=b.center.clone().sub(a.center).normalize();
     for(let k=0;k<3;k++)fillPositions.push(...new THREE.Vector3(...fillPositions.slice((previousFill+k)*3,(previousFill+k)*3+3)).addScaledVector(tangent,.12).toArray());
     for(let k=0;k<2;k++){fillTriangle(previousFill+k,row+k,row+k+1);fillTriangle(previousFill+k,row+k+1,previousFill+k+1);}fillTriangle(row,row+1,row+2);previousFill=null;
    }
    const postCenter=new THREE.Vector3(axis.x,(top+bottom)/2,axis.z);
    // Folded open channel, three connected plates; embedded toe reaches support.
    addBox(postCenter,along,normal,.100,height,.008);
    for(const sign of[-1,1])addBox(postCenter.clone().addScaledVector(along,sign*.046).addScaledVector(normal,.036),along,normal,.008,height,.072);
    // Blockout meets the centre fold; one part reaches both rail and post web.
    const bracket=center.clone().addScaledVector(normal,.08575);addBox(bracket,along,normal,.065,.100,.0885);
    postSupports.push({sM:q.sM,position:axis.toArray(),groundY:ground,bottomY:bottom,topY:top,heightM:height,support:Number.isFinite(sampled)?support.source:'route-fallback',fillFootprint:support.footprint?.map(p=>p.toArray())});
    record.postCount++;
   }
  }
  if(previousFill!==null)fillTriangle(previousFill,previousFill+1,previousFill+2);
  diagnosticRuns.push(record);
 }
 const owned=new Set(),restore=[];
 if(railPos.length){
  const material=new THREE.MeshStandardMaterial({name:'ASFALTO_COLLISION_GUARDRAIL_GALVANIZED',color:'#808780',metalness:.42,roughness:.68,side:THREE.DoubleSide});
  material.userData.advancedMaterials=false;owned.add(material);
  for(const [name,p,index]of[['Rail',railPos,railIndex],['Posts',postPos,postIndex]]){
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();owned.add(g);
   const m=new THREE.Mesh(g,material);m.name='ASFALTO_COLLISION_GUARDRAIL_'+name+'_'+sectorId;m.receiveShadow=true;group.add(m);
  }
 }
 if(fillIndices.length){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(fillPositions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(fillPositions.flatMap((v,i)=>i%3===0?[v/3,fillPositions[i+2]/3]:[]),2));g.setIndex(fillIndices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();owned.add(g);
  const surface=supportMeshes.find(m=>/SHOULDER/.test(m.name))?.material||supportMeshes[0]?.material;
  if(!surface)throw new TypeError('Shoulder support material missing');
  const mesh=new THREE.Mesh(g,surface);mesh.name='ASFALTO_COLLISION_GUARDRAIL_Support_'+sectorId;mesh.receiveShadow=true;group.add(mesh);
 }
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.name.startsWith('V2_FURNITURE_'+sectorId+'_GUARDRAIL'))return;
  restore.push([mesh,mesh.visible]);mesh.visible=false;hidden.push(mesh.name);
 });
 root.add(group);group.updateMatrixWorld(true);
 const result={sectorId,metres:data.runs.reduce((sum,run)=>sum+run.slice(1).reduce((n,p,i)=>n+p.center.distanceTo(run[i].center),0),0),sourceMeshes:data.sources,segments:data.segments,runs:diagnosticRuns,posts:postSupports,hiddenAuthoredMeshes:hidden,drawCalls:railPos.length?(fillIndices.length?3:2):0,supportTriangles:fillIndices.length/3,triangles:(railIndex.length+postIndex.length+fillIndices.length)/3,sectionM:{height:.312,depth:.083,thickness},source:'sector collision quads',fallbackSupportPosts:postSupports.filter(p=>p.support==='route-fallback').length};
 let disposed=false;
 Object.defineProperty(result,'dispose',{enumerable:false,value:()=>{
  if(disposed)return;disposed=true;group.removeFromParent();for(const [mesh,visible]of restore)mesh.visible=visible;for(const resource of owned)resource.dispose();owned.clear();if(root.userData.asfaltoCollisionGuardrails===result)delete root.userData.asfaltoCollisionGuardrails;
 }});
 root.userData.asfaltoCollisionGuardrails=result;return result;
}

