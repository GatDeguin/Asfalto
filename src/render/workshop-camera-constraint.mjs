/** Static room/prop collision. Original meshes remain usable after render batching.
 * The car is deliberately absent from obstacleRoots so its inspection target is free. */
export function createWorkshopCameraConstraint(T, root, { obstacleRoots = [root] } = {}) {
  const floor = new T.Box3(), walls = new T.Box3(), box = new T.Box3();
  root.updateWorldMatrix(true, true);
  const names = object => (Array.isArray(object.material) ? object.material : [object.material]).map(m => m?.name || '');
  root.traverse(object => {
    if (!object.isMesh) return;
    if (names(object).includes('MAT_Floor_Concrete_Oily')) floor.union(box.setFromObject(object));
    if (names(object).some(n => /^MAT_Wall_(Plaster_Aged|Blue_OilPaint)$/.test(n))) walls.union(box.setFromObject(object));
  });
  if (floor.isEmpty() || walls.isEmpty()) throw new Error('No se encontraron el piso y las paredes del taller');
  const bounds = floor.clone(); bounds.min.y = floor.max.y; bounds.max.y = walls.max.y;
  const colliders = [], safe = bounds.clone(), anchor = new T.Vector3(), delta = new T.Vector3();
  const original = new T.Vector3(), candidate = new T.Vector3(), best = new T.Vector3();
  const expanded = [], instance = new T.Matrix4(), world = new T.Matrix4();
  const axes = ['x','y','z'];
  function refresh(roots = obstacleRoots) {
    obstacleRoots = roots; colliders.length = 0; expanded.length = 0;
    const seen = new Set();
    for (const part of roots) {
      if (!part) continue;
      part.updateWorldMatrix(true, true);
      part.traverse(object => {
        if (!object.isMesh || seen.has(object) || !object.geometry?.attributes.position) return;
        seen.add(object);
        if (names(object).some(n => /^MAT_(Floor_|Wall_|Fluorescent)/.test(n))) return;
        // Batched rendering geometry can span the entire room. Use authored sources.
        for (let p = object; p; p = p.parent) if (p.name === 'Workshop_Static_Batches' || p.userData?.cameraCollision === false) return;
        const geometry = object.geometry; geometry.computeBoundingBox();
        const add = matrix => {
          const b = geometry.boundingBox.clone().applyMatrix4(matrix);
          if (!b.intersectsBox(bounds)) return;
          // Large combined architecture must not turn the room interior into a solid box.
          const s = b.getSize(new T.Vector3()), room = bounds.getSize(new T.Vector3());
          if (s.x > room.x * .65 && s.z > room.z * .65) {
            const positions = geometry.attributes.position, index = geometry.index;
            const cells = new Map(), point = new T.Vector3(), triangle = new T.Box3();
            for (let i = 0, count = index?.count ?? positions.count; i < count; i += 3) {
              triangle.makeEmpty();
              for (let j = 0; j < 3; j++) triangle.expandByPoint(point.fromBufferAttribute(positions, index ? index.getX(i+j) : i+j).applyMatrix4(matrix));
              triangle.getCenter(point);
              const key = `${Math.floor(point.x/.5)},${Math.floor(point.y/.5)},${Math.floor(point.z/.5)}`;
              if (!cells.has(key)) cells.set(key, triangle.clone()); else cells.get(key).union(triangle);
            }
            colliders.push(...cells.values());
          } else colliders.push(b);
        };
        if (object.isInstancedMesh) for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, instance); world.multiplyMatrices(object.matrixWorld, instance); add(world);
        } else add(object.matrixWorld);
      });
    }
    for (const b of colliders) expanded.push(b.clone());
    return colliders.length;
  }
  refresh();
  function constrain(camera, target) {
    original.copy(camera.position);
    const tangent = Math.tan(camera.getEffectiveFOV() * Math.PI / 360);
    const clearance = Math.max(.18, camera.near * Math.hypot(1, tangent, tangent * camera.aspect) + .035);
    safe.copy(bounds).expandByScalar(-clearance);
    if (safe.isEmpty()) { bounds.getCenter(camera.position); return true; }
    anchor.copy(target).clamp(safe.min, safe.max);
    delta.subVectors(camera.position, anchor);
    let fraction = 1;
    for (const axis of axes) {
      if (delta[axis] > 0) fraction = Math.min(fraction, (safe.max[axis] - anchor[axis]) / delta[axis]);
      else if (delta[axis] < 0) fraction = Math.min(fraction, (safe.min[axis] - anchor[axis]) / delta[axis]);
    }
    for (let i = 0; i < colliders.length; i++) {
      const b = expanded[i].copy(colliders[i]).expandByScalar(clearance);
      // Inspection targets can lie in furniture. Do not collapse the boom to zero.
      if (b.containsPoint(anchor)) continue;
      let enter = 0, leave = fraction;
      for (const axis of axes) {
        if (Math.abs(delta[axis]) < 1e-10) {
          if (anchor[axis] < b.min[axis] || anchor[axis] > b.max[axis]) { leave = -1; break; }
        } else {
          const a = (b.min[axis]-anchor[axis])/delta[axis], c = (b.max[axis]-anchor[axis])/delta[axis];
          enter = Math.max(enter, Math.min(a,c)); leave = Math.min(leave, Math.max(a,c));
        }
      }
      if (leave >= enter && enter <= fraction) fraction = Math.max(0, enter - .0001);
    }
    camera.position.copy(anchor).addScaledVector(delta, Math.max(0, fraction)).clamp(safe.min, safe.max);
    const blocked = point => expanded.some(b => b.containsPoint(point));
    if (blocked(camera.position)) {
      // Recover even when both target and camera start inside an obstacle. Search
      // faces of all solids, considering overlaps and the room together.
      let distance = Infinity;
      for (const b of expanded) for (const axis of axes) for (const side of ['min','max']) {
        candidate.copy(camera.position); candidate[axis] = b[side][axis] + (side === 'min' ? -.001 : .001);
        if (!safe.containsPoint(candidate) || blocked(candidate)) continue;
        const d = candidate.distanceToSquared(camera.position);
        if (d < distance) { distance = d; best.copy(candidate); }
      }
      // Interlocking props can obstruct every axial exit. A bounded room search
      // is only needed for this initial-overlap recovery, never normal orbiting.
      if (!Number.isFinite(distance)) for (let x=0;x<=8;x++) for (let y=0;y<=4;y++) for (let z=0;z<=8;z++) {
        candidate.set(safe.min.x+(safe.max.x-safe.min.x)*x/8, safe.min.y+(safe.max.y-safe.min.y)*y/4, safe.min.z+(safe.max.z-safe.min.z)*z/8);
        if (blocked(candidate)) continue;
        const d=candidate.distanceToSquared(camera.position);
        if(d<distance){distance=d;best.copy(candidate);}
      }
      if (Number.isFinite(distance)) camera.position.copy(best);
    }
    return !camera.position.equals(original);
  }
  return { bounds, constrain, refresh, get colliderCount() { return colliders.length; } };
}

