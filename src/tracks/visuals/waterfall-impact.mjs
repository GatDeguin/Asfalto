// Intersect a delivered curtain with actual horizontal basin triangles, not their bounding boxes.
function triangles(T,mesh){
 const g=mesh.geometry,p=g?.attributes?.position,index=g?.index,rows=[];if(!p)return rows;
 const point=new T.Vector3();for(let i=0;i<(index?.count||p.count);i+=3){const row=[];for(let j=0;j<3;j++)row.push(point.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray());rows.push(row);}return rows;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
function clipSegment(a,b,t){
 const sign=Math.sign(cross(t[0],t[1],t[2]));if(!sign)return null;let lo=0,hi=1;
 for(let i=0;i<3;i++){const p=t[i],q=t[(i+1)%3],fa=sign*cross(p,q,a),fb=sign*cross(p,q,b),delta=fb-fa;
  if(Math.abs(delta)<1e-9){if(fa<-.00001)return null;continue;}
  const at=-fa/delta;if(delta>0)lo=Math.max(lo,at);else hi=Math.min(hi,at);if(lo>=hi)return null;
 }
 return [a.map((v,i)=>v+(b[i]-v)*lo),a.map((v,i)=>v+(b[i]-v)*hi)];
}
export function findWaterfallImpact(T,fall,riverMeshes){
 const fallTriangles=triangles(T,fall),sum=[0,0,0],sources=new Set(),segments=[];let length=0;
 for(const river of riverMeshes)for(const water of triangles(T,river)){
  const waterY=(water[0][1]+water[1][1]+water[2][1])/3;if(water.some(p=>Math.abs(p[1]-waterY)>.01))continue;
  const xmin=Math.min(...water.map(p=>p[0])),xmax=Math.max(...water.map(p=>p[0])),zmin=Math.min(...water.map(p=>p[2])),zmax=Math.max(...water.map(p=>p[2]));
  for(const triangle of fallTriangles){
   if(triangle.every(p=>p[1]>waterY)||triangle.every(p=>p[1]<waterY)||triangle.every(p=>p[0]<xmin)||triangle.every(p=>p[0]>xmax)||triangle.every(p=>p[2]<zmin)||triangle.every(p=>p[2]>zmax))continue;
   const crossings=[];for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],dy=b[1]-a[1];if(Math.abs(dy)<1e-9)continue;const f=(waterY-a[1])/dy;if(f>=0&&f<=1){const p=a.map((v,k)=>v+(b[k]-v)*f);if(!crossings.some(q=>Math.hypot(...q.map((v,k)=>v-p[k]))<1e-6))crossings.push(p);}}
   if(crossings.length!==2)continue;const clipped=clipSegment(...crossings,water);if(!clipped)continue;const [a,b]=clipped,l=Math.hypot(a[0]-b[0],a[2]-b[2]);if(l<1e-5)continue;
   length+=l;segments.push({a,b});sources.add(river.name);for(let k=0;k<3;k++)sum[k]+=(a[k]+b[k])*.5*l;
  }
 }
 return length>0?{impactCenter:sum.map(v=>v/length),impactSpanM:length,impactSegments:segments,impactSource:[...sources],impactMethod:'curtain_basin_triangle_intersection'}:null;
}
