import test from 'node:test';
import assert from 'node:assert/strict';
import { THREE as T } from './cinematic-three.mjs?v=1538801f0545ceb6';
import { createTrafficDriver } from '../src/render/traffic-driver.mjs?v=9229a704a8fd763a';
import { createDriveTrafficView } from '../src/render/drive-traffic-view.mjs?v=fc2c05d15d3d494a';
import {loadVehicleGeometry} from './vehicle-cabin-pilot-fixture.mjs';

test('the seated driver fits below the roof and changes appearance without replacing the pose', () => {
  const driver = createTrafficDriver(T, {eye:[.48,1.13,.43], wheel:[-.05,.89,.43], roofM:1.39});
  assert.equal(driver.root.name, 'TrafficDriver');
  assert.ok(new T.Box3().setFromObject(driver.root,true).max.y<1.39);
  const mesh=driver.root.getObjectByName('OccupantSkin');
  assert.ok(mesh.isSkinnedMesh);
  assert.equal(mesh.skeleton.bones.length,16);
  const firstGeometry=mesh.geometry;
  const before=driver.diagnostics();
  const skin=mesh.material[0].color.getHex();
  driver.setVariant(4);
  assert.notEqual(mesh.material[0].color.getHex(),skin);
  assert.notEqual(mesh.geometry,firstGeometry);
  assert.deepEqual(driver.diagnostics().hands,before.hands);
  const newGeometry=mesh.geometry;
  driver.setParked(true);
  assert.notDeepEqual(driver.diagnostics().hands,before.hands);
  assert.equal(mesh.geometry,newGeometry);
  driver.setParked(false);
  assert.deepEqual(driver.diagnostics().hands,before.hands);
  const near=driver.diagnostics();
  driver.setLod('far');
  assert.ok(driver.diagnostics().triangles<near.triangles*.43);
  assert.deepEqual(driver.diagnostics().head,near.head);
  driver.setLod('near');
  assert.equal(mesh.geometry,newGeometry);
  driver.dispose();
  assert.equal(driver.root.children.length,0);
});

test('the traffic view draws the same poses and body footprint it admits to physics', async t => {
  const scene=new T.Scene();
  const view=createDriveTrafficView(T,{scene,loadGlb:async url=>{
    if(!url.includes('chevy-lod2'))throw new Error('missing model');
    const model=new T.Group();
    const body=new T.Mesh(new T.BoxGeometry(2,.40,.74),new T.MeshStandardMaterial({name:'BodyPaint'}));
    body.position.set(.10,.04,.02);
    const mirror=new T.Mesh(new T.BoxGeometry(.08,.12,.1),new T.MeshStandardMaterial());
    mirror.name='outside_mirror';mirror.position.z=.85;
    model.add(body,mirror);
    return model;
  }});
  t.after(()=>view.dispose());
  const parked={id:1,kind:'parked',model:'chevy',progressM:20,direction:1,side:1,color:'#465565',driver:0,rim:0,tire:0,brake:0};
  const duplicate={...parked,id:2,progressM:80};
  const missing={...parked,id:3,model:'falcon'};
  await view.prepare([parked,duplicate,missing]);
  const sample=s=>({position:[s,0,0],frame:{tangent:[1,0,0],normal:[0,1,0],left:[0,0,1]},widthM:7});
  const poses=view.stage([parked,duplicate,missing],sample);
  assert.deepEqual(poses.map(p=>p.id),[1]);
  assert.deepEqual(poses[0].position,[20,.03,3.98]);
  assert.ok(Math.abs(poses[0].hull.halfExtents[0]-2.5)<1e-6);
  assert.ok(Math.abs(poses[0].hull.halfExtents[2]-.925)<1e-6,'the mirror does not enlarge the body');
  view.update(poses,20);
  const model=scene.getObjectByName('DriveTraffic_chevy');
  assert.equal(model.visible,true);
  assert.deepEqual(model.position.toArray(),poses[0].position);
  assert.deepEqual(model.quaternion.toArray(),poses[0].rotation);
  view.update(view.stage([],sample),20);
  assert.equal(model.visible,false);
});

test('each shipped traffic model uses its optics and running state, and keeps a far occupant',async t=>{
  const scene=new T.Scene();
  const view=createDriveTrafficView(T,{scene,loadGlb:async url=>loadVehicleGeometry(url.split('/').at(-1).split('-lod')[0],2)});
  t.after(()=>view.dispose());
  const models=['chevy','chevrolet_1969','chevy_400_1957','falcon','belair_1957','pickup_3100'];
  const cars=models.map((model,id)=>({id,model,kind:'regular',direction:1,side:1,progressM:250,
    finish:'daily',color:'#465565',driver:id,passenger:(id+1)%6,rim:0,tire:0,brake:0,poseTimeS:1.2}));
  await view.prepare(cars);
  assert.deepEqual(view.diagnostics().errors,[]);
  const sample=s=>({position:[s,0,0],frame:{tangent:[1,0,0],normal:[0,1,0],left:[0,0,1]},widthM:7,curvaturePerM:.005});
  for(const car of cars) {
    const poses=view.stage([car],sample);
    view.update(poses,198,1);
    const night=view.diagnostics(),light=night.runningLights[car.model];
    assert.equal(light.mode,'low',car.model);
    assert.ok(light.sourceMaterials.low.length>0,car.model);
    assert.ok(light.sourceMaterials.tail.length>0,car.model);
    assert.equal(night.occupants[car.model].driver.lod,'far',car.model);
    assert.ok(night.occupants[car.model].passenger.head[2]<0,car.model);
    assert.equal(scene.getObjectByName(`DriveTraffic_${car.model}`).children.filter(node=>node.name.startsWith('TrafficLamp_')).length,6);
    assert.equal(scene.children[0].children.filter(node=>node.isSpotLight&&node.intensity>0).length,2);
    view.update(poses,230,0);
    const day=view.diagnostics();
    assert.equal(day.runningLights[car.model].mode,'position',car.model);
    assert.equal(day.occupants[car.model].driver.lod,'near',car.model);
    view.update(poses,212,0);
    assert.equal(view.diagnostics().occupants[car.model].driver.lod,'near','the 34–41 m band preserves the current LOD');
    const parked={...car,id:car.id+20,kind:'parked',hazards:true,parking:{edgeOffsetM:.8,liftM:.085}};
    const stopped=view.stage([parked],sample);
    assert.deepEqual(stopped[0].position,[250,.085,4.3]);
    view.update(stopped,243,1);
    const parkedView=view.diagnostics();
    assert.equal(parkedView.runningLights[car.model].hazards,true,car.model);
    assert.equal(parkedView.occupants[car.model].driver.parkBlend,1,car.model);
  }
});
