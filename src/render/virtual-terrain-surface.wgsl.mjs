import {virtualTerrainShader} from './virtual-terrain-raster.wgsl.mjs';

// Share the depth and ID attachments with the virtual relief rasterizer.
export const virtualTerrainSurfaceShader = virtualTerrainShader + /* wgsl */ `
struct SurfaceVertex {
  positionNormal: vec4f,
  tint: vec4f,
};

struct Directional {
  direction: vec4f,
  radiance: vec4f,
};

struct SurfaceMaterial {
  colorRoughness: vec4f,
  scales: vec4f,
};

struct SurfaceFrame {
  rayOrigin: vec4f,
  rayX: vec4f,
  rayY: vec4f,
  cameraPosition: vec4f,
  directional: array<Directional, 3>,
  sky: vec4f,
  ground: vec4f,
  materials: array<SurfaceMaterial, 4>,
  depthRange: vec4f,
  environment: vec4f,
  irradiance: array<vec4f, 9>,
};

@group(0) @binding(13) var<storage, read> surfaceVertices: array<SurfaceVertex>;
@group(0) @binding(14) var<storage, read> surfaceIndices: array<u32>;
@group(0) @binding(15) var<uniform> surface: SurfaceFrame;
@group(0) @binding(16) var surfaceSampler: sampler;
@group(0) @binding(17) var landscapeColor: texture_2d<f32>;
@group(0) @binding(18) var landscapeNormal: texture_2d<f32>;
@group(0) @binding(19) var landscapeRoughness: texture_2d<f32>;
@group(0) @binding(20) var landscapeRock: texture_2d<f32>;
@group(0) @binding(21) var roadColor: texture_2d<f32>;
@group(0) @binding(22) var roadNormal: texture_2d<f32>;
@group(0) @binding(23) var roadRoughness: texture_2d<f32>;
@group(0) @binding(24) var hdrSky: texture_2d<f32>;
@group(0) @binding(25) var hdrSampler: sampler;

fn surfaceClip(p: vec3f) -> vec4f {
  let c = frame.mvp * vec4f(p, 1.0);
  let near = surface.depthRange.x;
  let far = surface.depthRange.y;
  // Reverse Z directly in clip space. Subtracting the projected z from w
  // would lose precision in the distance with the cockpit's near plane.
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
  // Static surfaces need more than 16 triangle bits. Their object IDs occupy
  // the high byte. Streamed Vista IDs retain their existing slot address.
  let visibility = (object << 24u) | (vertex / 3u + 1u);
  return SurfaceVisibilityVertex(surfaceClip(p), visibility);
}

@fragment
fn surfaceIdFragment(in: SurfaceVisibilityVertex) -> @location(0) u32 {
  return in.visibility;
}

fn visibleSurface(coord: vec2u) -> vec2u {
  let index = coord.y * frame.size.x + coord.x;
  let native = textureLoad(nativeIds, vec2i(coord), 0).x;
  let micro = ownerRead[index];
  if (native == 0u) {
    return vec2u(micro, select(0u, depthRead[index], micro != 0u));
  }
  let reverseZ = textureLoad(nativeDepth, vec2i(coord), 0);
  let near = surface.depthRange.x;
  let far = surface.depthRange.y;
  let key = depthKey(far * near / (near + reverseZ * (far - near)));
  if (micro != 0u && depthRead[index] >= key) {
    return vec2u(micro, depthRead[index]);
  }
  return vec2u(native, key);
}

fn octNormal(value: f32) -> vec3f {
  let bits = u32(value);
  let f = vec2f(f32(bits & 255u), f32(bits >> 8u)) * (2.0 / 255.0) - 1.0;
  let z = 1.0 - abs(f.x) - abs(f.y);
  let folded = (1.0 - abs(f.yx)) * select(vec2f(-1.0), vec2f(1.0), f >= vec2f(0.0));
  return normalize(vec3f(select(f, folded, z < 0.0), z));
}

fn projectedOffset(ray: vec3f, plane: vec3f, distance: f32, center: vec3f) -> vec3f {
  let denominator = dot(plane, ray);
  if (abs(denominator) <= 1e-7) { return vec3f(0.0); }
  return clamp(ray * (distance / denominator) - center, vec3f(-200.0), vec3f(200.0));
}

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let cell = floor(p);
  let q = fract(p);
  let f = q * q * (3.0 - 2.0 * q);
  return mix(mix(hash(cell), hash(cell + vec2f(1.0, 0.0)), f.x),
    mix(hash(cell + vec2f(0.0, 1.0)), hash(cell + vec2f(1.0)), f.x), f.y);
}

fn landscapeTint(p: vec3f) -> vec3f {
  let mixA = noise(p.xz * 0.012);
  let grain = noise(p.xz * 0.035 + vec2f(p.y * 0.014, 0.0));
  let broad = noise(p.xz * 0.0023);
  let tint = mix(vec3f(0.78, 0.88, 0.75), vec3f(0.96, 0.94, 0.86), mixA) * (0.94 + grain * 0.12);
  return mix(tint, vec3f(0.86, 0.94, 1.02), broad * 0.34);
}

fn triplanar(tex: texture_2d<f32>, uv: vec3f, weight: vec3f, dx: vec3f, dy: vec3f) -> vec3f {
  var value = vec3f(0.0);
  if (weight.x > 0.0) { value += textureSampleGrad(tex, surfaceSampler, uv.yz, dx.yz, dy.yz).rgb * weight.x; }
  if (weight.y > 0.0) { value += textureSampleGrad(tex, surfaceSampler, uv.xz, dx.xz, dy.xz).rgb * weight.y; }
  if (weight.z > 0.0) { value += textureSampleGrad(tex, surfaceSampler, uv.xy, dx.xy, dy.xy).rgb * weight.z; }
  return value;
}

fn skyDirection(v: vec3f) -> vec3f {
  let c = surface.environment.y;
  let s = surface.environment.z;
  return vec3f(c * v.x - s * v.z, v.y, s * v.x + c * v.z);
}

fn skyIrradiance(v: vec3f) -> vec3f {
  let n = skyDirection(v);
  let c = surface.irradiance;
  return max(vec3f(0.0), c[0].rgb * 0.282094792 +
    (c[1].rgb * n.x + c[2].rgb * n.y + c[3].rgb * n.z) * 0.488602512 +
    (c[4].rgb * n.x * n.y + c[5].rgb * n.y * n.z + c[6].rgb * n.z * n.x) * 1.092548431 +
    c[7].rgb * (3.0 * n.y * n.y - 1.0) * 0.315391565 +
    c[8].rgb * (n.x * n.x - n.z * n.z) * 0.546274215);
}

fn materialLighting(color: vec3f, n: vec3f, v: vec3f, roughness: f32) -> vec3f {
  let lambert = color * 0.318309886;
  let ambient = mix(surface.ground.rgb, surface.sky.rgb, n.y * 0.5 + 0.5);
  var result = lambert * ambient;
  let alpha = roughness * roughness;
  let alphaSquared = alpha * alpha;
  let dotNV = clamp(dot(n, v), 0.001, 1.0);
  if (surface.environment.x > 0.0) {
    let reflected = skyDirection(normalize(mix(reflect(-v, n), n, alpha)));
    let uv = vec2f(atan2(reflected.z, reflected.x) * 0.159154943 + 0.5,
      asin(clamp(reflected.y, -1.0, 1.0)) * 0.318309886 + 0.5);
    let radiance = textureSampleLevel(hdrSky, hdrSampler, uv, roughness * surface.environment.w).rgb;
    let irradiance = skyIrradiance(n) * 0.318309886;
    // Analytic split-sum BRDF used by the standard material, with the
    // panorama mip chain as an approximation of its filtered radiance.
    let r = roughness * vec4f(-1.0, -0.0275, -0.572, 0.022) + vec4f(1.0, 0.0425, 1.04, -0.04);
    let a004 = min(r.x * r.x, exp2(-9.28 * dotNV)) * r.x + r.y;
    let brdf = vec2f(-1.04, 1.04) * a004 + r.zw;
    let single = 0.04 * brdf.x + brdf.y;
    let loss = 1.0 - brdf.x - brdf.y;
    let multiple = single * 0.0857143 * loss / (1.0 - loss * 0.0857143);
    result += surface.environment.x * (radiance * single +
      irradiance * (color * (1.0 - single - multiple) + multiple));
  }
  for (var i = 0u; i < 3u; i++) {
    let light = surface.directional[i];
    let l = light.direction.xyz;
    let dotNL = max(dot(n, l), 0.0);
    if (dotNL <= 0.0) { continue; }
    let h = normalize(v + l);
    let dotNH = max(dot(n, h), 0.0);
    let dotVH = max(dot(v, h), 0.0);
    let denominator = dotNH * dotNH * (alphaSquared - 1.0) + 1.0;
    let distribution = 0.318309886 * alphaSquared / (denominator * denominator);
    let gv = dotNL * sqrt(dotNV * dotNV * (1.0 - alphaSquared) + alphaSquared);
    let gl = dotNV * sqrt(dotNL * dotNL * (1.0 - alphaSquared) + alphaSquared);
    let specular = distribution * 0.5 / max(gv + gl, 0.001) * (0.04 + 0.96 * pow(1.0 - dotVH, 5.0));
    result += light.radiance.rgb * dotNL * (lambert + specular);
  }
  return result;
}

fn shadeSurface(visibility: u32, pixel: vec2f) -> vec3f {
  let object = visibility >> 24u;
  var a: SurfaceVertex;
  var b: SurfaceVertex;
  var c: SurfaceVertex;
  if (object == 0u) {
    let index = ((visibility & TRIANGLE_MASK) - 1u) * 3u;
    a = SurfaceVertex(vertices[index], vec4f(1.0));
    b = SurfaceVertex(vertices[index + 1u], vec4f(1.0));
    c = SurfaceVertex(vertices[index + 2u], vec4f(1.0));
  } else {
    let index = ((visibility & 16777215u) - 1u) * 3u;
    a = surfaceVertices[surfaceIndices[index]];
    b = surfaceVertices[surfaceIndices[index + 1u]];
    c = surfaceVertices[surfaceIndices[index + 2u]];
  }
  let m = surface.materials[max(object, 1u) - 1u];
  let eye = surface.cameraPosition.xyz;
  let ray = surface.rayOrigin.xyz + surface.rayX.xyz * pixel.x + surface.rayY.xyz * pixel.y;
  let ab = b.positionNormal.xyz - a.positionNormal.xyz;
  let ac = c.positionNormal.xyz - a.positionNormal.xyz;
  let rayCross = cross(ray, ac);
  let determinant = dot(ab, rayCross);
  if (abs(determinant) <= 1e-8) { return vec3f(0.0); }
  let offset = eye - a.positionNormal.xyz;
  let q = cross(offset, ab);
  let t = dot(ac, q) / determinant;
  if (!(t > 0.0)) { return vec3f(0.0); }
  let u = dot(offset, rayCross) / determinant;
  let v = dot(ray, q) / determinant;
  let weights = clamp(vec3f(1.0 - u - v, u, v), vec3f(0.0), vec3f(1.0));
  let normal = normalize(octNormal(a.positionNormal.w) * weights.x +
    octNormal(b.positionNormal.w) * weights.y + octNormal(c.positionNormal.w) * weights.z) * sign(determinant);
  let toHit = ray * t;
  let world = eye + toHit;
  let plane = cross(ab, ac);
  let planeDistance = dot(plane, toHit);
  let dx = projectedOffset(ray + surface.rayX.xyz, plane, planeDistance, toHit) / m.scales.x;
  let dy = projectedOffset(ray + surface.rayY.xyz, plane, planeDistance, toHit) / m.scales.x;
  var uv = world / m.scales.x;
  var vertexTint = a.tint.rgb * weights.x + b.tint.rgb * weights.y + c.tint.rgb * weights.z;
  if (object == 0u) { vertexTint = landscapeTint(world); }
  var diffuse: vec3f;
  var n: vec3f;
  var roughness: f32;
  if (object == 2u) {
    let st = vec2f(uv.x, uv.z + uv.y * 0.18);
    let sx = vec2f(dx.x, dx.z + dx.y * 0.18);
    let sy = vec2f(dy.x, dy.z + dy.y * 0.18);
    diffuse = textureSampleGrad(roadColor, surfaceSampler, st, sx, sy).rgb;
    let nt = textureSampleGrad(roadNormal, surfaceSampler, st, sx, sy).xyz * 2.0 - 1.0;
    let tx = normalize(vec3f(normal.y, -normal.x, 0.0));
    let tz = cross(tx, normal);
    n = normalize(normal * nt.z + m.scales.y * (tx * nt.x + tz * nt.y));
    roughness = m.colorRoughness.w * textureSampleGrad(roadRoughness, surfaceSampler, st, sx, sy).g;
  } else {
    let projectionWeights = pow(abs(normal), vec3f(4.0));
    let weights = select(vec3f(0.0), projectionWeights, projectionWeights > vec3f(0.001));
    let w = weights / max(dot(weights, vec3f(1.0)), 0.0001);
    uv += (vec3f(noise(uv.yz * 0.19 + 8.3), noise(uv.xz * 0.19 + 41.7), noise(uv.xy * 0.19 + 19.2)) - 0.5) * 1.65;
    diffuse = triplanar(landscapeColor, uv, w, dx, dy);
    let distantGrain = smoothstep(65.0, 420.0, length(toHit)) * 0.78;
    if (distantGrain > 0.0) {
      let macroColor = triplanar(landscapeColor, uv * 0.071 + vec3f(4.7, 8.1, 2.3), w, dx * 0.071, dy * 0.071);
      diffuse = mix(diffuse, macroColor, distantGrain);
    }
    diffuse *= mix(0.87, 1.13, noise(world.xz * 0.007));
    let rock = (1.0 - smoothstep(0.58, 0.96, abs(normal.y))) * mix(0.48, 0.91, noise(world.xz * 0.015));
    if (rock > 0.0) {
      diffuse = mix(diffuse, triplanar(landscapeRock, uv * 0.57 + vec3f(12.6, 8.1, 2.7), w, dx * 0.57, dy * 0.57), rock);
    }
    let region = noise(world.xz * 0.0028 + vec2f(27.1, 8.3));
    let bedding = noise(vec2f(world.y * 0.018 + noise(world.xz * 0.004) * 3.7,
      dot(world.xz, vec2f(0.0017, 0.0024))));
    diffuse *= mix(vec3f(1.04, 1.01, 0.96), vec3f(0.78, 0.85, 0.71),
      smoothstep(0.32, 0.74, bedding) * (0.3 + 0.7 * region) * 0.66);
    let moss = smoothstep(0.12, 0.72, normal.y) *
      (1.0 - smoothstep(0.2, 0.8, dot(normal, vec3f(0.82, 0.0, 0.57)))) * noise(world.xz * 0.15);
    diffuse *= mix(vec3f(1.0), vec3f(0.68, 0.83, 0.54), moss * 0.44);
    var detail = vec3f(0.0);
    if (w.x > 0.0) {
      let nx = textureSampleGrad(landscapeNormal, surfaceSampler, uv.yz, dx.yz, dy.yz).xy * 2.0 - 1.0;
      detail += vec3f(0.0, nx) * w.x;
    }
    if (w.y > 0.0) {
      let ny = textureSampleGrad(landscapeNormal, surfaceSampler, uv.xz, dx.xz, dy.xz).xy * 2.0 - 1.0;
      detail += vec3f(ny.x, 0.0, ny.y) * w.y;
    }
    if (w.z > 0.0) {
      let nz = textureSampleGrad(landscapeNormal, surfaceSampler, uv.xy, dx.xy, dy.xy).xy * 2.0 - 1.0;
      detail += vec3f(nz, 0.0) * w.z;
    }
    n = normalize(normal + detail * m.scales.y);
    roughness = m.colorRoughness.w * mix(0.88, 1.0, triplanar(landscapeRoughness, uv, w, dx, dy).g);
  }
  return materialLighting(diffuse * m.colorRoughness.rgb * vertexTint, n, normalize(-ray),
    clamp(roughness, 0.09, 1.0));
}

@fragment
fn resolveSurface(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let coord = vec2u(position.xy);
  let x = coord.x % frame.size.x;
  let hit = visibleSurface(vec2u(x, coord.y));
  if (hit.x == 0u) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  if (coord.x >= frame.size.x) {
    let key = hit.y;
    return vec4f(vec3f(f32(key & 255u), f32((key >> 8u) & 255u), f32(key >> 16u)) / 255.0, 1.0);
  }
  let rgb = shadeSurface(hit.x, vec2f(f32(x) + 0.5, position.y));
  // Opaque RGBA8 canvas bridge, with a logarithmic code for linear HDR [0,16].
  return vec4f(clamp(log2(1.0 + max(rgb, vec3f(0.0)) * 32.0) / log2(513.0), vec3f(0.0), vec3f(1.0)), 1.0);
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
