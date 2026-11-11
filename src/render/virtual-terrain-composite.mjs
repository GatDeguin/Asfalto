import {terrainProjection} from '../tracks/visuals/reference-landscape.mjs?v=ada39f9cec1a7220';
import {MAX_PAGE_TRIANGLES, TRIANGLE_BYTES, VISIBILITY_OBJECT_SHIFT, VISIBILITY_TRIANGLE_MASK,
  VISTA_OBJECT_SHIFT, VISTA_TRIANGLE_MASK}
  from './virtual-terrain-data.mjs?v=3cb3d32add0067b4';

const ATLAS_WIDTH = 256;
const ATLAS_HEIGHT = Math.ceil(MAX_PAGE_TRIANGLES * 3 / ATLAS_WIDTH);
const ATLAS_FLOATS = ATLAS_WIDTH * ATLAS_HEIGHT * 4;
const STATIC_WIDTH = 1024;

/** A WebGL layer for each WebGPU residency slot. Detail updates touch one layer. */
export function createVirtualTerrainAtlas(THREE, slots) {
  const data = new Float32Array(slots * ATLAS_FLOATS);
  const texture = new THREE.DataArrayTexture(data, ATLAS_WIDTH, ATLAS_HEIGHT, slots);
  texture.name = 'ASFALTO_VIRTUAL_TERRAIN_VERTEX_ATLAS';
  texture.type = THREE.FloatType;
  texture.format = THREE.RGBAFormat;
  texture.colorSpace = THREE.NoColorSpace;
  let initialized = false;
  texture.onUpdate = () => { initialized = true; };
  return {
    texture,
    bytes: data.byteLength,
    upload(slot, vertices) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= slots || !(vertices instanceof Float32Array) ||
        !vertices.byteLength || vertices.byteLength % TRIANGLE_BYTES || vertices.byteLength > MAX_PAGE_TRIANGLES * TRIANGLE_BYTES) {
        throw new RangeError('La página de atributos no coincide con la reserva de visibilidad.');
      }
      data.set(vertices, slot * ATLAS_FLOATS);
      if (initialized) texture.addLayerUpdate(slot);
      texture.needsUpdate = true;
    },
    dispose() { texture.dispose(); },
  };
}

/** The authored triangle order is identical in the WebGPU and WebGL atlases. */
export function createSurfaceVisibilityAtlas(THREE, {vertices, indices}, maxTextureSize) {
  const stride = STATIC_WIDTH * 4;
  const vertexRows = Math.ceil(vertices.length / stride);
  const triangleRows = Math.ceil(indices.length / (STATIC_WIDTH * 3));
  if (Math.max(STATIC_WIDTH, vertexRows, triangleRows) > maxTextureSize) {
    throw new RangeError('Atlas de visibilidad fuera del presupuesto de texturas WebGL.');
  }
  const attributes = new Float32Array(vertexRows * stride);
  const corners = new Uint32Array(triangleRows * stride);
  attributes.set(vertices);
  for (let i = 0, t = 0; i < indices.length; i += 3, t += 4) {
    corners[t] = indices[i];
    corners[t + 1] = indices[i + 1];
    corners[t + 2] = indices[i + 2];
  }
  const vertexTexture = new THREE.DataTexture(attributes, STATIC_WIDTH, vertexRows, THREE.RGBAFormat, THREE.FloatType);
  const triangleTexture = new THREE.DataTexture(corners, STATIC_WIDTH, triangleRows, THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
  vertexTexture.name = 'ASFALTO_SURFACE_VERTEX_ATLAS';
  triangleTexture.name = 'ASFALTO_SURFACE_TRIANGLE_ATLAS';
  vertexTexture.needsUpdate = triangleTexture.needsUpdate = true;
  return {
    vertices: vertexTexture,
    triangles: triangleTexture,
    bytes: attributes.byteLength + corners.byteLength,
    dispose() { vertexTexture.dispose(); triangleTexture.dispose(); },
  };
}

const reconstruct = /* glsl */ `
uniform sampler2D virtualTerrainVisibility;
uniform highp sampler2DArray virtualTerrainVertices;
uniform uint virtualTerrainObject;
uniform vec4 virtualTerrainViewport;
uniform mat4 virtualTerrainInverseProjection;
uniform mat4 virtualTerrainLocalFromView;
uniform mat4 virtualTerrainWorldFromLocal;
uniform mat3 virtualTerrainNormal;
uniform float virtualTerrainInverseLogFar;
uniform float virtualTerrainFar;

vec4 virtualVertex(uint slot, uint vertex) {
  return texelFetch(virtualTerrainVertices, ivec3(int(vertex % ${ATLAS_WIDTH}u), int(vertex / ${ATLAS_WIDTH}u), int(slot)), 0);
}

vec3 virtualOctNormal(float packedNormal) {
  uint bits = uint(packedNormal);
  vec2 f = vec2(float(bits & 255u), float(bits >> 8u)) * (2.0 / 255.0) - 1.0;
  float z = 1.0 - abs(f.x) - abs(f.y);
  if (z < 0.0) f = (1.0 - abs(f.yx)) * mix(vec2(-1.0), vec2(1.0), greaterThanEqual(f, vec2(0.0)));
  return normalize(vec3(f, z));
}

vec3 virtualViewRay(vec2 pixel) {
  vec2 clipXY = pixel / virtualTerrainViewport.zw * 2.0 - 1.0;
  vec3 ray = (virtualTerrainInverseProjection * vec4(clipXY, 0.0, 1.0)).xyz;
  return ray / -ray.z;
}
`;

const staticGeometry = /* glsl */ `
uniform highp usampler2D virtualSurfaceTriangles;
uniform highp sampler2D virtualSurfaceVertices;

ivec2 virtualStaticCoord(uint address) {
  return ivec2(int(address % ${STATIC_WIDTH}u), int(address / ${STATIC_WIDTH}u));
}

vec4 virtualStaticVertex(uint vertex, uint component) {
  return texelFetch(virtualSurfaceVertices, virtualStaticCoord(vertex * 2u + component), 0);
}
`;

const readVisibility = (objectShift, triangleMask) => /* glsl */ `
  vec2 samplePixel = gl_FragCoord.xy - virtualTerrainViewport.xy;
  ivec2 pixel = ivec2(samplePixel);
  // The unflipped canvas uploads its top row as WebGL texture row zero.
  pixel.y = int(virtualTerrainViewport.w) - 1 - pixel.y;
  uvec3 bits = uvec3(floor(texelFetch(virtualTerrainVisibility, pixel, 0).rgb * 255.0 + 0.5));
  uint visibility = bits.r | (bits.g << 8u) | (bits.b << 16u);
  uint objectId = visibility >> ${objectShift}u;
  uint reference = visibility & ${triangleMask}u;
  if (reference == 0u) discard;
  uint triangle = reference - 1u;
`;

const readVista = /* glsl */ `
  uint slot = triangle / ${MAX_PAGE_TRIANGLES}u;
  uint vertex = (triangle % ${MAX_PAGE_TRIANGLES}u) * 3u;
  a = virtualVertex(slot, vertex);
  b = virtualVertex(slot, vertex + 1u);
  c = virtualVertex(slot, vertex + 2u);
`;

const readStatic = /* glsl */ `
  corners = texelFetch(virtualSurfaceTriangles, virtualStaticCoord(triangle), 0).xyz;
  a = virtualStaticVertex(corners.x, 0u);
  b = virtualStaticVertex(corners.y, 0u);
  c = virtualStaticVertex(corners.z, 0u);
`;

const intersection = /* glsl */ `
  // Ray/triangle barycentrics work for clipped primitives too. The ray
  // parameter stays in units of view-space depth.
  vec3 viewRay = virtualViewRay(samplePixel);
  vec3 localRay = mat3(virtualTerrainLocalFromView) * viewRay;
  vec3 localEye = virtualTerrainLocalFromView[3].xyz;
  vec3 ab = b.xyz - a.xyz;
  vec3 ac = c.xyz - a.xyz;
  vec3 p = cross(localRay, ac);
  float determinant = dot(ab, p);
  if (abs(determinant) < 1e-8) discard;
  vec3 offset = localEye - a.xyz;
  vec3 q = cross(offset, ab);
  float viewDepth = dot(ac, q) / determinant;
  if (!(viewDepth > 0.0 && viewDepth <= virtualTerrainFar)) discard;
  gl_FragDepth = clamp(log2(1.0 + viewDepth) * virtualTerrainInverseLogFar, 0.0, 1.0);

  float u = dot(offset, p) / determinant;
  float v = dot(localRay, q) / determinant;
  // Keep attributes inside the triangle at subpixel-quantized edges.
  vec3 barycentric = clamp(vec3(1.0 - u - v, u, v), 0.0, 1.0);
  barycentric /= dot(barycentric, vec3(1.0));
  vec3 localNormal = barycentric.x * virtualOctNormal(a.w) +
    barycentric.y * virtualOctNormal(b.w) + barycentric.z * virtualOctNormal(c.w);
  vViewPosition = -viewRay * viewDepth;
  vLandscapeWorld = (virtualTerrainWorldFromLocal * vec4(localEye + localRay * viewDepth, 1.0)).xyz;
  vLandscapeNormal = normalize(virtualTerrainNormal * localNormal) * sign(determinant);
  #ifdef USE_FOG
    vFogDepth = viewDepth;
  #endif
`;

const vistaTint = /* glsl */ `
  vec3 tintPoint = vLandscapeWorld;
  float tintMix = landscapeNoise(tintPoint.xz * .012);
  float tintGrain = landscapeNoise(tintPoint.xz * .035 + vec2(tintPoint.y * .014, 0.0));
  float tintBroad = landscapeNoise(tintPoint.xz * .0023);
  vec3 terrainTint = mix(vec3(.78, .88, .75), vec3(.96, .94, .86), tintMix) * (.94 + tintGrain * .12);
  diffuseColor.rgb *= mix(terrainTint, vec3(.86, .94, 1.02), tintBroad * .34);
`;

const staticTint = /* glsl */ `
  diffuseColor.rgb *= barycentric.x * virtualStaticVertex(corners.x, 1u).rgb +
    barycentric.y * virtualStaticVertex(corners.y, 1u).rgb +
    barycentric.z * virtualStaticVertex(corners.z, 1u).rgb;
`;

const roadCoordinates = /* glsl */ `
uniform float virtualRoadMetres;
vec3 vLandscapeWorld;
vec3 vLandscapeNormal;

vec2 virtualRoadProjection(vec3 point) {
  return vec2(point.x, point.z + point.y * 0.18) / virtualRoadMetres;
}

vec3 virtualRoadStep(vec2 pixel, vec3 plane, float numerator, vec3 hit) {
  vec3 ray = mat3(virtualTerrainLocalFromView) * virtualViewRay(pixel);
  float d = dot(ray, plane);
  if (abs(d) <= 1e-8) return vec3(0.0);
  return clamp(ray * (numerator / d) - hit, vec3(-200.0), vec3(200.0));
}
`;

const roadMap = /* glsl */ `
  // Match the metric UVs of the authored road. Derive mip gradients from
  // this triangle's plane, even at a boundary with another object.
  vec3 plane = cross(ab, ac);
  float numerator = dot(plane, localRay * viewDepth);
  vec2 roadUV = virtualRoadProjection(vLandscapeWorld);
  vec2 roadDx = virtualRoadProjection(virtualRoadStep(samplePixel + vec2(1., 0.), plane, numerator, localRay * viewDepth));
  vec2 roadDy = virtualRoadProjection(virtualRoadStep(samplePixel + vec2(0., 1.), plane, numerator, localRay * viewDepth));
  #ifdef USE_MAP
    diffuseColor *= textureGrad(map, roadUV, roadDx, roadDy);
  #endif
`;

function makeVisibilityPacket(THREE, canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  let width = 0;
  let height = 0;
  function releaseViewport() {
    if (width) texture.dispose();
    width = height = 0;
  }
  return {
    texture, releaseViewport,
    update(viewport) {
      if (width !== viewport.z || height !== viewport.w) {
        releaseViewport();
        width = viewport.z;
        height = viewport.w;
      }
      texture.needsUpdate = true;
    },
  };
}

function makeResolver(THREE, source, packet, atlas, {objectId = 1, authored = null, road = false} = {}) {
  const original = source.material;
  const uniforms = {
    virtualTerrainVisibility: {value: packet.texture},
    virtualTerrainVertices: {value: atlas.texture},
    virtualTerrainObject: {value: objectId},
    virtualTerrainViewport: {value: new THREE.Vector4()},
    virtualTerrainInverseProjection: {value: new THREE.Matrix4()},
    virtualTerrainLocalFromView: {value: new THREE.Matrix4()},
    virtualTerrainWorldFromLocal: {value: new THREE.Matrix4()},
    virtualTerrainNormal: {value: new THREE.Matrix3()},
    virtualTerrainInverseLogFar: {value: 0},
    virtualTerrainFar: {value: 0},
  };
  if (authored) {
    uniforms.virtualSurfaceTriangles = {value: authored.triangles};
    uniforms.virtualSurfaceVertices = {value: authored.vertices};
  }
  if (road) uniforms.virtualRoadMetres = {value: original.userData.asfaltoSurfaceMetres};
  const material = original.clone();
  material.name = road ? 'Asfalto · calzada por visibilidad' : 'Asfalto · terreno por visibilidad';
  material.side = THREE.FrontSide;
  material.vertexColors = false;
  if (!road) terrainProjection(material, original.userData.asfaltoSurfaceMetres, 1e8,
    original.asfaltoTerrainRockTexture ? {diff: original.asfaltoTerrainRockTexture} : null);
  const landscape = material.onBeforeCompile;
  const programKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => programKey + '|visibility-' + (road ? 'road' : authored ? 'surfaces' : 'vista');
  const readId = authored ? readVisibility(VISIBILITY_OBJECT_SHIFT, VISIBILITY_TRIANGLE_MASK) :
    readVisibility(VISTA_OBJECT_SHIFT, VISTA_TRIANGLE_MASK);
  const vertices = road ? `if (objectId != virtualTerrainObject) discard;\nuvec3 corners;\n${readStatic}` :
    authored ? `if (objectId != 1u && objectId != 3u && objectId != 4u) discard;\nuvec3 corners;\n
      if (objectId == 1u) { ${readVista} } else { ${readStatic} }` :
      `if (objectId != virtualTerrainObject) discard;\n${readVista}`;
  const tint = road ? staticTint : authored ?
    `if (objectId == 1u) { ${vistaTint} } else { ${staticTint} }` : vistaTint;
  material.onBeforeCompile = shader => {
    if (!road) landscape(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\ngl_Position = vec4(position.xy, 0.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vViewPosition;', 'vec3 vViewPosition;')
      .replace('varying vec3 vLandscapeWorld;', 'vec3 vLandscapeWorld;')
      .replace('varying vec3 vLandscapeNormal;', 'vec3 vLandscapeNormal;')
      .replace('#include <common>', '#include <common>\n' + reconstruct + (authored ? staticGeometry : '') +
        (road ? roadCoordinates : ''))
      .replace('#include <fog_pars_fragment>', THREE.ShaderChunk.fog_pars_fragment.replace('varying float vFogDepth;', 'float vFogDepth;'))
      .replace('#include <logdepthbuf_fragment>', readId + '\nvec4 a, b, c;\n' + vertices + intersection)
      .replace('#include <alphamap_fragment>', tint + '\n#include <alphamap_fragment>')
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = 1.0;
        vec3 normal = normalize(mat3(viewMatrix) * vLandscapeNormal);
        vec3 nonPerturbedNormal = normal;
      `);
    if (road) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', roadMap)
        .replace('#include <roughnessmap_fragment>', `
          float roughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
            roughnessFactor *= textureGrad(roughnessMap, roadUV, roadDx, roadDy).g;
          #endif
        `)
        .replace('#include <normal_fragment_maps>', `
          #ifdef USE_NORMALMAP
            vec3 detail = textureGrad(normalMap, roadUV, roadDx, roadDy).xyz * 2.0 - 1.0;
            detail.xy *= normalScale;
            vec3 tangent = normalize(cross(vLandscapeNormal, vec3(0.0, 0.18, 1.0)));
            vec3 bitangent = normalize(cross(vec3(1.0, 0.0, 0.0), vLandscapeNormal));
            normal = normalize(mat3(viewMatrix) * mat3(tangent, bitangent, vLandscapeNormal) * detail);
          #endif
        `);
    }
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = road ? 'ASFALTO_VIRTUAL_TERRAIN_ROAD_RESOLVE' : authored ?
    'ASFALTO_VIRTUAL_TERRAIN_SURFACE_RESOLVE' : 'ASFALTO_VIRTUAL_TERRAIN_RESOLVE';
  mesh.frustumCulled = false;
  mesh.renderOrder = 9000;
  mesh.visible = false;
  return {
    mesh,
    update(camera, viewport) {
      uniforms.virtualTerrainViewport.value.copy(viewport);
      uniforms.virtualTerrainInverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.virtualTerrainLocalFromView.value.copy(source.matrixWorld).invert().multiply(camera.matrixWorld);
      uniforms.virtualTerrainWorldFromLocal.value.copy(source.matrixWorld);
      uniforms.virtualTerrainNormal.value.getNormalMatrix(source.matrixWorld);
      uniforms.virtualTerrainInverseLogFar.value = 1 / Math.log2(camera.far + 1);
      uniforms.virtualTerrainFar.value = camera.far * 1.000001;
      material.color.copy(original.color);
      material.roughness = original.roughness;
      material.metalness = original.metalness;
      material.normalScale.copy(original.normalScale);
      material.envMapIntensity = original.envMapIntensity;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createVirtualTerrainComposite(THREE, source, canvas, {atlas, objectId}) {
  const packet = makeVisibilityPacket(THREE, canvas);
  const resolver = makeResolver(THREE, source, packet, atlas, {objectId});
  return {
    mesh: resolver.mesh,
    meshes: [resolver.mesh],
    releaseViewport: packet.releaseViewport,
    update(camera, viewport) { packet.update(viewport); resolver.update(camera, viewport); },
    dispose() { resolver.dispose(); packet.releaseViewport(); },
  };
}

export function createVirtualTerrainSurfaceComposite(THREE, sources, canvas, {atlas, geometry, maxTextureSize}) {
  const [vista, road, ...sheets] = sources;
  const terrain = vista.material;
  const metres = terrain.userData.asfaltoSurfaceMetres;
  const roadMetres = road.material.userData.asfaltoSurfaceMetres;
  function compatible() {
    return terrain.userData.asfaltoSurfaceMetres === metres && road.material.userData.asfaltoSurfaceMetres === roadMetres &&
      sheets.every(({material}) => material.userData.asfaltoSurfaceMetres === metres &&
        material.color.equals(terrain.color) && material.normalScale.equals(terrain.normalScale) &&
        material.roughness === terrain.roughness && material.metalness === terrain.metalness &&
        material.envMapIntensity === terrain.envMapIntensity &&
        material.map === terrain.map && material.normalMap === terrain.normalMap && material.roughnessMap === terrain.roughnessMap &&
        material.asfaltoTerrainRockTexture === terrain.asfaltoTerrainRockTexture);
  }
  if (!(metres > 0 && roadMetres > 0 && compatible())) {
    throw new Error('Materiales de calzada y terreno incompatibles con el búfer de visibilidad.');
  }
  const authored = createSurfaceVisibilityAtlas(THREE, geometry, maxTextureSize);
  const packet = makeVisibilityPacket(THREE, canvas);
  const resolvers = [
    makeResolver(THREE, vista.mesh, packet, atlas, {authored}),
    makeResolver(THREE, road.mesh, packet, atlas, {authored, road: true, objectId: road.id}),
  ];
  return {
    compatible,
    attributeBytes: authored.bytes,
    meshes: resolvers.map(({mesh}) => mesh),
    releaseViewport: packet.releaseViewport,
    update(camera, viewport) {
      packet.update(viewport);
      for (const resolver of resolvers) resolver.update(camera, viewport);
    },
    dispose() {
      for (const resolver of resolvers) resolver.dispose();
      authored.dispose();
      packet.releaseViewport();
    },
  };
}
