/** Capability observations, never a promise of a renderer or an estimate of VRAM.
 * requestAdapter creates no GPUDevice. A disposed owner ignores asynchronous results. */
export function createRenderCapabilities({renderer,navigator=globalThis.navigator}={}) {
 let disposed=false,webgl={},webgpu={status:navigator?.gpu?.requestAdapter?'pending':'unavailable',rendererCompatible:false,reason:'The shipped renderer, GLSL material patches and capture passes require WebGL2.'};
 const canvas=renderer?.domElement;
 function refresh(){
  if(disposed)return;
  try{
   const gl=renderer.getContext(),extensions=gl.getSupportedExtensions?.()||[];
   const read=name=>{try{return gl[name]===undefined?null:gl.getParameter(gl[name]);}catch{return null;}};
   const compression=[];if(extensions.some(n=>/s3tc|bptc|rgtc/i.test(n)))compression.push('bc');if(extensions.includes('WEBGL_compressed_texture_astc'))compression.push('astc');if(extensions.some(n=>/compressed_texture_etc/i.test(n)))compression.push('etc');
   webgl={version:read('VERSION'),contextLost:gl.isContextLost?.()===true,hdr:extensions.includes('EXT_color_buffer_float')||extensions.includes('EXT_color_buffer_half_float'),timerQuery:extensions.includes('EXT_disjoint_timer_query_webgl2'),maxTextureSize:read('MAX_TEXTURE_SIZE'),maxRenderbufferSize:read('MAX_RENDERBUFFER_SIZE'),maxTextureUnits:read('MAX_TEXTURE_IMAGE_UNITS'),maxVertexAttributes:read('MAX_VERTEX_ATTRIBS'),maxUniformBlockBytes:read('MAX_UNIFORM_BLOCK_SIZE'),maxArrayLayers:read('MAX_ARRAY_TEXTURE_LAYERS'),maxSamples:read('MAX_SAMPLES'),maxAnisotropy:renderer.capabilities?.getMaxAnisotropy?.()||1,compression};
  }catch{webgl={unavailable:true};}
 }
 const restored=()=>refresh();canvas?.addEventListener?.('webglcontextrestored',restored);refresh();
 if(webgpu.status==='pending')Promise.resolve().then(()=>navigator.gpu.requestAdapter({powerPreference:'high-performance'})).then(adapter=>{
  if(disposed)return;
  webgpu={...webgpu,status:adapter?'available':'unavailable',features:adapter?Array.from(adapter.features||[]):[],limits:adapter?{maxTextureDimension2D:adapter.limits?.maxTextureDimension2D??null,maxBufferSize:adapter.limits?.maxBufferSize??null,maxStorageBufferBindingSize:adapter.limits?.maxStorageBufferBindingSize??null}:null};
 },error=>{if(!disposed)webgpu={...webgpu,status:'denied',error:String(error?.message||error)};});
 return {diagnostics:()=>({backend:'webgl2',webgl:{...webgl,compression:[...(webgl.compression||[])]},webgpu:{...webgpu,features:webgpu.features?[...webgpu.features]:undefined,limits:webgpu.limits?{...webgpu.limits}:webgpu.limits},memory:{systemGiBHint:Number.isFinite(navigator?.deviceMemory)?navigator.deviceMemory:null,scope:'browser system-memory hint; not VRAM'},disposed}),dispose(){if(disposed)return;disposed=true;canvas?.removeEventListener?.('webglcontextrestored',restored);}};
}
