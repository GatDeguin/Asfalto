const WHEEL_IDS = Object.freeze(['frontLeft', 'frontRight', 'rearLeft', 'rearRight']);
const TRACE_LIMIT = 600;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(a, b, alpha) {
  return finite(a) + (finite(b) - finite(a)) * alpha;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}

function vector(values, length, fallback) {
  if (!Array.isArray(values) || values.length < length) return [...fallback];
  return Array.from({ length }, (_, index) => finite(values[index], fallback[index]));
}

function setVector3(target, values) {
  if (!target) return;
  if (typeof target.set === 'function') target.set(values[0], values[1], values[2]);
  else {
    target.x = values[0];
    target.y = values[1];
    target.z = values[2];
  }
}

function setQuaternion(target, values) {
  if (!target) return;
  if (typeof target.set === 'function') target.set(values[0], values[1], values[2], values[3]);
  else {
    target.x = values[0];
    target.y = values[1];
    target.z = values[2];
    target.w = values[3];
  }
}

function interpolateQuaternion(beforeValue, afterValue, alpha) {
  const before = vector(beforeValue, 4, [0, 0, 0, 1]);
  const after = vector(afterValue, 4, [0, 0, 0, 1]);
  let sign = 1;
  if (before.reduce((sum, value, index) => sum + value * after[index], 0) < 0) sign = -1;
  const result = before.map((value, index) => lerp(value, after[index] * sign, alpha));
  const magnitude = Math.hypot(...result) || 1;
  return result.map(value => value / magnitude);
}

function wheelMap(snapshot) {
  return new Map((Array.isArray(snapshot?.wheels) ? snapshot.wheels : [])
    .filter(wheel => wheel && typeof wheel.id === 'string')
    .map(wheel => [wheel.id, wheel]));
}

function interpolateWheel(before, after, alpha) {
  return {
    ...after,
    rotationRad: lerp(before?.rotationRad, after?.rotationRad, alpha),
    steerAngleRad: lerp(before?.steerAngleRad, after?.steerAngleRad, alpha),
    compressionM: lerp(before?.compressionM, after?.compressionM, alpha),
  };
}

export function interpolateVehicleSnapshot(previous, current, interpolation = 1) {
  if (!previous?.chassis || !current?.chassis) return null;
  const alpha = clamp(finite(interpolation, 1), 0, 1);
  const beforePosition = vector(previous.chassis.position, 3, [0, 0, 0]);
  const afterPosition = vector(current.chassis.position, 3, beforePosition);
  const beforeWheels = wheelMap(previous);
  const afterWheels = wheelMap(current);
  return freeze({
    ...current,
    chassis: {
      ...current.chassis,
      position: afterPosition.map((value, index) => lerp(beforePosition[index], value, alpha)),
      rotation: interpolateQuaternion(previous.chassis.rotation, current.chassis.rotation, alpha),
    },
    wheels: WHEEL_IDS
      .filter(id => beforeWheels.has(id) && afterWheels.has(id))
      .map(id => interpolateWheel(beforeWheels.get(id), afterWheels.get(id), alpha)),
  });
}

function frameForRival(renderFrame, id) {
  const rivals = renderFrame?.rivals;
  if (Array.isArray(rivals)) return rivals.find(item => item?.id === id) || null;
  return rivals?.[id] || null;
}

function captureRestPosition(target) {
  if (Array.isArray(target?.restPosition) && target.restPosition.length >= 3) {
    return target.restPosition.slice(0, 3).map(value => finite(value));
  }
  const rest = [finite(target?.position?.x), finite(target?.position?.y), finite(target?.position?.z)];
  if (target) target.restPosition = rest;
  return rest;
}

function normalizeRig(value, label) {
  if (!value) return null;
  if (!value.body?.position || !value.body?.quaternion) {
    throw new TypeError(`${label}.body requiere position y quaternion`);
  }
  return {
    body: value.body,
    wheelsById: value.wheelsById || {},
    applyWheels: typeof value.applyWheels === 'function' ? value.applyWheels : null,
  };
}

function applyRig(rig, previous, current, interpolation) {
  if (!rig || !previous || !current) return null;
  const snapshot = interpolateVehicleSnapshot(previous, current, interpolation);
  if (!snapshot) return null;
  setVector3(rig.body.position, snapshot.chassis.position);
  setQuaternion(rig.body.quaternion, snapshot.chassis.rotation);
  const wheels = {};
  if (rig.applyWheels) rig.applyWheels(previous, current, clamp(finite(interpolation, 1), 0, 1), snapshot);
  else {
    for (const wheel of snapshot.wheels) {
      const target = rig.wheelsById[wheel.id];
      if (!target) continue;
      const rest = captureRestPosition(target);
      setVector3(target.position, [rest[0], rest[1] - finite(wheel.compressionM), rest[2]]);
      if (target.rotation) {
        target.rotation.y = finite(wheel.steerAngleRad);
        target.rotation.z = finite(wheel.rotationRad);
      }
      wheels[wheel.id] = {
        rotationRad: finite(wheel.rotationRad),
        steerAngleRad: finite(wheel.steerAngleRad),
        compressionM: finite(wheel.compressionM),
      };
    }
  }
  return freeze({
    position: [...snapshot.chassis.position],
    rotation: [...snapshot.chassis.rotation],
    wheels,
  });
}

export function createPhysicalRenderBridge(options = {}) {
  const player = normalizeRig(options.player, 'player');
  if (!player) throw new TypeError('createPhysicalRenderBridge requiere player');
  const falcon = normalizeRig(options.falcon, 'falcon');
  const trackRoots = (Array.isArray(options.trackRoots) ? options.trackRoots : [])
    .filter(Boolean);
  let applyCount = 0;
  let resetCount = 0;
  let originShiftCount = 0;
  let referenceFrameCount = 0;
  let disposed = false;
  const trace = [];

  function missingWheelVisuals(rig) {
    if (!rig || rig.applyWheels) return [];
    return WHEEL_IDS.filter(id => !rig.wheelsById[id]);
  }

  function apply(renderFrame, forceCurrent = false) {
    if (disposed) return false;
    const alpha = forceCurrent ? 1 : clamp(finite(renderFrame?.alpha, 1), 0, 1);
    const playerResult = applyRig(
      player,
      forceCurrent ? renderFrame?.currentSnapshot : renderFrame?.previousSnapshot,
      renderFrame?.currentSnapshot,
      alpha,
    );
    const falconFrame = frameForRival(renderFrame, 'falcon');
    const falconAlpha = forceCurrent ? 1 : clamp(finite(falconFrame?.alpha, alpha), 0, 1);
    const falconResult = applyRig(
      falcon,
      forceCurrent ? falconFrame?.currentSnapshot : falconFrame?.previousSnapshot,
      falconFrame?.currentSnapshot,
      falconAlpha,
    );
    if (falcon?.body && 'visible' in falcon.body) falcon.body.visible = Boolean(falconResult);
    applyCount += 1;
    const result = freeze({ player: playerResult, falcon: falconResult, alpha });
    trace.push(freeze({
      applyCount,
      forceCurrent: Boolean(forceCurrent),
      playerPosition: playerResult?.position ? [...playerResult.position] : null,
      falconPosition: falconResult?.position ? [...falconResult.position] : null,
      alpha,
    }));
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
    return result;
  }

  return Object.freeze({
    apply,
    reset(renderFrame) {
      if (disposed) return false;
      resetCount += 1;
      return apply(renderFrame, true);
    },
    applyReferenceFrame(transform) {
      if (disposed) return false;
      if (!transform || !['point','rotation'].every(key=>typeof transform[key]==='function')) throw new TypeError('render reference transform is required');
      const nodes=new Set([...trackRoots,player.body,falcon?.body].filter(Boolean));
      for (const node of nodes) {
        let parent=node.parent,inherited=false;while(parent){if(nodes.has(parent)){inherited=true;break;}parent=parent.parent;}if(inherited)continue;
        if(node.getWorldPosition&&node.position.clone&&node.getWorldQuaternion&&node.quaternion.clone){
          node.updateWorldMatrix?.(true,false);const p=node.getWorldPosition(node.position.clone()),q=node.getWorldQuaternion(node.quaternion.clone());
          p.fromArray(transform.point(p.toArray()));q.fromArray(transform.rotation(q.toArray()));
          if(node.parent){node.parent.worldToLocal(p);q.premultiply(node.parent.getWorldQuaternion(q.clone()).invert());}
          node.position.copy(p);node.quaternion.copy(q);
        }else{
          setVector3(node.position,transform.point([finite(node.position?.x),finite(node.position?.y),finite(node.position?.z)]));
          if(node.quaternion)setQuaternion(node.quaternion,transform.rotation([finite(node.quaternion.x),finite(node.quaternion.y),finite(node.quaternion.z),finite(node.quaternion.w,1)]));
        }
        node.matrixWorldNeedsUpdate=true;node.updateMatrixWorld?.(true);
      }
      for(let i=0;i<trace.length;i++)trace[i]=freeze({...trace[i],playerPosition:trace[i].playerPosition?transform.point(trace[i].playerPosition):null,falconPosition:trace[i].falconPosition?transform.point(trace[i].falconPosition):null});
      referenceFrameCount++;return true;
    },
    applyOriginShift(value) {
      if (disposed) return false;
      const shift = vector(value, 3, [0, 0, 0]);
      for (const root of trackRoots) {
        setVector3(root.position, [
          finite(root.position?.x) + shift[0],
          finite(root.position?.y) + shift[1],
          finite(root.position?.z) + shift[2],
        ]);
        root.matrixWorldNeedsUpdate = true;
        root.updateMatrixWorld?.(true);
      }
      originShiftCount += 1;
      return true;
    },
    diagnostics() {
      return freeze({
        disposed,
        applyCount,
        resetCount,
        originShiftCount,
        referenceFrameCount,
        trackRootCount: trackRoots.length,
        player: { missingWheelVisuals: missingWheelVisuals(player) },
        falcon: falcon ? { missingWheelVisuals: missingWheelVisuals(falcon) } : null,
        trace: [...trace],
      });
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      return true;
    },
  });
}

export { WHEEL_IDS };
