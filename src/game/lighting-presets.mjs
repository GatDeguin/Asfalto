const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safeId=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,95}$/i.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const number=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new RangeError('Valor de iluminación fuera de rango');return v;};
const bool=v=>{if(typeof v!=='boolean')throw new TypeError('Se esperaba una opción activada/desactivada');return v;};
const color=v=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw new TypeError('Color inválido');return v.toLowerCase();};
const vector=(v,min,max)=>{if(!Array.isArray(v)||v.length!==3)throw new TypeError('Se esperaba un vector de tres números');return v.map(n=>number(n,min,max));};
const fields={
 hdri:{backgroundIntensity:[0,20],environmentIntensity:[0,20],exposure:[.001,16],backgroundBlurriness:[0,1],rotation:v=>vector(v,-180,180),environmentRotation:v=>vector(v,-180,180)},
 light:{enabled:bool,intensity:[0,100000],color,groundColor:color,position:v=>vector(v,-100000,100000),target:v=>vector(v,-100000,100000),castShadow:bool,shadowBias:[-.05,.05],shadowNormalBias:[0,2],distance:[0,2000],decay:[0,4],angleDeg:[1,89],penumbra:[0,1]},
 vehicle:{enabled:bool,intensityScale:[0,5],color,distanceScale:[.1,3],angleDeg:[1,80],penumbra:[0,1],decay:[0,4],castShadow:bool,aimHorizontalDeg:[-30,30],aimVerticalDeg:[-20,20]},
 fog:{color,density:[0,.02]},
 lut:{lutId:v=>{if(!safeId(v))throw new TypeError('LUT inválido');return v;},intensity:[0,1],contrast:[0,2],saturation:[0,2],temperature:[-1,1],tint:[-1,1]},
};
function group(value,kind){if(!record(value))throw new TypeError('Configuración inválida');const out={};for(const [key,v]of Object.entries(value)){const schema=fields[kind][key];if(!schema)throw new TypeError('Parámetro de iluminación desconocido: '+key);out[key]=typeof schema==='function'?schema(v):number(v,...schema);}return out;}
export function lightingPresetKey(context){if(!record(context)||!['trackId','skyId','weather'].every(k=>safeId(context[k])))throw new TypeError('Circuito, HDRI o clima inválido');return [context.trackId,context.skyId,context.weather].join('|');}
export function sanitizeLightingOverrides(value){if(!record(value))throw new TypeError('Configuración inválida');const out={};for(const[key,v]of Object.entries(value)){
 if(['hdri','fog','lut'].includes(key))out[key]=group(v,key);
 else if(key==='lights'||key==='vehicles'){if(!record(v)||Object.keys(v).length>32)throw new TypeError('Lista de luces inválida');out[key]={};for(const[id,entry]of Object.entries(v)){if(!safeId(id)||(key==='vehicles'&&!['player','rival'].includes(id)))throw new TypeError('Luz inválida');out[key][id]=group(entry,key==='lights'?'light':'vehicle');}}
 else throw new TypeError('Grupo de iluminación desconocido: '+key);
 }return out;
}
export function validateLightingEntry(value){lightingPresetKey(value?.context);if(typeof value.updatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt)||!Number.isFinite(Date.parse(value.updatedAt)))throw new TypeError('Fecha de guardado inválida');return {context:Object.fromEntries(['trackId','skyId','weather'].map(k=>[k,value.context[k]])),updatedAt:value.updatedAt,values:sanitizeLightingOverrides(value.values)};}
export const LUT_DEFAULTS=Object.freeze({lutId:'none',intensity:1,contrast:1,saturation:1,temperature:0,tint:0});
