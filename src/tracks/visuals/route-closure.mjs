import { createReturnLandscape } from './closure-terrain.mjs?v=4d33f36d27d26268';
// Procedural game-fiction return corridor. Original canonical samples are never modified.
// Closing is physical: the last position and frame coincide with the original start.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const unit=p=>{const n=Math.hypot(p[0],p[2]);return[p[0]/n,0,p[2]/n];};
const add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const normalize=p=>{const d=Math.hypot(...p);return p.map(v=>v/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const frame=s=>s.frame||s;
function boundaryPoint(point,direction,b){
  const options=[];
  if(direction[0]>1e-6)options.push({side:1,t:(b.maxX-point[0])/direction[0]});
  if(direction[0]<-1e-6)options.push({side:3,t:(b.minX-point[0])/direction[0]});
  if(direction[2]>1e-6)options.push({side:2,t:(b.maxZ-point[2])/direction[2]});
  if(direction[2]<-1e-6)options.push({side:0,t:(b.minZ-point[2])/direction[2]});
  const hit=options.filter(o=>o.t>0).sort((a,b)=>a.t-b.t)[0];return{...hit,position:add(point,direction,hit.t)};
}
function perimeterPoints(exit,entry,b,direction){
  const corners=[[b.minX,0,b.minZ],[b.maxX,0,b.minZ],[b.maxX,0,b.maxZ],[b.minX,0,b.maxZ]],points=[exit.position];
  // Include a whole perimeter for the long alternative when both endpoints share a side.
  let side=exit.side;
  for(let count=0;count<5;count++){
    const target=direction===1?(side+1)%4:side;
    if(side===entry.side&&count>0)break;
    if(side===entry.side&&count===0){
      const along=direction===1?[1,0,1,-1][side]:-[1,0,1,-1][side];
      const axis=side%2?2:0;const sign=(side===0||side===1?1:-1)*direction;
      if((entry.position[axis]-exit.position[axis])*sign>0)break;
    }
    points.push(corners[target]);side=(side+direction+4)%4;
  }
  points.push(entry.position);return points;
}
function hermite(a,b,ma,mb,t){const t2=t*t,t3=t2*t;return a.map((v,i)=>(2*t3-3*t2+1)*v+(t3-2*t2+t)*ma[i]+(-2*t3+3*t2)*b[i]+(t3-t2)*mb[i]);}
function smoothPath(points,startDirection,endDirection,stepM){
  const clean=points.filter((p,i)=>!i||distance(p,points[i-1])>1),tangents=clean.map((p,i)=>{
    if(i===0)return startDirection.map(v=>v*Math.min(800,distance(p,clean[1])*.85));
    if(i===clean.length-1)return endDirection.map(v=>v*Math.min(800,distance(p,clean[i-1])*.85));
    const before=unit(add(p,clean[i-1],-1)),after=unit(add(clean[i+1],p,-1)),t=normalize(add(before,after));
    return t.map(v=>v*Math.min(700,distance(p,clean[i-1])*.6,distance(p,clean[i+1])*.6));
  });
  const output=[];let horizontalM=0,last;
  for(let i=0;i<clean.length-1;i++){const count=Math.max(2,Math.ceil(distance(clean[i],clean[i+1])/stepM)*2);for(let k=0;k<count;k++){
    const p=hermite(clean[i],clean[i+1],tangents[i],tangents[i+1],k/count);
    if(last)horizontalM+=distance(last,p);output.push({p,horizontalM});last=p;
  }}
  const p=clean.at(-1);horizontalM+=distance(last,p);output.push({p:[...p],horizontalM});
  // Arc-length resample; each retained segment remains under stepM + numerical tolerance.
  const sampled=[output[0]];let index=1;
  for(let s=stepM;s<horizontalM;s+=stepM){while(output[index].horizontalM<s)index++;const a=output[index-1],b=output[index],u=(s-a.horizontalM)/(b.horizontalM-a.horizontalM);sampled.push({p:a.p.map((v,i)=>v+(b.p[i]-v)*u),horizontalM:s});}
  sampled.push(output.at(-1));return sampled;
}
function sourceGrid(samples){const grid=new Map(),size=100;for(let i=0;i<samples.length;i++){const p=samples[i].position,key=Math.floor(p[0]/size)+':'+Math.floor(p[2]/size);if(!grid.has(key))grid.set(key,[]);grid.get(key).push({p,index:i});}return{grid,size};}
function crossingCount(path,source,spatial){
  let crossings=0,minClearanceM=Infinity;
  for(let k=30;k<path.length-30;k+=3){const p=path[k].p,cx=Math.floor(p[0]/spatial.size),cz=Math.floor(p[2]/spatial.size);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)for(const record of spatial.grid.get((cx+x)+':'+(cz+z))||[]){const d=distance(p,record.p);minClearanceM=Math.min(minClearanceM,d);if(d<(source[record.index].widthM||8)/2+10)crossings++;}}
  return {crossings,minClearanceM:Number.isFinite(minClearanceM)?minClearanceM:spatial.size};
}
function elevation(s,L,y0,y1,g0,g1){
  const B=Math.min(400,L*.06),base=(y1-y0-(g0+g1)*B/2)/(L-B);
  const first=Math.min(s,B),last=Math.max(0,s-(L-B));
  const integralStart=first/2+B/(2*Math.PI)*Math.sin(Math.PI*first/B),integralEnd=last/2-B/(2*Math.PI)*Math.sin(Math.PI*last/B);
  const y=y0+base*s+(g0-base)*integralStart+(g1-base)*integralEnd;
  const grade=base+(g0-base)*(s<B?(1+Math.cos(Math.PI*s/B))/2:0)+(g1-base)*(s>L-B?(1-Math.cos(Math.PI*last/B))/2:0);
  return {y,grade,base};
}

export function createClosedRoute(sourceRoute,{id=sourceRoute.id||'circuit',maxGrade=.08,stepM=8,marginM=1100}={}){
  if(!sourceRoute?.samples?.length||sourceRoute.samples.length<2||!Number.isFinite(sourceRoute.lengthM))throw new TypeError('closure requires a normalized route with finite length');
  if(stepM<2||stepM>20||maxGrade<=0||maxGrade>.2)throw new RangeError('invalid closure spacing or grade');
  if(id==='cataratas_iguazu'&&marginM===1100)marginM=1800;
  const source=sourceRoute.samples,first=source[0],last=source.at(-1),S=first.position,F=last.position,t0=unit(frame(last).tangent),t1=unit(frame(first).tangent),spatial=sourceGrid(source);
  if(![...S,...F,...t0,...t1].every(Number.isFinite))throw new TypeError('finite nonvertical endpoint tangents are required');
  const sourceBounds={minX:Math.min(...source.map(s=>s.position[0])),maxX:Math.max(...source.map(s=>s.position[0])),minZ:Math.min(...source.map(s=>s.position[2])),maxZ:Math.max(...source.map(s=>s.position[2]))};
  const slope=s=>{const t=frame(s).tangent;return t[1]/Math.hypot(t[0],t[2]);},g0=slope(last),g1=slope(first);
  let best=null;
  for(let expansion=0;expansion<8;expansion++){
    const margin=marginM+expansion*650;
    const horcones=id==='aconcagua_horcones'&&Math.abs(F[0]+20498.3)<2;
    const b=horcones?{minX:sourceBounds.minX-1900-expansion*650,maxX:sourceBounds.maxX+1900+expansion*650,minZ:sourceBounds.minZ-4900-expansion*650,maxZ:sourceBounds.maxZ+4900+expansion*650}:{minX:sourceBounds.minX-margin,maxX:sourceBounds.maxX+margin,minZ:sourceBounds.minZ-margin,maxZ:sourceBounds.maxZ+margin};
    // Dos Lagos leaves the finish bay to the south. A long eastbound ray would
    // enter the shore hillside before it reached the exterior perimeter.
    const dosLagos=id==='dos_lagos'&&Math.abs(F[0]-1275.9737)<2;
    const departure=dosLagos?[add(F,t0,120),[F[0]+210,0,F[2]-300]]:[];
    const exit=boundaryPoint(departure.at(-1)||F,dosLagos?[0,0,-1]:t0,b),entry=boundaryPoint(S,t1.map(v=>-v),b);
    for(const direction of [1,-1]){
      const perimeter=perimeterPoints(exit,entry,b,direction),points=[F,...departure,...perimeter,S],path=smoothPath(points,t0,t1,stepM),L=path.at(-1).horizontalM;
      const profile=elevation(L*.5,L,F[1],S[1],g0,g1),clearance=crossingCount(path,source,spatial);
      if(clearance.crossings||Math.abs(profile.base)>maxGrade)continue;
      const candidate={path,b,margin,L,grade:profile.base,...clearance};
      if(!best||L<best.L)best=candidate;
    }
    if(best)break;
  }
  if(!best)throw new Error('No noncrossing exterior closure within the configured grade budget');
  const points=best.path.map(record=>{const e=elevation(record.horizontalM,best.L,F[1],S[1],g0,g1);return{...record,p:[record.p[0],e.y,record.p[2]],grade:e.grade};});
  const closureSamples=[];let accumulated=sourceRoute.lengthM,maxObservedGrade=0;
  for(let i=0;i<points.length;i++){
    const record=points[i],a=points[Math.max(0,i-1)].p,b=points[Math.min(points.length-1,i+1)].p;
    const tangent=i===0?[...frame(last).tangent]:i===points.length-1?[...frame(first).tangent]:normalize(add(b,a,-1));
    let left=normalize([-tangent[2],0,tangent[0]]),normal=cross(left,tangent);
    if(i===0){left=[...frame(last).left];normal=[...frame(last).normal];}else if(i===points.length-1){left=[...frame(first).left];normal=[...frame(first).normal];}
    if(i)accumulated+=Math.hypot(...record.p.map((v,k)=>v-points[i-1].p[k]));
    const u=record.horizontalM/best.L,widthM=(last.widthM||8)*(1-u)+(first.widthM||8)*u;
    closureSamples.push({sM:accumulated,position:[...record.p],tangent,left,normal,widthM,bank:0,bankRad:0,surfaceId:'asphalt',sectorId:'return_corridor',curvaturePerM:0,targetSpeedKmh:id==='cuesta_lipan'?65:90});
    maxObservedGrade=Math.max(maxObservedGrade,Math.abs(record.grade));
  }
  // Copy exact endpoints rather than accepting accumulated floating-point drift.
  closureSamples[0].position=[...F];closureSamples.at(-1).position=[...S];
  const lengthM=accumulated,returnLength=lengthM-sourceRoute.lengthM;
  const sectors=Array.from({length:5},(_,i)=>({id:'return_'+String(i+1).padStart(2,'0'),name:i===4?'Regreso a largada':'Enlace de regreso '+(i+1),startM:sourceRoute.lengthM+returnLength*i/5,endM:i===4?lengthM:sourceRoute.lengthM+returnLength*(i+1)/5}));
  for(let i=0;i<closureSamples.length;i++){
    const s=closureSamples[i],previous=closureSamples[Math.max(0,i-1)],next=closureSamples[Math.min(closureSamples.length-1,i+1)],a=previous.tangent,b=next.tangent;
    s.sectorId=sectors[Math.min(4,Math.floor((s.sM-sourceRoute.lengthM)/returnLength*5))].id;
    s.curvaturePerM=Math.atan2(a[0]*b[2]-a[2]*b[0],a[0]*b[0]+a[2]*b[2])/Math.max(1,next.sM-previous.sM);
    s.targetSpeedKmh=Math.min(id==='cuesta_lipan'?80:95,Math.sqrt(4.1/Math.max(.0001,Math.abs(s.curvaturePerM)))*3.6);
  }
  const respawns=[...(sourceRoute.respawns||[])];for(let s=sourceRoute.lengthM+80;s<lengthM-20;s+=500)respawns.push({sM:s,lateralM:0});
  const sourceCopies=[...source.slice(0,-1),{...last,sectorId:sectors[0].id}];
  const route={...sourceRoute,format:'closed_loop',closed:true,lengthM,samples:[...sourceCopies,...closureSamples.slice(1)],sectors:[...(sourceRoute.sectors||[]),...sectors],checkpoints:[...(sourceRoute.checkpoints||[]),...sectors.map((sector,i)=>({index:(sourceRoute.checkpoints||[]).length+i,sM:sector.endM,halfWidthM:(first.widthM||8)/2}))],respawns};
  const closure=Object.freeze({id,startS:sourceRoute.lengthM,lengthM:lengthM-sourceRoute.lengthM,totalLengthM:lengthM,bounds:best.b,marginM:best.margin,mainGrade:best.grade,maxGrade:maxObservedGrade,inheritedEndpointGrade:Math.max(Math.abs(g0),Math.abs(g1)),clearanceM:best.minClearanceM,originalCrossings:best.crossings,sampleCount:closureSamples.length,physical:true,fictionalConnector:true});
  return {route,closure,samples:closureSamples,createRoots:(THREE,materials={})=>createClosureRoots(THREE,closureSamples,{id,materials,closure,sourceSamples:source})};
}

export function createClosureRoots(THREE,samples,{id='circuit',materials={},closure=null,sourceSamples=[]}={}){
  if(!THREE?.BufferGeometry||samples.length<2)throw new TypeError('closure roots require Three.js and sampled geometry');
  const visualRoot=new THREE.Group(),collisionRoot=new THREE.Group();visualRoot.name='ASFALTO_PHYSICAL_RETURN_CORRIDOR';collisionRoot.name='COLLISION_RETURN_CORRIDOR';
  function strip(name,offsets,heightOffsets,material,physical=false){
    const p=[],uv=[],coordinates=[],halfWidths=[],indices=[];
    for(let i=0;i<samples.length;i++){const s=samples[i],f=frame(s);for(let k=0;k<offsets.length;k++){const off=typeof offsets[k]==='function'?offsets[k](s):offsets[k];const point=add(s.position,f.left,off);point[1]=typeof heightOffsets[k]==='function'?heightOffsets[k](point,s,off):point[1]+heightOffsets[k];p.push(...point);uv.push(off/5,s.sM/8);coordinates.push(s.sM,off);halfWidths.push(s.widthM*.5);if(i&&k){const a=(i-1)*offsets.length+k-1,b=i*offsets.length+k-1;indices.push(a,a+1,b+1,a,b+1,b);}}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('asfaltoRoadCoordinates',new THREE.Float32BufferAttribute(coordinates,2));g.setAttribute('asfaltoRoadHalfWidth',new THREE.Float32BufferAttribute(halfWidths,1));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.receiveShadow=true;visualRoot.add(mesh);
    if(physical){const collider=new THREE.Mesh(g.clone(),new THREE.MeshBasicMaterial());collider.name=name==='RETURN_ROAD'?'COLLISION_RETURN_ROAD':'COLLISION_RETURN_SHOULDER_'+name;collider.visible=false;collisionRoot.add(collider);}
    return mesh;
  }
  const forest=id==='dos_lagos'||id==='paso_garibaldi'||id==='cataratas_iguazu';
  const names=({dos_lagos:['M_Asphalt_Wet','M_Shoulder_Gravel','M_Terrain_Andean'],aconcagua_horcones:['MAT_P1_ROAD','MAT_P1_GRAVEL','MAT_P1_TERRAIN_ARID'],cuesta_lipan:['V2_ASPHALT_PBR','V2_SHOULDER_PBR','V2_TERRAIN_PBR'],paso_garibaldi:['MAT_ASPHALT','MAT_SHOULDER','MAT_TERRAIN_HERO']})[id]||['ASFALTO_RETURN_ASPHALT','ASFALTO_RETURN_GRAVEL','ASFALTO_RETURN_TERRAIN'];
  const road=materials.asphalt||new THREE.MeshStandardMaterial({name:names[0],color:'#4c4d4b',roughness:.85});
  const shoulder=materials.shoulder||new THREE.MeshStandardMaterial({name:names[1],color:forest?'#727664':'#a79477',roughness:1});
  let ground=materials.terrain||new THREE.MeshStandardMaterial({name:names[2],color:forest?'#5d6a45':id==='cuesta_lipan'?'#ad875e':'#8e8370',roughness:1,side:THREE.DoubleSide});
  if(id==='cataratas_iguazu'&&materials.terrain){
    ground=materials.terrain.clone();ground.name=materials.terrain.name;ground.vertexColors=false;
    for(const slot of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(ground[slot]){ground[slot]=ground[slot].clone();ground[slot].wrapS=ground[slot].wrapT=THREE.RepeatWrapping;ground[slot].needsUpdate=true;}
    ground.userData.asfaltoReturnMaterial={source:materials.terrain.name,worldUvMetres:10,ownedTextureCopies:true};
  }
  strip('RETURN_ROAD',[s=>-s.widthM/2,s=>s.widthM/2],[0,0],road,true);
  strip('LEFT_SHOULDER',[s=>-s.widthM/2-2,s=>-s.widthM/2],[0,0],shoulder,true);
  strip('RIGHT_SHOULDER',[s=>s.widthM/2,s=>s.widthM/2+2],[0,0],shoulder,true);
  const landscape=createReturnLandscape(THREE,{samples,sourceSamples,sourceRoot:materials.sourceRoot,material:ground,id});visualRoot.add(landscape.mesh);
  const bankY=(p,s,off)=>{const u=Math.max(0,Math.min(1,(Math.abs(off)-s.widthM/2-2)/240));return s.position[1]+(landscape.heightAt(p[0],p[2])-s.position[1])*u;};
  strip('RETURN_LEFT_BANK',[-260,-180,-100,-55,-24,s=>-s.widthM/2-2],[bankY,bankY,bankY,bankY,bankY,0],ground);
  strip('RETURN_RIGHT_BANK',[s=>s.widthM/2+2,24,55,100,180,260],[0,bankY,bankY,bankY,bankY,bankY],ground);
  const paint=materials.paint||new THREE.MeshStandardMaterial({name:'MAT_ROAD_MARKING',color:'#c6bb83',roughness:.9});
  for(const side of [-1,1])strip('RETURN_EDGE_LINE_'+side,[s=>side*(s.widthM/2-.22)-.055,s=>side*(s.widthM/2-.22)+.055],[.012,.012],paint);
  // Centre dashes are actual segmented strips at route scale.
  const dashes=[];for(let i=1;i<samples.length;i++)if(Math.floor((samples[i].sM-samples[0].sM)/10)%2===0)dashes.push(i);
  const p=[],idx=[],coordinates=[];for(const i of dashes){const a=samples[i-1],b=samples[i],start=p.length/3;for(const s of [a,b])for(const side of [-1,1]){const point=add(s.position,frame(s).left,side*.05);point[1]+=.012;p.push(...point);coordinates.push(s.sM,side*.05);}idx.push(start,start+1,start+3,start,start+3,start+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.setAttribute('asfaltoRoadCoordinates',new THREE.Float32BufferAttribute(coordinates,2));g.computeVertexNormals();const dash=new THREE.Mesh(g,paint);dash.name='RETURN_CENTRE_DASHES';visualRoot.add(dash);
  visualRoot.userData.asfaltoClosure=closure;collisionRoot.userData.asfaltoClosure=closure;
  return {visualRoot,collisionRoot,carveSourceTerrain:landscape.carveSourceTerrain};
}
