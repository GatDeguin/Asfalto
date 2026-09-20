
(function installAsfaltoV6Physics(root) {
  'use strict';

  const FIXED_DT = 1 / 120;
  const TELEPORT_TOKENS = new WeakSet();

  function finite(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  function scale(vector, factor) {
    return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function length(vector) {
    return Math.hypot(vector[0], vector[1], vector[2]);
  }

  function normalized(vector, fallback) {
    const magnitude = length(vector);
    return magnitude > 1e-9 ? scale(vector, 1 / magnitude) : fallback.slice();
  }

  function rotateByQuaternion(vector, quaternion) {
    const qx = finite(quaternion.x, 0);
    const qy = finite(quaternion.y, 0);
    const qz = finite(quaternion.z, 0);
    const qw = finite(quaternion.w, 1);
    const x = vector[0];
    const y = vector[1];
    const z = vector[2];
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    return [
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx,
    ];
  }

  function transformPoint(elements, x, y, z) {
    if (!elements || elements.length < 16) return [x, y, z];
    const w = elements[3] * x + elements[7] * y + elements[11] * z + elements[15];
    const divisor = Math.abs(w) > 1e-12 ? w : 1;
    return [
      (elements[0] * x + elements[4] * y + elements[8] * z + elements[12]) / divisor,
      (elements[1] * x + elements[5] * y + elements[9] * z + elements[13]) / divisor,
      (elements[2] * x + elements[6] * y + elements[10] * z + elements[14]) / divisor,
    ];
  }

  function collectCollisionTriangles(THREE, collisionRoot, options = {}) {
    void THREE;
    if (!collisionRoot || typeof collisionRoot.traverse !== 'function') {
      throw new TypeError('collisionRoot con traverse requerido');
    }
    collisionRoot.updateMatrixWorld?.(true);
    const vertices = [];
    const indices = [];
    const minimum = [Infinity, Infinity, Infinity];
    const maximum = [-Infinity, -Infinity, -Infinity];
    let meshCount = 0;
    collisionRoot.traverse((node) => {
      if (!node?.isMesh) return;
      if (typeof options.includeMesh === 'function' && !options.includeMesh(node)) return;
      const geometry = node.geometry;
      const position = geometry?.attributes?.position;
      const positionArray = position?.array;
      const itemSize = position?.itemSize || 3;
      const count = position?.count ?? (positionArray ? positionArray.length / itemSize : 0);
      if (!positionArray || itemSize < 3 || !Number.isInteger(count) || count < 3) return;
      const matrix = node.matrixWorld?.elements;
      const sourceIndices = geometry.index?.array;
      const available = geometry.index?.count ?? sourceIndices?.length ?? count;
      const first = Math.max(0, Math.floor(finite(geometry.drawRange?.start, 0) / 3) * 3);
      const limit = Math.min(available, first + Math.max(0, finite(geometry.drawRange?.count, available)));
      if (limit <= first) return;
      if ((limit-first) % 3 !== 0) throw new Error('collision mesh index count no divisible por tres');
      let instances = node.isInstancedMesh ? node.instanceMatrix?.array : null;
      let instanceCount = instances ? Math.min(node.count, instances.length/16) : 1;
      // Visibility windows compact the live instance buffer. Read their immutable
      // chart copy so changing the rendering camera never changes collision.
      let canonical = null;
      if (node.isInstancedMesh && typeof node.userData?.asfaltoCloneForChart === 'function') {
        canonical = node.userData.asfaltoCloneForChart({});
        if (!canonical) return;
        instances = canonical.instanceMatrix.array; instanceCount = canonical.count;
      }
      try { for (let instance = 0; instance < instanceCount; instance += 1) {
        const baseIndex = vertices.length / 3;
        const localMatrix = instances?.subarray(instance*16,instance*16+16);
        for (let index = 0; index < count; index += 1) {
          const offset = index * itemSize;
          const local = localMatrix ? transformPoint(localMatrix,positionArray[offset],positionArray[offset+1],positionArray[offset+2])
            : [positionArray[offset],positionArray[offset+1],positionArray[offset+2]];
          const point = transformPoint(matrix,...local);
          if (!point.every(Number.isFinite)) throw new TypeError('collision mesh contiene vertice no finito');
          vertices.push(...point);
          for (let axis=0;axis<3;axis++) {minimum[axis]=Math.min(minimum[axis],point[axis]);maximum[axis]=Math.max(maximum[axis],point[axis]);}
        }
        for (let index=first;index<limit;index++) {
          const localIndex=sourceIndices?Number(sourceIndices[index]):index;
          if (!Number.isInteger(localIndex)||localIndex<0||localIndex>=count) throw new Error('collision mesh contiene indice invalido');
          indices.push(baseIndex+localIndex);
        }
      }} finally { canonical?.dispose?.(); }
      meshCount += 1;
    });
    if (meshCount === 0 || vertices.length === 0 || indices.length === 0) {
      throw new Error('collisionRoot no contiene triangulos');
    }
    return Object.freeze({
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      meshCount,
      triangleCount: indices.length / 3,
      bounds: Object.freeze({ min: Object.freeze(minimum), max: Object.freeze(maximum) }),
    });
  }

  function buildRouteRibbonTriangles(track, options = {}) {
    if (!track || typeof track.sample !== 'function') {
      throw new TypeError('route ribbon requiere track.sample');
    }
    const routeLengthM = finite(track.length, 0);
    if (!(routeLengthM > 0)) throw new TypeError('route ribbon requiere longitud positiva');
    const stepM = clamp(finite(options.stepM, 5), 1, 25);
    const endpointMarginM = Math.max(0, finite(options.endpointMarginM, 0));
    const stationCount = Math.ceil(routeLengthM / stepM) + 1;
    const stations = [];
    for (let index = 0; index < stationCount; index += 1) {
      const s = Math.min(routeLengthM, index * stepM);
      const sample = track.sample(s) || {};
      const x = finite(sample.x, finite(sample.position?.[0], NaN));
      const y = finite(sample.y, finite(sample.position?.[1], NaN));
      const z = finite(sample.z, finite(sample.position?.[2], NaN));
      if (![x, y, z].every(Number.isFinite)) {
        throw new TypeError('route ribbon contiene muestra no finita en ' + s + ' m');
      }
      const widthM = Math.max(2, finite(
        sample.width,
        finite(sample.widthM, typeof track.widthAt === 'function' ? track.widthAt(s) : 8),
      ));
      stations.push({ s, x, y, z, widthM });
    }
    const vertices = [];
    const indices = [];
    const minimum = [Infinity, Infinity, Infinity];
    const maximum = [-Infinity, -Infinity, -Infinity];
    for (let index = 0; index < stations.length; index += 1) {
      const station = stations[index];
      const previous = stations[Math.max(0, index - 1)];
      const next = stations[Math.min(stations.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const dz = next.z - previous.z;
      const horizontalMagnitude = Math.hypot(dx, dz) || 1;
      const routeMagnitude = Math.hypot(dx, dy, dz) || 1;
      const leftX = -dz / horizontalMagnitude;
      const leftZ = dx / horizontalMagnitude;
      const halfWidthM = station.widthM * 0.5;
      const endpointDirection = index === 0 ? -1 : index === stations.length - 1 ? 1 : 0;
      const endpointOffsetM = endpointDirection * endpointMarginM;
      const center = [
        station.x + dx / routeMagnitude * endpointOffsetM,
        station.y + dy / routeMagnitude * endpointOffsetM,
        station.z + dz / routeMagnitude * endpointOffsetM,
      ];
      const points = [
        [center[0] + leftX * halfWidthM, center[1], center[2] + leftZ * halfWidthM],
        [center[0] - leftX * halfWidthM, center[1], center[2] - leftZ * halfWidthM],
      ];
      for (const point of points) {
        vertices.push(...point);
        for (let axis = 0; axis < 3; axis += 1) {
          minimum[axis] = Math.min(minimum[axis], point[axis]);
          maximum[axis] = Math.max(maximum[axis], point[axis]);
        }
      }
      if (index + 1 < stations.length) {
        const left = index * 2;
        const right = left + 1;
        const nextLeft = left + 2;
        const nextRight = left + 3;
        indices.push(left, nextLeft, right, nextLeft, nextRight, right);
      }
    }
    return Object.freeze({
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      meshCount: 1,
      triangleCount: indices.length / 3,
      bounds: Object.freeze({ min: Object.freeze(minimum), max: Object.freeze(maximum) }),
    });
  }

  function createRapierTrackCollider(RAPIER, world, triangles, { material = 'unknown' } = {}) {
    if (!RAPIER?.ColliderDesc || !world?.createCollider) throw new TypeError('Rapier World requerido');
    const verticesAreFloat32 = triangles?.vertices?.constructor?.name === 'Float32Array'
      && ArrayBuffer.isView(triangles.vertices);
    const indicesAreUint32 = triangles?.indices?.constructor?.name === 'Uint32Array'
      && ArrayBuffer.isView(triangles.indices);
    if (!verticesAreFloat32 || !indicesAreUint32
        || triangles.indices.length % 3 !== 0) {
      throw new TypeError('triangulos de pista invalidos');
    }
    const descriptor = RAPIER.ColliderDesc.trimesh(triangles.vertices, triangles.indices)
      .setFriction(0.05)
      .setRestitution(0.02);
    const collider = world.createCollider(descriptor);
    collider.asfaltoContactMaterial = material;
    return collider;
  }

  function sceneCollisionRole(node) {
    if (!node?.isMesh || !node.geometry?.attributes?.position || node.geometry.drawRange?.count===0
        || node.userData?.collision===false || node.userData?.asfaltoDistantRidge) return null;
    const names=[];for(let p=node;p;p=p.parent)names.push(String(p.name||''));
    const path=names.join(' ').toLowerCase();
    if (/resource.owner|source.owner|detail.template|backdrop|billboard|canopy|foliage|leaves|grass|snow.patch|mist|water|wetland|river.design/.test(path)) return null;
    const materials=Array.isArray(node.material)?node.material:[node.material];
    if(materials.length&&materials.every(m=>m?.transparent||m?.transmission>0))return null;
    const roles=materials.map(m=>m?.userData?.asfaltoSurfaceRole);
    if (/terrain|shoulder|pulloff|talus|river.bank|shore.gravel|ground/.test(path)||roles.includes('terrain'))return 'ground';
    if (/rock|boulder|stone.outcrop|retaining/.test(path)||roles.includes('rock'))return 'obstacle';
    return null;
  }

  // Own the copied Rapier shapes, not graphics resources. Once loaded, sector
  // collision survives render culling and LOD disposal until the track is freed.
  function createSceneCollisionLayer(RAPIER,worlds,getRoot) {
    const records=new Map(),slots=new Map(),nodeBindings=new WeakMap();
    let disposed=false,lastRefresh=-Infinity,refreshes=0,builds=0,triangleCount=0,buildTimeMs=0,nextSlot=0;
    let sourceMeshes=0,duplicateSourcePaths=0,lastBuiltMeshes=0,cacheHits=0;
    function refresh({timeSeconds=0,force=false}={}) {
      if(disposed||(!force&&timeSeconds>=lastRefresh&&timeSeconds-lastRefresh<.5))return false;
      lastRefresh=timeSeconds;refreshes++;lastBuiltMeshes=0;
      const root=getRoot?.();if(!root?.traverse)return false;
      root.updateMatrixWorld?.(true);const before=Date.now();let changed=false;
      const entries=[],present=new Set(),seen=new Set(),paths=new Set();
      root.traverse(node=>{
        const role=sceneCollisionRole(node);if(!role)return;
        const parts=[];for(let p=node;p&&p!==root;p=p.parent)parts.push(String(p.name||'mesh-'+(p.parent?.children?.indexOf(p)||0)).replace(/lod[ _-]?\d+/ig,'lod'));
        const path=parts.reverse().join('/'),binding=nodeBindings.get(node);
        // Names identify a replacement slot, not a live object: repeated detail
        // groups legitimately contain identically named tiles at different poses.
        const current=binding&&records.get(binding.key)?.binding===binding?binding:null;
        if(current)present.add(current.key);
        paths.add(path);entries.push({node,role,path,binding:current});
      });
      sourceMeshes=entries.length;duplicateSourcePaths=entries.length-paths.size;
      for(const entry of entries){
        const {node,role,path}=entry;let binding=entry.binding;
        if(!binding){
          const candidates=slots.get(path)||[],key=candidates.find(key=>!present.has(key))??++nextSlot;
          if(!slots.has(path))slots.set(path,candidates);
          if(!candidates.includes(key))candidates.push(key);
          binding={key};nodeBindings.set(node,binding);present.add(key);
        }
        const key=binding.key,g=node.geometry,p=g.attributes.position;
        const canonical=node.userData?.asfaltoCanonicalInstances;
        const signature=[g.uuid||g.id||'',p.version||0,g.index?.version||0,g.drawRange?.start,g.drawRange?.count,
          canonical?'canonical-'+(canonical.version||0):(node.instanceMatrix?.version||0),...(node.matrixWorld?.elements||[])].join('|');
        seen.add(key);const previous=records.get(key);
        if(previous){previous.binding=binding;previous.chartScoped=/_CHART_-?\d+/i.test(path);}
        if(previous?.signature===signature){cacheHits++;continue;}
        let triangles;try{triangles=collectCollisionTriangles({}, {traverse:visit=>visit(node)});}
        catch(error){if(/no contiene triangulos/.test(String(error?.message)))continue;throw error;}
        const colliders=[];
        try{for(const world of worlds)colliders.push(createRapierTrackCollider(RAPIER,world,triangles,{material:role==='ground'?'soil':'stone'}));}
        catch(error){colliders.forEach((collider,i)=>worlds[i].removeCollider(collider,true));throw error;}
        records.set(key,{signature,binding,path,role,colliders,triangles:triangles.triangleCount,chartScoped:/_CHART_-?\d+/i.test(path)});
        triangleCount+=triangles.triangleCount-(previous?.triangles||0);builds++;lastBuiltMeshes++;changed=true;
        if(previous)previous.colliders.forEach((collider,i)=>worlds[i].removeCollider(collider,true));
      }
      // A discarded seam chart is an obsolete spatial copy, unlike a culled
      // sector. Keep sector contacts, but do not accumulate past lap copies.
      for(const [key,record] of records)if(record.chartScoped&&!seen.has(key)){
        record.colliders.forEach((collider,i)=>worlds[i].removeCollider(collider,true));
        triangleCount-=record.triangles;records.delete(key);changed=true;
        const candidates=slots.get(record.path);if(candidates){const i=candidates.indexOf(key);if(i>=0)candidates.splice(i,1);if(!candidates.length)slots.delete(record.path);}
      }
      // Only the dedicated static query world needs an immediate BVH refresh.
      if(changed)worlds.at(-1).step();
      buildTimeMs+=Date.now()-before;return changed;
    }
    function diagnostics(){return {meshes:records.size,colliders:records.size*worlds.length,triangleCount,builds,refreshes,buildTimeMs,
      sourceMeshes,duplicateSourcePaths,lastBuiltMeshes,cacheHits,refreshIntervalSeconds:.5,retainedAcrossVisualUnload:true,disposed};}
    function dispose(){if(disposed)return;disposed=true;for(const record of records.values())record.colliders.forEach((collider,i)=>worlds[i].removeCollider(collider,true));records.clear();slots.clear();triangleCount=0;}
    return {refresh,diagnostics,dispose};
  }

  function createVehicleBody(RAPIER, world, spec, spawn) {
    const yaw = finite(spawn?.yawRad, 0);
    const halfYaw = yaw * 0.5;
    const descriptor = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(finite(spawn?.x, 0), finite(spawn?.y, 0.7), finite(spawn?.z, 0))
      .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
      .setLinearDamping(finite(spec.aero?.linearDamping, 0.015))
      .setAngularDamping(0.1)
      .setCcdEnabled(true)
      .setCanSleep(false);
    const body = world.createRigidBody(descriptor);
    // Measured from the approved GLB paint and bumper envelope in chassis metres.
    // Mirrors/antenna do not enlarge contact. See vehicles/dimensions-and-contact.json.
    const measuredHull = /falcon/i.test(spec.id)
      ? { minX: -2.57872, maxX: 2.05724, minZ: -.90828, maxZ: .91248 }
      : /chevy/i.test(spec.id)
        ? { minX: -2.69364, maxX: 2.10835, minZ: -.89002, maxZ: .89484 }
        : null;
    const legacyHalf = { x: spec.dimensionsM.length * .38,
      y: spec.dimensionsM.height * .18, z: spec.dimensionsM.width * .42 };
    const lowerCenter = measuredHull
      ? { x: (measuredHull.minX + measuredHull.maxX) / 2, y: -.02,
          z: (measuredHull.minZ + measuredHull.maxZ) / 2 }
      : { x: -.03, y: -.02, z: 0 };
    const lowerMass = spec.massKg * .72;
    const lower = RAPIER.ColliderDesc.cuboid(
      measuredHull ? (measuredHull.maxX - measuredHull.minX) / 2 : legacyHalf.x,
      legacyHalf.y,
      measuredHull ? (measuredHull.maxZ - measuredHull.minZ) / 2 : legacyHalf.z,
    )
      .setTranslation(lowerCenter.x, lowerCenter.y, lowerCenter.z)
      // Changing the collision skin must not silently change handling. Preserve
      // the original box's mass, mass center and inertia tensor exactly.
      .setMassProperties(lowerMass,
        { x: -.03 - lowerCenter.x, y: 0, z: -lowerCenter.z },
        { x: lowerMass / 3 * (legacyHalf.y ** 2 + legacyHalf.z ** 2),
          y: lowerMass / 3 * (legacyHalf.x ** 2 + legacyHalf.z ** 2),
          z: lowerMass / 3 * (legacyHalf.x ** 2 + legacyHalf.y ** 2) },
        { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(0.04)
      .setRestitution(0.04);
    const upper = RAPIER.ColliderDesc.cuboid(
      spec.dimensionsM.length * 0.21,
      spec.dimensionsM.height * 0.16,
      spec.dimensionsM.width * 0.34,
    )
      .setTranslation(-0.22, spec.dimensionsM.height * 0.25, 0)
      .setMass(spec.massKg * 0.28)
      .setFriction(0.04)
      .setRestitution(0.04);
    const colliders = Object.freeze([
      world.createCollider(lower, body),
      world.createCollider(upper, body),
    ]);
    return Object.freeze({ body, colliders });
  }

  function normalizeRouteSamples(track) {
    const source = track?.samples || track?.route || track;
    if (!Array.isArray(source) || source.length < 2) throw new TypeError('ruta con al menos dos muestras requerida');
    const samples = [];
    let cumulative = 0;
    for (let index = 0; index < source.length; index += 1) {
      const point = source[index];
      const x = finite(point?.x ?? point?.[0], NaN);
      const y = finite(point?.y ?? point?.[1], 0);
      const z = finite(point?.z ?? point?.[2], NaN);
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError('muestra de ruta invalida');
      if (index > 0) {
        const previous = samples[index - 1];
        cumulative += Math.hypot(x - previous.x, y - previous.y, z - previous.z);
      }
      const suppliedS = finite(point?.s, NaN);
      samples.push(Object.freeze({ x, y, z, s: Number.isFinite(suppliedS) ? suppliedS : cumulative }));
    }
    return Object.freeze(samples);
  }

  function gridKey(x, z, cellSizeM) {
    return Math.floor(x / cellSizeM) + ':' + Math.floor(z / cellSizeM);
  }

  function createRouteSpatialIndex(track) {
    const samples = normalizeRouteSamples(track);
    const cellSizeM = 50;
    const cells = new Map();
    for (let index = 0; index < samples.length - 1; index += 1) {
      const a = samples[index];
      const b = samples[index + 1];
      const minimumX = Math.floor(Math.min(a.x, b.x) / cellSizeM);
      const maximumX = Math.floor(Math.max(a.x, b.x) / cellSizeM);
      const minimumZ = Math.floor(Math.min(a.z, b.z) / cellSizeM);
      const maximumZ = Math.floor(Math.max(a.z, b.z) / cellSizeM);
      for (let gx = minimumX; gx <= maximumX; gx += 1) {
        for (let gz = minimumZ; gz <= maximumZ; gz += 1) {
          const key = gx + ':' + gz;
          if (!cells.has(key)) cells.set(key, []);
          cells.get(key).push(index);
        }
      }
    }
    return Object.freeze({ samples, cellSizeM, cells, closed:track.closed===true, lengthM: samples[samples.length - 1].s });
  }

  function closestOnSegment(a, b, position, segmentIndex) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    const px = position[0] - a.x;
    const py = position[1] - a.y;
    const pz = position[2] - a.z;
    const amount = lengthSquared > 1e-12
      ? clamp((px * dx + py * dy + pz * dz) / lengthSquared, 0, 1)
      : 0;
    const point = [a.x + dx * amount, a.y + dy * amount, a.z + dz * amount];
    const qx = position[0] - point[0];
    const qy = position[1] - point[1];
    const qz = position[2] - point[2];
    const horizontalLength = Math.hypot(dx, dz) || 1;
    return {
      segmentIndex,
      amount,
      point,
      distanceSquared: qx * qx + qy * qy + qz * qz,
      s: a.s + (b.s - a.s) * amount,
      lateral: qx * (-dz / horizontalLength) + qz * (dx / horizontalLength),
      headingRad: Math.atan2(dz, dx),
    };
  }

  function createProjectionTeleportToken() {
    const token = Object.freeze({ kind: 'asfalto-v6-route-teleport' });
    TELEPORT_TOKENS.add(token);
    return token;
  }

  function projectToRoute(index, worldPosition, previousS, teleportToken) {
    if (!index?.samples || !Array.isArray(worldPosition) || worldPosition.length < 3) {
      throw new TypeError('indice y posicion de ruta requeridos');
    }
    const position = [finite(worldPosition[0], 0), finite(worldPosition[1], 0), finite(worldPosition[2], 0)];
    const cellX = Math.floor(position[0] / index.cellSizeM);
    const cellZ = Math.floor(position[2] / index.cellSizeM);
    const candidates = new Set();
    for (let radius = 0; radius <= 5 && candidates.size === 0; radius += 1) {
      for (let gx = cellX - radius; gx <= cellX + radius; gx += 1) {
        for (let gz = cellZ - radius; gz <= cellZ + radius; gz += 1) {
          for (const segment of index.cells.get(gx + ':' + gz) || []) candidates.add(segment);
        }
      }
    }
    if (candidates.size === 0) {
      for (let segment = 0; segment < index.samples.length - 1; segment += 1) candidates.add(segment);
    }
    let best;
    for (const segment of candidates) {
      const candidate = closestOnSegment(
        index.samples[segment],
        index.samples[segment + 1],
        position,
        segment,
      );
      if (!best || candidate.distanceSquared < best.distanceSquared) best = candidate;
    }
    const prior = finite(previousS, best.s);
    const allowedTeleport = teleportToken && TELEPORT_TOKENS.has(teleportToken);
    if (allowedTeleport) TELEPORT_TOKENS.delete(teleportToken);
    const wrap=value=>((value%index.lengthM)+index.lengthM)%index.lengthM;
    const jump = index.closed ? wrap(best.s-wrap(prior)+index.lengthM*.5)-index.lengthM*.5 : best.s-prior;
    const jumpRejected = !allowedTeleport && Math.abs(jump) > 150;
    return Object.freeze({
      s: jumpRejected ? (index.closed?wrap(prior+Math.sign(jump)*150):prior+Math.sign(jump)*150) : best.s,
      raceProgress:index.closed?prior+(jumpRejected?Math.sign(jump)*150:jump):best.s,
      lateral: best.lateral,
      headingRad: best.headingRad,
      point: Object.freeze(best.point),
      distanceM: Math.sqrt(best.distanceSquared),
      segmentIndex: best.segmentIndex,
      jumpRejected,
    });
  }

  function toRapierVector(vector) {
    return { x: vector[0], y: vector[1], z: vector[2] };
  }

  function fromRapierVector(vector) {
    return [finite(vector?.x, 0), finite(vector?.y, 0), finite(vector?.z, 0)];
  }

  const SUSPENSION = Object.freeze({
    front: Object.freeze({
      springRateNpm: 34_500,
      damperBumpNsPm: 2_500,
      damperReboundNsPm: 3_600,
      staticCompressionM: 0.115,
      antiRollRateNpm: 16_000,
      rigidCouplingRateNpm: 0,
      rigidAxle: false,
    }),
    rear: Object.freeze({
      springRateNpm: 28_500,
      damperBumpNsPm: 2_200,
      damperReboundNsPm: 3_200,
      staticCompressionM: 0.118,
      antiRollRateNpm: 10_000,
      rigidCouplingRateNpm: 12_000,
      rigidAxle: true,
    }),
    bumpStopStartM: 0.16,
    maxTravelM: 0.18,
  });

  function validateReferenceTransform(transform) {
    if (!transform || !['point', 'vector', 'rotation'].every(key => typeof transform[key] === 'function')) {
      throw new TypeError('reference transform requires point, vector and rotation functions');
    }
    const basis=[[1,0,0],[0,1,0],[0,0,1]], axes=basis.map(axis=>transform.vector(axis)), origin=transform.point([0,0,0]), q=transform.rotation([0,0,0,1]);
    const finiteArray=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
    if (!finiteArray(origin,3) || axes.some(axis=>!finiteArray(axis,3)) || !finiteArray(q,4)) throw new TypeError('reference transform must contain finite vectors and rotation');
    const c=1-2*q[1]*q[1],s=2*q[1]*q[3],expected=[[c,0,-s],[0,1,0],[s,0,c]];
    if (axes.some(axis=>Math.abs(Math.hypot(...axis)-1)>1e-7) || Math.hypot(axes[1][0],axes[1][1]-1,axes[1][2])>1e-7
        || Math.abs(dot(axes[0],axes[2]))>1e-7 || Math.abs(axes[0][1])+Math.abs(axes[2][1])>1e-7
        || Math.abs(axes[0][0]*axes[2][2]-axes[0][2]*axes[2][0]-1)>1e-7 || Math.abs(Math.hypot(...q)-1)>1e-7 || Math.hypot(q[0],q[2])>1e-7
        || axes.some((axis,i)=>Math.hypot(...axis.map((v,j)=>v-expected[i][j]))>1e-7)
        || basis.some((axis,i)=>{const p=transform.point(axis);return !finiteArray(p,3)||Math.hypot(...p.map((v,j)=>v-origin[j]-axes[i][j]))>1e-6;})) throw new TypeError('reference transform must be a consistent rigid yaw and preserve gravity');
    return transform;
  }

  function transformPhysicsSnapshot(snapshot, transform) {
    validateReferenceTransform(transform);
    if (!snapshot) return snapshot;
    const pose = value => {
      if (!value) return value;
      const result = { ...value };
      for (const key of ['position', 'point', 'origin']) if (Array.isArray(value[key])) result[key] = transform.point(value[key]);
      for (const key of ['linearVelocity', 'angularVelocity', 'acceleration', 'normal', 'relativeVelocityMps']) if (Array.isArray(value[key])) result[key] = transform.vector(value[key]);
      for (const key of ['rotation', 'quaternion']) if (Array.isArray(value[key])) result[key] = transform.rotation(value[key]);
      return result;
    };
    const result = pose(snapshot);
    if (snapshot.chassis) result.chassis = pose(snapshot.chassis);
    for (const key of ['wheels', 'wheelContacts', 'wheelStates', 'impacts']) if (Array.isArray(snapshot[key])) result[key] = snapshot[key].map(pose);
    if (snapshot.debugForces) result.debugForces = Object.fromEntries(Object.entries(snapshot.debugForces)
      .map(([key,value]) => [key,Array.isArray(value)&&value.length===3?transform.vector(value):value]));
    return result;
  }

  function transformRouteProjection(projection, transform) {
    validateReferenceTransform(transform);
    if (!projection) return projection;
    const result = { ...projection };
    for (const key of ['position','point','routePosition']) if (Array.isArray(projection[key])) result[key] = transform.point(projection[key]);
    for (const key of ['frame','routeFrame']) if (projection[key]) result[key] = Object.fromEntries(Object.entries(projection[key])
      .map(([name,value]) => [name,['tangent','left','normal'].includes(name)&&Array.isArray(value)?transform.vector(value):value]));
    if (Number.isFinite(projection.headingRad)) {
      const direction = transform.vector([Math.cos(projection.headingRad),0,Math.sin(projection.headingRad)]);
      result.headingRad = Math.atan2(direction[2],direction[0]);
    }
    return result;
  }

  function transformRapierBody(body, transform) {
    const sleeping = body.isSleeping(), position = transform.point(fromRapierVector(body.translation()));
    const q = body.rotation(), rotation = transform.rotation([q.x,q.y,q.z,q.w]);
    const velocity = transform.vector(fromRapierVector(body.linvel())), angular = transform.vector(fromRapierVector(body.angvel()));
    const force = transform.vector(fromRapierVector(body.userForce())), torque = transform.vector(fromRapierVector(body.userTorque()));
    const nextPosition = body.isKinematic?.() ? transform.point(fromRapierVector(body.nextTranslation())) : null;
    const nextQ = body.isKinematic?.() ? body.nextRotation() : null;
    body.setTranslation(toRapierVector(position),false);body.setRotation({x:rotation[0],y:rotation[1],z:rotation[2],w:rotation[3]},false);
    body.setLinvel(toRapierVector(velocity),false);body.setAngvel(toRapierVector(angular),false);
    body.resetForces(false);body.resetTorques(false);body.addForce(toRapierVector(force),false);body.addTorque(toRapierVector(torque),false);
    if (nextPosition) { const nextRotation=transform.rotation([nextQ.x,nextQ.y,nextQ.z,nextQ.w]);body.setNextKinematicTranslation(toRapierVector(nextPosition));body.setNextKinematicRotation({x:nextRotation[0],y:nextRotation[1],z:nextRotation[2],w:nextRotation[3]}); }
    if (sleeping) body.sleep();
  }

  function transformRapierWorldReferenceFrame(world, transform, {excludeBodies=[],refreshStaticQueries=false}={}) {
    validateReferenceTransform(transform);
    const bodies=[],colliders=[],excluded=new Set(excludeBodies.map(body=>body.handle));
    world.forEachRigidBody(body=>bodies.push(body));world.forEachCollider(collider=>{if(!collider.parent())colliders.push(collider);});
    if (refreshStaticQueries && bodies.some(body=>!body.isFixed())) throw new TypeError('query refresh requires a static-only world');
    for (const body of bodies) if (!excluded.has(body.handle)) transformRapierBody(body,transform);
    for (const collider of colliders) {
      const p=transform.point(fromRapierVector(collider.translation())),q=collider.rotation(),rotation=transform.rotation([q.x,q.y,q.z,q.w]);
      collider.setTranslation(toRapierVector(p));collider.setRotation({x:rotation[0],y:rotation[1],z:rotation[2],w:rotation[3]});
    }
    world.propagateModifiedBodyPositionsToColliders();
    // Rapier 0.20 refreshes its query BVH in step(). Only the separate static
    // suspension world may do this here; dynamic worlds wait for their next fixed step.
    if (refreshStaticQueries) world.step();
    return {bodies:bodies.filter(body=>!excluded.has(body.handle)).length,standaloneColliders:colliders.length,staticQueriesRefreshed:refreshStaticQueries};
  }

  class VehiclePhysicsSession {
    constructor(options) {
      if (!options?.RAPIER || !options?.world || !options?.core || !options?.spec) {
        throw new TypeError('VehiclePhysicsSession requiere RAPIER, world, core y spec');
      }
      options.core.validateVehicleSpec(options.spec);
      this.RAPIER = options.RAPIER;
      this.world = options.world;
      this.suspensionWorld = options.suspensionWorld || options.world;
      this.core = options.core;
      this.baseSpec = options.spec;
      this.spec = options.spec;
      this.chassisConfig = null;
      this.absModulation = [1, 1, 1, 1];
      this.setChassisConfig(options.chassisConfig || null);
      this.environment = typeof options.environment === 'function'
        ? options.environment
        : () => ({ surface: 'asphalt', mu: 0.92, waterDepthM: 0, airDensityKgPm3: 1.2 });
      this.world.timestep = FIXED_DT;
      const physical = createVehicleBody(this.RAPIER, this.world, this.spec, options.spawn || {});
      this.body = physical.body;
      this.colliders = physical.colliders;
      this.impactEvents = this.RAPIER.EventQueue ? new this.RAPIER.EventQueue(true) : null;
      if(this.impactEvents) for(const collider of this.colliders) {
        collider.setActiveEvents(this.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
        collider.setContactForceEventThreshold(this.spec.massKg * .3 / FIXED_DT);
      }
      this.previousLinearVelocity = fromRapierVector(this.body.linvel());
      const state = this.core.createVehicleState(this.spec);
      this.wheels = state.wheels.map((wheel) => ({ ...wheel }));
      this.previousCompression = [NaN, NaN, NaN, NaN];
      this.powertrainState = {
        engineRpm: this.spec.engine.idleRpm,
        gear: 1,
        requestedGear: 1,
        clutchEngagement: 1,
        clutchSlipRadps: 0,
        temperatureC: 20,
      };
      this.brakeState = {
        hydraulicPressure: 0,
        frontTemperatureC: 20,
        rearTemperatureC: 20,
      };
      this.damage = this.core.createDamageState();
      this.impacts = [];
      this.staticImpactTimes = new Map();
      this.timeSeconds = 0;
      this.disposed = false;
      this.lastSnapshot = null;
    }

    setChassisConfig(value) {
      if (value && !root.AsfaltoV6Chassis) throw new Error('chassis configuration module unavailable');
      const radius = this.spec.wheelRadiusM;
      this.chassisConfig = value ? root.AsfaltoV6Chassis.sanitizeChassisConfig(value) : null;
      this.spec = root.AsfaltoV6Chassis?.chassisVehicleSpec(this.baseSpec, this.chassisConfig) || this.baseSpec;
      this.core.validateVehicleSpec(this.spec);
      if (this.wheels && radius !== this.spec.wheelRadiusM) {
        for (const wheel of this.wheels) wheel.angularSpeedRadps *= radius / this.spec.wheelRadiusM;
        this.previousCompression?.fill(NaN);
      }
      this.absModulation = [1, 1, 1, 1];
      return this.getChassisDiagnostics();
    }

    getChassisDiagnostics() {
      return { configured: Boolean(this.chassisConfig),
        configuration: this.chassisConfig ? { ...this.chassisConfig } : null,
        effective: { wheelRadiusM: this.spec.wheelRadiusM,
          wheelInertiaKgM2: root.AsfaltoV6Chassis?.chassisWheelInertia(this.chassisConfig) || 1.8,
          tireWidthRole: 'visual; compound and pressure determine contact forces',
          tires: { ...this.spec.tires }, brakes: { ...this.spec.brakes },
          steering: { ...this.spec.steering }, assists: { ...this.spec.assists } } };
    }

    _wheelContact(index, rotation, translation, steering) {
      const wheel = this.wheels[index];
      const mountLocal = [
        wheel.localAnchorM[0],
        this.spec.wheelRadiusM - this.spec.cgHeightM,
        wheel.localAnchorM[2],
      ];
      const origin = add(translation, rotateByQuaternion(mountLocal, rotation));
      const down = normalized(rotateByQuaternion([0, -1, 0], rotation), [0, -1, 0]);
      const ray = new this.RAPIER.Ray(toRapierVector(origin), toRapierVector(down));
      const hit = this.suspensionWorld.castRayAndGetNormal(
        ray,
        this.spec.wheelRadiusM + 0.55,
        true,
        undefined,
        undefined,
        undefined,
        this.body,
      );
      if (!hit) return {
        contact: false,
        origin,
        point: add(origin, scale(down, this.spec.wheelRadiusM + 0.18)),
        normal: scale(down, -1),
        compressionM: 0,
        compressionVelocityMps: Number.isFinite(this.previousCompression[index])
          ? (0 - this.previousCompression[index]) / FIXED_DT
          : 0,
        steering,
      };
      const normal = normalized(fromRapierVector(hit.normal), [0, 1, 0]);
      const point = add(origin, scale(down, hit.timeOfImpact));
      const axleSetup = wheel.axle === 'front' ? SUSPENSION.front : SUSPENSION.rear;
      const compressionM = clamp(
        axleSetup.staticCompressionM - (hit.timeOfImpact - this.spec.wheelRadiusM),
        0,
        SUSPENSION.maxTravelM,
      );
      return {
        contact: dot(normal, scale(down, -1)) > 0.2,
        origin,
        point,
        normal,
        compressionM,
        compressionVelocityMps: Number.isFinite(this.previousCompression[index])
          ? (compressionM - this.previousCompression[index]) / FIXED_DT
          : 0,
        steering,
      };
    }

    _collectContacts(controls) {
      const maximumRoadWheelAngleRad = finite(
        this.spec.steering?.maximumRoadWheelAngleRad,
        0.48,
      );
      const rotation = this.body.rotation();
      const translationObject = this.body.translation();
      const translation = fromRapierVector(translationObject);
      const ackermann = this.core.computeAckermann({
        centerSteerRad: clamp(
          finite(controls.steer, 0),
          -maximumRoadWheelAngleRad,
          maximumRoadWheelAngleRad,
        ),
        wheelbaseM: this.spec.wheelbaseM,
        frontTrackM: this.spec.frontTrackM,
      });
      const steering = [ackermann.frontLeftRad, ackermann.frontRightRad, 0, 0];
      const contacts = this.wheels.map((wheel, index) => this._wheelContact(
        index,
        rotation,
        translation,
        steering[index],
      ));
      for (let axleStart = 0; axleStart <= 2; axleStart += 2) {
        const setup = axleStart === 0 ? SUSPENSION.front : SUSPENSION.rear;
        const coupling = this.core.computeAxleCoupling({
          leftCompressionM: contacts[axleStart].compressionM,
          rightCompressionM: contacts[axleStart + 1].compressionM,
          antiRollRateNpm: setup.antiRollRateNpm,
          rigidCouplingRateNpm: setup.rigidCouplingRateNpm,
          rigidAxle: setup.rigidAxle,
        });
        contacts[axleStart].couplingAdjustmentN = coupling.leftAdjustmentN;
        contacts[axleStart + 1].couplingAdjustmentN = coupling.rightAdjustmentN;
      }
      return { contacts, rotation, translation };
    }

    _prepareWheelLoads(contacts) {
      return contacts.map((contact, index) => {
        const setup = index < 2 ? SUSPENSION.front : SUSPENSION.rear;
        const suspension = this.core.computeSuspensionForce({
          contact: contact.contact,
          springRateNpm: setup.springRateNpm,
          damperBumpNsPm: setup.damperBumpNsPm,
          damperReboundNsPm: setup.damperReboundNsPm,
          compressionM: contact.compressionM,
          compressionVelocityMps: contact.compressionVelocityMps,
          bumpStopStartM: SUSPENSION.bumpStopStartM,
          maxTravelM: SUSPENSION.maxTravelM,
        });
        const wheelId = this.wheels[index].id;
        const suspensionCondition = clamp(
          finite(this.damage?.suspension?.[wheelId]?.condition, 1), 0.1, 1,
        );
        const normalLoadN = contact.contact
          ? Math.max(0, (suspension.normalForceN + finite(contact.couplingAdjustmentN, 0)) * suspensionCondition)
          : 0;
        this.previousCompression[index] = contact.compressionM;
        return { ...contact, suspension, normalLoadN };
      });
    }

    _setRequestedGear(controls) {
      const requested = controls.requestedGear;
      // Game inputs may name an unavailable gate. Reject the whole shift here;
      // the vehicle core remains strict for callers constructing invalid state.
      if (!Number.isInteger(requested) || requested < -1 || requested > this.spec.gearbox.forward.length) {
        controls.requestedGear = this.powertrainState.gear;
        controls.clutchEngagement = this.powertrainState.clutchEngagement;
        return;
      }
      if (requested !== this.powertrainState.gear) {
        this.powertrainState = {
          ...this.core.requestGear(this.powertrainState, this.spec, requested).state,
          engineRpm: this.powertrainState.engineRpm,
          clutchSlipRadps: this.powertrainState.clutchSlipRadps,
          temperatureC: finite(this.powertrainState.engineTemperatureC, this.powertrainState.temperatureC),
        };
      }
      this.powertrainState.clutchEngagement = clamp(finite(controls.clutchEngagement, 1), 0, 1);
    }

    stepFixed(input) {
      if (this.disposed) throw new Error('VehiclePhysicsSession disposed');
      this.body.resetForces(true);
      this.body.resetTorques(true);
      const steeringCondition = clamp(finite(this.damage?.steering?.condition, 1), 0.2, 1);
      const steeringOffsetRad = finite(this.damage?.steering?.offsetRad, 0);
      const maximumRoadWheelAngleRad = finite(
        this.spec.steering?.maximumRoadWheelAngleRad,
        0.48,
      );
      const controls = {
        throttle: clamp(finite(input?.throttle, 0), 0, 1),
        brake: clamp(finite(input?.brake, 0), 0, 1),
        handbrake: clamp(finite(input?.handbrake, 0), 0, 1),
        steer: clamp(
          finite(input?.steer, 0) * steeringCondition + steeringOffsetRad,
          -maximumRoadWheelAngleRad,
          maximumRoadWheelAngleRad,
        ),
        handwheelAngleRad: finite(input?.handwheelAngleRad, 0),
        clutchEngagement: clamp(finite(input?.clutchEngagement, 1), 0, 1),
        requestedGear: input?.requestedGear ?? this.powertrainState.gear,
        engineCoolingCondition: clamp(finite(this.damage?.engine?.coolingCondition, 1), 0, 1),
        engineFire: this.damage?.engine?.fire === true,
      };
      this._setRequestedGear(controls);
      this.body.resetForces?.(true);
      this.body.resetTorques?.(true);

      const contactState = this._collectContacts(controls);
      const loadedContacts = this._prepareWheelLoads(contactState.contacts);
      const powertrainWheels = loadedContacts.map((contact, index) => ({
        id: this.wheels[index].id,
        axle: this.wheels[index].axle,
        angularSpeedRadps: finite(this.wheels[index].angularSpeedRadps, 0),
        normalLoadN: contact.normalLoadN,
        contact: contact.contact,
      }));
      const powertrain = this.core.stepPowertrain(
        this.powertrainState,
        controls,
        powertrainWheels,
        FIXED_DT,
        this.spec,
      );
      this.powertrainState = { ...powertrain.state };
      const brakeWheels = loadedContacts.map((contact, index) => {
        let mu = finite(this.spec.tires?.dryMu, 0.92);
        if (this.chassisConfig) {
          const speedMps = Math.hypot(...fromRapierVector(this.body.velocityAtPoint(toRapierVector(contact.point))));
          const environment = this.environment({ wheelId: this.wheels[index].id,
            worldPosition: contact.point.slice(), speedMps, normalLoadN: contact.normalLoadN }) || {};
          const waterFactor = this.core.waterGripFactor({ speedMps, waterDepthM: finite(environment.waterDepthM, 0), normalLoadN: contact.normalLoadN });
          mu = finite(environment.mu, .92) * waterFactor
            * root.AsfaltoV6Chassis.chassisGripScale(this.chassisConfig, environment, index < 2 ? 'front' : 'rear');
        }
        return { ...powertrainWheels[index], mu, wheelRadiusM: this.spec.wheelRadiusM };
      });
      const damagedBrakeWheels = brakeWheels.map((wheel, index) => {
        const tireDamage = this.damage?.tires?.[this.wheels[index].id] || {};
        const tireFactor = clamp(0.45 + 0.55 * finite(tireDamage.condition, 1), 0.35, 1)
          * clamp(0.5 + 0.5 * finite(tireDamage.pressureRatio, 1), 0.35, 1);
        return { ...wheel, mu: wheel.mu * tireFactor };
      });

      const brakeResult = this.core.stepBrakes(
        this.brakeState,
        controls,
        damagedBrakeWheels,
        FIXED_DT,
        this.spec,
      );
      const brakes = { ...brakeResult, wheelBrakeTorquesNm: Array.from(brakeResult.wheelBrakeTorquesNm),
        locked: Array.from(brakeResult.locked) };
      const bodySpeedMps = Math.hypot(...fromRapierVector(this.body.linvel()));
      for (let index = 0; index < 4; index += 1) {
        const wheel = this.wheels[index];
        const enabled = this.chassisConfig?.abs && bodySpeedMps > 2 && loadedContacts[index].contact;
        const slip = Math.max(-finite(wheel.slipRatio, 0),
          1 - Math.abs(wheel.angularSpeedRadps * this.spec.wheelRadiusM) / Math.max(2, bodySpeedMps));
        this.absModulation[index] = enabled
          ? clamp(this.absModulation[index] + (slip > .18 ? -16 : 4) * FIXED_DT, .04, 1) : 1;
        if (enabled) {
          const handbrakeNm = index >= 2 ? 1600 * controls.handbrake : 0;
          brakes.wheelBrakeTorquesNm[index] = Math.max(0, brakes.wheelBrakeTorquesNm[index] - handbrakeNm)
            * this.absModulation[index] + handbrakeNm;
          const contact = loadedContacts[index];
          const environment = this.environment({ wheelId: wheel.id, worldPosition: contact.point.slice(),
            speedMps: bodySpeedMps, normalLoadN: contact.normalLoadN }) || {};
          const gripScale = root.AsfaltoV6Chassis.chassisGripScale(this.chassisConfig, environment, index < 2 ? 'front' : 'rear');
          const capacityNm = contact.normalLoadN * finite(environment.mu, 1) * gripScale * this.spec.wheelRadiusM;
          brakes.locked[index] = brakes.wheelBrakeTorquesNm[index] > capacityNm && Math.abs(wheel.angularSpeedRadps) > .5;
        }
      }
      const previousBrakeState = this.brakeState;
      this.brakeState = { ...brakes.state };
      if (this.chassisConfig) {
        const cooling = root.AsfaltoV6Chassis.chassisCoolingScale(this.chassisConfig);
        for (const [axle, indices, rate] of [['front', [0, 1], .01], ['rear', [2, 3], .008]]) {
          const key = axle + 'TemperatureC', oldTemperature = finite(previousBrakeState[key], 20);
          const originalPower = indices.reduce((sum, i) => sum + brakeResult.wheelBrakeTorquesNm[i] * Math.abs(this.wheels[i].angularSpeedRadps), 0);
          const actualPower = indices.reduce((sum, i) => sum + brakes.wheelBrakeTorquesNm[i] * Math.abs(this.wheels[i].angularSpeedRadps), 0);
          const workScale = originalPower > 0 ? actualPower / originalPower : 1;
          const originalCooling = Math.max(0, oldTemperature - 20) * rate * FIXED_DT;
          const generatedHeat = this.brakeState[key] - oldTemperature + originalCooling;
          this.brakeState[key] = clamp(oldTemperature + generatedHeat * workScale - originalCooling * cooling, 20, 1000);
        }
      }

      const bodyRotation = contactState.rotation;
      const bodyForward = normalized(rotateByQuaternion([1, 0, 0], bodyRotation), [1, 0, 0]);
      const bodySide = normalized(rotateByQuaternion([0, 0, 1], bodyRotation), [0, 0, 1]);
      const wheelSnapshots = [];
      let accumulatedSuspensionForce = [0, 0, 0];
      let accumulatedTireForce = [0, 0, 0];
      for (let index = 0; index < loadedContacts.length; index += 1) {
        const contact = loadedContacts[index];
        const wheel = this.wheels[index];
        if (!contact.contact || contact.normalLoadN <= 0) {
          this.wheels[index] = {
            ...wheel,
            contact: false,
            normalLoadN: 0,
            compressionM: contact.compressionM,
            compressionVelocityMps: contact.compressionVelocityMps,
            steerAngleRad: contact.steering,
          };
          wheelSnapshots.push({
            ...this.wheels[index],
            aligningTorqueNm: 0,
            combinedUtilization: 0,
            point: contact.point,
            normal: contact.normal,
            tire: { fxN: 0, fyN: 0, utilization: 0, warning: false, saturated: false, capacityN: 0 },
          });
          continue;
        }
        const steerCos = Math.cos(contact.steering);
        const steerSin = Math.sin(contact.steering);
        const wheelForward = normalized(add(scale(bodyForward, steerCos), scale(bodySide, steerSin)), bodyForward);
        const wheelSide = normalized(add(scale(bodySide, steerCos), scale(bodyForward, -steerSin)), bodySide);
        const pointVelocity = fromRapierVector(this.body.velocityAtPoint(toRapierVector(contact.point)));
        const longitudinalSpeedMps = dot(pointVelocity, wheelForward);
        const lateralSpeedMps = dot(pointVelocity, wheelSide);
        const driveCondition = clamp(finite(this.damage?.drivetrain?.condition, 1), 0.15, 1)
          * clamp(finite(this.damage?.engine?.powerFactor, 1), 0.2, 1);
        const brakeCondition = clamp(finite(this.damage?.brakes?.condition, 1), 0.15, 1)
          * (1 - clamp(finite(this.damage?.brakes?.fade, 0), 0, 0.8));
        const wheelInertiaKgM2 = root.AsfaltoV6Chassis?.chassisWheelInertia(this.chassisConfig) || 1.8;
        const driveAndTireTorqueNm = powertrain.wheelDriveTorquesNm[index] * driveCondition
          - finite(wheel.tire?.fxN, 0) * this.spec.wheelRadiusM;
        const unbrakedAngularSpeedRadps = finite(wheel.angularSpeedRadps, 0)
          + driveAndTireTorqueNm / wheelInertiaKgM2 * FIXED_DT;
        const brakeAngularDeltaRadps = brakes.wheelBrakeTorquesNm[index]
          * brakeCondition / wheelInertiaKgM2 * FIXED_DT;
        const angularSpeedRadps = Math.sign(unbrakedAngularSpeedRadps)
          * Math.max(0, Math.abs(unbrakedAngularSpeedRadps) - brakeAngularDeltaRadps);
        const targetSlipRatio = (angularSpeedRadps * this.spec.wheelRadiusM - longitudinalSpeedMps)
          / Math.max(0.5, Math.abs(longitudinalSpeedMps));
        const targetSlipAngleRad = Math.atan2(lateralSpeedMps, Math.abs(longitudinalSpeedMps) + 0.5);
        const environment = this.environment({
          wheelId: wheel.id,
          worldPosition: contact.point.slice(),
          speedMps: Math.abs(longitudinalSpeedMps),
          normalLoadN: contact.normalLoadN,
        }) || {};
        const waterFactor = this.core.waterGripFactor({
          speedMps: Math.abs(longitudinalSpeedMps),
          waterDepthM: finite(environment.waterDepthM, 0),
          normalLoadN: contact.normalLoadN,
        });
        const tireDamage = this.damage?.tires?.[wheel.id] || {};
        const tireFactor = clamp(0.45 + 0.55 * finite(tireDamage.condition, 1), 0.35, 1)
          * clamp(0.5 + 0.5 * finite(tireDamage.pressureRatio, 1), 0.35, 1);
        const tireGripScale = root.AsfaltoV6Chassis?.chassisGripScale(this.chassisConfig, environment, index < 2 ? 'front' : 'rear') || 1;
        const effectiveMu = clamp(finite(environment.mu, 0.92) * waterFactor * tireFactor * tireGripScale, 0.12, 1.4);
        const stepped = this.core.stepWheelState(wheel, {
          targetSlipAngleRad,
          targetSlipRatio,
          longitudinalSpeedMps,
          normalLoadN: contact.normalLoadN,
          wheelRadiusM: this.spec.wheelRadiusM,
          mu: effectiveMu,
          surface: environment.surface || 'asphalt',
          relaxationLengthM: index < 2
            ? finite(this.spec.tires?.frontRelaxationLengthM, 0.5)
            : finite(this.spec.tires?.rearRelaxationLengthM, 0.42),
          corneringStiffnessNprad: index < 2
            ? finite(this.spec.tires?.frontCorneringStiffnessNprad, 50_000)
            : finite(this.spec.tires?.rearCorneringStiffnessNprad, 58_000),
          longitudinalStiffnessN: index < 2
            ? finite(this.spec.tires?.frontLongitudinalStiffnessN, 52_000)
            : finite(this.spec.tires?.rearLongitudinalStiffnessN, 50_000),
        }, FIXED_DT);
        const rotationRad = (finite(wheel.rotationRad, 0) + angularSpeedRadps * FIXED_DT) % (Math.PI * 2);
        const tireForce = add(scale(wheelForward, stepped.tire.fxN), scale(wheelSide, stepped.tire.fyN));
        const suspensionForce = scale(contact.normal, contact.normalLoadN);
        accumulatedSuspensionForce = add(accumulatedSuspensionForce, suspensionForce);
        accumulatedTireForce = add(accumulatedTireForce, tireForce);
        this.body.addForceAtPoint(toRapierVector(suspensionForce), toRapierVector(contact.point), true);
        this.body.addForceAtPoint(toRapierVector(tireForce), toRapierVector(contact.point), true);
        this.wheels[index] = {
          ...stepped,
          tireGripScale, effectiveMu,
          aligningTorqueNm: finite(stepped.tire?.aligningTorqueNm, 0),
          combinedUtilization: clamp(finite(stepped.tire?.utilization, 0), 0, 1),
          angularSpeedRadps,
          rotationRad,
          contact: true,
          normalLoadN: contact.normalLoadN,
          compressionM: contact.compressionM,
          compressionVelocityMps: contact.compressionVelocityMps,
          steerAngleRad: contact.steering,
          surface: environment.surface || 'asphalt',
          waterDepthM: finite(environment.waterDepthM, 0),
        };
        wheelSnapshots.push({
          ...this.wheels[index],
          point: contact.point,
          normal: contact.normal,
        });
      }

      const velocity = fromRapierVector(this.body.linvel());
      const planarVelocity = [velocity[0], 0, velocity[2]];
      const planarSpeed = length(planarVelocity);
      let resistance = [0, 0, 0];
      if (planarSpeed > 0.05) {
        const environment = this.environment({ worldPosition: contactState.translation.slice(), speedMps: planarSpeed }) || {};
        const density = clamp(finite(environment.airDensityKgPm3, 1.2), 0.8, 1.4);
        const dragN = 0.5 * density * this.spec.aero.dragCoefficient
          * this.spec.aero.frontalAreaM2 * planarSpeed * planarSpeed;
        const rollingN = this.spec.massKg * 9.81 * 0.015
          * clamp(finite(environment.rollingResistanceMultiplier, 1), 0.5, 2);
        resistance = scale(normalized(planarVelocity, [1, 0, 0]), -(dragN + rollingN));
        this.body.addForce(toRapierVector(resistance), true);
      }

      const preImpactAngularVelocity = fromRapierVector(this.body.angvel());
      this.world.step(this.impactEvents || undefined);
      this.timeSeconds += FIXED_DT;
      const hadStaticImpact = this._captureStaticImpacts(velocity, preImpactAngularVelocity);
      const translation = this.body.translation();
      this.damage = this.core.applyMechanicalWear(this.damage, {
        engineRpm: this.powertrainState.engineRpm,
        engineTemperatureC: finite(this.powertrainState.engineTemperatureC, this.powertrainState.temperatureC),
        frontBrakeTemperatureC: this.brakeState.frontTemperatureC,
        rearBrakeTemperatureC: this.brakeState.rearTemperatureC,
        clutchSlipPowerW: Math.abs(this.powertrainState.clutchSlipRadps * powertrain.engineTorqueNm),
        shiftShock: 0,
        bottomOut: loadedContacts.reduce((severity, contact) => {
          if (contact.compressionM < SUSPENSION.maxTravelM - 0.002) return severity;
          const impactSpeedMps = Math.max(0, finite(contact.compressionVelocityMps, 0) - 1);
          return Math.max(severity, clamp(impactSpeedMps / 2, 0, 2));
        }, 0),
      }, FIXED_DT);

      const rotation = this.body.rotation();
      const linearVelocity = this.body.linvel();
      const angularVelocity = this.body.angvel();
      const currentLinearVelocity = fromRapierVector(linearVelocity);
      const acceleration = currentLinearVelocity.map(
        (value, index) => (value - finite(this.previousLinearVelocity?.[index], value)) / FIXED_DT,
      );
      this.previousLinearVelocity = currentLinearVelocity.slice();
      const frontWheels = wheelSnapshots.slice(0, 2);
      const snapshot = {
        fixedHz: 120,
        timeSeconds: this.timeSeconds,
        chassis: {
          position: [translation.x, translation.y, translation.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          linearVelocity: currentLinearVelocity,
          angularVelocity: [angularVelocity.x, angularVelocity.y, angularVelocity.z],
          acceleration,
        },
        wheels: wheelSnapshots,
        steering: {
          frontAligningTorqueNm: frontWheels.reduce(
            (sum, wheel) => sum + finite(wheel.aligningTorqueNm, 0),
            0,
          ),
          frontContactRatio: frontWheels.length
            ? frontWheels.filter(wheel => wheel.contact).length / frontWheels.length
            : 0,
        },
        engine: {
          rpm: this.powertrainState.engineRpm,
          temperatureC: finite(this.powertrainState.engineTemperatureC, this.powertrainState.temperatureC),
          load: controls.throttle,
          torqueNm: powertrain.engineTorqueNm
            * clamp(finite(this.damage?.engine?.powerFactor, 1), 0.2, 1),
        },
        gearbox: {
          gear: this.powertrainState.gear,
          requestedGear: controls.requestedGear,
        },
        clutch: {
          engagement: this.powertrainState.clutchEngagement,
          slipRadps: this.powertrainState.clutchSlipRadps,
        },
        brakes: {
          frontTemperatureC: this.brakeState.frontTemperatureC,
          rearTemperatureC: this.brakeState.rearTemperatureC,
          locked: Array.from(brakes.locked),
          wheelBrakeTorquesNm: Array.from(brakes.wheelBrakeTorquesNm),
          absModulation: this.absModulation.slice(),
          frontFade: brakes.frontFade,
          rearFade: brakes.rearFade,
        },
        controls,
        chassisConfig: this.chassisConfig ? { ...this.chassisConfig } : null,
        impact: hadStaticImpact,
        impacts: this.impacts.slice(),
        damage: this.damage,
        debugForces: {
          suspensionN: accumulatedSuspensionForce,
          tireN: accumulatedTireForce,
          resistanceN: resistance,
        },
      };
      this.lastSnapshot = this.core.finiteSnapshot(snapshot);
      return this.lastSnapshot;
    }

    step(deltaSeconds, controls) {
      if (Math.abs(finite(deltaSeconds, 0) - FIXED_DT) > 1e-12) {
        throw new Error('VehiclePhysicsSession requiere fixed dt 1/120');
      }
      return this.stepFixed(controls);
    }

    _captureStaticImpacts(linearVelocity, angularVelocity) {
      if (!this.impactEvents || !this.world.contactPair) return false;
      const contacts = new Map(), center = fromRapierVector(this.body.translation());
      const ownHandles = new Set(this.colliders.map(collider => collider.handle));
      // Rapier 0.20 clears solver contacts after stepping; force events retain
      // the solved impulses (force * fixed dt), including CCD contacts.
      this.impactEvents.drainContactForceEvents(event => {
        const a = event.collider1(), b = event.collider2();
        const ownHandle = ownHandles.has(a) ? a : ownHandles.has(b) ? b : null;
        if (ownHandle === null) return;
        const own = this.world.getCollider(ownHandle), other = this.world.getCollider(ownHandle===a?b:a);
        if (!other || (other.parent() && !other.parent().isFixed())) return;
        const impulseNs = Math.max(0, finite(event.totalForceMagnitude(), 0)) * FIXED_DT;
        const normal = fromRapierVector(event.maxForceDirection());
        let point = null;
        this.world.contactPair(own, other, (manifold, flipped) => {
          if (point || !manifold.numContacts()) return;
          // Local contact positions are relative to the collider, not its body.
          const local = fromRapierVector(flipped ? manifold.localContactPoint2(0) : manifold.localContactPoint1(0));
          point = add(fromRapierVector(own.translation()), rotateByQuaternion(local, own.rotation()));
        });
        if (!point) return; // No contact geometry: do not invent a damage location.
        const r = point.map((v, i) => v - center[i]), w = angularVelocity;
        const pointVelocity = [linearVelocity[0]+w[1]*r[2]-w[2]*r[1],
          linearVelocity[1]+w[2]*r[0]-w[0]*r[2],linearVelocity[2]+w[0]*r[1]-w[1]*r[0]];
        const previous = contacts.get(other.handle);
        contacts.set(other.handle, { impulseNs: impulseNs+(previous?.impulseNs||0), point,
          speed: Math.max(Math.abs(dot(pointVelocity, normal)), previous?.speed||0),
          material: other.asfaltoContactMaterial || 'unknown' });
      });
      let impacted = false;
      for (const [handle, contact] of contacts) {
        // Gravity/resting solver impulses do not damage the car. A cooldown
        // coalesces successive solver frames of the same collision.
        if (contact.impulseNs < this.spec.massKg * .65 || contact.speed < 2
            || this.timeSeconds - (this.staticImpactTimes.get(handle) ?? -Infinity) < .3) continue;
        const q = this.body.rotation();
        const localPointM = rotateByQuaternion(contact.point.map((v, i) => v-center[i]), {x:-q.x,y:-q.y,z:-q.z,w:q.w});
        this.staticImpactTimes.set(handle, this.timeSeconds);
        this.applyImpact({ impulseNs:contact.impulseNs, localPointM, otherId:'world', material:contact.material,
          relativeVelocityMps:linearVelocity });
        impacted = true;
      }
      for (const [handle, time] of this.staticImpactTimes) if(this.timeSeconds-time>1) this.staticImpactTimes.delete(handle);
      return impacted;
    }

    applyImpact(event) {
      if (this.disposed) throw new Error('VehiclePhysicsSession disposed');
      const impulseNs = Math.max(0, finite(event?.impulseNs, 0));
      const localPointM = Array.isArray(event?.localPointM)
        ? event.localPointM.slice(0, 3).map(value => finite(value, 0))
        : [0, 0, 0];
      while (localPointM.length < 3) localPointM.push(0);
      const record = Object.freeze({
        timeSeconds: this.timeSeconds,
        impulseNs,
        magnitude: clamp(impulseNs / 20_000, 0, 1),
        localPointM: Object.freeze(localPointM),
        otherId: String(event?.otherId || 'world'),
        material: String(event?.material || 'unknown'),
        relativeVelocityMps: Object.freeze([0,1,2].map(i=>finite(event?.relativeVelocityMps?.[i],0))),
      });
      this.damage = this.core.applyImpactDamage(this.damage, { impulseNs, localPointM });
      this.impacts = [...this.impacts.slice(-7), record];
      if (this.lastSnapshot) {
        this.lastSnapshot = this.core.finiteSnapshot({
          ...this.lastSnapshot,
          impact: impulseNs > 0,
          impacts: this.impacts.slice(),
          damage: this.damage,
        });
      }
      return this.lastSnapshot;
    }

    reset(options) {
      if (this.disposed) throw new Error('VehiclePhysicsSession disposed');
      const frame = options?.frame || options?.spawn || {};
      this.teleport(frame, { x: 0, y: 0, z: 0 });
      const state = this.core.createVehicleState(this.spec);
      this.wheels = state.wheels.map(wheel => ({ ...wheel }));
      this.previousCompression.fill(NaN);
      this.powertrainState = {
        engineRpm: this.spec.engine.idleRpm,
        gear: 1,
        requestedGear: 1,
        clutchEngagement: 1,
        clutchSlipRadps: 0,
        temperatureC: 20,
      };
      this.brakeState = {
        hydraulicPressure: 0,
        frontTemperatureC: 20,
        rearTemperatureC: 20,
      };
      this.absModulation = [1, 1, 1, 1];
      if (options?.resetDamage !== false) this.damage = this.core.createDamageState();
      if (options?.resetClock !== false) this.timeSeconds = 0;
      this.impacts = [];
      const translation = this.body.translation();
      const rotation = this.body.rotation();
      const linearVelocity = this.body.linvel();
      const angularVelocity = this.body.angvel();
      this.previousLinearVelocity = fromRapierVector(linearVelocity);
      this.lastSnapshot = this.core.finiteSnapshot({
        fixedHz: 120,
        timeSeconds: this.timeSeconds,
        chassis: {
          position: [translation.x, translation.y, translation.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          linearVelocity: [linearVelocity.x, linearVelocity.y, linearVelocity.z],
          angularVelocity: [angularVelocity.x, angularVelocity.y, angularVelocity.z],
          acceleration: [0, 0, 0],
        },
        wheels: this.wheels.map(wheel => ({
          ...wheel,
          aligningTorqueNm: finite(wheel.aligningTorqueNm, 0),
          combinedUtilization: clamp(finite(wheel.combinedUtilization, 0), 0, 1),
        })),
        steering: { frontAligningTorqueNm: 0, frontContactRatio: 0 },
        engine: {
          rpm: this.powertrainState.engineRpm,
          temperatureC: finite(this.powertrainState.engineTemperatureC, this.powertrainState.temperatureC),
          load: 0,
          torqueNm: 0,
        },
        gearbox: { gear: 1, requestedGear: 1 },
        clutch: { engagement: 1, slipRadps: 0 },
        brakes: {
          frontTemperatureC: 20,
          rearTemperatureC: 20,
          locked: [false, false, false, false],
          frontFade: 0,
          rearFade: 0,
        },
        controls: { throttle: 0, brake: 0, handbrake: 0, steer: 0, handwheelAngleRad: 0, clutchEngagement: 1, requestedGear: 1 },
        impact: false,
        impacts: [],
        damage: this.damage,
      });
      return this.lastSnapshot;
    }

    transformReferenceFrame(transform) {
      if (this.disposed) throw new Error('VehiclePhysicsSession disposed');
      validateReferenceTransform(transform);
      const snapshot = transformPhysicsSnapshot(this.lastSnapshot,transform);
      const previousVelocity = transform.vector(this.previousLinearVelocity);
      transformRapierBody(this.body,transform);
      this.previousLinearVelocity = previousVelocity;
      if (snapshot?.impacts) this.impacts = snapshot.impacts.map(event=>Object.freeze(event));
      this.lastSnapshot = snapshot ? this.core.finiteSnapshot(snapshot) : null;
      this.world.propagateModifiedBodyPositionsToColliders();
      return this.lastSnapshot;
    }

    teleport(spawn, linearVelocity = { x: 0, y: 0, z: 0 }) {
      if (this.disposed) throw new Error('VehiclePhysicsSession disposed');
      this.staticImpactTimes.clear();
      this.impactEvents?.clear();
      const yaw = finite(spawn?.yawRad, 0);
      const suppliedRotation = Array.isArray(spawn?.rotation) && spawn.rotation.length >= 4
        ? spawn.rotation.slice(0, 4).map((value, index) => finite(value, index === 3 ? 1 : 0))
        : [0, Math.sin(yaw * 0.5), 0, Math.cos(yaw * 0.5)];
      const rotationLength = Math.hypot(...suppliedRotation) || 1;
      const desiredRotation = suppliedRotation.map(value => value / rotationLength);
      this.body.setTranslation({
        x: finite(spawn?.x, 0),
        y: finite(spawn?.y, 0.7),
        z: finite(spawn?.z, 0),
      }, true);
      this.body.setRotation({
        x: desiredRotation[0],
        y: desiredRotation[1],
        z: desiredRotation[2],
        w: desiredRotation[3],
      }, true);
      this.body.setLinvel({
        x: finite(linearVelocity?.x, 0),
        y: finite(linearVelocity?.y, 0),
        z: finite(linearVelocity?.z, 0),
      }, true);
      this.previousLinearVelocity = [
        finite(linearVelocity?.x, 0),
        finite(linearVelocity?.y, 0),
        finite(linearVelocity?.z, 0),
      ];
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.previousCompression.fill(NaN);
      const translation = this.body.translation();
      const rotation = this.body.rotation();
      const velocity = this.body.linvel();
      const angularVelocity = this.body.angvel();
      const prior = this.lastSnapshot || {
        fixedHz: 120,
        timeSeconds: this.timeSeconds,
        wheels: this.wheels.map(wheel => ({ ...wheel })),
        engine: { rpm: this.powertrainState.engineRpm },
        gearbox: {
          gear: this.powertrainState.gear,
          requestedGear: this.powertrainState.requestedGear,
        },
        damage: this.damage,
        impacts: this.impacts.slice(),
      };
      this.lastSnapshot = this.core.finiteSnapshot({
        ...prior,
        timeSeconds: this.timeSeconds,
        chassis: {
          ...(prior.chassis || {}),
          position: [translation.x, translation.y, translation.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          linearVelocity: [velocity.x, velocity.y, velocity.z],
          angularVelocity: [angularVelocity.x, angularVelocity.y, angularVelocity.z],
          acceleration: [0, 0, 0],
        },
      });
      return this.lastSnapshot;
    }

    getSnapshot() {
      return this.lastSnapshot;
    }

    dispose() {
      if (this.disposed) return false;
      this.impactEvents?.free();
      this.impactEvents = null;
      this.disposed = true;
      for (const collider of this.colliders) {
        try { this.world.removeCollider(collider, true); } catch { /* world may already own cleanup */ }
      }
      try { this.world.removeRigidBody(this.body); } catch { /* world may already own cleanup */ }
      return true;
    }
  }

  root.AsfaltoV6Physics = Object.freeze({
    FIXED_DT,
    collectCollisionTriangles,
    sceneCollisionRole,
    createSceneCollisionLayer,
    buildRouteRibbonTriangles,
    createRapierTrackCollider,
    createVehicleBody,
    createRouteSpatialIndex,
    projectToRoute,
    createProjectionTeleportToken,
    validateReferenceTransform,
    transformPhysicsSnapshot,
    transformRouteProjection,
    transformRapierWorldReferenceFrame,
    VehiclePhysicsSession,
  });
}(globalThis));
