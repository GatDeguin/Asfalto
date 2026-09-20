const CLEARANCE_M = 0.06;
const CONTACT_EPSILON_M = 1e-5;
const ANTICIPATION_M = 0.8;
export const MAX_LIFT_M = 4;
const validPoint = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const contains = (box, point) => point.every((value, axis) => value >= box.min[axis] && value <= box.max[axis]);

// Rotate the whole viewing basis by the change in camera-to-subject direction.
// Chase additionally reserves vertical space for the car's growing roof/rear
// silhouette as the boom lifts; the chassis point alone does not bound it.
export function reframeCameraBoom({ from, to, look, up, mode }, position) {
  if (!validPoint(from) || !validPoint(to) || !validPoint(look) || !validPoint(up)
      || !validPoint(position) || position.every((n, i) => n === to[i])) return { look, up };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const a = from.map((n,i) => n-to[i]), b = from.map((n,i) => n-position[i]);
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  if (la < 1e-9 || lb < 1e-9) return { look, up };
  for (let i=0;i<3;i++) { a[i]/=la; b[i]/=lb; }
  const axis = cross(a,b), w = 1+a.reduce((sum,n,i) => sum+n*b[i],0), norm = Math.hypot(...axis,w);
  if (norm < 1e-9) return { look, up };
  const q = axis.map(n => n/norm), qw = w/norm;
  const rotate = vector => {
    const twice = cross(q,vector).map(n => n*2), second = cross(q,twice);
    return vector.map((n,i) => n+qw*twice[i]+second[i]);
  };
  let direction=rotate(look.map((n,i) => n-to[i])),viewUp=rotate(up);
  const bias=mode==='chase'?Math.min(5,Math.max(0,position[1]-to[1])*3)*Math.PI/180:0;
  if(bias>0){
    const right=cross(direction,viewUp),magnitude=Math.hypot(...right);
    if(magnitude>1e-9){
      for(let i=0;i<3;i++)right[i]/=magnitude;
      const cosine=Math.cos(bias),sine=Math.sin(bias);
      const pitchDown=vector=>{
        const tangent=cross(right,vector),parallel=right.reduce((sum,n,i)=>sum+n*vector[i],0);
        return vector.map((n,i)=>n*cosine-tangent[i]*sine+right[i]*parallel*(1-cosine));
      };
      direction=pitchDown(direction);viewUp=pitchDown(viewUp);
    }
  }
  return { look:direction.map((n,i) => n+position[i]), up:viewUp };
}

// Segment vs expanded AABB: a conservative swept-sphere test, including a
// camera whose endpoints are outside but whose boom crosses the actor.
function crossingInterval(from, delta, box, axes = [0, 1, 2]) {
  let enter = 0, leave = 1;
  for (const axis of axes) {
    if (Math.abs(delta[axis]) < 1e-12) {
      if (from[axis] < box.min[axis] || from[axis] > box.max[axis]) return null;
      continue;
    }
    const a = (box.min[axis] - from[axis]) / delta[axis];
    const b = (box.max[axis] - from[axis]) / delta[axis];
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return null;
  }
  return [enter, leave];
}

function nearestHorizontal(from, to, box) {
  const dx=to[0]-from[0], dz=to[2]-from[2], lengthSq=dx*dx+dz*dz;
  let best={distance:Infinity,t:1};
  const consider = raw => {
    const t=Math.max(0,Math.min(1,raw)), x=from[0]+dx*t, z=from[2]+dz*t;
    const distance=Math.hypot(x-Math.max(box.min[0],Math.min(box.max[0],x)),z-Math.max(box.min[2],Math.min(box.max[2],z)));
    if(distance<best.distance-1e-10 || (Math.abs(distance-best.distance)<=1e-10 && t<best.t))best={distance,t};
  };
  consider(0);consider(1);
  if(lengthSq>1e-12)for(const x of [box.min[0],box.max[0]])for(const z of [box.min[2],box.max[2]])consider(((x-from[0])*dx+(z-from[2])*dz)/lengthSq);
  return best;
}

/** Return a corrected world position, or null to preserve the pose exactly. */
export function resolveCameraBoom({ from, to, look, baseHeight, radius = 0.24, mode } = {}, bounds = []) {
  if (mode && mode !== 'chase' && mode !== 'cinematic') return null;
  if (!validPoint(from) || !validPoint(to) || !Number.isFinite(radius) || radius < 0) return null;
  const padding = radius + CLEARANCE_M;
  const boxes = bounds.filter(box => validPoint(box?.min) && validPoint(box?.max)
    && box.min.every((n, i) => n <= box.max[i])).map(box => ({
    min: box.min.map(n => n - padding), max: box.max.map(n => n + padding),
  }));
  if (!boxes.length) return null;

  const anchors = validPoint(look) ? [from, look] : [from];
  // Keep the authored horizontal framing. Over each XZ crossing interval,
  // y(t) must exceed the roof; its required endpoint height is extremal at
  // one of the interval endpoints. A clear endpoint alone is insufficient.
  let height = to[1];
  for (const anchor of anchors) for (const box of boxes) {
    if(contains(box,anchor)&&!contains(box,to))continue;
    if(anchor[1]<box.min[1]&&to[1]<box.min[1])continue;
    const interval = crossingInterval(anchor, to.map((n, i) => n - anchor[i]), box, [0, 2]);
    const roof = box.max[1] + CONTACT_EPSILON_M;
    if (!interval) {
      // A finite roof has a discontinuous height at its front edge. Prepare
      // the lift within this bounded horizontal envelope so an approaching
      // actor does not make the camera jump when the hard boom first touches.
      const nearest=nearestHorizontal(anchor,to,box);
      if(nearest.distance>=ANTICIPATION_M||nearest.t<0.15)continue;
      const p=1-nearest.distance/ANTICIPATION_M, blend=p*p*(3-2*p);
      const required=anchor[1]+(roof-anchor[1])/nearest.t;
      height=Math.max(height,to[1]+Math.max(0,required-to[1])*blend);
      continue;
    }
    if (interval[0] === 0 && anchor[1] <= roof) {
      // An embedded anchor has no entirely clear segment. Lift the camera
      // outside instead of collapsing it into the player's own vehicle.
      height = Math.max(height, roof);
      continue;
    }
    for (const t of interval) if (t > 0) height = Math.max(height, anchor[1] + (roof - anchor[1]) / t);
  }
  // A rival virtually covering the anchor can demand roof/t -> infinity.
  // Bound the visual fallback; an occluded/embedded subject anchor cannot
  // guarantee a clear sight line without an unreasonable aerial camera.
  height=Math.min(height,(Number.isFinite(baseHeight)?baseHeight:to[1])+MAX_LIFT_M);
  return height>to[1]+1e-12?[to[0], height, to[2]]:null;
}

/** Visual-only actor bounds. No raycaster, physics mutation or GPU work. */
export function createCameraBoomCollisionQuery(THREE, { getObstacles } = {}) {
  if (!THREE?.Box3 || typeof getObstacles !== 'function') throw new TypeError('camera boom query requires Three and getObstacles');
  const actorBounds = new THREE.Box3(), meshBounds = new THREE.Box3();
  return request => {
    if (request?.mode !== 'chase' && request?.mode !== 'cinematic') return null;
    const bounds = [];
    for (const root of getObstacles() || []) {
      if (!root?.traverseVisible) continue;
      let visible = true;
      for (let node = root; node; node = node.parent) if (node.visible === false) { visible = false; break; }
      if (!visible) continue;
      root.updateWorldMatrix(true, true);
      actorBounds.makeEmpty();
      root.traverseVisible(mesh => {
        if (!mesh.isMesh || !mesh.geometry) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (materials.length && materials.every(material => material?.visible === false)) return;
        // Falcon's authored whole-car geometry includes the wheels. Cached
        // local bounds plus the swept radius cover their small articulation;
        // avoid reskinning every vertex twice per camera frame for a box.
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        if (!mesh.geometry.boundingBox || mesh.geometry.boundingBox.isEmpty()) return;
        meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        actorBounds.union(meshBounds);
      });
      if (!actorBounds.isEmpty()) bounds.push({ min: actorBounds.min.toArray(), max: actorBounds.max.toArray() });
    }
    return resolveCameraBoom(request, bounds);
  };
}
