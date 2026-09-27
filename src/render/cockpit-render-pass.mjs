import {compileVisiblePass,prepareBatchedPass} from './pass-preparation.mjs?v=2481e701be72bf1c';
// The adjustable interior is a camera-space model. Its lowered floor must not
// share depth with physical road/terrain. Keep normal depth *within* the cabin,
// and retain the already-rendered world through windows and transparent glass.
// Layer 30 is temporary: editor picking, mirrors and authored masks are restored
// before returning. No render target, material copy or GPU resource is created.
const INTERIOR_MASK = 1 << 30;

export function createCockpitRenderPass({ renderer, scene, camera, cockpit, overlays = [], renderWorld = () => renderer.render(scene,camera), prepareWorld = compile => compile(), prepareInterior = compile => compile() }) {
  const masks = [], visibility = [];
  let dirty=true,disposed=false,rebuilds=0,revision=0;
  const observed=new Set(),lights=[],interiorNodes=[];
  const invalidate=()=>{dirty=true;revision++;};
  function clearMembership(){for(const node of observed){node.removeEventListener('childadded',invalidate);node.removeEventListener('childremoved',invalidate);}observed.clear();lights.length=interiorNodes.length=0;}
  function membership(){
    if(!dirty)return;
    clearMembership();
    const observe=node=>{if(observed.has(node))return;observed.add(node);node.addEventListener('childadded',invalidate);node.addEventListener('childremoved',invalidate);};
    scene.traverse(node=>{observe(node);if(node.isLight)lights.push(node);});
    for(const root of [cockpit,...overlays])root.traverse(node=>{observe(node);interiorNodes.push(node);});
    dirty=false;rebuilds++;
  }
  const isolate = node => { masks.push(node, node.layers.mask); node.layers.mask = INTERIOR_MASK; };
  const includeLight = node => { if(node.isLight && !node.userData.excludeFromCameraInterior && node.layers.test(camera.layers)) isolate(node); };
  // Three.compile() traverses hidden meshes and ignores their layers. Limit its
  // material traversal to this pass, while targetScene supplies the real lights,
  // fog and environment. Lights must not also be gathered from this view.
  function compilePass(interior,split){
    membership();
    const savedMasks=[],savedVisibility=[];
    const cameraMask=camera.layers.mask,background=scene.background,cockpitVisible=cockpit.visible;
    const autoClear=renderer.autoClear,infoAutoReset=renderer.info?.autoReset;
    const shadowAutoUpdate=renderer.shadowMap?.autoUpdate,shadowNeedsUpdate=renderer.shadowMap?.needsUpdate;
    const remap=node=>{savedMasks.push(node,node.layers.mask);node.layers.mask=INTERIOR_MASK;};
    try{
      if(interior){
        cockpit.visible=true;
        for(const node of lights)if(!node.userData.excludeFromCameraInterior&&node.layers.test(camera.layers))remap(node);
        for(const node of interiorNodes)remap(node);
        camera.layers.mask=INTERIOR_MASK;scene.background=null;renderer.autoClear=false;
        if(renderer.info)renderer.info.autoReset=false;
        if(renderer.shadowMap){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;}
      }else if(split){
        cockpit.visible=false;
        for(const overlay of overlays){savedVisibility.push(overlay,overlay.visible);overlay.visible=false;}
      }
      return (interior?prepareInterior:prepareWorld)(()=>compileVisiblePass(renderer,scene,camera));
    }finally{
      // compileAsync captures the programs synchronously. Restore before its
      // promise settles so UI rendering cannot observe temporary pass state.
      for(let i=savedMasks.length-2;i>=0;i-=2)savedMasks[i].layers.mask=savedMasks[i+1];
      for(let i=0;i<savedVisibility.length;i+=2)savedVisibility[i].visible=savedVisibility[i+1];
      cockpit.visible=cockpitVisible;camera.layers.mask=cameraMask;scene.background=background;renderer.autoClear=autoClear;
      if(renderer.info)renderer.info.autoReset=infoAutoReset;
      if(renderer.shadowMap){renderer.shadowMap.autoUpdate=shadowAutoUpdate;renderer.shadowMap.needsUpdate=shadowNeedsUpdate;}
    }
  }
  return {
    invalidate,getRevision:()=>revision,
    diagnostics:()=>({rebuilds,observed:observed.size,lights:lights.length,interiorNodes:interiorNodes.length,disposed}),
    dispose(){disposed=true;clearMembership();},
    async prepare({signal,withState=compile=>compile(),incremental=false}={}){
      signal?.throwIfAborted();if(disposed)throw new Error('Cockpit render pass disposed');
      const split=cockpit.visible;
      const preparePass=interior=>incremental?prepareBatchedPass(renderer,()=>compilePass(interior,split),{signal,withTurnState:withState}):withState(()=>compilePass(interior,split));
      await preparePass(false);
      // Shared materials hold one currentProgram; finish world polling before
      // selecting the interior lighting variant of those same materials.
      signal?.throwIfAborted();if(disposed)throw new Error('Cockpit render pass disposed');
      if(split)await preparePass(true);
      signal?.throwIfAborted();
    },
    render() {
      if(disposed)return;membership();
      if (!cockpit.visible) { renderWorld(); return; }
      const cameraMask = camera.layers.mask, background = scene.background;
      const autoClear = renderer.autoClear, infoAutoReset = renderer.info?.autoReset;
      const shadowAutoUpdate = renderer.shadowMap?.autoUpdate;
      let shadowNeedsUpdate = renderer.shadowMap?.needsUpdate;
      masks.length = 0; visibility.length = 0;
      try {
        cockpit.visible = false;
        for (const overlay of overlays) { visibility.push(overlay, overlay.visible); overlay.visible = false; }
        renderWorld();
        shadowNeedsUpdate = renderer.shadowMap?.needsUpdate;
        cockpit.visible = true;
        for (let i=0;i<visibility.length;i+=2) visibility[i].visible=visibility[i+1];

        // Preserve environment and external/cabin lights. The own road beam must
        // not be remapped into this camera-space interior. Hidden lights stay hidden.
        for(const node of lights)includeLight(node);
        for(const node of interiorNodes)isolate(node);
        camera.layers.mask = INTERIOR_MASK;
        scene.background = null;
        renderer.autoClear = false;
        if (renderer.info) renderer.info.autoReset = false;
        if (renderer.shadowMap) { renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false; }
        renderer.clearDepth();
        renderer.render(scene, camera);
      } finally {
        for (let i=masks.length-2;i>=0;i-=2) masks[i].layers.mask=masks[i+1];
        for (let i=0;i<visibility.length;i+=2) visibility[i].visible=visibility[i+1];
        cockpit.visible = true;
        camera.layers.mask = cameraMask;
        scene.background = background;
        renderer.autoClear = autoClear;
        if (renderer.info) renderer.info.autoReset = infoAutoReset;
        if (renderer.shadowMap) { renderer.shadowMap.autoUpdate = shadowAutoUpdate; renderer.shadowMap.needsUpdate = shadowNeedsUpdate; }
        masks.length = 0; visibility.length = 0;
      }
    },
  };
}
