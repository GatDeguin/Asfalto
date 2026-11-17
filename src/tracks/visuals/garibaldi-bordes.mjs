export const garibaldiBordesAsset=Object.freeze({
  path:'assets/tracks/garibaldi-bordes.glb.gz',bytes:1621999,
  sha256:'8d8da81cda501fe922a0c2826b1830e03a13ae4cdc2625e99c624cb6bbcca9f7',
  startM:0,endM:24000,triangles:112680,primitives:16,
  preservedStartM:13760,preservedEndM:15240,
});

/** Measured Blender ground uses the same mesh for rendering and scene collision. */
export function attachGaribaldiBordes(root,art){
  const found=new Map();let triangles=0;
  art.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const owner=mesh.parent,name=owner.name,metadata=owner.userData;
    const geometry=mesh.geometry,positions=geometry?.attributes?.position;
    const range=metadata?.asfaltoGaribaldiBoundaryRangeM;
    if(!/^TERRAIN_GARIBALDI_BORDE_\d{2}$/.test(name)||found.has(name)||
       metadata.asfaltoGaribaldiBoundaryRole!=='ground'||!positions?.count||!geometry.index||
       geometry.index.count%3||geometry.attributes.uv2?.count!==positions.count||
       mesh.material?.userData?.asfaltoWeatherMask!=='uv2-snow-wetness'||
       !Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||
       range[0]<0||range[0]>=range[1]||range[1]>24000||
       (range[0]<15232&&range[1]>13768)){
      throw new Error('Malla de apoyo Garibaldi inesperada: '+name);
    }
    found.set(name,mesh);triangles+=geometry.index.count/3;
  });
  if(found.size!==garibaldiBordesAsset.primitives||triangles!==garibaldiBordesAsset.triangles){
    throw new Error('El apoyo continuo de Garibaldi no coincide con Blender.');
  }
  let shoulder;
  root.traverse(mesh=>{if(mesh.isMesh&&/^ROAD_SHOULDERS/.test(mesh.name))shoulder??=mesh.material;});
  for(const mesh of found.values()){
    mesh.userData.collision=true;
    mesh.receiveShadow=true;mesh.castShadow=false;
    if(shoulder){
      mesh.material.map=shoulder.map||null;
      mesh.material.normalMap=shoulder.normalMap||null;
      if(mesh.material.normalMap)mesh.material.normalScale.copy(shoulder.normalScale);
    }
  }
  art.name='ASFALTO_GARIBALDI_BORDES_BLENDER';
  root.add(art);
  return root.userData.asfaltoGaribaldiBordes=Object.freeze({triangles,primitives:found.size,
    startM:garibaldiBordesAsset.startM,endM:garibaldiBordesAsset.endM,
    preservedStartM:garibaldiBordesAsset.preservedStartM,preservedEndM:garibaldiBordesAsset.preservedEndM});
}
