/** Phone parts use the already-reviewed display mesh; normalization retains the full-source reference box. */
export function attachPhoneDisplayReference(mesh,json,phone){
 const data=json.extras?.asfaltoPhoneDisplay;if(!phone||!data)return mesh;
 const bounds=data.sourceBounds;if(!bounds||!['min','max'].every(k=>bounds[k]?.length===3&&bounds[k].every(Number.isFinite))||bounds.min.some((n,i)=>n>bounds.max[i]))throw new Error('Referencia móvil de cockpit inválida');
 mesh.userData.phoneDisplay={name:data.name,sourceBounds:structuredClone(bounds),provenance:structuredClone(data.provenance)};return mesh;
}
export function phoneDisplayReferenceBox(T,object){const b=object.userData?.phoneDisplay?.sourceBounds;return b?new T.Box3(new T.Vector3(...b.min),new T.Vector3(...b.max)):null;}
export function swappableCockpitBindings(bindings){return Object.fromEntries(Object.entries(bindings).filter(([,mesh])=>!mesh.userData?.phoneDisplay));}
