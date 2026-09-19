// Test-only renderer contract; real Three objects and targets, no GPU/FPS claims.
import {THREE as T} from './cinematic-three.mjs';
export function allocationRenderer(width=640,height=360){
 let target=null,ratio=1,queries=0;const viewport=new T.Vector4(0,0,width,height),scissor=viewport.clone(),color=new T.Color();
 const gl={RENDERBUFFER:1,RGBA16F:2,DEPTH_COMPONENT24:3,SAMPLES:4,isContextLost:()=>false,getInternalformatParameter(){queries++;return [4,2];}};
 return {capabilities:{maxSamples:4,logarithmicDepthBuffer:false},domElement:{addEventListener(){},removeEventListener(){}},info:{autoReset:true,memory:{textures:0,geometries:0}},shadowMap:{enabled:true},autoClear:true,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1,
 get queries(){return queries;},getContext:()=>gl,getRenderTarget:()=>target,setRenderTarget:t=>target=t,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
 getPixelRatio:()=>ratio,setPixelRatio:r=>ratio=r,getSize:v=>v.set(width,height),setSize(w,h){width=w;height=h;},getDrawingBufferSize:v=>v.set(width*ratio,height*ratio),getViewport:v=>v.copy(viewport),getCurrentViewport:v=>v.copy(viewport),setViewport(v){if(v?.isVector4)viewport.copy(v);},getScissor:v=>v.copy(scissor),setScissor(v){if(v?.isVector4)scissor.copy(v);},getScissorTest:()=>false,setScissorTest(){},getClearColor:v=>v.copy(color),getClearAlpha:()=>1,setClearColor(){},clear(){},render(){},state:{viewport(){}}};
}
