/** Evict the GPU residency of an editable interior when another car replaces it.
 * Keep CPU arrays/ImageBitmaps intact so returning to that car or its editor
 * uploads the same quality again. Objects borrowed by the live scene stay owned. */
export function releaseInactiveSceneGpu(root,scene){
 const nodes=new Set(),candidates=new Set(),borrowed=new Set();root.traverse(node=>nodes.add(node));
 const collect=(node,out)=>{if(node.geometry)out.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material){out.add(material);for(const value of Object.values(material))if(value?.isTexture)out.add(value);for(const uniform of Object.values(material.uniforms||{})){const values=Array.isArray(uniform.value)?uniform.value:[uniform.value];for(const value of values)if(value?.isTexture)out.add(value);}}if(node.isInstancedMesh||node.isBatchedMesh)out.add(node);};
 for(const node of nodes)collect(node,candidates);scene.traverse(node=>{if(!nodes.has(node))collect(node,borrowed);});for(const value of [scene.environment,scene.background])if(value?.isTexture)borrowed.add(value);
 const counts={textures:0,geometries:0,materials:0,instances:0},errors=[];
 for(const resource of candidates)if(!borrowed.has(resource)){try{resource.dispose?.();}catch(error){errors.push(error);}const key=resource.isTexture?'textures':resource.isBufferGeometry?'geometries':resource.isMaterial?'materials':'instances';counts[key]++;}
 if(errors.length)throw new AggregateError(errors,'Inactive cockpit GPU retirement failed');return counts;
}
