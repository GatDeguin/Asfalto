const RINGS = [0, .056, .11, .17, .23, .29, .34, .38, .415, .44, .465, .49, .515, .54, .565, .59, .615,
  .645, .675, .71, .75, .786, .82, .849, .876, .894, .913, .928, .944, .962, .979, .992, 1];
const SIDES = 20;
const WIDTH = SIDES + 1;
const bell = (distance, width) => Math.exp(-Math.pow(distance / width, 2));
const lerp = (a, b, t) => a + (b - a) * t;
const saturate = value => Math.max(0, Math.min(1, value));
const elbowTaper = RINGS.map(t => .13 * bell(t - .49, .11));
const around = Array.from({ length: WIDTH }, (_, i) => {
  const theta = (i % SIDES) / SIDES * Math.PI * 2;
  return { x: Math.cos(theta), y: Math.sin(theta), theta };
});
const ignoreRay = () => {};

function buildSleeveGeometry(T, side) {
  const geometry = new T.BufferGeometry(), uvs = [], colors = [], index = [], profiles = [];
  const positions = new T.BufferAttribute(new Float32Array(RINGS.length * WIDTH * 3), 3).setUsage(T.DynamicDrawUsage);
  const normals = new T.BufferAttribute(new Float32Array(positions.array.length), 3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('normal', normals);
  for (const [i, t] of RINGS.entries()) {
    const radius = t < .52 ? lerp(.062, .043, t / .52) : lerp(.043, .029, (t - .52) / .48);
    const forearmMass = bell(t - .642, .097), forearmTaper = bell(t - .712, .132);
    const hem = saturate((t - .908) / .018);
    const lip = .0016 * hem + .00145 * bell(t - .924, .011) + .00165 * bell(t - .979, .011)
      - .0011 * saturate((t - .988) / .012);
    for (const [j, { x, y, theta }] of around.entries()) {
      const drape = .00165 * Math.sin(theta * 3 + t * 10) + .0011 * Math.cos(theta * 2 - t * 19)
        + .00165 * bell(t - .746, .10) * Math.cos(theta * 4 + t * 33);
      const turn = Math.sin((t - .42) * 82 + 1.4 * Math.sin(theta)) * bell(t - .508, .115);
      const sleeveEnd = Math.cos((t - .76) * 74 - .9 * Math.cos(theta)) * bell(t - .840, .066);
      profiles.push({
        x, y: y * lerp(.86, .79, hem),
        radius: radius + drape * (1 - hem) + lip + .0048 * forearmMass + .0021 * forearmTaper * x ** 2,
        fold: .0054 * turn, wristFold: .0022 * sleeveEnd,
      });
      const shade = .93 + .055 * Math.cos(theta * 2 + t * 15) - hem * .044;
      colors.push(shade, shade * .99, shade);
      uvs.push(j / SIDES - (side === 'R' ? .25 : 0), t);
      if (i && j) {
        const corner = (i - 1) * WIDTH + j - 1;
        index.push(corner, corner + 1, corner + WIDTH, corner + 1, corner + WIDTH + 1, corner + WIDTH);
      }
    }
  }
  geometry.setIndex(index);
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  return { geometry, positions, normals, profiles };
}

export function createCockpitDriverSleeve(T, material, side) {
  const { geometry, positions, normals, profiles } = buildSleeveGeometry(T, side);
  const mesh = new T.Mesh(geometry, material);
  mesh.name = `CockpitDriver_sleeve.${side}`;
  mesh.frustumCulled = false;
  mesh.raycast = ignoreRay;

  const cuff = new T.Vector3(), cuffAxis = new T.Vector3(), bendIn = new T.Vector3(), bendOut = new T.Vector3();
  const upper = new T.Vector3(), lower = new T.Vector3(), inside = new T.Vector3();
  const nearElbow = new T.Vector3(), nearWrist = new T.Vector3();
  const center = new T.Vector3(), tangent = new T.Vector3(), priorTangent = new T.Vector3(), turnFrame = new T.Quaternion();
  const lateral = new T.Vector3(), normal = new T.Vector3(), seamNormal = new T.Vector3();
  const last = Array.from({ length: 5 }, () => new T.Vector3());
  let lastScale = 0;

  function sampleCurve(t, shoulder, elbow) {
    if (t <= .39) {
      center.lerpVectors(shoulder, bendIn, t / .39);
      tangent.copy(upper);
    } else if (t <= .60) {
      const u = (t - .39) / .21, v = 1 - u;
      center.copy(bendIn).multiplyScalar(v * v).addScaledVector(elbow, 2 * v * u).addScaledVector(bendOut, u * u);
      tangent.copy(elbow).sub(bendIn).multiplyScalar(v).addScaledVector(bendOut, u).addScaledVector(elbow, -u);
    } else {
      const u = (t - .60) / .40, v = 1 - u;
      center.copy(bendOut).multiplyScalar(v ** 3).addScaledVector(nearElbow, 3 * v * v * u)
        .addScaledVector(nearWrist, 3 * v * u * u).addScaledVector(cuff, u ** 3);
      tangent.copy(nearElbow).sub(bendOut).multiplyScalar(v * v).addScaledVector(nearWrist, 2 * v * u)
        .addScaledVector(nearElbow, -2 * v * u).addScaledVector(cuff, u * u).addScaledVector(nearWrist, -u * u);
    }
    tangent.normalize();
  }

  return {
    mesh, cuff,
    update(shoulder, elbow, wrist, aim, palmRight, scale) {
      const threshold = (scale * .00016) ** 2;
      if (Math.abs(lastScale - scale) < scale * .00016 && last[0].distanceToSquared(shoulder) < threshold &&
          last[1].distanceToSquared(elbow) < threshold && last[2].distanceToSquared(wrist) < threshold &&
          last[3].distanceToSquared(aim) < 1e-6 && last[4].distanceToSquared(palmRight) < 1e-6) return false;
      last[0].copy(shoulder); last[1].copy(elbow); last[2].copy(wrist);
      last[3].copy(aim); last[4].copy(palmRight); lastScale = scale;

      upper.subVectors(elbow, shoulder).normalize();
      lower.subVectors(wrist, elbow);
      const lowerLength = lower.length();
      lower.normalize();
      inside.subVectors(lower, upper).normalize();
      const compression = Math.sqrt(Math.max(0, .5 * (1 - upper.dot(lower))));
      cuffAxis.copy(aim);
      const gathering = Math.sqrt(Math.max(0, .5 * (1 - cuffAxis.dot(lower))));
      cuff.copy(wrist).addScaledVector(cuffAxis, -.006 * scale);
      bendIn.lerpVectors(shoulder, elbow, .66);
      bendOut.lerpVectors(elbow, wrist, .33);
      nearElbow.copy(bendOut).addScaledVector(lower, lowerLength * .232);
      nearWrist.copy(cuff).addScaledVector(cuffAxis, -.048 * scale);

      // Carry the cuff's frame up the sleeve to avoid twisting around the elbow.
      for (let ring = RINGS.length - 1; ring >= 0; ring--) {
        sampleCurve(RINGS[ring], shoulder, elbow);
        if (ring === RINGS.length - 1) lateral.copy(palmRight);
        else lateral.applyQuaternion(turnFrame.setFromUnitVectors(priorTangent, tangent));
        lateral.addScaledVector(tangent, -lateral.dot(tangent)).normalize();
        if (lateral.lengthSq() < .5) lateral.copy(aim).addScaledVector(tangent, -aim.dot(tangent)).normalize();
        normal.crossVectors(tangent, lateral);
        priorTangent.copy(tangent);
        const insideX = lateral.dot(inside), insideY = normal.dot(inside);
        for (let j = 0; j < WIDTH; j++) {
          const i = ring * WIDTH + j, { x, y, radius, fold, wristFold } = profiles[i];
          const pinch = saturate(.54 + .71 * (x * insideX + y * insideY));
          const r = scale * (radius + fold * compression * (.15 + .85 * pinch ** 2) + wristFold * gathering)
            * (1 - elbowTaper[ring] * compression * pinch);
          const rx = x * r, ry = y * r;
          positions.setXYZ(i, center.x + lateral.x * rx + normal.x * ry,
            center.y + lateral.y * rx + normal.y * ry, center.z + lateral.z * rx + normal.z * ry);
        }
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      for (let first = 0; first < positions.count; first += WIDTH) {
        const last = first + SIDES;
        seamNormal.fromBufferAttribute(normals, first).add(normal.fromBufferAttribute(normals, last)).normalize();
        normals.setXYZ(first, seamNormal.x, seamNormal.y, seamNormal.z);
        normals.setXYZ(last, seamNormal.x, seamNormal.y, seamNormal.z);
      }
      return true;
    },
  };
}
