import {VISIBILITY_OBJECT_SHIFT} from './virtual-terrain-data.mjs?v=3cb3d32add0067b4';
import {virtualTerrainShader} from './virtual-terrain-raster.wgsl.mjs?v=4228237d8a7e45da';

// The road and both terrain sheets use the fixed rasterizer. Vista may also
// produce compute fragments. Both paths emit the same triangle and object ID.
export const virtualTerrainSurfaceShader = virtualTerrainShader + /* wgsl */ `
struct SurfaceVertex {
  positionNormal: vec4f,
  tint: vec4f,
};

@group(0) @binding(13) var<storage, read> surfaceVertices: array<SurfaceVertex>;
@group(0) @binding(14) var<storage, read> surfaceIndices: array<u32>;
@group(0) @binding(15) var<uniform> depthRange: vec2f;

fn surfaceClip(p: vec3f) -> vec4f {
  let c = frame.mvp * vec4f(p, 1.0);
  let near = depthRange.x;
  let far = depthRange.y;
  // Construct reversed Z directly so the cockpit near plane does not erase
  // precision on distant terrain.
  return vec4f(c.xy, near * (far - c.w) / (far - near), c.w);
}

struct SurfaceVisibilityVertex {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) visibility: u32,
};

@vertex
fn surfaceVistaVertex(@builtin(vertex_index) i: u32) -> SurfaceVisibilityVertex {
  let id = largeRead[i / 3u];
  let triangle = (id & TRIANGLE_MASK) - 1u;
  return SurfaceVisibilityVertex(surfaceClip(vertices[triangle * 3u + i % 3u].xyz), id);
}

@vertex
fn surfaceVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) object: u32) -> SurfaceVisibilityVertex {
  let p = surfaceVertices[surfaceIndices[vertex]].positionNormal.xyz;
  let visibility = (object << ${VISIBILITY_OBJECT_SHIFT}u) | (vertex / 3u + 1u);
  return SurfaceVisibilityVertex(surfaceClip(p), visibility);
}

@fragment
fn surfaceIdFragment(in: SurfaceVisibilityVertex) -> @location(0) u32 {
  return in.visibility;
}

@fragment
fn resolveSurfaceVisibility(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let coord = vec2i(position.xy);
  let index = u32(coord.y) * frame.size.x + u32(coord.x);
  let native = textureLoad(nativeIds, coord, 0).x;
  let micro = ownerRead[index];
  if (native == 0u) { return encodeVisibility(micro); }
  if (micro == 0u) { return encodeVisibility(native); }
  let reverseZ = textureLoad(nativeDepth, coord, 0);
  let near = depthRange.x;
  let far = depthRange.y;
  let nativeKey = depthKey(far * near / (near + reverseZ * (far - near)));
  return encodeVisibility(select(native, micro, depthRead[index] >= nativeKey));
}
`;

export const indexedVirtualTerrainSurfaceShader = 'enable primitive_index;\n' + virtualTerrainSurfaceShader + /* wgsl */ `
@vertex
fn indexedSurfaceVertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) base: u32) -> SurfaceVisibilityVertex {
  return SurfaceVisibilityVertex(surfaceClip(surfaceVertices[vertex].positionNormal.xyz), base);
}

@fragment
fn indexedSurfaceFragment(in: SurfaceVisibilityVertex, @builtin(primitive_index) primitive: u32) -> @location(0) u32 {
  return in.visibility + primitive + 1u;
}
`;
