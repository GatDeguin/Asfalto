import {addRoadSigns,roadSignYaw} from './road-signs.mjs?v=6d823d9e48d15630';

// Each entry corresponds to the matching PROP_sign_NN pair in scene.glb.
// Hazard stations identify the measured bend, while place names are those of
// the fictional circuit. A straight approach to the finish needs no warning.
const placements = [
  {sM:30,name:'Cataratas del Iguazú'},
  {sM:1040,name:'Lomo Colorado'},
  // This verge drops almost 2 m. Keep the plate above the guardrail while
  // extending the post down to the measured soil.
  {sM:1670,turn:-1,hazardM:1824,bottomM:2.65},
  {sM:2690,name:'Arroyo Negro'},
  {sM:3435,name:'Caracol Basáltico'},
  {sM:4500,name:'Túnel Verde'},
  {sM:5830,turn:1,hazardM:6000},
  {sM:6120,name:'Puente del Vapor'},
  {sM:6960,name:'Eses del Guatambú'},
  {sM:8105,name:'Balcón del Salto'},
  {sM:8540,turn:-1,hazardM:8690},
  {sM:9280,name:'Garganta Roja'},
  {sM:10085,turn:-1,hazardM:10200},
  null,
];

function groundedRightShoulder(query,heightAt,{sM:station,bottomM=1.38}) {
  for (const change of [0,-12,12,-24,24,-36,36]) {
    const sM=station+change;
    if (sM<0) continue;
    const {position:road,frame,widthM}=query.sample(sM);
    // The delivered route stores the physical right vector in frame.left.
    for (const margin of [2.85,3.45,4.05]) {
      const offset=widthM*.5+margin;
      const x=road[0]+frame.left[0]*offset,z=road[2]+frame.left[2]*offset;
      const y=heightAt(x,z);
      const bottomAboveRoad=y+bottomM-road[1];
      if (!Number.isFinite(y)||bottomAboveRoad<.35||bottomAboveRoad>2.5) continue;
      const position=[x,y,z];
      const nearest=query.project?.(position);
      if (nearest&&(nearest.lateralM<nearest.widthM*.5+2.25||Math.abs(nearest.sM-sM)>14)) continue;
      return {sM,position,yaw:roadSignYaw(frame.tangent,-1)};
    }
  }
  return null;
}

export function addIguazuNativeRoadSigns(T,root,{query,heightAt}) {
  if (root.userData.asfaltoIguazuNativeSigns) return root.userData.asfaltoIguazuNativeSigns;
  const cues=[],replaced=[],obsolete=[];
  for (const [index,placement] of placements.entries()) {
    const suffix=String(index).padStart(2,'0');
    const plate=root.getObjectByName(`PROP_sign_${suffix}`),post=root.getObjectByName(`PROP_signpost_${suffix}`);
    if (!plate||!post) continue;
    if (!placement) {
      obsolete.push({plate,post});
      continue;
    }
    const anchored=groundedRightShoulder(query,heightAt,placement);
    if (!anchored) continue;
    const kind=placement.turn?'warning':'place';
    cues.push({...placement,...anchored,kind,source:plate.name,sourceStationM:plate.userData.station});
    replaced.push(plate,post);
  }
  if (!cues.length) return null;
  addRoadSigns(T,root,cues,{name:'ASFALTO_IGUAZU_AUTHORED_SIGNS',heightAt});
  // Retain ownership of the scene's shared GLB resources for normal teardown.
  // The source props are excluded from batching and all render passes.
  const originals=new T.Group();
  originals.name='ASFALTO_IGUAZU_SIGN_SOURCE_OWNER';
  originals.visible=false;
  root.add(originals);
  for (const node of replaced) originals.attach(node);
  for (const {plate,post} of obsolete) {
    originals.attach(plate);
    originals.attach(post);
  }
  const retired=obsolete.map(({plate})=>plate.name);
  return root.userData.asfaltoIguazuNativeSigns={cues,retired};
}
