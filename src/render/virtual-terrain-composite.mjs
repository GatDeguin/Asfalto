import {terrainProjection} from '../tracks/visuals/reference-landscape.mjs?v=30a528c61c10745d';

const reconstruct = /* glsl */ `
uniform sampler2D virtualTerrainPixels;
uniform vec4 virtualTerrainViewport;
uniform mat4 virtualTerrainInverseProjection;
uniform mat4 virtualTerrainCameraWorld;
uniform mat3 virtualTerrainNormal;
uniform float virtualTerrainLogFar;

vec3 virtualOctNormal(vec2 oct) {
  vec2 f = oct * 2.0 - 1.0;
  float z = 1.0 - abs(f.x) - abs(f.y);
  if (z < 0.0) f = (1.0 - abs(f.yx)) * mix(vec2(-1.0), vec2(1.0), greaterThanEqual(f, vec2(0.0)));
  return normalize(vec3(f, z));
}
`;

const fragmentStart = /* glsl */ `
  vec2 samplePixel = gl_FragCoord.xy - virtualTerrainViewport.xy;
  ivec2 pixel = ivec2(samplePixel);
  int width = int(virtualTerrainViewport.z);
  // The unflipped DOM canvas uploads its top row as WebGL texture row zero.
  pixel.y = int(virtualTerrainViewport.w) - 1 - pixel.y;
  vec3 bits = floor(texelFetch(virtualTerrainPixels, pixel, 0).rgb * 255.0 + 0.5);
  float key = dot(bits, vec3(1.0, 256.0, 65536.0));
  if (key == 0.0) discard;
  float logDepth = (16777215.0 - key) / 16777214.0;
  gl_FragDepth = logDepth;
  float viewDepth = exp2(logDepth * virtualTerrainLogFar) - 1.0;
  vec2 clipXY = samplePixel / virtualTerrainViewport.zw * 2.0 - 1.0;
  vec4 ray = virtualTerrainInverseProjection * vec4(clipXY, 1.0, 1.0);
  vec3 viewPoint = ray.xyz * (viewDepth / -ray.z);
  vViewPosition = -viewPoint;
  vLandscapeWorld = (virtualTerrainCameraWorld * vec4(viewPoint, 1.0)).xyz;
  vec2 oct = texelFetch(virtualTerrainPixels, pixel + ivec2(width, 0), 0).rg;
  vLandscapeNormal = normalize(virtualTerrainNormal * virtualOctNormal(oct));
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

export function createVirtualTerrainComposite(THREE, source, canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  const uniforms = {
    virtualTerrainPixels: {value: texture},
    virtualTerrainViewport: {value: new THREE.Vector4()},
    virtualTerrainInverseProjection: {value: new THREE.Matrix4()},
    virtualTerrainCameraWorld: {value: new THREE.Matrix4()},
    virtualTerrainNormal: {value: new THREE.Matrix3()},
    virtualTerrainLogFar: {value: 0},
  };
  const material = source.material.clone();
  material.name = 'Paso Garibaldi · terreno virtualizado';
  material.side = THREE.FrontSide;
  material.vertexColors = false;
  terrainProjection(material, source.material.userData.asfaltoSurfaceMetres, 1e8,
    source.material.asfaltoTerrainRockTexture ? {diff: source.material.asfaltoTerrainRockTexture} : null);
  const landscape = material.onBeforeCompile;
  const programKey = material.customProgramCacheKey();
  material.customProgramCacheKey = () => programKey + '|virtual-terrain-v1';
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
      uniforms.virtualTerrainCameraWorld.value.copy(camera.matrixWorld);
      uniforms.virtualTerrainNormal.value.getNormalMatrix(source.matrixWorld);
      uniforms.virtualTerrainLogFar.value = Math.log2(camera.far + 1);
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
