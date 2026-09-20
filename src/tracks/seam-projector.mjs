const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const distance2=(a,b)=>a.reduce((sum,v,i)=>sum+(v-b[i])**2,0);
/** A canonical spatial index is shared by current/previous/next reference charts. */
export function createSeamProjector(seam,source,{cellSizeM=128,neighbourWindowM=800,maxJumpM=150}={}){
 if(!seam?.sampleContinuous||!source?.samples?.length)throw new TypeError('Seam and source route are required');
 const L=seam.lengthM,stationSet=new Set(source.samples.map(s=>s.sM));for(let s=0;s<seam.prefixM;s+=1)stationSet.add(s);stationSet.add(seam.prefixM);
 const samples=[...stationSet].sort((a,b)=>a-b).map(s=>seam.sampleLocal(s)),segments=[],grid=new Map();let minimumX=Infinity,maximumX=-Infinity,minimumZ=Infinity,maximumZ=-Infinity;
 for(let i=0;i<samples.length-1;i++){
  const a=samples[i],b=samples[i+1],segment={a,b,index:i};segments.push(segment);
  const minX=Math.floor(Math.min(a.position[0],b.position[0])/cellSizeM),maxX=Math.floor(Math.max(a.position[0],b.position[0])/cellSizeM),minZ=Math.floor(Math.min(a.position[2],b.position[2])/cellSizeM),maxZ=Math.floor(Math.max(a.position[2],b.position[2])/cellSizeM);
  minimumX=Math.min(minimumX,minX);maximumX=Math.max(maximumX,maxX);minimumZ=Math.min(minimumZ,minZ);maximumZ=Math.max(maximumZ,maxZ);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=x+':'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}
 }
 function nearest(position,fromM,toM){
  const considered=new Set();let best=null;
  function consider(i){if(considered.has(i))return;considered.add(i);const {a,b}=segments[i];if(b.sM<fromM||a.sM>toM)return;
   const delta=sub(b.position,a.position),denom=dot(delta,delta),offset=sub(position,a.position),u=Math.max(0,Math.min(1,denom?dot(delta,offset)/denom:0));
   const sM=a.sM+(b.sM-a.sM)*u;if(sM<fromM||sM>toM)return;const point=a.position.map((v,k)=>v+delta[k]*u),d2=distance2(point,position);
   if(!best||d2<best.d2)best={sM,point,d2,segmentIndex:i};
  }
  const px=Math.floor(position[0]/cellSizeM),pz=Math.floor(position[2]/cellSizeM),cx=Math.max(minimumX,Math.min(maximumX,px)),cz=Math.max(minimumZ,Math.min(maximumZ,pz));
  const radiusMax=Math.max(cx-minimumX,maximumX-cx,cz-minimumZ,maximumZ-cz);
  for(let r=0;r<=radiusMax;r++){
   for(let x=Math.max(minimumX,cx-r);x<=Math.min(maximumX,cx+r);x++)for(let z=Math.max(minimumZ,cz-r);z<=Math.min(maximumZ,cz+r);z++){
    if(r&&x!==cx-r&&x!==cx+r&&z!==cz-r&&z!==cz+r)continue;for(const i of grid.get(x+':'+z)||[])consider(i);
   }
   // Lower bound to the edge of the visited square; vertical distance can only increase it.
   const lower=Math.min(position[0]-(cx-r)*cellSizeM,(cx+r+1)*cellSizeM-position[0],position[2]-(cz-r)*cellSizeM,(cz+r+1)*cellSizeM-position[2]);
   if(best&&lower>0&&lower*lower>best.d2)break;
  }
  if(best){
   // The authored cross-section is curved between sample chords. Refine station
   // against its forward plane so lateral/height offsets do not shift odometry.
   let station=best.sM;
   const residual=s=>{const q=seam.sampleLocal(s);return dot(sub(position,q.position),q.tangent);};
   for(let iteration=0;iteration<5;iteration++){
    const a=Math.max(fromM,station-.01),b=Math.min(toM,station+.01);if(b-a<1e-8)break;
    const value=residual(station),derivative=(residual(b)-residual(a))/(b-a);if(Math.abs(derivative)<.2)break;
    const change=Math.max(-2,Math.min(2,value/derivative));station=Math.max(fromM,Math.min(toM,station-change));if(Math.abs(change)<1e-8)break;
   }
   const point=seam.sampleLocal(station).position;best={...best,sM:station,point,d2:distance2(point,position)};
  }
  return best;
 }
 let queries=0;
 function project(position,{referenceChart=0,previous=null,allowRelocalize=false}={}){
  if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))throw new TypeError('Projection position must be finite');
  if(!Number.isSafeInteger(referenceChart))throw new TypeError('referenceChart must be an integer');
  const prior=Number.isFinite(previous?.raceProgressM)?previous.raceProgressM:Number.isFinite(previous?.raceProgress)?previous.raceProgress:null,baseLap=prior===null?referenceChart:Math.floor(prior/L),localPrior=prior===null?null:prior-baseLap*L;
  const charts=[{lap:baseLap,fromM:0,toM:L}];
  if(localPrior===null||localPrior<neighbourWindowM)charts.push({lap:baseLap-1,fromM:L-neighbourWindowM,toM:L});
  if(localPrior===null||localPrior>L-neighbourWindowM)charts.push({lap:baseLap+1,fromM:0,toM:neighbourWindowM});
  let best=null;
  for(const chart of charts){
   const local=seam.chartTransform(referenceChart-chart.lap).point(position);
   // A neighbour window is relevant only near its own seam endpoint, never across distant source scenery.
   if(chart.lap!==baseLap){const end=seam.sampleLocal(chart.lap<baseLap?L:0);if(distance2(local,end.position)>(neighbourWindowM+300)**2)continue;}
   const candidate=nearest(local,chart.fromM,chart.toM);if(!candidate)continue;candidate.raceProgressM=chart.lap*L+candidate.sM;
   const tie=best&&Math.abs(candidate.d2-best.d2)<1e-8;
   if(!best||candidate.d2<best.d2-1e-8||(tie&&Math.abs(candidate.raceProgressM-(prior??referenceChart*L))<Math.abs(best.raceProgressM-(prior??referenceChart*L))))best=candidate;
  }
  if(!best)throw new Error('Seam projection found no source segment');queries++;
  const jumpRejected=prior!==null&&!allowRelocalize&&Math.abs(best.raceProgressM-prior)>maxJumpM,progress=jumpRejected?prior:best.raceProgressM,sample=seam.sampleContinuous(progress,referenceChart),offset=sub(position,sample.position),lateralM=dot(offset,sample.left),frame={tangent:sample.tangent,left:sample.left,normal:sample.normal};
  return Object.freeze({s:sample.sM,sM:sample.sM,sourceSM:sample.sM,routeDistanceM:sample.sM,raceProgress:progress,raceProgressM:progress,lap:sample.lap,chart:sample.lap,referenceChart,position:sample.position,point:sample.position,frame,lateral:lateralM,lateralM,distanceM:Math.sqrt(best.d2),signedSeparationM:dot(offset,sample.normal),headingRad:Math.atan2(sample.tangent[2],sample.tangent[0]),widthM:sample.widthM,surfaceId:sample.surfaceId,sectorId:sample.sectorId,segmentIndex:best.segmentIndex,jumpRejected,continuous:!jumpRejected,rawCandidateProgressM:best.raceProgressM});
 }
 return Object.freeze({lengthM:L,project,sample:(progress,referenceChart=0)=>seam.sampleContinuous(progress,referenceChart),diagnostics:()=>({queries,canonicalSegments:segments.length,gridCells:grid.size,neighbourWindowM,maxJumpM})});
}
