/** Immutable segment BVH for visual road fields. Same segment interpolation as the
 * former grid scan; nearest-first bounding boxes avoid per-vertex string/array churn. */
export function createSegmentField(samples,{pairs}={}){
 const segments=(pairs||samples.slice(1).map((b,i)=>({a:samples[i],b}))).map(({a,b},i)=>{const x=a.position[0],z=a.position[2],vx=b.position[0]-x,vz=b.position[2]-z;return {a,b,i,x,z,vx,vz,length2:vx*vx+vz*vz||1,minX:Math.min(x,x+vx),maxX:Math.max(x,x+vx),minZ:Math.min(z,z+vz),maxZ:Math.max(z,z+vz)};});
 function build(items){if(!items.length)return null;let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;for(const s of items){minX=Math.min(minX,s.minX);minZ=Math.min(minZ,s.minZ);maxX=Math.max(maxX,s.maxX);maxZ=Math.max(maxZ,s.maxZ);}const node={minX,minZ,maxX,maxZ};if(items.length<=8){node.items=items;return node;}const x=maxX-minX>=maxZ-minZ;items.sort((a,b)=>x?a.minX+a.maxX-b.minX-b.maxX:a.minZ+a.maxZ-b.minZ-b.maxZ);const mid=items.length>>1;node.left=build(items.slice(0,mid));node.right=build(items.slice(mid));return node;}
 const root=build(segments);
 return (x,z,maxDistance=1500)=>{
  let bestD=maxDistance*maxDistance,best=null,bestU=0;
  const distance=node=>{const dx=Math.max(node.minX-x,0,x-node.maxX),dz=Math.max(node.minZ-z,0,z-node.maxZ);return dx*dx+dz*dz;};
  function visit(node){if(!node||distance(node)>bestD)return;if(node.items){for(const s of node.items){const u=Math.max(0,Math.min(1,((x-s.x)*s.vx+(z-s.z)*s.vz)/s.length2)),dx=x-s.x-s.vx*u,dz=z-s.z-s.vz*u,d=dx*dx+dz*dz;if(d<bestD||(best&&d===bestD&&s.i<best.i)){bestD=d;best=s;bestU=u;}}return;}
   if(distance(node.left)<distance(node.right)){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}
  }visit(root);if(!best)return null;const {a,b}=best;return {distance:Math.sqrt(bestD),height:a.position[1]+(b.position[1]-a.position[1])*bestU,sM:a.sM+(b.sM-a.sM)*bestU,widthM:a.widthM+(b.widthM-a.widthM)*bestU};
 };
}
