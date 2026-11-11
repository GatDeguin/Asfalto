const LEFT = 'leftDoor';
const RIGHT = 'rightDoor';
const HOOD = 'hood';
const BODY = 'body';
const DOORS = [LEFT, RIGHT];
const PANELS = [HOOD, ...DOORS];
const JAMMED = .42;
const DETACHED = .86;
const HOOD_ANGLE = 1.04;
const amount = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const outward = id => id === LEFT ? 1 : -1;
const side = z => z >= 0 ? LEFT : RIGHT;
const whole = (name, part, primary = false) => ({name, part, primary});
const B_PILLAR = [-1, 0, 0, .039];
const cutAtPillar = (name, part, primary = false) => ({name, part, primary, plane: B_PILLAR});
const components = (name, boxes, plane) => ({name, boxes, plane});

// Coordinates are in each shipping GLB's model space. Physical left is source
// +Z after the chassis fit rotates the model by 180 degrees.
// Component boxes list x, y and absolute z bounds for a complete attached part.
const SERIES_2_WINDOW = [
  [-.274, -.081, .086, .228, .267, .325],
  [-.148, .249, .086, .227, .268, .328],
];
// The Chevy's shell is welded. Clip the rocker, belt and two jambs at the
// workshop's authored door outline, including the angled lower front jamb.
const lowerJambSlope = .031 / .103;
const CHEVY_DOOR_OUTLINES = DOORS.map(id => [
  [0, 0, outward(id), -.305],
  [0, 1, 0, .173],
  [0, -1, 0, .111],
  [1, 0, 0, .219],
  [1, lowerJambSlope, 0, .219 + .07 * lowerJambSlope],
  [-1, 0, 0, .215],
]);
const DOOR_SPECS = {
  chevy: {
    hinge: [-.217, .347],
    meshes: [
      {name: 'chevy_Body_paint', primary: true, outlines: CHEVY_DOOR_OUTLINES},
      components('chevy_static_Vehicle_Glass', [[-.194, .184, .116, .272, .244, .325]]),
      components('chevy_static_Vehicle_Chrome', [
        [-.194, .184, .117, .270, .249, .323],
        [.105, .159, .058, .070, .360, .380],
      ]),
    ],
  },
  chevrolet_1969: {
    hinge: [-.253, .334],
    meshes: [
      whole('Puerta_I_Chapa_Separada', LEFT, true),
      whole('Puerta_D_Chapa_Separada', RIGHT, true),
      whole('Ventanilla_Puerta_Izquierdo__13', LEFT),
      whole('Ventilete_Izquierdo__13', LEFT),
      whole('Ventanilla_Puerta_Derecho__13', RIGHT),
      whole('Ventilete_Derecho__13', RIGHT),
      components('01_Carroceria_y_Franjas__08_Burletes_Negros', SERIES_2_WINDOW),
      components('01_Carroceria_y_Franjas__03_Cromo_Pulido_Microacabado_V4', [
        ...SERIES_2_WINDOW, [.153, .222, .031, .065, .354, .376],
      ]),
    ],
  },
  chevy_400_1957: {
    hinge: [-.231, .337],
    meshes: [
      cutAtPillar('V7_SheetMetal_L_Door', LEFT, true),
      cutAtPillar('V7_SheetMetal_R_Door', RIGHT, true),
      cutAtPillar('V7_GlassPane_01', LEFT),
      cutAtPillar('V7_GlassPane_02', RIGHT),
      components('Cabin__10_Window_seals', [[-.220, .338, .119, .308, .286, .341]], B_PILLAR),
      components('SS250_BodyTrim_DoorHandlesAnd4100', [[-.020, .034, .070, .083, .350, .372]]),
    ],
  },
  belair_1957: {
    hinge: [-.250, .344],
    meshes: [
      whole('belair_1957_doorSide_right_BA57_Paint_Turquoise', LEFT, true),
      whole('belair_1957_doorSide_left_BA57_Paint_Turquoise', RIGHT, true),
      components('belair_1957_static_BA57_Chrome', [
        [.130, .205, .062, .094, .364, .390],
        [-.138, .035, .115, .265, .305, .323],
      ]),
    ],
  },
  pickup_3100: {
    hinge: [-.171, .303],
    meshes: [
      whole('pickup_3100_doorSide_right_C3100_Paint_Turquoise', LEFT, true),
      whole('pickup_3100_doorSide_left_C3100_Paint_Turquoise', RIGHT, true),
      components('pickup_3100_static_C3100_Chrome', [[.115, .202, .171, .186, .316, .339]]),
      components('pickup_3100_static_C3100_Glass', [[-.125, .230, .207, .398, .291, .320]]),
      components('pickup_3100_static_C3100_Rubber', [[-.130, .233, .204, .403, .288, .321]]),
    ],
  },
};

function insideBox({min, max}, [x0, x1, y0, y1, z0, z1]) {
  const near = min.z > 0 ? min.z : -max.z;
  const far = min.z > 0 ? max.z : -min.z;
  return min.x >= x0 && max.x <= x1 && min.y >= y0 && max.y <= y1 && near >= z0 && far <= z1;
}

function classifyComponents(T, positions, indices, boxes) {
  const count = positions.length / 3;
  const parents = new Int32Array(count);
  const welded = new Map();
  function find(id) {
    while (id !== parents[id]) {
      parents[id] = parents[parents[id]];
      id = parents[id];
    }
    return id;
  }
  // Join coincident UV and normal seams before checking a component's extent.
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    const key = Math.round(positions[j] * 1e5) + ',' +
      Math.round(positions[j + 1] * 1e5) + ',' + Math.round(positions[j + 2] * 1e5);
    parents[i] = welded.get(key) ?? i;
    if (parents[i] === i) welded.set(key, i);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const root = find(indices[i]);
    parents[find(indices[i + 1])] = root;
    parents[find(indices[i + 2])] = root;
  }
  const bounds = new Map(), point = new T.Vector3();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    if (!bounds.has(root)) bounds.set(root, new T.Box3());
    bounds.get(root).expandByPoint(point.fromArray(positions, i * 3));
  }
  const parts = new Map();
  for (const [root, box] of bounds) {
    if (boxes.some(rule => insideBox(box, rule))) parts.set(root, side(box.min.z));
  }
  return index => parts.get(find(index)) ?? BODY;
}

function makeLayout(indices, cuts, vertexCount) {
  const vertices = [], remap = new Map();
  const mapped = indices.map(index => {
    if (!remap.has(index)) {
      remap.set(index, vertices.length);
      vertices.push(index < vertexCount ? index : cuts[index - vertexCount]);
    }
    return remap.get(index);
  });
  return {vertices, indices: mapped};
}

function appendTriangles(polygon, indices) {
  const a = polygon[0];
  for (let i = 1; i + 1 < polygon.length; i++) {
    const b = polygon[i], c = polygon[i + 1];
    if (a !== b && b !== c && a !== c) indices.push(a, b, c);
  }
}

function partition(T, {mesh, authored, transform, rule}) {
  if (rule.part && rule.plane === undefined) return [{id: rule.part}];
  const position = authored.attributes.position;
  if (!position || Array.isArray(mesh.material) || mesh.isSkinnedMesh) return [];
  const index = authored.index;
  const indices = Array.from({length: index?.count ?? position.count}, (_, i) => index?.getX(i) ?? i);
  const coordinates = new Float64Array(position.count * 3), point = new T.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(transform).toArray(coordinates, i * 3);
  }
  const classify = rule.boxes && classifyComponents(T, coordinates, indices, rule.boxes);
  const byPart = {[BODY]: [], [LEFT]: [], [RIGHT]: []};
  const cuts = [], cutVertices = new Map();
  const count = position.count;
  const vertex = id => id < count ? id : cuts[id - count];
  const coord = (id, axis) => id < count ? coordinates[id * 3 + axis] : cuts[id - count].point[axis];
  const signedDistance = (id, [x, y, z, offset]) =>
    x * coord(id, 0) + y * coord(id, 1) + z * coord(id, 2) + offset;

  // Outside-plane masks keep the bulk of the welded shell on the fast path.
  const outsideMasks = rule.outlines?.map(planes => {
    const masks = new Uint8Array(count);
    for (let i = 0; i < count; i++) for (let j = 0; j < planes.length; j++) {
      if (signedDistance(i, planes[j]) < 0) masks[i] |= 1 << j;
    }
    return masks;
  });
  function intersection(a, b, da, db, plane) {
    if (Math.abs(da) < 1e-12) return a;
    if (Math.abs(db) < 1e-12) return b;
    if (a > b) [a, b, da, db] = [b, a, db, da];
    if (!cutVertices.has(plane)) cutVertices.set(plane, new Map());
    const verticesOnPlane = cutVertices.get(plane), key = a + ',' + b;
    if (!verticesOnPlane.has(key)) {
      const mix = da / (da - db);
      const point = [0, 1, 2].map(axis => coord(a, axis) + (coord(b, axis) - coord(a, axis)) * mix);
      verticesOnPlane.set(key, count + cuts.length);
      cuts.push({a: vertex(a), b: vertex(b), mix, point});
    }
    return verticesOnPlane.get(key);
  }
  function split(polygon, plane) {
    const distances = polygon.map(id => signedDistance(id, plane));
    if (distances.every(distance => distance >= 0)) return [polygon, []];
    if (distances.every(distance => distance <= 0)) return [[], polygon];
    const inside = [], outside = [];
    for (let i = 0; i < polygon.length; i++) {
      const next = (i + 1) % polygon.length;
      const a = polygon[i], b = polygon[next], da = distances[i], db = distances[next];
      (da >= 0 ? inside : outside).push(a);
      if ((da >= 0) !== (db >= 0)) {
        const seam = intersection(a, b, da, db, plane);
        if (seam !== a || da < 0) inside.push(seam);
        if (seam !== a || da >= 0) outside.push(seam);
      }
    }
    return [inside, outside];
  }
  function isolate(polygon, planes, moving, fixed) {
    for (const plane of planes) {
      const [inside, outside] = split(polygon, plane);
      if (outside.length >= 3) fixed.push(outside);
      if (inside.length < 3) return;
      polygon = inside;
    }
    appendTriangles(polygon, moving);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    if (outsideMasks) {
      const [left, right] = outsideMasks;
      const possibleLeft = !(left[a] & left[b] & left[c]);
      const possibleRight = !(right[a] & right[b] & right[c]);
      if (!possibleLeft && !possibleRight) {
        byPart[BODY].push(a, b, c);
        continue;
      }
      let fixed = [[a, b, c]];
      for (let j = 0; j < DOORS.length; j++) {
        if (!(j === 0 ? possibleLeft : possibleRight)) continue;
        const remainder = [];
        for (const polygon of fixed) isolate(polygon, rule.outlines[j], byPart[DOORS[j]], remainder);
        fixed = remainder;
      }
      for (const polygon of fixed) appendTriangles(polygon, byPart[BODY]);
    } else {
      const id = rule.part ?? classify?.(a) ?? BODY;
      if (id === BODY || !rule.plane) byPart[id].push(a, b, c);
      else {
        const [inside, outside] = split([a, b, c], rule.plane);
        appendTriangles(inside, byPart[id]);
        appendTriangles(outside, byPart[BODY]);
      }
    }
  }
  return Object.entries(byPart).filter(([, indices]) => indices.length).map(([id, indices]) =>
    ({id, layout: makeLayout(indices, cuts, position.count)}));
}

function readAttribute(input, entry, component) {
  if (typeof entry === 'number') return input.getComponent(entry, component);
  const a = readAttribute(input, entry.a, component);
  return a + (readAttribute(input, entry.b, component) - a) * entry.mix;
}

// Use the original geometry to locate the seam and the live geometry for the
// rendered attributes. The split owns its GPU buffers and follows later dents.
function refreshPiece(T, piece, source) {
  if (!piece.layout) {
    piece.view.geometry = source;
    return;
  }
  const {vertices, indices} = piece.layout;
  if (!piece.attributes) {
    piece.attributes = new Map();
    piece.view.geometry = new T.BufferGeometry().setIndex(indices);
    piece.view.geometry.userData = {...source.userData};
  }
  const geometry = piece.view.geometry;
  let moved = false;
  for (const [name, input] of Object.entries(source.attributes)) {
    const version = input.isInterleavedBufferAttribute ? input.data.version : input.version;
    const previous = piece.attributes.get(name);
    if (previous?.input === input && previous.version === version) continue;
    let output = geometry.getAttribute(name);
    if (!output) {
      output = new T.Float32BufferAttribute(vertices.length * input.itemSize, input.itemSize);
      geometry.setAttribute(name, output);
    }
    for (let i = 0; i < vertices.length; i++) {
      const entry = vertices[i], start = i * input.itemSize;
      for (let j = 0; j < input.itemSize; j++) {
        output.array[start + j] = readAttribute(input, entry, j);
      }
    }
    output.needsUpdate = true;
    piece.attributes.set(name, {input, version});
    if (name === 'position') moved = true;
  }
  if (moved) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}

function releasePiece(piece) {
  if (!piece.view) return;
  piece.view.removeFromParent();
  if (piece.attributes) piece.view.geometry.dispose();
  piece.view = piece.attributes = null;
}

function restoreSource(record) {
  if (!record.split) return;
  for (const piece of record.pieces) releasePiece(piece);
  record.mesh.visible = record.visible;
  record.split = false;
}

function canLaunch(model, visibilityRoot) {
  for (let node = model; node; node = node.parent) {
    if (!node.visible) return false;
    if (node === visibilityRoot) break;
  }
  return true;
}

function surfaceAt(T, snapshot, position) {
  const point = new T.Vector3(position.x, position.y - .75, position.z);
  const normal = new T.Vector3(0, 1, 0);
  const chassisY = snapshot?.chassis?.position?.[1];
  if (Number.isFinite(chassisY)) point.y = Math.min(position.y - .24, chassisY - .55);
  let distance = Infinity;
  for (const wheel of snapshot?.wheels ?? []) {
    if (!wheel.contact || !wheel.point?.every(Number.isFinite)) continue;
    const [x, y, z] = wheel.point;
    const next = Math.hypot(x - position.x, z - position.z);
    if (next >= distance) continue;
    distance = next;
    point.set(x, y, z);
    normal.set(0, 1, 0);
    if (wheel.normal?.[1] > .45) normal.fromArray(wheel.normal).normalize();
  }
  return {point, normal};
}

function launchDebris(T, scene, model, name, id, pivots, snapshot) {
  const sources = [];
  for (const pivot of pivots) {
    pivot.updateWorldMatrix(true, true);
    pivot.traverseVisible(node => { if (node.isMesh) sources.push(node); });
  }
  if (!sources.length) return null;

  const hood = id === HOOD;
  const surface = surfaceAt(T, snapshot, pivots[0].getWorldPosition(new T.Vector3()));
  const direction = new T.Vector3(hood ? -.86 : .22, 0, hood ? .34 : outward(id))
    .transformDirection(model.matrixWorld);
  direction.y = 0;
  direction.normalize();
  const axis = new T.Vector3(1, .15, hood ? .25 : outward(id) * .48).transformDirection(model.matrixWorld);
  const normalMatrix = new T.Matrix3().getNormalMatrix(pivots[0].matrixWorld);
  const face = new T.Vector3(0, hood ? 1 : 0, hood ? 0 : outward(id)).applyNormalMatrix(normalMatrix);
  const rest = new T.Quaternion().setFromUnitVectors(face, surface.normal);
  const twist = new T.Quaternion().setFromAxisAngle(surface.normal, hood ? -.21 : .33 * outward(id));
  rest.premultiply(twist);

  // Fit the landed panel to the nearest tire contact plane. Use referenced
  // vertices so unused accessor entries do not affect its height.
  const bounds = new T.Box3(), point = new T.Vector3();
  let bottom = Infinity;
  for (const mesh of sources) {
    const {position} = mesh.geometry.attributes, {index} = mesh.geometry;
    for (let i = 0; i < (index?.count ?? position.count); i++) {
      point.fromBufferAttribute(position, index?.getX(i) ?? i).applyMatrix4(mesh.matrixWorld);
      bounds.expandByPoint(point);
      bottom = Math.min(bottom, point.applyQuaternion(rest).dot(surface.normal));
    }
  }
  const center = bounds.getCenter(new T.Vector3());
  const clearance = (center.clone().applyQuaternion(rest).dot(surface.normal) - bottom + .022) / surface.normal.y;
  const group = new T.Group();
  group.name = name;
  group.matrixAutoUpdate = false;
  const geometries = new Map();
  const offset = new T.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
  for (const mesh of sources) {
    if (!geometries.has(mesh.geometry)) geometries.set(mesh.geometry, mesh.geometry.clone());
    const copy = mesh.clone(false);
    copy.geometry = geometries.get(mesh.geometry);
    copy.matrixAutoUpdate = false;
    copy.matrix.multiplyMatrices(offset, mesh.matrixWorld);
    group.add(copy);
  }
  scene.add(group);
  scene.updateWorldMatrix(true, false);
  const velocity = new T.Vector3();
  const motion = snapshot?.chassis?.linearVelocity;
  if (motion?.every(Number.isFinite)) velocity.set(motion[0], 0, motion[2]).multiplyScalar(.22).clampLength(0, 5);
  velocity.addScaledVector(direction, hood ? 1.8 : 2.3);
  const start = center.addScaledVector(direction, hood ? .34 : .39);
  start.y += .17;
  const debris = {group, geometries, start, velocity, axis, rest, surface, clearance, hood,
    position: new T.Vector3(), rotation: new T.Quaternion(), unit: new T.Vector3(1, 1, 1),
    toScene: new T.Matrix4().copy(scene.matrixWorld).invert(), age: 0, landAt: null, settled: false};
  advanceDebris(debris, 0, false);
  return debris;
}

function advanceDebris(debris, dt, reducedMotion) {
  if (debris.settled) return;
  const {start, velocity, position, rotation, surface, hood} = debris;
  const age = debris.age += dt;
  position.copy(start).addScaledVector(velocity, (1 - Math.exp(-1.5 * age)) / 1.5);
  const {normal, point} = surface;
  const floor = point.y - (normal.x * (position.x - point.x) + normal.z * (position.z - point.z)) / normal.y + debris.clearance;
  const height = start.y + (hood ? 2.65 : 1.9) * age - 4.905 * age * age;
  if (debris.landAt === null && age > 0 && (height <= floor || age >= 1.65)) debris.landAt = age;
  if (reducedMotion) debris.landAt = age - .39;
  const spinTime = debris.landAt ?? age;
  rotation.setFromAxisAngle(debris.axis, .09 + spinTime * (hood ? 3.35 : 4.4));
  if (debris.landAt === null) position.y = Math.max(height, floor);
  else {
    const settle = amount((age - debris.landAt) / .38);
    position.y = floor + Math.sin(Math.PI * settle) * .10;
    rotation.slerp(debris.rest, settle);
    debris.settled = settle === 1;
  }
  debris.group.matrix.compose(position, rotation, debris.unit).premultiply(debris.toScene);
  debris.group.matrixWorldNeedsUpdate = true;
}

export function createVehicleDamagePanels(T, {model, vehicle, hoods = [], scene = null, visibilityRoot = null}) {
  const spec = DOOR_SPECS[vehicle], records = [];
  const hoodPivots = hoods.map(pivot => ({pivot, z: pivot.rotation.z, visible: pivot.visible}));
  const panels = Object.fromEntries(PANELS.map(id => [id, {
    damage: 0, available: false, state: 'closed', pending: false, debris: null, pivot: null, angle: 0,
  }]));
  panels.hood.available = hoodPivots.length > 0;
  if (spec) {
    model.updateWorldMatrix(true, true);
    const inverse = model.matrixWorld.clone().invert();
    for (const rule of spec.meshes) {
      model.getObjectByName(rule.name)?.traverseVisible(mesh => {
        if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
        const sides = rule.part ? [rule.part] : DOORS;
        if (rule.primary) for (const id of sides) panels[id].available = true;
        records.push({mesh, parent: mesh.parent, authored: mesh.geometry, rule, sides, pieces: null,
          transform: inverse.clone().multiply(mesh.matrixWorld), visible: mesh.visible, split: false});
      });
    }
  }
  let hoodOpen = 0, disposed = false;

  function syncHood() {
    const hood = panels.hood;
    const damageAngle = hood.state === 'closed' ? 0 : .105 + (hood.damage - JAMMED) * .49;
    hood.angle = Math.max(hoodOpen * HOOD_ANGLE, damageAngle);
    for (const {pivot, z, visible} of hoodPivots) {
      pivot.rotation.z = z - hood.angle;
      pivot.visible = visible && (hood.state !== 'detached' || hood.pending);
    }
  }

  function syncDoors() {
    for (const id of DOORS) {
      const panel = panels[id];
      const moving = panel.state === 'jammed' || panel.pending;
      panel.angle = moving ? -outward(id) * (.23 + (panel.damage - JAMMED) * .82) : 0;
      if (moving) {
        if (!panel.pivot) {
          panel.pivot = new T.Group();
          panel.pivot.name = vehicle + '_' + id + '_DamageHinge';
          panel.pivot.position.set(spec.hinge[0], 0, outward(id) * spec.hinge[1]);
          model.add(panel.pivot);
        }
        panel.pivot.rotation.y = panel.angle;
      }
    }
    for (const record of records) {
      const relevant = record.sides.some(id => panels[id].state !== 'closed');
      if (!relevant) {
        restoreSource(record);
        record.pieces = null;
        continue;
      }
      record.pieces ??= partition(T, record);
      if (!record.pieces.some(({id}) => id !== BODY && panels[id].state !== 'closed')) {
        restoreSource(record);
        continue;
      }
      record.mesh.visible = false;
      record.split = true;
      for (const piece of record.pieces) {
        const panel = panels[piece.id];
        if (panel?.state === 'detached' && !panel.pending) {
          releasePiece(piece);
          continue;
        }
        const pivot = panel?.state !== 'closed' && panel?.pivot;
        const parent = pivot || record.parent;
        piece.view ??= record.mesh.clone(false);
        if (piece.view.parent !== parent) {
          piece.view.visible = true;
          piece.view.matrixAutoUpdate = false;
          if (pivot) {
            piece.view.matrix.copy(record.transform);
            const e = piece.view.matrix.elements;
            e[12] -= pivot.position.x;
            e[13] -= pivot.position.y;
            e[14] -= pivot.position.z;
          } else {
            piece.view.matrix.copy(record.mesh.matrix);
          }
          parent.add(piece.view);
        }
        refreshPiece(T, piece, record.mesh.geometry);
      }
    }
    for (const id of DOORS) {
      const panel = panels[id];
      if (panel.pivot && panel.state !== 'jammed' && !panel.pending) {
        panel.pivot.removeFromParent();
        panel.pivot = null;
      }
    }
  }

  function releaseDebris(panel) {
    if (!panel.debris) return;
    panel.debris.group.removeFromParent();
    for (const geometry of panel.debris.geometries.values()) geometry.dispose();
    panel.debris = null;
  }

  function clearDebris() {
    if (disposed) return false;
    const pending = PANELS.some(id => panels[id].pending);
    for (const id of PANELS) {
      panels[id].pending = false;
      releaseDebris(panels[id]);
    }
    if (pending) {
      syncHood();
      syncDoors();
    }
    return true;
  }

  return {
    setDamage(value, {spawnDebris = false} = {}) {
      if (disposed) return false;
      let syncDoorState = false;
      for (const id of PANELS) {
        const panel = panels[id], previous = panel.state;
        panel.damage = amount(value?.[id]);
        panel.state = !panel.available || panel.damage < JAMMED ? 'closed' :
          panel.damage >= DETACHED ? 'detached' : 'jammed';
        if (panel.state === 'detached') {
          if (previous !== 'detached' && scene && spawnDebris && canLaunch(model, visibilityRoot)) panel.pending = true;
        } else {
          panel.pending = false;
          releaseDebris(panel);
        }
        if (id !== HOOD && (previous !== 'closed' || panel.state !== 'closed')) syncDoorState = true;
      }
      syncHood();
      if (syncDoorState) syncDoors();
      return true;
    },
    setHoodOpen(value) {
      if (disposed) return false;
      hoodOpen = amount(value);
      syncHood();
      return true;
    },
    update({dt = 0, snapshot, paused = false, reducedMotion = false} = {}) {
      if (disposed) return false;
      let hoodReleased = false, doorReleased = false;
      for (const id of PANELS) {
        const panel = panels[id];
        if (panel.pending) {
          const pivots = id === HOOD ? hoodPivots.map(({pivot}) => pivot) : [panel.pivot];
          if (!reducedMotion) panel.debris = launchDebris(T, scene, model, vehicle + '_' + id + '_DamageDebris', id, pivots, snapshot);
          panel.pending = false;
          if (id === HOOD) hoodReleased = true;
          else doorReleased = true;
        }
        if (panel.debris && (!paused || reducedMotion)) {
          advanceDebris(panel.debris, paused ? 0 : Math.min(.1, amount(dt)), reducedMotion);
        }
      }
      if (hoodReleased) syncHood();
      if (doorReleased) syncDoors();
      return true;
    },
    clearDebris,
    diagnostics: () => Object.fromEntries(PANELS.map(id => {
      const {available, state, damage, angle, pending, debris} = panels[id];
      return [id, {state: available ? state : 'unavailable', damage, angleRad: angle,
        debris: pending ? 'pending' : debris?.settled ? 'settled' : debris ? 'moving' : null}];
    })),
    dispose() {
      if (disposed) return false;
      for (const id of PANELS) {
        const panel = panels[id];
        releaseDebris(panel);
        panel.pending = false;
        panel.state = 'closed';
      }
      syncDoors();
      for (const {pivot, z, visible} of hoodPivots) {
        pivot.rotation.z = z;
        pivot.visible = visible;
      }
      disposed = true;
      return true;
    },
  };
}
