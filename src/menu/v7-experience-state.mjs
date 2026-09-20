/** Experience phases own cancellation only; the 120 Hz simulation remains the clock owner. */
const phases=new Set(['workshop','loading','opening','driving','paused','editor','results','closed']);
export function createExperienceFlow({onChange=()=>{},onError=()=>{}}={}) {
 let phase='workshop',hidden=false,epoch=0,disposed=false,controller=null,resources=new Set();
 const snapshot=()=>Object.freeze({phase,hidden,epoch,drivingInput:!hidden&&phase==='driving',raceAudio:!hidden&&phase==='driving',menuAudio:!hidden&&phase==='workshop'});
 const publish=()=>onChange(snapshot());
 function release(){controller?.abort();controller=null;const old=resources;resources=new Set();for(const fn of old)try{fn();}catch(error){onError(error);}}
 function begin(next){if(!phases.has(next))throw new TypeError('Unknown experience phase');if(disposed)throw new Error('Experience disposed');release();phase=next;const ticket=++epoch;controller=new AbortController();const signal=controller.signal;publish();
  return Object.freeze({signal,isCurrent:()=>!disposed&&epoch===ticket,own(fn){if(typeof fn!=='function')throw new TypeError('Cleanup must be a function');if(disposed||epoch!==ticket){fn();return()=>{};}resources.add(fn);return()=>resources.delete(fn);},commit(value){if(disposed||epoch!==ticket)return false;if(!phases.has(value))throw new TypeError('Unknown experience phase');phase=value;publish();return true;}});
 }
 return {begin,get state(){return snapshot();},setHidden(value){hidden=!!value;publish();},dispose(){if(disposed)return;disposed=true;release();epoch++;phase='closed';publish();}};
}
export function inputIsEditing(target){return !!(target&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY','A'].includes(target.tagName)||target.closest?.('[role="dialog"],[contenteditable="true"],[data-v7-no-drive]')));}
const number=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export function activityHud({enabled=false,activity='free',speedMps=0,gear='N',alerts=[]}={}){return{compact:!!enabled,speedKph:Math.round(Math.abs(number(speedMps))*3.6),gear:String(gear===0?'N':gear===-1?'R':gear),showTiming:!['free','practice','journey'].includes(activity),alerts:[...new Set(alerts.filter(x=>typeof x==='string'&&x))].slice(0,3)};}
export function resultSummary({activeSeconds,penaltySeconds,valid,reason='',progress=''}={}){const active=Number.isFinite(activeSeconds)?Math.max(0,activeSeconds):null,penalty=Number.isFinite(penaltySeconds)?Math.max(0,penaltySeconds):null;return {activeSeconds:active,penaltySeconds:penalty,totalSeconds:active!==null&&penalty!==null?active+penalty:null,validity:valid===true?'Válida':valid===false?'No válida':'Sin validar',reason:String(reason),progress:String(progress)};}
