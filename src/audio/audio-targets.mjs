/** Do not append identical targets every animation frame. Clear after explicit silence. */
export function createAudioTargets(context){
 let previous=new WeakMap();
 return {target(param,value,tau=.04){const last=previous.get(param);if(last?.value===value&&last.tau===tau)return;previous.set(param,{value,tau});param.setTargetAtTime(value,context.currentTime,tau);},clear(){previous=new WeakMap();}};
}
