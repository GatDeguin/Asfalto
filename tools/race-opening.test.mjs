import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceOpening} from '../src/game/race-opening.mjs?v=463e5f3d50f43451';
import {regionalCameraProfiles} from '../src/tracks/visuals/regional-landscape-details.mjs?v=00ce76228f289119';

const viewpoint={position:[50,40,50],positionEnd:[68,46,62],target:[200,15,-100],fov:55,fovEnd:52,sM:320};

test('the opening camera travels on its authored path while holding the same landmark',()=>{
 const opening=createRaceOpening({duration:5});
 assert.equal(opening.start(viewpoint),true);
 const start=opening.diagnostics().shot;
 assert.deepEqual(start.position,viewpoint.position);
 let middle;
 for(let i=0;i<25;i++)middle=opening.step(.1);
 assert.ok(middle.blocking);
 assert.notDeepEqual(middle.shot.position,start.position);
 assert.ok(middle.shot.fov<start.fov);
 assert.deepEqual(middle.shot.target,viewpoint.target);
 assert.deepEqual(start.position,viewpoint.position);
 for(let i=0;i<23;i++)opening.step(.1);
 const end=opening.diagnostics().shot;
 assert.ok(Math.hypot(...end.position.map((v,i)=>v-viewpoint.positionEnd[i]))<1);
 assert.ok(end.fov>viewpoint.fovEnd);
});

test('pausing preserves the current pose and reduced motion can end an active opening',()=>{
 const opening=createRaceOpening();
 opening.start(viewpoint);
 const before=opening.step(.1);
 assert.deepEqual(opening.step(.1,{paused:true}),before);
 const reduced=opening.step(.1,{reducedMotion:true});
 assert.equal(reduced.active,false);
 assert.equal(reduced.blocking,false);
 assert.equal(reduced.shot,null);
 assert.equal(opening.start(viewpoint,{reducedMotion:true}),false);
});

test('skipping leaves the establishing shot through its fade and permits a fresh intro',()=>{
 const opening=createRaceOpening({duration:5,fade:.4});
 opening.start(viewpoint);
 opening.skip();
 assert.equal(opening.blocking,true);
 for(let i=0;i<5;i++)opening.step(.1);
 assert.equal(opening.blocking,false);
 assert.equal(opening.active,true);
 for(let i=0;i<5;i++)opening.step(.1);
 assert.equal(opening.active,false);
 assert.equal(opening.start(viewpoint),true);
 assert.equal(opening.diagnostics().elapsed,0);
});

test('the two reviewed circuit views provide a shorter shot and a bounded travel endpoint',()=>{
 const query={lengthM:24000,sample:sM=>({sM,position:[sM,0,0],frame:{left:[0,0,1],tangent:[1,0,0]}})};
 for(const id of ['dos_lagos','cuesta_lipan']){
  const {openingDurationS,openingShot}=regionalCameraProfiles({id,query});
  assert.equal(openingDurationS,5);
  assert.equal(openingShot.status,'rendered_reviewed');
  assert.ok(openingShot.positionEnd.every(Number.isFinite));
  const distance=Math.hypot(...openingShot.position.map((v,i)=>v-openingShot.positionEnd[i]));
  assert.ok(distance>10&&distance<60);
  if(id==='cuesta_lipan')assert.ok(openingShot.sM<1700,'Lipán opens inside the sector already loaded for the start');
 }
});
