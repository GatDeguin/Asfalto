// World metres after the legacy room import. Construction is reversible; source GLB stays intact.
export const WORKSHOP_E31_LAYOUT=Object.freeze({floorY:.1883417943,inside:{left:-8.70165746,right:8.70165746,back:-5.86118786,front:5.94820445,ceiling:4.75359115},cabinet:{position:[-5.8,.1893417943,5.70],width:3.8,depth:.42},gate:{width:6.86,height:4.1,x:0,z:6.50},service:{width:1.265,height:2.10,x:8.765,z:3.835},lowShelf:{position:[-8.10,.1790055349,3.20],yaw:Math.PI/2},tealShiftX:-.36});

function createDepartureExterior(T,floorY){
 const positions=[],colors=[],indices=[],palette=new Map();
 const color=hex=>{if(!palette.has(hex))palette.set(hex,new T.Color(hex));return palette.get(hex);};
 const solid=hex=>()=>color(hex);
 function quad(points,tone){
  const start=positions.length/3;
  for(const point of points){
   positions.push(...point);
   const {r,g,b}=tone(...point);colors.push(r,g,b);
  }
  indices.push(start,start+1,start+2,start,start+2,start+3);
 }
 const flat=(x0,x1,y,z0,z1,tone)=>quad([[x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0]],tone);
 const front=(x0,x1,y0,y1,z,tone)=>quad([[x0,y0,z],[x0,y1,z],[x1,y1,z],[x1,y0,z]],tone);
 const ground=floorY-.001,curb=floorY+.11;
 const between=(value,low,high)=>Math.max(0,Math.min(1,(value-low)/(high-low)));
 const pools=[[-5.0,18.6],[6.1,19.4]];
 const warmAt=(x,z)=>Math.max(...pools.map(([px,pz])=>Math.exp(-(((x-px)/2.9)**2+((z-pz)/3.25)**2))));

 // The lane runs across the shot. The vehicle's straight exit stays on the apron.
 const pavement=new T.Color();
 const pavementTone=(x,_y,z)=>{
  const concrete=color('#343943'),asphalt=color('#202631');
  const patch=.04*(1+Math.sin(x*1.7+z*.84)*Math.cos(z*1.6-x*.64));
  return pavement.copy(concrete).lerp(asphalt,between(z,10.9,12.15)).lerp(color('#645746'),warmAt(x,z)*.39)
   .lerp(color('#171c27'),patch);
 };
 const streetX=[-28,-16,-10,-7,-5,-3,-1,1,3,6,8,10,16,28];
 const streetZ=[6.24,6.53,7.8,9.82,11.66,12.35,14.8,16.5,17.7,21.4,28.5];
 for(let j=1;j<streetZ.length;j++)for(let i=1;i<streetX.length;i++)
  flat(streetX[i-1],streetX[i],ground,streetZ[j-1],streetZ[j],pavementTone);
 for(const z of [7.8,9.82,11.66])flat(-10.8,10.8,ground+.0017,z-.012,z+.012,solid('#242831'));
 for(const [x,z0,z1]of [[-2.54,6.54,7.8],[-1.23,7.8,9.82],[-2.03,9.82,11.66],[3.11,6.54,11.66]])
  flat(x-.012,x+.012,ground+.0017,z0,z1,solid('#252a33'));
 for(let i=1;i<streetX.length;i++){
  const x0=streetX[i-1],x1=streetX[i];
  front(x0,x1,ground,curb,17.73,(_x,y)=>y<curb?color('#2b313b'):color('#585762'));
  flat(x0,x1,curb,17.73,20.65,(x,_y,z)=>pavementTone(x,0,z).lerp(color('#65616a'),.23));
 }
 for(const x of [-18,-14,-10,-6,-2,2,6,10,14,18])
  flat(x-.009,x+.009,curb+.0015,17.74,20.5,solid('#31323c'));

 // A few industrial bays, their returns and rooflines give the gate a real horizon.
 const facade=new T.Color();
 const facadeTone=(x,y)=>{
  const near=Math.max(
   Math.exp(-(((x+5)/2.3)**2+((y-floorY-3.8)/1.8)**2)),
   Math.exp(-(((x-6.1)/2.4)**2+((y-floorY-4.0)/1.8)**2))
  );
  return facade.copy(color('#293240')).lerp(color('#394855'),between(y,floorY,floorY+6))
   .lerp(color('#73614c'),near*.65);
 };
 function warehouse(x0,x1,z,height){
  const top=floorY+height;
  const bands=[curb,floorY+1.2,floorY+2.8,floorY+4.0,top];
  const sections=Math.ceil((x1-x0)/2.6);
  for(let i=0;i<sections;i++)for(let j=1;j<bands.length;j++){
   const left=x0+(x1-x0)*i/sections,right=x0+(x1-x0)*(i+1)/sections;
   front(left,right,bands[j-1],bands[j],z,facadeTone);
  }
  front(x0-.14,x1+.14,top-.18,top+.09,z-.09,solid('#46515d'));
  quad([[x0,curb,z+3.2],[x0,top,z+3.2],[x0,top,z],[x0,curb,z]],solid('#293441'));
  quad([[x1,curb,z],[x1,top,z],[x1,top,z+3.2],[x1,curb,z+3.2]],solid('#303b47'));
 }
 warehouse(-24,-10.6,23.0,6.65);
 warehouse(-10.6,9.1,20.42,5.28);
 warehouse(9.1,25,22.6,6.18);
 for(const x of [-8.35,-2.05,3.40,8.37])
  front(x-.12,x+.12,curb,floorY+5.17,20.31,solid('#4a4650'));
 for(const x of [-5.08,.75,5.93]){
  const z=20.40,width=1.88,bottom=curb+.03,top=floorY+3.17;
  front(x-width-.17,x+width+.17,bottom-.01,top+.25,z-.07,solid('#514a44'));
  front(x-width,x+width,bottom,top,z-.10,(_x,y)=>facade.copy(color('#252c35')).lerp(color('#424751'),between(y,bottom,top)));
  for(let i=1;i<12;i++){
   const y=bottom+(top-bottom)*i/12;
   front(x-width,x+width,y,y+.015,z-.12,solid('#30343a'));
  }
  front(x-.62,x+.62,floorY+3.81,floorY+4.10,z-.13,solid(x>.5&&x<1?'#504b42':'#9e7850'));
  for(const dx of [-.31,0,.31])front(x+dx-.019,x+dx+.019,floorY+3.81,floorY+4.10,z-.14,solid('#383a3b'));
 }
 for(const [x0,x1,height]of [[-21,-13,7.8],[-10,-3.9,6.58],[3.7,8.5,7.2],[9.8,17.5,8.3]]){
  front(x0,x1,floorY,floorY+height,29,solid('#202c3d'));
  front(x0+.65,x0+1.17,floorY+height,floorY+height+.87,29.1,solid('#243144'));
 }
 const sky=new T.Color();
 const skyTone=(x,y)=>sky.copy(color('#354454')).lerp(color('#101725'),between(y,floorY+2,floorY+24))
  .lerp(color('#4d4951'),Math.exp(-((x/23)**2))*(1-between(y,floorY+4,floorY+12))*.23);
 for(const [y0,y1]of [[0,4],[4,8],[8,13],[13,24],[24,37]])for(const [x0,x1]of [[-64,-24],[-24,0],[0,24],[24,64]])
  front(x0,x1,floorY+y0,floorY+y1,47,skyTone);

 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);
 geometry.computeBoundingSphere();
 const material=new T.MeshBasicMaterial({name:'E31_BakedNightStreet',vertexColors:true});
 const exterior=new T.Mesh(geometry,material);
 exterior.name='E31_DepartureExterior';exterior.visible=false;
 Object.assign(exterior.userData,{asfaltoPrewarm:true,cameraCollision:false,pivotPainter:false});
 return exterior;
}

export function createWorkshopArchitectureE31(T,workshop,{floorY=WORKSHOP_E31_LAYOUT.floorY}={}){
 const {scene,workshopRoot:source}=workshop,root=new T.Group(),staticRoot=new T.Group(),doorRoot=new T.Group(),owned=new Set(),changed=[],records=[];let disposed=false,gateOpen=0,serviceOpen=0;
 root.userData.pivotPainter=false;root.name='Workshop_Architecture_E31';staticRoot.name='E31_StaticConstruction';doorRoot.name='E31_OperableDoors';root.add(staticRoot,doorRoot);scene.add(root);source.updateWorldMatrix(true,true);
 const originalBounds=new T.Box3().setFromObject(source),materials={};
 const mat=(name,color,roughness=.82,metalness=0)=>materials[name]||(materials[name]=new T.MeshStandardMaterial({name,color,roughness,metalness}));
 const plaster=mat('MAT_Wall_Plaster_Aged','#c9bca7'),blue=mat('MAT_Wall_Blue_OilPaint','#6d8988'),steel=mat('MAT_Steel_Blackened','#454a45',.65,.65),zinc=mat('E31_Galvanized','#87908a',.48,.72),rubber=mat('E31_Rubber','#242725',.95),concrete=mat('E31_ConcreteThreshold','#89877c',.95),red=mat('E31_DoorPaint','#667b73',.65,.22);
 const boxGeo=new T.BoxGeometry(1,1,1),cylGeo=new T.CylinderGeometry(1,1,1,12);owned.add(boxGeo);owned.add(cylGeo);
 function mesh(name,geometry,material,p,s,r=[0,0,0],parent=staticRoot){const m=new T.Mesh(geometry,material);m.name=name;m.position.fromArray(p);m.scale.fromArray(s);m.rotation.set(...r);m.castShadow=true;m.receiveShadow=true;parent.add(m);records.push({name,position:[...p],size:[...s],rotation:[...r],parent:parent.name});return m;}
 const box=(name,p,s,m=steel,r,parent)=>mesh(name,boxGeo,m,p,s,r,parent);
 const cylinder=(name,p,r,h,m=zinc,rotation=[0,0,0],parent)=>mesh(name,cylGeo,m,p,[r,h,r],rotation,parent);
 function hide(name){const n=source.getObjectByName(name);if(!n)return;changed.push({node:n,visible:n.visible});n.visible=false;}
 function moveNodeWorld(node,delta){if(!node)return;changed.push({node,position:node.position.clone()});const world=node.getWorldPosition(new T.Vector3()).add(new T.Vector3(...delta));node.position.copy(node.parent.worldToLocal(world));node.updateMatrixWorld(true);}
 function relocate(name,target,yaw=0,{supportLevels=[]}={}){const n=source.getObjectByName(name);if(!n)return;const b=new T.Box3().setFromObject(n),center=b.getCenter(new T.Vector3());center.y=b.min.y;const assembly=new T.Group();assembly.name='E31_Relocated_'+name;assembly.position.copy(center);staticRoot.add(assembly);assembly.updateMatrixWorld(true);const members=[n];source.traverse(x=>{if(!/^(PRP_|TOL_)/.test(x.name)||members.some(p=>p===x||p.getObjectById(x.id)))return;const bounds=new T.Box3().setFromObject(x),c=bounds.getCenter(new T.Vector3());if(c.x>=b.min.x&&c.x<=b.max.x&&c.z>=b.min.z&&c.z<=b.max.z&&supportLevels.some(y=>Math.abs(bounds.min.y-y)<.025))members.push(x);});for(const x of members){changed.push({node:x,parent:x.parent,position:x.position.clone(),quaternion:x.quaternion.clone(),scale:x.scale.clone()});assembly.attach(x);}assembly.position.fromArray(target);assembly.rotation.y=yaw;assembly.updateMatrixWorld(true);records.push({name:assembly.name,from:center.toArray(),to:target,yaw,members:members.map(x=>x.name)});}
 // AR-01/03: real voids, not doors drawn on solid walls.
 for(const name of ['ARC_Wall_Front','ARC_Wall_Right','ARC_Wall_Left','ARC_Wall_Left_Upper','DOR_Front_Roller','DOR_Service_Right','ARC_Ceiling'])hide(name);
 const I=WORKSHOP_E31_LAYOUT.inside,top=I.ceiling,base=.179005535,gateTop=floorY+4.1,halfGate=3.43,thickness=.29834254;
 for(const side of [-1,1])box('E31_FrontPier_'+side,[side*(halfGate+(I.right-halfGate)/2),(base+top)/2,6.09737572],[I.right-halfGate,top-base,thickness],plaster);
 box('E31_FrontPortalLintel',[0,(gateTop+top)/2,6.09737572],[6.86,top-gateTop,thickness],concrete);
 // Steel door frame leaves a 6.86m useful drive-through width and a flush threshold.
 for(const side of [-1,1]){box('E31_GateGuideWeb_'+side,[side*3.555,(floorY+gateTop)/2,6.4935],[.018,4.1,.045],steel);for(const z of[6.475,6.512])box('E31_GateGuideFlange_'+side+'_'+z,[side*3.49,(floorY+gateTop)/2,z],[.12,4.1,.008],steel);}
 // Exterior guides are tied to the masonry by continuous folded jamb returns, not left across an open setback.
 // The inside face remains at +/-3.43m, preserving the nominal6.86m passage.
 const returnBottom=floorY-.002,returnTop=gateTop+.060;
 for(const side of[-1,1]){
  box('E31_GateJambReturn_'+side,[side*3.432,(returnBottom+returnTop)/2,6.3495],[.004,returnTop-returnBottom,.259],steel);
  box('E31_GateJambWallFlange_'+side,[side*3.50,(returnBottom+returnTop)/2,6.248],[.140,returnTop-returnBottom,.006],steel);
  cylinder('E31_GateJambGuideWeld_'+side,[side*3.434,(returnBottom+gateTop)/2,6.481],.0021,gateTop-returnBottom,zinc);
  for(const y of[.20,.95,1.70,2.45,3.20,3.95]){cylinder('E31_GateJambAnchorShaft_'+side,[side*3.515,floorY+y,6.226],.0035,.050,steel,[Math.PI/2,0,0]);cylinder('E31_GateJambAnchorHead_'+side,[side*3.515,floorY+y,6.254],.007,.006,zinc,[Math.PI/2,0,0]);}
 }
 box('E31_GateHeadGuide',[0,gateTop+.015,6.36],[7.02,.055,.06],steel);
 box('E31_GateThreshold',[0,floorY-.018,6.15],[6.86,.036,.75],concrete);
 const apron=box('E31_ExteriorApron',[0,floorY-.064,9.17],[8.5,.12,6.0],concrete);
 apron.castShadow=false;
 const exterior=createDepartureExterior(T,floorY);
 root.add(exterior);owned.add(exterior.geometry);owned.add(exterior.material);
 const doorMin=3.2025,doorMax=4.4675,serviceTop=floorY+2.1;
 for(const [a,b,label]of [[I.back,doorMin,'Back'],[doorMax,I.front,'Front']])box('E31_ServiceWall_'+label,[8.85082873,(base+top)/2,(a+b)/2],[thickness,top-base,b-a],plaster);
 box('E31_ServiceLintel',[8.85082873,(serviceTop+top)/2,3.835],[thickness,top-serviceTop,1.265],plaster);
 for(const z of [doorMin-.025,doorMax+.025])box('E31_ServiceJamb_'+z,[8.752,(floorY+serviceTop)/2,z],[.15,2.1,.05],steel);
 box('E31_ServiceHead',[8.752,serviceTop+.025,3.835],[.15,.05,1.365],steel);
 box('E31_ServiceThreshold',[8.92,floorY-.010,3.835],[.65,.020,1.265],concrete);
 // AR-04: three intentional closed windows; masonry fills every other strip.
 const apertures=[[-5.53798345,-3.32527627],[-3.05179542,-.83908823],[-.56560753,1.64709965]],sill=1.65082878,head=4.11712718;
 box('E31_LeftSillWall',[-8.85082873,(base+sill)/2,(I.back+I.front)/2],[thickness,sill-base,I.front-I.back],blue);
 box('E31_LeftHeadWall',[-8.85082873,(head+top)/2,(I.back+I.front)/2],[thickness,top-head,I.front-I.back],plaster);
 let cursor=I.back;for(const [i,[a,b]]of apertures.entries()){if(a>cursor)box('E31_LeftPier_'+i,[-8.85082873,(sill+head)/2,(cursor+a)/2],[thickness,head-sill,a-cursor],plaster);box('E31_WindowSill_'+i,[-8.725,sill-.025,(a+b)/2],[.40,.05,b-a+.09],concrete);for(const z of[a,b])box('E31_WindowReveal_'+i+'_'+z,[-8.81,(sill+head)/2,z],[.25,head-sill,.035],plaster);cursor=b;}box('E31_LeftFrontClosure',[-8.85082873,(sill+head)/2,(cursor+I.front)/2],[thickness,head-sill,I.front-cursor],plaster);
 // AR-05: I-section members enter 0.21m into the bearing walls; front central members land on the portal header.
 for(let i=1;i<=6;i++){const n=source.getObjectByName('ARC_Beam_'+String(i).padStart(2,'0'));if(!n)continue;const b=new T.Box3().setFromObject(n),x=b.getCenter(new T.Vector3()).x,lift=(8.995-Math.abs(x))*.018;hide(n.name);for(const y of[4.344,4.713])box('E31_Beam_'+i+'_Flange_'+y,[x,y+lift,.044],[.22,.026,12.23],steel);box('E31_Beam_'+i+'_Web',[x,4.5285+lift,.044],[.012,.343,12.23],steel);for(const z of[-5.975,6.058]){box('E31_BearingPlate_'+i+'_'+z,[x,4.32+lift,z],[.35,.022,.30],zinc);box('E31_BeamEndPlate_'+i+'_'+z,[x,4.52+lift,z<0?-5.856:5.943],[.26,.405,.014],zinc);for(const dx of[-.09,.09])for(const y of[4.39,4.64])cylinder('E31_BearingBolt',[x+dx,y+lift,z<0?-5.842:5.929],.009,.021,zinc,[Math.PI/2,0,0]);}}
 // AR-10: shallow pitched steel roof on secondary rails, a visible folded edge and real downpipes.
 const roof=new T.BoxGeometry(17.99,.055,12.4,2,1,1),rp=roof.attributes.position;for(let i=0;i<rp.count;i++)rp.setY(i,rp.getY(i)+(8.995-Math.abs(rp.getX(i)))*.018);roof.computeVertexNormals();owned.add(roof);mesh('E31_RoofDeck',roof,zinc,[0,4.7955,0.044],[1,1,1]);
 for(let j=0;j<9;j++){const g=new T.BoxGeometry(17.55,.043,.075,2,1,1),a=g.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)+(8.995-Math.abs(a.getX(i)))*.018);g.computeVertexNormals();owned.add(g);mesh('E31_RoofPurlin_'+j,g,steel,[0,4.7475,-5.55+j*1.39],[1,1,1]);}
 for(const z of [-6.15953,5.94820]){const shape=new T.Shape();shape.moveTo(-9,4.75359);shape.lineTo(9,4.75359);shape.lineTo(9,4.7955);shape.lineTo(0,4.95741);shape.lineTo(-9,4.7955);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.29834,bevelEnabled:false});owned.add(g);mesh('E31_GableClosure_'+z,g,plaster,[0,0,z],[1,1,1]);}
 for(const x of[-9.045,9.045]){box('E31_RoofFascia_'+x,[Math.sign(x)*8.99,4.70,.044],[.025,.24,12.4],zinc);box('E31_GutterBottom_'+x,[x,4.73,.044],[.15,.02,12.4],zinc);for(const dx of[-.075,.075]){const inner=Math.abs(x+dx)<Math.abs(x);box(inner?'E31_GutterInnerLip':'E31_GutterOuterLip',[x+dx,inner?4.749:4.79,.044],[.015,inner?.035:.13,12.4],zinc);};for(const z of[-5.9,5.95]){cylinder('E31_Downpipe_'+x+'_'+z,[x,(floorY+4.73)/2,z],.0375,4.73-floorY,zinc);for(const y of[.65,2.4,4.25])box('E31_DownpipeClip',[x,y,z],[.105,.045,.095],steel);box('E31_DrainShoe',[x,floorY+.055,z],[.16,.11,.25],concrete);}}
 // AR-06: move source junctions and conduit together to the inner wall; clamps physically bridge back to plaster.
 const electrical=[];source.traverse(n=>{if(!/^ARC_(Conduit|JunctionBox)/.test(n.name))return;for(let p=n.parent;p&&p!==source;p=p.parent)if(/^ARC_(Conduit|JunctionBox)/.test(p.name))return;electrical.push(n);});
 for(const n of electrical)moveNodeWorld(n,[0,0,.39]);
 // Half-round saddles clasp the measured pipe, with two legs anchored into the wall.
 const saddleGeo=new T.TorusGeometry(.0205,.0023,6,14,Math.PI);owned.add(saddleGeo);
 function conduitSaddle(x,y,z,horizontal=false,rx=.0174,rz=.01655){const wall=I.back-.002,front=z+.001,depth=front-wall;for(const side of[-1,1]){const p=horizontal?[x,y+side*(rx+.006),(wall+front)/2]:[x+side*(rx+.006),y,(wall+front)/2];box('E31_ConduitStandOff',p,horizontal?[.032,.009,depth]:[.009,.032,depth],zinc);cylinder('E31_ConduitFixing',[p[0],p[1],I.back+.004],.0035,.008,steel,[Math.PI/2,0,0]);}const g=new T.Group();g.position.set(x,y,z);if(horizontal)g.rotation.z=Math.PI/2;staticRoot.add(g);mesh('E31_ConduitSaddle',saddleGeo,zinc,[0,0,0],[rx/.0182,rz/.0182,1],[Math.PI/2,0,0],g);}
 for(const n of electrical){const b=new T.Box3().setFromObject(n),c=b.getCenter(new T.Vector3());if(n.name.startsWith('ARC_Conduit_Drop_'))for(const y of[2.24,3.06,3.81])conduitSaddle(c.x,y,c.z,false,(b.max.x-b.min.x)/2,(b.max.z-b.min.z)/2);else if(n.name==='ARC_Conduit_Back_Main')for(const x of[-6,-2,2,6])conduitSaddle(x,c.y,c.z,true,(b.max.y-b.min.y)/2,(b.max.z-b.min.z)/2);}
 // AR-12/13: complete assemblies and their supported props move together.
 relocate('FUR_LowShelf_Center',WORKSHOP_E31_LAYOUT.lowShelf.position,Math.PI/2,{supportLevels:[.22872929,.83038676,1.43204424]});
 const teal=source.getObjectByName('FUR_ToolChest_Teal');if(teal){const b=new T.Box3().setFromObject(teal),c=b.getCenter(new T.Vector3());relocate('FUR_ToolChest_Teal',[c.x-.36,b.min.y,c.z],0,{supportLevels:[1.61104978]});}
 // Operable roller curtain: each narrow lath follows a take-up path, never translates through the roof as a solid sheet.
 const count=66,lathHeight=4.1/count,lathLength=lathHeight-.001,rollStartRadius=.145,rollPitch=.021,rollK=rollPitch/(2*Math.PI),rollY=gateTop+.215,rollZ=6.74;
 // A 1.2mm folded sheet, with a concave broad face and returned edges. The silhouette is geometry.
 const faceProfile=[[-.5,-.001],[-.43,.001],[-.34,0],[-.20,-.006],[0,-.011],[.20,-.006],[.34,0],[.43,.001],[.5,-.001]],sheet=.0012;
 const section=[...faceProfile,...[...faceProfile].reverse().map(([y,z])=>[y,z+sheet])],lathShape=new T.Shape();section.forEach(([y,z],i)=>i?lathShape.lineTo(-z,y):lathShape.moveTo(-z,y));lathShape.closePath();const lathGeo=new T.ExtrudeGeometry(lathShape,{depth:1,steps:1,bevelEnabled:false});lathGeo.rotateY(Math.PI/2);lathGeo.translate(-.5,0,0);owned.add(lathGeo);
 const gate=new T.InstancedMesh(lathGeo,red,count),matrix=new T.Matrix4(),q=new T.Quaternion();owned.add(gate);gate.name='E31_RollerCurtain';gate.userData.profile={section,height:lathLength,width:6.92,sheetM:sheet,pitchM:rollPitch,startRadiusM:rollStartRadius,axis:[rollY,rollZ]};gate.castShadow=true;gate.receiveShadow=true;doorRoot.add(gate);
 cylinder('E31_RollerDrum',[0,rollY,rollZ],.140,7.00,zinc,[0,0,Math.PI/2]);box('E31_RollerMotor',[-3.69,rollY,rollZ],[.25,.26,.25],steel);
 box('E31_RollerCassetteTop',[0,4.795,6.72],[7.90,.030,.63],zinc);box('E31_RollerCassetteFront',[0,4.51,7.025],[7.90,.54,.020],zinc);
 for(const x of[-3.93,3.93])box('E31_RollerCassetteEnd',[x,4.51,6.72],[.03,.54,.63],zinc);
 for(const x of[-3.49,3.49]){box('E31_RollerBearingStand',[Math.sign(x)*3.54,(gateTop+rollY)/2,6.62],[.065,rollY-gateTop+.08,.28],steel);box('E31_RollerBearing',[x,rollY,rollZ],[.08,.065,.065],zinc);}
 cylinder('E31_RollerDriveShaft',[-3.57,rollY,rollZ],.018,.20,steel,[0,0,Math.PI/2]);
 for(const y of [.29,1.04,1.81])box('E31_ServiceFixedHingePlate',[8.721,floorY+y,3.164],[.086,.075,.057],zinc);
 const spiralPrimitive=r=>(r*Math.hypot(r,rollK)+rollK*rollK*Math.log(r+Math.hypot(r,rollK)))/(2*rollK),spiralZero=spiralPrimitive(rollStartRadius);
 function spiralAngle(travel){let angle=(Math.sqrt(rollStartRadius*rollStartRadius+2*rollK*travel)-rollStartRadius)/rollK;for(let j=0;j<4;j++){const r=rollStartRadius+rollK*angle;angle-=(spiralPrimitive(r)-spiralZero-travel)/Math.hypot(r,rollK);}return angle;}
 function setGateOpen(value){
  gateOpen=Math.max(0,Math.min(1,Number(value)||0));const lift=gateOpen*4.1,bridgeHeight=rollY-gateTop,smooth=u=>u*u*(3-2*u);let radius=rollStartRadius,bridge=[],bridgeLength=bridgeHeight,rolled=0;
  // The incoming sheet joins the outside of the roll. A short guide bows to its changing tangent.
  for(let solve=0;solve<6;solve++){const endZ=rollZ-radius;bridge=[[0,0]];bridgeLength=0;let py=gateTop,pz=6.50;for(let j=1;j<=48;j++){const u=j/48,y=gateTop+u*bridgeHeight,z=6.50+(endZ-6.50)*smooth(u);bridgeLength+=Math.hypot(y-py,z-pz);bridge.push([u,bridgeLength]);py=y;pz=z;}rolled=Math.max(0,lift-bridgeLength);radius=rollStartRadius+rollK*spiralAngle(rolled);}
  const endZ=rollZ-radius;
  for(let i=0;i<count;i++){const distance=(i+.5)*lathHeight+lift;let y=floorY+distance,z=6.50,angle=0;if(distance>4.1&&distance<=4.1+bridgeLength){const d=distance-4.1;let j=1;while(j<bridge.length-1&&bridge[j][1]<d)j++;const [u0,s0]=bridge[j-1],[u1,s1]=bridge[j],u=u0+(u1-u0)*(d-s0)/(s1-s0);y=gateTop+u*bridgeHeight;z=6.50+(endZ-6.50)*smooth(u);angle=Math.atan2((endZ-6.50)*6*u*(1-u),bridgeHeight);}else if(distance>4.1+bridgeLength){const travel=distance-4.1-bridgeLength,r=rollStartRadius+rollK*spiralAngle(Math.max(0,rolled-travel)),theta=(radius-r)/rollK;y=rollY+Math.sin(theta)*r;z=rollZ-Math.cos(theta)*r;angle=theta+Math.atan2(rollK,r);}q.setFromEuler(new T.Euler(angle,0,0));matrix.compose(new T.Vector3(0,y,z),q,new T.Vector3(6.92,lathLength,1));gate.setMatrixAt(i,matrix);}
  gate.instanceMatrix.needsUpdate=true;gate.computeBoundingBox();gate.computeBoundingSphere();return gateOpen;
 }
 const servicePivot=new T.Group();servicePivot.name='E31_ServiceDoorHinge';servicePivot.position.set(8.67,floorY,doorMin);doorRoot.add(servicePivot);box('E31_ServiceLeaf',[0,1.04,.6325],[.045,2.08,1.255],red,undefined,servicePivot);for(const z of[.04,1.23])box('E31_ServiceStile',[-.027,1.04,z],[.018,2.02,.032],steel,undefined,servicePivot);for(const y of[.29,1.04,1.81]){cylinder('E31_ServiceHinge',[0,y,0],.018,.115,zinc,undefined,servicePivot);box('E31_ServiceHingePlate',[-.009,y,.045],[.028,.07,.09],zinc,undefined,servicePivot);}box('E31_ServicePull',[-.070,1.06,1.115],[.048,.13,.016],zinc,undefined,servicePivot);box('E31_ServiceLatch',[-.028,1.04,1.225],[.035,.12,.035],steel,undefined,servicePivot);

 // Merge only the rigid leaf's local pieces, preserving its hinge and keeping it out of room batching.
 const leafGroups=new Map();for(const child of [...servicePivot.children]){child.updateMatrix();let g=child.geometry.clone();g.applyMatrix4(child.matrix);if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}if(!leafGroups.has(child.material))leafGroups.set(child.material,[]);leafGroups.get(child.material).push(g);child.removeFromParent();}
 for(const [material,pieces]of leafGroups){const g=new T.BufferGeometry();for(const key of ['position','normal','uv']){const size=key==='uv'?2:3,values=new Float32Array(pieces.reduce((n,p)=>n+p.attributes.position.count,0)*size);let at=0;for(const p of pieces){values.set(p.attributes[key].array,at);at+=p.attributes[key].array.length;}g.setAttribute(key,new T.Float32BufferAttribute(values,size));}pieces.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();owned.add(g);const leaf=new T.Mesh(g,material);leaf.name='E31_ServiceLeaf_'+material.name;leaf.castShadow=true;leaf.receiveShadow=true;servicePivot.add(leaf);}
 function setServiceOpen(value){serviceOpen=Math.max(0,Math.min(1,Number(value)||0));servicePivot.rotation.y=-serviceOpen*Math.PI/2;servicePivot.updateMatrixWorld(true);return serviceOpen;}
 setGateOpen(0);setServiceOpen(0);for(const m of Object.values(materials))owned.add(m);root.updateMatrixWorld(true);
 const diagnostics=()=>({version:'E31-construction-1',units:'world metres',gateOpen,serviceOpen,gateClearM:[6.86,4.05],serviceClearM:[1.2425,2.10],beamBearingM:.21,beamDepthM:.395,roofFall:'1.8% from central ridge to both side gutters',roofPurlinBearing:'purlin soffit touches I-flange top along sloped profile',cabinet:WORKSHOP_E31_LAYOUT.cabinet,originalBounds:{min:originalBounds.min.toArray(),max:originalBounds.max.toArray()},records,disposed});
 return{root,staticRoot,doorRoot,setGateOpen,setServiceOpen,diagnostics,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const r of changed.reverse()){if(r.parent)r.parent.add(r.node);if(r.position)r.node.position.copy(r.position);if(r.quaternion)r.node.quaternion.copy(r.quaternion);if(r.scale)r.node.scale.copy(r.scale);if(r.visible!==undefined)r.node.visible=r.visible;}for(const x of owned)x.dispose?.();owned.clear();}};
}
