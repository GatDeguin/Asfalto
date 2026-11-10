// Coordinates are local to the shipped R53 cabin or the expansion LOD0.
// Upper surfaces are sampled on the donor, so trim follows the actual seat and floor.
const finishes={
 chevy_400_1957:{
  floor:{base:'#303336',dark:'#171a1b',light:'#424548',edge:'#666058',pattern:'diamond'},
  seat:{base:'#54504b',dark:'#34312c',light:'#65605a',edge:'#a09480',pattern:'perforation'},
 },
 pickup_3100:{
  floor:{base:'#373d3a',dark:'#212724',light:'#585f56',edge:'#737b6c',pattern:'ribs'},
  seat:{base:'#38615d',dark:'#294947',light:'#537a72',edge:'#8f9c83',pattern:'bench'},
 },
 belair_1957:{
  floor:{base:'#365052',dark:'#253b3d',light:'#456165',edge:'#a19578',pattern:'weave'},
  seat:{base:'#cbbb97',dark:'#a39677',light:'#e4d4ac',edge:'#a08d6d',pattern:'weave'},
 },
};

function drawSurface(T,finish,heightMap){
 const canvas=globalThis.document?.createElement?.('canvas');
 if(!canvas)return null;
 canvas.width=canvas.height=256;
 const c=canvas.getContext('2d');
 if(!c)return null;
 const {pattern}=finish;
 const [base,dark,light,edge]=heightMap?['#747474','#414141','#a3a3a3','#b7b7b7']
  :[finish.base,finish.dark,finish.light,finish.edge];
 c.fillStyle=base;c.fillRect(0,0,256,256);
 if(pattern==='diamond'){
  for(let y=3;y<255;y+=14)for(let x=5;x<255;x+=18){
   const u=x+(y%28<14?0:9);
   c.fillStyle=dark;c.fillRect(u,y,7,3);
   c.fillStyle=light;c.fillRect(u+1,y,5,2);
  }
 }else if(pattern==='ribs'){
  for(let x=9;x<250;x+=12){
   c.fillStyle=dark;c.fillRect(x,4,4,248);
   c.fillStyle=light;c.fillRect(x+4,4,2,248);
  }
 }else if(pattern==='perforation'){
  for(let y=4;y<253;y+=8)for(let x=4;x<253;x+=8){
   c.fillStyle=light;c.fillRect(x+1,y,3,3);
   c.fillStyle=dark;c.fillRect(x,y,2,2);
  }
 }else{
  for(let y=4;y<256;y+=5)for(let x=4;x<256;x+=6){
   const u=x+(y%10<5?0:3);
   c.fillStyle=dark;c.fillRect(u,y,3,1);
   c.fillStyle=light;c.fillRect(u+1,y+1,3,1);
  }
 }
 c.strokeStyle=edge;c.lineWidth=3;
 c.beginPath();c.roundRect(8,8,240,240,18);c.stroke();
 if(pattern==='bench'||pattern==='perforation'){
  for(const x of pattern==='bench'?[48,101,155,208]:[28,228]){
   c.fillStyle=dark;c.fillRect(x,12,3,232);
   c.fillStyle=edge;
   for(let y=16;y<241;y+=8)c.fillRect(x+3,y,1.5,4);
  }
 }
 const texture=new T.CanvasTexture(canvas);
 if(!heightMap)texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=4;
 return texture;
}

function targetsBelow(root){
 const meshes=[];
 root?.traverse(node=>{if(node.isMesh)meshes.push(node);});
 return meshes;
}

function projectVinylUVs(T,frame,mesh){
 const geo=mesh.geometry.clone(),position=geo.attributes.position;
 const transform=frame.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
 const point=new T.Vector3(),coordinates=new Float32Array(position.count*2);
 let left=Infinity,right=-Infinity,front=Infinity,back=-Infinity;
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(transform);
  coordinates[2*i]=point.x;coordinates[2*i+1]=point.y;
  left=Math.min(left,point.x);right=Math.max(right,point.x);
  front=Math.min(front,point.y);back=Math.max(back,point.y);
 }
 if(right-left<1e-5||back-front<1e-5){geo.dispose();return null;}
 for(let i=0;i<coordinates.length;i+=2){
  coordinates[i]=(coordinates[i]-left)/(right-left);
  coordinates[i+1]=1-(coordinates[i+1]-front)/(back-front);
 }
 // Leave the donor UVs for normal and ambient occlusion textures intact.
 geo.setAttribute('uv3',new T.BufferAttribute(coordinates,2));
 return geo;
}

// Use a rounded UV grid. Its triangles and normals are built from the real hits.
// Abort rather than bridging a gap, a different seat, or a missing donor.
function fittedSurface(T,frame,targets,{center,width,length,min,max,ss400}){
 if(!targets.length)return null;
 const steps=ss400?12:6,positions=[],uv=[],indices=[],ray=new T.Raycaster();
 const direction=new T.Vector3(0,ss400?0:-1,ss400?1:0).transformDirection(frame.matrixWorld);
 const corner=Math.min(width,length)*.15;
 for(let y=0;y<=steps;y++){
  const t=y/steps,v=(t-.5)*length;
  const curve=Math.max(0,Math.abs(v)-length*.5+corner);
  const half=width*.5-corner+Math.sqrt(Math.max(0,corner*corner-curve*curve));
  for(let x=0;x<=steps;x++){
   const s=x/steps,u=(2*s-1)*half;
   const start=ss400?new T.Vector3(center[0]+u,center[1]-v,min-.045)
    :new T.Vector3(center[0]+v,max+.025,center[1]+u);
   ray.set(frame.localToWorld(start),direction);
   const hit=ray.intersectObjects(targets,false)[0];
   if(!hit)return null;
   const p=frame.worldToLocal(hit.point),height=ss400?p.z:p.y;
   if(height<min||height>max)return null;
   if(ss400)p.z-=.0016;else p.y+=.0008;
   positions.push(p.x,p.y,p.z);uv.push(s,t);
   if(x<steps&&y<steps){const i=y*(steps+1)+x;indices.push(i,i+1,i+steps+1,i+1,i+steps+2,i+steps+1);}
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

function fitPickupPedals(T,frame,group,floor,add,metal,rubber){
 const ray=new T.Raycaster(),directions=[
  new T.Vector3(-1,0,0).transformDirection(frame.matrixWorld),
  new T.Vector3(0,-1,0).transformDirection(frame.matrixWorld),
 ];
 const locate=(position,index)=>{
  ray.set(frame.localToWorld(position),directions[index]);
  const hit=ray.intersectObjects(floor,false)[0];
  return hit?frame.worldToLocal(hit.point):null;
 };
 const pedals=[];
 // The steering column occupies Z=.185-.192 at bracket height.
 for(const [key,z,width] of [['clutch',.242,.031],['brake',.172,.037]]){
  const mount=locate(new T.Vector3(.02,.027,z),0);
  if(!mount||mount.x<-.31||mount.x>-.16)continue;
  const bracket=new T.Group();bracket.position.copy(mount);group.add(bracket);
  const pivot=new T.Group();
  pivot.name='Pickup_'+key+'_PedalPivot';bracket.add(pivot);
  const hanger=add(bracket,'PedalHanger',new T.BoxGeometry(.014,.019,.025),rubber);
  hanger.position.x=.007;
  const points=[new T.Vector3(.009,0,0),new T.Vector3(.021,-.025,0),new T.Vector3(.050,-.078,0)];
  add(pivot,'PedalArm',new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.0037,7),metal);
  add(pivot,'PedalPad',new T.BoxGeometry(.009,.027,width),rubber).position.copy(points[2]);
  pedals.push({key,pivot,travel:-.27});
 }
 const mount=locate(new T.Vector3(-.084,-.09,.124),1);
 if(mount&&Math.abs(mount.y+.1273)<.012){
  const bracket=new T.Group();bracket.position.copy(mount);bracket.position.y+=.005;group.add(bracket);
  const pivot=new T.Group();
  pivot.name='Pickup_throttle_PedalPivot';bracket.add(pivot);
  const pad=add(pivot,'AcceleratorPad',new T.BoxGeometry(.009,.073,.021),rubber);
  pad.rotation.z=.65;pad.position.set(-.020,.028,0);
  const pin=add(bracket,'AcceleratorHinge',new T.CylinderGeometry(.006,.006,.025,12),metal);
  pin.rotation.x=Math.PI/2;
  pedals.push({key:'throttle',pivot,travel:.29});
 }
 return pedals;
}

export function installClassicCabinSurfaces(T,model,vehicle){
 const style=finishes[vehicle],ss400=vehicle==='chevy_400_1957',pickup=vehicle==='pickup_3100';
 const frame=ss400?model.getObjectByName('SS250_PhysicalInterior_R53'):model;
 if(!style||!frame)return null;
 frame.updateWorldMatrix(true,true);
 const group=new T.Group();group.name='ClassicCabinUpholstery';frame.add(group);
 const resources=new Set(),materials=new Map(),bindings=[],meshCounts={floor:0,seat:0};
 const add=(parent,name,geometry,material)=>{
  resources.add(geometry);resources.add(material);
  const mesh=new T.Mesh(geometry,material);
  mesh.name=name;mesh.receiveShadow=true;parent.add(mesh);
  return mesh;
 };
 function addSurface(kind,donor,profile){
  const geometry=fittedSurface(T,frame,targetsBelow(donor),{...profile,ss400});
  if(!geometry)return;
  if(!materials.has(kind)){
   const map=drawSurface(T,style[kind],false),bumpMap=drawSurface(T,style[kind],true);
   if(map)resources.add(map);if(bumpMap)resources.add(bumpMap);
   materials.set(kind,new T.MeshStandardMaterial({
    map,bumpMap,color:map?0xffffff:style[kind].base,bumpScale:kind==='floor'?.002:.001,
    roughness:kind==='floor'?.93:.81,emissive:0xc8bca7,emissiveMap:map,emissiveIntensity:map ? .075 : 0,
   }));
  }
  add(group,kind==='floor'?'FittedCabinMat':'FittedSeatInsert',geometry,materials.get(kind));
  meshCounts[kind]++;
 }
 let pedals=[];
 if(ss400){
  const vinyl=drawSurface(T,style.seat,false);
  if(vinyl){vinyl.channel=3;resources.add(vinyl);}
  for(const [side,sign] of [['Driver',-1],['Passenger',1]]){
   addSurface('floor',frame.getObjectByName('SS250_'+side+'ToeBoardFloor'),{center:[.355*sign,.22],width:.39,length:.19,min:.43,max:.505});
   if(!vinyl)continue;
   for(const mesh of targetsBelow(frame.getObjectByName('SS250_'+side+'CushionUpholstery'))){
    if(!mesh.material?.isMeshStandardMaterial)continue;
    const geometry=projectVinylUVs(T,frame,mesh);
    if(!geometry)continue;
    const material=mesh.material.clone();
    material.map=vinyl;material.color.set(0xffffff);material.roughness=.78;
    bindings.push({mesh,geometry:mesh.geometry,material:mesh.material});
    mesh.geometry=geometry;mesh.material=material;
    resources.add(geometry);resources.add(material);
    meshCounts.seat++;
   }
  }
 }else{
  const prefix=vehicle+'_static_'+(pickup?'C3100':'BA57')+'_';
  const floor=frame.getObjectByName(prefix+'UnderbodyBlackened');
  const seat=frame.getObjectByName(prefix+'Upholstery_'+(pickup?'Turquoise':'Ivory'));
  for(const side of [-1,1]){
   addSurface('floor',floor,{center:[-.090,.195*side],width:.160,length:.224,min:pickup?-.135:-.168,max:pickup?-.117:-.154});
   if(!pickup)addSurface('seat',seat,{center:[.055,.151*side],width:.228,length:.120,min:-.053,max:-.041});
  }
  if(pickup){
   addSurface('seat',seat,{center:[.103,0],width:.49,length:.130,min:.003,max:.022});
   const metal=new T.MeshStandardMaterial({color:0x7d827b,roughness:.52,metalness:.53});
   const rubber=new T.MeshStandardMaterial({color:0x343732,roughness:.88});
   resources.add(metal);resources.add(rubber);
   // Pedal anchors live inside the same resource owner as the cabin trim.
   pedals=fitPickupPedals(T,frame,group,targetsBelow(floor),add,metal,rubber);
  }
 }
 const unit=value=>Math.max(0,Math.min(1,Number(value)||0));
 return {
  update(controls,clutch){
   for(const {key,pivot,travel} of pedals)pivot.rotation.z=travel*unit(key==='clutch'?clutch:controls[key]);
  },
  diagnostics:()=>({...meshCounts,pedals:pedals.map(({key,pivot})=>({key,angle:pivot.rotation.z}))}),
  dispose(){
   group.removeFromParent();
   for(const {mesh,geometry,material} of bindings){mesh.geometry=geometry;mesh.material=material;}
   bindings.length=0;
   for(const resource of resources)resource.dispose();
   resources.clear();
  },
 };
}
