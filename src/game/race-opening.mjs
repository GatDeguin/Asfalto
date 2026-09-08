const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
/** Establishing shot; the car and saved cockpit transform never move. */
export function createRaceOpening({duration=7.5,fade=.4}={}){
 let shot=null,elapsed=Infinity,length=duration;
 function cancel(){shot=null;elapsed=Infinity;}
 function start(value,{reducedMotion=false,durationS=duration}={}){
  cancel();if(reducedMotion||!value||!vector(value.position)||!vector(value.target)||Math.hypot(...value.position.map((v,i)=>v-value.target[i]))<.1)return false;
  length=clamp(Number.isFinite(durationS)?durationS:duration,2,12);shot={position:[...value.position],target:[...value.target],fov:clamp(Number.isFinite(value.fov)?value.fov:48,25,75),sM:Number.isFinite(value.sM)?value.sM:0};elapsed=0;return true;
 }
 function snapshot(){const blocking=Boolean(shot)&&elapsed<length,active=Boolean(shot)&&elapsed<length+fade;
  const opacity=!active?0:blocking?Math.max(1-clamp(elapsed/fade,0,1),clamp((elapsed-length+fade)/fade,0,1)):1-clamp((elapsed-length)/fade,0,1);
  return {active,blocking,opacity,shot:blocking?shot:null,elapsed};
 }
 return {start,cancel,skip(){if(shot)elapsed=Math.max(elapsed,length-fade);},get blocking(){return snapshot().blocking;},get active(){return snapshot().active;},diagnostics:snapshot,step(dt,{paused=false}={}){if(!paused&&Number.isFinite(elapsed))elapsed+=clamp(Number.isFinite(dt)?dt:0,0,.1);return snapshot();}};
}
