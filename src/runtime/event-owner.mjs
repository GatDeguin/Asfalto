/** Scene-owned listeners. Disposal is idempotent and does not retain handlers. */
export function createEventOwner(){
 const disposers=new Set();let disposed=false;
 return {listen(target,type,handler,options){
  if(disposed)throw new Error('Event owner disposed');
  target.addEventListener(type,handler,options);
  const remove=()=>{target.removeEventListener(type,handler,options);disposers.delete(remove);};
  disposers.add(remove);return remove;
 },dispose(){if(disposed)return;disposed=true;for(const remove of [...disposers])remove();},diagnostics:()=>({disposed,listeners:disposers.size})};
}
