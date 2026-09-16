import {addRetainingTalus} from './regional-talus.mjs';
import {addSectorCollisionGuardrails} from './sector-collision-guardrails.mjs';
// Regional details follow the read-only route and terrain. All additions are visual.
import { applyPhotographicLeafCutout } from './regional-forest.mjs';
import { instanceDetailTiles } from './roadside-details.mjs?v=body-r2-20260916';
const FOREST=new Set(['dos_lagos','paso_garibaldi']);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const rand=n=>{const v=Math.sin(n*127.17+19.73)*43758.5453;return v-Math.floor(v);};
const yAt=(q,l)=>q.position.map((v,i)=>v+q.frame.left[i]*l);
function curve(query,s,step=36){const a=query.sample(Math.max(0,s-step)),b=query.sample(Math.min(query.lengthM||Infinity,s+step));return Math.atan2(a.frame.tangent[0]*b.frame.tangent[2]-a.frame.tangent[2]*b.frame.tangent[0],a.frame.tangent[0]*b.frame.tangent[0]+a.frame.tangent[2]*b.frame.tangent[2]);}

export function regionalCameraProfiles({id,query,lengthM=query.lengthM}){
  lengthM=Math.min(lengthM,({dos_lagos:10250,aconcagua_horcones:21000,cuesta_lipan:20000,paso_garibaldi:24000})[id]||lengthM);
  const candidates=[];
  for(let s=120;s<lengthM-120;s+=80)candidates.push({sM:s,curvature:Math.abs(curve(query,s)),height:query.sample(s).position[1]});
  const bend=candidates.reduce((a,b)=>a.curvature>b.curvature?a:b,candidates[0]||{sM:lengthM*.45});
  const heroS=id==='cuesta_lipan'?bend.sM:id==='aconcagua_horcones'?lengthM*.38:id==='dos_lagos'?Math.min(4880,lengthM*.8):lengthM*.48;
  const view=(key,sM,side,height,back,lookAhead,fov)=>{
    const q=query.sample(clamp(sM,0,lengthM)),t=query.sample(clamp(sM+lookAhead,0,lengthM));
    return {key,sM:q.sM??sM,position:q.position.map((v,i)=>v+q.frame.left[i]*side-q.frame.tangent[i]*back+(i===1?height:0)),target:t.position.map((v,i)=>v+(i===1?3:0)),fov};
  };
  const reviewedOpening={
    dos_lagos:{sM:8320,position:[633.8158511,96.73373,-5546.1372001],target:[1120.0559448,28.5,-5715.8297787],fov:55,evidence:'weather/world-audio/dos_lagos-shore-1.png'},
    cuesta_lipan:{sM:5320,position:[662.6197463451695,621.229648362015,4222.534221270718],target:[843.321389,380.252305,4017.238369],fov:48,evidence:'circuits/after-v3/03-lipan-hairpin.png'}
  }[id];
  return Object.freeze({id,openingDurationS:7.5,...(reviewedOpening&&reviewedOpening.sM<=lengthM?{openingShot:Object.freeze({...reviewedOpening,status:'rendered_reviewed'})}:{}),views:[
    view('start',Math.min(120,lengthM*.05),id==='dos_lagos'?-52:28,id==='cuesta_lipan'?80:22,40,100,48),
    view(id==='cuesta_lipan'?'hairpin':id==='dos_lagos'?'lake-overlook':id==='aconcagua_horcones'?'ravine':'wet-forest',heroS,id==='cuesta_lipan'?140:FOREST.has(id)?-55:75,id==='cuesta_lipan'?260:FOREST.has(id)?28:15,80,id==='aconcagua_horcones'?550:140,48),
    view('panorama',id==='aconcagua_horcones'?lengthM*.72:heroS+180,id==='cuesta_lipan'?-340:160,id==='cuesta_lipan'?540:140,240,id==='aconcagua_horcones'?1600:160,52),
    view('rival-scale',heroS,22,6,38,70,56),
  ]});
}

export function planRegionalFeatures({id,query,lengthM,heightAt,bounds,maxFeatures=720,detailRange=null}){
  const forest=FOREST.has(id),features=[];
  const supported=p=>{const y=heightAt(p[0],p[2]);return Number.isFinite(y)?[p[0],y,p[2]]:null;};
  for(let s=64;s<lengthM-50&&features.length<maxFeatures;s+=forest?62:54){
    if(detailRange&&(s<detailRange.startM||s>=detailRange.endM))continue;
    const q=query.sample(s),c=curve(query,s),left=q.frame.left;
    if(bounds&&(q.position[0]<bounds.min.x-70||q.position[0]>bounds.max.x+70||q.position[2]<bounds.min.z-70||q.position[2]>bounds.max.z+70))continue;
    for(const side of [-1,1]){
      const seed=s+side*17,offset=side*((q.widthM||8)/2+5+rand(seed)*7),p=supported(yAt(q,offset));if(!p)continue;
      const far=supported(yAt(q,offset+side*10)),rise=p[1]-q.position[1];
      const project=query.project?.(p);if(project&&project.distanceXZ-project.widthM/2<3.2)continue;
      const record={sM:s,side,position:p,rotation:Math.atan2(left[0],left[2]),seed};
      const cutOffset=side*((q.widthM||8)/2+(id==='cuesta_lipan'?70:28)+rand(seed+20)*(id==='cuesta_lipan'?60:28)),cutP=supported(yAt(q,cutOffset)),cutFar=supported(yAt(q,cutOffset+side*14));
      if(cutP&&cutFar&&cutP[1]>q.position[1]+1.7&&cutP[1]<q.position[1]+46&&cutFar[1]>cutP[1]+1.3&&rand(seed+21)>.48){
        const clear=query.project?.(cutP);if(!clear||clear.distanceXZ>clear.widthM/2+12)features.push({...record,position:cutP,kind:'cut',scale:[6+rand(seed+1)*9,Math.min(13,(cutP[1]-q.position[1])*.4+4),3+rand(seed+2)*4]});
      }
      if(id==='cuesta_lipan'){
        const footOffset=side*((q.widthM||8)/2+58+rand(seed+60)*24),foot=supported(yAt(q,footOffset)),upper=supported(yAt(q,footOffset+side*30));
        if(foot&&upper&&upper[1]>foot[1]+2.2&&rand(seed+61)>.35){const clear=query.project?.(foot);if(!clear||clear.distanceXZ>clear.widthM/2+20)features.push({...record,position:foot,kind:'sediment',scale:[10+rand(seed+62)*12,.2,7+rand(seed+63)*9],slopeSourceM:upper[1]-foot[1]});}
        if(side===1&&Math.floor(s/54)%6===0){const before=query.sample(s-20),after=query.sample(s+20),grade=(after.position[1]-before.position[1])/40;if(Math.abs(grade)>.018){const direction=-Math.sign(grade);features.push({...record,kind:'drain',flow:[q.frame.tangent[0]*direction,q.frame.tangent[2]*direction],wet:false,roadGrade:grade});}}
      }
      if((rise<-2.4||Math.abs(c)>.3)&&rand(seed+3)>.38)features.push({...record,kind:'barrier',startM:s-24,endM:s+24});
      const before=query.sample(s-45),after=query.sample(s+45),low=q.position[1]<before.position[1]-.12&&q.position[1]<after.position[1]-.12;
      const drainFar=supported(yAt(q,offset+side*40)),drainSlope=drainFar&&(drainFar[1]-p[1])/40;
      if(low||drainFar&&Math.abs(drainSlope)>.035&&rand(seed+4)>.62)features.push({...record,kind:'drain',flow:[side*left[0],side*left[2]],wet:id==='paso_garibaldi'});
      if(forest&&rand(seed+5)>.42&&Math.abs(rise)<5)features.push({...record,kind:'forest-floor',scale:[1,1,1]});
      if(!forest&&drainFar&&drainFar[1]>p[1]+1.2&&rand(seed+6)>.45)features.push({...record,kind:'sediment',scale:[3+rand(seed+7)*5,.2,2+rand(seed+8)*4]});
      if(Math.abs(c)>.3&&side===1&&rand(seed+9)>.6)features.push({...record,kind:'curve-sign',turn:Math.sign(c)});
      if(features.length>=maxFeatures)break;
    }
  }
  return features.slice(0,maxFeatures);
}

function geometryFrom(THREE,positions,indices,uv=null,colors=null){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
function patch(THREE,center,{radiusX=3,radiusZ=2,heightAt,seed=0,offset=.022,alpha=1}={}){
  const p=[...center.slice(0,1),heightAt(center[0],center[2])+offset,center[2]],uv=[.5,.5],colors=[1,1,1,alpha],indices=[];
  if(!Number.isFinite(p[1]))return null;
  for(let ring=1;ring<=2;ring++)for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,r=ring/2*(.86+rand(seed+i)*.28),x=center[0]+Math.cos(a)*radiusX*r,z=center[2]+Math.sin(a)*radiusZ*r,y=heightAt(x,z);
    if(!Number.isFinite(y)||Math.abs(y-center[1])>8)return null;
    p.push(x,y+offset,z);uv.push(.5+Math.cos(a)*r*.5,.5+Math.sin(a)*r*.5);colors.push(1,1,1,ring===1?alpha:0);
    if(ring===1)indices.push(0,1+i,1+(i+1)%12);else{const a=1+i,b=1+(i+1)%12;indices.push(a,13+i,13+(i+1)%12,a,13+(i+1)%12,b);}
  }
  return geometryFrom(THREE,p,indices,uv,colors);
}
function combine(THREE,geometries){
  const p=[],uv=[],c=[],idx=[];
  for(const g of geometries){const offset=p.length/3;p.push(...g.attributes.position.array);uv.push(...g.attributes.uv.array);c.push(...g.attributes.color.array);for(const i of g.index.array)idx.push(offset+i);g.dispose();}
  return geometryFrom(THREE,p,idx,uv,c);
}
function signTexture(THREE,id,type,turn=-1){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
  c.fillStyle=type==='curve'?'#dab85d':'#2b4940';c.fillRect(0,0,256,256);c.strokeStyle=type==='curve'?'#29291f':'#d0cec1';c.lineWidth=9;c.strokeRect(9,9,238,238);
  c.fillStyle=type==='curve'?'#242723':'#e8e2d0';c.textAlign='center';c.font='bold 72px sans-serif';
  if(type==='curve'){if(turn>0){c.translate(256,0);c.scale(-1,1);}c.lineWidth=20;c.strokeStyle='#242723';c.beginPath();c.moveTo(62,189);c.lineTo(62,88);c.quadraticCurveTo(63,57,107,57);c.lineTo(185,57);c.stroke();c.beginPath();c.moveTo(157,25);c.lineTo(204,57);c.lineTo(157,90);c.fill();}
  else{c.font='bold 41px sans-serif';c.fillText('MIRADOR',128,74);c.font='26px sans-serif';c.fillText(id==='dos_lagos'?'DOS LAGOS':id==='paso_garibaldi'?'GARIBALDI':id==='cuesta_lipan'?'CUESTA DE LIPÁN':'HORCONES',128,126);c.fillText('↗ 150 m',128,191);}
  // Sparse edge wear remains legible at cockpit distance.
  c.fillStyle='#6b655244';for(let i=0;i<42;i++)c.fillRect(rand(i)*256,rand(i+90)*256,2+rand(i+70)*5,1);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;
}

function addInfrastructure(THREE,group,{id,query,lengthM,heightAt,features,root,detailRange,barrierSource}){
  const collisionGuardrails=id==='cuesta_lipan'&&barrierSource?addSectorCollisionGuardrails(THREE,root,{...barrierSource,query,heightAt}):null;
  const posts=[],rails=[],terminal=[],signPosts=[],signBoards=[],wall=[],retainingWalls=[],wetPatches=[],dryPatches=[],watercourses=[];
  const p=[],idx=[],uv=[];let guardLengthM=0;
  // Coalesce overlapping exposure intervals so rails and posts never double up.
  const intervals=[];for(const side of [-1,1]){const source=features.filter(f=>f.kind==='barrier'&&f.side===side).sort((a,b)=>a.startM-b.startM);for(const f of source){const previous=intervals.at(-1);if(previous?.side===side&&f.startM<=previous.endM+9)previous.endM=Math.max(previous.endM,f.endM);else intervals.push({...f});}}
  for(const f of intervals){let last=null;const first=Math.max(0,f.startM),end=Math.min(lengthM,f.endM);
    for(let s=first;s<=end+1;s+=4){const q=query.sample(Math.min(s,end)),off=f.side*((q.widthM||8)/2+2.25),base=yAt(q,off),y=heightAt(base[0],base[2]);
      const projected=query.project?.(base);if(projected&&(projected.distanceXZ<projected.widthM/2+1.8||Math.abs(projected.sM-s)>24)){last=null;continue;}
      // Posts use the shoulder elevation where the cut lies below road grade.
      base[1]=Number.isFinite(y)&&Math.abs(y-base[1])<.6?y:base[1];
      if(!collisionGuardrails)posts.push({position:[base[0],base[1]+.45,base[2]],scale:[.10,1.16,.15],rotation:Math.atan2(q.frame.tangent[0],q.frame.tangent[2])});
      const toe=yAt(q,off+f.side*2.8),toeY=heightAt(toe[0],toe[2]),wallHeight=base[1]-toeY;
      if(id!=='dos_lagos'&&Number.isFinite(toeY)&&wallHeight>.75&&wallHeight<8)retainingWalls.push({position:[base[0]+q.frame.left[0]*f.side*.45,base[1]-Math.min(3.5,wallHeight)/2,base[2]+q.frame.left[2]*f.side*.45],scale:[.62,Math.min(3.5,wallHeight),4.08],rotation:Math.atan2(q.frame.tangent[0],q.frame.tangent[2])});
      const top=base.map((v,i)=>v+(i===1?.84:0));
      if(last&&!collisionGuardrails){const mid=top.map((v,i)=>(v+last[i])/2),distance=Math.hypot(...top.map((v,i)=>v-last[i]));rails.push({position:mid,scale:[.09,.28,distance+.035],rotation:Math.atan2(top[0]-last[0],top[2]-last[2]),pitch:-Math.atan2(top[1]-last[1],Math.hypot(top[0]-last[0],top[2]-last[2]))});guardLengthM+=distance;}
      if(!collisionGuardrails&&(s===first||s+4>end))terminal.push({position:[top[0],top[1]-.18,top[2]],scale:[.15,.43,1.2],rotation:Math.atan2(q.frame.tangent[0],q.frame.tangent[2])});
      last=top;
    }
  }
  const markers=features.filter(f=>f.kind==='curve-sign');
  // Every surveyed major bend gets an approach board, even if the niche planner rejected a steep side.
  const intervalM=id==='aconcagua_horcones'?600:150,minimumTurn=id==='aconcagua_horcones'?.08:.62;
  const seenStations=new Set(markers.map(f=>Math.floor(f.sM/intervalM)));
  for(let s=140;s<lengthM-120;s+=110)if((!detailRange||s>=detailRange.startM&&s<detailRange.endM)&&Math.abs(curve(query,s,55))>minimumTurn&&!seenStations.has(Math.floor(s/intervalM))){markers.push({sM:Math.max(0,s-75),side:1});seenStations.add(Math.floor(s/intervalM));}
  for(const f of markers){const q=query.sample(f.sM),position=yAt(q,(q.widthM||8)/2+2.9),y=heightAt(position[0],position[2]);if(Number.isFinite(y)&&Math.abs(y-position[1])<1.5)position[1]=y;const check=query.project?.(position);if(check&&check.distanceXZ<check.widthM/2+2.1)continue;const rot=Math.atan2(-q.frame.tangent[0],-q.frame.tangent[2]);signPosts.push({position:[position[0],position[1]+1.1,position[2]],scale:[.075,2.2,.075],rotation:0});signBoards.push({position:[position[0],position[1]+2.0,position[2]],scale:[.92,.92,.035],rotation:rot,turn:f.turn||Math.sign(curve(query,f.sM+75,55))});}
  const metal=new THREE.MeshStandardMaterial({color:'#888c87',roughness:.6,metalness:.62}),stone=new THREE.MeshStandardMaterial({color:id==='cuesta_lipan'?'#826b50':'#616560',roughness:1});
  const box=new THREE.BoxGeometry(1,1,1);instanceDetailTiles(THREE,group,box,metal,posts,{name:'guard-post',distanceM:950});instanceDetailTiles(THREE,group,box,metal,rails,{name:'continuous-guardrail',distanceM:1400});instanceDetailTiles(THREE,group,box,metal,terminal,{name:'guard-terminal',distanceM:950});instanceDetailTiles(THREE,group,box,metal,signPosts,{name:'sign-post',distanceM:700});
  for(const turn of [-1,1]){const boards=signBoards.filter(b=>Math.sign(b.turn||-1)===turn);if(!boards.length)continue;const map=signTexture(THREE,id,'curve',turn),mat=new THREE.MeshStandardMaterial({map,roughness:.68,color:'#ffffff',metalness:.08});instanceDetailTiles(THREE,group,box,mat,boards,{name:'curve-approach-'+(turn>0?'left':'right'),distanceM:800});}
  for(const f of features.filter(f=>f.kind==='drain')){
    const q=query.sample(f.sM),base=[...f.position];
    const channel=[];let direction=Number.isFinite(f.roadGrade)?[...f.flow]:[-f.side*q.frame.left[0],-f.side*q.frame.left[2]];
    const testA=heightAt(base[0]+direction[0]*3,base[2]+direction[1]*3),testB=heightAt(base[0]-direction[0]*3,base[2]-direction[1]*3);
    if(Number.isFinite(testA)&&Number.isFinite(testB)&&testB<testA)direction=direction.map(v=>-v);
    for(let k=0;k<6;k++){const pt=[base[0]+direction[0]*k*1.1,0,base[2]+direction[1]*k*1.1],y=heightAt(pt[0],pt[2]);if(!Number.isFinite(y)||k>0&&y>channel.at(-1)[1]+.2)break;pt[1]=y+.03;channel.push(pt);}
    if(channel.length>1){const start=p.length/3;for(let k=0;k<channel.length;k++){const pt=channel[k];for(const sign of [-1,1]){p.push(pt[0]+q.frame.tangent[0]*.24*sign,pt[1],pt[2]+q.frame.tangent[2]*.24*sign);uv.push(sign<0?0:1,k*.45);}if(k){const a=start+(k-1)*2;idx.push(a,a+1,a+3,a,a+3,a+2);}}watercourses.push({sM:f.sM,position:channel[0],end:channel.at(-1),widthM:.48});}
    const py=heightAt(base[0],base[2]);if(Number.isFinite(py)){wall.push({position:[base[0],py+.23,base[2]],scale:[1.35,.6,.52],rotation:f.rotation});const g=patch(THREE,[base[0],py,base[2]],{heightAt,radiusX:1.7,radiusZ:2.2,seed:f.seed,alpha:.72});if(g)wetPatches.push(g);}
  }
  instanceDetailTiles(THREE,group,box,stone,wall,{name:'culvert-headwall',distanceM:480});
  instanceDetailTiles(THREE,group,box,stone,retainingWalls,{name:'retaining-wall',distanceM:1100});
  if(idx.length){const g=geometryFrom(THREE,p,idx,uv),m=new THREE.MeshStandardMaterial({name:'ASFALTO_DRAINAGE_STREAM',color:id==='paso_garibaldi'?'#34433f':'#63594a',roughness:id==='paso_garibaldi'?.23:.88,metalness:0,side:THREE.DoubleSide});const mesh=new THREE.Mesh(g,m);mesh.name='ASFALTO_TOPOGRAPHIC_DRAINS';mesh.userData.asfaltoDrainageWater=true;if(id==='paso_garibaldi')mesh.userData.asfaltoWater={kind:'drain',maxDepthM:.12,shoreWidthM:.3,flowDirection:{x:1,z:0},flowSpeedMps:.4};mesh.receiveShadow=true;group.add(mesh);}
  if(wetPatches.length){const mesh=new THREE.Mesh(combine(THREE,wetPatches),new THREE.MeshStandardMaterial({color:'#343b2d',roughness:.82,transparent:true,vertexColors:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));mesh.name='ASFALTO_DRAINAGE_WET_SOIL';group.add(mesh);}
  // Keep shared source geometry/material reachable even when a streamed tile has no feature.
  const owner=new THREE.Mesh(box,metal);owner.visible=false;owner.name='ASFALTO_INFRASTRUCTURE_OWNER';owner.add(new THREE.Mesh(new THREE.BufferGeometry(),stone));group.add(owner);
  root.userData.asfaltoDrainageChannels=watercourses;
  return {...(collisionGuardrails?{collisionGuardrails:{sectorId:collisionGuardrails.sectorId,segments:collisionGuardrails.segments,runs:collisionGuardrails.runs.length,posts:collisionGuardrails.posts.length,source:collisionGuardrails.source}}:{}),guardrailMetres:Math.round(collisionGuardrails?.metres??guardLengthM),guardrailPosts:collisionGuardrails?.posts.length??posts.length,guardrailTerminals:collisionGuardrails?collisionGuardrails.runs.length*2:terminal.length,curveApproachSigns:signBoards.length,drainageChannels:watercourses.length,culverts:wall.length,retainingWallSections:retainingWalls.length};
}

export function addRegionalLandscapeDetails(THREE,root,{id,query,lengthM,heightAt,textures,templates,scenery=true,detailRange=null,barrierSource=null}){
  if(!heightAt||!query)return {};
  const features=planRegionalFeatures({id,query,lengthM,heightAt,bounds:heightAt.bounds,detailRange}),forest=FOREST.has(id);
  const group=new THREE.Group();group.name='ASFALTO_REGIONAL_LANDSCAPE_DETAILS';root.updateMatrixWorld(true);group.matrix.copy(root.matrixWorld).invert();group.matrixAutoUpdate=false;
  const rockMap=textures[forest?'aerial_rocks_04':'rock_face'];
  const rock=new THREE.MeshStandardMaterial({map:rockMap?.diff,normalMap:rockMap?.normal,roughnessMap:rockMap?.rough,color:id==='cuesta_lipan'?'#b08f68':id==='paso_garibaldi'?'#6f7b6b':'#9b9487',roughness:id==='paso_garibaldi'?.68:.97,normalScale:new THREE.Vector2(.45,.45),envMapIntensity:.22});
  rock.userData.asfaltoSnow=true;
  const cuts=features.filter(f=>f.kind==='cut').map(f=>({...f,position:[f.position[0],f.position[1]-f.scale[1]*.45,f.position[2]]}));
  for(let i=0;i<4;i++)if(templates?.get('rock-'+i))instanceDetailTiles(THREE,group,templates.get('rock-'+i),rock,cuts.filter((_,j)=>j%4===i),{name:'regional-rock-cut-'+i,distanceM:850});
  const patches=[];
  for(const f of features.filter(f=>f.kind==='sediment'||f.kind==='forest-floor')){const geometry=patch(THREE,f.position,{heightAt,radiusX:forest?3.1:f.scale[0],radiusZ:forest?2.4:f.scale[2],seed:f.seed,alpha:forest?.72:.6});if(geometry)patches.push(geometry);}
  if(patches.length){const map=textures[forest?'aerial_grass_rock':'gravel_floor']?.diff;const mat=new THREE.MeshStandardMaterial({map,color:forest?id==='paso_garibaldi'?'#4e5937':'#716f46':'#a89776',roughness:1,transparent:true,vertexColors:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});const mesh=new THREE.Mesh(combine(THREE,patches),mat);mesh.name=forest?'ASFALTO_ROOTED_FOREST_FLOOR':'ASFALTO_SEDIMENT_FANS';mesh.receiveShadow=true;group.add(mesh);}
  const logs=[],shrubs=[];
  if(forest)for(const f of features.filter(f=>f.kind==='forest-floor')){
    if(rand(f.seed+7)>.55){const y=heightAt(f.position[0],f.position[2]);logs.push({position:[f.position[0],y+.17,f.position[2]],rotation:f.rotation+.8,scale:[.18,.18,2.8+rand(f.seed+31)*2.8]});}
    else shrubs.push({...f,position:[f.position[0],f.position[1]-.24,f.position[2]],scale:[.085,.085,.085],variation:0});
  }
  const logGeometry=new THREE.CylinderGeometry(1,.86,1,7).rotateX(Math.PI/2),bark=new THREE.MeshStandardMaterial({map:textures.detailBark||null,color:'#67604c',roughness:1});instanceDetailTiles(THREE,group,logGeometry,bark,logs,{name:'fallen-wood',distanceM:250});
  if(templates?.get('tree-0-leaf')){const mat=new THREE.MeshStandardMaterial({map:textures.regionalCrown||null,color:id==='paso_garibaldi'?'#62764c':'#82905b',roughness:1,vertexColors:true,side:THREE.DoubleSide});mat.userData.asfaltoSnow=true;mat.userData.asfaltoWind={heightM:1.6,baseY:0,maxBendM:.06};applyPhotographicLeafCutout(mat);instanceDetailTiles(THREE,group,templates.get('tree-0-leaf'),mat,shrubs,{name:'soil-pocket-shrubs',distanceM:210});const owner=new THREE.Mesh(new THREE.BufferGeometry(),mat);owner.visible=false;group.add(owner);}
  let xericShrubs=0;
  if(!forest){
    const twigParts=[],dummy=new THREE.Object3D();
    for(let k=0;k<7;k++){const angle=k*2.399,height=.4+rand(k+8)*.4,g=new THREE.CylinderGeometry(.009,.022,height,5,1);g.rotateZ(.18+rand(k+3)*.42);g.rotateY(angle);g.translate(Math.cos(angle)*.17,height*.47,Math.sin(angle)*.17);twigParts.push(g);
      for(let n=0;n<9;n++){const leaf=new THREE.PlaneGeometry(.05+rand(n+k)*.035,.1+rand(n+2*k)*.07);leaf.rotateX(rand(n+k*12)*2.3);leaf.rotateY(angle+n*1.7);leaf.translate(Math.cos(angle)*(.15+n*.014),height*(.42+n*.055),Math.sin(angle)*(.15+n*.014));twigParts.push(leaf);}}
    const position=[],normal=[];for(const g of twigParts){const flat=g.toNonIndexed();position.push(...flat.attributes.position.array);normal.push(...flat.attributes.normal.array);flat.dispose();g.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({name:'ASFALTO_XERIC_SHRUB',color:id==='cuesta_lipan'?'#96956d':'#888b73',side:THREE.DoubleSide,roughness:1});material.userData.asfaltoWind={heightM:1,baseY:0,maxBendM:.045};material.userData.asfaltoSnow=true;
    const dry=features.filter(f=>f.kind==='sediment').filter((f,i)=>i%3===0&&rand(f.seed+43)>.2).slice(0,120).map(f=>{const scale=.65+rand(f.seed+24)*.55;return{position:[f.position[0],f.position[1]-.07,f.position[2]],rotation:f.rotation,scale:[scale,scale,scale]};});xericShrubs=dry.length;
    instanceDetailTiles(THREE,group,geometry,material,dry,{name:'sheltered-xeric-shrubs',distanceM:240});const keeper=new THREE.Mesh(geometry,material);keeper.visible=false;group.add(keeper);
  }
  const owner=new THREE.Mesh(logGeometry,bark);owner.visible=false;owner.add(new THREE.Mesh(new THREE.BufferGeometry(),rock));group.add(owner);
  const infrastructure=addInfrastructure(THREE,group,{id,query,lengthM,heightAt,features,root,detailRange,barrierSource});
  const retainingTalus=id==='aconcagua_horcones'?addRetainingTalus(THREE,group,{query,lengthM,heightAt,material:rock}):[];root.userData.asfaltoRetainingTalus=retainingTalus;
  let overlookFurniture=0;
  if(id==='dos_lagos'){let deck;root.traverse(mesh=>{if(mesh.isMesh&&/PROP_Mirador_Deck/.test(mesh.name+' '+mesh.parent?.name))deck=mesh;});
    if(deck){const box=new THREE.Box3().setFromObject(deck),p=box.getCenter(new THREE.Vector3()),q=query.project(p.toArray());
      if(q.distanceXZ>q.widthM/2+3){const wood=new THREE.MeshStandardMaterial({map:textures.detailBark||null,color:'#746b53',roughness:.91}),bench=new THREE.Group();bench.name='ASFALTO_MIRADOR_SINGLE_BENCH';bench.position.set(p.x,box.max.y+.015,p.z);
        for(const [pos,scale]of [[[0,.47,0],[1.8,.09,.46]],[[0,.85,.22],[1.8,.32,.065]],[[-.63,.23,0],[.1,.46,.37]],[[.63,.23,0],[.1,.46,.37]]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...scale),wood);mesh.position.fromArray(pos);mesh.castShadow=true;mesh.receiveShadow=true;bench.add(mesh);}group.add(bench);overlookFurniture=1;
      }
    }
  }
  root.add(group);
  const profiles=regionalCameraProfiles({id,query,lengthM});root.userData.asfaltoRegionalCameras=profiles;
  return {regionalFeatures:features.length,rockCuts:cuts.length,soilPatches:patches.length,fallenLogs:logs.length,protectedShrubs:shrubs.length,xericShrubs,overlookFurniture,retainingTalusSections:retainingTalus.length,cameraProfiles:profiles,...infrastructure};
}
