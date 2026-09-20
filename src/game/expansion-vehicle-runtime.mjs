const SS250_REVIEW_EYE=[.22,.235,.15865491525423722];
const ss250InteriorReviewEnabled=id=>id==='chevy_400_1957';
import {getVehicleDefinition} from '../render/vehicle-catalog.mjs?v=79da6f20496c6a50';
export function buildVehiclePhysicsSpec(base,id){
 const definition=getVehicleDefinition(id);if(!definition?.physicsEstimate)return base;
 return {...structuredClone(base),...structuredClone(definition.physicsEstimate),id:`${id}-${base.profile||'original'}`,label:definition.label,isCalibrationOnly:true};
}
export function authoredCockpitAnchors(id){
 const d=getVehicleDefinition(id);const review=ss250InteriorReviewEnabled(id);if(!d||(d.cockpit!=='authored-interior'&&!review))return null;
 const s=d.calibration,scaleX=s.wheelbaseM/(s.sourceRearX-s.sourceFrontX),scaleY=(s.heightM-s.radiusM)/(s.sourceRoof-s.sourceWheelY),scaleZ=(s.frontTrackM+s.rearTrackM)/4/s.sourceHalfTrack;
 const offsetX=s.wheelbaseM*(1-s.frontWeight)+s.sourceFrontX*scaleX,offsetY=s.radiusM-s.cgHeightM-s.sourceWheelY*scaleY;
 const transform=p=>[offsetX-p[0]*scaleX,offsetY+p[1]*scaleY,-p[2]*scaleZ];
 return {lookDownDeg:review?18:Math.max(10,d.cockpitLookDownDeg||0),cockpit:transform(review?SS250_REVIEW_EYE:d.cockpitEyeSource),hood:transform([-.34,.245,0])};
}

export function authoredWindshieldMount(T,presentation,id){
 const fit=id==='chevy_400_1957'?{widthM:.620,topWidthM:.560,heightM:.188,baseY:.129716993,baseZ:-.254339524,rakeRad:.632766248,curveDepthM:.008,curveTopYM:-.020,curveBottomYM:-.002,curveExponent:6,curveYExponent:4}:getVehicleDefinition(id)?.windshield;if(!fit)return null;const mount=new T.Group();mount.name='AuthoredWindshieldMount';mount.rotation.y=Math.PI/2;presentation.root.add(mount);return{cabinMount:mount,...fit,glassOffsetM:.001,bladeOffsetM:.0015,pivotBelowM:.008};
}
