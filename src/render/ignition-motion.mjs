import {stepDampedSpring} from './cockpit-animator.mjs?v=1e70e16a21a9b8b3';
const EMPTY=Object.freeze({}),IDENTITY=Object.freeze([0,0,0,1]);
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function inverseRotate(out,x,y,z,q=IDENTITY){
  const n=Math.hypot(finite(q[0]),finite(q[1]),finite(q[2]),finite(q[3],1))||1;
  const qx=-finite(q[0])/n,qy=-finite(q[1])/n,qz=-finite(q[2])/n,qw=finite(q[3],1)/n;
  const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
  out[0]=x+qw*tx+qy*tz-qz*ty;out[1]=y+qw*ty+qz*tx-qx*tz;out[2]=z+qw*tz+qx*ty-qy*tx;
}
/** Reusable two-axis gravity pendulum. Result is borrowed until next step. */
export function createIgnitionMotion(){
  const previousPosition=new Float64Array(3),previousVelocity=new Float64Array(3),previousOmega=new Float64Array(3);
  const force=new Float64Array([0,-9.81,0]),localForce=new Float64Array(3),omega=new Float64Array(3),alpha=new Float64Array(3),target=new Float64Array(3),spring=new Float64Array(6);
  const state={pitch:0,roll:0,twist:0,keyRoll:0,keyPitch:0,updates:0};
  let initialized=false,previousTime=NaN,phase=0;
  function reset(){initialized=false;previousTime=NaN;phase=0;spring.fill(0);force[0]=force[2]=0;force[1]=-9.81;state.pitch=state.roll=state.twist=state.keyRoll=state.keyPitch=state.updates=0;return state;}
  return{reset,getState:()=>state,
    step(snapshot,options=EMPTY){
      if(options.editing||options.reducedMotion)return reset();
      if(options.paused||!snapshot?.chassis)return state;
      const body=snapshot.chassis,time=finite(snapshot.timeSeconds,NaN),p=body.position,v=body.linearVelocity,w=body.angularVelocity,q=body.rotation;
      const elapsed=initialized&&Number.isFinite(time)&&Number.isFinite(previousTime)?time-previousTime:finite(options.dt,1/60);
      if(initialized&&elapsed===0)return state;
      const px=finite(p?.[0]),py=finite(p?.[1]),pz=finite(p?.[2]),vx=finite(v?.[0]),vy=finite(v?.[1]),vz=finite(v?.[2]);
      const wx=finite(w?.[0]),wy=finite(w?.[1]),wz=finite(w?.[2]);
      const jump=initialized&&Math.hypot(px-previousPosition[0],py-previousPosition[1],pz-previousPosition[2])>5+Math.hypot(vx,vy,vz)*Math.max(0,elapsed)*3;
      if(!initialized||elapsed<=0||elapsed>.2||jump){
        reset();initialized=true;
        previousPosition[0]=px;previousPosition[1]=py;previousPosition[2]=pz;
        previousVelocity[0]=vx;previousVelocity[1]=vy;previousVelocity[2]=vz;
        previousOmega[0]=wx;previousOmega[1]=wy;previousOmega[2]=wz;previousTime=time;return state;
      }
      const dt=clamp(elapsed,1/1000,1/15),a=body.acceleration;
      const ax=finite(a?.[0],(vx-previousVelocity[0])/dt),ay=finite(a?.[1],(vy-previousVelocity[1])/dt),az=finite(a?.[2],(vz-previousVelocity[2])/dt);
      inverseRotate(omega,wx,wy,wz,q);
      inverseRotate(alpha,clamp((wx-previousOmega[0])/dt,-35,35),clamp((wy-previousOmega[1])/dt,-35,35),clamp((wz-previousOmega[2])/dt,-35,35),q);
      inverseRotate(localForce,-clamp(ax,-45,45),-9.81-clamp(ay,-45,45),-clamp(az,-45,45),q);
      const rx=.45,ry=.22,rz=-.22;
      const cx=omega[1]*rz-omega[2]*ry,cy=omega[2]*rx-omega[0]*rz,cz=omega[0]*ry-omega[1]*rx;
      localForce[0]-=alpha[1]*rz-alpha[2]*ry+omega[1]*cz-omega[2]*cy;
      localForce[1]-=alpha[2]*rx-alpha[0]*rz+omega[2]*cx-omega[0]*cz;
      localForce[2]-=alpha[0]*ry-alpha[1]*rx+omega[0]*cy-omega[1]*cx;
      inverseRotate(target,localForce[2],localForce[1],-localForce[0],options.frameQuaternion||IDENTITY);
      const blend=-Math.expm1(-dt/.045);for(let i=0;i<3;i++)force[i]+=(clamp(target[i],-40,40)-force[i])*blend;
      const rpm=clamp(finite(snapshot.engine?.rpm),0,8000),load=clamp(finite(snapshot.engine?.load),0,1);
      phase=(phase+dt*rpm/60*Math.PI*2)%(Math.PI*2);
      const vibration=rpm>100?Math.sin(phase)*(.0008+.0005*load):0;
      state.keyRoll+=(clamp(force[0]*.0005+vibration,-.012,.012)-state.keyRoll)*(-Math.expm1(-dt*70));
      state.keyPitch+=(clamp((force[1]+9.81)*.00015+vibration*.4,-.006,.006)-state.keyPitch)*(-Math.expm1(-dt*55));
      // Exact damped harmonic response to the effective gravity direction.
      const gravity=Math.max(2,-force[1]),frequency=Math.sqrt(gravity/clamp(finite(options.lengthM,.09),.045,.22));
      state.pitch=stepDampedSpring(spring,0,clamp(Math.atan2(-force[2],gravity),-.82,.82),dt,frequency,Math.min(1,2.75/frequency));
      state.roll=stepDampedSpring(spring,2,clamp(Math.atan2(force[0],gravity),-.82,.82),dt,frequency,Math.min(1,2.75/frequency));
      state.twist=stepDampedSpring(spring,4,clamp(-omega[1]*.07-force[0]*.004,-.2,.2),dt,Math.sqrt(90),4/Math.sqrt(90));
      for(let i=0;i<4;i+=2)if(Math.abs(spring[i])>.82){spring[i]=clamp(spring[i],-.82,.82);if(spring[i]*spring[i+1]>0)spring[i+1]*=-.12;}
      state.pitch=spring[0];state.roll=spring[2];state.twist=clamp(spring[4],-.28,.28);spring[4]=state.twist;
      previousPosition[0]=px;previousPosition[1]=py;previousPosition[2]=pz;
      previousVelocity[0]=vx;previousVelocity[1]=vy;previousVelocity[2]=vz;
      previousOmega[0]=wx;previousOmega[1]=wy;previousOmega[2]=wz;
      previousTime=time;state.updates++;return state;
    }
  };
}

