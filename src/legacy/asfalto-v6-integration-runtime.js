
(function exposeAsfaltoV6Integration(root) {
  'use strict';

  const FIXED_DT = 1 / 120;
  const EPSILON = 1e-9;
  const MAX_FRAME_SECONDS = 0.25;
  const FALSE_START_PENALTY_SECONDS = 2;

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function nowMs() {
    return typeof root.performance?.now === 'function'
      ? root.performance.now()
      : Date.now();
  }

  function percentile(sorted, ratio) {
    if (!sorted.length) return 0;
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
    return sorted[index];
  }

  function vector3(value) {
    return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)
      ? value.slice(0, 3) : null;
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function cross3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  function normalize3(value) {
    const vector = vector3(value);
    const length = vector ? Math.hypot(...vector) : 0;
    return length > 1e-9 ? vector.map(component => component / length) : null;
  }

  function cloneRouteFrame(value) {
    const tangent = vector3(value?.tangent);
    const left = vector3(value?.left);
    const normal = vector3(value?.normal);
    return tangent && left && normal ? { tangent, left, normal } : null;
  }

  function freezeDeep(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freezeDeep(child);
    return Object.freeze(value);
  }

  function quaternionFromRouteFrame(frame) {
    const tangent = normalize3(frame?.tangent);
    const normalSource = normalize3(frame?.normal);
    const legacyLeft = normalize3(frame?.left);
    if (!tangent || !normalSource || !legacyLeft) throw new TypeError('respawn route frame is incomplete');
    const normalAlongTangent = dot3(normalSource, tangent);
    const normal = normalize3(normalSource.map(
      (value, index) => value - tangent[index] * normalAlongTangent,
    ));
    const routeRight = normal && normalize3(cross3(tangent, normal));
    if (!normal || !routeRight || dot3(routeRight, legacyLeft) < 0.999) {
      throw new TypeError('respawn route frame handedness is invalid');
    }
    const m00 = tangent[0];
    const m01 = normal[0];
    const m02 = routeRight[0];
    const m10 = tangent[1];
    const m11 = normal[1];
    const m12 = routeRight[1];
    const m20 = tangent[2];
    const m21 = normal[2];
    const m22 = routeRight[2];
    const trace = m00 + m11 + m22;
    let quaternion;
    if (trace > 0) {
      const scale = Math.sqrt(trace + 1) * 2;
      quaternion = [(m21 - m12) / scale, (m02 - m20) / scale, (m10 - m01) / scale, scale / 4];
    } else if (m00 > m11 && m00 > m22) {
      const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
      quaternion = [scale / 4, (m01 + m10) / scale, (m02 + m20) / scale, (m21 - m12) / scale];
    } else if (m11 > m22) {
      const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
      quaternion = [(m01 + m10) / scale, scale / 4, (m12 + m21) / scale, (m02 - m20) / scale];
    } else {
      const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
      quaternion = [(m02 + m20) / scale, (m12 + m21) / scale, scale / 4, (m10 - m01) / scale];
    }
    const length = Math.hypot(...quaternion) || 1;
    return quaternion.map(value => value / length);
  }

  function physicalRespawnFrame(respawn) {
    const position = vector3(respawn?.position);
    const normal = normalize3(respawn?.frame?.normal);
    if (!position || !normal) throw new TypeError('respawn position is incomplete');
    const clearanceM = Math.max(0, finite(respawn?.clearanceM, 0.56));
    const chassisPosition = position.map(
      (value, index) => value + normal[index] * clearanceM,
    );
    return {
      s: finite(respawn?.sM, finite(respawn?.raceProgressM, 0)),
      x: chassisPosition[0],
      y: chassisPosition[1],
      z: chassisPosition[2],
      position: chassisPosition,
      rotation: quaternionFromRouteFrame(respawn.frame),
    };
  }

  function projectionEvidence(raw, snapshot) {
    const routePosition = vector3(raw?.routePosition);
    const routeFrame = cloneRouteFrame(raw?.routeFrame);
    const chassisPosition = vector3(snapshot?.chassis?.position);
    const normal = normalize3(routeFrame?.normal);
    const signedSeparationM = routePosition && chassisPosition && normal
      ? dot3(chassisPosition.map((value, index) => value - routePosition[index]), normal)
      : null;
    return {
      continuous: raw?.continuous === true,
      distanceM: Number.isFinite(raw?.distanceM) ? raw.distanceM : null,
      routePosition,
      routeFrame,
      segmentIndex: Number.isFinite(raw?.segmentIndex) ? raw.segmentIndex : null,
      routeHalfWidthM: Number.isFinite(raw?.routeHalfWidthM) ? raw.routeHalfWidthM : null,
      signedSeparationM,
    };
  }

  function cloneProjection(value) {
    return {
      s: value.s,
      raceProgress: value.raceProgress,
      lateral: value.lateral,
      headingError: value.headingError,
      yawRate: value.yawRate,
      lateralSpeedMps: value.lateralSpeedMps,
      speedAlongRouteMps: value.speedAlongRouteMps,
      surface: value.surface,
      grip: value.grip,
      slip: value.slip,
      valid: value.valid,
      jumpRejected: value.jumpRejected,
      trackLengthM: value.trackLengthM,
      sourceSM: value.sourceSM,
      lap: value.lap,
      referenceChart: value.referenceChart,
      continuous: value.continuous,
      distanceM: value.distanceM,
      routePosition: vector3(value.routePosition),
      routeFrame: cloneRouteFrame(value.routeFrame),
      segmentIndex: value.segmentIndex,
      routeHalfWidthM: value.routeHalfWidthM,
      signedSeparationM: value.signedSeparationM,
    };
  }

  function createOwnedAbortController() {
    if (typeof root.AbortController === 'function') {
      return new root.AbortController();
    }
    const listeners = new Set();
    const signal = {
      aborted: false,
      reason: undefined,
      addEventListener(type, listener) {
        if (type === 'abort' && typeof listener === 'function') listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type === 'abort') listeners.delete(listener);
      },
    };
    return {
      signal,
      abort(reason) {
        if (signal.aborted) return;
        signal.aborted = true;
        signal.reason = reason;
        for (const listener of [...listeners]) listener.call(signal, { type: 'abort', target: signal });
        listeners.clear();
      },
    };
  }

  function initialProjection(track) {
    return {
      s: 0,
      raceProgress: 0,
      lateral: 0,
      headingError: 0,
      yawRate: 0,
      lateralSpeedMps: 0,
      speedAlongRouteMps: 0,
      surface: 'asphalt',
      grip: 1,
      slip: 0,
      valid: true,
      jumpRejected: false,
      trackLengthM: finite(track?.length, 0),
    };
  }

  function normalizeProjection(raw, track, previous, snapshot) {
    const evidence = projectionEvidence(raw, snapshot);
    const rawProjection = {
      ...(raw || {}),
      ...evidence,
      lateralM: finite(raw?.lateralM, finite(raw?.lateral, 0)),
      valid: raw?.valid === true,
      jumpRejected: raw?.jumpRejected === true,
    };
    if (!raw || raw.valid === false || raw.jumpRejected === true) {
      return {
        projection: { ...cloneProjection(previous), ...evidence },
        rawProjection,
        rejected: true,
      };
    }
    const open = track?.closed === false;
    const length = Math.max(0, finite(track?.length, 0));
    const rawS = finite(raw.s, previous.s);
    const rawProgress = finite(raw.raceProgress, rawS);
    const s = open ? clamp(rawS, 0, length) : rawS;
    const raceProgress = open ? clamp(rawProgress, 0, length) : rawProgress;
    return {
      projection: {
        s,
        raceProgress,
        lateral: finite(raw.lateral, previous.lateral),
        headingError: finite(raw.headingError, previous.headingError),
        yawRate: finite(raw.yawRate, previous.yawRate),
        lateralSpeedMps: finite(raw.lateralSpeedMps, previous.lateralSpeedMps),
        speedAlongRouteMps: finite(raw.speedAlongRouteMps, previous.speedAlongRouteMps),
        surface: typeof raw.surface === 'string' ? raw.surface : previous.surface,
        grip: clamp(finite(raw.grip, previous.grip), 0, 2),
        slip: clamp(finite(raw.slip, previous.slip), 0, 2),
        valid: true,
        jumpRejected: false,
        trackLengthM: length,
        ...evidence,
      },
      rawProjection,
      rejected: false,
    };
  }

  function safeInput(input) {
    return {
      steer: clamp(finite(input?.steer, 0), -0.65, 0.65),
      handwheelAngleRad: finite(input?.handwheelAngleRad, 0),
      throttle: clamp(finite(input?.throttle, 0), 0, 1),
      brake: clamp(finite(input?.brake, 0), 0, 1),
      handbrake: clamp(finite(input?.handbrake, 0), 0, 1),
      clutchEngagement: clamp(finite(input?.clutchEngagement, 1), 0, 1),
      requestedGear: Number.isInteger(input?.requestedGear) ? input.requestedGear : undefined,
    };
  }

  function qaPhysicalRouteInput(driverCommand, projection, track) {
    const progressM = finite(projection?.raceProgress, finite(projection?.s, 0));
    const previewSamples = [0, 25, 60, 110].map(offsetM => (
      track?.sample?.(progressM + offsetM) || {}
    ));
    const authoredTargetsMps = previewSamples.map(sample => {
      return finite(sample.targetSpeedKph, 90) / 3.6 * 0.84;
    });
    const previewCurvature = previewSamples.reduce((maximum, sample) => (
      Math.max(maximum, Math.abs(finite(sample.curvature, 0)))
    ), 0.0005);
    const curvatureSpeedMps = Math.sqrt(0.58 * 9.81 / previewCurvature);
    let targetSpeedMps = clamp(
      Math.min(12, curvatureSpeedMps, ...authoredTargetsMps), 5, 12,
    );
    const lateralM = finite(projection?.lateral, 0);
    const headingErrorRad = finite(projection?.headingError, 0);
    const lateralSpeedMps = finite(projection?.lateralSpeedMps, 0);
    const outsideLane = Math.abs(lateralM) > 1.6;
    if (outsideLane) targetSpeedMps = Math.min(targetSpeedMps, 7);
    if (Math.abs(lateralM) > 2.6) targetSpeedMps = Math.min(targetSpeedMps, 5);
    const speedMps = Math.abs(finite(projection?.speedAlongRouteMps, 0));
    const speedErrorMps = targetSpeedMps - speedMps;
    const overspeedMps = -speedErrorMps;
    const braking = overspeedMps > 0.5;
    const coasting = overspeedMps > 0.5;
    const driverBrake = clamp(finite(driverCommand?.brake, 0), 0, 0.58);
    const throttle = braking || coasting || driverBrake > 0.04
      ? 0
      : Math.min(
        clamp(finite(driverCommand?.throttle, 0), 0, 1),
        clamp(0.36 + speedErrorMps / 7, 0, 1),
      );
    const brake = braking
      ? Math.max(driverBrake, clamp(0.55 + overspeedMps / 6, 0, 1))
      : driverBrake;
    const signedCurvature = previewSamples.reduce((sum, sample, index) => (
      sum + finite(sample.curvature, 0) * [0.46, 0.3, 0.17, 0.07][index]
    ), 0);
    return safeInput({
      steer: Math.atan(2.819 * signedCurvature)
        - headingErrorRad * 1.4
        - lateralM * 0.18
        - lateralSpeedMps * 0.035,
      throttle,
      brake,
      handbrake: 0,
      clutchEngagement: speedMps < 3 ? 1 : finite(driverCommand?.clutch, 1),
      requestedGear: speedMps < 3 ? 1 : driverCommand?.requestedGear,
    });
  }

  function cloneState(state) {
    return {
      ...state,
      camera: state.camera ? { ...state.camera } : {},
      rivals: Array.isArray(state.rivals) ? state.rivals.map((rival) => ({ ...rival })) : [],
      ghostSamples: Array.isArray(state.ghostSamples)
        ? state.ghostSamples.map((sample) => ({ ...sample }))
        : [],
      currentSectorTimes: Array.isArray(state.currentSectorTimes)
        ? [...state.currentSectorTimes]
        : [],
      lastSectorTimes: Array.isArray(state.lastSectorTimes)
        ? [...state.lastSectorTimes]
        : [],
      bestSectorTimes: Array.isArray(state.bestSectorTimes)
        ? [...state.bestSectorTimes]
        : [],
      events: Array.isArray(state.events) ? state.events.map((event) => (
        event?.type === 'recover' ? Object.freeze({ ...event }) : { ...event }
      )) : [],
      speedTrap: state.speedTrap ? { ...state.speedTrap } : {},
      sectorPractice: state.sectorPractice ? { ...state.sectorPractice } : {},
      track: state.track
        ? {
          ...state.track,
          checkpoints: Array.isArray(state.track.checkpoints) ? [...state.track.checkpoints] : [],
          speedTrap: state.track.speedTrap ? { ...state.track.speedTrap } : {},
        }
        : null,
      settings: state.settings
        ? {
          ...state.settings,
          assists: state.settings.assists ? { ...state.settings.assists } : {},
        }
        : {},
      projection: state.projection ? { ...state.projection } : null,
    };
  }

  function identityMatrixElements() {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }

  function transformRoutePoint(elements, point) {
    const matrix = elements?.length >= 16 ? elements : identityMatrixElements();
    const x = finite(point?.x, 0);
    const y = finite(point?.y, 0);
    const z = finite(point?.z, 0);
    const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    const divisor = Math.abs(w) > 1e-12 ? w : 1;
    return {
      x: (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / divisor,
      y: (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / divisor,
      z: (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / divisor,
    };
  }

  function transformRouteDirection(elements, direction) {
    const vector = vector3(direction);
    if (!vector) return null;
    const matrix = elements?.length >= 16 ? elements : identityMatrixElements();
    return normalize3([
      matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2],
      matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2],
      matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2],
    ]);
  }

  function buildWorldRouteSamples(track, collisionRoot) {
    collisionRoot.updateMatrixWorld?.(true);
    const elements = collisionRoot.matrixWorld?.elements || identityMatrixElements();
    const lengthM = Math.max(1, finite(track?.length, 1));
    const stepM = 5;
    const samples = [];
    for (let s = 0; s < lengthM; s += stepM) {
      samples.push({ ...transformRoutePoint(elements, track.sample(s)), s });
    }
    samples.push({
      ...transformRoutePoint(elements, track.sample(lengthM)),
      s: lengthM,
    });
    return samples;
  }

  function segmentAtProgress(samples, progress) {
    const s = clamp(finite(progress, 0), 0, samples[samples.length - 1].s);
    let low = 0;
    let high = samples.length - 1;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (samples[middle].s <= s) low = middle;
      else high = middle;
    }
    const a = samples[low];
    const b = samples[Math.min(low + 1, samples.length - 1)];
    const span = Math.max(1e-9, b.s - a.s);
    const amount = clamp((s - a.s) / span, 0, 1);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const planar = Math.hypot(dx, dz) || 1;
    return {
      s,
      x: a.x + (b.x - a.x) * amount,
      y: a.y + (b.y - a.y) * amount,
      z: a.z + (b.z - a.z) * amount,
      tangentX: dx / planar,
      tangentZ: dz / planar,
      yawRad: Math.atan2(dz, dx),
    };
  }

  function quaternionForward(rotation) {
    const x = finite(rotation?.[0], 0);
    const y = finite(rotation?.[1], 0);
    const z = finite(rotation?.[2], 0);
    const w = finite(rotation?.[3], 1);
    return [
      1 - 2 * (y * y + z * z),
      2 * (x * z - w * y),
    ];
  }

  function wrapAngle(angle) {
    let value = finite(angle, 0);
    while (value > Math.PI) value -= Math.PI * 2;
    while (value < -Math.PI) value += Math.PI * 2;
    return value;
  }

  function averageWheelSlip(snapshot) {
    const wheels = Array.isArray(snapshot?.wheels) ? snapshot.wheels : [];
    if (wheels.length === 0) return 0;
    return clamp(
      wheels.reduce((sum, wheel) => (
        sum + Math.abs(finite(wheel?.slipRatio, 0))
          + Math.abs(finite(wheel?.slipAngleRad, 0))
      ), 0) / wheels.length,
      0,
      2,
    );
  }

  function createBrowserTrackAdapter(
    physicsCore,
    track,
    collisionRoot,
    getEnvironmentState,
    modularAdapter,
  ) {
    const samples = buildWorldRouteSamples(track, collisionRoot);
    let spatialIndex = physicsCore.createRouteSpatialIndex({ samples,closed:track.closed===true });
    let matrix = Array.from(collisionRoot.matrixWorld?.elements || identityMatrixElements());
    let referenceChart = 0;
    let projectionTeleportToken = null;

    function authoredEvidence(route) {
      let authored = null;
      try {
        authored = modularAdapter?.sampleRoute?.(route.s) || null;
      } catch {
        authored = null;
      }
      const segmentIndex = Math.max(
        0,
        Math.min(samples.length - 2, Number.isFinite(route.segmentIndex) ? route.segmentIndex : 0),
      );
      const a = samples[segmentIndex];
      const b = samples[segmentIndex + 1];
      const fallbackTangent = normalize3([b.x - a.x, b.y - a.y, b.z - a.z]) || [1, 0, 0];
      const fallbackLeft = normalize3([-fallbackTangent[2], 0, fallbackTangent[0]]) || [0, 0, 1];
      const fallbackNormal = normalize3(cross3(fallbackLeft, fallbackTangent)) || [0, 1, 0];
      const authoredFrame = authored?.frame;
      const tangent = transformRouteDirection(matrix, authoredFrame?.tangent) || fallbackTangent;
      let left = transformRouteDirection(matrix, authoredFrame?.left) || fallbackLeft;
      const along = dot3(left, tangent);
      left = normalize3(left.map((value, index) => value - tangent[index] * along)) || fallbackLeft;
      let normal = normalize3(cross3(left, tangent)) || fallbackNormal;
      const authoredNormal = transformRouteDirection(matrix, authoredFrame?.normal);
      if (authoredNormal && dot3(normal, authoredNormal) < 0) {
        left = left.map(value => -value);
        normal = normal.map(value => -value);
      }
      const sampledWidthM = Number.isFinite(authored?.widthM)
        ? authored.widthM : finite(track.sample(route.s)?.width, NaN);
      return {
        routePosition: vector3(route.point)
          || (authored?.position ? Object.values(transformRoutePoint(matrix, {
            x: authored.position[0],
            y: authored.position[1],
            z: authored.position[2],
          })) : [a.x, a.y, a.z]),
        routeFrame: { tangent, left, normal },
        routeHalfWidthM: Number.isFinite(sampledWidthM) && sampledWidthM > 0
          ? sampledWidthM * 0.5 : null,
      };
    }

    return {
      get samples() { return samples; },
      get spatialIndex() { return spatialIndex; },
      samplePhysicalRoute(progress) {
        if(!Number.isFinite(progress))throw new TypeError('Physical route progress must be finite');
        const length=samples[samples.length-1].s,s=track.closed?((progress%length)+length)%length:clamp(progress,0,length);
        let lo=0,hi=samples.length-1;while(lo+1<hi){const mid=(lo+hi)>>>1;if(samples[mid].s<=s)lo=mid;else hi=mid;}
        const point=segmentAtProgress(samples,s),evidence=authoredEvidence({s,segmentIndex:lo,point:[point.x,point.y,point.z]});
        return freezeDeep({sM:s,position:evidence.routePosition,frame:evidence.routeFrame,widthM:evidence.routeHalfWidthM*2,referenceChart});
      },
      applyReferenceFrame(transform, options={}) {
        physicsCore.validateReferenceTransform(transform);
        for(let index=0;index<samples.length;index++){
          const sample=samples[index],point=transform.point([sample.x,sample.y,sample.z]);samples[index]={...sample,x:point[0],y:point[1],z:point[2]};
        }
        const next=matrix.slice();for(const start of [0,4,8]){const direction=transform.vector(matrix.slice(start,start+3));next.splice(start,3,...direction);}next.splice(12,3,...transform.point(matrix.slice(12,15)));matrix=next;
        spatialIndex=physicsCore.createRouteSpatialIndex({samples,closed:track.closed===true});
        referenceChart=Number.isSafeInteger(options.referenceChart)?options.referenceChart:referenceChart+1;
        return referenceChart;
      },
      resetProjection() {
        projectionTeleportToken = physicsCore.createProjectionTeleportToken?.() || null;
        return true;
      },
      resolveRespawn(raceProgressM) {
        if (typeof modularAdapter?.resolveRespawn !== 'function') {
          throw new Error('modular track adapter has no authored respawn resolver');
        }
        return modularAdapter.resolveRespawn(raceProgressM);
      },
      resolveQaTeleport(raceProgressM) {
        if (typeof modularAdapter?.sampleRoute !== 'function') {
          throw new Error('modular track adapter has no authored route sampler');
        }
        const sampled = modularAdapter.sampleRoute(raceProgressM);
        const position = vector3(sampled?.position);
        const frame = cloneRouteFrame(sampled?.frame);
        const sM = finite(sampled?.sM, NaN);
        if (!position || !frame || !Number.isFinite(sM)) {
          throw new TypeError('authored QA teleport sample is incomplete');
        }
        return {
          sM,
          raceProgressM: track.closed?raceProgressM:sM,
          position,
          frame,
          lateralM: 0,
          clearanceM: 0.56,
          sectorId: sampled?.sectorId || null,
        };
      },
      safeFrame(progress) {
        const length=samples[samples.length-1].s;
        const requestedProgress = track.closed?((finite(progress)%length)+length)%length:clamp(finite(progress,0),0,length);
        const minimumPhysicalProgressM = track.closed?0:Math.min(6.3,length);
        const physicalProgress = requestedProgress < minimumPhysicalProgressM
          ? minimumPhysicalProgressM : requestedProgress;
        const frame = segmentAtProgress(samples, physicalProgress);
        return {
          s: requestedProgress,
          x: frame.x,
          y: frame.y + 0.56,
          z: frame.z,
          yawRad: -frame.yawRad,
        };
      },
      projectSnapshot(snapshot, context = {}) {
        const chassis = snapshot?.chassis || {};
        const position = chassis.position || [0, 0, 0];
        const prior = finite(track.closed?context.previous?.raceProgress:context.previous?.s,0);
        const route = physicsCore.projectToRoute(
          spatialIndex,
          [finite(position[0], 0), finite(position[1], 0), finite(position[2], 0)],
          prior,
          projectionTeleportToken,
        );
        projectionTeleportToken = null;
        const frame = segmentAtProgress(samples, route.s);
        const evidence = authoredEvidence(route);
        const velocity = chassis.linearVelocity || [0, 0, 0];
        const forward = quaternionForward(chassis.rotation);
        const heading = Math.atan2(forward[1], forward[0]);
        const speedAlongRouteMps = finite(velocity[0], 0) * frame.tangentX
          + finite(velocity[2], 0) * frame.tangentZ;
        const lateralSpeedMps = finite(velocity[0], 0) * -frame.tangentZ
          + finite(velocity[2], 0) * frame.tangentX;
        const environment = getEnvironmentState?.() || {};
        const rain = environment.rain?.visible
          ? clamp(finite(environment.rain.intensity, 0), 0, 1)
          : 0;
        const onRoad = Number.isFinite(evidence.routeHalfWidthM)
          && Math.abs(route.lateral) <= evidence.routeHalfWidthM;
        const signedSeparationM = dot3(
          [position[0], position[1], position[2]].map(
            (value, index) => finite(value, 0) - evidence.routePosition[index],
          ),
          evidence.routeFrame.normal,
        );
        return {
          s: route.s,
          referenceChart,
          raceProgress: track.closed?finite(route.raceProgress,route.s):route.s,
          lateral: route.lateral,
          headingError: wrapAngle(heading - route.headingRad),
          yawRate: -finite(chassis.angularVelocity?.[1], 0),
          lateralSpeedMps,
          speedAlongRouteMps,
          surface: onRoad ? 'asphalt' : 'grass',
          grip: (onRoad ? 0.92 : 0.55) * (1 - rain * 0.34),
          slip: averageWheelSlip(snapshot),
          valid: route.distanceM < 120,
          jumpRejected: route.jumpRejected,
          continuous: route.jumpRejected !== true,
          distanceM: route.distanceM,
          routePosition: evidence.routePosition,
          routeFrame: evidence.routeFrame,
          segmentIndex: route.segmentIndex,
          routeHalfWidthM: evidence.routeHalfWidthM,
          signedSeparationM,
        };
      },
    };
  }

  function modularSpawnFrame(
    trackAdapter,
    kind,
    fallback,
    clearanceM = 0.56,
    minimumProgressM = 0,
  ) {
    if (typeof trackAdapter?.getSpawn !== 'function') return fallback;
    let spawn = trackAdapter.getSpawn(kind);
    const authoredProgressM = finite(spawn?.progress?.sM, fallback?.s || 0);
    if (authoredProgressM < minimumProgressM && typeof trackAdapter?.sampleRoute === 'function') {
      const route = trackAdapter.sampleRoute(minimumProgressM);
      if (Array.isArray(route?.position) && Array.isArray(route?.frame?.tangent)) {
        spawn = {
          ...spawn,
          position: route.position.map((value,axis)=>value+finite(spawn?.grid?.lateralM,0)*finite(route.frame.left?.[axis],0)),
          frame: route.frame,
          progress: { ...(spawn?.progress || {}), sM: minimumProgressM },
        };
      }
    }
    const position = spawn?.position;
    const tangent = spawn?.frame?.tangent;
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)
        || !Array.isArray(tangent) || tangent.length !== 3 || !tangent.every(Number.isFinite)) {
      throw new TypeError('spawn modular ' + kind + ' invalido');
    }
    return {
      s: finite(spawn?.progress?.sM, fallback?.s || 0),
      x: position[0],
      y: position[1] + clearanceM,
      z: position[2],
      yawRad: (-Math.atan2(tangent[2], tangent[0])) || 0,
    };
  }

  function createEnvironmentAdapter(getEnvironmentState, trackAdapter) {
    return (query = {}) => {
      const state = getEnvironmentState?.() || {};
      const rain = state.rain?.visible
        ? clamp(finite(state.rain.intensity, 0), 0, 1)
        : 0;
      let routeSurface = null;
      if (trackAdapter && typeof trackAdapter.surfaceAt === 'function' && Array.isArray(query.worldPosition)) {
        try { routeSurface = trackAdapter.surfaceAt(query.worldPosition); } catch { routeSurface = null; }
      }
      const surface = routeSurface?.surface || 'road';
      const baseMu = surface === 'road' ? 1 : surface === 'shoulder' ? 0.72 : 0.55;
      const surfaceCondition = state.surfaceCondition || null;
      const gripMultiplier = surfaceCondition
        ? clamp(finite(surfaceCondition.gripMultiplier, 1), 0.35, 1.15)
        : 1 - rain * 0.34;
      const aquaplaningEnabled = surfaceCondition?.aquaplaningEnabled === true;
      return {
        surface: surface === 'road' ? 'asphalt' : surface === 'shoulder' ? 'gravel' : 'grass',
        mu: clamp(baseMu * gripMultiplier, 0.35, 1.15),
        gripMultiplier,
        waterDepthM: aquaplaningEnabled
          ? clamp(finite(surfaceCondition.looseSurfaceDepthM, 0), 0, 0.05)
          : surfaceCondition ? 0 : rain * 0.006,
        surfaceState: surfaceCondition?.state || null,
        wetness: clamp(finite(surfaceCondition?.wetness, surfaceCondition?.state === 'wet' ? 1 : surfaceCondition?.state === 'damp' ? .5 : rain), 0, 1),
        rollingResistanceMultiplier: surfaceCondition
          ? clamp(finite(surfaceCondition.rollingResistanceMultiplier, 1), 0.5, 2)
          : 1,
        aquaplaningEnabled,
        airDensityKgPm3: 1.2,
      };
    };
  }

  function resolveChassisConfig(options) {
    if (!root.AsfaltoV6Chassis) return null;
    let value = options?.chassisConfig;
    if (value === undefined) {
      try {
        const storage = options?.storage || globalThis.__asfaltoV7Storage;
        value = JSON.parse(storage?.getItem?.('chevy-serie2-v6-profile') || 'null')?.chassis || null;
      } catch { value = null; }
    }
    return value ? root.AsfaltoV6Chassis.sanitizeChassisConfig(value) : null;
  }

  function resolveVehicleProfile(options) {
    if (options?.vehicleProfile === 'restomod') return 'restomod';
    if (options?.vehicleProfile === 'original') return 'original';
    try {
      const storage = options?.storage || globalThis.__asfaltoV7Storage;
      const parsed = JSON.parse(
        storage?.getItem?.('asfalto-nacional-v6-profile') || 'null',
      );
      return parsed?.physicsProfile === 'restomod' ? 'restomod' : 'original';
    } catch {
      return 'original';
    }
  }

  async function createBrowserPhysicalStack(options) {
    const RAPIER = options?.RAPIER || root.AsfaltoV6Rapier;
    const vehicleCore = options?.vehicleCore || root.AsfaltoV6VehicleCore;
    const physicsCore = options?.physicsCore || root.AsfaltoV6Physics;
    const falconCore = options?.falconCore || root.AsfaltoV6Falcon;
    if (!RAPIER?.World || !vehicleCore || !physicsCore || !falconCore) {
      throw new Error('modulos fisicos v6 incompletos');
    }
    if (!options?.track?.sample || !options?.collisionRoot) {
      throw new Error('pista fisica v6 incompleta');
    }
    if (typeof RAPIER.init === 'function') await RAPIER.init();
    const vehicleProfile = resolveVehicleProfile(options);
    const vehicleSpec = vehicleProfile === 'restomod'
      ? vehicleCore.CHEVY_RESTOMOD_SPEC
      : vehicleCore.CHEVY_ORIGINAL_SPEC;
    if (!vehicleSpec) {
      throw new Error('perfil fisico v6 incompleto');
    }
    const visualCollisionRoot = () => options.trackAdapter?.visualRoot || options.visualRoot || null;
    let visualGroundAvailable=false,visualTerrainAvailable=false,visualShouldersAvailable=false;
    visualCollisionRoot()?.traverse?.(node=>{
      if(physicsCore.sceneCollisionRole?.(node)!=='ground')return;
      visualGroundAvailable=true;
      const name=String(node.name||'').toLowerCase();
      if(/terrain/.test(name))visualTerrainAvailable=true;
      if(/shoulder/.test(name))visualShouldersAvailable=true;
    });
    let authoredBoundaryTriangleCount=0;const authoredContactMaterials=new Set();
    let boundaryTriangles = null;
    try {
      boundaryTriangles = physicsCore.collectCollisionTriangles(
        options.THREE || {},
        options.collisionRoot,
        {
          includeMesh(node) {
            const name = String(node?.name || '').toLowerCase();
            const boundary=/(guardrail|barrier|track[_\-\s]?limit|wall)/.test(name);
            if(boundary)authoredBoundaryTriangleCount+=(node.geometry?.index?.count||node.geometry?.attributes?.position?.count||0)/3;
            if(/mist|trigger|sensor|checkpoint/.test(name))return false;
            if(!boundary&&/(?:^|[_\-\s])(road|asphalt)(?:[_\-\s]|$)/.test(name))return false;
            if(visualTerrainAvailable&&/terrain|shoulder|ground/.test(name))return false;
            if(visualShouldersAvailable&&/shoulder/.test(name))return false;
            authoredContactMaterials.add(/guardrail|steel|metal/.test(name)?'metal':/rock|boulder/.test(name)?'stone':/terrain|shoulder|ground/.test(name)?'soil':'unknown');
            return true;
          },
        },
      );
    } catch (error) {
      if (!/no contiene triangulos/.test(String(error?.message || ''))) throw error;
    }
    const endpointMarginM = Math.max(0, finite(vehicleSpec.dimensionsM?.length, 0));
    const routeTriangles = physicsCore.buildRouteRibbonTriangles(
      options.track,
      { stepM: 5, endpointMarginM },
    );
    let playerWorld = null;
    let rivalWorld = null;
    let suspensionWorld = null;
    const authoredContactMaterial=authoredContactMaterials.size===1?[...authoredContactMaterials][0]:'unknown';
    let sceneCollisionLayer = null;
    let physicsSession = null;
    let rivalSession = null;
    let disposalStarted = false;
    let disposalPromise = null;
    function disposeOwnedStack() {
      if (disposalStarted) return disposalPromise.then(() => false);
      disposalStarted = true;
      disposalPromise = (async () => {
        const failures = [];
        const cleanupSteps = [
          () => physicsSession?.dispose?.(),
          () => rivalSession?.dispose?.(),
          () => sceneCollisionLayer?.dispose?.(),
          () => playerWorld?.free?.(),
          () => rivalWorld?.free?.(),
          () => suspensionWorld?.free?.(),
        ];
        for (const cleanup of cleanupSteps) {
          try {
            await cleanup();
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length) {
          throw new AggregateError(failures, 'physical stack cleanup failed');
        }
        return true;
      })();
      return disposalPromise;
    }
    try {
    playerWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    rivalWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    suspensionWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    playerWorld.timestep = FIXED_DT;
    rivalWorld.timestep = FIXED_DT;
    suspensionWorld.timestep = FIXED_DT;
    if (boundaryTriangles) {
      physicsCore.createRapierTrackCollider(RAPIER, playerWorld, boundaryTriangles, {material:authoredContactMaterial});
    }
    physicsCore.createRapierTrackCollider(RAPIER, playerWorld, routeTriangles, {material:'asphalt'});
    if (boundaryTriangles) {
      physicsCore.createRapierTrackCollider(RAPIER, rivalWorld, boundaryTriangles, {material:authoredContactMaterial});
    }
    physicsCore.createRapierTrackCollider(RAPIER, rivalWorld, routeTriangles, {material:'asphalt'});
    physicsCore.createRapierTrackCollider(RAPIER, suspensionWorld, routeTriangles, {material:'asphalt'});
    if(boundaryTriangles)physicsCore.createRapierTrackCollider(RAPIER,suspensionWorld,boundaryTriangles,{material:authoredContactMaterial});
    sceneCollisionLayer=physicsCore.createSceneCollisionLayer?.(RAPIER,[playerWorld,rivalWorld,suspensionWorld],visualCollisionRoot)||null;
    sceneCollisionLayer?.refresh({force:true});
    const trackAdapter = createBrowserTrackAdapter(
      physicsCore,
      options.track,
      options.collisionRoot,
      options.getEnvironmentState,
      options.trackAdapter,
    );
    const environment = createEnvironmentAdapter(options.getEnvironmentState, options.trackAdapter);
    playerWorld.step();
    rivalWorld.step();
    suspensionWorld.step();
    const falconSpec = vehicleCore.FALCON_CALIBRATED_SPEC;
    const falconRearContactM = falconSpec.wheelbaseM * falconSpec.frontWeightFraction
      + falconSpec.wheelRadiusM;
    const playerMinimumProgressM = 8.3; // >=1.5 m bumper gap to the measured Falcon hull at s=2.05.
    const initialFrame = modularSpawnFrame(
      options.trackAdapter,
      'chevy',
      trackAdapter.safeFrame(0),
      vehicleSpec.cgHeightM,
      playerMinimumProgressM,
    );
    const initialRay = new RAPIER.Ray(
      { x: initialFrame.x, y: initialFrame.y + 5, z: initialFrame.z },
      { x: 0, y: -1, z: 0 },
    );
    const initialHit = playerWorld.castRayAndGetNormal(initialRay, 20, true);
    const initialGroundProbe = initialHit ? Object.freeze({
      hit: true,
      distanceM: initialHit.timeOfImpact,
      groundY: initialFrame.y + 5 - initialHit.timeOfImpact,
      normal: Object.freeze([
        finite(initialHit.normal?.x, 0), finite(initialHit.normal?.y, 0), finite(initialHit.normal?.z, 0),
      ]),
    }) : Object.freeze({ hit: false });
    physicsSession = new physicsCore.VehiclePhysicsSession({
      RAPIER,
      world: playerWorld,
      suspensionWorld,
      core: vehicleCore,
      spec: vehicleSpec,
      chassisConfig: resolveChassisConfig(options),
      spawn: initialFrame,
      environment,
    });
    const initialWheelContacts = Object.freeze(
      physicsSession._collectContacts({ steer: 0 }).contacts.map((contact, index) => Object.freeze({
        id: physicsSession.wheels[index].id,
        contact: contact.contact,
        compressionM: contact.compressionM,
        point: Object.freeze(contact.point.slice()),
        normal: Object.freeze(contact.normal.slice()),
      })),
    );

    const falconSpawn = modularSpawnFrame(
      options.trackAdapter,
      'falcon',
      trackAdapter.safeFrame(Math.min(12, options.track.length)),
      falconSpec.cgHeightM,
      falconRearContactM + 0.25,
    );
    rivalSession = new physicsCore.VehiclePhysicsSession({
      RAPIER,
      world: rivalWorld,
      suspensionWorld,
      core: vehicleCore,
      spec: vehicleCore.FALCON_CALIBRATED_SPEC,
      spawn: falconSpawn,
      environment,
    });
    const falconHalfYaw = (Number(falconSpawn.yawRad) || 0) * 0.5;
    const falconProxyBody = playerWorld.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(falconSpawn.x, falconSpawn.y, falconSpawn.z)
        .setRotation({ x: 0, y: Math.sin(falconHalfYaw), z: 0, w: Math.cos(falconHalfYaw) }),
    );
    const falconProxyCollider = playerWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(
        (2.05724+2.57872)*.5,
        vehicleCore.FALCON_CALIBRATED_SPEC.dimensionsM.height * 0.25,
        (.91248+.90828)*.5,
      ).setTranslation((2.05724-2.57872)*.5,-.02,(.91248-.90828)*.5).setFriction(0.04).setRestitution(0.04),
      falconProxyBody,
    );
    let trafficProjection = null;
    const physicalRival = falconCore.createFalconRival({
      physicsSession: rivalSession,
      track: options.track,
      trackAdapter,
      seed: 1973,
      getTrafficState:()=>{const snapshot=physicsSession.getSnapshot();trafficProjection=trackAdapter.projectSnapshot(snapshot,{previous:trafficProjection});return {snapshot,projection:trafficProjection};},
      wheelbaseM: vehicleCore.FALCON_CALIBRATED_SPEC.wheelbaseM,
    });
    function syncFalconProxy(state) {
      const snapshot = state?.snapshot || physicalRival.getState?.().snapshot;
      const position = snapshot?.chassis?.position;
      const rotation = snapshot?.chassis?.rotation;
      if (!Array.isArray(position) || position.length !== 3
          || !Array.isArray(rotation) || rotation.length !== 4) return false;
      falconProxyBody.setNextKinematicTranslation({
        x: Number(position[0]) || 0,
        y: Number(position[1]) || 0,
        z: Number(position[2]) || 0,
      });
      falconProxyBody.setNextKinematicRotation({
        x: Number(rotation[0]) || 0,
        y: Number(rotation[1]) || 0,
        z: Number(rotation[2]) || 0,
        w: Number.isFinite(Number(rotation[3])) ? Number(rotation[3]) : 1,
      });
      return true;
    }
    let falconContactLatched = false;
    let falconContactActive = false;
    falconProxyCollider.setEnabled?.(false);
    function localContactPoint(session, otherPosition) {
      const position = session.body.translation();
      const rotation = session.body.rotation();
      const dx = finite(otherPosition?.x, 0) - finite(position.x, 0);
      const dz = finite(otherPosition?.z, 0) - finite(position.z, 0);
      const forwardX = 1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z);
      const forwardZ = 2 * (rotation.x * rotation.z - rotation.w * rotation.y);
      const sideX = 2 * (rotation.x * rotation.z + rotation.w * rotation.y);
      const sideZ = 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y);
      const localX = dx * forwardX + dz * forwardZ;
      const localZ = dx * sideX + dz * sideZ;
      return [
        Math.sign(localX || 1) * session.spec.dimensionsM.length * 0.42,
        0,
        Math.sign(localZ || 1) * session.spec.dimensionsM.width * 0.42,
      ];
    }
    function resolveFalconContact() {
      if (!falconContactActive) return false;
      let impulseNs = 0;
      let touching = false;
      for (const collider of physicsSession.colliders) {
        playerWorld.contactPair(collider, falconProxyCollider, (manifold) => {
          touching = true;
          for (let index = 0; index < manifold.numContacts(); index += 1) {
            impulseNs += Math.abs(finite(manifold.contactImpulse(index), 0));
          }
        });
      }
      if (!touching) {
        falconContactLatched = false;
        return false;
      }
      if (falconContactLatched || impulseNs <= 0) return false;
      falconContactLatched = true;
      const playerPosition = physicsSession.body.translation();
      const falconPosition = falconProxyBody.translation();
      const dx = falconPosition.x - playerPosition.x;
      const dz = falconPosition.z - playerPosition.z;
      const distance = Math.hypot(dx, dz) || 1;
      const exchangedImpulse = Math.min(30_000, impulseNs);
      rivalSession.body.applyImpulse({
        x: dx / distance * exchangedImpulse,
        y: 0,
        z: dz / distance * exchangedImpulse,
      }, true);
      physicsSession.applyImpact({
        impulseNs,
        localPointM: localContactPoint(physicsSession, falconPosition),
        otherId: 'falcon',
      });
      physicalRival.applyImpact({
        impulseNs,
        localPointM: localContactPoint(rivalSession, playerPosition),
        otherId: 'chevy',
      });
      return true;
    }
    const stepPlayerPhysics = physicsSession.step.bind(physicsSession);
    physicsSession.step = function stepWithFalconContact(deltaSeconds, controls) {
      stepPlayerPhysics(deltaSeconds, controls);
      resolveFalconContact();
      return physicsSession.getSnapshot();
    };
    const rival = {
      physicsSession: rivalSession,
      setActive(active) {
        falconContactActive = Boolean(active);
        falconProxyCollider.setEnabled?.(falconContactActive);
        if (!falconContactActive) falconContactLatched = false;
        return falconContactActive;
      },
      isActive() {
        return falconContactActive;
      },
      step(deltaSeconds) {
        const state = physicalRival.step(deltaSeconds);
        syncFalconProxy(state);
        return state;
      },
      recover(progress) {
        const recovered = physicalRival.recover(progress);
        syncFalconProxy(physicalRival.getState());
        return recovered;
      },
      reset(frame) {
        physicalRival.recover(frame.s);
        rivalSession.teleport(frame, { x: 0, y: 0, z: 0 });
        const snapshot = rivalSession.getSnapshot?.() || null;
        const projection = snapshot
          ? trackAdapter.projectSnapshot(snapshot, { previous: null, track: options.track })
          : { s: frame.s, raceProgress: frame.s, lateral: 0 };
        const state = { ...physicalRival.getState(), snapshot, projection };
        syncFalconProxy(state);
        return state;
      },
      getState() {
        return physicalRival.getState();
      },
      dispose() {
        return rivalSession.dispose();
      },
    };
    return {
      physicsSession,
      rival,
      trackAdapter,
      refreshSceneColliders:options=>sceneCollisionLayer?.refresh(options),
      transformReferenceFrame(transform, reference={}) {
        if(disposalStarted)throw new Error('physical stack is disposed');
        physicsCore.validateReferenceTransform(transform);
        physicsSession.transformReferenceFrame(transform);rivalSession.transformReferenceFrame(transform);
        physicsCore.transformRapierWorldReferenceFrame(playerWorld,transform,{excludeBodies:[physicsSession.body]});
        physicsCore.transformRapierWorldReferenceFrame(rivalWorld,transform,{excludeBodies:[rivalSession.body]});
        physicsCore.transformRapierWorldReferenceFrame(suspensionWorld,transform,{refreshStaticQueries:true});
        trackAdapter.applyReferenceFrame(transform,reference);
        trafficProjection=physicsCore.transformRouteProjection(trafficProjection,transform);
        physicalRival.snapshot=rivalSession.getSnapshot();
        physicalRival.projection=physicsCore.transformRouteProjection(physicalRival.projection,transform);
        return {player:physicsSession.getSnapshot(),rival:physicalRival.getState(),referenceChart:reference.referenceChart};
      },
      diagnostics: Object.freeze({
        fixedHz: 120,
        rivalCount: 1,
        dynamicBodyCount: 2,
        vehicleColliderCount: physicsSession.colliders.length + rivalSession.colliders.length,
        contactProxyCount: 1,
        triangleCount: (boundaryTriangles?.triangleCount || 0) + routeTriangles.triangleCount,
        authoredBoundaryTriangleCount,
        authoredSolidTriangleCount: boundaryTriangles?.triangleCount || 0,
        get sceneCollisions(){return sceneCollisionLayer?.diagnostics()||null;},
        generatedRouteTriangleCount: routeTriangles.triangleCount,
        authoredRoadAndTerrainReplaced: false,
        generatedRoadSupport: true,
        terrainContact: visualGroundAvailable?'refined-scene':'authored-collision-or-unavailable',
        separateDeterministicWorlds: true,
        rapierContactProxy: true,
        vehicleProfile,
        forwardGears: vehicleSpec.gearbox.forward.length,
        triangleBounds: boundaryTriangles?.bounds || null,
        routeTriangleBounds: routeTriangles.bounds,
        endpointMarginM,
        initialFrame: Object.freeze({ ...initialFrame }),
        initialGroundProbe,
        initialWheelContacts,
      }),
      dispose: disposeOwnedStack,
    };
    } catch (error) {
      try {
        await disposeOwnedStack();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'physical stack construction and cleanup failed',
          { cause: error },
        );
      }
      throw error;
    }
  }

  class RaceSimulationV6 {
    constructor(options) {
      if (!options?.RaceCore?.RaceSimulation) {
        throw new TypeError('RaceSimulationV6 requiere RaceCore.RaceSimulation');
      }
      if (!options.track) throw new TypeError('RaceSimulationV6 requiere un circuito');
      this.RaceCore = options.RaceCore;
      this.track = options.track;
      this.storage = options.storage;
      this.trackAdapter = options.trackAdapter || null;
      this._physicsSession = options.physicsSession || null;
      this._createPhysicsSession = typeof options.createPhysicsSession === 'function'
        ? options.createPhysicsSession
        : null;
      this._getCollisionRoot = typeof options.getCollisionRoot === 'function'
        ? options.getCollisionRoot
        : null;
      this._browserStackFactory = typeof options.browserStackFactory === 'function'
        ? options.browserStackFactory
        : (this._getCollisionRoot ? createBrowserPhysicalStack : null);
      this._vehicleProfile = resolveVehicleProfile(options);
      this._chassisConfig = resolveChassisConfig(options);
      this._browserOptions = {
        ...options, vehicleProfile: this._vehicleProfile, chassisConfig: this._chassisConfig,
      };
      this._physicalStack = null;
      this._physicsTrackAdapter = null;
      this._rival = null;
      this._rivalLastState = null;
      this._previousRivalSnapshot = null;
      this._currentRivalSnapshot = null;
      this._physicalObservers = new Set();
      this._vehicleMaintenance = options.vehicleMaintenance || null;
      this._physicalSessionSequence = 0;
      this._physicalQAMutated = false;
      this._physicalTeleportBaseline = 0;
      this._championshipOptions = null;
      this._championshipLedger = null;
      this._championshipPaused = false;
      this._championshipNotified = null;
      this._disposed = false;
      this._disposePromise = null;
      this._rules = new this.RaceCore.RaceSimulation({
        track: this.track,
        settings: { ...(options.settings || {}), rivalCount: 0 },
        storage: this.storage,
      });
      this._rules.configure({ rivalCount: 0 });
      this.settings = this._rules.settings;
      this._projection = initialProjection(this.track);
      this._snapshot = this._physicsSession?.getSnapshot?.() || null;
      this._previousSnapshot = this._snapshot;
      this._currentSnapshot = this._snapshot;
      this._lastControls = safeInput(null);
      this._accumulator = 0;
      this._referenceChart = 0;
      this._referenceFrameSequence = 0;
      this._physicsPerformance = {
        frameCount: 0,
        totalSubsteps: 0,
        lastSubsteps: 0,
        maxSubstepsPerFrame: 0,
        overruns: 0,
        frameTimesMs: [],
      };
      this._prepared = false;
      this._preparing = null;
      this._operationTail = Promise.resolve();
      this._stackAbortController = null;
      this._falseStartApplied = false;
      this._lastFeedback = null;
      this._qaRouteDriving = false;
      this._recoveryGuard = typeof root.AsfaltoV6RecoveryGuard?.createRecoveryGuard === 'function'
        ? root.AsfaltoV6RecoveryGuard.createRecoveryGuard()
        : null;
      this._lastSafeFrame = null;
      this._recoveryReady = false;
      this._recoveryInProgress = false;
      this._recoveryCount = 0;
      this._playerTeleportCount = 0;
      this._lastRecoveryReason = null;
      this._lastRecoveryEvent = null;
      this._recoveryFallbackReason = null;
      this.state = this._publish(this._projection, this._snapshot);
    }

    // Observers subscribe after start(). They receive only actual player physics steps.
    subscribePhysicalSteps(observer) {
      if (this._disposed || !observer || typeof observer.sample !== 'function') throw new TypeError('Active physical observer with sample callback required');
      this._physicalObservers.add(observer);
      return () => this._physicalObservers.delete(observer);
    }

    getPhysicalObservationState() {
      return Object.freeze({sessionSequence:this._physicalSessionSequence,qa:this._physicalQAMutated,referenceChart:this._referenceChart});
    }

    getRoadTestContext() {
      const adapter=this._physicsTrackAdapter,sequence=this._physicalSessionSequence;
      if(this._disposed||!this._physicsSession?.spec||typeof adapter?.samplePhysicalRoute!=='function')throw new Error('Physical road-test context is not prepared');
      const vehicleSpec=freezeDeep(JSON.parse(JSON.stringify(this._physicsSession.spec)));
      const routeQuery=Object.freeze({sample:progress=>{
        if(this._disposed||this._physicalSessionSequence!==sequence||this._physicsTrackAdapter!==adapter)throw new Error('Physical road-test session changed');
        return adapter.samplePhysicalRoute(progress);
      }});
      return Object.freeze({...this.getPhysicalObservationState(),routeQuery,projection:freezeDeep(cloneProjection(this._projection)),snapshot:this._snapshot,vehicleSpec,displacementLiters:vehicleSpec.engine?.displacementLiters});
    }

    _invalidatePhysicalObservers(reason) {
      const observers = [...this._physicalObservers];
      this._physicalObservers.clear();
      for (const observer of observers) { try { observer.invalidated?.(reason); } catch {} }
    }

    _markPhysicalQA(reason) {
      this._physicalQAMutated = true;
      this._invalidatePhysicalObservers(reason);
    }

    _emitPhysicalStep(statusBefore, previousTime) {
      if ((!this._physicalObservers.size && !this._vehicleMaintenance) || !this._snapshot || this._snapshot.timeSeconds === previousTime) return;
      const snapshot = this._snapshot;
      const environment = this._physicsSession.environment?.({worldPosition:snapshot.chassis.position,speedMps:Math.hypot(...snapshot.chassis.linearVelocity)}) || {};
      const frame = freezeDeep({sessionSequence:this._physicalSessionSequence,tick:Math.round(snapshot.timeSeconds*120),statusBefore,running:statusBefore==='RUNNING',snapshot,projection:cloneProjection(this._projection),environment:{...environment},qa:this._physicalQAMutated,teleports:this._playerTeleportCount-this._physicalTeleportBaseline,recoveries:this._recoveryCount,referenceChart:this._referenceChart});
      this._vehicleMaintenance?.sample(frame);
      for (const observer of [...this._physicalObservers]) {
        if (!this._physicalObservers.has(observer)) continue;
        try { observer.sample(frame); } catch { this._physicalObservers.delete(observer); try { observer.invalidated?.('observer-callback-error'); } catch {} }
      }
    }

    transformReferenceFrame(transform, options={}) {
      if(this._disposed)throw new Error('RaceSimulationV6 esta descartada');
      const physicsCore=this._browserOptions.physicsCore||root.AsfaltoV6Physics;
      if(!physicsCore?.transformPhysicsSnapshot)throw new Error('reference frame physics helpers unavailable');
      physicsCore.validateReferenceTransform(transform);
      const previousChart=this._referenceChart,referenceChart=Number.isSafeInteger(options.referenceChart)?options.referenceChart:previousChart+1;
      if(referenceChart===previousChart)return Object.freeze({applied:false,referenceChart});
      // Map all immutable histories before touching live bodies; never reset the accumulator.
      const memo=new Map(),snapshot=value=>{if(!value)return value;if(!memo.has(value))memo.set(value,physicsCore.transformPhysicsSnapshot(value,transform));return memo.get(value);};
      const history={};for(const key of ['_snapshot','_previousSnapshot','_currentSnapshot','_previousRivalSnapshot','_currentRivalSnapshot'])history[key]=snapshot(this[key]);
      const projection=physicsCore.transformRouteProjection(this._projection,transform);
      projection.referenceChart=referenceChart;
      const rivalState=this._rivalLastState?{...this._rivalLastState,snapshot:snapshot(this._rivalLastState.snapshot),projection:physicsCore.transformRouteProjection(this._rivalLastState.projection,transform)}:null;
      const safe=this._lastSafeFrame?{...physicsCore.transformRouteProjection(this._lastSafeFrame,transform),snapshot:snapshot(this._lastSafeFrame.snapshot),referenceChart}:null;
      if(this._physicalStack?.transformReferenceFrame)this._physicalStack.transformReferenceFrame(transform,{referenceChart});
      else{
        if(typeof this._physicsSession?.transformReferenceFrame!=='function')throw new Error('physics session cannot change reference');
        this._physicsSession.transformReferenceFrame(transform);
        this._rival?.physicsSession?.transformReferenceFrame?.(transform);
        this._physicsTrackAdapter?.applyReferenceFrame?.(transform,{referenceChart});
      }
      Object.assign(this,history);this._projection=projection;this._rivalLastState=rivalState;this._lastSafeFrame=safe?freezeDeep(safe):null;
      // RecoveryGuard caches only scalar separation/distances/timers, all rigid-transform invariants.
      this._referenceChart=referenceChart;this._referenceFrameSequence++;
      if(this._physicalObservers.size){
        const axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>transform.vector(v)),origin=transform.point([0,0,0]);
        const event=freezeDeep({referenceChart,previousChart,matrix:[...axes[0],0,...axes[1],0,...axes[2],0,...origin,1]});
        for(const observer of [...this._physicalObservers]){try{if(typeof observer.rebase!=='function')throw new Error('rebase handler required');observer.rebase(event);}catch{this._physicalObservers.delete(observer);try{observer.invalidated?.('observer-rebase-required');}catch{}}}
      }
      this.state=this._publish(this._projection,this._snapshot);
      return Object.freeze({applied:true,previousChart,referenceChart,sequence:this._referenceFrameSequence,raceProgressM:this._projection.raceProgress,transform});
    }

    _resetSnapshotHistory(snapshot) {
      this._snapshot = snapshot || null;
      this._previousSnapshot = this._snapshot;
      this._currentSnapshot = this._snapshot;
      this._accumulator = 0;
      return this._snapshot;
    }

    _resetRivalSnapshotHistory(state = this._rivalLastState) {
      this._rivalLastState = state || null;
      const snapshot = this._rivalLastState?.snapshot || null;
      this._previousRivalSnapshot = snapshot;
      this._currentRivalSnapshot = snapshot;
      return snapshot;
    }

    _teleportPlayer(frame, velocity) {
      const teleport = this._physicsSession?.teleport;
      if (typeof teleport !== 'function') return undefined;
      const snapshot = teleport.call(this._physicsSession, frame, velocity);
      this._playerTeleportCount += 1;
      return snapshot;
    }

    _syncRivalActive() {
      const active = Boolean(this._rival && this._rules.settings.mode === 'race'
        && !this._championshipLedger?.isTerminal('player') && !this._championshipLedger?.isTerminal('falcon'));
      this._rival?.setActive?.(active);
      return active;
    }

    _enqueueLifecycle(operation) {
      const run = this._operationTail.then(() => {
        if (this._disposed) throw new Error('RaceSimulationV6 esta descartada');
        return operation();
      });
      const settled = run.then(() => undefined, () => undefined);
      this._operationTail = settled;
      settled.then(() => {
        if (this._operationTail === settled && !this._disposed) {
          this._operationTail = Promise.resolve();
        }
      });
      return run;
    }

    async _preparePhysicalStack() {
      if (this._prepared) return this.getState();
      try {
        if (!this._physicsSession && this._browserStackFactory) {
          const collisionRoot = this._getCollisionRoot?.();
          if (!collisionRoot) {
            throw new Error('RaceSimulationV6 requiere collisionRoot antes de prepare');
          }
          this._stackAbortController = createOwnedAbortController();
          const stack = await this._browserStackFactory({
            ...this._browserOptions,
            RaceCore: this.RaceCore,
            track: this.track,
            trackAdapter: this.trackAdapter,
            collisionRoot,
            getEnvironmentState: this._browserOptions.getEnvironmentState,
            signal: this._stackAbortController.signal,
          });
          this._physicalStack = stack || null;
          if (!stack?.physicsSession) {
            throw new Error('stack fisico v6 no entrego physicsSession');
          }
          this._physicsSession = stack.physicsSession;
          this._physicsTrackAdapter = stack.trackAdapter || null;
          this._rival = stack.rival || null;
          this._syncRivalActive();
          this._rivalLastState = this._rival?.getState?.() || null;
          this._resetRivalSnapshotHistory(this._rivalLastState);
        }
        if (!this._physicsSession && this._createPhysicsSession) {
          this._physicsSession = await this._createPhysicsSession({
            chassisConfig: this._chassisConfig,
            track: this.track,
            trackAdapter: this.trackAdapter,
          });
        }
        if (!this._physicsSession) {
          throw new Error('RaceSimulationV6 requiere una sesion fisica preparada');
        }
        this._physicsSession.setChassisConfig?.(this._chassisConfig);
        if (typeof this._physicsSession.prepare === 'function') {
          await this._physicsSession.prepare({
            track: this.track,
            trackAdapter: this.trackAdapter,
          });
        }
        if (this._disposed) throw new Error('RaceSimulationV6 esta descartada');
        this._resetSnapshotHistory(
          this._physicsSession.getSnapshot?.() || this._snapshot,
        );
        if (this._snapshot) {
          const projected = this._project(this._snapshot);
          if (!projected.rejected) this._projection = projected.projection;
        }
        this._prepared = true;
        this.state = this._publish(this._projection, this._snapshot);
        return this.getState();
      } catch (error) {
        await this._disposePhysicalStackNow();
        throw error;
      }
    }

    async prepare() {
      if (this._prepared) return this.getState();
      if (this._preparing) return this._preparing;
      this._preparing = this._enqueueLifecycle(() => this._preparePhysicalStack());
      try {
        return await this._preparing;
      } finally {
        this._preparing = null;
      }
    }

    async _disposePhysicalStackNow() {
      const stack = this._physicalStack;
      const session = this._physicsSession;
      const rival = this._rival;
      const hadPhysicalStack = Boolean(stack || session || rival || this._prepared);
      this._stackAbortController?.abort(new Error('physical stack disposed'));
      this._stackAbortController = null;
      this._physicalStack = null;
      this._physicsSession = null;
      this._physicsTrackAdapter = null;
      this._rival = null;
      this._rivalLastState = null;
      this._previousRivalSnapshot = null;
      this._currentRivalSnapshot = null;
      this._resetSnapshotHistory(null);
      this._projection = initialProjection(this.track);
      this._prepared = false;
      this._falseStartApplied = false;
      this._lastFeedback = null;
      this.state = this._publish(this._projection, this._snapshot);
      if (stack?.dispose) await stack.dispose();
      else {
        await session?.dispose?.();
        await rival?.dispose?.();
      }
      return hadPhysicalStack;
    }

    disposePhysicalStack() {
      this._championshipLedger?.cancel();
      this._championshipLedger = null;
      if (this._disposed) return Promise.resolve(false);
      return this._enqueueLifecycle(() => this._disposePhysicalStackNow());
    }

    replaceTrack({ track, trackAdapter, physicsBridge } = {}) {
      if (!track) return Promise.reject(new TypeError('replaceTrack requiere un circuito'));
      if (!trackAdapter || trackAdapter.ready !== true) {
        return Promise.reject(new TypeError('replaceTrack requiere un TrackAdapter listo'));
      }
      if (typeof physicsBridge?.browserStackFactory !== 'function'
          || typeof physicsBridge?.getCollisionRoot !== 'function') {
        return Promise.reject(new TypeError('replaceTrack requiere un physicsBridge completo'));
      }
      const collisionRoot = physicsBridge.getCollisionRoot();
      if (!collisionRoot) return Promise.reject(new TypeError('replaceTrack requiere collisionRoot'));
      this._invalidatePhysicalObservers('track-changed');
      this._championshipLedger?.cancel();
      this._championshipLedger = null;
      this._championshipPaused = false;
      return this._enqueueLifecycle(async () => {
        const currentSettings = {
          ...(this._rules.settings || {}),
          assists: { ...(this._rules.settings?.assists || {}) },
        };
        await this._disposePhysicalStackNow();
        this.track = track;
        this.trackAdapter = trackAdapter;
        this._browserStackFactory = physicsBridge.browserStackFactory;
        this._getCollisionRoot = () => collisionRoot;
        this._browserOptions.trackAdapter = trackAdapter;
        this._browserOptions.routeQuery = trackAdapter.routeQuery || null;
        this._rules.selectTrack(track);
        this._rules.configure({ ...currentSettings, rivalCount: 0 });
        this.settings = this._rules.settings;
        this._projection = initialProjection(track);
        this._resetSnapshotHistory(null);
        this._resetRivalSnapshotHistory(null);
        this._falseStartApplied = false;
        this._lastFeedback = null;
        this.state = this._publish(this._projection, this._snapshot);
        await this._preparePhysicalStack();
        return this.getState();
      });
    }

    _publicSettings() {
      const settings = this._rules.settings || {};
      return {
        ...settings,
        rivalCount: settings.mode === 'race' && this._rival ? 1 : 0,
      };
    }

    setChassisConfig(value) {
      const config = resolveChassisConfig({ chassisConfig: value || null });
      if(this._physicalObservers.size&&JSON.stringify(config)!==JSON.stringify(this._chassisConfig))this._invalidatePhysicalObservers('chassis-configuration-changed');
      this._chassisConfig = config;
      this._browserOptions.chassisConfig = config;
      this._physicsSession?.setChassisConfig?.(config);
      return config ? { ...config } : null;
    }

    setVehicleProfile(value) {
      if (value !== 'original' && value !== 'restomod') {
        throw new TypeError('perfil fisico debe ser original o restomod');
      }
      if (value === this._vehicleProfile) return false;
      this._invalidatePhysicalObservers('vehicle-profile-changed');
      this._vehicleProfile = value;
      this._browserOptions.vehicleProfile = value;
      if (this._physicalStack) {
        const cleanup = this._disposePhysicalStackNow();
        cleanup.catch(() => {});
      }
      return true;
    }

    configureChampionship({ enabled = false, createLedger, onFinalClassification } = {}) {
      if (enabled && ['RUNNING', 'COUNTDOWN', 'PAUSED'].includes(this._rules.state.status)) {
        throw new Error('Championship must be configured before start');
      }
      if (enabled && typeof createLedger !== 'function') throw new TypeError('Championship ledger factory required');
      this._championshipLedger?.cancel();
      this._championshipLedger = null;
      this._championshipPaused = false;
      this._championshipNotified = null;
      this._championshipOptions = enabled ? { createLedger, onFinalClassification } : null;
      this.state = this._publish(this._projection, this._snapshot);
      return this.getChampionshipClassification();
    }

    invalidateChampionship(reason) { return this._championshipLedger?.invalidate(reason) || false; }
    getChampionshipClassification() { return this._championshipLedger?.getState() || null; }
    getFinalClassification() { return this._championshipLedger?.getFinalClassification() || null; }
    _championshipPending() { return Boolean(this._championshipLedger && !this.getFinalClassification()); }

    _notifyChampionshipCompletion() {
      const ledger = this._championshipLedger, result = this.getFinalClassification();
      if (!result || this._championshipNotified === ledger) return;
      this._championshipNotified = ledger;
      const callback = this._championshipOptions?.onFinalClassification;
      if (typeof callback === 'function') Promise.resolve().then(() => {
        if (!this._disposed && this._championshipLedger === ledger && ledger.getFinalClassification() === result) callback(result);
      }).catch(error => { this._championshipCallbackError = String(error?.message || error); });
    }

    retireChampionshipParticipant(id, status, reason) {
      if (!this._championshipLedger) throw new Error('Championship not active');
      const changed = this._championshipLedger.retire(id, status, reason);
      if (changed && id === 'player') this._rules.finish(status);
      if (changed) this._rival?.setActive?.(false);
      this._notifyChampionshipCompletion();
      this.state = this._publish(this._projection, this._snapshot);
      return changed;
    }

    configure(settings) {
      const observedSettings=this._physicalObservers.size?JSON.stringify(this._rules.settings):null;
      this._rules.configure({ ...(settings || {}), rivalCount: 0 });
      if(observedSettings!==null&&observedSettings!==JSON.stringify(this._rules.settings))this._invalidatePhysicalObservers('rules-configuration-changed');
      this._syncRivalActive();
      this.settings = this._rules.settings;
      this.state = this._publish(this._projection, this._snapshot);
      return this.getState();
    }

    selectTrack(track) {
      this._championshipLedger?.cancel();
      this._championshipLedger = null;
      if (!track) throw new TypeError('selectTrack requiere un circuito');
      this._invalidatePhysicalObservers('track-changed');
      this.track = track;
      this._rules.selectTrack(track);
      this._rules.configure({ rivalCount: 0 });
      this.settings = this._rules.settings;
      this.trackAdapter?.selectTrack?.(track);
      this._projection = initialProjection(track);
      this._resetSnapshotHistory(this._snapshot);
      this._falseStartApplied = false;
      this.state = this._publish(this._projection, this._snapshot);
      return this.getState();
    }

    _safeFrame(progress) {
      const adapter = this._physicsTrackAdapter || this.trackAdapter;
      if (typeof adapter?.safeFrame === 'function') {
        return adapter.safeFrame(progress);
      }
      if (typeof adapter?.getSafeFrame === 'function') {
        return adapter.getSafeFrame(progress);
      }
      const s = this.track.closed === false
        ? clamp(finite(progress, 0), 0, this.track.length)
        : finite(progress, 0);
      const sample = this.track.sample(s);
      return {
        s,
        x: finite(sample.x, 0),
        y: finite(sample.y, 0) + finite(this._physicsSession?.spec?.cgHeightM, 0.56),
        z: finite(sample.z, 0),
        yawRad: finite(sample.heading, 0),
      };
    }

    start({ initialGear } = {}) {
      const persistentDamage=this._vehicleMaintenance?.begin({vehicleSpec:this._physicsSession?.spec});
      if (this._championshipOptions && (!this._rival || this._rules.settings.mode !== 'race')) throw new Error('Championship requires the prepared physical Falcon in race mode');
      this._invalidatePhysicalObservers('session-restarted');
      this._physicalSessionSequence++;
      this._physicalQAMutated = false;
      this._physicalTeleportBaseline = this._playerTeleportCount;
      this._championshipLedger?.cancel();
      this._championshipLedger = this._championshipOptions?.createLedger({track:this.track,laps:this._rules.settings.laps,checkpointPenalty:this._rules.settings.checkpointPenalty}) || null;
      this._championshipPaused = false;
      this._championshipNotified = null;
      this._recoveryGuard?.reset?.();
      this._lastSafeFrame = null;
      this._recoveryReady = false;
      this._recoveryCount = 0;
      this._lastRecoveryReason = null;
      this._lastRecoveryEvent = null;
      this._recoveryFallbackReason = null;
      const state = this._rules.start();
      this._rules.configure({ rivalCount: 0 });
      const legacyRivalProgress = Math.min(12, Math.max(1, this.track.length * 0.0012));
      const rivalActive = this._syncRivalActive();
      if (rivalActive) {
        if (typeof this.trackAdapter?.getSpawn === 'function'
            && typeof this._rival.reset === 'function') {
          this._rival.reset(modularSpawnFrame(
            this.trackAdapter,
            'falcon',
            this._safeFrame(legacyRivalProgress),
            0.57,
            2.05,
          ));
        } else {
          this._rival.recover?.(legacyRivalProgress);
        }
        this._rivalLastState = this._rival.getState?.() || this._rivalLastState;
        this._resetRivalSnapshotHistory(this._rivalLastState);
      }
      this.settings = this._rules.settings;
      this._accumulator = 0;
      this._falseStartApplied = false;
      const frame = modularSpawnFrame(
        this.trackAdapter,
        'chevy',
        this._safeFrame(state.raceProgress),
        finite(this._physicsSession?.spec?.cgHeightM, 0.56),
        8.3,
      );
      if (typeof this._physicsSession?.reset === 'function') {
        const resetSnapshot = this._physicsSession.reset({
          frame,
          startEngine: true,
          initialGear,
          resetClock: true,
          resetDamage: !persistentDamage,
          damageState: persistentDamage,
        });
        if (resetSnapshot && typeof resetSnapshot === 'object') this._snapshot = resetSnapshot;
      } else if (typeof this._physicsSession?.teleport === 'function') {
        this._teleportPlayer(frame, { x: 0, y: 0, z: 0 });
        this._snapshot = this._physicsSession.getSnapshot?.() || this._snapshot;
      }
      this._physicalTeleportBaseline = this._playerTeleportCount;
      this._resetSnapshotHistory(this._snapshot);
      this._projection = {
        ...initialProjection(this.track),
        s: state.s,
        raceProgress: state.raceProgress,
      };
      if (this._snapshot) {
        const projected = this._project(this._snapshot);
        if (!projected.rejected) this._projection = projected.projection;
      }
      this._syncRulesMotion(this._projection);
      this.state = this._publish(this._projection, this._snapshot);
      return this.getState();
    }

    pause() {
      if (this._championshipPending()) this._championshipPaused = true;
      this._rules.pause();
      this.state = this._publish(this._projection, this._snapshot);
      return this.getState();
    }

    resume() {
      if(this._vehicleMaintenance && !this._vehicleMaintenance.canDrive()) return this.getState();
      this._championshipPaused = false;
      this._rules.resume();
      this._resetSnapshotHistory(this._snapshot);
      this.state = this._publish(this._projection, this._snapshot);
      return this.getState();
    }

    _observeRecovery(projected) {
      if (!this._recoveryGuard || !this._snapshot?.chassis) return null;
      const chassis = this._snapshot.chassis;
      const result = this._recoveryGuard.observe({
        snapshot: {
          position: vector3(chassis.position),
          rotation: Array.isArray(chassis.rotation) ? chassis.rotation.slice(0, 4) : null,
          linearVelocity: vector3(chassis.linearVelocity),
          wheels: Array.isArray(this._snapshot.wheels) ? this._snapshot.wheels : [],
        },
        rawProjection: projected.rawProjection,
        routeFrame: projected.rawProjection?.routeFrame,
        routeHalfWidthM: projected.rawProjection?.routeHalfWidthM,
        raceProgressM: projected.projection.raceProgress,
        sM: projected.projection.s,
        fixedTimeS: finite(this._snapshot.timeSeconds, 0),
        fixedDt: FIXED_DT,
      });
      if (result.safeFrameCandidate) {
        this._lastSafeFrame = freezeDeep({
          ...result.safeFrameCandidate,
          routePosition: vector3(projected.rawProjection?.routePosition),
          routeHalfWidthM: projected.rawProjection?.routeHalfWidthM,
          clearanceM: finite(this._physicsSession?.spec?.cgHeightM, 0.56),
        });
        this._recoveryReady = true;
      }
      if (!this._recoveryReady) {
        if (result.reason) this._recoveryGuard.reset();
        return null;
      }
      return result.reason ? this.requestRecovery(result.reason, 'guard') : null;
    }

    _safeFrameRespawn(progressM) {
      const safe = this._lastSafeFrame;
      if (safe?.routeFrame && vector3(safe.routePosition)) {
        return {
          sM: finite(safe.sM, progressM),
          raceProgressM: finite(safe.raceProgressM, progressM),
          position: vector3(safe.routePosition),
          frame: cloneRouteFrame(safe.routeFrame),
          lateralM: 0,
          clearanceM: finite(safe.clearanceM, 0.56),
          sectorId: null,
        };
      }
      const legacy = this._safeFrame(progressM);
      const yaw = finite(legacy.yawRad, 0);
      return {
        sM: finite(legacy.s, progressM),
        raceProgressM: finite(legacy.s, progressM),
        position: [finite(legacy.x, 0), finite(legacy.y, 0.56), finite(legacy.z, 0)],
        frame: {
          tangent: [Math.cos(yaw), 0, -Math.sin(yaw)],
          left: [Math.sin(yaw), 0, Math.cos(yaw)],
          normal: [0, 1, 0],
        },
        lateralM: 0,
        clearanceM: 0,
        sectorId: null,
      };
    }

    debugTeleportPhysicalVehicle({
      raceProgressM,
      lateralOffsetM = 0,
      normalOffsetM = 0,
      linearVelocityMps = [0, 0, 0],
    } = {}) {
      if (this._championshipLedger?.isTerminal('player')) throw new Error('Finished championship participant is immutable');
      if (!Number.isFinite(raceProgressM)
          || !Number.isFinite(lateralOffsetM)
          || !Number.isFinite(normalOffsetM)
          || !Array.isArray(linearVelocityMps)
          || linearVelocityMps.length !== 3
          || !linearVelocityMps.every(Number.isFinite)) {
        throw new TypeError('QA physical teleport requires finite arguments');
      }
      const adapter = this._physicsTrackAdapter || this.trackAdapter;
      const resolveQaTeleport = typeof adapter?.resolveQaTeleport === 'function'
        ? adapter.resolveQaTeleport : adapter?.resolveRespawn;
      if (typeof resolveQaTeleport !== 'function') {
        throw new Error('QA physical teleport requires an authored route resolver');
      }
      if (typeof this._physicsSession?.teleport !== 'function') {
        throw new Error('QA physical teleport requires a physics session');
      }
      this.invalidateChampionship('qa-physical-teleport');
      this._markPhysicalQA('qa-physical-teleport');
      const respawn = resolveQaTeleport.call(adapter, raceProgressM);
      const routePosition = vector3(respawn?.position);
      const routeFrame = cloneRouteFrame(respawn?.frame);
      const left = normalize3(routeFrame?.left);
      const normal = normalize3(routeFrame?.normal);
      if (!routePosition || !routeFrame || !left || !normal) {
        throw new TypeError('QA physical teleport respawn is incomplete');
      }
      const shiftedRespawn = {
        ...respawn,
        position: routePosition.map((value, index) => value
          + left[index] * lateralOffsetM + normal[index] * normalOffsetM),
        lateralM: lateralOffsetM,
      };
      const frame = physicalRespawnFrame(shiftedRespawn);
      const velocity = {
        x: linearVelocityMps[0],
        y: linearVelocityMps[1],
        z: linearVelocityMps[2],
      };
      const teleported = this._teleportPlayer(frame, velocity);
      adapter.resetProjection?.();
      const snapshot = teleported && typeof teleported === 'object'
        ? teleported : this._physicsSession.getSnapshot?.() || this._snapshot;
      this._resetSnapshotHistory(snapshot);
      const resolvedS = finite(respawn?.sM, raceProgressM);
      const resolvedProgress = finite(respawn?.raceProgressM, resolvedS);
      const clearanceM = Math.max(0, finite(respawn?.clearanceM, 0.56));
      this._projection = {
        ...this._projection,
        s: resolvedS,
        raceProgress: resolvedProgress,
        lateral: lateralOffsetM,
        headingError: 0,
        yawRate: 0,
        lateralSpeedMps: dot3(linearVelocityMps, left),
        speedAlongRouteMps: dot3(linearVelocityMps, normalize3(routeFrame.tangent)),
        valid: true,
        jumpRejected: false,
        continuous: true,
        distanceM: Math.abs(clearanceM + normalOffsetM),
        routePosition,
        routeFrame,
        signedSeparationM: clearanceM + normalOffsetM,
      };
      this.state = this._publish(this._projection, this._snapshot);
      this._lastFeedback = this._mergeFeedback(null, this._projection, this._snapshot, false);
      return this.getState();
    }

    requestRecovery(reason = 'manual', source = 'legacy') {
      if (this._championshipLedger?.isTerminal('player')) return Object.freeze({recovered:false,event:null,snapshot:this._snapshot});
      if (this._recoveryInProgress) {
        return Object.freeze({ recovered: false, event: null, snapshot: this._snapshot });
      }
      this._recoveryInProgress = true;
      try {
        const recoveredState = this._rules.recover();
        const safeProgressM = finite(
          this._lastSafeFrame?.raceProgressM,
          finite(recoveredState.raceProgress, 0),
        );
        const adapter = this._physicsTrackAdapter || this.trackAdapter;
        let respawn;
        this._recoveryFallbackReason = null;
        try {
          if (typeof adapter?.resolveRespawn !== 'function') {
            throw new Error('authored respawn resolver unavailable');
          }
          respawn = adapter.resolveRespawn(safeProgressM);
          physicalRespawnFrame(respawn);
        } catch (error) {
          this._recoveryFallbackReason = String(error?.message || error);
          respawn = this._safeFrameRespawn(safeProgressM);
        }
        const frame = physicalRespawnFrame(respawn);
        const teleported = this._teleportPlayer(
          frame,
          { x: 0, y: 0, z: 0 },
        );
        const recoveredSnapshot = teleported && typeof teleported === 'object'
          ? teleported : this._physicsSession?.getSnapshot?.() || this._snapshot;
        this._resetSnapshotHistory(recoveredSnapshot);
        this._resetRivalSnapshotHistory();
        adapter?.resetProjection?.();
        const resolvedS = finite(respawn?.sM, safeProgressM);
        const resolvedProgress = finite(respawn?.raceProgressM, resolvedS);
        const routePosition = vector3(respawn?.position);
        const routeFrame = cloneRouteFrame(respawn?.frame);
        this._projection = {
          ...this._projection,
          s: resolvedS,
          raceProgress: resolvedProgress,
          lateral: finite(respawn?.lateralM, 0),
          headingError: 0,
          yawRate: 0,
          lateralSpeedMps: 0,
          speedAlongRouteMps: 0,
          valid: true,
          jumpRejected: false,
          continuous: true,
          distanceM: finite(respawn?.clearanceM, 0.56),
          routePosition,
          routeFrame,
          segmentIndex: finite(this._lastSafeFrame?.segmentIndex, null),
          routeHalfWidthM: finite(this._lastSafeFrame?.routeHalfWidthM, null),
          signedSeparationM: finite(respawn?.clearanceM, 0.56),
        };
        this._recoveryCount += 1;
        this._lastRecoveryReason = String(reason || 'manual');
        this._lastRecoveryEvent = Object.freeze({
          type: 'recover',
          reason: this._lastRecoveryReason,
          source: String(source || 'legacy'),
          count: this._recoveryCount,
        });
        const events = Array.isArray(this._rules.state.events)
          ? this._rules.state.events.slice() : [];
        const rulesRecoveryIndex = events.findLastIndex(event => event?.type === 'recover');
        if (rulesRecoveryIndex >= 0) events[rulesRecoveryIndex] = this._lastRecoveryEvent;
        else events.push(this._lastRecoveryEvent);
        this._rules.debugSet({
          s: resolvedS,
          raceProgress: resolvedProgress,
          lastCheckpointProgress: resolvedProgress,
          lateral: 0,
          headingError: 0,
          yawRate: 0,
          lateralVelocity: 0,
          events,
        }, { publish: false });
        this._syncRulesMotion(this._projection);
        this._recoveryGuard?.markRecovered?.();
        this.state = this._publish(this._projection, this._snapshot);
        this._lastFeedback = this._mergeFeedback(
          this._rules.getState(),
          this._projection,
          this._snapshot,
          false,
        );
        return Object.freeze({
          recovered: true,
          event: this._lastRecoveryEvent,
          snapshot: this._snapshot,
        });
      } finally {
        this._recoveryInProgress = false;
      }
    }

    recover() {
      return this.requestRecovery('manual', 'legacy');
    }

    _project(snapshot) {
      let raw = snapshot?.projection || null;
      const projectionAdapter = this._physicsTrackAdapter || this.trackAdapter;
      if (typeof projectionAdapter?.projectSnapshot === 'function') {
        raw = projectionAdapter.projectSnapshot(snapshot, {
          previous: cloneProjection(this._projection),
          track: this.track,
        });
      } else if (typeof projectionAdapter?.project === 'function') {
        raw = projectionAdapter.project(snapshot, {
          previous: cloneProjection(this._projection),
          track: this.track,
        });
      }
      return normalizeProjection(raw, this.track, this._projection, snapshot);
    }

    _syncRulesMotion(projection) {
      this._rules.debugSet({
        s: projection.s,
        raceProgress: projection.raceProgress,
        lateral: projection.lateral,
        headingError: projection.headingError,
        yawRate: projection.yawRate,
        lateralVelocity: projection.lateralSpeedMps,
        surface: projection.surface,
        grip: projection.grip,
        slip: projection.slip,
      }, { publish: false });
    }

    _applyFalseStart(input, snapshot) {
      if (this._falseStartApplied || this._rules.state.status !== 'COUNTDOWN') return;
      const projectedSpeed = Math.abs(finite(
        snapshot?.projection?.speedAlongRouteMps,
        this._projection.speedAlongRouteMps,
      ));
      if (input.throttle <= 0.18 && projectedSpeed <= 0.8) return;
      this._falseStartApplied = true;
      const state = this._rules.state;
      const events = Array.isArray(state.events) ? state.events.slice(-31) : [];
      events.push({
        type: 'false-start',
        at: finite(state.totalTime, 0),
        penalty: FALSE_START_PENALTY_SECONDS,
      });
      this._rules.debugSet({
        penaltyTime: finite(state.penaltyTime, 0) + FALSE_START_PENALTY_SECONDS,
        events,
      }, { publish: false });
    }

    _advanceFixed(input) {
      if (!this._physicalObservers.size && !this._vehicleMaintenance) return this._advanceRulesFixed(input);
      const statusBefore=this._rules.state.status,previousTime=this._snapshot?.timeSeconds;
      const feedback=this._advanceRulesFixed(input);
      this._emitPhysicalStep(statusBefore,previousTime);
      return feedback;
    }

    _advanceRulesFixed(input) {
      const ledger = this._championshipLedger;
      if (!ledger || this._rules.state.status === 'COUNTDOWN') return this._advanceLegacyFixed(input);
      const previousPlayer = this._projection;
      const previousFalcon = this._rivalLastState?.projection;
      const teleports = this._playerTeleportCount;
      const playerPending = !ledger.isTerminal('player');
      const falconPending = !ledger.isTerminal('falcon');
      if (playerPending || falconPending) {
        if (playerPending) this._advanceLegacyFixed(input);
        else if (falconPending) {
          this._physicalStack?.refreshSceneColliders?.({timeSeconds:this._rival?.physicsSession?.timeSeconds||0});
          this._previousRivalSnapshot = this._currentRivalSnapshot;
          this._rivalLastState = this._rival.step(FIXED_DT) || this._rival.getState?.() || this._rivalLastState;
          this._currentRivalSnapshot = this._rivalLastState?.snapshot || this._previousRivalSnapshot;
        }
        ledger.advance({
          player: playerPending ? {previous:previousPlayer,current:this._projection,discontinuity:this._playerTeleportCount!==teleports,reason:this._lastRecoveryReason||'physical-discontinuity'} : null,
          falcon: falconPending ? {previous:previousFalcon,current:this._rivalLastState?.projection} : null,
        }, {playerPenaltySeconds:this._rules.state.penaltyTime});
      }
      if (ledger.isTerminal('player') || ledger.isTerminal('falcon')) this._rival?.setActive?.(false);
      if (ledger.isTerminal('player')) this._previousSnapshot = this._currentSnapshot;
      if (ledger.isTerminal('falcon')) this._previousRivalSnapshot = this._currentRivalSnapshot;
      this._notifyChampionshipCompletion();
      this.state = this._publish(this._projection, this._snapshot);
      this._lastFeedback = this._mergeFeedback(this._lastFeedback,this._projection,this._snapshot,false);
      return this._lastFeedback;
    }

    _advanceLegacyFixed(input) {
      this._physicalStack?.refreshSceneColliders?.({timeSeconds:this._physicsSession.timeSeconds||0});
      const previous = this._projection;
      this._previousSnapshot = this._currentSnapshot || this._snapshot;
      const statusBefore = this._rules.state.status;
      if (this._rival
        && this._rules.settings.mode === 'race'
        && statusBefore === 'RUNNING'
        && !this._championshipLedger?.isTerminal('falcon')) {
        this._previousRivalSnapshot = this._currentRivalSnapshot
          || this._rivalLastState?.snapshot || null;
        this._rivalLastState = this._rival.step(FIXED_DT)
          || this._rival.getState?.() || this._rivalLastState;
        this._currentRivalSnapshot = this._rivalLastState?.snapshot
          || this._previousRivalSnapshot;
      }
      const snapshot = this._physicsSession.step(FIXED_DT, input);
      this._snapshot = snapshot || this._physicsSession.getSnapshot?.() || this._snapshot;
      this._currentSnapshot = this._snapshot;
      const projected = this._project(this._snapshot);
      const current = projected.projection;
      const recovery = this._observeRecovery(projected);
      if (recovery?.recovered) return this._lastFeedback;
      this._applyFalseStart(input, this._snapshot);

      let ruleFeedback;
      if (statusBefore === 'RUNNING') {
        const ghostCountBefore = this._rules.state.ghostSamples.length;
        const eventCountBefore = this._rules.state.events.length;
        this._rules.debugSet({
          s: previous.s,
          raceProgress: previous.raceProgress,
          lateral: current.lateral,
          headingError: current.headingError,
          yawRate: current.yawRate,
          lateralVelocity: current.lateralSpeedMps,
          surface: current.surface,
          grip: current.grip,
          slip: current.slip,
        }, { publish: false });
        const routeDelta = current.raceProgress - previous.raceProgress;
        const checkpointIndex = this._rules.state.nextCheckpointIndex;
        const checkpoint = this.track.checkpoints[checkpointIndex];
        const checkpointProgress = this._rules.state.completedLaps * this.track.length
          + finite(checkpoint, Infinity);
        const confirmedCrossing = routeDelta > 0
          && previous.raceProgress < checkpointProgress
          && current.raceProgress >= checkpointProgress;
        const headingCosine = Math.cos(current.headingError);
        const safeCosine = Math.abs(headingCosine) < 0.05
          ? (headingCosine < 0 ? -0.05 : 0.05)
          : headingCosine;
        const ruleSpeedMps = routeDelta / (FIXED_DT * safeCosine);
        ruleFeedback = this._rules.step(FIXED_DT, {
          speedMps: ruleSpeedMps,
          steer: input.steer,
          throttle: input.throttle,
          brake: input.brake,
          handbrake: input.handbrake,
        });
        if (this._rules.state.ghostSamples.length > ghostCountBefore) {
          const ghostSamples = this._rules.state.ghostSamples.map((sample, index) => (
            index < ghostCountBefore
              ? sample
              : {
                ...sample,
                s: current.raceProgress,
                lateral: current.lateral,
                speed: current.speedAlongRouteMps,
                heading: current.headingError,
                slip: current.slip,
              }
          ));
          this._rules.debugSet({ ghostSamples }, { publish: false });
        }
        const crossingWasProcessed = this._rules.state.events
          .slice(eventCountBefore)
          .some((event) => (
            (event.type === 'sector' || event.type === 'checkpoint-missed')
              && event.index === checkpointIndex
          ));
        if (confirmedCrossing && !crossingWasProcessed) {
          this._syncRulesMotion(current);
          this._rules._checkpointCrossing(
            previous.raceProgress,
            current.raceProgress,
          );
        }
      } else {
        this._syncRulesMotion(current);
        ruleFeedback = this._rules.step(FIXED_DT, {
          speedMps: 0,
          steer: input.steer,
          throttle: input.throttle,
          brake: input.brake,
          handbrake: input.handbrake,
        });
      }

      if (!projected.rejected) this._projection = current;
      this._syncRulesMotion(this._projection);
      if (!this._championshipLedger || statusBefore !== 'RUNNING') {
        this.state = this._publish(this._projection, this._snapshot, projected.rejected);
      }
      this._lastFeedback = this._mergeFeedback(
        ruleFeedback,
        this._projection,
        this._snapshot,
        projected.rejected,
      );
      return this._lastFeedback;
    }

    step(seconds, input) {
      if (!this._prepared && this._rules.state.status !== 'IDLE') {
        throw new Error('RaceSimulationV6 debe prepararse antes de step activo');
      }
      if (this._qaRouteDriving) {
        return this._lastFeedback || this._mergeFeedback(
          null,
          this._projection,
          this._snapshot,
          false,
        );
      }
      const status = this._rules.state.status;
      if (this._championshipPaused || status === 'PAUSED' || (status === 'FINISHED' && !this._championshipPending()) || status === 'IDLE') {
        const passive = this._rules.step(0, {
          speedMps: 0,
          steer: 0,
          throttle: 0,
          brake: 0,
          handbrake: 0,
        });
        this.state = this._publish(this._projection, this._snapshot);
        this._lastFeedback = this._mergeFeedback(
          passive,
          this._projection,
          this._snapshot,
          false,
        );
        return this._lastFeedback;
      }

      const controls = safeInput(input);
      this._lastControls = controls;
      const requestedSeconds = finite(seconds, 0);
      if (requestedSeconds > MAX_FRAME_SECONDS) this._physicsPerformance.overruns += 1;
      this._accumulator += clamp(requestedSeconds, 0, MAX_FRAME_SECONDS);
      const frameStartedMs = nowMs();
      let substeps = 0;
      let feedback = this._lastFeedback;
      while (this._accumulator + EPSILON >= FIXED_DT) {
        feedback = this._advanceFixed(controls);
        this._accumulator = Math.max(0, this._accumulator - FIXED_DT);
        substeps += 1;
        if (this._rules.state.status === 'FINISHED' && !this._championshipPending()) {
          this._accumulator = 0;
          break;
        }
      }
      const frameMs = Math.max(0, nowMs() - frameStartedMs);
      const performanceState = this._physicsPerformance;
      performanceState.frameCount += 1;
      performanceState.totalSubsteps += substeps;
      performanceState.lastSubsteps = substeps;
      performanceState.maxSubstepsPerFrame = Math.max(performanceState.maxSubstepsPerFrame, substeps);
      performanceState.frameTimesMs.push(frameMs);
      if (performanceState.frameTimesMs.length > 7200) performanceState.frameTimesMs.shift();
      if (!feedback) {
        feedback = this._mergeFeedback(
          null,
          this._projection,
          this._snapshot,
          false,
        );
      }
      return feedback;
    }

    debugSet(partial) {
      this.invalidateChampionship('qa-debug-state');
      this._markPhysicalQA('qa-debug-state');
      this._rules.debugSet(partial || {});
      this.settings = this._rules.settings;
      this.state = this._publish(this._projection, this._snapshot);
      return this.getState();
    }

    async debugDrivePhysicalRoute(options = {}) {
      if (this._rules.state.status !== 'RUNNING') {
        throw new Error('QA physical route drive requires a running route');
      }
      if (!this._prepared || !this._physicsSession?.step) {
        throw new Error('QA physical route drive requires the prepared physics session');
      }
      if (this._qaRouteDriving) throw new Error('QA physical route drive already running');
      const Driver = root.AsfaltoV6Falcon?.FalconDriverAI;
      if (typeof Driver !== 'function') {
        throw new Error('QA physical route drive requires FalconDriverAI');
      }
      this.invalidateChampionship('qa-autonomous-route-driver');
      this._markPhysicalQA('qa-autonomous-route-driver');
      const maximumSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0
        ? options.maxSteps
        : Math.ceil((this.track.length * Math.max(1,this._rules.settings.laps||1) / 5 + 120) / FIXED_DT);
      const yieldEverySteps = Number.isInteger(options.yieldEverySteps)
        && options.yieldEverySteps > 0
        ? options.yieldEverySteps
        : 4096;
      const traceEverySteps = Number.isInteger(options.traceEverySteps)
        && options.traceEverySteps > 0
        ? options.traceEverySteps
        : 1200;
      const driver = new Driver({
        track: this.track,
        seed: 1974,
        wheelbaseM: finite(this._physicsSession?.spec?.wheelbaseM, 2.819),
      });
      const startState = this._rules.getState();
      const startProgressM = this._projection.raceProgress;
      const startPlayerTeleportCount = this._playerTeleportCount;
      const startRecoveryCount = this._recoveryCount;
      let previousProgressM = startProgressM;
      let previousPosition = this._snapshot?.chassis?.position || null;
      let steps = 0;
      let integratedForwardDistanceM = 0;
      let chassisDistanceM = 0;
      let maximumAbsLateralM = Math.abs(finite(this._projection.lateral, 0));
      let maximumSpeedMps = Math.abs(finite(this._projection.speedAlongRouteMps, 0));
      let minimumWheelContacts = Infinity;
      let groundedSteps = 0;
      let fourWheelContactSteps = 0;
      let projectionRejectedSteps = 0;
      let checkpointTransitions = 0;
      let previousCheckpointIndex = finite(startState.nextCheckpointIndex, 0);
      const trace = [];
      this._qaRouteDriving = true;
      try {
        while (this._rules.state.status === 'RUNNING' && steps < maximumSteps) {
          const driverState = this._snapshot
            ? { ...this._snapshot, projection: cloneProjection(this._projection) }
            : { projection: cloneProjection(this._projection) };
          const command = driver.update(FIXED_DT, driverState);
          if (driver.shouldRecover?.()) {
            throw new Error(
              'QA physical route driver became immobile at '
              + this._projection.raceProgress.toFixed(2) + ' m; trace='
              + JSON.stringify(trace),
            );
          }
          const physicalInput = qaPhysicalRouteInput(
            command,
            this._projection,
            this.track,
          );
          this._advanceFixed(physicalInput);
          steps += 1;
          const progressM = this._projection.raceProgress;
          integratedForwardDistanceM += Math.max(0, progressM - previousProgressM);
          previousProgressM = progressM;
          maximumAbsLateralM = Math.max(
            maximumAbsLateralM,
            Math.abs(finite(this._projection.lateral, 0)),
          );
          maximumSpeedMps = Math.max(
            maximumSpeedMps,
            Math.abs(finite(this._projection.speedAlongRouteMps, 0)),
          );
          if (this.state.projectionRejected) projectionRejectedSteps += 1;
          const contacts = Array.isArray(this._snapshot?.wheels)
            ? this._snapshot.wheels.filter(wheel => wheel?.contact).length
            : 0;
          minimumWheelContacts = Math.min(minimumWheelContacts, contacts);
          if (contacts > 0) groundedSteps += 1;
          if (contacts === 4) fourWheelContactSteps += 1;
          const position = this._snapshot?.chassis?.position;
          if (Array.isArray(position) && Array.isArray(previousPosition)) {
            chassisDistanceM += Math.hypot(
              finite(position[0], 0) - finite(previousPosition[0], 0),
              finite(position[1], 0) - finite(previousPosition[1], 0),
              finite(position[2], 0) - finite(previousPosition[2], 0),
            );
          }
          if (Array.isArray(position)) previousPosition = position;
          const checkpointIndex = finite(this._rules.state.nextCheckpointIndex, previousCheckpointIndex);
          const checkpointAdvanced = checkpointIndex !== previousCheckpointIndex;
          if (checkpointAdvanced) {
            checkpointTransitions += checkpointIndex>previousCheckpointIndex?checkpointIndex-previousCheckpointIndex:this.track.checkpoints.length-previousCheckpointIndex+checkpointIndex;
            previousCheckpointIndex = checkpointIndex;
          }
          if (this._rules.state.status === 'FINISHED'
              && !checkpointAdvanced) {
            checkpointTransitions += 1;
          }
          if (steps === 1 || steps % traceEverySteps === 0) {
            trace.push(Object.freeze({
              step: steps,
              progressM,
              lateralM: this._projection.lateral,
              headingErrorRad: this._projection.headingError,
              speedMps: this._projection.speedAlongRouteMps,
              steer: physicalInput.steer,
              throttle: physicalInput.throttle,
              brake: physicalInput.brake,
              contacts,
              brakeFrontC: finite(this._snapshot?.brakes?.frontTemperatureC, 0),
              brakeRearC: finite(this._snapshot?.brakes?.rearTemperatureC, 0),
              brakeFrontFade: finite(this._snapshot?.brakes?.frontFade, 0),
              brakeRearFade: finite(this._snapshot?.brakes?.rearFade, 0),
              brakeCondition: finite(this._snapshot?.damage?.brakes?.condition, 1),
              gear: finite(this._snapshot?.gearbox?.gear, 0),
              engineRpm: finite(this._snapshot?.engine?.rpm, 0),
              wheelAngularRadps: Array.isArray(this._snapshot?.wheels)
                ? this._snapshot.wheels.map(wheel => finite(wheel?.angularSpeedRadps, 0)) : [],
              wheelFxN: Array.isArray(this._snapshot?.wheels)
                ? this._snapshot.wheels.map(wheel => finite(wheel?.tire?.fxN, 0)) : [],
              wheelSlipRatio: Array.isArray(this._snapshot?.wheels)
                ? this._snapshot.wheels.map(wheel => finite(wheel?.slipRatio, 0)) : [],
              wheelNormalLoadN: Array.isArray(this._snapshot?.wheels)
                ? this._snapshot.wheels.map(wheel => finite(wheel?.normalLoadN, 0)) : [],
              wheelNormals: Array.isArray(this._snapshot?.wheels)
                ? this._snapshot.wheels.map(wheel => Array.isArray(wheel?.normal)
                  ? wheel.normal.map(value => finite(value, 0)) : null) : [],
              chassisVelocity: Array.isArray(this._snapshot?.chassis?.linearVelocity)
                ? this._snapshot.chassis.linearVelocity.slice() : null,
              chassisAcceleration: Array.isArray(this._snapshot?.chassis?.acceleration)
                ? this._snapshot.chassis.acceleration.slice() : null,
              debugForces: this._snapshot?.debugForces || null,
              position: Array.isArray(position) ? position.slice() : null,
            }));
            if (trace.length > 32) trace.shift();
          }
          if (steps % yieldEverySteps === 0) {
            if (typeof root.setTimeout === 'function') {
              await new Promise(resolve => root.setTimeout(resolve, 0));
            } else {
              await Promise.resolve();
            }
          }
        }
      } finally {
        this._qaRouteDriving = false;
      }
      const finalState = this._rules.getState();
      if (finalState.status !== 'FINISHED' || finalState.finishReason !== 'completed') {
        throw new Error(
          'QA physical route drive did not finish after ' + steps
          + ' fixed steps at ' + this._projection.raceProgress.toFixed(2) + ' m; trace='
          + JSON.stringify(trace),
        );
      }
      this.settings = this._rules.settings;
      this.state = this._publish(this._projection, this._snapshot);
      return Object.freeze({
        state: this.getState(),
        evidence: Object.freeze({
          mode: 'fixed-step-rapier-route',
          fixedHz: 120,
          steps,
          simulatedSeconds: steps * FIXED_DT,
          startProgressM,
          finishProgressM: this._projection.raceProgress,
          integratedForwardDistanceM,
          chassisDistanceM,
          maximumAbsLateralM,
          maximumSpeedMps,
          minimumWheelContacts: Number.isFinite(minimumWheelContacts)
            ? minimumWheelContacts : 0,
          groundedStepRatio: steps > 0 ? groundedSteps / steps : 0,
          fourWheelContactStepRatio: steps > 0 ? fourWheelContactSteps / steps : 0,
          projectionRejectedSteps,
          checkpointTransitions,
          rivalPhysicalSteps: this._rival && this._rules.settings.mode === 'race' ? steps : 0,
          teleports: this._playerTeleportCount - startPlayerTeleportCount,
          recoveries: this._recoveryCount - startRecoveryCount,
          trace: Object.freeze(trace.slice()),
        }),
      });
    }

    getGhost() {
      return this._rules.getGhost();
    }

    getGhostPose(lapTime) {
      return this._rules.getGhostPose(lapTime);
    }

    getGhostPoseAtDistance(distance) {
      return this._rules.getGhostPoseAtDistance(distance);
    }

    getDiagnostics() {
      const stack = this._physicalStack?.diagnostics || {};
      const performanceState = this._physicsPerformance;
      const frameTimesMs = performanceState.frameTimesMs.slice().sort((a, b) => a - b);
      const frameMsMax = frameTimesMs.length ? frameTimesMs[frameTimesMs.length - 1] : 0;
      return Object.freeze({
        ...stack,
        prepared: this._prepared,
        disposed: this._disposed,
        authority: 'rapier-four-wheel-v6',
        fixedHz: 120,
        vehicleProfile: this._vehicleProfile,
        chassis: this._physicsSession?.getChassisDiagnostics?.() || {
          configured: Boolean(this._chassisConfig),
          configuration: this._chassisConfig ? { ...this._chassisConfig } : null,
          effective: null,
        },
        rivalCount: this._rival ? 1 : 0,
        rivalContactProxyActive: Boolean(this._rival?.isActive?.()),
        forwardGears: this._physicsSession?.spec?.gearbox?.forward?.length || stack.forwardGears || 0,
        playerContacts: this._snapshot?.wheels?.filter(wheel => wheel.contact).length || 0,
        damage: this._snapshot?.damage || null,
        impactCount: this._snapshot?.impacts?.length || 0,
        playerTeleportCount: this._playerTeleportCount,
        recovery: Object.freeze({
          recoveryCount: this._recoveryCount,
          lastRecoveryReason: this._lastRecoveryReason,
          lastSafeProgressM: Number.isFinite(this._lastSafeFrame?.raceProgressM)
            ? this._lastSafeFrame.raceProgressM : null,
          lastSafeTimestampS: Number.isFinite(this._lastSafeFrame?.timestampS)
            ? this._lastSafeFrame.timestampS : null,
          unsupportedSeconds: finite(this._recoveryGuard?.diagnostics?.().unsupportedSeconds, 0),
          previousSeparationM: Number.isFinite(
            this._recoveryGuard?.diagnostics?.().previousSeparationM,
          ) ? this._recoveryGuard.diagnostics().previousSeparationM : null,
          previousProjectionDistanceM: Number.isFinite(
            this._recoveryGuard?.diagnostics?.().previousProjectionDistanceM,
          ) ? this._recoveryGuard.diagnostics().previousProjectionDistanceM : null,
          fallbackReason: this._recoveryFallbackReason,
        }),
        physicsPerformance: Object.freeze({
          frameCount: performanceState.frameCount,
          totalSubsteps: performanceState.totalSubsteps,
          lastSubsteps: performanceState.lastSubsteps,
          maxSubstepsPerFrame: performanceState.maxSubstepsPerFrame,
          overruns: performanceState.overruns,
          frameMs: Object.freeze({
            p50: percentile(frameTimesMs, 0.50),
            p95: percentile(frameTimesMs, 0.95),
            max: frameMsMax,
          }),
        }),
      });
    }
    _publishedRivals() {
      if (!this._rival || this._rules.settings.mode !== 'race') return [];
      const source = this._rivalLastState || this._rival.getState?.() || {};
      const projection = source.projection || source.snapshot?.projection || {};
      return [{
        id: 'falcon',
        name: 'Falcon',
        s: finite(projection.s, 0),
        raceProgress: finite(projection.raceProgress, projection.s || 0),
        lateral: finite(projection.lateral, 0),
        heading: finite(projection.headingError, 0),
        speed: finite(projection.speedAlongRouteMps, 0),
        speedMps: finite(projection.speedAlongRouteMps, 0),
        colorIndex: 0,
        skill: 0.72,
        aggression: 0.46,
        physicsSnapshot: source.snapshot || null,
      }];
    }

    _publish(projection, snapshot, projectionRejected) {
      const rulesState = this._rules.getState();
      const publicSettings = this._publicSettings();
      const state = {
        ...rulesState,
        settings: publicSettings,
        rivals: this._publishedRivals(),
        s: projection.s,
        raceProgress: projection.raceProgress,
        lateral: projection.lateral,
        headingError: projection.headingError,
        yawRate: projection.yawRate,
        lateralVelocity: projection.lateralSpeedMps,
        surface: projection.surface,
        grip: projection.grip,
        slip: projection.slip,
        speedMps: projection.speedAlongRouteMps,
        projection: cloneProjection(projection),
        projectionRejected: Boolean(projectionRejected),
        physicsSnapshot: snapshot || null,
      };
      if (this._championshipLedger) {
        const classification = this.getChampionshipClassification();
        state.championship = Object.freeze({enabled:true,playerFinished:this._championshipLedger.isTerminal('player'),classification});
        state.status = this._championshipPaused ? 'PAUSED' : classification.complete ? 'FINISHED' : rulesState.status === 'FINISHED' ? 'RUNNING' : rulesState.status;
        state.finishReason = classification.complete ? 'completed' : null;
      }
      this.settings = publicSettings;
      return cloneState(state);
    }

    _mergeFeedback(ruleFeedback, projection, snapshot, projectionRejected) {
      const base = ruleFeedback || {};
      return {
        ...base,
        speedMps: projection.speedAlongRouteMps,
        surface: projection.surface,
        grip: projection.grip,
        slip: projection.slip,
        impact: Boolean(base.impact || snapshot?.impact),
        camera: base.camera ? { ...base.camera } : { ...(this.state.camera || {}) },
        track: this.track.sample(projection.s),
        projection: cloneProjection(projection),
        projectionRejected: Boolean(projectionRejected),
        physicsSnapshot: snapshot || null,
      };
    }

    dispose() {
      if (this._disposePromise) return this._disposePromise;
      this._disposed = true;
      this._invalidatePhysicalObservers('session-disposed');
      this._championshipLedger?.cancel();
      this._disposePromise = this._operationTail
        .then(() => this._disposePhysicalStackNow())
        .then(() => true);
      this._operationTail = this._disposePromise.catch(() => {});
      return this._disposePromise;
    }

    getState() {
      return cloneState(this.state);
    }

    getRenderFrame() {
      const controls = Object.freeze({ ...this._lastControls });
      const projection = Object.freeze(cloneProjection(this._projection));
      const alpha = clamp(this._accumulator / FIXED_DT, 0, 1);
      const rivals = this._currentRivalSnapshot
        ? Object.freeze({
          falcon: Object.freeze({
            id: 'falcon',
            alpha,
            currentSnapshot: this._currentRivalSnapshot,
            previousSnapshot: this._previousRivalSnapshot || this._currentRivalSnapshot,
          }),
        })
        : Object.freeze({});
      return Object.freeze({
        alpha,
        referenceChart: this._referenceChart,
        referenceFrameSequence: this._referenceFrameSequence,
        controls,
        currentSnapshot: this._currentSnapshot,
        previousSnapshot: this._previousSnapshot,
        projection,
        rivals,
      });
    }
  }

  function createRaceSimulation(options) {
    return new RaceSimulationV6(options);
  }

  root.AsfaltoV6Integration = Object.freeze({
    FIXED_DT,
    FALSE_START_PENALTY_SECONDS,
    qaPhysicalRouteInput,
    createBrowserPhysicalStack,
    RaceSimulationV6,
    createRaceSimulation,
  });
}(globalThis));
