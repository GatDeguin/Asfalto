// Deform disconnected decorative rocks independently. Terrain and collider buffers excluded.
const hash=n=>{const a=Math.sin(n*17.319+5.13)*43758.5453;return a-Math.floor(a);};
export function screeSizeFactor({heightM,roadHeightM,releaseHeightM}){const span=releaseHeightM-roadHeightM;if(!(span>2))return 1;const fraction=Math.max(0,Math.min(1,(heightM-roadHeightM)/span));return .48+fraction*.94;}
export function refineRegionalBoulders(THREE,root,{id,query,heightAt}){
  const meshes=[];root.updateMatrixWorld(true);root.traverse(mesh=>{
    if(mesh.isMesh&&!mesh.userData.asfaltoBoulderRefinement&&!/COLLISION_|SOURCE_OWNER|ASFALTO_/.test(mesh.name)&&/ROCK|Rock|BOULDER/.test(mesh.name+' '+mesh.parent?.name)&&!/TERRAIN|Terrain/.test(mesh.name+' '+mesh.parent?.name)&&mesh.geometry?.attributes.position)meshes.push(mesh);
  });let componentsChanged=0;
  for(const mesh of meshes){const original=mesh.geometry,p=original.attributes.position,index=original.index,parents=Array.from({length:p.count},(_,i)=>i),lookup=new Map(),point=new THREE.Vector3();
    const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;},join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[a]=b;};
    for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1000)).join(':');if(lookup.has(key))join(i,lookup.get(key));else lookup.set(key,i);}
    for(let i=0;i<(index?.count||p.count);i+=3){const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;join(a,b);join(b,c);}
    const groups=new Map();for(let i=0;i<p.count;i++){const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
    const geometry=original.clone(),positions=geometry.attributes.position,inverse=mesh.matrixWorld.clone().invert();let changed=0;
    for(const ids of groups.values()){
      const bounds=new THREE.Box3();for(const i of ids)bounds.expandByPoint(point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
      const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());if(size.length()>85||size.y<.25||size.x<.2)continue;
      const ground=heightAt(center.x,center.z);if(!Number.isFinite(ground))continue;
      const q=query.project([center.x,ground,center.z]),clear=q.distanceXZ-(q.widthM||8)/2;if(clear<3.3)continue;
      const seed=center.x*.04+center.z*.13,angle=hash(seed)*Math.PI*2,ca=Math.cos(angle),sa=Math.sin(angle);
      let gravityScale=1;
      if(id==='aconcagua_horcones'){
        const road=query.sample(q.sM),sign=Math.sign(q.lateralM||((center.x-road.position[0])*road.frame.left[0]+(center.z-road.position[2])*road.frame.left[2]))||1;
        const release=road.position.map((v,i)=>v+road.frame.left[i]*sign*85),releaseY=heightAt(release[0],release[2]);
        gravityScale=screeSizeFactor({heightM:ground,roadHeightM:road.position[1],releaseHeightM:releaseY});
      }
      const variation=(.5+hash(seed+3)*.7)*gravityScale,sx=Math.min(variation*1.3,(clear-2.5)/Math.max(.1,Math.hypot(size.x,size.z)*.55)),sz=sx*(.55+hash(seed+17)*.6),sy=.55+hash(seed+31)*.68;
      const radiusX=Math.max(.01,size.x/2),radiusZ=Math.max(.01,size.z/2),buried=.15+hash(seed+21)*.23;
      for(const i of ids){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const x=(point.x-center.x)/radiusX,z=(point.z-center.z)/radiusZ;
        const px=Math.sign(x)*Math.pow(Math.abs(x),.78)*radiusX*sx,pz=Math.sign(z)*Math.pow(Math.abs(z),.78)*radiusZ*sz;
        point.set(center.x+px*ca-pz*sa,ground+(point.y-bounds.min.y-size.y*buried)*sy+(x-z)*size.y*.08,center.z+px*sa+pz*ca).applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);
      }changed++;
    }
    if(changed){geometry.deleteAttribute('tangent');geometry.computeVertexNormals();geometry.computeBoundingSphere();mesh.geometry=geometry;const owner=new THREE.Mesh(original,mesh.material);owner.name='ASFALTO_BOULDER_SOURCE_OWNER';owner.visible=false;mesh.add(owner);mesh.userData.asfaltoBoulderRefinement={components:changed,buried:true,clearanceM:2.5,gravitySorted:id==='aconcagua_horcones'};componentsChanged+=changed;
      mesh.userData.asfaltoReprojectInstances=heightAt=>{
        let moved=0;const world=new THREE.Vector3();
        for(const ids of groups.values()){
          const box=new THREE.Box3();for(const i of ids)box.expandByPoint(world.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));
          const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());if(size.length()>85)continue;
          const y=heightAt(c.x,c.z,box.min.y,Math.hypot(size.x,size.z)*.5+1);if(y!==null&&!Number.isFinite(y))continue;
          const delta=y===null?0:y-box.min.y;
          for(const i of ids){world.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);if(y===null)world.copy(c);else world.y+=delta;world.applyMatrix4(inverse);positions.setXYZ(i,world.x,world.y,world.z);}moved++;
        }
        if(moved){positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();}return moved;
      };}else geometry.dispose();
  }
  return {authoredBoulderComponents:componentsChanged};
}
