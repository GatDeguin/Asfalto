import {installClassicRadioFace,playlistNeedlePosition,RADIO_PRESETS,roundedRadioPanel} from './classic-radio-face.mjs?v=a2eea130a3b85767';

function drawBrushedMetal(ctx){
 const finish=ctx.createLinearGradient(0,0,0,128);
 finish.addColorStop(0,'#a2a4a1');finish.addColorStop(.44,'#d3d2c6');finish.addColorStop(1,'#a7a9a3');
 ctx.fillStyle=finish;ctx.fillRect(0,0,512,128);
 for(let y=2;y<128;y+=4){
  ctx.fillStyle='rgba(43,48,46,.28)';ctx.fillRect(0,y,512,1);
  ctx.fillStyle='rgba(246,245,230,.25)';ctx.fillRect(0,y+1,512,1);
 }
}

function drawDial(ctx){
 const glass=ctx.createLinearGradient(0,0,0,128);
 glass.addColorStop(0,'#15191a');glass.addColorStop(.54,'#212927');glass.addColorStop(1,'#41493b');
 ctx.fillStyle=glass;ctx.fillRect(0,0,512,128);
 ctx.strokeStyle='#bdc0ac';ctx.lineWidth=2;
 ctx.beginPath();
 ctx.moveTo(225,22);ctx.lineTo(247,22);ctx.lineTo(247,17);ctx.lineTo(287,17);
 ctx.lineTo(287,28);ctx.lineTo(265,28);ctx.lineTo(265,33);ctx.lineTo(225,33);
 ctx.closePath();ctx.stroke();
 ctx.fillStyle='#cdd1b6';ctx.fillRect(24,66,464,2);
 ctx.textAlign='center';ctx.font='bold 32px Arial, sans-serif';
 const marks=[5,6,8,10,12,14,16];
 for(const [i,frequency] of marks.entries()){
  const x=40+i*72;
  ctx.fillText(String(frequency),x,111);ctx.fillRect(x,57,2,10);
  if(i<marks.length-1)ctx.fillRect(x+36,62,2,5);
 }
}

// The Automundo 185 dashboard photo establishes the installation. The loose
// GMA receiver photographed by Motorclásico (item 3223) resolves the face.
export function installSS250RadioFace(T,mount){
 return installClassicRadioFace(T,mount,({model,positionControl,material,part,texture})=>{
  const metalGrain=texture(512,128,drawBrushedMetal);
  const brushed=material({color:0xc6c7bd,map:metalGrain,metalness:.64,roughness:.41,emissive:0x77796f,emissiveIntensity:.20});
  const chrome=material({color:0xc6c9c1,metalness:.86,roughness:.25});
  const black=material({color:0x272725,roughness:.42,emissive:0x181815,emissiveIntensity:.18});
  const print=texture(512,128,drawDial);
  const lens=material({color:print?0xffffff:0x30392e,map:print,roughness:.31,emissive:0xd9ddb5,emissiveMap:print,emissiveIntensity:.23});
  const pointer=material({color:0xd35a35,roughness:.48,emissive:0xa52d12,emissiveIntensity:.42});

  const face=roundedRadioPanel(T,.207,.054,.022,.005);
  const vertices=face.getAttribute('position'),uv=face.getAttribute('uv');
  for(let i=0;i<vertices.count;i++)uv.setXY(i,.5+vertices.getX(i)/.209,.5+vertices.getY(i)/.056);
  part(model,'SS250_RadioFaceplate',face,brushed,[0,0,.076]);
  part(model,'SS250_RadioBezel',roundedRadioPanel(T,.098,.044,.004,.006),chrome,[0,.001,.081]);
  part(model,'SS250_RadioInset',roundedRadioPanel(T,.089,.037,.002,.001),black,[0,.001,.0865]);
  part(model,'SS250_RadioAnalogDial',new T.PlaneGeometry(.083,.020),lens,[0,.009,.089]);
  const needle=part(model,'SS250_RadioNeedle',new T.PlaneGeometry(.0011,.010),pointer,[-.013,.005,.0895]);

  const preset=roundedRadioPanel(T,.0135,.009,.0015,.0045);
  for(const [i,name] of RADIO_PRESETS.entries()){
   const control=positionControl(name,[(i-2)*.0165,-.0125,.089]);
   part(control,'SS250_RadioPreset',preset,black,[0,0,0]);
  }

  const seat=new T.LatheGeometry([[.007,0],[.011,.001],[.015,.005],[.015,.006],[.013,.007],[.010,.003]].map(([r,z])=>new T.Vector2(r,z)),32);
  const grip=new T.LatheGeometry([[0,0],[.010,0],[.0105,.002],[.0105,.008],[.0085,.011],[0,.011]].map(([r,z])=>new T.Vector2(r,z)),32);
  const cap=new T.CircleGeometry(.0073,32);
  // The cockpit's two stamped seats share the dash trim mesh. Fit the
  // controls over them so the same openings carry both the trim and inputs.
  for(const [name,x] of [['POWER_VOLUME',-.0894],['TUNING_SEEK',.0894]]){
   const ring=part(model,'SS250_RadioKnobSeat',seat,chrome,[x,-.0025,.085]);
   ring.rotation.x=Math.PI/2;
   const control=positionControl(name,[x,-.0025,.091]);
   const knob=part(control,'SS250_RadioKnob',grip,black,[0,0,0]);
   knob.rotation.x=Math.PI/2;
   part(control,'SS250_RadioKnobCap',cap,chrome,[0,0,.0112]);
  }
  return state=>{
   lens.emissiveIntensity=state.powered?.83:.23;
   needle.position.x=playlistNeedlePosition(state,.034,-.013);
  };
 });
}
