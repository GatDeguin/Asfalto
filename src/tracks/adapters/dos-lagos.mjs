import { createGameplayBridge as createCanonicalGameplayBridge } from '../gameplay-bridge.mjs?v=75c4371c18fdd85b';
import { prepareOptionalClosedRoute, attachClosedRouteRoots, respawnRouteDistance } from './closed-route-support.mjs?v=e12c62b76f1ec198';
import { createRouteQuery } from '../route-query.mjs?v=dee7340624ec958a';
import { RESPAWN_CLEARANCE_M, validateTrackManifest } from '../track-contract.mjs?v=7d88fa8e85b8ea4d';
import { collectMaterialBindings } from '../../environment/material-bindings.mjs?v=458bef43475f6397';
import { prepareTrackVisual, prepareReturnScenery } from '../visuals/reference-landscape.mjs?v=457a8af4bf40a703';

const ENVIRONMENTS = Object.freeze(['clear','overcast','golden','sunset','moonrise','night']);
const LOCKS = Object.freeze({
  route: Object.freeze({ bytes: 533187, sha256: '27ace7aae436122021c7d43caaffa1ad28fab841fde8d680c605dabf5e91699b' }),
  visual: Object.freeze({ bytes: 24238072, sha256: '69e76b196f6735b02b7464fcab3f9b1ea1248a974d09677b818b77cda5f475f4' }),
  collision: Object.freeze({ bytes: 522300, sha256: '591e79a9a299a1eb21bc05ec37985ceca924de3f79d0dbc6b19fe651c84cc2f1' }),
});
const PROVENANCE = Object.freeze({
  source: 'Circuitos/Dos_Lagos.zip',
  visualEntry: 'DosLagos_BlenderPass_v3/dos_lagos_scene_hyperreal_blender_pass_v3.glb',
  collisionEntry: 'DosLagos_BlenderPass_v3/dos_lagos_collision.glb',
  axis: 'Y_UP',
  units: 'meters',
  collisionSeparate: true,
  assetsRecompressed: false,
});
const GLB_STATS = Object.freeze({
  visual: Object.freeze({ nodes: 64, meshes: 63, materials: 26, textures: 55 }),
  collision: Object.freeze({ nodes: 4, meshes: 3, materials: 1, textures: 0 }),
});
const LOD_NODES = Object.freeze({
  ROCK_Outcrops_v3: Object.freeze({ minDistanceM: 0, maxDistanceM: 650 }),
  ROCK_Talus_v3: Object.freeze({ minDistanceM: 0, maxDistanceM: 260 }),
  VEG_HeroTrunks_v3: Object.freeze({ minDistanceM: 0, maxDistanceM: 520 }),
  VEG_HeroCanopies_v3: Object.freeze({ minDistanceM: 0, maxDistanceM: 420 }),
  DETAIL_ShoreFoam_v3: Object.freeze({ minDistanceM: 0, maxDistanceM: 240 }),
  DETAIL_Driftwood_v3: Object.freeze({ minDistanceM: 0, maxDistanceM: 180 }),
});
const LOD_GROUPS = Object.freeze({
  geology: Object.freeze(['ROCK_Outcrops_v3','ROCK_Talus_v3']),
  heroVegetation: Object.freeze(['VEG_HeroTrunks_v3','VEG_HeroCanopies_v3']),
  shoreDetail: Object.freeze(['DETAIL_ShoreFoam_v3','DETAIL_Driftwood_v3']),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneFrozen(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozen));
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, child] of Object.entries(value)) result[key] = cloneFrozen(child);
    return Object.freeze(result);
  }
  return value;
}

function requireFunction(dependencies, name) {
  if (typeof dependencies?.[name] !== 'function') throw new TypeError(name + ' must be a function');
}

function bytesOf(value, label) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError(label + ' fetch must return bytes');
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 Web Crypto is unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function abortError() {
  const error = new Error('Dos Lagos load aborted');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function throwIfAborted(signal, token, currentToken) {
  if (signal?.aborted || token !== currentToken()) {
    const reason = signal?.reason;
    if (reason && typeof reason === 'object' && reason.name === 'AbortError') throw reason;
    throw abortError();
  }
}

function finiteVector(value) {
  if (Array.isArray(value)) return value.length === 3 && value.every(Number.isFinite) ? value : null;
  if (value && typeof value === 'object') {
    const vector = [value.x, value.y, value.z];
    return vector.every(Number.isFinite) ? vector : null;
  }
  return null;
}

const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function normalize(vector, fallback) {
  const length = Math.hypot(...vector);
  return Number.isFinite(length) && length > 1e-10 ? vector.map((value) => value / length) : [...fallback];
}

function authoredFrame(sample, index) {
  const rawTangent = finiteVector(sample?.tangent);
  const rawLeft = finiteVector(sample?.left);
  if (!rawTangent || !rawLeft) throw new TypeError('Dos Lagos route sample ' + index + ' has an invalid authored frame');
  const tangent = normalize(rawTangent, [1,0,0]);
  const projection = dot(rawLeft, tangent);
  let left = normalize(rawLeft.map((value, axis) => value - tangent[axis] * projection), [0,0,1]);
  let normal = normalize(cross(left, tangent), [0,1,0]);
  if (normal[1] < 0) {
    left = left.map((value) => -value);
    normal = normal.map((value) => -value);
  }
  return { tangent, left, normal };
}

function normalizeRoute(source) {
  if (!source || source.schema !== 'dos-lagos-route@1' || source.coordinateSystem !== 'Y_UP_METERS'
      || source.routeLengthM !== 10250 || source.sampleStepM !== 5
      || !Array.isArray(source.samples) || source.samples.length !== 2051
      || !Array.isArray(source.sectors) || source.sectors.length !== 6) {
    throw new TypeError('invalid locked Dos Lagos route contract');
  }
  const sectors = source.sectors.map((sector, index) => {
    const startM = Number(sector.km_start) * 1000;
    const endM = Number(sector.km_end) * 1000;
    if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
      throw new TypeError('invalid Dos Lagos sector bounds at ' + index);
    }
    return { id: String(sector.id).toLowerCase(), name: String(sector.name), startM, endM };
  });
  const sectorAt = (sM) => {
    const index = sectors.findIndex((sector, sectorIndex) => sM >= sector.startM
      && (sectorIndex === sectors.length - 1 ? sM <= sector.endM : sM < sector.endM));
    if (index < 0) throw new TypeError('Dos Lagos sample outside sector coverage at ' + sM);
    return sectors[index].id;
  };
  const samples = source.samples.map((sample, index) => {
    const sM = Number(sample.s);
    const position = finiteVector(sample.position);
    if (sM !== index * 5 || !position || !Number.isFinite(sample.width) || sample.width <= 0) {
      throw new TypeError('invalid Dos Lagos route sample at ' + index);
    }
    const frame = authoredFrame(sample, index);
    return {
      sM,
      position: [...position],
      tangent: frame.tangent,
      left: frame.left,
      normal: frame.normal,
      widthM: Number(sample.width),
      curvaturePerM: Number(sample.curvature)||0,
      bank: Number(sample.bankRad)||0,
      targetSpeedKmh: Number(sample.targetSpeedKph)||110,
      surfaceId: 'asphalt',
      sectorId: sectorAt(sM),
    };
  });
  const widthAt = (sM) => {
    const index = Math.max(0, Math.min(samples.length - 1, Math.round(sM / 5)));
    return samples[index].widthM;
  };
  const checkpoints = sectors.map((sector, index) => ({
    index,
    sM: sector.endM,
    halfWidthM: widthAt(sector.endM) * 0.5,
  }));
  const respawns = sectors.map((sector) => ({ sM: sector.startM, lateralM: 0 }));
  return deepFreeze({
    schema: 'asfalto-route/v1',
    coordinateSystem: 'Y_UP_METERS',
    lengthM: 10250,
    sampleStepM: 5,
    samples,
    sectors,
    checkpoints,
    respawns,
  });
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new TypeError(label + ' is not valid UTF-8 JSON: ' + error.message);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function sameJson(actual, expected) {
  return JSON.stringify(canonicalJson(actual)) === JSON.stringify(canonicalJson(expected));
}

function releaseUrl(value, base, root, label) {
  const raw = String(value);
  if (raw.includes('%')) throw new TypeError(label + ' must not contain encoded path characters');
  if (raw.includes('\\') || raw.includes('\0')) throw new TypeError(label + ' decoded path is not canonical');
  const rawPath = raw.split(/[?#]/, 1)[0];
  const relative = !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rawPath) && !rawPath.startsWith('/');
  const containedRawPath = rawPath.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]+/, '');
  if (containedRawPath.includes('//')) throw new TypeError(label + ' path must not contain repeated separators');
  const rawSegments = containedRawPath.split('/');
  if (rawSegments.some((part, index) => part === '..' || (part === '.' && !(relative && index === 0)))) throw new TypeError(label + ' decoded path is not canonical');
  let url;
  try { url = new URL(value, base); } catch { throw new TypeError(label + ' must be a canonical release URL'); }
  if (url.username || url.password || url.search || url.hash) throw new TypeError(label + ' must not contain credentials, query, or fragment');
  if (url.origin !== root.origin) throw new TypeError(label + ' must stay on release origin');
  if (/%/i.test(url.pathname)) throw new TypeError(label + ' must not contain encoded path characters');
  let decoded = url.pathname;
  for (let index = 0; index < 4; index += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some((part) => part === '.' || part === '..')) {
    throw new TypeError(label + ' decoded path is not canonical');
  }
  const rootPath = root.pathname.endsWith('/') ? root.pathname : root.pathname + '/';
  if (!decoded.startsWith(rootPath)) throw new TypeError(label + ' must be contained beneath release root');
  return url;
}

function validateLockedManifest(raw) {
  const result = validateTrackManifest(raw);
  if (!result.ok) throw new TypeError('invalid Dos Lagos manifest: ' + result.errors.join('; '));
  const manifest = result.manifest;
  const exact = [
    ['id', manifest.id, 'dos_lagos'],
    ['lengthM', manifest.lengthM, 10250],
    ['format', manifest.format, 'point_to_point'],
    ['defaultEnvironment', manifest.defaultEnvironment, 'clear'],
    ['route', manifest.route, './route.json'],
  ];
  for (const [field, actual, expected] of exact) {
    if (actual !== expected) throw new TypeError('locked manifest ' + field + ' must equal ' + expected);
  }
  if (!sameJson(manifest.visual, ['./scene.glb'])) throw new TypeError('locked manifest visual URL drift');
  if (!sameJson(manifest.collision, ['./collision.glb'])) throw new TypeError('locked manifest collision URL drift');
  const expectedIntegrity = {
    route: { ...LOCKS.route },
    visual: { './scene.glb': { ...LOCKS.visual } },
    collision: { './collision.glb': { ...LOCKS.collision } },
  };
  const expectedGlb = { visual: { ...GLB_STATS.visual }, collision: { ...GLB_STATS.collision } };
  const expectedLod = { groups: LOD_GROUPS, nodes: LOD_NODES };
  if (!sameJson(raw.integrity, expectedIntegrity)) throw new TypeError('locked manifest integrity metadata drift');
  if (!sameJson(raw.glb, expectedGlb)) throw new TypeError('locked manifest GLB statistics drift');
  if (!sameJson(raw.lod, expectedLod)) throw new TypeError('locked manifest LOD metadata drift');
  if (!sameJson(raw.provenance, PROVENANCE)) throw new TypeError('locked manifest provenance metadata drift');
  return manifest;
}

function inspectGlb(bytes, label, expected, requiredNames = []) {
  if (bytes.byteLength < 20) throw new TypeError(label + ' GLB is truncated');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new TypeError(label + ' GLB magic must equal glTF');
  if (view.getUint32(4, true) !== 2) throw new TypeError(label + ' GLB version must equal 2');
  if (view.getUint32(8, true) !== bytes.byteLength) throw new TypeError(label + ' GLB declared length mismatch');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > bytes.byteLength) {
    throw new TypeError(label + ' GLB JSON chunk is invalid');
  }
  const json = parseJson(bytes.subarray(20, 20 + jsonLength), label + ' GLB JSON chunk');
  const counts = {
    nodes: (json.nodes || []).length,
    meshes: (json.meshes || []).length,
    materials: (json.materials || []).length,
    textures: (json.textures || []).length,
  };
  if (!sameJson(counts, expected)) throw new TypeError(label + ' GLB structural statistics drift');
  const names = new Set((json.nodes || []).map((node) => node.name));
  for (const name of requiredNames) if (!names.has(name)) throw new TypeError(label + ' GLB missing stable node ' + name);
  return json;
}

function interpolateAuthored(source, distance) {
  if (!Number.isFinite(distance)) throw new TypeError('distance must be finite');
  const s = Math.max(0, Math.min(10250, distance));
  const lower = Math.min(source.length - 1, Math.floor(s / 5));
  const upper = Math.min(source.length - 1, lower + 1);
  const a = source[lower];
  const b = source[upper];
  const amount = upper === lower ? 0 : (s - a.s) / Math.max(1e-9, b.s - a.s);
  const lerp = (from, to) => from + (to - from) * amount;
  return {
    s,
    curvature: lerp(Number(a.curvature) || 0, Number(b.curvature) || 0),
    width: lerp(Number(a.width) || 7, Number(b.width) || 7),
    bank: lerp(Number(a.bankRad) || 0, Number(b.bankRad) || 0),
    targetSpeedKph: lerp(Number(a.targetSpeedKph) || 110, Number(b.targetSpeedKph) || 110),
  };
}

function createGameplayBridge(routeQuery, route) {
  const source = route.samples;
  const length = route.routeLengthM;
  const step = route.sampleStepM;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const requireFinite = (value, label) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(label + ' must be finite');
    return value;
  };
  const requireNonNegative = (value, label) => {
    requireFinite(value, label);
    if (value < 0) throw new TypeError(label + ' must be nonnegative');
    return value;
  };
  let maxCurvature = 0;
  for (const point of source) maxCurvature = Math.max(maxCurvature, Math.abs(Number(point.curvature) || 0));

  function sample(distance) {
    requireFinite(distance, 'distance');
    const s = clamp(distance, 0, length);
    const lower = Math.min(source.length - 1, Math.floor(s / step));
    const upper = Math.min(source.length - 1, lower + 1);
    const a = source[lower], b = source[upper];
    const span = Math.max(1e-9, b.s - a.s);
    const amount = upper === lower ? 0 : clamp((s - a.s) / span, 0, 1);
    let tx = lerp(a.tangent[0], b.tangent[0], amount);
    let ty = lerp(a.tangent[1], b.tangent[1], amount);
    let tz = lerp(a.tangent[2], b.tangent[2], amount);
    const tangentLength = Math.hypot(tx, ty, tz) || 1;
    tx /= tangentLength; ty /= tangentLength; tz /= tangentLength;
    const heading = Math.atan2(tx, -tz);
    return deepFreeze({
      s, u:s/length, sectorId:amount<0.5?a.sectorId:b.sectorId,
      x:lerp(a.position[0],b.position[0],amount), y:lerp(a.position[1],b.position[1],amount), z:lerp(a.position[2],b.position[2],amount),
      tx,ty,tz,rx:Math.cos(heading),rz:Math.sin(heading),heading,
      curvature:lerp(Number(a.curvature)||0,Number(b.curvature)||0,amount),
      width:lerp(Number(a.width)||7,Number(b.width)||7,amount),
      bank:lerp(Number(a.bankRad)||0,Number(b.bankRad)||0,amount),
      targetSpeedKph:lerp(Number(a.targetSpeedKph)||110,Number(b.targetSpeedKph)||110,amount),
    });
  }
  const shoulder = 0.9, barrier = 2.8;
  const widthAt = (distance) => sample(distance).width;
  const bankAt = (distance) => sample(distance).bank;
  function idealLineOffset(distance) {
    requireFinite(distance, 'distance');
    const here=sample(distance), ahead=sample(distance+35);
    const turn=clamp(here.curvature*130+ahead.curvature*75,-1,1);
    const offset=-turn*here.width*0.16;
    return offset === 0 ? 0 : offset;
  }
  function surfaceAt(distance,lateral,vehicleHalfWidth=0) {
    requireFinite(distance,'distance');requireFinite(lateral,'lateral');requireNonNegative(vehicleHalfWidth,'vehicleHalfWidth');
    const edge=widthAt(distance)*0.5-Math.max(0,vehicleHalfWidth), absolute=Math.abs(lateral), side=lateral<0?-1:1;
    if(absolute<=edge)return deepFreeze({kind:'asphalt',grip:1,drag:0.006,roughness:0.02,side});
    if(absolute<=edge+0.36)return deepFreeze({kind:'curb',grip:0.86,drag:0.04,roughness:0.62,side});
    if(absolute<=edge+shoulder)return deepFreeze({kind:'shoulder',grip:0.72,drag:0.15,roughness:0.35,side});
    if(absolute>=edge+barrier)return deepFreeze({kind:'barrier',grip:0.25,drag:1.8,roughness:1,side});
    return deepFreeze({kind:'grass',grip:0.48,drag:0.58,roughness:0.72,side});
  }
  function resolveBarrierCollision(distance,lateral,lateralSpeedMps=0,vehicleHalfWidth=0.91) {
    requireFinite(distance,'distance');requireFinite(lateral,'lateral');requireFinite(lateralSpeedMps,'lateralSpeedMps');requireNonNegative(vehicleHalfWidth,'vehicleHalfWidth');
    const allowed=sample(distance).width*0.5+barrier-Math.max(0,vehicleHalfWidth);
    if(Math.abs(lateral)<=allowed)return deepFreeze({collided:false,lateral,lateralSpeedMps});
    const side=lateral<0?-1:1,inwardSpeed=lateralSpeedMps*side;
    return deepFreeze({collided:true,lateral:side*allowed,lateralSpeedMps:inwardSpeed>0?-lateralSpeedMps*0.08:lateralSpeedMps});
  }
  const checkpoints=Object.freeze(route.sectors.map((sector)=>Math.round(Number(sector.km_end)*1000)));
  const brakingMarkers=Object.freeze((route.corners||[]).map((corner)=>deepFreeze({
    s:clamp(Number(corner.apex_km)*1000-150,0,length),targetS:clamp(Number(corner.apex_km)*1000,0,length),distance:150,
    direction:String(corner.direction||'').includes('Izquierda')?-1:1,severity:clamp(90/Math.max(30,Number(corner.radius_m)||90),0.18,1),
  })));
  return Object.freeze({
    id:'dos_lagos',name:'Dos Lagos',description:'Ruta patagónica punto a punto entre Villarino y Falkner.',biome:'patagonia',environment:'forest',seed:501,
    palette:deepFreeze({skyTop:'#527f9d',skyHorizon:'#cadce3',ground:'#526448',dirt:'#806c55',grassBottom:'#344e2f',grassTop:'#69805b',treeBottom:'#173326',treeTop:'#45694a',curbA:'#e9e7df',curbB:'#c43d32',fog:'#b9cbd0',waterDeep:'#173f55',waterMid:'#427b91',waterHighlight:'#b9e0e5'}),
    shoulder,barrier,closed:false,length,maxCurvature,checkpoints,speedTrap:deepFreeze({start:7550,end:8250}),brakingMarkers,
    sample,widthAt,bankAt,idealLineOffset,surfaceAt,resolveBarrierCollision,
    forwardDistance(from,to){requireFinite(from,'from');requireFinite(to,'to');return clamp(to,0,length)-clamp(from,0,length)},
    shortestDistance(from,to){requireFinite(from,'from');requireFinite(to,'to');return clamp(to,0,length)-clamp(from,0,length)},
    routeQuery,
  });
}
function findNamed(root, name) {
  if (typeof root?.getObjectByName === 'function') return root.getObjectByName(name);
  let match = null;
  root?.traverse?.((node) => { if (!match && node?.name === name) match = node; });
  return match;
}

function resourceInventory(roots, owns) {
  const geometry = new Set();
  const material = new Set();
  const texture = new Set();
  const addMaterial = (value) => {
    if (!value || typeof value !== 'object') return;
    material.add(value);
    for (const child of Object.values(value)) {
      if (child?.isTexture === true) texture.add(child);
      else if (Array.isArray(child)) for (const item of child) if (item?.isTexture === true) texture.add(item);
    }
  };
  for (const root of roots) root?.traverse?.((node) => {
    if (!node?.isMesh) return;
    if (node.geometry && typeof node.geometry === 'object') geometry.add(node.geometry);
    if (Array.isArray(node.material)) for (const value of node.material) addMaterial(value);
    else addMaterial(node.material);
  });
  const filter = (set, kind) => new Set([...set].filter((resource) => owns(resource, kind)));
  return { geometry: filter(geometry,'geometry'), material: filter(material,'material'), texture: filter(texture,'texture') };
}

function publicSpawn(sample, position, grid, lengthM=10250) {
  return deepFreeze({
    position: [...position],
    frame: {
      tangent: [...sample.frame.tangent],
      left: [...sample.frame.left],
      normal: [...sample.frame.normal],
    },
    progress: { sM: sample.sM, u: sample.sM / lengthM, sectorId: sample.sectorId },
    grid: { ...grid },
  });
}

function respawnRecord(routeQuery, raceProgressM, lengthM, closed=false) {
  if (!Number.isFinite(raceProgressM)) throw new TypeError('raceProgressM must be finite');
  const progress=respawnRouteDistance({lengthM,closed},raceProgressM);
  const record = routeQuery.respawnFor(progress.sM);
  return deepFreeze({
    sM: record.sM,
    raceProgressM: progress.lapPrefixM+record.sM,
    position: [...record.position],
    frame: {
      tangent: [...record.frame.tangent],
      left: [...record.frame.left],
      normal: [...record.frame.normal],
    },
    lateralM: record.lateralM,
    clearanceM: RESPAWN_CLEARANCE_M,
    sectorId: record.sectorId,
  });
}

export function createDosLagosAdapter(dependencies) {
  requireFunction(dependencies, 'fetchBytes');
  requireFunction(dependencies, 'completeGlbToObject');
  requireFunction(dependencies, 'createCollisionProbe');
  requireFunction(dependencies, 'createPhysicsBridge');
  requireFunction(dependencies, 'detachPhysicsBridge');
  requireFunction(dependencies, 'installVisualRoot');
  requireFunction(dependencies, 'detachVisualRoot');
  requireFunction(dependencies, 'installCollisionRoot');
  requireFunction(dependencies, 'detachCollisionRoot');
  requireFunction(dependencies, 'applyVisualEnvironment');
  if (typeof dependencies.releaseRootUrl !== 'string' || !dependencies.releaseRootUrl) {
    throw new TypeError('releaseRootUrl is required');
  }
  const rawReleaseRoot = dependencies.releaseRootUrl;
  if (rawReleaseRoot.includes('%')) throw new TypeError('releaseRootUrl must not contain percent escapes');
  if (rawReleaseRoot.includes('\\')) throw new TypeError('releaseRootUrl must not contain a backslash');
  if (rawReleaseRoot.includes('\0')) throw new TypeError('releaseRootUrl must not contain NUL');
  if (rawReleaseRoot.includes('?') || rawReleaseRoot.includes('#')) throw new TypeError('releaseRootUrl must not contain query or fragment');
  const releaseMatch = /^(https?):\/\/([^/?#]+)(\/[^?#]*)$/i.exec(rawReleaseRoot);
  if (!releaseMatch) throw new TypeError('releaseRootUrl must be an absolute canonical http(s) URL with a path');
  const rawReleasePath = releaseMatch[3];
  if (!rawReleasePath.endsWith('/')) throw new TypeError('releaseRootUrl must have a trailing slash');
  if (rawReleasePath.includes('//')) throw new TypeError('releaseRootUrl path must not contain repeated separators');
  if (rawReleasePath.split('/').some(part => part === '.' || part === '..')) throw new TypeError('releaseRootUrl path must not contain dot segments');
  const releaseRoot = new URL(rawReleaseRoot);
  if (!/^https?:$/.test(releaseRoot.protocol) || releaseRoot.search || releaseRoot.hash || releaseRoot.username || releaseRoot.password) {
    throw new TypeError('releaseRootUrl must be a canonical http(s) URL without credentials');
  }
  const registryBase = dependencies.registryUrl
    ? releaseUrl(dependencies.registryUrl, releaseRoot, releaseRoot, 'registry URL')
    : releaseRoot;
  const owns = typeof dependencies.isResourceOwned === 'function' ? dependencies.isResourceOwned : () => true;

  let ready = false;
  let state = 'idle';
  let epoch = 0;
  let activeLoad = null;
  let unloadPromise = null;
  let currentTransaction = null;
  let activeCancellableHook = null;

  let routeQuery = null;
  let gameplay = null;
  let normalizedRoute = null;
  let sourceRoute = null;
  let visualRoot = null;
  let collisionRoot = null;
  let collisionProbe = null;
  let physicsBridge = null;
  let lodObjects = new Map();
  let environment = 'clear';

  const emptyCounts = () => ({ geometry: 0, material: 0, texture: 0 });
  const emptyLoadedBytes = () => ({ manifest: 0, route: 0, visual: 0, collision: 0, total: 0 });
  let lastStats = {
    resourceCounts: emptyCounts(),
    disposalCounts: { ...emptyCounts(), physics: 0 },
    installCounts: { visual: 0, collision: 0, physics: 0 },
    loadedBytes: emptyLoadedBytes(),
  };
  const cumulative = {
    created: { visualRoots: 0, collisionRoots: 0, collisionProbes: 0, physicsBridges: 0, geometry: 0, material: 0, texture: 0 },
    disposed: { visualRoots: 0, collisionRoots: 0, collisionProbes: 0, physicsBridges: 0, geometry: 0, material: 0, texture: 0 },
  };

  function createTransaction(token, controller) {
    return {
      token,
      controller,
      cleanupController: new AbortController(),
      cleanupPromise: null,
      cleanupReported: false,
      cleanupErrors: [],
      awaitingHook: null,
      counted: { geometry: new Set(), material: new Set(), texture: new Set() },
      resources: { geometry: new Set(), material: new Set(), texture: new Set() },
      resourceCounts: emptyCounts(),
      disposalCounts: { ...emptyCounts(), physics: 0 },
      installCounts: { visual: 0, collision: 0, physics: 0 },
      loadedBytes: emptyLoadedBytes(),
      sourceRoute: null,
      normalizedRoute: null,
      routeQuery: null,
      gameplay: null,
      visualRoot: null,
      collisionRoot: null,
      collisionProbe: null,
      physicsBridge: null,
      physicsBridgeSource: null,
      physicsSourceCounted: false,
      disposePhysics: null,
      physicsDisposePromise: null,
      physicsDisposalCounted: false,
      lodObjects: new Map(),
      visualParsed: false,
      collisionParsed: false,
      probeAttempted: false,
      probeCreated: false,
      physicsAttempted: false,
      visualInstallAttempted: false,
      visualInstalled: false,
      collisionInstallAttempted: false,
      collisionInstalled: false,
    };
  }

  function rememberStats(transaction) {
    if (!transaction) return;
    lastStats = {
      resourceCounts: { ...transaction.resourceCounts },
      disposalCounts: { ...transaction.disposalCounts },
      installCounts: { ...transaction.installCounts },
      loadedBytes: { ...transaction.loadedBytes },
    };
  }

  function clearPublicReferences(transaction) {
    if (currentTransaction !== transaction) return;
    ready = false;
    routeQuery = null;
    gameplay = null;
    normalizedRoute = null;
    sourceRoute = null;
    visualRoot = null;
    collisionRoot = null;
    collisionProbe = null;
    physicsBridge = null;
    lodObjects = new Map();
    currentTransaction = null;
  }

  function updateInventory(transaction, roots) {
    const next = resourceInventory(roots, owns);
    for (const kind of ['geometry', 'material', 'texture']) {
      for (const resource of next[kind]) {
        if (!transaction.counted[kind].has(resource)) {
          transaction.counted[kind].add(resource);
          cumulative.created[kind] += 1;
        }
      }
    }
    transaction.resources = next;
    transaction.resourceCounts = {
      geometry: next.geometry.size,
      material: next.material.size,
      texture: next.texture.size,
    };
    rememberStats(transaction);
  }

  function recordCleanupError(errors, stage, error) {
    errors.push(Object.assign(new Error(stage + ': ' + (error?.message || error)), { cause: error, stage }));
  }
  function observedRejection(error) {
    const promise = Promise.reject(error);
    promise.catch(() => {});
    return promise;
  }

  function countPhysicsDisposal(transaction) {
    if (transaction.physicsDisposalCounted) return;
    transaction.physicsDisposalCounted = true;
    transaction.disposalCounts.physics += 1;
    cumulative.disposed.physicsBridges += 1;
  }

  function isThenable(value) {
    return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
  }

  function cancellableContractError(stage) {
    return new TypeError(stage + ' mutating hook must return a synchronous value or cancellable handle { promise, cancel }; bare Promise returns are invalid');
  }

  function cancelCancellableRecord(record, reason) {
    if (!record || record.settled || record.cancelled) return;
    record.cancelled = true;
    try {
      record.cancel(reason);
    } catch (error) {
      recordCleanupError(record.transaction.cleanupErrors, record.stage + ' cancel', error);
    }
  }

  function cancelActiveCancellableHook(reason, transaction = null) {
    const record = activeCancellableHook;
    if (transaction && record?.transaction !== transaction) return;
    cancelCancellableRecord(record, reason);
  }

  function abortTransaction(transaction, reason) {
    if (!transaction) return;
    transaction.controller.abort(reason);
    cancelActiveCancellableHook(reason || transaction.controller.signal.reason || abortError(), transaction);
  }

  async function callLifecycleHook(transaction, stage, callback, signal = transaction.controller.signal) {
    let result;
    try {
      result = callback();
    } catch (error) {
      throw error;
    }
    if (isThenable(result)) {
      Promise.resolve(result).catch(() => {});
      throw cancellableContractError(stage);
    }
    const looksLikeHandle = result && typeof result === 'object'
      && (Object.hasOwn(result, 'promise') || Object.hasOwn(result, 'cancel'));
    if (!looksLikeHandle) return result;
    if (!isThenable(result.promise) || typeof result.cancel !== 'function') throw cancellableContractError(stage);

    const promise = Promise.resolve(result.promise);
    promise.catch(() => {});
    const record = {
      transaction,
      stage,
      promise,
      cancel: result.cancel.bind(result),
      cancelled: false,
      settled: false,
    };
    transaction.awaitingHook = record;
    activeCancellableHook = record;
    if (signal.aborted) cancelCancellableRecord(record, signal.reason || abortError());
    const observer = promise.then(
      () => { record.settled = true; },
      () => { record.settled = true; },
    );
    observer.catch(() => {});
    try {
      return await promise;
    } catch (error) {
      if (record.cancelled && error?.name !== 'AbortError') {
        recordCleanupError(transaction.cleanupErrors, stage + ' settlement', error);
      }
      throw error;
    } finally {
      if (transaction.awaitingHook === record) transaction.awaitingHook = null;
      if (activeCancellableHook === record) activeCancellableHook = null;
    }
  }

  function createPhysicsDisposer(transaction, source) {
    const disposePhysics = () => {
      if (transaction.physicsDisposePromise) return transaction.physicsDisposePromise;
      const signal = transaction.controller.signal.aborted
        ? transaction.cleanupController.signal
        : transaction.controller.signal;
      const promise = callLifecycleHook(transaction, 'physics dispose', () => source.dispose({ signal }), signal)
        .then(() => { countPhysicsDisposal(transaction); });
      promise.catch(() => {});
      transaction.physicsDisposePromise = promise;
      return promise;
    };
    return disposePhysics;
  }
  function aggregateCleanupErrors(errors) {
    return new AggregateError(errors, 'Dos Lagos cleanup failed: ' + errors.map(error => error.message).join('; '));
  }

  function cleanupTransaction(transaction) {
    if (!transaction) return Promise.resolve([]);
    if (transaction.cleanupPromise) return transaction.cleanupPromise;
    transaction.cleanupPromise = (async () => {
      const errors = transaction.cleanupErrors;
      if (currentTransaction === transaction) ready = false;
      const signal = transaction.cleanupController.signal;
      try {
        if (transaction.physicsAttempted && !transaction.physicsDetached) {
          transaction.physicsDetached = true;
          try {
            await callLifecycleHook(transaction, 'physics detach', () => dependencies.detachPhysicsBridge(
              transaction.physicsBridgeSource || transaction.physicsBridge,
              { collisionRoot: transaction.collisionRoot, collisionProbe: transaction.collisionProbe, signal },
            ), signal);
          } catch (error) {
            recordCleanupError(errors, 'physics detach', error);
          }
        }
        if (transaction.disposePhysics) {
          try {
            await transaction.disposePhysics();
          } catch (error) {
            recordCleanupError(errors, 'physics dispose', error);
          }
        }
        if (transaction.collisionInstallAttempted && !transaction.collisionDetached) {
          transaction.collisionDetached = true;
          try {
            await callLifecycleHook(transaction, 'collision detach', () => dependencies.detachCollisionRoot(transaction.collisionRoot, { signal }), signal);
          } catch (error) {
            recordCleanupError(errors, 'collision detach', error);
          }
        }
        if (transaction.visualInstallAttempted && !transaction.visualDetached) {
          transaction.visualDetached = true;
          try {
            await callLifecycleHook(transaction, 'visual detach', () => dependencies.detachVisualRoot(transaction.visualRoot, { signal }), signal);
          } catch (error) {
            recordCleanupError(errors, 'visual detach', error);
          }
        }
        for (const kind of ['geometry', 'material', 'texture']) {
          for (const resource of [...transaction.resources[kind]]) {
            transaction.resources[kind].delete(resource);
            try {
              if (typeof resource.dispose === 'function') {
                await callLifecycleHook(transaction, kind + ' dispose', () => resource.dispose({ signal }), signal);
              }
              transaction.disposalCounts[kind] += 1;
              cumulative.disposed[kind] += 1;
            } catch (error) {
              recordCleanupError(errors, kind + ' dispose', error);
            }
          }
        }
      } finally {
        if (transaction.collisionParsed && !transaction.collisionReleased) {
          transaction.collisionReleased = true;
          cumulative.disposed.collisionRoots += 1;
        }
        if (transaction.visualParsed && !transaction.visualReleased) {
          transaction.visualReleased = true;
          cumulative.disposed.visualRoots += 1;
        }
        if (transaction.probeCreated && !transaction.probeReleased) {
          transaction.probeReleased = true;
          cumulative.disposed.collisionProbes += 1;
        }
        rememberStats(transaction);
        clearPublicReferences(transaction);
        transaction.visualRoot = null;
        transaction.collisionRoot = null;
        transaction.collisionProbe = null;
        transaction.physicsBridge = null;
        transaction.physicsBridgeSource = null;
        transaction.disposePhysics = null;
        transaction.physicsDisposePromise = null;
        transaction.routeQuery = null;
        transaction.gameplay = null;
        transaction.normalizedRoute = null;transaction.closure=null;
        transaction.sourceRoute = null;
        for (const kind of ['geometry', 'material', 'texture']) {
          transaction.counted[kind].clear();
          transaction.resources[kind].clear();
        }
        transaction.lodObjects = new Map();
      }
      return errors;
    })();
    transaction.cleanupPromise.catch(() => {});
    return transaction.cleanupPromise;
  }
  function attachCleanup(primary, errors) {
    if (!errors.length) return primary;
    const aggregate = aggregateCleanupErrors(errors);
    try {
      Object.defineProperty(primary, 'cleanupError', { value: aggregate });
      Object.defineProperty(primary, 'cleanupErrors', { value: Object.freeze([...errors]) });
      return primary;
    } catch {
      const wrapper = new Error(primary?.message || 'Dos Lagos load failed', { cause: primary });
      wrapper.name = primary?.name || 'Error';
      wrapper.cleanupError = aggregate;
      wrapper.cleanupErrors = Object.freeze([...errors]);
      return wrapper;
    }
  }

  function assertCurrent(transaction) {
    if (transaction !== currentTransaction || transaction.token !== epoch || transaction.controller.signal.aborted) {
      const reason = transaction.controller.signal.reason;
      if (reason && typeof reason === 'object' && reason.name === 'AbortError') throw reason;
      throw abortError();
    }
  }

  function assertCollisionProbe(value) {
    if (!value || typeof value !== 'object' || typeof value.then === 'function'
        || typeof value.sample !== 'function' || typeof value.getState !== 'function') {
      throw new TypeError('collision probe must be a resolved object with sample and getState functions');
    }
  }

  function createPhysicsBridgeDescriptor(value, expectedCollisionRoot, disposePhysics) {
    if (!value || typeof value !== 'object' || typeof value.then === 'function'
        || typeof value.browserStackFactory !== 'function' || typeof value.getCollisionRoot !== 'function'
        || typeof value.dispose !== 'function') {
      throw new TypeError('physics bridge must be a resolved object with browserStackFactory, getCollisionRoot, and dispose functions');
    }
    let reportedCollisionRoot;
    try {
      reportedCollisionRoot = value.getCollisionRoot();
    } catch (error) {
      throw new TypeError('physics bridge collision root lookup failed: ' + (error?.message || error), { cause: error });
    }
    if (reportedCollisionRoot !== expectedCollisionRoot) {
      throw new TypeError('physics bridge getCollisionRoot must return the live collision root');
    }
    return Object.freeze({
      browserStackFactory: value.browserStackFactory.bind(value),
      getCollisionRoot: () => expectedCollisionRoot,
      dispose: disposePhysics,
    });
  }

  async function validate() {
    return deepFreeze({ ok: true, errors: [] });
  }

  async function performLoad(request, transaction) {
    const callerSignal = request.signal || null;
    let removeCallerAbort = () => {};
    if (callerSignal) {
      const mirrorAbort = () => abortTransaction(transaction, callerSignal.reason);
      if (callerSignal.aborted) mirrorAbort();
      else {
        callerSignal.addEventListener('abort', mirrorAbort, { once: true });
        removeCallerAbort = () => callerSignal.removeEventListener('abort', mirrorAbort);
      }
    }
    const signal = transaction.controller.signal;
    try {
      assertCurrent(transaction);
      const requested = request.manifestUrl ?? dependencies.manifestUrl ?? request.entry?.manifest;
      if (!requested) throw new TypeError('manifestUrl is required');
      const manifestUrl = releaseUrl(requested, registryBase, releaseRoot, 'manifest URL');
      const manifestBytes = bytesOf(await dependencies.fetchBytes(manifestUrl.href, { signal }), 'manifest');
      assertCurrent(transaction);
      const rawManifest = parseJson(manifestBytes, 'Dos Lagos manifest');
      const manifest = validateLockedManifest(rawManifest);
      const routeUrl = releaseUrl(manifest.route, manifestUrl, releaseRoot, 'route release URL');
      const visualUrl = releaseUrl(manifest.visual[0], manifestUrl, releaseRoot, 'visual release URL');
      const collisionUrl = releaseUrl(manifest.collision[0], manifestUrl, releaseRoot, 'collision release URL');
      const routeBytes = bytesOf(await dependencies.fetchBytes(routeUrl.href, { signal }), 'route');
      assertCurrent(transaction);
      const visualBytes = bytesOf(await dependencies.fetchBytes(visualUrl.href, { signal }), 'visual');
      assertCurrent(transaction);
      const collisionBytes = bytesOf(await dependencies.fetchBytes(collisionUrl.href, { signal }), 'collision');
      assertCurrent(transaction);
      transaction.loadedBytes = {
        manifest: manifestBytes.byteLength,
        route: routeBytes.byteLength,
        visual: visualBytes.byteLength,
        collision: collisionBytes.byteLength,
        total: manifestBytes.byteLength + routeBytes.byteLength + visualBytes.byteLength + collisionBytes.byteLength,
      };
      rememberStats(transaction);
      for (const [label, bytes] of [['route', routeBytes], ['visual', visualBytes], ['collision', collisionBytes]]) {
        if (bytes.byteLength !== LOCKS[label].bytes) throw new TypeError(label + ' byte length mismatch');
        const actual = await sha256(bytes);
        assertCurrent(transaction);
        if (actual !== LOCKS[label].sha256) throw new TypeError(label + ' SHA-256 mismatch');
      }
      inspectGlb(visualBytes, 'visual', GLB_STATS.visual, Object.keys(LOD_NODES));
      inspectGlb(collisionBytes, 'collision', GLB_STATS.collision);
      transaction.sourceRoute = parseJson(routeBytes, 'Dos Lagos route');
      const sourceCanonical = normalizeRoute(transaction.sourceRoute), sourceQuery = createRouteQuery(sourceCanonical);
      const authoredGameplay = createGameplayBridge(sourceQuery, transaction.sourceRoute);
      const closure = prepareOptionalClosedRoute(dependencies, sourceCanonical, 'dos_lagos');
      transaction.normalizedRoute = closure?.route || sourceCanonical;
      transaction.closure = closure?.closure || null;
      transaction.routeQuery = closure ? createRouteQuery(transaction.normalizedRoute) : sourceQuery;
      transaction.gameplay = closure ? createCanonicalGameplayBridge(transaction.routeQuery, transaction.normalizedRoute, {
        id:'dos_lagos',name:'Dos Lagos',description:'Circuito patagónico con regreso a largada.',biome:authoredGameplay.biome,
        environment:authoredGameplay.environment,palette:authoredGameplay.palette,shoulder:authoredGameplay.shoulder,
        barrier:authoredGameplay.barrier,speedTrap:authoredGameplay.speedTrap,brakingMarkers:authoredGameplay.brakingMarkers,
      }) : authoredGameplay;

      transaction.visualRoot = await dependencies.completeGlbToObject(visualBytes, 'Dos Lagos visual', { signal });
      if (!transaction.visualRoot || typeof transaction.visualRoot.traverse !== 'function') {
        throw new TypeError('Dos Lagos visual root is invalid');
      }
      transaction.visualParsed = true;
      cumulative.created.visualRoots += 1;
      updateInventory(transaction, [transaction.visualRoot]);
      assertCurrent(transaction);

      await prepareTrackVisual(transaction.visualRoot, { id: 'dos_lagos', query: sourceQuery, lengthM: sourceCanonical.lengthM, signal });
      updateInventory(transaction, [transaction.visualRoot]);
      assertCurrent(transaction);

      if(!closure){
      transaction.visualInstallAttempted = true;
      transaction.installCounts.visual += 1;
      rememberStats(transaction);
      const visualInstallRoot = transaction.visualRoot;
      await callLifecycleHook(transaction, 'visual install', () => dependencies.installVisualRoot(visualInstallRoot, { signal }));
      transaction.visualInstalled = true;
      assertCurrent(transaction);

      }

      transaction.collisionRoot = await dependencies.completeGlbToObject(collisionBytes, 'Dos Lagos collision', { signal });
      if (!transaction.collisionRoot || typeof transaction.collisionRoot.traverse !== 'function') {
        throw new TypeError('Dos Lagos collision root is invalid');
      }
      transaction.collisionParsed = true;
      cumulative.created.collisionRoots += 1;
      try {
        if (closure) { const roots=attachClosedRouteRoots(closure, transaction.visualRoot, transaction.collisionRoot);await prepareReturnScenery(roots.visualRoot,{id:'dos_lagos',query:transaction.routeQuery,lengthM:transaction.normalizedRoute.lengthM,startM:sourceCanonical.lengthM,signal}); }
      } finally {
        // A malformed optional closure can already have attached one root.
        // Count both owners before rollback so every allocated resource is released.
        updateInventory(transaction, [transaction.visualRoot, transaction.collisionRoot]);
      }
      assertCurrent(transaction);

      if(closure){
      transaction.visualInstallAttempted = true;
      transaction.installCounts.visual += 1;
      rememberStats(transaction);
      const visualInstallRoot = transaction.visualRoot;
      await callLifecycleHook(transaction, 'visual install', () => dependencies.installVisualRoot(visualInstallRoot, { signal }));
      transaction.visualInstalled = true;
      assertCurrent(transaction);

      }

      transaction.collisionInstallAttempted = true;
      transaction.installCounts.collision += 1;
      rememberStats(transaction);
      const collisionInstallRoot = transaction.collisionRoot;
      await callLifecycleHook(transaction, 'collision install', () => dependencies.installCollisionRoot(collisionInstallRoot, { signal }));
      transaction.collisionInstalled = true;
      assertCurrent(transaction);

      transaction.lodObjects = new Map(Object.keys(LOD_NODES).map(name => {
        const object = findNamed(transaction.visualRoot, name);
        if (!object) throw new TypeError('Dos Lagos visual root missing stable node ' + name);
        return [name, object];
      }));

      transaction.probeAttempted = true;
      const probeResult = await callLifecycleHook(transaction, 'collision probe create', () => dependencies.createCollisionProbe(transaction.collisionRoot, { signal }));
      if (probeResult && typeof probeResult === 'object') {
        transaction.collisionProbe = probeResult;
        transaction.probeCreated = true;
        cumulative.created.collisionProbes += 1;
      }
      assertCollisionProbe(probeResult);
      transaction.collisionProbe = probeResult;
      assertCurrent(transaction);

      transaction.physicsAttempted = true;
      transaction.installCounts.physics += 1;
      rememberStats(transaction);
      const physicsCreationContext = {
        collisionRoot: transaction.collisionRoot,
        collisionProbe: transaction.collisionProbe,
      };
      const bridgeResult = await callLifecycleHook(transaction, 'physics bridge create', () => dependencies.createPhysicsBridge({
        ...physicsCreationContext,
        routeQuery: transaction.routeQuery,
        signal,
      }));
      if (bridgeResult && typeof bridgeResult === 'object') {
        transaction.physicsBridgeSource = bridgeResult;
        if (!transaction.physicsSourceCounted) {
          transaction.physicsSourceCounted = true;
          cumulative.created.physicsBridges += 1;
        }
        if (typeof bridgeResult.dispose === 'function') {
          transaction.disposePhysics = createPhysicsDisposer(transaction, bridgeResult);
        }
      }
      transaction.physicsBridge = createPhysicsBridgeDescriptor(
        bridgeResult,
        transaction.collisionRoot,
        transaction.disposePhysics,
      );
      assertCurrent(transaction);

      routeQuery = transaction.routeQuery;
      gameplay = transaction.gameplay;
      normalizedRoute = transaction.normalizedRoute;
      sourceRoute = transaction.sourceRoute;
      visualRoot = transaction.visualRoot;
      collisionRoot = transaction.collisionRoot;
      collisionProbe = transaction.collisionProbe;
      physicsBridge = transaction.physicsBridge;
      lodObjects = transaction.lodObjects;
      environment = manifest.defaultEnvironment;
      ready = true;
      state = 'ready';
      rememberStats(transaction);
      return adapter;
    } catch (error) {
      const primary = transaction.controller.signal.aborted && error?.name !== 'AbortError'
        ? abortError()
        : error;
      const errors = await cleanupTransaction(transaction);
      transaction.cleanupReported = true;
      if (state !== 'unloading') state = 'idle';
      throw attachCleanup(primary, errors);
    } finally {
      removeCallerAbort();
    }
  }

  function load(request = {}) {
    if (state === 'unloading') return observedRejection(new Error('Dos Lagos adapter is unloading'));
    if (state === 'loading') return observedRejection(new Error('Dos Lagos adapter is already loading'));
    if (ready && state === 'ready') return Promise.resolve(adapter);

    const token = ++epoch;
    const controller = new AbortController();
    const transaction = createTransaction(token, controller);
    currentTransaction = transaction;
    state = 'loading';
    ready = false;
    rememberStats(transaction);
    const promise = performLoad(request, transaction);
    const record = { token, controller, promise, transaction };
    activeLoad = record;
    promise.then(
      () => { if (activeLoad === record) activeLoad = null; },
      () => { if (activeLoad === record) activeLoad = null; },
    );
    return promise;
  }

  function unload() {
    if (unloadPromise) return unloadPromise;
    const reason = abortError();
    const transaction = currentTransaction;
    const loading = activeLoad;
    epoch += 1;
    state = 'unloading';
    ready = false;

    let begin;
    const gate = new Promise(resolve => { begin = resolve; });
    const task = gate.then(async () => {
      if (loading) await loading.promise.catch(() => {});
      const errors = await cleanupTransaction(transaction);
      if (errors.length) throw aggregateCleanupErrors(errors);
    }).finally(() => {
      if (currentTransaction === transaction) clearPublicReferences(transaction);
      state = 'idle';
      if (unloadPromise === task) unloadPromise = null;
    });
    unloadPromise = task;
    task.catch(() => {});
    abortTransaction(transaction, reason);
    begin();
    return task;
  }

  function requireReady() {
    if (!ready || !routeQuery || !gameplay) throw new Error('Dos Lagos adapter is not ready');
  }
  function sampleRoute(sM) {
    requireReady();
    const route = routeQuery.sample(sM);
    const authored = normalizedRoute.closed ? gameplay.sample(route.sM) : interpolateAuthored(sourceRoute.samples, route.sM);
    return deepFreeze({ ...route, curvature: authored.curvature, bankRad: authored.bank, targetSpeedKph: authored.targetSpeedKph, idealLineOffsetM: gameplay.idealLineOffset(route.sM) });
  }
  function projectToRoute(position, hintSegment, options) {
    requireReady();
    return routeQuery.project(position, hintSegment, options);
  }
  function surfaceAt(first, second, third, fourth) {
    requireReady();
    return typeof first === 'number' ? gameplay.surfaceAt(first, second, third) : routeQuery.surfaceAt(first, second, third || fourth);
  }
  function getSpawn(kind, index = 0) {
    requireReady();
    if (kind === 'chevy') {
      const sample = routeQuery.sample(0);
      return publicSpawn(sample, sample.position, { rearwardM: 0, lateralM: 0 }, normalizedRoute.lengthM);
    }
    if (kind === 'falcon') {
      const sample = routeQuery.sample(0);
      const rearwardM = 4.5;
      const lateralM = Math.min(1.25, sample.widthM * 0.25);
      const position = sample.position.map((value, axis) => value - sample.frame.tangent[axis] * rearwardM + sample.frame.left[axis] * lateralM);
      return publicSpawn(sample, position, { rearwardM, lateralM }, normalizedRoute.lengthM);
    }
    if (kind === 'respawn') {
      if (!Number.isInteger(index) || index < 0 || index >= normalizedRoute.respawns.length) throw new RangeError('respawn index out of range: ' + index);
      const record = routeQuery.respawnFor(normalizedRoute.respawns[index].sM);
      return publicSpawn(record, record.position, { rearwardM: 0, lateralM: record.lateralM }, normalizedRoute.lengthM);
    }
    throw new RangeError('unknown spawn: ' + kind);
  }
  function resolveRespawn(raceProgressM) {
    requireReady();
    return respawnRecord(routeQuery, raceProgressM, normalizedRoute.lengthM, normalizedRoute.closed);
  }
  function getCheckpoints() {
    requireReady();
    return Object.freeze(normalizedRoute.checkpoints.map((checkpoint, index) => {
      const record = routeQuery.checkpointAt(index);
      return deepFreeze({ ...record, id: 'checkpoint_' + (index + 1), finish: index === normalizedRoute.checkpoints.length - 1 });
    }));
  }
  function updateStreaming(context = {}) {
    requireReady();
    let distance = context.distanceM;
    if (!Number.isFinite(distance)) {
      const camera = finiteVector(context.cameraPosition);
      const vehicle = finiteVector(context.vehiclePosition);
      if (!camera || !vehicle) throw new TypeError('streaming requires distanceM or cameraPosition and vehiclePosition');
      distance = Math.hypot(camera[0] - vehicle[0], camera[1] - vehicle[1], camera[2] - vehicle[2]);
    }
    if (distance < 0) throw new RangeError('streaming distance must be nonnegative');
    for (const [name, object] of lodObjects) {
      const metadata = LOD_NODES[name];
      object.visible = distance >= metadata.minDistanceM && distance <= metadata.maxDistanceM;
    }
    return deepFreeze({ distanceM: distance, visible: Object.freeze([...lodObjects].filter(([, object]) => object.visible).map(([name]) => name)) });
  }
  function applyEnvironment(id) {
    requireReady();
    if (!ENVIRONMENTS.includes(id)) throw new RangeError('unsupported environment: ' + id);
    dependencies.applyVisualEnvironment(visualRoot, id);
    environment = id;
  }
  function getDiagnostics() {
    const stats = currentTransaction ? {
      resourceCounts: currentTransaction.resourceCounts,
      disposalCounts: currentTransaction.disposalCounts,
      installCounts: currentTransaction.installCounts,
      loadedBytes: currentTransaction.loadedBytes,
    } : lastStats;
    const live = {
      visualRoots: ready && visualRoot ? 1 : 0,
      collisionRoots: ready && collisionRoot ? 1 : 0,
      collisionProbes: ready && collisionProbe ? 1 : 0,
      physicsBridges: ready && physicsBridge ? 1 : 0,
      geometry: ready && currentTransaction ? currentTransaction.resources.geometry.size : 0,
      material: ready && currentTransaction ? currentTransaction.resources.material.size : 0,
      texture: ready && currentTransaction ? currentTransaction.resources.texture.size : 0,
    };
    return deepFreeze({
      id: 'dos_lagos', state, closed:normalizedRoute?.closed===true,lengthM:normalizedRoute?.lengthM||0,closure:currentTransaction?.closure||null,
      visualMeshes: GLB_STATS.visual.meshes,
      collisionMeshes: GLB_STATS.collision.meshes,
      routeSamples: normalizedRoute?.samples.length || 0,
      loadedBytes: { ...stats.loadedBytes }, environment,
      installCounts: { ...stats.installCounts },
      resourceCounts: { ...stats.resourceCounts },
      disposalCounts: { ...stats.disposalCounts },
      declared: { visualMeshes: 63, collisionMeshes: 3, routeSamples: 2051 },
      live,
      cumulative: { created: { ...cumulative.created }, disposed: { ...cumulative.disposed } },
    });
  }

  const adapter = {};
  Object.defineProperties(adapter, {
    id: { enumerable: true, value: 'dos_lagos' },
    ready: { enumerable: true, get: () => ready },
    environmentProfile: { enumerable: true, value: deepFreeze({ profile: './environment.json', defaultPreset: 'clear', availablePresets: ['clear', 'overcast', 'golden-hour', 'sunset', 'moonrise', 'night'] }) },
    visualRoot: { enumerable: true, get: () => ready ? visualRoot : null },
    collisionRoot: { enumerable: true, get: () => ready ? collisionRoot : null },
    collisionProbe: { enumerable: true, get: () => ready ? collisionProbe : null },
    physicsBridge: { enumerable: true, get: () => ready ? physicsBridge : null },
    routeQuery: { enumerable: true, get: () => ready ? routeQuery : null },
    gameplay: { enumerable: true, get: () => ready ? gameplay : null },
    sectors: { enumerable: true, get: () => ready && normalizedRoute ? cloneFrozen(normalizedRoute.sectors) : Object.freeze([]) },
    respawns: { enumerable: true, get: () => ready && normalizedRoute ? cloneFrozen(normalizedRoute.respawns) : Object.freeze([]) },
    validate: { enumerable: true, value: validate },
    load: { enumerable: true, value: load },
    unload: { enumerable: true, value: unload },
    sampleRoute: { enumerable: true, value: sampleRoute },
    projectToRoute: { enumerable: true, value: projectToRoute },
    surfaceAt: { enumerable: true, value: surfaceAt },
    resolveRespawn: { enumerable: true, value: resolveRespawn },
    getSpawn: { enumerable: true, value: getSpawn },
    getCheckpoints: { enumerable: true, value: getCheckpoints },
    getMaterialBindings: { enumerable: true, value: () => ready ? collectMaterialBindings(visualRoot, { asphalt: ['M_Asphalt_Wet', 'M_DL_Detail_RoadPatch_PBR'], shoulder: ['M_Shoulder_Gravel', 'M_DL_Detail_Gravel_PBR'], terrain: ['M_Terrain_Andean', 'M_Rock_Patagonian', 'M_DL_Detail_Rock_PBR'], water: ['M_Lake_Water'], snow: [] }) : Object.freeze([]) },
    updateStreaming: { enumerable: true, value: updateStreaming },
    applyEnvironment: { enumerable: true, value: applyEnvironment },
    getDiagnostics: { enumerable: true, value: getDiagnostics },
  });
  return Object.freeze(adapter);
}
