import {installClassicRadioFace,playlistNeedlePosition,RADIO_PRESETS,roundedRadioPanel} from './classic-radio-face.mjs?v=a2eea130a3b85767';

function drawDial(ctx){
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
}

// Use the live donor's seven controls and the Delco's visible arrangement.
// Chevrolet Radio Shop and Service Manual, 986443 section, pp. 38–42.
export function installDelco986443Face(T,mount){
 return installClassicRadioFace(T,mount,({model,positionControl,material,part,texture})=>{
  const steel=material({color:0xb6b8ab,metalness:.72,roughness:.36});
  const bakelite=material({color:0x602c20,roughness:.42,metalness:.08});
  const ivory=material({color:0xdfc591,roughness:.36,emissive:0xd6ab70,emissiveIntensity:.17});
  const print=texture(512,88,drawDial);
  const glass=material({color:print?0xffffff:0x41291b,map:print,roughness:.28,emissive:0xe9ab65,emissiveMap:print,emissiveIntensity:.17});
  const red=material({color:0xd35c3b,roughness:.55,emissive:0x7f2f15,emissiveIntensity:.13});
  part(model,'Delco986443_StampedMount',roundedRadioPanel(T,.199,.060,.011,.005),steel,[0,0,.077]);
  part(model,'Delco986443_BakeliteBezel',roundedRadioPanel(T,.126,.050,.005,.008),bakelite,[0,.001,.082]);
  part(model,'Delco986443_Dial',new T.PlaneGeometry(.113,.015),glass,[0,-.012,.0915]);
  const needle=part(model,'Delco986443_Needle',new T.PlaneGeometry(.0013,.014),red,[-.022,-.012,.092]);
  const keyGeometry=roundedRadioPanel(T,.020,.015,.002,.004);
  for(const [i,name] of RADIO_PRESETS.entries()){
   const control=positionControl(name,[(i-2)*.023,.014,.091]);
   part(control,'Delco986443_Preset',keyGeometry,ivory,[0,0,0]);
  }
  const knobGeometry=new T.LatheGeometry([
    new T.Vector2(0,-.003),new T.Vector2(.010,-.003),new T.Vector2(.010,.000),
    new T.Vector2(.007,.001),new T.Vector2(.009,.006),new T.Vector2(.009,.009),
    new T.Vector2(.0075,.011),new T.Vector2(0,.011),
  ],28);
  for(const [name,x] of [['POWER_VOLUME',-.079],['TUNING_SEEK',.079]]){
   const control=positionControl(name,[x,.004,.091]);
   const knob=part(control,'Delco986443_Knob',knobGeometry,ivory,[0,0,0]);
   knob.rotation.x=Math.PI/2;
  }
  return state=>{
   glass.emissiveIntensity=state.powered?.8:.17;
   needle.position.x=playlistNeedlePosition(state,.045,-.022);
  };
 });
}
