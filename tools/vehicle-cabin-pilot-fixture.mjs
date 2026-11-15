import {readFileSync} from 'node:fs';
import {THREE} from './cinematic-three.mjs?v=1538801f0545ceb6';
import {makeGlbAttribute} from '../src/runtime/glb-accessors.mjs';
import '../src/legacy/asfalto-v5-glb-runtime.js';

export function loadVehicleGeometry(vehicle, lod) {
  const file = `${vehicle}-lod${lod}.glb`;
  return loadVehicleGeometryAsset(new URL(`../assets/vehicles/${file}`, import.meta.url), file);
}

export function loadVehicleGeometryAsset(url, name = url.pathname.split('/').at(-1)) {
  const bytes = readFileSync(url);
  const jsonEnd = 20 + bytes.readUInt32LE(12);
  return globalThis.AsfaltoV5GlbCore.completeGlbToObject(THREE, bytes, name, {
    parseGlb: () => ({json:JSON.parse(bytes.toString('utf8', 20, jsonEnd)), bin:bytes.subarray(jsonEnd + 8)}),
    makeAttribute:makeGlbAttribute,
    textureFromInfo:() => null,
  });
}
