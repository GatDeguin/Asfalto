import {PROBE_RADIANCE_RANGE} from './probe-radiance-input.mjs?v=83e589831e106c72';

export const probeRadianceShader = /* wgsl */ `
struct Spot {
  position: vec4f, // relative to BVH origin and local range
  direction: vec4f, // world direction and outer cone cosine
  color: vec4f, // linear color and intensity
  shape: vec4f, // inner cone cosine and distance decay
}
struct Params {
  origin: vec4f,  // relative to BVH origin; w is the ray limit
  spacing: vec4f, // probe spacing in world metres
  config: vec4u,  // horizontal grid size, node count, proxy count, lobe samples
  sun: vec4f,     // world direction and intensity
  sunColor: vec4f,
  sky: vec4f,     // linear irradiance from the game's hemisphere light
  ground: vec4f,
  headlights: array<Spot, 2>,
}
struct Node { lo: vec4f, hi: vec4f }
struct Triangle { a: vec4f, e1: vec4f, e2: vec4f }
struct Proxy {
  center: vec4f, // w is the rounding radius
  core: vec4f,   // unrounded core, w indicates a dynamic proxy
  orientation: vec4f,
  color: vec4f,
}
struct Hit { distance: f32, normal: vec3f, color: vec3f, kind: u32 }

@group(0) @binding(0) var<uniform> p: Params;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(3) var<storage, read> proxies: array<Proxy>;
@group(0) @binding(4) var<storage, read_write> field: array<u32>;
var<workgroup> lobes: array<vec4f, 32>;

fn inverseRay(direction: vec3f) -> vec3f {
  return 1.0 / select(direction, vec3f(1.0), abs(direction) < vec3f(0.000001));
}

fn rayInterval(origin: vec3f, direction: vec3f, inverse: vec3f, lo: vec3f, hi: vec3f, limit: f32) -> vec2f {
  let parallel = abs(direction) < vec3f(0.000001);
  if any(select(vec3<bool>(false), origin < lo, parallel)) ||
     any(select(vec3<bool>(false), origin > hi, parallel)) { return vec2f(1.0, -1.0); }
  let t0 = (lo - origin) * inverse;
  let t1 = (hi - origin) * inverse;
  let near = select(min(t0, t1), vec3f(-1e10), parallel);
  let far = select(max(t0, t1), vec3f(1e10), parallel);
  return vec2f(max(0.0, max(near.x, max(near.y, near.z))), min(limit, min(far.x, min(far.y, far.z))));
}

fn traceBvh(origin: vec3f, direction: vec3f, limit: f32) -> Hit {
  var best = Hit(limit, vec3f(0), vec3f(0), 0u);
  var index = 0u;
  let inverse = inverseRay(direction);
  for (var visits = 0u; visits < 1536u && index < p.config.y; visits++) {
    let node = nodes[index];
    let interval = rayInterval(origin, direction, inverse, node.lo.xyz, node.hi.xyz, best.distance);
    if interval.x > interval.y { index = u32(node.hi.w); continue; }
    index++;
    if node.lo.w < 0.0 { continue; }
    let packed = u32(node.lo.w);
    for (var j = 0u; j < packed % 8u; j++) {
      let t = triangles[packed / 8u + j];
      let perpendicular = cross(direction, t.e2.xyz);
      let det = dot(t.e1.xyz, perpendicular);
      if abs(det) < 1e-8 { continue; }
      let v = origin - t.a.xyz;
      let u = dot(v, perpendicular) / det;
      if u < 0.0 || u > 1.0 { continue; }
      let q = cross(v, t.e1.xyz);
      let w = dot(direction, q) / det;
      if w < 0.0 || u + w > 1.0 { continue; }
      let distance = dot(t.e2.xyz, q) / det;
      if distance <= 0.02 || distance >= best.distance { continue; }
      let n = normalize(cross(t.e1.xyz, t.e2.xyz));
      best = Hit(distance, select(n, -n, dot(n, direction) > 0.0), vec3f(t.a.w, t.e1.w, t.e2.w), 1u);
    }
  }
  return best;
}

fn rotate(v: vec3f, q: vec4f) -> vec3f {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

fn roundedBox(v: vec3f, core: vec3f, radius: f32) -> f32 {
  let q = abs(v) - core;
  return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - radius;
}

fn traceSdf(origin: vec3f, direction: vec3f, exact: Hit) -> Hit {
  var best = exact;
  for (var i = 0u; i < p.config.z; i++) {
    let box = proxies[i];
    if exact.kind != 0u && box.core.w < 0.5 { continue; }
    let q = vec4f(-box.orientation.xyz, box.orientation.w);
    let localOrigin = rotate(origin - box.center.xyz, q);
    let localDirection = rotate(direction, q);
    if roundedBox(localOrigin, box.core.xyz, box.center.w) < 0.02 { continue; }
    let extent = box.core.xyz + vec3f(box.center.w);
    let span = rayInterval(localOrigin, localDirection, inverseRay(localDirection), -extent, extent, best.distance);
    var distance = max(0.025, span.x);
    for (var iteration = 0u; iteration < 12u && distance <= span.y; iteration++) {
      let position = localOrigin + localDirection * distance;
      let d = roundedBox(position, box.core.xyz, box.center.w);
      if d < 0.016 {
        let h = 0.009;
        let dx = vec3f(h, 0, 0); let dy = vec3f(0, h, 0); let dz = vec3f(0, 0, h);
        let normal = normalize(vec3f(
          roundedBox(position + dx, box.core.xyz, box.center.w) - roundedBox(position - dx, box.core.xyz, box.center.w),
          roundedBox(position + dy, box.core.xyz, box.center.w) - roundedBox(position - dy, box.core.xyz, box.center.w),
          roundedBox(position + dz, box.core.xyz, box.center.w) - roundedBox(position - dz, box.core.xyz, box.center.w)
        ));
        best = Hit(distance, rotate(normal, box.orientation), box.color.xyz, 2u);
        break;
      }
      distance += max(d, 0.012);
    }
  }
  return best;
}

const axes = array<vec3f, 6>(vec3f(1,0,0), vec3f(-1,0,0), vec3f(0,1,0), vec3f(0,-1,0), vec3f(0,0,1), vec3f(0,0,-1));

fn headlightBounce(point: vec3f, normal: vec3f) -> vec3f {
  var light = vec3f(0);
  for (var i = 0u; i < 2u; i++) {
    let spot = p.headlights[i];
    if spot.color.w <= .01 { continue; }
    let delta = point - spot.position.xyz;
    let d = length(delta);
    if d < .08 || d > spot.position.w { continue; }
    let fromLight = delta / d;
    let facing = max(dot(-fromLight, normal), 0.0);
    let cone = smoothstep(spot.direction.w, max(spot.direction.w + .00001, spot.shape.x),
                          dot(fromLight, spot.direction.xyz));
    if facing * cone < .003 { continue; }
    let shadow = traceBvh(point + normal * .06, -fromLight, max(.0, d - .10));
    if shadow.kind != 0u { continue; }
    let attenuation = 1.0 - smoothstep(spot.position.w * .58, spot.position.w, d);
    let irradiance = spot.color.w * facing * cone * attenuation / pow(max(1.0, d), spot.shape.y);
    light += spot.color.xyz * min(1.5, irradiance * .08);
  }
  return light;
}

fn traceLobe(origin: vec3f, face: u32) -> vec4f {
  let axis = axes[face];
  let tangent = normalize(cross(select(vec3f(0,1,0), vec3f(1,0,0), abs(axis.y) > .5), axis));
  let bitangent = cross(axis, tangent);
  var sum = vec4f(0.0);
  for (var ray = 0u; ray < p.config.w; ray++) {
    let angle = f32(face) * 2.39996 + f32(ray) * 3.14159;
    let spread = select(0.0, .43, ray > 0u);
    let direction = normalize(axis + spread * (cos(angle) * tangent + sin(angle) * bitangent));
    let hit = traceSdf(origin, direction, traceBvh(origin, direction, p.origin.w));
    if hit.kind == 0u { continue; }
    let point = origin + direction * hit.distance;
    let hemisphere = mix(p.ground.xyz, p.sky.xyz, clamp(hit.normal.y * .5 + .5, 0.0, 1.0));
    let facing = max(dot(p.sun.xyz, hit.normal), 0.0);
    var sunlight = 0.0;
    if facing > 0.025 && p.sun.w > 0.015 {
      let shadow = traceBvh(point + hit.normal * .06, p.sun.xyz, 14.0);
      sunlight = facing * p.sun.w * select(0.82, .12, shadow.kind != 0u) / 3.14159;
    }
    let weight = smoothstep(.075, .45, hit.distance) * (1.0 - smoothstep(p.origin.w * .62, p.origin.w, hit.distance));
    let bounce = min(hit.color * (hemisphere * .6 + p.sunColor.xyz * sunlight + headlightBounce(point, hit.normal)),
                     vec3f(${PROBE_RADIANCE_RANGE.toFixed(1)}));
    sum += vec4f(bounce * weight, weight);
  }
  return sum / f32(p.config.w);
}

fn encode(value: vec4f) -> u32 {
  return pack4x8unorm(clamp(vec4f(value.rgb / ${PROBE_RADIANCE_RANGE.toFixed(1)}, value.a), vec4f(0), vec4f(1)));
}

@compute @workgroup_size(32)
fn traceProbes(@builtin(global_invocation_id) id: vec3u, @builtin(local_invocation_index) lane: u32) {
  let gridSize = p.config.x;
  let count = gridSize * 2u * gridSize;
  let probe = id.x / 8u;
  let face = lane % 8u;
  if probe < count && face < 6u {
    let coordinate = vec3f(f32(probe % gridSize), f32(probe / gridSize % 2u), f32(probe / (gridSize * 2u)));
    let lobe = traceLobe(p.origin.xyz + coordinate * p.spacing.xyz, face);
    lobes[lane] = lobe;
    field[(face + 1u) * count + probe] = encode(lobe);
  }
  workgroupBarrier();
  if probe < count && face == 0u {
    // Downweight the road underneath the grid to limit same-surface feedback.
    let diffuse = (lobes[lane] + lobes[lane+1u] + lobes[lane+2u] + lobes[lane+3u] * .25
                 + lobes[lane+4u] + lobes[lane+5u]) / 5.25;
    field[probe] = encode(diffuse);
  }
}
`;
