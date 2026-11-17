export const lipanAccessAsset=Object.freeze({
  path:'assets/tracks/lipan-acceso.glb.gz',bytes:105405,
  sha256:'34517e8b3290b75ab317a7d31821b802dc253bfbcf397478fab7fc2698c4d434',
  startM:0,endM:160,innerM:4.1,outerM:12.6,triangles:19840,primitives:2,
});

/** Permanent S01 shoulder support; the clearing and S05 remain authored geometry. */
export function attachLipanAccess(root,art){
  const found=new Map();let triangles=0;
  art.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const owner=mesh.parent,name=owner.name,metadata=owner.userData,p=mesh.geometry?.attributes?.position;
    if(!/^TERRAIN_LIPAN_ACCESO_(DERECHA|IZQUIERDA)$/.test(name)||found.has(name)||
       metadata.asfaltoLipanAccessRole!=='ground'||!p?.count||!mesh.geometry.index||
       mesh.geometry.index.count%3||mesh.geometry.attributes.uv2?.count!==p.count||
       mesh.material?.userData?.asfaltoWeatherMask!=='uv2-snow-wetness'||
       JSON.stringify(metadata.asfaltoLipanAccessRangeM)!=='[0,160]'||
       JSON.stringify(metadata.asfaltoLipanAccessLateralM)!=='[4.1,12.6]'){
      throw new Error('Malla de apoyo de Lipán inesperada: '+name);
    }
    found.set(name,mesh);triangles+=mesh.geometry.index.count/3;
  });
  if(found.size!==lipanAccessAsset.primitives||triangles!==lipanAccessAsset.triangles)throw new Error('El acceso de Lipán no coincide con Blender.');
  const maps=root.getObjectByName('ASFALTO_VISUAL_RESOURCE_OWNER')?.asfaltoSurfaceTextures?.gravel_floor;
  for(const mesh of found.values()){
    mesh.userData.collision=true;mesh.castShadow=false;mesh.receiveShadow=true;
    mesh.material.userData.asfaltoSurfaceRole='terrain';mesh.material.userData.asfaltoRegion='cuesta_lipan';
    if(maps){mesh.material.map=maps.diff;mesh.material.normalMap=maps.normal;mesh.material.normalScale.set(.5,.5);mesh.material.roughnessMap=maps.rough;}
  }
  art.name='ASFALTO_LIPAN_ACCESO_BLENDER';root.add(art);
  return root.userData.asfaltoLipanAccess=Object.freeze({triangles,primitives:found.size,
    startM:lipanAccessAsset.startM,endM:lipanAccessAsset.endM,innerM:lipanAccessAsset.innerM,outerM:lipanAccessAsset.outerM});
}
