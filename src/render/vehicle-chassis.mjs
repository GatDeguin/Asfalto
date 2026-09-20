import {createChassisMechanism,tireRadius,tireWidth} from './chassis-mechanism.mjs?v=7552609a0f52f6b8';
import {sanitizeChassisConfig} from '../game/chassis-configuration.mjs?v=cb4421d5b87d806c';
const IDS=['frontLeft','frontRight','rearLeft','rearRight'];
const visibleKinds=new Set(['tire','rim','rotor','caliper','pad','drum','shoe','bearing','hub']);
const materialList=o=>Array.isArray(o.material)?o.material:[o.material];
const templateKind=o=>/rubber|goma|tire|neumatic|tread/i.test(o.name+' '+materialList(o).map(m=>m?.name).join(' '))?'tire':'rim';
function bake(T,meshes,reference,materialCopies,ownedGeometries){
 reference.updateWorldMatrix(true,true);const inverse=reference.matrixWorld.clone().invert(),buckets=new Map();
 for(const object of meshes){
  if(!object.geometry?.attributes.position||Array.isArray(object.material))continue;
  const matrix=new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld),g=object.geometry.clone();g.applyMatrix4(matrix);g.deleteAttribute('tangent');
  // Mirroring the left/right assembly must also preserve triangle winding.
  if(matrix.determinant()<0){if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));const a=g.index;for(let i=0;i<a.count;i+=3){const b=a.getX(i+1);a.setX(i+1,a.getX(i+2));a.setX(i+2,b);}}
  let flat=g;if(g.index){flat=g.toNonIndexed();g.dispose();}
  const names=Object.keys(flat.attributes).sort(),key=object.material.uuid+'|'+names.map(n=>n+flat.attributes[n].itemSize).join(',');
  if(!buckets.has(key))buckets.set(key,{material:object.material,names,pieces:[]});
  buckets.get(key).pieces.push(flat);
 }
 const group=new T.Group();group.userData.chassisGenerated=true;
 for(const {material,names,pieces}of buckets.values()){
  const geometry=new T.BufferGeometry();
  for(const name of names){const size=pieces[0].attributes[name].itemSize,total=pieces.reduce((n,p)=>n+p.attributes[name].count,0),data=new Float32Array(total*size);let offset=0;
   for(const piece of pieces){const a=piece.attributes[name];for(let i=0;i<a.count;i++)for(let c=0;c<size;c++)data[offset++]=a.getComponent(i,c);}
   geometry.setAttribute(name,new T.BufferAttribute(data,size));
  }
  pieces.forEach(g=>g.dispose());geometry.computeBoundingSphere();ownedGeometries.add(geometry);
  if(!materialCopies.has(material)){const copy=material.clone();copy.name=material.name;materialCopies.set(material,copy);}
  const mesh=new T.Mesh(geometry,materialCopies.get(material));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.chassisGenerated=true;group.add(mesh);
 }
 return group;
}
export function createVehicleChassis(T,{root,tiers,centers}){
 let config=null,signature='',environment=null,disposed=false,templates=null;const originals=[],groups=[],geometries=new Set(),materials=new Map(),templateGeometries=new Set(),shapes=[];
 for(const tier of tiers)for(const id of IDS)for(const pivot of [tier.wheels[id],tier.stationaryWheels[id]])pivot.traverse(o=>{if(o.isMesh)originals.push([o,o.visible]);});
 function sourceWheels(){
  if(templates)return templates;root.updateWorldMatrix(true,true);
  templates=IDS.map((id,index)=>{
   const pivot=tiers[0].wheels[id],inverse=pivot.matrixWorld.clone().invert(),bounds=new T.Box3(),tireBounds=new T.Box3(),point=new T.Vector3(),records=[];
   pivot.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||o.userData.chassisGenerated)return;
    const transform=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld),kind=templateKind(o),p=o.geometry.attributes.position;
    for(const i of new Set(o.geometry.index?.array||Array.from({length:p.count},(_,j)=>j))){point.fromBufferAttribute(p,i).applyMatrix4(transform);bounds.expandByPoint(point);if(kind==='tire')tireBounds.expandByPoint(point);}
    records.push({o,transform,kind});
   });
   const box=tireBounds.isEmpty()?bounds:tireBounds,center=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),size=box.isEmpty()?new T.Vector3(.26,.26,.075):box.getSize(new T.Vector3());
   const radius=Math.max(.025,Math.max(size.x,size.y)*.5),units=radius/.3303,side=index%2===0?-1:1;
   shapes[index]={units,center:center.clone(),radius,width:size.z};
   const normalize=new T.Matrix4().makeScale(1/units,1/units,side/units).multiply(new T.Matrix4().makeTranslation(-center.x,-center.y,-center.z)),group=new T.Group();
   for(const {o,transform,kind}of records){const geometry=o.geometry.clone();const matrix=new T.Matrix4().multiplyMatrices(normalize,transform);geometry.applyMatrix4(matrix);if(matrix.determinant()<0){if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));const a=geometry.index;for(let i=0;i<a.count;i+=3){const b=a.getX(i+1);a.setX(i+1,a.getX(i+2));a.setX(i+2,b);}}templateGeometries.add(geometry);const mesh=new T.Mesh(geometry,o.material);mesh.name=o.name;mesh.userData.chassisKind=kind;group.add(mesh);}
   return group;
  });return templates;
 }
 function releaseApplied(){for(const group of groups)group.removeFromParent();groups.length=0;geometries.forEach(g=>g.dispose());geometries.clear();materials.forEach(m=>m.dispose());materials.clear();for(const[o,visible]of originals)o.visible=visible;}
 function setConfiguration(value){
  if(disposed)return false;config=value?sanitizeChassisConfig(value):null;const next=config?[config.rim,config.tire,config.kit].join(':'):'original';
  if(next===signature)return true;signature=next;releaseApplied();
  if(!config||(!config.rim&&!config.tire&&!config.kit))return true;
  const inputs=sourceWheels(),settings={...config,wheel:0,view:'car',steer:0,brake:0,explode:0,demo:false,rpm:60,cut:false,thermal:false,isolated:null,layers:{body:true,tires:true,rims:true,brakes:true,steering:true,suspension:true,hydraulic:true,engine:false}};
  const mechanism=createChassisMechanism(T,{settings,sourceWheels:inputs});
  try{
   mechanism.update(0,{angle:[0,0,0,0],temp:[20,20,20,20]});mechanism.root.updateWorldMatrix(true,true);
   for(let i=0;i<IDS.length;i++){
    const wheel=mechanism.wheels[i],spin=[],stationary=[];
    wheel.root.traverse(o=>{if(!o.isMesh)return;let owner=o.userData.part;for(let p=o.parent;!owner&&p;p=p.parent)owner=p.userData.part;if(!owner||!visibleKinds.has(owner.kind))return;
     let rotates=false;for(let p=o;p&&p!==wheel.root;p=p.parent)if(p===wheel.spin||p===wheel.rotspin)rotates=true;(rotates?spin:stationary).push(o);
    });
    for(const [meshes,rotating]of [[spin,true],[stationary,false]]){
     const baked=bake(T,meshes,wheel.root,materials,geometries);baked.name='Chassis_'+IDS[i]+(rotating?'_Rotating':'_Stationary');
     baked.position.copy(shapes[i].center);baked.scale.set(shapes[i].units,shapes[i].units,-shapes[i].units);
     for(const tier of tiers){const g=baked.clone(true);(rotating?tier.wheels[IDS[i]]:tier.stationaryWheels[IDS[i]]).add(g);groups.push(g);}
    }
   }
   for(const[o]of originals)o.visible=false;setEnvironment(environment);return true;
  }catch(error){releaseApplied();signature='';throw error;}finally{mechanism.dispose();}
 }
 function setEnvironment(texture){environment=texture;for(const m of materials.values()){if(m.envMap!==texture){m.envMap=texture;m.needsUpdate=true;}}}
 function inspectionMatrix(){
  sourceWheels();const front=centers[0],rear=centers[2],sx=(rear[0]-front[0])/2.819,sy=(shapes[0].units+shapes[2].units)*.5,sz=(centers[1][2]-front[2])/1.510;
  return new T.Matrix4().compose(new T.Vector3(front[0]+1.4145*sx,front[1]-.32978*sy,(front[2]+centers[1][2])*.5),new T.Quaternion(),new T.Vector3(sx,sy,-sz));
 }
 return{setConfiguration,setEnvironment,sourceWheels,inspectionMatrix,
  diagnostics:()=>({configured:!!config,config:config?{...config}:null,generatedGroups:groups.length,drawMeshes:groups.reduce((n,g)=>n+g.children.length,0),triangles:[...geometries].reduce((n,g)=>n+g.attributes.position.count/3,0),radiusScale:config?tireRadius[config.tire]/tireRadius[0]:1,widthScale:config?tireWidth[config.tire]/tireWidth[0]:1,disposed}),
  dispose(){if(disposed)return;disposed=true;releaseApplied();templateGeometries.forEach(g=>g.dispose());templateGeometries.clear();templates=null;}
 };
}
