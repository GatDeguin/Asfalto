// The adjustable interior is a camera-space model. Its lowered floor must not
// share depth with physical road/terrain. Keep normal depth *within* the cabin,
// and retain the already-rendered world through windows and transparent glass.
// Layer 30 is temporary: editor picking, mirrors and authored masks are restored
// before returning. No render target, material copy or GPU resource is created.
const INTERIOR_MASK = 1 << 30;

export function createCockpitRenderPass({ renderer, scene, camera, cockpit, overlays = [], onStage = null, renderWorld = () => renderer.render(scene,camera) }) {
  const masks = [], visibility = [];
  const isolate = node => { masks.push(node, node.layers.mask); node.layers.mask = INTERIOR_MASK; };
  const includeLight = node => { if(node.isLight && !node.userData.excludeFromCameraInterior && node.layers.test(camera.layers)) isolate(node); };
  return {
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
        onStage?.('Primer cuadro: mundo');renderWorld();
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
        onStage?.('Primer cuadro: interior del cockpit');renderer.clearDepth();
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
