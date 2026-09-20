// Reproducible review stations use the delivered route; they do not steer, switch
// cameras, alter weather, or claim any geographic survey accuracy.
export function regionalReviewPlan({id,query,lengthM=query?.lengthM}={}){
 if(!query||!Number.isFinite(lengthM)||lengthM<=0)return null;
 const reveal=Math.min(lengthM-80,({dos_lagos:8320,aconcagua_horcones:7980,cuesta_lipan:5320,paso_garibaldi:11520,cataratas_iguazu:8600})[id]||lengthM*.6);
 const stations=[Math.min(20,lengthM*.01),lengthM*.2,lengthM*.43,reveal,lengthM*.82,Math.max(0,lengthM-120)];
 return{schema:'asfalto-regional-review/v7',id,geography:'adapted-scenic-route',status:'awaiting-driven-capture',
  conditions:{resolution:[1920,1080],cameraModes:['cockpit','chase'],lighting:['clear-neutral-noon','overcast','sunset','night'],quality:['balanced','high'],musicGain:0},
  views:stations.map((sM,i)=>{const q=query.sample(sM);const lateral=i===2?-12:i===4?12:0,eyeHeight=lateral?2.4:1.25,position=q.position.map((v,k)=>v+q.frame.left[k]*lateral+(k===1?eyeHeight:0)),target=q.position.map((v,k)=>v+q.frame.tangent[k]*(lateral?8:70)+(k===1?1.25:0));return{key:['start','structure','material','reveal','depth','return'][i],sM,cameraMode:lateral?'lateral-inspection':'driver-circulation',position,target,up:[0,1,0],driverEye:q.position.map((v,k)=>v+(k===1?1.25:0)),forward:q.frame.tangent,fov:48,referenceFrame:'authored route Y_UP metres; apply live visual-root parent transform if rebased',acceptance:'pose provided, not yet rendered or driven'};}),
  drive:{startM:Math.max(0,reveal-3200),endM:Math.min(lengthM,reveal+1000),targetDurationS:id==='dos_lagos'?[300,480]:[60,120],controls:'real throttle brake steer; no camera animation',acceptance:'record frame intervals, rival clearance, LOD and return to driving'},
  deferredOptional:id==='cataratas_iguazu'?{rainbow:'deferred until measured sun-observer-spray alignment and GPU margin',fauna:'deferred; no new fauna simulation'}:null};
}
