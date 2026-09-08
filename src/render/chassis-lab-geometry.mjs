/** Parametric geometry from the supplied Chevy laboratory, expressed with Three.
 * The helper factory keeps the caller's Three version and owned GPU resources local.
 * Wheel profiles revolve around local Z; all lengths are metres. */
export const TAU=Math.PI*2;
export function createChassisGeometry(T,{geometries=new Set(),materials=new Set()}={}){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
 function group(name,parent=null,pos=[0,0,0]){const object=new T.Group();object.name=name;object.position.fromArray(pos);if(parent)parent.add(object);return object;}
 function material(name,hex,metallic=.7,roughness=.35){const result=new T.MeshStandardMaterial({name,color:hex,metalness:metallic,roughness,side:T.DoubleSide});materials.add(result);return result;}
 function mesh(parent,data,mat,name='detalle'){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.p,3));geometry.setIndex(data.i);
  if(data.n?.length===data.p.length)geometry.setAttribute('normal',new T.Float32BufferAttribute(data.n,3));else geometry.computeVertexNormals();
  if(data.uv)geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geometry.computeBoundingSphere();geometries.add(geometry);
  const result=new T.Mesh(geometry,mat);result.name=name;result.receiveShadow=true;result.castShadow=true;if(parent)parent.add(result);return result;
 }
function box(w,h,d){let p=[],n=[],i=[],uv=[];const x=w/2,y=h/2,z=d/2;
 const faces=[[[x,-y,-z],[x,y,-z],[x,y,z],[x,-y,z],[1,0,0]],[[-x,-y,z],[-x,y,z],[-x,y,-z],[-x,-y,-z],[-1,0,0]],[[ -x,y,-z],[-x,y,z],[x,y,z],[x,y,-z],[0,1,0]],[[-x,-y,z],[-x,-y,-z],[x,-y,-z],[x,-y,z],[0,-1,0]],[[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[0,0,1]],[[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z],[0,0,-1]]];
 for(const f of faces){const k=p.length/3;for(let j=0;j<4;j++){p.push(...f[j]);n.push(...f[4]);uv.push(j===1||j===2?1:0,j>1?1:0);}i.push(k,k+1,k+2,k,k+2,k+3);}return{p,n,i,uv};
}
/** Revolve a radial/axial profile about local Z. Each profile segment has its own
 * normal, so machined shoulders stay sharp while circumferences remain smooth. */
function lathe(profile,segments=64,start=0,sweep=TAU){const p=[],n=[],i=[],uv=[];
 for(let j=0;j<profile.length-1;j++){const a=profile[j],b=profile[j+1],dr=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dr,dz)||1;
  for(let k=0;k<segments;k++){const t=start+k/segments*sweep,u=start+(k+1)/segments*sweep,o=p.length/3;
   for(const [r,z,ang] of [[a[0],a[1],t],[a[0],a[1],u],[b[0],b[1],u],[b[0],b[1],t]]){p.push(r*Math.cos(ang),r*Math.sin(ang),z);n.push(dz/len*Math.cos(ang),dz/len*Math.sin(ang),-dr/len);uv.push(ang/TAU,z);}
   i.push(o,o+1,o+2,o,o+2,o+3);
  }
 }
 return{p,n,i,uv};
}
const ring=(outer,inner,depth,segments=64,start=0,sweep=TAU)=>lathe([[inner,-depth/2],[outer,-depth/2],[outer,depth/2],[inner,depth/2],[inner,-depth/2]],segments,start,sweep);
const cylinder=(r,d,segments=24)=>ring(r,0,d,segments);
function torus(major,minor,seg=64,tubeSeg=10,start=0,sweep=TAU){let profile=[];for(let j=0;j<=tubeSeg;j++){const a=j/tubeSeg*TAU;profile.push([major+minor*Math.cos(a),minor*Math.sin(a)]);}return lathe(profile,seg,start,sweep);}
function sphere(r,seg=16,rings=10){const p=[],n=[],i=[];for(let j=0;j<=rings;j++){const a=j/rings*Math.PI;for(let k=0;k<=seg;k++){const b=k/seg*TAU,x=Math.sin(a)*Math.cos(b),y=Math.cos(a),z=Math.sin(a)*Math.sin(b);p.push(x*r,y*r,z*r);n.push(x,y,z);if(j<rings&&k<seg){const o=j*(seg+1)+k;i.push(o,o+1,o+seg+2,o,o+seg+2,o+seg+1);}}}return{p,n,i};}
function transformed(data,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){
 const p=[],n=[],matrix=new T.Matrix4().compose(V(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot,'YXZ')),V(...scale)),normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
 for(let j=0;j<data.p.length;j+=3){p.push(...V(data.p[j],data.p[j+1],data.p[j+2]).applyMatrix4(matrix).toArray());if(data.n)n.push(...V(data.n[j],data.n[j+1],data.n[j+2]).applyMatrix3(normalMatrix).normalize().toArray());}
 return {p,n:data.n?n:undefined,i:data.i.slice(),uv:data.uv};
}
function merge(items){const p=[],n=[],i=[],uv=[];let hasN=true,hasUV=true;for(const d of items){const o=p.length/3;for(const v of d.p)p.push(v);if(d.n){for(const v of d.n)n.push(v);}else hasN=false;if(d.uv){for(const v of d.uv)uv.push(v);}else hasUV=false;for(const x of d.i)i.push(x+o);}return{p,i,n:hasN?n:undefined,uv:hasUV?uv:undefined};}
function tube(points,r=.008,sides=8){
 const p=[],n=[],i=[],pts=points.map(point=>point.isVector3?point:V(...point));
 for(let j=0;j<pts.length;j++){
  const tangent=pts[Math.min(j+1,pts.length-1)].clone().sub(pts[Math.max(0,j-1)]).normalize(),reference=Math.abs(tangent.y)<.85?V(0,1,0):V(1,0,0),u=V().crossVectors(tangent,reference).normalize(),v=V().crossVectors(tangent,u).normalize();
  for(let k=0;k<=sides;k++){const a=k/sides*TAU,normal=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a)),point=pts[j].clone().addScaledVector(normal,r);p.push(...point.toArray());n.push(...normal.toArray());if(j<pts.length-1&&k<sides){const o=j*(sides+1)+k;i.push(o,o+1,o+sides+2,o,o+sides+2,o+sides+1);}}
 }
 return {p,n,i};
}
function coil(radius=.055,length=.30,turns=8,wire=.008){const pts=[];for(let i=0;i<=turns*24;i++){const t=i/(turns*24),a=t*turns*TAU;pts.push([radius*Math.cos(a),length*(t-.5),radius*Math.sin(a)]);}return tube(pts,wire,8);}
function spoke(r1,r2,width,depth,angle,z=0){return transformed(box(r2-r1,width,depth),[(r1+r2)/2*Math.cos(angle),(r1+r2)/2*Math.sin(angle),z],[0,0,angle]);}
function boltCircle(count,r,boltR=.008,depth=.026,z=0,offset=0){const d=[];for(let i=0;i<count;i++){const a=i/count*TAU+offset;d.push(transformed(cylinder(boltR,depth,6),[r*Math.cos(a),r*Math.sin(a),z]));}return merge(d);}
function rod(parent,a,b,r,mat,name='barra'){const object=mesh(parent,cylinder(r,1,12),mat,name);setRod(object,a,b);return object;}
function setRod(object,a,b){
 const start=a.isVector3?a:V(...a),end=b.isVector3?b:V(...b),direction=end.clone().sub(start),length=direction.length();
 object.position.copy(start).add(end).multiplyScalar(.5);object.scale.z=Math.max(length,.0001);
 if(length>1e-10)object.quaternion.setFromUnitVectors(V(0,0,1),direction.multiplyScalar(1/length));else object.quaternion.identity();
}

return {V,group,material,mesh,box,lathe,ring,cylinder,torus,sphere,transformed,merge,tube,coil,spoke,boltCircle,rod,setRod,geometries,materials};
}
