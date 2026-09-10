/** Cached local contact approximation from the actual underside, independent of room key-light shadows. */
export function createWorkshopContactShadow(T,{renderer,scene,car,floorY,getRevision=()=>''}={}) {
 if(!renderer||!scene||!car||!Number.isFinite(floorY))throw new TypeError('Workshop contact requires renderer, scene, car and floor');
 const resolution=[256,128],targets=Array.from({length:3},(_,i)=>new T.WebGLRenderTarget(...resolution,{depthBuffer:i===0,stencilBuffer:false}));
 const camera=new T.OrthographicCamera(-3,3,1.5,-1.5,.005,3.5);camera.up.set(0,0,1);
 const depth=new T.ShaderMaterial({side:T.DoubleSide,toneMapped:false,uniforms:{floorY:{value:floorY}},vertexShader:'uniform float floorY; varying float heightAboveFloor; void main(){vec4 p=vec4(position,1.);\n#ifdef USE_INSTANCING\np=instanceMatrix*p;\n#endif\nvec4 world=modelMatrix*p;heightAboveFloor=max(0.,world.y-floorY);gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'varying float heightAboveFloor;void main(){float contact=exp(-heightAboveFloor*6.);gl_FragColor=vec4(vec3(contact),1.);}'});
 const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{source:{value:null},step:{value:new T.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D source;uniform vec2 step;varying vec2 vUv;void main(){float a=texture2D(source,vUv).r*.38774; a+=(texture2D(source,vUv+step*1.25).r+texture2D(source,vUv-step*1.25).r)*.24477;a+=(texture2D(source,vUv+step*2.75).r+texture2D(source,vUv-step*2.75).r)*.06136;gl_FragColor=vec4(vec3(a),1.);}'});
 const passGeometry=new T.PlaneGeometry(2,2),passScene=new T.Scene(),passCamera=new T.Camera();passScene.add(new T.Mesh(passGeometry,blur));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms:{contactMap:{value:targets[2].texture},opacity:{value:.64}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D contactMap;uniform float opacity;varying vec2 vUv;void main(){float a=texture2D(contactMap,vUv).r*opacity;if(a<.003)discard;gl_FragColor=vec4(.019,.017,.014,a);}'});
 const geometry=new T.PlaneGeometry(1,1),plane=new T.Mesh(geometry,material);plane.name='Workshop_Vehicle_Contact';plane.rotation.x=Math.PI/2;plane.renderOrder=3;plane.visible=false;scene.add(plane);
 let disposed=false,signature=null,captures=0,lastBounds=null;
 const box=new T.Box3(),partBox=new T.Box3(),size=new T.Vector3(),center=new T.Vector3();
 function update(){
  if(disposed||!car.visible)return false;car.updateWorldMatrix(true,true);
  const next=car.matrixWorld.elements.join(',')+'|'+getRevision();if(next===signature)return false;
  box.makeEmpty();car.traverse(o=>{if(!o.isMesh)return;for(let p=o;p&&p!==car.parent;p=p.parent)if(!p.visible)return;partBox.setFromObject(o);box.union(partBox);});if(box.isEmpty())return false;
  box.getCenter(center);box.getSize(size);const width=Math.max(.5,size.x+.48),length=Math.max(.5,size.z+.48);
  camera.left=-width/2;camera.right=width/2;camera.top=length/2;camera.bottom=-length/2;camera.far=Math.max(3.5,size.y+.5);camera.position.set(center.x,floorY-.012,center.z);camera.lookAt(center.x,floorY+1,center.z);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const prior={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new T.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,toneMapping:renderer.toneMapping,xr:renderer.xr?.enabled,shadowAuto:renderer.shadowMap?.autoUpdate,shadowDirty:renderer.shadowMap?.needsUpdate,override:scene.overrideMaterial,background:scene.background,visibility:scene.children.map(o=>[o,o.visible])};
  try{
   for(const [object]of prior.visibility)if(object!==car)object.visible=false;scene.overrideMaterial=depth;scene.background=null;renderer.autoClear=true;renderer.toneMapping=T.NoToneMapping;if(renderer.xr)renderer.xr.enabled=false;if(renderer.shadowMap){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;}renderer.setScissorTest(false);renderer.setClearColor(0,0);
   renderer.setRenderTarget(targets[0]);renderer.clear();renderer.render(scene,camera);
   blur.uniforms.source.value=targets[0].texture;blur.uniforms.step.value.set(1/resolution[0],0);renderer.setRenderTarget(targets[1]);renderer.clear();renderer.render(passScene,passCamera);
   blur.uniforms.source.value=targets[1].texture;blur.uniforms.step.value.set(0,1/resolution[1]);renderer.setRenderTarget(targets[2]);renderer.clear();renderer.render(passScene,passCamera);
   signature=next;captures++;lastBounds={min:box.min.toArray(),max:box.max.toArray()};
  }finally{
   scene.overrideMaterial=prior.override;scene.background=prior.background;for(const[o,visible]of prior.visibility)o.visible=visible;renderer.autoClear=prior.autoClear;renderer.toneMapping=prior.toneMapping;if(renderer.xr)renderer.xr.enabled=prior.xr;if(renderer.shadowMap){renderer.shadowMap.autoUpdate=prior.shadowAuto;renderer.shadowMap.needsUpdate=prior.shadowDirty;}renderer.setRenderTarget(prior.target);renderer.setViewport(prior.viewport);renderer.setScissor(prior.scissor);renderer.setScissorTest(prior.scissorTest);renderer.setClearColor(prior.clear,prior.alpha);
  }
  plane.position.set(center.x,floorY+.009,center.z);plane.scale.set(width,length,1);plane.visible=true;return true;
 }
 return Object.freeze({plane,update,invalidate(){signature=null;},diagnostics:()=>({approximation:'underside-height-contact',resolution:[...resolution],captures,liveTargets:disposed?0:3,steadyDrawCalls:disposed?0:1,bounds:lastBounds,disposed}),dispose(){if(disposed)return;disposed=true;plane.removeFromParent();for(const target of targets)target.dispose();for(const resource of [geometry,material,depth,blur,passGeometry])resource.dispose();passScene.clear();}});
}
