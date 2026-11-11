import {MAX_PAGE_TRIANGLES} from './virtual-terrain-data.mjs?v=09bc75160261c900';

export const virtualTerrainShader = /* wgsl */`
const PAGE_TRIANGLES = ${MAX_PAGE_TRIANGLES}u;
const DEPTH_MAX = 16777215u;
const TRIANGLE_MASK = 65535u;
const MICRO_SPAN = 8.0;

struct Frame {
  mvp: mat4x4f,
  size: vec2u,
  inverseLogFar: f32,
  flags: u32,
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> vertices: array<vec4f>;
@group(0) @binding(2) var<storage, read> pages: array<vec2u>;
@group(0) @binding(3) var<storage, read_write> microDepth: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> microOwner: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> largeWrite: array<u32>;
@group(0) @binding(6) var<storage, read_write> drawArgs: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> stats: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> largeRead: array<u32>;
@group(0) @binding(9) var nativeIds: texture_2d<u32>;
@group(0) @binding(10) var<storage, read> depthRead: array<u32>;
@group(0) @binding(11) var<storage, read> ownerRead: array<u32>;
@group(0) @binding(12) var nativeDepth: texture_depth_2d;

struct Triangle { a: vec4f, b: vec4f, c: vec4f };

fn clipTriangle(id: u32) -> Triangle {
  let i = id * 3u;
  return Triangle(frame.mvp * vec4f(vertices[i].xyz, 1.0),
    frame.mvp * vec4f(vertices[i + 1u].xyz, 1.0), frame.mvp * vec4f(vertices[i + 2u].xyz, 1.0));
}

fn isOutside(t: Triangle) -> bool {
  let a = t.a;
  let b = t.b;
  let c = t.c;
  return any((a.xyz < -vec3f(a.w)) & (b.xyz < -vec3f(b.w)) & (c.xyz < -vec3f(c.w))) ||
    any((a.xyz > vec3f(a.w)) & (b.xyz > vec3f(b.w)) & (c.xyz > vec3f(c.w)));
}

fn toPixel(v: vec4f) -> vec2f {
  let pixel = (v.xy / v.w * vec2f(0.5, -0.5) + 0.5) * vec2f(frame.size);
  return round(pixel * 256.0) / 256.0;
}

fn edge(a: vec2f, b: vec2f, p: vec2f) -> f32 {
  let d = b - a;
  let q = p - a;
  return d.x * q.y - d.y * q.x;
}

fn ownsEdge(a: vec2f, b: vec2f, weight: f32) -> bool {
  let d = b - a;
  return weight > 0.0 || (weight == 0.0 && (d.y < 0.0 || (d.y == 0.0 && d.x > 0.0)));
}

fn depthKey(viewDepth: f32) -> u32 {
  return DEPTH_MAX - u32(round(clamp(log2(1.0 + viewDepth) * frame.inverseLogFar, 0.0, 1.0) * f32(DEPTH_MAX - 1u)));
}

fn appendNative(visibility: u32) {
  let entry = atomicAdd(&drawArgs[0], 3u) / 3u;
  largeWrite[entry] = visibility;
}

fn raster(invocation: vec3u, owners: bool) {
  let page = pages[invocation.y];
  if (invocation.x >= page.y) { return; }
  let id = (page.x & TRIANGLE_MASK) * PAGE_TRIANGLES + invocation.x;
  // The low 16 bits address the resident triangle, with zero reserved for sky.
  // The high byte identifies its object and selects a material at resolve time.
  let visibility = (page.x & ~TRIANGLE_MASK) | (id + 1u);
  let t = clipTriangle(id);
  if (isOutside(t)) { return; }
  // The fixed rasterizer clips large triangles and triangles crossing near/far.
  if (min(t.a.w, min(t.b.w, t.c.w)) <= 0.0 ||
      any(abs(vec3f(t.a.z, t.b.z, t.c.z)) > vec3f(t.a.w, t.b.w, t.c.w))) {
    if (!owners) { appendNative(visibility); }
    return;
  }
  let a = toPixel(t.a);
  let b = toPixel(t.b);
  let c = toPixel(t.c);
  let low = min(a, min(b, c));
  let high = max(a, max(b, c));
  if (any(high - low > vec2f(MICRO_SPAN))) {
    if (!owners) { appendNative(visibility); }
    return;
  }
  let area = edge(a, b, c);
  if (area == 0.0 || (area > 0.0 && (frame.flags & 1u) == 0u)) { return; }
  let u = select(b, c, area < 0.0);
  let v = select(c, b, area < 0.0);
  let inverseW = vec3f(1.0 / t.a.w, 1.0 / select(t.b.w, t.c.w, area < 0.0),
    1.0 / select(t.c.w, t.b.w, area < 0.0));
  let start = vec2i(clamp(ceil(low - 0.5), vec2f(0.0), vec2f(frame.size)));
  let end = vec2i(clamp(floor(high - 0.5), vec2f(-1.0), vec2f(frame.size) - 1.0));
  if (any(start > end)) { return; }
  if (!owners && (frame.flags & 2u) != 0u) { atomicAdd(&stats[0], 1u); }
  for (var y = start.y; y <= end.y; y++) {
    for (var x = start.x; x <= end.x; x++) {
      let p = vec2f(f32(x), f32(y)) + 0.5;
      let e = vec3f(edge(u, v, p), edge(v, a, p), edge(a, u, p));
      if (!ownsEdge(u, v, e.x) || !ownsEdge(v, a, e.y) || !ownsEdge(a, u, e.z)) { continue; }
      let pixel = u32(y) * frame.size.x + u32(x);
      let key = depthKey(abs(area) / dot(e, inverseW));
      if (owners) {
        if (atomicLoad(&microDepth[pixel]) == key) { atomicMax(&microOwner[pixel], visibility); }
      } else {
        atomicMax(&microDepth[pixel], key);
      }
    }
  }
}

@compute @workgroup_size(64)
fn rasterDepth(@builtin(global_invocation_id) id: vec3u) { raster(id, false); }

@compute @workgroup_size(64)
fn rasterOwner(@builtin(global_invocation_id) id: vec3u) { raster(id, true); }

struct NativeVertex {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) visibility: u32,
  @location(1) viewDepth: f32,
};

@vertex
fn nativeVertex(@builtin(vertex_index) i: u32) -> NativeVertex {
  let visibility = largeRead[i / 3u];
  let triangle = (visibility & TRIANGLE_MASK) - 1u;
  let v = vertices[triangle * 3u + i % 3u];
  let c = frame.mvp * vec4f(v.xyz, 1.0);
  return NativeVertex(vec4f(c.xy, (c.z + c.w) * 0.5, c.w), visibility, c.w);
}

struct NativeVisibility {
  @location(0) visibility: u32,
  @builtin(frag_depth) depth: f32,
};

fn normalizedDepth(key: u32) -> f32 {
  return f32(key) / f32(DEPTH_MAX);
}

@fragment
fn nativeFragment(in: NativeVertex) -> NativeVisibility {
  // Use the same reversed logarithmic depth as compute. Projective depth
  // alone loses the order of distant surfaces with the cockpit near plane.
  return NativeVisibility(in.visibility, normalizedDepth(depthKey(in.viewDepth)));
}

@vertex
fn fullscreen(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let vertices = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(vertices[i], 0.0, 1.0);
}

// Transport only the winning IDs. Geometry attributes are fetched by the
// material shader after visibility, and depth stays in the rasterizer.
@fragment
fn resolveVisibility(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let coord = vec2u(position.xy);
  let pixel = coord.y * frame.size.x + coord.x;
  let native = textureLoad(nativeIds, vec2i(coord), 0).x;
  let owner = ownerRead[pixel];
  var winner = native;
  if (owner != 0u) {
    if (native == 0u || normalizedDepth(depthRead[pixel]) >= textureLoad(nativeDepth, vec2i(coord), 0)) {
      winner = owner;
    }
  }
  let bytes = vec3u(winner & 255u, (winner >> 8u) & 255u, winner >> 16u);
  return vec4f(vec3f(bytes) / 255.0, 1.0);
}
`;
