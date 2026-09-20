export const MAX_PHOTO_BYTES=256*1024;
export function createRacePhotoCapture({createCanvas=()=>document.createElement('canvas'),timeoutMs=5000}={}){
 let pending=null,disposed=false;
 function request(expected,{signal}={}){if(disposed)throw Error('Captura cerrada.');if(expected?.qa!==false)throw Error('QA no genera recuerdos ganados.');if(pending)throw Error('Ya hay una captura pendiente.');return new Promise((resolve,reject)=>{
  const task={expected:structuredClone(expected),resolve,reject,timer:null,abort:null,signal};pending=task;
  task.fail=error=>{if(pending===task)pending=null;clearTimeout(task.timer);signal?.removeEventListener('abort',task.abort);reject(error);};
  task.abort=()=>task.fail(Error('Captura cancelada.'));task.timer=setTimeout(()=>task.fail(Error('No hubo un frame renderizado disponible para la fotografía.')),timeoutMs);signal?.addEventListener('abort',task.abort,{once:true});if(signal?.aborted)task.abort();
 });}
 function afterFrame(source,frame){const task=pending;if(!task)return;pending=null;clearTimeout(task.timer);task.signal?.removeEventListener('abort',task.abort);
  try{if(frame?.qa!==false||!Number.isFinite(frame.frameId)||['trackId','skyId','weather','vehicleId'].some(key=>frame[key]!==task.expected[key]))throw Error('El frame no corresponde al entorno y auto del recibo.');if(!(source?.width>0&&source?.height>0))throw Error('Canvas de carrera no disponible.');
   const canvas=createCanvas(),ratio=Math.min(1,640/source.width,640/source.height);canvas.width=Math.max(1,Math.round(source.width*ratio));canvas.height=Math.max(1,Math.round(source.height*ratio));const context=canvas.getContext('2d');if(!context)throw Error('Copia fotográfica no disponible.');
   // Must stay synchronous inside the renderer's completed default-frame callback.
   context.drawImage(source,0,0,canvas.width,canvas.height);const actual=structuredClone(frame);
   canvas.toBlob(blob=>{if(disposed)return task.reject(Error('Captura cerrada.'));if(!blob||blob.type!=='image/jpeg')return task.reject(Error('No se pudo codificar la miniatura.'));if(blob.size>MAX_PHOTO_BYTES)return task.reject(Error('La miniatura supera256KiB.'));task.resolve({blob,width:canvas.width,height:canvas.height,frame:actual});},'image/jpeg',.82);
  }catch(error){task.reject(error);}
 }
 return Object.freeze({request,afterFrame,failCapture:error=>pending?.fail(error),hasPending:()=>!!pending,dispose(){disposed=true;pending?.fail(Error('Captura cerrada.'));}});
}
