/**
 * Render gains for the six shipped, independently exposed HDR panoramas.
 * Measured solid-angle luminance is recorded in weather/lighting/hdri-radiance.json.
 * These gains are scene-relative, not photometric lux. Closed night deliberately
 * has no artificial global fill: local vehicle/authored lamps reveal the road.
 */
const zeroSupport=Object.freeze([0,0,0]);
const rows={
  clear:[1,.90,1,.95,'#fff0d2',[.707240,.484869,.514503],.850575],
  overcast:[.76,.72,1.25,.08,'#d8e2e8',[.805527,.568259,-.167951],.908901],
  'golden-hour':[.84,.66,1.10,.60,'#ffd19a',[.763861,.328210,.555694],.945739],
  sunset:[.60,.32,1.35,.18,'#ffad7a',[.803999,.107172,.584893],1.099745],
  moonrise:[.060,.014,1.35,.006,'#9db8dc',[.785021,.240003,.571087],1.007931],
  night:[.025,.00065,1.20,0,'#6f86ad',[0,1,0],.714385],
};
const policies=new Map(Object.entries(rows).map(([id,[backgroundIntensity,environmentIntensity,exposure,keyLightIntensity,keyLightColor,direction,hdriRadianceMean]])=>[id,Object.freeze({
  lightingPolicy:'hdri-scene-v1',skyId:id,backgroundIntensity,environmentIntensity,exposure,keyLightIntensity,keyLightColor,keyLightDirection:Object.freeze(direction),
  supportIntensities:zeroSupport,syntheticArtificialLight:false,hdriRadianceMean,
})]));
export function resolveRaceLighting(id){const value=policies.get(id==='golden'?'golden-hour':id);if(!value)throw new RangeError('Unknown HDRI lighting: '+id);return value;}
export function applyRaceLightingSupport(lights,preset){if(!preset.supportIntensities)return;lights.forEach((light,index)=>{if(light)light.intensity=preset.supportIntensities[index]??0;});}
/** AV3HDRI stores row zero at the zenith; Three equirectUv samples zenith at v=1.
 * Reverse rows once in decoded-cache construction, preserving every half-float bit.
 */
export function orientHdriRows(rgb,width,height){
  if(!(rgb instanceof Uint16Array)||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgb.length!==width*height*3)throw new TypeError('Invalid HDRI RGB rows');
  const result=new Uint16Array(rgb.length),row=width*3;
  for(let y=0;y<height;y++)result.set(rgb.subarray(y*row,(y+1)*row),(height-y-1)*row);
  return result;
}
