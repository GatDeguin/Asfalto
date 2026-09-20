/** Educational reduced-order model. SI internally; parameters are illustrative,
 * not measured for the supplied artistic GLB. No homologation/fit/safety use. */
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const defaultConfig={mass:1400,cg:.55,frontStatic:.54,wheelbase:2.819,track:1.510,radius:.3303,tire:0,kit:0,surface:'dry',abs:false,bias:.65,psi:32,ambient:20};
export const kits=[
 {name:'Clásico',rF:.135,rR:.125,piston:.048,mu:.38,mF:6,mR:5.5,cooling:15,fade:330,rear:.68},
 {name:'Turismo',rF:.150,rR:.140,piston:.052,mu:.40,mF:7.5,mR:6.0,cooling:22,fade:400,rear:.60},
 {name:'Sport',rF:.160,rR:.150,piston:.055,mu:.43,mF:8,mR:6.8,cooling:26,fade:480,rear:.57},
 {name:'Pista',rF:.175,rR:.160,piston:.058,mu:.46,mF:9,mR:7.5,cooling:32,fade:600,rear:.53}
];
export function ackermann(deg,L=2.819,T=1.510){
 const d=clamp(deg,-34,34)*Math.PI/180;if(Math.abs(d)<1e-8)return{left:0,right:0,radius:Infinity};
 const R=L/Math.tan(Math.abs(d)),sg=Math.sign(d),inner=Math.atan(L/(R-T/2)),outer=Math.atan(L/(R+T/2));
 return {left:sg*(sg>0?inner:outer),right:sg*(sg>0?outer:inner),radius:R};
}
export function normalLoads(m,a,h,front,L){const total=m*9.81,F=clamp(total*front+m*a*h/L,total*.08,total*.92);return{front:F,rear:total-F};}
export function tireForce(k,Fz,mu){const B=10,C=1.9,E=.97,x=B*k;return mu*Fz*Math.sin(C*Math.atan(x-E*(x-Math.atan(x))));}
export function grip(c){const compound=[.88,1.05,1.18,.96][c.tire],surface={dry:1,wet:.62,gravel:.48,ice:.12}[c.surface]??1;
 const wetPenalty=c.surface==='wet'?[1,.95,.61,1.12][c.tire]:1;return compound*surface*wetPenalty*clamp(Math.exp(-Math.pow((c.psi-32)/30,2)),.6,1);}
export function hydraulic(brake){return clamp(brake,0,1)*450*4*2.5/(Math.PI*.0127*.0127);}
export class Physics{
 constructor(config={}){this.config={...defaultConfig,...config};this.reset();}
 reset(keepHeat=false){const t=this.temp;this.speed=0;this.distance=0;this.time=0;this.accel=0;this.lat=0;this.pressure=0;this.omega=[0,0,0,0];this.slip=[0,0,0,0];this.force=[0,0,0,0];this.torque=[0,0,0,0];this.mod=[1,1,1,1];this.temp=keepHeat&&t?t.slice():Array(4).fill(this.config.ambient);this.loads=[0,0,0,0];this.angle=[0,0,0,0];this.active=false;this.stopped=false;this.yaw=0;this.x=0;this.z=0;this.samples=[];this._sample=0;this.initialSpeed=0;}
 launch(kmh,keepHeat=false){this.reset(keepHeat);this.speed=clamp(kmh,5,180)/3.6;this.initialSpeed=this.speed;this.omega.fill(this.speed/this.config.radius);this.active=true;}
 step(dt,input={}){
  const brake=clamp(input.brake??0,0,1),steer=input.steer??0,c=this.config,K=kits[c.kit];
  this.pressure=hydraulic(brake)/1e5;
  if(!this.active){for(let i=0;i<4;i++)this.temp[i]+=(c.ambient-this.temp[i])*.003*dt;return;}
  const n=Math.max(1,Math.ceil(dt/(1/960))),h=dt/n;
  for(let it=0;it<n;it++){
   if(this.stopped)break;
   const v=this.speed,mu=grip(c),N=normalLoads(c.mass,this.accel,c.cg,c.frontStatic,c.wheelbase);
   const desiredAy=v*v*Math.tan(steer*Math.PI/180)/c.wheelbase;
   this.lat=clamp(desiredAy,-mu*9.81*.95,mu*9.81*.95);
   const reserve=Math.sqrt(Math.max(.05,1-Math.pow(this.lat/(mu*9.81),2)));
   const lateralTransfer=c.mass*this.lat*c.cg/c.track;
   this.loads=[N.front/2-lateralTransfer*.54,N.front/2+lateralTransfer*.54,N.rear/2-lateralTransfer*.46,N.rear/2+lateralTransfer*.46].map(x=>Math.max(100,x));
   const loadSum=this.loads.reduce((a,b)=>a+b,0);this.loads=this.loads.map(x=>x*c.mass*9.81/loadSum);
   for(let i=0;i<4;i++){
    const front=i<2,R=c.radius,slip=clamp((v-this.omega[i]*R)/Math.max(v,2),-1,1);this.slip[i]=slip;
    if(c.abs&&v>2){this.mod[i]=clamp(this.mod[i]+(slip>.18?-16:4)*h,.04,1);}else this.mod[i]=1;
    const fade=clamp(1-Math.max(0,this.temp[i]-K.fade)/450,.28,1);
    const area=Math.PI*(K.piston/2)**2;
    const axle=front?c.bias/.65:(1-c.bias)/.35*K.rear;
    const torque=hydraulic(brake)*area*2*K.mu*(front?K.rF:K.rR)*.80*axle*fade*this.mod[i];
    const force=tireForce(slip,this.loads[i],mu*reserve);
    this.force[i]=force;this.torque[i]=torque;
    const inertia=1.35+(c.tire===2?.15:0)+c.kit*.07;
    this.omega[i]=Math.max(0,this.omega[i]+(force*R-torque)*h/inertia);
    this.angle[i]=(this.angle[i]+this.omega[i]*h)%(2*Math.PI);
    const heat=torque*this.omega[i]*.9,loss=(K.cooling+v*1.2)*(this.temp[i]-c.ambient);
    this.temp[i]=Math.max(c.ambient,this.temp[i]+(heat-loss)*h/((front?K.mF:K.mR)*460));
   }
   const aero=.5*1.225*.47*2.1*v*v,rolling=c.mass*9.81*.013;
   const ret=this.force.reduce((a,b)=>a+b,0)+aero+rolling;
   const next=Math.max(0,v-ret/c.mass*h);this.accel=(v-next)/h;
   this.distance+=(v+next)*.5*h;this.speed=next;this.time+=h;
   this.yaw+=(v>.2?this.lat/v:0)*h;this.x+=v*Math.cos(this.yaw)*h;this.z+=v*Math.sin(this.yaw)*h;
   if(this.speed<.15&&(brake>.02||v<.15)){this.speed=0;this.omega.fill(0);this.slip.fill(0);this.stopped=true;this.active=false;}
  }
  this._sample+=dt;
  if(this._sample>=.04||this.stopped){this._sample=0;this.samples.push({time:this.time,speed:this.speed*3.6,distance:this.distance,accel:this.accel/9.81,pressure:this.pressure,tempFront:(this.temp[0]+this.temp[1])/2,tempRear:(this.temp[2]+this.temp[3])/2,slipFront:this.slip[0],slipRear:this.slip[2],x:this.x,z:this.z});if(this.samples.length>20000)this.samples.shift();}
 }
}
