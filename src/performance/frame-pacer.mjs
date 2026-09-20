export function createFramePacer(){
 let deadline=null,last=null,target=null;
 function reset(){deadline=null;last=null;target=null;}
 function sample(now,fps=60){
  if(!Number.isFinite(now))throw new TypeError('Presentation timestamp must be finite');
  const nextTarget=fps===30?30:60,interval=1000/nextTarget;
  if(target!==nextTarget){deadline=null;last=null;target=nextTarget;}
  if(deadline!==null&&now+.5<deadline)return {render:false,intervalMs:null,targetFps:target};
  const elapsed=last===null?null:Math.max(0,now-last);last=now;
  deadline=deadline===null?now+interval:deadline+interval;
  if(deadline<=now+.5)deadline=now+interval;
  return {render:true,intervalMs:elapsed,targetFps:target};
 }
 return Object.freeze({sample,reset});
}
