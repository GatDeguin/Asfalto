// Update transforms once after simulation/streaming and before mirrors/world/cabin.
// Renderer-owned full-screen scenes and cameras continue to update themselves.
export function withFrameMatrices(scene,draw){
 const previous=scene.matrixWorldAutoUpdate;
 scene.updateMatrixWorld(true);
 scene.matrixWorldAutoUpdate=false;
 try{return draw();}finally{scene.matrixWorldAutoUpdate=previous;}
}
