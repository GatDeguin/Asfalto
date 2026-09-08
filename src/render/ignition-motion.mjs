const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
const vector=x=>[finite(x?.[0]),finite(x?.[1]),finite(x?.[2])];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function inverseRotate(v,q=[0,0,0,1]) {
  const norm=Math.hypot(...q)||1,x=-finite(q[0])/norm,y=-finite(q[1])/norm,z=-finite(q[2])/norm,w=finite(q[3],1)/norm;
  const t=cross([x,y,z],v).map(n=>2*n),u=cross([x,y,z],t);
  return v.map((n,i)=>n+w*t[i]+u[i]);
}

// A damped, two-axis pendulum driven by Rapier acceleration and gravity at the
// dashboard attachment. Chassis +X is forward/+Z right; cockpit +Z is rearward.
// Visual only: no impulses are fed back into the vehicle or saved editor poses.
export function createIgnitionMotion() {
  let previous=null,pitch=0,roll=0,pitchSpeed=0,rollSpeed=0,twist=0,twistSpeed=0;
  let keyRoll=0,keyPitch=0,phase=0,force=[0,-9.81,0],updates=0;
  let state;
  const publish=()=>state=Object.freeze({pitch,roll,twist,keyRoll,keyPitch,updates});
  function reset(){previous=null;pitch=roll=pitchSpeed=rollSpeed=twist=twistSpeed=keyRoll=keyPitch=phase=0;force=[0,-9.81,0];publish();}
  reset();
  return Object.freeze({
    reset,
    getState:()=>state,
    step(snapshot,{dt=1/60,paused=false,editing=false,reducedMotion=false,frameQuaternion=[0,0,0,1],lengthM=.09}={}){
      if(editing||reducedMotion){reset();return state;}
      if(paused||!snapshot?.chassis)return state;
      const body=snapshot.chassis,time=finite(snapshot.timeSeconds,NaN),position=vector(body.position),velocity=vector(body.linearVelocity),omega=vector(body.angularVelocity);
      const sample={time,position,velocity,omega};
      const elapsed=previous&&Number.isFinite(time)&&Number.isFinite(previous.time)?time-previous.time:dt;
      if(previous&&elapsed===0)return state;
      const jump=previous&&Math.hypot(...position.map((n,i)=>n-previous.position[i]))>5+Math.hypot(...velocity)*Math.max(0,elapsed)*3;
      if(!previous||elapsed<=0||elapsed>.2||jump){reset();previous=sample;return state;}
      const delta=clamp(elapsed,1/1000,1/15),rotation=body.rotation;
      const acceleration=Array.isArray(body.acceleration)?vector(body.acceleration):velocity.map((n,i)=>(n-previous.velocity[i])/delta);
      const alpha=omega.map((n,i)=>clamp((n-previous.omega[i])/delta,-35,35));
      const localOmega=inverseRotate(omega,rotation),localAlpha=inverseRotate(alpha,rotation);
      const localForce=inverseRotate(acceleration.map((n,i)=>(i===1?-9.81:0)-clamp(n,-45,45)),rotation);
      const anchor=[.45,.22,-.22],angularForce=cross(localAlpha,anchor),centripetal=cross(localOmega,cross(localOmega,anchor));
      for(let i=0;i<3;i++)localForce[i]-=angularForce[i]+centripetal[i];
      const target=inverseRotate([localForce[2],localForce[1],-localForce[0]],frameQuaternion);
      const smooth=1-Math.exp(-delta/0.045);
      for(let i=0;i<3;i++)force[i]+=(clamp(target[i],-40,40)-force[i])*smooth;
      const rpm=clamp(finite(snapshot.engine?.rpm),0,8000),load=clamp(finite(snapshot.engine?.load),0,1);
      // Engine rocking stays sub-degree; no free-floating translation at the blade tip.
      phase=(phase+delta*rpm/60*Math.PI*2)%(Math.PI*2);
      const vibration=rpm>100?Math.sin(phase)*(.0008+.0005*load):0;
      keyRoll+=(clamp(force[0]*.0005+vibration,-.012,.012)-keyRoll)*(1-Math.exp(-delta*70));
      keyPitch+=(clamp((force[1]+9.81)*.00015+vibration*.4,-.006,.006)-keyPitch)*(1-Math.exp(-delta*55));
      const steps=Math.max(1,Math.ceil(delta*240)),h=delta/steps,L=clamp(lengthM,.045,.22),limit=.82;
      for(let i=0;i<steps;i++){
        pitchSpeed+=((-force[2]*Math.cos(pitch)+force[1]*Math.sin(pitch))/L-5.5*pitchSpeed)*h;
        rollSpeed+=((force[0]*Math.cos(roll)+force[1]*Math.sin(roll))/L-5.5*rollSpeed)*h;
        pitch+=pitchSpeed*h;roll+=rollSpeed*h;
        if(Math.abs(pitch)>limit){pitch=clamp(pitch,-limit,limit);pitchSpeed*=-.12;}
        if(Math.abs(roll)>limit){roll=clamp(roll,-limit,limit);rollSpeed*=-.12;}
        const twistTarget=clamp(-localOmega[1]*.07-force[0]*.004,-.2,.2);
        twistSpeed+=((twistTarget-twist)*90-8*twistSpeed)*h;
        twist=clamp(twist+twistSpeed*h,-.28,.28);
      }
      previous=sample;updates++;return publish();
    },
  });
}
