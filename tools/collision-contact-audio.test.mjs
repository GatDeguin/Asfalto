import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({console,WebAssembly,TextDecoder,TextEncoder,atob,btoa,performance});
for(const name of ['rapier','vehicle-model','physics-runtime','falcon-runtime','integration-runtime']) {
  const file=new URL(`../src/legacy/asfalto-v6-${name}.js`,import.meta.url);
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file.pathname});
}
const R=context.AsfaltoV6Rapier;
await R.init();

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function wall(name,z){
  const points=[0,0,z,100,0,z,100,3,z,0,3,z];
  return {name,isMesh:true,matrixWorld:{elements:identity},geometry:{attributes:{position:{array:new Float32Array(points),itemSize:3,count:4}},index:{array:new Uint32Array([0,1,2,0,2,3]),count:6}}};
}
async function setup(nodes=[]){
  const track={length:100,sample:s=>({s,x:s,y:0,z:0,heading:0,width:12,halfWidth:6,grade:0,bank:0})};
  const collisionRoot={matrixWorld:{elements:identity},traverse:visit=>nodes.forEach(visit)};
  return context.AsfaltoV6Integration.createBrowserPhysicalStack({track,collisionRoot,vehicleProfile:'original'});
}

test('actual Rapier strikes keep their authored collider material in a mixed track',async t=>{
  const stack=await setup([wall('COL_Guardrail',3),wall('COL_Boulder',-3)]);
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  for(const [direction,material] of [[1,'metal'],[-1,'stone']]){
    player.reset({spawn:{x:30,y:.65,z:0}});
    player.body.setLinvel({x:0,y:0,z:direction*24},true);
    for(let i=0;i<30&&!player.getSnapshot().impacts.length;i++)player.stepFixed({});
    const event=player.getSnapshot().impacts.at(-1);
    assert.ok(event?.impulseNs>1000,'wall must be struck by the actual rigid body');
    assert.equal(event.material,material);
    assert.equal(Math.sign(event.localPointM[2]),direction);
  }
});

test('actual loaded chassis sliding along a guardrail supplies scrape telemetry until separated',async t=>{
  const stack=await setup([wall('COL_Guardrail',3)]);
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  player.teleport({x:30,y:.65,z:1.9},{x:16,y:0,z:1.6});
  let scrape;
  for(let i=0;i<44&&!scrape;i++){
    player.body.applyImpulse({x:0,y:0,z:35},true);
    const snapshot=player.stepFixed({});
    scrape=snapshot.scrapeContact;
  }
  assert.equal(scrape?.material,'metal');
  assert.ok(scrape.tangentialSpeedMps>6);
  assert.ok(scrape.normalForceN>1000);
  assert.ok(scrape.localSideM>0);
  player.teleport({x:30,y:.65,z:0});
  assert.equal(player.getSnapshot().scrapeContact,null);
});

test('actual player to Falcon contact exports a measured vehicle impact',async t=>{
  const stack=await setup();
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  stack.rival.setActive(true);
  player.teleport({x:4,y:.65,z:0},{x:26,y:0,z:0});
  for(let i=0;i<36&&!player.getSnapshot().impacts.length;i++)player.step(1/120,{});
  const event=player.getSnapshot().impacts.at(-1);
  assert.ok(event?.impulseNs>1000);
  assert.equal(event.otherId,'falcon');
  assert.equal(event.material,'vehicle-metal');
  assert.ok(event.relativeVelocityMps[0]>15);
  assert.ok(event.localPointM[0]>0);
});

const trafficHull={center:[0,.55,0],halfExtents:[2.2,.35,.87]};
const trafficPose=(id,x,z,rotation=[0,0,0,1])=>({id,position:[x,.03,z],rotation,hull:trafficHull});

test('parked route traffic collides only at its visible offset and removal frees the lane',async t=>{
  const stack=await setup();
  t.after(()=>stack.dispose());
  const player=stack.physicsSession,car=trafficPose(1,30,3.6);
  player.teleport({x:19,y:.65,z:0},{x:24,y:0,z:0});
  for(let i=0;i<70;i++){
    stack.syncDriveTraffic([car],player.getSnapshot());
    player.step(1/120,{});
  }
  assert.ok(player.body.translation().x>31);
  assert.equal(player.getSnapshot().impacts.length,0);
  player.reset({spawn:{x:19,y:.65,z:3.6}});
  player.body.setLinvel({x:24,y:0,z:0},true);
  for(let i=0;i<70&&!player.getSnapshot().impact;i++){
    stack.syncDriveTraffic([car],player.getSnapshot());
    player.step(1/120,{});
  }
  const hit=player.getSnapshot().impacts.at(-1);
  assert.ok(hit?.impulseNs>1000);
  assert.equal(hit.otherId,'traffic:1');
  assert.equal(hit.material,'vehicle-metal');
  assert.ok(player.body.linvel().x<15);
  stack.syncDriveTraffic([],player.getSnapshot());
  assert.equal(stack.diagnostics.driveTrafficColliders,0);
  player.reset({spawn:{x:19,y:.65,z:3.6}});
  player.body.setLinvel({x:24,y:0,z:0},true);
  for(let i=0;i<70;i++)player.step(1/120,{});
  assert.ok(player.body.translation().x>31);
  assert.equal(player.getSnapshot().impacts.length,0);
});

test('oncoming traffic contributes its actual speed to the solver impact and keeps one collider',async t=>{
  const stack=await setup();
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  player.teleport({x:20,y:.65,z:0},{x:12,y:0,z:0});
  for(let i=0;i<100&&!player.getSnapshot().impact;i++){
    stack.syncDriveTraffic([trafficPose(8,39-i*15/120,0,[0,1,0,0])],player.getSnapshot());
    player.step(1/120,{});
    assert.equal(stack.diagnostics.driveTrafficColliders,1);
  }
  const hit=player.getSnapshot().impacts.at(-1);
  assert.equal(hit?.otherId,'traffic:8');
  assert.ok(hit.relativeVelocityMps[0]>23);
});

test('an overtaking vehicle can strike the player from behind when it moves into the lane',async t=>{
  const stack=await setup();
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  player.teleport({x:50,y:.65,z:1},{x:6,y:0,z:0});
  for(let i=0;i<112&&!player.getSnapshot().impact;i++){
    const side=-1.4+2.4*Math.max(0,Math.min(1,(i-25)/45));
    stack.syncDriveTraffic([trafficPose(11,34+i*28/120,side)],player.getSnapshot());
    player.step(1/120,{});
  }
  const hit=player.getSnapshot().impacts.at(-1);
  assert.equal(hit?.otherId,'traffic:11');
  assert.ok(hit.relativeVelocityMps[0]<-14);
  assert.ok(hit.localPointM[0]<-1);
});

test('traffic follows the player world through a reference chart change',async t=>{
  const stack=await setup();
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  player.teleport({x:20,y:.65,z:0},{x:23,y:0,z:0});
  stack.syncDriveTraffic([trafficPose(14,32,0)],player.getSnapshot());
  const point=([x,y,z])=>[x-1000,y+5,z+300];
  const transform={point,vector:value=>Array.from(value),rotation:value=>Array.from(value)};
  stack.transformReferenceFrame(transform,{referenceChart:1});
  assert.equal(stack.diagnostics.driveTrafficColliders,1);
  for(let i=0;i<70&&!player.getSnapshot().impact;i++)player.step(1/120,{});
  const hit=player.getSnapshot().impacts.at(-1);
  assert.equal(hit?.otherId,'traffic:14');
  assert.ok(hit.relativeVelocityMps[0]>15);
});

test('traffic leaving the view or entering a discontinuity cannot leave a distant collider',async t=>{
  const stack=await setup();
  t.after(()=>stack.dispose());
  const player=stack.physicsSession;
  player.teleport({x:20,y:.65,z:0});
  stack.syncDriveTraffic([trafficPose(9,100,0)],player.getSnapshot());
  assert.equal(stack.diagnostics.driveTrafficColliders,0);
  stack.syncDriveTraffic([trafficPose(9,35,0)],player.getSnapshot());
  assert.equal(stack.diagnostics.driveTrafficColliders,1);
  stack.clearDriveTraffic();
  assert.equal(stack.diagnostics.driveTrafficColliders,0);
});
