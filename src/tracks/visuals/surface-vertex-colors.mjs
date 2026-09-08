
// Deterministic world-space fields; linear multipliers over photographic maps.
const palettes={
  cataratas_iguazu:[[.81,.94,.73],[1.06,.91,.77],[.91,.96,.85]],
  dos_lagos:[[.84,.94,.77],[1.04,.99,.88],[.86,.91,.96]],
  paso_garibaldi:[[.78,.88,.75],[.96,.94,.86],[.86,.94,1.02]],
  aconcagua_horcones:[[1.04,.97,.84],[.85,.90,.97],[.97,.87,.75]],
  cuesta_lipan:[[1.09,.91,.74],[.94,.78,.69],[1.03,.99,.86]],
};
const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;
  u=u*u*(3-2*u);v=v*v*(3-2*v);
  return(hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
}
export function sampleSurfaceTint(id,x,y,z,role='terrain'){
  const palette=palettes[id]||palettes.dos_lagos;
  const a=noise(x*.012,z*.012),b=noise(x*.035+y*.014,z*.035),broad=noise(x*.0023,z*.0023);
  const strength=role==='road'?.20:role==='gravel'?.65:1;
  return palette[0].map((v,i)=>{
    const tint=(v*(1-a)+palette[1][i]*a)*(.94+b*.12);
    return 1+((tint*(1-broad*.34)+palette[2][i]*broad*.34)-1)*strength;
  });
}
export function applySurfaceVertexColors(THREE,root,{id}={}){
  root.updateMatrixWorld(true);
  const protectedGeometries=new Set(),uses=new Map(),retainedSources=new Map();
  root.traverse(o=>{
    if(!o.isMesh)return;
    uses.set(o.geometry,(uses.get(o.geometry)||0)+1);
    for(let parent=o;parent;parent=parent.parent){
      if(!parent.visible||/COLLISION_|SOURCE_OWNER|RESOURCE_OWNER/.test(parent.name)){
        protectedGeometries.add(o.geometry);break;
      }
    }
  });
  const point=new THREE.Vector3(),matrix=new THREE.Matrix4(),color=new THREE.Color();
  let meshes=0,vertices=0,instances=0;
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.userData.asfaltoVertexVariation||!mesh.geometry?.attributes.position)return;
    for(let o=mesh;o;o=o.parent)if(!o.visible||/COLLISION_|SOURCE_OWNER|RESOURCE_OWNER/.test(o.name))return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(!materials.every(m=>m?.userData.asfaltoSurfaceRole&&!m.transparent))return;
    const role=materials[0].userData.asfaltoSurfaceRole;
    if(protectedGeometries.has(mesh.geometry)||uses.get(mesh.geometry)>1){
      const original=mesh.geometry;
      mesh.geometry=original.clone();
      if(!protectedGeometries.has(original)&&!retainedSources.has(original)){
        const owner=new THREE.Mesh(original,materials[0]);
        owner.name='ASFALTO_VERTEX_COLOR_SOURCE_OWNER';owner.visible=false;retainedSources.set(original,owner);
      }
    }
    const geometry=mesh.geometry,p=geometry.attributes.position,source=geometry.attributes.color;
    const stride=source?.itemSize===4?4:3,values=new Float32Array(p.count*stride);
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i);
      if(!mesh.isInstancedMesh)point.applyMatrix4(mesh.matrixWorld);
      const tint=sampleSurfaceTint(id,point.x,point.y,point.z,role);
      for(let c=0;c<3;c++)values[i*stride+c]=tint[c]*(source?.itemSize===4 ? 1 : source ? .85+.15*source.getComponent(i,c) : 1);
      if(stride===4)values[i*stride+3]=source.getW(i);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(values,stride));
    if(mesh.isInstancedMesh&&mesh.userData.asfaltoCanonicalInstances){
      // Culling compacts matrices each frame. Derive tint from the live instance
      // transform so colors cannot jump between rocks or disappear in seam copies.
      for(const m of materials)installInstanceTint(m,id);
      instances+=mesh.count;
    }else if(mesh.isInstancedMesh){
      const hadColor=!!mesh.instanceColor;
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
        const tint=sampleSurfaceTint(id,point.x,point.y,point.z,role);
        if(hadColor)mesh.getColorAt(i,color);else color.setRGB(1,1,1);
        color.r*=tint[0];color.g*=tint[1];color.b*=tint[2];mesh.setColorAt(i,color);
      }
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;instances+=mesh.count;
    }
    for(const m of materials){m.vertexColors=true;m.needsUpdate=true;m.userData.asfaltoVertexVariation=true;}
    mesh.userData.asfaltoVertexVariation={id,role,vertices:p.count};meshes++;vertices+=p.count;
  });
  for(const owner of retainedSources.values())root.add(owner);
  return{meshes,vertices,instances};
}

function installInstanceTint(material,id){
  if(material.userData.asfaltoInstanceTint)return;
  material.userData.asfaltoInstanceTint=true;
  const previous=material.onBeforeCompile,base=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\n'+
      '#if defined(USE_INSTANCING) && (defined(USE_COLOR) || defined(USE_COLOR_ALPHA))\n'+
      'vec3 anTintOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;\n'+
      'float anTintField=.5+.5*sin(anTintOrigin.x*.017+sin(anTintOrigin.z*.011)*2.);\n'+
      'vColor.rgb*=mix(vec3(.88,.92,.86),vec3(1.04,1.01,.96),anTintField);\n#endif');
  };
  material.customProgramCacheKey=()=>base+'|world-instance-tint-v1-'+id;
  material.needsUpdate=true;
}
