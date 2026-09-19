import {planMainRenderBudget} from './main-render-budget.mjs';
import {supportedHdrSamples} from './render-target-capabilities.mjs';
import {parseCubeLut,sampleCubeLut} from './cube-lut.mjs';

export const DEFAULT_COLOR_GRADE_SETTINGS=Object.freeze({lutId:'none',intensity:1,contrast:1,saturation:1,temperature:0,tint:0});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function normalizeColorGradeSettings(value={}){
 const number=(key,min,max)=>Number.isFinite(value[key])?clamp(value[key],min,max):DEFAULT_COLOR_GRADE_SETTINGS[key];
 return{lutId:typeof value.lutId==='string'&&value.lutId?value.lutId:'none',intensity:number('intensity',0,1),contrast:number('contrast',0,2),saturation:number('saturation',0,2),temperature:number('temperature',-1,1),tint:number('tint',-1,1)};
}
function neutral(s){return(s.lutId==='none'||s.intensity===0)&&s.contrast===1&&s.saturation===1&&s.temperature===0&&s.tint===0;}
/** CPU reference operates on display-sRGB values, after exposure and tone mapping. */
export function applyColorGradePixel(rgb,settings={},lut=null){
 const s=normalizeColorGradeSettings(settings);let c=[...rgb];
 if(lut&&s.intensity>0){const mapped=sampleCubeLut(lut,c);c=c.map((v,i)=>v+(mapped[i]-v)*s.intensity);}
 c=[c[0]*Math.exp(.18*s.temperature+.06*s.tint),c[1]*Math.exp(-.12*s.tint),c[2]*Math.exp(-.18*s.temperature+.06*s.tint)];
 const luma=c[0]*.2126+c[1]*.7152+c[2]*.0722;
 return c.map(v=>clamp(((luma+(v-luma)*s.saturation)-.5)*s.contrast+.5,0,1));
}

const vertexShader=`varying vec2 vGradeUv;
void main(){vGradeUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const fragmentShader=`
uniform sampler2D uScene;
uniform highp sampler3D uLut3D;
uniform sampler2D uLut1D;
uniform int uLutKind;
uniform float uLutSize,uIntensity,uContrast,uSaturation,uTemperature,uTint;
uniform vec3 uDomainMin,uDomainMax;
uniform int uToneMapping;
varying vec2 vGradeUv;
#include <tonemapping_pars_fragment>
vec3 mapHdr(vec3 c){
 if(uToneMapping==1)return LinearToneMapping(c);
 if(uToneMapping==2)return ReinhardToneMapping(c);
 if(uToneMapping==3)return CineonToneMapping(c);
 if(uToneMapping==4)return ACESFilmicToneMapping(c);
 if(uToneMapping==6)return AgXToneMapping(c);
 if(uToneMapping==7)return NeutralToneMapping(c);
 return c;
}
void main(){
 vec4 sceneColor=texture2D(uScene,vGradeUv);
 // Ordinary r180 render targets contain linear HDR, without per-material tone mapping.
 vec3 c=sRGBTransferOETF(vec4(mapHdr(sceneColor.rgb),sceneColor.a)).rgb;
 if(uLutKind>0&&uIntensity>0.){
  vec3 p=clamp((c-uDomainMin)/(uDomainMax-uDomainMin),0.,1.);
  p=(p*(uLutSize-1.)+.5)/uLutSize;
  vec3 mapped;
  if(uLutKind==3)mapped=texture(uLut3D,p).rgb;
  else mapped=vec3(texture2D(uLut1D,vec2(p.r,.5)).r,texture2D(uLut1D,vec2(p.g,.5)).g,texture2D(uLut1D,vec2(p.b,.5)).b);
  c=mix(c,mapped,uIntensity);
 }
 c*=exp(vec3(.18*uTemperature+.06*uTint,-.12*uTint,-.18*uTemperature+.06*uTint));
 float luma=dot(c,vec3(.2126,.7152,.0722));
 c=mix(vec3(luma),c,uSaturation);
 c=(c-.5)*uContrast+.5;
 // Already encoded for display. No second colorspace or tone-mapping chunk here.
 gl_FragColor=vec4(clamp(c,0.,1.),sceneColor.a);
}`;

/** World and cockpit must both be drawn inside the supplied synchronous callback. */
export function createRaceColorGrade({THREE:T,renderer,manifest:initialManifest=null,manifestUrl=new URL('../../assets/luts/manifest.json',import.meta.url),fetch:fetcher=globalThis.fetch,cacheLimit=3,samples=2,phone=false,getQuality=()=> 'high',onStage=null}={}){
 if(!T||!renderer)throw new TypeError('Color grade requires THREE and renderer');
 const limit=clamp(Math.floor(cacheLimit)||3,1,4),cache=new Map(),pending=new Map();
 let manifestPromise=initialManifest?Promise.resolve(initialManifest):null,requested={...DEFAULT_COLOR_GRADE_SETTINGS},settings={...requested},activeEntry=null,sequence=0,disposed=false,lastError=null,pass=null,rendering=false,renderCount=0;
 let requestedSamples=samples,acceptedSamples=supportedHdrSamples(renderer,samples),targetBudget=null;
 const contextRestored=()=>{releasePass();acceptedSamples=supportedHdrSamples(renderer,requestedSamples);};renderer.domElement?.addEventListener?.('webglcontextrestored',contextRestored);
 const size=new T.Vector2(),savedViewport=new T.Vector4();
 function releasePass(){if(!pass)return;pass.target.dispose();pass.geometry.dispose();pass.material.dispose();pass=null;}
 function evict(){for(const [id,entry]of cache){if(cache.size<=limit)break;if(entry===activeEntry)continue;entry.texture.dispose();cache.delete(id);}}
 function manifest(){
  if(!manifestPromise)manifestPromise=Promise.resolve(fetcher(manifestUrl)).then(async response=>{if(!response.ok)throw new Error('LUT manifest HTTP '+response.status);const value=await response.json();if(!Array.isArray(value.luts))throw new Error('Invalid LUT manifest');return value;}).catch(error=>{manifestPromise=null;throw error;});
  return manifestPromise;
 }
 function makeTexture(lut){
  const maximum=lut.kind==='3D'?renderer.capabilities?.max3DTextureSize:renderer.capabilities?.maxTextureSize;
  if(Number.isFinite(maximum)&&lut.size>maximum)throw new Error('LUT size exceeds GPU texture limit');
  const count=lut.data.length/3,data=new Uint16Array(count*4);
  for(let i=0;i<count;i++){for(let c=0;c<3;c++)data[i*4+c]=T.DataUtils.toHalfFloat(clamp(lut.data[i*3+c],-65504,65504));data[i*4+3]=T.DataUtils.toHalfFloat(1);}
  const texture=lut.kind==='3D'?new T.Data3DTexture(data,lut.size,lut.size,lut.size):new T.DataTexture(data,lut.size,1);
  texture.name='ASFALTO_COLOR_LUT';texture.type=T.HalfFloatType;texture.format=T.RGBAFormat;texture.colorSpace=T.NoColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.wrapS=texture.wrapT=texture.wrapR=T.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
 }
 async function load(id){
  if(cache.has(id)){const entry=cache.get(id);cache.delete(id);cache.set(id,entry);return entry;}
  if(pending.has(id))return pending.get(id).promise;
  const abort=new AbortController(),record={abort,promise:null};
  record.promise=(async()=>{
   const catalog=await manifest();if(disposed||abort.signal.aborted)return null;
   const descriptor=catalog.luts.find(entry=>entry.id===id);if(!descriptor)throw new Error('Unknown LUT: '+id);
   const response=await fetcher(new URL(descriptor.url,manifestUrl),{signal:abort.signal});if(!response.ok)throw new Error('LUT HTTP '+response.status);
   const text=await response.text();if(disposed||abort.signal.aborted)return null;const lut=parseCubeLut(text);
   if(lut.kind!==descriptor.kind||lut.size!==descriptor.size)throw new Error('LUT table does not match its manifest');
   const entry={id,lut,texture:makeTexture(lut),descriptor};cache.set(id,entry);return entry;
  })().finally(()=>{if(pending.get(id)===record)pending.delete(id);});
  pending.set(id,record);return record.promise;
 }
 function ensurePass(){
  const destination=renderer.getRenderTarget();if(destination)size.set(destination.width,destination.height);else renderer.getDrawingBufferSize(size);targetBudget=planMainRenderBudget({width:size.x,height:size.y,quality:getQuality(),phone,samples:acceptedSamples,maxTextureSize:renderer.capabilities?.maxTextureSize});const {width,height}=targetBudget;
  if(pass){if(pass.target.width!==width||pass.target.height!==height)pass.target.setSize(width,height);return;}
  const target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,format:T.RGBAFormat,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,stencilBuffer:false});
  target.texture.name='ASFALTO_COLOR_HDR';target.texture.colorSpace=T.LinearSRGBColorSpace;target.samples=acceptedSamples;
  const uniforms={uScene:{value:target.texture},uLut3D:{value:null},uLut1D:{value:null},uLutKind:{value:0},uLutSize:{value:2},uIntensity:{value:0},uContrast:{value:1},uSaturation:{value:1},uTemperature:{value:0},uTint:{value:0},uDomainMin:{value:new T.Vector3()},uDomainMax:{value:new T.Vector3(1,1,1)},uToneMapping:{value:0},toneMappingExposure:{value:1}};
  const material=new T.ShaderMaterial({name:'ASFALTO_COLOR_GRADE',uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false,blending:T.NoBlending});
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const quad=new T.Mesh(geometry,material);quad.frustumCulled=false;const scene=new T.Scene();scene.add(quad);pass={target,geometry,material,scene,camera:new T.Camera()};
 }
 return{
  setSamples(value){const next=Math.max(0,Math.min(8,Math.floor(Number(value)||0)));if(next===requestedSamples)return;requestedSamples=next;acceptedSamples=supportedHdrSamples(renderer,next);if(pass&&pass.target.samples!==acceptedSamples)releasePass();},
  async setSettings(value={}){
   if(disposed)return{applied:false,stale:true};const ticket=++sequence;requested=normalizeColorGradeSettings({...requested,...value});const next={...requested};lastError=null;
   for(const [id,record]of pending)if(id!==next.lutId){pending.delete(id);record.abort.abort();}
   try{
    const entry=next.lutId==='none'||next.intensity===0?null:await load(next.lutId);
    if(disposed||ticket!==sequence){evict();return{applied:false,stale:true};}
    activeEntry=entry;settings=next;evict();if(neutral(settings))releasePass();return{applied:true,settings:{...settings}};
   }catch(error){
    if(disposed||ticket!==sequence)return{applied:false,stale:true};lastError=error.message;evict();throw error;
   }
  },
  render(drawSceneCallback){
   if(typeof drawSceneCallback!=='function')throw new TypeError('Color grade draw callback is required');
   if(disposed||neutral(settings)){drawSceneCallback({linearOutput:false});return;}
   if(rendering)throw new Error('Color grade cannot render recursively');rendering=true;
   const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace?.()??0,oldMip=renderer.getActiveMipmapLevel?.()??0,oldScissor=renderer.getScissorTest(),oldAutoClear=renderer.autoClear,oldInfoAutoReset=renderer.info?.autoReset;
   renderer.getCurrentViewport?.(savedViewport);
   try{
    onStage?.('Primer cuadro: buffer HDR de color');ensurePass();const u=pass.material.uniforms;
    u.uToneMapping.value=renderer.toneMapping;u.toneMappingExposure.value=renderer.toneMappingExposure;
    u.uLutKind.value=activeEntry?(activeEntry.lut.kind==='3D'?3:1):0;
    u.uLut3D.value=activeEntry?.lut.kind==='3D'?activeEntry.texture:null;u.uLut1D.value=activeEntry?.lut.kind==='1D'?activeEntry.texture:null;
    if(activeEntry){u.uLutSize.value=activeEntry.lut.size;u.uDomainMin.value.fromArray(activeEntry.lut.domainMin);u.uDomainMax.value.fromArray(activeEntry.lut.domainMax);}
    for(const key of ['intensity','contrast','saturation','temperature','tint'])u['u'+key[0].toUpperCase()+key.slice(1)].value=settings[key];
    renderer.setRenderTarget(pass.target);renderer.setScissorTest(false);renderer.clear(true,true,true);drawSceneCallback({linearOutput:true});
    renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setScissorTest(oldScissor);renderer.autoClear=false;if(renderer.info)renderer.info.autoReset=false;
    onStage?.('Primer cuadro: composición de color');renderer.render(pass.scene,pass.camera);renderCount++;
   }finally{
    renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.setScissorTest(oldScissor);renderer.autoClear=oldAutoClear;if(renderer.info)renderer.info.autoReset=oldInfoAutoReset;
    // Preserve a caller's camera viewport as well as its target and global viewport settings.
    if(renderer.getCurrentViewport&&renderer.state?.viewport)renderer.state.viewport(savedViewport);
    rendering=false;
   }
  },
  diagnostics:()=>({mainRenderBudget:targetBudget,disposed,settings:{...settings},requestedSettings:{...requested},activeLut:activeEntry?.id??'none',requestedSamples,cachedLuts:cache.size,pendingLoads:pending.size,cacheLimit:limit,renderTargetAllocated:!!pass,samples:pass?.target.samples??null,renderTargetSize:pass?[pass.target.width,pass.target.height]:null,renderCount,lastError,pipeline:'linear HDR -> renderer tone mapping -> display sRGB -> LUT -> parameters',sourceFilesModified:false}),
  dispose(){if(disposed)return;disposed=true;renderer.domElement?.removeEventListener?.('webglcontextrestored',contextRestored);sequence++;for(const record of pending.values())record.abort.abort();pending.clear();activeEntry=null;for(const entry of cache.values())entry.texture.dispose();cache.clear();releasePass();},
 };
}
