import {MAX_PAGE_TRIANGLES} from './virtual-terrain-data.mjs?v=09bc75160261c900';

export const virtualTerrainShader = /* wgsl */`
const PAGE_TRIANGLES = ${MAX_PAGE_TRIANGLES}u;
const DEPTH_MAX = 16777215u;
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
@group(0) @binding(9) var nativePixels: texture_2d<u32>;
@group(0) @binding(10) var<storage, read> depthRead: array<u32>;
@group(0) @binding(11) var<storage, read> ownerRead: array<u32>;

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

fn octDecode(bits: u32) -> vec3f {
  let f = vec2f(f32(bits & 255u), f32((bits >> 8u) & 255u)) * (2.0 / 255.0) - 1.0;
  let z = 1.0 - abs(f.x) - abs(f.y);
  let folded = (1.0 - abs(f.yx)) * select(vec2f(-1.0), vec2f(1.0), f >= vec2f(0.0));
  return normalize(vec3f(select(f, folded, z < 0.0), z));
}

fn octEncode(normal: vec3f) -> u32 {
  let n = normal / max(dot(abs(normal), vec3f(1.0)), 0.000001);
  let folded = (1.0 - abs(n.yx)) * select(vec2f(-1.0), vec2f(1.0), n.xy >= vec2f(0.0));
  let oct = vec2u(round((select(n.xy, folded, n.z < 0.0) * 0.5 + 0.5) * 255.0));
  return oct.x | (oct.y << 8u);
}

fn appendNative(id: u32) {
  let entry = atomicAdd(&drawArgs[0], 3u) / 3u;
  largeWrite[entry] = id;
}

fn raster(invocation: vec3u, owners: bool) {
  let page = pages[invocation.y];
  if (invocation.x >= page.y) { return; }
  let id = page.x * PAGE_TRIANGLES + invocation.x;
  let t = clipTriangle(id);
  if (isOutside(t)) { return; }
  // The fixed rasterizer clips large triangles and triangles crossing near/far.
  if (min(t.a.w, min(t.b.w, t.c.w)) <= 0.0 ||
      any(abs(vec3f(t.a.z, t.b.z, t.c.z)) > vec3f(t.a.w, t.b.w, t.c.w))) {
    if (!owners) { appendNative(id); }
    return;
  }
  let a = toPixel(t.a);
  let b = toPixel(t.b);
  let c = toPixel(t.c);
  let low = min(a, min(b, c));
  let high = max(a, max(b, c));
  if (any(high - low > vec2f(MICRO_SPAN))) {
    if (!owners) { appendNative(id); }
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
        if (atomicLoad(&microDepth[pixel]) == key) { atomicMax(&microOwner[pixel], id + 1u); }
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
  @location(0) normal: vec3f,
  @location(1) viewDepth: f32,
};

@vertex
fn nativeVertex(@builtin(vertex_index) i: u32) -> NativeVertex {
  let v = vertices[largeRead[i / 3u] * 3u + i % 3u];
  let c = frame.mvp * vec4f(v.xyz, 1.0);
  return NativeVertex(vec4f(c.xy, (c.z + c.w) * 0.5, c.w), octDecode(u32(v.w)), c.w);
}

@fragment
fn nativeFragment(in: NativeVertex, @builtin(front_facing) front: bool) -> @location(0) vec2u {
  return vec2u(depthKey(in.viewDepth), octEncode(in.normal * select(-1.0, 1.0, front)));
}

@vertex
fn fullscreen(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let vertices = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(vertices[i], 0.0, 1.0);
}

fn softwareNormal(id: u32, pixel: vec2f) -> u32 {
  let t = clipTriangle(id);
  let a = toPixel(t.a);
  let b = toPixel(t.b);
  let c = toPixel(t.c);
  let area = edge(a, b, c);
  let w = vec3f(edge(b, c, pixel) / t.a.w, edge(c, a, pixel) / t.b.w, edge(a, b, pixel) / t.c.w);
  let first = id * 3u;
  // Signed weights already flip the normal when we shade the back face.
  return octEncode((octDecode(u32(vertices[first].w)) * w.x +
    octDecode(u32(vertices[first + 1u].w)) * w.y + octDecode(u32(vertices[first + 2u].w)) * w.z) * -1.0 *
    select(0.0, 1.0 / abs(area), abs(area) > 0.0));
}

// An opaque UNORM canvas transfers both exact bit fields into the WebGL world
// without readPixels/mapAsync or any same-frame CPU copy of the framebuffer.
@fragment
fn resolvePixels(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let packed = u32(position.x) >= frame.size.x;
  let x = u32(position.x) % frame.size.x;
  let y = u32(position.y);
  let pixel = y * frame.size.x + x;
  let native = textureLoad(nativePixels, vec2i(i32(x), i32(y)), 0).xy;
  let depth = depthRead[pixel];
  let owner = ownerRead[pixel];
  let useSoftware = owner != 0u && depth >= native.x;
  let winner = select(native.x, depth, useSoftware);
  if (!packed) {
    return vec4f(vec3f(f32(winner & 255u), f32((winner >> 8u) & 255u), f32(winner >> 16u)) / 255.0, 1.0);
  }
  if (winner == 0u) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  var normal = native.y;
  if (useSoftware) { normal = softwareNormal(owner - 1u, vec2f(f32(x) + 0.5, position.y)); }
  return vec4f(f32(normal & 255u) / 255.0, f32(normal >> 8u) / 255.0, select(128.0 / 255.0, 1.0, useSoftware), 1.0);
}
`;
