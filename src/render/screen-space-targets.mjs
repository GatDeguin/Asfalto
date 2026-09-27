/**
 * WebGL2 targets for scene capture and point-sampled screen-space effects.
 * Effect RGBA16F: GI.rgb + AO.a, fog.rgb + opticalDepth.a, or geometry metadata.
 * Scalar AO: R8. Scene capture: linear RGBA16F + a nearest depth attachment.
 */
export function supportsScreenSpaceHDR(renderer) {
  return !!(renderer.extensions?.has?.('EXT_color_buffer_float')
    || renderer.extensions?.has?.('EXT_color_buffer_half_float'));
}

export function createScreenSpaceTarget(THREE, width, height, name, {
  color = false,
  ao = false,
  samples = 0
} = {}) {
  if (color && ao) throw new TypeError('A target cannot be both scene color and scalar AO');
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
    throw new RangeError('Render target dimensions must be positive');
  }
  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  const filter = color ? THREE.LinearFilter : THREE.NearestFilter;
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: ao ? THREE.RedFormat : THREE.RGBAFormat,
    type: ao ? THREE.UnsignedByteType : THREE.HalfFloatType,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: color,
    stencilBuffer: false,
    samples: color ? Math.max(0, samples | 0) : 0,
    generateMipmaps: false
  });
  target.texture.name = name;
  target.texture.internalFormat = ao ? 'R8' : 'RGBA16F';
  target.texture.colorSpace = color ? THREE.LinearSRGBColorSpace : THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  if (color) {
    target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    target.depthTexture.minFilter = THREE.NearestFilter;
    target.depthTexture.magFilter = THREE.NearestFilter;
    target.depthTexture.generateMipmaps = false;
  }
  return target;
}

