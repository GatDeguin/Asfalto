/** Local occlusion approximation anchored to observed wheel contacts.
 * No shadow-map, raycast, render target, texture, history or simulation state. */
const IDS = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight'];
const CORNERS = [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];
const validVector = value => (Array.isArray(value) || ArrayBuffer.isView(value)) && value.length >= 3 && [value[0],value[1],value[2]].every(Number.isFinite);
const validContact = wheel => wheel?.contact === true && validVector(wheel.point) && validVector(wheel.normal) && Math.hypot(...wheel.normal) > .001;

export function createVehicleContactOcclusion(T, {scene, renderer} = {}) {
  if (!scene?.add) throw new TypeError('Vehicle contact requires the physical scene');
  const positions = new Float32Array(5 * 6 * 3), strengths = new Float32Array(5 * 6), uvs = new Float32Array(5 * 6 * 2);
  for (let patch=0;patch<5;patch++) for (let corner=0;corner<6;corner++) {
    const at=(patch*6+corner)*2;uvs[at]=(CORNERS[corner][0]+1)/2;uvs[at+1]=(CORNERS[corner][1]+1)/2;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('anContactStrength',new T.BufferAttribute(strengths,1).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));geometry.setDrawRange(0,0);
  const material = new T.MeshBasicMaterial({color:0x000000,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,fog:true});
  material.defines={USE_UV:''};material.name='Physical wheel contact occlusion';
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float anContactStrength; varying float anContactGain;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nanContactGain=anContactStrength;');
    shader.fragmentShader='varying float anContactGain;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`diffuseColor.a*=anContactGain*(1.0-smoothstep(.15,1.0,length(vUv*2.0-1.0)));\nif(diffuseColor.a<.002)discard;\n#include <alphatest_fragment>`);
  };
  material.customProgramCacheKey=()=> 'physical-wheel-contact-occlusion-v1';
  const mesh=new T.Mesh(geometry,material);mesh.name='PhysicalVehicleContactOcclusion';mesh.renderOrder=2;mesh.frustumCulled=false;mesh.visible=false;
  mesh.userData.advancedMaterials=false;mesh.userData.asfaltoPrewarm=true;scene.add(mesh);
  const contacts=IDS.map(()=>({point:new T.Vector3(),normal:new T.Vector3(),surface:null}));
  const forward=new T.Vector3(),tangent=new T.Vector3(),side=new T.Vector3(),center=new T.Vector3(),normal=new T.Vector3(),delta=new T.Vector3(),vertex=new T.Vector3(),rotation=new T.Quaternion();
  let disposed=false,patches=0,updates=0;
  function basis(n) {
    tangent.copy(forward).addScaledVector(n,-forward.dot(n));
    if(tangent.lengthSq()<.001)tangent.set(0,0,1).addScaledVector(n,-n.z);
    tangent.normalize();side.crossVectors(n,tangent).normalize();
  }
  function patch(p,n,halfLength,halfWidth,gain) {
    basis(n);
    for(let i=0;i<6;i++) {
      vertex.copy(p).addScaledVector(n,.009).addScaledVector(tangent,CORNERS[i][0]*halfLength).addScaledVector(side,CORNERS[i][1]*halfWidth);
      vertex.toArray(positions,(patches*6+i)*3);strengths[patches*6+i]=gain;
    }
    patches++;
  }
  function update(previous,current=previous,alpha=1) {
    if(disposed)return false;
    alpha=Number.isFinite(alpha)?Math.max(0,Math.min(1,alpha)):1;patches=0;
    const q=current?.chassis?.rotation;
    rotation.set(...(q?.length===4&&Array.from(q).every(Number.isFinite)?q:[0,0,0,1])).normalize();forward.set(1,0,0).applyQuaternion(rotation);
    let count=0;
    for(const id of IDS) {
      const wheel=current?.wheels?.find(w=>w.id===id);if(!validContact(wheel))continue;
      const contact=contacts[count],before=previous?.wheels?.find(w=>w.id===id);
      contact.point.fromArray(wheel.point);contact.normal.fromArray(wheel.normal).normalize();contact.surface=wheel.surface;
      if(validContact(before)&&before.surface===wheel.surface) {
        contact.point.lerp(delta.fromArray(before.point),1-alpha);
        contact.normal.lerp(delta.fromArray(before.normal).normalize(),1-alpha).normalize();
      }
      // Wheel normals on walls or contradictory data cannot represent support below a car.
      if(contact.normal.y<.2||contact.normal.lengthSq()<.5)continue;
      patch(contact.point,contact.normal,.36,.27,.38);count++;
    }
    if(count===4) {
      center.set(0,0,0);normal.set(0,0,0);
      for(const c of contacts){center.add(c.point);normal.add(c.normal);}center.multiplyScalar(.25);normal.normalize();basis(normal);
      let length=0,width=0,planar=true;
      for(const c of contacts){delta.copy(c.point).sub(center);length=Math.max(length,Math.abs(delta.dot(tangent)));width=Math.max(width,Math.abs(delta.dot(side)));if(c.surface!==contacts[0].surface||normal.dot(c.normal)<.98||Math.abs(delta.dot(normal))>.04)planar=false;}
      if(planar&&length>.2&&length<3.5&&width>.2&&width<1.5)patch(center,normal,length+.28,width+.17,.19);
    }
    geometry.setDrawRange(0,patches*6);geometry.attributes.position.needsUpdate=true;geometry.attributes.anContactStrength.needsUpdate=true;mesh.visible=patches>0;updates++;return mesh.visible;
  }
  const lost=()=>{geometry.dispose();material.dispose();patches=0;mesh.visible=false;geometry.setDrawRange(0,0);};
  renderer?.domElement?.addEventListener?.('webglcontextlost',lost);
  return {mesh,update,diagnostics:()=>({approximation:'observed-wheel-plane soft occlusion; not directional shadow or GI',patches,steadyDrawCalls:mesh.visible?1:0,triangles:patches*2,targets:0,textures:0,updates,disposed}),dispose(){if(disposed)return;disposed=true;renderer?.domElement?.removeEventListener?.('webglcontextlost',lost);mesh.removeFromParent();geometry.dispose();material.dispose();patches=0;mesh.visible=false;}};
}
