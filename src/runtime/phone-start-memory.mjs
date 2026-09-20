import {phoneCockpitAssets} from './phone-cockpit-assets.mjs?v=66cbfc049865294f';
import {readDeferredPayload} from './workshop-bootstrap.mjs?v=2451a6adbe22e7d9';
export async function readPhoneCockpitPart(key,signal,read=readDeferredPayload){
 const entry=phoneCockpitAssets[key];if(!entry)throw new Error('Pieza móvil desconocida: '+key);
 if(signal?.aborted)throw signal.reason;
 return read({dataset:{externalUrl:new URL(entry.url,import.meta.url).href,bytes:String(entry.bytes),sha256:entry.sha256.toUpperCase()}},signal);
}
export async function releasePhoneWorkshopForRace(workshop,{signal,yieldFrame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}={}){
 if(!workshop?.deviceProfile?.phone)return false;
 if(signal?.aborted)throw signal.reason;
 workshop.memorySuspended=true;workshop.setActive(false);
 await workshop.loadingTask;
 await workshop.vehicleSelector?.whenSettled?.();
 if(signal?.aborted)throw signal.reason;
 const nodes=new Set();workshop.scene?.traverse(node=>nodes.add(node));
 const before={...workshop.renderer?.info?.memory};
 workshop.releaseScene();
 for(const key of Object.keys(workshop)){if(nodes.has(workshop[key]))workshop[key]=null;}
 globalThis.__asfaltoPhoneMemory={workshopReleased:true,before,phase:'loading-race'};
 await yieldFrame();if(signal?.aborted)throw signal.reason;return true;
}
