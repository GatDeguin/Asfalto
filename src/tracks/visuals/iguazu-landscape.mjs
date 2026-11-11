import {waterfallCameraProfile} from './regional-waterfall-camera.mjs?v=4147e1c291a4f463';
import {regionalReviewPlan} from './regional-review-plan.mjs?v=3ef6be1d326a3487';
import {createIguazuFern} from './regional-forest.mjs?v=76e2be9ca5367f98';
import {batchIguazuGround} from './iguazu-ground-batches.mjs?v=657ba3796dce7370';
import {prepareIguazuSurfaces,terrainHeightSampler} from './reference-landscape.mjs?v=893415f03864bece';
import {applySurfaceVertexColors} from './surface-vertex-colors.mjs?v=60d9521f76c1d1f1';
import {installSharedInstanceWindow} from '../seam-copy-factory.mjs?v=24bdf88876427050';
import {findWaterfallImpact,refineWaterfallVolume,connectSidefallToBasin,repairBakedSidefallTransform,createSidefallReceivingLedge} from './waterfall-impact.mjs?v=88a5c279fc1ae5d5';
import {addRouteDirection} from './route-direction.mjs?v=e9e6dcf49d8bbd2e';
import {addKilometreMarkers} from './regional-wayfinding.mjs?v=01d189b1a8467e23';
import {addIguazuNativeRoadSigns} from './iguazu-signs.mjs?v=963ecc7c5f8c18fb';
import {addScenicSetpieces} from './scenic-setpieces.mjs?v=02639ca1402db565';

const sourceTemplates=new WeakMap();
const trunkShapes=new WeakMap();
const roadsideTreeReachM=48;
const rand=n=>{const x=Math.sin(n*17.831+4.917)*43961.7;return x-Math.floor(x);};
const ownerOf=mesh=>{let node=mesh;while(node&&!/^VEG_/.test(node.name||''))node=node.parent;return node;};

function iguazuRoadsideTrees(query,lengthM){
  const cellM=64,stepM=16,cells=new Set();
  const cell=value=>Math.floor(value/cellM);
  // Include neighboring cells before doing an exact route projection. This
  // conservatively covers 48 m even halfway between the 16 m route samples.
  for(let s=0;;s+=stepM){
    const [x,,z]=query.sample(Math.min(s,lengthM)).position;
    const cx=cell(x),cz=cell(z);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)cells.add((cx+dx)+':'+(cz+dz));
    if(s>=lengthM)break;
  }
  return (x,y,z)=>cells.has(cell(x)+':'+cell(z))&&query.project([x,y,z]).distanceXZ<=roadsideTreeReachM;
}

function iguazuTrunkShape(geometry){
  if(trunkShapes.has(geometry))return trunkShapes.get(geometry);
  const position=geometry.attributes.position,index=geometry.index;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  // The exported trunks start at the local origin. The roots spread outward
  // beyond the stem, so take only the basal shaft of the authored mesh.
  const contactHeight=geometry.boundingBox.min.y+1.35,stemRadiusM=.85;
  const isStemVertex=i=>Math.hypot(position.getX(i),position.getZ(i))<=stemRadiusM;
  const vertices=[],indices=[],mapped=new Map();
  for(let i=0;i<(index?.count??position.count);i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    if(Math.min(position.getY(a),position.getY(b),position.getY(c))>contactHeight||![a,b,c].every(isStemVertex))continue;
    for(const source of [a,b,c]){
      if(!mapped.has(source)){
        mapped.set(source,vertices.length/3);
        vertices.push(position.getX(source),position.getY(source),position.getZ(source));
      }
      indices.push(mapped.get(source));
    }
  }
  const shape={vertices,indices};
  trunkShapes.set(geometry,shape);
  return shape;
}

function addIguazuTrunkBatch(T,root,source,trees){
  if(!trees.length)return null;
  const mesh=new T.InstancedMesh(source.geometry,source.material,trees.length);
  mesh.name=source.name+'_TRUNK_COLLISION';
  mesh.visible=false;
  mesh.userData.asfaltoTrunkCollider=iguazuTrunkShape(source.geometry);
  trees.forEach((tree,i)=>mesh.setMatrixAt(i,tree.matrix));
  const window=installSharedInstanceWindow(T,mesh,{rangeM:Infinity,eligible:i=>!trees[i].matrix.asfaltoReturnExcluded});
  root.add(mesh);
  return ()=>{
    trees.forEach(({matrix},i)=>window.source.set(matrix.elements,i*16));
    window.replace(window.source);
  };
}

export function iguazuInstanceRange(name){
  if(/^(BANK_(PLANT|SCREE)_|WOW_(rock|arch)_)/.test(name))return Infinity;
  if(/^(VEG_|ROCK_|CLIFF_|PROP_|BRIDGE_|LATERITE_|JUNGLE_ARCH_|VINE_)/.test(name))return /fern|understory|shrub/.test(name)?190:1050;
  return null;
}
export function createIguazuInstanceBatches(T,root,items,prefix){
  const bins=new Map();
  for(const item of items){
    const key=item.geometry.uuid+':'+item.material.uuid+':'+item.range;
    if(!bins.has(key))bins.set(key,new Map());
    const cells=bins.get(key),e=item.matrix.elements,cell=Math.floor(e[12]/256)+':'+Math.floor(e[14]/256);
    if(!cells.has(cell))cells.set(cell,[]);
    cells.get(cell).push(item);
  }
  for(const [key,cells]of bins){
    const partitions=[...cells.values()],list=partitions.flat();
    const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.name=prefix+key;list.forEach((item,i)=>mesh.setMatrixAt(i,item.matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=false;
    const original=list.map(x=>x.matrix),range=list[0].range,maximum=list.length;
    const instanceWindow=installSharedInstanceWindow(T,mesh,{rangeM:range,eligible:index=>!original[index].asfaltoReturnExcluded,viewPartitions:partitions.map(items=>items.length)});
    const updateTrunks=addIguazuTrunkBatch(T,root,mesh,list.filter(item=>item.treeTrunk));
    if(Number.isFinite(range)&&/MAT_(leaf|palm|fern|bark)|ASFALTO_IGUAZU_FERN_V7/.test(mesh.material.name))mesh.userData.asfaltoReprojectInstances=heightAt=>{let changed=0;for(let i=0;i<original.length;i++){const e=original[i].elements,y=heightAt(e[12],e[14],e[13]);if(y===null){original[i].asfaltoReturnExcluded=true;original[i].scale(new T.Vector3(0,0,0));changed++;}else if(Number.isFinite(y)){e[13]=y;changed++;}instanceWindow.source.set(original[i].elements,i*16);}if(changed){instanceWindow.replace(instanceWindow.source);updateTrunks?.();}return changed;};
    mesh.userData.asfaltoIguazuInstances={maximum,rangeM:range};root.add(mesh);
  }return bins.size;
}
export async function prepareIguazuVisual(root,{query,lengthM,signal,THREE:T=globalThis.__chevyV6Three||globalThis.THREE}={}){
  if(!root?.isObject3D||!T)return null;
  root.updateMatrixWorld(true);const riverMeshes=[],falls=[];root.traverse(mesh=>{if(mesh.isMesh&&mesh.material?.name==='MAT_river_FLOW')riverMeshes.push(mesh);if(mesh.isMesh&&mesh.material?.name==='MAT_waterfall_FLOW')falls.push(mesh);});
  const groundAt=terrainHeightSampler(T,root);
  const nativeSigns=addIguazuNativeRoadSigns(T,root,{query,heightAt:groundAt});
  for(const mesh of falls){repairBakedSidefallTransform(T,mesh);if(/^SIDEFALL_/.test(mesh.name)){
    const pool=createSidefallReceivingLedge(T,mesh,{heightAt:groundAt.raw,query,root,material:riverMeshes[0]?.material});if(pool)riverMeshes.push(pool);
    connectSidefallToBasin(T,mesh,riverMeshes);
  }const impact=findWaterfallImpact(T,mesh,riverMeshes);refineWaterfallVolume(T,mesh,impact||{});mesh.userData.asfaltoWaterfallContact=impact;}const fernForms=[0,1,2].map(v=>createIguazuFern(T,v)),fernMaterial=new T.MeshStandardMaterial({name:'ASFALTO_IGUAZU_FERN_V7',color:'#879f67',roughness:.97,metalness:0,vertexColors:true,side:T.DoubleSide,envMapIntensity:.18});
  fernMaterial.userData.asfaltoWind={heightM:1.2,baseY:0,maxBendM:.09};fernMaterial.userData.asfaltoRainCanopy=true;
  const replacedFernSources=new Set();let fernReplacements=0;
  const plants=[],bankDetails=[],remove=new Set(),removeBankDetails=new Set(),templates=[],templateNames=new Set(),worldInverse=root.matrixWorld.clone().invert();let vegetationParts=0;
  const isRoadsideTree=iguazuRoadsideTrees(query,lengthM);
  root.traverse(mesh=>{
    if(!mesh.isMesh||/SOURCE_OWNER/.test(mesh.name))return;
    let plant=ownerOf(mesh);
    if(!plant){plant=mesh;while(plant.parent&&plant.parent!==root)plant=plant.parent;}
    const range=iguazuInstanceRange(plant.name),name=mesh.material?.name||'';
    if(/MAT_(leaf|palm|fern|bark)/.test(name)){mesh.material.userData.asfaltoWind={heightM:/fern/.test(name)?1.2:12,baseY:0,maxBendM:/bark/.test(name)?.14:.24};mesh.material.userData.asfaltoSnow=true;mesh.material.alphaToCoverage=true;}
    if(/MAT_(leaf|palm)/.test(name))mesh.material.userData.asfaltoRainCanopy=true;
    if(/MAT_(basalt|laterite|forest_floor|earthen_bank)/.test(name))mesh.material.userData.asfaltoSnow=true;
    if(name==='MAT_river_FLOW'){
      const center=new T.Box3().setFromObject(mesh).getCenter(new T.Vector3()),q=query.project(center.toArray()),sample=query.sample(q.sM);
      mesh.userData.asfaltoWater={kind:'river',maxDepthM:mesh.userData.asfaltoSidefallPool?.waterY!==undefined?.65:4,shoreWidthM:mesh.userData.asfaltoSidefallPool?1.2:7,flowDirection:{x:sample.frame.tangent[0],z:sample.frame.tangent[2]},flowSpeedMps:1.8,roughness:.42,shallowColor:'#64785a',deepColor:'#314734',absorptionPerMeter:.45};
    }
    if(name==='MAT_waterfall_FLOW'){
      const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3());
      mesh.userData.asfaltoWaterfall={heightM:box.max.y-box.min.y,speedMps:12,flowDirection:[0,-1,0],baseWidthM:Math.hypot(box.max.x-box.min.x,box.max.z-box.min.z),bottomCenter:[center.x,box.min.y,center.z],sprayRadiusM:12,...(mesh.userData.asfaltoWaterfallContact||{})};
    }
    if(name==='MAT_foam'||name==='MAT_mist_LOCAL')mesh.userData.asfaltoWaterfallAux={kind:name==='MAT_foam'?'foam':'mist',source:'delivered_iguazu_environment'};
    if(range===null)return;
    if(/^VEG_/.test(plant.name))vegetationParts++;
    const bankDetail=range===Infinity,matrix=worldInverse.clone().multiply(mesh.matrixWorld);
    (bankDetail?removeBankDetails:remove).add(plant);
    let geometry=mesh.geometry,material=mesh.material;
    if(/^VEG_fern_/.test(plant.name)&&query.project([mesh.matrixWorld.elements[12],mesh.matrixWorld.elements[13],mesh.matrixWorld.elements[14]]).distanceXZ<38){
      replacedFernSources.add(geometry);geometry=fernForms[fernReplacements%3];material=fernMaterial;fernReplacements++;
    }
    const origin=mesh.matrixWorld.elements;
    const treeTrunk=name==='MAT_bark'&&/^VEG_(tree|palmito)_/.test(plant.name)&&isRoadsideTree(origin[12],origin[13],origin[14]);
    (bankDetail?bankDetails:plants).push({geometry,material,matrix,range,treeTrunk});
    if(/^VEG_(tree|palmito|fern|shrub)_/.test(plant.name)){
      const family=plant.name.split('_')[1],signature=family+':'+mesh.geometry.uuid+':'+mesh.material.uuid;
      if(!templateNames.has(signature)&&templates.filter(t=>t.family===family).length<12){templateNames.add(signature);const local=plant.matrixWorld.clone().invert().multiply(mesh.matrixWorld);templates.push({family,geometry:mesh.geometry,material:mesh.material,local,range,scale:plant.scale.clone()});}
    }
  });
  const group=new T.Group();group.name='ASFALTO_IGUAZU_INSTANCED_FOREST';const batches=createIguazuInstanceBatches(T,group,plants,'IGUAZU_SOURCE_');for(const plant of remove)plant.removeFromParent();root.add(group);sourceTemplates.set(root,templates);
  const fernOwner=new T.Group();fernOwner.name='ASFALTO_FERN_RESOURCE_OWNER';fernOwner.visible=false;
  for(const geometry of new Set([...fernForms,...replacedFernSources]))fernOwner.add(new T.Mesh(geometry,fernMaterial));root.add(fernOwner);
  const points=[{key:'portal-verde',sM:120},{key:'selva',sM:4850}].map(p=>{const q=query.sample(p.sM);return{...p,position:q.position.map((v,i)=>v-q.frame.tangent[i]*10+(i===1?4:0)),target:q.position.map((v,i)=>v+q.frame.tangent[i]*80+(i===1?1.8:0)),fov:58};});
  points.push(waterfallCameraProfile(T,root,{query,falls,heightAt:groundAt}));
  // Keep the original ray blockers for the camera pose search above.
  const bankBatches=createIguazuInstanceBatches(T,group,bankDetails,'IGUAZU_BANK_');
  for(const owner of removeBankDetails)owner.removeFromParent();
  root.userData.asfaltoRegionalCameras={id:'cataratas_iguazu',views:points};root.userData.asfaltoWeather={snowLineM:1500,valleyFloorM:15};root.userData.asfaltoIguazu={sourceVegetationParts:vegetationParts,instancedBatches:batches+bankBatches,bankDetailParts:bankDetails.length,bankBatches,templateParts:templates.length,sourceGeometryPreserved:true,fernReplacements};
  root.userData.asfaltoIguazu.surfaces=await prepareIguazuSurfaces(root,{THREE:T,signal});
  root.userData.asfaltoRegionalReview=regionalReviewPlan({id:'cataratas_iguazu',query,lengthM});
  const direction=addRouteDirection(T,root,{id:'cataratas_iguazu',leg:'outbound',query,lengthM,heightAt:groundAt,existingCues:nativeSigns?.cues});
  root.userData.asfaltoIguazu.routeDirectionCues=direction.cues.length;
  root.userData.asfaltoIguazu.kilometreMarkers=addKilometreMarkers(T,root,{query,lengthM,heightAt:groundAt});
  const water=new Set(riverMeshes);
  const waterAt=terrainHeightSampler(T,root,mesh=>water.has(mesh),{includeDefaultTerrain:false}).raw;
  const bankAt=terrainHeightSampler(T,root,mesh=>/^MAT_(basalt|laterite)/.test(mesh.material?.name||''),{includeDefaultTerrain:false}).raw;
  const dryGroundAt=(x,z)=>{
    const y=Math.max(groundAt.raw(x,z),bankAt(x,z)),waterY=waterAt(x,z);
    return y<=waterY+.45?NaN:y;
  };
  root.userData.asfaltoIguazu.scenicSetpieces=addScenicSetpieces(T,root,{id:'cataratas_iguazu',leg:'outbound',query,lengthM,heightAt:dryGroundAt});
  return root.userData.asfaltoIguazu;
}
export function addIguazuApproachPlants(T, root, name, placements) {
  const templates = sourceTemplates.get(root);
  if (!templates) return;
  const dummy = new T.Object3D(), scale = new T.Matrix4();
  for (const family of ['tree', 'palmito']) {
    const rows = placements.filter((_, i) => (i % 5 === 0) === (family === 'palmito'));
    const parts = templates.filter(template => template.family === family).slice(0, 2);
    if (!rows.length) continue;
    parts.forEach(({geometry, material, local, scale: authoredScale}, part) => {
      const mesh = new T.InstancedMesh(geometry, material, rows.length);
      mesh.name = `${name}_${family}_${part}`;
      mesh.receiveShadow = true;
      if(material.name==='MAT_bark')mesh.userData.asfaltoTrunkCollider=iguazuTrunkShape(geometry);
      scale.makeScale(...authoredScale.toArray()).multiply(local);
      rows.forEach(({x, y, z, size, rotation}, i) => {
        dummy.position.set(x, y, z);
        dummy.rotation.y = rotation;
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix.multiply(scale));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    });
  }
}

export function reseatIguazuFinishPlants(T, root) {
  if (!T || !root?.isObject3D) return null;
  const banks = [-1, 1].map(side => root.getObjectByName('APPROACH_FINISH_TERRAIN_' + side));
  if (banks.some(mesh => !mesh?.isMesh || mesh.parent?.userData.iguazuFinishRegrade !== 1)) return null;
  const bankSet = new Set(banks);
  const heightAt = terrainHeightSampler(T,root,mesh=>bankSet.has(mesh)||/^TERRAIN_/.test(mesh.name)
    || mesh.userData.asfaltoDistantRidge,{includeDefaultTerrain:false}).raw;
  const matrix = new T.Matrix4();
  let supported = 0, unsupported = 0, maximumShiftM = 0;
  for (const family of ['tree','palmito']) {
    const parts = [0,1].map(part=>root.getObjectByName(`APPROACH_FINISH_CANOPY_${family}_${part}`))
      .filter(mesh=>mesh?.isInstancedMesh);
    const trunk = parts.find(mesh=>mesh.material?.name==='MAT_bark');
    if (!trunk || parts.some(mesh=>mesh.count!==trunk.count)) continue;
    trunk.geometry.computeBoundingBox();
    for (let i=0;i<trunk.count;i++) {
      trunk.getMatrixAt(i,matrix);
      const e = matrix.elements;
      const floor = heightAt(e[12],e[14]);
      if (!Number.isFinite(floor)) {
        unsupported++;
        continue;
      }
      // Parts of the same instance share a root. Move the crown and the
      // trunk collider by the same amount so their alignment stays intact.
      const base = e[13] + trunk.geometry.boundingBox.min.y * e[5];
      const shift = floor - .06 - base;
      for (const mesh of parts) {
        mesh.getMatrixAt(i,matrix);
        matrix.elements[13] += shift;
        mesh.setMatrixAt(i,matrix);
      }
      supported++;
      maximumShiftM = Math.max(maximumShiftM,Math.abs(shift));
    }
    for (const mesh of parts) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }
  return root.userData.asfaltoIguazuFinish = Object.freeze({supported,unsupported,maximumShiftM});
}

export async function prepareIguazuReturn(root,{sourceRoot,query,startM,lengthM,THREE:T=globalThis.__chevyV6Three||globalThis.THREE}={}){
  if(!root?.isObject3D||!T)return null;
  if(sourceRoot?.isObject3D&&sourceRoot.userData.asfaltoIguazu)sourceRoot.userData.asfaltoIguazu.ground=batchIguazuGround(T,sourceRoot);
  const templates=sourceTemplates.get(sourceRoot)||[];if(!templates.length)return null;
  const {terrainHeightSampler}=await import('./reference-landscape.mjs?v=893415f03864bece'),heightAt=root.userData.asfaltoReturnHeightAt||terrainHeightSampler(T,root),items=[],dummy=new T.Object3D();let count=0;
  delete root.userData.asfaltoReturnHeightAt;
  for(let s=startM+80;s<lengthM-80&&count<6000;s+=18)for(const side of [-1,1])for(const band of [18,45,90,160]){
    if(count>=6000)continue;const seed=s+side*371+band*7;if(rand(seed)>.72)continue;const q=query.sample(s),off=side*(band+rand(seed+2)*25),p=q.position.map((v,i)=>v+q.frame.left[i]*off),y=heightAt(p[0],p[2]);if(!Number.isFinite(y)||Math.abs(y-p[1])>60)continue;
    const family=band<30?(rand(seed+3)>.4?'fern':'shrub'):rand(seed+4)>.8?'palmito':'tree',parts=templates.filter(t=>t.family===family),variant=Math.floor(rand(seed+8)*Math.max(1,parts.length/2)),chosen=parts.slice(variant*2,variant*2+2);if(!chosen.length)continue;
    dummy.position.set(p[0],y-.06,p[2]);dummy.rotation.set(0,rand(seed+6)*Math.PI*2,0);const scale=.7+rand(seed+9)*.6;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();
    for(const t of chosen)items.push({geometry:t.geometry,material:t.material,matrix:dummy.matrix.clone().multiply(new T.Matrix4().makeScale(t.scale.x,t.scale.y,t.scale.z)).multiply(t.local),range:t.range});count++;
  }
  const group=new T.Group();group.name='ASFALTO_IGUAZU_RETURN_FOREST';const batches=createIguazuInstanceBatches(T,group,items,'IGUAZU_RETURN_');root.add(group);applySurfaceVertexColors(T,root,{id:'cataratas_iguazu'});root.userData.asfaltoIguazuReturn={plants:count,batches};return root.userData.asfaltoIguazuReturn;
}
