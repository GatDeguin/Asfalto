const MODES=new Set(['off','position','low','high']);
const STORAGE_KEY='asfalto:nacional:v6:lights';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
export function createVehicleLightControl({storage}={}) {
 let automatic=true,position=0,beam='low',dimmer=.8,required=false;
 try {const saved=JSON.parse(storage?.getItem(STORAGE_KEY)||'null');if(saved){automatic=saved.automatic!==false;position=Math.round(clamp(saved.position,0,2));beam=saved.beam==='high'?'high':'low';dimmer=clamp(saved.dimmer,0,1);}}catch{}
 function persist(){try{storage?.setItem(STORAGE_KEY,JSON.stringify({automatic,position,beam,dimmer}));}catch{}}
 function getState(){const effectivePosition=automatic?(required?2:0):position;const mode=effectivePosition===0?'off':effectivePosition===1?'position':automatic?'low':beam;return {automatic,position:effectivePosition,beam:mode==='high'?'high':'low',mode,dimmer,instrumentPower:effectivePosition?dimmer:0,required};}
 return {getState,setEnvironment(value){required=!!value;return getState();},setAutomatic(value){if(automatic&&!value){const current=getState();position=current.position;beam=current.beam;}automatic=!!value;persist();return getState();},setPosition(value){automatic=false;position=Math.round(clamp(value,0,2));persist();return getState();},setMode(value){if(!MODES.has(value))throw new RangeError('Modo de luces inválido');automatic=false;position=value==='off'?0:value==='position'?1:2;if(position===2)beam=value;persist();return getState();},cycle(){const next=(getState().position+1)%3;automatic=false;position=next;persist();return getState();},toggleBeam(){const current=getState();automatic=false;position=2;beam=current.mode==='high'?'low':'high';persist();return getState();},setDimmer(value){dimmer=clamp(value,0,1);persist();return getState();}};
}
