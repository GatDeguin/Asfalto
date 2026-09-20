import {collectRayGeometry} from './ray-geometry.mjs?v=d2ec3723f8cda231';
export const RAY_TRACING_PRESETS=Object.freeze({off:null,balanced:Object.freeze({rays:2,radius:16,distance:1.25,triangles:8000,strength:.55}),high:Object.freeze({rays:4,radius:24,distance:2,triangles:24000,strength:.62})});
export const RAY_TRACING_STORAGE_KEY='asfalto:nacional:v6:ray-tracing';
const fragment=String.raw`
uniform sampler2D anRtNodes;
uniform sampler2D anRtTriangles;
uniform vec2 anRtNodeSize,anRtTriangleSize;
uniform vec3 anRtOrigin,anRtEye;
uniform float anRtEnabled,anRtCount,anRtRadius,anRtDistance,anRtRays,anRtStrength;
varying vec3 anRtWorldPosition;
vec4 anRtRead(sampler2D data,vec2 size,float index){return texture2D(data,(vec2(mod(index,size.x),floor(index/size.x))+.5)/size);}
float anRtTrace(vec3 origin,vec3 direction){
 vec3 invDir=1.0/(sign(direction+vec3(1e-12))*max(abs(direction),vec3(1e-8)));
 float node=0.0,nearest=anRtDistance;
 for(int visit=0;visit<2048;visit++){
  if(node>=anRtCount)break;
  vec4 lo=anRtRead(anRtNodes,anRtNodeSize,node*2.0),hi=anRtRead(anRtNodes,anRtNodeSize,node*2.0+1.0);
  vec3 v0=(lo.xyz-origin)*invDir,v1=(hi.xyz-origin)*invDir,nearV=min(v0,v1),farV=max(v0,v1);
  if(min(nearest,min(farV.x,min(farV.y,farV.z)))<max(0.0,max(nearV.x,max(nearV.y,nearV.z)))){node=hi.w;continue;}
  if(lo.w<0.0){node+=1.0;continue;}
  float first=floor(lo.w/8.0),count=mod(lo.w,8.0);
  for(int j=0;j<4;j++){
   if(float(j)>=count)break;
   float i=(first+float(j))*3.0;
   vec3 a=anRtRead(anRtTriangles,anRtTriangleSize,i).xyz,e1=anRtRead(anRtTriangles,anRtTriangleSize,i+1.0).xyz,e2=anRtRead(anRtTriangles,anRtTriangleSize,i+2.0).xyz;
   vec3 p=cross(direction,e2);float det=dot(e1,p);if(abs(det)<1e-8)continue;
   vec3 v=origin-a;float u=dot(v,p)/det;if(u<0.0||u>1.0)continue;
   vec3 q=cross(v,e1);float w=dot(direction,q)/det;if(w<0.0||u+w>1.0)continue;
   float distance=dot(e2,q)/det;if(distance>.003&&distance<nearest){nearest=distance;if(nearest<.035)return nearest;}
  }node+=1.0;
 }
 return nearest;
}
float anRtAmbient(vec3 normalWorld){
 if(anRtEnabled<.001||anRtCount<.5)return 1.0;
 float cameraDistance=distance(anRtWorldPosition,anRtEye);
 if(cameraDistance>anRtRadius-3.0||distance(anRtWorldPosition,anRtOrigin)>anRtRadius-2.8)return 1.0;
 vec3 n=normalize(normalWorld),t=normalize(cross(abs(n.y)<.95?vec3(0,1,0):vec3(1,0,0),n)),b=cross(n,t);
 vec3 origin=anRtWorldPosition-anRtOrigin+n*.009;
 // Deterministic hemisphere directions avoid crawling noise without a temporal buffer.
 float angle=.7548777,blocked=0.0;
 for(int i=0;i<4;i++){
  if(float(i)>=anRtRays)break;
  float u=(float(i)+.5)/anRtRays,phi=angle+float(i)*2.3999632;
  vec3 direction=normalize(n*sqrt(1.0-u)+(t*cos(phi)+b*sin(phi))*sqrt(u));
  blocked+=1.0-smoothstep(.02,anRtDistance,anRtTrace(origin,direction));
 }
 float fade=1.0-smoothstep(anRtRadius-9.0,anRtRadius-3.0,cameraDistance);
 return 1.0-anRtStrength*anRtEnabled*fade*blocked/anRtRays;
}
`;
const positionCode=`
vec4 anRtPosition=vec4(transformed,1.0);
#ifdef USE_BATCHING
 anRtPosition=batchingMatrix*anRtPosition;
#endif
#ifdef USE_INSTANCING
 anRtPosition=instanceMatrix*anRtPosition;
#endif
anRtWorldPosition=(modelMatrix*anRtPosition).xyz;
`;
export function createRayTracedOcclusion({THREE:T,renderer,scene,camera,excludeRoots=()=>[],excludeOccluders=()=>[],mode='off',workerFactory=()=>new Worker(new URL('./ray-bvh-worker.mjs?v=cac3c9c2092433b4',import.meta.url),{type:'module'})}={}) {
 const supported=Boolean(renderer?.capabilities?.isWebGL2&&renderer.capabilities.maxTextures>=12),patches=new Map(),eye=new T.Vector3(),lastCenter=new T.Vector3(Infinity,Infinity,Infinity);
 const uniforms={anRtNodes:{value:null},anRtTriangles:{value:null},anRtNodeSize:{value:new T.Vector2(1,1)},anRtTriangleSize:{value:new T.Vector2(1,1)},anRtOrigin:{value:new T.Vector3()},anRtEye:{value:eye},anRtEnabled:{value:0},anRtCount:{value:0},anRtRadius:{value:28},anRtDistance:{value:1.8},anRtRays:{value:2},anRtStrength:{value:.62}};
 let requested='off',status='off',worker=null,job=0,abort=null,pending=false,disposed=false,key=null,lastBuild=0,buildMs=0,collectMs=0,triangleCount=0,budgetReached=false,rebuilds=0,textureBytes=0,error=null,restoreMode='off',lastActive=0;
 function restoreMaterials(){for(const [material,p]of patches){if(material.onBeforeCompile===p.hook){material.onBeforeCompile=p.original;material.customProgramCacheKey=p.originalKey;material.needsUpdate=true;}}patches.clear();}
 function drop(){job++;abort?.abort();abort=null;worker?.terminate();worker=null;pending=false;uniforms.anRtEnabled.value=0;uniforms.anRtCount.value=0;for(const name of ['anRtNodes','anRtTriangles']){uniforms[name].value?.dispose();uniforms[name].value=null;}triangleCount=0;textureBytes=0;restoreMaterials();lastCenter.set(Infinity,Infinity,Infinity);}
 function setMode(next){if(disposed)return false;if(!Object.hasOwn(RAY_TRACING_PRESETS,next))return false;if(next===requested)return true;drop();requested=next;error=null;status=next==='off'?'off':supported?'preparing':'unsupported';if(supported&&next!=='off'){const preset=RAY_TRACING_PRESETS[next];uniforms.anRtRadius.value=preset.radius;uniforms.anRtDistance.value=preset.distance;uniforms.anRtRays.value=preset.rays;uniforms.anRtStrength.value=preset.strength;}return true;}
 function texture(data,sizeUniform){const pixels=Math.max(1,data.length/4),width=Math.min(renderer.capabilities.maxTextureSize,Math.max(1,Math.ceil(Math.sqrt(pixels)))),height=Math.ceil(pixels/width),padded=new Float32Array(width*height*4);padded.set(data);const tex=new T.DataTexture(padded,width,height,T.RGBAFormat,T.FloatType);tex.minFilter=tex.magFilter=T.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;sizeUniform.value.set(width,height);textureBytes+=padded.byteLength;return tex;}
 function patchMaterials(){const excluded=new Set(excludeRoots().filter(Boolean)),seen=new Set(),stack=[scene];while(stack.length){const node=stack.pop();if(excluded.has(node))continue;for(const child of node.children)stack.push(child);for(const material of node.material?Array.isArray(node.material)?node.material:[node.material]:[]){if(!material?.isMeshStandardMaterial||material.transparent||material.alphaTest>0)continue;seen.add(material);const prior=patches.get(material);if(prior&&material.onBeforeCompile===prior.hook)continue;
    const original=material.onBeforeCompile,originalKey=material.customProgramCacheKey,cache=originalKey.call(material);
    const hook=function(shader,render){original.call(this,shader,render);Object.assign(shader.uniforms,uniforms);if(shader.fragmentShader.includes('float anRtTrace('))return;shader.vertexShader='varying vec3 anRtWorldPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',positionCode+'\n#include <project_vertex>');shader.fragmentShader=fragment+'\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
      float anRtAO=anRtAmbient(inverseTransformDirection(normal,viewMatrix));
      reflectedLight.indirectDiffuse*=anRtAO;
      reflectedLight.indirectSpecular*=mix(1.0,anRtAO,roughnessFactor*roughnessFactor);
    `);};
    patches.set(material,{original,originalKey,hook});material.onBeforeCompile=hook;material.customProgramCacheKey=()=>cache+'|asfalto-world-bvh-ao-v1';material.needsUpdate=true;
  }}for(const [m,p]of patches)if(!seen.has(m)){if(m.onBeforeCompile===p.hook){m.onBeforeCompile=p.original;m.customProgramCacheKey=p.originalKey;m.needsUpdate=true;}patches.delete(m);}}
 async function rebuild(now){if(pending)return;pending=true;const id=++job,controller=new AbortController();abort=controller;const preset=RAY_TRACING_PRESETS[requested],start=performance.now(),center=eye.clone();status='preparing';try{
   const snapshot=await collectRayGeometry(T,scene,center,{radius:preset.radius,maxTriangles:preset.triangles,excludeRoots:[...excludeRoots(),...excludeOccluders()],signal:controller.signal});if(disposed||id!==job)return;collectMs=performance.now()-start;
   worker??=workerFactory();worker.onerror=event=>{if(id!==job)return;error=event.message||'No se pudo construir el BVH';status='error';drop();};
   worker.onmessage=({data})=>{if(disposed||data.id!==job)return;if(data.error){error=data.error;status='error';drop();return;}textureBytes=0;const nodes=texture(data.bounds,uniforms.anRtNodeSize),triangles=texture(data.triangles,uniforms.anRtTriangleSize);uniforms.anRtNodes.value?.dispose();uniforms.anRtTriangles.value?.dispose();uniforms.anRtNodes.value=nodes;uniforms.anRtTriangles.value=triangles;uniforms.anRtCount.value=data.nodeCount;uniforms.anRtOrigin.value.copy(snapshot.origin);lastCenter.copy(snapshot.origin);triangleCount=data.triangleCount;budgetReached=snapshot.budgetReached;buildMs=data.buildMs;rebuilds++;pending=false;lastBuild=performance.now();patchMaterials();status=triangleCount?'active':'empty';};
   worker.postMessage({id,vertices:snapshot.vertices},[snapshot.vertices.buffer]);
 }catch(reason){if(reason.name==='AbortError'||id!==job)return;error=String(reason.message||reason);status='error';drop();}}
 function update({sceneKey=scene,active=true,now=performance.now()}={}){if(disposed||!supported||requested==='off'||status==='error'||status==='context-lost')return;if(!active){uniforms.anRtEnabled.value=0;return;}camera.getWorldPosition(eye);lastActive=now;if(key!==sceneKey){drop();key=sceneKey;status='preparing';lastBuild=0;}
   const radius=RAY_TRACING_PRESETS[requested].radius,distance=lastCenter.distanceTo(eye);uniforms.anRtEnabled.value=distance>radius-10?0:Math.min(1,uniforms.anRtEnabled.value+.09);
   if(!pending&&(distance>Math.min(8,radius*.35)||now-lastBuild>30000))void rebuild(now);
 }
 const onLost=()=>{restoreMode=requested;drop();status='context-lost';},onRestored=()=>{const next=restoreMode;requested='off';setMode(next);};renderer.domElement?.addEventListener('webglcontextlost',onLost);renderer.domElement?.addEventListener('webglcontextrestored',onRestored);
 setMode(mode);
 return{setMode,update,invalidate(){drop();status=requested==='off'?'off':'preparing';},diagnostics:()=>({requested,supported,status,effects:['ray-traced ambient occlusion'],hardwareRT:false,reflectionsRT:false,staticOpaqueGeometry:true,triangles:triangleCount,budgetReached,nodeCount:uniforms.anRtCount.value,raysPerShadedPixel:requested==='off'?0:RAY_TRACING_PRESETS[requested].rays,radiusM:uniforms.anRtRadius.value,textureBytes,materialCount:patches.size,workerActive:Boolean(worker),pending,rebuilds,buildMs,collectMs,lastActive,error}),dispose(){if(disposed)return false;drop();disposed=true;status='disposed';renderer.domElement?.removeEventListener('webglcontextlost',onLost);renderer.domElement?.removeEventListener('webglcontextrestored',onRestored);return true;}};
}
