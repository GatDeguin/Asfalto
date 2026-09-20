import {routePreviewKey} from './menu-refinement-state.mjs?v=063b3cd332035f9f';
export function normalizeRouteMap(samples,{width=240,height=140,padding=14,maxPoints=360}={}){
 const points=samples.map(sample=>sample.position).filter(point=>Array.isArray(point)&&point.length>=3&&point.every(Number.isFinite));if(points.length<2)throw new Error('Route needs at least two valid world positions');
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const [x,,z]of points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
 const dx=maxX-minX,dz=maxZ-minZ,scale=Math.min((width-padding*2)/Math.max(dx,.001),(height-padding*2)/Math.max(dz,.001)),left=(width-dx*scale)/2,top=(height-dz*scale)/2;
 const stride=Math.max(1,Math.ceil((points.length-1)/(maxPoints-1))),selected=points.filter((_,index)=>index%stride===0||index===points.length-1),first=points[0],last=points.at(-1);
 return {mapPoints:selected.map(([x,,z])=>[Number((left+(x-minX)*scale).toFixed(2)),Number((height-top-(z-minZ)*scale).toFixed(2))]),sourceStart:[...first],sourceEnd:[...last],sourceSampleCount:points.length,sourceClosed:Math.hypot(first[0]-last[0],first[2]-last[2])<.1,projection:'local world X/Z, equal scale; not geographic coordinates'};
}
export function selectRoutePhoto(catalog,track,sky,weather){
 const key=routePreviewKey(track,sky,weather),record=catalog?.previews?.[key];
 return record?.file&&record.trackId===track&&record.skyId===sky&&record.weather===weather?{key,record,exact:true}:null;
}
