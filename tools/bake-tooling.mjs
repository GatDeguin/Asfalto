import {BAKE_SCHEMA,indexSpatial,packSpatial} from '../src/tracks/visuals/bake-binary-codec.mjs?v=9a206fac5b81dd7a';
import {unpackArray} from './bake-legacy-v2.mjs?v=dd28b9e47b59d0a9';
const TYPES={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array};
export function prepareBinaryPayload(payload,{legacy=false}={}){
 return {...payload,schema:BAKE_SCHEMA,entries:payload.entries.map(([key,value])=>{
  if(key.startsWith('curvature:'))return[key,{...value,values:legacy?unpackArray(value.values):new Float32Array(value.values)}];
  if(key.startsWith('spatial:'))return[key,legacy?indexSpatial(unpackArray(value.spatial)):packSpatial(value)];
  if(key.startsWith('refine:')){const geometry=structuredClone(value.geometry);for(const a of [...Object.values(geometry.data.attributes),...(geometry.data.index?[geometry.data.index]:[])])a.array=legacy?unpackArray(a.array):new TYPES[a.type](a.array);return[key,{...value,geometry}];}
  return[key,value];
 })};
}
