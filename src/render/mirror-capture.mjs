import {createOpaqueTransmission} from './opaque-transmission.mjs?v=74188532df76e9a7';
import {createScreenSpaceTarget, supportsScreenSpaceHDR} from './screen-space-targets.mjs?v=6da4d0d78fe83c9e';
import {compileVisiblePass} from './pass-preparation.mjs?v=5e96c4931974c8ab';

// Keep the display target and its color space. The linear intermediate holds
// the same view at the same resolution, including the opaque depth needed by
// physical refraction. Each feed owns its size and can be updated independently.
export function createMirrorCapture(T) {
  const captures = new Map();
  let owner = null;
  let resolve = null;
  let reusedFrames = 0;
  function suspend() {
    for (const {target, refraction} of captures.values()) {
      refraction.release();
      target.dispose();
    }
    captures.clear();
    if (resolve) resolve.uniforms.mirrorColor.value = null;
    owner = null;
  }
  function captureFor(renderer, display) {
    if (owner !== renderer) {
      suspend();
      owner = renderer;
    }
    let capture = captures.get(display);
    if (!capture) {
      const target = createScreenSpaceTarget(T, display.width, display.height, 'ASFALTO_MIRROR_REFRACTION', {color: true});
      capture = {target, refraction: createOpaqueTransmission(T, renderer)};
      captures.set(display, capture);
    } else if (capture.target.width !== display.width || capture.target.height !== display.height) {
      capture.target.setSize(display.width, display.height);
    }
    return capture;
  }
  function resolvePass() {
    if (resolve) return resolve;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0], 3));
    const uniforms = {mirrorColor: {value: null}};
    const material = new T.ShaderMaterial({
      name: 'ASFALTO_MIRROR_DISPLAY', uniforms, depthTest: false, depthWrite: false,
      toneMapped: false, blending: T.NoBlending,
      vertexShader: 'varying vec2 mirrorUv;void main(){mirrorUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: 'uniform sampler2D mirrorColor;varying vec2 mirrorUv;void main(){gl_FragColor=texture2D(mirrorColor,mirrorUv);}',
    });
    const scene = new T.Scene(), camera = new T.Camera(), mesh = new T.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return resolve = {geometry, material, uniforms, scene, camera};
  }
  function draw(renderer, scene, camera, display, prepareOnly = false) {
    const useLinear = renderer.transmissionResolutionScale === 1 && supportsScreenSpaceHDR(renderer);
    if (!useLinear) {
      if (owner) suspend();
      renderer.setRenderTarget(display);
      renderer.setScissorTest(false);
      if (prepareOnly) return compileVisiblePass(renderer, scene, camera);
      renderer.clear(true, true, true);
      return renderer.render(scene, camera);
    }
    const {target, refraction} = captureFor(renderer, display);
    const pass = resolvePass();
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    if (prepareOnly) {
      const world = compileVisiblePass(renderer, scene, camera);
      renderer.setRenderTarget(display);
      return Promise.all([world, compileVisiblePass(renderer, pass.scene, pass.camera)]);
    }
    renderer.clear(true, true, true);
    const before = refraction.diagnostics().captures;
    refraction.draw(target, () => renderer.render(scene, camera));
    reusedFrames += refraction.diagnostics().captures - before;
    pass.uniforms.mirrorColor.value = target.texture;
    renderer.setRenderTarget(display);
    renderer.render(pass.scene, pass.camera);
  }
  return {
    draw, suspend,
    diagnostics: () => ({linearTargets: captures.size, reusedFrames}),
    dispose() {
      suspend();
      resolve?.geometry.dispose();
      resolve?.material.dispose();
      resolve = null;
    },
  };
}
