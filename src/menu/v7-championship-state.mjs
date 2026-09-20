import {AWARDS,CATALOG_VERSION,CHAMPIONSHIPS,createSchedule} from './v7-championship-catalog.mjs?v=250778123f1c9e7f';
// No DOM, global profile, storage, timers or physics. A trusted host must build receipts.
const copy=value=>structuredClone(value);
const requireText=(value,name)=>{if(typeof value!=='string'||!value.trim())throw new TypeError('Missing '+name);};
const finite=(value,name)=>{if(!Number.isFinite(value)||value<0)throw new TypeError('Invalid '+name);};
export function createRun({id,championshipId,entrant,createdAt,completedChampionshipIds=[]}){
 requireText(id,'run id');requireText(entrant?.vehicleId,'vehicle');requireText(entrant?.class,'class');requireText(entrant?.configurationHash,'configuration');if(!Number.isFinite(Date.parse(createdAt)))throw new TypeError('Invalid date');
 const c=CHAMPIONSHIPS.find(x=>x.id===championshipId);if(!c)throw new RangeError('Unknown championship');if(c.requires&&!completedChampionshipIds.includes(c.requires))throw new Error('Championship locked');
 return{schema:'asfalto-championship-run/v1',id,catalogVersion:CATALOG_VERSION,championshipId,status:'ready',entrant:copy(entrant),schedule:createSchedule(championshipId),nextStageIndex:0,attempt:null,accepted:[],createdAt};
}
export function beginStage(run,attemptId){if(run.status!=='ready'||run.nextStageIndex>=run.schedule.length)throw new Error('Stage is not ready');requireText(attemptId,'attempt');return{...copy(run),status:'running',attempt:{id:attemptId,stageId:run.schedule[run.nextStageIndex].id}};}
export function cancelStage(run,attemptId){if(run.attempt?.id!==attemptId)return run;return{...copy(run),status:'ready',attempt:null};}
export function resumeRun(run){
 if(run.schema!=='asfalto-championship-run/v1'||run.catalogVersion!==CATALOG_VERSION)throw new TypeError('Unsupported run schema/catalog');
 if(!Array.isArray(run.accepted)||run.nextStageIndex!==run.accepted.length||JSON.stringify(run.schedule)!==JSON.stringify(createSchedule(run.championshipId)))throw new TypeError('Invalid persisted stage cursor/schedule');
 const c=CHAMPIONSHIPS.find(x=>x.id===run.championshipId);
 // Unlock authorization belongs to the profile adapter; replay validates this run only.
 let restored=createRun({id:run.id,championshipId:run.championshipId,entrant:run.entrant,createdAt:run.createdAt,completedChampionshipIds:c.requires?[c.requires]:[]});
 for(const result of run.accepted)restored=acceptStage(beginStage(restored,result.attemptId),result);
 if(!['ready','running','completed'].includes(run.status)||(run.status==='completed')!==(restored.status==='completed'))throw new TypeError('Invalid persisted phase');
 return restored;
}
function classification(value){
 if(!Array.isArray(value)||value.length!==2||new Set(value.map(x=>x.entrantId)).size!==2||!value.some(x=>x.entrantId==='player')||!value.some(x=>x.entrantId==='falcon'))throw new TypeError('Expected player and falcon classification');
 for(const row of value){
  if(!['finished','dnf','dq'].includes(row.status))throw new TypeError('Classification still pending');
  if(row.status==='finished'){if(row.checkpointsComplete!==true)throw new TypeError('Incomplete checkpoints');for(const key of ['activeSeconds','penaltySeconds','officialSeconds','finishTick'])finite(row[key],key);if(!Number.isInteger(row.finishTick))throw new TypeError('Invalid finish tick');if(Math.abs(row.officialSeconds-row.activeSeconds-row.penaltySeconds)>1e-6)throw new TypeError('Official time mismatch');}
  else requireText(row.reason,'terminal reason');
 }
 if(value.find(x=>x.entrantId==='player').status!=='finished')throw new Error('Player needs valid arrival');
 const p=value.find(x=>x.entrantId==='player'),f=value.find(x=>x.entrantId==='falcon');
 const tie=f.status==='finished'&&p.officialSeconds===f.officialSeconds;
 const winner=tie?null:f.status!=='finished'||p.officialSeconds<f.officialSeconds?'player':'falcon';
 return value.map(row=>({...copy(row),points:tie?2:row.entrantId===winner?3:row.status==='finished'?1:0,win:row.entrantId===winner}));
}
export function acceptStage(run,receipt){
 requireText(receipt?.resultId,'result');
 const duplicate=run.accepted.find(x=>x.resultId===receipt.resultId);if(duplicate){if(duplicate.runId!==receipt.runId||duplicate.stageId!==receipt.stageId||duplicate.attemptId!==receipt.attemptId)throw new Error('Result identity conflict');return run;}
 if(run.status!=='running'||!run.attempt||receipt.attemptId!==run.attempt.id)throw new Error('Stale attempt');
 const stage=run.schedule[run.nextStageIndex];
 if(receipt.runId!==run.id||receipt.stageId!==stage.id||receipt.configurationHash!==run.entrant.configurationHash)throw new Error('Session/configuration mismatch');
 for(const key of ['trackId','skyId','weather'])if(receipt[key]!==stage[key])throw new Error('Committed environment mismatch');
 if(receipt.valid!==true||receipt.qa!==false||receipt.source!=='authoritative-race')throw new Error('Invalid authoritative receipt');
 if(!Number.isFinite(Date.parse(receipt.finishedAt)))throw new TypeError('Invalid finish date');
 const scored=classification(receipt.classification),nextStageIndex=run.nextStageIndex+1;
 return{...copy(run),status:nextStageIndex===run.schedule.length?'completed':'ready',attempt:null,nextStageIndex,accepted:[...copy(run.accepted),{...copy(receipt),classification:scored}]};
}
const compare=(a,b)=>b.points-a.points||b.wins-a.wins||a.dnf-b.dnf||a.officialSeconds-b.officialSeconds;
export function standings(run){const rows=['player','falcon'].map(entrantId=>({entrantId,points:0,wins:0,dnf:0,officialSeconds:0}));for(const result of run.accepted)for(const c of result.classification){const row=rows.find(x=>x.entrantId===c.entrantId);row.points+=c.points;row.wins+=c.win?1:0;if(c.status==='finished')row.officialSeconds+=c.officialSeconds;else row.dnf++;}return rows.sort(compare);}
export function earnedAwards(run){
 const awards=[];for(const result of run.accepted){if(!result.classification.find(x=>x.entrantId==='player')?.win)continue;const award=AWARDS.find(x=>x.id==='route:'+result.trackId);if(award&&!awards.some(x=>x.id===award.id))awards.push({...award,receiptId:result.resultId,runId:run.id});}
 if(run.status==='completed'&&run.accepted.length===run.schedule.length){const table=standings(run),shared=compare(table[0],table[1])===0;if(table[0].entrantId==='player'||shared){const award=AWARDS.find(x=>x.id==='cup:'+run.championshipId);awards.push({...award,receiptIds:run.accepted.map(x=>x.resultId),runId:run.id,shared});}}
 return awards;
}
