// One physical context; view facades own all mutable renderer state. No transaction crosses await.
import {retainVehicleResources} from '../render/vehicle-resource-pool.mjs?v=564628ad31eed1e7';
const hosts=new WeakMap();
const scalar=['autoClear','autoClearColor','autoClearDepth','autoClearStencil','outputColorSpace','toneMapping','toneMappingExposure','localClippingEnabled','clippingPlanes','transmissionResolutionScale','sortObjects'];
const nested={shadowMap:['enabled','type','autoUpdate','needsUpdate'],xr:['enabled'],info:['autoReset']};
export function getRenderHost(T,{canvas,rendererFactory=options=>new T.WebGLRenderer(options)}={}){
 if(hosts.has(T))return hosts.get(T);
 const raw=rendererFactory({canvas,alpha:true,logarithmicDepthBuffer:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
 const home={parent:raw.domElement.parentNode,next:raw.domElement.nextSibling};
 let active=null,current=null,epoch=0,lost=false,closed=false,pending=0;
 const views=new Map(),native={};for(const key of Object.keys(raw))if(typeof raw[key]==='function')native[key]=raw[key];
 const invoke=(key,args=[])=>native[key]?native[key].apply(raw,args):raw[key](...args);
 function snapshot(){const s={};for(const k of scalar)s[k]=raw[k];for(const [k,keys]of Object.entries(nested))s[k]=Object.fromEntries(keys.map(p=>[p,raw[k]?.[p]]));s.clear=raw.getClearColor(new T.Color()).clone();s.alpha=raw.getClearAlpha();s.target=raw.getRenderTarget();s.face=raw.getActiveCubeFace?.()||0;s.mip=raw.getActiveMipmapLevel?.()||0;s.viewport=raw.getViewport(new T.Vector4()).clone();s.scissor=raw.getScissor(new T.Vector4()).clone();s.scissorTest=raw.getScissorTest();s.physical=raw.getCurrentViewport?.(new T.Vector4()).clone();s.size=raw.getSize(new T.Vector2()).clone();s.dpr=raw.getPixelRatio();s.methods={renderBufferDirect:raw.renderBufferDirect,setRenderTarget:raw.setRenderTarget};return s;}
 function apply(s,resize=false){for(const k of scalar)raw[k]=s[k];for(const[k,keys]of Object.entries(nested))for(const p of keys)if(raw[k])raw[k][p]=s[k][p];if(resize){if(raw.getPixelRatio()!==s.dpr)invoke('setPixelRatio',[s.dpr]);const size=raw.getSize(new T.Vector2());if(size.x!==s.size.x||size.y!==s.size.y)invoke('setSize',[s.size.x,s.size.y,false]);}invoke('setClearColor',[s.clear,s.alpha]);invoke('setRenderTarget',[s.target,s.face,s.mip]);invoke('setViewport',[s.viewport]);invoke('setScissor',[s.scissor]);invoke('setScissorTest',[s.scissorTest]);if(s.physical)raw.state?.viewport?.(s.physical);for(const[k,v]of Object.entries(s.methods))raw[k]=v;}
 const initial=snapshot();
 function run(view,fn){if(closed||view.released)throw Error('Renderer view released: '+view.id);if(current===view||active===view&&!current)return fn();const before=snapshot(),prior=current;if(active&&!current)active.state=before;current=view;apply(view.state);try{return fn();}finally{const size=view.state.size,dpr=view.state.dpr;view.state=snapshot();view.state.size=size;view.state.dpr=dpr;current=prior;apply(before);}}
 function acquireView(id,{container,getDimensions,onSuspend,onActivate,onContextLost,onContextRestored}={}){
  if(views.has(id))throw Error('Duplicate renderer view: '+id);
  const view={id,state:{...initial,shadowMap:{...initial.shadowMap},xr:{...initial.xr},info:{...initial.info},methods:{...initial.methods}},released:false,container,getDimensions,onSuspend,onActivate,onContextLost,onContextRestored,pending:0,scratch:null};
  const wrappers=new Map(),nestedProxies={};
  const stateProxyCache=new WeakMap();const wrapState=target=>{if(stateProxyCache.has(target))return stateProxyCache.get(target);const proxy=new Proxy(target,{get(object,key){const value=object[key];if(typeof value==='function')return(...args)=>run(view,()=>value.apply(object,args));if(value&&typeof value==='object')return wrapState(value);return value;},set(object,key,value){return run(view,()=>Reflect.set(object,key,value));}});stateProxyCache.set(target,proxy);return proxy;};
  const state=()=>current===view||active===view&&!current?raw:view.state;
  for(const key of Object.keys(nested))nestedProxies[key]=new Proxy(raw[key],{get(_target,p){const live=raw[key];if(nested[key].includes(p))return state()[key][p];const v=live[p];return typeof v==='function'?v.bind(live):v;},set(_target,p,v){const live=raw[key];if(nested[key].includes(p)){view.state[key][p]=v;if(current===view||active===view&&!current)live[p]=v;}else live[p]=v;return true;}});
  const facade=new Proxy(raw,{get(target,key){
   if(key==='__renderHost')return host;if(key==='__renderView')return lease;if(key==='__rawRenderer')return raw;if(key==='state')return wrapState(raw.state);
   if(key==='dispose')return lease.release;if(key==='forceContextLoss'||key==='forceContextRestore')return ()=>{throw Error('Context lifetime belongs to render host');};
   if(nestedProxies[key])return nestedProxies[key];if(scalar.includes(key))return state()[key];
   if(typeof target[key]!=='function')return target[key];
   if(view.state.methods[key]&&view.state.methods[key]!==native[key])return view.state.methods[key];
   if(!wrappers.has(key))wrappers.set(key,function(...args){
    if(key==='getContext'||key==='getContextAttributes')return invoke(key,args);
    if(key==='getSize')return args[0].copy(current===view||active===view?raw.getSize(new T.Vector2()):view.state.size);
    if(key==='getDrawingBufferSize')return args[0].copy(view.state.size).multiplyScalar(view.state.dpr).floor();
    if(key==='getPixelRatio')return active===view?raw.getPixelRatio():view.state.dpr;
    if(key==='setSize'||key==='setPixelRatio'){if(key==='setSize')view.state.size=new T.Vector2(args[0],args[1]);else view.state.dpr=args[0];view.state.viewport=new T.Vector4(0,0,view.state.size.x,view.state.size.y);if(active===view&&!current)return invoke(key,key==='setSize'?[args[0],args[1],false]:args);return;}
    if(key==='compileAsync'){const startedEpoch=epoch;const release=retainVehicleResources(args[0]);pending++;view.pending++;let result;try{result=run(view,()=>invoke(key,args));}catch(error){release();pending--;view.pending--;throw error;}return Promise.resolve(result).then(value=>{if(startedEpoch!==epoch)throw new DOMException('Context epoch changed','AbortError');return value;}).finally(()=>{release();pending--;view.pending--;cleanup(view);});}
    return run(view,()=>{
     // Inactive PMREM/probe/priming continuations are allowed, but never touch the visible backbuffer.
     if(['render','clear','clearColor','clearDepth','clearStencil'].includes(key)&&active!==view&&!raw.getRenderTarget()){
      if(!view.scratch)view.scratch=new T.WebGLRenderTarget(Math.max(1,view.state.size.x*view.state.dpr),Math.max(1,view.state.size.y*view.state.dpr));
      invoke('setRenderTarget',[view.scratch]);try{return invoke(key,args);}finally{invoke('setRenderTarget',[null]);}
     }
     return invoke(key,args);
    });
   });return wrappers.get(key);
  },set(target,key,value){if(scalar.includes(key)){view.state[key]=value;if(current===view||active===view&&!current)target[key]=value;}else if(typeof value==='function'){view.state.methods[key]=value;if(current===view||active===view&&!current)target[key]=value;}else target[key]=value;return true;}});
  function cleanup(v){if(v.released&&!v.pending){v.scratch?.dispose();v.scratch=null;if(views.get(v.id)===v)views.delete(v.id);}}
  const lease={renderer:facade,id,isActive:()=>active===view&&!lost&&!closed&&!view.released,withState:fn=>run(view,fn),frame:fn=>lease.isActive()?run(view,fn):false,
   activate(){if(view.released||lost||closed)return false;if(active===view)return true;if(active){active.onSuspend?.();active.state=snapshot();}active=view;const mount=id==='workshop'?home.parent:(container||home.parent);if(mount){if(id==='workshop'&&home.next?.parentNode===mount)mount.insertBefore(raw.domElement,home.next);else mount.appendChild(raw.domElement);}raw.domElement.dataset.renderOwner=id;raw.domElement.setAttribute?.('aria-label',id==='workshop'?'Taller interactivo en 3D':'Cockpit Chevy interactivo en 3D');raw.domElement.classList?.remove('dragging','control-hover','wheel-hover','editor-hit');apply(view.state,true);const dimensions=getDimensions?.();if(dimensions){facade.setSize(dimensions.width,dimensions.height,false);}view.onActivate?.();return true;},
   release(){if(view.released)return false;if(active===view){view.state=snapshot();view.onSuspend?.();active=null;}view.released=true;if(views.get(id)===view)views.delete(id);cleanup(view);return true;},
   diagnostics:()=>({id,active:active===view,released:view.released,pending:view.pending,epoch})};
  views.set(id,view);return lease;
 }
 function contextLost(event){event.preventDefault();lost=true;epoch++;for(const view of views.values())view.onContextLost?.(epoch);}
 function contextRestored(){lost=false;epoch++;for(const view of views.values()){view.scratch?.dispose();view.scratch=null;view.state.target=null;view.onContextRestored?.(epoch);}if(active)apply(active.state,true);}
 raw.domElement.addEventListener('webglcontextlost',contextLost);raw.domElement.addEventListener('webglcontextrestored',contextRestored);
 const host={renderer:raw,acquireView,diagnostics:()=>({activeView:active?.id||null,contextEpoch:epoch,lost,pending,views:[...views.keys()],physicalRenderers:1,contextAttributes:raw.getContext().getContextAttributes()}),async shutdown(){if(closed)return;closed=true;while(pending)await new Promise(r=>setTimeout(r,10));for(const v of views.values()){v.released=true;v.scratch?.dispose();}active=null;views.clear();raw.domElement.removeEventListener('webglcontextlost',contextLost);raw.domElement.removeEventListener('webglcontextrestored',contextRestored);invoke('dispose');hosts.delete(T);}};
 hosts.set(T,host);return host;
}
