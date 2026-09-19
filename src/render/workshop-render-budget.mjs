import {TRACK_RENDER_POLICIES} from '../performance/track-performance-governor.mjs';
import {planMainRenderBudget} from './main-render-budget.mjs';

/** One owner for the workshop drawing buffer. Never feeds a scaled DPR back into
 * its own baseline; close vehicle geometry and contact shadows remain available. */
export function createWorkshopRenderBudget(T,{renderer,scene,phone=false}={}) {
  const size=new T.Vector2(),physical=new T.Vector2();
  const originalRatio=renderer.getPixelRatio?.()||1;
  renderer.getSize?.(size);
  if(!size.x||!size.y){renderer.getDrawingBufferSize?.(size);size.divideScalar(originalRatio);}
  let width=Math.max(1,size.x||640),height=Math.max(1,size.y||360),preferredRatio=originalRatio;
  let tier='high',disposed=false,last=null,signature='';
  const shadows=new Map();
  function apply() {
    if(disposed)return last;
    const policy=TRACK_RENDER_POLICIES[tier]||TRACK_RENDER_POLICIES.high;
    const budget=planMainRenderBudget({width,height,pixelRatio:preferredRatio*policy.resolutionScale,quality:tier,phone,samples:phone?0:tier==='cinematic'?4:2,maxTextureSize:renderer.capabilities?.maxTextureSize});
    const next=[width,height,budget.pixelRatio].join(':');
    if(next!==signature){
      if(renderer.getPixelRatio?.()!==budget.pixelRatio)renderer.setPixelRatio?.(budget.pixelRatio);
      renderer.setSize?.(width,height,false);signature=next;
    }
    // Keep the car's contact shadows. Reduce resolution instead of disabling all shadows.
    const shadowLimit=tier==='low'?1024:2048;
    scene?.traverse?.(object=>{
      if(!object.isLight||!object.castShadow||!object.shadow?.mapSize)return;
      if(!shadows.has(object))shadows.set(object,object.shadow.mapSize.clone());
      const authored=shadows.get(object),w=Math.min(authored.x,shadowLimit),h=Math.min(authored.y,shadowLimit);
      if(object.shadow.mapSize.x!==w||object.shadow.mapSize.y!==h){
        object.shadow.mapSize.set(w,h);object.shadow.map?.dispose();object.shadow.map=null;
        object.shadow.mapPass?.dispose();object.shadow.mapPass=null;
        object.shadow.needsUpdate=true;if(renderer.shadowMap)renderer.shadowMap.needsUpdate=true;
      }
    });
    renderer.getDrawingBufferSize?.(physical);
    last={tier,resolutionScale:policy.resolutionScale,preferredPixelRatio:preferredRatio,pixelRatio:renderer.getPixelRatio?.()??budget.pixelRatio,
      drawingBuffer:renderer.getDrawingBufferSize?[physical.x,physical.y]:null,
      applied:typeof renderer.setPixelRatio==='function'&&typeof renderer.setSize==='function',
      shadowsEnabled:renderer.shadowMap?.enabled??null,contactShadowsPreserved:true,shadowLimit,budget};
    return last;
  }
  return {
    setTier(value){tier=Object.hasOwn(TRACK_RENDER_POLICIES,value)?value:'high';return apply();},
    resize(value={}){if(Number.isFinite(value.width)&&value.width>0)width=value.width;if(Number.isFinite(value.height)&&value.height>0)height=value.height;if(Number.isFinite(value.pixelRatio)&&value.pixelRatio>0)preferredRatio=value.pixelRatio;return apply();},
    diagnostics:()=>last,
    dispose(){if(disposed)return;disposed=true;for(const [light,authored]of shadows){if(!light.shadow.mapSize.equals(authored)){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapPass?.dispose();light.shadow.mapPass=null;light.shadow.mapSize.copy(authored);light.shadow.needsUpdate=true;}}shadows.clear();renderer.setPixelRatio?.(originalRatio);},
  };
}
