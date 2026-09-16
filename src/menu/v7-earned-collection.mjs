import {getRoadTestDisplayItems} from './v7-roadtest-receipts.mjs?v=photo-r1-20260916';
import {AWARDS as AWARD_CATALOG} from './v7-championship-catalog.mjs';
import {resumeRun,earnedAwards} from './v7-championship-state.mjs';
export {AWARD_CATALOG};
/** Read-only reconstruction. Legacy counters, sheets, photos and unvalidated medal IDs are ignored. */
export function getEarnedDisplayItems(profile){
 const storedRuns=profile?.motorsportV7?.runs,runs=storedRuns&&typeof storedRuns==='object'&&!Array.isArray(storedRuns)?storedRuns:{};
 const found=new Map(getRoadTestDisplayItems(profile).map(item=>[item.id,item]));
 for(const candidate of Object.values(runs)){
  try{
   const run=resumeRun(candidate);
   for(const award of earnedAwards(run)){
    const ids=award.receiptIds||[award.receiptId],receipts=ids.map(id=>run.accepted.find(x=>x.resultId===id));
    if(receipts.some(x=>!x))continue;
    const earnedAt=receipts.at(-1).finishedAt;
    const item={...award,vehicleId:run.entrant.vehicleId,class:run.entrant.class,earnedAt,conditions:receipts.map(r=>({trackId:r.trackId,skyId:r.skyId,weather:r.weather})),source:'championship-receipt'};
    if(!found.has(item.id)||Date.parse(item.earnedAt)<Date.parse(found.get(item.id).earnedAt))found.set(item.id,item);
   }
  }catch{/* A corrupt or unsupported run never creates a display item. Other valid runs remain usable. */}
 }
 return AWARD_CATALOG.filter(a=>found.has(a.id)).map(a=>found.get(a.id));
}
