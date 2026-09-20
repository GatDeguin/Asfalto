import {boundedOperation} from '../runtime/demand-loader.mjs?v=4a2efb64f7eb24a0';
import {waitForAnimationFrame} from '../runtime/abortable.mjs?v=c91114c944607feb';
import {yieldToMain} from '../runtime/cooperative-work.mjs?v=529f3ae5a1f59485';
import {auditPreparation,auditProgramOwners} from './shader-preparation-audit.mjs?v=e9677e0454b956bd';
const emptyScenes=new WeakMap();
const diagnosticsEnabled=new URLSearchParams(globalThis.location?.search).get('qa')==='1';
const rectangle=()=>({isVector4:true,x:0,y:0,z:0,w:0,copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;}});

function rendererState(renderer){return {viewport:renderer.getViewport?.(rectangle()),scissor:renderer.getScissor?.(rectangle()),scissorTest:renderer.getScissorTest?.(),target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace?.()||0,mip:renderer.getActiveMipmapLevel?.()||0,tone:renderer.toneMapping,output:renderer.outputColorSpace,clip:renderer.clippingPlanes,localClip:renderer.localClippingEnabled,shadows:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,shadowAuto:renderer.shadowMap.autoUpdate,shadowDirty:renderer.shadowMap.needsUpdate,auto:renderer.autoClear,info:renderer.info.autoReset};}
function restore(renderer,s){renderer.setRenderTarget(s.target,s.face,s.mip);renderer.toneMapping=s.tone;renderer.outputColorSpace=s.output;renderer.clippingPlanes=s.clip;renderer.localClippingEnabled=s.localClip;renderer.shadowMap.enabled=s.shadows;renderer.shadowMap.type=s.shadowType;renderer.shadowMap.autoUpdate=s.shadowAuto;renderer.shadowMap.needsUpdate=s.shadowDirty;renderer.autoClear=s.auto;renderer.info.autoReset=s.info;if(s.viewport)renderer.setViewport(s.viewport);if(s.scissor)renderer.setScissor(s.scissor);if(s.scissorTest!==undefined)renderer.setScissorTest(s.scissorTest);}

/** Capture pass state synchronously, then submit bounded batches without keeping
 * temporary renderer/light/layer mutations alive across a yield. This matters for
 * interior masks, mirror exclusions, clipping, and the HDR transmission prepass. */
export function preparePrograms(renderer,scene,camera,targetScene=scene,{signal,timeoutMs=120000}={}){
 signal?.throwIfAborted();
 const state=rendererState(renderer),captureCamera=camera.clone(),capture=new targetScene.constructor();
 for(const key of ['environment','environmentIntensity','environmentRotation','fog','overrideMaterial'])capture[key]=targetScene[key];
 state.clip=state.clip.map(plane=>plane.clone());
 const lights=[];targetScene.traverseVisible(node=>{if(node.isLight&&node.layers.test(camera.layers)){
  const light=node.clone();
  // SpotLight.copy in r180 deliberately omits its projected map. It still
  // changes NUM_SPOT_LIGHT_MAPS and shadow-map variants during real rendering.
  light.map=node.map;light.iesMap=node.iesMap;lights.push(light);
 }});
 capture.traverseVisible=visit=>{for(const light of lights)visit(light);};
 const objects=[],resources=new Set(state.target?[state.target]:[]),revisions=[];let invalidated=false,transmission=false;
 const visit=node=>{if(!(node.isMesh||node.isPoints||node.isLine||node.isSprite)||!node.material)return;objects.push(node);resources.add(node.geometry);revisions.push({node,geometry:node.geometry,material:node.material,materials:Array.isArray(node.material)?node.material.slice():[node.material]});for(const m of Array.isArray(node.material)?node.material:[node.material]){resources.add(m);if(m.transmission>0)transmission=true;}};
 if(scene.isScene)scene.traverseVisible(node=>{if(node.layers.test(camera.layers))visit(node);});else scene.traverse(visit);
 let empty=emptyScenes.get(renderer);if(!empty){empty=new targetScene.constructor();emptyScenes.set(renderer,empty);}
 const invalidate=event=>{invalidated=true;if(diagnosticsEnabled)globalThis.__asfaltoInvalidatedPreparation={type:event.target?.type||event.target?.constructor?.name,name:event.target?.name||'',at:performance.now()};};
 for(const resource of resources)resource?.addEventListener('dispose',invalidate);
 return boundedOperation(async active=>{
  const validate=()=>{active.throwIfAborted();if(invalidated||renderer.gpuOwnerDiagnostics?.().disposed)throw new DOMException('La escena cambió durante la preparación','AbortError');};
  let transmissionTarget;const T=globalThis.__chevyV6Three;
  const programs=new Set();
  try{
   if(transmission&&T){transmissionTarget=new T.WebGLRenderTarget(1,1);transmissionTarget.texture.colorSpace=T.LinearSRGBColorSpace;}
   function* compileBatches(){
    for(const variant of transmissionTarget?['transmission','destination']:['destination']){
     for(let start=0;start<objects.length;start+=8){
      validate();if(renderer.getContext().isContextLost())throw new Error('Contexto WebGL perdido durante preparación');
      for(const r of revisions.slice(start,start+8))if(r.node.geometry!==r.geometry||r.node.material!==r.material||(Array.isArray(r.material)&&r.material.some((m,i)=>m!==r.materials[i])))throw new DOMException('La escena cambió durante la preparación','AbortError');
      const previous=rendererState(renderer);
      try{
       restore(renderer,state);if(variant==='transmission'){renderer.setRenderTarget(transmissionTarget);renderer.toneMapping=0;}
       // compile() in Three r180 does not initialize WebGLClipping.
       renderer.autoClear=false;renderer.info.autoReset=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
       renderer.render(empty,captureCamera);
       const end=Math.min(objects.length,start+8),view={traverse(fn){for(let i=start;i<end;i++)fn(objects[i]);},traverseVisible(){}};
       renderer.compile(view,captureCamera,capture);
       // The transmission prepass draws the back of opaque double-sided glass.
       if(variant==='transmission')for(let i=start;i<end;i++){
        const node=objects[i];for(const material of Array.isArray(node.material)?node.material:[node.material])if(material.transmission>0&&material.side===2){
         const side=material.side;try{material.side=1;renderer.compile({traverse:fn=>fn(node),traverseVisible(){}},captureCamera,capture);}finally{material.side=side;}
        }
       }
       for(const program of renderer.info.programs||[])programs.add(program);
      }finally{restore(renderer,previous);}
      yield;
     }
    }
   }
   let deadline=performance.now()+6;
   for(const unused of compileBatches()){
    // Bound compiler pressure too: hundreds of concurrent ANGLE jobs can
    // starve the browser even after the JavaScript submission has yielded.
    const pending=[...programs].filter(program=>!program.isReady());
    if(pending.length>=12)while(pending.some(program=>!program.isReady())){validate();await waitForAnimationFrame(active);}
    if(performance.now()>=deadline){await yieldToMain();deadline=performance.now()+6;}
   }
   auditPreparation(renderer,capture,captureCamera);auditProgramOwners(renderer,objects);
   for(;;){validate();if(renderer.getContext().isContextLost())throw new Error('Contexto WebGL perdido durante preparación');
    const retained=new Set(renderer.info.programs||[]);if([...programs].every(program=>!retained.has(program)||program.isReady()))return;
    await waitForAnimationFrame(active);
   }
  }finally{transmissionTarget?.dispose();}
 },{signal,timeoutMs,label:'Preparación de shaders'}).finally(()=>{for(const resource of resources)resource?.removeEventListener('dispose',invalidate);});
}
