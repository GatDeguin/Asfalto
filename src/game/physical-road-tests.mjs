import { createFuelObserver } from './fuel-observer.mjs?v=c8691a04c5e062fe';
const IDS = Object.freeze(['vmax','accel100','accel160','m500','m1000','recovery','brake100','slalom','turn','wet','speedo','consumption']);
const DT = 1/120, dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const vec = v => Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
const freeze = value => {if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const wrapAngle = x => Math.atan2(Math.sin(x),Math.cos(x));
const yaw = q => Math.atan2(2*(q[0]*q[2]-q[3]*q[1]),1-2*(q[1]**2+q[2]**2));

export function fitObservedCircle(points) {
  if(points.length<8)return null;
  const origin=points[0],m=Array.from({length:3},()=>[0,0,0,0]);
  for(const p of points){const x=p[0]-origin[0],z=p[2]-origin[2],v=[x,z,1],r=x*x+z*z;for(let i=0;i<3;i++){for(let j=0;j<3;j++)m[i][j]+=v[i]*v[j];m[i][3]+=v[i]*r;}}
  for(let i=0;i<3;i++){let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;if(Math.abs(m[pivot][i])<1e-10)return null;[m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];for(let k=i;k<4;k++)m[i][k]/=d;for(let j=0;j<3;j++)if(j!==i){const f=m[j][i];for(let k=i;k<4;k++)m[j][k]-=f*m[i][k];}}
  const cx=m[0][3]/2,cz=m[1][3]/2,r2=m[2][3]+cx*cx+cz*cz;if(!(r2>0))return null;const radiusM=Math.sqrt(r2),center=[origin[0]+cx,origin[1],origin[2]+cz];const rmsResidualM=Math.sqrt(points.reduce((sum,p)=>sum+(Math.hypot(p[0]-center[0],p[2]-center[2])-radiusM)**2,0)/points.length);
  return {center,radiusM,diameterM:2*radiusM,rmsResidualM};
}

export function createSlalomCourse({routeQuery,startProgressM,gateSpacingM=16}) {
  if(!routeQuery?.sample||!Number.isFinite(startProgressM)||gateSpacingM<12)throw new TypeError('Invalid slalom course');
  return freeze(Array.from({length:8},(_,i)=>{const q=routeQuery.sample(startProgressM+20+i*gateSpacingM),offset=i%2?.9:-.9;return{id:'slalom-'+(i+1),center:q.position.map((v,j)=>v+q.frame.left[j]*offset),forward:[...q.frame.tangent],left:[...q.frame.left],halfWidthM:1.5};}));
}

export function createPhysicalRoadTestValidator(options) {
  const {testId,sessionId,configurationHash,trackId,vehicleId,definition={}}=options;
  if(!IDS.includes(testId)||![sessionId,configurationHash,trackId,vehicleId,options.class].every(v=>typeof v==='string'&&v))throw new TypeError('Road-test identity required');
  const maxActiveSeconds=definition.maxActiveSeconds??600,halfWidthM=definition.vehicleHalfWidthM??.93;
  if(!(maxActiveSeconds>0)||!Number.isFinite(maxActiveSeconds))throw new TypeError('Invalid duration limit');
  const gates=testId==='slalom'?structuredClone(definition.gates):[];
  if(testId==='slalom'&&(!Array.isArray(gates)||gates.length!==8||gates.some(g=>!vec(g.center)||!vec(g.forward)||!vec(g.left)||!(g.halfWidthM>halfWidthM))))throw new TypeError('Eight committed physical slalom gates required');
  const fuel=testId==='consumption'?createFuelObserver({displacementLiters:definition.displacementLiters,fuelMultiplier:definition.fuelMultiplier??1}):null;
  const standing=['accel100','accel160','m500','m1000'].includes(testId);
  let phase=standing?'arming':'running',last=null,lastTick=null,samples=0,startTick=null,endTick=null,measurement=null;
  let distanceM=0,originProgress=null,restTicks=0,stableTicks=0,unsupportedTicks=0,gateIndex=0,measureStart=null,brakeStartDistance=0;
  let fuelWindowStart=null;
  let errorSum=0,errorSquares=0,speedSum=0,speedSquares=0,windowCount=0,turnSweep=0,turnLastYaw=null,turnPoints=[],turnDistance=0;
  let wetBrakeInitial=null,wetBrakeDrop=0,peakLateralAcceleration=0,referenceChart=null,stoppedTicks=0,receipt=null;
  const invalidReasons=[],gateEvidence=[];
  function invalidate(reason){if(phase==='completed'||phase==='invalid')return;invalidReasons.push(reason);phase='invalid';}
  function complete(metric,value,unit,method,extra={}){if(!Number.isFinite(value)){invalidate('nonfinite-measurement');return;}phase='completed';endTick=lastTick;measurement={metric,value,unit,method,...extra};}
  function state(){return freeze({testId,phase,valid:phase==='completed'&&!invalidReasons.length,objectiveComplete:phase==='completed',invalidReasons:[...invalidReasons],activeSeconds:samples*DT,sampleCount:samples,startTick,endTick,distanceM,gateIndex,gateCount:gates.length,measurement:measurement?{...measurement}:null});}
  function sample(frame){
    if(phase==='completed'||phase==='invalid')return;
    if(frame.sessionId!==sessionId||frame.configurationHash!==configurationHash){invalidate('session-or-configuration-changed');return;}
    if(frame.qa){invalidate('qa-session');return;}
    if(frame.teleports>0||frame.recoveries>0){invalidate('teleport-or-recovery');return;}
    if(!Number.isSafeInteger(frame.tick)||frame.tick<0){invalidate('invalid-tick');return;}
    if(frame.tick===lastTick)return;
    if(lastTick!==null&&frame.tick!==lastTick+1){invalidate('sample-gap');return;}
    lastTick=frame.tick;
    if(!frame.running){last=null;return;}
    const s=frame.snapshot,p=frame.projection||{},position=s?.chassis?.position,velocity=s?.chassis?.linearVelocity;
    if(s?.fixedHz!==120||!vec(position)||!vec(velocity)||!Number.isFinite(p.raceProgress)||p.valid===false||p.continuous===false||p.jumpRejected){invalidate('invalid-physical-sample');return;}
    if(referenceChart!==null&&frame.referenceChart!==referenceChart){invalidate('reference-rebase-required');return;}referenceChart=frame.referenceChart;
    const speed=Math.hypot(...velocity),contacts=(s.wheels||[]).filter(w=>w.contact).length,stepDistance=last?distance(position,last.position):0;
    if(last&&stepDistance>Math.max(speed,last.speed)*DT+.05){invalidate('physical-discontinuity');return;}
    if(last&&Math.abs(p.raceProgress-last.progress)>stepDistance*1.5+.05){invalidate('projection-discontinuity');return;}
    if(testId!=='turn'&&p.speedAlongRouteMps<-.25){invalidate('reverse-during-measurement');return;}
    if(s.impact||(s.impacts||[]).length){invalidate('physical-impact');return;}
    if(contacts<3)unsupportedTicks++;else unsupportedTicks=0;
    if(unsupportedTicks>12){invalidate('unsupported-vehicle');return;}
    if(!['turn','slalom'].includes(testId)&&Number.isFinite(p.routeHalfWidthM)&&Math.abs(p.lateral)+halfWidthM>p.routeHalfWidthM+.9){invalidate('outside-measurement-zone');return;}
    samples++;startTick??=frame.tick;distanceM+=stepDistance;
    if(samples*DT>maxActiveSeconds){invalidate('time-limit-objective-incomplete');return;}
    if(fuel)fuel.sample({tick:samples,running:true,snapshot:s});
    const controls=s.controls||{},gear=s.gearbox?.gear,clutch=s.clutch?.engagement,brakeTorque=(s.brakes?.wheelBrakeTorquesNm||[]).reduce((a,b)=>a+Math.abs(b),0);
    const activeBrake=controls.brake>.05&&brakeTorque>1;
    if(standing){
      if(phase==='arming'){restTicks=speed<.5&&contacts===4?restTicks+1:0;if(restTicks>=60){phase='armed';originProgress=p.raceProgress;} }
      else if(phase==='armed'&&speed>.5){phase='measuring';measureStart=frame.tick-1;}
      if(phase==='measuring'){
        if(p.speedAlongRouteMps<-.25){invalidate('reverse-during-measurement');return;}
        if(testId.startsWith('accel')){const target=testId==='accel100'?100:160;if(speed*3.6>=target)complete('elapsedSeconds',(frame.tick-measureStart)*DT,'s','physical-speed-crossing',{targetKph:target});}
        else{const target=testId==='m500'?500:1000;if(p.raceProgress-originProgress>=target)complete('elapsedSeconds',(frame.tick-measureStart)*DT,'s','physical-route-distance-gate',{targetMeters:target,measuredProgressM:p.raceProgress-originProgress});}
      }
    }else switch(testId){
      case 'vmax':{
        const stable=last&&speed*3.6>=175&&Math.abs(speed-last.speed)/DT<.08&&controls.throttle>=.8&&contacts===4;
        stableTicks=stable?stableTicks+1:0;if(stableTicks>=360)complete('maximumStableSpeedKph',speed*3.6,'km/h','physical-stable-speed-window',{stableSeconds:3});break;
      }
      case 'recovery':{
        if(phase==='running'&&last&&last.speed<80/3.6&&speed>=80/3.6&&gear===4&&clutch>=.95){phase='measuring';measureStart=frame.tick;}
        if(phase==='measuring'){if(gear!==4||clutch<.95){invalidate('recovery-gear-or-clutch');return;}if(speed>=120/3.6)complete('elapsedSeconds',(frame.tick-measureStart)*DT,'s','physical-fourth-gear-speed-crossings');}break;
      }
      case 'brake100':{
        if(phase==='running'&&last&&last.speed<100/3.6&&speed>=100/3.6)phase='ready-to-brake';
        if(phase==='ready-to-brake'&&activeBrake&&speed>=100/3.6-.8){phase='measuring';measureStart=frame.tick;brakeStartDistance=distanceM;}
        if(phase==='measuring'){stoppedTicks=speed<.1&&contacts===4&&activeBrake?stoppedTicks+1:0;if(stoppedTicks>=30)complete('brakingDistanceM',distanceM-brakeStartDistance,'m','physical-brake-torque-to-supported-stop',{elapsedSeconds:(frame.tick-measureStart)*DT});}break;
      }
      case 'slalom':{
        const g=gates[gateIndex];if(last&&g){const before=dot(last.position.map((v,i)=>v-g.center[i]),g.forward),after=dot(position.map((v,i)=>v-g.center[i]),g.forward);if(before<0&&after>=0){const f=-before/(after-before),hit=last.position.map((v,i)=>v+(position[i]-v)*f),offset=Math.abs(dot(hit.map((v,i)=>v-g.center[i]),g.left));if(offset+halfWidthM>g.halfWidthM||contacts<3){invalidate('slalom-gate-missed');return;}gateEvidence.push({id:g.id,tick:frame.tick,position:hit});gateIndex++;if(gateIndex===8)complete('physicalGates',8,'puertas','ordered-physical-gate-crossings');}}break;
      }
      case 'turn':{
        if(speed>.5&&speed<5&&contacts===4&&Math.abs(controls.steer)>.3){const heading=yaw(s.chassis.rotation);if(turnLastYaw!==null)turnSweep+=wrapAngle(heading-turnLastYaw);turnLastYaw=heading;turnDistance+=stepDistance;if(!turnPoints.length||samples%12===0){if(turnPoints.length>=1200){invalidate('circle-sample-budget');return;}turnPoints.push([...position]);}
          if(Math.abs(turnSweep)>=2*Math.PI-.08&&turnPoints.length>=32){const circle=fitObservedCircle(turnPoints);if(circle&&circle.radiusM>=2&&circle.radiusM<=30&&circle.rmsResidualM<=Math.max(.1,circle.radiusM*.08)&&distance(position,turnPoints[0])<=Math.max(1,circle.radiusM*.2)&&turnDistance>=Math.PI*2*circle.radiusM*.85)complete('turningDiameterM',circle.diameterM,'m','observed-circle-fit',{radiusM:circle.radiusM,rmsResidualM:circle.rmsResidualM,sweepRad:turnSweep});}
        }else if(turnPoints.length){turnPoints=[];turnSweep=0;turnLastYaw=null;turnDistance=0;}break;
      }
      case 'wet':{
        if(!(frame.environment?.wetness>=.5&&frame.environment?.gripMultiplier<.99)){invalidate('surface-not-physically-wet');return;}
        if(activeBrake){wetBrakeInitial??=speed;wetBrakeDrop=Math.max(wetBrakeDrop,wetBrakeInitial-speed);}else wetBrakeInitial=null;
        const acceleration=s.chassis.acceleration||[0,0,0],heading=yaw(s.chassis.rotation);peakLateralAcceleration=Math.max(peakLateralAcceleration,Math.abs(-Math.sin(heading)*acceleration[0]+Math.cos(heading)*acceleration[2]));
        if(distanceM>=1800&&wetBrakeDrop>=10/3.6&&peakLateralAcceleration>=.5)complete('wetDistanceM',distanceM,'m','physical-wet-support-and-braking',{brakeSpeedDropMps:wetBrakeDrop,peakLateralAccelerationMps2:peakLateralAcceleration});break;
      }
      case 'speedo':{
        const instrument=frame.instrument,eligible=Math.abs(speed*3.6-100)<=2&&contacts===4&&Number.isFinite(instrument?.indicatedKph)&&Number.isSafeInteger(instrument.sampleTick)&&instrument.sampleTick<=frame.tick&&frame.tick-instrument.sampleTick<=12;
        if(!eligible){stableTicks=0;errorSum=0;errorSquares=0;break;}const error=instrument.indicatedKph-speed*3.6;stableTicks++;errorSum+=error;errorSquares+=error*error;
        if(stableTicks>=600)complete('speedometerRmsErrorKph',Math.sqrt(errorSquares/stableTicks),'km/h RMS','actual-display-versus-physical-velocity',{signedBiasKph:errorSum/stableTicks,stableSeconds:5});break;
      }
      case 'consumption':{
        const target=60,eligible=Math.abs(speed*3.6-target)<=5&&contacts===4;
        if(eligible){fuelWindowStart??={distanceM,liters:fuel.getState().fuelUsedLiters,clamped:fuel.getState().referenceClampedSamples,tick:frame.tick};stableTicks++;speedSum+=speed*3.6;speedSquares+=(speed*3.6)**2;windowCount++;}else{stableTicks=0;speedSum=0;speedSquares=0;windowCount=0;fuelWindowStart=null;}
        const windowDistanceM=fuelWindowStart?distanceM-fuelWindowStart.distanceM:0;
        if(windowDistanceM>=2400&&stableTicks>=14400){const f=fuel.getState(),windowLiters=f.fuelUsedLiters-fuelWindowStart.liters,sd=Math.sqrt(Math.max(0,speedSquares/windowCount-(speedSum/windowCount)**2));if(sd<=2&&f.referenceClampedSamples===fuelWindowStart.clamped)complete('modeledLitersPer100Km',windowLiters/windowDistanceM*100000,'L/100 km estimados por modelo','integrated-reference-fuel-model',{modelId:f.modelId,modeled:true,speedStdDevKph:sd,fuelUsedLiters:windowLiters,windowDistanceM,windowStartTick:fuelWindowStart.tick});}break;
      }
    }
    last={position:[...position],speed,progress:p.raceProgress};
  }
  return Object.freeze({sample,getState:state,invalidate,
    rebase({matrix,referenceChart:chart}){if(!Array.isArray(matrix)||matrix.length!==16||!matrix.every(Number.isFinite))throw new TypeError('Rigid rebase matrix required');const axes=[matrix.slice(0,3),matrix.slice(4,7),matrix.slice(8,11)],det=axes[0][0]*(axes[1][1]*axes[2][2]-axes[1][2]*axes[2][1])-axes[1][0]*(axes[0][1]*axes[2][2]-axes[0][2]*axes[2][1])+axes[2][0]*(axes[0][1]*axes[1][2]-axes[0][2]*axes[1][1]);if(axes.some((a,i)=>axes.some((b,j)=>Math.abs(dot(a,b)-(i===j?1:0))>1e-6))||Math.abs(det-1)>1e-6||[3,7,11].some(i=>Math.abs(matrix[i])>1e-6)||Math.abs(matrix[15]-1)>1e-6)throw new TypeError('Rigid rebase matrix required');const transform=(p,direction=false)=>[0,1,2].map(i=>matrix[i]*p[0]+matrix[4+i]*p[1]+matrix[8+i]*p[2]+(direction?0:matrix[12+i]));if(last)last.position=transform(last.position);turnPoints=turnPoints.map(p=>transform(p));turnLastYaw=null;for(const g of gates){g.center=transform(g.center);g.forward=transform(g.forward,true);g.left=transform(g.left,true);}referenceChart=chart;},
    getReceipt({resultId,finishedAt}){if(receipt)return receipt;if(phase!=='completed')return null;if(typeof resultId!=='string'||!resultId||!Number.isFinite(Date.parse(finishedAt)))throw new TypeError('Receipt identity/date required');receipt=freeze({schema:'asfalto-road-test-receipt/v1',source:'authoritative-road-test',qa:false,valid:true,objectiveComplete:true,sessionId,resultId,testId,configurationHash,trackId,vehicleId,class:options.class,finishedAt,measurement:{...measurement},evidence:{startTick,endTick,sampleCount:samples,fixedHz:120,distanceM,gates:gateEvidence.map(g=>({...g})),fuel:fuel?.getState()||null},invalidReasons:[]});return receipt;},
  });
}
