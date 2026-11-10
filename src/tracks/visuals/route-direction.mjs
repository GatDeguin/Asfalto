import {directionSectors} from './route-direction-design.mjs?v=ab2c52ff0594d7f6';

const swatches={dos_lagos:'#3b5548',aconcagua_horcones:'#63583d',cuesta_lipan:'#684934',paso_garibaldi:'#3b4d49',cataratas_iguazu:'#405842'};
const amber='#d6b657',paper='#e5dcc1';
const stepM=16;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function withoutNearbyGenericWarnings(markers,cues=[]){
  const authored=cues.filter(cue=>cue.kind==='warning');
  return authored.length?markers.filter(marker=>authored.every(cue=>Math.abs(cue.sM-marker.sM)>70)):markers;
}

function findBend(sector,sample){
  const {startM,endM,anchor}=sector,points=[];
  const focus=startM+(endM-startM)*anchor;
  for(let s=startM+34;s<endM-26;s+=stepM)points.push({s,t:sample(s).frame.tangent});
  let best=-1,score=0;
  // A single pass of station queries. Compare headings across 64 m, not the
  // raw instantaneous curvature of one noisy survey sample.
  for(let i=2;i<points.length-2;i++){
    const a=points[i-2].t,b=points[i+2].t;
    const angle=Math.atan2(a[0]*b[2]-a[2]*b[0],a[0]*b[0]+a[2]*b[2]);
    points[i].angle=angle;
    const strength=Math.abs(angle)*(1-.45*Math.abs(points[i].s-focus)/(endM-startM));
    if(strength>score){score=strength;best=i;}
  }
  if(best===-1||Math.abs(points[best].angle)<.32)return null;
  const peak=points[best],turn=Math.sign(peak.angle);
  let first=best,last=best;
  while(best-first<6&&points[first-1]?.angle*turn>Math.abs(peak.angle)*.32)first--;
  while(last-best<6&&points[last+1]?.angle*turn>Math.abs(peak.angle)*.32)last++;
  return {peakM:peak.s,startM:points[first].s,endM:points[last].s,angle:peak.angle,turn};
}

export function planRouteDirection({id,leg,query,heightAt,chapters=[],lengthM=Infinity,detailRange=null}){
  const sectors=directionSectors(id,leg,chapters,lengthM).filter(s=>!detailRange||s.endM>detailRange.startM&&s.startM<detailRange.endM);
  const cues=[],cache=new Map();
  const sample=s=>{if(!cache.has(s))cache.set(s,query.sample(s));return cache.get(s);};
  const available=s=>!detailRange||s>=detailRange.startM&&s<detailRange.endM;
  function add(sector,sM,kind,phase,turn=0,preferred=1,outsideOnly=false){
    if(!available(sM))return false;
    const q=sample(sM);
    // Local +X in the oncoming sign face points along frame.left. Positive
    // heading delta above therefore points to the driver's right on screen.
    const tangent=q.frame.tangent,yaw=Math.atan2(-tangent[0],-tangent[2]);
    for(const side of outsideOnly?[preferred]:[preferred,-preferred]){
      for(const margin of [3.65,4.6,5.5]){
        const lateral=(q.widthM*.5+margin)*side;
        const p=q.position.map((v,i)=>v+q.frame.left[i]*lateral);
        const y=heightAt(p[0],p[2]);
        if(!Number.isFinite(y)||y-p[1]>1.5||p[1]-y>2.25)continue;
        const candidate=[p[0],y,p[2]],nearest=query.project?.(candidate);
        if(nearest&&(nearest.distanceXZ<nearest.widthM*.5+2.65||Number.isFinite(nearest.sM)&&Math.abs(nearest.sM-sM)>28))continue;
        if(cues.some(c=>Math.hypot(c.position[0]-p[0],c.position[2]-p[2])<10))continue;
        cues.push({sM,kind,phase,turn,side,yaw,position:candidate,sector:sector.id,name:sector.name,reason:sector.reason});
        return true;
      }
    }
    return false;
  }
  for(const sector of sectors){
    if(sector.intent==='quiet')continue;
    const {startM,endM,anchor}=sector;
    if(endM-startM<120)continue;
    if(sector.intent==='place'){
      const station=startM+(endM-startM)*anchor;
      for(const delta of [0,-24,24])if(add(sector,station+delta,'place','approach'))break;
      continue;
    }
    const bend=findBend(sector,sample);
    if(!bend)continue;
    const approach=clamp(bend.startM-65,startM+34,bend.peakM-36);
    // Classic source scenes already have their own warning signs; these get
    // the outside reference and release only, to avoid back-to-back boards.
    if(leg==='return'||id==='cataratas_iguazu'){
      for(const delta of [0,-12,12]){
        if(approach+delta<startM+26||approach+delta>bend.peakM-34)continue;
        if(add(sector,approach+delta,'warning','approach',bend.turn))break;
      }
    }
    const severe=Math.abs(bend.angle)>=.72;
    const supports=severe?[bend.peakM-16,bend.peakM,bend.peakM+16]:[bend.peakM];
    for(const s of supports)if(s>=bend.startM-4&&s<=bend.endM+4)add(sector,s,'chevron','support',bend.turn,-bend.turn,true);
    const release=Math.max(bend.endM+28,bend.peakM+40);
    if(release<endM-24)add(sector,release,'delineator','exit',0,-bend.turn);
  }
  cues.sort((a,b)=>a.sM-b.sM);
  return {id,leg,sectors,cues};
}

const dimensions={place:[3.05,.78,1.42],warning:[1.0,.88,1.60],chevron:[1.26,.60,1.16],delineator:[.13,.22,.72]};

function drawArrow(ctx,turn,kind){
  ctx.save();ctx.translate(128,64);ctx.scale(turn,1);
  ctx.strokeStyle='#303229';ctx.fillStyle='#303229';ctx.lineJoin='round';ctx.lineCap='round';
  if(kind==='warning'){
    ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(-27,35);ctx.lineTo(-27,-4);ctx.quadraticCurveTo(-27,-24,0,-24);ctx.lineTo(44,-24);ctx.stroke();
    ctx.beginPath();ctx.moveTo(23,-49);ctx.lineTo(60,-24);ctx.lineTo(23,1);ctx.closePath();ctx.fill();
  }else{
    ctx.lineWidth=15;
    for(const x of [-30,29]){ctx.beginPath();ctx.moveTo(x-21,-31);ctx.lineTo(x+21,0);ctx.lineTo(x-21,31);ctx.stroke();}
  }
  ctx.restore();
}

function plateAtlas(T,cues,id,leg){
  const plates=[...new Map(cues.map(c=>[`${c.kind}:${c.kind==='place'?c.name:c.turn}`,c])).entries()];
  const columns=4,rows=Math.ceil(plates.length/columns);
  const canvas=typeof document==='undefined'?null:document.createElement('canvas');
  const ctx=canvas?.getContext('2d');
  if(ctx){canvas.width=columns*256;canvas.height=rows*128;}
  const cells=new Map();
  for(const [i,[key,cue]] of plates.entries()){
    const col=i%columns,row=Math.floor(i/columns),color=cue.kind==='place'?swatches[id]:cue.kind==='delineator'?paper:amber;
    cells.set(key,{u0:(col*256+3)/1024,u1:(col*256+253)/1024,v0:1-(row*128+125)/(rows*128),v1:1-(row*128+3)/(rows*128),color});
    if(!ctx)continue;
    ctx.save();ctx.translate(col*256,row*128);ctx.fillStyle=color;ctx.fillRect(0,0,256,128);
    ctx.strokeStyle=cue.kind==='place'?paper:'#4c4935';ctx.lineWidth=4;ctx.strokeRect(8,8,240,112);
    if(cue.kind==='place'){
      ctx.textAlign='center';ctx.fillStyle=paper;ctx.font='bold 18px sans-serif';ctx.fillText(leg==='return'?'CAMINO DE REGRESO':'ASFALTO NACIONAL',128,43,224);
      ctx.font='bold 32px sans-serif';ctx.fillText(cue.name,128,89,229);
    }else if(cue.kind==='delineator'){
      ctx.fillStyle='#933f32';ctx.fillRect(10,12,236,49);
    }else drawArrow(ctx,cue.turn,cue.kind);
    ctx.restore();
  }
  const map=ctx?new T.CanvasTexture(canvas):null;
  if(map){map.colorSpace=T.SRGBColorSpace;map.name=`ASFALTO_ROUTE_DIRECTION_ATLAS_${id}_${leg}`;}
  return {map,cells};
}

export function addRouteDirection(T,root,options){
  const plan=planRouteDirection(options),{cues,id,leg}=plan;
  if(!cues.length)return {...plan,drawCalls:0};
  const group=new T.Group();group.name=`ASFALTO_ROUTE_DIRECTION_${leg}`;
  root.updateMatrixWorld(true);group.matrix.copy(root.matrixWorld).invert();group.matrixAutoUpdate=false;
  const {map,cells}=plateAtlas(T,cues,id,leg),p=[],uv=[],indices=[],colors=[],posts=[];
  for(const cue of cues){
    const [width,height,center]=dimensions[cue.kind], [x,y,z]=cue.position;
    const sx=Math.cos(cue.yaw),sz=-Math.sin(cue.yaw),nx=Math.sin(cue.yaw),nz=Math.cos(cue.yaw);
    const cell=cells.get(`${cue.kind}:${cue.kind==='place'?cue.name:cue.turn}`),start=p.length/3;
    const color=new T.Color(map?'#ffffff':cell.color);
    for(const [dx,dy,u,v] of [[-.5,-.5,cell.u0,cell.v0],[.5,-.5,cell.u1,cell.v0],[.5,.5,cell.u1,cell.v1],[-.5,.5,cell.u0,cell.v1]]){
      p.push(x+sx*dx*width+nx*.031,y+center+dy*height,z+sz*dx*width+nz*.031);uv.push(u,v);colors.push(color.r,color.g,color.b);
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
    const postHeight=cue.kind==='delineator'?.86:center+height*.46;
    for(const off of cue.kind==='place'?[-.94,.94]:[0])posts.push({
      position:[x+sx*off,y+postHeight*.5-.07,z+sz*off],scale:[cue.kind==='delineator'?.16:.073,postHeight+.14,cue.kind==='delineator'?.12:.073],color:cue.kind==='delineator'?paper:'#6e7067',yaw:cue.yaw});
    if(cue.kind!=='delineator')posts.push({position:[x,y+center,z],scale:[width,height,.054],color:'#71746a',yaw:cue.yaw});
  }
  const faces=new T.BufferGeometry();faces.setAttribute('position',new T.Float32BufferAttribute(p,3));
  faces.setAttribute('uv',new T.Float32BufferAttribute(uv,2));faces.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  faces.setIndex(indices);faces.computeVertexNormals();faces.computeBoundingSphere();
  const front=new T.Mesh(faces,new T.MeshStandardMaterial({map,vertexColors:true,roughness:.77,metalness:0}));
  front.name='ROUTE_DIRECTION_FACES';group.add(front);
  const supports=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({roughness:.85,metalness:.06}),posts.length);
  supports.name='ROUTE_DIRECTION_SUPPORTS';const dummy=new T.Object3D();
  posts.forEach((post,i)=>{dummy.position.fromArray(post.position);dummy.scale.fromArray(post.scale);dummy.rotation.y=post.yaw;dummy.updateMatrix();supports.setMatrixAt(i,dummy.matrix);supports.setColorAt(i,new T.Color(post.color));});
  supports.instanceMatrix.needsUpdate=true;supports.instanceColor.needsUpdate=true;supports.computeBoundingSphere();group.add(supports);
  // Two small batches per layer, no extra shadows, lights, colliders or frame work.
  group.userData.asfaltoRouteDirection={...plan,drawCalls:2};root.add(group);
  return group.userData.asfaltoRouteDirection;
}
