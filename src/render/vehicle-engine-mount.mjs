import { getVehicleDefinition } from './vehicle-catalog.mjs?v=400-review-r144-20260917';

// Coordinates are in the exterior presentation root; the supplied engine is in
// metres. Its cylinder block center is the mounting datum, not its asymmetric box.
export function getVehicleEngineMount(vehicle) {
  return getVehicleDefinition(vehicle)?.engineMount || null;
}

export function calculateVehicleEngineFit(vehicle, { engineBoundsM, engineBlockCenterM, unitsPerMeter } = {}) {
  const spec=getVehicleEngineMount(vehicle);
  if(!spec)return null;
  const bounds=engineBoundsM||spec.engineBoundsM,block=engineBlockCenterM||spec.engineBlockCenterM,scale=unitsPerMeter??spec.unitsPerMeter;
  if(!Number.isFinite(scale)||scale<=0)throw new RangeError('Engine unitsPerMeter must be positive');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){
    const p=[-(z-block[2])*scale,(y-block[1])*scale,(x-block[0])*scale];
    for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  }
  const center=[...spec.center];
  center[1]=Math.min(center[1],spec.bayBounds.max[1]-max[1]);
  const fitted={min:min.map((x,k)=>x+center[k]),max:max.map((x,k)=>x+center[k])};
  const clearance={min:fitted.min.map((x,k)=>x-spec.bayBounds.min[k]),max:fitted.max.map((x,k)=>spec.bayBounds.max[k]-x)};
  return {center,rotationY:spec.rotationY,unitsPerMeter:scale,engineBlockCenterM:[...block],bounds:fitted,clearance,contained:[...clearance.min,...clearance.max].every(x=>x>=-1e-6)};
}


// The source model must first be translated by -engineBlockCenterM, exactly as
// the existing workshop loader does. This transform then locates that datum.
// When requiresMatrix is true, use mount.matrix.copy(result.matrix) and
// mount.matrixAutoUpdate=false. Otherwise apply position/quaternion/scale.
export function resolveWorkshopEngineMount(T,{vehicle,presentationRoot,carRoot,engineBoundsM,engineBlockCenterM}={}){
  const spec=getVehicleEngineMount(vehicle);if(!spec)return null;
  if(!presentationRoot||!carRoot)throw new TypeError('Engine mount needs the actual presentation and car roots');
  presentationRoot.updateWorldMatrix(true,false);carRoot.updateWorldMatrix(true,false);
  const rootWorld=presentationRoot.matrixWorld,rootInverse=rootWorld.clone().invert(),carInverse=carRoot.matrixWorld.clone().invert();
  const basisX=new T.Vector3().setFromMatrixColumn(rootWorld,0).normalize();
  const basisY=new T.Vector3().setFromMatrixColumn(rootWorld,1);basisY.addScaledVector(basisX,-basisY.dot(basisX)).normalize();
  const basisZ=new T.Vector3().crossVectors(basisX,basisY).normalize();
  const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(basisX,basisY,basisZ)).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),spec.rotationY));
  const bounds=engineBoundsM||spec.engineBoundsM,block=engineBlockCenterM||spec.engineBlockCenterM,relative=new T.Box3(),point=new T.Vector3(),rootOrigin=new T.Vector3().setFromMatrixPosition(rootWorld);
  for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){
    point.set(x-block[0],y-block[1],z-block[2]).applyQuaternion(orientation).add(rootOrigin).applyMatrix4(rootInverse);relative.expandByPoint(point);
  }
  const center=new T.Vector3().fromArray(spec.center);center.y=Math.min(center.y,spec.bayBounds.max[1]-relative.max.y);
  const fitted=relative.clone().translate(center),clearance={min:fitted.min.toArray().map((x,k)=>x-spec.bayBounds.min[k]),max:fitted.max.toArray().map((x,k)=>spec.bayBounds.max[k]-x)};
  const worldPosition=center.clone().applyMatrix4(rootWorld),worldMatrix=new T.Matrix4().compose(worldPosition,orientation,new T.Vector3(1,1,1)),matrix=carInverse.multiply(worldMatrix),position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3();matrix.decompose(position,quaternion,scale);
  const recomposed=new T.Matrix4().compose(position,quaternion,scale),matrixError=Math.max(...matrix.elements.map((x,k)=>Math.abs(x-recomposed.elements[k])));
  return {position,quaternion,scale,matrix,requiresMatrix:matrixError>1e-7,engineBlockCenterM:[...block],fit:{coordinateSpace:'presentation-root',center:center.toArray(),bounds:{min:fitted.min.toArray(),max:fitted.max.toArray()},bayBounds:spec.bayBounds,clearance,contained:[...clearance.min,...clearance.max].every(x=>x>=-1e-6),worldAxisScales:[1,1,1]}};
}
