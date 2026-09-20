/** Local contact occlusion under measured supports. No geometry is moved to hide gaps. */
export function createWorkshopPropContact(T,{root,floorAt}={}){
 const supports=[];root.updateMatrixWorld(true);
 for(const object of root.children){if(!/^(E31_BreakTableLeg|E31_StoolLeg)$/.test(object.name))continue;const box=new T.Box3().setFromObject(object),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),floorY=floorAt(center.x,center.z),gap=box.min.y-floorY;if(gap<-.003||gap>.012)continue;supports.push({name:object.name,x:center.x,z:center.z,floorY,width:size.x,depth:size.z,gap});}
 const geometry=new T.PlaneGeometry(1,1),extent=new Float32Array(supports.length*2),half=new Float32Array(supports.length*2);
 const material=new T.ShaderMaterial({name:'E31_SupportContact',transparent:true,depthWrite:false,toneMapped:false,uniforms:{opacity:{value:.45}},vertexShader:`#include <common>
 #include <logdepthbuf_pars_vertex>
 attribute vec2 contactExtent;attribute vec2 contactHalf;varying vec2 vContactPoint;varying vec2 vContactHalf;
 void main(){vContactPoint=(uv-.5)*contactExtent;vContactHalf=contactHalf;vec4 p=vec4(position,1.);
 #ifdef USE_INSTANCING
 p=instanceMatrix*p;
 #endif
 gl_Position=projectionMatrix*modelViewMatrix*p;
 #include <logdepthbuf_vertex>
 }`,fragmentShader:`#include <logdepthbuf_pars_fragment>
 uniform float opacity;varying vec2 vContactPoint;varying vec2 vContactHalf;
 void main(){
 #include <logdepthbuf_fragment>
 float outside=length(max(abs(vContactPoint)-vContactHalf,vec2(0.)));float a=opacity*exp(-outside*95.);if(a<.003)discard;gl_FragColor=vec4(.025,.024,.020,a);}`});
 const mesh=new T.InstancedMesh(geometry,material,supports.length);mesh.name='E31_MeasuredSupportContacts';mesh.renderOrder=2;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.pivotPainter=false;
 const rotation=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0));supports.forEach((p,i)=>{const w=p.width+.10,d=p.depth+.10;extent.set([w,d],i*2);half.set([p.width/2,p.depth/2],i*2);mesh.setMatrixAt(i,new T.Matrix4().compose(new T.Vector3(p.x,p.floorY+.009,p.z),rotation,new T.Vector3(w,d,1)));});
 geometry.setAttribute('contactExtent',new T.InstancedBufferAttribute(extent,2));geometry.setAttribute('contactHalf',new T.InstancedBufferAttribute(half,2));mesh.instanceMatrix.needsUpdate=true;root.add(mesh);let disposed=false;
 return{mesh,diagnostics:()=>({method:'local contact occlusion approximation under measured feet',supports:supports.map(p=>({...p})),drawCalls:supports.length?1:0,textures:0,disposed}),dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();mesh.dispose();}};
}

