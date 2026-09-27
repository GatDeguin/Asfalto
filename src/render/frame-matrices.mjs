// Update transforms once after simulation/streaming and before mirrors/world/cabin.
// A stationary Scene must not force every static track node to multiply matrices.
const previousMatrices = new WeakMap();
export function withFrameMatrices(scene, draw) {
  const worldAuto = scene.matrixWorldAutoUpdate, localAuto = scene.matrixAutoUpdate;
  try {
    if (localAuto) {
      let previous = previousMatrices.get(scene);
      if (!previous) { previous = new Float64Array(16); previousMatrices.set(scene, previous); }
      previous.set(scene.matrix.elements);
      const wasDirty = scene.matrixWorldNeedsUpdate;
      scene.updateMatrix();
      let changed = false;
      for (let i = 0; i < 16; i++) if (previous[i] !== scene.matrix.elements[i]) { changed = true; break; }
      scene.matrixWorldNeedsUpdate = wasDirty || changed;
      scene.matrixAutoUpdate = false;
    }
    // Dynamic descendants still compose their matrices normally. Static branches
    // are dirtied explicitly by streaming/rebasing or by a moving ancestor.
    scene.updateMatrixWorld(false);
    scene.matrixWorldAutoUpdate = false;
    return draw();
  } finally {
    scene.matrixWorldAutoUpdate = worldAuto;
    scene.matrixAutoUpdate = localAuto;
  }
}

// Apply only to completed, authored track subtrees, never to cars/editor mounts.
// The root stays dynamic so streaming may reposition it normally.
export function freezeStaticTrackTransforms(root) {
  if (!root?.isObject3D) return 0;
  root.updateMatrixWorld(true);
  let frozen = 0;
  root.traverse(node => {
    if (node === root || node.isSkinnedMesh || node.isBone || node.morphTargetInfluences || node.userData?.asfaltoDynamicTransform) return;
    if (node.matrixAutoUpdate) { node.updateMatrix(); node.matrixAutoUpdate = false; frozen++; }
  });
  return frozen;
}
