/** Explicit QA query only: counts program owners without retaining scene objects. */
export function inspectProgramResidency(renderer,scene){
 const materials=new Set(),visible=new Set(),owners=new Map();
 const collect=(node,set)=>{for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)set.add(material);};
 scene.traverse(node=>collect(node,materials));scene.traverseVisible(node=>collect(node,visible));const summaries=[];
 for(const material of materials){if(!renderer.properties.has(material))continue;const programs=[...(renderer.properties.get(material).programs?.values()||[])];if(!programs.length)continue;summaries.push({name:material.name||material.type,visible:visible.has(material),variants:programs.length});for(const program of programs){let record=owners.get(program);if(!record)owners.set(program,record={visible:false});record.visible||=visible.has(material);}}
 const live=renderer.info.programs||[];return {total:live.length,visibleMaterialPrograms:live.filter(p=>owners.get(p)?.visible).length,hiddenMaterialPrograms:live.filter(p=>owners.has(p)&&!owners.get(p).visible).length,rendererInternalPrograms:live.filter(p=>!owners.has(p)).length,materialOwners:summaries.sort((a,b)=>b.variants-a.variants)};
}
