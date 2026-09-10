// The request owns encoding/storage. This bridge only hands it the completed
// default-framebuffer canvas while its pixels are still valid.
export function createPresentedFrameCapture({renderer,camera,getBridge,getMetadata}){
 return function publishPresentedFrame(){let bridge;
  try{bridge=getBridge();if(!bridge?.hasPending?.()||renderer.getRenderTarget()!==null)return false;
   bridge.afterFrame(renderer.domElement,{...getMetadata(),frameId:renderer.info.render.frame,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,focalLength:camera.getFocalLength()}});return true;
  }catch(error){try{bridge?.failCapture?.(error);}catch{}return false;}
 };
}
