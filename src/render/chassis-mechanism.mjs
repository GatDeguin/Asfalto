import {createChassisGeometry,TAU} from './chassis-lab-geometry.mjs?v=751cfc1dc8821b3f';
import {ackermann,kits,clamp} from '../game/chassis-lab-physics.mjs?v=9626fb121a066f25';

export const rimNames=['Acero clásico','Aleación · 5 radios · 16″','Multirradio · 17″','Rally forjada · 18″'];
export const tireNames=['Radial clásico','Deportivo de calle','Semislick de pista','Turismo / lluvia'];
export const brakeNames=['Clásico · disco + tambor','Turismo · 4 discos ventilados','Sport · perforados / 4 pistones','Pista · ranurados / 6 pistones'];
export const wheelNames=['Delantera izquierda','Delantera derecha','Trasera izquierda','Trasera derecha'];
export const rimRadius=[.187,.2032,.2159,.2286],tireRadius=[.3303,.336,.340,.333],tireWidth=[.236,.245,.255,.225];
const detail={
 tire:['La carcasa contiene el aire y transmite las fuerzas al suelo. El dibujo cambia el comportamiento del compuesto sobre cada superficie.','El diámetro exterior se mantiene próximo al del GLB. Los perfiles alternativos se ajustan al aro virtual, sin certificar medidas comerciales.'],
 rim:['La llanta centra el neumático y transmite el par entre el cubo y la huella de contacto.','Los conjuntos modernos son variantes conceptuales. La selección comprueba una envolvente geométrica simplificada; no garantiza montaje real.'],
 rotor:['El disco gira con el cubo. Las pastillas convierten energía cinética en calor mediante fricción.','T = 2 · μpastilla · P · Apistón · Refectivo. En los discos ventilados, las aletas conectan las pistas y favorecen el intercambio térmico.'],
 caliper:['La pinza contiene los pistones y transmite la fuerza de apriete a las pastillas. No gira con el disco.','El kit clásico/turismo representa una pinza flotante. Los kits Sport y Pista muestran pistones opuestos.'],
 pad:['El material de fricción se apoya sobre el disco al aumentar la presión hidráulica.','En la animación la holgura se amplifica para mostrar el contacto. No es una medición de desplazamiento de servicio.'],
 bearing:['Los elementos rodantes permiten girar el cubo con baja resistencia mientras soportan cargas.','Las pistas, rodillos y retenes se separan con el despiece. No se calculan las tensiones internas del rodamiento.'],
 hub:['El cubo une disco, rodamientos y llanta mediante la brida y los espárragos.','La geometría de brida y fijaciones se reconstruyó con fines didácticos. No es un plano de fabricación.'],
 drum:['El tambor gira con la rueda. Las zapatas interiores se expanden hasta rozar su superficie de fricción.','Activá el corte o aumentá el despiece para ver zapatas, cilindro de rueda, regulador y resortes.'],
 shoe:['El cilindro de rueda abre las zapatas contra el tambor. Los resortes las retraen al soltar el pedal.','La expansión está amplificada en pantalla. El autoefecto de las zapatas se aproxima con un factor agregado, no con un contacto multibody.'],
 steering:['El volante acciona la columna y la caja; el brazo Pitman mueve el enlace central y las bieletas orientan las manguetas.','Se imponen ángulos Ackermann ideales. El conjunto de barras es una reconstrucción visual y no un mecanismo de cotas verificadas.'],
 master:['El pedal y el servofreno actúan sobre el cilindro maestro. La presión se reparte por dos circuitos idealizados.','P = Fpedal · relaciónPedal · asistencia / Amaestro. La compresibilidad, la ebullición y las averías hidráulicas no se modelan.'],
 suspension:['Los brazos sostienen la mangueta y permiten recorrido vertical. El muelle almacena energía y el amortiguador disipa movimiento.','La transferencia de carga se calcula; la inclinación del chasis es visual. No se resuelve una suspensión elástica multibody.']
};

/** Create an owned mechanism in the source front -X / up +Y / left +Z frame.
 * sourceWheels may contain wheel-centred groups with local +Z pointing outward.
 * Input geometry, material textures and environment maps always remain caller-owned.
 * Mutate settings, rebuild after rim/tire/kit/cut changes, and applyViews for visibility. */
export function createChassisMechanism(T,{settings={},sourceWheels=[]}={}){
 const defaults={rim:0,tire:0,kit:0,wheel:0,view:'car',steer:0,brake:0,explode:0,demo:false,rpm:60,cut:false,thermal:false,isolated:null};
 for(const [key,value]of Object.entries(defaults))if(settings[key]===undefined)settings[key]=value;
 settings.layers={body:true,tires:true,rims:true,brakes:true,steering:true,suspension:true,hydraulic:true,engine:false,...settings.layers};
 const geometries=new Set(),materials=new Set();
 const {V,group,material,mesh,box,ring,cylinder,torus,sphere,transformed,merge,tube,coil,spoke,boltCircle,rod,setRod,lathe}=createChassisGeometry(T,{geometries,materials});
function drilled(ro,ri,depth){
 const p=[],n=[],i=[];const rows=2,cols=18;
 function quad(vs,norm){const o=p.length/3;for(const v of vs){p.push(...v);n.push(...norm);}i.push(o,o+1,o+2,o,o+2,o+3);}
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const r0=ri+(ro-ri)*row/rows,r1=ri+(ro-ri)*(row+1)/rows,rm=(r0+r1)/2,am=(col+.5)/cols*TAU,hx=(r1-r0)/2,hy=Math.PI/cols*rm,rr=.0043;
  const angles=Array.from({length:20},(_,i)=>i/20*TAU);for(const x of [-hx,hx])for(const y of [-hy,hy])angles.push((Math.atan2(y,x)+TAU)%TAU);angles.sort((a,b)=>a-b);
  const map=(x,y,z)=>[(rm+x)*Math.cos(am+y/rm),(rm+x)*Math.sin(am+y/rm),z];
  for(let k=0;k<angles.length;k++){
   const a=angles[k],b=angles[(k+1)%angles.length],outer=t=>{const co=Math.cos(t),si=Math.sin(t),f=Math.min(hx/(Math.abs(co)||1e-9),hy/(Math.abs(si)||1e-9));return[f*co,f*si];},oa=outer(a),ob=outer(b),ha=[rr*Math.cos(a),rr*Math.sin(a)],hb=[rr*Math.cos(b),rr*Math.sin(b)];
   for(const sg of [-1,1])quad([map(...oa,sg*depth/2),map(...ob,sg*depth/2),map(...hb,sg*depth/2),map(...ha,sg*depth/2)],[0,0,sg]);
   const norm=[-Math.cos(am)*Math.cos((a+b)/2)+Math.sin(am)*Math.sin((a+b)/2),-Math.sin(am)*Math.cos((a+b)/2)-Math.cos(am)*Math.sin((a+b)/2),0];quad([map(...ha,-depth/2),map(...hb,-depth/2),map(...hb,depth/2),map(...ha,depth/2)],norm);
  }
 }
 return merge([{p,n,i},ring(ro,ro-.0006,depth,96),ring(ri+.0006,ri,depth,96)]);
}
class Mechanics{
 constructor(settings,sourceWheels){this.settings=settings;this.sourceWheels=sourceWheels;this.root=group('Mecánica reconstruida');this.parts=[];this.wheels=[];this.uid=0;this.explode=0;this.steer=0;this.pedal=0;this.elapsed=0;this.disposed=false;
  this.m={steel:material('Acero mecanizado','#a1a8ab',.83,.26),dark:material('Acero pavonado','#30393b',.65,.4),black:material('Goma y guardapolvos','#202625',0,.91),bronze:material('Bronce','#b89551',.73,.31),alloy:material('Aleación satinada','#bec4c1',.82,.24),friction:material('Material de fricción','#413e39',.10,.87),blue:material('Circuito trasero · azul','#397f94',.40,.29),orange:material('Circuito delantero · ámbar','#d57c31',.5,.3),chrome:material('Cromado','#e0e7e7',1,.14),white:material('Marcas laterales','#dddfcf',0,.86),red:material('Resortes / marcas','#bb4a31',.5,.35)};
  this.buildStructure();this.buildHydraulics();this.buildSteering();this.buildWheels();this.tag();
 }
 part(label,kind,parent,pos=[0,0,0],delta=[0,0,0],extra=''){
  const node=group(label,parent,pos),info=detail[kind]||[extra,'Reconstrucción paramétrica didáctica.'];
  const part={id:'P'+String(++this.uid).padStart(3,'0'),label,kind,node,base:V(...pos),delta:V(...delta),description:info[0],technical:extra||info[1],hidden:false,source:'Reconstrucción didáctica'};node.userData.part=part;this.parts.push(part);return part;
 }
 add(part,data,mat,name){const result=mesh(part.node,data,mat,name||part.label);result.userData.part=part;return result;}
 tag(){for(const part of this.parts)part.node.traverse(object=>{if(object.isMesh&&!object.userData.part)object.userData.part=part;});}
 buildStructure(){const m=this.m;this.structure=group('Soportes y chasis',this.root);
  const rails=this.part('Largueros de referencia','suspension',this.structure,[0,0,0],[0,-.12,0]);
  for(const side of [-1,1])this.add(rails,transformed(box(3.50,.10,.075),[0,.21,side*.42]),m.dark);
  for(const x of [-1.25,-.35,1.35])this.add(rails,transformed(box(.08,.07,1),[x,.23,0]),m.dark);
  const rear=this.part('Eje trasero y diferencial','suspension',this.structure,[1.4045,.32978,0],[.3,-.1,0]);this.add(rear,cylinder(.040,1.34,24),m.dark);this.add(rear,sphere(.13,24,14),m.dark);this.add(rear,transformed(ring(.11,.075,.065,48),[0,0,.04]),m.steel);
  for(const side of [-1,1]){
   const leaf=this.part('Ballesta trasera '+(side>0?'izquierda':'derecha'),'suspension',this.structure,[1.4,.22,side*.47],[0,-.12,side*.15]);
   for(let j=0;j<4;j++){const pts=[];for(let k=0;k<=20;k++){const t=k/20*2-1;pts.push([t*(.50-j*.04),.11*t*t-j*.010,0]);}this.add(leaf,tube(pts,.008,5),m.dark);}
  }
 }
 buildHydraulics(){const m=this.m;this.hydraulic=group('Circuito hidráulico',this.root);
  const booster=this.part('Servofreno de vacío','master',this.hydraulic,[-.68,.82,.44],[.1,.4,.24]);booster.node.rotation.y=Math.PI/2;this.add(booster,ring(.14,.01,.07,64),m.dark);this.add(booster,torus(.132,.007,64),m.steel);
  const master=this.part('Cilindro maestro tándem','master',this.hydraulic,[-.91,.82,.44],[-.22,.40,.24]);this.masterHousing=master;master.node.rotation.y=Math.PI/2;this.add(master,cylinder(.037,.24,40),m.steel);for(const z of [-.05,.045]){this.add(master,transformed(box(.056,.06,.065),[0,.044,z]),m.white);this.add(master,transformed(box(.062,.009,.073),[0,.08,z]),m.dark);}this.add(master,transformed(cylinder(.020,.025,24),[0,0,-.13]),m.bronze);
  const train=this.part('Pistones tándem, copas y resortes','master',this.hydraulic,[-.91,.82,.44],[-.20,.57,.42],'Corte conceptual de dos cámaras del maestro. Se amplifican los desplazamientos; la presión se calcula con un circuito ideal, sin compresibilidad ni averías.');train.node.rotation.y=Math.PI/2;this.masterTrain=train;
  for(const z of [-.075,.028]){this.add(train,transformed(cylinder(.025,.025,32),[0,0,z]),m.bronze);this.add(train,transformed(torus(.025,.003,32,8),[0,0,z+.014]),m.black);this.add(train,transformed(coil(.015,.057,5,.0022),[0,0,z+.045],[Math.PI/2,0,0]),m.steel);}
  const pedal=this.part('Pedal de freno y varilla','master',this.hydraulic,[-.29,.66,.45],[.28,.17,.20]);this.pedalPart=pedal;
  this.add(pedal,tube([[0,0,0],[.05,-.15,0],[.11,-.32,0]],.012,10),m.dark);this.add(pedal,transformed(box(.095,.07,.02),[.11,-.32,.0],[.12,0,0]),m.black);
  this.add(pedal,transformed(cylinder(.016,.055,16),[0,0,0]),m.bronze);
  const divider=this.part('Repartidor de frenada','master',this.hydraulic,[-.88,.48,.39],[0,.25,.25]);this.add(divider,box(.07,.08,.05),m.bronze);this.add(divider,boltCircle(3,.037,.007,.05,.025),m.steel);
  const front=this.part('Circuito delantero · tubería rígida','master',this.hydraulic,[0,0,0],[0,.10,.12],'La línea ámbar alimenta las dos ruedas delanteras. Los pulsos visuales representan presión, no un flujo volumétrico continuo.');
  this.add(front,tube([[-.92,.82,.45],[-.92,.68,.47],[-.89,.48,.42],[-1.14,.43,.40],[-1.22,.43,0],[-1.22,.43,-.48]],.007,8),m.orange);
  const rear=this.part('Circuito trasero · tubería rígida','master',this.hydraulic,[0,0,0],[0,.10,-.10],'La línea azul alimenta el eje trasero. El reparto efectivo de par depende de la presión y de la geometría de cada freno.');
  this.add(rear,tube([[-.83,.82,.44],[-.8,.60,.38],[-.85,.42,.38],[.3,.27,.40],[1.25,.34,.39],[1.4,.39,.46],[1.4,.39,-.50]],.0065,8),m.blue);
 }
 buildSteering(){const m=this.m;this.steering=group('Dirección articulada',this.root);
  const boxp=this.part('Caja de dirección · sector y sinfín','steering',this.steering,[-1.03,.44,.42],[-.12,.26,.2]);this.gearHousing=boxp;this.add(boxp,box(.16,.17,.13),m.dark);this.add(boxp,transformed(cylinder(.064,.06,32),[0,.022,.077]),m.steel);this.add(boxp,boltCircle(4,.05,.009,.022,.115,Math.PI/4),m.bronze);
  const worm=this.part('Sinfín de la caja · esquema interno','steering',this.steering,[-1.061,.451,.42],[-.20,.35,.26],'Sinfín y sector esquemáticos. Se ilustra la reducción de velocidad; no se reproducen tolerancias, recirculación de bolas ni perfiles de engrane de fábrica.');this.worm=worm;
  this.add(worm,transformed(cylinder(.014,.12,24),[0,0,0],[0,Math.PI/2,0]),m.chrome);const helix=[];for(let j=0;j<=200;j++){const t=j/200;helix.push([-.048+t*.096,Math.cos(t*6*TAU)*.018,Math.sin(t*6*TAU)*.018]);}this.add(worm,tube(helix,.004,8),m.bronze);
  const sector=this.part('Sector dentado y eje de salida','steering',this.steering,[-1.01,.405,.42],[.12,.32,-.16],'El eje vertical se conecta visualmente al brazo Pitman. La geometría cinemática usa los ángulos ideales Ackermann, no un contacto de dientes resuelto.');this.sector=sector;
  this.add(sector,transformed(cylinder(.046,.024,36),[0,0,0],[Math.PI/2,0,0]),m.steel);this.add(sector,transformed(cylinder(.014,.13,24),[0,-.048,0],[Math.PI/2,0,0]),m.chrome);for(let j=0;j<20;j++){const a=j/20*TAU;this.add(sector,transformed(box(.013,.025,.012),[Math.cos(a)*.048,0,Math.sin(a)*.048],[0,-a,0]),m.bronze);}
  const shaft=this.part('Columna y juntas universales','steering',this.steering,[0,0,0],[0,.32,.12]);const A=[-.10,1.00,.45],J=[-.65,.68,.45],C=[-1.03,.47,.42];rod(shaft.node,A,J,.020,m.steel);rod(shaft.node,J,C,.018,m.steel);for(const a of [J,C]){this.add(shaft,transformed(sphere(.032,16,10),a),m.dark);}
  const wheel=this.part('Volante y transmisión de dirección','steering',this.steering,A,[.3,.32,.12]);this.steeringWheel=wheel;const d=V(...J).sub(V(...A)).normalize();wheel.node.quaternion.setFromUnitVectors(V(0,0,1),d);this.wheelSpin=group('Giro del volante',wheel.node);mesh(this.wheelSpin,torus(.18,.014,72,12),m.black);mesh(this.wheelSpin,cylinder(.037,.035,24),m.dark);for(let i=0;i<3;i++)mesh(this.wheelSpin,spoke(.025,.17,.018,.009,i*TAU/3),m.steel);
  const pit=this.part('Brazo Pitman','steering',this.steering,[-1.03,.30,.42],[0,.04,.15]);this.pitman=pit;this.add(pit,box(.16,.025,.035),m.dark);this.add(pit,transformed(sphere(.023,12,8),[.07,0,0]),m.bronze);
  const idler=this.part('Brazo auxiliar / reenvío','steering',this.steering,[-1.03,.30,-.42],[0,.04,-.15]);this.idler=idler;this.add(idler,box(.16,.025,.035),m.dark);this.add(idler,transformed(sphere(.023,12,8),[.07,0,0]),m.bronze);
  const center=this.part('Barra central de dirección','steering',this.steering,[0,0,0],[0,-.04,0]);this.centerLink=rod(center.node,[-1.12,.29,-.40],[-1.12,.29,.40],.017,m.steel);
  this.tierods=[];for(const side of [1,-1]){const tr=this.part('Bieleta y terminal '+(side>0?'izquierdos':'derechos'),'steering',this.steering,[0,0,0],[0,-.055,side*.1]);const r=rod(tr.node,[-1.12,.29,side*.37],[-1.28,.29,side*.69],.012,m.bronze);const sleeve=rod(tr.node,[-1.13,.29,side*.43],[-1.23,.29,side*.58],.019,m.dark);this.tierods.push({part:tr,rod:r,sleeve,side});}
 }
 buildWheels(){
  if(this.disposed)return this.wheels;
  const c=this.settings;for(const key of ['rim','tire','kit'])c[key]=clamp(Math.round(Number(c[key])||0),0,3);c.kit=Math.min(c.kit,c.rim);
  for(const wheel of this.wheels)this.releaseTree(wheel.root,true);
  this.parts=this.parts.filter(part=>part.wheel===undefined);this.wheels=[];
  for(let index=0;index<4;index++)this.wheels.push(this.buildWheel(index));
  this.tag();this.applyViews();this.update(0);return this.wheels;
 }
 buildWheel(index){const m=this.m,c=this.settings,side=index%2===0?1:-1,front=index<2,R=tireRadius[c.tire],W=tireWidth[c.tire],RR=rimRadius[c.rim],K=kits[c.kit];
  const pivot=group(wheelNames[index],this.root,[front?-1.4145:1.4045,.32978,side*.755]);const assy=group('Conjunto local',pivot);assy.scale.z=side;const spin=group('Llanta y neumático giratorios',assy),rotspin=group('Disco giratorio',assy);
  const w={root:pivot,assy,spin,rotspin,index,side,front,parts:[],pads:[],shoes:[],pistons:[],rotors:[]};
  const part=(label,kind,parent=assy,pos=[0,0,0],delta=[0,0,0],extra='')=>{const p=this.part(label+' · '+wheelNames[index],kind,parent,pos,delta,extra);p.wheel=index;p.short=label;w.parts.push(p);return p;};
  const kn=part(front?'Mangueta y brazo de dirección':'Portamangueta / soporte de eje','suspension',assy,[0,0,-.07],[0,-.12,-.25]);this.add(kn,box(.075,.14,.04),m.dark);this.add(kn,cylinder(.029,.13,32),m.steel);if(front){this.add(kn,tube([[0,-.05,0],[.12,-.055,-.04],[.16,-.045,-.04]],.019,12),m.dark);for(const y of [-.095,.095])this.add(kn,transformed(sphere(.029,16,10),[0,y,-.035]),m.bronze);}
  const backing=part('Plato protector','hub',assy,[0,0,-.059],[0,0,-.10]);this.add(backing,ring((front?K.rF:K.rR)*1.02,.027,.003,72,c.cut?Math.PI*.20:0,c.cut?TAU*.73:TAU),m.dark);
  const hub=part('Cubo y brida de rueda','hub',rotspin,[0,0,.034],[0,0,.21]);this.add(hub,cylinder(.040,.09,40),m.steel);this.add(hub,ring(.073,.025,.019,56),m.steel);this.add(hub,boltCircle(5,.058,.006,.11,.045,Math.PI/2),m.dark);
  const inner=part('Rodamiento interior y retén','bearing',assy,[0,0,-.040],[0,0,-.025]);const outer=part('Rodamiento exterior y tuerca','bearing',rotspin,[0,0,.069],[0,0,.44]);
  for(const p of [inner,outer]){this.add(p,ring(.039,.025,.017,48),m.steel);this.add(p,ring(.026,.019,.021,40),m.chrome);const rs=[];for(let j=0;j<12;j++){const a=j/12*TAU;rs.push(transformed(cylinder(.0038,.016,8),[.032*Math.cos(a),.032*Math.sin(a),.005]));}this.add(p,merge(rs),m.bronze);}
  this.add(outer,transformed(cylinder(.023,.012,6),[0,0,.022]),m.bronze);
  const drum=c.kit===0&&!front;
  if(!drum){const radius=front?K.rF:K.rR;let rotMat=material('Pista de fricción '+index,'#aab1b2',.88,.31);w.heatMat=rotMat;
   const rotor=part(c.kit===0?'Disco macizo':c.kit===2?'Disco ventilado y perforado':c.kit===3?'Disco ventilado y ranurado':'Disco ventilado','rotor',rotspin,[0,0,.01],[0,0,.74]);w.rotorPart=rotor;
   const plate=(thick)=>c.kit===2&&!c.cut?drilled(radius,radius*.47,thick):ring(radius,radius*.47,thick,96,c.cut?Math.PI*.2:0,c.cut?TAU*.73:TAU);
   if(c.kit===0){w.rotors.push(this.add(rotor,plate(.014),rotMat));}else{for(const z of [-.010,.010])w.rotors.push(this.add(rotor,transformed(plate(.006),[0,0,z]),rotMat));const vanes=[];for(let j=0;j<36;j++){const a=j/36*TAU;if(c.cut&&a<Math.PI*.2)continue;if(c.cut&&a>TAU*.83)continue;vanes.push(spoke(radius*.53,radius*.98,.004,.016,a+.12,0));}this.add(rotor,merge(vanes),m.dark);}
   this.add(rotor,ring(radius*.51,.033,.040,48),m.dark);this.add(rotor,boltCircle(5,.058,.005,.05,.004),m.bronze);
   if(c.kit===3){const slots=[];for(let j=0;j<9;j++){const a=j/9*TAU;for(const z of [-.0132,.0132])slots.push(spoke(radius*.67,radius*.96,.003,.001,a+.24,z));}this.add(rotor,merge(slots),m.dark);}
   const calmat=material('Pinza '+index,['#465251','#ca6935','#b9422f','#af8650'][c.kit],.60,.30);
   const cal=part(c.kit<2?'Pinza flotante':'Pinza de '+(c.kit===2?4:6)+' pistones opuestos','caliper',assy,[0,0,.012],[.09,.22,.76]);w.caliper=cal;
   for(const sg of [-1,1]){this.add(cal,transformed(box(.059,.115,.024),[radius-.013,0,sg*.038]),calmat);this.add(cal,transformed(box(.026,.022,.095),[radius-.011,sg*.048,0]),calmat);}
   this.add(cal,transformed(box(.024,.088,.060),[radius+.024,0,0]),calmat);
   this.add(cal,transformed(cylinder(.006,.025,10),[radius+.012,.069,.043],[.25,0,0]),m.bronze);
   const fast=part('Pernos guía y soporte de pinza','caliper',assy,[0,0,-.027],[.04,-.20,.53]);for(const y of [-.063,.063]){this.add(fast,transformed(cylinder(.008,.092,10),[radius-.03,y,0]),m.steel);this.add(fast,transformed(cylinder(.013,.013,6),[radius-.03,y,-.04]),m.dark);}
   for(const sg of [-1,1]){const pad=part((sg>0?'Pastilla exterior':'Pastilla interior'),'pad',assy,[0,0,.010+sg*.023],[0,sg*.20,.88+(sg>0?.24:0)]);w.pads.push({part:pad,sg});this.add(pad,ring(radius*.95,radius*.61,.007,24,-.37,.74),m.friction);this.add(pad,transformed(ring(radius*.97,radius*.60,.004,24,-.40,.80),[0,0,sg*.006]),m.dark);
    if(c.kit<2&&sg>0)continue;const piston=part('Pistones y guardapolvos '+(sg>0?'exteriores':'interiores'),'caliper',assy,[0,0,sg*.034],[.14,sg*.15,1.12]);w.pistons.push({part:piston,sg});const num=c.kit===3?3:c.kit===2?2:1;for(let j=0;j<num;j++){const y=(j-(num-1)/2)*.033;this.add(piston,transformed(cylinder(num===1?.022:.015,.016,24),[radius-.015,y,0]),m.chrome);this.add(piston,transformed(torus(num===1?.024:.017,.0035,24,8),[radius-.015,y,0]),m.black);}
   }
  }else{
   const ro=.125,dr=part('Tambor desmontable','drum',rotspin,[0,0,.012],[0,0,.95]);w.rotorPart=dr;const start=c.cut?Math.PI*.25:0,sweep=c.cut?TAU*.68:TAU;
   this.add(dr,ring(ro,ro-.009,.067,96,start,sweep),m.dark);this.add(dr,transformed(ring(ro,.035,.009,96,start,sweep),[0,0,.039]),m.steel);this.add(dr,transformed(torus(ro,.002,96,8,start,sweep),[0,0,.027]),m.steel);
   for(const sg of [-1,1]){const sh=part(sg>0?'Zapata primaria':'Zapata secundaria','shoe',assy,[0,0,0],[sg*.20,0,.35]);w.shoes.push({part:sh,sg});const start=sg>0?-.94:Math.PI-.94;this.add(sh,ring(.115,.093,.041,40,start,1.88),m.friction);this.add(sh,ring(.099,.072,.007,40,start,1.88),m.steel);}
   const cyl=part('Cilindro de rueda y émbolos','master',assy,[0,.090,-.005],[0,.22,.35]);this.add(cyl,transformed(cylinder(.015,.064,24),[0,0,0],[0,Math.PI/2,0]),m.steel);for(const sg of [-1,1])this.add(cyl,transformed(cylinder(.012,.015,16),[sg*.038,0,0],[0,Math.PI/2,0]),m.black);
   const springs=part('Resortes de retorno y regulación','shoe',assy,[0,0,0],[0,-.19,.53]);for(const y of [.055,-.057]){const pts=[];for(let j=0;j<120;j++){const t=j/119;pts.push([-.064+t*.128,y+Math.cos(t*12*TAU)*.005,.022+Math.sin(t*12*TAU)*.005]);}this.add(springs,tube(pts,.0016,6),m.red);}this.add(springs,transformed(cylinder(.008,.078,12),[0,-.091,.01],[0,Math.PI/2,0]),m.bronze);
   const park=part('Palanca y cable de estacionamiento','shoe',assy,[0,0,0],[-.16,-.1,.26]);this.add(park,tube([[-.061,.039,-.025],[-.07,-.055,-.028],[-.04,-.093,-.038]],.009,8),m.dark);
  }
  const rim=part(rimNames[c.rim],'rim',spin,[0,0,0],[0,0,1.64]);w.rim= rim;
  const tire=part(tireNames[c.tire],'tire',spin,[0,0,0],[0,0,2.33]);w.tire=tire;
  const sourceWheel=this.sourceWheels[index];
  if(c.rim===0&&!c.cut&&this.cloneWheelPart(sourceWheel,rim,side,'rim'))rim.source='Geometría de llanta del GLB';
  else{
   this.add(rim,ring(RR,RR-.009,W*.79,96,c.cut?Math.PI*.2:0,c.cut?TAU*.73:TAU),m.alloy);for(const z of [-W*.4,W*.4])this.add(rim,transformed(torus(RR-.002,.006,96,10,c.cut?Math.PI*.2:0,c.cut?TAU*.73:TAU),[0,0,z]),m.chrome);
   let ds=[],rmat=c.rim===3?m.bronze:c.rim===0?m.dark:m.alloy;const count=c.rim===1?5:c.rim===2?12:c.rim===3?8:5;
   for(let j=0;j<count;j++){const a=j/count*TAU;if(c.rim===2){ds.push(spoke(.055,RR-.012,.011,.025,a+.07,W*.35));ds.push(spoke(.055,RR-.012,.009,.025,a-.07,W*.35));}else ds.push(spoke(.040,RR-.009,c.rim===1?.041:.029,.028,a,W*.35));}
   this.add(rim,merge(ds),rmat);this.add(rim,transformed(cylinder(.050,.041,40),[0,0,W*.35]),rmat);
  }
  if(c.tire===0&&c.rim===0&&!c.cut&&this.cloneWheelPart(sourceWheel,tire,side,'tire'))tire.source='Geometría de neumático del GLB';
  else{
   const w2=W/2,profile=[[RR-.008,-w2*.77],[RR+.012,-w2*.99],[R-.036,-w2*1.01],[R-.010,-w2*.84],[R,-w2*.64],[R,w2*.64],[R-.010,w2*.84],[R-.036,w2*1.01],[RR+.012,w2*.99],[RR-.008,w2*.77],[RR-.008,-w2*.77]];
   this.add(tire,ring(RR+.007,RR-.002,W*.79,64,c.cut?Math.PI*.2:0,c.cut?TAU*.73:TAU),m.black);this.add(tire,(awaitLathe(profile,c.cut)),m.black);
   const treads=[];const count=c.tire===2?64:88;
   for(let j=0;j<count;j++){const a=j/count*TAU;const phi=(a+Math.PI/2)%TAU;if(c.cut&&(phi<Math.PI*.2||phi>Math.PI*.2+TAU*.73))continue;const rows=c.tire===2?2:4;for(let row=0;row<rows;row++){const z=(row-(rows-1)/2)*W*.17;const w=c.tire===2?.058:W*.145;const block=transformed(box(.013,.003,w),[-(R+.0005)*Math.sin(a),(R+.0005)*Math.cos(a),z],[0,0,a]);treads.push(block);}}
   this.add(tire,merge(treads),material('Relieve de banda '+index,'#292c29',0,.94));
   for(const z of [-w2*.997,w2*.997])this.add(tire,transformed(torus(R-.045,.0014,96,6,c.cut?Math.PI*.2:0,c.cut?TAU*.73:TAU),[0,0,z]),m.black);
  }
  const nuts=part('Tuercas, arandelas y tapa de cubo','hub',spin,[0,0,W*.48],[0,0,2.05]);this.add(nuts,boltCircle(5,.058,.010,.022,0,Math.PI/2),m.chrome);this.add(nuts,cylinder(.026,.018,32),m.dark);this.add(nuts,torus(.023,.002,40,8),m.bronze);
  const valve=part('Válvula de inflado','tire',spin,[0,RR*.85,W*.43],[0,.09,1.76]);this.add(valve,cylinder(.0035,.022,10),m.black);this.add(valve,transformed(cylinder(.004,.010,10),[0,0,.013]),m.steel);
  const hose=part('Latiguillo flexible y racor','master',assy,[0,0,0],[-.12,.13,-.05]);this.add(hose,tube([[.16,.04,-.07],[.20,.12,-.13],[.13,.20,-.18],[.02,.16,-.24]],.0065,10),m.black);this.add(hose,transformed(cylinder(.009,.02,6),[.16,.04,-.07]),m.bronze);
  if(front){
   const arm=part('Brazos superior e inferior','suspension',assy,[0,0,0],[0,-.08,-.26]);for(const y of [-.12,.105]){this.add(arm,tube([[-.20,y,-.37],[0,y,-.10],[.20,y,-.37]],.018,10),m.dark);for(const x of [-.2,.2])this.add(arm,transformed(cylinder(.03,.065,20),[x,y,-.37],[0,Math.PI/2,0]),m.black);}
   const spring=part('Muelle helicoidal y amortiguador','suspension',assy,[0,.16,-.28],[0,.18,-.26]);this.add(spring,coil(.055,.26,8,.008),m.dark);this.add(spring,transformed(cylinder(.016,.28,20),[0,0,0],[Math.PI/2,0,0]),m.steel);this.add(spring,transformed(cylinder(.027,.14,24),[0,-.035,0],[Math.PI/2,0,0]),m.bronze);
  }
  return w;
 }

 cloneWheelPart(source,part,side,kind){
  if(!source)return false;
  source.updateWorldMatrix(true,true);const inverse=new T.Matrix4().copy(source.matrixWorld).invert();let count=0;
  source.traverse(original=>{
   const explicit=original.userData?.chassisKind;
   const matches=kind==='rim'?/Cromo|Centro_Llanta|Franjas_Negro|Burletes/i.test(original.name):/Goma_Neumaticos|Goma_Dibujo|Letras_Neumaticos/i.test(original.name);
   if(!original.isMesh||!(explicit?explicit===kind:matches))return;
   const geometry=original.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,original.matrixWorld));
   if(kind==='rim'&&/Cromo/i.test(original.name)&&geometry.index){const position=geometry.attributes.position,indices=geometry.index,keep=[];for(let q=0;q<indices.count;q+=3){const triangle=[indices.getX(q),indices.getX(q+1),indices.getX(q+2)];if(triangle.some(vertex=>Math.hypot(position.getX(vertex),position.getY(vertex))>.080))keep.push(...triangle);}geometry.setIndex(keep);}
   geometry.computeBoundingSphere();geometries.add(geometry);
   const copyMaterial=value=>{const copy=value.clone();materials.add(copy);return copy;};
   const material=Array.isArray(original.material)?original.material.map(copyMaterial):copyMaterial(original.material);
   const copy=new T.Mesh(geometry,material);copy.name=original.name+'_interactivo';copy.castShadow=true;copy.receiveShadow=true;copy.userData={part,source:'GLB original'};part.node.add(copy);count++;
  });return count>0;
 }
 applyViews(){
  if(this.disposed)return;
  const c=this.settings,wheelView=c.view==='wheel';
  for(const wheel of this.wheels)wheel.root.visible=!wheelView||wheel.index===c.wheel;
  this.structure.visible=!wheelView&&c.layers.suspension;this.steering.visible=!wheelView&&c.layers.steering;this.hydraulic.visible=!wheelView&&c.layers.hydraulic;
  const layers={tire:'tires',rim:'rims',rotor:'brakes',caliper:'brakes',pad:'brakes',drum:'brakes',shoe:'brakes',bearing:'brakes',hub:'brakes',suspension:'suspension',steering:'steering',master:'hydraulic'};
  for(const part of this.parts)part.node.visible=!part.hidden&&c.layers[layers[part.kind]]!==false&&(!c.isolated||part.id===c.isolated);
 }
 update(dt=0,physics){
  if(this.disposed)return;
  dt=Number.isFinite(dt)?Math.max(0,dt):0;this.elapsed+=dt;
  const c=this.settings,ease=1-Math.exp(-dt*9);
  this.explode+=(clamp(Number(c.explode)||0,0,1)-this.explode)*ease;this.steer+=(clamp(Number(c.steer)||0,-34,34)-this.steer)*ease;this.pedal+=(clamp(Number(c.brake)||0,0,1)-this.pedal)*ease;
  const A=ackermann(this.steer),ratio=Number(c.steerRatio)||18;
  for(const part of this.parts)part.node.position.copy(part.base).addScaledVector(part.delta,this.explode);
  this.worm.node.rotation.x=this.steer*ratio*Math.PI/180;this.sector.node.rotation.y=this.steer*.7*Math.PI/180;this.masterTrain.node.position.x-=this.pedal*.018;
  for(const part of [this.gearHousing,this.masterHousing])part.node.traverse(object=>{
   if(!object.isMesh)return;
   if(!object.userData.cutMaterial){const clone=value=>{const result=value.clone();materials.add(result);return result;};object.material=Array.isArray(object.material)?object.material.map(clone):clone(object.material);object.userData.cutMaterial=true;}
   for(const material of Array.isArray(object.material)?object.material:[object.material]){const transparent=Boolean(c.cut);if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=transparent?.16:1;material.depthWrite=!transparent;}
   object.userData.pickable=!c.cut;
  });
  const pulse=this.pedal*(.08+.025*Math.sin(this.elapsed*8));this.m.orange.emissive.setRGB(pulse,pulse*.32,0);this.m.blue.emissive.setRGB(0,pulse*.25,pulse*.6);
  this.pedalPart.node.rotation.z=-this.pedal*.28;this.wheelSpin.rotation.z=-this.steer*ratio*Math.PI/180;
  this.pitman.node.rotation.y=this.steer*.7*Math.PI/180;this.idler.node.rotation.y=this.steer*.7*Math.PI/180;
  const shift=Math.sin(this.steer*Math.PI/180)*.12;setRod(this.centerLink,[-1.12,.29,-.40+shift],[-1.12,.29,.40+shift]);
  for(const tr of this.tierods){const angle=tr.side>0?A.left:A.right,end=V(.15,-.045,-tr.side*.105).applyAxisAngle(V(0,1,0),angle).add(V(-1.4145,.32978,tr.side*.755)),start=V(-1.12,.29,tr.side*.37+shift);setRod(tr.rod,start,end);setRod(tr.sleeve,start.clone().lerp(end,.26),start.clone().lerp(end,.67));}
  for(const wheel of this.wheels){
   wheel.root.rotation.y=wheel.front?(wheel.side>0?A.left:A.right):0;
   if(c.demo&&!physics?.active)wheel.demoAngle=(wheel.demoAngle||0)+dt*(Number(c.rpm)||0)*TAU/60;
   const angle=physics?.angle?.[wheel.index]??0;wheel.spin.rotation.z=wheel.rotspin.rotation.z=angle+(wheel.demoAngle||0);
   for(const {part,sg} of wheel.pads)part.node.position.z-=sg*this.pedal*.010;
   for(const {part,sg} of wheel.pistons)part.node.position.z-=sg*this.pedal*.006;
   for(const {part,sg} of wheel.shoes)part.node.position.x+=sg*this.pedal*.009;
   if(wheel.heatMat){const temperature=physics?.temp?.[wheel.index]??20,f=c.thermal?clamp((temperature-20)/180,0,1):clamp((temperature-480)/250,0,1);wheel.heatMat.emissive.setRGB(f*.65,f*.10,f*.005);}
  }
 }
 findPart(id){return this.parts.find(part=>part.id===id);}
 releaseTree(root,keepBaseMaterials=false){
  const keep=keepBaseMaterials?new Set(Object.values(this.m)):new Set(),releaseGeometries=new Set(),releaseMaterials=new Set();
  root.traverse(object=>{if(!object.isMesh)return;releaseGeometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])if(!keep.has(material))releaseMaterials.add(material);});
  for(const geometry of releaseGeometries)if(geometries.delete(geometry))geometry.dispose();
  for(const material of releaseMaterials)if(materials.delete(material))material.dispose();
  root.removeFromParent();root.clear();
 }
 diagnostics(){
  let meshes=0,triangles=0,vertices=0,visibleMeshes=0;
  this.root.traverse(object=>{if(object.isMesh){meshes++;vertices+=object.geometry.attributes.position.count;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;let visible=true;for(let parent=object;parent;parent=parent.parent)visible&&=parent.visible;if(visible)visibleMeshes++;}});
  return {disposed:this.disposed,parts:this.parts.length,meshes,visibleMeshes,triangles,vertices,ownedGeometries:geometries.size,ownedMaterials:materials.size,rim:this.settings.rim,tire:this.settings.tire,kit:this.settings.kit,cut:Boolean(this.settings.cut),explode:this.explode,steer:this.steer,brake:this.pedal,wheels:this.wheels.map(wheel=>({index:wheel.index,front:wheel.front,side:wheel.side,visible:wheel.root.visible,steer:wheel.root.rotation.y,angle:wheel.spin.rotation.z,parts:wheel.parts.length}))};
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.root.clear();
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();geometries.clear();materials.clear();this.parts=[];this.wheels=[];
 }
}
function awaitLathe(profile,cut){return lathe(profile,112,cut?Math.PI*.20:0,cut?TAU*.73:TAU);}
return new Mechanics(settings,sourceWheels);
}
