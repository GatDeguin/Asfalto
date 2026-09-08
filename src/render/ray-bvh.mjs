// Stackless, depth-first BVH. Leaves retain exact source triangles; no proxy boxes.
export function buildRayBvh(vertices) {
  const count=Math.floor(vertices.length/9),ids=Array.from({length:count},(_,i)=>i),nodes=[],ordered=[];
  const center=(id,axis)=>(vertices[id*9+axis]+vertices[id*9+3+axis]+vertices[id*9+6+axis])/3;
  function split(first,end) {
    const index=nodes.length,node={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],first:-1,count:0,escape:0};nodes.push(node);
    for(let i=first;i<end;i++)for(let v=0;v<3;v++)for(let a=0;a<3;a++){const x=vertices[ids[i]*9+v*3+a];node.min[a]=Math.min(node.min[a],x);node.max[a]=Math.max(node.max[a],x);}
    if(end-first<=4){node.first=ordered.length;node.count=end-first;for(let i=first;i<end;i++)ordered.push(ids[i]);}
    else {const extent=node.max.map((v,a)=>v-node.min[a]),axis=extent.indexOf(Math.max(...extent)),slice=ids.slice(first,end).sort((a,b)=>center(a,axis)-center(b,axis));for(let i=0;i<slice.length;i++)ids[first+i]=slice[i];const mid=(first+end)>>1;split(first,mid);split(mid,end);}
    node.escape=nodes.length;return index;
  }
  if(count)split(0,count);
  const bounds=new Float32Array(Math.max(8,nodes.length*8)),triangles=new Float32Array(Math.max(12,count*12));
  nodes.forEach((n,i)=>{bounds.set(n.min,i*8);bounds[i*8+3]=n.first<0?-1:n.first*8+n.count;bounds.set(n.max,i*8+4);bounds[i*8+7]=n.escape;});
  ordered.forEach((id,i)=>{const offset=id*9,out=i*12;for(let a=0;a<3;a++){triangles[out+a]=vertices[offset+a];triangles[out+4+a]=vertices[offset+3+a]-vertices[offset+a];triangles[out+8+a]=vertices[offset+6+a]-vertices[offset+a];}});
  return {bounds,triangles,nodeCount:nodes.length,triangleCount:count};
}
export function traceRayBvh(bvh,origin,direction,maxDistance=Infinity) {
  const {bounds:b,triangles:t}=bvh;let node=0,nearest=maxDistance,hit=false;
  while(node<bvh.nodeCount){const p=node*8;let near=0,far=nearest;
    for(let a=0;a<3;a++){if(Math.abs(direction[a])<1e-12){if(origin[a]<b[p+a]||origin[a]>b[p+4+a]){far=-1;break;}}else{let t0=(b[p+a]-origin[a])/direction[a],t1=(b[p+4+a]-origin[a])/direction[a];if(t0>t1)[t0,t1]=[t1,t0];near=Math.max(near,t0);far=Math.min(far,t1);}}
    if(far<near){node=b[p+7];continue;}
    if(b[p+3]<0){node++;continue;}
    const first=Math.floor(b[p+3]/8),count=b[p+3]%8;
    for(let j=0;j<count;j++){const i=(first+j)*12,a=t.subarray(i,i+3),e1=t.subarray(i+4,i+7),e2=t.subarray(i+8,i+11),pvec=[direction[1]*e2[2]-direction[2]*e2[1],direction[2]*e2[0]-direction[0]*e2[2],direction[0]*e2[1]-direction[1]*e2[0]],det=e1[0]*pvec[0]+e1[1]*pvec[1]+e1[2]*pvec[2];if(Math.abs(det)<1e-9)continue;
      const v=[origin[0]-a[0],origin[1]-a[1],origin[2]-a[2]],u=(v[0]*pvec[0]+v[1]*pvec[1]+v[2]*pvec[2])/det;if(u<0||u>1)continue;const q=[v[1]*e1[2]-v[2]*e1[1],v[2]*e1[0]-v[0]*e1[2],v[0]*e1[1]-v[1]*e1[0]],w=(direction[0]*q[0]+direction[1]*q[1]+direction[2]*q[2])/det;if(w<0||u+w>1)continue;const distance=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])/det;if(distance>.00001&&distance<nearest){nearest=distance;hit=true;}
    }node++;
  }return hit?nearest:Infinity;
}
