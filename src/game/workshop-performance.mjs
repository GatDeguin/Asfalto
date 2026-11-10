const bounded=(value,min,max,fallback)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;

export function workshopPerformanceSetup({parts={},tuning={}}={}){
  return {
    intake:parts?.intake==='restomod', exhaust:parts?.exhaust==='restomod',
    cooling:parts?.cooling==='restomod', differential:parts?.differential==='restomod',
    lightweight:parts?.lightweight==='restomod', suspension:parts?.suspension==='restomod',
    longRangeTank:parts?.longRangeTank==='restomod',
    finalDrive:bounded(tuning?.finalDrive,3.08,4.11,3.55),
    frontDamping:bounded(tuning?.frontDamping,0,10,4),rearDamping:bounded(tuning?.rearDamping,0,10,4),
    rideHeight:bounded(tuning?.rideHeight,-20,15,0),
  };
}

export function applyWorkshopPerformance(spec, setup=workshopPerformanceSetup()){
  const {intake,exhaust,cooling,differential,lightweight,suspension,longRangeTank,finalDrive,frontDamping,rearDamping,rideHeight}=setup;
  if(!intake&&!exhaust&&!cooling&&!differential&&!lightweight&&!suspension&&!longRangeTank&&finalDrive===3.55&&frontDamping===4&&rearDamping===4&&rideHeight===0)return spec;
  const torqueCurveNm=intake||exhaust?spec.engine.torqueCurveNm.map(([rpm,torque])=>{
    const intakeGain=intake?(rpm>=2400?1.07:1.02):1;
    const exhaustGain=exhaust?(rpm<1800?.97:rpm>=3600?1.06:1.02):1;
    return [rpm,torque*intakeGain*exhaustGain];
  }):spec.engine.torqueCurveNm;
  return {
    ...spec,
    massKg:spec.massKg+(cooling?5:0)+(differential?4:0)+(longRangeTank?9:0)-(lightweight?42:0),
    fuelCapacityLiters:spec.fuelCapacityLiters+(longRangeTank?18:0),
    engine:{...spec.engine,torqueCurveNm,coolingMultiplier:cooling?1.34:1},
    gearbox:{...spec.gearbox,finalDrive:spec.gearbox.finalDrive+(finalDrive-3.55)},
    drivetrain:{...spec.drivetrain,differential:differential?'limited-slip':spec.drivetrain.differential},
    suspensionSetup:{
      frontDamping:1+(frontDamping-4)*(suspension?.065:.032),
      rearDamping:1+(rearDamping-4)*(suspension?.065:.032),
      antiRoll:suspension?1.16:1,
      heightM:rideHeight/1000,
    },
  };
}
