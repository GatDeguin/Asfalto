import { wrapRouteDistance } from '../route-distances.mjs';

export function prepareOptionalClosedRoute(dependencies, sourceRoute, id) {
  if (dependencies.prepareClosedRoute === undefined) return null;
  if (typeof dependencies.prepareClosedRoute !== 'function') throw new TypeError('prepareClosedRoute must be a function');
  const result = dependencies.prepareClosedRoute(sourceRoute, { id });
  if (!result || typeof result.then === 'function' || result.route?.closed !== true
      || !Number.isFinite(result.route.lengthM) || result.route.lengthM <= sourceRoute.lengthM
      || typeof result.createRoots !== 'function') throw new TypeError('prepareClosedRoute must synchronously return a longer closed route and createRoots');
  return result;
}
export function closureMaterialCandidates(root) {
  const result = {};
  root?.traverse?.(node => {
    if (/^COLLISION_/.test(node.name || '')) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material?.isMaterial) continue;
      const name = material.name || '';
      if (!result.asphalt && /ASPHALT|Asphalt_Wet|^MAT_P1_ROAD$|^MAT_asphalt$/.test(name)) result.asphalt = material;
      if (!result.shoulder && /SHOULDER|Shoulder_Gravel|^MAT_P1_GRAVEL$|^MAT_laterite$/.test(name)) result.shoulder = material;
      if (!result.terrain && /TERRAIN|Terrain_Andean|^MAT_forest_floor$/.test(name)) result.terrain = material;
      if (!result.paint && /ROAD_MARKING|ROAD_LINE|Marking|^MAT_P1_MARK|^MAT_road_white$/.test(name)) result.paint = material;
    }
  });
  return result;
}
// Attach each valid result before validating the pair so cleanup owns partial failure.
export function attachClosedRouteRoots(closure, visualRoot, collisionRoot, materials = closureMaterialCandidates(visualRoot)) {
  const roots = closure.createRoots({...materials,sourceRoot:visualRoot});
  if (!roots || typeof roots.then === 'function') throw new TypeError('closed route createRoots must be synchronous');
  const valid = root => root && typeof root.traverse === 'function' && Array.isArray(root.children);
  for (const [parent, child] of [[visualRoot, roots.visualRoot], [collisionRoot, roots.collisionRoot]]) {
    if (!valid(child)) continue;
    if (typeof parent.add === 'function') parent.add(child);
    else if (Array.isArray(parent.children)) { parent.children.push(child); child.parent = parent; }
    else throw new TypeError('closed route owner must support child attachment');
  }
  if (!valid(roots.visualRoot) || !valid(roots.collisionRoot)) throw new TypeError('closed route requires valid visualRoot and collisionRoot');
  visualRoot.userData ||= {};
  visualRoot.userData.asfaltoClosure = closure.closure;
  return roots;
}
export function respawnRouteDistance(route, raceProgressM) {
  if (!Number.isFinite(raceProgressM)) throw new TypeError('raceProgressM must be finite');
  if (!route.closed) return { sM: Math.max(0, Math.min(route.lengthM, raceProgressM)), lapPrefixM: 0 };
  const progress = Math.max(0, raceProgressM), sM = wrapRouteDistance(progress, route.lengthM);
  return { sM, lapPrefixM: progress - sM };
}
export function sourceStreamingDistance(route, sourceLengthM, sM, prefetchM = 800) {
  const station = route.closed ? wrapRouteDistance(sM, route.lengthM) : Math.max(0, Math.min(route.lengthM, sM));
  if (route.closed && station >= route.lengthM - prefetchM) return 0;
  return Math.min(sourceLengthM, station);
}
