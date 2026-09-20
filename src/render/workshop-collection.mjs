import {AWARDS} from '../menu/v7-championship-catalog.mjs?v=250778123f1c9e7f';

/** Local metres, centred X/Z, floor Y=0, front +Z. No renderer, storage or asset requests. */
export function createWorkshopCollection(T,{textures={},collection=[],posters=[]}={}){
 const root=new T.Group();root.name='WorkshopCollection';root.userData.front='+Z';
 const awardsRoot=new T.Group();awardsRoot.name='WorkshopCollection_Awards';root.add(awardsRoot);
 const owned={geometries:new Set(),materials:new Set(),textures:new Set()},primitives=new Map(),slots=[],awardGroups=new Map();let disposed=false,ignoredIds=[];
 const material=(name,color,roughness,metalness,map)=>{const m=new T.MeshPhysicalMaterial({color,roughness,metalness,map:map||null,anisotropy:/Nickel|Brass/.test(name)?.18:0});m.name='Collection_'+name;owned.materials.add(m);return m;};
 const wood=material('DarkOiledWood','#a89983',.84,0,textures.wood),back=material('RecessedWood','#777063',.93,0,textures.back||textures.wood),bronze=material('PatinatedBronze','#82704e',.61,.7),gold=material('WarmBrass','#baa06a',.43,.78),silver=material('SatinNickel','#b0b6b4',.47,.77),copper=material('Copper','#aa7451',.61,.62),green=material('DeepGreenEnamel','#315d4f',.48,.18),water=material('MatteWaterGlass','#6b9290',.74,.10),stone=material('StoneBase','#5e5950',.88,0);
 if(textures.wood&&!textures.woodNormal){wood.bumpMap=textures.wood;wood.bumpScale=.00035;}
 if(textures.woodNormal){wood.normalMap=textures.woodNormal;wood.normalScale.set(.3,.3);}if(textures.woodRoughness)wood.roughnessMap=textures.woodRoughness;
 function primitive(key,make){if(!primitives.has(key))primitives.set(key,make());return primitives.get(key);}
 const box=()=>primitive('box',()=>new T.BoxGeometry(1,1,1));
 const cylinder=(n=32)=>primitive('cyl'+n,()=>new T.CylinderGeometry(1,1,1,n,1));
 const cone=()=>primitive('cone',()=>new T.ConeGeometry(1,1,16,1));
 const ring=(arc=Math.PI*2,segments=48,radial=8)=>primitive('ring'+arc+':'+segments+':'+radial,()=>new T.TorusGeometry(1,.08,radial,segments,arc));
 function beveledBox(size,radius){
  const r=Math.min(radius,...size.map(v=>v/4)),key='bevel:'+size.join(',')+':'+r;
  return primitive(key,()=>{const g=new T.BoxGeometry(1,1,1,3,3,3),p=g.attributes.position,n=g.attributes.normal;
   for(let i=0;i<p.count;i++){const raw=[p.getX(i),p.getY(i),p.getZ(i)],point=raw.map((v,k)=>Math.sign(v)*(Math.abs(v)>.49?size[k]/2:size[k]/2-r)),inner=point.map((v,k)=>Math.max(-size[k]/2+r,Math.min(size[k]/2-r,v))),delta=new T.Vector3(...point.map((v,k)=>v-inner[k])).normalize();p.setXYZ(i,inner[0]+delta.x*r,inner[1]+delta.y*r,inner[2]+delta.z*r);n.setXYZ(i,delta.x,delta.y,delta.z);}
   p.needsUpdate=true;n.needsUpdate=true;return g;});
 }
 function batch(parent,name,boxBevel=.002){const pieces=new Map();return{
  add(g,m,p=[0,0,0],s=[1,1,1],r=[0,0,0]){if(g===box()&&(m===wood||m===stone||name.includes(':'))){g=beveledBox(s,boxBevel);s=[1,1,1];}const geometry=g.index?g.toNonIndexed():g.clone();const matrix=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...r)),new T.Vector3(...s));geometry.applyMatrix4(matrix);if(!pieces.has(m))pieces.set(m,[]);pieces.get(m).push(geometry);},
  finish({castShadow=true,receiveShadow=true}={}){for(const [m,list] of pieces){const count=list.reduce((n,g)=>n+g.attributes.position.count,0),geometry=new T.BufferGeometry(),arrays={position:new Float32Array(count*3),normal:new Float32Array(count*3),uv:new Float32Array(count*2)};let offset=0;for(const g of list){for(const key of Object.keys(arrays)){const attr=g.attributes[key],size=key==='uv'?2:3;if(attr)arrays[key].set(attr.array,offset*size);}offset+=g.attributes.position.count;g.dispose();}for(const [key,array] of Object.entries(arrays))geometry.setAttribute(key,new T.Float32BufferAttribute(array,key==='uv'?2:3));geometry.computeBoundingBox();geometry.computeBoundingSphere();owned.geometries.add(geometry);const mesh=new T.Mesh(geometry,m);mesh.name=name+'_'+m.name;mesh.receiveShadow=receiveShadow;mesh.castShadow=castShadow;parent.add(mesh);}pieces.clear();}
 };}
 function bar(b,m,a,z,width=.02){const first=new T.Vector3(...a),last=new T.Vector3(...z),delta=last.clone().sub(first),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()),e=new T.Euler().setFromQuaternion(q);b.add(cylinder(12),m,first.add(last).multiplyScalar(.5).toArray(),[width,delta.length(),width],[e.x,e.y,e.z]);}
 function path(b,m,points,width=.02){for(let i=1;i<points.length;i++)bar(b,m,points[i-1],points[i],width);}
 function profile(b,m,points,depth=.05){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.005,bevelSize:.005,bevelSegments:2,steps:1,curveSegments:4});b.add(g,m,[0,0,-depth/2]);g.dispose();}
 const cabinet=batch(root,'Cabinet');
 // Four continuous back standards, shelf brackets and front ribs carry each tier to the base.
 for(const x of [-1.79,-.60,.60,1.79]){cabinet.add(box(),bronze,[x,1.08,-.145],[.035,2.12,.035]);for(const y of [.4,1.015,1.505]){cabinet.add(box(),bronze,[x,y-.044,.015],[.035,.035,.355]);bar(cabinet,bronze,[x,y-.20,-.13],[x,y-.047,.16],.007);}}
 for(const y of [.4,1.015,1.505])cabinet.add(box(),bronze,[0,y-.043,.178],[3.64,.03,.035]);
 for(const x of [-1.65,1.65]){cabinet.add(box(),bronze,[x,2.03,-.218],[.12,.16,.018]);cabinet.add(box(),bronze,[x,2.075,-.24],[.12,.025,.07]);for(const dx of [-.034,.034])cabinet.add(cylinder(8),silver,[x+dx,2.035,-.233],[.004,.018,.004],[Math.PI/2,0,0]);}
 for(const y of [.633,.863])cabinet.add(box(),bronze,[0,y,-.146],[3.45,.030,.032]);
 cabinet.add(box(),back,[0,1.1,-.19],[3.8,2.2,.04]);
 for(const x of [-1.86,1.86])cabinet.add(box(),wood,[x,1.1,0],[.08,2.2,.42]);
 for(const y of [.045,2.155])cabinet.add(box(),wood,[0,y,0],[3.64,.09,.416]);
 for(const y of [.4,1.015,1.505]){cabinet.add(box(),wood,[0,y,0],[3.64,.055,.416]);cabinet.add(box(),bronze,[0,y,.205],[3.64,.011,.006]);}
 for(const x of [-1.18,-.4,.4,1.18])cabinet.add(box(),wood,[x,1.83,-.01],[.032,.6,.34]);
 // Base cabinet doors, inset moulding and small pulls stay within the .42m envelope.
 for(const x of [-.92,.92]){cabinet.add(box(),wood,[x,.224,.175],[1.78,.27,.035]);cabinet.add(box(),back,[x,.224,.196],[1.59,.16,.009]);cabinet.add(cylinder(8),bronze,[x+(x<0?.65:-.65),.235,.204],[.015,.01,.015],[Math.PI/2,0,0]);}
 const positionFor=(a,i)=>a.kind==='cup'?[(i-18)*.8,1.534,.025]:a.kind==='route-trophy'?[(i-2)*.72,1.044,.025]:[((i-5)%6-2.5)*.57,i<11?.79:.56,.12];
 AWARDS.forEach((a,i)=>{const p=positionFor(a,i);slots.push({id:a.id,kind:a.kind,position:[...p],heightM:a.heightM});if(a.kind==='test-medal'){cabinet.add(cylinder(8),bronze,[p[0],p[1]+.073,-.004],[.005,.288,.005],[Math.PI/2,0,0]);cabinet.add(cylinder(8),bronze,[p[0],p[1]+.079,.141],[.005,.022,.005]);}else cabinet.add(box(),bronze,[p[0],p[1]-.006,.045],[a.kind==='cup'?.31:.29,.006,.22]);});
 cabinet.finish();
 const stripMaterial=material('WarmShelfStrip','#b69060',.72,.05);stripMaterial.emissive.set('#f1bf7e');stripMaterial.emissiveIntensity=.35;
 const strips=batch(root,'ShelfStrips');for(const y of [.9865,1.4765,2.109])strips.add(box(),stripMaterial,[0,y,.17],[3.48,.0005,.009]);strips.finish({castShadow:false,receiveShadow:false});

 // One local atlas for all plaques. Textures supplied by the host are never mutated/disposed.
 const labelRows=[{text:'ARCHIVO DEL TALLER',p:[0,2.153,.21],w:1.12,h:.067},...AWARDS.map((a,i)=>{const p=positionFor(a,i);return{text:a.title.toUpperCase(),p:[p[0],a.kind==='test-medal'?p[1]-.035:p[1]-.044,.21],w:a.kind==='test-medal'?.46:.6,h:a.kind==='test-medal'?.031:.035};}),{text:'ESPACIOS RESERVADOS PARA PREMIOS OBTENIDOS',p:[0,.944,.21],w:2.3,h:.035}];
 const displayedPosters=posters.slice(0,2);for(let i=0;i<2;i++)labelRows.push({text:String(displayedPosters[i]?.caption||'DESTINOS POR CONOCER').slice(0,55).toUpperCase(),p:[i?1.55:-1.55,1.586,.025],w:.47,h:.035});
 let canvas=null;try{canvas=typeof globalThis.OffscreenCanvas==='function'?new OffscreenCanvas(2048,1024):globalThis.document?.createElement?.('canvas');if(canvas){canvas.width=2048;canvas.height=1024;}}catch{}
 const ctx=canvas?.getContext?.('2d');let atlas;
 // Each plaque samples a rectangle with its own physical aspect ratio. Mapping
 // every 4:1 atlas cell onto a 20:1 plaque deforms the lettering horizontally.
 const labelRects=labelRows.map((row,i)=>{const width=Math.min(1016,56*row.w/row.h),height=width*row.h/row.w;return{x:(i%2)*1024+(1024-width)/2,y:Math.floor(i/2)*64+(64-height)/2,width,height};});
 if(ctx){ctx.fillStyle='#28231c';ctx.fillRect(0,0,2048,1024);ctx.textAlign='center';ctx.textBaseline='middle';labelRows.forEach((row,i)=>{const rect=labelRects[i],{x,y,width,height}=rect;ctx.fillStyle='#afa186';ctx.fillRect(x,y,width,height);ctx.strokeStyle='#6b604a';ctx.lineWidth=.8;ctx.strokeRect(x+2,y+2,width-4,height-4);let size=height*.58;ctx.font='600 '+size+'px Georgia, serif';const measured=ctx.measureText(row.text).width;if(measured>width*.91){size*=width*.91/measured;ctx.font='600 '+size+'px Georgia, serif';}ctx.fillStyle='#272117';ctx.fillText(row.text,x+width/2,y+height*.53);});atlas=new T.CanvasTexture(canvas);}
 else{atlas=new T.DataTexture(new Uint8Array([100,89,66,255]),1,1);atlas.needsUpdate=true;}
 atlas.name='Collection_LocalPlaqueAtlas';atlas.colorSpace=T.SRGBColorSpace;atlas.anisotropy=4;owned.textures.add(atlas);const labelMat=new T.MeshStandardMaterial({map:atlas,color:'#ffffff',roughness:.78,metalness:.06});labelMat.name='Collection_PlaqueAtlas';owned.materials.add(labelMat);const labels=batch(root,'Labels');labelRows.forEach((row,i)=>{const g=new T.PlaneGeometry(row.w,row.h),uv=g.attributes.uv,rect=labelRects[i];for(let n=0;n<uv.count;n++)uv.setXY(n,(rect.x+uv.getX(n)*rect.width)/2048,1-(rect.y+(1-uv.getY(n))*rect.height)/1024);labels.add(g,labelMat,row.p);g.dispose();});labels.finish();
 const pictures=batch(root,'Posters');for(let i=0;i<2;i++){const x=i?1.55:-1.55;for(const dx of [-.226,.226])pictures.add(box(),bronze,[x+dx,1.845,-.11],[.018,.48,.025]);for(const y of [1.614,2.076])pictures.add(box(),bronze,[x,y,-.11],[.47,.018,.025]);const photo=displayedPosters[i]?.texture||displayedPosters[i]?.map;if(photo?.isTexture){const m=material('DecorativePoster'+i,'#ffffff',.93,0,photo);const g=new T.PlaneGeometry(.43,.445);pictures.add(g,m,[x,1.845,-.092]);g.dispose();}else pictures.add(box(),back,[x,1.845,-.106],[.431,.443,.014]);}pictures.finish();

 function awardGeometry(a,index){const group=new T.Group();group.name='Award_'+a.id;group.userData={awardId:a.id,shape:a.shape,heightM:a.heightM,earned:false};const b=batch(group,a.id,.002/a.heightM);const main=a.material.includes('silver')||a.material.includes('nickel')||a.material.includes('aluminium')?silver:a.material.includes('copper')?copper:a.kind==='cup'&&a.championshipId==='gran_nacional'?gold:bronze;
  if(a.kind==='test-medal'){
   const k=index-5;b.add(cylinder([24,10,12,8,16,14,24,8,20,12,24,16][k]),main,[0,.5,0],[.5,.08,.5],[Math.PI/2,0,0]);b.add(ring(Math.PI*2,32,6),gold,[0,.5,.046],[.445,.445,.445]);
   const line=(pts,w=.022)=>path(b,gold,pts.map(([x,y])=>[x,y,.075]),w),arc=(x,y,r,angle=Math.PI*2,rot=0)=>b.add(ring(angle,32,6),gold,[x,y,.075],[r,r,r],[0,0,rot]);
   if(k===0){arc(0,.51,.27,Math.PI,0);line([[0,.45],[.25,.77]],.027);}
   if(k===1||k===2){arc(-.16,.52,.13);arc(.17,.52,k===2?.21:.13);if(k===2)line([[-.29,.29],[.29,.29]]);}
   if(k===3||k===4){line([[-.32,.5],[.32,.5]]);for(let j=0;j<(k===3?5:10);j++){const x=-.28+j*.56/(k===3?4:9);line([[x,.42],[x,.59]],.011);}}
   if(k===5){arc(0,.49,.28,Math.PI*1.5,-.3);line([[-.08,.68],[-.08,.48],[.13,.48],[.13,.7],[.13,.32]]);}
   if(k===6){arc(-.09,.54,.19);for(let j=0;j<3;j++)line([[.16+j*.066,.36],[.16+j*.066,.73-j*.07]],.018);}
   if(k===7){for(let j=0;j<3;j++){const x=-.25+j*.25;line([[x,.31],[x,.71]],.016);}line([[-.32,.32],[-.14,.7],[.1,.31],[.31,.69]],.024);}
   if(k===8){arc(0,.5,.27,Math.PI*1.65,.3);line([[.3,.44],[.29,.7],[.08,.68]]);}
   if(k===9){profile(b,water,[[0,.8],[-.2,.43],[-.1,.26],[.12,.26],[.22,.43]],.13);line([[-.1,.34],[.09,.61]],.02);}
   if(k===10){arc(0,.51,.27,Math.PI);line([[-.03,.4],[.22,.71]],.018);line([[.03,.4],[-.19,.7]],.018);}
   if(k===11){line([[-.15,.77],[-.15,.31],[.08,.31],[.08,.77]]);line([[-.23,.78],[.16,.78]]);profile(b,green,[[.08,.43],[.32,.6],[.29,.32]],.13);}
  }else{
   b.add(box(),stone,[0,.045,0],[.58,.09,.42]);b.add(box(),main,[0,.10,0],[.43,.035,.3]);
   if(a.kind==='route-trophy'){
    if(index===0){b.add(ring(Math.PI),water,[-.16,.36,0],[.26,.37,.3]);b.add(ring(Math.PI),main,[.19,.36,.01],[.24,.32,.3]);bar(b,main,[0,.16,0],[0,.95,0],.022);for(let j=0;j<3;j++)b.add(cone(),green,[0,.49+j*.17,.015],[.18-j*.035,.32,.075]);}
    if(index===1){profile(b,main,[[-.45,.14],[-.18,.71],[0,.5],[.18,1],[.44,.14]],.1);path(b,water,[[-.33,.21,-.06],[-.04,.36,-.06],[.11,.2,-.06],[.31,.32,-.06]],.028);}
    if(index===2){path(b,main,[[-.38,.16,.01],[.28,.3,.01],[.35,.4,.01],[-.31,.56,.01],[-.35,.68,.01],[.33,.88,.01],[.32,.98,.01]],.055);path(b,gold,[[-.38,.16,.065],[.28,.3,.065],[.35,.4,.065],[-.31,.56,.065],[-.35,.68,.065],[.33,.88,.065]],.008);}
    if(index===3){profile(b,main,[[-.43,.14],[-.2,.9],[0,.49],[.25,.99],[.46,.14]],.09);profile(b,green,[[-.1,.25],[-.04,.6],[.15,.75],[.22,.58],[.07,.34]],.13);}
    if(index===4){b.add(ring(Math.PI*1.55),main,[0,.76,0],[.37,.19,.55],[0,0,-.85]);for(let j=0;j<9;j++){const x=(j-4)*.075,y=.79-Math.abs(j-4)*.02;bar(b,water,[x,.17,.035],[x,y,.035],.019);}b.add(ring(),water,[0,.18,0],[.39,.08,.25],[Math.PI/2,0,0]);}
   }else{
    const c=index-17;
    if(c===0){bar(b,main,[0,.13,0],[0,.49,0],.055);b.add(ring(),main,[0,.92,0],[.3,.3,.3],[Math.PI/2,0,0]);for(let j=0;j<5;j++){const angle=j*Math.PI*2/5;bar(b,main,[Math.sin(angle)*.10,.44,Math.cos(angle)*.10],[Math.sin(angle)*.3,.92,Math.cos(angle)*.3],.029);}b.add(cylinder(20),main,[0,.42,0],[.12,.05,.12]);}
    if(c===1){const points=[[.08,.14],[.045,.42],[.13,.48],[.25,.65],[.29,.87],[.275,.91]].map(([x,y])=>new T.Vector2(x,y));const g=new T.LatheGeometry(points,40);b.add(g,main);g.dispose();for(const side of [-1,1])b.add(ring(Math.PI*1.7),main,[side*.28,.65,0],[.15,.24,.15],[0,0,side<0?-.9:2.3]);b.add(ring(),gold,[0,.89,0],[.28,.28,.28],[Math.PI/2,0,0]);}
    if(c===2){for(let j=0;j<3;j++){const pts=Array.from({length:9},(_,i)=>{const angle=j*Math.PI*2/3+i*.20;return[Math.sin(angle)*(.1+i*.022),.14+i*.082,Math.cos(angle)*(.1+i*.022)];});path(b,main,pts,.026);}b.add(ring(),main,[0,.85,0],[.3,.3,.3],[Math.PI/2,0,0]);for(let j=0;j<5;j++){const angle=j*Math.PI*2/5;b.add(cone(),gold,[Math.sin(angle)*.30,.93,Math.cos(angle)*.30],[.045,.16,.045]);}}
   }
  }
  b.finish();group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=a.heightM/size.y;const matrix=new T.Matrix4().makeScale(scale,scale,scale).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));group.traverse(o=>{if(o.isMesh){o.geometry.applyMatrix4(matrix);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}});if(a.kind==='test-medal'){const loop=new T.Mesh(new T.TorusGeometry(.008,.002,8,24),main);loop.name='Medal_HangingLoop';loop.position.set(0,a.heightM+.008,.004);loop.castShadow=true;owned.geometries.add(loop.geometry);group.add(loop);}
  group.position.set(...positionFor(a,index));group.visible=false;awardsRoot.add(group);awardGroups.set(a.id,group);
 }
 AWARDS.forEach(awardGeometry);for(const g of primitives.values())g.dispose();primitives.clear();
 function setCollection(next=[]){if(disposed)throw new Error('Workshop collection disposed');if(!Array.isArray(next))throw new TypeError('Collection must be an array');const ids=new Set(next.map(x=>typeof x==='string'?x:x?.id));ignoredIds=[...ids].filter(id=>!awardGroups.has(id));for(const [id,group]of awardGroups){group.visible=ids.has(id);group.userData.earned=group.visible;}return diagnostics();}
 function diagnostics(){let drawCalls=0,triangles=0;root.traverseVisible(o=>{if(o.isMesh){drawCalls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return{disposed,front:'+Z',construction:{continuousBackStandards:4,bracketSpansM:[1.19,1.20,1.19],hookReachM:.288,hookBackGapM:0,antiTipPlates:2,selectiveShadows:true},dimensionsM:[3.8,2.2,.42],hardwareOverallDepthM:.485,occupiedIds:[...awardGroups].filter(([,g])=>g.visible).map(([id])=>id),ignoredIds:[...ignoredIds],slots:slots.map(s=>({...s,position:[...s.position]})),drawCalls,triangles,geometries:owned.geometries.size,materials:owned.materials.size,ownedTextures:owned.textures.size,atlasAvailable:!!ctx,decorativePosters:displayedPosters.length,transmissionPass:false};}
 function dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.clear();for(const set of Object.values(owned)){for(const resource of set)resource.dispose();set.clear();}awardGroups.clear();if(canvas){canvas.width=1;canvas.height=1;}canvas=null;}
 function setEnvironment(texture=null){if(disposed)throw new Error('Workshop collection disposed');for(const m of owned.materials)if(m.isMeshStandardMaterial&&m.envMap!==texture){m.envMap=texture;m.needsUpdate=true;}}
 setCollection(collection);return Object.freeze({root,setCollection,setEnvironment,diagnostics,dispose});
}
