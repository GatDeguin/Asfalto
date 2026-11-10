import {readFileSync} from 'node:fs';

export const CIRCUIT_IDS=['dos_lagos','aconcagua_horcones','cuesta_lipan','paso_garibaldi','cataratas_iguazu'];
export function readCircuitSource(id){
  const raw=JSON.parse(readFileSync(new URL('../../tracks/'+id.replaceAll('_','-')+'/route.json',import.meta.url),'utf8'));
  if(id==='cuesta_lipan'){
    const yUp=([x,y,z])=>[x,z,-y];
    return {...raw,samples:raw.samples.map(s=>({...s,position:yUp(s.position),tangent:yUp(s.tangent),left:yUp(s.left),normal:yUp(s.normal),bank:s.bankRad||0}))};
  }
  if(id!=='dos_lagos')return raw;
  const sectors=raw.sectors.map(s=>({id:s.id.toLowerCase(),name:s.name,startM:s.km_start*1000,endM:s.km_end*1000}));
  const samples=raw.samples.map(s=>{
    const unit=p=>p.map(v=>v/Math.hypot(...p));
    const tangent=unit(s.tangent);
    const rawLeft=unit(s.left),dot=rawLeft.reduce((n,v,i)=>n+v*tangent[i],0);
    const left=unit(rawLeft.map((v,i)=>v-dot*tangent[i]));
    const normal=[left[1]*tangent[2]-left[2]*tangent[1],left[2]*tangent[0]-left[0]*tangent[2],left[0]*tangent[1]-left[1]*tangent[0]];
    return {sM:s.s,position:s.position,tangent,left,normal,widthM:s.width,sectorId:s.sectorId.toLowerCase(),bank:s.bankRad,
      curvaturePerM:s.curvature,surfaceId:'asphalt',targetSpeedKmh:s.targetSpeedKph};
  });
  const checkpoints=sectors.map((s,index)=>({index,sM:s.endM,halfWidthM:samples[Math.round(s.endM/5)].widthM/2}));
  return {schema:'asfalto-route/v1',id,coordinateSystem:'Y_UP_METERS',format:'point_to_point',sampleStepM:5,lengthM:raw.routeLengthM,samples,sectors,checkpoints,respawns:[{sM:0,lateralM:0}]};
}
