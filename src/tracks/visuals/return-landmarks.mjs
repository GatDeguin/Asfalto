import {instanceDetailTiles} from './roadside-details.mjs?v=22883e922e9447bd';
import {addRouteDirection} from './route-direction.mjs?v=e9e6dcf49d8bbd2e';

const palette={
  dos_lagos:['#706a5a','#80765c','#33585a','#5e6547'],
  aconcagua_horcones:['#947759','#b48f6b','#656c5c','#a08260'],
  cuesta_lipan:['#9e7552','#ba8c61','#73684a','#947452'],
  paso_garibaldi:['#5c6057','#777b71','#3d5c59','#596747'],
  cataratas_iguazu:['#423e34','#72604b','#36594e','#94462f'],
};
const random=(n)=>{const x=Math.sin(n*127.1+31.9)*43758.5453;return x-Math.floor(x);};
const lateral=(q,offset,along=0)=>q.position.map((v,i)=>v+q.frame.left[i]*offset+q.frame.tangent[i]*along);

export function planReturnLandmarks({id,chapters,query,heightAt}){
  const landmarks=[];
  for(const [i,chapter] of chapters.entries()){
    const side=(i+(id==='cuesta_lipan'||id==='cataratas_iguazu'?1:0))%2?1:-1;
    for(const [j,fraction] of [.31,.64].entries()){
      const sM=chapter.startM+(chapter.endM-chapter.startM)*fraction,q=query.sample(sM);
      const sign=j===0?side:-side,kind=chapter.landscape;
      const distance=kind==='cut'?31:kind==='lookout'?59:kind==='grove'?42:52;
      const center=lateral(q,sign*(q.widthM/2+distance));
      const y=heightAt(center[0],center[2]);
      if(!Number.isFinite(y)||Math.abs(y-q.position[1])>50)continue;
      center[1]=y;
      const pieces=[];
      for(let k=0;k<(kind==='cut'?17:kind==='talus'?16:11);k++){
        const seed=i*543+j*17+k*11+1;
        const along=(k-5)*7+(random(seed)-.5)*11;
        const out=distance+(random(seed+1)-.28)*(kind==='cut'?18:38);
        const p=lateral(q,sign*(q.widthM*.5+out),along),h=heightAt(p[0],p[2]);
        if(!Number.isFinite(h))continue;
        const nearest=query.project?.([p[0],h,p[2]]);
        if(nearest&&nearest.distanceXZ<nearest.widthM*.5+12)continue;
        const size=kind==='cut'?[6+random(seed+2)*9,4+random(seed+3)*9,4+random(seed+4)*5]:
          kind==='talus'?[2+random(seed+2)*6,1+random(seed+3)*5,2+random(seed+4)*5]:
          kind==='lookout'?[3+random(seed+2)*4,1+random(seed+3)*3,2+random(seed+4)*4]:
          [1+random(seed+2)*3,.6+random(seed+3)*2,1+random(seed+4)*3];
        p[1]=h+size[1]*(kind==='cut'?.27:.12);
        pieces.push({position:p,scale:size,rotation:Math.atan2(q.frame.left[0],q.frame.left[2])+(random(seed+5)-.5)*2,
          pitch:(random(seed+6)-.5)*.6,light:k%3===0});
      }
      if(pieces.length)landmarks.push({sM,kind,center,side:sign,pieces,chapter:chapter.id});
    }
  }
  return landmarks;
}

function groundPatch(T,{query,heightAt,center,sM,kind,side},material){
  const q=query.sample(sM),wet=kind==='shore',positions=[],indices=[],uv=[];
  const radius=wet?17:kind==='wash'?16:12,segments=20;
  const yaw=Math.atan2(q.frame.tangent[2],q.frame.tangent[0])+(kind==='wash'?Math.PI*.31*side:0);
  const cs=Math.cos(yaw),sn=Math.sin(yaw);
  const pos=(x,z)=>{
    const h=heightAt(x,z);
    if(!Number.isFinite(h))return false;
    positions.push(x,h+.065,z);uv.push(x*.1,z*.1);
    return true;
  };
  if(!pos(center[0],center[2]))return null;
  for(let ring=1;ring<=3;ring++)for(let i=0;i<segments;i++){
    const a=i*Math.PI*2/segments,stretch=(.84+random(i*3+sM)*.28)*ring/3;
    const x=Math.cos(a)*radius*stretch*(kind==='wash'?2.1:1.6),z=Math.sin(a)*radius*stretch*(kind==='wash'?.37:.8);
    if(!pos(center[0]+x*cs-z*sn,center[2]+x*sn+z*cs))return null;
  }
  for(let i=0;i<segments;i++){
    const j=(i+1)%segments;
    indices.push(0,j+1,i+1);
    for(let ring=0;ring<2;ring++){
      const k=1+segments*ring;
      indices.push(k+i,k+j,k+j+segments,k+i,k+j+segments,k+i+segments);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,material);mesh.name='RETURN_LANDMARK_'+kind;mesh.receiveShadow=true;return mesh;
}

export function addReturnLandmarks(T,root,{id,chapters,query,heightAt,ground}){
  if(!chapters.length)return null;
  const [dark,light,wet,dry]=palette[id],landmarks=planReturnLandmarks({id,chapters,query,heightAt});
  const group=new T.Group();group.name='RETURN_REGIONAL_LANDMARKS';
  const rockGeometry=new T.DodecahedronGeometry(1,1);
  const rock=[dark,light].map(color=>new T.MeshStandardMaterial({color,roughness:.95,flatShading:true,map:ground.map||null}));
  const patches=[wet,dry].map((color,index)=>new T.MeshStandardMaterial({color,roughness:index?.92:.37,
    metalness:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  for(const [i,material] of rock.entries()){
    const pieces=landmarks.flatMap(site=>site.pieces.filter(p=>p.light===Boolean(i)));
    if(pieces.length)instanceDetailTiles(T,group,rockGeometry,material,pieces,{name:'return-landmark-'+i,distanceM:1000,tileM:420});
    else material.dispose();
  }
  if(!landmarks.length)rockGeometry.dispose();
  const used=new Set();
  for(const site of landmarks){
    if(!['shore','wash','grove','lookout'].includes(site.kind))continue;
    const index=site.kind==='shore'?0:1,patch=groundPatch(T,{...site,query,heightAt},patches[index]);
    if(patch){group.add(patch);used.add(index);}
  }
  patches.forEach((material,i)=>{if(!used.has(i))material.dispose();});
  root.add(group);
  const direction=addRouteDirection(T,root,{id,leg:'return',chapters,query,heightAt});
  return {sites:landmarks.map(({sM,kind,chapter,pieces})=>({sM,kind,chapter,pieces:pieces.length})),
    signs:direction.cues.filter(cue=>cue.kind!=='delineator').length,direction};
}
