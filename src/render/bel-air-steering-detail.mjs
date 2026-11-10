// Chevrolet Engineering Features 1957, steering wheels, Series 2400.
export function installBelAirSteeringDetail(T,pivot,axis,donor,rim){
 const wheel=new T.Group();
 wheel.name='BelAir2434_SteeringDetail';
 const right=new T.Vector3(0,0,-1),up=new T.Vector3().crossVectors(axis,right).normalize();
 wheel.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,axis));
 const chrome=new T.MeshStandardMaterial({color:0xc6cdce,metalness:.87,roughness:.23,envMapIntensity:.8});
 const ivory=Array.isArray(rim.material)?rim.material[0]:rim.material;
 const enamel=new T.MeshStandardMaterial({color:0xe9e2c6,metalness:.15,roughness:.32});
 function mesh(name,geometry,material,z=0){
  const part=new T.Mesh(geometry,material);
  part.name=name;part.position.z=z;wheel.add(part);return part;
 }
 function spoke(sign,trim=false){
  const shape=new T.Shape();
  const halfWidth=trim?.002:.006;
  shape.moveTo(sign*.009,-.010+halfWidth);
  shape.quadraticCurveTo(sign*.035,-.009+halfWidth,sign*(trim?.059:.077),.015+halfWidth*.55);
  shape.lineTo(sign*(trim?.059:.077),.015-halfWidth*.55);
  shape.quadraticCurveTo(sign*.035,-.009-halfWidth,sign*.009,-.010-halfWidth);
  shape.closePath();
  return new T.ExtrudeGeometry(shape,{depth:trim?.0008:.003,bevelSize:trim?.0005:.0011,bevelThickness:.0008,bevelSegments:2,curveSegments:8});
 }
 for(const sign of [-1,1]){
  mesh('BelAir2434_Spoke',spoke(sign),ivory,-.0035);
  mesh('BelAir2434_SpokeTrim',spoke(sign,true),chrome,.0002);
 }
 mesh('BelAir2434_HornRing',new T.TorusGeometry(.051,.0013,8,64),chrome,.0017);
 const hub=mesh('BelAir2434_Hub',new T.CylinderGeometry(.016,.019,.011,40),ivory,-.004);
 hub.rotation.x=Math.PI/2;
 mesh('BelAir2434_HubRim',new T.TorusGeometry(.015,.0017,8,40),chrome,.0021);
 const canvas=globalThis.document?.createElement?.('canvas');
 if(canvas){
  canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  if(ctx){
   ctx.fillStyle='#e9e2c6';ctx.fillRect(0,0,128,128);
   ctx.fillStyle='#90632a';ctx.beginPath();
   ctx.moveTo(43,42);ctx.lineTo(59,42);ctx.lineTo(59,38);ctx.lineTo(86,38);
   ctx.lineTo(86,51);ctx.lineTo(70,51);ctx.lineTo(70,55);ctx.lineTo(43,55);ctx.fill();
   ctx.textAlign='center';ctx.font='italic 23px Georgia, serif';ctx.fillText('Bel Air',64,83);
   enamel.map=new T.CanvasTexture(canvas);enamel.map.colorSpace=T.SRGBColorSpace;enamel.color.setHex(0xffffff);
  }
 }
 mesh('BelAir2434_HornCap',new T.CircleGeometry(.0145,40),enamel,.0023);
 const originalVisibility=donor.visible;
 donor.visible=false;pivot.add(wheel);
 return {dispose(){
  donor.visible=originalVisibility;wheel.removeFromParent();
  for(const part of wheel.children)part.geometry.dispose();
  enamel.map?.dispose();enamel.dispose();chrome.dispose();
 }};
}
