import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THREE as T} from './cinematic-three.mjs?v=1538801f0545ceb6';
import * as glass from '../src/render/vehicle-glass.mjs?v=d312f5431381b89c';

test('low race glass drops the transmission prepass and restores the authored material at higher quality',()=>{
 const pane=new T.MeshPhysicalMaterial({name:'Vehicle_Glass',transmission:1,opacity:.85,transparent:true,depthWrite:true});
 const lens=new T.MeshPhysicalMaterial({name:'Vehicle_Headlamp',transmission:.7,opacity:1});
 const other=new T.MeshPhysicalMaterial({name:'Other optical material',transmission:.8});
 const workshop=pane.clone();
 const policy=glass.createVehicleRefractionPolicy(new Set([pane,lens,other]));
 const original=[pane,lens].map(m=>[m.transmission,m.opacity,m.transparent,m.depthWrite,m.forceSinglePass]);
 policy.setReduced(true);
 assert.deepEqual([pane,lens].map(m=>[m.transmission,m.transparent,m.depthWrite,m.forceSinglePass]),
  [[0,true,false,true],[0,true,false,true]]);
 assert.ok(pane.opacity>0&&pane.opacity<.15);
 assert.ok(Math.abs(lens.opacity-.3)<1e-12);
 assert.equal(other.transmission,.8);
 assert.equal(workshop.transmission,1);
 const version=pane.version;
 policy.setReduced(true);
 assert.equal(pane.version,version);
 policy.setReduced(false);
 assert.deepEqual([pane,lens].map(m=>[m.transmission,m.opacity,m.transparent,m.depthWrite,m.forceSinglePass]),original);
});

test('a vehicle staged before a tier change uses the live tier when committed',async()=>{
 const source=readFileSync(new URL('../src/legacy/module-02.mjs?v=4b220ed4b01db6f9',import.meta.url),'utf8');
 const start=source.indexOf('  async function preparePlayerVehicle(');
 const end=source.indexOf("  setLoading('Preparando vegetación",start);
 let tier='balanced';
 const refraction=[],mount=new T.Group();
 const presentation={root:new T.Group(),setReducedRefraction:value=>refraction.push(value),setChassisConfig(){},setLightMode(){}};
 const scope={
  THREE:T,raceChevyV3Model:mount,runtimeDeviceProfile:{phone:false},scene:{},
  window:{__asfaltoVehiclePresentations:{}},getVehicleDefinition:()=>null,
  createVehiclePresentation:async()=>presentation,
  authoredControlMounts:{restore(){},attach(){}},authoredMirrors:null,raceChevyPresentation:null,
  cockpitMirrors:{feeds:{}},attachAuthoredMirrors:()=>null,authoredWindshieldMount:()=>null,cabinMount:{},
  raceCameraInitialized:true,lightingEditor:null,rayTracing:null,
  raceWorld:{getPerformanceTier:()=>tier,attachWeatherWindshield(){},invalidateVehiclePhysics(){},getDrivingLights:()=>({mode:'off'})}
 };
 const prepare=new Function('scope',`with(scope){${source.slice(start,end)};return preparePlayerVehicle;}`)(scope);
 const staged=await prepare('chevrolet_1969');
 assert.equal(mount.children[0].visible,false);
 tier='low';
 staged.commit();
 assert.equal(mount.children[0].visible,true);
 assert.equal(refraction.at(-1),true);
});
