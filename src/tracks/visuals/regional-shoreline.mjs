import {buildShorePromontory,shorelineFromGeometry} from './shore-promontory.mjs?v=5f5256d2401f842d';
// Extract actual terrain/water intersections for hydrology and terrain-conforming shores.
export function refineRegionalShoreline(THREE,root,{id,query,heightAt,textures}){
  if(id!=='dos_lagos'&&id!=='paso_garibaldi')return {shoreSegments:0,shoreBanks:0};
  root.updateMatrixWorld(true);const waters=[],terrains=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.geometry?.drawRange.count===0||/COLLISION_|SOURCE_OWNER/.test(mesh.name))return;
    const names=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m?.name||'').join(' ');
    if(/^(M_Lake_Water|MAT_WATER)$/.test(names))waters.push({mesh,box:new THREE.Box3().setFromObject(mesh),segments:[],promontories:[]});
    else if(mesh.userData.asfaltoTerrainRefinement)terrains.push(mesh);
  });
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),positions=[],uv=[],colors=[],indices=[];
  let banks=0;const headlands=[],headlandMaterial=new THREE.MeshStandardMaterial({map:textures.gravel_floor?.diff||null,normalMap:textures.gravel_floor?.normal||null,color:id==='dos_lagos'?'#817e62':'#607064',roughness:.9,side:THREE.DoubleSide});headlandMaterial.userData.asfaltoSnow=true;
  for(const {mesh:terrain}of terrains.map(mesh=>({mesh}))){const g=terrain.geometry,p=g.attributes.position,index=g.index;
    for(let i=0;i<(index?.count||p.count);i+=3){
      a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(terrain.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(terrain.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(terrain.matrixWorld);
      for(const water of waters){const level=water.box.max.y;if(Math.min(a.y,b.y,c.y)>level+.15||Math.max(a.y,b.y,c.y)<level-.15)continue;
        const hits=[];for(const[v,w]of [[a,b],[b,c],[c,a]])if((v.y-level)*(w.y-level)<0){const t=(level-v.y)/(w.y-v.y);hits.push(v.clone().lerp(w,t));}
        if(hits.length!==2||hits[0].distanceToSquared(hits[1])<1)continue;
        const center=hits[0].clone().lerp(hits[1],.5);if(center.x<water.box.min.x-2||center.x>water.box.max.x+2||center.z<water.box.min.z-2||center.z>water.box.max.z+2)continue;
        water.segments.push({a:hits[0].toArray(),b:hits[1].toArray()});
        if(banks>=100||water.segments.length%7!==0)continue;
        const route=query.project(center.toArray());if(route.distanceXZ<route.widthM/2+16)continue;
        // Small nonuniform gravel promontories meet the existing terrain and dip below water.
        // Their bases are hidden in the actual shoreline, so there is no floating strip.
        const tangent=hits[1].clone().sub(hits[0]).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x);
        const landA=heightAt.raw?.(center.x+normal.x*4,center.z+normal.z*4),landB=heightAt.raw?.(center.x-normal.x*4,center.z-normal.z*4);
        if(!Number.isFinite(landA)||!Number.isFinite(landB))continue;if(landB>landA)normal.negate();
        const start=positions.length/3,length=Math.min(28,hits[0].distanceTo(hits[1])*.85),width=2.4+Math.sin(center.x*.041+center.z*.017)*.8;
        for(let row=0;row<=5;row++)for(let col=0;col<=8;col++){
          const along=(col/8-.5)*length,across=(row/5-.4)*width*2,point=center.clone().addScaledVector(tangent,along).addScaledVector(normal,across);
          const raw=heightAt.raw?.(point.x,point.z);const edge=Math.sin(col/8*Math.PI),hump=edge*Math.exp(-across*across/5)*.32;
          point.y=Number.isFinite(raw)?Math.max(level-.42,raw)+hump+.025:level-.4;
          positions.push(point.x,point.y,point.z);uv.push(along/3,across/3);colors.push(1,1,1,(row===0||row===5?0:.65)*edge);
          if(row<5&&col<8){const k=start+row*9+col;indices.push(k,k+1,k+10,k,k+10,k+9);}
        }banks++;
      }
    }
  }
  for(const water of waters){
    const original=[...water.segments];
    for(let i=0;i<original.length&&water.promontories.length<8;i+=13){
      const segment=original[i],center=new THREE.Vector3().fromArray(segment.a).lerp(new THREE.Vector3().fromArray(segment.b),.5),route=query.project(center.toArray());
      if(route.distanceXZ<route.widthM/2+48||water.promontories.some(p=>Math.hypot(center.x-p.center[0],center.z-p.center[2])<220))continue;
      const tangent=new THREE.Vector3().fromArray(segment.b).sub(new THREE.Vector3().fromArray(segment.a)).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x),h=heightAt.raw||heightAt;
      const yA=h(center.x+normal.x*12,center.z+normal.z*12),yB=h(center.x-normal.x*12,center.z-normal.z*12);if(!Number.isFinite(yA)||!Number.isFinite(yB))continue;if(yB>yA)normal.negate();
      if(Math.max(yA,yB)>water.box.max.y+5||Math.min(yA,yB)>water.box.max.y-.2)continue;
      const options={center:center.toArray(),tangent:tangent.toArray(),landNormal:normal.toArray(),waterLevelM:water.box.max.y,heightAt:h,lengthM:52+Math.abs(Math.sin(center.x)) *20,extensionM:14+Math.abs(Math.sin(center.z)) *7};
      const g=buildShorePromontory(THREE,options);if(!g)continue;let clear=true;const p=g.attributes.position;
      for(let j=0;j<p.count;j++){const q=query.project([p.getX(j),p.getY(j),p.getZ(j)]);if(q.distanceXZ<q.widthM/2+20){clear=false;break;}}
      if(!clear){g.dispose();continue;}const mesh=new THREE.Mesh(g,headlandMaterial);mesh.name='ASFALTO_SHORE_HEADLAND_'+headlands.length;mesh.receiveShadow=true;mesh.matrix.copy(root.matrixWorld).invert();mesh.matrixAutoUpdate=false;root.add(mesh);
      const shape={...options,heightAt:undefined,shoreSegments:shorelineFromGeometry(THREE,g,water.box.max.y)};water.promontories.push(shape);headlands.push(shape);
    }
    for(const shape of water.promontories){water.segments=water.segments.filter(segment=>{const p=segment.a.map((v,i)=>(v+segment.b[i])*.5-shape.center[i]),along=p.reduce((sum,v,i)=>sum+v*shape.tangent[i],0);return Math.abs(along)>shape.lengthM*.44||Math.hypot(p[0],p[2])>shape.lengthM*.6;});water.segments.push(...shape.shoreSegments);}
  }
  let littoralStones=0;
  for(const water of waters){
    const items=planLittoralStones({segments:water.segments,levelM:water.box.max.y,heightAt:heightAt.raw||heightAt,query});
    if(!items.length)continue;
    const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.91+.09*Math.sin(x*3.1+z*4.7+y*2.3);p.setXYZ(i,x*f,y*f,z*f);}
    g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({name:'ASFALTO_LITTORAL_STONE',map:textures.aerial_rocks_04?.diff||null,normalMap:textures.aerial_rocks_04?.normal||null,color:id==='dos_lagos'?'#777e71':'#59665d',roughness:.76,metalness:0,envMapIntensity:.2});
    m.userData.asfaltoSnow=true;m.userData.asfaltoSurfaceRole='rock';
    const stones=new THREE.InstancedMesh(g,m,items.length),dummy=new THREE.Object3D();
    items.forEach((item,i)=>{dummy.position.fromArray(item.position);dummy.rotation.y=item.rotation;dummy.scale.fromArray(item.scale);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);});
    stones.name='ASFALTO_LITTORAL_STONE_BED';stones.matrix.copy(root.matrixWorld).invert();stones.matrixAutoUpdate=false;stones.receiveShadow=true;stones.instanceMatrix.needsUpdate=true;stones.computeBoundingBox();stones.computeBoundingSphere();root.add(stones);littoralStones+=items.length;
  }
  if(!headlands.length)headlandMaterial.dispose();else root.userData.asfaltoShoreHeadlands=headlands;
  // Optical art direction uses the real shore intersections. The depth wedge is
  // derived scenery, not measured bathymetry; sparse shore samples must not be
  // interpolated across the entire lake as if they described its unseen bed.
  const optics=id==='dos_lagos'
    ?{shallowColor:'#52715c',deepColor:'#12383d',absorptionPerMeter:.16,roughness:.14,attenuationDistanceM:10}
    :{shallowColor:'#68735e',deepColor:'#203b3e',absorptionPerMeter:.2,roughness:.18,attenuationDistanceM:8};
  for(const water of waters)water.mesh.userData.asfaltoWater={...(water.mesh.userData.asfaltoWater||{}),...optics,kind:'lake',maxDepthM:35,shoreWidthM:id==='dos_lagos'?6:8,depthSource:'derived-geometric-shore-wedge-not-surveyed-bathymetry',opticalSource:'regional-art-direction-awaiting-rendered-reference-comparison',flowDirection:{x:.82,z:.57},flowSpeedMps:0,shoreSegments:water.segments};
  if(indices.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
    const maps=textures.gravel_floor,m=new THREE.MeshStandardMaterial({map:maps?.diff||null,normalMap:maps?.normal||null,color:id==='dos_lagos'?'#9d9b7b':'#687768',roughness:.73,transparent:true,vertexColors:true,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,m);mesh.name='ASFALTO_SHORE_COVES_AND_PROMONTORIES';mesh.receiveShadow=true;mesh.matrix.copy(root.matrixWorld).invert();mesh.matrixAutoUpdate=false;root.add(mesh);}
  return {shoreSegments:waters.reduce((n,w)=>n+w.segments.length,0),shoreBanks:banks,shorePromontories:headlands.length,littoralStones};
}

// Sparse stones have real shallow-water support. No foam ribbon, no arbitrary
// placement over deep water, and no interference with a nearby bend.
export function planLittoralStones({segments,levelM,heightAt,query,maxStones=96}){
 const stones=[],rand=n=>{const x=Math.sin(n*17.13+9.4)*41381.2;return x-Math.floor(x);};
 for(let i=0;i<segments.length&&stones.length<maxStones;i++){
  const {a,b}=segments[i],x=(a[0]+b[0])*.5,z=(a[2]+b[2])*.5,seed=x*.027+z*.049;
  if(rand(seed)<.42||stones.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<9))continue;
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
  for(const sign of [-1,1]){
   const inset=.6+rand(seed+2)*2,px=x-dz/length*inset*sign,pz=z+dx/length*inset*sign,y=heightAt(px,pz);
   if(!Number.isFinite(y)||y>levelM+.08||y<levelM-1.2)continue;
   const road=query.project([px,y,pz]);if(road.distanceXZ<road.widthM/2+17)continue;
   const radius=.22+rand(seed+4)*.58;
   stones.push({position:[px,y-radius*.18,pz],scale:[radius*1.45,radius*.8,radius],rotation:rand(seed+5)*Math.PI*2});break;
  }
 }
 return stones;
}
