import {preparePrograms} from './shader-preparation.mjs';
// The adjustable interior is a camera-space model. Its lowered floor must not
// share depth with physical road/terrain. Keep normal depth *within* the cabin,
// and retain the already-rendered world through windows and transparent glass.
// Layer 30 is temporary: editor picking, mirrors and authored masks are restored
// before returning. No render target, material copy or GPU resource is created.
const INTERIOR_MASK = 1 << 30;

export function createCockpitRenderPass({ compilePrograms=preparePrograms, renderer, scene, camera, cockpit, overlays = [], renderWorld = () => renderer.render(scene,camera), prepareWorld = compile => compile(), prepareInterior = compile => compile() }) {
  const masks = [], visibility = [];
  const isolate = node => { masks.push(node, node.layers.mask); node.layers.mask = INTERIOR_MASK; };
  const includeLight = node => { if(node.isLight && !node.userData.excludeFromCameraInterior && node.layers.test(camera.layers)) isolate(node); };
  // Three.compile() traverses hidden meshes and ignores their layers. Limit its
  // material traversal to this pass, while targetScene supplies the real lights,
  // fog and environment. Lights must not also be gathered from this view.
  const compileView = {
    traverse(visit){scene.traverseVisible(node=>{if(node.layers.test(camera.layers))visit(node);});},
    traverseVisible(){},
  };
  function compilePass(interior,split,signal){
    const savedMasks=[],savedVisibility=[];
    const cameraMask=camera.layers.mask,background=scene.background,cockpitVisible=cockpit.visible;
    const autoClear=renderer.autoClear,infoAutoReset=renderer.info?.autoReset;
    const shadowAutoUpdate=renderer.shadowMap?.autoUpdate,shadowNeedsUpdate=renderer.shadowMap?.needsUpdate;
    const remap=node=>{savedMasks.push(node,node.layers.mask);node.layers.mask=INTERIOR_MASK;};
    try{
      if(interior){
        cockpit.visible=true;
        scene.traverse(node=>{if(node.isLight&&!node.userData.excludeFromCameraInterior&&node.layers.test(camera.layers))remap(node);});
        cockpit.traverse(remap);for(const overlay of overlays)overlay.traverse(remap);
        camera.layers.mask=INTERIOR_MASK;scene.background=null;renderer.autoClear=false;
        if(renderer.info)renderer.info.autoReset=false;
        if(renderer.shadowMap){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;}
      }else if(split){
        cockpit.visible=false;
        for(const overlay of overlays){savedVisibility.push(overlay,overlay.visible);overlay.visible=false;}
      }
      return (interior?prepareInterior:prepareWorld)(()=>compilePrograms(renderer,compileView,camera,scene,{signal}));
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
    async prepare({signal}={}){
      const split=cockpit.visible;
      await compilePass(false,split,signal);
      // Shared materials hold one currentProgram; finish world polling before
      // selecting the interior lighting variant of those same materials.
      if(split)await compilePass(true,true,signal);
    },
    render() {
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
        scene.traverse(includeLight);
        cockpit.traverse(isolate);
        for (const overlay of overlays) overlay.traverse(isolate);
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
