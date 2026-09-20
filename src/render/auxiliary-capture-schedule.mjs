// Keep existing rates and normally render one auxiliary view per frame.
// Permit one overdue recovery view on slower devices without an unbounded burst.
export const AUXILIARY_CAPTURE_RATES=Object.freeze({cinematic:Object.freeze({water:15,center:24,left:18}),high:Object.freeze({water:15,center:24,left:18}),balanced:Object.freeze({water:10,center:15,left:12}),low:Object.freeze({water:6,center:8,left:6})});
export function createAuxiliaryCaptureSchedule(){
 const deadlines={water:null,center:null,left:null};let now=0,last=null,quality=null,rates=null,available=new Set(),planned=new Set(),used=0;
 function plan(){
  const due=[...available].filter(id=>deadlines[id]<=now+.01).sort((a,b)=>deadlines[a]-deadlines[b]);
  planned=new Set();if(due.length)planned.add(due[0]);
  if(due.length>1&&now-deadlines[due[1]]>=1000/rates[due[1]])planned.add(due[1]);
 }
 return {beginFrame(time,{quality:next='balanced',mirrors=true}={}){
  if(!Number.isFinite(time))throw new TypeError('Finite frame timestamp required');
  // Preserve relative deadlines across slow frames; resetting all of them would starve mirrors behind water.
  const reset=last===null||time<last||quality!==next;now=time;last=time;quality=next;rates=AUXILIARY_CAPTURE_RATES[next]||AUXILIARY_CAPTURE_RATES.balanced;
  available=new Set(mirrors?['water','center','left']:['water']);used=0;
  for(const id of Object.keys(deadlines)){if(reset||deadlines[id]===null)deadlines[id]=now;if(!available.has(id))deadlines[id]=now;}
  plan();
 },skip(id){available.delete(id);if(!used)plan();},take(id){
  if(used>=2||!planned.has(id))return false;
  planned.delete(id);used++;const period=1000/rates[id];deadlines[id]+=period;
  if(deadlines[id]<now-250)deadlines[id]=now;
  return true;
 }};
}
