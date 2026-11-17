import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { THREE as T } from './cinematic-three.mjs';
import { loadVehicleGeometryAsset } from './vehicle-cabin-pilot-fixture.mjs?v=d5045cbd1690ebd9';
import { createVehiclePresentation, installVehiclePresentation } from '../src/render/vehicle-presentation.mjs?v=290c23d70e1142a5';

function loadAsset(url) {
  const directory = process.env.VEHICLE_BODY_CRUSH_ASSETS;
  const candidate = directory && pathToFileURL(resolve(directory, basename(fileURLToPath(url))));
  return loadVehicleGeometryAsset(candidate && existsSync(candidate) ? candidate : url);
}

for(const lod of [0,1,2])test(`Chevy front seals stay behind lamps and grille under compound damage in LOD${lod}`,async()=>{
  const model=await loadAsset(new URL(`../assets/vehicles/chevy-lod${lod}.glb`,import.meta.url));
  const view=installVehiclePresentation(T,{vehicle:'chevy',modelRoot:new T.Group(),lods:[model],cabinSurfaceDetail:lod===0});
  const backing=model.getObjectByName('chevy_Glass_Rear_Gasket_Primitive_0');
  const original=backing.geometry,material=backing.material;
  const samples=[[-.267,'Cylinder.058_Primitive_0'],[.267,'Cylinder.058_Primitive_0'],[0,'chevy_Body_chrome_Primitive_0']];
  try{
    for(const condition of [{damageZones:{front:1}},{damageZones:{front:1,rear:1,left:1,right:1},mechanical:{body:{undersideCondition:.5371428571428571}}}]){
      view.setPersistentCondition(condition);view.root.updateWorldMatrix(true,true);
      for(const [z,name] of samples){
        const ray=rayFor('front',z,-.03),skin=model.getObjectByName(name);
        const depth=ray.intersectObject(skin,false)[0]?.distance??Infinity;
        const inner=ray.intersectObject(backing,false)[0]?.distance??Infinity;
        assert.ok(depth<2,'the observed front lamp or grille bar must remain in front of the cabin');
        assert.ok(inner>=depth-.001,`${name} at ${z}: rubber projects ${(depth-inner).toFixed(5)} in front of the lamp/grille`);
      }
      const radiator=model.getObjectByName('Cube.049_Primitive_0'),ray=rayFor('front',0,-.03);
      const grilleDepth=ray.intersectObject(model.getObjectByName('chevy_Body_chrome_Primitive_0'),false)[0]?.distance??Infinity;
      const radiatorDepth=ray.intersectObject(radiator,false)[0]?.distance??Infinity;
      assert.ok(radiatorDepth>=grilleDepth-.001,`the radiator projects ${(grilleDepth-radiatorDepth).toFixed(5)} in front of the grille`);
      assert.equal(backing.material,material,'seals retain their rubber material');
    }
    view.setPersistentCondition({});assert.equal(backing.geometry,original);
  }finally{view.dispose();}
});

for(const lod of [0,1,2])test(`compound Bel Air damage keeps the lower door frame behind the sheet in LOD${lod}`,async()=>{
  const model=await loadAsset(new URL(`../assets/vehicles/belair_1957-lod${lod}.glb`,import.meta.url));
  const view=installVehiclePresentation(T,{vehicle:'belair_1957',modelRoot:new T.Group(),lods:[model],cabinSurfaceDetail:lod===0});
  const skin=model.getObjectByName(`R3_Door-1.00${lod+7}_Primitive_0`),backing=model.getObjectByName(`DoorCut-1.00${lod+7}_Primitive_0`);
  const ray=rayFor('right',-.03969,-.15037),originals=new Map();
  model.traverse(mesh=>{if(mesh.isMesh)originals.set(mesh,mesh.geometry);});
  try{
    assert.ok(skin?.isMesh&&backing?.isMesh);
    for(const undersideCondition of [.5371428571428571,0]){
      view.setPersistentCondition({damageZones:{front:1,rear:1,left:1,right:1},mechanical:{body:{undersideCondition}}});
      view.root.updateWorldMatrix(true,true);
      const depth=ray.intersectObject(skin,false)[0]?.distance??Infinity;
      const inner=ray.intersectObject(backing,false)[0]?.distance??Infinity;
      if(undersideCondition>0)assert.ok(Number.isFinite(depth),'the lower door sheet must remain over the observed frame');
      if(!Number.isFinite(depth))continue; // A fully raised floor can leave this projection in LOD2.
      assert.ok(inner>=depth-.001,`lower door frame protrudes by ${(depth-inner).toFixed(5)} with underside condition ${undersideCondition}`);
    }
    view.setPersistentCondition({});
    for(const [mesh,geometry] of originals)assert.equal(mesh.geometry,geometry,'repair restores the exact shared geometry');
  }finally{view.dispose();}
});

for(const lod of [0,1,2])test(`compound Chevy damage keeps engine-bay backing inside LOD${lod}`,async()=>{
  const model=await loadAsset(new URL(`../assets/vehicles/chevy-lod${lod}.glb`,import.meta.url));
  const view=installVehiclePresentation(T,{vehicle:'chevy',modelRoot:new T.Group(),lods:[model],cabinSurfaceDetail:lod===0});
  const samples=[
    ['right',-.34131,.02566,'chevy_Body_paint_Primitive_0','Cube.047_Primitive_0'],
    ['left',-.35719,-.04978,'chevy_Body_paint_Primitive_0','Cylinder.064_Primitive_0'],
  ].map(([zone,x,y,skin,backing])=>({zone,ray:rayFor(zone,x,y),skin:model.getObjectByName(skin),backing:model.getObjectByName(backing)}));
  const originals=new Map(),failures=[];
  model.traverse(mesh=>{if(mesh.isMesh)originals.set(mesh,mesh.geometry);});
  try{
    view.root.updateWorldMatrix(true,true);
    const distance=(sample,mesh)=>sample.ray.intersectObject(mesh,false)[0]?.distance??Infinity;
    for(const sample of samples){assert.ok(sample.skin?.isMesh&&sample.backing?.isMesh);assert.ok(distance(sample,sample.skin)<distance(sample,sample.backing));}
    // The partial underside loss is the actual three-impact browser result.
    // Also cover the fully crushed underside and the two separate side hits.
    const conditions=[{damageZones:{left:1}},{damageZones:{right:1}},
      ...[.5371428571428571,0].map(undersideCondition=>({damageZones:{front:1,rear:1,left:1,right:1},mechanical:{body:{undersideCondition}}}))];
    for(const [index,condition] of conditions.entries()){
      view.setPersistentCondition(condition);view.root.updateWorldMatrix(true,true);
      for(const sample of samples){
        if(index<2&&sample.zone!==(index===0?'left':'right'))continue;
        const depth=distance(sample,sample.skin),gap=distance(sample,sample.backing)-depth;
        if(index===2)assert.ok(Number.isFinite(depth),`${sample.zone} ${sample.skin.name}: the observed sheet must still cover the ray`);
        if(!Number.isFinite(depth))continue; // A fully crushed underside can leave this projection.
        if(gap<-.001)failures.push(`${sample.zone} ${sample.backing.name}, condition ${index}: ${(-gap).toFixed(5)}`);
      }
    }
    view.setPersistentCondition({mechanical:{body:{undersideCondition:0}}});
    view.root.updateWorldMatrix(true,true);
    const floor=model.getObjectByName('chevy_Body_interior_Primitive_0'),before=originals.get(floor).attributes.position;
    const a=new T.Vector3(),b=new T.Vector3();let centralFloorDent=0;
    for(let i=0;i<before.count;i++){
      a.fromBufferAttribute(before,i).applyMatrix4(floor.matrixWorld);
      if(Math.abs(a.x)<.4&&Math.abs(a.z)<.08&&a.y<-.16){
        b.fromBufferAttribute(floor.geometry.attributes.position,i).applyMatrix4(floor.matrixWorld);
        centralFloorDent=Math.max(centralFloorDent,b.y-a.y);
      }
    }
    assert.ok(centralFloorDent>.01,'the floor between the supported flanges must still bend under an underside impact');
    view.setPersistentCondition({});
    for(const [mesh,geometry] of originals)assert.equal(mesh.geometry,geometry,'repair restores the exact shared geometry');
    assert.deepEqual(failures,[]);
  }finally{view.dispose();}
});

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
      loadGlb: url => loadAsset(new URL(url))});
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

// The long triangles in these inner skins used to bridge over the folded
// outer panel even though every vertex received the backing displacement.
for (const vehicle of ['chevy', 'belair_1957']) for (const lod of [0, 1, 2]) {
  test(`${vehicle} LOD${lod} keeps coarse backing faces behind a fully crushed panel`, async () => {
    const model = await loadAsset(new URL(`../assets/vehicles/${vehicle}-lod${lod}.glb`,import.meta.url));
    const view = installVehiclePresentation(T, {vehicle, modelRoot: new T.Group(), lods: [model], cabinSurfaceDetail: lod === 0});
    const samples = vehicle === 'chevy' ? [
      ['front', -.10175, -.20904, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['front', -.11275, -.20904, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['left', -.21431, -.19228, 'chevy_Body_paint_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['right', -.13494, -.17551, 'chevy_Body_paint_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['left', -.45244, -.19228, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['right', -.45244, -.19228, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['left', -.46831, -.15875, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['right', -.46831, -.15875, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['left', .67469, -.15875, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
      ['right', .67469, -.15875, 'chevy_Body_trim_Primitive_0', 'chevy_Body_interior_Primitive_0'],
    ] : [
      ['right', .05556, .00051, `R3_Door-1.00${lod + 7}_Primitive_0`, `Cubo.${[963, 1580, 1668][lod]}_Primitive_0`],
      ['right', .07144, .00051, `R3_Door-1.00${lod + 7}_Primitive_0`, `Cubo.${[963, 1580, 1668][lod]}_Primitive_0`],
      ['right', .02381, -.00787, `R3_Door-1.00${lod + 7}_Primitive_0`, `Cubo.${[963, 1580, 1668][lod]}_Primitive_0`],
    ];
    const wheels = new Map(), failures = [];
    view.root.traverse(node => {
      if (!node.name.endsWith('_PresentationPivot')) return;
      node.traverse(mesh => { if (mesh.isMesh) wheels.set(mesh, mesh.geometry); });
    });
    try {
      for (const [zone, horizontal, y, skinName, backingName] of samples) {
        const ray = rayFor(zone, horizontal, y);
        const skin = view.root.getObjectByName(skinName), backing = view.root.getObjectByName(backingName);
        assert.ok(skin?.isMesh && backing?.isMesh, `${skinName} / ${backingName}`);
        const original = [skin.geometry, backing.geometry], material = backing.material;
        const distance = mesh => ray.intersectObject(mesh, false)[0]?.distance ?? Infinity;
        view.root.updateWorldMatrix(true, true);
        const clean = distance(skin);
        assert.ok(Number.isFinite(clean) && clean < distance(backing), `${zone} clean at ${horizontal},${y}`);
        for (const severity of [.25, .55, .8, 1]) {
          view.setPersistentCondition({damageZones: {[zone]: severity}});
          view.root.updateWorldMatrix(true, true);
          const depth = distance(skin), gap = distance(backing) - depth;
          assert.ok(Number.isFinite(depth), `${zone}: sheet metal disappeared`);
          if (gap < -.001) failures.push(`${zone} ${severity} at ${horizontal},${y}: backing protrudes by ${(-gap).toFixed(5)}`);
          assert.equal(backing.material, material, 'crushing must retain the upholstery material');
        }
        for (const [wheel, geometry] of wheels) assert.equal(wheel.geometry, geometry, wheel.name);
        view.setPersistentCondition({});
        assert.equal(skin.geometry, original[0]);
        assert.equal(backing.geometry, original[1]);
      }
      assert.deepEqual(failures, []);
    } finally { view.dispose(); }
  });
}
