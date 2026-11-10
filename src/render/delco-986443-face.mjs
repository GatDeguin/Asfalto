const buttons=['PREVIOUS','REWIND','PLAY_PAUSE','FORWARD','NEXT'];
const knobs=['POWER_VOLUME','TUNING_SEEK'];

function roundedPanel(T,width,height,radius,depth){
 const x=width/2,y=height/2,r=radius,s=new T.Shape();
 s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);
 s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);
 s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
 return new T.ExtrudeGeometry(s,{depth,bevelSize:.001,bevelThickness:.001,bevelSegments:2,curveSegments:5});
}

function dialTexture(T){
 const canvas=globalThis.document?.createElement?.('canvas');
 if(!canvas)return null;
 canvas.width=512;canvas.height=88;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const gradient=ctx.createLinearGradient(0,0,0,88);
 gradient.addColorStop(0,'#18110d');gradient.addColorStop(.55,'#422b1f');gradient.addColorStop(1,'#251710');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,512,88);
 ctx.fillStyle='#e5cfa0';ctx.textAlign='center';ctx.font='bold 34px Georgia, serif';
 const frequencies=[55,70,90,110,130,150];
 for(const [i,frequency] of frequencies.entries()){
  const x=42+i*85;
  ctx.fillText(String(frequency),x,69);ctx.fillRect(x,24,2,12);
  if(i<5)for(let j=1;j<4;j++)ctx.fillRect(x+j*21,29,2,7);
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

// Use the live donor's seven controls and the Delco's visible arrangement.
// Chevrolet Radio Shop and Service Manual, 986443 section, pp. 38–42.
export function installDelco986443Face(T,mount){
 const controls=[...buttons,...knobs].map(name=>mount.getObjectByName('CTRL_'+name));
 const model=controls[0]?.parent;
 if(!model||controls.some(control=>control?.parent!==model))return null;
 const hidden=[];
 model.traverse(node=>{if(node.isMesh){hidden.push([node,node.visible]);node.visible=false;}});
 const saved=controls.map(control=>({position:control.position.clone(),base:control.userData.radioBasePosition?.clone()}));
 const parts=[],materials=[];
 function material(properties){const m=new T.MeshStandardMaterial(properties);materials.push(m);return m;}
 function part(parent,name,geometry,mat,position){
  const node=new T.Mesh(geometry,mat);
  node.name=name;node.position.fromArray(position);parts.push(node);parent.add(node);return node;
 }
 const steel=material({color:0xb6b8ab,metalness:.72,roughness:.36});
 const bakelite=material({color:0x602c20,roughness:.42,metalness:.08});
 const ivory=material({color:0xdfc591,roughness:.36,emissive:0xd6ab70,emissiveIntensity:.17});
 const print=dialTexture(T);
 const glass=material({color:print?0xffffff:0x41291b,map:print,roughness:.28,emissive:0xe9ab65,emissiveMap:print,emissiveIntensity:.17});
 const red=material({color:0xd35c3b,roughness:.55,emissive:0x7f2f15,emissiveIntensity:.13});
 part(model,'Delco986443_StampedMount',roundedPanel(T,.199,.060,.011,.005),steel,[0,0,.077]);
 part(model,'Delco986443_BakeliteBezel',roundedPanel(T,.126,.050,.005,.008),bakelite,[0,.001,.082]);
 const dial=part(model,'Delco986443_Dial',new T.PlaneGeometry(.113,.015),glass,[0,-.012,.0915]);
 const needle=part(model,'Delco986443_Needle',new T.PlaneGeometry(.0013,.014),red,[-.022,-.012,.092]);
 for(const [i,control] of controls.entries()){
  const key=i<buttons.length;
  control.position.set(key?(i-2)*.023:i===5?-.079:.079,key?.014:.004,.091);
  control.userData.radioBasePosition?.copy(control.position);
  if(key){
   part(control,'Delco986443_Preset',roundedPanel(T,.020,.015,.002,.004),ivory,[0,0,0]);
  }else{
   const knob=part(control,'Delco986443_Knob',new T.LatheGeometry([
    new T.Vector2(0,-.003),new T.Vector2(.010,-.003),new T.Vector2(.010,.000),
    new T.Vector2(.007,.001),new T.Vector2(.009,.006),new T.Vector2(.009,.009),
    new T.Vector2(.0075,.011),new T.Vector2(0,.011),
   ],28),ivory,[0,0,0]);
   knob.rotation.x=Math.PI/2;
  }
 }
 function sync(state){
  glass.emissiveIntensity=state.powered?.8:.17;
  const count=state.tracks?.length??0;
  needle.position.x=count>1?-.045+.09*Math.max(0,state.currentIndex)/(count-1):-.022;
 }
 const previousUpdate=mount.userData.updateRadioFace;
 mount.userData.updateRadioFace=sync;
 sync({powered:mount.userData.radioPowered});
 return {dispose(){
  mount.userData.updateRadioFace=previousUpdate;
  for(const [i,control] of controls.entries()){
   control.position.copy(saved[i].position);
   if(saved[i].base)control.userData.radioBasePosition.copy(saved[i].base);
  }
  for(const [node,visible] of hidden)node.visible=visible;
  for(const node of parts){node.removeFromParent();node.geometry.dispose();}
  for(const m of materials)m.dispose();print?.dispose();
 }};
}
