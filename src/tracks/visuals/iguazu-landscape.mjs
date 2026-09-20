import {yieldToMain} from '../../runtime/cooperative-work.mjs';
import {waterfallCameraProfileAsync} from './regional-waterfall-camera.mjs?v=4147e1c291a4f463';
import {regionalReviewPlan} from './regional-review-plan.mjs?v=3ef6be1d326a3487';
import {createIguazuFern} from './regional-forest.mjs?v=b20261a5a12d8b0b';
import {prepareIguazuSurfaces,terrainHeightSampler} from './reference-landscape.mjs?v=457a8af4bf40a703';
import {applySurfaceVertexColors} from './surface-vertex-colors.mjs?v=60d9521f76c1d1f1';
import {installSharedInstanceWindow} from '../seam-copy-factory.mjs?v=87374a99c604ce32';
import {findWaterfallImpactAsync,refineWaterfallVolume,connectSidefallToBasin,repairBakedSidefallTransform,createSidefallReceivingLedge} from './waterfall-impact.mjs?v=88a5c279fc1ae5d5';

const sourceTemplates=new WeakMap();
const rand=n=>{const x=Math.sin(n*17.831+4.917)*43961.7;return x-Math.floor(x);};
const ownerOf=mesh=>{let node=mesh;while(node&&!/^VEG_/.test(node.name||''))node=node.parent;return node;};
async function makeBatches(T,root,items,prefix,{signal}={}){
  let deadline=performance.now()+6;
  const checkpoint=async()=>{signal?.throwIfAborted();if(performance.now()>=deadline){await yieldToMain();deadline=performance.now()+6;}};
  const bins=new Map();
  for(const item of items){const e=item.matrix.elements,key=item.geometry.uuid+':'+item.material.uuid+':'+Math.floor(e[12]/256)+':'+Math.floor(e[14]/256);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(item);}
  for(const [key,list]of bins){
    await checkpoint();
    const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.name=prefix+key;list.forEach((item,i)=>mesh.setMatrixAt(i,item.matrix));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=false;
    const original=list.map(x=>x.matrix),range=list[0].range,maximum=list.length;
    const instanceWindow=installSharedInstanceWindow(T,mesh,{rangeM:range,eligible:index=>!original[index].asfaltoReturnExcluded});
    if(/MAT_(leaf|palm|fern|bark)|ASFALTO_IGUAZU_FERN_V7/.test(mesh.material.name))mesh.userData.asfaltoReprojectInstances=heightAt=>{let changed=0;for(let i=0;i<original.length;i++){const e=original[i].elements,y=heightAt(e[12],e[14],e[13]);if(y===null){original[i].asfaltoReturnExcluded=true;original[i].scale(new T.Vector3(0,0,0));changed++;}else if(Number.isFinite(y)){e[13]=y;changed++;}instanceWindow.source.set(original[i].elements,i*16);}if(changed)instanceWindow.replace(instanceWindow.source);return changed;};
    mesh.userData.asfaltoIguazuInstances={maximum,rangeM:range};root.add(mesh);
  }return bins.size;
}
export async function prepareIguazuVisual(root,{query,signal,THREE:T=globalThis.__chevyV6Three||globalThis.THREE}={}){
  if(!root?.isObject3D||!T)return null;
  root.updateMatrixWorld(true);const riverMeshes=[],falls=[];root.traverse(mesh=>{if(mesh.isMesh&&mesh.material?.name==='MAT_river_FLOW')riverMeshes.push(mesh);if(mesh.isMesh&&mesh.material?.name==='MAT_waterfall_FLOW')falls.push(mesh);});
  const groundAt=terrainHeightSampler(T,root);
  for(const mesh of falls){signal?.throwIfAborted();await yieldToMain();repairBakedSidefallTransform(T,mesh);if(/^SIDEFALL_/.test(mesh.name)){
    const pool=createSidefallReceivingLedge(T,mesh,{heightAt:groundAt.raw,query,root,material:riverMeshes[0]?.material});if(pool)riverMeshes.push(pool);
    connectSidefallToBasin(T,mesh,riverMeshes);
  }const impact=await findWaterfallImpactAsync(T,mesh,riverMeshes,{signal});refineWaterfallVolume(T,mesh,impact||{});mesh.userData.asfaltoWaterfallContact=impact;}const fernForms=[0,1,2].map(v=>createIguazuFern(T,v)),fernMaterial=new T.MeshStandardMaterial({name:'ASFALTO_IGUAZU_FERN_V7',color:'#879f67',roughness:.97,metalness:0,vertexColors:true,side:T.DoubleSide,envMapIntensity:.18});
  fernMaterial.userData.asfaltoWind={heightM:1.2,baseY:0,maxBendM:.09};fernMaterial.userData.asfaltoRainCanopy=true;
  const replacedFernSources=new Set();let fernReplacements=0;
  const plants=[],remove=new Set(),templates=[],templateNames=new Set(),worldInverse=root.matrixWorld.clone().invert();let vegetationParts=0;
  const nodes=[];root.traverse(node=>nodes.push(node));let deadline=performance.now()+6;
  for(const mesh of nodes){
    if(performance.now()>=deadline){signal?.throwIfAborted();await yieldToMain();deadline=performance.now()+6;}
    if(!mesh.isMesh||/SOURCE_OWNER/.test(mesh.name))continue;
    let plant=ownerOf(mesh);if(!plant){let node=mesh;while(node.parent&&node.parent!==root)node=node.parent;if(/^(ROCK_|CLIFF_|PROP_|BRIDGE_|LATERITE_|JUNGLE_ARCH_|VINE_)/.test(node.name||''))plant=node;}const name=mesh.material?.name||'';
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
    if(!plant)continue;
    if(/^VEG_/.test(plant.name))vegetationParts++;remove.add(plant);const matrix=worldInverse.clone().multiply(mesh.matrixWorld),range=/fern|understory|shrub/.test(plant.name)?190:1050;
    let geometry=mesh.geometry,material=mesh.material;
    if(/^VEG_fern_/.test(plant.name)&&query.project([mesh.matrixWorld.elements[12],mesh.matrixWorld.elements[13],mesh.matrixWorld.elements[14]]).distanceXZ<38){
      replacedFernSources.add(geometry);geometry=fernForms[fernReplacements%3];material=fernMaterial;fernReplacements++;
    }
    plants.push({geometry,material,matrix,range});
    if(/^VEG_(tree|palmito|fern|shrub)_/.test(plant.name)){
      const family=plant.name.split('_')[1],signature=family+':'+mesh.geometry.uuid+':'+mesh.material.uuid;
      if(!templateNames.has(signature)&&templates.filter(t=>t.family===family).length<12){templateNames.add(signature);const local=plant.matrixWorld.clone().invert().multiply(mesh.matrixWorld);templates.push({family,geometry:mesh.geometry,material:mesh.material,local,range,scale:plant.scale.clone()});}
    }
  }
  const group=new T.Group();group.name='ASFALTO_IGUAZU_INSTANCED_FOREST';const batches=await makeBatches(T,group,plants,'IGUAZU_SOURCE_',{signal});for(const plant of remove){plant.removeFromParent();if(performance.now()>=deadline){signal?.throwIfAborted();await yieldToMain();deadline=performance.now()+6;}}root.add(group);sourceTemplates.set(root,templates);
  const fernOwner=new T.Group();fernOwner.name='ASFALTO_FERN_RESOURCE_OWNER';fernOwner.visible=false;
  for(const geometry of new Set([...fernForms,...replacedFernSources]))fernOwner.add(new T.Mesh(geometry,fernMaterial));root.add(fernOwner);
  const points=[{key:'portal-verde',sM:120},{key:'selva',sM:4850}].map(p=>{const q=query.sample(p.sM);return{...p,position:q.position.map((v,i)=>v-q.frame.tangent[i]*10+(i===1?4:0)),target:q.position.map((v,i)=>v+q.frame.tangent[i]*80+(i===1?1.8:0)),fov:58};});
  points.push(await waterfallCameraProfileAsync(T,root,{query,falls,heightAt:groundAt,signal}));
  root.userData.asfaltoRegionalCameras={id:'cataratas_iguazu',views:points};root.userData.asfaltoWeather={snowLineM:1500,valleyFloorM:15};root.userData.asfaltoIguazu={sourceVegetationParts:vegetationParts,instancedBatches:batches,templateParts:templates.length,sourceGeometryPreserved:true,fernReplacements};
  root.userData.asfaltoIguazu.surfaces=await prepareIguazuSurfaces(root,{THREE:T,signal});
  root.userData.asfaltoRegionalReview=regionalReviewPlan({id:'cataratas_iguazu',query,lengthM:query.lengthM});
  return root.userData.asfaltoIguazu;
}
export async function prepareIguazuReturn(root,{sourceRoot,query,startM,lengthM,signal,THREE:T=globalThis.__chevyV6Three||globalThis.THREE}={}){
  if(!root?.isObject3D||!T)return null;
  const templates=sourceTemplates.get(sourceRoot)||[];if(!templates.length)return null;
  const {terrainHeightSampler}=await import('./reference-landscape.mjs?v=457a8af4bf40a703'),heightAt=terrainHeightSampler(T,root),items=[],dummy=new T.Object3D();let count=0;
  for(let s=startM+80;s<lengthM-80&&count<6000;s+=18)for(const side of [-1,1])for(const band of [18,45,90,160]){
    if(count>=6000)continue;const seed=s+side*371+band*7;if(rand(seed)>.72)continue;const q=query.sample(s),off=side*(band+rand(seed+2)*25),p=q.position.map((v,i)=>v+q.frame.left[i]*off),y=heightAt(p[0],p[2]);if(!Number.isFinite(y)||Math.abs(y-p[1])>60)continue;
    const family=band<30?(rand(seed+3)>.4?'fern':'shrub'):rand(seed+4)>.8?'palmito':'tree',parts=templates.filter(t=>t.family===family),variant=Math.floor(rand(seed+8)*Math.max(1,parts.length/2)),chosen=parts.slice(variant*2,variant*2+2);if(!chosen.length)continue;
    dummy.position.set(p[0],y-.06,p[2]);dummy.rotation.set(0,rand(seed+6)*Math.PI*2,0);const scale=.7+rand(seed+9)*.6;dummy.scale.set(scale,scale,scale);dummy.updateMatrix();
    for(const t of chosen)items.push({geometry:t.geometry,material:t.material,matrix:dummy.matrix.clone().multiply(new T.Matrix4().makeScale(t.scale.x,t.scale.y,t.scale.z)).multiply(t.local),range:t.range});count++;
  }
  const group=new T.Group();group.name='ASFALTO_IGUAZU_RETURN_FOREST';const batches=await makeBatches(T,group,items,'IGUAZU_RETURN_',{signal});root.add(group);applySurfaceVertexColors(T,root,{id:'cataratas_iguazu'});root.userData.asfaltoIguazuReturn={plants:count,batches};return root.userData.asfaltoIguazuReturn;
}
