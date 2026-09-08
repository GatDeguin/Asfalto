// Fit authored visual geometry to the existing chassis without modifying its physics.
const IDS=['frontLeft','frontRight','rearLeft','rearRight'];
export const VEHICLE_VISUAL_CALIBRATION=Object.freeze({
 chevy:Object.freeze({wheelbaseM:2.819,cgHeightM:.56,radiusM:.315,tireWidthM:.185,heightM:1.398,frontWeight:.54,frontTrackM:1.48,rearTrackM:1.47,sourceRoof:.294483747,sourceFrontX:-.623,sourceRearX:.49715,sourceWheelY:-.156625,sourceHalfTrack:.3172}),
 falcon:Object.freeze({wheelbaseM:2.79,cgHeightM:.57,radiusM:.32,tireWidthM:.185,heightM:1.42,frontWeight:.53,frontTrackM:1.47,rearTrackM:1.46,sourceRoof:.299941339,sourceFrontX:-.63848,sourceRearX:.50985,sourceWheelY:-.16532,sourceHalfTrack:.3065}),
});
export function createVehiclePhysicalCalibration(T,{vehicle,root,modelRoot,tiers,spec=VEHICLE_VISUAL_CALIBRATION[vehicle]}){
 const sx=spec.wheelbaseM/(spec.sourceRearX-spec.sourceFrontX),sy=(spec.heightM-spec.radiusM)/(spec.sourceRoof-spec.sourceWheelY),sz=(spec.frontTrackM+spec.rearTrackM)/4/spec.sourceHalfTrack;
 const offset=new T.Vector3(spec.wheelbaseM*(1-spec.frontWeight)+spec.sourceFrontX*sx,spec.radiusM-spec.cgHeightM-spec.sourceWheelY*sy,0),sourceYaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI),bodyFit=new T.Matrix4().compose(offset,sourceYaw,new T.Vector3(sx,sy,sz));
 const wheelShapes=new Map(),v=new T.Vector3();
 for(const tier of tiers)for(const id of IDS){const pivot=tier.wheels[id];pivot.updateWorldMatrix(true,true);const inverse=pivot.matrixWorld.clone().invert(),box=new T.Box3(),tireBox=new T.Box3();
  pivot.traverse(o=>{if(!o.isMesh||/TireLetter/.test(o.material?.name))return;const a=o.geometry.attributes.position,indices=o.geometry.index?.array,matrix=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld);for(const i of new Set(indices||Array.from({length:a.count},(_,j)=>j))){v.fromBufferAttribute(a,i).applyMatrix4(matrix);box.expandByPoint(v);if(/Rubber/.test(o.material?.name))tireBox.expandByPoint(v);}});
  const center=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),size=box.isEmpty()?new T.Vector3(.28,.28,.07):box.getSize(new T.Vector3());let radius=0;
  pivot.traverse(o=>{if(!o.isMesh||/TireLetter/.test(o.material?.name))return;const a=o.geometry.attributes.position,indices=o.geometry.index?.array,matrix=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld);for(const i of new Set(indices||Array.from({length:a.count},(_,j)=>j))){v.fromBufferAttribute(a,i).applyMatrix4(matrix).sub(center);radius=Math.max(radius,Math.hypot(v.x,v.y));}});
  const shape=new T.Group();shape.name=`${vehicle}_${id}_CenteredTire`;for(const child of [...pivot.children])shape.add(child);shape.position.copy(center).multiplyScalar(-1);pivot.add(shape);
  const stationary=tier.stationaryWheels?.[id];if(stationary?.children.length){const stationaryShape=new T.Group();for(const child of [...stationary.children])stationaryShape.add(child);stationaryShape.position.copy(center).multiplyScalar(-1);stationary.add(stationaryShape);stationary.matrixAutoUpdate=false;}
  wheelShapes.set(pivot,{radius:Math.max(.01,radius),width:Math.max(.01,tireBox.isEmpty()?size.z:tireBox.getSize(new T.Vector3()).z),center:center.toArray()});pivot.matrixAutoUpdate=false;
 }
 root.matrixAutoUpdate=false;let active=false,lastWheels={},radiusScale=1;
 const chassisMatrix=new T.Matrix4(),desired=new T.Matrix4(),inverseParent=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),steering=new T.Quaternion(),spin=new T.Quaternion(),wheelQ=new T.Quaternion(),normal=new T.Vector3(),worldCenter=new T.Vector3(),physicalPoint=new T.Vector3(),wheelMatrix=new T.Matrix4(),scale=new T.Vector3(),unit=new T.Vector3(1,1,1),axisY=new T.Vector3(0,1,0),axisZ=new T.Vector3(0,0,1);
 return {
  setChassisRadiusScale(value){radiusScale=Number.isFinite(value)?Math.max(.9,Math.min(1.15,value)):1;},
  update(snapshot){if(!snapshot?.chassis?.position||!snapshot?.chassis?.rotation)return false;p.fromArray(snapshot.chassis.position);q.fromArray(snapshot.chassis.rotation);chassisMatrix.compose(p,q,unit);modelRoot.updateWorldMatrix(true,false);inverseParent.copy(modelRoot.matrixWorld).invert();desired.multiplyMatrices(chassisMatrix,bodyFit);root.matrix.multiplyMatrices(inverseParent,desired);root.matrix.decompose(root.position,root.quaternion,root.scale);root.updateWorldMatrix(false,true);lastWheels={};
   for(const [index,id]of IDS.entries()){const wheel=snapshot.wheels?.find(w=>w.id===id);if(!wheel)continue;const front=index<2,compression=Number.isFinite(wheel.compressionM)?wheel.compressionM:0,rest=front?.115:.118,anchor=wheel.localAnchorM||[front?spec.wheelbaseM*(1-spec.frontWeight):-spec.wheelbaseM*spec.frontWeight,-spec.cgHeightM,(id.endsWith('Left')?1:-1)*(front?spec.frontTrackM:spec.rearTrackM)/2];
    // Reconstruct the ray contact from the interpolated chassis and compression.
    // This keeps the tire smooth when the physical contact point belongs to the next fixed tick.
    physicalPoint.set(anchor[0],-spec.cgHeightM-rest+compression,anchor[2]).applyMatrix4(chassisMatrix);normal.set(0,1,0).applyQuaternion(q);if(wheel.contact&&Array.isArray(wheel.normal))normal.fromArray(wheel.normal).normalize();worldCenter.copy(physicalPoint).addScaledVector(normal,spec.radiusM*radiusScale);
    steering.setFromAxisAngle(axisY,front?-(wheel.steerAngleRad||0):0);spin.setFromAxisAngle(axisZ,wheel.rotationRad||0);wheelQ.copy(q).multiply(sourceYaw).multiply(steering).multiply(spin);
    for(const tier of tiers){const pivot=tier.wheels[id],shape=wheelShapes.get(pivot);scale.set(spec.radiusM/shape.radius,spec.radiusM/shape.radius,spec.tireWidthM/shape.width);wheelMatrix.compose(worldCenter,wheelQ,scale);pivot.matrix.copy(tier.model.matrixWorld).invert().multiply(wheelMatrix);pivot.matrix.decompose(pivot.position,pivot.quaternion,pivot.scale);pivot.updateWorldMatrix(false,true);const stationary=tier.stationaryWheels?.[id];if(stationary?.children.length){wheelMatrix.compose(worldCenter,wheelQ.clone().multiply(spin.clone().invert()),scale);stationary.matrix.copy(tier.model.matrixWorld).invert().multiply(wheelMatrix);stationary.matrix.decompose(stationary.position,stationary.quaternion,stationary.scale);stationary.updateWorldMatrix(false,true);}}
    lastWheels[id]={centerWorld:worldCenter.toArray(),pointInterpolated:physicalPoint.toArray(),radiusM:spec.radiusM*radiusScale,widthM:spec.tireWidthM,compressionM:compression,contact:!!wheel.contact};
   }
   active=true;return true;
  },
  diagnostics:()=>({active,sourceToMeters:[sx,sy,sz],bodyOffsetM:offset.toArray(),wheelbaseM:spec.wheelbaseM,heightM:spec.heightM,radiusM:spec.radiusM*radiusScale,tireWidthM:spec.tireWidthM,sourceWheels:[...wheelShapes].map(([pivot,shape])=>({id:pivot.name,...shape})),wheels:lastWheels}),
 };
}
