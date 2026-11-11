import {getVehicleDefinition} from './vehicle-catalog.mjs?v=d34c237e4bf2bab0';
import {mirrorCameraPoses} from './cockpit-mirrors.mjs?v=ce951fdc15ca9bae';

function bind400DriverLens(T, vehicleRoot, anchor, feed) {
 const lens=vehicleRoot.getObjectByName('Details__26_Mirror_optical_silver')?.getObjectByProperty('isMesh',true);
 if(!lens?.geometry?.index)return null;
 const {geometry:originalGeometry,material:originalMaterial}=lens;
 const {index,attributes:{position}}=originalGeometry;
 lens.updateWorldMatrix(true,false);anchor.updateWorldMatrix(true,false);
 const lensToBody=vehicleRoot.matrixWorld.clone().invert().multiply(lens.matrixWorld);
 const lensToFace=anchor.matrixWorld.clone().invert().multiply(lens.matrixWorld);
 // The chrome backing touches the high-detail silver at its center. Lift the
 // live finish by 0.15 mm in model space to keep the depth test unambiguous.
 const relief=new T.Vector3(0,0,.00015).applyMatrix3(new T.Matrix3().setFromMatrix4(lensToFace.clone().invert()));
 const driverSide=new Set(),bounds=new T.Box2(),uv=new Float32Array(position.count*2);
 const vertices=new Float32Array(position.count*3);
 const vertex=new T.Vector3(),bodyVertex=new T.Vector3(),projected=new T.Vector3();
 for(let i=0;i<position.count;i++){
  vertex.fromBufferAttribute(position,i);
  if(bodyVertex.copy(vertex).applyMatrix4(lensToBody).z>0){
   driverSide.add(i);
   projected.copy(vertex).applyMatrix4(lensToFace);
   bounds.expandByPoint(projected);
   uv[2*i]=projected.x;uv[2*i+1]=projected.y;
   vertex.add(relief);
  }
  vertex.toArray(vertices,3*i);
 }
 const passive=[],active=[];
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  const triangles=driverSide.has(a)&&driverSide.has(b)&&driverSide.has(c)?active:passive;
  triangles.push(a,b,c);
 }
 if(!active.length||!passive.length)return null;
 const size=bounds.getSize(new T.Vector2());
 if(!(size.x>0&&size.y>0))return null;
 for(const i of driverSide){
  uv[2*i]=T.MathUtils.clamp(1-(uv[2*i]-bounds.min.x)/size.x,0,1);
  uv[2*i+1]=T.MathUtils.clamp((uv[2*i+1]-bounds.min.y)/size.y,0,1);
 }
 // Both optical faces share one GLB primitive. Draw the driver's triangles
 // with the feed in cab, leaving the passenger lens and chrome in place.
 const geometry=originalGeometry.clone(),materials=[originalMaterial,feed];
 geometry.setIndex([...passive,...active]);
 geometry.setAttribute('position',new T.BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.clearGroups();
 geometry.addGroup(0,passive.length,0);
 geometry.addGroup(passive.length,active.length,1);
 function setVisible(value){
  lens.geometry=value?geometry:originalGeometry;
  lens.material=value?materials:originalMaterial;
 }
 return {lens,setVisible,dispose(){setVisible(false);geometry.dispose();}};
}

// Optical faces share the existing capture feeds, but sit on each authored housing.
export function attachAuthoredMirrors(T,presentation,id,feeds){
 if(getVehicleDefinition(id)?.cockpit!=='authored-interior'&&id!=='chevy_400_1957')return null;
 const ss400=id==='chevy_400_1957',pickup=id==='pickup_3100',root=new T.Group(),faces={},captureSurfaces={},owned=[];root.name='AuthoredLiveMirrors';presentation.root.add(root);
 const position=p=>ss400?p:p.map((v,i)=>v*.4+(i===1?-.296283007:0));
 // The 400's optical silver is tilted with respect to the body axes.
 const specs=ss400?{
  center:{p:[-.12,.298,0],w:.175,h:.06},
  left:{p:[-.21595,.17783,.40416],r:.0234,rotation:[-.0377,1.0619,0,'YXZ']},
 }:pickup?{center:{p:[-.23,1.64,0],w:.19,h:.064},left:{p:[-.372,1.50,.98],r:.059*.4}}:
  {center:{p:[-.150,1.347,0],w:.159,h:.048},left:{p:[-.340,1.143,.946],r:.047*.4}};
 let driverLens;
 for(const [key,s] of Object.entries(specs)){
  const face=new T.Group();face.name='AuthoredMirrorFace_'+key;
  face.position.fromArray(position(s.p));face.rotation.set(...(s.rotation||[0,Math.PI/2,0]));
  root.add(face);faces[key]=face;
  const material=feeds[key].glass.material;
  if(ss400&&key==='left'){
   driverLens=bind400DriverLens(T,presentation.root,face,material);
   if(driverLens){driverLens.setVisible(true);captureSurfaces[key]=driverLens.lens;continue;}
  }
  const geometry=s.r?new T.CircleGeometry(s.r,40):new T.PlaneGeometry(s.w*.4,s.h*.4);
  const uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
  const glass=new T.Mesh(geometry,material);face.add(glass);captureSurfaces[key]=glass;owned.push(geometry);
 }
 if(pickup||ss400){
  const chrome=new T.MeshStandardMaterial({color:'#c9ced0',metalness:1,roughness:.16}),geometry=new T.BoxGeometry(.008,.030,.082),housing=new T.Mesh(geometry,chrome);housing.position.copy(faces.center.position);housing.position.x-=.005;root.add(housing);owned.push(chrome,geometry);
  const stemGeometry=new T.BoxGeometry(.004,.035,.004),stem=new T.Mesh(stemGeometry,chrome);stem.position.copy(housing.position);stem.position.y+=.022;root.add(stem);owned.push(stemGeometry);
 }
 return {
  captureSurfaces,
  get visible(){return root.visible;},
  setVisible(value){
   const visible=!!value;
   if(root.visible===visible)return;
   root.visible=visible;driverLens?.setVisible(visible);
  },
  cameraPoses(carPose){
   const poses=mirrorCameraPoses(T,carPose);if(!poses)return null;
   root.updateWorldMatrix(true,true);
   for(const key of ['center','left']){
    const old=poses[key],p=faces[key].getWorldPosition(new T.Vector3()).toArray();
    poses[key]={...old,position:p,look:p.map((v,i)=>v+old.look[i]-old.position[i])};
   }
   return poses;
  },
  dispose(){driverLens?.dispose();root.removeFromParent();owned.forEach(x=>x.dispose());},
  diagnostics:()=>({attached:!!root.parent,visible:root.visible}),
 };
}
