export function auditPreparation(renderer,capture,captureCamera){
 if(globalThis.__asfaltoShaderAuditOn){
  let audit=renderer.__asfaltoShaderAudit;
  if(!audit){audit=renderer.__asfaltoShaderAudit={known:new Set(),draws:[],preparations:[]};globalThis.__asfaltoShaderAudit=audit;(globalThis.__asfaltoShaderAudits??=[]).push(audit);const original=renderer.renderBufferDirect;
   renderer.renderBufferDirect=function(...args){const before=performance.now();const result=original.apply(this,args);const ms=performance.now()-before;
    if(ms>30&&audit.draws.length<100){const material=args[3],program=renderer.properties.get(material).currentProgram;const key=program?.cacheKey;const parts=key?.split(',')||[];let nearest=null,best=1e9;
     for(const known of audit.known){const other=known.split(','),diff=parts.flatMap((v,i)=>v===other[i]?[]:[[i,other[i],v]]);if(diff.length<best){best=diff.length;nearest=diff;}}
     const lights=[];args[1].traverseVisible(node=>{if(node.isLight&&node.layers.test(args[0].layers))lights.push({name:node.name,type:node.type,intensity:node.intensity});});audit.draws.push({lights,ms,material:material?.name,object:args[4]?.name,known:audit.known.has(key),diff:nearest,key,stack:new Error().stack});}
    return result;};
  }
  const lights=[];capture.traverseVisible(node=>{if(node.isLight&&node.layers.test(captureCamera.layers))lights.push({name:node.name,type:node.type,intensity:node.intensity});});audit.preparations.push({camera:captureCamera.name,mask:captureCamera.layers.mask,lights,clip:renderer.clippingPlanes?.length,shadow:renderer.shadowMap.enabled,programs:renderer.info.programs.length});
  for(const program of renderer.info.programs||[])audit.known.add(program.cacheKey);
 }

}


export function auditProgramOwners(renderer,objects){if(!globalThis.__asfaltoShaderAuditOn)return;const owners=renderer.__asfaltoProgramOwners??=new Map();for(const object of objects)for(const material of Array.isArray(object.material)?object.material:[object.material]){if(!material)continue;for(const program of renderer.properties.get(material).programs?.values()||[]){let names=owners.get(program.cacheKey);if(!names)owners.set(program.cacheKey,names=new Set());names.add(material.name||material.type);}}}
