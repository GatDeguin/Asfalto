// Three calls object.onBeforeRender before this public entry point. Distance
// windows can therefore set count=0 for this camera. Avoid preparing shaders,
// uniforms and bindings for that empty draw; leave selection callbacks intact.
export function installEmptyInstanceDrawGuard(renderer,{enabled=()=>true}={}) {
 const original=renderer.renderBufferDirect;
 function draw(camera,scene,geometry,material,object,group) {
  if(object?.isInstancedMesh && !object.isBatchedMesh && object.count===0 && enabled())return;
  return original.call(this,camera,scene,geometry,material,object,group);
 }
 renderer.renderBufferDirect=draw;
 return {dispose(){if(renderer.renderBufferDirect===draw)renderer.renderBufferDirect=original;}};
}
