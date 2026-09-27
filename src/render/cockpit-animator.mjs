const EMPTY=Object.freeze({});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
/** Exact solution for a constant target over dt. Handles under/critical damping.
 * state = [position, velocity] pairs, allocated once by the owner.
 */
export function stepDampedSpring(state,index,target,dt,omega,damping=1){
  if(!(dt>0)||!(omega>0))return state[index];
  const y=state[index]-target,v=state[index+1],z=clamp(damping,0,1);
  let next,velocity;
  if(z>.9999){
    const c=v+omega*y,e=Math.exp(-omega*dt);
    next=(y+c*dt)*e;velocity=(v-omega*c*dt)*e;
  }else{
    const a=z*omega,w=omega*Math.sqrt(1-z*z),c=Math.cos(w*dt),s=Math.sin(w*dt),e=Math.exp(-a*dt),b=(v+a*y)/w;
    next=e*(y*c+b*s);velocity=e*(-a*(y*c+b*s)-y*w*s+b*w*c);
  }
  state[index]=target+next;state[index+1]=velocity;return state[index];
}
export function smoothAnalog(current,target,response,dt){
  // Math.lerp is not standard JavaScript; equivalent frame-rate independent lerp.
  return current+(target-current)*(-Math.expm1(-Math.max(0,dt)*response));
}
/** Cache nodes/bindings once, feed controls from pointer event handlers.
 * Wheel/gear meshes must be motion pivots below authored/editor transforms.
 * cameraRoot must likewise be a dedicated motion child of the physical base pose.
 */
export function createCockpitAnimator(T,{
  wheel=null,gear=null,key=null,keychain=null,cameraRoot=null,needles=[],
  steeringRadians=7.85,gearPitch=.22,gearYaw=.18,pendulumLength=.09
}={}){
  const wheelBase=wheel?.quaternion.clone(),gearBase=gear?.quaternion.clone();
  const keyBase=key?.quaternion.clone(),chainBase=keychain?.quaternion.clone();
  const cameraBase=cameraRoot?.quaternion.clone(),cameraPosition=cameraRoot?.position.clone();
  const TEMP_VEC3=new T.Vector3(),LOCAL_FORCE=new T.Vector3(),OMEGA=new T.Vector3(),ALPHA=new T.Vector3();
  const ANCHOR=new T.Vector3(.45,.22,-.22),CROSS=new T.Vector3(),ANGULAR=new T.Vector3();
  const INVERSE=new T.Quaternion(),QX=new T.Quaternion(),QY=new T.Quaternion(),QZ=new T.Quaternion();
  const AXIS_X=new T.Vector3(1,0,0),AXIS_Y=new T.Vector3(0,1,0),AXIS_Z=new T.Vector3(0,0,1);
  const springs=new Float64Array(18),previousOmega=new T.Vector3();
  const bindings=needles.map(binding=>({...binding,base:binding.node.quaternion.clone(),axis:(binding.axis||AXIS_Z).clone().normalize(),reading:finite(binding.initial),response:finite(binding.response,14)}));
  let steer=0,gateX=0,gateY=0,initialized=false,disposed=false,lastTime=NaN;
  function rotate(node,base,x,y,z){
    if(!node)return;
    QX.setFromAxisAngle(AXIS_X,x);QY.setFromAxisAngle(AXIS_Y,y);QZ.setFromAxisAngle(AXIS_Z,z);
    node.quaternion.copy(base).multiply(QX).multiply(QY).multiply(QZ);
  }
  function reset(){
    springs.fill(0);initialized=false;lastTime=NaN;previousOmega.set(0,0,0);
    if(key)key.quaternion.copy(keyBase);if(keychain)keychain.quaternion.copy(chainBase);
    if(cameraRoot){cameraRoot.position.copy(cameraPosition);cameraRoot.quaternion.copy(cameraBase);}
  }
  function vector(out,values){return out.set(finite(values?.[0]??values?.x),finite(values?.[1]??values?.y),finite(values?.[2]??values?.z));}
  return{
    setSteering(value){steer=clamp(finite(value),-1,1);},
    /** H gate comes from interaction/physics; animation never changes actual gear. */
    setGate(x,y){gateX=clamp(finite(x),-1,1);gateY=clamp(finite(y),-1,1);},
    update(snapshot,dt,context=EMPTY){
      if(disposed||context.paused)return;
      dt=finite(dt);if(dt<=0)return;
      if(dt>.2||context.reset){reset();dt=Math.min(dt,1/60);}
      rotate(wheel,wheelBase,0,0,-steer*steeringRadians);
      rotate(gear,gearBase,gateY*gearPitch,0,-gateX*gearYaw);
      const body=snapshot?.chassis;
      if(body&&!context.reducedMotion){
        const q=body.rotation;
        INVERSE.set(finite(q?.[0]),finite(q?.[1]),finite(q?.[2]),finite(q?.[3],1)).normalize().invert();
        vector(OMEGA,body.angularVelocity);
        if(initialized)ALPHA.copy(OMEGA).sub(previousOmega).multiplyScalar(1/dt);else ALPHA.set(0,0,0);
        previousOmega.copy(OMEGA);OMEGA.applyQuaternion(INVERSE);ALPHA.applyQuaternion(INVERSE);
        // Effective gravity at dashboard anchor: g-a-alpha×r-omega×(omega×r).
        vector(LOCAL_FORCE,body.acceleration).multiplyScalar(-1);LOCAL_FORCE.y-=9.81;LOCAL_FORCE.applyQuaternion(INVERSE);
        CROSS.crossVectors(OMEGA,ANCHOR);ANGULAR.crossVectors(OMEGA,CROSS);
        CROSS.crossVectors(ALPHA,ANCHOR);LOCAL_FORCE.sub(CROSS).sub(ANGULAR);
        const down=Math.max(2,-LOCAL_FORCE.y),frequency=Math.sqrt(9.81/clamp(pendulumLength,.04,.3));
        // Pendulum rest points along -Y: +Z force needs -X rotation; +X needs +Z.
        const pitch=stepDampedSpring(springs,0,clamp(Math.atan2(-LOCAL_FORCE.z,down),-.8,.8),dt,frequency,.28);
        const roll=stepDampedSpring(springs,2,clamp(Math.atan2(LOCAL_FORCE.x,down),-.8,.8),dt,frequency,.28);
        const twist=stepDampedSpring(springs,4,clamp(-OMEGA.y*.07,-.2,.2),dt,9,.6);
        rotate(keychain,chainBase,pitch,twist,roll);
        rotate(key,keyBase,clamp(pitch*.02,-.012,.012),0,clamp(roll*.02,-.012,.012));
        vector(TEMP_VEC3,body.acceleration).applyQuaternion(INVERSE);
        const x=stepDampedSpring(springs,6,clamp(-TEMP_VEC3.z*.0032,-.035,.035),dt,16.3);
        const y=stepDampedSpring(springs,8,clamp(-TEMP_VEC3.y*.0015,-.025,.025),dt,16.3);
        const z=stepDampedSpring(springs,10,clamp(TEMP_VEC3.x*.004,-.045,.045),dt,16.3);
        const rx=stepDampedSpring(springs,12,clamp(TEMP_VEC3.x*.0035,-.044,.044),dt,18.85);
        const ry=stepDampedSpring(springs,14,clamp(-OMEGA.y*.012,-.026,.026),dt,18.85);
        const rz=stepDampedSpring(springs,16,clamp(TEMP_VEC3.z*.0025,-.026,.026),dt,18.85);
        if(cameraRoot){cameraRoot.position.copy(cameraPosition);cameraRoot.position.x+=x;cameraRoot.position.y+=y;cameraRoot.position.z+=z;rotate(cameraRoot,cameraBase,rx,ry,rz);}
        initialized=true;lastTime=snapshot.timeSeconds;
      }else if(context.reducedMotion)reset();
      for(let i=0;i<bindings.length;i++){
        const b=bindings[i];
        let value=b.channel==='rpm'?snapshot?.engine?.rpm:b.channel==='speedKmh'?Math.hypot(finite(body?.linearVelocity?.[0]),finite(body?.linearVelocity?.[1]),finite(body?.linearVelocity?.[2]))*3.6:snapshot?.engine?.[b.channel];
        value=clamp(finite(value,b.reading),b.min,b.max);
        b.reading=smoothAnalog(b.reading,value,b.response,dt);
        const angle=b.angleMin+(b.angleMax-b.angleMin)*(b.reading-b.min)/Math.max(1e-9,b.max-b.min);
        QZ.setFromAxisAngle(b.axis,angle);b.node.quaternion.copy(b.base).multiply(QZ);
      }
    },
    reset,
    dispose(){if(disposed)return;reset();disposed=true;},
    // An explicit copy is appropriate only for diagnostics, outside update().
    getState:()=>({steer,gateX,gateY,lastTime,springs:Array.from(springs)})
  };
}

