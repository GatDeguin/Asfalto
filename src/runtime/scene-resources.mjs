/** Snapshot ownership before feature disposers detach their subtrees. Shared source
 * assets are explicitly excluded; instance buffers and shadow targets are objects,
 * not geometry/material resources, and need their own disposal. A retiring
 * renderer must evict borrowed GPU uploads too, while keeping their CPU images. */
export function snapshotSceneResources(root,{borrowedRoots=[],disposeBorrowedGpu=false}={}){
 const borrowed=new Set(),borrowedImages=new Set();
 const visitResources=(node,add)=>{if(node.geometry)add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m){add(m);for(const value of Object.values(m))if(value?.isTexture)add(value);}if(node.isInstancedMesh||node.isBatchedMesh)add(node);if(node.shadow)add(node.shadow);};
 for(const root of borrowedRoots)root?.traverse?.(node=>visitResources(node,value=>{borrowed.add(value);if(value.isTexture&&value.image)borrowedImages.add(value.image);}));
 const resources=new Set(),images=new Set();root?.traverse?.(node=>visitResources(node,value=>{if(disposeBorrowedGpu||!borrowed.has(value)){resources.add(value);if(value.isTexture&&value.image?.close&&!borrowedImages.has(value.image))images.add(value.image);}}));
 let disposed=false;
 return {dispose(){if(disposed)return false;disposed=true;const errors=[];for(const resource of resources)try{resource.dispose?.();}catch(error){errors.push(error);}for(const bitmap of images)try{bitmap.close();}catch(error){errors.push(error);}resources.clear();images.clear();if(errors.length)throw new AggregateError(errors,'No se pudieron liberar recursos de escena');return true;},diagnostics:()=>({resources:resources.size,bitmaps:images.size,disposed})};
}
