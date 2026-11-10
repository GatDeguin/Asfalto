import {installClassicRadioFace,playlistNeedlePosition,RADIO_PRESETS,roundedRadioPanel} from './classic-radio-face.mjs?v=a2eea130a3b85767';

function drawDial(ctx){
 const glass=ctx.createLinearGradient(0,0,0,64);
 glass.addColorStop(0,'#242824');glass.addColorStop(.48,'#171a18');glass.addColorStop(1,'#303229');
 ctx.fillStyle=glass;ctx.fillRect(0,0,512,64);
 ctx.fillStyle='#d9d4b9';ctx.textAlign='center';ctx.font='bold 34px Arial, sans-serif';
 for(const [label,x] of [['5',43],['7',108],['9',184],['11',259],['14',393],['16',468]]){
  ctx.fillText(label,x,45,label.length===1?18:35);
  ctx.fillRect(x-1,50,3,6);
 }
 ctx.font='bold 17px Arial, sans-serif';ctx.fillText('4',58,27);
 for(const x of [68,145,222,300,348,430])ctx.fillRect(x-1,52,3,4);
 ctx.strokeStyle='#d9d4b9';ctx.lineWidth=2;
 for(const x of [83,324])ctx.strokeRect(x-3,32,6,6);
}

function drawEmblem(ctx){
 const metal=ctx.createLinearGradient(0,0,0,64);
 metal.addColorStop(0,'#d5d3c7');metal.addColorStop(.46,'#9a9b91');metal.addColorStop(1,'#c6c5bb');
 ctx.fillStyle=metal;ctx.fillRect(0,0,256,64);
 ctx.fillStyle='#3c3d37';ctx.strokeStyle='#ebe6d6';ctx.lineWidth=3;
 ctx.beginPath();ctx.moveTo(12,13);ctx.lineTo(96,17);ctx.lineTo(128,22);ctx.lineTo(160,17);ctx.lineTo(244,13);
 ctx.lineTo(233,29);ctx.lineTo(244,45);ctx.lineTo(128,54);ctx.lineTo(12,45);ctx.lineTo(23,29);ctx.closePath();
 ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(32,33);ctx.lineTo(224,33);ctx.stroke();
 ctx.fillStyle='#c7bd9b';ctx.beginPath();ctx.moveTo(102,29);ctx.lineTo(119,29);ctx.lineTo(119,24);
 ctx.lineTo(137,24);ctx.lineTo(137,29);ctx.lineTo(154,29);ctx.lineTo(150,38);
 ctx.lineTo(137,38);ctx.lineTo(137,42);ctx.lineTo(119,42);ctx.lineTo(119,38);ctx.lineTo(98,38);ctx.closePath();ctx.fill();
}

// Delco bulletin 6D-864 and the surviving 987575 face: a crest, AM glass,
// five mechanical keys and two black knobs with bright metal escutcheons.
export function installDelco987575Face(T,mount){
 return installClassicRadioFace(T,mount,({model,positionControl,material,part,texture})=>{
  const chrome=material({color:0xd9dad3,metalness:.78,roughness:.27,emissive:0x66675d,emissiveIntensity:.23});
  const steel=material({color:0xb1b3aa,metalness:.62,roughness:.42,emissive:0x4e514c,emissiveIntensity:.16});
  const recess=material({color:0x181b19,roughness:.76});
  const phenolic=material({color:0x35352f,roughness:.50,emissive:0x262622,emissiveIntensity:.25});
  const print=texture(512,64,drawDial);
  const dial=material({color:print?0xffffff:0x2c3026,map:print,roughness:.37,emissive:0xe9d3a1,emissiveMap:print,emissiveIntensity:.25});
  const emblem=material({color:0xe6e4d9,map:texture(256,64,drawEmblem),metalness:.40,roughness:.36});
  const pointer=material({color:0xc65c32,roughness:.46,emissive:0xa73618,emissiveIntensity:.36});

  const shoulder=new T.Shape();
  shoulder.moveTo(.045,.021);shoulder.lineTo(.089,.003);
  shoulder.quadraticCurveTo(.102,-.002,.102,-.012);
  shoulder.lineTo(.098,-.022);shoulder.lineTo(.045,-.025);shoulder.closePath();
  const wing=new T.ExtrudeGeometry(shoulder,{depth:.021,bevelSize:.001,bevelThickness:.001,bevelSegments:2});
  part(model,'Delco987575_LeftShoulder',wing,steel,[0,0,.057]).scale.x=-1;
  part(model,'Delco987575_RightShoulder',wing,steel,[0,0,.057]);
  part(model,'Delco987575_Bezel',roundedRadioPanel(T,.108,.054,.003,.029),chrome,[0,.002,.057]);
  part(model,'Delco987575_Emblem',new T.PlaneGeometry(.050,.011),emblem,[0,.022,.0874]);
  part(model,'Delco987575_Dial',new T.PlaneGeometry(.096,.0125),dial,[0,.0094,.0874]);
  const needle=part(model,'Delco987575_Needle',new T.PlaneGeometry(.00085,.009),pointer,[-.020,.0091,.088]);
  part(model,'Delco987575_KeyRecess',roundedRadioPanel(T,.098,.019,.0015,.001),recess,[0,-.0134,.086]);

  const key=roundedRadioPanel(T,.0145,.0103,.0014,.0075);
  for(const [i,name] of RADIO_PRESETS.entries()){
   const control=positionControl(name,[(i-2)*.0186,-.0135,.088]);
   part(control,'Delco987575_Preset',key,phenolic,[0,0,0]).rotation.x=-.19;
  }

  const collar=new T.LatheGeometry([[.009,0],[.014,0],[.017,.002],[.017,.005],[.013,.008]].map(p=>new T.Vector2(...p)),32);
  const grip=new T.LatheGeometry([[0,0],[.012,0],[.014,.003],[.014,.011],[.011,.014],[.010,.0115],[0,.0115]].map(p=>new T.Vector2(...p)),48);
  const rim=new T.TorusGeometry(.0112,.0011,8,32);
  for(const [name,x] of [['POWER_VOLUME',-.085],['TUNING_SEEK',.085]]){
   part(model,'Delco987575_Escutcheon',collar,chrome,[x,-.011,.078]).rotation.x=Math.PI/2;
   const control=positionControl(name,[x,-.011,.084]);
   part(control,'Delco987575_Knob',grip,phenolic,[0,0,0]).rotation.x=Math.PI/2;
   part(control,'Delco987575_KnobRim',rim,chrome,[0,0,.0135]);
  }
  return state=>{
   dial.emissiveIntensity=state.powered?.80:.25;
   needle.position.x=playlistNeedlePosition(state,.038,-.020);
  };
 });
}
