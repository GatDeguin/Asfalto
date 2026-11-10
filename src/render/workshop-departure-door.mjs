// Hinge and skin coordinates are in each shipping vehicle's model space.
const doors = {
  chevy: {
    hinge: [-.217, 0, .347],
    panels: [
      ['chevy_Body_paint', p => p.z > .305 && p.y > -.173 && p.y < .111 &&
        p.x > -.219 + .031 * Math.max(0, (-p.y - .07) / .103) && p.x < .215],
      ['chevy_static_Vehicle_Chrome', p => p.x > .105 && p.x < .159 && p.y > .058 && p.y < .070 && p.z > .36],
    ],
  },
  chevrolet_1969: {
    hinge: [-.253, 0, .334],
    panels: [['Puerta_I_Chapa_Separada'], ['Ventanilla_Puerta_Izquierdo__13'], ['Ventilete_Izquierdo__13']],
  },
  chevy_400_1957: {
    hinge: [-.231, 0, .337],
    panels: [
      ['V7_SheetMetal_L_Door', p => p.x < .039],
      ['SS250_BodyTrim_DoorHandlesAnd4100', p => p.z > .34 && p.x > -.019 && p.x < .033],
    ],
  },
  belair_1957: {
    hinge: [-.250, 0, .344],
    panels: [
      ['belair_1957_doorSide_right_BA57_Paint_Turquoise'],
      ['belair_1957_static_BA57_Chrome', p => p.x > .13 && p.x < .205 && p.y > .075 && p.y < .094 && p.z > .365],
    ],
  },
  pickup_3100: {
    hinge: [-.171, 0, .303],
    panels: [
      ['pickup_3100_doorSide_right_C3100_Paint_Turquoise'],
      ['pickup_3100_static_C3100_Chrome', p => p.x > .115 && p.x < .202 && p.y > .171 && p.y < .186 && p.z > .316],
    ],
  },
};

// The legacy Chevy and the 400 have paint triangles shared with adjacent
// panels. Create an indexed cut for this shot, retaining the original vertex
// attributes and material. The installed model comes back at the latch.
function partition(T, geometry, transform, belongsToDoor) {
  const {index, attributes: {position}} = geometry;
  if (!index) return null;
  const point = new T.Vector3(), center = new T.Vector3(), moving = [], fixed = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    center.fromBufferAttribute(position, a).add(point.fromBufferAttribute(position, b))
      .add(point.fromBufferAttribute(position, c)).multiplyScalar(1 / 3).applyMatrix4(transform);
    (belongsToDoor(center) ? moving : fixed).push(a, b, c);
  }
  if (!moving.length || !fixed.length) return null;
  return [moving, fixed].map(indices => geometry.clone().setIndex(indices));
}

export function prepareDepartureDoor(T, root, vehicle) {
  const spec = doors[vehicle];
  if (!T || !root || !spec) return null;
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const pivot = new T.Group();
  pivot.name = 'DepartureDriverDoor';
  pivot.userData.workshopPreparedMeshCopy = true;
  pivot.position.fromArray(spec.hinge);
  const originals = [], fixedMeshes = [], owned = [];

  for (const [name, filter] of spec.panels) {
    const meshes = [];
    root.getObjectByName(name)?.traverseVisible(node => { if (node.isMesh) meshes.push(node); });
    for (const mesh of meshes) {
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      const cut = filter && partition(T, mesh.geometry, transform, filter);
      if (filter && !cut) continue;
      const leaf = mesh.clone(false);
      if (cut) {
        owned.push(...cut);
        leaf.geometry = cut[0];
        const remainder = mesh.clone(false);
        remainder.geometry = cut[1];
        remainder.userData.workshopPreparedMeshCopy = true;
        mesh.parent.add(remainder);
        fixedMeshes.push(remainder);
      }
      transform.setPosition(new T.Vector3().setFromMatrixPosition(transform).sub(pivot.position));
      transform.decompose(leaf.position, leaf.quaternion, leaf.scale);
      leaf.updateMatrix();
      pivot.add(leaf);
      originals.push(mesh);
      mesh.visible = false;
    }
  }
  if (!originals.length) return null;
  root.add(pivot);
  let restored = false;
  return {
    setOpen(amount) { pivot.rotation.y = -.205 * amount; },
    restore() {
      if (restored) return;
      restored = true;
      pivot.removeFromParent();
      for (const mesh of fixedMeshes) mesh.removeFromParent();
      for (const mesh of originals) mesh.visible = true;
      for (const geometry of owned) geometry.dispose();
    },
  };
}
