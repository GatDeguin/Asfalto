// Connected, visual-only relief. X/Z, road envelope, shore and sector borders
// remain fixed. A hidden owner retains the untouched imported buffers for disposal.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
function noise(x,z){
  const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);
  const h=(a,b)=>{let n=Math.imul(a,374761393)^Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
  return(h(ix,iz)*(1-u)+h(ix+1,iz)*u)*(1-v)+(h(ix,iz+1)*(1-u)+h(ix+1,iz+1)*u)*v;
}

export function refineTerrainSurface(THREE,mesh,{roadField,waterLevel=-Infinity,region='dos_lagos',maxTriangles=280000,targetEdgeM=32,nearEdgeM=targetEdgeM,roadMarginM=20}={}){
  if(!mesh?.isMesh||/^COLLISION_/i.test(mesh.name)||!mesh.geometry?.attributes?.position||!roadField)return null;
  if(mesh.userData.asfaltoTerrainRefinement)return mesh.userData.asfaltoTerrainRefinement;
  const source=mesh.geometry,p=source.attributes.position,index=source.index,color=source.attributes.color;
  const sourceTriangles=(index?.count||p.count)/3;if(sourceTriangles>maxTriangles)return null;
  const forest=region==='dos_lagos'||region==='paso_garibaldi',maxChange=forest?60:85;
  mesh.updateWorldMatrix(true,false);const inverse=mesh.matrixWorld.clone().invert(),point=new THREE.Vector3();
  const vertices=[],triangles=[],lookup=new Map(),ids=new Uint32Array(p.count);
  let cutResculptedVertices=0,maxCutReductionM=0;
  const makeVertex=(x,y,z,c,boundary=false)=>{
    const q=roadField(x,z),road=smooth((q.distanceM-(q.widthM||8)/2-roadMarginM)/48),shore=smooth((y-waterLevel-1)/14);
    const sourceY=y;
    if(region==='cuesta_lipan'&&!boundary){
      const clear=Math.max(0,q.distanceM-(q.widthM||8)/2-10);
      // Compress only the over-steep road cuts. A finite concave toe rises into
      // connected spurs; sector-edge samples use the same world-space function.
      // The road and all imported collision buffers remain untouched.
      const spur=.5+.5*Math.sin((x*.81+z*.59)/155+Math.sin((z*.81-x*.59)/470)*1.4);
      const cap=(q.position?.[1]||0)+clear*(.57+.23*smooth(clear/240))+(spur-.5)*Math.min(28,clear*.2);
      const blend=smooth(clear/30)*(1-smooth((clear-700)/500));
      y-=Math.max(0,y-cap)*blend;
      if(sourceY-y>.01){cutResculptedVertices++;maxCutReductionM=Math.max(maxCutReductionM,sourceY-y);}
    }
    return{x,y,z,baseY:y,sourceY,color:c,boundary,weight:road*shore,slope:0,roadDistanceM:q.distanceM};
  };
  for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
    const key=[point.x,point.y,point.z].map(v=>Math.round(v*1000)).join(':');
    if(!lookup.has(key)){
      lookup.set(key,vertices.length);
      vertices.push(makeVertex(point.x,point.y,point.z,color?Array.from({length:color.itemSize},(_,c)=>color.getComponent(i,c)):null));
    }
    ids[i]=lookup.get(key);
  }
  for(let i=0;i<(index?.count||p.count);i+=3){
    const a=ids[index?index.getX(i):i],b=ids[index?index.getX(i+1):i+1],c=ids[index?index.getX(i+2):i+2];
    if(a!==b&&b!==c&&a!==c)triangles.push(a,b,c);
  }
  function topology(){
    const edges=new Map(),neighbors=vertices.map(()=>new Set());
    for(let i=0;i<triangles.length;i+=3)for(let j=0;j<3;j++){
      const a=triangles[i+j],b=triangles[i+(j+1)%3],key=edgeKey(a,b);
      if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});
      neighbors[a].add(b);neighbors[b].add(a);
    }
    return{edges,neighbors};
  }
  let graph=topology();
  for(const e of graph.edges.values())if(e.count===1){vertices[e.a].boundary=true;vertices[e.b].boundary=true;}
  // A weighted local plane estimate removes the angular height residual while
  // leaving a tilted planar slope unchanged, unlike averaging raw heights.
  function relax(iterations){
    const next=new Float64Array(vertices.length);
    for(let pass=0;pass<iterations;pass++){
      for(let i=0;i<vertices.length;i++){
        const v=vertices[i];next[i]=v.y;if(v.boundary||v.weight===0)continue;
        let sw=0,sx=0,sz=0,sxx=0,sxz=0,szz=0,sy=0,sxy=0,szy=0,min=Infinity,max=-Infinity;
        for(const j of graph.neighbors[i]){
          const n=vertices[j],x=n.x-v.x,z=n.z-v.z,r2=x*x+z*z;if(r2<.0001)continue;
          const w=1/Math.max(1,r2),y=n.y-v.y;
          sw+=w;sx+=w*x;sz+=w*z;sxx+=w*x*x;sxz+=w*x*z;szz+=w*z*z;sy+=w*y;sxy+=w*x*y;szy+=w*z*y;min=Math.min(min,y);max=Math.max(max,y);
        }
        const minor=sxx*szz-sxz*sxz,det=sw*minor-sx*(sx*szz-sxz*sz)+sz*(sx*sxz-sxx*sz);
        if(Math.abs(det)<1e-12)continue;
        const residual=(sy*minor-sx*(sxy*szz-sxz*szy)+sz*(sxy*sxz-sxx*szy))/det;
        const delta=clamp(clamp(residual,min,max)*.48,-6,6)*v.weight;
        next[i]=clamp(v.y+delta,v.baseY-maxChange*v.weight,v.baseY+maxChange*v.weight);
        v.slope=Math.min(2,Math.hypot(sxy,szy)/Math.max(.001,sxx+szz)*2);
      }
      for(let i=0;i<vertices.length;i++)vertices[i].y=next[i];
    }
  }
  relax(12);
  for(let pass=0;pass<4;pass++){
    const capacity=Math.floor((maxTriangles-triangles.length/3)/2);if(capacity<=0)break;
    const candidates=[];
    for(const[key,e]of graph.edges){const a=vertices[e.a],b=vertices[e.b];e.length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);const target=Math.min(a.roadDistanceM,b.roadDistanceM)<450?nearEdgeM:targetEdgeM;if(e.length>target)candidates.push([key,e]);}
    if(!candidates.length)break;
    candidates.sort((a,b)=>b[1].length-a[1].length);
    const midpoints=new Map();
    for(const[key,e]of candidates.slice(0,capacity)){
      const a=vertices[e.a],b=vertices[e.b],m=makeVertex((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,a.color?.map((v,i)=>(v+b.color[i])/2),e.count===1);
      m.baseY=(a.baseY+b.baseY)/2;midpoints.set(key,vertices.length);vertices.push(m);
    }
    const out=[];
    for(let i=0;i<triangles.length;i+=3){
      const a=triangles[i],b=triangles[i+1],c=triangles[i+2],ab=midpoints.get(edgeKey(a,b)),bc=midpoints.get(edgeKey(b,c)),ca=midpoints.get(edgeKey(c,a));
      const mask=(ab!==undefined?1:0)|(bc!==undefined?2:0)|(ca!==undefined?4:0);
      if(mask===0)out.push(a,b,c);
      else if(mask===1)out.push(a,ab,c,ab,b,c);
      else if(mask===2)out.push(a,b,bc,a,bc,c);
      else if(mask===4)out.push(a,b,ca,ca,b,c);
      else if(mask===3)out.push(ab,b,bc,a,ab,c,ab,bc,c);
      else if(mask===6)out.push(b,bc,ca,b,ca,a,bc,c,ca);
      else if(mask===5)out.push(a,ab,ca,ab,b,c,ab,c,ca);
      else out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
    }
    triangles.length=0;for(const value of out)triangles.push(value);graph=topology();relax(4);
  }
  // Source hairpin terraces need a physical smoothing radius. One-ring
  // relaxation shrinks to centimetres/metres as a sector is tessellated and
  // preserves the broad flat shelves followed by an abrupt height jump.
  // Fit a local tilted plane over 60m; flat ground and a steady slope stay put.
  // Road support and tile boundaries remain exact source anchors.
  if(region==='cuesta_lipan'){
    const cell=20,radius=60,grid=new Map(),next=new Float64Array(vertices.length);
    vertices.forEach((v,i)=>{const key=Math.floor(v.x/cell)+':'+Math.floor(v.z/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);});
    for(let pass=0;pass<3;pass++){
      // Equal-area cell centroids keep dense source tessellation from dominating
      // the fit and bound work independently of imported vertex density.
      const samples=new Map();for(const [key,ids]of grid){let x=0,y=0,z=0;for(const j of ids){x+=vertices[j].x;y+=vertices[j].y;z+=vertices[j].z;}samples.set(key,{x:x/ids.length,y:y/ids.length,z:z/ids.length});}
      for(let i=0;i<vertices.length;i++){
        const v=vertices[i];next[i]=v.y;
        const q=roadField(v.x,v.z),weight=smooth((q.distanceM-(q.widthM||8)/2-roadMarginM)/24)*(1-smooth((q.distanceM-350)/300));
        if(v.boundary||weight===0)continue;
        let sw=0,sx=0,sz=0,sxx=0,sxz=0,szz=0,sy=0,sxy=0,szy=0;
        const cx=Math.floor(v.x/cell),cz=Math.floor(v.z/cell);
        for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
          const n=samples.get((cx+dx)+':'+(cz+dz));if(!n)continue;const x=n.x-v.x,z=n.z-v.z,r2=x*x+z*z;if(r2>radius*radius)continue;
          const w=Math.exp(-r2/1800),y=n.y-v.y;sw+=w;sx+=w*x;sz+=w*z;sxx+=w*x*x;sxz+=w*x*z;szz+=w*z*z;sy+=w*y;sxy+=w*x*y;szy+=w*z*y;
        }
        const minor=sxx*szz-sxz*sxz,det=sw*minor-sx*(sx*szz-sxz*sz)+sz*(sx*sxz-sxx*sz);
        if(Math.abs(det)<1e-10)continue;
        const residual=(sy*minor-sx*(sxy*szz-sxz*szy)+sz*(sxy*sxz-sxx*szy))/det;
        next[i]=clamp(v.y+residual*.78*weight,v.baseY-maxChange*weight,v.baseY+maxChange*weight);
      }
      vertices.forEach((v,i)=>{v.y=next[i];});
    }
  }
  // Sparse incised drainage, elongated along the downhill profile. No uniform
  // positive noise inflation: a flat terrace stays flat and the silhouette stays authored.
  const positions=[],colors=[];let maxHeightChangeM=0,protectedVertices=0;
  for(let i=0;i<vertices.length;i++){
    const v=vertices[i];let borderFade=v.boundary?0:1;
    if(borderFade)for(const j of graph.neighbors[i])if(vertices[j].boundary){borderFade=.2;break;}
    const slope=smooth((v.slope-.15)/.65),u=(v.x*.78+v.z*.62)/95,w=(v.z*.78-v.x*.62)/340;
    const channel=Math.pow(clamp(1-Math.abs(noise(u+noise(w,u)*.6,w)-.5)*8),3);
    const regionalDetail=region==='cuesta_lipan'?.15+.85*smooth((v.roadDistanceM-250)/400):1;
    const erosion=channel*slope*(forest?22:28)*v.weight*borderFade*regionalDetail;
    const broadRelief=(noise(v.x/180+17,v.z/220+43)-.5)*(forest?45:70)*slope*v.weight*borderFade*regionalDetail;
    v.y=clamp(v.y-erosion+broadRelief,v.baseY-maxChange*v.weight,v.baseY+maxChange*v.weight);
    if(v.boundary||v.weight===0)protectedVertices++;
    maxHeightChangeM=Math.max(maxHeightChangeM,Math.abs(v.y-v.baseY));
    point.set(v.x,v.y,v.z).applyMatrix4(inverse);positions.push(point.x,point.y,point.z);if(v.color)colors.push(...v.color);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(triangles);
  if(color)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,color.itemSize));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
  const owner=new THREE.Mesh(source,mesh.material);owner.name='ASFALTO_TERRAIN_SOURCE_OWNER';owner.visible=false;mesh.add(owner);
  const result=Object.freeze({sourceTriangles,triangles:triangles.length/3,vertices:vertices.length,maxHeightChangeM,protectedVertices,targetEdgeM,region,cutResculptedVertices,maxCutReductionM});
  mesh.userData.asfaltoTerrainRefinement=result;return result;
}

/** Adjacent Dos Lagos tiles are one continuous sheet, not independent cliffs. */
export function joinTerrainTiles(THREE,root,meshes){
  if(meshes.length<2)return meshes[0]||null;
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),point=new THREE.Vector3();
  const positions=[],colors=[],indices=[];let colorSize=meshes[0].geometry.attributes.color?.itemSize||0;
  if(meshes.some(m=>(m.geometry.attributes.color?.itemSize||0)!==colorSize))colorSize=0;
  for(const mesh of meshes){
    const g=mesh.geometry,p=g.attributes.position,c=g.attributes.color,offset=positions.length/3;
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);positions.push(point.x,point.y,point.z);if(colorSize)for(let k=0;k<colorSize;k++)colors.push(c.getComponent(i,k));}
    for(let i=0;i<(g.index?.count||p.count);i++)indices.push(offset+(g.index?g.index.getX(i):i));
    mesh.userData.asfaltoReplacedTerrain=true;g.setDrawRange(0,0);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  if(colorSize)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,colorSize));
  geometry.computeVertexNormals();const joined=new THREE.Mesh(geometry,meshes[0].material);joined.name='ASFALTO_CONTINUOUS_TERRAIN';joined.receiveShadow=true;root.add(joined);return joined;
}
