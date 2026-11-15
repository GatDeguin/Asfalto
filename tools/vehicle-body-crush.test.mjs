import assert from 'node:assert/strict';
import test from 'node:test';
import { THREE as T } from './cinematic-three.mjs';
import { loadVehicleGeometryAsset } from './vehicle-cabin-pilot-fixture.mjs?v=d5045cbd1690ebd9';
import { createVehiclePresentation } from '../src/render/vehicle-presentation.mjs?v=aee43660313b9773';

// Orthogonal samples of the shipping panels. Each line reaches the outer
// sheet before the inner skin, trim or lining on an undamaged car.
const panelSamples = {
  chevy: [
    ['left', -.24606, .08434, 'chevy_Body_paint_Primitive_0', 'chevy_Body_interior_Primitive_0'],
    ['right', -.26194, .08434, 'chevy_Body_paint_Primitive_0', 'chevy_Body_interior_Primitive_0'],
    ['front', .17875, -.17551, 'chevy_Body_paint_Primitive_0', 'chevy_Body_interior_Primitive_0'],
    ['rear', -.02475, -.16713, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
  ],
  chevrolet_1969: [
    ['left', -.03969, .02566, 'Puerta_I_Chapa_Separada_Primitive_0', '05_Habitaculo__09_Vinilo_Negro_Interior_Primitive_0'],
    ['right', -.10319, -.02463, 'Puerta_D_Chapa_Separada_Primitive_0', '05_Habitaculo__09_Vinilo_Negro_Interior_Primitive_0'],
    ['front', .05775, -.04140, '02_Opticas_y_Cromados__01_Naranja_Restauracion_Barniz_V4_Primitive_0', 'Mesh_97_Primitive_0'],
    ['rear', -.09075, -.15875, '02_Opticas_y_Cromados__01_Naranja_Restauracion_Barniz_V4_Primitive_0', '02_Opticas_y_Cromados__08_Burletes_Negros_Primitive_0'],
  ],
  chevy_400_1957: [
    ['left', -.05556, .05919, 'V7_SheetMetal_L_Door_Primitive_0', 'SS250_DriverFrontDoorCard_Primitive_0'],
    ['right', -.07144, .05919, 'V7_SheetMetal_R_Door_Primitive_0', 'SS250_PassengerFrontDoorCard_Primitive_0'],
  ],
  belair_1957: [
    ['left', .11906, .00890, 'R3_Door1.007_Primitive_0', 'Cubo.963_Primitive_0'],
    ['right', .02381, -.05816, 'R3_Door-1.007_Primitive_0', 'Cubo.963_Primitive_0'],
    ['front', -.01925, .00051, 'R3_HoodFrontAndUpperContinuous.007_Primitive_0', 'Cubo.1021_Primitive_0'],
  ],
  pickup_3100: [
    ['left', .23019, .07596, 'R17_DoorSkin1.004_Primitive_0', 'Cubo.828_Primitive_0'],
    ['right', .23019, .05081, 'R17_DoorSkin-1.004_Primitive_0', 'Cubo.828_Primitive_0'],
    ['front', .10175, -.07493, 'C3100_Grille_PaintedStampedSlats_Primitive_0', 'NoseBacking.004_Primitive_0'],
    ['rear', -.28875, -.04140, 'HeadlightPaintBucket-1.004_Primitive_0', 'Cubo.819_Primitive_0'],
  ],
};

function rayFor(zone, horizontal, y) {
  const alongSide = zone === 'left' || zone === 'right';
  const sign = zone === 'left' || zone === 'rear' ? 1 : -1;
  return alongSide
    ? new T.Raycaster(new T.Vector3(horizontal, y, sign * 2), new T.Vector3(0, 0, -sign))
    : new T.Raycaster(new T.Vector3(sign * 2, y, horizontal), new T.Vector3(-sign, 0, 0));
}

for (const [vehicle, samples] of Object.entries(panelSamples)) {
  test(`${vehicle} keeps dented sheet metal ahead of its inner layers`, async () => {
    const view = await createVehiclePresentation(T, {vehicle, modelRoot: new T.Group(), lodLevels: [0],
      loadGlb: url => loadVehicleGeometryAsset(new URL(url))});
    try {
      const wheels = new Map();
      view.root.traverse(node => {
        if (!node.name.endsWith('_PresentationPivot')) return;
        node.traverse(mesh => { if (mesh.isMesh) wheels.set(mesh, mesh.geometry); });
      });
      assert.ok(wheels.size > 0, 'the fixture must contain attached wheels');
      for (const [zone, horizontal, y, skinName, backingName] of samples) {
        const ray = rayFor(zone, horizontal, y);
        const skin = view.root.getObjectByName(skinName), backing = view.root.getObjectByName(backingName);
        assert.ok(skin?.isMesh && backing?.isMesh, `${skinName} / ${backingName}`);
        const distance = mesh => ray.intersectObject(mesh, false)[0]?.distance ?? Infinity;
        view.root.updateWorldMatrix(true, true);
        const original = [skin, backing].map(mesh => mesh.geometry);
        const clean = distance(skin);
        assert.ok(Number.isFinite(clean) && clean < distance(backing), `${zone} clean`);
        let previousDent = 0;
        for (const severity of [.25, .55, .8, 1]) {
          view.setPersistentCondition({damageZones: {[zone]: severity}});
          view.root.updateWorldMatrix(true, true);
          const depth = distance(skin), dent = depth - clean;
          const sample = `${zone} ${severity} (${skinName} / ${backingName})`;
          assert.ok(Number.isFinite(depth), `${sample}: thin panel disappeared from the impact ray`);
          assert.ok(depth <= distance(backing) + .001, `${sample}: backing protrudes by ${(depth - distance(backing)).toFixed(4)}`);
          assert.ok(dent >= previousDent - .001, `${sample}: a stronger impact reduced the dent`);
          previousDent = dent;
        }
        assert.ok(previousDent > .018, `${zone}: impact must still visibly dent the metal`);
        for (const [wheel, geometry] of wheels) assert.equal(wheel.geometry, geometry, wheel.name);
        view.setPersistentCondition({});
        assert.equal(skin.geometry, original[0]);
        assert.equal(backing.geometry, original[1]);
      }
    } finally { view.dispose(); }
  });
}
