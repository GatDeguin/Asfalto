import {withRenderTarget} from './render-target-scope.mjs?v=30b8f30c25afc698';
import {boundedOperation} from '../runtime/demand-loader.mjs?v=4a2efb64f7eb24a0';
import {waitForAnimationFrame,waitForSignal} from '../runtime/abortable.mjs?v=c91114c944607feb';

/** A WebGL2 pixel-pack buffer transfers a full precision probe without making
 * JavaScript wait synchronously for six cube faces and PMREM. GPU fences have
 * no event API: one nonblocking check per animation frame is finite and owned.
 * Unlike Three r180's async helper, cancellation/context loss also deletes the
 * temporary buffer and fence. Renderer state never crosses an await. */
export async function readHalfFloatTarget(renderer,target,output,{signal,timeoutMs=45000,wait=waitForAnimationFrame}={}){
 signal?.throwIfAborted();const gl=renderer.getContext(),buffer=gl.createBuffer();let fence;
 const pack=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
 try{
  try{withRenderTarget(renderer,target,()=>{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,output.byteLength,gl.STREAM_READ);gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.HALF_FLOAT,0);fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();});}
  finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);}
  if(!fence)throw new Error('GPU probe fence unavailable');
  await boundedOperation(async active=>{
   while(true){active.throwIfAborted();if(gl.isContextLost())throw new Error('WebGL context lost during probe readback');const status=gl.clientWaitSync(fence,0,0);if(status===gl.WAIT_FAILED)throw new Error('GPU probe readback failed');if(status!==gl.TIMEOUT_EXPIRED)break;await waitForSignal(wait(active),active);}
   active.throwIfAborted();const current=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);try{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,output);}finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,current);}
  },{signal,timeoutMs,label:'Lectura del reflejo del taller'});
  return output;
 }finally{if(fence)gl.deleteSync(fence);if(buffer)gl.deleteBuffer(buffer);}
}
