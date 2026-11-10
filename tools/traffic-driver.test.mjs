import test from 'node:test';
import assert from 'node:assert/strict';
import { THREE as T } from './cinematic-three.mjs?v=1538801f0545ceb6';
import { createTrafficDriver } from '../src/render/traffic-driver.mjs?v=6a52e1173920be49';
import { createDriveTrafficView } from '../src/render/drive-traffic-view.mjs?v=44d4ba6f65de40c7';

test('the seated driver fits below the roof and changes appearance without replacing the pose', () => {
  const driver = createTrafficDriver(T, {eye:[.48,1.13,.43], wheel:[-.05,.89,.43], roofM:1.39});
  assert.equal(driver.root.name, 'TrafficDriver');
  assert.ok(new T.Box3().setFromObject(driver.root).max.y<1.39);
  const geometries=driver.root.children.map(mesh=>mesh.geometry);
  const before=driver.root.children.map(mesh=>mesh.material.color.getHex());
  driver.setVariant(4);
  assert.notDeepEqual(driver.root.children.map(mesh=>mesh.material.color.getHex()),before);
  assert.deepEqual(driver.root.children.map(mesh=>mesh.geometry),geometries);
  driver.setParked(true);
  assert.notDeepEqual(driver.root.children.map(mesh=>mesh.geometry),geometries);
  driver.setParked(false);
  assert.deepEqual(driver.root.children.map(mesh=>mesh.geometry),geometries);
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
