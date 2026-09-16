import {configureSurfaceRelief,installSurfaceRelief} from './surface-relief.mjs';
import {installSharedInstanceWindow} from '../seam-copy-factory.mjs?v=vehicles-r1-20260916';
import { createRegionalTreeTemplates, createCrownTexture, applyCrownDistanceTransition, applyPhotographicLeafCutout } from './regional-forest.mjs';
// Blender-authored, local-metre meshes. All instances are visual and have no collision role.
const ASSETS = new URL('../../../assets/tracks/visual-correction/', import.meta.url);

export async function loadRoadsideTemplates(THREE, signal, id="dos_lagos") {
  const response = await fetch(new URL('roadside-details.glb', ASSETS), { signal });
  if (!response.ok) throw new Error('Roadside model HTTP ' + response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('Roadside model must be glTF 2');
  const length = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
  const bin = bytes.subarray(28 + length), geometries = new Map();
  const types = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const attribute = index => {
    const a = json.accessors[index], b = json.bufferViews[a.bufferView], Type = types[a.componentType], size = sizes[a.type];
    if (!Type || !size || a.sparse || (b.byteStride && b.byteStride !== size * Type.BYTES_PER_ELEMENT)) throw new Error('Unsupported roadside accessor');
    const start = bin.byteOffset + (b.byteOffset || 0) + (a.byteOffset || 0);
    return new THREE.BufferAttribute(new Type(bin.buffer.slice(start, start + a.count * size * Type.BYTES_PER_ELEMENT)), size, Boolean(a.normalized));
  };
  try {
    for (const node of json.nodes) {
      if (node.mesh === undefined) continue;
      const primitives = json.meshes[node.mesh].primitives;
      if (primitives.length !== 1 || primitives[0].mode && primitives[0].mode !== 4 || node.matrix || node.translation || node.rotation || node.scale)
        throw new Error('Roadside meshes require baked transforms and one triangle primitive');
      const primitive = primitives[0], geometry = new THREE.BufferGeometry();
      geometries.set(node.name, geometry);
      for (const [name, index] of Object.entries(primitive.attributes)) {
        const slot = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', COLOR_0: 'color' }[name];
        if (slot) geometry.setAttribute(slot, attribute(index));
      }
      if (primitive.indices !== undefined) geometry.setIndex(attribute(primitive.indices));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    }
    for (const required of ['tree-0-bark','tree-0-leaf','rock-0','rock-1','rock-2','rock-3','grass-0','grass-1'])
      if (!geometries.has(required)) throw new Error('Missing roadside template ' + required);
    // Reuse the same optimized CC0 geometry with independently rotated/scaled
    // forest instances; orientation variants must not multiply buffer memory.
    for (const variant of [1, 2]) for (const part of ['bark', 'leaf'])
      if (!geometries.has('tree-'+variant+'-'+part)) geometries.set('tree-'+variant+'-'+part, geometries.get('tree-0-'+part));
    if (signal?.aborted) throw signal.reason || new Error('Roadside model aborted');
    const retired=new Set();for(const[name,geometry]of geometries)if(name.startsWith('tree-'))retired.add(geometry);
    for(const[name,geometry]of createRegionalTreeTemplates(THREE,{id}))geometries.set(name,geometry);
    for(const geometry of retired)geometry.dispose();
    return geometries;
  } catch (error) { for (const geometry of new Set(geometries.values())) geometry?.dispose(); throw error; }
}

function random(seed) {
  let value = seed >>> 0;
  return () => { value = Math.imul(value, 1664525) + 1013904223 >>> 0; return value / 4294967296; };
}

export function createRoadsidePlacements({ id, query, lengthM, heightAt, bounds, maxRocks = 5500, maxGrass = 6200, detailRange = null }) {
  const forest = id === 'dos_lagos' || id === 'paso_garibaldi';
  const rng = random(id === 'cuesta_lipan' ? 93271 : id === 'aconcagua_horcones' ? 62871 : 84377);
  const rocks = [], grass = [], step = Math.max(5.5, lengthM / 3100);
  for (let s = 0; s < lengthM; s += step) {
    if(detailRange&&(s<detailRange.startM||s>=detailRange.endM))continue;
    const sample = query.sample(s + rng() * step * .8), p = sample.position;
    if (bounds && (p[0] < bounds.min.x - 100 || p[0] > bounds.max.x + 100 || p[2] < bounds.min.z - 100 || p[2] > bounds.max.z + 100)) continue;
    for (const side of [-1, 1]) {
      const offset = side * ((sample.widthM || 8) / 2 + 3.3 + Math.pow(rng(), 1.5) * (forest ? 15 : 32));
      const x = p[0] + sample.frame.left[0] * offset, z = p[2] + sample.frame.left[2] * offset;
      const y = heightAt(x, z);
      if (!Number.isFinite(y) || y < p[1] - 7 || y > p[1] + 35) continue;
      let clearM = Math.abs(offset) - (sample.widthM || 8) / 2;
      if (query.project) {
        const q = query.project([x, y, z]);
        clearM = q.distanceXZ - q.widthM / 2;
        if (q.distanceXZ < q.widthM / 2 + 2.6) continue;
      }
      const size = Math.min(.18 + Math.pow(rng(), 2.4) * (forest ? 1.7 : 3.6), Math.max(.1, (clearM - 1.5) / 1.8));
      const placement = { position: [x, y - size * .22, z], scale: [size * (1 + rng()*.4), size, size], rotation: rng()*Math.PI*2, variation: Math.floor(rng()*4) };
      const pocket=.5+.5*Math.sin(s*.016+side*2.6)*Math.cos(s*.0067);
      if (rocks.length < maxRocks && rng() < (forest ? .25 : .25+pocket*.5)) rocks.push(placement);
      if (grass.length < maxGrass && pocket>.5 && rng() < (forest ? .9 : id === 'cuesta_lipan' ? .34 : .14)) {
        const scale = forest ? .8 + rng() * 1.3 : .7 + rng()*.9;
        for(let clump=0;clump<(forest?4:3)&&grass.length<maxGrass;clump++){
          const a=rng()*Math.PI*2,r=rng()*1.3,gx=x+Math.cos(a)*r,gz=z+Math.sin(a)*r,gy=heightAt(gx,gz);
          if(Number.isFinite(gy))grass.push({ ...placement, position:[gx,gy-.13,gz],scale: [scale, scale * (id === 'paso_garibaldi' ? .78 : 1), scale], variation: Math.floor(rng()*2) });
        }
      }
    }
  }
  return { rocks, grass };
}

// Small tiles remain frustum-cullable. The primary camera and mirror cameras
// independently select a tile; no per-frame edit changes an authored transform.
export function instanceDetailTiles(THREE, group, geometry, material, placements, { name, distanceM = 300, tileM = 260 } = {}) {
  const tiles = new Map(), dummy = new THREE.Object3D();
  for (const item of placements) {
    const key = Math.floor(item.position[0] / tileM) + ':' + Math.floor(item.position[2] / tileM);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push({...item,position:[...item.position]});
  }
  for (const [key, items] of tiles) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    mesh.name = 'ASFALTO_DETAIL_' + name + '_' + key;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      dummy.position.fromArray(item.position); dummy.scale.fromArray(item.scale); dummy.rotation.set(item.pitch||0, item.rotation, 0); dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.receiveShadow = true; mesh.castShadow = name === 'tree-bark';
    const instanceWindow=installSharedInstanceWindow(THREE,mesh,{rangeM:distanceM+12,eligible:index=>!items[index].returnExcluded,beforeRender:()=>material.userData.asfaltoFoliageUpdate?.()});
    const sourceMatrices=instanceWindow.source;
    mesh.userData.asfaltoReprojectInstances=heightAt=>{
      let changed=0;for(let index=0;index<items.length;index++){const p=items[index].position,y=heightAt(p[0],p[2],p[1]);if(y===null){items[index].returnExcluded=true;sourceMatrices.fill(0,index*16,index*16+12);changed++;continue;}if(!Number.isFinite(y)||Math.abs(y-p[1])<.35)continue;const delta=y-p[1];p[1]+=delta;sourceMatrices[index*16+13]+=delta;changed++;}
      if(changed)instanceWindow.replace(sourceMatrices);return changed;
    };
    group.add(mesh);
  }
  return tiles.size;
}

export function addRoadsideDetails(THREE, root, { id, query, lengthM, heightAt, templates, textures, treePlacements = [], detailRange = null }) {
  if (!templates?.size) return {};
  const group = new THREE.Group(); group.name = 'ASFALTO_ROADSIDE_DETAILS';
  root.updateMatrixWorld(true); group.matrix.copy(root.matrixWorld).invert(); group.matrixAutoUpdate = false;
  const bounds = new THREE.Box3().setFromObject(root);
  const { rocks, grass } = createRoadsidePlacements({ id, query, lengthM, heightAt, bounds, detailRange });
  const forest = id === 'dos_lagos' || id === 'paso_garibaldi', rockMaps = textures[forest ? 'aerial_rocks_04' : 'rock_face'];
  const rock = new THREE.MeshStandardMaterial({ map: rockMaps?.diff || null, normalMap: rockMaps?.normal || null, roughnessMap: rockMaps?.rough || null,
    normalScale: new THREE.Vector2(.55,.55), roughness: 1, color: id === 'cuesta_lipan' ? '#c9ae8a' : '#ced0c3', envMapIntensity: .35 });
  configureSurfaceRelief(THREE);
  rock.userData.asfaltoSurfaceRole='rock';
  installSurfaceRelief(rock,{heightMap:rockMaps?.height,depthM:.12,silhouette:true});
  const grassMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1, color: forest ? '#788151' : '#a99c71', envMapIntensity: .25 });
  const bark = new THREE.MeshStandardMaterial({ map: textures.detailBark || null, roughness: 1, color: '#b3aa94', envMapIntensity: .22 });
  const crownMap=forest?textures.detailLeaf:null;
  const leaf = new THREE.MeshStandardMaterial({ name:'ASFALTO_'+id+'_leaf', map: crownMap, roughness: .94, side: THREE.DoubleSide, color: id === 'paso_garibaldi' ? '#aebcae' : '#c2c9b2', envMapIntensity: .2 });
  leaf.vertexColors=true; leaf.side=THREE.DoubleSide;applyPhotographicLeafCutout(leaf);
  applyCrownDistanceTransition(leaf);applyCrownDistanceTransition(bark);
  leaf.userData.asfaltoSnow=true;
  leaf.userData.asfaltoRainCanopy=true;
  bark.userData.asfaltoSnow=true;
  leaf.userData.asfaltoWind={heightM:16,baseY:0,maxBendM:.35};
  bark.userData.asfaltoWind={heightM:16,baseY:0,maxBendM:.2};
  textures.regionalCrown=crownMap;
  rock.userData.asfaltoSnow=true;grassMaterial.userData.asfaltoSnow=true;grassMaterial.userData.asfaltoWind={heightM:1,baseY:0,maxBendM:.04};
  const materials = { rock, grass: grassMaterial, bark, leaf };
  const holder = new THREE.Group(); holder.name = 'ASFALTO_DETAIL_RESOURCE_OWNER'; holder.visible = false;
  for (const [name, geometry] of templates) {
    const role = name.startsWith('rock') ? 'rock' : name.startsWith('grass') ? 'grass' : name.endsWith('bark') ? 'bark' : 'leaf';
    if (!geometry.attributes.uv && role === 'rock') {
      const p = geometry.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { uv[i*2] = p.getX(i)*.6; uv[i*2+1] = (p.getZ(i)+p.getY(i))*.6; }
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    if (role === 'grass') {
      const p = geometry.attributes.position, color = new Float32Array(p.count*3);
      for (let i=0;i<p.count;i++) { const factor=.5+Math.min(.5,Math.max(0,p.getY(i))*.8); color.set([factor,factor,factor],i*3); }
      geometry.setAttribute('color',new THREE.BufferAttribute(color,3)); grassMaterial.vertexColors=true;
    }
    holder.add(new THREE.Mesh(geometry, materials[role]));
  }
  group.add(holder);
  let batches = 0;
  for (let variation = 0; variation < 4; variation++) batches += instanceDetailTiles(THREE, group, templates.get('rock-'+variation), rock,
    rocks.filter(item => item.variation === variation), { name: 'rock', distanceM: 360 });
  for (let variation = 0; variation < 2; variation++) batches += instanceDetailTiles(THREE, group, templates.get('grass-'+variation), grassMaterial,
    grass.filter(item => item.variation === variation), { name: 'grass', distanceM: 160 });
  const trees = treePlacements.filter(item => item.roadDistanceM <= 48).map(item => {
    const scale = item.height / 16;
    return { ...item, scale: [scale*item.width,scale,scale*item.width] };
  });
  if (forest) for (let variation = 0; variation < 3; variation++) for (const role of ['bark', 'leaf']) batches += instanceDetailTiles(THREE, group,
    templates.get('tree-'+variation+'-'+role), materials[role], trees.filter(item => item.variation === variation), { name: 'tree-'+role, distanceM: 245 });
  root.add(group);
  return { detailRocks: rocks.length, detailGrass: grass.length, detailTrees: trees.length, detailBatches: batches };
}
