// Authored expansion vehicles; visual and runtime evidence is recorded in the release report.
// Dimensions follow the authored meshes. Dynamics are gameplay estimates, not factory certification.
const shift=-.296283007;
function candidate({id,label,wheelbase,radius,height,frontTrack,rearTrack,frontWeight,cg,mass,length,width,eye,paint}){
 const front=-wheelbase/2,rear=wheelbase/2,y=radius*.4+shift;
 return {id,label,selectable:true,supportsPersistentCondition:true,artisticRecreation:true,preserveAuthoredMaterials:true,supportsDetailedEngine:false,supportsHood:true,cockpit:'authored-interior',sourceFrontAxis:'-X',sourceScale:.4,sourceShiftY:shift,defaultPaint:paint,
 centers:[[front*.4,y,-frontTrack*.2],[front*.4,y,frontTrack*.2],[rear*.4,y,-rearTrack*.2],[rear*.4,y,rearTrack*.2]],
 hoodHinge:id==='belair_1957'?[-.2504,.109316993,0]:[-.256,.183716993,0],
 lampAnchor:id==='belair_1957'?[-.902,.059716993,.2992]:[-.875,.073716993,.3084],
 steeringCenterSource:(id==='belair_1957'?[-.024,.965,.49]:[-.06,1.15,.47]).map((v,i)=>v*.4+(i===1?shift:0)),steeringAxis:id==='belair_1957'?[.933,-.36,0]:[1,0,0],cockpitLookDownDeg:6,
 windshield:id==='belair_1957'?{widthM:.6384,topWidthM:.6384,edgeNarrow:.06,curveExponent:6,curveYExponent:12,heightM:.1652,baseY:1.038*.4+shift,baseZ:-.57*.4,rakeRad:Math.atan(.28/.413),curveDepthM:.23*.4,curveBottomYM:.035*.4,curveTopYM:-.035*.4}:{widthM:.5872,topWidthM:.57252,curveExponent:3,curveYExponent:4,heightM:.17,baseY:1.286*.4+shift,baseZ:-.514*.4,rakeRad:Math.atan(.145/.425),curveDepthM:.095*.4,curveBottomYM:-.028*.4,curveTopYM:-.028*.4},
 cockpitEyeSource:eye.map((v,i)=>v*.4+(i===1?shift:0)),
 conditionSpace:id==='belair_1957'?{scale:[.875,1,.925],offset:[-.0889,.002283007,0]}:{scale:[.88,.77,.91],offset:[-.07,-.0681,0]},
 calibration:{wheelbaseM:wheelbase,cgHeightM:cg,radiusM:radius,tireWidthM:.205,heightM:height,frontWeight,frontTrackM:frontTrack,rearTrackM:rearTrack,sourceRoof:height*.4+shift,sourceFrontX:front*.4,sourceRearX:rear*.4,sourceWheelY:y,sourceHalfTrack:(frontTrack+rearTrack)*.1},
 physicsEstimate:{massKg:mass,dimensionsM:{length,width,height},wheelbaseM:wheelbase,frontTrackM:frontTrack,rearTrackM:rearTrack,frontWeightFraction:frontWeight,cgHeightM:cg,wheelRadiusM:radius},
 };
}
export const EXPANSION_VEHICLES={
 belair_1957:candidate({id:'belair_1957',label:'Chevrolet Bel Air 1957',wheelbase:2.921,radius:.356,height:1.514602,frontTrack:1.4732,rearTrack:1.49352,frontWeight:.53,cg:.58,mass:1640,length:5.14,width:1.90,eye:[.50,1.20,.45],paint:'#087782'}),
 pickup_3100:candidate({id:'pickup_3100',label:'Chevrolet 3100 Pickup',wheelbase:2.946,radius:.365,height:1.872,frontTrack:1.54,rearTrack:1.54,frontWeight:.55,cg:.66,mass:1480,length:5.06,width:2.0,eye:[.54,1.43,.43],paint:'#188fc5'}),
};
