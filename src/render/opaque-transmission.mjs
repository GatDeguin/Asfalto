// The app ships Three r180 in workshop-bootstrap.json. Keep its renderer and
// render lists, adding a single callback between opaque and transmissive draws.
const rendererAnchors = [
  ['function Ke(e,t,n,r){const i=e.opaque',
    'function Ke(e,t,n,r,afterOpaque){const i=e.opaque'],
  ['r&&ce.viewport(O.copy(r)),i.length>0&&je(i,t,n),a.length>0&&je(a,t,n)',
    'r&&ce.viewport(O.copy(r)),i.length>0&&je(i,t,n),afterOpaque?.(),a.length>0&&je(a,t,n)'],
  ['}else i.length>0&&qe(r,i,e,t),ae&&be.render(e),Ke(x,e,t);null!==w',
    `}else{
      const refraction=C.asfaltoOpaqueTransmission;
      if(i.length>0&&refraction?.canReuse(w,e,t)){
        const slots=R.state.transmissionRenderTarget, previous=slots[t.id];
        let published=false;
        try{
          if(ae)be.render(e);
          Ke(x,e,t,void 0,()=>{
            if(!refraction.capture({
              source:w,items:i,camera:t,
              renderBackFaces:!se.has("WEBGL_multisampled_render_to_texture"),
              bind:target=>{slots[t.id]=target;published=true},
              mipmaps:target=>pe.updateRenderTargetMipmap(target),
              drawBack:item=>Ze(item.object,e,t,item.geometry,item.material,item.group)
            }))qe(r,i,e,t);
          });
        }finally{
          if(published){
            if(previous===void 0)delete slots[t.id];
            else slots[t.id]=previous;
          }
        }
      }else{
        if(i.length>0)qe(r,i,e,t);
        if(ae)be.render(e);
        Ke(x,e,t);
      }
    }null!==w`],
];

export function patchOpaqueTransmissionSource(source) {
  for (const [anchor] of rendererAnchors) {
    const index = source.indexOf(anchor);
    if (index < 0 || index !== source.lastIndexOf(anchor)) return source;
  }
  for (const [anchor, replacement] of rendererAnchors) source = source.replace(anchor, replacement);
  return source;
}

export function createOpaqueTransmission(THREE, view) {
  const renderer = view.__rawRenderer ?? view;
  let currentSource = null;
  let opaque = null;
  let withBackFaces = null;
  let captures = 0, copies = 0, backs = 0;

  function makeTarget(name, depth) {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: depth,
      stencilBuffer: false,
      depthTexture: depth ? new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) : null,
    });
    target.texture.name = name;
    target.texture.internalFormat = 'RGBA16F';
    return target;
  }

  function canReuse(source, scene, camera) {
    const {background} = scene;
    return Boolean(source && source === currentSource && !scene.overrideMaterial && !camera.viewport &&
      source.isWebGLRenderTarget && source.texture.type === THREE.HalfFloatType &&
      source.texture.colorSpace === THREE.LinearSRGBColorSpace &&
      source.depthTexture?.format === THREE.DepthFormat && source.depthTexture.type === THREE.UnsignedIntType &&
      !source.stencilBuffer && source.textures.length === 1 && renderer.getActiveMipmapLevel() === 0 &&
      renderer.transmissionResolutionScale === 1 && !renderer.getScissorTest() &&
      source.viewport.x === 0 && source.viewport.y === 0 &&
      source.viewport.z === source.width && source.viewport.w === source.height &&
      (renderer.getClearAlpha() === 1 || background?.isColor ||
        (background?.isDataTexture && background.type === THREE.HalfFloatType)));
  }

  function blit(gl, from, target, source, includeDepth) {
    target.setSize(source.width, source.height);
    renderer.setRenderTarget(target);
    const to = renderer.properties.get(target).__webglFramebuffer;
    // setRenderTarget binds FRAMEBUFFER, which changes both bindings. Three's
    // READ_FRAMEBUFFER cache is separate, so synchronize it before copying.
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, to);
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, from);
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to);
    try {
      gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, source.width, source.height,
        gl.COLOR_BUFFER_BIT | (includeDepth ? gl.DEPTH_BUFFER_BIT : 0), gl.NEAREST);
    } finally {
      renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, to);
    }
    copies++;
  }

  function capture({source, items, camera, renderBackFaces, bind, mipmaps, drawBack}) {
    const gl = renderer.getContext();
    if (gl.isContextLost?.() || typeof gl.blitFramebuffer !== 'function') return false;
    const props = renderer.properties.get(source);
    // Multisampled render-to-texture resolves implicitly on another binding.
    // The explicit resolve below requires a standalone source framebuffer.
    const from = source.samples > 0 ? props.__webglMultisampledFramebuffer : props.__webglFramebuffer;
    if (!from || Array.isArray(from)) return false;

    const needsBack = renderBackFaces && items.some(({material, object}) =>
      material.side === THREE.DoubleSide && object.layers.test(camera.layers));
    opaque ??= makeTarget('ASFALTO_OPAQUE_REFRACTION', false);
    const toneMapping = renderer.toneMapping;
    try {
      blit(gl, from, opaque, source, false);
      mipmaps(opaque);
      bind(opaque);
      if (needsBack) {
        withBackFaces ??= makeTarget('ASFALTO_REFRACTION_BACK_FACES', true);
        blit(gl, from, withBackFaces, source, true);
        renderer.toneMapping = THREE.NoToneMapping;
        for (const item of items) {
          const {material, object} = item;
          if (material.side !== THREE.DoubleSide || !object.layers.test(camera.layers)) continue;
          material.side = THREE.BackSide;
          material.needsUpdate = true;
          try {
            drawBack(item);
            backs++;
          } finally {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          }
        }
        mipmaps(withBackFaces);
        bind(withBackFaces);
      }
      captures++;
      return true;
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.setRenderTarget(source);
      renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, from);
    }
  }

  const hook = {canReuse, capture};
  return {
    draw(source, draw) {
      const oldHook = renderer.asfaltoOpaqueTransmission;
      const oldSource = currentSource;
      renderer.asfaltoOpaqueTransmission = hook;
      currentSource = source;
      try {
        return draw();
      } finally {
        renderer.asfaltoOpaqueTransmission = oldHook;
        currentSource = oldSource;
      }
    },
    release() {
      opaque?.dispose();
      withBackFaces?.dispose();
      opaque = withBackFaces = null;
    },
    diagnostics: () => ({captures, copies, backs, targets: Number(Boolean(opaque)) + Number(Boolean(withBackFaces))}),
  };
}
