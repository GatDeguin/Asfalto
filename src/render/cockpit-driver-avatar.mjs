import { COCKPIT_HAND_MESH } from './cockpit-hand-mesh.mjs?v=1c425c0800cdabe4';

const ignoreRay = () => {};
const decode = source => Uint8Array.from(atob(source), character => character.charCodeAt(0)).buffer;
const RINGS = [0, .052, .104, .156, .208, .26, .31, .36, .41, .46, .51, .56, .61, .66, .71, .76, .81, .86, .90, .915, .932, .956, .981, 1];
const SIDES = 20;
const TWISTS = Array.from({ length: SIDES + 1 }, (_, i) => {
  const theta = (i % SIDES) / SIDES * Math.PI * 2;
  return [Math.cos(theta), Math.sin(theta), theta];
});
const lerp = (a, b, t) => a + (b - a) * t;

function fitRim(points, { y, depth, lean, tube }) {
  const unit = 1 / Math.hypot(1, lean), tilt = lean * unit;
  const centerY = y + .18 * unit, centerZ = -depth + .18 * tilt;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i], dy = points[i + 1] - centerY, dz = points[i + 2] - centerZ;
    const radial = dy * unit + dz * tilt, normal = dz * unit - dy * tilt;
    const delta = 1 - .18 / Math.hypot(x, radial);
    const dx = x * delta, dr = radial * delta;
    const distance = Math.hypot(dx, dr, normal);
    const correction = tube - .0011 - distance;
    if (correction <= 0 || distance < 1e-6) continue;
    const amount = Math.min(.008, correction) / distance;
    points[i] += dx * amount;
    points[i + 1] += (dr * unit - normal * tilt) * amount;
    points[i + 2] += (dr * tilt + normal * unit) * amount;
  }
}

function handGeometry(T, tube) {
  const { units, index, skin, poses, grip: { lean, thin, thick } } = COCKPIT_HAND_MESH;
  const geometry = new T.BufferGeometry();
  geometry.setIndex(new T.BufferAttribute(new Uint16Array(decode(index)), 1));
  geometry.setAttribute('color', new T.BufferAttribute(new Uint8Array(decode(skin)), 3, true));
  const fit = Math.min(1, Math.max(0, (tube - thin.tube) / (thick.tube - thin.tube)));
  const wheel = { tube, lean, y: lerp(thin.y, thick.y, fit), depth: lerp(thin.depth, thick.depth, fit) };
  const coordinates = name => new Int16Array(decode(poses[name]));
  const narrow = coordinates('thin'), wide = coordinates('thick');
  const base = Float32Array.from(narrow, (value, i) => lerp(value, wide[i], fit) / units);
  fitRim(base, wheel);
  const positions = [], normals = [];
  for (const name of ['wheel', 'reach', 'shifter']) {
    const pose = name === 'wheel' ? base : Float32Array.from(coordinates(name), value => value / units);
    const points = new T.BufferAttribute(pose, 3);
    points.name = name;
    geometry.setAttribute('position', points);
    geometry.computeVertexNormals();
    positions.push(points);
    normals.push(geometry.getAttribute('normal').clone());
  }
  geometry.setAttribute('position', positions[0]);
  geometry.setAttribute('normal', normals[0]);
  geometry.morphAttributes.position = positions.slice(1);
  geometry.morphAttributes.normal = normals.slice(1);
  geometry.computeBoundingSphere();
  return { surface: geometry, wheel };
}

function fabricMap(T) {
  const size = 64, values = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ridges = Math.cos((x * 2 + y) * Math.PI / 4) * .55 + Math.cos(y * Math.PI / 2) * .45;
    const grain = ((x * 17 ^ y * 29 ^ x * y) & 15) / 15 - .5;
    const delta = 239 + 6 * ridges + 8 * grain;
    const i = (y * size + x) * 4;
    values.fill(Math.round(delta), i, i + 3);
    values[i + 3] = 255;
  }
  const map = new T.DataTexture(values, size, size);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

function sleeveMesh(T, material, side) {
  const geometry = new T.BufferGeometry(), uvs = [], colors = [], index = [], profile = [];
  const width = SIDES + 1;
  const positions = new T.BufferAttribute(new Float32Array(RINGS.length * width * 3), 3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('normal', new T.BufferAttribute(new Float32Array(positions.array.length), 3).setUsage(T.DynamicDrawUsage));
  for (const [i, t] of RINGS.entries()) {
    const radius = t < .54 ? lerp(.063, .041, t / .54) : lerp(.041, .029, (t - .54) / .46);
    const cuff = t >= .915;
    const welt = t === .915 || t === .981 ? .00145 : 0;
    for (const [j, [x, y, theta]] of TWISTS.entries()) {
      const jointFold = Math.sin(t * 61 + theta * 1.9) * (.0009 + .0023 * Math.exp(-Math.pow((t - .52) / .13, 2)));
      const bias = .0014 * (Math.cos(theta * 3 + t * 8) + Math.sin(theta * 2 - t * 19));
      const rib = cuff ? (j % 2) * .00075 : 0;
      const r = radius + (cuff ? .0015 + welt + rib : jointFold + bias);
      profile.push([x * r, y * r * (cuff ? .78 : .87)]);
      const shade = (cuff ? .68 : .84) + (cuff ? .045 : .085) * Math.cos(theta * 2 + t * 19) + (j === 4 ? -.085 : 0);
      colors.push(shade, shade * .98, shade * .965);
      uvs.push(j / SIDES * 3, t * 5);
      if (i && j) {
        const a = (i - 1) * width + j - 1, b = a + 1;
        index.push(a, b, a + width, b, b + width, a + width);
      }
    }
  }
  geometry.setIndex(index);
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  const mesh = new T.Mesh(geometry, material);
  mesh.name = `CockpitDriver_sleeve.${side}`;
  mesh.frustumCulled = false;
  mesh.raycast = ignoreRay;

  const cuff = new T.Vector3(), bendIn = new T.Vector3(), bendOut = new T.Vector3(), cuffStart = new T.Vector3(), cuffAxis = new T.Vector3();
  const center = new T.Vector3(), tangent = new T.Vector3(), lateral = new T.Vector3(), normal = new T.Vector3();
  const last = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
  let lastScale = 0;
  function curve(start, control, end, t) {
    center.copy(start).multiplyScalar((1 - t) ** 2).addScaledVector(control, 2 * t * (1 - t)).addScaledVector(end, t * t);
    tangent.copy(control).sub(start).multiplyScalar(1 - t).addScaledVector(end, t).addScaledVector(control, -t);
  }

  return {
    mesh, cuff,
    update(shoulder, elbow, wrist, aim, palmRight, scale) {
      const threshold = Math.pow(scale * .00016, 2);
      if (lastScale === scale && last[0].distanceToSquared(shoulder) < threshold &&
          last[1].distanceToSquared(elbow) < threshold && last[2].distanceToSquared(wrist) < threshold &&
          last[3].distanceToSquared(aim) < 1e-6 && last[4].distanceToSquared(palmRight) < 1e-6) return false;
      last[0].copy(shoulder); last[1].copy(elbow); last[2].copy(wrist);
      last[3].copy(aim); last[4].copy(palmRight); lastScale = scale;
      bendIn.lerpVectors(shoulder, elbow, .76);
      bendOut.lerpVectors(elbow, wrist, .24);
      cuffAxis.subVectors(wrist, elbow).normalize().lerp(aim, .57).normalize();
      cuff.copy(wrist).addScaledVector(cuffAxis, -.008 * scale);
      cuffStart.copy(cuff).addScaledVector(cuffAxis, -.042 * scale);
      for (const [ring, t] of RINGS.entries()) {
        if (t < .41) {
          center.lerpVectors(shoulder, bendIn, t / .41);
          tangent.subVectors(elbow, shoulder);
        } else if (t < .61) curve(bendIn, elbow, bendOut, (t - .41) / .20);
        else curve(bendOut, cuffStart, cuff, (t - .61) / .39);
        tangent.normalize();
        lateral.copy(palmRight).addScaledVector(tangent, -palmRight.dot(tangent)).normalize();
        if (lateral.lengthSq() < .5) lateral.copy(aim).addScaledVector(tangent, -aim.dot(tangent)).normalize();
        normal.crossVectors(tangent, lateral);
        for (let j = 0; j < width; j++) {
          const i = ring * width + j, [rx, ry] = profile[i];
          positions.setXYZ(i, center.x + scale * (lateral.x * rx + normal.x * ry),
            center.y + scale * (lateral.y * rx + normal.y * ry), center.z + scale * (lateral.z * rx + normal.z * ry));
        }
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      return true;
    },
  };
}

export function createCockpitDriverAvatar(T, radius) {
  const root = new T.Group();
  root.name = 'CockpitDriverArms';
  const { surface, wheel } = handGeometry(T, radius);
  const weave = fabricMap(T);
  const fabric = new T.MeshStandardMaterial({ name: 'Cepillado de algodón azul', color: 0x414b57, roughness: .94, vertexColors: true, map: weave });
  const skin = new T.MeshStandardMaterial({ name: 'Piel y uñas del conductor', roughness: .66, metalness: 0, vertexColors: true, envMapIntensity: .45 });
  const arms = ['L', 'R'].map(side => {
    const handMesh = new T.Mesh(surface, skin);
    handMesh.name = `CockpitDriver_hand.${side}`;
    handMesh.raycast = ignoreRay;
    const sleeve = sleeveMesh(T, fabric, side);
    root.add(sleeve.mesh, handMesh);
    return { sleeve, handMesh, shoulder: new T.Vector3(), elbow: new T.Vector3(), wrist: new T.Vector3(), grip: new T.Vector3(), contact: 'wheel' };
  });
  return {
    root, arms, wheel,
    triangles: surface.index.count * 2 / 3 + arms.reduce((sum, arm) => sum + arm.sleeve.mesh.geometry.index.count / 3, 0),
    dispose() {
      root.removeFromParent();
      for (const arm of arms) arm.sleeve.mesh.geometry.dispose();
      surface.dispose();
      fabric.dispose();
      weave.dispose();
      skin.dispose();
      root.clear();
    },
  };
}
