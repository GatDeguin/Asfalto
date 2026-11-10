import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const lods=[0,1,2];
function transport(id,lod){
 const file=readFileSync(new URL(`../assets/vehicles/${id}-lod${lod}.glb`,import.meta.url));
 const document=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));
 const part=name=>{
  const node=document.nodes.find(entry=>entry.name===name);
  assert.ok(node?.mesh!==undefined,`${id} LOD ${lod} is missing ${name}`);
  const primitive=document.meshes[node.mesh].primitives[0];
  return {node,material:document.materials[primitive.material],triangles:document.accessors[primitive.indices].count/3};
 };
 return {document,part};
}

test('all 400 body tiers fit inner and outer sealed beams and a second pair of door cuts',()=>{
 for(const lod of lods){
  const {document,part}=transport('chevy_400_1957',lod);
  const outer=part('SS250_OuterSealedBeams'),inner=part('SS250_InnerSealedBeams');
  assert.equal(outer.material.name,'SS250_HeadlampOuter');
  assert.equal(inner.material.name,'SS250_HeadlampHigh');
  assert.equal(outer.triangles,inner.triangles);
  assert.ok(outer.triangles>=150);
  assert.ok(document.nodes.filter(n=>/^Headlight_/.test(n.name)).every(n=>n.mesh===undefined));
  assert.ok(part('SS250_Panel_gap_AdditionalDoors').triangles>0);
  assert.ok(part('SS250_BodyTrim_CenterPillars').triangles>0);
  assert.ok(part('SS250_BodyTrim_IdentificationPlates').triangles>0);
  assert.equal(document.nodes.find(n=>n.name==='Badges__22_White_lettering')?.mesh,undefined);
  assert.match(part('chevy_400_1957_hood_V7_Hood_continuous_skin').material.name,/^Vehicle_Paint__/);
 }
});

test('the 3100 keeps its badges on the live hood and its five painted slats in every tier',()=>{
 for(const lod of lods){
  const {document,part}=transport('pickup_3100',lod);
  const hood=document.nodes.find(n=>n.extras?.hoodHingeAuthored&&/C3100_Paint_Turquoise$/.test(n.name));
  const letters=part('C3100_BodyTrim_StampedLettering');
  const backing=part('C3100_BodyTrim_HoodNameplates');
  for(const badge of [letters,backing])assert.deepEqual(badge.node.extras.hoodHingeAuthored,hood.extras.hoodHingeAuthored);
  const slats=part('C3100_Grille_PaintedStampedSlats');
  assert.equal(slats.material.name,'C3100_Paint_Turquoise');
  assert.equal(slats.triangles%5,0);
  assert.ok(part('C3100_Grille_BrightLowerEdges').triangles>0);
 }
});

test('the Bel Air uses the gold lattice and fluted quarter panels in every tier',()=>{
 let previous=Infinity;
 for(const lod of lods){
  const {document,part}=transport('belair_1957',lod);
  const flutes=part('BA57_BodyTrim_QuarterFlutes');
  assert.equal(flutes.material.name,'BA57_BodyTrim_AnodizedAluminium');
  assert.ok(flutes.triangles<previous);
  previous=flutes.triangles;
  assert.equal(part('BA57_Grille_GoldRectangularLattice').material.name,'BA57_BodyTrim_AnodizedGold');
  assert.ok(part('BA57_BodyTrim_FenderLouvers').triangles>0);
  assert.equal(part('BA57_PositionLamps').material.name,'BA57_HeadlampPosition');
  assert.equal(document.nodes.filter(n=>n.name.startsWith('belair_1957_radioDonor_')).length,lod===0?3:0);
 }
});
