const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));
const mix=(a,b,t)=>a+(b-a)*t;
/** Establishing shot; the car and saved cockpit transform never move. */
export function createRaceOpening({duration=7.5,fade=.4}={}){
 let shot=null,elapsed=Infinity,length=duration,cutAt=duration;
 function cancel(){shot=null;elapsed=Infinity;}
 function start(value,{reducedMotion=false,durationS=duration}={}){
  cancel();if(reducedMotion||!value||!vector(value.position)||!vector(value.target)||distance(value.position,value.target)<.1)return false;
  length=clamp(Number.isFinite(durationS)?durationS:duration,2,12);cutAt=length;
  const position=[...value.position],fov=clamp(Number.isFinite(value.fov)?value.fov:48,25,75);
  const positionEnd=vector(value.positionEnd)&&distance(value.positionEnd,value.target)>=.1?[...value.positionEnd]:position;
  shot={position,positionEnd,target:[...value.target],fov,fovEnd:clamp(Number.isFinite(value.fovEnd)?value.fovEnd:fov,25,75),sM:Number.isFinite(value.sM)?value.sM:0};
  elapsed=0;return true;
 }
 const blocks=()=>shot!==null&&elapsed<cutAt;
 const visible=()=>shot!==null&&elapsed<cutAt+fade;
 function snapshot(){
  const blocking=blocks(),active=visible();
  const opacity=!active?0:blocking?Math.max(1-clamp(elapsed/fade,0,1),clamp((elapsed-cutAt+fade)/fade,0,1)):1-clamp((elapsed-cutAt)/fade,0,1);
  let pose=null;
  if(blocking){
   const t=clamp(elapsed/length,0,1),eased=t*t*(3-2*t);
   pose={position:shot.position.map((value,i)=>mix(value,shot.positionEnd[i],eased)),target:shot.target,
    fov:mix(shot.fov,shot.fovEnd,eased),sM:shot.sM};
  }
  return {active,blocking,opacity,shot:pose,elapsed};
 }
 return {start,cancel,skip(){if(blocks())cutAt=Math.min(cutAt,elapsed+fade);},get blocking(){return blocks();},get active(){return visible();},
  diagnostics:snapshot,step(dt,{paused=false,reducedMotion=false}={}){
   if(reducedMotion)cancel();
   else if(!paused&&visible())elapsed+=clamp(Number.isFinite(dt)?dt:0,0,.1);
   return snapshot();
  }};
}
