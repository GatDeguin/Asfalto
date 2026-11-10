import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE as T} from './cinematic-three.mjs';
import {CIRCUIT_IDS,readCircuitSource} from './fixtures/closed-circuit-source.mjs';
import {createClosedRoute} from '../src/tracks/visuals/route-closure.mjs?v=ed419e307fa1007f';
import {createRouteQuery} from '../src/tracks/route-query.mjs';
import * as direction from '../src/tracks/visuals/route-direction.mjs?v=45e8a4216d1415cc';
import {addRegionalLandscapeDetails} from '../src/tracks/visuals/regional-landscape-details.mjs?v=d33414548db428b8';

const routeFixture=id=>{
  const source=readCircuitSource(id),closed=createClosedRoute(source,{id});
  const query=createRouteQuery(closed.route);
  // Follow the sampled road elevation; geometry and ground rejection are
  // separately exercised with the real return root below.
  return {source,closed,query,heightAt:(x,z)=>query.project([x,0,z]).position[1]};
};

for(const id of CIRCUIT_IDS)test(id+' authors both legs and reserves quiet sectors',()=>{
  const {source,closed,query,heightAt}=routeFixture(id);
  for(const [leg,expected] of [['outbound',source.sectors],['return',closed.closure.chapters]]){
    const plan=direction.planRouteDirection({id,leg,query,heightAt,chapters:closed.closure.chapters,lengthM:source.lengthM});
    const sectorRanges=sectors=>sectors.map(({id,startM,endM})=>[id,startM,endM]);
    assert.deepEqual(sectorRanges(plan.sectors),sectorRanges(expected));
    assert.ok(plan.cues.some(c=>c.kind==='place'),'a contextual reference anchors the leg');
    assert.ok(plan.sectors.some(s=>s.intent==='quiet'),'visual breaks are authored');
    for(const sector of plan.sectors){
      const cues=plan.cues.filter(c=>c.sector===sector.id);
      assert.ok(sector.reason.trim());
      if(sector.intent==='quiet')assert.equal(cues.length,0);
      assert.ok(cues.length<=5,'one warning, three supports and a release at most');
      for(const cue of cues){
        assert.ok(cue.sM>sector.startM&&cue.sM<sector.endM);
        const near=query.project(cue.position);
        assert.ok(near.distanceXZ>near.widthM*.5+2.6,'all bases clear the shoulder');
        if(cue.kind==='chevron')assert.equal(cue.side,-cue.turn,'support is outside the bend');
      }
    }
  }
});

test('supports for the Lipán hairpins stay in their streamed sector',()=>{
  const id='cuesta_lipan',{source,query,heightAt}=routeFixture(id);
  const detailRange={startM:4200,endM:7700};
  const opts={id,leg:'outbound',query,heightAt,lengthM:source.lengthM,detailRange};
  const plan=direction.planRouteDirection(opts);
  const supports=plan.cues.filter(c=>c.phase==='support');
  assert.ok(supports.length>=1,'the real switchback has a support cue');
  assert.ok(plan.cues.every(c=>c.sM>=4200&&c.sM<7700));
  assert.equal(direction.planRouteDirection({...opts,heightAt:()=>NaN}).cues.length,0,'no cue without terrain');
});

test('the Cornisa del Buque chevron points with the road rather than away from it',()=>{
  const id='dos_lagos',{source,query,heightAt}=routeFixture(id);
  const plan=direction.planRouteDirection({id,leg:'outbound',query,heightAt,lengthM:source.lengthM});
  const cue=plan.cues.find(c=>c.kind==='chevron'&&c.sector==='s03'&&c.sM>3540);
  assert.ok(cue);
  const q=query.sample(cue.sM),ahead=query.sample(cue.sM+25);
  // +X of the oncoming board (right on its face) in world space.
  const x=Math.cos(cue.yaw),z=-Math.sin(cue.yaw);
  const move=(ahead.position[0]-q.position[0])*x+(ahead.position[2]-q.position[2])*z;
  assert.ok(move*cue.turn>0);
});

test('an authored return warning only replaces generic warnings close to it',()=>{
  const first={sM:100},overlap={sM:980},last={sM:1200};
  const cues=[{sM:1000,kind:'warning'},{sM:1190,kind:'delineator'}];
  assert.deepEqual(direction.withoutNearbyGenericWarnings?.([first,overlap,last],cues),[first,last]);
});

test('the legacy warning at the Cornisa draws its arrow in the actual turn direction',()=>{
  const id='dos_lagos',{source,query,heightAt}=routeFixture(id),root=new T.Group();
  const originalDocument=globalThis.document;
  // Capture the real texture drawing commands without bringing a browser into
  // the Node suite. Both the sign mesh and its route projection are real.
  globalThis.document={createElement(){
    const canvas={};let translateX=0,scaleX=1,points=[];
    canvas.getContext=()=>({
      fillRect(){},strokeRect(){},stroke(){},quadraticCurveTo(){},
      translate(x){translateX+=x;},scale(x){scaleX*=x;},
      beginPath(){points=[];},moveTo(x){points.push(translateX+x*scaleX);},lineTo(x){points.push(translateX+x*scaleX);},
      fill(){canvas.arrowDx=points[1]-points[0];},
    });
    return canvas;
  }};
  try{
    const textures={aerial_rocks_04:{diff:null,normal:null,rough:null}};
    addRegionalLandscapeDetails(T,root,{id,query,lengthM:source.lengthM,heightAt,textures,templates:new Map(),detailRange:{startM:3510,endM:3548}});
    let board;
    root.traverse(node=>{if(node.isInstancedMesh&&/curve-approach/.test(node.name))board=node;});
    assert.ok(board,'one existing warning sign is rendered at the Cornisa');
    const matrix=new T.Matrix4();board.getMatrixAt(0,matrix);
    const position=new T.Vector3().setFromMatrixPosition(matrix).toArray();
    const station=query.project(position).sM,q=query.sample(station),ahead=query.sample(station+25);
    const dx=(ahead.position[0]-q.position[0])*matrix.elements[0]+(ahead.position[2]-q.position[2])*matrix.elements[2];
    assert.ok(dx*board.material.map.image.arrowDx>0,'warning arrow agrees with the sign-local direction of the road');
  }finally{
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
    const resources=new Set();root.traverse(node=>{if(node.isMesh){resources.add(node.geometry);resources.add(node.material);if(node.material.map)resources.add(node.material.map);}});
    for(const resource of resources)resource.dispose();
  }
});

test('the physical return renders a sparse visual direction layer, separate from collision',()=>{
  const id='dos_lagos', closed=createClosedRoute(readCircuitSource(id),{id});
  const {visualRoot,collisionRoot}=closed.createRoots(T);
  try {
    const group=visualRoot.getObjectByName('ASFALTO_ROUTE_DIRECTION_return');
    assert.ok(group,'return has a dedicated layer of roadside cues');
    assert.equal(collisionRoot.getObjectByName(group.name),undefined);
    const draws=[];group.traverse(node=>{if(node.isMesh)draws.push(node);});
    assert.ok(draws.length>0&&draws.length<=4,'visual direction stays within four draw calls');
    assert.ok(draws.every(node=>!node.castShadow),'no additional shadow draws');
  } finally {
    const resources=new Set();
    for(const root of [visualRoot,collisionRoot])root.traverse(node=>{
      if(node.isMesh){resources.add(node.geometry);resources.add(node.material);}
    });
    for(const resource of resources)resource.dispose();
  }
});
