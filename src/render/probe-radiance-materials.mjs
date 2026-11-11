import {PROBE_RADIANCE_RANGE, PROBE_SLABS} from './probe-radiance-input.mjs?v=83e589831e106c72';

const VARYING = 'varying vec3 vAnProbePosition;';
const POSITION = /* glsl */ `
vec4 anProbePosition = vec4(transformed, 1.);
#ifdef USE_BATCHING
anProbePosition = batchingMatrix * anProbePosition;
#endif
#ifdef USE_INSTANCING
anProbePosition = instanceMatrix * anProbePosition;
#endif
vAnProbePosition = (modelMatrix * anProbePosition).xyz;
`;
const DECLARATIONS = /* glsl */ `
uniform highp sampler3D anProbeAtlas;
uniform vec3 anProbeMin, anProbeExtent, anProbeDimensions;
uniform float anProbeStrength;
${VARYING}
vec4 anProbeRead(vec3 uv, float slab) {
  return texture(anProbeAtlas, vec3(uv.xy, (uv.z + slab) / ${PROBE_SLABS.toFixed(1)}));
}
`;
const LIGHTING = /* glsl */ `
if (anProbeStrength > .001) {
  vec3 anGrid = (vAnProbePosition - anProbeMin) / anProbeExtent;
  float anEdge = min(min(anGrid.x, 1.-anGrid.x), min(anGrid.z, 1.-anGrid.z));
  float anVertical = max(-anGrid.y, anGrid.y-1.) * anProbeExtent.y;
  float anWeight = smoothstep(0., .21, anEdge) * (1.-smoothstep(.45, 2.4, anVertical)) * anProbeStrength;
  if (anWeight > .001) {
    vec3 anProbeUv = (clamp(anGrid, 0., 1.) * (anProbeDimensions - 1.) + .5) / anProbeDimensions;
    vec3 anBounce = anProbeRead(anProbeUv, 0.).rgb * ${PROBE_RADIANCE_RANGE.toFixed(1)};
    reflectedLight.indirectDiffuse += material.diffuseColor * min(anBounce * .72, vec3(.28)) * anWeight;
    float anRough = smoothstep(.075, .21, roughnessFactor) * (1.-smoothstep(.62, .89, roughnessFactor));
    if (anRough > .015) {
      vec3 anN = inverseTransformDirection(normal, viewMatrix);
      vec3 anV = normalize(cameraPosition - vAnProbePosition);
      vec3 anR = reflect(-anV, anN);
      vec3 anAxis = anR * anR;
      vec4 anReflected = anAxis.x * anProbeRead(anProbeUv, anR.x >= 0. ? 1. : 2.)
                       + anAxis.y * anProbeRead(anProbeUv, anR.y >= 0. ? 3. : 4.)
                       + anAxis.z * anProbeRead(anProbeUv, anR.z >= 0. ? 5. : 6.);
      vec3 anFresnel = mix(material.specularColor, vec3(1.), pow(1.-clamp(dot(anN, anV),0.,1.), 5.));
      vec3 anSpecular = anFresnel * anReflected.rgb * ${PROBE_RADIANCE_RANGE.toFixed(1)} / max(.01, anReflected.a);
      reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, anSpecular, .62 * anWeight * anRough * anReflected.a);
    }
  }
}
`;

const eligible = material => material?.isMeshStandardMaterial && material.visible !== false
  && !material.transparent && !(material.alphaTest > 0) && !(material.transmission > 0);

export function createProbeMaterialBridge(T) {
  const uniforms = {
    anProbeAtlas: {value: null}, anProbeMin: {value: new T.Vector3()},
    anProbeExtent: {value: new T.Vector3(1, 1, 1)}, anProbeDimensions: {value: new T.Vector3(1, 2, 1)},
    anProbeStrength: {value: 0},
  };
  const patches = new Map();
  let size = 0, lastGrid = '', uploads = 0, covered = 0, energy = 0;

  function releasePatch(material, patch) {
    patch.active = false;
    if (material.onBeforeCompile === patch.hook) material.onBeforeCompile = patch.prior;
    if (material.customProgramCacheKey === patch.key) material.customProgramCacheKey = patch.priorKey;
    material.needsUpdate = true;
    patches.delete(material);
  }

  function setReceivers(roots) {
    const next = new Set();
    let changed = false;
    for (const root of roots) root?.traverse(node => {
      if (!node.isMesh || node.isSkinnedMesh) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (eligible(material)) next.add(material);
      }
    });
    for (const [material, patch] of patches) {
      if (!next.has(material)) { releasePatch(material, patch); changed = true; }
    }
    for (const material of next) {
      if (patches.has(material)) continue;
      const patch = {active: true, prior: material.onBeforeCompile, priorKey: material.customProgramCacheKey};
      const baseKey = patch.priorKey.call(material);
      patch.hook = function(shader, renderer) {
        patch.prior.call(this, shader, renderer);
        if (!patch.active || this !== material || shader.fragmentShader.includes('anProbeRead(')
          || !shader.vertexShader.includes('#include <project_vertex>') || !shader.fragmentShader.includes('#include <aomap_fragment>')) return;
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = VARYING + '\n' + shader.vertexShader.replace('#include <project_vertex>', POSITION + '\n#include <project_vertex>');
        shader.fragmentShader = DECLARATIONS + '\n' + shader.fragmentShader.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + LIGHTING);
      };
      patch.key = function() { return baseKey + (patch.active && this === material ? '|local-radiance-probes-v1' : ''); };
      material.onBeforeCompile = patch.hook;
      material.customProgramCacheKey = patch.key;
      material.needsUpdate = true;
      patches.set(material, patch);
      changed = true;
    }
    return changed;
  }

  function publish(grid, nextSize, data) {
    const key = grid.origin.join(',');
    if (size !== nextSize) {
      uniforms.anProbeAtlas.value?.dispose();
      const texture = new T.Data3DTexture(new Uint8Array(data.length), nextSize, 2, nextSize * PROBE_SLABS);
      texture.name = 'Local radiance from WebGPU';
      texture.minFilter = texture.magFilter = T.LinearFilter;
      texture.colorSpace = T.NoColorSpace;
      texture.generateMipmaps = false;
      texture.unpackAlignment = 1;
      uniforms.anProbeAtlas.value = texture;
      size = nextSize;
      lastGrid = '';
    }
    const texture = uniforms.anProbeAtlas.value, bytes = texture.image.data;
    if (key === lastGrid) {
      for (let index = 0; index < bytes.length; index++) bytes[index] = Math.round(bytes[index] * .28 + data[index] * .72);
    } else bytes.set(data);
    covered = 0; energy = 0;
    for (let index = 0; index < bytes.length; index += 4) {
      if (bytes[index + 3] > 0) covered++;
      energy += bytes[index] + bytes[index + 1] + bytes[index + 2];
    }
    lastGrid = key;
    texture.needsUpdate = true;
    uniforms.anProbeMin.value.fromArray(grid.origin);
    uniforms.anProbeExtent.value.fromArray(grid.extent);
    uniforms.anProbeDimensions.value.set(size, 2, size);
    uniforms.anProbeStrength.value = 1;
    uploads++;
  }

  function invalidate() {
    uniforms.anProbeStrength.value = 0;
    lastGrid = ''; covered = 0; energy = 0;
  }

  function clear() {
    invalidate();
    uniforms.anProbeAtlas.value?.dispose();
    uniforms.anProbeAtlas.value = null;
    size = 0;
    for (const [material, patch] of patches) releasePatch(material, patch);
  }
  return {publish, setReceivers, invalidate, clear,
    diagnostics: () => ({textureBytes: uniforms.anProbeAtlas.value?.image.data.byteLength || 0,
      uploads, materialCount: patches.size, coveredTexels: covered, radianceEnergy: energy})};
}
