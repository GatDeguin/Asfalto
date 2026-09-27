import {stepDampedSpring} from '../render/cockpit-animator.mjs?v=1e70e16a21a9b8b3';
const DEG=Math.PI/180,EMPTY=Object.freeze({});
export const HEAD_MOTION_DEFAULTS=Object.freeze({enabled:true,intensity:1,responseSpeed:1,translationScale:1,rotationScale:1});
export const HEAD_MOTION_LIMITS=Object.freeze({translationM:Object.freeze([.035,.025,.045]),rotationRad:Object.freeze([2.5*DEG,1.5*DEG,1.5*DEG])});
const finite=(v,f=0)=>Number.isFinite(v)?v:f,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function sanitizeHeadMotionCalibration(v=EMPTY){v=v&&typeof v==='object'?v:EMPTY;return Object.freeze({enabled:typeof v.enabled==='boolean'?v.enabled:true,intensity:clamp(finite(v.intensity,1),0,2),responseSpeed:clamp(finite(v.responseSpeed,1),.25,3),translationScale:clamp(finite(v.translationScale,1),0,2),rotationScale:clamp(finite(v.rotationScale,1),0,2)});}
function rotation(out,q){let x=finite(q?.[0]),y=finite(q?.[1]),z=finite(q?.[2]),w=finite(q?.[3],1),n=Math.hypot(x,y,z,w)||1;out[0]=x/n;out[1]=y/n;out[2]=z/n;out[3]=w/n;}
function rotate(out,x,y,z,q){const tx=2*(q[1]*z-q[2]*y),ty=2*(q[2]*x-q[0]*z),tz=2*(q[0]*y-q[1]*x);out[0]=x+q[3]*tx+q[1]*tz-q[2]*ty;out[1]=y+q[3]*ty+q[2]*tx-q[0]*tz;out[2]=z+q[3]*tz+q[0]*ty-q[1]*tx;}
function compression(out,snapshot){
  out.fill(0);const wheels=snapshot?.wheels;if(!wheels)return;
  for(let i=0;i<wheels.length;i++){const w=wheels[i],index=w.id==='frontLeft'?0:w.id==='frontRight'?1:w.id==='rearLeft'?2:w.id==='rearRight'?3:-1;if(index>=0)out[index]=finite(w.compressionM);}
}
/** All update results are borrowed mutable views. Copy only when storing history. */
export function createCockpitHeadMotion(options=EMPTY){
  let calibration=sanitizeHeadMotionCalibration(options),mode='cockpit',disposed=false,initialized=false,clockTime=null,elapsedSeconds=0;
  const rest=new Float64Array(4),suspension=[0,0,0,0],springs=new Float64Array(12);
  const body=[0,0,0,1],inverseCamera=[0,0,0,1],forward=[0,0,0],up=[0,0,0],right=[0,0,0];
  const a=[0,0,0],w=[0,0,0],translationTarget=[0,0,0],rotationTarget=[0,0,0],position=[0,0,0],rv=[0,0,0],q=[0,0,0,1],inverse=[0,0,0,1],compensation=[0,0,0];
  const state={positionOffsetM:position,rotationVectorRad:rv,quaternion:q,compensationPositionM:compensation,compensationQuaternion:inverse,active:false,elapsedSeconds:0,source:{accelerationLocalMps2:a,angularVelocityLocalRadps:w,suspensionDeltaM:suspension}};
  function publishTransform(){
    const angle=Math.hypot(rv[0],rv[1],rv[2]),ratio=angle>1e-12?Math.sin(angle*.5)/angle:.5;
    q[0]=rv[0]*ratio;q[1]=rv[1]*ratio;q[2]=rv[2]*ratio;q[3]=Math.cos(angle*.5);
    inverse[0]=-q[0];inverse[1]=-q[1];inverse[2]=-q[2];inverse[3]=q[3];rotate(compensation,-position[0],-position[1],-position[2],inverse);
  }
  function reset(snapshot=null){
    springs.fill(0);position.fill(0);rv.fill(0);a.fill(0);w.fill(0);suspension.fill(0);publishTransform();
    initialized=!!snapshot?.chassis;compression(rest,snapshot);clockTime=Number.isFinite(snapshot?.timeSeconds)?snapshot.timeSeconds:null;elapsedSeconds=state.elapsedSeconds=0;state.active=false;return state;
  }
  function toCamera(target){
    const x=right[0]*target[0]+up[0]*target[1]-forward[0]*target[2],y=right[1]*target[0]+up[1]*target[1]-forward[1]*target[2],z=right[2]*target[0]+up[2]*target[1]-forward[2]*target[2];
    rotate(target,x,y,z,inverseCamera);
  }
  reset();
  return{
    update(snapshot,dt=1/60,context=EMPTY){
      const nextMode=context.mode??mode;if(nextMode!==mode){mode=nextMode;reset();}
      if(disposed||mode!=='cockpit'||!calibration.enabled||calibration.intensity===0||context.reducedMotion||!snapshot?.chassis)return reset();
      if(context.paused||finite(dt)<=0)return state;if(!initialized)return reset(snapshot);
      let step=finite(dt),time=Number.isFinite(snapshot.timeSeconds)?snapshot.timeSeconds:null;
      if(time!==null&&clockTime!==null){step=time-clockTime;if(step< -1e-8||step>.25)return reset(snapshot);if(step<=1e-8)return state;}
      if(step>.25)return reset(snapshot);clockTime=time;
      rotation(body,snapshot.chassis.rotation);rotate(forward,1,0,0,body);rotate(up,0,1,0,body);rotate(right,0,0,1,body);
      const av=snapshot.chassis.acceleration,wv=snapshot.chassis.angularVelocity;
      const ax=finite(av?.[0]),ay=finite(av?.[1]),az=finite(av?.[2]),wx=finite(wv?.[0]),wy=finite(wv?.[1]),wz=finite(wv?.[2]);
      a[0]=ax*right[0]+ay*right[1]+az*right[2];a[1]=ax*up[0]+ay*up[1]+az*up[2];a[2]=-ax*forward[0]-ay*forward[1]-az*forward[2];
      w[0]=wx*right[0]+wy*right[1]+wz*right[2];w[1]=wx*up[0]+wy*up[1]+wz*up[2];w[2]=-wx*forward[0]-wy*forward[1]-wz*forward[2];
      compression(suspension,snapshot);for(let i=0;i<4;i++)suspension[i]-=rest[i];
      const front=(suspension[0]+suspension[1])*.5,rear=(suspension[2]+suspension[3])*.5,left=(suspension[0]+suspension[2])*.5,rightCompression=(suspension[1]+suspension[3])*.5;
      translationTarget[0]=-a[0]*.0032;translationTarget[1]=-a[1]*.0015+(front+rear)*.05;translationTarget[2]=-a[2]*.004;
      rotationTarget[0]=-a[2]*.0035+(front-rear)*.35-w[0]*.012;rotationTarget[1]=-w[1]*.012;rotationTarget[2]=a[0]*.0025+(rightCompression-left)*.25-w[2]*.012;
      if(context.cameraWorldQuaternion){rotation(inverseCamera,context.cameraWorldQuaternion);inverseCamera[0]*=-1;inverseCamera[1]*=-1;inverseCamera[2]*=-1;toCamera(translationTarget);toCamera(rotationTarget);}
      for(let i=0;i<3;i++){
        const pl=HEAD_MOTION_LIMITS.translationM[i],rl=HEAD_MOTION_LIMITS.rotationRad[i];
        position[i]=stepDampedSpring(springs,i*2,clamp(translationTarget[i]*calibration.intensity*calibration.translationScale,-pl,pl),step,2*Math.PI*2.6*calibration.responseSpeed);
        rv[i]=stepDampedSpring(springs,6+i*2,clamp(rotationTarget[i]*calibration.intensity*calibration.rotationScale,-rl,rl),step,2*Math.PI*3*calibration.responseSpeed);
        if(Math.abs(position[i])>pl){position[i]=springs[i*2]=clamp(position[i],-pl,pl);if(springs[i*2+1]*position[i]>0)springs[i*2+1]=0;}
        if(Math.abs(rv[i])>rl){rv[i]=springs[6+i*2]=clamp(rv[i],-rl,rl);if(springs[7+i*2]*rv[i]>0)springs[7+i*2]=0;}
      }
      elapsedSeconds+=step;state.elapsedSeconds=elapsedSeconds;state.active=true;publishTransform();return state;
    },
    setCalibration(value=EMPTY){value=value&&typeof value==='object'?value:EMPTY;calibration=sanitizeHeadMotionCalibration(Object.keys(value).length?{...calibration,...value}:EMPTY);if(!calibration.enabled||calibration.intensity===0)reset();return{...calibration};},
    getCalibration:()=>({...calibration}),getState:()=>state,reset,
    diagnostics:()=>({calibration:{...calibration},mode,disposed,initialized,limits:HEAD_MOTION_LIMITS,state}),
    dispose(){disposed=true;reset();}
  };
}

