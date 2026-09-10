/** Display-only cockpit geometry. All editor mounts and source materials remain authoritative. */
export const COCKPIT_DISPLAY_ASSETS=Object.freeze(['cabina','tablero','volante','pedales-accelerator','pedales-brake','palanca']);
const BASE_URL=new URL('../../assets/cockpit/v7/',import.meta.url);

export function decodeCockpitDisplayGeometry(T,input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length)throw new Error('Cockpit display GLB inválido');
 const jsonLength=view.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength))),binOffset=28+jsonLength,primitive=j.meshes?.[0]?.primitives?.[0];
 if(!primitive||!j.extras?.asfaltoDisplayLod)throw new Error('Falta procedencia del LOD cockpit');
 const g=new T.BufferGeometry();
 function read(index,components,indices=false){
  const a=j.accessors[index],b=j.bufferViews[a.bufferView],Type=indices?Uint32Array:Float32Array;
  if(a.componentType!==(indices?5125:5126)||b.byteStride||a.normalized)throw new Error('Formato de geometría cockpit no soportado');
  const begin=binOffset+(b.byteOffset||0)+(a.byteOffset||0),length=a.count*components*4;
  if(begin+length>bytes.length)throw new Error('Atributo cockpit truncado');
  return new T.BufferAttribute(new Type(bytes.buffer.slice(bytes.byteOffset+begin,bytes.byteOffset+begin+length)),components);
 }
 try{
  g.setAttribute('position',read(primitive.attributes.POSITION,3));g.setAttribute('normal',read(primitive.attributes.NORMAL,3));g.setAttribute('uv',read(primitive.attributes.TEXCOORD_0,2));g.setIndex(read(primitive.indices,1,true));
  if(g.attributes.position.count!==g.attributes.normal.count||g.attributes.position.count!==g.attributes.uv.count)throw new Error('Atributos cockpit desalineados');
  g.computeBoundingBox();g.computeBoundingSphere();
  const transform=j.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.extensions?.KHR_texture_transform;
  g.userData.cockpitDisplayLod={...j.extras.asfaltoDisplayLod,uvTransformScale:transform?.scale||[1,1]};return g;
 }catch(error){g.dispose();throw error;}
}

function geometryBytes(geometries){
 const arrays=new Set();for(const g of geometries){for(const a of Object.values(g.attributes)){const array=a.isInterleavedBufferAttribute?a.data.array:a.array;if(array)arrays.add(array);}if(g.index?.array)arrays.add(g.index.array);}
 return [...arrays].reduce((sum,array)=>sum+array.byteLength,0);
}

export function createCockpitDisplayLodController({bindings,geometries,enabled=true,editing=false}={}){
 const records=[];let disposed=false,requested=!!enabled,editorActive=!!editing;
 for(const [name,geometry] of Object.entries(geometries||{})){
  const mesh=bindings?.[name],source=mesh?.geometry,e=geometry?.userData?.cockpitDisplayLod;
  if(!mesh?.isMesh||!e)throw new Error('Binding de LOD cockpit inválido: '+name);
  if((source.index?.count||source.attributes.position.count)!==e.sourceTriangles*3)throw new Error('Topología fuente incompatible: '+name);
  if(!source.boundingBox)source.computeBoundingBox();
  const box=source.boundingBox;
  for(let axis=0;axis<3;axis++){
   const key=['x','y','z'][axis];if(Math.abs(box.min[key]-e.sourceBounds.min[axis])>.001||Math.abs(box.max[key]-e.sourceBounds.max[axis])>.001)throw new Error('Referencia original incompatible: '+name);
  }
  records.push({name,mesh,source,geometry});
 }
 function apply(){if(disposed)return false;const display=requested&&!editorActive;for(const r of records)r.mesh.geometry=display?r.geometry:r.source;return display;}
 apply();
 return Object.freeze({
  update({editing:next=editorActive}={}){editorActive=!!next;return apply();},
  setEnabled(value){requested=!!value;return apply();},
  diagnostics(){return {enabled:requested,editing:editorActive,disposed,display:!disposed&&requested&&!editorActive,sourceGeometryBytes:geometryBytes(records.map(r=>r.source)),displayGeometryBytes:geometryBytes(records.map(r=>r.geometry)),drawCalls:records.length,assets:records.map(r=>({name:r.name,sourceTriangles:r.source.index.count/3,displayTriangles:r.geometry.index.count/3,...JSON.parse(JSON.stringify(r.geometry.userData.cockpitDisplayLod))}))};},
  dispose(){if(disposed)return false;for(const r of records){if(r.mesh.geometry===r.geometry)r.mesh.geometry=r.source;r.geometry.dispose();}disposed=true;return true;},
 });
}

export async function loadCockpitDisplayLods({THREE,bindings,fetchBytes,signal,enabled=true,editing=false}={}){
 const geometries={};
 const check=()=>{if(signal?.aborted)throw signal.reason||new Error('Cockpit LOD cancelado');};
 const fetcher=fetchBytes||async function(url){const response=await fetch(url,{signal,credentials:'same-origin'});if(!response.ok)throw new Error('Cockpit LOD HTTP '+response.status);return new Uint8Array(await response.arrayBuffer());};
 try{
  // Source meshes are already resident for editing. Sequential geometry decoding bounds the additional peak.
  for(const name of COCKPIT_DISPLAY_ASSETS){if(!bindings?.[name])continue;check();const bytes=await fetcher(new URL(name+'-display.glb',BASE_URL),{signal});check();geometries[name]=decodeCockpitDisplayGeometry(THREE,bytes);}
  check();return createCockpitDisplayLodController({bindings,geometries,enabled,editing});
 }catch(error){for(const g of Object.values(geometries))g.dispose();throw error;}
}

/** Projected error estimate from sampled raw-space error, at an explicitly supplied screen projection. */
export function projectCockpitLodError({rawError,worldScale,distanceM,verticalFovDeg,heightPx}){
 if(![rawError,worldScale,distanceM,verticalFovDeg,heightPx].every(Number.isFinite)||distanceM<=0||verticalFovDeg<=0||verticalFovDeg>=180)return Infinity;
 return Math.abs(rawError*worldScale)*heightPx/(2*Math.tan(verticalFovDeg*Math.PI/360)*distanceM);
}
