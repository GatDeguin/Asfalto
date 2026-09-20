import assert from 'node:assert/strict';

// Sample the central scene, outside corner HUDs, after a real browser screenshot.
export async function inspectFrame(page,png){
 return page.evaluate(async base64=>{
  const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
  const c=document.createElement('canvas');c.width=64;c.height=36;
  c.getContext('2d').drawImage(image,image.width*.22,image.height*.2,image.width*.56,image.height*.55,0,0,64,36);
  const pixels=c.getContext('2d').getImageData(0,0,64,36).data;
  let min=255,max=0,sum=0,squared=0;const colors=new Set();
  for(let i=0;i<pixels.length;i+=4){const v=(pixels[i]+pixels[i+1]+pixels[i+2])/3;min=Math.min(min,v);max=Math.max(max,v);sum+=v;squared+=v*v;colors.add((pixels[i]>>4)*256+(pixels[i+1]>>4)*16+(pixels[i+2]>>4));}
  const mean=sum/(pixels.length/4);return{min,max,mean,variance:squared/(pixels.length/4)-mean*mean,colors:colors.size};
 },png.toString('base64'));
}
export function assertVisibleFrame(frame){assert(frame.colors>8&&frame.max-frame.min>18&&frame.variance>12,'Scene is blank or covered: '+JSON.stringify(frame));}
export function assertMovement(cycle){const a=cycle.before.position,b=cycle.motion.position;assert(a?.length===3&&b?.length===3,'No physical chassis snapshot');const distance=Math.hypot(...b.map((v,i)=>v-a[i]));assert(distance>2,'Vehicle did not move under player input: '+distance);cycle.distanceM=distance;}
export function assertStability(report,{maxTaskMs=2500,maxPrepareMs=240000,heapGrowthMB=35}={}){
 assert.deepEqual(report.errors,[],'Unexpected JavaScript/console errors');assert.deepEqual(report.httpErrors,[],'HTTP errors');
 const final=report.checkpoints.at(-1).audit;assert.deepEqual(final.errors,[],'Unhandled browser rejection');assert(!final.contextLosses.some(c=>!c.requested),'Unexpected WebGL context loss');
 for(const cycle of report.cycles){assertMovement(cycle);assertVisibleFrame(cycle.visual);assert(cycle.prepareMs<maxPrepareMs,'Preparation exceeded measured budget');}
 assert(Math.max(0,...final.longTasks.map(t=>t.ms))<maxTaskMs,'Main-thread freeze budget exceeded');
 for(const c of report.checkpoints.filter(c=>c.name.startsWith('returned-'))){assert(c.audit.pendingRaf<=1,'Duplicate persistent RAF');assert(c.audit.audio.filter(a=>a.state!=='closed').length<=2,'Accumulating audio contexts');}
 // Compare like with like: different tracks have intentionally different budgets.
 const groups=new Map();for(const cycle of report.cycles){const c=report.checkpoints.find(c=>c.name==='returned-'+cycle.i);if(!groups.has(cycle.track))groups.set(cycle.track,[]);groups.get(cycle.track).push(c);}
 for(const [track,returns]of groups){if(returns.length<3)continue;const heap=returns.map(c=>c.metrics.JSHeapUsedSize);assert(heap.at(-1)-heap[0]<heapGrowthMB*1e6,'Retained heap growth on '+track);const gl=returns.map(c=>c.audit.gl.reduce((n,g)=>n+(g.resources.Buffer?.live||0),0));assert(gl.at(-1)-gl[0]<Math.max(120,gl[0]*.05),'GPU buffer growth on '+track+': '+gl);for(const initial of returns[0].audit.gl){const final=returns.at(-1).audit.gl.find(g=>g.id===initial.id);if(!final)continue;for(const [kind,budget]of [['Texture',8],['Program',16],['Framebuffer',2],['Renderbuffer',4]]){const first=initial.resources[kind]?.live||0,last=final.resources[kind]?.live||0;assert(last-first<=budget,kind+' growth in context '+initial.id+': '+first+'→'+last);}}const listeners=returns.map(c=>c.dom.jsEventListeners);assert(listeners.at(-1)<=listeners[0]+10,'Retained listeners on '+track);}
}
