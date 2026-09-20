// Three r180's shadow-map depth materials and VSM pass have no public disposer.
// Own the native allocations of a renderer from construction to retirement so
// those internal caches cannot outlive it when a mobile canvas is reused.
const activeOwners=new WeakMap();
const kinds=['VertexArray','Framebuffer','TransformFeedback','Query','Sync','Program','Shader','Buffer','Renderbuffer','Texture','Sampler'];
export function ownGpuContext(gl){
 if(activeOwners.has(gl))throw new Error('WebGL context already has an active renderer owner');
 let disposed=false;const records=[],restores=[];
 try{for(const kind of kinds){
  const createName=kind==='Sync'?'fenceSync':'create'+kind,deleteName='delete'+kind;
  const create=gl[createName],remove=gl[deleteName];if(typeof create!=='function'||typeof remove!=='function')continue;
  const live=new Set();const make=function(...args){if(disposed)throw new Error('GPU allocation after renderer disposal');const object=create.apply(this,args);if(object)live.add(object);return object;};
  const drop=function(object){live.delete(object);return remove.call(this,object);};
  restores.push(()=>{if(gl[createName]===make)gl[createName]=create;if(gl[deleteName]===drop)gl[deleteName]=remove;});
  gl[createName]=make;gl[deleteName]=drop;records.push({kind,live,remove});
 }}catch(error){for(const restore of restores.reverse())restore();throw error;}
 const owner={diagnostics:()=>({disposed,live:Object.fromEntries(records.map(r=>[r.kind,r.live.size]))}),dispose(){
  if(disposed)return false;disposed=true;const errors=[];
  // deleteProgram alone only flags CURRENT_PROGRAM for later deletion.
  gl.useProgram?.(null);gl.bindVertexArray?.(null);
  // VAO/FBO owners go first, then the buffers/textures they reference.
  for(const {live,remove}of records){for(const object of live)try{remove.call(gl,object);}catch(error){errors.push(error);}live.clear();}
  for(const restore of restores)restore();activeOwners.delete(gl);
  if(errors.length)throw new AggregateError(errors,'GPU retirement failed');return true;
 }};activeOwners.set(gl,owner);return owner;
}
export function createOwnedRenderer(T,parameters={}){
 const canvas=parameters.canvas||document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
 const attrs={alpha:false,depth:true,stencil:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'default',failIfMajorPerformanceCaveat:false};
 for(const key of Object.keys(attrs))if(key in parameters)attrs[key]=parameters[key];
 const context=parameters.context||canvas.getContext('webgl2',attrs);if(!context)throw new Error('WebGL 2 no disponible');
 const owner=ownGpuContext(context);let renderer;
 try{renderer=new T.WebGLRenderer({...parameters,canvas,context});}catch(error){owner.dispose();throw error;}
 const dispose=renderer.dispose.bind(renderer);let disposed=false;
 renderer.dispose=()=>{if(disposed)return;disposed=true;try{dispose();}finally{owner.dispose();}};
 renderer.gpuOwnerDiagnostics=owner.diagnostics;return renderer;
}
