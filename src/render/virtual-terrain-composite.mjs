import {terrainProjection} from '../tracks/visuals/reference-landscape.mjs?v=ada39f9cec1a7220';
import {MAX_PAGE_TRIANGLES, TRIANGLE_BYTES} from './virtual-terrain-data.mjs?v=09bc75160261c900';

const ATLAS_WIDTH = 256;
const ATLAS_HEIGHT = Math.ceil(MAX_PAGE_TRIANGLES * 3 / ATLAS_WIDTH);
const ATLAS_FLOATS = ATLAS_WIDTH * ATLAS_HEIGHT * 4;

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
`;

const fragmentStart = /* glsl */ `
  vec2 samplePixel = gl_FragCoord.xy - virtualTerrainViewport.xy;
  ivec2 pixel = ivec2(samplePixel);
  // The unflipped DOM canvas uploads its top row as WebGL texture row zero.
  pixel.y = int(virtualTerrainViewport.w) - 1 - pixel.y;
  uvec3 bits = uvec3(floor(texelFetch(virtualTerrainVisibility, pixel, 0).rgb * 255.0 + 0.5));
  uint reference = bits.r | (bits.g << 8u);
  if (reference == 0u || bits.b != virtualTerrainObject) discard;

  uint triangle = reference - 1u;
  uint slot = triangle / ${MAX_PAGE_TRIANGLES}u;
  uint vertex = (triangle % ${MAX_PAGE_TRIANGLES}u) * 3u;
  vec4 a = virtualVertex(slot, vertex);
  vec4 b = virtualVertex(slot, vertex + 1u);
  vec4 c = virtualVertex(slot, vertex + 2u);
  // Ray/triangle barycentrics work for clipped primitives too. Unproject the
  // pixel center and keep the ray parameter in units of view-space depth.
  vec2 clipXY = samplePixel / virtualTerrainViewport.zw * 2.0 - 1.0;
  vec3 ray = (virtualTerrainInverseProjection * vec4(clipXY, 0.0, 1.0)).xyz;
  vec3 viewRay = ray / -ray.z;
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
  // Clamp only the attributes near subpixel-quantized edges. Depth is always
  // the intersection with the original triangle plane.
  vec3 barycentric = clamp(vec3(1.0 - u - v, u, v), 0.0, 1.0);
  vec3 localNormal = barycentric.x * virtualOctNormal(a.w) +
    barycentric.y * virtualOctNormal(b.w) + barycentric.z * virtualOctNormal(c.w);
  vViewPosition = -viewRay * viewDepth;
  vLandscapeWorld = (virtualTerrainWorldFromLocal * vec4(localEye + localRay * viewDepth, 1.0)).xyz;
  vLandscapeNormal = normalize(virtualTerrainNormal * localNormal) * sign(determinant);
  #ifdef USE_FOG
    vFogDepth = viewDepth;
  #endif
`;

// Match the route's existing landscape projection, materials and light model.
// Vertex tint is evaluated in world space here because LODs change the vertices.
const tint = /* glsl */ `
  vec3 tintPoint = vLandscapeWorld;
  float tintMix = landscapeNoise(tintPoint.xz * .012);
  float tintGrain = landscapeNoise(tintPoint.xz * .035 + vec2(tintPoint.y * .014, 0.0));
  float tintBroad = landscapeNoise(tintPoint.xz * .0023);
  vec3 terrainTint = mix(vec3(.78, .88, .75), vec3(.96, .94, .86), tintMix) * (.94 + tintGrain * .12);
  diffuseColor.rgb *= mix(terrainTint, vec3(.86, .94, 1.02), tintBroad * .34);
`;

export function createVirtualTerrainComposite(THREE, source, canvas, {atlas, objectId}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  const uniforms = {
    virtualTerrainVisibility: {value: texture},
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
  const material = source.material.clone();
  material.name = 'Paso Garibaldi · terreno virtualizado';
  material.side = THREE.FrontSide;
  material.vertexColors = false;
  terrainProjection(material, source.material.userData.asfaltoSurfaceMetres, 1e8,
    source.material.asfaltoTerrainRockTexture ? {diff: source.material.asfaltoTerrainRockTexture} : null);
  const landscape = material.onBeforeCompile;
  const programKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => programKey + '|virtual-terrain-visibility';
  material.onBeforeCompile = shader => {
    landscape(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\ngl_Position = vec4(position.xy, 0.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vViewPosition;', 'vec3 vViewPosition;')
      .replace('varying vec3 vLandscapeWorld;', 'vec3 vLandscapeWorld;')
      .replace('varying vec3 vLandscapeNormal;', 'vec3 vLandscapeNormal;')
      .replace('#include <common>', '#include <common>\n' + reconstruct)
      .replace('#include <fog_pars_fragment>', THREE.ShaderChunk.fog_pars_fragment.replace('varying float vFogDepth;', 'float vFogDepth;'))
      .replace('#include <logdepthbuf_fragment>', fragmentStart)
      .replace('#include <alphamap_fragment>', tint + '\n#include <alphamap_fragment>')
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = 1.0;
        vec3 normal = normalize(mat3(viewMatrix) * vLandscapeNormal);
        vec3 nonPerturbedNormal = normal;
      `);
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ASFALTO_VIRTUAL_TERRAIN_RESOLVE';
  mesh.frustumCulled = false;
  mesh.renderOrder = 9000;
  mesh.visible = false;
  let width = 0;
  let height = 0;
  function releaseTexture() {
    if (width) texture.dispose();
    width = height = 0;
  }
  return {
    mesh,
    releaseViewport: releaseTexture,
    update(camera, viewport) {
      if (width !== viewport.z || height !== viewport.w) {
        releaseTexture();
        width = viewport.z;
        height = viewport.w;
      }
      texture.needsUpdate = true;
      uniforms.virtualTerrainViewport.value.copy(viewport);
      uniforms.virtualTerrainInverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.virtualTerrainLocalFromView.value.copy(source.matrixWorld).invert().multiply(camera.matrixWorld);
      uniforms.virtualTerrainWorldFromLocal.value.copy(source.matrixWorld);
      uniforms.virtualTerrainNormal.value.getNormalMatrix(source.matrixWorld);
      uniforms.virtualTerrainInverseLogFar.value = 1 / Math.log2(camera.far + 1);
      uniforms.virtualTerrainFar.value = camera.far * 1.000001;
      material.color.copy(source.material.color);
      material.roughness = source.material.roughness;
      material.envMapIntensity = source.material.envMapIntensity;
    },
    dispose() {
      mesh.removeFromParent();
      releaseTexture();
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createVirtualTerrainSurfaceComposite(THREE, canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.NoColorSpace;
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    surfacePacket: {value: texture},
    surfaceViewport: {value: new THREE.Vector4()},
    surfaceLogFar: {value: 0},
  };
  const material = new THREE.ShaderMaterial({
    name: 'Composición HDR de superficies WebGPU',
    uniforms,
    fog: true,
    vertexShader: 'void main(){gl_Position = vec4(position.xy, 0.0, 1.0);}',
    fragmentShader: /* glsl */ `
      uniform sampler2D surfacePacket;
      uniform vec4 surfaceViewport;
      uniform float surfaceLogFar;
      ${THREE.ShaderChunk.fog_pars_fragment.replace('varying float vFogDepth;', 'float vFogDepth;')}
      void main() {
        ivec2 pixel = ivec2(gl_FragCoord.xy - surfaceViewport.xy);
        pixel.y = int(surfaceViewport.w) - 1 - pixel.y;
        vec3 bits = floor(texelFetch(surfacePacket, pixel + ivec2(int(surfaceViewport.z), 0), 0).rgb * 255.0 + 0.5);
        float key = dot(bits, vec3(1.0, 256.0, 65536.0));
        if (key == 0.0) discard;
        float depth = (16777215.0 - key) / 16777214.0;
        gl_FragDepth = depth;
        #ifdef USE_FOG
          vFogDepth = exp2(depth * surfaceLogFar) - 1.0;
        #endif
        vec3 packed = texelFetch(surfacePacket, pixel, 0).rgb;
        gl_FragColor = vec4((exp2(packed * log2(513.0)) - 1.0) / 32.0, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ASFALTO_VIRTUAL_TERRAIN_SURFACE_RESOLVE';
  mesh.frustumCulled = false;
  mesh.renderOrder = 9000;
  mesh.visible = false;
  let width = 0, height = 0;
  function releaseViewport() {
    if (width) texture.dispose();
    width = height = 0;
  }
  return {
    mesh,
    releaseViewport,
    update(camera, viewport) {
      if (width !== viewport.z || height !== viewport.w) {
        releaseViewport();
        width = viewport.z;
        height = viewport.w;
      }
      texture.needsUpdate = true;
      uniforms.surfaceViewport.value.copy(viewport);
      uniforms.surfaceLogFar.value = Math.log2(camera.far + 1);
    },
    dispose() {
      mesh.removeFromParent();
      releaseViewport();
      geometry.dispose();
      material.dispose();
    },
  };
}
