export const garibaldiLaderaAsset=Object.freeze({
  path:'assets/tracks/garibaldi-ladera.glb.gz', bytes:328658,
  sha256:'31bd6302c0966ca3768a9942c19fdb237d05acf724097bde13e9e748c409711e',
  startM:13760, endM:15240, triangles:19964, primitives:6,
});

const roles=Object.freeze({
  TERRAIN_GARIBALDI_JUNTA:'ground', TERRAIN_GARIBALDI_ESTRATOS:'ground',
  TERRAIN_GARIBALDI_MORRENITAS:'ground', GARIBALDI_LENGA_CORTEZA:'trunk',
  GARIBALDI_LENGA_COPA:'visual', GARIBALDI_BORDE_HELECHOS:'visual',
});

function validateStems(stems){
  if(!Array.isArray(stems?.vertices)||!Array.isArray(stems?.indices)||
     stems.vertices.length<9||stems.vertices.length%3||stems.indices.length<3||stems.indices.length%3||
     !stems.vertices.every(Number.isFinite)||!stems.indices.every(i=>Number.isInteger(i)&&i>=0&&i<stems.vertices.length/3)){
    throw new Error('Los troncos de Garibaldi no coinciden con el arte de Blender.');
  }
  return stems;
}

export function attachGaribaldiLadera(root,art){
  const found=new Map();
  let triangles=0,groundTriangles=0,stemTriangles=0;
  art.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const name=mesh.parent.name,role=roles[name],metadata=mesh.parent.userData;
    const geometry=mesh.geometry,positions=geometry.attributes.position;
    if(!role||metadata.asfaltoGaribaldiRole!==role||found.has(name)||!positions?.count||!geometry.index){
      throw new Error('Malla Garibaldi inesperada: '+name);
    }
    const count=geometry.index.count/3;
    found.set(name,mesh);
    triangles+=count;
    mesh.userData.collision=role!=='visual';
    mesh.receiveShadow=true;
    mesh.castShadow=false;
    if(role==='trunk'){
      mesh.userData.asfaltoTrunkCollider=validateStems(metadata.asfaltoTrunkCollider);
      stemTriangles+=mesh.userData.asfaltoTrunkCollider.indices.length/3;
    }
    if(role==='ground'){
      if(geometry.attributes.uv2?.count!==positions.count||mesh.material.userData.asfaltoWeatherMask!=='uv2-snow-wetness'){
        throw new Error('Falta la máscara local de nieve y humedad: '+name);
      }
      groundTriangles+=count;
    }
  });
  if(found.size!==garibaldiLaderaAsset.primitives||triangles!==garibaldiLaderaAsset.triangles||!stemTriangles){
    throw new Error('El paquete Garibaldi no coincide con su exportación.');
  }
  const source={};
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(/^ROAD_SHOULDERS/.test(mesh.name))source.verge??=mesh.material;
    if(/^TERRAIN_HERO/.test(mesh.name))source.terrain??=mesh.material;
  });
  const shareMaps=(material,maps)=>{
    if(!maps)return;
    material.map=maps.map||null;
    material.normalMap=maps.normalMap||null;
    if(material.normalMap)material.normalScale.copy(maps.normalScale);
  };
  // Borrow the existing Garibaldi textures. Both owners unload in the same root.
  shareMaps(found.get('TERRAIN_GARIBALDI_JUNTA').material,source.verge);
  shareMaps(found.get('TERRAIN_GARIBALDI_ESTRATOS').material,source.terrain);
  art.name='ASFALTO_GARIBALDI_LADERA_BLENDER';
  root.add(art);
  root.userData.asfaltoGaribaldiLadera=Object.freeze({triangles,groundTriangles,stemTriangles,
    primitives:found.size,startM:garibaldiLaderaAsset.startM,endM:garibaldiLaderaAsset.endM});
  return root.userData.asfaltoGaribaldiLadera;
}
