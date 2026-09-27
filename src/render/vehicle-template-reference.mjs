import {vehicleTemplateReference as reference} from '../runtime/vehicle-template-reference.mjs?v=a2e37619eaa3c18d';
/** Legacy coordinate reference, with no renderable geometry. */
export function createVehicleTemplateReference(T){const root=new T.Object3D();root.name='Vehicle_Template_Reference';root.geometry=new T.BufferGeometry();root.geometry.boundingBox=new T.Box3(new T.Vector3(...reference.bounds.min),new T.Vector3(...reference.bounds.max));root.clone=function(){return createVehicleTemplateReference(T);};return root;}
