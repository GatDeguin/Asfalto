
(function installAsfaltoV6Physics(root) {
  'use strict';

  const FIXED_DT = 1 / 120;
  // Session starts share a monotonic identifier even when a track replaces its physics session.
  let nextIgnitionSequence = 0;
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
    const lowerMass = spec.massKg * .72, upperMass = spec.massKg * .28;
    const upperHalf = { x: spec.dimensionsM.length * .21, y: spec.dimensionsM.height * .16, z: spec.dimensionsM.width * .34 };
    const upperCenter = { x: -.22, y: spec.dimensionsM.height * .25, z: 0 };
    // Chassis origin is the declared centre of gravity: axle offsets and
    // cgHeightM are expressed relative to it. Recenter the two-box mass model
    // without moving collision skins or changing its inertia about its COM.
    // These inertias remain a geometric approximation, not factory measurements.
    const massOrigin = { x: -.03 * .72 + upperCenter.x * .28,
      y: -.02 * .72 + upperCenter.y * .28, z: 0 };
    const lower = RAPIER.ColliderDesc.cuboid(
      measuredHull ? (measuredHull.maxX - measuredHull.minX) / 2 : legacyHalf.x,
      legacyHalf.y,
      measuredHull ? (measuredHull.maxZ - measuredHull.minZ) / 2 : legacyHalf.z,
    )
      .setTranslation(lowerCenter.x, lowerCenter.y, lowerCenter.z)
      // Shape and inertial model are independent; preserve the box inertia.
      .setMassProperties(lowerMass,
        { x: -.03 - lowerCenter.x - massOrigin.x, y: -massOrigin.y, z: -lowerCenter.z },
        { x: lowerMass / 3 * (legacyHalf.y ** 2 + legacyHalf.z ** 2),
          y: lowerMass / 3 * (legacyHalf.x ** 2 + legacyHalf.z ** 2),
          z: lowerMass / 3 * (legacyHalf.x ** 2 + legacyHalf.y ** 2) },
        { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(0.04)
      .setRestitution(0.04);
    const upper = RAPIER.ColliderDesc.cuboid(upperHalf.x, upperHalf.y, upperHalf.z)
      .setTranslation(upperCenter.x, upperCenter.y, upperCenter.z)
      .setMassProperties(upperMass,
        { x: -massOrigin.x, y: -massOrigin.y, z: 0 },
        { x: upperMass / 3 * (upperHalf.y ** 2 + upperHalf.z ** 2),
          y: upperMass / 3 * (upperHalf.x ** 2 + upperHalf.z ** 2),
          z: upperMass / 3 * (upperHalf.x ** 2 + upperHalf.y ** 2) },
        { x: 0, y: 0, z: 0, w: 1 })
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

  // Per-session storage: numeric vectors/torques never escape as historical records.
  function vectorInto(out, x, y, z) { out[0]=x; out[1]=y; out[2]=z; return out; }
  function rapierInto(out, vector) { out.x=vector[0];out.y=vector[1];out.z=vector[2];return out; }
  function fromRapierInto(out, vector) { return vectorInto(out,finite(vector?.x,0),finite(vector?.y,0),finite(vector?.z,0)); }
  function rotateInto(out, vector, q) {
    const x=vector[0],y=vector[1],z=vector[2],qx=finite(q.x,0),qy=finite(q.y,0),qz=finite(q.z,0),qw=finite(q.w,1);
    const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;
    return vectorInto(out,ix*qw-iw*qx-iy*qz+iz*qy,iy*qw-iw*qy-iz*qx+ix*qz,iz*qw-iw*qz-ix*qy+iy*qx);
  }
  function normalizeInto(out, fallback) {const m=length(out);for(let i=0;i<3;i++)out[i]=m>1e-9?out[i]/m:fallback[i];return out;}
  function fieldsInto(out, source) {for(const key in source)out[key]=source[key];return out;}
  const EMPTY_PHYSICS_INPUT=Object.freeze({}), AXIS_FORWARD=Object.freeze([1,0,0]), AXIS_SIDE=Object.freeze([0,0,1]), AXIS_DOWN=Object.freeze([0,-1,0]), AXIS_UP=Object.freeze([0,1,0]);
  const DEFAULT_ENVIRONMENT=Object.freeze({surface:'asphalt',mu:.92,waterDepthM:0,airDensityKgPm3:1.2});
  // Allocated once per vehicle. Four-wheel scalar lanes share one backing store.
  // Vector views are also fixed; only legacy public snapshots expose ordinary arrays.
  function createContactStorage() {
    const count = 4;
    const buffer = new Float64Array(count * 15);
    const lanes = {
      buffer,
      contact: new Uint8Array(count),
      normalLoadN: buffer.subarray(0, 4),
      compressionM: buffer.subarray(4, 8),
      compressionVelocityMps: buffer.subarray(8, 12),
      steering: buffer.subarray(12, 16),
      couplingAdjustmentN: buffer.subarray(16, 20),
      previousCompression: buffer.subarray(20, 24),
    };
    lanes.previousCompression.fill(NaN);
    const contacts = new Array(count);
    for (let i = 0; i < count; i++) {
      const offset = 24 + i * 9;
      contacts[i] = {
        origin: buffer.subarray(offset, offset + 3),
        point: buffer.subarray(offset + 3, offset + 6),
        normal: buffer.subarray(offset + 6, offset + 9),
        suspension: { springForceN: 0, damperForceN: 0, bumpStopForceN: 0, normalForceN: 0, compressionM: 0, travelLimited: false },
      };
      contacts[i].normal[1] = 1;
    }
    lanes.contacts = contacts;
    return lanes;
  }

  function createPhysicsScratch(session) {
    const vec=()=>new Float64Array(3), obj=()=>({x:0,y:0,z:0});
    const contactData=createContactStorage(),contacts=contactData.contacts;
    const wheels=session.wheels.map(w=>({id:w.id,axle:w.axle,angularSpeedRadps:0,normalLoadN:0,contact:false,mu:0,wheelRadiusM:session.spec.wheelRadiusM}));
    const out={...session.core.createDynamicsScratch(),contacts,contactData,powertrainWheels:wheels,environmentOutput:{},controls:{},ackermann:{},ackermannInput:{},coupling:{},couplingInput:{},suspensionInput:{},wheelInput:{},waterInput:{},wear:{},
      translation:[0,0,0],mount:vec(),down:vec(),bodyForward:vec(),bodySide:vec(),wheelForward:vec(),wheelSide:vec(),pointVelocity:vec(),velocity:vec(),angularVelocity:vec(),suspensionForce:vec(),tireForce:vec(),resistance:vec(),sumSuspension:vec(),sumTire:vec(),
      force:obj(),point:obj(),rayOrigin:obj(),rayDirection:obj(),query:{wheelId:null,worldPosition:[0,0,0],speedMps:0,normalLoadN:0},brakeTorques:new Float64Array(4),locked:[false,false,false,false]};
    out.rapierTranslation=obj();out.rapierVelocity=obj();out.rapierAngular=obj();out.rapierNormal=obj();out.rapierLocal=obj();out.rapierOrigin=obj();
    out.rapierRotation={x:0,y:0,z:0,w:1};out.rapierOtherRotation={x:0,y:0,z:0,w:1};
    out.ray=new session.RAPIER.Ray(out.rayOrigin,out.rayDirection);
    out.contactState={contacts,rotation:null,translation:out.translation};
    out.snapshots=Array.from({length:2},()=>({fixedHz:120,timeSeconds:0,chassis:{position:[0,0,0],rotation:[0,0,0,1],linearVelocity:[0,0,0],angularVelocity:[0,0,0],acceleration:[0,0,0]},
      wheels:session.wheels.map(w=>({...w,point:[0,0,0],normal:[0,1,0],tire:{}})),steering:{frontAligningTorqueNm:0,frontContactRatio:0},
      engine:{ignition:{state:'ready',sequence:0,startedAtS:0}},gearbox:{},clutch:{},brakes:{locked:[false,false,false,false],wheelBrakeTorquesNm:[0,0,0,0],absModulation:[1,1,1,1]},controls:{},chassisConfig:null,impact:false,impacts:[],damage:session.core.createMutableDamageState(),debugForces:{suspensionN:[0,0,0],tireN:[0,0,0],resistanceN:[0,0,0]}}));
    const impactRecord=()=>({timeSeconds:0,impulseNs:0,magnitude:0,otherId:'world',material:'unknown',localPointM:[0,0,0],relativeVelocityMps:[0,0,0]});
    out.impactHistory=Array.from({length:8},impactRecord);out.impactHistoryIndex=0;
    out.impactSnapshotSlots=Array.from({length:2},()=>Array.from({length:8},impactRecord));
    out.impactInput=impactRecord();out.impactRotation={x:0,y:0,z:0,w:1};
    for(const key of ['impactLocal','impactPoint','impactOrigin','impactNormal','impactCenter','impactVelocity'])out[key]=vec();
    out.snapshotIndex=0;
    return out;
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
        : () => DEFAULT_ENVIRONMENT;
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
      this.wheels = state.wheels.map((wheel) => ({ ...wheel, tire: {} }));
      this.previousCompression = null;
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
      this.damage = this.core.createMutableDamageState();
      this.impacts = [];
      this.staticImpactTimes = new Map();
      this.timeSeconds = 0;
      this.ignitionSequence = 0;
      this.ignitionStartedAtS = 0;
      this.ignitionState = 'ready';
      this.disposed = false;
      this.lastSnapshot = null;
      this.mutableSnapshots = options.mutableSnapshots === true;
      this.scratch = createPhysicsScratch(this);
      this.previousCompression = this.scratch.contactData.previousCompression;
      this.reserveImpactContacts();
    }

    _engineStatus() {
      const engine = this.damage?.engine || {};
      const condition = clamp(finite(engine.condition, 1), 0, 1);
      const powerFactor = clamp(finite(engine.powerFactor, 1), 0, 1);
      const fire = engine.fire === true;
      return {
        ignition: { state: this.ignitionState, sequence: this.ignitionSequence, startedAtS: this.ignitionStartedAtS },
        condition, powerFactor, fire,
        fault: fire ? 'fire' : condition < 1 || powerFactor < 1 ? 'damaged' : 'none',
      };
    }

    setChassisConfig(value) {
      if (value && !root.AsfaltoV6Chassis) throw new Error('chassis configuration module unavailable');
      const radius = this.spec.wheelRadiusM;
      this.chassisConfig = value ? root.AsfaltoV6Chassis.sanitizeChassisConfig(value) : null;
      this.spec = root.AsfaltoV6Chassis?.chassisVehicleSpec(this.baseSpec, this.chassisConfig) || this.baseSpec;
      this.core.validateVehicleSpec(this.spec);
      const chassis=root.AsfaltoV6Chassis,config=this.chassisConfig;
      this.chassisDynamics={inertia:chassis?.chassisWheelInertia(config)||1.8,cooling:chassis?.chassisCoolingScale(config)||1};
      if(config)for(const axle of ['front','rear']){
        this.chassisDynamics[axle+'Dry']=chassis.chassisGripScale(config,{wetness:0,surface:'asphalt'},axle);
        this.chassisDynamics[axle+'Wet']=chassis.chassisGripScale(config,{wetness:1,surface:'asphalt'},axle);
        this.chassisDynamics[axle+'Loose']=chassis.chassisGripScale(config,{wetness:0,surface:'gravel'},axle);
      }
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
      const s=this.scratch,d=s.contactData,wheel=this.wheels[index],out=s.contacts[index];
      vectorInto(s.mount,wheel.localAnchorM[0],this.spec.wheelRadiusM-this.spec.cgHeightM,wheel.localAnchorM[2]);
      rotateInto(out.origin,s.mount,rotation);
      for(let i=0;i<3;i++)out.origin[i]+=translation[i];
      normalizeInto(rotateInto(s.down,AXIS_DOWN,rotation),AXIS_DOWN);
      // Rapier Ray is plain reusable JS storage; cast results remain Rapier-owned allocations; supported getter outputs are reused.
      rapierInto(s.ray.origin,out.origin);rapierInto(s.ray.dir,s.down);
      const hit=this.suspensionWorld.castRayAndGetNormal(s.ray,this.spec.wheelRadiusM+.55,true,undefined,undefined,undefined,this.body);
      const distance=hit?hit.timeOfImpact:this.spec.wheelRadiusM+.18;
      for(let i=0;i<3;i++)out.point[i]=out.origin[i]+s.down[i]*distance;
      if(hit)normalizeInto(fromRapierInto(out.normal,hit.normal),AXIS_UP);
      else for(let i=0;i<3;i++)out.normal[i]=-s.down[i];
      const setup=index<2?SUSPENSION.front:SUSPENSION.rear;
      d.compressionM[index]=hit?clamp(setup.staticCompressionM-(distance-this.spec.wheelRadiusM),0,SUSPENSION.maxTravelM):0;
      d.contact[index]=hit&&-dot(out.normal,s.down)>.2?1:0;
      d.compressionVelocityMps[index]=Number.isFinite(this.previousCompression[index])?(d.compressionM[index]-this.previousCompression[index])/FIXED_DT:0;
      d.steering[index]=steering;
      return out;
    }

    _collectContacts(controls) {
      const s=this.scratch,d=s.contactData,rotation=this.body.rotation(s.rapierRotation);
      fromRapierInto(s.translation,this.body.translation(s.rapierTranslation));
      const max=finite(this.spec.steering?.maximumRoadWheelAngleRad,.48),a=s.ackermannInput;
      a.centerSteerRad=clamp(finite(controls.steer,0),-max,max);a.wheelbaseM=this.spec.wheelbaseM;a.frontTrackM=this.spec.frontTrackM;
      this.core.computeAckermannInto(s.ackermann,a);
      for(let i=0;i<4;i++)this._wheelContact(i,rotation,s.translation,i===0?s.ackermann.frontLeftRad:i===1?s.ackermann.frontRightRad:0);
      for(let i=0;i<4;i+=2){const setup=i===0?SUSPENSION.front:SUSPENSION.rear,c=s.couplingInput;
        c.leftCompressionM=d.compressionM[i];c.rightCompressionM=d.compressionM[i+1];
        c.antiRollRateNpm=setup.antiRollRateNpm;c.rigidCouplingRateNpm=setup.rigidCouplingRateNpm;c.rigidAxle=setup.rigidAxle;
        this.core.computeAxleCouplingInto(s.coupling,c);
        d.couplingAdjustmentN[i]=s.coupling.leftAdjustmentN;d.couplingAdjustmentN[i+1]=s.coupling.rightAdjustmentN;
      }
      s.contactState.rotation=rotation;return s.contactState;
    }

    _prepareWheelLoads(contacts) {
      const input=this.scratch.suspensionInput,d=this.scratch.contactData;
      for(let i=0;i<4;i++) {const c=contacts[i],setup=i<2?SUSPENSION.front:SUSPENSION.rear;
        input.contact=(d.contact[i]!==0);input.springRateNpm=setup.springRateNpm;input.damperBumpNsPm=setup.damperBumpNsPm;input.damperReboundNsPm=setup.damperReboundNsPm;
        input.compressionM=d.compressionM[i];input.compressionVelocityMps=d.compressionVelocityMps[i];input.bumpStopStartM=SUSPENSION.bumpStopStartM;input.maxTravelM=SUSPENSION.maxTravelM;
        this.core.computeSuspensionForceInto(c.suspension,input);
        const condition=clamp(finite(this.damage?.suspension?.[this.wheels[i].id]?.condition,1),.1,1);
        d.normalLoadN[i]=(d.contact[i]!==0)?Math.max(0,(c.suspension.normalForceN+finite(d.couplingAdjustmentN[i],0))*condition):0;
        this.previousCompression[i]=d.compressionM[i];
      }
      return contacts;
    }

    _setRequestedGear(controls) {
      const requested=controls.requestedGear,state=this.powertrainState;
      if(!Number.isInteger(requested)||requested < -1||requested>this.spec.gearbox.forward.length){controls.requestedGear=state.gear;controls.clutchEngagement=state.clutchEngagement;return;}
      if(requested!==state.gear){state.gear=requested;state.requestedGear=requested;state.temperatureC=finite(state.engineTemperatureC,state.temperatureC);}
      state.clutchEngagement=clamp(finite(controls.clutchEngagement,1),0,1);
    }

    _sampleEnvironment(wheelId,point,speedMps,normalLoadN) {
      const q=this.scratch.query;q.wheelId=wheelId;for(let k=0;k<3;k++)q.worldPosition[k]=point[k];q.speedMps=speedMps;q.normalLoadN=normalLoadN;
      // Synchronous borrowed query: providers retaining it must copy explicitly.
      return this.environment(q,this.scratch.environmentOutput)||DEFAULT_ENVIRONMENT;
    }

    // Borrowed double-buffer view: valid through the following fixed tick.
    // Retainers/recorders call getSnapshotCopy() outside the simulation kernel.
    stepFixedMutable(input) {
      if(this.disposed)throw new Error('VehiclePhysicsSession disposed');
      const s=this.scratch,d=s.contactData,controls=s.controls,spec=this.spec;
      this.body.resetForces(true);this.body.resetTorques(true);
      const max=finite(spec.steering?.maximumRoadWheelAngleRad,.48);
      controls.throttle=clamp(finite(input?.throttle,0),0,1);controls.brake=clamp(finite(input?.brake,0),0,1);controls.handbrake=clamp(finite(input?.handbrake,0),0,1);
      controls.steer=clamp(finite(input?.steer,0)*clamp(finite(this.damage?.steering?.condition,1),.2,1)+finite(this.damage?.steering?.offsetRad,0),-max,max);
      controls.handwheelAngleRad=finite(input?.handwheelAngleRad,0);controls.clutchEngagement=clamp(finite(input?.clutchEngagement,1),0,1);controls.requestedGear=input?.requestedGear??this.powertrainState.gear;
      controls.engineCoolingCondition=clamp(finite(this.damage?.engine?.coolingCondition,1),0,1);controls.engineFire=this.damage?.engine?.fire===true;
      this._setRequestedGear(controls);
      const contactState=this._collectContacts(controls),contacts=this._prepareWheelLoads(contactState.contacts);
      for(let i=0;i<4;i++){const pw=s.powertrainWheels[i],w=this.wheels[i],c=contacts[i];pw.angularSpeedRadps=finite(w.angularSpeedRadps,0);pw.normalLoadN=d.normalLoadN[i];pw.contact=(d.contact[i]!==0);pw.wheelRadiusM=spec.wheelRadiusM;}
      const powertrain=this.core.stepPowertrainInto(s.powertrain,this.powertrainState,controls,s.powertrainWheels,FIXED_DT,spec);
      fieldsInto(this.powertrainState,powertrain.state);
      for(let i=0;i<4;i++){
        const c=contacts[i],w=this.wheels[i];let mu=finite(spec.tires?.dryMu,.92);
        if(this.chassisConfig){const speed=length(fromRapierInto(s.pointVelocity,this.body.velocityAtPoint(rapierInto(s.point,c.point),s.rapierVelocity)));
          const e=this._sampleEnvironment(w.id,c.point,speed,d.normalLoadN[i]),wi=s.waterInput;wi.speedMps=speed;wi.waterDepthM=finite(e.waterDepthM,0);wi.normalLoadN=d.normalLoadN[i];
          mu=finite(e.mu,.92)*this.core.waterGripFactor(wi)*this._gripScale(e,i<2?'front':'rear');}
        const damageTire=this.damage?.tires?.[w.id];s.powertrainWheels[i].mu=mu*clamp(.45+.55*finite(damageTire?.condition,1),.35,1)*clamp(.5+.5*finite(damageTire?.pressureRatio,1),.35,1);
      }
      const oldFront=this.brakeState.frontTemperatureC,oldRear=this.brakeState.rearTemperatureC;
      const brakes=this.core.stepBrakesInto(s.brakes,this.brakeState,controls,s.powertrainWheels,FIXED_DT,spec);
      s.brakeTorques.set(brakes.wheelBrakeTorquesNm);
      const bodySpeed=length(fromRapierInto(s.pointVelocity,this.body.linvel(s.rapierVelocity)));
      for(let i=0;i<4;i++) {const w=this.wheels[i],c=contacts[i],enabled=this.chassisConfig?.abs&&bodySpeed>2&&(d.contact[i]!==0);
        const slip=Math.max(-finite(w.slipRatio,0),1-Math.abs(w.angularSpeedRadps*spec.wheelRadiusM)/Math.max(2,bodySpeed));
        this.absModulation[i]=enabled?clamp(this.absModulation[i]+(slip>.18?-16:4)*FIXED_DT,.04,1):1;
        s.locked[i]=brakes.locked[i];
        if(enabled){const handbrake=i>=2?1600*controls.handbrake:0;s.brakeTorques[i]=Math.max(0,s.brakeTorques[i]-handbrake)*this.absModulation[i]+handbrake;
          const e=this._sampleEnvironment(w.id,c.point,bodySpeed,d.normalLoadN[i]),grip=this._gripScale(e,i<2?'front':'rear');
          s.locked[i]=s.brakeTorques[i]>d.normalLoadN[i]*finite(e.mu,1)*grip*spec.wheelRadiusM&&Math.abs(w.angularSpeedRadps)>.5;}
      }
      fieldsInto(this.brakeState,brakes.state);
      if(this.chassisConfig){const cooling=this.chassisDynamics.cooling;
        for(let axle=0;axle<2;axle++){const i=axle*2,key=axle===0?'frontTemperatureC':'rearTemperatureC',old=finite(axle===0?oldFront:oldRear,20),rate=axle===0?.01:.008;
          const original=brakes.wheelBrakeTorquesNm[i]*Math.abs(this.wheels[i].angularSpeedRadps)+brakes.wheelBrakeTorquesNm[i+1]*Math.abs(this.wheels[i+1].angularSpeedRadps);
          const actual=s.brakeTorques[i]*Math.abs(this.wheels[i].angularSpeedRadps)+s.brakeTorques[i+1]*Math.abs(this.wheels[i+1].angularSpeedRadps);
          const originalCooling=Math.max(0,old-20)*rate*FIXED_DT,heat=this.brakeState[key]-old+originalCooling;
          this.brakeState[key]=clamp(old+heat*(original>0?actual/original:1)-originalCooling*cooling,20,1000);}
      }
      normalizeInto(rotateInto(s.bodyForward,AXIS_FORWARD,contactState.rotation),AXIS_FORWARD);normalizeInto(rotateInto(s.bodySide,AXIS_SIDE,contactState.rotation),AXIS_SIDE);
      s.sumSuspension.fill(0);s.sumTire.fill(0);
      const snapshot=s.snapshots[s.snapshotIndex];s.snapshotIndex^=1;
      let frontAligning=0,frontContacts=0,bottomOut=0;
      for(let i=0;i<4;i++){
        const c=contacts[i],w=this.wheels[i],ws=snapshot.wheels[i],outTire=ws.tire;
        if(d.compressionM[i]>=SUSPENSION.maxTravelM-.002)bottomOut=Math.max(bottomOut,clamp(Math.max(0,finite(d.compressionVelocityMps[i],0)-1)/2,0,2));
        if((d.contact[i]!==0)&&d.normalLoadN[i]>0){
          const cos=Math.cos(d.steering[i]),sin=Math.sin(d.steering[i]);
          for(let k=0;k<3;k++){s.wheelForward[k]=s.bodyForward[k]*cos+s.bodySide[k]*sin;s.wheelSide[k]=s.bodySide[k]*cos-s.bodyForward[k]*sin;}
          normalizeInto(s.wheelForward,s.bodyForward);normalizeInto(s.wheelSide,s.bodySide);
          fromRapierInto(s.pointVelocity,this.body.velocityAtPoint(rapierInto(s.point,c.point),s.rapierVelocity));
          const longitudinal=dot(s.pointVelocity,s.wheelForward),lateral=dot(s.pointVelocity,s.wheelSide);
          const drive=clamp(finite(this.damage?.drivetrain?.condition,1),.15,1)*clamp(finite(this.damage?.engine?.powerFactor,1),.2,1);
          const brake=clamp(finite(this.damage?.brakes?.condition,1),.15,1)*(1-clamp(finite(this.damage?.brakes?.fade,0),0,.8));
          const inertia=this.chassisDynamics.inertia;
          const unbraked=finite(w.angularSpeedRadps,0)+(powertrain.wheelDriveTorquesNm[i]*drive-finite(w.tire?.fxN,0)*spec.wheelRadiusM)/inertia*FIXED_DT;
          const angular=Math.sign(unbraked)*Math.max(0,Math.abs(unbraked)-s.brakeTorques[i]*brake/inertia*FIXED_DT);
          const rotation=(finite(w.rotationRad,0)+angular*FIXED_DT)%(Math.PI*2);
          const e=this._sampleEnvironment(w.id,c.point,Math.abs(longitudinal),d.normalLoadN[i]),wi=s.waterInput;
          wi.speedMps=Math.abs(longitudinal);wi.waterDepthM=finite(e.waterDepthM,0);wi.normalLoadN=d.normalLoadN[i];
          const damageTire=this.damage?.tires?.[w.id],factor=clamp(.45+.55*finite(damageTire?.condition,1),.35,1)*clamp(.5+.5*finite(damageTire?.pressureRatio,1),.35,1);
          const grip=this._gripScale(e,i<2?'front':'rear');
          const mu=clamp(finite(e.mu,.92)*this.core.waterGripFactor(wi)*factor*grip,.12,1.4),input=s.wheelInput;
          input.targetSlipRatio=(angular*spec.wheelRadiusM-longitudinal)/Math.max(.5,Math.abs(longitudinal));input.targetSlipAngleRad=Math.atan2(lateral,Math.abs(longitudinal)+.5);
          input.longitudinalSpeedMps=longitudinal;input.normalLoadN=d.normalLoadN[i];input.wheelRadiusM=spec.wheelRadiusM;input.mu=mu;input.surface=e.surface||'asphalt';
          input.relaxationLengthM=i<2?finite(spec.tires?.frontRelaxationLengthM,.5):finite(spec.tires?.rearRelaxationLengthM,.42);
          input.corneringStiffnessNprad=i<2?finite(spec.tires?.frontCorneringStiffnessNprad,50000):finite(spec.tires?.rearCorneringStiffnessNprad,58000);
          input.longitudinalStiffnessN=i<2?finite(spec.tires?.frontLongitudinalStiffnessN,52000):finite(spec.tires?.rearLongitudinalStiffnessN,50000);
          this.core.stepWheelStateInto(w,w,input,FIXED_DT,s.tire);
          w.tireGripScale=grip;w.effectiveMu=mu;w.aligningTorqueNm=finite(w.tire.aligningTorqueNm,0);w.combinedUtilization=clamp(finite(w.tire.utilization,0),0,1);
          w.angularSpeedRadps=angular;w.rotationRad=rotation;w.surface=e.surface||'asphalt';w.waterDepthM=finite(e.waterDepthM,0);
          for(let k=0;k<3;k++){s.tireForce[k]=s.wheelForward[k]*w.tire.fxN+s.wheelSide[k]*w.tire.fyN;s.suspensionForce[k]=c.normal[k]*d.normalLoadN[i];s.sumSuspension[k]+=s.suspensionForce[k];s.sumTire[k]+=s.tireForce[k];}
          this.body.addForceAtPoint(rapierInto(s.force,s.suspensionForce),rapierInto(s.point,c.point),true);this.body.addForceAtPoint(rapierInto(s.force,s.tireForce),s.point,true);
        }
        w.contact=(d.contact[i]!==0)&&d.normalLoadN[i]>0;w.normalLoadN=w.contact?d.normalLoadN[i]:0;w.compressionM=d.compressionM[i];w.compressionVelocityMps=d.compressionVelocityMps[i];w.steerAngleRad=d.steering[i];
        for(const key in w)if(key!=='tire')ws[key]=w[key];ws.tire=outTire;
        if(w.contact)fieldsInto(outTire,w.tire);else{outTire.fxN=0;outTire.fyN=0;outTire.utilization=0;outTire.warning=false;outTire.saturated=false;outTire.capacityN=0;outTire.aligningTorqueNm=0;outTire.muEffective=0;outTire.saturationAngleRad=0;ws.aligningTorqueNm=0;ws.combinedUtilization=0;}
        for(let k=0;k<3;k++){ws.point[k]=c.point[k];ws.normal[k]=c.normal[k];}
        if(i<2){frontAligning+=finite(ws.aligningTorqueNm,0);if(ws.contact)frontContacts++;}
      }
      fromRapierInto(s.velocity,this.body.linvel(s.rapierVelocity));const planarSpeed=Math.hypot(s.velocity[0],s.velocity[2]);s.resistance.fill(0);
      if(planarSpeed>.05){const e=this._sampleEnvironment(undefined,contactState.translation,planarSpeed,undefined),density=clamp(finite(e.airDensityKgPm3,1.2),.8,1.4);
        const force=-(.5*density*spec.aero.dragCoefficient*spec.aero.frontalAreaM2*planarSpeed*planarSpeed+spec.massKg*9.81*.015*clamp(finite(e.rollingResistanceMultiplier,1),.5,2));
        s.resistance[0]=s.velocity[0]/planarSpeed*force;s.resistance[2]=s.velocity[2]/planarSpeed*force;this.body.addForce(rapierInto(s.force,s.resistance),true);}
      fromRapierInto(s.angularVelocity,this.body.angvel(s.rapierAngular));this.world.step(this.impactEvents||undefined);this.timeSeconds+=FIXED_DT;if(this.ignitionState==='starting')this.ignitionState='running';
      const hadImpact=this._captureStaticImpacts(s.velocity,s.angularVelocity);
      const wear=s.wear;wear.engineRpm=this.powertrainState.engineRpm;wear.engineTemperatureC=finite(this.powertrainState.engineTemperatureC,this.powertrainState.temperatureC);wear.frontBrakeTemperatureC=this.brakeState.frontTemperatureC;wear.rearBrakeTemperatureC=this.brakeState.rearTemperatureC;wear.clutchSlipPowerW=Math.abs(this.powertrainState.clutchSlipRadps*powertrain.engineTorqueNm);wear.shiftShock=0;wear.bottomOut=bottomOut;
      this.core.applyMechanicalWearInto(this.damage,this.damage,wear,FIXED_DT);
      const ch=snapshot.chassis,q=this.body.rotation(s.rapierRotation);fromRapierInto(ch.position,this.body.translation(s.rapierTranslation));ch.rotation[0]=q.x;ch.rotation[1]=q.y;ch.rotation[2]=q.z;ch.rotation[3]=q.w;
      fromRapierInto(ch.linearVelocity,this.body.linvel(s.rapierVelocity));fromRapierInto(ch.angularVelocity,this.body.angvel(s.rapierAngular));
      for(let k=0;k<3;k++){ch.acceleration[k]=(ch.linearVelocity[k]-finite(this.previousLinearVelocity[k],ch.linearVelocity[k]))/FIXED_DT;this.previousLinearVelocity[k]=ch.linearVelocity[k];snapshot.debugForces.suspensionN[k]=s.sumSuspension[k];snapshot.debugForces.tireN[k]=s.sumTire[k];snapshot.debugForces.resistanceN[k]=s.resistance[k];}
      snapshot.timeSeconds=this.timeSeconds;snapshot.steering.frontAligningTorqueNm=frontAligning;snapshot.steering.frontContactRatio=frontContacts/2;
      this._engineStatusInto(snapshot.engine);snapshot.engine.rpm=this.powertrainState.engineRpm;snapshot.engine.temperatureC=wear.engineTemperatureC;snapshot.engine.load=controls.throttle;snapshot.engine.torqueNm=powertrain.engineTorqueNm*clamp(finite(this.damage?.engine?.powerFactor,1),.2,1);
      snapshot.gearbox.gear=this.powertrainState.gear;snapshot.gearbox.requestedGear=controls.requestedGear;snapshot.clutch.engagement=this.powertrainState.clutchEngagement;snapshot.clutch.slipRadps=this.powertrainState.clutchSlipRadps;
      snapshot.brakes.frontTemperatureC=this.brakeState.frontTemperatureC;snapshot.brakes.rearTemperatureC=this.brakeState.rearTemperatureC;snapshot.brakes.frontFade=brakes.frontFade;snapshot.brakes.rearFade=brakes.rearFade;
      for(let i=0;i<4;i++){snapshot.brakes.locked[i]=s.locked[i];snapshot.brakes.wheelBrakeTorquesNm[i]=s.brakeTorques[i];snapshot.brakes.absModulation[i]=this.absModulation[i];}
      fieldsInto(snapshot.controls,controls);snapshot.chassisConfig=this.chassisConfig;snapshot.impact=hadImpact;this._copyImpactsInto(snapshot);
      this.core.copyDamageInto(snapshot.damage,this.damage);
      this.lastSnapshot=snapshot;return snapshot;
    }

    _engineStatusInto(out) {
      const e=this.damage?.engine;out.condition=clamp(finite(e?.condition,1),0,1);out.powerFactor=clamp(finite(e?.powerFactor,1),0,1);out.fire=e?.fire===true;
      out.fault=out.fire?'fire':out.condition<1||out.powerFactor<1?'damaged':'none';out.ignition.state=this.ignitionState;out.ignition.sequence=this.ignitionSequence;out.ignition.startedAtS=this.ignitionStartedAtS;return out;
    }

    stepFixed(input) {
      const snapshot=this.stepFixedMutable(input);
      if(!this.mutableSnapshots)this.lastSnapshot=this.core.finiteSnapshot(snapshot);
      return this.lastSnapshot;
    }

    getSnapshotCopy() { return this.lastSnapshot ? this.core.finiteSnapshot(this.lastSnapshot) : null; }

    step(deltaSeconds, controls) {
      if (Math.abs(finite(deltaSeconds, 0) - FIXED_DT) > 1e-12) {
        throw new Error('VehiclePhysicsSession requiere fixed dt 1/120');
      }
      return this.stepFixed(controls);
    }

    reserveImpactContacts() {
      // Collider lifecycle boundary. Register new scene colliders before stepping.
      if(!this._impactRegistry){this._impactRegistry=new Map();this._impactRecords=[];this._activeImpactIndices=[];
        this._impactOwnHandles=new Set(this.colliders.map(c=>c.handle));
        this._impactDrain=event=>this._onContactForce(event);
        this._impactManifold=(manifold,flipped)=>{
          if(this._impactHasPoint||!manifold.numContacts())return;
          const s=this.scratch,own=this._impactOwn;
          fromRapierInto(s.impactLocal,flipped?manifold.localContactPoint2(0,s.rapierLocal):manifold.localContactPoint1(0,s.rapierLocal));
          rotateInto(s.impactPoint,s.impactLocal,own.rotation(s.rapierOtherRotation));fromRapierInto(s.impactOrigin,own.translation(s.rapierOrigin));
          for(let k=0;k<3;k++)s.impactPoint[k]+=s.impactOrigin[k];this._impactHasPoint=true;
        };
        this._registerImpactCollider=collider=>{if(this._impactRegistry.has(collider.handle))return;
          const record={index:this._impactRecords.length,handle:collider.handle,point:[0,0,0],impulseNs:0,speed:0,material:'unknown',tick:-1,lastTime:-Infinity};
          this._impactRegistry.set(collider.handle,record);this._impactRecords.push(record);};
      }
      if(!this._inImpactDrain) {
        for(let i=this._impactRecords.length-1;i>=0;i--)if(!this.world.getCollider(this._impactRecords[i].handle)) {
          this._impactRegistry.delete(this._impactRecords[i].handle);this._impactRecords.splice(i,1);
        }
        for(let i=0;i<this._impactRecords.length;i++)this._impactRecords[i].index=i;
      }
      this.world.forEachCollider?.(this._registerImpactCollider);
      if(this._activeImpactIndices.length<this._impactRecords.length) {
        const previous=this._activeImpactIndices;this._activeImpactIndices=new Uint32Array(this._impactRecords.length);this._activeImpactIndices.set(previous);
      }
    }

    _onContactForce(event) {
      const a=event.collider1(),b=event.collider2(),ownHandle=this._impactOwnHandles.has(a)?a:this._impactOwnHandles.has(b)?b:null;
      if(ownHandle===null)return;
      const own=this.world.getCollider(ownHandle),other=this.world.getCollider(ownHandle===a?b:a);
      if(!other||(other.parent()&&!other.parent().isFixed()))return;
      let record=this._impactRegistry.get(other.handle);
      // Compatibility for external callers adding colliders without the lifecycle hook.
      // Browser integration reserves at scene refresh; this fallback is exceptional/cold.
      if(!record){this.reserveImpactContacts();record=this._impactRegistry.get(other.handle);if(!record)return;}
      const s=this.scratch,impulse=Math.max(0,finite(event.totalForceMagnitude(),0))*FIXED_DT;
      fromRapierInto(s.impactNormal,event.maxForceDirection(s.rapierNormal));
      this._impactOwn=own;this._impactHasPoint=false;this.world.contactPair(own,other,this._impactManifold);
      if(!this._impactHasPoint)return;
      const p=s.impactPoint,c=s.impactCenter,w=s.angularVelocity,v=s.velocity,rx=p[0]-c[0],ry=p[1]-c[1],rz=p[2]-c[2];
      vectorInto(s.impactVelocity,v[0]+w[1]*rz-w[2]*ry,v[1]+w[2]*rx-w[0]*rz,v[2]+w[0]*ry-w[1]*rx);
      const speed=Math.abs(dot(s.impactVelocity,s.impactNormal));
      if(record.tick!==this.timeSeconds){record.tick=this.timeSeconds;record.impulseNs=0;record.speed=0;this._activeImpactIndices[this._activeImpactCount++]=record.index;}
      record.impulseNs+=impulse;record.speed=Math.max(speed,record.speed);record.material=other.asfaltoContactMaterial||'unknown';
      for(let k=0;k<3;k++)record.point[k]=p[k];
    }

    _captureStaticImpacts(linearVelocity, angularVelocity) {
      if(!this.impactEvents||!this.world.contactPair)return false;
      const s=this.scratch;fromRapierInto(s.impactCenter,this.body.translation(s.rapierTranslation));
      // Inputs ordinarily already alias s.velocity/angularVelocity.
      for(let k=0;k<3;k++){s.velocity[k]=linearVelocity[k];s.angularVelocity[k]=angularVelocity[k];}
      this._activeImpactCount=0;this._inImpactDrain=true;
      try {this.impactEvents.drainContactForceEvents(this._impactDrain);} finally {this._inImpactDrain=false;}
      let impacted=false;
      for(let i=0;i<this._activeImpactCount;i++) {const c=this._impactRecords[this._activeImpactIndices[i]];
        if(c.impulseNs<this.spec.massKg*.65||c.speed<2||this.timeSeconds-c.lastTime<.3)continue;
        const q=this.body.rotation(s.rapierRotation);s.impactRotation.x=-q.x;s.impactRotation.y=-q.y;s.impactRotation.z=-q.z;s.impactRotation.w=q.w;
        for(let k=0;k<3;k++)s.impactLocal[k]=c.point[k]-s.impactCenter[k];
        rotateInto(s.impactInput.localPointM,s.impactLocal,s.impactRotation);s.impactInput.impulseNs=c.impulseNs;s.impactInput.otherId='world';s.impactInput.material=c.material;s.impactInput.relativeVelocityMps=s.velocity;
        c.lastTime=this.timeSeconds;this._applyImpactMutable(s.impactInput);impacted=true;
      }
      return impacted;
    }

    _applyImpactMutable(event) {
      const s=this.scratch,impulse=Math.max(0,finite(event?.impulseNs,0)),record=s.impactHistory[s.impactHistoryIndex];s.impactHistoryIndex=(s.impactHistoryIndex+1)%8;
      record.timeSeconds=this.timeSeconds;record.impulseNs=impulse;record.magnitude=clamp(impulse/20000,0,1);record.otherId=String(event?.otherId||'world');record.material=String(event?.material||'unknown');
      for(let k=0;k<3;k++){record.localPointM[k]=finite(event?.localPointM?.[k],0);record.relativeVelocityMps[k]=finite(event?.relativeVelocityMps?.[k],0);}
      this.core.applyImpactDamageInto(this.damage,this.damage,record);
      if(this.impacts.length===8){for(let i=0;i<7;i++)this.impacts[i]=this.impacts[i+1];this.impacts[7]=record;}else this.impacts.push(record);
    }

    applyImpact(event) {
      if(this.disposed)throw new Error('VehiclePhysicsSession disposed');
      this._applyImpactMutable(event);
      // An external discrete collision can occur between fixed ticks.
      if(this.lastSnapshot){
        if(!this.mutableSnapshots||Object.isFrozen(this.lastSnapshot)) {
          this.lastSnapshot=this.core.finiteSnapshot({...this.lastSnapshot,engine:{...this.lastSnapshot.engine,...this._engineStatus()},impact:finite(event?.impulseNs,0)>0,impacts:this.impacts,damage:this.damage});
        } else {
          this._engineStatusInto(this.lastSnapshot.engine);this.lastSnapshot.impact=finite(event?.impulseNs,0)>0;
          this.core.copyDamageInto(this.lastSnapshot.damage,this.damage);this._copyImpactsInto(this.lastSnapshot);
        }
      }
      return this.lastSnapshot;
    }

    _copyImpactsInto(snapshot) {
      snapshot.impacts.length=this.impacts.length;
      const slots=snapshot===this.scratch.snapshots[0]?this.scratch.impactSnapshotSlots[0]:this.scratch.impactSnapshotSlots[1];
      for(let i=0;i<this.impacts.length;i++){const source=this.impacts[i],out=slots[i];
        out.timeSeconds=source.timeSeconds;out.impulseNs=source.impulseNs;out.magnitude=source.magnitude;out.otherId=source.otherId;out.material=source.material;
        for(let k=0;k<3;k++){out.localPointM[k]=source.localPointM[k];out.relativeVelocityMps[k]=source.relativeVelocityMps[k];}snapshot.impacts[i]=out;
      }
    }

    _gripScale(environment, axle) {
      if(!this.chassisConfig)return 1;
      const d=this.chassisDynamics,wetness=clamp(Number.isFinite(environment.wetness)?environment.wetness:environment.surface==='wet'||environment.waterDepthM>0?1:0,0,1),surface=environment.surface;
      const loose=surface==='gravel'||surface==='grass'||surface==='dirt'||surface==='sand'||surface==='mud'||environment.surfaceState==='dust';
      return axle==='rear'?(loose?d.rearLoose:d.rearDry+(d.rearWet-d.rearDry)*wetness):(loose?d.frontLoose:d.frontDry+(d.frontWet-d.frontDry)*wetness);
    }

    reset(options) {
      if (this.disposed) throw new Error('VehiclePhysicsSession disposed');
      const frame = options?.frame || options?.spawn || {};
      this.teleport(frame, { x: 0, y: 0, z: 0 });
      const state = this.core.createVehicleState(this.spec);
      this.wheels = state.wheels.map(wheel => ({ ...wheel, tire: {} }));
      this.previousCompression.fill(NaN);
      const initialGear = Number.isInteger(options?.initialGear) && options.initialGear >= -1 && options.initialGear <= this.spec.gearbox.forward.length ? options.initialGear : 1;
      const initialClutchEngagement = initialGear === 0 ? 0 : 1;
      this.powertrainState = {
        engineRpm: this.spec.engine.idleRpm,
        gear: initialGear,
        requestedGear: initialGear,
        clutchEngagement: initialClutchEngagement,
        clutchSlipRadps: 0,
        temperatureC: 20,
      };
      this.brakeState = {
        hydraulicPressure: 0,
        frontTemperatureC: 20,
        rearTemperatureC: 20,
      };
      this.absModulation = [1, 1, 1, 1];
      if (options?.damageState) this.core.copyDamageInto(this.damage, options.damageState);
      else if (options?.resetDamage !== false) this.damage = this.core.createMutableDamageState();
      if (options?.resetClock !== false) this.timeSeconds = 0;
      if (options?.startEngine === true) {
        this.ignitionSequence = ++nextIgnitionSequence;
        this.ignitionStartedAtS = this.timeSeconds;
        this.ignitionState = 'starting';
      }
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
          ...this._engineStatus(),
          rpm: this.powertrainState.engineRpm,
          temperatureC: finite(this.powertrainState.engineTemperatureC, this.powertrainState.temperatureC),
          load: 0,
          torqueNm: 0,
        },
        gearbox: { gear: initialGear, requestedGear: initialGear },
        clutch: { engagement: initialClutchEngagement, slipRadps: 0 },
        brakes: {
          frontTemperatureC: 20,
          rearTemperatureC: 20,
          locked: [false, false, false, false],
          frontFade: 0,
          rearFade: 0,
        },
        controls: { throttle: 0, brake: 0, handbrake: 0, steer: 0, handwheelAngleRad: 0, clutchEngagement: initialClutchEngagement, requestedGear: initialGear },
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
      for(const record of this._impactRecords){record.lastTime=-Infinity;record.tick=-1;}
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
        engine: { ...this._engineStatus(), rpm: this.powertrainState.engineRpm },
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
