import { COCKPIT_SKIN_MAP } from './cockpit-hand-surface.mjs?v=d06635fc63b32480';

const saturate = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
const bell = (distance, width) => Math.exp(-Math.pow(distance / width, 2));
const fract = value => value - Math.floor(value);
const channel = value => Math.round(saturate(value) * 255);

function texture(T, data, size, name, color, wrapU = false) {
  const map = new T.DataTexture(data, size, size, T.RGBAFormat);
  map.name = name;
  if (color) map.colorSpace = T.SRGBColorSpace;
  if (wrapU) map.wrapS = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  return map;
}

function skinMaps(T) {
  const { size, pixels } = COCKPIT_SKIN_MAP;
  const bytes = atob(pixels);
  const color = new Uint8Array(size * size * 4), surface = new Uint8Array(color.length);
  for (let dst = 0, src = 0; dst < color.length; dst += 4, src += 5) {
    color[dst] = bytes.charCodeAt(src);
    color[dst + 1] = bytes.charCodeAt(src + 1);
    color[dst + 2] = bytes.charCodeAt(src + 2);
    color[dst + 3] = 255;
    surface[dst] = bytes.charCodeAt(src + 3);
    surface[dst + 1] = bytes.charCodeAt(src + 4);
    surface[dst + 3] = 255;
  }
  return [
    texture(T, color, size, 'Cockpit skin pigment', true),
    texture(T, surface, size, 'Cockpit skin relief and roughness', false),
  ];
}

function fabricMaps(T) {
  const size = 256;
  const color = new Uint8Array(size * size * 4), surface = new Uint8Array(color.length);
  const warp = Array.from({ length: size }, (_, i) => {
    const u = (i + .5) / size, thread = 104 * u;
    return {
      u, yarn: Math.floor(thread), profile: Math.sin(Math.PI * fract(thread)) ** 2,
      rib: Math.sin(Math.PI * fract(u * 52)) ** 2, seam: Math.abs(u - .584),
      cuffStitch: bell(fract(u * 92) - .45, .28),
    };
  });
  for (let y = 0; y < size; y++) {
    const v = (y + .5) / size, thread = v * 136;
    const weftYarn = Math.floor(thread), weftProfile = Math.sin(Math.PI * fract(thread)) ** 2;
    const cuff = saturate((v - .910) / .012);
    const hem = bell(v - .922, .006) + .62 * bell(v - .979, .006);
    const hemThread = bell(v - .936, .0028) + .73 * bell(v - .967, .0028);
    const seamThread = bell(fract(v * 122) - .47, .28);
    for (let x = 0; x < size; x++) {
      const { u, yarn, profile, rib, seam, cuffStitch } = warp[x];
      // A two-over/two-under twill with the float advancing each weft.
      const float = ((yarn - weftYarn) & 3) < 2;
      const weave = float ? profile : weftProfile;
      const grain = ((((x * 37 + y * 179) ^ (x * y * 29)) >>> 2) & 255) / 255 - .5;
      const slub = Math.sin(u * Math.PI * 16 + Math.sin(v * 17) + .37 * weftYarn);
      const raisedSeam = bell(seam, .009) + .25 * bell(u - .089, .010);
      const shadow = bell(seam - .010, .0045) * (1 - cuff);
      const stitches = (bell(seam - .013, .0045) + .55 * bell(seam - .026, .0039)) * seamThread * (1 - cuff)
        + hemThread * cuffStitch * cuff;
      const dyeWear = bell(seam, .056) * .027 + slub * .014 + grain * .032;
      const pigment = lerp(.029 * (weave - .5) + dyeWear, .027 * (rib - .5) + .44 * dyeWear, cuff);
      const i = (y * size + x) * 4;
      color[i] = channel(lerp(.257, .199, cuff) + pigment - .036 * shadow + stitches * .131);
      color[i + 1] = channel(lerp(.313, .247, cuff) + pigment - .040 * shadow + stitches * .108);
      color[i + 2] = channel(lerp(.386, .309, cuff) + pigment - .043 * shadow + stitches * .081);
      color[i + 3] = 255;
      surface[i] = channel(.44 + lerp(.119 * weave + .145 * raisedSeam, .146 * rib + .141 * hem, cuff)
        - .12 * shadow + .14 * stitches + grain * .040);
      surface[i + 1] = channel(.925 - weave * .044 - stitches * .19 - cuff * .025);
      surface[i + 3] = 255;
    }
  }
  return [
    texture(T, color, size, 'Cotton twill pigment and stitching', true, true),
    texture(T, surface, size, 'Cotton twill relief and roughness', false, true),
  ];
}

export function createCockpitDriverMaterials(T) {
  const [skinColor, skinSurface] = skinMaps(T);
  const [twill, thread] = fabricMaps(T);
  const skin = new T.MeshStandardMaterial({
    name: 'Piel del conductor', map: skinColor, bumpMap: skinSurface, roughnessMap: skinSurface,
    bumpScale: .52, roughness: 1, vertexColors: true, envMapIntensity: .33,
  });
  const fabric = new T.MeshPhysicalMaterial({
    name: 'Sarga de algodón azul', map: twill, bumpMap: thread, roughnessMap: thread,
    bumpScale: .64, roughness: 1, vertexColors: true, envMapIntensity: .29,
    sheen: .38, sheenRoughness: .88, sheenColor: 0x718299,
  });
  return {
    skin, fabric,
    dispose() {
      skin.dispose();
      fabric.dispose();
      skinColor.dispose();
      skinSurface.dispose();
      twill.dispose();
      thread.dispose();
    },
  };
}
