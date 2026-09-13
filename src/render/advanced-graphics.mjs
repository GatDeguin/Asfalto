import {createAdvancedMaterials}from'./advanced-materials.mjs';
import {createPivotPainter}from'./pivot-painter.mjs?v=phone-r3-20260913';
import {createDistanceFieldOcclusion}from'./distance-field-occlusion.mjs';
import {createPhysicalAtmosphere}from'./physical-atmosphere.mjs';
import {createScreenSpaceLighting,screenLightingPolicy}from'./screen-space-lighting.mjs?v=phone-r6-20260913';
import {readAdvancedGraphics,normalizeAdvancedGraphics,effectiveGraphicsQuality}from'./advanced-graphics-settings.mjs';
import {setSurfaceReliefPDO,surfaceReliefDiagnostics}from'../tracks/visuals/surface-relief.mjs';
export function createAdvancedGraphics(T,{renderer,scene,camera,scope='world',getEnvironment=()=>({}),getQuality=()=> 'high',allowPivotPainter=true,samples=2,onRenderStage=null}={}){
 let settings=readAdvancedGraphics(),quality=effectiveGraphicsQuality(settings,getQuality()),disposed=false,lastRefresh=-10,lastSignature='',lastField=-10,frames=0;
 const pivot=createPivotPainter(T,{root:scene,quality,enabled:allowPivotPainter});pivot.refresh();const materials=createAdvancedMaterials(T,{root:scene,scope,quality}),field=createDistanceFieldOcclusion(T,{scene}),atmosphere=createPhysicalAtmosphere(T,{scene,scope,quality}),post=createScreenSpaceLighting(T,{renderer,scene,camera,distanceField:field,atmosphere,quality,samples,onStage:onRenderStage});
 function configure(){
  quality=effectiveGraphicsQuality(settings,getQuality());const budget=screenLightingPolicy(quality);
  materials.setQuality(settings.materials?quality:'off');pivot.setQuality(settings.pivotPainter?quality:'off');field.setQuality(settings.dfao?quality:'off');
  atmosphere.setQuality(settings.volumetrics||settings.sky?quality:'off');post.setQuality(quality);post.setFeatures(settings);
  setSurfaceReliefPDO(settings.pdo&&quality!=='off'&&quality!=='low');
  return budget;
 }
 function refresh(){if(disposed)return;pivot.refresh();materials.refresh();field.refresh({camera});lastSignature=[scene.children.length,renderer.info.memory.geometries].join(':');}
 function setSettings(value){settings=normalizeAdvancedGraphics(value);configure();}
 const change=event=>setSettings(event.detail||{});globalThis.addEventListener?.('asfalto:advanced-graphics',change);configure();refresh();
 return{
  refresh,setSettings,getEffectiveQuality:()=>quality,
  update({time=0,environment=getEnvironment()}={}){
   if(disposed)return;const next=effectiveGraphicsQuality(settings,getQuality());if(next!==quality)configure();setSurfaceReliefPDO(settings.pdo&&quality!=='off'&&quality!=='low');
   const signature=[scene.children.length,renderer.info.memory.geometries].join(':');if(time-lastRefresh>2||(time-lastRefresh>1&&signature!==lastSignature)){refresh();lastRefresh=time;}
   const sunDirection=environment.keyLightDirection||environment.sunDirection,sunColor=environment.keyLightColor||environment.sunColor;
   materials.update({time,sunDirection,sunColor,sunIntensity:environment.sunIntensity??2.5});
   pivot.update({time,windDirection:environment.wind?.direction||[.8,.4],windSpeed:environment.wind?.speedMps??environment.windSpeed??(environment.weather==='storm'?7:environment.weather==='rain'?3.5:1.2)});
   atmosphere.update({camera,time,environment,skyId:environment.skyId,sunDirection,sunColor});
   if(!settings.sky||quality==='off')atmosphere.sky.visible=false;
   atmosphere.uniforms.anAtmoEnabled.value=settings.volumetrics&&screenLightingPolicy(quality).volume?1:0;
   if(settings.dfao&&screenLightingPolicy(quality).dfao&&time-lastField>.6){field.refresh({camera});lastField=time;}
   frames++;
  },
  render(draw=()=>renderer.render(scene,camera)){post.render(draw);},
  diagnostics:()=>({scope,settings:{...settings},effectiveQuality:quality,frames,materials:materials.diagnostics(),pivotPainter:pivot.diagnostics(),dfao:field.diagnostics(),atmosphere:atmosphere.diagnostics(),screenSpace:post.diagnostics(),pdo:surfaceReliefDiagnostics(),disposed}),
  dispose(){if(disposed)return;disposed=true;globalThis.removeEventListener?.('asfalto:advanced-graphics',change);post.dispose();materials.dispose();pivot.dispose();field.dispose();atmosphere.dispose();}
 };
}
