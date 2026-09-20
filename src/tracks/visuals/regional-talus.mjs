// Low, battered stone buttresses at genuine uphill bends. Road/collision/source terrain remain untouched.
const rand=n=>{const x=Math.sin(n*13.17+4.3)*41518.13;return x-Math.floor(x);};
const pointAt=(q,offset)=>q.position.map((v,i)=>v+q.frame.left[i]*offset);
export function planRetainingTalus({query,lengthM,heightAt,maxSections=24}){
 const plans=[];
 for(let s=200;s<lengthM-200&&plans.length<maxSections;s+=180){
  const a=query.sample(s-55).frame.tangent,b=query.sample(s+55).frame.tangent,turn=Math.atan2(a[0]*b[2]-a[2]*b[0],a[0]*b[0]+a[2]*b[2]);
  if(Math.abs(turn)<.055||plans.some(p=>Math.abs(p.sM-s)<650))continue;
  const q=query.sample(s);
  for(const side of [-1,1]){
   const near=pointAt(q,side*((q.widthM||8)/2+7)),far=pointAt(q,side*((q.widthM||8)/2+29));
   const nearY=heightAt(near[0],near[2]),farY=heightAt(far[0],far[2]);
   if(!Number.isFinite(nearY)||!Number.isFinite(farY)||farY-nearY<2.2||farY-nearY>14)continue;
   let clear=true;for(let station=s-72;station<=s+72;station+=12){const t=query.sample(station);for(const d of [7,10,17,29]){const p=pointAt(t,side*((t.widthM||8)/2+d)),h=heightAt(p[0],p[2]),road=query.project?.(p);if(!Number.isFinite(h)||road&&road.distanceXZ<road.widthM/2+6.5)clear=false;}}
   if(clear){plans.push({sM:s,side,startM:s-72,endM:s+72,riseM:farY-nearY});break;}
  }
 }
 return plans;
}
export function buildRetainingTalusGeometry(T,plan,{query,heightAt}){
 const positions=[],uv=[],index=[],color=[],rows=[7,10,17,29],steps=24;
 for(let i=0;i<=steps;i++){
  const s=plan.startM+(plan.endM-plan.startM)*i/steps,q=query.sample(s),endFade=Math.sin(Math.PI*i/steps)**2;
  for(let k=0;k<rows.length;k++){
   const p=pointAt(q,plan.side*((q.widthM||8)/2+rows[k])),y=heightAt(p[0],p[2]);if(!Number.isFinite(y))return null;
   p[1]=y+.028+endFade*([0,1.8,.48,0][k]);positions.push(...p);uv.push(s/4,rows[k]/3);
   const tint=.87+rand(Math.floor(s/24)+k)*.16;color.push(tint,tint*.98,tint*.94);
   if(i&&k){const a=(i-1)*4+k-1,b=a+1,c=i*4+k-1,d=c+1;index.push(a,c,d,a,d,b);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(index);g.computeVertexNormals();
 const n=g.attributes.normal;let mean=0;for(let i=0;i<n.count;i++)mean+=n.getY(i);if(mean<0){for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];g.setIndex(index);g.computeVertexNormals();}
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function addRetainingTalus(T,group,{query,lengthM,heightAt,material}){
 const plans=planRetainingTalus({query,lengthM,heightAt}),accepted=[];
 for(const p of plans){const g=buildRetainingTalusGeometry(T,p,{query,heightAt});if(!g)continue;const mesh=new T.Mesh(g,material);mesh.name='ASFALTO_ENGINEERED_TALUS_'+Math.round(p.sM);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.asfaltoRetainingTalus={...p,roadClearanceM:7,maximumAddedHeightM:1.828};group.add(mesh);accepted.push(p);}
 return accepted;
}
