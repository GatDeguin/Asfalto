import {GRAPHICS_QUALITY_LABELS,GRAPHICS_QUALITY_RANKS} from './graphics-quality-policy.mjs';
export const ADVANCED_GRAPHICS_KEY='asfalto-v6-advanced-graphics-v1';
export const DEFAULT_ADVANCED_GRAPHICS=Object.freeze({quality:'balanced',materials:true,gtao:true,ssgi:true,dfao:true,volumetrics:true,sky:true,pivotPainter:true,pdo:true});
const choices=Object.keys(GRAPHICS_QUALITY_LABELS);
const owners=new WeakMap();
export function normalizeAdvancedGraphics(value={}){const v=value&&typeof value==='object'?value:{};const out={quality:choices.includes(v.quality)?v.quality:DEFAULT_ADVANCED_GRAPHICS.quality};for(const key of Object.keys(DEFAULT_ADVANCED_GRAPHICS).slice(1))out[key]=typeof v[key]==='boolean'?v[key]:DEFAULT_ADVANCED_GRAPHICS[key];return out;}
export function readAdvancedGraphics(storage=globalThis.__asfaltoV7Storage){try{return normalizeAdvancedGraphics(JSON.parse(storage?.getItem(ADVANCED_GRAPHICS_KEY)||'{}'));}catch{return{...DEFAULT_ADVANCED_GRAPHICS};}}
export function effectiveGraphicsQuality(settings,governed='high'){const ranks=GRAPHICS_QUALITY_RANKS,normalized=normalizeAdvancedGraphics(settings),requested=normalized.quality==='auto'?'high':normalized.quality,cap=Object.hasOwn(ranks,governed)?governed:'high';return ranks[requested]<=ranks[cap]?requested:cap;}
export function installAdvancedGraphicsSettings({root=document,storage=globalThis.__asfaltoV7Storage,getDiagnostics=()=>null}={}){
 const existing=owners.get(root);if(existing){existing.setDiagnosticsProvider(getDiagnostics);return existing;}
 let settings=readAdvancedGraphics(storage),disposed=false;const selectors=[...root.querySelectorAll('[data-advanced-graphics-quality]')],statuses=[...root.querySelectorAll('[data-advanced-graphics-status]')];let last='';
 function sync(){for(const s of selectors)s.value=settings.quality;}
 function setSettings(value){if(disposed)return{...settings};settings=normalizeAdvancedGraphics({...settings,...value});try{storage?.setItem(ADVANCED_GRAPHICS_KEY,JSON.stringify(settings));}catch{}sync();globalThis.dispatchEvent?.(new CustomEvent('asfalto:advanced-graphics',{detail:{...settings}}));refresh();return{...settings};}
 const change=e=>setSettings({quality:e.target.value});for(const s of selectors)s.addEventListener('change',change);
 function refresh(){
  if(disposed)return;const d=getDiagnostics(),quality=d?.effectiveQuality||settings.quality;
  const labels=GRAPHICS_QUALITY_LABELS,label=labels[quality]||quality;
  const text='Solicitado: '+labels[settings.quality]+' · Efectivo: '+label+(d?.targetFps?' · Objetivo '+d.targetFps+' FPS':'')+(d?.reductionReason?' · '+d.reductionReason:'')+'.';
  if(text===last)return;last=text;for(const s of statuses)s.textContent=text;
  const adapted=quality!=='off'&&settings.quality!=='off'&&quality!==(settings.quality==='auto'?'high':settings.quality);
  globalThis.__asfaltoV7Experience?.setQuality?.({label:label+' · adaptativo',reason:'Nivel solicitado: '+labels[settings.quality],visible:adapted});
 }

 const api={getSettings:()=>({...settings}),setSettings,setMode:quality=>setSettings({quality}),refresh,setDiagnosticsProvider(provider){if(disposed)return;getDiagnostics=typeof provider==='function'?provider:()=>null;refresh();},dispose(){if(disposed)return;disposed=true;owners.delete(root);for(const s of selectors)s.removeEventListener('change',change);}};
 owners.set(root,api);sync();refresh();return api;
}

// This module is a deferred dependency of the active module-02 entry. Bind its
// existing DOM selector before any awaited 3D/cockpit preparation, without loading
// Three or changing preferences. The later race installation reuses the owner.
export function bootAdvancedGraphicsSettings({root=globalThis.document,host=globalThis}={}){
 if(!root?.querySelectorAll||host.__asfaltoAdvancedGraphics)return null;
 const active=()=>host.__chevyV6Complete?.workshop?.advancedGraphics;
 const settings=installAdvancedGraphicsSettings({root,storage:host.__asfaltoV7Storage,getDiagnostics:()=>{const graphics=active();return graphics?.getEffectiveQuality?{effectiveQuality:graphics.getEffectiveQuality()}:graphics?.diagnostics()||null;}});
 const facade={getSettings:settings.getSettings,setSettings:settings.setSettings,setMode:settings.setMode,refreshStatus:settings.refresh,diagnostics:()=>active()?.diagnostics()||null,refresh:()=>active()?.refresh()};
 host.__asfaltoAdvancedGraphics=facade;
 const dispose=()=>{settings.dispose();if(host.__asfaltoAdvancedGraphics===facade)delete host.__asfaltoAdvancedGraphics;host.removeEventListener?.('pagehide',pagehide);};
 const pagehide=event=>{if(!event.persisted)dispose();};host.addEventListener?.('pagehide',pagehide);
 return{...settings,dispose};
}
if(globalThis.document?.querySelector?.('[data-advanced-graphics-quality]'))bootAdvancedGraphicsSettings();
