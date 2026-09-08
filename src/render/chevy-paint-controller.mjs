import { createChevyWheelVisualRig } from '../game/chevy-wheel-visual-rig.mjs';

// V3 stores body paint, trim, glass and chrome in one atlas. The source orange
// pigment is isolated before recoloring; metallic and emissive pixels remain
// independent. The verified wheel partition excludes orange tread reflections.
export function createChevyPaintController(T, root, { color = '#d66a24', partitionWheels = true } = {}) {
  const entries = [], owned = [], materials = new Map();
  const uniform = { value: new T.Color('#d66a24') };
  let disposed = false, wheelRig = null;
  const initialMeshes = [];
  root.traverse(object => { if (object.isMesh) initialMeshes.push(object); });
  if (partitionWheels && initialMeshes.length === 1 && initialMeshes[0].geometry.getAttribute('position')?.count === 201686
      && initialMeshes[0].geometry.getIndex()?.count === 1135308) {
    wheelRig = createChevyWheelVisualRig(T, root);
  }
  root.traverse(object => {
    if (!object.isMesh || Array.isArray(object.material)) return;
    const original = object.material;
    const paintEnabled = !/_TireRim$/.test(object.name);
    let byKind = materials.get(original);
    if (!byKind) { byKind = new Map(); materials.set(original, byKind); }
    let material = byKind.get(paintEnabled);
    if (!material) {
      material = new T.MeshPhysicalMaterial();
      if (original.isMeshPhysicalMaterial) material.copy(original);
      else T.MeshStandardMaterial.prototype.copy.call(material, original);
      material.name = paintEnabled ? 'ChevyV3_IsolatedBodyPaint' : 'ChevyV3_OriginalTireChrome';
      material.clearcoat = paintEnabled ? .8 : .06;
      material.clearcoatRoughness = .17;
      material.normalScale?.set(.22, .22);
      material.emissiveIntensity = .035;
      material.envMapIntensity = 1.15;
      material.onBeforeCompile = shader => {
        original.onBeforeCompile?.call(material, shader);
        shader.uniforms.chevyPaintColor = uniform;
        shader.uniforms.chevyPaintEnabled = { value: paintEnabled ? 1 : 0 };
        shader.fragmentShader = 'uniform vec3 chevyPaintColor;\nuniform float chevyPaintEnabled;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec3 chevySourceColor = diffuseColor.rgb;
          float chevySourceMetal = 0.0;
          #ifdef USE_METALNESSMAP
            chevySourceMetal = texture2D(metalnessMap, vMetalnessMapUv).b;
          #endif
          float chevyEmission = 0.0;
          #ifdef USE_EMISSIVEMAP
            vec3 chevyE = texture2D(emissiveMap, vEmissiveMapUv).rgb;
            chevyEmission = max(chevyE.r, max(chevyE.g, chevyE.b));
          #endif
          float chevyPaintMask = chevyPaintEnabled
            * smoothstep(.025, .065, chevySourceColor.r)
            * smoothstep(1.9, 2.8, chevySourceColor.r / max(chevySourceColor.g, .0001))
            * smoothstep(.018, .05, chevySourceColor.g / max(chevySourceColor.r, .0001))
            * (1.0 - smoothstep(.32, .7, chevySourceColor.b / max(chevySourceColor.g, .0001)))
            * (1.0 - smoothstep(.12, .48, chevySourceMetal))
            * (1.0 - smoothstep(.04, .3, chevyEmission));
          float chevyShade = clamp(chevySourceColor.r, .08, 1.0);
          diffuseColor.rgb = mix(chevySourceColor, chevyPaintColor * chevyShade, chevyPaintMask);
          // The scan atlas has magenta baked into chrome. Neutral reflectance
          // lets the current environment supply its color instead.
          float chevyChrome = smoothstep(.55, .92, chevySourceMetal);
          float chevySilver = clamp(dot(chevySourceColor, vec3(.2126,.7152,.0722)), .32, .72);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(chevySilver), chevyChrome * .92);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, .28, chevyPaintMask);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize(mix(normal, nonPerturbedNormal, chevyPaintMask * .68));
        `);
      };
      material.customProgramCacheKey = () => `chevy-v3-isolated-paint-1:${paintEnabled}`;
      byKind.set(paintEnabled, material); owned.push(material);
    }
    object.material = material;
    entries.push({ object, original, material, paintEnabled });
  });
  const controller = {
    setColor(hex) {
      if (disposed || typeof hex !== 'string' || !/^#[a-f\d]{6}$/i.test(hex)) return false;
      uniform.value.set(hex); return true;
    },
    forEachMaterial(callback) { owned.forEach(callback); },
    diagnostics: () => ({ color: `#${uniform.value.getHexString()}`, disposed, materials: owned.length,
      paintMeshes: entries.filter(entry => entry.paintEnabled).length, wheelMeshesExcluded: entries.filter(entry => !entry.paintEnabled).length }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { object, original, material } of entries) if (object.material === material) object.material = original;
      for (const material of owned) material.dispose();
      wheelRig?.dispose();
    },
  };
  controller.setColor(color);
  return controller;
}
