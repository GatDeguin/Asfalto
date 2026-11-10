import {directionSectors} from './route-direction-design.mjs?v=ab2c52ff0594d7f6';
import {createIguazuFern} from './regional-forest.mjs?v=76e2be9ca5367f98';

// [chapter index, fraction, preferred side, formation]. These are foreground
// beats in the game world. The wider valley and distant skyline remain visible.
const cues={
  dos_lagos:{
    outbound:[[2,.44,-1,'shore'],[1,.60,1,'grove']],
    return:[[0,.38,1,'shore'],[2,.41,-1,'grove']],
  },
  aconcagua_horcones:{
    outbound:[[2,.44,1,'fan'],[4,.36,-1,'scree']],
    return:[[1,.37,-1,'scree'],[2,.42,1,'fan']],
  },
  cuesta_lipan:{
    outbound:[[2,.34,1,'strata'],[4,.48,-1,'cardon']],
    return:[[0,.43,-1,'strata'],[3,.45,1,'cardon']],
  },
  paso_garibaldi:{
    outbound:[[2,.45,-1,'moraine'],[5,.42,1,'peat']],
    return:[[1,.41,-1,'peat'],[3,.39,1,'moraine']],
  },
  cataratas_iguazu:{
    outbound:[[3,.36,1,'basalt'],[6,.41,-1,'laterite']],
    return:[[1,.40,-1,'basalt'],[3,.44,1,'laterite']],
  },
};

const formations={
  shore:{bands:['#605950','#827971','#8a8271','#a9a08b'],rows:[.26,.46,.76,1],taper:[.99,.91,.83,.62],height:2.4,spread:19,accent:'wood'},
  grove:{bands:['#4e4b3d','#666651','#827b64','#858575'],rows:[.18,.43,.72,1],height:2.1,spread:16,accent:'wood'},
  fan:{bands:['#78614f','#94775f','#ac8a6b','#ba9e7e'],rows:[.23,.49,.78,1],height:2.8,spread:24,accent:'grass'},
  scree:{bands:['#726256','#9b7a64','#8b746b','#b59a7b'],rows:[.17,.42,.68,1],height:5.3,spread:23,accent:'grass'},
  strata:{bands:['#79533d','#c39973','#9d6754','#c7a47e'],rows:[.22,.41,.65,1],taper:[.98,.91,.87,.72],sides:9,height:5.6,spread:22,accent:'cardon'},
  cardon:{bands:['#816347','#a37b59','#b48560','#c29e78'],rows:[.16,.42,.74,1],height:2.3,spread:22,accent:'cardon'},
  moraine:{bands:['#45483f','#686b5f','#828276','#77805e'],rows:[.20,.46,.72,1],height:4.4,spread:20,accent:'wood'},
  peat:{bands:['#4e4a37','#60583d','#746a49','#747653'],rows:[.27,.53,.76,1],height:1.4,spread:23,accent:'grass'},
  basalt:{bands:['#413d3a','#60564d','#4b4c43','#777761'],rows:[.16,.44,.73,1],taper:[.99,.95,.91,.74],sides:7,height:4.8,spread:17,accent:'fern'},
  laterite:{bands:['#664337','#9b5840','#b26b48','#776f46'],rows:[.26,.50,.72,1],height:2.6,spread:19,accent:'fern'},
};

const clearanceM=5;
const noise=n=>{const value=Math.sin(n*67.749+19.683)*43758.5453;return value-Math.floor(value);};
const offset=(q,along,side)=>[
  q.position[0]+q.frame.tangent[0]*along+q.frame.left[0]*side,
  q.position[2]+q.frame.tangent[2]*along+q.frame.left[2]*side,
];
const inRange=(s,range)=>!range||s>=range.startM&&s<range.endM;
function definitions(id,leg,chapters,lengthM,detailRange){
  const sectors=directionSectors(id,leg,chapters,lengthM);
  return (cues[id]?.[leg]||[]).flatMap(([index,fraction,side,kind])=>{
    const sector=sectors[index];
    if(!sector)return [];
    const nominalM=sector.startM+(sector.endM-sector.startM)*fraction;
    return inRange(nominalM,detailRange)?[{sector,nominalM,side,kind}]:[];
  });
}

export function hasScenicSetpieces(options){
  const {id,leg,chapters=[],lengthM=Infinity,detailRange}=options;
  return definitions(id,leg,chapters,lengthM,detailRange).length>0;
}

function groundAt(x,z,query,heightAt,extraMargin=0){
  const y=heightAt(x,z);
  if(!Number.isFinite(y))return null;
  const road=query.project?.([x,y,z]);
  if(road&&road.distanceXZ<road.widthM*.5+clearanceM+extraMargin)return null;
  return y;
}

export function planScenicSetpieces({id,leg,query,heightAt,chapters=[],lengthM=Infinity,detailRange=null}){
  const sites=[];
  for(const {sector,nominalM,side:preferred,kind} of definitions(id,leg,chapters,lengthM,detailRange)){
    const profile=formations[kind];
    let best=null;
    for(const delta of [0,-45,45,-92,92,-165,165]){
      const sM=nominalM+delta;
      if(!inRange(sM,detailRange)||sM<sector.startM+40||sM>=sector.endM-40)continue;
      const q=query.sample(sM);
      for(const side of [preferred,-preferred])for(const margin of [14,20,29]){
        const lateral=side*(q.widthM*.5+margin);
        const [x,z]=offset(q,0,lateral);
        const y=groundAt(x,z,query,heightAt);
        if(y===null||y<q.position[1]-4.5||y>q.position[1]+12)continue;
        const support=[[-profile.spread,0],[profile.spread,0],[-8,-4],[8,-4],[0,5]].map(([along,out])=>{
          const [px,pz]=offset(q,along,lateral+out*side);
          return groundAt(px,pz,query,heightAt);
        });
        if(support.some(h=>h===null||Math.abs(h-y)>8))continue;
        const before=query.sample(Math.max(0,sM-44));
        const heightScore=Math.abs(y-before.position[1]-1.5);
        const score=heightScore+margin*.12+Math.abs(delta)*.022+(side===preferred?0:1.35);
        if(!best||score<best.score)best={id,leg,sector:sector.id,chapter:sector.name,kind,sM,side,
          center:[x,y,z],lateral,score};
      }
    }
    if(best)sites.push(best);
  }
  return sites;
}

function buildBatch(T,textured=false){
  const positions=[],colors=[],indices=[];
  return {
    point(position,color){const i=positions.length/3;positions.push(...position);colors.push(color.r,color.g,color.b);return i;},
    triangle(a,b,c){indices.push(a,b,c);},
    quad(a,b,c,d){indices.push(a,b,d,b,c,d);},
    geometry(){
      if(!indices.length)return null;
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      if(textured){
        const uv=[];
        for(let i=0;i<positions.length;i+=3){
          const x=positions[i],y=positions[i+1],z=positions[i+2];
          uv.push(x*.29+z*.22,z*.32-x*.11+y*.47);
        }
        geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      }
      geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
      return geometry;
    },
  };
}

function mineralTexture(T){
  const size=64,data=new Uint8Array(size*size*4);
  function field(x,z,grid,seed){
    const px=x/size*grid,pz=z/size*grid,i=Math.floor(px),j=Math.floor(pz);
    const fade=t=>t*t*(3-2*t),u=fade(px-i),v=fade(pz-j);
    const cell=(dx,dz)=>noise(((i+dx)%grid)*23+((j+dz)%grid)*139+seed);
    const low=cell(0,0)*(1-u)+cell(1,0)*u,high=cell(0,1)*(1-u)+cell(1,1)*u;
    return low*(1-v)+high*v;
  }
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const broad=field(x,z,5,31),chips=field(x,z,17,49),grain=noise(x+z*size+19);
    const value=Math.round(141+broad*62+chips*31+grain*14);
    const i=(z*size+x)*4;data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

const roundedTaper=[.94,.86,.78,.54];
function addSlab(T,batch,q,profile,{along,lateral,width,depth,height,seed,query,heightAt}){
  const sides=profile.sides||10,foot=[];
  for(let i=0;i<sides;i++){
    const angle=i*Math.PI*2/sides,variation=.76+noise(seed+i)*.22;
    const du=Math.cos(angle)*width*variation,dv=Math.sin(angle)*depth*variation;
    const [x,z]=offset(q,along+du,lateral+dv),y=groundAt(x,z,query,heightAt);
    if(y===null)return false;
    foot.push({du,dv,y});
  }
  if(Math.max(...foot.map(p=>p.y))-Math.min(...foot.map(p=>p.y))>height*1.6+3)return false;
  const palette=profile.bands.map(color=>new T.Color(color));
  const rings=[{level:-.22,span:1.0,band:0},{level:0,span:1.0,band:0},
    ...profile.rows.map((level,i)=>({level,span:(profile.taper||roundedTaper)[i],band:i}))];
  const vertices=rings.map(({level,span,band},r)=>foot.map(({du,dv,y},i)=>{
    const lean=height*level*(noise(seed+27)-.5)*.42;
    const [x,z]=offset(q,along+du*span+lean,lateral+dv*span);
    const surface=groundAt(x,z,query,heightAt);
    if(surface===null)return null;
    const top=height*level*(.92+noise(seed+i*7)*.14);
    return {p:[x,level<=0?surface+top:y+top,z],
      color:palette[band].clone().multiplyScalar(.8+noise(seed+i+r*3)*.27)};
  }));
  if(vertices.some(ring=>ring.some(point=>!point)))return false;
  const ids=vertices.map(ring=>ring.map(({p,color})=>batch.point(p,color)));
  for(let r=0;r<ids.length-1;r++)for(let i=0;i<sides;i++){
    const j=(i+1)%sides;
    batch.quad(ids[r][j],ids[r][i],ids[r+1][i],ids[r+1][j]);
  }
  const top=ids.at(-1);
  for(let i=1;i<sides-1;i++)batch.triangle(top[0],top[i+1],top[i]);
  return true;
}

function addTube(T,batch,points,radii,color,seed){
  const rings=[],sides=7;
  const axis=new T.Vector3(...points.at(-1)).sub(new T.Vector3(...points[0])).normalize();
  const reference=Math.abs(axis.y)>.9?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
  const normal=reference.cross(axis).normalize(),binormal=axis.clone().cross(normal);
  for(const [ring,position] of points.entries()){
    const ids=[];
    for(let i=0;i<sides;i++){
      const angle=i*Math.PI*2/sides,r=radii[ring]*(.86+noise(seed+i)*.22);
      const p=new T.Vector3(...position).addScaledVector(normal,Math.cos(angle)*r).addScaledVector(binormal,Math.sin(angle)*r);
      ids.push(batch.point(p.toArray(),color.clone().multiplyScalar(.74+noise(seed+i*2)*.42)));
    }
    rings.push(ids);
  }
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<sides;i++){
    const j=(i+1)%sides;
    batch.quad(rings[r][i],rings[r][j],rings[r+1][j],rings[r+1][i]);
  }
  for(const [end,reverse] of [[rings[0],true],[rings.at(-1),false]])for(let i=1;i<sides-1;i++)
    batch.triangle(end[0],end[i+(reverse?1:0)],end[i+(reverse?0:1)]);
}

function addAccent(T,batch,fern,{x,y,z,size,seed,accent,query,heightAt}){
  if(accent==='wood'){
    const angle=noise(seed)*Math.PI*2;
    const end=[x+Math.cos(angle)*size*2.4,z+Math.sin(angle)*size*2.4];
    const endY=groundAt(...end,query,heightAt,1);
    if(endY===null||Math.abs(endY-y)>size*.55)return false;
    const wood=new T.Color('#74634b');
    addTube(T,batch,[[x,y+.13*size,z],[end[0],endY+.09*size,end[1]]],[size*.22,size*.15],wood,seed);
  }else if(accent==='cardon'){
    const green=new T.Color('#737b49'),h=size*2.5;
    addTube(T,batch,[[x,y-.12,z],[x,y+h*.74,z],[x,y+h,z]],[.17*size,.145*size,.075*size],green,seed);
    for(const side of [-1,1]){
      const stem=x+size*.38*side;
      addTube(T,batch,[[x,y+h*(side===1?.43:.27),z],[stem,y+h*.54,z],[stem,y+h*(side===1?.84:.73),z]],
        [.105*size,.093*size,.06*size],green,seed+side);
    }
  }else if(accent==='fern'){
    const p=fern.attributes.position,c=fern.attributes.color,color=new T.Color('#799f53'),ids=[];
    const yaw=noise(seed)*Math.PI*2,cs=Math.cos(yaw),sn=Math.sin(yaw);
    for(let i=0;i<p.count;i++){
      const px=p.getX(i),pz=p.getZ(i);
      ids.push(batch.point([x+(px*cs-pz*sn)*size,y+p.getY(i)*size,z+(px*sn+pz*cs)*size],
        color.clone().multiplyScalar(.65+c.getY(i)*.6)));
    }
    for(let i=0;i<fern.index.count;i+=3)batch.triangle(...[0,1,2].map(j=>ids[fern.index.getX(i+j)]));
  }else{
    const leaf=new T.Color('#8d8860');
    for(let i=0;i<10;i++){
      const angle=i*2.399+noise(seed),dx=Math.cos(angle),dz=Math.sin(angle);
      const a=batch.point([x-dz*.05,y,z+dx*.05],leaf);
      const b=batch.point([x+dz*.05,y,z-dx*.05],leaf);
      const c=batch.point([x+dx*size*.58,y+size*(.42+noise(seed+i)*.4),z+dz*size*.58],leaf);
      batch.triangle(a,b,c);
    }
  }
  return true;
}

export function addScenicSetpieces(T,root,options){
  const {id,leg,query,heightAt}=options;
  const sites=planScenicSetpieces(options);
  if(!sites.length)return [];
  root.updateWorldMatrix(true,false);
  const group=new T.Group();group.name='ASFALTO_SCENIC_SETPIECES_'+leg.toUpperCase();
  group.matrix.copy(root.matrixWorld).invert();group.matrixAutoUpdate=false;
  const texture=mineralTexture(T);
  const stone=new T.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.23,vertexColors:true,
    color:'#e2d9c7',roughness:.99,envMapIntensity:.18,metalness:0});
  const plants=new T.MeshStandardMaterial({vertexColors:true,roughness:.96,envMapIntensity:.18,
    metalness:0,side:T.DoubleSide});
  stone.userData.asfaltoSnow=plants.userData.asfaltoSnow=id!=='cataratas_iguazu';
  const fern=id==='cataratas_iguazu'?createIguazuFern(T,1):null,report=[];
  let usedStone=false,usedPlants=false;
  for(const site of sites){
    const profile=formations[site.kind],q=query.sample(site.sM);
    const rockBatch=buildBatch(T,true),accentBatch=buildBatch(T);
    let slabs=0,accents=0;
    for(let i=0;i<17;i++){
      const seed=site.sM+i*41,feature=i<5;
      const along=feature?(i-2)*profile.spread*.42:(noise(seed+1)-.5)*profile.spread*2.2;
      const lateral=site.lateral+site.side*(feature?(noise(seed+2)-.30)*7:(noise(seed+2)-.56)*14);
      if(addSlab(T,rockBatch,q,profile,{along,lateral,
        width:feature?4.7+noise(seed+3)*5:1.15+noise(seed+3)*3,
        depth:feature?2.6+noise(seed+4)*3:1+noise(seed+4)*2.1,
        height:profile.height*(feature?.62+noise(seed+5)*.42:.15+noise(seed+5)*.32),
        seed,query,heightAt}))slabs++;
    }
    for(let i=0;i<14;i++){
      const seed=site.sM+i*47,along=(noise(seed+2)-.5)*profile.spread*2.3;
      const lateral=site.lateral+site.side*(i%3===0?-4:4+noise(seed+3)*6);
      const [x,z]=offset(q,along,lateral),y=groundAt(x,z,query,heightAt,profile.accent==='fern'?3.5:1);
      if(y===null||Math.abs(y-site.center[1])>7)continue;
      const size=(profile.accent==='fern'?1.25:.75)+noise(seed+6)*(profile.accent==='wood'?1.45:.8);
      if(addAccent(T,accentBatch,fern,{x,y,z,size,seed,accent:profile.accent,query,heightAt}))accents++;
    }
    const geometries=[rockBatch.geometry(),accentBatch.geometry()];
    const composition=new T.Group();composition.name='ASFALTO_SCENIC_'+site.kind.toUpperCase();
    let triangles=0;
    for(const [index,geometry] of geometries.entries()){
      if(!geometry)continue;
      const mesh=new T.Mesh(geometry,index===0?stone:plants);
      mesh.name=index===0?'Grounded mineral forms':'Regional accents';
      mesh.receiveShadow=true;composition.add(mesh);
      triangles+=geometry.index.count/3;
      if(index===0)usedStone=true;else usedPlants=true;
    }
    if(!triangles)continue;
    group.add(composition);
    const meta={...site,slabs,accents,triangles,drawCalls:composition.children.length};
    composition.userData.asfaltoScenicSetpiece=meta;
    // Source valleys can be cut when the return is attached. Lower the scenery
    // with the donor ground, or hide it if any part meets the other road.
    composition.userData.asfaltoReprojectInstances=sample=>{
      if(!composition.visible)return 0;
      const updates=[];
      for(const geometry of geometries.filter(Boolean)){
        const p=geometry.attributes.position;
        const offsets=[];
        for(let i=0;i<p.count;i++){
          const y=sample(p.getX(i),p.getZ(i),p.getY(i),clearanceM);
          if(y===null){composition.visible=false;meta.excluded=true;return 0;}
          if(Number.isFinite(y))offsets.push([i,y]);
        }
        if(offsets.length)updates.push({geometry,p,offsets});
      }
      let moved=0;
      for(const {geometry,p,offsets} of updates){
        for(const [i,y] of offsets)p.setY(i,y);
        p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
        moved+=offsets.length;
      }
      return moved;
    };
    report.push(meta);
  }
  fern?.dispose();
  if(!usedStone){stone.dispose();texture.dispose();}
  if(!usedPlants)plants.dispose();
  if(report.length)root.add(group);
  return report;
}
