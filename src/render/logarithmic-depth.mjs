// Custom ShaderMaterials need explicit depth chunks when the world spans centimetres to kilometres.
// Built-in Three materials already include these chunks, including our onBeforeCompile terrain pass.
export function enableCustomLogarithmicDepth(material) {
  if (!material?.isShaderMaterial) return false;
  if (!material.vertexShader.includes('#include <logdepthbuf_vertex>')) {
    const common = material.vertexShader.includes('#include <common>') ? '' : '#include <common>\n';
    material.vertexShader = common + '#include <logdepthbuf_pars_vertex>\n' + material.vertexShader.replace(/}\s*$/, '\n#include <logdepthbuf_vertex>\n}');
  }
  if (!material.fragmentShader.includes('#include <logdepthbuf_fragment>')) {
    material.fragmentShader = '#include <logdepthbuf_pars_fragment>\n' + material.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*{/, 'void main(){\n#include <logdepthbuf_fragment>\n');
  }
  material.needsUpdate = true;
  return true;
}
