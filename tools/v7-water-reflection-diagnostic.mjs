export function toggleReflection(enabled){
 const T=__chevyV6Three,r=__qaRender.renderer,scene=__qaRender.scene;
 globalThis.qaWaterOriginalHooks??=new Map();
 scene.traverse(o=>{if(!o.isMesh||!o.material?.userData.asfaltoWaterEffects)return;
 if(!qaWaterOriginalHooks.has(o))qaWaterOriginalHooks.set(o,o.onBeforeRender);
 o.onBeforeRender=function(...args){qaWaterOriginalHooks.get(o)?.apply(this,args);const u=r.properties.get(o.material).uniforms;if(u?.uAnWaterReflectReady&&!enabled)u.uAnWaterReflectReady.value=0;};
 });__cockpit.render();return [...qaWaterOriginalHooks.keys()].map(o=>o.name);
}
export function previewReflection(){
 const T=__chevyV6Three,{renderer:r,scene:world}=__qaRender;let texture;
 world.traverse(o=>{if(o.name==='WATER_Villarino_Primitive_0')texture=r.properties.get(o.material).uniforms.uAnWaterReflection.value;});
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1),geo=new T.PlaneGeometry(2,2),mat=new T.MeshBasicMaterial({map:texture,depthTest:false,depthWrite:false}),quad=new T.Mesh(geo,mat);scene.add(quad);const target=r.getRenderTarget();r.setRenderTarget(null);r.render(scene,camera);r.setRenderTarget(target);geo.dispose();mat.dispose();return {size:[texture.image.width,texture.image.height]};
}
