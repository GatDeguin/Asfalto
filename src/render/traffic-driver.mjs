import {OCCUPANT_JOINTS, OCCUPANT_MESHES, OCCUPANT_SEATS} from './traffic-occupant-meshes.mjs?v=242cd6a2a1b298c6';

const DRIVERS = [
  [0xb98562, 0x344650, 0x34393e, 0x28211c, 0x655447],
  [0x7f5542, 0x777b51, 0x414747, 0x1d1919, 0x4a4231],
  [0xdbad8f, 0x794b3e, 0x3f4950, 0x493025, 0x513d31],
  [0xa7795d, 0x687981, 0x4f4640, 0x514841, 0x3f4c54],
  [0x8d624f, 0x6d4b54, 0x353638, 0x251e1e, 0x3d3028],
  [0xc7956c, 0x64644f, 0x47484b, 0x6d5e4a, 0x755039],
];
const JOINT_NAMES = Object.keys(OCCUPANT_JOINTS);
const SURFACES = ['skin', 'clothing', 'dark', 'hair', 'accessory'];
const caches = new WeakMap();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const decode = value => Uint8Array.from(atob(value), byte => byte.charCodeAt(0));

function occupantGeometry(T, lod, variant) {
  const geometry = new T.BufferGeometry();
  const parts = [OCCUPANT_MESHES[lod][0], OCCUPANT_MESHES[lod][variant + 1]];
  const positions = [], weights = [], skinIndices = [], index = [];
  const indicesByMaterial = SURFACES.map(() => []);
  for (const {p, s, i, groups} of parts) {
    const offset = positions.length / 3;
    for (const point of new Int16Array(decode(p).buffer)) positions.push(point / 10000);
    for (const bone of decode(s)) {
      skinIndices.push(bone, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
    const source = new Uint16Array(decode(i).buffer);
    let first = 0;
    for (const [material, count] of groups) {
      for (let j = first; j < first + count; j++) indicesByMaterial[material].push(source[j] + offset);
      first += count;
    }
  }
  for (const [material, indices] of indicesByMaterial.entries()) {
    if (indices.length) geometry.addGroup(index.length, indices.length, material);
    index.push(...indices);
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function geometryCache(T) {
  if (!caches.has(T)) caches.set(T, new Map());
  const cache = caches.get(T), held = new Map();
  return {
    get(lod, variant) {
      const key = `${lod}:${variant}`;
      if (!held.has(key)) {
        if (!cache.has(key)) cache.set(key, {geometry:occupantGeometry(T, lod, variant), users:0});
        const entry = cache.get(key);
        entry.users++;
        held.set(key, entry);
      }
      return held.get(key).geometry;
    },
    dispose() {
      for (const [key, entry] of held) {
        if (--entry.users === 0) {
          entry.geometry.dispose();
          cache.delete(key);
        }
      }
      held.clear();
    },
  };
}

// As the wheel goes past a comfortable reach, each hand changes its grip on
// the rim in turn. The return arc and the loaded arc meet at the same point.
function gripAngle(steering, side) {
  const cycle = 1.82, loadedArc = 1.29;
  const phase = ((side * steering + (side === 1 ? .98 : .96)) % cycle + cycle) % cycle;
  const t = clamp((phase - loadedArc) / (cycle - loadedArc), 0, 1);
  const swept = t > 0 ? loadedArc * (1 - t * t * (3 - 2 * t)) + (cycle - loadedArc) * t * (1 - t) * (1 - 2 * t) : phase;
  return side * (.34 + swept);
}

export function trafficOccupantSeat(model = 'chevy') {
  return OCCUPANT_SEATS[model] || OCCUPANT_SEATS.chevy;
}

// Car-space metres with -X forward. The player supplies calibrated chassis
// coordinates and applies the same yaw as its body. Traffic uses road height.
export function createTrafficDriver(T, {
  eye, wheel, roofM, model='chevy', passenger=false, steeringAxis=[1,0,0], wheelRadius,
}) {
  const seat = trafficOccupantSeat(model);
  const center = new T.Vector3(...wheel), axis = new T.Vector3(...steeringAxis).normalize();
  const up = new T.Vector3(0, 1, 0), rimUp = up.clone().addScaledVector(axis, -axis.dot(up)).normalize();
  const radius = wheelRadius ?? seat.radius;
  const [ex, ey, ez] = eye;
  const p = seat.passenger;
  const head = new T.Vector3(ex + (passenger ? p[0] : 0), Math.min(ey + (passenger ? p[1] : .008), roofM - .162),
    passenger ? -ez + p[2] : ez);
  const at = ([x,y,z], side=1) => new T.Vector3(head.x+x, head.y+y, head.z+side*z);
  const hips = at(seat.hip), shoulders = at(seat.shoulder);
  const root = new T.Group();
  root.name = passenger ? 'TrafficPassenger' : 'TrafficDriver';
  root.userData.asfaltoPrewarm = true;
  root.userData.seatType = seat.seat;

  const materials = SURFACES.map(name => new T.MeshStandardMaterial({name:`Occupant_${name}`, roughness:.83}));
  const meshes = geometryCache(T);
  const joints = JOINT_NAMES.map(name => {
    const [start,end] = OCCUPANT_JOINTS[name];
    const bone = new T.Bone(), position = new T.Vector3(...start);
    bone.name = name;
    bone.position.copy(position);
    const direction = new T.Vector3(...end).sub(position), length = direction.length();
    return {name,bone,direction:direction.normalize(),length};
  });
  const byName = Object.fromEntries(joints.map(joint => [joint.name,joint]));
  const mesh = new T.SkinnedMesh(meshes.get('near', 0), materials);
  mesh.name = 'OccupantSkin';
  mesh.userData.asfaltoPrewarm = true;
  mesh.frustumCulled = false; // Traffic visibility is gated by route distance.
  for (const {bone} of joints) mesh.add(bone);
  root.add(mesh);
  mesh.bind(new T.Skeleton(joints.map(({bone}) => bone)));
  for (const {bone} of joints) bone.matrixAutoUpdate = false;

  const delta = new T.Vector3(), torso = new T.Vector3(), neck = new T.Vector3(),
    aim = new T.Vector3(), alongRim = new T.Vector3(), stretch = new T.Matrix4();
  const arms = [-1, 1].map(side => {
    const suffix = side === 1 ? 'L' : 'R';
    const shoulder = shoulders.clone().add(new T.Vector3(0, -.011, side * .166));
    const hip = hips.clone().add(new T.Vector3(-.012, -.012, side * .087));
    const knee = at(seat.knee, side), ankle = at(seat.pedal, side);
    const onLap = knee.clone().add(new T.Vector3(.075, .066, side * .008));
    const reach = center.clone().sub(shoulder);
    const reachAlong = reach.dot(axis);
    const armLength = Math.max(.49, Math.hypot(reachAlong, reach.addScaledVector(axis, -reachAlong).length() + radius) / .97);
    return {side,suffix,shoulder,hip,knee,ankle,onLap,upper:armLength*.52,lower:armLength*.48,
      target:new T.Vector3(), elbow:new T.Vector3(), pole:new T.Vector3(), direction:new T.Vector3()};
  });
  let lod = 'near', variant = 0, parkBlend = passenger ? 1 : 0;
  let lastSteering = 0, lastTime = 0, lastFacing = 0, disposed = false;

  function setJoint(name, point, end, fitLength=false) {
    const {bone,direction,length} = byName[name];
    delta.subVectors(end, point);
    const factor = fitLength ? delta.length()/length - 1 : 0;
    bone.position.copy(point);
    bone.quaternion.setFromUnitVectors(direction, delta.normalize());
    bone.matrix.makeRotationFromQuaternion(bone.quaternion);
    if (fitLength) {
      const {x,y,z} = direction;
      stretch.set(1+factor*x*x, factor*x*y, factor*x*z, 0,
        factor*y*x, 1+factor*y*y, factor*y*z, 0,
        factor*z*x, factor*z*y, 1+factor*z*z, 0, 0, 0, 0, 1);
      bone.matrix.multiply(stretch);
    }
    bone.matrix.setPosition(point);
    bone.matrixWorldNeedsUpdate = true;
  }

  function pose(steering, seconds, facing) {
    const breath = Math.sin(seconds * 2.15) * .0026;
    const turn = passenger ? -.12 + .10 * Math.sin(seconds * .64 + 1.5) : clamp(facing * .22, -.17, .17);
    torso.copy(hips).lerp(shoulders, .48);
    neck.copy(shoulders).lerp(head, .31);
    neck.y += breath;
    setJoint('pelvis', hips, torso);
    setJoint('chest', torso, neck);
    setJoint('neck', neck, head);
    const headBone = byName.head.bone;
    headBone.position.copy(head);
    headBone.position.y += breath;
    headBone.quaternion.setFromAxisAngle(up, turn);
    headBone.updateMatrix();
    if (lod === 'far') return;
    for (const arm of arms) {
      const {side,suffix,shoulder,hip,knee,ankle,onLap,upper,lower,target,elbow,pole,direction} = arm;
      target.copy(rimUp).applyAxisAngle(axis, gripAngle(steering, side)).multiplyScalar(radius).add(center);
      target.lerp(onLap, parkBlend);
      direction.subVectors(target, shoulder);
      const length = direction.length();
      direction.normalize();
      const projected = (upper * upper - lower * lower + length * length) / (2 * Math.max(.001, length));
      pole.set(.03, -.94, side * .42).addScaledVector(direction, -pole.dot(direction)).normalize();
      elbow.copy(shoulder).addScaledVector(direction, projected)
        .addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - projected * projected)));
      setJoint(`upperArm.${suffix}`, shoulder, elbow, true);
      setJoint(`forearm.${suffix}`, elbow, target, true);
      alongRim.subVectors(center, target).normalize().multiplyScalar(.07).add(target);
      aim.set(target.x-.07,target.y-.01,target.z);
      setJoint(`hand.${suffix}`, target, alongRim.lerp(aim, parkBlend));
      setJoint(`thigh.${suffix}`, hip, knee, true);
      setJoint(`shin.${suffix}`, knee, ankle, true);
      aim.set(ankle.x-.125,ankle.y-.012,ankle.z);
      setJoint(`foot.${suffix}`, ankle, aim);
    }
  }

  function setVariant(index) {
    variant = Number.isInteger(index) && DRIVERS[index] ? index : 0;
    materials.forEach((material, i) => material.color.setHex(DRIVERS[variant][i]));
    mesh.geometry = meshes.get(lod, variant);
  }
  function setLod(next) {
    if (next === lod || !OCCUPANT_MESHES[next]) return;
    lod = next;
    mesh.geometry = meshes.get(lod, variant);
    pose(lastSteering, lastTime, lastFacing);
  }
  function update({steering=lastSteering, seconds=lastTime, facing=lastFacing, parked=false, dt=0}={}) {
    if (Number.isFinite(steering)) lastSteering = steering;
    if (Number.isFinite(seconds)) lastTime = seconds;
    if (Number.isFinite(facing)) lastFacing = facing;
    const goal = passenger || parked ? 1 : 0;
    parkBlend += (goal - parkBlend) * (1 - Math.exp(-Math.max(0, dt) / .22));
    pose(lastSteering, lastTime, lastFacing);
  }
  setVariant(0);
  pose(0, 0, 0);
  return {
    root, setVariant, setLod, update,
    setSteering(value=0) {update({steering:value});},
    setParked(value) {parkBlend=passenger||value?1:0;pose(lastSteering,lastTime,lastFacing);},
    diagnostics: () => ({lod, variant, seat:seat.seat, parkBlend, wheelRadius:radius, wheelCenter:center.toArray(),
      head:byName.head.bone.position.toArray(), triangles:mesh.geometry.index.count/3,
      hands:arms.map(({suffix}) => byName[`hand.${suffix}`].bone.position.toArray()),
      elbows:arms.map(({suffix}) => byName[`forearm.${suffix}`].bone.position.toArray())}),
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      mesh.skeleton.dispose();
      materials.forEach(material => material.dispose());
      meshes.dispose();
      root.clear();
    },
  };
}
