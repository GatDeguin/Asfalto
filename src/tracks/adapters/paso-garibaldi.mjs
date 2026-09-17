import { createGlbPointToPointAdapter } from './glb-point-to-point.mjs?v=balance-20260917';

const MANIFEST = Object.freeze({
  schema: 'asfalto-track/v1',
  id: 'paso_garibaldi',
  displayName: 'RN3 Paso Garibaldi — Lago Escondido',
  format: 'point_to_point',
  lengthM: 24000,
  defaultEnvironment: 'overcast',
  environment: Object.freeze({
    profile: './environment.json',
    defaultPreset: 'overcast',
    availablePresets: Object.freeze(['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night']),
  }),
  route: './route.json',
  visual: Object.freeze(['./scene.glb']),
  collision: Object.freeze(['./collision.glb']),
  collisionMode: 'separate',
  collisionNodes: Object.freeze(['COLLISION_ROAD', 'COLLISION_TRACK_LIMIT_LEFT', 'COLLISION_TRACK_LIMIT_RIGHT']),
});
const LOCKS = Object.freeze({
  manifest: Object.freeze({ bytes: 3536, sha256: 'F3F8AF64B3553C9863E1B37C93760EB23D43C5CEF1EC85532AC8EC8CAAFC0F29' }),
  route: Object.freeze({ bytes: 1808485, sha256: 'B4776AAF39C2DD146F91ADCF666FF353F1662629947E44C623EE05A7ABB03894' }),
  visual: Object.freeze({ './scene.glb': Object.freeze({ bytes: 13892196, sha256: 'BC62529005836556D5CE2A321CAFC9B9AF4AC4791A0CA7C426D39F1CC8CB339A' }) }),
  collision: Object.freeze({ './collision.glb': Object.freeze({ bytes: 450760, sha256: 'AEC06938556EFE17877306DA1E02F2EF1F38553928BCD24D471B3DF4EA11E0A2' }) }),
});
const PHYSICAL_COLLISION = Object.freeze(['COLLISION_ROAD', 'COLLISION_TRACK_LIMIT_LEFT', 'COLLISION_TRACK_LIMIT_RIGHT']);
const SENSOR_NODES = Object.freeze([
  'COLLISION_WATER_EXCLUSION',
  'COLLISION_WETLAND_EXCLUSION',
  ...Array.from({ length: 10 }, (_, index) => 'COLLISION_CHECKPOINT_' + String(index).padStart(2, '0')),
]);
const REQUIRED_VISUAL = Object.freeze([
  'START', 'FINISH',
  ...Array.from({ length: 10 }, (_, index) => 'CHECKPOINT_' + String(index).padStart(2, '0')),
  ...Array.from({ length: 10 }, (_, index) => 'SPAWN_' + String(index).padStart(2, '0')),
  'ROAD_RENDER', 'ROAD_SHOULDERS', 'ROAD_MARKINGS', 'ROAD_DRAINAGE', 'ROAD_GUARDRAILS',
  'TERRAIN_HERO', 'TERRAIN_TRANSITION', 'TERRAIN_VISTA', 'LAGO_ESCONDIDO',
  'FOREST_NEAR', 'FOREST_MID', 'FOREST_VISTA', 'PEATLAND_PATCHES', 'SNOW_PATCHES',
]);
const PROFILE = Object.freeze({
  id: 'paso_garibaldi',
  name: 'RN3 Paso Garibaldi — Lago Escondido',
  description: 'Corredor fueguino de montaña, bosque húmedo, nieve y asfalto frío.',
  biome: 'tierra_del_fuego_mountain',
  environment: 'overcast',
  palette: Object.freeze({ forest: '#354238', peat: '#5D5944', asphalt: '#30383B', snow: '#DCE3E4', lake: '#526C78' }),
  shoulder: 1.8,
  barrier: 3.2,
  recommendedFarPlaneM: 32000,
  surface: Object.freeze({ road: 'cold_variable_asphalt', shoulder: 'wet_gravel', barrier: 'galvanized_guardrail' }),
});

function named(root, name) {
  let found = null;
  root?.traverse?.(node => { if (!found && node?.name === name) found = node; });
  return found;
}

function positionOf(node) {
  if (Array.isArray(node?.position) && node.position.length === 3) return node.position;
  if (node?.position && [node.position.x, node.position.y, node.position.z].every(Number.isFinite)) {
    return [node.position.x, node.position.y, node.position.z];
  }
  if (Array.isArray(node?.translation) && node.translation.length === 3) return node.translation;
  if (node?.matrixWorld?.elements?.length === 16) return [node.matrixWorld.elements[12], node.matrixWorld.elements[13], node.matrixWorld.elements[14]];
  throw new TypeError('authored Garibaldi anchor has no finite position');
}

function validateAnchors(base) {
  for (let index = 0; index < 10; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const checkpoint = named(base.visualRoot, 'CHECKPOINT_' + suffix);
    const spawn = named(base.visualRoot, 'SPAWN_' + suffix);
    if (!checkpoint || !spawn) throw new TypeError('Garibaldi authored anchor is missing: ' + suffix);
    const station = base.getCheckpoints()[index]?.sM;
    const respawn = base.respawns[index];
    if (!Number.isFinite(station) || !respawn) throw new TypeError('Garibaldi authored anchor metadata is invalid: ' + suffix);
    const routeCheckpoint = base.sampleRoute(station);
    const routeSpawn = base.sampleRoute(respawn.sM);
    const checkpointPosition = positionOf(checkpoint);
    const spawnPosition = positionOf(spawn);
    if (Math.hypot(...checkpointPosition.map((value, axis) => value - routeCheckpoint.position[axis])) > 2
        || Math.hypot(...spawnPosition.map((value, axis) => value - routeSpawn.position[axis])) > 2) {
      throw new TypeError('Garibaldi authored anchor does not match route: ' + suffix);
    }
  }
}

function spawnRecord(base, sample, position, grid) {
  return Object.freeze({
    position: Object.freeze([...position]),
    frame: Object.freeze({
      tangent: Object.freeze([...sample.frame.tangent]),
      left: Object.freeze([...sample.frame.left]),
      normal: Object.freeze([...sample.frame.normal]),
    }),
    progress: Object.freeze({ sM: sample.sM, u: sample.sM / base.gameplay.length, sectorId: sample.sectorId }),
    grid: Object.freeze({ ...grid }),
  });
}

function policy() {
  return Object.freeze({
    manifest: MANIFEST,
    locks: LOCKS,
    profile: PROFILE,
    requiredVisualNodes: REQUIRED_VISUAL,
    materialRoles: Object.freeze({ asphalt: Object.freeze(['MAT_ASPHALT']), shoulder: Object.freeze(['MAT_SHOULDER', 'MAT_PEAT']), terrain: Object.freeze(['MAT_TERRAIN_HERO', 'MAT_TERRAIN_TRANSITION', 'MAT_TERRAIN_VISTA', 'MAT_ROCK', 'MAT_ROCK.001']), water: Object.freeze(['MAT_WATER', 'MAT_WATER.001']), snow: Object.freeze(['MAT_SNOW']) }),
    requiredSourceCollisionNodes: Object.freeze([...PHYSICAL_COLLISION, ...SENSOR_NODES]),
    requiredCollisionNodes: PHYSICAL_COLLISION,
    visualFilter: () => true,
    collisionFilter: name => PHYSICAL_COLLISION.includes(name),
    updateStreaming(_root, context) {
      const sM = Number(context?.sM ?? context?.distanceM ?? 0);
      if (!Number.isFinite(sM)) throw new TypeError('Garibaldi streaming station must be finite');
      return Object.freeze({ mode: 'static-authored', sM, sectors: 9 });
    },
    applyEnvironment(root, id) {
      root.userData = root.userData || {};
      root.userData.asfaltoEnvironment = id;
      root.traverse?.(node => {
        node.userData = node.userData || {};
        node.userData.asfaltoEnvironment = id;
      });
      return Object.freeze({ id });
    },
  });
}

function wrapGaribaldi(base) {
  const validatedRoots = new WeakSet();
  const ensureAnchors = () => {
    const root = base.visualRoot;
    if (!root) throw new Error('Garibaldi adapter is not ready');
    if (!validatedRoots.has(root)) { validateAnchors(base); validatedRoots.add(root); }
  };
  const wrapper = {};
  for (const key of Reflect.ownKeys(base)) {
    if (key === 'getSpawn' || key === 'getDiagnostics') continue;
    Object.defineProperty(wrapper, key, Object.getOwnPropertyDescriptor(base, key));
  }
  Object.defineProperty(wrapper, 'getSpawn', { enumerable: true, value(kind, index = 0) {
    ensureAnchors();
    if (kind === 'chevy') {
      const sample = base.sampleRoute(8);
      return spawnRecord(base, sample, sample.position, { rearwardM: 0, lateralM: 0 });
    }
    if (kind === 'falcon') {
      const sample = base.sampleRoute(0);
      const lateralM = Math.min(1.15, sample.widthM * 0.2);
      const position = sample.position.map((value, axis) => value + sample.frame.left[axis] * lateralM);
      return spawnRecord(base, sample, position, { rearwardM: 8, lateralM });
    }
    return base.getSpawn(kind, index);
  } });
  Object.defineProperty(wrapper, 'getDiagnostics', { enumerable: true, value() {
    return Object.freeze({ ...base.getDiagnostics(), sensorCount: SENSOR_NODES.length, physicalColliderNodes: PHYSICAL_COLLISION.length });
  } });
  return Object.freeze(wrapper);
}

export function createPasoGaribaldiAdapter(dependencies) {
  return wrapGaribaldi(createGlbPointToPointAdapter(dependencies, policy()));
}
