
(function exposeAsfaltoV6Falcon(root) {
  'use strict';

  const FIXED_DT = 1 / 120;
  const AI_DT = 1 / 30;
  const WHEEL_NAMES = Object.freeze([
    'frontLeft',
    'frontRight',
    'rearLeft',
    'rearRight',
  ]);

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function findFirstMesh(rootObject) {
    let found = null;
    rootObject?.traverse?.((node) => {
      if (!found && node?.isMesh) found = node;
    });
    return found;
  }

  function pointForAttribute(THREE, mesh, position, index) {
    if (THREE?.Vector3 && typeof mesh.localToWorld === 'function') {
      mesh.updateWorldMatrix?.(true, false);
      const point = new THREE.Vector3(
        finite(position.getX(index), 0),
        finite(position.getY(index), 0),
        finite(position.getZ(index), 0),
      );
      return mesh.localToWorld(point).toArray();
    }
    return [
      finite(position.getX(index), 0),
      finite(position.getY(index), 0),
      finite(position.getZ(index), 0),
    ];
  }

  function assignedBone(point, manifest) {
    const matches = [];
    for (let index = 0; index < WHEEL_NAMES.length; index += 1) {
      const wheel = manifest.wheels?.[WHEEL_NAMES[index]];
      if (!wheel) throw new Error('Manifest Falcon sin rueda ' + WHEEL_NAMES[index]);
      const dx = point[0] - wheel.center[0];
      const dy = point[1] - wheel.center[1];
      if (dx * dx + dy * dy <= wheel.radius * wheel.radius
          && Math.abs(point[2] - wheel.center[2]) <= wheel.halfWidth) {
        matches.push(index + 1);
      }
    }
    if (matches.length > 1) throw new Error('V�rtice Falcon asignado a dos ruedas');
    return matches[0] || 0;
  }

  function createFalconVisualRig(THREE, sourceRoot, manifest) {
    if (!THREE?.SkinnedMesh || !THREE?.Bone || !THREE?.Skeleton) {
      throw new TypeError('createFalconVisualRig requiere clases Three de skin');
    }
    if (!sourceRoot?.clone || !manifest?.wheels) {
      throw new TypeError('createFalconVisualRig requiere root y manifest');
    }
    const clonedRoot = sourceRoot.clone(true);
    const clonedMesh = findFirstMesh(clonedRoot);
    if (!clonedMesh?.geometry?.getAttribute) {
      throw new Error('Falcon visual no contiene geometry POSITION');
    }
    const geometry = clonedMesh.geometry.clone();
    // Different glTF bufferViews can share one backing ArrayBuffer. Three's
    // interleaved clone cache keys that whole buffer, so a NORMAL view may
    // accidentally inherit POSITION bytes. Copy each packed view independently
    // before baking; preserve component type/normalization and source bytes.
    for (const [name, attribute] of Object.entries(clonedMesh.geometry.attributes || {})) {
      if (!attribute.isInterleavedBufferAttribute) continue;
      const values = new attribute.array.constructor(attribute.count * attribute.itemSize);
      for (let index = 0; index < attribute.count; index += 1) {
        const from = index * attribute.data.stride + attribute.offset;
        const to = index * attribute.itemSize;
        for (let component = 0; component < attribute.itemSize; component += 1) {
          values[to + component] = attribute.array[from + component];
        }
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    let position = geometry.getAttribute('position');
    if (position.isInterleavedBufferAttribute || position.array?.constructor !== Float32Array) {
      const values = new Float32Array(position.count * position.itemSize);
      for (let index = 0; index < position.count; index += 1) {
        const offset = index * position.itemSize;
        values[offset] = position.getX(index);
        values[offset + 1] = position.getY(index);
        values[offset + 2] = position.getZ(index);
      }
      position = new THREE.Float32BufferAttribute(values, position.itemSize);
      geometry.setAttribute('position', position);
    }
    const skinIndices = new Uint16Array(position.count * 4);
    const skinWeights = new Float32Array(position.count * 4);
    for (let index = 0; index < position.count; index += 1) {
      skinIndices[index * 4] = assignedBone(
        pointForAttribute(THREE, clonedMesh, position, index),
        manifest,
      );
      skinWeights[index * 4] = 1;
    }
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(skinIndices, 4),
    );
    geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(skinWeights, 4),
    );
    clonedRoot.updateMatrixWorld?.(true);
    const bakedToAuthoredSpace = typeof geometry.applyMatrix4 === 'function'
      && clonedMesh.matrixWorld;
    if (bakedToAuthoredSpace) geometry.applyMatrix4(clonedMesh.matrixWorld);

    const skinnedMesh = new THREE.SkinnedMesh(geometry, clonedMesh.material);
    skinnedMesh.name = clonedMesh.name || 'falcon-skinned';
    if (!bakedToAuthoredSpace && clonedMesh.position && skinnedMesh.position?.copy) {
      skinnedMesh.position.copy(clonedMesh.position);
      skinnedMesh.quaternion?.copy?.(clonedMesh.quaternion);
      skinnedMesh.scale?.copy?.(clonedMesh.scale);
    }
    const parent = clonedMesh.parent;
    if (!parent) throw new Error('Falcon mesh sin parent');
    parent.remove(clonedMesh);
    if (bakedToAuthoredSpace) clonedRoot.add(skinnedMesh);
    else parent.add(skinnedMesh);

    const bones = manifest.bones.map((entry) => {
      const bone = new THREE.Bone();
      bone.name = entry.name;
      bone.position.set(entry.center[0], entry.center[1], entry.center[2]);
      bone.rotation.order = 'YXZ';
      bone.userData = {
        ...(bone.userData || {}),
        falconRigIndex: entry.index,
        restCenter: [...entry.center],
      };
      return bone;
    });
    const bodyBone = bones[0];
    for (let index = 1; index < bones.length; index += 1) bodyBone.add(bones[index]);
    skinnedMesh.add(bodyBone);
    const skeleton = new THREE.Skeleton(bones);
    skinnedMesh.bind(skeleton);
    clonedRoot.scale?.setScalar?.(manifest.uniformScale);
    const bonesByName = Object.fromEntries(bones.map(bone => [bone.name, bone]));

    function update(snapshot) {
      const wheels = snapshot?.wheels || [];
      for (const wheel of wheels) {
        const bone = bonesByName[wheel.id];
        if (!bone) continue;
        const isFront = wheel.id === 'frontLeft' || wheel.id === 'frontRight';
        bone.rotation.y = isFront ? finite(wheel.steerAngleRad, 0) : 0;
        bone.rotation.z = finite(wheel.rotationRad, 0);
        bone.userData.v6SteerRad = bone.rotation.y;
        bone.userData.v6SpinRad = bone.rotation.z;
        const manifestWheel = manifest.wheels[wheel.id];
        const compression = finite(wheel.compressionM, 0);
        bone.position.y = manifestWheel.center[1]
          - compression / Math.max(1e-9, finite(manifest.uniformScale, 1));
      }
      return true;
    }

    return Object.freeze({
      root: clonedRoot,
      mesh: skinnedMesh,
      skeleton,
      bones: Object.freeze(bones.slice()),
      bonesByName: Object.freeze(bonesByName),
      update,
    });
  }

  function seededLaneOffset(seed, distance) {
    const cell = Math.floor(finite(distance, 0) / 45);
    const x = Math.sin((finite(seed, 77) + 1) * 12.9898 + cell * 78.233) * 43758.5453;
    return (x - Math.floor(x) - 0.5) * 0.22;
  }

  function maximumDamage(damage) {
    if (!damage || typeof damage !== 'object') return 0;
    function severity(value, key, depth) {
      if (Number.isFinite(value)) {
        if (depth > 0 && /(condition|factor|reliability|ratio)$/i.test(key)) {
          return 1 - clamp(value, 0, 1);
        }
        if (/offsetRad$/i.test(key)) return clamp(Math.abs(value) / 0.18, 0, 1);
        return clamp(value, 0, 1);
      }
      if (!value || typeof value !== 'object') return 0;
      let maximum = 0;
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        maximum = Math.max(maximum, severity(nestedValue, nestedKey, depth + 1));
      }
      return maximum;
    }
    return severity(damage, 'damage', 0);
  }

  function wheelById(wheels, id) {
    return wheels.find(wheel => wheel?.id === id) || {};
  }

  class FalconDriverAI {
    constructor(options) {
      if (!options?.track?.sample) throw new TypeError('FalconDriverAI requiere track');
      this.track = options.track;
      this.seed = Number.isInteger(options.seed) ? options.seed : 77;
      this.wheelbaseM = finite(options.wheelbaseM, 2.79);
      this.accumulator = 0;
      this.initialized = false;
      this.command = Object.freeze({
        steer: 0,
        throttle: 0.35,
        brake: 0,
        clutch: 1,
        requestedGear: 1,
      });
      this.immobileSeconds = 0;
      this.recoveryRequested = false;
    }

    _preview(projection, speedMps) {
      const s = finite(projection.s, finite(projection.raceProgress, 0));
      // Include the contact patch and near apex. Looking only 50-170 m ahead
      // drops the current bend from the speed envelope and reapplies throttle
      // while the rear axle is still cornering.
      const distances = [0, Math.min(12,5+speedMps*.25),18+speedMps*.7,40+speedMps*1.3,75+speedMps*2];
      let signedCurvature=0,maximumCurvature=.0005,authoredTargetMps=Infinity;
      for(let index=0;index<distances.length;index++){
        const sample=this.track.sample(s+distances[index]);const curvature=finite(sample?.curvature,0);
        signedCurvature+=curvature*[.55,.25,.15,.04,.01][index];maximumCurvature=Math.max(maximumCurvature,Math.abs(curvature));
        if(Number.isFinite(sample?.targetSpeedKph)&&sample.targetSpeedKph>0)authoredTargetMps=Math.min(authoredTargetMps,sample.targetSpeedKph/3.6*.82);
      }
      return {signedCurvature,maximumCurvature,authoredTargetMps};
    }

    _selectGear(speedMps, currentGear) {
      const thresholds = [0, 7.5, 15.5, 24.5];
      let target = 1;
      for (let index = 1; index < thresholds.length; index += 1) {
        if (speedMps >= thresholds[index]) target = index + 1;
      }
      if (Number.isInteger(currentGear) && currentGear >= 1 && currentGear <= 4) {
        if (target > currentGear + 1) return currentGear + 1;
        if (target < currentGear - 1) return currentGear - 1;
      }
      return target;
    }

    _compute(state) {
      const projection = state?.projection || {};
      const speedMps = Math.abs(finite(projection.speedAlongRouteMps, 0));
      const preview = this._preview(projection, speedMps);
      const damage = maximumDamage(state?.damage);
      const dryUtilization = 0.50 * clamp(finite(projection.grip,.92),.35,1);
      const curvatureTarget = Math.sqrt(
        dryUtilization * 9.81 / Math.max(0.0005, preview.maximumCurvature),
      );
      const damagePace = 1 - damage * 0.42;
      let targetSpeedMps = clamp(Math.min(curvatureTarget,preview.authoredTargetMps,32)*damagePace,5,32);
      const lateralMargin=Math.abs(finite(projection.lateral,0));
      const usableHalf=Math.max(1.5,finite(projection.routeHalfWidthM,3.5)-1.05);
      if(lateralMargin>usableHalf)targetSpeedMps=Math.min(targetSpeedMps,12);
      if(lateralMargin>usableHalf+.4)targetSpeedMps=Math.min(targetSpeedMps,7);
      let laneTarget=seededLaneOffset(this.seed,projection.raceProgress);
      const traffic=state?.traffic;
      if(traffic&&traffic.gapM>-12&&traffic.gapM<55){
        const roadHalf=finite(projection.routeHalfWidthM,3.5),limit=Math.max(.3,roadHalf-1.15);
        const side=traffic.lateralM>.2?-1:1;
        laneTarget=clamp(traffic.lateralM+side*2.08,-limit,limit);
        const lateralSeparation=Math.abs(finite(projection.lateral,0)-traffic.lateralM);
        if(traffic.gapM>0&&lateralSeparation<1.97){
          const space=Math.max(0,traffic.gapM-6.2),followingSpeed=traffic.speedMps+space/1.7;
          targetSpeedMps=Math.min(targetSpeedMps,followingSpeed);
        }
      }
      const speedError = targetSpeedMps - speedMps;
      let throttle = clamp(0.28 + speedError / 12, 0, 1);
      let brake = clamp(-speedError / 9, 0, 1);

      const lateral = finite(projection.lateral, 0);
      const headingError = finite(projection.headingError, 0);

      let steer = Math.atan(this.wheelbaseM * preview.signedCurvature)
        - headingError * 1.4
        - (lateral - laneTarget) * 0.15
        - finite(projection.lateralSpeedMps,0) * 0.045;

      // Rapier's positive Y rotation turns the vehicle's authored +X forward
      // vector toward -Z, while route heading grows toward +Z.
      const yawRate = -finite(state?.chassis?.angularVelocity?.[1], 0);
      const expectedYaw = speedMps * preview.signedCurvature;
      const rearLeft = wheelById(state?.wheels || [], 'rearLeft');
      const rearRight = wheelById(state?.wheels || [], 'rearRight');
      const rearSlip = (
        Math.abs(finite(rearLeft.slipAngleRad, 0))
        + Math.abs(finite(rearRight.slipAngleRad, 0))
      ) * 0.5;
      const oversteer = yawRate - expectedYaw;
      if (rearSlip > 0.12 || Math.abs(oversteer) > 0.22) {
        steer -= oversteer * 0.32 + Math.sign(oversteer || yawRate) * rearSlip * 0.42;
        throttle *= clamp(1 - rearSlip * 1.25, 0.2, 1);
      }

      if (state?.blocked) {
        throttle = 0;
        brake = Math.max(brake, 0.72);
      }
      throttle *= 1 - damage * 0.72;
      if (damage > 0.55) brake = Math.max(brake, 0.08 + damage * 0.12);
      steer = clamp(steer, -0.65, 0.65);
      throttle = clamp(throttle, 0, 1);
      brake = clamp(brake, 0, 1);
      const currentGear = finite(state?.gearbox?.gear, 1);
      const requestedGear = this._selectGear(speedMps, currentGear);
      const clutch = speedMps < 1.2 && requestedGear === 1
        ? clamp(0.45 + speedMps * 0.4, 0.45, 1)
        : 1;

      if (speedMps < 0.4 && throttle > 0.3) this.immobileSeconds += AI_DT;
      else this.immobileSeconds = Math.max(0, this.immobileSeconds - AI_DT * 2);
      if (this.immobileSeconds >= 6) this.recoveryRequested = true;

      return Object.freeze({
        steer,
        throttle,
        brake,
        clutch,
        requestedGear,
      });
    }

    update(deltaSeconds, state) {
      const dt = clamp(finite(deltaSeconds, 0), 0, 0.25);
      if (!this.initialized) {
        this.initialized = true;
        this.command = this._compute(state);
        this.accumulator = 0;
      } else {
        this.accumulator += dt;
        if (this.accumulator + 1e-12 >= AI_DT) {
          this.accumulator %= AI_DT;
          this.command = this._compute(state);
        }
      }
      return { ...this.command };
    }

    shouldRecover() {
      return this.recoveryRequested;
    }

    clearRecoveryRequest() {
      this.recoveryRequested = false;
      this.immobileSeconds = 0;
      return true;
    }
  }

  class FalconRival {
    constructor(options) {
      if (!options?.physicsSession?.step || !options?.track?.sample) {
        throw new TypeError('FalconRival requiere physicsSession y track');
      }
      this.physicsSession = options.physicsSession;
      this.track = options.track;
      this.trackAdapter = options.trackAdapter || null;
      this.getTrafficState = options.getTrafficState || null;
      this.ai = options.ai || new FalconDriverAI({
        track: this.track,
        seed: options.seed,
        wheelbaseM: options.wheelbaseM,
      });
      this.snapshot = this.physicsSession.getSnapshot?.() || null;
      this.projection = this._project(this.snapshot);
      this.command = null;
    }

    _project(snapshot) {
      if (!snapshot) return null;
      if (typeof this.trackAdapter?.projectSnapshot === 'function') {
        return this.trackAdapter.projectSnapshot(snapshot, {
          previous: this.projection,
          track: this.track,
        });
      }
      return snapshot.projection || null;
    }

    step(deltaSeconds) {
      if (Math.abs(finite(deltaSeconds, 0) - FIXED_DT) > 1e-12) {
        throw new Error('FalconRival requiere fixed dt 1/120');
      }
      const aiState = this.snapshot
        ? { ...this.snapshot, projection: this.projection || this.snapshot.projection }
        : { projection: this.projection };
      if(!this.trafficState||!this.ai.initialized||this.ai.accumulator+FIXED_DT+1e-12>=AI_DT)this.trafficState=this.getTrafficState?.();
      const traffic=this.trafficState;
      if(traffic?.projection){
        let gapM=finite(traffic.projection.raceProgress,traffic.projection.s)-finite(this.projection?.raceProgress,this.projection?.s);
        if(this.track.closed)gapM=((gapM+this.track.length*.5)%this.track.length+this.track.length)%this.track.length-this.track.length*.5;
        aiState.traffic={gapM,lateralM:finite(traffic.projection.lateral,0),speedMps:Math.max(0,finite(traffic.projection.speedAlongRouteMps,0))};
      }
      this.command = this.ai.update(FIXED_DT, aiState);
      const controls = {
        steer: this.command.steer,
        throttle: this.command.throttle,
        brake: this.command.brake,
        handbrake: 0,
        clutchEngagement: this.command.clutch,
        requestedGear: this.command.requestedGear,
      };
      this.snapshot = this.physicsSession.step(FIXED_DT, controls);
      this.projection = this._project(this.snapshot);
      return Object.freeze({
        snapshot: this.snapshot,
        projection: this.projection,
        command: Object.freeze({ ...this.command }),
        recoveryRequested: this.ai.shouldRecover(),
      });
    }

    recover(progress) {
      const s = this.track.closed === false
        ? clamp(finite(progress, 0), 0, this.track.length)
        : finite(progress, 0);
      let frame;
      if (typeof this.trackAdapter?.safeFrame === 'function') {
        frame = this.trackAdapter.safeFrame(s);
      } else {
        const sample = this.track.sample(s);
        frame = {
          s,
          x: finite(sample.x, 0),
          y: finite(sample.y, 0) + 0.75,
          z: finite(sample.z, 0),
          yawRad: finite(sample.heading, 0),
        };
      }
      this.physicsSession.teleport(frame, { x: 0, y: 0, z: 0 });
      this.snapshot = this.physicsSession.getSnapshot?.() || this.snapshot;
      this.projection = {
        ...(this.projection || {}),
        s,
        raceProgress: s,
        lateral: 0,
        headingError: 0,
        speedAlongRouteMps: 0,
      };
      this.ai.clearRecoveryRequest();
      return true;
    }

    applyImpact(event) {
      if (typeof this.physicsSession.applyImpact !== 'function') return this.snapshot;
      this.snapshot = this.physicsSession.applyImpact(event) || this.snapshot;
      return this.snapshot;
    }

    getState() {
      return {
        snapshot: this.snapshot,
        projection: this.projection ? { ...this.projection } : null,
        command: this.command ? { ...this.command } : null,
        recoveryRequested: this.ai.shouldRecover(),
      };
    }
  }

  function createFalconRival(options) {
    return new FalconRival(options);
  }

  root.AsfaltoV6Falcon = Object.freeze({
    FIXED_DT,
    AI_DT,
    WHEEL_NAMES,
    maximumDamage,
    createFalconVisualRig,
    FalconDriverAI,
    FalconRival,
    createFalconRival,
  });
}(globalThis));
