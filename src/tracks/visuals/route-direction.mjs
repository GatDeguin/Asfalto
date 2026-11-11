import {directionSectors} from './route-direction-design.mjs?v=ab2c52ff0594d7f6';
import {addRoadSigns,roadSignYaw} from './road-signs.mjs?v=6d823d9e48d15630';

const stepM=16;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cueSeparationM={place:135,warning:70,chevron:36};

export function withoutNearbyGenericWarnings(markers,cues=[]){
  const authored=cues.filter(cue=>cue.kind==='warning');
  return authored.length?markers.filter(marker=>authored.every(cue=>Math.abs(cue.sM-marker.sM)>70)):markers;
}

function findBend(sector,sample){
  const {startM,endM,anchor}=sector,points=[];
  const focus=startM+(endM-startM)*anchor;
  for(let s=startM+34;s<endM-26;s+=stepM)points.push({s,t:sample(s).frame.tangent});
  let best=-1,score=0;
  // A single pass of station queries. Compare headings across 64 m, not the
  // raw instantaneous curvature of one noisy survey sample.
  for(let i=2;i<points.length-2;i++){
    const a=points[i-2].t,b=points[i+2].t;
    const angle=Math.atan2(a[0]*b[2]-a[2]*b[0],a[0]*b[0]+a[2]*b[2]);
    points[i].angle=angle;
    const strength=Math.abs(angle)*(1-.45*Math.abs(points[i].s-focus)/(endM-startM));
    if(strength>score){score=strength;best=i;}
  }
  if(best===-1||Math.abs(points[best].angle)<.32)return null;
  const peak=points[best],turn=Math.sign(peak.angle);
  let first=best,last=best;
  while(best-first<6&&points[first-1]?.angle*turn>Math.abs(peak.angle)*.32)first--;
  while(last-best<6&&points[last+1]?.angle*turn>Math.abs(peak.angle)*.32)last++;
  return {peakM:peak.s,startM:points[first].s,endM:points[last].s,angle:peak.angle,turn};
}

export function planRouteDirection({id,leg,query,heightAt,chapters=[],lengthM=Infinity,detailRange=null,existingCues=[]}){
  const sectors=directionSectors(id,leg,chapters,lengthM).filter(s=>!detailRange||s.endM>detailRange.startM&&s.startM<detailRange.endM);
  const cues=[],cache=new Map();
  const sample=s=>{if(!cache.has(s))cache.set(s,query.sample(s));return cache.get(s);};
  const available=s=>!detailRange||s>=detailRange.startM&&s<detailRange.endM;
  const nearExisting=(kind,sM)=>existingCues.some(c=>c.kind===kind&&Math.abs(c.sM-sM)<=cueSeparationM[kind]);
  function add(sector,sM,kind,phase,turn=0,preferred=1,outsideOnly=false){
    if(!available(sM)||nearExisting(kind,sM))return false;
    const q=sample(sM);
    // The route field's legacy left vector points to the driver's right.
    for(const side of outsideOnly?[preferred]:[preferred,-preferred]){
      for(const margin of [3.65,4.6,5.5]){
        const lateral=(q.widthM*.5+margin)*side;
        const p=q.position.map((v,i)=>v+q.frame.left[i]*lateral);
        const y=heightAt(p[0],p[2]);
        if(!Number.isFinite(y)||y-p[1]>1.5||p[1]-y>2.25)continue;
        const candidate=[p[0],y,p[2]],nearest=query.project?.(candidate);
        if(nearest&&(nearest.distanceXZ<nearest.widthM*.5+2.65||Number.isFinite(nearest.sM)&&Math.abs(nearest.sM-sM)>28))continue;
        if(cues.some(c=>Math.hypot(c.position[0]-p[0],c.position[2]-p[2])<10))continue;
        const yaw=roadSignYaw(q.frame.tangent,-side);
        const bottomM=kind==='warning'||kind==='place'?Math.max(1.3,1.38+q.position[1]-y):undefined;
        cues.push({sM,kind,phase,turn,side,yaw,position:candidate,sector:sector.id,name:sector.name,
          reason:sector.reason,...(bottomM===undefined?{}:{bottomM})});
        return true;
      }
    }
    return false;
  }
  for(const sector of sectors){
    if(sector.intent==='quiet')continue;
    const {startM,endM,anchor}=sector;
    if(endM-startM<120)continue;
    if(sector.intent==='place'){
      const station=startM+(endM-startM)*anchor;
      if(nearExisting('place',station))continue;
      for(const delta of [0,-24,24])if(add(sector,station+delta,'place','approach'))break;
      continue;
    }
    const bend=findBend(sector,sample);
    if(!bend)continue;
    const approach=clamp(bend.startM-65,startM+34,bend.peakM-36);
    // Classic source scenes already have their own warning signs; these get
    // the outside reference and release only, to avoid back-to-back boards.
    if(leg==='return'||id==='cataratas_iguazu'){
      for(const delta of [0,-12,12]){
        if(approach+delta<startM+26||approach+delta>bend.peakM-34)continue;
        if(add(sector,approach+delta,'warning','approach',bend.turn)){
          if(Math.abs(bend.angle)>=.72)cues.at(-1).symbol='sharp';
          break;
        }
      }
    }
    const severe=Math.abs(bend.angle)>=.72;
    const supports=severe?[bend.peakM-16,bend.peakM,bend.peakM+16]:[bend.peakM];
    for(const s of supports)if(s>=bend.startM-4&&s<=bend.endM+4)add(sector,s,'chevron','support',bend.turn,-bend.turn,true);
    const release=Math.max(bend.endM+28,bend.peakM+40);
    if(release<endM-24)add(sector,release,'delineator','exit',0,-bend.turn);
  }
  cues.sort((a,b)=>a.sM-b.sM);
  return {id,leg,sectors,cues};
}

export function addRouteDirection(T,root,options){
  const plan=planRouteDirection(options);
  const group=addRoadSigns(T,root,plan.cues,{name:'ASFALTO_ROUTE_DIRECTION_'+plan.leg,heightAt:options.heightAt});
  const diagnostics={...plan,drawCalls:group?.children.length??0};
  if(group)group.userData.asfaltoRouteDirection=diagnostics;
  return diagnostics;
}
