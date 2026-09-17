import {getVehicleDefinition} from './vehicle-catalog.mjs?v=body-r3-20260916';
import {mirrorCameraPoses} from './cockpit-mirrors.mjs?v=body-r3-20260916';
// Optical faces share the existing capture feeds, but sit on each authored housing.
export function attachAuthoredMirrors(T,presentation,id,feeds){
 if(getVehicleDefinition(id)?.cockpit!=='authored-interior')return null;
 const pickup=id==='pickup_3100',root=new T.Group(),faces={},owned=[];root.name='AuthoredLiveMirrors';presentation.root.add(root);
 const position=p=>p.map((v,i)=>v*.4+(i===1?-.296283007:0));
 const specs=pickup?{center:{p:[-.23,1.64,0],w:.19,h:.064},left:{p:[-.372,1.50,.98],r:.059}}:{center:{p:[-.150,1.347,0],w:.159,h:.048},left:{p:[-.340,1.143,.946],r:.047}};
 for(const [key,s] of Object.entries(specs)){
  const geometry=s.r?new T.CircleGeometry(s.r*.4,40):new T.PlaneGeometry(s.w*.4,s.h*.4),uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
  const face=new T.Mesh(geometry,feeds[key].glass.material);face.name='AuthoredMirrorFace_'+key;face.position.fromArray(position(s.p));face.rotation.y=Math.PI/2;root.add(face);faces[key]=face;owned.push(geometry);
 }
 if(pickup){
  const chrome=new T.MeshStandardMaterial({color:'#c9ced0',metalness:1,roughness:.16}),geometry=new T.BoxGeometry(.008,.030,.082),housing=new T.Mesh(geometry,chrome);housing.position.copy(faces.center.position);housing.position.x-=.005;root.add(housing);owned.push(chrome,geometry);
  const stemGeometry=new T.BoxGeometry(.004,.035,.004),stem=new T.Mesh(stemGeometry,chrome);stem.position.copy(housing.position);stem.position.y+=.022;root.add(stem);owned.push(stemGeometry);
 }
 return {setVisible(value){root.visible=!!value;},cameraPoses(carPose){const poses=mirrorCameraPoses(T,carPose);if(!poses)return null;root.updateWorldMatrix(true,true);for(const key of ['center','left']){const old=poses[key],p=faces[key].getWorldPosition(new T.Vector3()).toArray();poses[key]={...old,position:p,look:p.map((v,i)=>v+old.look[i]-old.position[i])};}return poses;},dispose(){root.removeFromParent();owned.forEach(x=>x.dispose());},diagnostics:()=>({attached:!!root.parent,visible:root.visible})};
}
