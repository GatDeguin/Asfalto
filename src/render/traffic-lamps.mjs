import {TRAFFIC_LAMP_MOUNTS} from './traffic-occupant-meshes.mjs?v=242cd6a2a1b298c6';
import {isHighBeamLens} from './vehicle-lighting.mjs?v=5a49d3e7dc4a2630';

const ROLES = ['low', 'tail', 'position'];
const COLORS = {low:0xffead0, tail:0xf42c16, position:0xffa72d};
const MARKER_SIZE = {low:[.095,.095], tail:[.075,.055], position:[.045,.021]};

function lampRole(material, node) {
  const name = material?.name || '';
  if (!material?.emissive) return null;
  if (isHighBeamLens(material)) {
    material.emissiveIntensity = 0;
    return null;
  }
  if (/headlampposition|optica_ambar|amber_lens/i.test(name)) return 'position';
  if (/headlamp|headlight|vidrio_faro/i.test(name)) return 'low';
  if (/brakelens|tail.?light|optica_trasera/i.test(name) && !/interior|quarter_reflector/i.test(node.parent?.name + node.name)) return 'tail';
  return null;
}

export function createTrafficLamps(T, {group, model, id, disc}) {
  const mounts = TRAFFIC_LAMP_MOUNTS[id];
  const surfaces = Object.fromEntries(ROLES.map(role => [role,new Set()]));
  model.traverseVisible(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const role = lampRole(material, node);
      if (role) surfaces[role].add(material);
    }
  });

  const lightNodes = {}, owned = [];
  for (const role of ROLES) {
    const [x,y,z] = mounts[role];
    const needsDisc = surfaces[role].size === 0;
    let material;
    if (needsDisc) {
      material = new T.MeshBasicMaterial({color:COLORS[role],toneMapped:false});
      owned.push(material);
    }
    lightNodes[role] = [-1, 1].map(side => {
      const lamp = needsDisc ? new T.Mesh(disc, material) : new T.Object3D();
      lamp.name = `TrafficLamp_${role}_${side < 0 ? 'Right' : 'Left'}`;
      lamp.position.set(x + Math.sign(x)*.003, y, side*z);
      lamp.rotation.y = Math.sign(x)*Math.PI/2;
      lamp.userData.asfaltoPrewarm = true;
      if (needsDisc) lamp.scale.set(...MARKER_SIZE[role], 1);
      group.add(lamp);
      return lamp;
    });
    for (const lens of surfaces[role]) lens.emissive.setHex(COLORS[role]);
  }

  let mode, hazards;
  function update(next, flashing) {
    if (next === mode && flashing === hazards) return;
    mode = next;
    hazards = flashing;
    const low = mode === 'low';
    const gain = {low:low ? 1.35 : .07, tail:hazards ? 1.85 : low ? .51 : .25,
      position:hazards ? 1.75 : low ? .58 : .42};
    for (const role of ROLES) {
      for (const lens of surfaces[role]) lens.emissiveIntensity = gain[role];
      for (const lamp of lightNodes[role]) {
        if (!lamp.isMesh) continue;
        lamp.visible = role !== 'low' || low;
        lamp.material.color.setHex(COLORS[role]).multiplyScalar(gain[role]);
      }
    }
  }
  update('position', false);
  return {
    lowMounts:lightNodes.low, update,
    diagnostics:() => ({mode,hazards,front:2,rear:2,positions:true,
      sourceMaterials:Object.fromEntries(ROLES.map(role=>[role,[...surfaces[role]].map(m=>m.name)]))}),
    dispose() { owned.forEach(material=>material.dispose()); },
  };
}
