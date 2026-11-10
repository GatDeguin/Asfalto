import test from 'node:test';
import assert from 'node:assert/strict';
import { THREE as T } from './cinematic-three.mjs?v=1538801f0545ceb6';
import { createTrafficDriver } from '../src/render/traffic-driver.mjs?v=42860607f9e38d27';

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
