/** The workshop is an axis-aligned rectangular room after its authoring
 * transform. Use its concrete footprint and structural walls, never props or
 * the car. Keep a sphere enclosing the camera's near plane inside the room. */
export function createWorkshopCameraConstraint(T, root) {
  const floor = new T.Box3(), walls = new T.Box3(), box = new T.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(m => m?.name === 'MAT_Floor_Concrete_Oily')) floor.union(box.setFromObject(object));
    if (materials.some(m => /^MAT_Wall_(Plaster_Aged|Blue_OilPaint)$/.test(m?.name || ''))) walls.union(box.setFromObject(object));
  });
  if (floor.isEmpty() || walls.isEmpty()) throw new Error('No se encontraron el piso y las paredes del taller');
  const bounds = floor.clone(); bounds.min.y = floor.max.y; bounds.max.y = walls.max.y;
  const safe = bounds.clone(), anchor = new T.Vector3(), delta = new T.Vector3();
  function constrain(camera, target) {
    const tangent = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
    const clearance = Math.max(.18, camera.near * Math.hypot(1, tangent, tangent * camera.aspect) + .035);
    safe.copy(bounds).expandByScalar(-clearance);
    if (safe.isEmpty()) { bounds.getCenter(camera.position); return true; }
    if (safe.containsPoint(camera.position)) return false;
    anchor.copy(target).clamp(safe.min, safe.max);
    delta.subVectors(camera.position, anchor);
    let fraction = 1;
    for (const axis of ['x','y','z']) {
      if (delta[axis] > 0) fraction = Math.min(fraction, (safe.max[axis] - anchor[axis]) / delta[axis]);
      else if (delta[axis] < 0) fraction = Math.min(fraction, (safe.min[axis] - anchor[axis]) / delta[axis]);
    }
    camera.position.copy(anchor).addScaledVector(delta, Math.max(0, fraction)).clamp(safe.min, safe.max);
    return true;
  }
  return { bounds, constrain };
}
