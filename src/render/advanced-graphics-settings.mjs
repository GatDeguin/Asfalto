export const ADVANCED_GRAPHICS_KEY='asfalto-v6-advanced-graphics-v1';
export const DEFAULT_ADVANCED_GRAPHICS=Object.freeze({quality:'balanced',materials:true,gtao:true,ssgi:true,dfao:true,volumetrics:true,sky:true,pivotPainter:true,pdo:true});
const choices=['auto','high','balanced','low','off'];
export function normalizeAdvancedGraphics(value={}){const v=value&&typeof value==='object'?value:{};const out={quality:choices.includes(v.quality)?v.quality:DEFAULT_ADVANCED_GRAPHICS.quality};for(const key of Object.keys(DEFAULT_ADVANCED_GRAPHICS).slice(1))out[key]=typeof v[key]==='boolean'?v[key]:DEFAULT_ADVANCED_GRAPHICS[key];return out;}
export function readAdvancedGraphics(storage=globalThis.__asfaltoV7Storage){try{return normalizeAdvancedGraphics(JSON.parse(storage?.getItem(ADVANCED_GRAPHICS_KEY)||'{}'));}catch{return{...DEFAULT_ADVANCED_GRAPHICS};}}
export function effectiveGraphicsQuality(settings,governed='high'){const ranks={off:-1,low:0,balanced:1,high:2},requested=settings.quality==='auto'?'high':settings.quality,cap=Object.hasOwn(ranks,governed)?governed:'high';return ranks[requested]<=ranks[cap]?requested:cap;}
export function installAdvancedGraphicsSettings({root=document,storage=globalThis.__asfaltoV7Storage,getDiagnostics=()=>null}={}){
 let settings=readAdvancedGraphics(storage),disposed=false;const selectors=[...root.querySelectorAll('[data-advanced-graphics-quality]')],statuses=[...root.querySelectorAll('[data-advanced-graphics-status]')];let last='';
 function sync(){for(const s of selectors)s.value=settings.quality;}
 function setSettings(value){settings=normalizeAdvancedGraphics({...settings,...value});try{storage?.setItem(ADVANCED_GRAPHICS_KEY,JSON.stringify(settings));}catch{}sync();globalThis.dispatchEvent?.(new CustomEvent('asfalto:advanced-graphics',{detail:{...settings}}));refresh();return{...settings};}
 const change=e=>setSettings({quality:e.target.value});for(const s of selectors)s.addEventListener('change',change);
 function refresh(){
  if(disposed)return;const d=getDiagnostics(),quality=d?.effectiveQuality||settings.quality;
  const labels={auto:'Adaptativo',high:'Alto',balanced:'Equilibrado',low:'Bajo',off:'Apagado'},label=labels[quality]||quality;
  const text='Solicitado: '+labels[settings.quality]+' · Efectivo: '+label+(d?.targetFps?' · Objetivo '+d.targetFps+' FPS':'')+'.';
  if(text===last)return;last=text;for(const s of statuses)s.textContent=text;
  const adapted=quality!=='off'&&settings.quality!=='off'&&quality!==(settings.quality==='auto'?'high':settings.quality);
  globalThis.__asfaltoV7Experience?.setQuality?.({label:label+' · adaptativo',reason:'Nivel solicitado: '+labels[settings.quality],visible:adapted});
 }

 sync();refresh();return{getSettings:()=>({...settings}),setSettings,setMode:quality=>setSettings({quality}),refresh,dispose(){if(disposed)return;disposed=true;for(const s of selectors)s.removeEventListener('change',change);}};
}
