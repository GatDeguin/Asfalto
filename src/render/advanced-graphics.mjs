import {createWorkshopRenderBudget} from './workshop-render-budget.mjs';
import {createTextureFiltering} from './texture-filtering.mjs';
import {createTrackPerformanceGovernor,maximumTierForGraphicsQuality} from '../performance/track-performance-governor.mjs';
import {GRAPHICS_QUALITY_LABELS} from './graphics-quality-policy.mjs';
import {createAdvancedMaterials}from'./advanced-materials.mjs?v=balance-20260917';
import {createPivotPainter}from'./pivot-painter.mjs?v=balance-20260917';
import {createDistanceFieldOcclusion}from'./distance-field-occlusion.mjs';
import {createPhysicalAtmosphere}from'./physical-atmosphere.mjs';
import {createScreenSpaceLighting,screenLightingPolicy}from'./screen-space-lighting.mjs?v=balance-20260917';
import {readAdvancedGraphics,normalizeAdvancedGraphics,effectiveGraphicsQuality}from'./advanced-graphics-settings.mjs';
import {setSurfaceReliefPDO,surfaceReliefDiagnostics}from'../tracks/visuals/surface-relief.mjs';
export function createAdvancedGraphics(T,{renderer,scene,camera,scope='world',getEnvironment=()=>({}),getQuality=null,getMaximumQuality=()=> 'auto',getQualityDiagnostics=()=>null,allowPivotPainter=true,phone=false,samples=2,onRenderStage=null}={}){
 let settings=readAdvancedGraphics(),disposed=false,lastRefresh=-10,lastSignature='',lastField=-10,frames=0;
 // Reuse the same governor for the workshop's own frame intervals. Never feed
 // animation-clamped dt or synthetic FPS into it; the race keeps its existing owner.
 let workshopBudget=null;
 const maximum=()=>maximumTierForGraphicsQuality(getMaximumQuality(),settings.quality);
 const performanceGovernor=scope==='workshop'&&!getQuality?createTrackPerformanceGovernor({initialTier:maximum(),maximumTier:maximum(),onTierChange:({tier})=>workshopBudget?.setTier(tier)}):null;
 const governed=()=>getQuality?.()??performanceGovernor?.tier()??'high';
 if(performanceGovernor){workshopBudget=createWorkshopRenderBudget(T,{renderer,scene,phone});workshopBudget.setTier(governed());}
 let quality=effectiveGraphicsQuality(settings,governed()),frameTime=null,lastFrameTime=null,pendingFrame=false,lastLimitCheck=-Infinity;
 const filtering=createTextureFiltering(T,{root:scene,renderer,quality});
 const pivot=createPivotPainter(T,{root:scene,quality,enabled:allowPivotPainter});pivot.refresh();const materials=createAdvancedMaterials(T,{root:scene,scope,quality}),field=createDistanceFieldOcclusion(T,{scene}),atmosphere=createPhysicalAtmosphere(T,{scene,scope,quality}),post=createScreenSpaceLighting(T,{renderer,scene,camera,distanceField:field,atmosphere,quality,phone,samples,onStage:onRenderStage});
 function configure(){
  performanceGovernor?.setMaximumTier(maximum());quality=effectiveGraphicsQuality(settings,governed());filtering.setQuality(quality);const budget=screenLightingPolicy(quality);
  materials.setQuality(settings.materials?quality:'off');pivot.setQuality(settings.pivotPainter?quality:'off');field.setQuality(settings.dfao?quality:'off');
  atmosphere.setQuality(settings.volumetrics||settings.sky?quality:'off');post.setQuality(quality);post.setFeatures(settings);
  setSurfaceReliefPDO(settings.pdo&&quality!=='off'&&quality!=='low');
  return budget;
 }
 function refresh(){if(disposed)return;pivot.refresh();materials.refresh();filtering.refresh();if(settings.dfao&&screenLightingPolicy(quality).dfao){field.refresh({camera});lastField=lastRefresh;}lastSignature=[scene.children.length,renderer.info.memory.geometries].join(':');}
 function setSettings(value){if(disposed)return;settings=normalizeAdvancedGraphics(value);configure();}
 const change=event=>setSettings(event.detail||{});globalThis.addEventListener?.('asfalto:advanced-graphics',change);configure();refresh();
 return{
  refresh,setSettings,getEffectiveQuality:()=>quality,getGovernedQuality:()=>governed(),applyRendererPolicy:value=>workshopBudget?.resize(value),
  beginFrameWindow(){lastFrameTime=null;pendingFrame=false;return performanceGovernor?.beginWindow('workshop-visible');},
  update({time=0,environment=getEnvironment()}={}){
   if(disposed)return;
   if(performanceGovernor){frameTime=time*1000;pendingFrame=true;if(time<lastLimitCheck||time-lastLimitCheck>.5){performanceGovernor.setMaximumTier(maximum());lastLimitCheck=time;}}
   const next=effectiveGraphicsQuality(settings,governed());if(next!==quality)configure();setSurfaceReliefPDO(settings.pdo&&quality!=='off'&&quality!=='low');
   const signature=[scene.children.length,renderer.info.memory.geometries].join(':');if(time-lastRefresh>2||(time-lastRefresh>1&&signature!==lastSignature)){lastRefresh=time;refresh();}
   const sunDirection=environment.keyLightDirection||environment.sunDirection,sunColor=environment.keyLightColor||environment.sunColor;
   materials.update({time,sunDirection,sunColor,sunIntensity:environment.sunIntensity??2.5,sunVisibility:environment.sunVisibility});
   pivot.update({time,windDirection:environment.wind?.direction||[.8,.4],windSpeed:environment.wind?.speedMps??environment.windSpeed??(environment.weather==='storm'?7:environment.weather==='rain'?3.5:1.2)});
   atmosphere.update({camera,time,environment,skyId:environment.skyId,sunDirection,sunColor});
   if(!settings.sky||quality==='off')atmosphere.sky.visible=false;
   atmosphere.uniforms.anAtmoEnabled.value=settings.volumetrics&&screenLightingPolicy(quality).volume?1:0;
   if(settings.dfao&&screenLightingPolicy(quality).dfao&&time-lastField>.6){field.refresh({camera});lastField=time;}
   frames++;
  },
  render(draw=()=>renderer.render(scene,camera)){
   const started=performance.now();try{post.render(draw);}finally{
    if(performanceGovernor&&pendingFrame&&!disposed){
     const interval=lastFrameTime===null?0:frameTime-lastFrameTime;
     if(interval>0)performanceGovernor.sample({frameMs:interval,frameWorkMs:Math.max(0,performance.now()-started),heapBytes:performance.memory?.usedJSHeapSize||0,gpuTextures:renderer.info.memory.textures||0,gpuGeometries:renderer.info.memory.geometries||0,targetFps:60});
     else performanceGovernor.beginWindow('workshop-visible');
     lastFrameTime=frameTime;pendingFrame=false;
    }
   }
  },
  diagnostics:()=>({scope,settings:{...settings},requestedQuality:settings.quality,effectiveQuality:quality,governedQuality:governed(),reductionReason:quality!==settings.quality&&settings.quality!=='auto'?'Limitado a '+GRAPHICS_QUALITY_LABELS[quality]+' por el presupuesto gráfico':null,performance:performanceGovernor?.diagnostics()||getQualityDiagnostics(),rendererPolicy:workshopBudget?.diagnostics()||null,measurementScope:performanceGovernor?'workshop frame intervals; advanced render CPU submission only':'race governor',filtering:filtering.diagnostics(),frames,materials:materials.diagnostics(),pivotPainter:pivot.diagnostics(),dfao:field.diagnostics(),atmosphere:atmosphere.diagnostics(),screenSpace:post.diagnostics(),pdo:surfaceReliefDiagnostics(),disposed}),
  dispose(){if(disposed)return;disposed=true;globalThis.removeEventListener?.('asfalto:advanced-graphics',change);post.dispose();workshopBudget?.dispose();filtering.dispose();materials.dispose();pivot.dispose();field.dispose();atmosphere.dispose();}
 };
}
