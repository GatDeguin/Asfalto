import {createForestImpostorGeometry} from './regional-canopy-stand.mjs?v=4e2c6dc3fe25ef44';
import {addIguazuApproachPlants} from './iguazu-landscape.mjs?v=8af12914a5c2238f';
import {batchIguazuGround} from './iguazu-ground-batches.mjs?v=657ba3796dce7370';

// The access roads are scene geometry. The route query still spans the two official gates.
const STEP_M = 8;
const OVERLAP_M = .45;
const RAD = Math.PI / 180;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// turn = [start, length, degrees]. The two flanks shape the land outside the bend.
const PROFILES = {
  dos_lagos: {
    asphalt: 'M_Asphalt_Wet', gravel: 'M_Shoulder_Gravel', edge: 'M_Road_Line_Ivory', center: 'M_Road_Line_Ochre',
    terrain: 'M_Terrain_Andean', soil: '#514b39',
    start: {length: 952, turn: [10, 180, 95], rise: [22, 260], gradeFade: 140, flanks: [45, -12], toe: 12, surface: .032},
    finish: {length: 1120, turn: [10, 180, 52], rise: [29, 330], gradeFade: 140, flanks: [20, 34], toe: 11, surface: .032},
  },
  aconcagua_horcones: {
    asphalt: 'MAT_P1_ROAD', gravel: 'MAT_P1_GRAVEL', edge: 'MAT_ROAD_PAINT_WHITE_PBR', center: 'MAT_ROAD_PAINT_YELLOW_PBR',
    terrain: 'MAT_P1_TERRAIN_ARID', soil: '#736352',
    start: {length: 1296, turn: [50, 492, -65], rise: [-22, 860], gradeFade: 270, flanks: [82, 42], toe: .4, surface: .12},
    finish: {length: 1280, turn: [40, 370, 77], rise: [57, 1100], gradeFade: 285, flanks: [46, 102], toe: .4, surface: .12},
  },
  cuesta_lipan: {
    asphalt: 'V2_ASPHALT_PBR', gravel: 'V2_SHOULDER_PBR', edge: 'V2_PAINT_PBR', center: 'V2_PAINT_PBR',
    terrain: 'V2_TERRAIN_PBR', soil: '#8a7050',
    start: {length: 1024, turn: [32, 410, 68], rise: [5, 180], gradeFade: 28, flanks: [43, 75], toe: 1.8, surface: 0},
    finish: {length: 1176, turn: [36, 415, -76], rise: [15, 500], gradeFade: 110, flanks: [85, 45], toe: 1.8, surface: 0},
  },
  paso_garibaldi: {
    asphalt: 'MAT_ASPHALT', gravel: 'MAT_SHOULDER', edge: 'MAT_ROAD_MARKING', center: 'MAT_ROAD_MARKING',
    terrain: 'MAT_TERRAIN_HERO', soil: '#4f4b3e',
    start: {length: 1064, turn: [32, 420, 72], rise: [23, 640], gradeFade: 170, flanks: [52, 29], toe: .8, surface: .074},
    finish: {length: 1120, turn: [36, 410, -83], rise: [24, 720], gradeFade: 185, flanks: [37, 65], toe: .8, surface: .074},
  },
  cataratas_iguazu: {
    asphalt: 'MAT_asphalt', gravel: 'MAT_laterite', edge: 'MAT_road_white', center: 'MAT_road_ochre',
    terrain: 'MAT_forest_floor', soil: '#76442d',
    start: {length: 896, turn: [10, 180, -70], rise: [29, 330], gradeFade: 140, flanks: [23, 48], toe: 1.2, surface: 0},
    finish: {length: 992, turn: [10, 180, -95], rise: [22, 270], gradeFade: 140, flanks: [50, 23], toe: 3.1, surface: 0,
      cut: {lengthM: 168, tiles: [212, 245, 246]}},
  },
};

function approachRows(gate, direction, profile) {
  const [gateX, gateY, gateZ] = gate.position;
  const [tx, ty, tz] = gate.frame.tangent;
  const planar = Math.hypot(tx, tz);
  const bearing = Math.atan2(direction * tz, direction * tx);
  const grade = direction * ty / planar;
  const [bendStart, bendLength, turnDegrees] = profile.turn;
  const [riseM, riseLengthM] = profile.rise;
  const heading = distance => bearing + turnDegrees * RAD * smooth((distance - bendStart) / bendLength);
  const distances = [-OVERLAP_M, 0, 2, 4];
  for (let distance = STEP_M; distance <= profile.length; distance += STEP_M) distances.push(distance);
  let x = gateX, z = gateZ, previous = 0;
  return distances.map(distance => {
    const advance = distance - previous, middle = heading((distance + previous) / 2);
    x += Math.cos(middle) * advance;
    z += Math.sin(middle) * advance;
    previous = distance;
    const yaw = heading(distance);
    const ramp = distance < 0 ? distance : profile.gradeFade * -Math.expm1(-distance / profile.gradeFade);
    return {
      distance, x, z, y: gateY + grade * ramp + riseM * smooth(distance / riseLengthM),
      leftX: -Math.sin(yaw), leftZ: Math.cos(yaw),
      bank: direction * gate.frame.left[1] * (1 - smooth(distance / 80)),
      halfWidth: gate.widthM / 2, s: gate.sM + distance * direction,
    };
  });
}

function makeStrip(T, rows, columns, {colorAt, nativeColor, worldUv, enabled = () => true} = {}) {
  const positions = [], uv = [], indices = [], roadCoordinates = [], halfWidths = [], colors = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    for (let column = 0; column < columns.length; column++) {
      const [offset, height] = columns[column](row);
      const x = row.x + row.leftX * offset, z = row.z + row.leftZ * offset;
      positions.push(x, row.y + row.bank * offset + height, z);
      uv.push(worldUv ? x / worldUv : offset / 5, worldUv ? z / worldUv : row.s / 8);
      roadCoordinates.push(row.s, offset);
      halfWidths.push(row.halfWidth);
      if (colorAt) colors.push(...colorAt(row, column));
      else if (nativeColor) colors.push(...nativeColor);
      if (!rowIndex || !column || !enabled(rowIndex)) continue;
      const next = rowIndex * columns.length + column, previous = next - columns.length;
      indices.push(previous - 1, previous, next - 1, next - 1, previous, next);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('asfaltoRoadCoordinates', new T.Float32BufferAttribute(roadCoordinates, 2));
  geometry.setAttribute('asfaltoRoadHalfWidth', new T.Float32BufferAttribute(halfWidths, 1));
  if (colors.length) geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function cutApproachTerrain(T, root, rows, {lengthM, tiles}) {
  const terrainNames = new Set(tiles.map(id => `TERRAIN_${id}_Primitive_0`));
  const corridor = rows.filter(row => row.distance >= 0 && row.distance <= lengthM);
  const gate = corridor[0], point = new T.Vector3(), inverse = new T.Matrix4();
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (!mesh.isMesh || !terrainNames.has(mesh.name)) return;
    const positions = mesh.geometry.attributes.position;
    inverse.copy(mesh.matrixWorld).invert();
    let changed = false;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      point.fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld);
      const fromGate = (point.x - gate.x) * gate.leftZ - (point.z - gate.z) * gate.leftX;
      if (fromGate <= 2) continue;
      let distanceSquared = 54 ** 2, nearest;
      for (let i = 1; i < corridor.length; i++) {
        const a = corridor[i - 1], b = corridor[i], dx = b.x - a.x, dz = b.z - a.z;
        const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
        const d2 = (point.x - a.x - dx * u) ** 2 + (point.z - a.z - dz * u) ** 2;
        if (d2 < distanceSquared) {
          distanceSquared = d2;
          nearest = {y: a.y + (b.y - a.y) * u, distance: a.distance + (b.distance - a.distance) * u};
        }
      }
      if (!nearest) continue;
      const flank = Math.max(0, Math.sqrt(distanceSquared) - gate.halfWidth - 9);
      const cutY = nearest.y - .55 + flank * .31;
      if (point.y <= cutY) continue;
      const blend = smooth(fromGate / 17) * smooth((lengthM - nearest.distance) / 27) * (1 - smooth(flank / 39));
      if (!blend) continue;
      point.y += (cutY - point.y) * blend;
      point.applyMatrix4(inverse);
      positions.setXYZ(vertex, point.x, point.y, point.z);
      changed = true;
    }
    if (!changed) return;
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

function addApproachInstances(T, root, name, geometry, material, placements) {
  const mesh = new T.InstancedMesh(geometry, material, placements.length);
  const dummy = new T.Object3D();
  mesh.name = name;
  mesh.receiveShadow = true;
  placements.forEach(({x, y, z, rotation, size, width, depth}, i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.y = rotation;
    dummy.scale.set(width, size, depth);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  root.add(mesh);
}

export function addTrackApproaches(T, {id, query, lengthM, visualRoot, collisionRoot}) {
  const profile = PROFILES[id];
  if (!profile || !visualRoot?.isObject3D || !collisionRoot?.isObject3D) return;
  const source = new Map();
  const materialNames = new Set([profile.asphalt, profile.gravel, profile.edge, profile.center, profile.terrain]);
  let sharedTextures, canopy;
  visualRoot.traverse(node => {
    sharedTextures ||= node.asfaltoSurfaceTextures;
    const name = node.material?.name;
    if (name === `ASFALTO_${id}_canopy` && node.material.map) canopy ||= node.material;
    if (!node.isMesh || !materialNames.has(name) || source.has(name)) return;
    const color = node.geometry.attributes.color;
    source.set(name, {material: node.material, nativeColor: color && [color.getX(0), color.getY(0), color.getZ(0)]});
  });
  const material = (name, color, options) => source.get(name) || {material: new T.MeshStandardMaterial({name, color, roughness: .91, ...options})};
  const asphalt = material(profile.asphalt, '#6b6d66', {map: sharedTextures?.aerial_asphalt_01?.diff || null});
  const gravel = material(profile.gravel, '#a69374', {map: sharedTextures?.gravel_floor?.diff || null});
  const edge = material(profile.edge, '#d9cfad'), center = material(profile.center, id === 'cuesta_lipan' ? '#c9c8ba' : '#b58c41');
  const ground = material(profile.terrain, '#c2b9a5', {map: sharedTextures?.gravel_floor?.diff || null, vertexColors: true, roughness: 1});
  const rock = new T.MeshStandardMaterial({color: profile.soil, roughness: 1, map: ground.material.map});
  const rockForm = new T.IcosahedronGeometry(.76, 1);
  const forest = canopy && new T.MeshStandardMaterial({map: canopy.map, color: canopy.color, alphaTest: .44,
    side: T.DoubleSide, roughness: 1, envMapIntensity: .2});
  const trees = forest && createForestImpostorGeometry(T);
  if (forest) forest.userData.asfaltoRainCanopy = forest.userData.asfaltoSnow = true;
  const physical = {material: new T.MeshBasicMaterial({side: T.DoubleSide})};
  const soilColor = new T.Color('#b3aa9b'), grassColor = new T.Color('#e1e0d6');
  const blendedColor = new T.Color();
  for (const [tag, end, direction, s] of [['START', profile.start, -1, 0], ['FINISH', profile.finish, 1, lengthM]]) {
    const rows = approachRows(query.sample(s), direction, end);
    if (end.cut) cutApproachTerrain(T, visualRoot, rows, end.cut);
    const mount = (root, name, surface, columns, options, stations = rows) => {
      const mesh = new T.Mesh(makeStrip(T, stations, columns, {...surface, ...options}), surface.material);
      mesh.name = name;
      mesh.receiveShadow = root === visualRoot;
      root.add(mesh);
    };
    // Start slightly under the original surface to overlap its end without a visible seam.
    const seam = row => -.025 * (1 - smooth((row.distance + OVERLAP_M) / .7));
    const deck = (lift, fade = () => 0) => [-1, 0, 1].map(side => row => [side * row.halfWidth, lift + fade(row)]);
    mount(visualRoot, `APPROACH_${tag}_ASPHALT`, asphalt, deck(end.surface, seam));
    mount(collisionRoot, `COLLISION_APPROACH_${tag}_PAVEMENT`, physical, deck(0));
    const stones = [], plants = [];
    const gate = rows[1];
    const landRows = [-22, -8].map(distance => ({...gate, distance,
      x: gate.x + gate.leftZ * distance, z: gate.z - gate.leftX * distance, y: gate.y - 1.8})).concat(rows);
    for (const side of [-1, 1]) {
      const ordered = columns => side < 0 ? columns.reverse() : columns;
      const shoulder = ordered([row => [side * row.halfWidth, end.surface + seam(row)], row => [side * (row.halfWidth + 1.55), end.surface - .14]]);
      mount(visualRoot, `APPROACH_${tag}_SHOULDER_${side}`, gravel, shoulder);
      const stripe = [-.06, .06].map(offset => row => [side * (row.halfWidth - .17) + offset, end.surface + .025]);
      mount(visualRoot, `APPROACH_${tag}_EDGE_${side}`, edge, stripe, {enabled: i => i > 1});
      const relief = end.flanks[side < 0 ? 0 : 1];
      const [, turnLength, turnDegrees] = end.turn;
      const innerRadius = turnLength / (1.5 * Math.abs(turnDegrees) * RAD);
      const flankScale = side === Math.sign(turnDegrees) ? Math.min(1, innerRadius * .8 / 275) : 1;
      const distances = [1.55, 4, 9, 21, 42, 85, 142, 205, 266];
      const groundAt = (row, distance) => {
        const flank = smooth((distance - 9) / 102);
        const toe = -end.toe * smooth((distance - 1.55) / 22);
        const ridge = .78 + .22 * Math.cos(row.distance / 140 + side);
        const variation = 2.5 * Math.sin(row.distance / 58 + distance / 33) + 3.4 * Math.cos(row.distance / 113 - distance / 22);
        const height = end.surface - .15 + toe + flank * (relief * ridge * smooth(row.distance / 210)
          + variation * smooth(row.distance / 72) - 12 * smooth((distance - 160) / 106));
        const width = distance < 9 ? distance : 9 + (distance - 9) * flankScale;
        return [side * (row.halfWidth + width), height];
      };
      const hillside = ordered(distances.map(distance => row => groundAt(row, distance)));
      mount(visualRoot, `APPROACH_${tag}_TERRAIN_${side}`, ground, hillside, {worldUv: 11, colorAt(row, column) {
        const fromRoad = side > 0 ? column : distances.length - 1 - column;
        blendedColor.copy(soilColor).lerp(grassColor, smooth(fromRoad / 5));
        return blendedColor.multiplyScalar(.94 + .13 * Math.sin(row.distance / 38 + column * 1.73) ** 2).toArray();
      }}, landRows);
      const place = (row, distance, size, width, depth, rotation) => {
        const [offset, height] = groundAt(row, distance);
        return {x:row.x+row.leftX*offset, y:row.y+row.bank*offset+height, z:row.z+row.leftZ*offset, size, width, depth, rotation};
      };
      for (let i = 6; i < rows.length; i += 3) {
        const row = rows[i], wave = .5 + .5 * Math.sin(i * 17.63 + side * 5.97);
        stones.push(place(row, wave > .58 ? 21 : 9, .38 + wave * .68, .77 + wave * 1.12, .61 + wave * .9, i * 2.35));
        if (forest || id === 'cataratas_iguazu') {
          const height = 5.3 + wave * 8.6;
          plants.push(place(row, wave < .54 ? 21 : 42, forest ? height : .78 + wave * .64, height * .47, height * .48, i * 1.73));
          plants.push(place(row, wave < .51 ? 85 : 142, forest ? height * 1.27 : .9 + wave * .68, height * .6, height * .59, i * 3.11));
        }
      }
    }
    const dash = [-.072, .072].map(offset => () => [offset, end.surface + .03]);
    mount(visualRoot, `APPROACH_${tag}_CENTER`, center, dash, {enabled: i => i >= 4 && i % 2 === 0});
    addApproachInstances(T, visualRoot, `APPROACH_${tag}_STONES`, rockForm, rock, stones);
    if (forest) addApproachInstances(T, visualRoot, `APPROACH_${tag}_CANOPY`, trees, forest, plants);
    if (id === 'cataratas_iguazu') addIguazuApproachPlants(T, visualRoot, `APPROACH_${tag}_CANOPY`, plants);
    if (id !== 'dos_lagos') {
      const apron = new T.Mesh(new T.CircleGeometry(990, 24).rotateX(-Math.PI / 2), ground.material);
      const middle = rows[Math.floor(rows.length / 2)];
      apron.name = `APPROACH_${tag}_GROUND_BACKDROP`;
      apron.position.set(middle.x, Math.min(...rows.map(row => row.y)) - 30, middle.z);
      visualRoot.add(apron);
    }
  }
  if (id === 'cataratas_iguazu' && visualRoot.userData.asfaltoIguazu) {
    visualRoot.userData.asfaltoIguazu.ground = batchIguazuGround(T, visualRoot);
  }
}
