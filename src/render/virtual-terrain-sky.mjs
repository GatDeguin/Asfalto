// Three's EquirectangularReflectionMapping places the zenith at v=1.
// Keep the same orientation for the GPU mip chain and the diffuse irradiance.
export function prepareSurfaceSky(THREE, texture) {
  const source = texture?.image;
  if (!(source?.data instanceof Uint16Array) || texture.type !== THREE.HalfFloatType || texture.flipY ||
    !Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 2 || source.height < 2 ||
    source.data.length !== source.width * source.height * 4) {
    throw new Error('El cielo WebGPU requiere el panorama HDR lineal del circuito.');
  }
  const width = Math.min(256, source.width), height = Math.min(128, source.height);
  const data = new Uint16Array(width * height * 4);
  const irradiance = new Float32Array(9 * 4);
  const decode = THREE.DataUtils.fromHalfFloat;
  const encode = THREE.DataUtils.toHalfFloat;
  const phiStep = 2 * Math.PI / width, thetaStep = Math.PI / height;
  const band = [Math.PI, 2 * Math.PI / 3, 2 * Math.PI / 3, 2 * Math.PI / 3,
    Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4];
  const basis = new Float64Array(9);
  const cosLongitude = Array.from({length: width}, (_, x) => Math.cos((x + .5) * phiStep - Math.PI));
  const sinLongitude = Array.from({length: width}, (_, x) => Math.sin((x + .5) * phiStep - Math.PI));
  for (let y = 0; y < height; y++) {
    const latitude = (y + .5) * thetaStep - Math.PI / 2;
    const up = Math.sin(latitude), horizontal = Math.cos(latitude);
    const solidAngle = phiStep * thetaStep * horizontal;
    const y0 = Math.floor(y * source.height / height), y1 = Math.floor((y + 1) * source.height / height);
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * source.width / width), x1 = Math.floor((x + 1) * source.width / width);
      const east = cosLongitude[x] * horizontal, north = sinLongitude[x] * horizontal;
      let r = 0, g = 0, b = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const at = (sy * source.width + sx) * 4;
        r += decode(source.data[at]);
        g += decode(source.data[at + 1]);
        b += decode(source.data[at + 2]);
      }
      const count = (x1 - x0) * (y1 - y0);
      r /= count;
      g /= count;
      b /= count;
      const pixel = (y * width + x) * 4;
      data[pixel] = encode(r);
      data[pixel + 1] = encode(g);
      data[pixel + 2] = encode(b);
      data[pixel + 3] = 0x3c00;
      basis[0] = 0.282094792;
      basis[1] = 0.488602512 * east;
      basis[2] = 0.488602512 * up;
      basis[3] = 0.488602512 * north;
      basis[4] = 1.092548431 * east * up;
      basis[5] = 1.092548431 * up * north;
      basis[6] = 1.092548431 * north * east;
      basis[7] = 0.315391565 * (3 * up * up - 1);
      basis[8] = 0.546274215 * (east * east - north * north);
      for (let i = 0; i < 9; i++) {
        const weight = band[i] * solidAngle * basis[i];
        irradiance[i * 4] += r * weight;
        irradiance[i * 4 + 1] += g * weight;
        irradiance[i * 4 + 2] += b * weight;
      }
    }
  }
  return {data, width, height, irradiance};
}
