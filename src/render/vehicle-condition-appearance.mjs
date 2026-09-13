// Appearance consumes saved physical condition; it never awards or repairs state.
const clamp=(v,a=0,b=100,f=b)=>Number.isFinite(v)?Math.min(b,Math.max(a,v)):f;
export function normalizeVehicleAppearanceCondition(input={}){
 const c={};for(const key of ['engine','oil','brakes','tires','body','paint','fuel','steering','suspension'])c[key]=clamp(input?.[key]);c.dirt=clamp(input?.dirt,0,100,0);
 c.damageZones={};for(const key of ['front','rear','left','right','roof'])c.damageZones[key]=clamp(input?.damageZones?.[key],0,1,0);return c;
}
const FIELDS=[['front',[-.88,.005,0],[.25,.23,.50],[1,0,0]],['rear',[.84,-.005,0],[.23,.22,.5],[-1,0,0]],['left',[-.06,.01,-.35],[.70,.24,.105],[0,0,1]],['right',[-.06,.01,.35],[.70,.24,.105],[0,0,-1]],['roof',[.09,.28,0],[.42,.15,.28],[0,-1,0]]];
function displacement(p,c,out){out[0]=out[1]=out[2]=0;const global=1-c.body/100,localized=Object.values(c.damageZones).some(x=>x>0);for(const [key,center,radius,direction] of FIELDS){const hit=c.damageZones[key]||(localized?0:global*.5);if(!hit)continue;let d=0;for(let k=0;k<3;k++)d+=((p[k]-center[k])/radius[k])**2;const amount=Math.exp(-d*2.7)*Math.max(global*.72,hit)*.058;const crease=.72+.28*Math.cos((p[0]+p[1]*.7+p[2]) * 34);for(let k=0;k<3;k++)out[k]+=direction[k]*amount*crease;}return out;}
export function damageDisplacement(position,condition={}){return displacement(position,normalizeVehicleAppearanceCondition(condition),[0,0,0]);}
export function createVehicleConditionAppearance(T){
 let condition=normalizeVehicleAppearanceCondition(),bodyKey='',disposed=false;const surfaces=[],owned=new Set(),originals=new Set();const p=new T.Vector3(),local=new T.Vector3(),delta=[0,0,0];
 function decoded(attribute){if(!attribute)return null;const values=new Float32Array(attribute.count*3);for(let i=0;i<attribute.count;i++){values[i*3]=attribute.getX(i);values[i*3+1]=attribute.getY(i);values[i*3+2]=attribute.getZ(i);}return values;}
 function apply(surface){const {mesh,base,matrix,inverse}=surface;const severity=1-condition.body/100,hasDamage=severity>0||Object.values(condition.damageZones).some(v=>v>0);if(!hasDamage&&!surface.changed)return;
  if(!surface.changed){originals.add(mesh.geometry);mesh.geometry=mesh.geometry.clone();mesh.geometry.setAttribute('position',new T.Float32BufferAttribute(base.slice(),3));if(surface.normals)mesh.geometry.setAttribute('normal',new T.Float32BufferAttribute(surface.normals.slice(),3));owned.add(mesh.geometry);surface.changed=true;}
  const pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i++){p.fromArray(base,i*3).applyMatrix4(matrix);displacement([p.x,p.y,p.z],condition,delta);p.x+=delta[0];p.y+=delta[1];p.z+=delta[2];local.copy(p).applyMatrix4(inverse);pos.setXYZ(i,local.x,local.y,local.z);}if(!hasDamage)pos.array.set(base);pos.needsUpdate=true;if(!hasDamage&&surface.normals){mesh.geometry.attributes.normal.array.set(surface.normals);mesh.geometry.attributes.normal.needsUpdate=true;}else mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 }
 return {add(mesh,matrix){if(disposed||!mesh.geometry?.attributes.position)return false;const surface={mesh,base:decoded(mesh.geometry.attributes.position),normals:decoded(mesh.geometry.attributes.normal),matrix:matrix.clone(),inverse:matrix.clone().invert(),changed:false};surfaces.push(surface);apply(surface);return true;},
  set(value){if(disposed)return false;condition=normalizeVehicleAppearanceCondition(value);const next=JSON.stringify([condition.body,condition.damageZones]);if(next!==bodyKey){bodyKey=next;surfaces.forEach(apply);}return true;},
  originalGeometries:()=>Array.from(originals),
  diagnostics:()=>({condition:structuredClone(condition),surfaces:surfaces.length,deformedGeometries:owned.size,disposed}),
  // Geometry now belongs to the presentation and is disposed with its GLB tree.
  dispose(){if(disposed)return false;disposed=true;surfaces.length=0;owned.clear();return true;}
 };
}
