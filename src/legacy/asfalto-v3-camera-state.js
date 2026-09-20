
(function(root){
'use strict';
const modes=Object.freeze(['cockpit','chase','hood','cinematic']);
function normalize(value){return modes.includes(value)?value:'cockpit';}
function create(initial='cockpit'){
 let current=normalize(initial);
 const listeners=new Set();
 function publish(previous){if(previous===current)return;for(const listener of listeners)listener(current,previous);}
 return Object.freeze({
  get current(){return current;},
  get modes(){return modes;},
  set(value){const previous=current;current=normalize(value);publish(previous);return current;},
  next(){const previous=current;current=modes[(modes.indexOf(current)+1)%modes.length];publish(previous);return current;},
  subscribe(listener){if(typeof listener!=='function')throw new TypeError('camera listener debe ser una funcion');listeners.add(listener);return()=>listeners.delete(listener);}
 });
}
root.AsfaltoV3CameraState=Object.freeze({modes,create});
})(globalThis);
